const { getSession, closeDriver } = require("../src/db/neo4j");

(async () => {
  const s = await getSession();
  try {
    const users = await s.run("MATCH (u:User) RETURN u ORDER BY u.id");
    console.log(
      "Users:",
      users.records.map((r) => r.get("u").properties)
    );

    const rels = await s.run(
      "MATCH (a:User)-[r:SHARES_PAYMENT_METHOD]-(b:User) RETURN a.id AS a, b.id AS b, type(r) AS t ORDER BY a, b"
    );
    console.log(
      "SHARES_PAYMENT_METHOD:",
      rels.records.map((r) => ({ a: r.get("a"), b: r.get("b"), t: r.get("t") }))
    );
  } catch (e) {
    console.error("Check error:", e.message);
    process.exitCode = 1;
  } finally {
    await s.close();
    await closeDriver();
  }
})();
