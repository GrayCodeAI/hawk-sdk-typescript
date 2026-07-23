/**
 * Shared test helper: a tiny in-process HTTP server that stands in for the
 * hawk daemon, plus a JSON response helper.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";

export type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  body: string,
) => void;

export interface TestServer {
  url: string;
  close: () => Promise<void>;
}

/** startServer launches a mock daemon on an ephemeral port. */
export async function startServer(handler: Handler): Promise<TestServer> {
  const server: Server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => handler(req, res, body));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const addr = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${addr.port}`,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((err) => (err ? reject(err) : resolve())),
      ),
  };
}

/** json writes a JSON response with the given status and headers. */
export function json(
  res: ServerResponse,
  status: number,
  data: unknown,
  headers: Record<string, string> = {},
): void {
  res.writeHead(status, { "Content-Type": "application/json", ...headers });
  res.end(JSON.stringify(data));
}
