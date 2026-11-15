import { spawn } from "node:child_process";

try { process.loadEnvFile(".env"); } catch (error) { if (error?.code !== "ENOENT") throw error; }

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const children = [
  spawn(npm, ["run", "dev:api"], { stdio: "inherit", env: { ...process.env, DATABASE_MODE: process.env.DATABASE_MODE ?? "embedded" } }),
  spawn(npm, ["run", "dev:web"], { stdio: "inherit", env: process.env }),
];

let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
  process.exitCode = code;
};

for (const child of children) {
  child.on("error", (error) => { console.error(error); stop(1); });
  child.on("exit", (code, signal) => {
    if (!stopping && (code !== 0 || signal)) stop(code ?? 1);
  });
}
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
