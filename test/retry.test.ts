import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HawkClient,
  backoffDurationMs,
  defaultRetryConfig,
  isRetryable,
  parseRetryAfterMs,
  retryableForMethod,
} from "../src/index.js";
import { json, startServer } from "./helpers.js";

const fastRetry = { ...defaultRetryConfig(), initialBackoffMs: 1, maxBackoffMs: 5 };

test("default retry config retries transient statuses", () => {
  const cfg = defaultRetryConfig();
  assert.equal(cfg.maxRetries, 3);
  assert.ok(isRetryable(cfg, 429));
  assert.ok(isRetryable(cfg, 503));
  assert.ok(!isRetryable(cfg, 404));
});

test("non-idempotent requests only retry on 429", () => {
  const cfg = defaultRetryConfig();
  assert.equal(retryableForMethod(cfg, 429, false), true);
  assert.equal(retryableForMethod(cfg, 500, false), false);
  assert.equal(retryableForMethod(cfg, 500, true), true);
});

test("backoff stays within the max bound", () => {
  const cfg = defaultRetryConfig();
  for (let attempt = 0; attempt < 10; attempt++) {
    const b = backoffDurationMs(cfg, attempt);
    assert.ok(b >= 0);
    assert.ok(b <= cfg.maxBackoffMs);
  }
});

test("parseRetryAfterMs handles seconds, dates, and garbage", () => {
  assert.equal(parseRetryAfterMs("5"), 5000);
  assert.equal(parseRetryAfterMs(null), 0);
  assert.equal(parseRetryAfterMs("not-a-date"), 0);
  const future = new Date(Date.now() + 10000).toUTCString();
  const d = parseRetryAfterMs(future);
  assert.ok(d > 0 && d <= 10000);
});

test("client retries a 429 then succeeds", async () => {
  let calls = 0;
  const server = await startServer((_req, res) => {
    calls++;
    if (calls === 1) {
      json(res, 429, { error: "slow down" }, { "Retry-After": "0" });
    } else {
      json(res, 200, {
        status: "ok",
        version: "v",
        uptime: "u",
        active_sessions: 0,
        started_at: "t",
      });
    }
  });
  try {
    const client = new HawkClient({ baseURL: server.url, retry: fastRetry });
    const health = await client.health();
    assert.equal(health.status, "ok");
    assert.equal(calls, 2);
  } finally {
    await server.close();
  }
});

test("client does not retry a POST 500 (non-idempotent)", async () => {
  let calls = 0;
  const server = await startServer((_req, res) => {
    calls++;
    json(res, 500, { error: "boom" });
  });
  try {
    const client = new HawkClient({ baseURL: server.url, retry: fastRetry });
    await assert.rejects(() => client.chat({ prompt: "x" }), /boom/);
    assert.equal(calls, 1);
  } finally {
    await server.close();
  }
});
