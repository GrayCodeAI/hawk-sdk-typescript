/**
 * hawk-sdk — dependency-free TypeScript client for the Hawk daemon API.
 *
 * @example
 * ```ts
 * import { HawkClient, defaultRetryConfig } from "hawk-sdk";
 *
 * const client = new HawkClient({ retry: defaultRetryConfig() });
 * const health = await client.health();
 * const reply = await client.chat({ prompt: "Hello!" });
 * console.log(reply.response);
 * ```
 */

export * from "./types.js";
export * from "./errors.js";
export * from "./retry.js";
export * from "./stream.js";
export * from "./tools.js";
export * from "./version.js";
export * from "./client.js";
export * from "./agent.js";
