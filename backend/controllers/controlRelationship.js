const { getSession, neo4j } = require("../src/db/neo4j");
const REL_CYPHER = require("../cyphers/relationCypher");

function formatGraph(records) {
  const nodeMap = new Map();
  const edges = [];

  for (const rec of records) {
    const n = rec.get("n");
    const m = rec.get("m");
    const r = rec.get("r");

    if (n && !nodeMap.has(n.identity.toString())) {
      const node = {
        id: n.identity.toString(),
        identity: n.identity.toString(),
        labels: n.labels,
        domainId: n.properties?.id,
        properties: n.properties,
      };
      nodeMap.set(n.identity.toString(), node);
    }

    if (m && !nodeMap.has(m.identity.toString())) {
      const node = {
        id: m.identity.toString(),
        identity: m.identity.toString(),
        labels: m.labels,
        domainId: m.properties?.id,
        properties: m.properties,
      };
      nodeMap.set(m.identity.toString(), node);
    }

    if (r) {
      const edge = {
        from: r.start.toString(),
        to: r.end.toString(),
        type: r.type,
        properties: r.properties,
      };
      edges.push(edge);
    }
  }

  const result = { nodes: Array.from(nodeMap.values()), edges };
  return result;
}

async function getRelationshipsForUser(req, res) {
  const { id } = req.params;
  const session = await getSession(neo4j.session.READ);
  try {
    const result = await session.run(REL_CYPHER.RELATIONSHIPS_FOR_USER, { id });
    const graphData = formatGraph(result.records);
    res.json(graphData);
  } catch (e) {
    console.error("Error fetching user relationships:", e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
}

async function getRelationshipsForTransaction(req, res) {
  const { id } = req.params;
  const session = await getSession(neo4j.session.READ);
  try {
    const result = await session.run(REL_CYPHER.RELATIONSHIPS_FOR_TRANSACTION, {
      id,
    });
    const graphData = formatGraph(result.records);
    res.json(graphData);
  } catch (e) {
    console.error("Error fetching transaction relationships:", e);
    res.status(500).json({ error: e.message });
  } finally {
    await session.close();
  }
}

module.exports = {
  getRelationshipsForUser,
  getRelationshipsForTransaction,
  formatGraph, // exported in case it's useful elsewhere
};
