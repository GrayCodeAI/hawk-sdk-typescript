/**
 * HawkClient is the TypeScript SDK client for the hawk daemon HTTP API.
 *
 * It is dependency-free at runtime (uses the global `fetch`) and mirrors the
 * hawk-sdk-go client: functional-style options, typed errors, optional
 * automatic retries, and SSE streaming.
 */

import { parseAPIError } from "./errors.js";
import {
  backoffDurationMs,
  parseRetryAfterMs,
  retryableForMethod,
  sleep,
  type RetryConfig,
} from "./retry.js";
import { StreamReader } from "./stream.js";
import type { Tool } from "./tools.js";
import type {
  ChatRequest,
  ChatResponse,
  ChatWithToolsRequest,
  ChatWithToolsResponse,
  HealthResponse,
  ListOptions,
  Message,
  PaginatedResponse,
  SessionDetail,
  SessionSummary,
  StatsResponse,
  ToolResult,
  ToolSchema,
} from "./types.js";
import { userAgent } from "./version.js";

/** defaultBaseURL is the daemon address used when none is configured. */
export const defaultBaseURL = "http://127.0.0.1:4590";

/** ClientOptions configures the HawkClient. */
export interface ClientOptions {
  /** baseURL sets the daemon base URL (default: http://127.0.0.1:4590). */
  baseURL?: string;
  /** apiKey is sent as an Authorization: Bearer header on every request. */
  apiKey?: string;
  /**
   * retry enables automatic retries with exponential backoff. The client
   * performs no retries by default; pass defaultRetryConfig() for production.
   */
  retry?: RetryConfig;
  /** fetch overrides the fetch implementation (useful for testing). */
  fetch?: typeof fetch;
}

interface SendInit {
  headers: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}

/**
 * HawkClient is a client for the hawk daemon API.
 *
 * Note: the client performs no retries by default. Pass
 * `{ retry: defaultRetryConfig() }` for production use to enable automatic
 * retries with exponential backoff on transient failures.
 */
