#!/usr/bin/env node
const { generateAll } = require("../src/services/generateData");

(async () => {
  const mode = process.env.GENERATE_MODE || process.argv[2] || "demo";
  console.log(`[generateData] Starting in mode='${mode}'...`);
  try {
    const result = await generateAll({ mode });
    console.log(`[generateData] Finished with status: ${result.status}`);
    process.exit(result.status === "ok" ? 0 : 1);
  } catch (e) {
    console.error("[generateData] Failed:", e.message);
    process.exit(1);
  }
})();
