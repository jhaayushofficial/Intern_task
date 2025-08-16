const { getSession, closeDriver } = require("../src/db/neo4j");

async function createConstraints() {
  const session = await getSession();
  try {
    console.log("Creating Neo4j constraints...");

    // Create unique constraints for User and Transaction IDs
    await session.run(
      "CREATE CONSTRAINT user_id_unique IF NOT EXISTS FOR (u:User) REQUIRE u.id IS UNIQUE"
    );

    await session.run(
      "CREATE CONSTRAINT transaction_id_unique IF NOT EXISTS FOR (t:Transaction) REQUIRE t.id IS UNIQUE"
    );

    // Create indexes for better query performance
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
      "CREATE INDEX transaction_ip_index IF NOT EXISTS FOR (t:Transaction) ON (t.ip)"
    );

    await session.run(
      "CREATE INDEX transaction_device_index IF NOT EXISTS FOR (t:Transaction) ON (t.deviceId)"
    );

    // New per-party transaction fields
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

    console.log("Constraints and indexes created successfully!");
  } catch (error) {
    console.error("Error creating constraints:", error.message);
  } finally {
    await session.close();
    await closeDriver();
  }
}

if (require.main === module) {
  createConstraints();
}

module.exports = { createConstraints };
