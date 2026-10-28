export const SCHEMA = 'idea015.project.10';
export const V9_SCHEMA = 'idea015.project.9';
/** project.8 had no map readings: it reads as none (readings=[]); nothing else changes. */
export const V8_SCHEMA = 'idea015.project.8';
/** project.7 had no pasted records: it reads as none (pasted=[]); nothing else changes. */
export const V7_SCHEMA = 'idea015.project.7';
export const V6_SCHEMA = 'idea015.project.6';
/** project.5 had no area understanding and no export anchors: every area reads none, every export anchor=null (no backfill). */
export const V5_SCHEMA = 'idea015.project.5';
/** project.4 had no background snapshots: every task and export reads background=null (nothing is backfilled). */
export const V4_SCHEMA = 'idea015.project.4';
/** project.3 had no space; it is read as an empty one. */
export const V3_SCHEMA = 'idea015.project.3';
export const PREVIOUS_SCHEMA = 'idea015.project.2';
export const LEGACY_SCHEMA = 'idea015.project.1';
export const RESULT_SCHEMA = 'agentflow.return.1';
export const RESULT_BYTES = 131072;
export const RESULT_TEXT_LIMIT = 11000;
/** AREA17: return.1 plus one optional, already organised description of the area the returned task belongs to. */
export const RESULT2_SCHEMA = 'agentflow.return.2';
export const API_SCHEMA = 'idea022.context.7';
export const TEXT_LIMIT = 12000;
// One limit for the same compact JSON bytes: autosave, recovery file download and import.
export const FILE_LIMIT = 8_000_000;
// Element-count cap for every persisted/validated array, derived from FILE_LIMIT: an element written by
// this app serialises to well over FILE_LIMIT / ITEM_LIMIT = 80 bytes, so the byte limit is what binds real
// projects. The cap only bounds hand-crafted files; validation stays linear up to it.
export const ITEM_LIMIT = 100_000;
// AI request only. Local handoff, autosave and recovery files are not bound by it.
export const REQUEST_BYTES = 131072;
// Only when full context exceeds REQUEST_BYTES: older, never-edited requests may use marked excerpts.
export const EXCERPT_CHARS = 200;
export const PASTED_TEXT_LIMIT = 60000;
export const CLAIM_KINDS = ['want', 'idea', 'reported', 'checked', 'describes', 'open', 'differs'];
export const isMapReading = (e) => e.version === 'map-reading.1' || e.version === 'map-reading.2';
export const READINGS_LIMIT = 500;
export const PASTED_LIMIT = 500;
export const SOURCE_LABEL = {
    request: '사용자 요청 원문', report: '가져온 구현 보고 · 앱 미검증',
    evidence: '사용자가 가져온 관찰·검사 자료 · 앱 미검증', test_answer: '합성 시험답변 · 실제 요구 아님',
    answer: '사용자 답변', manual_decision: '사용자가 직접 기록·수정한 기준'
};
export const BASIS_LABEL = {
    requested: '요청 원문 · 해석 미확정', answered: '사용자 답변 원문', confirmed: '사용자 확정', deferred: '사용자 보류'
};
/* ---------- GUIDE097: area guidance. A separate, unsaved preview before the user's own request; never project data. ---------- */
/** guidance.2 (GUIDE098): the reply's proposal gains defaults. guidance.3 (GUIDE099): the request gains currentInstruction.
 * The version moves each time so a stale client and server refuse each other plainly. Never stored. */
export const GUIDE_SCHEMA = 'guidance.3';
