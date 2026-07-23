import assert from "node:assert/strict";
import { test } from "node:test";

import { HawkClient, type StreamEvent } from "../src/index.js";
import { startServer } from "./helpers.js";

test("chatStream parses SSE events", async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write("event: delta\ndata: Hello\n\n");
    res.write("event: delta\ndata: world\n\n");
    res.write("data: [DONE]\n\n");
    res.end();
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const reader = await client.chatStream({ prompt: "hi" });
    const events: StreamEvent[] = [];
    for await (const ev of reader) {
      events.push(ev);
    }
    assert.equal(events.length, 3);
    assert.equal(events[0]?.event, "delta");
    assert.equal(events[0]?.data, "Hello");
    assert.equal(events[1]?.data, "world");
    assert.equal(events[2]?.data, "[DONE]");
    assert.equal(events[2]?.event, "");
  } finally {
    await server.close();
  }
});

test("chatStream joins multi-line data fields with newlines", async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write("data: line1\ndata: line2\n\n");
    res.end();
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const reader = await client.chatStream({ prompt: "hi" });
    const ev = await reader.next();
    assert.equal(ev?.data, "line1\nline2");
    assert.equal(await reader.next(), null);
  } finally {
    await server.close();
  }
});

test("chatStream supports next() until null", async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write("data: one\n\n");
    res.write("data: two\n\n");
    res.end();
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const reader = await client.chatStream({ prompt: "hi" });
    assert.equal((await reader.next())?.data, "one");
    assert.equal((await reader.next())?.data, "two");
    assert.equal(await reader.next(), null);
  } finally {
    await server.close();
  }
});

test("chatStream surfaces non-200 as a typed error", async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "stream failed" }));
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    await assert.rejects(() => client.chatStream({ prompt: "hi" }), /stream failed/);
  } finally {
    await server.close();
  }
});
