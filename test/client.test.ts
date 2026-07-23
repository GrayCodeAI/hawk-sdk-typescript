import assert from "node:assert/strict";
import { test } from "node:test";

import { HawkClient, NotFoundError, AuthenticationError } from "../src/index.js";
import { json, startServer } from "./helpers.js";

test("health returns daemon status", async () => {
  const server = await startServer((req, res) => {
    assert.equal(req.url, "/v1/health");
    json(res, 200, {
      status: "ok",
      version: "1.2.3",
      uptime: "5m",
      active_sessions: 2,
      started_at: "2026-01-01T00:00:00Z",
    });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const health = await client.health();
    assert.equal(health.status, "ok");
    assert.equal(health.version, "1.2.3");
    assert.equal(health.active_sessions, 2);
  } finally {
    await server.close();
  }
});

test("chat posts prompt and returns response", async () => {
  const server = await startServer((req, res, body) => {
    assert.equal(req.method, "POST");
    assert.equal(req.url, "/v1/chat");
    const parsed = JSON.parse(body) as { prompt: string; model?: string };
    assert.equal(parsed.prompt, "Hello!");
    assert.equal(parsed.model, "test-model");
    json(res, 200, {
      session_id: "sess-1",
      response: "Hi there.",
      tokens_in: 5,
      tokens_out: 3,
      turns_taken: 1,
      duration: "120ms",
    });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const resp = await client.chat({ prompt: "Hello!", model: "test-model" });
    assert.equal(resp.session_id, "sess-1");
    assert.equal(resp.response, "Hi there.");
    assert.equal(resp.tokens_out, 3);
  } finally {
    await server.close();
  }
});

test("sends Authorization header when apiKey is set", async () => {
  let seenAuth: string | undefined;
  const server = await startServer((req, res) => {
    seenAuth = req.headers.authorization;
    json(res, 200, { status: "ok" });
  });
  try {
    const client = new HawkClient({ baseURL: server.url, apiKey: "secret-key" });
    await client.health();
    assert.equal(seenAuth, "Bearer secret-key");
  } finally {
    await server.close();
  }
});

test("sets a hawk-sdk-typescript User-Agent", async () => {
  let seenUA: string | undefined;
  const server = await startServer((req, res) => {
    seenUA = req.headers["user-agent"];
    json(res, 200, { status: "ok" });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    await client.health();
    assert.match(seenUA ?? "", /^hawk-sdk-typescript\//);
  } finally {
    await server.close();
  }
});

test("sessions lists active sessions", async () => {
  const server = await startServer((req, res) => {
    assert.equal(req.url, "/v1/sessions");
    json(res, 200, [
      { id: "a", created_at: "t", last_used: "t", turns: 1, cwd: "/x" },
      { id: "b", created_at: "t", last_used: "t", turns: 2, cwd: "/y" },
    ]);
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const list = await client.sessions();
    assert.equal(list.length, 2);
    assert.equal(list[0]?.id, "a");
  } finally {
    await server.close();
  }
});

test("session fetches a single session by id", async () => {
  const server = await startServer((req, res) => {
    assert.equal(req.url, "/v1/sessions/sess-42");
    json(res, 200, {
      id: "sess-42",
      created_at: "t",
      updated_at: "t",
      model: "m",
      provider: "p",
      cwd: "/c",
      name: "n",
      message_count: 4,
      tool_calls: 1,
    });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const detail = await client.session("sess-42");
    assert.equal(detail.id, "sess-42");
    assert.equal(detail.message_count, 4);
  } finally {
    await server.close();
  }
});

test("messages applies pagination query params", async () => {
  let seenURL: string | undefined;
  const server = await startServer((req, res) => {
    seenURL = req.url;
    json(res, 200, {
      data: [{ role: "user", content: "hi" }],
      total: 1,
      offset: 10,
      limit: 5,
      has_more: false,
    });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const page = await client.messages("s1", { offset: 10, limit: 5 });
    assert.equal(seenURL, "/v1/sessions/s1/messages?offset=10&limit=5");
    assert.equal(page.data.length, 1);
    assert.equal(page.has_more, false);
  } finally {
    await server.close();
  }
});

test("deleteSession accepts 204 No Content", async () => {
  let seenMethod: string | undefined;
  const server = await startServer((req, res) => {
    seenMethod = req.method;
    res.writeHead(204);
    res.end();
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    await client.deleteSession("s1");
    assert.equal(seenMethod, "DELETE");
  } finally {
    await server.close();
  }
});

test("stats returns aggregated usage", async () => {
  const server = await startServer((req, res) => {
    assert.equal(req.url, "/v1/stats");
    json(res, 200, {
      total_sessions: 3,
      total_messages: 30,
      total_tool_calls: 7,
      total_cost_usd: 1.5,
      active_days: 2,
      models: [{ model: "m", requests: 3, cost_usd: 1.5 }],
    });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const stats = await client.stats();
    assert.equal(stats.total_sessions, 3);
    assert.equal(stats.models[0]?.model, "m");
  } finally {
    await server.close();
  }
});

test("maps 404 to NotFoundError", async () => {
  const server = await startServer((_req, res) => {
    json(res, 404, { error: "session not found", code: "not_found" });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    await assert.rejects(
      () => client.session("missing"),
      (err: unknown) => {
        assert.ok(err instanceof NotFoundError);
        assert.equal(err.statusCode, 404);
        assert.equal(err.code, "not_found");
        assert.match(err.message, /session not found/);
        return true;
      },
    );
  } finally {
    await server.close();
  }
});

test("maps 401 to AuthenticationError", async () => {
  const server = await startServer((_req, res) => {
    json(res, 401, { error: "bad key" });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    await assert.rejects(
      () => client.health(),
      (err: unknown) => err instanceof AuthenticationError,
    );
  } finally {
    await server.close();
  }
});
