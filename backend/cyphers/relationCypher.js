// Centralized Cypher statements for Relationship queries (graph fetch)

module.exports = {
  RELATIONSHIPS_FOR_USER: `
    MATCH (n:User {id: $id})-[r]-(m)
    RETURN n, r, m
  `,

  RELATIONSHIPS_FOR_TRANSACTION: `
    MATCH (n:Transaction {id: $id})-[r]-(m)
    RETURN n, r, m
  `,
};
