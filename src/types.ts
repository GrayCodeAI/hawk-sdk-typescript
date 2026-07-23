/**
 * API types for the Hawk daemon HTTP API.
 *
 * Field names use snake_case to match the daemon's JSON wire format exactly,
 * mirroring the hawk-sdk-go and hawk-sdk-python clients.
 */

/** ChatRequest is the request body for POST /v1/chat. */
export interface ChatRequest {
  prompt: string;
  session_id?: string;
  model?: string;
  max_turns?: number;
  autonomy?: string;
  cwd?: string;
  agent?: string;
  system_prompt?: string;
  temperature?: number;
  top_p?: number;
  tool_choice?: string;
  parallel_tool_calls?: boolean;
}

/** ChatResponse is the response from POST /v1/chat. */
export interface ChatResponse {
  session_id: string;
  response: string;
  tokens_in: number;
  tokens_out: number;
  turns_taken: number;
  duration: string;
}

/** HealthResponse is the response from GET /v1/health. */
export interface HealthResponse {
  status: string;
  version: string;
  uptime: string;
  active_sessions: number;
  started_at: string;
}

/** SessionSummary is a session entry in the list response. */
export interface SessionSummary {
  id: string;
  created_at: string;
  last_used: string;
  turns: number;
  cwd: string;
}

/** SessionDetail is the full session detail from GET /v1/sessions/{id}. */
export interface SessionDetail {
  id: string;
  created_at: string;
  updated_at: string;
  model: string;
  provider: string;
  cwd: string;
  name: string;
  message_count: number;
  tool_calls: number;
}

/** ToolSchema describes a tool's function signature (OpenAI function format). */
export interface ToolSchema {
  /** name is the function name. */
  name: string;
  /** description explains what the tool does. */
  description: string;
  /** parameters is a JSON Schema object describing the function's parameters. */
  parameters: Record<string, unknown>;
}

/** ToolCall represents a tool invocation requested by the model. */
export interface ToolCall {
  /** id is the unique identifier for this tool call. */
  id: string;
  /** name is the function name to invoke. */
  name: string;
  /** arguments is the arguments object for the tool call. */
  arguments: Record<string, unknown>;
}

/**
 * ToolResult holds the result of executing a tool call.
 *
 * Hawk's daemon keys tool results by the `tool_use_id` field it emitted in the
 * assistant's tool_use block (Anthropic/MCP convention), not OpenAI's
 * `tool_call_id` — the daemon would otherwise drop unmatched results.
 */
export interface ToolResult {
  tool_use_id: string;
  content: string;
  is_error?: boolean;
}

/** Message is a conversation message. */
export interface Message {
  role: string;
  content?: string;
  tool_use?: ToolCall[];
  tool_results?: ToolResult[];
}

/** ChatWithToolsRequest extends ChatRequest with tool definitions for the model. */
export interface ChatWithToolsRequest extends ChatRequest {
  tools?: ToolSchema[];
  tool_results?: ToolResult[];
  messages?: Message[];
}

/** ChatWithToolsResponse extends ChatResponse with tool call information. */
export interface ChatWithToolsResponse extends ChatResponse {
  tool_calls?: ToolCall[];
  finish_reason?: string;
}

/** ModelStat is per-model usage in StatsResponse. */
export interface ModelStat {
  model: string;
  requests: number;
  cost_usd: number;
}

/** StatsResponse is the response from GET /v1/stats. */
export interface StatsResponse {
  total_sessions: number;
  total_messages: number;
  total_tool_calls: number;
  total_cost_usd: number;
  active_days: number;
  models: ModelStat[];
}

/** PaginatedResponse wraps paginated list results. */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  offset: number;
  limit: number;
  has_more: boolean;
}

/** ListOptions configures pagination for list endpoints. */
export interface ListOptions {
  offset?: number;
  limit?: number;
}

/** ErrorResponse is the standard error envelope from the daemon. */
export interface ErrorResponse {
  error: string;
  code?: string;
  details?: string;
}
