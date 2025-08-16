require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { driver, neo4j } = require("./db/neo4j");

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", async (req, res) => {
  try {
    await driver.verifyConnectivity();
    res.json({ status: "ok" });
  } catch (err) {
    res
      .status(500)
      .json({ error: "Neo4j not reachable", details: err.message });
  }
});

// Data generation trigger (admin)
const { generateAll, isRunning } = require("./services/generateData");
app.post("/admin/generate-data", async (req, res) => {
  const mode = req.body?.mode || "demo";
  if (isRunning()) return res.status(409).json({ status: "busy" });
  try {
    const result = await generateAll({ mode });
    res.json({ status: result.status });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Routes
app.use("/users", require("./routes/users"));
app.use("/transactions", require("./routes/transactions"));
app.use("/relationships", require("./routes/relationships"));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
  // Optional: auto-generate data on startup when env flag is set
  if (String(process.env.AUTO_GENERATE_DATA || "").toLowerCase() === "true") {
    generateAll({ mode: process.env.GENERATE_MODE || "demo" })
      .then(() => console.log("Auto data generation complete"))
      .catch((e) => console.error("Auto data generation failed:", e.message));
  }
});
