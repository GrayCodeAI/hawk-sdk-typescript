/**
 * Smoke test for the Tool interface and chatWithTools execution loop.
 * The Tool interface is structural (compile-time only), so this exercises
 * the client-level tool loop end-to-end against a mock daemon.
 */

import assert from "node:assert/strict";
import { test } from "node:test";

import {
  HawkClient,
  type ChatWithToolsResponse,
  type Tool,
} from "../src/index.js";
import { json, startServer } from "./helpers.js";

const echoTool: Tool = {
  schema: {
    name: "echo",
    description: "Echoes the input text.",
    parameters: {
      type: "object",
      properties: { text: { type: "string" } },
      required: ["text"],
    },
  },
  run: (args) => `echo:${(args as { text: string }).text}`,
};

test("chatWithTools returns final response when no tool calls", async () => {
  const server = await startServer((_req, res) => {
    json(res, 200, {
      session_id: "sess-1",
      response: "done",
      tokens_in: 1,
      tokens_out: 1,
      turns_taken: 1,
      duration: "1ms",
      finish_reason: "stop",
    } satisfies ChatWithToolsResponse);
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const resp = await client.chatWithTools({ prompt: "hi" }, [echoTool]);
    assert.equal(resp.response, "done");
    assert.equal(resp.session_id, "sess-1");
  } finally {
    await server.close();
  }
});

test("chatWithTools executes a tool and loops to completion", async () => {
  let calls = 0;
  const server = await startServer((_req, res) => {
    calls++;
    if (calls === 1) {
      // First response: ask to run the echo tool.
      json(res, 200, {
        session_id: "sess-2",
        response: "",
        tokens_in: 1,
        tokens_out: 1,
        turns_taken: 1,
        duration: "1ms",
        finish_reason: "tool_calls",
        tool_calls: [
          { id: "tc-1", name: "echo", arguments: { text: "hello" } },
        ],
      } satisfies ChatWithToolsResponse);
    } else {
      // Second response: final.
      json(res, 200, {
        session_id: "sess-2",
        response: "tool ran",
        tokens_in: 2,
        tokens_out: 1,
        turns_taken: 2,
        duration: "2ms",
        finish_reason: "stop",
      } satisfies ChatWithToolsResponse);
    }
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    const resp = await client.chatWithTools({ prompt: "hi" }, [echoTool]);
    assert.equal(resp.response, "tool ran");
    assert.equal(calls, 2);
  } finally {
    await server.close();
  }
});

test("chatWithTools surfaces unknown-tool errors without crashing", async () => {
  const server = await startServer((_req, res) => {
    json(res, 200, {
      session_id: "sess-3",
      response: "",
      tokens_in: 1,
      tokens_out: 1,
      turns_taken: 1,
      duration: "1ms",
      finish_reason: "tool_calls",
      tool_calls: [{ id: "tc-1", name: "missing_tool", arguments: {} }],
    } satisfies ChatWithToolsResponse);
  });
  try {
    // Loop: first response requests missing_tool (error result), second is final.
    let calls = 0;
    const server2 = await startServer((_req, res) => {
      calls++;
      if (calls === 1) {
        json(res, 200, {
          session_id: "sess-3",
          response: "",
          tokens_in: 1,
          tokens_out: 1,
          turns_taken: 1,
          duration: "1ms",
          finish_reason: "tool_calls",
          tool_calls: [{ id: "tc-1", name: "missing_tool", arguments: {} }],
        } satisfies ChatWithToolsResponse);
      } else {
        json(res, 200, {
          session_id: "sess-3",
          response: "handled",
          tokens_in: 1,
          tokens_out: 1,
          turns_taken: 1,
          duration: "1ms",
          finish_reason: "stop",
        } satisfies ChatWithToolsResponse);
      }
    });
    try {
      const client = new HawkClient({ baseURL: server2.url });
      const resp = await client.chatWithTools({ prompt: "hi" }, [echoTool]);
      assert.equal(resp.response, "handled");
    } finally {
      await server2.close();
    }
  } finally {
    await server.close();
  }
});

test("chatWithTools throws after exceeding maxRounds", async () => {
  const server = await startServer((_req, res) => {
    // Always return a tool call so the loop never finishes on its own.
    json(res, 200, {
      session_id: "sess-4",
      response: "",
      tokens_in: 1,
      tokens_out: 1,
      turns_taken: 1,
      duration: "1ms",
      finish_reason: "tool_calls",
      tool_calls: [{ id: "tc-1", name: "echo", arguments: { text: "spin" } }],
    } satisfies ChatWithToolsResponse);
  });
  try {
    const client = new HawkClient({ baseURL: server.url });
    await assert.rejects(
      () => client.chatWithTools({ prompt: "hi" }, [echoTool], 3),
      (err: unknown) => {
        assert.ok(err instanceof Error);
        assert.match(err.message, /exceeded max rounds \(3\)/);
        return true;
      },
    );
  } finally {
    await server.close();
  }
});
