import { type StorageLike } from '../shared/storage.js';
import { STATIC_TARGET } from './static-target.js';
import { STUDIO_ENDPOINT } from './studio-endpoint.js';
// Static build (copied as client/runtime.js): no server unless the build set STUDIO_API_BASE. Store keys are prefixed so the
// static site never shares or overwrites the local server's projects.
export const RUNTIME = { kind: 'static' as const, apiBase: STUDIO_ENDPOINT };
export const runtimeStorage = (storage: StorageLike): StorageLike => ({
  getItem: key => storage.getItem(STATIC_TARGET.prefix + key),
  setItem: (key, value) => storage.setItem(STATIC_TARGET.prefix + key, value)
});
