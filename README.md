<p align="center">
  <h1 align="center">Hawk SDK for TypeScript</h1>
  <p align="center">
    <strong>Dependency-free TypeScript client for the Hawk daemon API</strong>
  </p>
  <p align="center">
    <img src="https://img.shields.io/badge/Node-18+-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node">
    <img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License">
  </p>
</p>

---

Hawk SDK for TypeScript is the official TypeScript client library for the
[Hawk](https://github.com/GrayCodeAI/hawk) daemon API. It provides a
dependency-free, type-safe client for interacting with Hawk's HTTP API from
Node.js applications (any runtime with a global `fetch`, Node 18+).

## Ecosystem

Hawk SDK for TypeScript is part of the [hawk-eco](https://github.com/GrayCodeAI/hawk-eco) mono-ecosystem:

| Component | Purpose |
|-----------|---------|
| **hawk** | AI-powered coding agent for the terminal |
| **hawk-sdk-go** | Go SDK for the Hawk daemon API |
| **hawk-sdk-python** | Python SDK for the Hawk daemon API |
| **hawk-sdk-typescript** | TypeScript SDK for the Hawk daemon API (this repo) |
| **hawk-core-contracts** | Shared cross-repo contracts (types, events, tools) |

## Installation

```bash
npm install hawk-sdk
# or
pnpm add hawk-sdk
```

## Quick start

```ts
import { HawkClient, defaultRetryConfig } from "hawk-sdk";

const client = new HawkClient({
  baseURL: "http://127.0.0.1:4590", // default
  apiKey: process.env.HAWK_API_KEY, // optional
  retry: defaultRetryConfig(), // optional: automatic retries w/ backoff
});

const health = await client.health();
console.log(health.status); // "ok"

const reply = await client.chat({ prompt: "Explain closures in JavaScript." });
console.log(reply.response);
```

### Streaming

```ts
const reader = await client.chatStream({ prompt: "Write a haiku." });
for await (const event of reader) {
  process.stdout.write(event.data);
}
```

### Sessions & stats

```ts
const sessions = await client.sessions();
const detail = await client.session(sessions[0].id);
const messages = await client.messages(detail.id, { offset: 0, limit: 50 });
const stats = await client.stats();
await client.deleteSession(detail.id);
```

### Agents

`Agent` wraps a client with declarative configuration and tracks the session
automatically for multi-turn conversations:

```ts
import { Agent, HawkClient } from "hawk-sdk";

const agent = new Agent(new HawkClient(), {
  model: "gpt-4o",
  systemPrompt: "You are a concise assistant.",
  memory: { enabled: true },
});

const first = await agent.chat("Remember the number 7.");
const second = await agent.chat("What number did I give you?"); // same session
```

### Tools

Provide tools and the SDK runs the full tool-execution loop until the model
stops requesting calls:

```ts
const agent = new Agent(client, {
  tools: [
    {
      schema: {
        name: "get_weather",
        description: "Get the weather for a city.",
        parameters: {
          type: "object",
          properties: { city: { type: "string" } },
          required: ["city"],
        },
      },
      run: async (args) => `It is sunny in ${args.city}.`,
    },
  ],
});

const reply = await agent.chat("What's the weather in Tokyo?");
```

### Error handling

All non-2xx responses throw a typed error extending `APIError`, so you can
branch with `instanceof`:

```ts
import { NotFoundError, RateLimitError } from "hawk-sdk";

try {
  await client.session("missing");
} catch (err) {
  if (err instanceof NotFoundError) {
    console.log("no such session");
  } else if (err instanceof RateLimitError) {
    console.log(`retry after ${err.retryAfterMs}ms`);
  }
}
```

## Retries

The client performs **no retries by default**. Pass a retry config to enable
exponential backoff with full jitter and `Retry-After` support:

```ts
import { defaultRetryConfig } from "hawk-sdk";

const client = new HawkClient({ retry: defaultRetryConfig() });
```

Idempotent requests (GET/DELETE) retry on 429/500/502/503/504. Non-idempotent
requests (POST `/v1/chat`) retry only on 429, since a 5xx may mean the daemon
already began processing the request.

## API reference

| Method | Description |
|--------|-------------|
| `health(signal?)` | Daemon connectivity and version |
| `chat(req, signal?)` | Send a prompt, return the full response |
| `chatStream(req, signal?)` | Send a prompt, stream SSE events |
| `chatWithTools(req, tools, maxRounds?, signal?)` | Run the tool-execution loop |
| `sessions(signal?)` | List active sessions |
| `session(id, signal?)` | Get a session by ID |
| `messages(id, opts?, signal?)` | Paginated session messages |
| `deleteSession(id, signal?)` | Delete a session |
| `stats(signal?)` | Aggregated usage statistics |

Every method accepts an optional `AbortSignal` as its last argument for
cancellation.

## Development

```bash
npm install       # install dev dependencies (typescript, tsx)
npm run build     # compile to dist/
npm run typecheck # type-check without emitting
npm test          # run the test suite (node:test via tsx)
```

The runtime build in `dist/` has **zero dependencies** — it relies only on the
global `fetch`, `ReadableStream`, and `TextDecoder` available in Node 18+.

## License

[MIT](LICENSE) © GrayCode AI
