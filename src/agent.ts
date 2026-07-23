/**
 * Agent wraps a HawkClient with declarative configuration, providing a
 * simplified interface for conversational AI interactions. Mirrors the
 * hawk-sdk-go Agent.
 */

import type { HawkClient } from "./client.js";
import type { StreamReader } from "./stream.js";
import type { Tool } from "./tools.js";
import type { ChatRequest, ChatResponse } from "./types.js";

/** MemoryConfig configures memory behavior for an agent. */
export interface MemoryConfig {
  /**
   * enabled controls whether memory is active. If false, sessionID is ignored
   * and each chat call starts a fresh, session-less conversation.
   */
  enabled: boolean;
  /** sessionID allows resuming a previous session. Only used when enabled. */
  sessionID?: string;
  /**
   * maxMessages is reserved for a future client-side history limit; it is not
   * yet enforced (the daemon manages context retention per session).
   */
  maxMessages?: number;
}

/** AgentConfig holds the declarative configuration for an Agent. */
export interface AgentConfig {
  /** model specifies which LLM model to use. */
  model?: string;
  /** systemPrompt sets a custom system prompt for the agent. */
  systemPrompt?: string;
  /** temperature controls response randomness (0.0 = deterministic). */
  temperature?: number;
  /** topP controls nucleus sampling (0.0-1.0). */
  topP?: number;
  /** toolChoice controls tool selection behavior: "none", "auto", "required". */
  toolChoice?: string;
  /** tools are the tools available to this agent. */
  tools?: Tool[];
  /** maxRounds limits the tool execution loop iterations. */
  maxRounds?: number;
  /** memory is an optional configuration for agent memory/context management. */
  memory?: MemoryConfig;
}

/**
 * Agent wraps a HawkClient with declarative configuration.
 *
 * Each chat or chatStream call captures the session ID at the moment the
 * request is built; a stream returned by chatStream continues to use the
 * session ID captured at call time even if a concurrent chat call establishes
 * a new session while the stream is being consumed.
 */
export class Agent {
  private readonly client: HawkClient;
  private readonly config: AgentConfig;
  private sessionIDValue = "";

  constructor(client: HawkClient, config: AgentConfig = {}) {
    this.client = client;
    this.config = config;
    if (config.memory?.enabled && config.memory.sessionID) {
      this.sessionIDValue = config.memory.sessionID;
    }
  }

  /**
   * chat sends a message and returns the complete response. If the agent has
   * tools configured, it automatically uses the tool execution loop.
   */
  async chat(message: string, signal?: AbortSignal): Promise<ChatResponse> {
    const req = this.buildRequest(message);
    const tools = this.config.tools ?? [];

    let resp: ChatResponse;
    if (tools.length > 0) {
      const maxRounds =
        this.config.maxRounds && this.config.maxRounds > 0
          ? this.config.maxRounds
          : 10;
      resp = await this.client.chatWithTools(req, tools, maxRounds, signal);
    } else {
      resp = await this.client.chat(req, signal);
    }

    this.updateSession(resp);
    return resp;
  }

  /**
   * chatStream sends a message and returns a streaming response reader.
   * Note: streaming with tools is not automatically looped; use chat for full
   * tool loop support.
   */
  async chatStream(
    message: string,
    signal?: AbortSignal,
  ): Promise<StreamReader> {
    const req = this.buildRequest(message);
    return this.client.chatStream(req, signal);
  }

  /** sessionID returns the current session ID, if established. */
  sessionID(): string {
    return this.sessionIDValue;
  }

  private buildRequest(message: string): ChatRequest {
    const req: ChatRequest = {
      prompt: message,
      model: this.config.model,
      session_id: this.sessionIDValue || undefined,
      system_prompt: this.config.systemPrompt,
      temperature: this.config.temperature,
      top_p: this.config.topP,
      tool_choice: this.config.toolChoice,
    };
    if (this.config.maxRounds && this.config.maxRounds > 0) {
      req.max_turns = this.config.maxRounds;
    }
    return req;
  }

  private updateSession(resp: ChatResponse): void {
    if (resp && resp.session_id !== "") {
      this.sessionIDValue = resp.session_id;
    }
  }
}
