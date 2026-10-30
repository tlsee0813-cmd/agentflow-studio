// AF137 synthetic corpus (model-free, author-written; not the 136 reply, which was never kept). Each case is one later reply on
// the 116 photo-sorter case: the lawful map.7 reply, or that reply with one generic contract fault at a known nested place, plus
// the same faults on the map.6 ask of the same project. Sensitive-looking markers are planted in faulty values and extra keys so a
// diagnosis can be checked not to carry them. Modules are passed in so a base build and a candidate build read the same objects.
import * as K from './condition116-case.mjs';

export const MARKERS = ['SECRET_MARKER_137', 'sk-AAAAAAAAAAAAAAAAAAAAAAAA137', 'EXTRA_KEY_137'];
const SECRETISH = `sk-${'A'.repeat(24)}137`;

/** [{ name, schema, ask, reply, expect? }]; expect (map.7 only) is the candidate's [path, rule, target] for a generic guard. */
export function corpus(mods) {
  const { D, M, C, S, studioView, emptyBundle } = mods;
  const c = K.conditionProject({ D, M, C, S, studioView, emptyBundle }), p = mods.parseProject(JSON.stringify(c.project));
  const a7 = M.buildMapAsk(p, studioView(p), [c.rq], c.rq.id, M.MAP7_SCHEMA), a6 = M.buildMapAsk(p, studioView(p), [c.rq], c.rq.id, M.MAP6_SCHEMA);
  const base7 = () => { const w = K.replyFor7(a7.ask, a7.records), R = K.aliases(a7.ask, a7.records).report;
    w.relations.push({ from: 'new:webp', to: 'P01', kind: 'needs', note: '썸네일 인코딩에 쓰임', at: K.piece(a7.ask, R, '썸네일 생성기를') }); return w; };
  const base6 = () => K.replyFor6(a6.ask, a6.records);
  const out = [];
  const add7 = (name, change, expect) => { const w = base7(); const r = change ? change(w) ?? w : w; out.push({ name: `7:${name}`, schema: 7, ask: a7.ask, reply: r, ...(expect ? { expect } : {}) }); };
  const add6 = (name, change) => { const w = base6(); const r = change ? change(w) ?? w : w; out.push({ name: `6:${name}`, schema: 6, ask: a6.ask, reply: r }); };
  const R7 = K.aliases(a7.ask, a7.records).report;
  add7('lawful');
  add7('root array', () => [], ['reply', 'contract', 'shape']);
  add7('root extra key', w => ({ ...w, EXTRA_KEY_137: 'SECRET_MARKER_137' }), ['reply', 'contract', 'keys']);
  add7('summary number', w => { w.summary = 137; }, ['summary', 'contract', 'shape']);
  add7('summary over 200', w => { w.summary = `SECRET_MARKER_137 ${'x'.repeat(200)}`; }, ['summary', 'contract', 'text']);
  add7('summary secret-like', w => { w.summary = `키 ${SECRETISH}`; }, ['summary', 'contract', 'secret-like']);
  add7('parts object', w => { w.parts = { SECRET_MARKER_137: 1 }; }, ['parts', 'contract', 'shape']);
  add7('parts 25', w => { w.parts = Array.from({ length: 25 }, () => w.parts[1]); }, ['parts', 'contract', 'count']);
  add7('part extra key', w => { w.parts[1].EXTRA_KEY_137 = 'SECRET_MARKER_137'; }, ['parts[1]', 'contract', 'keys']);
  add7('new part parent unknown', w => { w.parts[0].parent = 'P99'; }, ['parts[0].parent', 'contract', 'parent']);
  add7('existing part named', w => { w.parts[1].name = 'SECRET_MARKER_137'; }, ['parts[1]', 'contract', 'existing-name-parent']);
  add7('new part name blank', w => { w.parts[0].name = '   '; }, ['parts[0].name', 'contract', 'text']);
  add7('new part no basis', w => { w.parts[0].basis = []; }, ['parts[0].basis', 'contract', 'basis-required']);
  add7('claims 5', w => { w.parts[1].claims.push(w.parts[1].claims[0]); }, ['parts[1].claims', 'contract', 'count']);
  add7('claim kind', w => { w.parts[1].claims[2].kind = 'SECRET_MARKER_137'; }, ['parts[1].claims[2].kind', 'contract', 'kind']);
  add7('claim text control', w => { w.parts[1].claims[1].text = 'SECRET_MARKER_137\u0007'; }, ['parts[1].claims[1].text', 'contract', 'text']);
  add7('claim replaces unknown', w => { w.parts[1].claims[0].replaces = 'SECRET_MARKER_137'; }, ['parts[1].claims[0].replaces', 'contract', 'replaces']);
  add7('claim extra key', w => { w.parts[1].claims[3].EXTRA_KEY_137 = 1; }, ['parts[1].claims[3]', 'contract', 'keys']);
  add7('new parts cycle', w => { w.parts.unshift(K.part7('new:loop', { name: '고리', parent: 'new:webp', basis: w.parts[0].basis })); w.parts[1].parent = 'new:loop'; }, ['parts[0].parent', 'contract', 'parent-cycle']);
  add7('relation kind', w => { w.relations[0].kind = 'SECRET_MARKER_137'; }, ['relations[0].kind', 'contract', 'kind']);
  add7('relation end unknown', w => { w.relations[0].to = 'P77'; }, ['relations[0]', 'contract', 'ends']);
  add7('relation note number', w => { w.relations[0].note = 7; }, ['relations[0].note', 'contract', 'shape']);
  add7('candidate text over 240', w => { w.candidates[0].text = 'y'.repeat(241); }, ['candidates[0].text', 'contract', 'text']);
  add7('candidate statement kind', w => { w.candidates[0].statement.kind = 'SECRET_MARKER_137'; }, ['candidates[0].statement.kind', 'contract', 'kind']);
  add7('candidate statement extra key', w => { w.candidates[0].statement.EXTRA_KEY_137 = null; }, ['candidates[0].statement', 'contract', 'keys']);
  add7('gaps 3', w => { w.gaps = ['a', 'b', 'c']; }, ['gaps', 'contract', 'count']);
  add7('gap over 160', w => { w.gaps = [`SECRET_MARKER_137${'g'.repeat(160)}`]; }, ['gaps[0]', 'contract', 'text']);
  add7('material what blank', w => { w.material[0].what = ''; }, ['material[0].what', 'contract', 'text']);
  add7('material at number', w => { w.material[0].at = 137; }, ['material[0].at', 'contract', 'shape']);
  add7('match record key', w => { w.matches[2].record = 'SECRET_MARKER_137'; }, ['matches[2]', 'contract', 'shape']);
  add7('match stance', w => { w.matches[0].stance = 'SECRET_MARKER_137'; }, ['matches[0]', 'contract', 'match-contract']);
  add7('match unknown request', w => { w.matches[1].targets = [{ requestId: 'RQ_SECRET_MARKER_137', itemId: 'change_1' }]; }, ['matches[1]', 'contract', 'match-contract']);
  add7('match extra key', w => { w.matches[3].EXTRA_KEY_137 = 'SECRET_MARKER_137'; }, ['matches[3]', 'contract', 'match-contract']);
  add7('match text secret-like', w => { w.matches[3].text = `값 ${SECRETISH}`; }, ['matches[3]', 'contract', 'secret-like']);
  add7('match replaces unknown prior', w => { w.matches[3].replaces = 'M09'; }, ['matches[3].replaces', 'contract', 'prior']);
  add7('matches 25', w => { w.matches = Array.from({ length: 25 }, () => w.matches[3]); }, ['matches', 'contract', 'count']);
  // Structured refusals that existed before 137 (they must stay exactly as they were).
  add7('kept: condition not-anchor', w => { w.matches[1].aboutAt = K.CODE_META.version; });
  add7('kept: invalid new key', w => { w.parts[0].ref = 'new:SecretMarker'; });
  add7('kept: condition-length', w => { w.parts[1].claims[0].aboutAt = K.piece(a7.ask, R7, '모바일 조건: Pixel 9'); });
  add7('kept: claim key', w => { w.parts[1].claims[0].key = 'SECRET_MARKER_137'; });
  // map.6: the same faults (as far as its shape goes) must refuse exactly as before.
  add6('lawful');
  add6('root extra key', w => ({ ...w, EXTRA_KEY_137: 'SECRET_MARKER_137' }));
  add6('summary over 200', w => { w.summary = `SECRET_MARKER_137 ${'x'.repeat(200)}`; });
  add6('claim kind', w => { w.parts[0].claims[0].kind = 'SECRET_MARKER_137'; });
  add6('existing part named', w => { w.parts[0].name = 'SECRET_MARKER_137'; });
  add6('match stance', w => { w.matches[0].stance = 'SECRET_MARKER_137'; });
  add6('match text secret-like', w => { w.matches[0].text = `값 ${SECRETISH}`; });
  add6('gaps 3', w => { w.gaps = ['a', 'b', 'c']; });
  add6('kept: source-kind', w => { w.matches[1].at = K.piece(a6.ask, K.aliases(a6.ask, a6.records).report, '검사 조건:'); });
  return out;
}

/** What a validator says of one case: ok with its value, or the refusal (its class, message and structured fields only). */
export function outcome(validate, x) {
  try { return { ok: true, value: validate(x.reply, x.ask) }; }
  catch (e) { return { ok: false, name: e?.name ?? null, message: e?.message ?? null, ...(e?.name === 'MapReplyError' ? { path: e.path, rule: e.rule, target: e.target } : {}) }; }
}