export class HawkClient {
  private readonly baseURL: string;
  private readonly apiKey: string;
  private readonly retry?: RetryConfig;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: ClientOptions = {}) {
    this.baseURL = (opts.baseURL ?? defaultBaseURL).replace(/\/+$/, "");
    this.apiKey = opts.apiKey ?? "";
    this.retry = opts.retry;
    this.fetchImpl = opts.fetch ?? fetch;
  }

  /** health checks daemon connectivity. */
  async health(signal?: AbortSignal): Promise<HealthResponse> {
    return this.getJSON<HealthResponse>("/v1/health", undefined, signal);
  }

  /** chat sends a prompt and returns the complete response. */
  async chat(req: ChatRequest, signal?: AbortSignal): Promise<ChatResponse> {
    return this.postJSON<ChatResponse>("/v1/chat", req, signal);
  }

  /** chatStream sends a prompt and streams the response via SSE. */
  async chatStream(
    req: ChatRequest,
    signal?: AbortSignal,
  ): Promise<StreamReader> {
    const headers = this.jsonHeaders();
    headers.set("Accept", "text/event-stream");
    const resp = await this.send(
      "POST",
      `${this.baseURL}/v1/chat`,
      {
        headers: Object.fromEntries(headers),
        body: JSON.stringify(req),
        signal,
      },
      false,
    );
    if (resp.status !== 200) {
      // parseAPIError consumes the body to build the typed error.
      throw await parseAPIError(resp);
    }
    return new StreamReader(resp);
  }

  /**
   * sessions lists the daemon's active sessions. The daemon returns a plain
   * array with no pagination envelope.
   */
  async sessions(signal?: AbortSignal): Promise<SessionSummary[]> {
    return this.getJSON<SessionSummary[]>("/v1/sessions", undefined, signal);
  }

  /** session gets a session by ID. */
  async session(id: string, signal?: AbortSignal): Promise<SessionDetail> {
    return this.getJSON<SessionDetail>(
      `/v1/sessions/${encodeURIComponent(id)}`,
      undefined,
      signal,
    );
  }

  /** messages gets messages for a session with optional pagination. */
  async messages(
    sessionID: string,
    opts?: ListOptions,
    signal?: AbortSignal,
  ): Promise<PaginatedResponse<Message>> {
    return this.getJSON<PaginatedResponse<Message>>(
      `/v1/sessions/${encodeURIComponent(sessionID)}/messages`,
      paginationParams(opts),
      signal,
    );
  }

  /** deleteSession deletes a session by ID. */
  async deleteSession(id: string, signal?: AbortSignal): Promise<void> {
    const headers = this.jsonHeaders();
    const resp = await this.send(
      "DELETE",
      `${this.baseURL}/v1/sessions/${encodeURIComponent(id)}`,
      { headers: Object.fromEntries(headers), signal },
      true, // DELETE is idempotent: safe to retry on any configured status.
    );
    // The daemon returns 204 No Content on delete, but older versions and
    // proxies may respond 200 OK. Accept any 2xx.
    if (!resp.ok) {
      // parseAPIError consumes the body to build the typed error.
      throw await parseAPIError(resp);
    }
    await resp.body?.cancel().catch(() => {});
  }

  /** stats gets aggregated usage statistics. */
  async stats(signal?: AbortSignal): Promise<StatsResponse> {
    return this.getJSON<StatsResponse>("/v1/stats", undefined, signal);
  }

  /**
   * chatWithTools implements the tool execution loop. It sends a chat request,
   * checks for tool_calls in the response, executes matching tools, appends
   * results to the conversation, and repeats until either no more tool calls
   * are requested or maxRounds is reached.
   */
  async chatWithTools(
    req: ChatRequest,
    tools: Tool[],
    maxRounds = 10,
    signal?: AbortSignal,
  ): Promise<ChatResponse> {
    if (maxRounds <= 0) {
      maxRounds = 10;
    }

    const schemas: ToolSchema[] = tools.map((t) => t.schema);
    const toolMap = new Map<string, Tool>();
    for (const t of tools) {
      toolMap.set(t.schema.name, t);
    }

    const messages: Message[] = [];
    let toolResults: ToolResult[] = [];
    // Work on a copy so we can clear the prompt across rounds without mutating
    // the caller's request.
    const roundReq: ChatRequest = { ...req };

    for (let round = 0; round < maxRounds; round++) {
      if (signal?.aborted) {
        throw signal.reason ?? new Error("aborted");
      }

      const toolReq: ChatWithToolsRequest = {
        ...roundReq,
        tools: schemas,
        tool_results: toolResults,
        messages,
      };

      const resp = await this.postJSON<ChatWithToolsResponse>(
        "/v1/chat",
        toolReq,
        signal,
      );

      const toolCalls = resp.tool_calls ?? [];
      if (toolCalls.length === 0 || resp.finish_reason === "stop") {
        return {
          session_id: resp.session_id,
          response: resp.response,
          tokens_in: resp.tokens_in,
          tokens_out: resp.tokens_out,
          turns_taken: resp.turns_taken,
          duration: resp.duration,
        };
      }

      toolResults = [];
      for (const tc of toolCalls) {
        const tool = toolMap.get(tc.name);
        if (!tool) {
          toolResults.push({
            tool_use_id: tc.id,
            content: `error: unknown tool "${tc.name}"`,
            is_error: true,
          });
          continue;
        }
        try {
          const result = await tool.run(tc.arguments, signal);
          toolResults.push({ tool_use_id: tc.id, content: result });
        } catch (err) {
          toolResults.push({
            tool_use_id: tc.id,
            content: `error: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          });
        }
      }

      // Append assistant response and tool results to message history.
      messages.push({
        role: "assistant",
        content: resp.response,
        tool_use: toolCalls,
      });
      messages.push({ role: "tool", tool_results: toolResults });

      // Clear the prompt for subsequent rounds — the messages carry context.
      roundReq.prompt = "";
    }

    throw new Error(
      `hawk-sdk: tool execution loop exceeded max rounds (${maxRounds})`,
    );
  }

  // --- internal transport -------------------------------------------------

  private jsonHeaders(): Headers {
    const headers = new Headers();
    headers.set("Accept", "application/json");
    headers.set("User-Agent", userAgent());
    if (this.apiKey !== "") {
      headers.set("Authorization", `Bearer ${this.apiKey}`);
    }
    return headers;
  }

  private async getJSON<T>(
    path: string,
    params: URLSearchParams | undefined,
    signal?: AbortSignal,
  ): Promise<T> {
    let url = this.baseURL + path;
    if (params && params.toString() !== "") {
      url += `?${params.toString()}`;
    }
    const headers = this.jsonHeaders();
    // GET is idempotent: safe to retry on any configured status.
    const resp = await this.send(
      "GET",
      url,
      { headers: Object.fromEntries(headers), signal },
      true,
    );
    if (!resp.ok) {
      throw await parseAPIError(resp);
    }
    return (await resp.json()) as T;
  }

  private async postJSON<T>(
    path: string,
    body: unknown,
    signal?: AbortSignal,
  ): Promise<T> {
    const headers = this.jsonHeaders();
    headers.set("Content-Type", "application/json");
    // POST is not idempotent (currently only /v1/chat): a 5xx may mean the
    // daemon already started processing, so only 429 is retried.
    const resp = await this.send(
      "POST",
      this.baseURL + path,
      {
        headers: Object.fromEntries(headers),
        body: JSON.stringify(body),
        signal,
      },
      false,
    );
    // Accept any 2xx status.
    if (!resp.ok) {
      throw await parseAPIError(resp);
    }
    return (await resp.json()) as T;
  }

  /**
   * send executes a request, applying retry logic when a RetryConfig is set.
   * `idempotent` must be false for requests that are not safe to blindly
   * resend after a 5xx (e.g. POST /v1/chat).
   */
  private async send(
    method: string,
    url: string,
    init: SendInit,
    idempotent: boolean,
  ): Promise<Response> {
    const cfg = this.retry;
    const requestInit: RequestInit = {
      method,
      headers: init.headers,
      body: init.body,
      signal: init.signal,
    };

    if (!cfg) {
      return await this.fetchImpl(url, requestInit);
    }

    let lastResp: Response | undefined;
    let lastErr: unknown;

    for (let attempt = 0; attempt <= cfg.maxRetries; attempt++) {
      let resp: Response;
      try {
        resp = await this.fetchImpl(url, requestInit);
      } catch (err) {
        // Network error — retryable.
        lastErr = err;
        if (attempt < cfg.maxRetries) {
          await sleep(backoffDurationMs(cfg, attempt), init.signal);
          continue;
        }
        throw lastErr;
      }

      // Success or non-retryable status — return as-is.
      if (!retryableForMethod(cfg, resp.status, idempotent)) {
        return resp;
      }

      // Retryable status — determine backoff and retry.
      lastResp = resp;
      lastErr = undefined;

      if (attempt < cfg.maxRetries) {
        let backoff = backoffDurationMs(cfg, attempt);
        if (resp.status === 429) {
          const ra = resp.headers.get("Retry-After");
          if (ra) {
            const parsed = parseRetryAfterMs(ra);
            if (parsed >= 0) {
              backoff = Math.min(parsed, cfg.maxBackoffMs);
            }
          }
        }
        // Drain body before retry to allow connection reuse.
        await resp.body?.cancel().catch(() => {});
        await sleep(backoff, init.signal);
        continue;
      }
    }

    if (lastResp) {
      return lastResp;
    }
    throw lastErr;
  }
}

function paginationParams(opts?: ListOptions): URLSearchParams | undefined {
  if (!opts) {
    return undefined;
  }
  const params = new URLSearchParams();
  if (opts.offset && opts.offset > 0) {
    params.set("offset", String(opts.offset));
  }
  if (opts.limit && opts.limit > 0) {
    params.set("limit", String(opts.limit));
  }
  return params;
}
