/**
 * SSE stream reader for streaming chat responses, mirroring hawk-sdk-go's
 * StreamReader. Parses `event:`/`data:` lines from a fetch Response body and
 * yields one StreamEvent per SSE frame.
 */

/** StreamEvent is a single SSE event from the chat stream. */
export interface StreamEvent {
  event: string;
  data: string;
}

/**
 * StreamReader reads SSE events from a streaming chat response.
 *
 * Use it as an async iterable (`for await (const ev of reader)`) or call
 * `next()` directly, which resolves to `null` when the stream is complete.
 */
export class StreamReader {
  private reader: ReadableStreamDefaultReader<Uint8Array>;
  private decoder = new TextDecoder();
  private buffer = "";
  private streamDone = false;

  private current: StreamEvent = { event: "", data: "" };
  private hasData = false;

  constructor(response: Response) {
    if (!response.body) {
      throw new Error("hawk-sdk: response has no body to stream");
    }
    this.reader = response.body.getReader();
  }

  /**
   * next reads the next SSE event from the stream. Resolves to `null` when the
   * stream is complete (the underlying reader is exhausted).
   */
  async next(): Promise<StreamEvent | null> {
    for (;;) {
      // Process a complete line if one is buffered.
      const nl = this.buffer.indexOf("\n");
      if (nl !== -1) {
        let line = this.buffer.slice(0, nl);
        this.buffer = this.buffer.slice(nl + 1);
        if (line.endsWith("\r")) {
          line = line.slice(0, -1);
        }
        const dispatched = this.processLine(line);
        if (dispatched) {
          return dispatched;
        }
        continue;
      }

      // No complete line buffered — flush a trailing partial line at EOF.
      if (this.streamDone) {
        if (this.buffer.length > 0) {
          const line = this.buffer;
          this.buffer = "";
          this.processLine(line);
        }
        if (this.hasData) {
          return this.dispatch();
        }
        return null;
      }

      const { value, done } = await this.reader.read();
      if (done) {
        // Drain any final bytes held by the decoder.
        this.buffer += this.decoder.decode();
        this.streamDone = true;
        continue;
      }
      this.buffer += this.decoder.decode(value, { stream: true });
    }
  }

  /** Async iterator support: `for await (const ev of reader) { ... }`. */
  async *[Symbol.asyncIterator](): AsyncIterator<StreamEvent> {
    for (;;) {
      const ev = await this.next();
      if (ev === null) {
        return;
      }
      yield ev;
    }
  }

  /** close cancels the underlying stream, releasing the connection. */
  async close(): Promise<void> {
    try {
      await this.reader.cancel();
    } catch {
      // Already closed or cancelled — nothing to do.
    }
  }

  private dispatch(): StreamEvent {
    const ev = this.current;
    this.current = { event: "", data: "" };
    this.hasData = false;
    return ev;
  }

  private processLine(line: string): StreamEvent | null {
    if (line === "") {
      // Empty line terminates the current event.
      if (this.hasData) {
        return this.dispatch();
      }
      return null;
    }

    if (line.startsWith("event: ")) {
      this.current.event = line.slice("event: ".length);
    } else if (line.startsWith("data: ")) {
      if (this.current.data !== "") {
        this.current.data += "\n";
      }
      this.current.data += line.slice("data: ".length);
      this.hasData = true;
    } else if (line === "data:") {
      if (this.current.data !== "") {
        this.current.data += "\n";
      }
      this.hasData = true;
    }
    // Other lines (comments starting with ':', unknown fields) are ignored.
    return null;
  }
}
