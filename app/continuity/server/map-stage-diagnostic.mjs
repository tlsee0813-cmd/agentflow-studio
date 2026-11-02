// Where a divided map reading stopped: a stage id, its phase and fixed categories only (a rule, a safe path, a contract guard
// category or a coarse reason). Never model text, record text, quoted aliases or error.target outside the fixed guard list.
// This is best-effort reading of an already refused outcome: it never changes validation and never throws.
import { redactSecrets } from '../dist/public/shared/secret.js';
import { safeValidation, originalAnchors, BLUEPRINT_PARTS_MAX, BLUEPRINT_NEW_PARTS_MAX, BLUEPRINT_GLOBAL_MAX, BLUEPRINT_GLOBAL_KINDS,
  BLUEPRINT_CORRECTIONS_MAX, BLUEPRINT_CORRECTIONS_PER_PART_MAX } from './map-blueprint.mjs';

export const STAGE_PHASES = Object.freeze(['extract', 'plan', 'render', 'global', 'correction']);
const STAGE = /^(?:extract-[1-9]\d?|plan|render-[1-9]\d?(?:-semantic)?|render-semantic|global(?:-final)?)(?:-correction)?$/;
/** Coarse reasons for refusals that carry no validator path/rule (extraction receipts, the blueprint, assignment shape). */
export const STAGE_REASONS = Object.freeze(['shape', 'coverage', 'candidate', 'anchor', 'count', 'text', 'duplicate', 'ref', 'existing-part',
  'parent', 'parent-cycle', 'kind', 'correction', 'revision', 'assignment', 'key', 'transport', 'input']);
const REASONS = new Set(STAGE_REASONS);

/** 'extract' | 'plan' | 'render' | 'global' | 'correction' for a pipeline stage id, else null. */
export function stagePhase(id) {
  if (typeof id !== 'string' || !STAGE.test(id)) return null;
  if (id.endsWith('-correction')) return 'correction';
  return id.startsWith('extract-') ? 'extract' : id.startsWith('render-') ? 'render' : id === 'plan' ? 'plan' : 'global';
}

/** The public detail of a refused stage: { stage, phase, total?, rule?, path?, category?, reason? }. */
export function stageDiagnostic(id, error, { total, reason } = {}) {
  const phase = stagePhase(id);
  if (!phase) return null;
  const out = { stage: id, phase };
  if (Number.isSafeInteger(total) && total >= 1 && total <= 99) out.total = total;
  try {
    const validation = safeValidation(error);
    if (validation) { out.rule = validation.rule; out.path = validation.path; if (validation.category) out.category = validation.category; }
  } catch { /* no rule */ }
  let why = null;
  try { why = typeof reason === 'function' ? reason() : reason ?? null; } catch { why = null; }
  if (!out.rule && (typeof why !== 'string' || !REASONS.has(why))) {
    try { why = typeof error?.reason === 'string' ? error.reason : null; } catch { why = null; }
  }
  if (!out.rule && typeof why === 'string' && REASONS.has(why)) out.reason = why;
  return out;
}

const exact = (value, keys) => !!value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const CONTROL = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;
const words = (value, max) => typeof value === 'string' && !!value.trim() && value.length <= max && !CONTROL.test(value);
const NEW = /^new:[a-z0-9_-]{1,24}$/;

