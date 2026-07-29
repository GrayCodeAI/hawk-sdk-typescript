/**
 * Composio and cognee integration for the Hawk TypeScript SDK.
 *
 * This module provides TypeScript methods for:
 *   - Searching composio tools
 *   - Executing composio tools
 *   - Listing composio credentials
 *   - Storing and recalling cognee structured memory entries (QA, trace, feedback, skill run)
 *   - Improving memories (re-process for quality)
 *   - Syncing session memories to permanent graph
 */

import { parseAPIError } from "./errors.js";
import type { RetryConfig } from "./retry.js";

const DEFAULT_BASE_URL = "http://127.0.0.1:4590";

// --- Composio Types ---

export interface ComposioTool {
  name: string;
  description?: string;
  scope?: "read" | "write" | "action";
  auth_required?: boolean;
  params?: Record<string, unknown>;
  tags?: string[];
  category?: string;
}

export interface ComposioToolResult {
  success: boolean;
  data?: Record<string, unknown>;
  error?: string;
}

export interface ComposioCredential {
  id: string;
  service_name: string;
  type: string;
  scope?: string;
  expires_at?: string;
  metadata?: Record<string, string>;
}

// --- Cognee Entry Types ---

export interface CogneeQAEntry {
  question: string;
  answer: string;
  project: string;
  context?: string;
  feedback_text?: string;
  feedback_score?: number;
  used_graph_ids?: string[];
  session_id?: string;
  source_agent?: string;
}

export interface CogneeTraceEntry {
  origin_function: string;
  project: string;
  session_id?: string;
  status?: string;
  method_params?: string;
  method_return_value?: string;
  memory_query?: string;
  memory_context?: string;
  error_message?: string;
  source_agent?: string;
}

export interface CogneeFeedbackEntry {
  target_node_id: string;
  project: string;
  feedback_text?: string;
  score?: number;
  session_id?: string;
  source_agent?: string;
}

export interface CogneeSkillRunEntry {
  skill_name: string;
  project: string;
  status?: string;
  skill_version?: string;
  params?: string;
  result?: string;
  duration_ms?: number;
  error?: string;
  session_id?: string;
  source_agent?: string;
}

export interface CogneeImproveResult {
  nodes_processed: number;
  nodes_improved: number;
  summaries_generated: number;
  embeddings_refreshed: number;
  duplicates_merged: number;
  errors: number;
  duration_ms: number;
}

// --- Composio Methods ---

export async function searchComposioTools(
  query: string = "",
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<ComposioTool[]> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/composio/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  if (!resp.ok) throw await parseAPIError(resp);
  const data = (await resp.json()) as { tools: ComposioTool[] };
  return data.tools ?? [];
}

export async function executeComposioTool(
  name: string,
  params: Record<string, unknown> = {},
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<ComposioToolResult> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/composio/execute`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, params }),
  });
  if (!resp.ok) throw await parseAPIError(resp);
  return (await resp.json()) as ComposioToolResult;
}

export async function listComposioCredentials(
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<ComposioCredential[]> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/composio/credentials`);
  if (!resp.ok) throw await parseAPIError(resp);
  return (await resp.json()) as ComposioCredential[];
}

// --- Cognee Memory Methods ---

export async function rememberQA(
  qa: CogneeQAEntry,
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<string> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/cognee/qa`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(qa),
  });
  if (!resp.ok) throw await parseAPIError(resp);
  const data = (await resp.json()) as { id: string };
  return data.id;
}

export async function rememberTrace(
  trace: CogneeTraceEntry,
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<string> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/cognee/trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(trace),
  });
  if (!resp.ok) throw await parseAPIError(resp);
  const data = (await resp.json()) as { id: string };
  return data.id;
}

export async function rememberFeedback(
  feedback: CogneeFeedbackEntry,
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<string> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/cognee/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(feedback),
  });
  if (!resp.ok) throw await parseAPIError(resp);
  const data = (await resp.json()) as { id: string };
  return data.id;
}

export async function rememberSkillRun(
  skillRun: CogneeSkillRunEntry,
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<string> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/cognee/skill_run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(skillRun),
  });
  if (!resp.ok) throw await parseAPIError(resp);
  const data = (await resp.json()) as { id: string };
  return data.id;
}

export async function improve(
  opts: {
    project?: string;
    min_confidence?: number;
    min_access_count?: number;
    consolidate_duplicates?: boolean;
    regenerate_summaries?: boolean;
    refresh_embeddings?: boolean;
    limit?: number;
  } = {},
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<CogneeImproveResult> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/cognee/improve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(opts),
  });
  if (!resp.ok) throw await parseAPIError(resp);
  return (await resp.json()) as CogneeImproveResult;
}

export async function syncSessionToPermanent(
  sessionId: string,
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<number> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/cognee/sync_session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ session_id: sessionId }),
  });
  if (!resp.ok) throw await parseAPIError(resp);
  const data = (await resp.json()) as { promoted: number };
  return data.promoted;
}

export async function recallWithSession(
  query: string,
  sessionId: string,
  project: string = "",
  limit: number = 10,
  options?: {
    baseUrl?: string;
    timeout?: number;
    retry?: RetryConfig;
  },
): Promise<string> {
  const baseUrl = options?.baseUrl ?? DEFAULT_BASE_URL;
  const resp = await fetch(`${baseUrl}/cognee/recall_session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, session_id: sessionId, project, limit }),
  });
  if (!resp.ok) throw await parseAPIError(resp);
  const data = (await resp.json()) as { context: string };
  return data.context;
}
