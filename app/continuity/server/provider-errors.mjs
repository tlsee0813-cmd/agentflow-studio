// Provider transport errors, shared by every continuity AI call (provider.mjs for /api/continuity and /api/guidance, studio.mjs
// for /api/studio/*). Only the status is read: the caller cancels the upstream body and it never surfaces. No node: imports, so
// it is part of the Worker closure. (server/ keeps its own copy: that tree is frozen by the historic evaluation gates.)
import { ApiError } from '../../server/errors.mjs';

/** The error for a provider HTTP status that is not ok. retryAfter (seconds) applies to the provider's own rate limit only. */
export function providerHttpError(status, retryAfter) {
  if (status === 401 || status === 403) return new ApiError('AI_AUTH_FAILED', 502);
  if (status === 402) return new ApiError('AI_BALANCE_REQUIRED', 502);
  if (status === 429) return new ApiError('AI_RATE_LIMIT', 429, retryAfter);
  if (status === 400 || status === 404 || status === 422) return new ApiError('AI_CONFIG_REJECTED', 502);
  return new ApiError('AI_UNAVAILABLE', 503);
}
/** The error for a call that was aborted: by its own deadline (timedOut) or by the caller (the browser went away). */
export function abortError(timedOut) {
  return timedOut ? new ApiError('AI_TIMEOUT', 504) : new ApiError('CANCELLED', 499);
}
