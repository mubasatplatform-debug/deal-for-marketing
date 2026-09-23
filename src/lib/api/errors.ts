/**
 * Errors shared by the REST API and the MCP server. `code` is stable and
 * machine-readable; `message` is for the developer (or the model) reading it
 * and says what to do next.
 */
export type ApiErrorCode =
  | "unauthorized"
  | "insufficient_scope"
  | "forbidden"
  | "not_found"
  | "method_not_allowed"
  | "invalid_json"
  | "payload_too_large"
  | "validation_error"
  | "rate_limited"
  | "key_limit_reached"
  | "internal_error";

export type FieldIssue = { field: string; message: string };

export class ApiError extends Error {
  readonly status: number;
  readonly code: ApiErrorCode;
  readonly details?: FieldIssue[];
  /** Seconds, for 429 responses. */
  readonly retryAfter?: number;
  /** The key the failed call was made with, when it was a valid one (for auditing). */
  keyId?: number;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    extra: { details?: FieldIssue[]; retryAfter?: number } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = extra.details;
    this.retryAfter = extra.retryAfter;
  }
}

export const missingScope = (scope: string) =>
  new ApiError(
    403,
    "insufficient_scope",
    `This API key lacks the "${scope}" scope. Create a key with that scope at /client/keys (or /admin/keys for team scopes).`,
  );
