import assert from "node:assert/strict";
import { test } from "node:test";

import { Agent, HawkClient, type ChatWithToolsResponse } from "../src/index.js";
import { json, startServer } from "./helpers.js";

test("agent.chat stores the session id from the response", async () => {
  const server = await startServer((_req, res) => {
    json(res, 200, {
      session_id: "sess-9",
      response: "ok",
      tokens_in: 1,
      tokens_out: 1,
      turns_taken: 1,
      duration: "1ms",
    });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const agent = new Agent(client, { model: "m" });
    assert.equal(agent.sessionID(), "");
    const resp = await agent.chat("hello");
    assert.equal(resp.response, "ok");
    assert.equal(agent.sessionID(), "sess-9");
  } finally {
    await server.close();
  }
});

test("agent resumes a configured session", async () => {
  let seenSession: string | undefined;
  const server = await startServer((_req, res, body) => {
    seenSession = (JSON.parse(body) as { session_id?: string }).session_id;
    json(res, 200, {
      session_id: "sess-1",
      response: "ok",
      tokens_in: 1,
      tokens_out: 1,
      turns_taken: 1,
      duration: "1ms",
    });
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const agent = new Agent(client, {
      memory: { enabled: true, sessionID: "sess-1" },
    });
    await agent.chat("hi");
    assert.equal(seenSession, "sess-1");
  } finally {
    await server.close();
  }
});

test("agent runs the tool execution loop until stop", async () => {
  // Round 1: model requests a tool call. Round 2: model stops.
  let round = 0;
  const toolArgs: Record<string, unknown>[] = [];
  const server = await startServer((_req, res, body) => {
    round++;
    const parsed = JSON.parse(body) as { tool_results?: { content: string }[] };
    if (round === 1) {
      const resp: ChatWithToolsResponse = {
        session_id: "s",
        response: "let me check",
        tokens_in: 1,
        tokens_out: 1,
        turns_taken: 1,
        duration: "1ms",
        tool_calls: [{ id: "call-1", name: "lookup", arguments: { q: "x" } }],
        finish_reason: "tool_calls",
      };
      json(res, 200, resp);
    } else {
      // Capture the tool result the client sent back.
      if (parsed.tool_results) {
        toolArgs.push({ content: parsed.tool_results[0]?.content });
      }
      const resp: ChatWithToolsResponse = {
        session_id: "s",
        response: "the answer is 42",
        tokens_in: 1,
        tokens_out: 1,
        turns_taken: 2,
        duration: "2ms",
        tool_calls: [],
        finish_reason: "stop",
      };
      json(res, 200, resp);
    }
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const agent = new Agent(client, {
      tools: [
        {
          schema: {
            name: "lookup",
            description: "look up a value",
            parameters: { type: "object" },
          },
          run: (args) => `result for ${String(args.q)}`,
        },
      ],
    });
    const resp = await agent.chat("what is x?");
    assert.equal(resp.response, "the answer is 42");
    assert.equal(round, 2);
    assert.equal(toolArgs[0]?.content, "result for x");
  } finally {
    await server.close();
  }
});

test("agent.chatStream returns a streaming reader", async () => {
  const server = await startServer((_req, res) => {
    res.writeHead(200, { "Content-Type": "text/event-stream" });
    res.write("event: delta\ndata: streamed\n\n");
    res.write("data: [DONE]\n\n");
    res.end();
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const agent = new Agent(client, { model: "m" });
    const reader = await agent.chatStream("hello");
    const events: { event: string; data: string }[] = [];
    for await (const ev of reader) {
      events.push(ev);
    }
    assert.equal(events.length, 2);
    assert.equal(events[0]?.data, "streamed");
    assert.equal(events[1]?.data, "[DONE]");
  } finally {
    await server.close();
  }
});

test("chatWithTools reports unknown tools as error results", async () => {
  let round = 0;
  let sawErrorResult = false;
  const server = await startServer((_req, res, body) => {
    round++;
    const parsed = JSON.parse(body) as {
      tool_results?: { is_error?: boolean; content: string }[];
    };
    if (round === 1) {
      json(res, 200, {
        session_id: "s",
        response: "calling",
        tokens_in: 1,
        tokens_out: 1,
        turns_taken: 1,
        duration: "1ms",
        tool_calls: [{ id: "c1", name: "missing", arguments: {} }],
        finish_reason: "tool_calls",
      });
    } else {
      if (parsed.tool_results?.[0]?.is_error) {
        sawErrorResult = true;
      }
      json(res, 200, {
        session_id: "s",
        response: "done",
        tokens_in: 1,
        tokens_out: 1,
        turns_taken: 2,
        duration: "1ms",
        tool_calls: [],
        finish_reason: "stop",
      });
    }
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const resp = await client.chatWithTools(
      { prompt: "go" },
      [
        {
          schema: { name: "other", description: "d", parameters: {} },
          run: () => "unused",
        },
      ],
      5,
    );
    assert.equal(resp.response, "done");
    assert.ok(sawErrorResult);
  } finally {
    await server.close();
  }
});
