// Every error code the Studio server can answer with (the handler, its provider, the job store and the session reader) either has
// a sentence the page shows, or is listed below with the reason the page never shows it. A new server code without either fails
// here, so a raw code never reaches the person by accident.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ERROR_TEXT } from '../dist/public/client/studio-api.js';

const read = f => readFileSync(new URL(f, import.meta.url), 'utf8');
const SERVER = ['../server/studio.mjs', '../server/provider-errors.mjs', '../server/map-jobs.mjs', '../server/sessions.mjs', '../../server/limiter.mjs'];
/** Codes the page handles in code rather than by text, or that only a hand-made request can cause. */
const NOT_SHOWN = {
  CANCELLED: 'the person cancelled; every view checks it first and shows its own note',
  DUPLICATE_REQUEST: 'the studio handler gives every call a fresh id, so it cannot repeat one',
  INVALID_CONTENT_TYPE: 'the page always sends JSON', METHOD_NOT_ALLOWED: 'the page uses each route\'s own method', NOT_FOUND: 'the page asks known routes only',
  OPERATION_ACCEPTING: 'map-run.ts retries while a job is being accepted', OPERATION_CONFLICT: 'map-run.ts settles the local record',
  OPERATION_NOT_FOUND: 'map-run.ts forgets the record', OPERATION_STATE: 'map-run.ts settles the local record'
};
const pageText = () => {
  const run = read('../src/client/map-run.ts');
  return new Set([...Object.keys(ERROR_TEXT), ...[...run.matchAll(/^\s+([A-Z][A-Z0-9_]{2,}):\s*'/gm)].map(m => m[1])]);
};

test('ERRORS-1 every server code has page text or a stated reason it is never shown', () => {
  const codes = new Set(SERVER.flatMap(f => [...read(f).matchAll(/new ApiError\('([A-Z_]+)'/g)].map(m => m[1])));
  assert.ok(codes.size > 25, 'the scan found the server codes');
  const shown = pageText(), missing = [...codes].filter(c => !shown.has(c) && !Object.hasOwn(NOT_SHOWN, c));
  assert.deepEqual(missing, [], 'add a sentence to ERROR_TEXT (or a reason to NOT_SHOWN)');
  const stale = Object.keys(NOT_SHOWN).filter(c => !codes.has(c) || shown.has(c));
  assert.deepEqual(stale, [], 'NOT_SHOWN lists only codes the server still sends and the page has no text for');
});
