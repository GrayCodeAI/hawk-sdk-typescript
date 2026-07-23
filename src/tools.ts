/**
 * Tool execution support. A Tool pairs a ToolSchema (describing the function
 * to the model) with a run function that executes it.
 */

import type { ToolSchema } from "./types.js";

/**
 * Tool represents a callable tool with its schema and execution function.
 * The run function receives the model-supplied arguments and returns a result
 * string (or a promise of one). Throwing signals a tool execution error.
 */
export interface Tool {
  /** schema describes the tool for the model. */
  schema: ToolSchema;
  /** run executes the tool with the given arguments and returns a result string. */
  run: (
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<string> | string;
}
