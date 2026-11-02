// Advisory extraction only. These are not MapAsk records: their original span.2 aliases must never be re-indexed.
// The final merger and validateMapReply still receive the complete, original, validated MapAsk.
import { partitionGroups } from '../dist/public/shared/map-route.js';

export const EXTRACTION_KINDS = Object.freeze(['part', 'relation', 'condition', 'correction', 'material', 'uncertain']);
// A finite advisory list, not accepted map claims. Dense source conditions/corrections must not be clipped to a target of 12.
// Increasing this capacity does not change evidence/coverage guards or the original-ask final map validator.
export const EXTRACTION_CANDIDATES_MAX = 24;
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const fail = code => { throw new Error(code); };
const shape = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Split already validated original records at whole-span boundaries. Core text has a targetChars limit;
 * bounded neighboring/header context and the original non-span lead are additional, so total payload size is a soft target.
 * Nothing is clipped, renumbered, normalized, or silently omitted when either limit cannot be satisfied. */
export function planMapPartitions(ask, { targetChars = 3500, maxPartitions = 12 } = {}) {
  if (!Number.isSafeInteger(targetChars) || targetChars < 1 || !Number.isSafeInteger(maxPartitions) || maxPartitions < 1
    || !ask || !Array.isArray(ask.records) || !ask.records.length) fail('INVALID_PARTITION_INPUT');
  const seen = new Set(), flat = [];
  for (const [ri, record] of ask.records.entries()) {
    if (!record || typeof record.id !== 'string' || typeof record.kind !== 'string' || typeof record.basis !== 'string'
      || typeof record.note !== 'string' || typeof record.lead !== 'string' || !Array.isArray(record.spans) || !record.spans.length) fail('INVALID_PARTITION_INPUT');
    for (const [si, span] of record.spans.entries()) {
      if (!span || typeof span.s !== 'string' || !span.s.startsWith(`${record.id}.`) || seen.has(span.s)
        || typeof span.t !== 'string' || !span.t.length) fail('INVALID_PARTITION_INPUT');
      seen.add(span.s);
      if (span.t.length > targetChars) fail('MAP_PARTITION_TOO_LARGE');
      flat.push({ ri, si, size: span.t.length });
    }
  }
  // The same grouping the browser counts with before it sends (shared/map-route.ts fitMapInput).
  const groups = partitionGroups(flat.map(entry => entry.size), targetChars).map(indices => indices.map(i => flat[i]));
  if (groups.length > maxPartitions) fail('MAP_PARTITION_LIMIT');
  return groups.map((entries, pi) => {
    const owned = new Map();
    for (const { ri, si } of entries) { if (!owned.has(ri)) owned.set(ri, []); owned.get(ri).push(si); }
    const records = [...owned].map(([ri, indices]) => {
      const record = ask.records[ri], first = indices[0], last = indices.at(-1), selected = new Set(indices), core = new Set(indices);
      for (let i = Math.max(0, first - 2); i <= Math.min(record.spans.length - 1, last + 2); i++) selected.add(i);
      let headings = 0;
      for (let i = first - 1; i >= 0 && headings < 2; i--) if (record.spans[i].k === 'h') { selected.add(i); headings++; }
      const order = [...selected].sort((a, b) => a - b);
      return { id: record.id, basis: record.basis, kind: record.kind, note: record.note,
        ...(Object.hasOwn(record, 'addedAt') ? { addedAt: record.addedAt } : {}),
        // Lead is original text outside the first evidence span. It is always context, even on a later shard.
        lead: record.lead, spans: order.map(i => structuredClone(record.spans[i])),
        core: indices.map(i => record.spans[i].s), context: order.filter(i => !core.has(i)).map(i => record.spans[i].s) };
    });
    return { id: `extract-${String(pi + 1).padStart(2, '0')}`, records };
  });
}

/** Structural receipt, not a semantic completeness certificate. Every core alias must be acknowledged exactly once.
 * Candidates are sparse advisory pointers; they neither become final facts nor advance the original input's read coverage.
 * A refusal keeps its INVALID_EXTRACTION message and says one coarse reason (error.reason): 'shape' (the reply or the partition),
 * 'coverage' (covered is not exactly the core aliases) or 'candidate' (too many, or one malformed or pointing outside). */
