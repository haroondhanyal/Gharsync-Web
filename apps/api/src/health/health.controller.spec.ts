import assert from "node:assert/strict";
import test from "node:test";
import { HealthController } from "./health.controller.js";

test("health endpoint reports the API service as ready", () => {
  assert.deepEqual(new HealthController().check(), {
    status: "ok",
    service: "gharsync-api",
    version: "v1",
  });
});
