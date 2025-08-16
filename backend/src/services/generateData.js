const path = require("path");
const { spawn } = require("child_process");

let running = false;

function runNodeScript(scriptRelPath, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.resolve(__dirname, "..", "..", scriptRelPath);
    const child = spawn(process.execPath, [scriptPath, ...args], {
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout.on("data", (d) => process.stdout.write(d));
    child.stderr.on("data", (d) => process.stderr.write(d));
    child.on("close", (code) => {
      if (code === 0) return resolve();
      reject(
        new Error(`${path.basename(scriptRelPath)} exited with code ${code}`)
      );
    });
  });
}

async function generateAll({ mode = "demo" } = {}) {
  if (running) return { status: "busy" };
  running = true;
  try {
    await runNodeScript(path.join("scripts", "constraints.js"));
    if (mode === "demo") {
      await runNodeScript(path.join("scripts", "seedDemo.js"));
    }
    await runNodeScript(path.join("scripts", "createRelationships.js"));
    return { status: "ok" };
  } finally {
    running = false;
  }
}

function isRunning() {
  return running;
}

module.exports = { generateAll, isRunning };