export function validateExtraction(value, partition) {
  // The message stays INVALID_EXTRACTION; reason is one fixed category for a local diagnostic, never a value.
  const invalid = reason => { const error = new Error('INVALID_EXTRACTION'); error.reason = reason; throw error; };
  if (!partition || !Array.isArray(partition.records)) invalid('input');
  if (!shape(value, ['covered', 'candidates'])) invalid('shape');
  const core = new Set(), allowed = new Set();
  for (const record of partition.records) {
    if (!record || !Array.isArray(record.core) || !Array.isArray(record.context) || !Array.isArray(record.spans)) invalid('input');
    for (const alias of record.core) { if (typeof alias !== 'string' || core.has(alias)) invalid('input'); core.add(alias); }
    for (const span of record.spans) { if (typeof span?.s !== 'string' || allowed.has(span.s)) invalid('input'); allowed.add(span.s); }
    const declared = [...record.core, ...record.context];
    if (new Set(declared).size !== declared.length || declared.some(alias => !record.spans.some(span => span.s === alias))
      || declared.length !== record.spans.length) invalid('input');
  }
  if (!core.size) invalid('input');
  if (!Array.isArray(value.covered) || value.covered.length !== core.size
    || new Set(value.covered).size !== core.size || value.covered.some(alias => !core.has(alias))) invalid('coverage');
  if (!Array.isArray(value.candidates)) invalid('shape');
  if (value.candidates.length > EXTRACTION_CANDIDATES_MAX) invalid('count');
  for (const candidate of value.candidates) {
    if (!shape(candidate, ['kind', 'text', 'at']) || !EXTRACTION_KINDS.includes(candidate.kind)
      || typeof candidate.text !== 'string' || !candidate.text.trim() || candidate.text.length > 240 || CONTROL.test(candidate.text)) invalid('candidate');
    if (!Array.isArray(candidate.at) || !candidate.at.length || new Set(candidate.at).size !== candidate.at.length
      || candidate.at.some(alias => !allowed.has(alias)) || !candidate.at.some(alias => core.has(alias))) invalid('anchor');
  }
  return structuredClone(value);
}

/** Safe feedback for the one bounded extraction correction: fixed paths (covered, candidates[i].at, ...), fixed rules and counts.
 * Neither aliases nor any text of the rejected receipt or the records are copied; the partition itself lists its core. */
export function extractionStageIssues(value, partition) {
  const issues = [];
  const add = (path, rule, expected = null, actual = null) => {
    if (issues.length < 12 && !issues.some(issue => issue.path === path && issue.rule === rule)) issues.push({ path, rule, expected, actual });
  };
  try {
    if (!shape(value, ['covered', 'candidates'])) { add('reply', 'shape'); return issues; }
    const core = new Set(), allowed = new Set();
    for (const record of partition?.records ?? []) { for (const alias of record?.core ?? []) core.add(alias); for (const span of record?.spans ?? []) allowed.add(span?.s); }
    if (!Array.isArray(value.covered)) add('covered', 'shape');
    else {
      const known = new Set(value.covered.filter(alias => core.has(alias)));
      if (known.size !== core.size) add('covered', 'coverage', core.size, known.size);
      if (value.covered.some(alias => !core.has(alias))) add('covered', 'reference');
      if (new Set(value.covered).size !== value.covered.length) add('covered', 'duplicate');
    }
    if (!Array.isArray(value.candidates)) add('candidates', 'shape');
    else {
      if (value.candidates.length > EXTRACTION_CANDIDATES_MAX) add('candidates', 'count', EXTRACTION_CANDIDATES_MAX, value.candidates.length);
      value.candidates.slice(0, EXTRACTION_CANDIDATES_MAX).forEach((candidate, i) => {
        const path = `candidates[${i}]`;
        if (!shape(candidate, ['kind', 'text', 'at'])) { add(path, 'keys'); return; }
        if (!EXTRACTION_KINDS.includes(candidate.kind)) add(`${path}.kind`, 'kind');
        if (typeof candidate.text !== 'string' || !candidate.text.trim() || CONTROL.test(candidate.text)) add(`${path}.text`, 'text');
        else if (candidate.text.length > 240) add(`${path}.text`, 'length', 240, candidate.text.length);
        if (!Array.isArray(candidate.at) || !candidate.at.length || new Set(candidate.at).size !== candidate.at.length
          || candidate.at.some(alias => !allowed.has(alias)) || !candidate.at.some(alias => core.has(alias))) add(`${path}.at`, 'reference');
      });
    }
  } catch { /* A diagnostic read failure cannot replace the original stage outcome. */ }
  return issues;
}
