const { getSession, neo4j } = require("../src/db/neo4j");
const USER_CYPHER = require("../cyphers/userCypher");

// helper to check empty values (null, undefined, empty string)
function isBlank(v) {
  return (
    v === undefined || v === null || (typeof v === "string" && v.trim() === "")
  );
}

// Create a new user if not exists (all fields required)
async function createUser(req, res) {
  const {
    id,
    name,
    email,
    phone,
    ip,
    deviceId,
    paymentMethod,
    address,
    ...props
  } = req.body || {};
  const required = {
    id,
    name,
    email,
    phone,
    ip,
    deviceId,
    paymentMethod,
    address,
  };
  const missing = Object.entries(required)
    .filter(([_, v]) => isBlank(v))
    .map(([k]) => k);
  if (missing.length) {
    return res
      .status(400)
      .json({ error: `Missing required user fields: ${missing.join(", ")}` });
  }
  const session = await getSession(neo4j.session.WRITE);
  try {
    const existsResult = await session.run(USER_CYPHER.CHECK_USER_EXISTS, {
      id,
    });
    if (existsResult.records.length > 0) {
      return res
        .status(409)
        .json({ error: "User with this ID already exists" });
    }

    const result = await session.run(USER_CYPHER.CREATE_USER, {
      id,
      props: {
        id,
        name,
        email,
        phone,
        ip,
        deviceId,
        paymentMethod,
        address,
        ...props,
      },
      phone: phone ?? null,
      email: email ?? null,
      ip: ip ?? null,
      deviceId: deviceId ?? null,
      paymentMethod: paymentMethod ?? null,
    });
    const node = result.records[0]?.get("u");
    res.status(201).json(node?.properties || {});
  } catch (e) {
    console.error("/users error:", e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
}

// Update an existing user (cannot change id; require all other fields)
async function updateUser(req, res) {
  const { id } = req.params;
  const { name, email, phone, ip, deviceId, paymentMethod, address, ...props } =
    req.body || {};
  // If client attempts to send a different id in body, reject
  if (!isBlank(req.body?.id) && req.body.id !== id) {
    return res.status(400).json({ error: "Cannot update user id" });
  }
  const required = { name, email, phone, ip, deviceId, paymentMethod, address };
  const missing = Object.entries(required)
    .filter(([_, v]) => isBlank(v))
    .map(([k]) => k);
  if (missing.length) {
    return res
      .status(400)
      .json({
        error: `Missing required fields for update: ${missing.join(", ")}`,
      });
  }
  const session = await getSession(neo4j.session.WRITE);
  try {
    const result = await session.run(USER_CYPHER.UPDATE_USER, {
      id,
      props: {
        name,
        email,
        phone,
        ip,
        deviceId,
        paymentMethod,
        address,
        ...props,
      },
      phone: phone ?? null,
      email: email ?? null,
      ip: ip ?? null,
      deviceId: deviceId ?? null,
      paymentMethod: paymentMethod ?? null,
    });

    if (!result.records.length) {
      return res.status(404).json({ error: "User not found" });
    }

    const node = result.records[0]?.get("u");
    res.status(200).json(node?.properties || {});
  } catch (e) {
    console.error("/users PUT error:", e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
}

// List users
async function listUsers(_req, res) {
  const session = await getSession(neo4j.session.READ);
  try {
    const result = await session.run(USER_CYPHER.LIST_USERS);
    const users = result.records.map((r) => r.get("u").properties);
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
}

module.exports = { createUser, updateUser, listUsers };
