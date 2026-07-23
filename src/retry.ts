/**
 * Automatic retry behavior for API requests: exponential backoff with full
 * jitter and Retry-After support, mirroring hawk-sdk-go's retry semantics.
 */

/** RetryConfig configures the automatic retry behavior for API requests. */
export interface RetryConfig {
  /** maxRetries is the maximum number of retry attempts. */
  maxRetries: number;
  /** initialBackoffMs is the base delay before the first retry. */
  initialBackoffMs: number;
  /** maxBackoffMs is the maximum delay between retries. */
  maxBackoffMs: number;
  /** backoffMultiplier controls exponential growth of the backoff. */
  backoffMultiplier: number;
  /** retryableStatuses lists HTTP status codes that should trigger a retry. */
  retryableStatuses: number[];
}

/**
 * defaultRetryConfig returns the default retry configuration: 3 retries, 1s
 * initial backoff, 30s max, 2x multiplier, retry on 429/500/502/503/504.
 */
export function defaultRetryConfig(): RetryConfig {
  return {
    maxRetries: 3,
    initialBackoffMs: 1000,
    maxBackoffMs: 30000,
    backoffMultiplier: 2.0,
    retryableStatuses: [429, 500, 502, 503, 504],
  };
}

/** isRetryable checks if the given status code is in the retryable set. */
export function isRetryable(cfg: RetryConfig, statusCode: number): boolean {
  return cfg.retryableStatuses.includes(statusCode);
}

/**
 * retryableForMethod reports whether statusCode should trigger a retry,
 * accounting for whether the request is idempotent. Only 429 is retried for
 * non-idempotent requests (e.g. POST /v1/chat): a 5xx may mean the daemon
 * already started processing the request, so blindly resubmitting it could
 * duplicate side effects.
 */
export function retryableForMethod(
  cfg: RetryConfig,
  statusCode: number,
  idempotent: boolean,
): boolean {
  if (!idempotent) {
    return statusCode === 429;
  }
  return isRetryable(cfg, statusCode);
}

/**
 * backoffDurationMs computes the backoff delay (in milliseconds) for the given
 * attempt (0-indexed) using exponential backoff with full jitter.
 */
export function backoffDurationMs(cfg: RetryConfig, attempt: number): number {
  const backoff = Math.min(
    cfg.initialBackoffMs * Math.pow(cfg.backoffMultiplier, attempt),
    cfg.maxBackoffMs,
  );
  // Full jitter: random value between 0 and the calculated backoff.
  return Math.random() * backoff;
}

/**
 * parseRetryAfterMs parses a Retry-After header value into milliseconds.
 * Supports both delta-seconds (integer) and HTTP-date formats. Returns 0 when
 * the header is absent or unparseable.
 */
export function parseRetryAfterMs(val: string | null): number {
  if (!val) {
    return 0;
  }
  const trimmed = val.trim();

  // Try parsing as delta-seconds.
  if (/^\d+$/.test(trimmed)) {
    return Number.parseInt(trimmed, 10) * 1000;
  }

  // Try parsing as HTTP-date.
  const date = Date.parse(trimmed);
  if (!Number.isNaN(date)) {
    const delta = date - Date.now();
    if (delta > 0) {
      return delta;
    }
  }

  return 0;
}

/**
 * sleep waits for the given number of milliseconds, rejecting early with the
 * abort reason if the provided AbortSignal fires.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason ?? new Error("aborted"));
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(signal?.reason ?? new Error("aborted"));
    };
    const cleanup = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}
