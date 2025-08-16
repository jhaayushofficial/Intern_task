const router = require("express").Router();
const userController = require("../../controllers/controlUser");

// POST /users — Add/update user
router.post("/", userController.createUser);

// PUT /users/:id — Update existing user
router.put("/:id", userController.updateUser);

// GET /users — List users
router.get("/", userController.listUsers);

module.exports = router;
