const { getSession, closeDriver } = require("../src/db/neo4j");
const USER_CYPHER = require("../cyphers/userCypher");

async function seedUsers() {
  const session = await getSession();
  try {
    console.log("Resetting database (deleting all nodes and relationships)...");
    await session.run("MATCH (n) DETACH DELETE n");
    console.log("All nodes deleted.");

    console.log("Seeding users only (no transactions)...");
    const users = [
      {
        id: "userA",
        name: "Alice",
        email: "alice@example.com",
        phone: "+1000001",
        address: "1 Alpha Rd",
        ip: "192.168.1.100",
        deviceId: "device_alice_123",
        paymentMethod: "Credit Card",
      },
      {
        id: "userB",
        name: "Bob",
        email: "bob@example.com",
        phone: "+1000002",
        address: "2 Beta Rd",
        ip: "192.168.1.101",
        deviceId: "device_bob_456",
        paymentMethod: "Credit Card",
      },
    ];

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

    console.log("Seed complete: users created.");
  } catch (err) {
    console.error("Error during user seed:", err.message);
    process.exitCode = 1;
  } finally {
    await session.close();
    await closeDriver();
  }
}

if (require.main === module) {
  seedUsers();
}

module.exports = { seedUsers };
