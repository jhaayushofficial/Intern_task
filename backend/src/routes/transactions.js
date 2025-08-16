const router = require("express").Router();
const txController = require("../../controllers/controlTransaction");

// (Delete endpoints removed as duplicates cannot exist and delete-by-id not needed for users)

// POST /transactions — Create transaction (id must be unique)
// Optional relationships: fromUserId (sender), toUserId (receiver)
router.post("/", txController.createTransaction);

// PUT /transactions/:id — Update transaction (merge fields and relationships)
router.put("/:id", txController.updateTransaction);

// GET /transactions — List transactions
router.get("/", txController.listTransactions);

module.exports = router;
