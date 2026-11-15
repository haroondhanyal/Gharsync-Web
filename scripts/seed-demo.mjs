try { process.loadEnvFile(".env"); } catch (error) { if (error?.code !== "ENOENT") throw error; }

const api = new URL(process.env.API_URL ?? "http://127.0.0.1:4000/api/v1");
if (process.env.NODE_ENV === "production" || !["localhost", "127.0.0.1", "::1"].includes(api.hostname)) {
  throw new Error("Demo records are only allowed against a local development API. Set API_URL to localhost and NODE_ENV=development.");
}
const health = await fetch(new URL("health", `${api.href.replace(/\/$/, "")}/`));
if (!health.ok) throw new Error("Start the local API first with npm run dev:all.");
const child = await import("node:child_process");
const result = child.spawnSync(process.execPath, ["scripts/e2e-local.mjs"], { stdio: "inherit", env: process.env });
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
