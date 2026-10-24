import { type StorageLike } from '../shared/storage.js';
// Server build: the studio API is on the same origin as the page. Storage keys are the existing ones (no prefix).
export const RUNTIME = { kind: 'server' as const, apiBase: '' as string | null };
export const runtimeStorage = (storage: StorageLike): StorageLike => storage;
