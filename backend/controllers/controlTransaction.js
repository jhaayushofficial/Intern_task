const { getSession, neo4j } = require("../src/db/neo4j");
const TX_CYPHER = require("../cyphers/transactionCypher");

// helper to check empty values (null, undefined, empty string)
function isBlank(v) {
  return (
    v === undefined || v === null || (typeof v === "string" && v.trim() === "")
  );
}

// Create transaction (id must be unique) and require all fields
async function createTransaction(req, res) {
  const {
    id,
    amount,
    timestamp,
    fromUserId,
    toUserId,
    // legacy fields
    ip,
    deviceId,
    // new fields
    senderIp,
    receiverIp,
    senderDeviceId,
    receiverDeviceId,
    ...props
  } = req.body || {};
  // Require all transaction fields on creation
  const required = {
    id,
    amount,
    timestamp,
    fromUserId,
    toUserId,
    senderIp: senderIp ?? ip,
    receiverIp,
    senderDeviceId: senderDeviceId ?? deviceId,
    receiverDeviceId,
  };
  const missing = Object.entries(required)
    .filter(([_, v]) => isBlank(v))
    .map(([k]) => k);
  if (missing.length) {
    return res
      .status(400)
      .json({
        error: `Missing required transaction fields: ${missing.join(", ")}`,
      });
  }
  if (!Number.isFinite(Number(amount))) {
    return res.status(400).json({ error: "amount must be a finite number" });
  }

  const session = await getSession(neo4j.session.WRITE);
  try {
    const exists = await session.run(TX_CYPHER.CHECK_TX_EXISTS, { id });
    if (exists.records.length) {
      return res.status(409).json({ error: "Transaction id already exists" });
    }

    const result = await session.run(TX_CYPHER.CREATE_TRANSACTION, {
      id,
      props: {
        id,
        amount,
        timestamp,
        ip: ip ?? null,
        deviceId: deviceId ?? null,
        senderIp: senderIp ?? ip ?? null,
        receiverIp: receiverIp ?? null,
        senderDeviceId: senderDeviceId ?? deviceId ?? null,
        receiverDeviceId: receiverDeviceId ?? null,
        ...props,
      },
      fromUserId: fromUserId ?? null,
      toUserId: toUserId ?? null,
      senderIp: senderIp ?? ip ?? null,
      receiverIp: receiverIp ?? null,
      senderDeviceId: senderDeviceId ?? deviceId ?? null,
      receiverDeviceId: receiverDeviceId ?? null,
    });
    const node = result.records[0]?.get("t");
    res.status(201).json(node?.properties || {});
  } catch (e) {
    if (
      e?.code &&
      (String(e.code).includes("Constraint") ||
        String(e.code).includes("Schema"))
    ) {
      return res.status(409).json({ error: "Transaction id already exists" });
    }
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
}

// Update transaction (only amount can be changed; must be provided and finite)
async function updateTransaction(req, res) {
  const id = req.params.id;
  const body = req.body || {};
  if (isBlank(body.amount)) {
    return res.status(400).json({ error: "amount is required on update" });
  }
  const amt = Number(body.amount);
  if (!Number.isFinite(amt)) {
    return res.status(400).json({ error: "amount must be a finite number" });
  }
  if (!id) return res.status(400).json({ error: "id is required" });

  // Only pass amount for update
  const props = { amount: amt };

  const session = await getSession(neo4j.session.WRITE);
  try {
    const result = await session.run(TX_CYPHER.UPDATE_TRANSACTION, {
      id,
      props,
      fromUserId: null,
      toUserId: null,
    });
    if (!result.records.length) {
      return res.status(404).json({ error: "Transaction not found" });
    }
    const node = result.records[0].get("t");
    res.status(200).json(node.properties || {});
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
}

// List transactions
async function listTransactions(_req, res) {
  const session = await getSession(neo4j.session.READ);
  try {
    const result = await session.run(TX_CYPHER.LIST_TRANSACTIONS_WITH_USERS);
    const list = result.records.map((r) => {
      const transaction = r.get("t").properties;
      const sender = r.get("sender")?.properties;
      const receiver = r.get("receiver")?.properties;

      return {
        ...transaction,
        senderIp: transaction.senderIp ?? null,
        receiverIp: transaction.receiverIp ?? null,
        senderDeviceId: transaction.senderDeviceId ?? null,
        receiverDeviceId: transaction.receiverDeviceId ?? null,
        senderName: sender?.name || null,
        senderEmail: sender?.email || null,
        senderPhone: sender?.phone || null,
        senderAddress: sender?.address || null,
        receiverName: receiver?.name || null,
        receiverEmail: receiver?.email || null,
        receiverPhone: receiver?.phone || null,
        receiverAddress: receiver?.address || null,
      };
    });
    res.json(list);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
}

module.exports = {
  createTransaction,
  updateTransaction,
  listTransactions,
};