/** First failing category of a refused blueprint, read in the validator's order; null when none is found. */
export function blueprintReason(value, ask) {
  try {
    const later = ask?.schemaVersion === 'studio.map.7';
    if (!exact(value, later ? ['parts', 'global', 'corrections'] : ['parts', 'global']) || !Array.isArray(value.parts) || !Array.isArray(value.global)
      || (later && !Array.isArray(value.corrections))) return 'shape';
    if (value.parts.length > BLUEPRINT_PARTS_MAX || value.global.length > BLUEPRINT_GLOBAL_MAX || (later && value.corrections.length > BLUEPRINT_CORRECTIONS_MAX)) return 'count';
    const anchors = originalAnchors(ask), existing = new Map(ask.parts.map(part => [part.id, part])), used = new Set(); let fresh = 0;
    for (const part of value.parts) {
      if (!exact(part, ['ref', 'name', 'parent', 'at', 'focus'])) return 'shape';
      if (typeof part.ref !== 'string' || used.has(part.ref)) return 'duplicate';
      if (!words(part.name, 60) || !words(part.focus, 240)) return 'text';
      if (!anchors(part.at)) return 'anchor';
      if (existing.has(part.ref)) { if (part.name !== existing.get(part.ref).name || part.parent !== existing.get(part.ref).parentId) return 'existing-part'; }
      else if (!NEW.test(part.ref)) return 'ref';
      else if (++fresh > BLUEPRINT_NEW_PARTS_MAX) return 'count';
      used.add(part.ref);
    }
    const parents = new Map(ask.parts.map(part => [part.id, part.parentId]));
    for (const part of value.parts) {
      if (part.parent !== null && (typeof part.parent !== 'string' || (!existing.has(part.parent) && !used.has(part.parent)))) return 'parent';
      parents.set(part.ref, part.parent);
    }
    for (const part of value.parts) {
      const trail = new Set();
      for (let ref = part.ref; ref !== null; ref = parents.get(ref) ?? null) { if (trail.has(ref)) return 'parent-cycle'; trail.add(ref); }
    }
    for (const item of value.global) {
      if (!exact(item, ['kind', 'text', 'at'])) return 'shape';
      if (!BLUEPRINT_GLOBAL_KINDS.includes(item.kind)) return 'kind';
      if (!words(item.text, 240)) return 'text';
      if (!anchors(item.at)) return 'anchor';
    }
    if (later) {
      const seen = new Set(), counts = new Map();
      for (const c of value.corrections) {
        if (!exact(c, ['part', 'claim', 'at'])) return 'shape';
        if (typeof c.part !== 'string' || !used.has(c.part) || !existing.has(c.part) || typeof c.claim !== 'string'
          || !existing.get(c.part).current.some(claim => claim.key === c.claim)) return 'correction';
        if (!anchors(c.at)) return 'anchor';
        const id = `${c.part}:${c.claim}`, count = (counts.get(c.part) ?? 0) + 1;
        if (seen.has(id) || count > BLUEPRINT_CORRECTIONS_PER_PART_MAX) return 'correction';
        seen.add(id); counts.set(c.part, count);
      }
    }
  } catch { /* unknown */ }
  return null;
}

const WIRE_KEYS = ['summary', 'parts', 'relations', 'candidates', 'gaps', 'matches', 'material'];
/** A render refusal without a validator path: its wire shape, its assigned part list, or its claim key range. */
export function fragmentReason(value, assignment) {
  try {
    if (!exact(value, WIRE_KEYS) || typeof value.summary !== 'string' || WIRE_KEYS.slice(1).some(key => !Array.isArray(value[key]))
      || value.summary !== '' || WIRE_KEYS.slice(2).some(key => value[key].length)) return 'shape';
    const planned = new Map((assignment?.parts ?? []).map(part => [part.ref, part])), seen = new Set();
    if (value.parts.length !== planned.size) return 'assignment';
    for (const part of value.parts) {
      if (!part || typeof part !== 'object' || !planned.has(part.ref) || seen.has(part.ref)) return 'assignment';
      const plan = planned.get(part.ref);
      if (NEW.test(part.ref) ? part.name !== plan.name || part.parent !== plan.parent : part.name !== null || part.parent !== null) return 'assignment';
      if (!Array.isArray(part.claims)) return 'shape';
      const start = assignment.keyStart;
      for (const claim of part.claims) {
        const n = typeof claim?.key === 'string' && /^s[1-9]\d{0,2}$/.test(claim.key) ? Number(claim.key.slice(1)) : NaN;
        if (!(n >= start && n <= start + 98)) return 'key';
      }
      seen.add(part.ref);
    }
  } catch { /* unknown */ }
  return null;
}

/** A global-stage refusal without a validator path: a malformed review sentinel or a wire that is not the global shape. */
export function globalReason(value) {
  try {
    if (value && typeof value === 'object' && !Array.isArray(value) && Object.hasOwn(value, 'reviseParts')) return 'revision';
    if (!exact(value, WIRE_KEYS) || typeof value.summary !== 'string' || WIRE_KEYS.slice(1).some(key => !Array.isArray(value[key])) || value.parts.length) return 'shape';
  } catch { /* unknown */ }
  return null;
}

const HIDDEN = '[가려진 비밀값]';
/** A JSON copy for a local diagnostic file: every string (and key) with key-like text hidden and the given keys removed. */
export function maskForKeeping(value, keys = []) {
  const secrets = keys.filter(key => typeof key === 'string' && key.length >= 8);
  const mask = text => { let out = redactSecrets(text).text; for (const key of secrets) out = out.split(key).join(HIDDEN); return out; };
  const walk = (v, depth) => {
    if (depth > 64) return null;
    if (typeof v === 'string') return mask(v);
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return v;
    if (Array.isArray(v)) return v.map(x => walk(x, depth + 1));
    if (typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [mask(k), walk(x, depth + 1)]));
    return null;
  };
  try { return walk(JSON.parse(JSON.stringify(value ?? null)), 0); } catch { return null; }
}
