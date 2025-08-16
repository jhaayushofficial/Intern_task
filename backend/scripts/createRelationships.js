const { getSession, closeDriver } = require("../src/db/neo4j");

async function createRelationships() {
  const session = await getSession();
  try {
    console.log("Creating relationships between Users and Transactions...");

    // 0) Cleanup: remove stale relationships that no longer match criteria
    console.log("Cleaning up stale relationships...");
    // User-User SHARES_* where properties differ or missing
    await session.run(`
      MATCH (u1:User)-[r:SHARES_EMAIL]-(u2:User)
      WHERE u1.email IS NULL OR u2.email IS NULL OR u1.email <> u2.email
      DELETE r
    `);
    await session.run(`
      MATCH (u1:User)-[r:SHARES_PHONE]-(u2:User)
      WHERE u1.phone IS NULL OR u2.phone IS NULL OR u1.phone <> u2.phone
      DELETE r
    `);
    await session.run(`
      MATCH (u1:User)-[r:SHARES_IP]-(u2:User)
      WHERE u1.ip IS NULL OR u2.ip IS NULL OR u1.ip <> u2.ip
      DELETE r
    `);
    await session.run(`
      MATCH (u1:User)-[r:SHARES_DEVICE]-(u2:User)
      WHERE u1.deviceId IS NULL OR u2.deviceId IS NULL OR u1.deviceId <> u2.deviceId
      DELETE r
    `);
    await session.run(`
      MATCH (u1:User)-[r:SHARES_ADDRESS]-(u2:User)
      WHERE u1.address IS NULL OR u2.address IS NULL OR u1.address <> u2.address
      DELETE r
    `);

    // Tx-Tx SAME_* cleanup
    await session.run(`
      MATCH (t1:Transaction)-[r:SAME_IP]-(t2:Transaction)
      WHERE t1.ip IS NULL OR t2.ip IS NULL OR t1.ip <> t2.ip
      DELETE r
    `);
    await session.run(`
      MATCH (t1:Transaction)-[r:SAME_DEVICE]-(t2:Transaction)
      WHERE t1.deviceId IS NULL OR t2.deviceId IS NULL OR t1.deviceId <> t2.deviceId
      DELETE r
    `);
    await session.run(`
      MATCH (t1:Transaction)-[r:SAME_SENDER]-(t2:Transaction)
      WHERE NOT EXISTS {
        MATCH (su:User)-[:MADE]->(t1)
        MATCH (su)-[:MADE]->(t2)
      }
      DELETE r
    `);
    await session.run(`
      MATCH (t1:Transaction)-[r:SAME_RECEIVER]-(t2:Transaction)
      WHERE NOT EXISTS {
        MATCH (t1)-[:TO]->(ru:User)
        MATCH (t2)-[:TO]->(ru)
      }
      DELETE r
    `);

    // 1) User <-> User relationships based on shared attributes (bidirectional)
    console.log("Creating User-User relationships...");

    await session.run(`
      MATCH (u1:User), (u2:User)
      WHERE u1.id < u2.id AND u1.email IS NOT NULL AND u1.email = u2.email
      MERGE (u1)-[:SHARES_EMAIL]->(u2)
      MERGE (u2)-[:SHARES_EMAIL]->(u1)
    `);

    await session.run(`
      MATCH (u1:User), (u2:User)
      WHERE u1.id < u2.id AND u1.phone IS NOT NULL AND u1.phone = u2.phone
      MERGE (u1)-[:SHARES_PHONE]->(u2)
      MERGE (u2)-[:SHARES_PHONE]->(u1)
    `);

    await session.run(`
      MATCH (u1:User), (u2:User)
      WHERE u1.id < u2.id AND u1.ip IS NOT NULL AND u1.ip = u2.ip
      MERGE (u1)-[:SHARES_IP]->(u2)
      MERGE (u2)-[:SHARES_IP]->(u1)
    `);

    await session.run(`
      MATCH (u1:User), (u2:User)
      WHERE u1.id < u2.id AND u1.deviceId IS NOT NULL AND u1.deviceId = u2.deviceId
      MERGE (u1)-[:SHARES_DEVICE]->(u2)
      MERGE (u2)-[:SHARES_DEVICE]->(u1)
    `);

    await session.run(`
      MATCH (u1:User), (u2:User)
      WHERE u1.id < u2.id AND u1.address IS NOT NULL AND u1.address = u2.address
      MERGE (u1)-[:SHARES_ADDRESS]->(u2)
      MERGE (u2)-[:SHARES_ADDRESS]->(u1)
    `);

    // 2) User -> Transaction MADE and Transaction -> User TO (directional)
    console.log("Creating User-Transaction relationships...");
    await session.run(`
      MATCH (u:User), (t:Transaction)
      WHERE u.id = t.fromUserId
      MERGE (u)-[:MADE]->(t)
    `);

    await session.run(`
      MATCH (u:User), (t:Transaction)
      WHERE u.id = t.toUserId
      MERGE (t)-[:TO]->(u)
    `);

    // 3) Transaction <-> Transaction relationships based on shared attributes (bidirectional)
    console.log("Creating Transaction-Transaction relationships...");
    await session.run(`
      MATCH (t1:Transaction), (t2:Transaction)
      WHERE t1.id < t2.id AND t1.ip IS NOT NULL AND t1.ip = t2.ip
      MERGE (t1)-[:SAME_IP]->(t2)
      MERGE (t2)-[:SAME_IP]->(t1)
    `);

    await session.run(`
      MATCH (t1:Transaction), (t2:Transaction)
      WHERE t1.id < t2.id AND t1.deviceId IS NOT NULL AND t1.deviceId = t2.deviceId
      MERGE (t1)-[:SAME_DEVICE]->(t2)
      MERGE (t2)-[:SAME_DEVICE]->(t1)
    `);

    await session.run(`
      MATCH (su:User)-[:MADE]->(t1:Transaction)
      MATCH (su)-[:MADE]->(t2:Transaction)
      WHERE t1.id < t2.id
      MERGE (t1)-[:SAME_SENDER]->(t2)
      MERGE (t2)-[:SAME_SENDER]->(t1)
    `);

    await session.run(`
      MATCH (t1:Transaction)-[:TO]->(ru:User)
      MATCH (t2:Transaction)-[:TO]->(ru)
      WHERE t1.id < t2.id
      MERGE (t1)-[:SAME_RECEIVER]->(t2)
      MERGE (t2)-[:SAME_RECEIVER]->(t1)
    `);

    console.log("All relationships created successfully!");

    // 5) Mirror any existing one-way edges to enforce bidirectionality (safety net)
    const mirrorTypes = [
      "SHARES_EMAIL",
      "SHARES_PHONE",
      "SHARES_IP",
      "SHARES_DEVICE",
      "SHARES_ADDRESS",
      "SAME_IP",
      "SAME_DEVICE",
      "SAME_SENDER",
      "SAME_RECEIVER",
    ];
    for (const t of mirrorTypes) {
      const q = `MATCH (a)-[:${t}]->(b) MERGE (b)-[:${t}]->(a)`;
      await session.run(q);
    }

    // 6) Stats
    const stats = await session.run(`
      MATCH ()-[r]->()
      RETURN type(r) as relationshipType, count(r) as count
      ORDER BY count DESC
    `);
    console.log("\nRelationship Statistics:");
    stats.records.forEach((record) => {
      console.log(`${record.get("relationshipType")}: ${record.get("count")}`);
    });
  } catch (error) {
    console.error("Error creating relationships:", error.message);
  } finally {
    await session.close();
    await closeDriver();
  }
}

if (require.main === module) {
  createRelationships();
}

module.exports = { createRelationships };
