const router = require("express").Router();
const relController = require("../../controllers/controlRelationship");

// GET /relationships/user/:id — Get all connections for a user (both directions)
router.get("/user/:id", relController.getRelationshipsForUser);

// GET /relationships/transaction/:id — Get all connections for a transaction (both directions)
router.get("/transaction/:id", relController.getRelationshipsForTransaction);

module.exports = router;
