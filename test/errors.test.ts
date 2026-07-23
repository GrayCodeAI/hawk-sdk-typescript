import assert from "node:assert/strict";
import { test } from "node:test";

import {
  APIError,
  BadRequestError,
  InternalServerError,
  RateLimitError,
  parseAPIError,
} from "../src/index.js";

function resp(status: number, body: string, headers: Record<string, string> = {}): Response {
  return new Response(body, { status, headers });
}

test("parses the JSON error envelope", async () => {
  const err = await parseAPIError(
    resp(400, JSON.stringify({ error: "bad", code: "invalid", details: "x" })),
  );
  assert.ok(err instanceof BadRequestError);
  assert.equal(err.statusCode, 400);
  assert.equal(err.code, "invalid");
  assert.equal(err.details, "x");
  assert.match(err.message, /bad \[invalid\] \(status 400\)/);
});

test("falls back to the raw body when not JSON", async () => {
  const err = await parseAPIError(resp(500, "boom"));
  assert.ok(err instanceof InternalServerError);
  assert.match(err.message, /boom/);
});

test("uses a generic message for an empty body", async () => {
  const err = await parseAPIError(resp(500, ""));
  assert.match(err.message, /HTTP 500/);
});

test("rate limit captures Retry-After seconds", async () => {
  const err = await parseAPIError(
    resp(429, JSON.stringify({ error: "slow down" }), { "Retry-After": "3" }),
  );
  assert.ok(err instanceof RateLimitError);
  assert.equal(err.retryAfterMs, 3000);
  assert.match(err.message, /retry after 3000ms/);
});

test("unknown status maps to the base APIError", async () => {
  const err = await parseAPIError(resp(418, JSON.stringify({ error: "teapot" })));
  assert.equal(err.constructor, APIError);
  assert.equal(err.statusCode, 418);
});
