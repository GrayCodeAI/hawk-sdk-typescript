/**
 * Typed error hierarchy for the Hawk daemon API, mirroring hawk-sdk-go.
 *
 * All errors extend APIError, which carries the HTTP status code, an optional
 * error code string, a human-readable message, and optional details. Subclasses
 * map to specific HTTP status codes so callers can branch with `instanceof`.
 */

import { parseRetryAfterMs } from "./retry.js";

/** APIErrorInit holds the fields needed to construct an APIError. */
export interface APIErrorInit {
  statusCode: number;
  message: string;
  code?: string;
  details?: string;
}

/** APIError is the base error type for all hawk API errors. */
export class APIError extends Error {
  readonly statusCode: number;
  readonly code?: string;
  readonly details?: string;

  constructor(init: APIErrorInit) {
    const msg = init.code
      ? `hawk-sdk: ${init.message} [${init.code}] (status ${init.statusCode})`
      : `hawk-sdk: ${init.message} (status ${init.statusCode})`;
    super(msg);
    this.name = "APIError";
    this.statusCode = init.statusCode;
    this.code = init.code;
    this.details = init.details;
    // Restore prototype chain for correct instanceof across transpilation.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** BadRequestError represents a 400 Bad Request response. */
export class BadRequestError extends APIError {
  constructor(init: APIErrorInit) {
    super(init);
    this.name = "BadRequestError";
  }
}

/** AuthenticationError represents a 401 Unauthorized response. */
export class AuthenticationError extends APIError {
  constructor(init: APIErrorInit) {
    super(init);
    this.name = "AuthenticationError";
  }
}

/** ForbiddenError represents a 403 Forbidden response. */
export class ForbiddenError extends APIError {
  constructor(init: APIErrorInit) {
    super(init);
    this.name = "ForbiddenError";
  }
}

/** NotFoundError represents a 404 Not Found response. */
export class NotFoundError extends APIError {
  constructor(init: APIErrorInit) {
    super(init);
    this.name = "NotFoundError";
  }
}

/**
 * RateLimitError represents a 429 Too Many Requests response. retryAfterMs
 * indicates how long to wait before retrying (0 when unknown).
 */
export class RateLimitError extends APIError {
  readonly retryAfterMs: number;

  constructor(init: APIErrorInit & { retryAfterMs?: number }) {
    super(init);
    this.name = "RateLimitError";
    this.retryAfterMs = init.retryAfterMs ?? 0;
    if (this.retryAfterMs > 0) {
      this.message = `${this.message} (retry after ${this.retryAfterMs}ms)`;
    }
  }
}

/** InternalServerError represents a 500 Internal Server Error response. */
export class InternalServerError extends APIError {
  constructor(init: APIErrorInit) {
    super(init);
    this.name = "InternalServerError";
  }
}

/** ServiceUnavailableError represents a 503 Service Unavailable response. */
export class ServiceUnavailableError extends APIError {
  constructor(init: APIErrorInit) {
    super(init);
    this.name = "ServiceUnavailableError";
  }
}

interface ErrorEnvelope {
  error?: string;
  code?: string;
  details?: string;
}

/**
 * parseAPIError reads a non-2xx response body and returns an appropriate typed
 * error. The daemon's standard error envelope is `{ error, code?, details? }`;
 * if the body is not JSON or lacks `error`, the raw body becomes the message.
 */
export async function parseAPIError(response: Response): Promise<APIError> {
  let body = "";
  try {
    body = await response.text();
  } catch {
    // Body unreadable — fall through with an empty message.
  }

  let message = body;
  let code: string | undefined;
  let details: string | undefined;

  try {
    const parsed = JSON.parse(body) as ErrorEnvelope;
    if (parsed && typeof parsed.error === "string" && parsed.error !== "") {
      message = parsed.error;
      code = parsed.code;
      details = parsed.details;
    }
  } catch {
    // Not JSON — keep the raw body as the message.
  }

  const init: APIErrorInit = {
    statusCode: response.status,
    message: message !== "" ? message : `HTTP ${response.status}`,
    code,
    details,
  };

  switch (response.status) {
    case 400:
      return new BadRequestError(init);
    case 401:
      return new AuthenticationError(init);
    case 403:
      return new ForbiddenError(init);
    case 404:
      return new NotFoundError(init);
    case 429:
      return new RateLimitError({
        ...init,
        retryAfterMs: parseRetryAfterMs(response.headers.get("Retry-After")),
      });
    case 500:
      return new InternalServerError(init);
    case 503:
      return new ServiceUnavailableError(init);
    default:
      return new APIError(init);
  }
}
