export class ApiError extends Error {
  constructor(code, status = 502, retryAfter = null) { super(code); this.name = 'ApiError'; this.code = code; this.status = status; this.retryAfter = retryAfter; }
}
// Do not return/log raw exceptions, upstream response bodies, request contents or headers.
export function safeError(error) {
  if (error instanceof ApiError) return error;
  if (error?.name === 'ContractError') return new ApiError('INVALID_RESPONSE', 502);
  return new ApiError('INTERNAL_ERROR', 500);
}
