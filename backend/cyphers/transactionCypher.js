// Centralized Cypher statements for Transaction operations

module.exports = {
  CHECK_TX_EXISTS: `
    MATCH (t:Transaction {id: $id})
    RETURN t
    LIMIT 1
  `,

  CREATE_TRANSACTION: `
    CREATE (t:Transaction {id: $id})
    SET t += $props
    WITH t,
         $fromUserId AS fromUserId,
         $toUserId AS toUserId,
         $senderIp AS senderIp,
         $receiverIp AS receiverIp,
         $senderDeviceId AS senderDeviceId,
         $receiverDeviceId AS receiverDeviceId
    // Link sender if provided and exists
    OPTIONAL MATCH (su:User {id: fromUserId})
    FOREACH (_ IN CASE WHEN fromUserId IS NULL OR su IS NULL THEN [] ELSE [1] END |
      MERGE (su)-[:MADE]->(t)
    )
    WITH t, toUserId, senderIp, receiverIp, senderDeviceId, receiverDeviceId
    // Link receiver if provided and exists
    OPTIONAL MATCH (ru:User {id: toUserId})
    FOREACH (_ IN CASE WHEN toUserId IS NULL OR ru IS NULL THEN [] ELSE [1] END |
      MERGE (t)-[:TO]->(ru)
    )
    WITH t, senderIp, receiverIp, senderDeviceId, receiverDeviceId
    // SAME_SENDER_IP relationships between transactions
    CALL {
      WITH t, senderIp
      MATCH (other:Transaction)
      WHERE senderIp IS NOT NULL AND other.id <> t.id AND other.senderIp = senderIp
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_SENDER_IP]->(b)
      MERGE (b)-[:SAME_SENDER_IP]->(a)
      RETURN count(*) AS s1
    }
    WITH t, receiverIp, senderDeviceId, receiverDeviceId
    // SAME_RECEIVER_IP relationships between transactions
    CALL {
      WITH t, receiverIp
      MATCH (other:Transaction)
      WHERE receiverIp IS NOT NULL AND other.id <> t.id AND other.receiverIp = receiverIp
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_RECEIVER_IP]->(b)
      MERGE (b)-[:SAME_RECEIVER_IP]->(a)
      RETURN count(*) AS s2
    }
    WITH t, senderDeviceId, receiverDeviceId
    // SAME_SENDER: transactions sharing the same sender user
    CALL {
      WITH t
      MATCH (su:User)-[:MADE]->(t)
      MATCH (su)-[:MADE]->(other:Transaction)
      WHERE other.id <> t.id
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_SENDER]->(b)
      MERGE (b)-[:SAME_SENDER]->(a)
      RETURN count(*) AS s3
    }
    WITH t, senderDeviceId, receiverDeviceId
    // SAME_RECEIVER: transactions sharing the same receiver user
    CALL {
      WITH t
      MATCH (t)-[:TO]->(ru:User)
      MATCH (other:Transaction)-[:TO]->(ru)
      WHERE other.id <> t.id
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_RECEIVER]->(b)
      MERGE (b)-[:SAME_RECEIVER]->(a)
      RETURN count(*) AS s4
    }
    WITH t, senderDeviceId, receiverDeviceId
    // SAME_SENDER_DEVICE relationships
    CALL {
      WITH t, senderDeviceId
      MATCH (other:Transaction)
      WHERE senderDeviceId IS NOT NULL AND other.id <> t.id AND other.senderDeviceId = senderDeviceId
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_SENDER_DEVICE]->(b)
      MERGE (b)-[:SAME_SENDER_DEVICE]->(a)
      RETURN count(*) AS s5
    }
    WITH t, receiverDeviceId
    // SAME_RECEIVER_DEVICE relationships
    CALL {
      WITH t, receiverDeviceId
      MATCH (other:Transaction)
      WHERE receiverDeviceId IS NOT NULL AND other.id <> t.id AND other.receiverDeviceId = receiverDeviceId
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_RECEIVER_DEVICE]->(b)
      MERGE (b)-[:SAME_RECEIVER_DEVICE]->(a)
      RETURN count(*) AS s6
    }
    RETURN t
  `,

  UPDATE_TRANSACTION: `
    MATCH (t:Transaction {id: $id})
    OPTIONAL MATCH (curSender:User)-[:MADE]->(t)
    OPTIONAL MATCH (t)-[:TO]->(curReceiver:User)
    WITH t, curSender, curReceiver, $fromUserId AS fromUserIdParam, $toUserId AS toUserIdParam
    SET t += $props
    WITH t,
         coalesce(fromUserIdParam, curSender.id) AS fromUserId,
         coalesce(toUserIdParam, curReceiver.id) AS toUserId
  // Remove old relationships first (group matches, then delete)
  OPTIONAL MATCH (t)-[oldMade:MADE]-()
  OPTIONAL MATCH ()-[oldTo:TO]->(t)
  OPTIONAL MATCH (t)-[oldSameSenderIp:SAME_SENDER_IP]-()
  OPTIONAL MATCH (t)-[oldSameReceiverIp:SAME_RECEIVER_IP]-()
  OPTIONAL MATCH (t)-[oldSameSenderDev:SAME_SENDER_DEVICE]-()
  OPTIONAL MATCH (t)-[oldSameReceiverDev:SAME_RECEIVER_DEVICE]-()
  OPTIONAL MATCH (t)-[oldSameSend:SAME_SENDER]-()
  OPTIONAL MATCH (t)-[oldSameRec:SAME_RECEIVER]-()
  DELETE oldMade, oldTo, oldSameSenderIp, oldSameReceiverIp, oldSameSenderDev, oldSameReceiverDev, oldSameSend, oldSameRec
    WITH t, fromUserId, toUserId
    // Link sender if provided and exists
    OPTIONAL MATCH (su:User {id: fromUserId})
    FOREACH (_ IN CASE WHEN fromUserId IS NULL OR su IS NULL THEN [] ELSE [1] END |
      MERGE (su)-[:MADE]->(t)
    )
    WITH t, toUserId
    // Link receiver if provided and exists
    OPTIONAL MATCH (ru:User {id: toUserId})
    FOREACH (_ IN CASE WHEN toUserId IS NULL OR ru IS NULL THEN [] ELSE [1] END |
      MERGE (t)-[:TO]->(ru)
    )
    WITH t
    // Recreate SAME_SENDER_IP relationships (based on node properties)
    CALL {
      WITH t
      MATCH (other:Transaction)
      WHERE t.senderIp IS NOT NULL AND other.id <> t.id AND other.senderIp = t.senderIp
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_SENDER_IP]->(b)
      MERGE (b)-[:SAME_SENDER_IP]->(a)
      RETURN count(*) AS s1
    }
    WITH t
    // Recreate SAME_RECEIVER_IP relationships
    CALL {
      WITH t
      MATCH (other:Transaction)
      WHERE t.receiverIp IS NOT NULL AND other.id <> t.id AND other.receiverIp = t.receiverIp
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_RECEIVER_IP]->(b)
      MERGE (b)-[:SAME_RECEIVER_IP]->(a)
      RETURN count(*) AS s2
    }
    WITH t
    // Recreate SAME_SENDER relationships
    CALL {
      WITH t
      MATCH (su:User)-[:MADE]->(t)
      MATCH (su)-[:MADE]->(other:Transaction)
      WHERE other.id <> t.id
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_SENDER]->(b)
      MERGE (b)-[:SAME_SENDER]->(a)
      RETURN count(*) AS s3
    }
    WITH t
    // Recreate SAME_RECEIVER relationships
    CALL {
      WITH t
      MATCH (t)-[:TO]->(ru:User)
      MATCH (other:Transaction)-[:TO]->(ru)
      WHERE other.id <> t.id
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_RECEIVER]->(b)
      MERGE (b)-[:SAME_RECEIVER]->(a)
      RETURN count(*) AS s4
    }
    WITH t
    // Recreate SAME_SENDER_DEVICE relationships
    CALL {
      WITH t
      MATCH (other:Transaction)
      WHERE t.senderDeviceId IS NOT NULL AND other.id <> t.id AND other.senderDeviceId = t.senderDeviceId
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_SENDER_DEVICE]->(b)
      MERGE (b)-[:SAME_SENDER_DEVICE]->(a)
      RETURN count(*) AS s5
    }
    WITH t
    // Recreate SAME_RECEIVER_DEVICE relationships
    CALL {
      WITH t
      MATCH (other:Transaction)
      WHERE t.receiverDeviceId IS NOT NULL AND other.id <> t.id AND other.receiverDeviceId = t.receiverDeviceId
      WITH t, other
      WITH CASE WHEN t.id < other.id THEN t ELSE other END AS a,
           CASE WHEN t.id < other.id THEN other ELSE t END AS b
      MERGE (a)-[:SAME_RECEIVER_DEVICE]->(b)
      MERGE (b)-[:SAME_RECEIVER_DEVICE]->(a)
      RETURN count(*) AS s6
    }
    RETURN t
  `,

  LIST_TRANSACTIONS_WITH_USERS: `
    MATCH (t:Transaction)
    OPTIONAL MATCH (sender:User)-[:MADE]->(t)
    OPTIONAL MATCH (t)-[:TO]->(receiver:User)
    RETURN t, sender, receiver
    ORDER BY t.id
  `,

  DELETE_TX_BY_ID: `
    MATCH (t:Transaction {id: $id})
    DETACH DELETE t
    RETURN count(t) AS deleted
  `,

  DELETE_DUPLICATE_TXS: `
    MATCH (t:Transaction)
    WITH t.id AS tid, collect(t) AS txs
    WHERE size(txs) > 1
    UNWIND txs[1..] AS dup
    DETACH DELETE dup
    RETURN tid, count(*) AS deleted
  `,
};
