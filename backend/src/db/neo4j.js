const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
const neo4j = require("neo4j-driver");

const uri = process.env.NEO4J_URI || "bolt://localhost:7687";
const user = process.env.NEO4J_USERNAME || "neo4j";
const password = process.env.NEO4J_PASSWORD || "test";

const driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
  /* tuned defaults */
});

async function getSession(accessMode = neo4j.session.WRITE) {
  if (!driver) throw new Error("Neo4j driver not initialized");
  return driver.session({ defaultAccessMode: accessMode });
}

async function closeDriver() {
  await driver.close();
}

module.exports = { driver, getSession, closeDriver, neo4j };
