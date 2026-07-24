import assert from "node:assert/strict";
import { test } from "node:test";

import {
  APIError,
  AuthenticationError,
  BadRequestError,
  ForbiddenError,
  InternalServerError,
  NotFoundError,
  RateLimitError,
  ServiceUnavailableError,
  parseAPIError,
} from "../src/index.js";

function resp(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response {
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
  const err = await parseAPIError(
    resp(418, JSON.stringify({ error: "teapot" })),
  );
  assert.equal(err.constructor, APIError);
  assert.equal(err.statusCode, 418);
});

test("401 maps to AuthenticationError", async () => {
  const err = await parseAPIError(
    resp(401, JSON.stringify({ error: "unauthorized" })),
  );
  assert.ok(err instanceof AuthenticationError);
  assert.equal(err.statusCode, 401);
});

test("403 maps to ForbiddenError", async () => {
  const err = await parseAPIError(
    resp(403, JSON.stringify({ error: "forbidden" })),
  );
  assert.ok(err instanceof ForbiddenError);
  assert.equal(err.statusCode, 403);
});

test("404 maps to NotFoundError", async () => {
  const err = await parseAPIError(
    resp(404, JSON.stringify({ error: "not found" })),
  );
  assert.ok(err instanceof NotFoundError);
  assert.equal(err.statusCode, 404);
});

test("503 maps to ServiceUnavailableError", async () => {
  const err = await parseAPIError(
    resp(503, JSON.stringify({ error: "service unavailable" })),
  );
  assert.ok(err instanceof ServiceUnavailableError);
  assert.equal(err.statusCode, 503);
});

test("error classes are instanceof APIError", async () => {
  // All typed errors should inherit from APIError so callers can catch broadly.
  const errors = [
    await parseAPIError(resp(400, "{}")),
    await parseAPIError(resp(401, "{}")),
    await parseAPIError(resp(403, "{}")),
    await parseAPIError(resp(404, "{}")),
    await parseAPIError(resp(429, "{}")),
    await parseAPIError(resp(500, "{}")),
    await parseAPIError(resp(503, "{}")),
  ];
  for (const err of errors) {
    assert.ok(err instanceof APIError, `${err.constructor.name} not instanceof APIError`);
  }
});
