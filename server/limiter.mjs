import { ApiError } from './errors.mjs';
// Single-process development limits. Not distributed, durable billing quotas or auth.
export function createLimiter(config, now = Date.now) {
  let started = now(), windowCount = 0, total = 0, active = 0;
  const seen = new Set();
  return {
    acquire(requestId) {
      if (now() - started >= 60000) { started = now(); windowCount = 0; }
      if (seen.has(requestId)) throw new ApiError('DUPLICATE_REQUEST',409);
      if (total >= config.cap) throw new ApiError('PROCESS_CALL_CAP',429);
      if (windowCount >= config.rate) throw new ApiError('LOCAL_RATE_LIMIT',429,60);
      if (active >= config.concurrency) throw new ApiError('AI_BUSY',429,5);
      seen.add(requestId); total++; windowCount++; active++;
      let released = false;
      return () => { if (!released) { active--; released = true; } };
    }
  };
}
