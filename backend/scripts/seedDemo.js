const { getSession, closeDriver } = require("../src/db/neo4j");
const USER_CYPHER = require("../cyphers/userCypher");
const TX_CYPHER = require("../cyphers/transactionCypher");

function nowIso(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60 * 1000);
  return d.toISOString();
}

async function seedDemo() {
  const session = await getSession();
  try {
    console.log("Resetting database (deleting all nodes and relationships)...");
    await session.run("MATCH (n) DETACH DELETE n");
    console.log(
      "All nodes deleted. Creating constraints/indexes if missing..."
    );
    // Create constraints and indexes in the same session to avoid closing the driver
    await session.run(
      "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE"
    );
    await session.run(
      "CREATE CONSTRAINT transaction_id_unique IF NOT EXISTS FOR (t:Transaction) REQUIRE t.id IS UNIQUE"
    );
    await session.run(
      "CREATE INDEX user_email_index IF NOT EXISTS FOR (u:User) ON (u.email)"
    );
    await session.run(
      "CREATE INDEX user_phone_index IF NOT EXISTS FOR (u:User) ON (u.phone)"
    );
    await session.run(
      "CREATE INDEX user_ip_index IF NOT EXISTS FOR (u:User) ON (u.ip)"
    );
    await session.run(
      "CREATE INDEX user_device_index IF NOT EXISTS FOR (u:User) ON (u.deviceId)"
    );
    await session.run(
      "CREATE INDEX user_payment_method_index IF NOT EXISTS FOR (u:User) ON (u.paymentMethod)"
    );
    await session.run(
      "CREATE INDEX transaction_sender_ip_index IF NOT EXISTS FOR (t:Transaction) ON (t.senderIp)"
    );
    await session.run(
      "CREATE INDEX transaction_receiver_ip_index IF NOT EXISTS FOR (t:Transaction) ON (t.receiverIp)"
    );
    await session.run(
      "CREATE INDEX transaction_sender_device_index IF NOT EXISTS FOR (t:Transaction) ON (t.senderDeviceId)"
    );
    await session.run(
      "CREATE INDEX transaction_receiver_device_index IF NOT EXISTS FOR (t:Transaction) ON (t.receiverDeviceId)"
    );

    // --- Users: At least 5, with shared attributes to create user-to-user links ---
    const users = [
      // u1 shares email with u3, ip with u2, device with u4, payment with u6
      {
        id: "u1",
        name: "Alice Alpha",
        email: "shared1@demo.com",
        phone: "+1111111",
        address: "1 Alpha Rd",
        ip: "10.0.0.10",
        deviceId: "dev-A",
        paymentMethod: "UPI",
      },
      // u2 shares phone with u5 and ip with u1
      {
        id: "u2",
        name: "Bob Beta",
        email: "bob@demo.com",
        phone: "+2222222",
        address: "2 Beta St",
        ip: "10.0.0.10",
        deviceId: "dev-B",
        paymentMethod: "Credit Card",
      },
      // u3 shares email with u1
      {
        id: "u3",
        name: "Cara Gamma",
        email: "shared1@demo.com",
        phone: "+3333333",
        address: "3 Gamma Ave",
        ip: "10.0.0.11",
        deviceId: "dev-C",
        paymentMethod: "Debit Card",
      },
      // u4 shares device with u1
      {
        id: "u4",
        name: "Dan Delta",
        email: "dan@demo.com",
        phone: "+4444444",
        address: "4 Delta Blvd",
        ip: "10.0.0.12",
        deviceId: "dev-A",
        paymentMethod: "Credit Card",
      },
      // u5 shares phone with u2
      {
        id: "u5",
        name: "Eve Epsilon",
        email: "eve@demo.com",
        phone: "+2222222",
        address: "5 Epsilon Way",
        ip: "10.0.0.13",
        deviceId: "dev-D",
        paymentMethod: "Debit Card",
      },
      // u6 shares payment method with u1 (UPI)
      {
        id: "u6",
        name: "Finn Zeta",
        email: "finn@demo.com",
        phone: "+6666666",
        address: "6 Zeta Loop",
        ip: "10.0.0.14",
        deviceId: "dev-E",
        paymentMethod: "UPI",
      },
    ];

    console.log(`Creating ${users.length} users...`);
    for (const u of users) {
      await session.run(USER_CYPHER.CREATE_USER, {
        id: u.id,
        props: u,
        phone: u.phone ?? null,
        email: u.email ?? null,
        ip: u.ip ?? null,
        deviceId: u.deviceId ?? null,
        paymentMethod: u.paymentMethod ?? null,
      });
    }

    // --- Transactions: At least 10 with mixed direct (MADE/TO) and indirect (SAME_*) links ---
    const txs = [
      // t1 & t2 share senderIp; t1 & t6 share senderDeviceId; t1 & t3 share receiverDeviceId
      {
        id: "t1",
        amount: 100.25,
        timestamp: nowIso(0),
        fromUserId: "u1",
        toUserId: "u2",
        senderIp: "1.2.3.4",
        receiverIp: "9.9.9.1",
        senderDeviceId: "devA-1",
        receiverDeviceId: "devR-1",
      },
      {
        id: "t2",
        amount: 57.5,
        timestamp: nowIso(1),
        fromUserId: "u1",
        toUserId: "u3",
        senderIp: "1.2.3.4", // SAME_SENDER_IP with t1
        receiverIp: "9.9.9.2",
        senderDeviceId: "devA-2",
        receiverDeviceId: "devR-2",
      },
      {
        id: "t3",
        amount: 210.0,
        timestamp: nowIso(2),
        fromUserId: "u2",
        toUserId: "u5",
        senderIp: "2.2.2.2",
        receiverIp: "9.9.9.1",
        senderDeviceId: "devB-1",
        receiverDeviceId: "devR-1", // SAME_RECEIVER_DEVICE with t1
      },
      {
        id: "t4",
        amount: 75.0,
        timestamp: nowIso(3),
        fromUserId: "u4",
        toUserId: "u6",
        senderIp: "3.3.3.3",
        receiverIp: "9.9.9.9",
        senderDeviceId: "devA-1",
        receiverDeviceId: "devR-3",
      },
      {
        id: "t5",
        amount: 33.33,
        timestamp: nowIso(4),
        fromUserId: "u5",
        toUserId: "u4",
        senderIp: "4.4.4.4",
        receiverIp: "9.9.9.9", // SAME_RECEIVER_IP with t4
        senderDeviceId: "devD-1",
        receiverDeviceId: "devR-4",
      },
      {
        id: "t6",
        amount: 999.99,
        timestamp: nowIso(5),
        fromUserId: "u1",
        toUserId: "u5",
        senderIp: "6.6.6.6",
        receiverIp: "9.9.9.5",
        senderDeviceId: "devA-1", // SAME_SENDER_DEVICE with t1
        receiverDeviceId: "devR-5",
      },
      {
        id: "t7",
        amount: 10.0,
        timestamp: nowIso(6),
        fromUserId: "u3",
        toUserId: "u2",
        senderIp: "7.7.7.7",
        receiverIp: "9.9.9.7",
        senderDeviceId: "devC-1",
        receiverDeviceId: "devR-2", // aligns with t2 receiverDeviceId to create SAME_RECEIVER_DEVICE
      },
      {
        id: "t8",
        amount: 48.5,
        timestamp: nowIso(7),
        fromUserId: "u3",
        toUserId: "u4",
        senderIp: "5.5.5.5",
        receiverIp: "9.9.9.8",
        senderDeviceId: "devC-2",
        receiverDeviceId: "devR-6",
      },
      {
        id: "t9",
        amount: 64.0,
        timestamp: nowIso(8),
        fromUserId: "u5",
        toUserId: "u6",
        senderIp: "5.5.5.5", // SAME_SENDER_IP with t8
        receiverIp: "9.9.9.6",
        senderDeviceId: "devD-2",
        receiverDeviceId: "devR-7",
      },
      {
        id: "t10",
        amount: 120.0,
        timestamp: nowIso(9),
        fromUserId: "u6",
        toUserId: "u1",
        senderIp: "8.8.8.8",
        receiverIp: "7.7.7.7", // will pair with t12 receiverIp
        senderDeviceId: "devE-1",
        receiverDeviceId: "devR-8",
      },
      {
        id: "t11",
        amount: 5.0,
        timestamp: nowIso(10),
        fromUserId: "u2",
        toUserId: "u3",
        senderIp: "2.2.2.3",
        receiverIp: "9.9.9.10",
        senderDeviceId: "devB-2",
        receiverDeviceId: "devR-9",
      },
      {
        id: "t12",
        amount: 19.99,
        timestamp: nowIso(11),
        fromUserId: "u4",
        toUserId: "u2",
        senderIp: "3.3.3.4",
        receiverIp: "7.7.7.7", // SAME_RECEIVER_IP with t10
        senderDeviceId: "devA-3",
        receiverDeviceId: "devR-10",
      },
    ];

    console.log(`Creating ${txs.length} transactions...`);
    for (const t of txs) {
      await session.run(TX_CYPHER.CREATE_TRANSACTION, {
        id: t.id,
        props: {
          id: t.id,
          amount: t.amount,
          timestamp: t.timestamp,
          senderIp: t.senderIp ?? null,
          receiverIp: t.receiverIp ?? null,
          senderDeviceId: t.senderDeviceId ?? null,
          receiverDeviceId: t.receiverDeviceId ?? null,
        },
        fromUserId: t.fromUserId ?? null,
        toUserId: t.toUserId ?? null,
        senderIp: t.senderIp ?? null,
        receiverIp: t.receiverIp ?? null,
        senderDeviceId: t.senderDeviceId ?? null,
        receiverDeviceId: t.receiverDeviceId ?? null,
      });
    }

    console.log("Demo seed complete: users and transactions created.");
    // Quick summary counts
    const usersCount = await session.run("MATCH (u:User) RETURN count(u) AS c");
    const txCount = await session.run(
      "MATCH (t:Transaction) RETURN count(t) AS c"
    );
    const uuLinks = await session.run(
      "MATCH (:User)-[r:SHARES_EMAIL|SHARES_PHONE|SHARES_IP|SHARES_DEVICE|SHARES_PAYMENT_METHOD]->(:User) RETURN count(r) AS c"
    );
    const ttLinks = await session.run(
      "MATCH (:Transaction)-[r:SAME_SENDER_IP|SAME_RECEIVER_IP|SAME_SENDER_DEVICE|SAME_RECEIVER_DEVICE|SAME_SENDER|SAME_RECEIVER]->(:Transaction) RETURN count(r) AS c"
    );
    console.log(
      `Summary -> Users: ${usersCount.records[0]
        .get("c")
        .toString()}, Transactions: ${txCount.records[0]
        .get("c")
        .toString()}, U-U links: ${uuLinks.records[0]
        .get("c")
        .toString()}, T-T links: ${ttLinks.records[0].get("c").toString()}`
    );
  } catch (err) {
    console.error("Error during demo seed:", err.message);
    process.exitCode = 1;
  } finally {
    await session.close();
    await closeDriver();
  }
}

if (require.main === module) {
  seedDemo();
}

module.exports = { seedDemo };
