// Centralized Cypher statements for User operations

module.exports = {
  CHECK_USER_EXISTS: `
    MATCH (u:User {id: $id})
    RETURN u
    LIMIT 1
  `,

  CREATE_USER: `
    CREATE (u:User {id: $id})
    SET u += $props
  WITH u, $phone AS phone, $email AS email, $ip AS ip, $deviceId AS deviceId, u.address AS address, $paymentMethod AS paymentMethod
    // Remove any outdated SHARES_* relationships before recalculating
  OPTIONAL MATCH (u)-[old:SHARES_EMAIL|SHARES_PHONE|SHARES_IP|SHARES_DEVICE|SHARES_ADDRESS|SHARES_PAYMENT_METHOD]-()
    DELETE old
  WITH u, phone, email, ip, deviceId, address, paymentMethod

    // SHARES_PHONE (bidirectional)
    CALL {
      WITH u, phone
      MATCH (o:User)
      WHERE phone IS NOT NULL AND o.id <> u.id AND o.phone = phone
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_PHONE]->(b)
      MERGE (b)-[:SHARES_PHONE]->(a)
      RETURN count(*) AS c1
    }
  WITH u, email, ip, deviceId, address, paymentMethod

    // SHARES_EMAIL (bidirectional)
    CALL {
      WITH u, email
      MATCH (o:User)
      WHERE email IS NOT NULL AND o.id <> u.id AND o.email = email
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_EMAIL]->(b)
      MERGE (b)-[:SHARES_EMAIL]->(a)
      RETURN count(*) AS c2
    }
  WITH u, ip, deviceId, address, paymentMethod

    // SHARES_IP (bidirectional)
    CALL {
      WITH u, ip
      MATCH (o:User)
      WHERE ip IS NOT NULL AND o.id <> u.id AND o.ip = ip
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_IP]->(b)
      MERGE (b)-[:SHARES_IP]->(a)
      RETURN count(*) AS c3
    }
  WITH u, deviceId, address, paymentMethod

    // SHARES_DEVICE (bidirectional)
    CALL {
      WITH u, deviceId
      MATCH (o:User)
      WHERE deviceId IS NOT NULL AND o.id <> u.id AND o.deviceId = deviceId
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_DEVICE]->(b)
      MERGE (b)-[:SHARES_DEVICE]->(a)
      RETURN count(*) AS c4
    }
    WITH u, address, paymentMethod

    // SHARES_ADDRESS (bidirectional)
    CALL {
      WITH u, address
      MATCH (o:User)
      WHERE address IS NOT NULL AND o.id <> u.id AND o.address = address
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_ADDRESS]->(b)
      MERGE (b)-[:SHARES_ADDRESS]->(a)
      RETURN count(*) AS c5
    }
    WITH u, paymentMethod

    // SHARES_PAYMENT_METHOD (bidirectional)
    CALL {
      WITH u, paymentMethod
      MATCH (o:User)
      WHERE paymentMethod IS NOT NULL AND o.id <> u.id AND o.paymentMethod = paymentMethod
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_PAYMENT_METHOD]->(b)
      MERGE (b)-[:SHARES_PAYMENT_METHOD]->(a)
      RETURN count(*) AS c6
    }
    RETURN u
  `,

  UPDATE_USER: `
    MATCH (u:User {id: $id})
    SET u += $props
    WITH u, $phone AS phone, $email AS email, $ip AS ip, $deviceId AS deviceId, u.address AS address, $paymentMethod AS paymentMethod
    // Remove any outdated SHARES_* relationships before recalculating
    OPTIONAL MATCH (u)-[old:SHARES_EMAIL|SHARES_PHONE|SHARES_IP|SHARES_DEVICE|SHARES_ADDRESS|SHARES_PAYMENT_METHOD]-()
    DELETE old
    WITH u, phone, email, ip, deviceId, address, paymentMethod

    // SHARES_PHONE (bidirectional)
    CALL {
      WITH u, phone
      MATCH (o:User)
      WHERE phone IS NOT NULL AND o.id <> u.id AND o.phone = phone
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_PHONE]->(b)
      MERGE (b)-[:SHARES_PHONE]->(a)
      RETURN count(*) AS c1
    }
  WITH u, email, ip, deviceId, address, paymentMethod

    // SHARES_EMAIL (bidirectional)
    CALL {
      WITH u, email
      MATCH (o:User)
      WHERE email IS NOT NULL AND o.id <> u.id AND o.email = email
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_EMAIL]->(b)
      MERGE (b)-[:SHARES_EMAIL]->(a)
      RETURN count(*) AS c2
    }
  WITH u, ip, deviceId, address, paymentMethod

    // SHARES_IP (bidirectional)
    CALL {
      WITH u, ip
      MATCH (o:User)
      WHERE ip IS NOT NULL AND o.id <> u.id AND o.ip = ip
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_IP]->(b)
      MERGE (b)-[:SHARES_IP]->(a)
      RETURN count(*) AS c3
    }
  WITH u, deviceId, address, paymentMethod

    // SHARES_DEVICE (bidirectional)
    CALL {
      WITH u, deviceId
      MATCH (o:User)
      WHERE deviceId IS NOT NULL AND o.id <> u.id AND o.deviceId = deviceId
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_DEVICE]->(b)
      MERGE (b)-[:SHARES_DEVICE]->(a)
      RETURN count(*) AS c4
    }
    WITH u, address, paymentMethod

    // SHARES_ADDRESS (bidirectional)
    CALL {
      WITH u, address
      MATCH (o:User)
      WHERE address IS NOT NULL AND o.id <> u.id AND o.address = address
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_ADDRESS]->(b)
      MERGE (b)-[:SHARES_ADDRESS]->(a)
      RETURN count(*) AS c5
    }
    WITH u, paymentMethod

    // SHARES_PAYMENT_METHOD (bidirectional)
    CALL {
      WITH u, paymentMethod
      MATCH (o:User)
      WHERE paymentMethod IS NOT NULL AND o.id <> u.id AND o.paymentMethod = paymentMethod
      WITH u, o
      WITH CASE WHEN u.id < o.id THEN u ELSE o END AS a,
           CASE WHEN u.id < o.id THEN o ELSE u END AS b
      MERGE (a)-[:SHARES_PAYMENT_METHOD]->(b)
      MERGE (b)-[:SHARES_PAYMENT_METHOD]->(a)
      RETURN count(*) AS c6
    }
    RETURN u
  `,

  LIST_USERS: `
    MATCH (u:User)
    RETURN u
    ORDER BY u.id
  `,
};
