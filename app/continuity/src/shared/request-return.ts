/* Frozen requests and quote-backed correspondence. The generated request lives in the plan sidecar; a reading keeps its own
 * copy and matches in the Project's single commit. No auto observation is written back into the sidecar. */
import type { Project, MapReading, ReadingEntry } from './types.js';
import { sourceText } from './validation.js';

export interface EvidenceOrigin { record: string | null; reading: string | null; quote: string | null }
export interface FrozenItem { id: string; title: string; description: string; partIds: string[]; sources: { id: string; title: string; basis: string; origins: EvidenceOrigin[] }[] }
export interface FrozenRequest {
  version: 'request-scope.1'; id: string; projectId: string; planId: string; planRevision: number; createdAt: string;
  basis: string; intent: string; items: FrozenItem[];
}
/** Wire-only projection. The full frozen sources/origins remain in MapInput and the one stored reading. */
export type RequestContext = Omit<FrozenRequest, 'version' | 'items'> & { version: 'request-context.1'; items: Omit<FrozenItem, 'sources'>[] };
export function requestContext(r: FrozenRequest): RequestContext {
  const { items, ...head } = r;
  return structuredClone({ ...head, version: 'request-context.1', items: items.map(({ sources: _sources, ...item }) => item) });
}
export interface RequestTarget { requestId: string; itemId: string }
export type MatchKind = 'reported' | 'checked' | 'code' | 'test' | 'open';
export const MATCH_LABEL: Record<MatchKind, string> = { reported: '작업 보고', checked: '확인 보고', code: '코드 자료', test: '검사 자료', open: '남은 것' };
/** What a quote says about the requested change, apart from its kind (who says it and how): made = it says the change was made,
 * within the quote's own scope (progress in that scope, never the item completed); not-made = it says in so many words that it
 * was not made (not implemented, only planned, an earlier claim withdrawn); unclear = anything else (no information, not
 * reported, a check of some scope, merged or not). A stored match without one (before studio.map.3) is an unclassified report. */
export type MatchStance = 'made' | 'not-made' | 'unclear';
export const MATCH_STANCES: readonly MatchStance[] = ['made', 'not-made', 'unclear'];
export interface MatchRef { reading: string; index: number }
export interface RequestMatch {
  record: string; quote: string; text: string; kind: MatchKind; about: string | null;
  /** One target: clear correspondence. Several: unresolved alternatives, never several automatic completions. */
  targets: RequestTarget[]; why: string;
  /** studio.map.3 and map-reading.3 only. */
  stance?: MatchStance;
}
/** studio.map.3 wire: the stance, and the alias of the earlier match (MapAsk.priors) this record explicitly takes back, if any. */
export interface RequestMatch3 extends RequestMatch { stance: MatchStance; replaces: string | null }
export interface StoredRequestMatch extends RequestMatch { from: number; to: number;
  /** map-reading.3 only: the earlier match (an earlier reading's) this record explicitly withdraws or supersedes. */
  replaces?: MatchRef | null }
export interface RequestCorrection {
  version: 'request-correction.1'; id: string; at: string; reading: string; index: number;
  /** null excludes this passage from requests; otherwise the person selected one of its frozen targets. */
  target: RequestTarget | null;
}
/** The person says a match's withdrawal link is not one: the earlier report it named reads as current again. Its own act, never
 * implied by excluding or retargeting either passage. */
export interface ReplaceCorrection { version: 'replace-correction.1'; id: string; at: string; reading: string; index: number }
/** A withdrawal takes back a match of the same nature (a change report by a change report, a check by a check); a passage left
 * open may take back a change report only by saying it was not made ('철회합니다, 아직 미구현'). */
export const matchGroup = (k: MatchKind) => k === 'reported' || k === 'code' ? 'change' : k === 'checked' || k === 'test' ? 'check' : 'open';
const squash = (t: string) => t.replace(/\s+/g, ' ').trim();
/* Scope identity (about), by the identifiers it names, as whole tokens: a branch ('feature/folder', main), a version (v1, 1.2.0) or a
 * commit (abc1234). Never by plain substring ('v1' is not 'v10') nor by the whole wording ('feature/folder 브랜치' and
 * 'feature/folder의 입력' name the same branch). */
type ScopeIds = { branch: Set<string>; version: Set<string>; commit: Set<string> };
const BRANCH_WORDS = new Set(['main', 'master', 'develop', 'trunk']);
function scopeIds(t: string): ScopeIds {
  const out: ScopeIds = { branch: new Set(), version: new Set(), commit: new Set() };
  for (const raw of t.normalize('NFKC').split(/[\s@]+/).flatMap(w => w.match(/[A-Za-z0-9][A-Za-z0-9._\/-]*/g) ?? [])) {
    const x = raw.replace(/[._\/-]+$/, '').toLowerCase(); if (!x) continue;
    if (/^v\d+(?:\.\d+)*$/.test(x) || /^\d+(?:\.\d+)+$/.test(x)) out.version.add(x.replace(/^v/, ''));
    else if (/^[0-9a-f]{7,40}$/.test(x) && /\d/.test(x) && /[a-f]/.test(x)) out.commit.add(x);
    else if (x.includes('/') || BRANCH_WORDS.has(x)) out.branch.add(x);
  }
  return out;
}
const CLASSES = ['branch', 'version', 'commit'] as const;
/** same: they share an identifier and name no other one of the same class; different: some class is named on both sides with
 * nothing in common (feature/folder vs main, v1 vs v10, two commits); unknown: either side unnamed, or no identifier to compare. */
export type ScopeRelation = 'same' | 'different' | 'unknown';
export function scopeRelation(a: string | null | undefined, b: string | null | undefined): ScopeRelation {
  if (!a || !b) return 'unknown';
  const x = scopeIds(a), y = scopeIds(b), shared = (c: typeof CLASSES[number]) => [...x[c]].some(v => y[c].has(v));
  if (CLASSES.some(c => x[c].size && y[c].size && !shared(c))) return 'different';
  return CLASSES.some(shared) ? 'same' : 'unknown';
}
/** Two scopes on separate lines: another branch or another version (a not-made there leaves a report here standing). Two commits
 * alone are points of one line whose order is not known: not separate, so their reports read side by side. */
export function separateLines(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const x = scopeIds(a), y = scopeIds(b);
  return (['branch', 'version'] as const).some(c => x[c].size && y[c].size && ![...x[c]].some(v => y[c].has(v)));
}
/** The text points at what makes the older scope another one: for every class in which the two differ (both name some and none
 * in common), it names one of the older side's identifiers of that class as a whole token. A shared one (the branch of two
 * commits) never counts; with nothing differing named, nothing is pointed at. */
export function namesDifference(text: string, older: string | null, newer: string | null): boolean {
  if (!older || !newer) return false;
  const a = scopeIds(older), b = scopeIds(newer), got = scopeIds(text);
  const differing = CLASSES.filter(c => a[c].size && b[c].size && ![...a[c]].some(v => b[c].has(v)));
  return differing.length > 0 && differing.every(c => [...a[c]].some(v => got[c].has(v)));
}

const ID = /^[A-Za-z0-9_-]{1,100}$/;
const object = (v: unknown, keys: string[]): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v, k));
const text = (v: unknown, max: number) => typeof v === 'string' && !!v.trim() && v.length <= max && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const id = (v: unknown): v is string => typeof v === 'string' && ID.test(v);
function fail(): never { throw new Error('INVALID_REQUEST_SCOPE'); }
export function validateOrigins(v: unknown): asserts v is EvidenceOrigin[] {
  if (!Array.isArray(v) || v.length > 16) fail();
  for (const x of v) if (!object(x, ['record', 'reading', 'quote']) || (x.record !== null && !id(x.record)) || (x.reading !== null && !id(x.reading)) || (x.quote !== null && (!text(x.quote, 300) || x.record === null))) fail();
}
export function validateFrozenRequest(v: unknown): FrozenRequest {
  if (!object(v, ['version', 'id', 'projectId', 'planId', 'planRevision', 'createdAt', 'basis', 'intent', 'items']) || v.version !== 'request-scope.1' || !id(v.id) || !id(v.projectId) || !id(v.planId) || !Number.isSafeInteger(v.planRevision) || (v.planRevision as number) < 1 || !text(v.basis, 2000) || !text(v.intent, 12000) || typeof v.createdAt !== 'string' || !Number.isFinite(Date.parse(v.createdAt)) || new Date(v.createdAt).toISOString() !== v.createdAt || !Array.isArray(v.items) || !v.items.length || v.items.length > 32) fail();
  const seen = new Set<string>();
  for (const x of v.items as unknown[]) {
    if (!object(x, ['id', 'title', 'description', 'partIds', 'sources']) || !id(x.id) || seen.has(x.id) || !text(x.title, 200) || !text(x.description, 4000) || !Array.isArray(x.partIds) || x.partIds.length > 32 || !x.partIds.every(id) || new Set(x.partIds).size !== x.partIds.length || !Array.isArray(x.sources) || x.sources.length > 48) fail();
    seen.add(x.id as string);
    for (const s of x.sources as unknown[]) {
      if (!object(s, ['id', 'title', 'basis', 'origins']) || !id(s.id) || !text(s.title, 200) || !text(s.basis, 2000)) fail();
      validateOrigins(s.origins);
    }
  }
  return structuredClone(v as unknown as FrozenRequest);
}
export function validateRequestContext(v: unknown): RequestContext {
  if (!object(v, ['version', 'id', 'projectId', 'planId', 'planRevision', 'createdAt', 'basis', 'intent', 'items']) || v.version !== 'request-context.1' || !Array.isArray(v.items)) fail();
  const items = v.items.map(x => {
    if (!object(x, ['id', 'title', 'description', 'partIds'])) fail();
    return { ...x, sources: [] };
  });
  return requestContext(validateFrozenRequest({ ...v, version: 'request-scope.1', items }));
}
type TargetScope = { id: string; items: { id: string }[] };
export const sameTarget = (a: RequestTarget, b: RequestTarget) => a.requestId === b.requestId && a.itemId === b.itemId;
export function hasTarget(requests: TargetScope[], t: RequestTarget): boolean { return requests.some(r => r.id === t.requestId && r.items.some(i => i.id === t.itemId)); }
/** quoteMax: an anchored quote (map-reading.4) is an exact passage of up to ANCHOR_QUOTE_MAX; a copied one stays within 300. */
export function validateRequestMatch(v: unknown, requests: TargetScope[], three = false, quoteMax = 300): RequestMatch {
  if (!object(v, ['record', 'quote', 'text', 'kind', 'about', 'targets', 'why', ...(three ? ['stance', 'replaces'] : [])]) || !id(v.record) || !text(v.quote, quoteMax) || !text(v.text, 240) || !['reported', 'checked', 'code', 'test', 'open'].includes(v.kind as string) || (v.about !== null && !text(v.about, 200)) || !text(v.why, 240) || !Array.isArray(v.targets) || v.targets.length > 8) fail();
  // Something left open never says the change was made.
  if (three && (!MATCH_STANCES.includes(v.stance as MatchStance) || (v.kind === 'open' && v.stance === 'made'))) fail();
  const seen = new Set<string>();
  for (const t of v.targets as unknown[]) {
    if (!object(t, ['requestId', 'itemId']) || !id(t.requestId) || !id(t.itemId) || !hasTarget(requests, t as unknown as RequestTarget)) fail();
    const key = `${t.requestId}/${t.itemId}`; if (seen.has(key)) fail(); seen.add(key);
  }
  return structuredClone(v as unknown as RequestMatch);
}
export interface EffectiveMatch {
  reading: string; index: number; match: StoredRequestMatch; target: RequestTarget | null; excluded: boolean; corrected: boolean; requests: FrozenRequest[];
  prior?: { reading: string; index: number; target: RequestTarget };
  /** The person's last correction of this passage's target (its id), so a reading asked before it can tell it changed. */
  correction: string | null;
  /** A later match explicitly withdrew this one: kept as history, never part of the current reading. */
  replacedBy: (MatchRef & { match: StoredRequestMatch }) | null;
  /** The earlier match this one withdraws, while that link holds. */
  replaces: MatchRef | null;
}
const targetKey = (targets: RequestTarget[]) => targets.map(t => `${t.requestId}/${t.itemId}`).sort().join('|');
const overlap = (a: StoredRequestMatch, b: StoredRequestMatch) => a.record === b.record && a.from < b.to && b.from < a.to;
/** Whether a match may withdraw an earlier effective one: the very same single frozen RQ item the earlier one now answers, of the
 * same nature, saying made or not made (an unclear or general remark never takes a report back), from a new passage, and about
 * that claim's scope: another named branch, version or commit only when text (the record exactly as it was sent with this
 * match, never an unsent tail) names what makes the older one different. */
export function canReplace(prior: { target: RequestTarget | null; excluded: boolean; replaced: boolean; kind: MatchKind; quote: string; about: string | null }, m: { targets: RequestTarget[]; kind: MatchKind; stance?: MatchStance; quote: string; about: string | null }, text: string | null): boolean {
  if (scopeRelation(prior.about, m.about) === 'different' && !(text !== null && namesDifference(text, prior.about, m.about))) return false;
  return !!prior.target && !prior.excluded && !prior.replaced && m.targets.length === 1 && sameTarget(prior.target, m.targets[0]!)
    && (m.stance === 'made' || m.stance === 'not-made') && squash(m.quote) !== squash(prior.quote)
    && (matchGroup(m.kind) === 'open' ? m.stance === 'not-made' && matchGroup(prior.kind) === 'change' : matchGroup(m.kind) === matchGroup(prior.kind));
}
/** Every stored correspondence in order, with the person's corrections and the explicit withdrawals applied. invalid: a stored
 * withdrawal (or its undoing) that does not hold where it stands. texts: each record's full text; only the interval each reading
 * was sent is read from it (for the scope rule of canReplace). */
export function matchLedger(readings: readonly ReadingEntry[], texts: ReadonlyMap<string, string>): { all: EffectiveMatch[]; invalid: boolean } {
  const out: EffectiveMatch[] = []; let invalid = false;
  const at = (ref: MatchRef) => out.find(x => x.reading === ref.reading && x.index === ref.index);
  // What the reading was sent of the match's record: the interval holding the match, as the reply was judged on it.
  const sentText = (r: MapReading, x: StoredRequestMatch) => { const i = r.records.find(i => i.id === x.record && x.from >= i.from && x.to <= i.to), t = texts.get(x.record); return i && t !== undefined ? t.slice(i.from, i.to) : null; };
  for (const r of readings) {
    if (r.version === 'request-correction.1') {
      const x = at(r);
      if (x) { x.target = r.target; x.excluded = r.target === null; x.corrected = true; x.correction = r.id; delete x.prior; }
    } else if (r.version === 'replace-correction.1') {
      const x = at(r), prior = x?.replaces ? at(x.replaces) : undefined;
      if (!x || !prior || prior.replacedBy?.reading !== x.reading || prior.replacedBy.index !== x.index) { invalid = true; continue; }
      // Undone where it was made and on every later reading of the same passage that kept it.
      for (const y of out) if (y.replacedBy?.reading === x.reading && y.replacedBy.index === x.index) y.replacedBy = null;
      x.replaces = null;
    } else if (r.version === 'map-reading.2' || r.version === 'map-reading.3' || r.version === 'map-reading.4') r.matches!.forEach((match, index) => {
      // An explicit earlier correction of the same quote survives reading that passage again.
      const same = (x: EffectiveMatch) => x.match.record === match.record && x.match.from === match.from && x.match.to === match.to;
      const previous = [...out].reverse().find(x => x.corrected && same(x));
      const earlier = previous && targetKey(previous.match.targets) === targetKey(match.targets) && (!previous.target || hasTarget(r.requests!, previous.target)) ? previous : null;
      const proposed = match.targets.length === 1 ? match.targets[0]! : null;
      const conflict = !earlier && previous?.target && proposed && !sameTarget(previous.target, proposed) ? previous : null;
      // Reading a withdrawn passage again (a re-comparison, a copy) does not bring it back.
      const withdrawn = [...out].reverse().find(x => x.replacedBy && same(x) && targetKey(x.match.targets) === targetKey(match.targets));
      const entry: EffectiveMatch = { reading: r.id, index, match, target: earlier ? earlier.target : conflict ? null : proposed,
        excluded: earlier?.excluded ?? false, corrected: earlier?.corrected ?? false, requests: r.requests!, correction: earlier?.correction ?? null,
        replacedBy: withdrawn?.replacedBy ?? null, replaces: null,
        ...(conflict?.target ? { prior: { reading: conflict.reading, index: conflict.index, target: conflict.target } } : {}) };
      if (match.replaces) {
        const prior = at(match.replaces);
        if (!prior || prior.reading === r.id || overlap(prior.match, match) || !canReplace({ ...prior, replaced: !!prior.replacedBy, kind: prior.match.kind, quote: prior.match.quote, about: prior.match.about }, match, sentText(r, match))) invalid = true;
        else { prior.replacedBy = { reading: r.id, index, match }; entry.replaces = { ...match.replaces }; }
      }
      out.push(entry);
    });
  }
  return { all: out, invalid };
}
/** Each record as it was read (a returned report as received: sourceText). */
export const recordTexts = (p: Project): Map<string, string> => new Map([...p.pasted.map(r => [r.id, r.text] as const), ...p.sources.map(r => [r.id, sourceText(p.tasks, r)] as const)]);
export function requestMatches(p: Project): EffectiveMatch[] {
  const out = matchLedger(p.readings, recordTexts(p)).all;
  // A replay of the same passage and scope is one correspondence, with the correction kept above.
  const seen = new Set<string>();
  const recent = out.reverse().filter(x => { const key = `${x.match.record}/${x.match.from}/${x.match.to}/${targetKey(x.match.targets)}`; if (seen.has(key)) return false; seen.add(key); return true; });
  const order = new Map(p.readings.map((r, i) => [r.id, i]));
  return recent.sort((a, b) => (order.get(b.reading)! - order.get(a.reading)!) || a.index - b.index);
}
/** One frozen item as it reads now. made: a current change report (reported/code) says made; not-made: only not made; mixed: both,
 * about scopes that may be the same, with no explicit withdrawal between them (neither is dropped); unclassified: change reports
 * stored before stances; none: nothing about the change (checks, open points, no information). Never product completion. */
export type ItemState = 'made' | 'mixed' | 'not-made' | 'unclassified' | 'none';
export const ITEM_STATE_LABEL: Record<ItemState, string> = { made: '변경 보고', mixed: '보고 엇갈림', 'not-made': '미구현 보고', unclassified: '미분류 보고', none: '변경 근거 없음' };
export interface ItemReading { state: ItemState; lead: EffectiveMatch | null; current: EffectiveMatch[]; history: EffectiveMatch[] }
export function itemReading(matches: EffectiveMatch[], t: RequestTarget): ItemReading {
  const own = matches.filter(x => !x.excluded && !!x.target && sameTarget(x.target, t));
  const current = own.filter(x => !x.replacedBy), history = own.filter(x => x.replacedBy);
  const change = current.filter(x => matchGroup(x.match.kind) === 'change');
  // A check that passed is a check of its scope, never progress; a passage saying the change was not made counts however it is labelled.
  const made = change.filter(x => x.match.stance === 'made'), legacy = change.filter(x => x.match.stance === undefined), not = current.filter(x => x.match.stance === 'not-made' && matchGroup(x.match.kind) !== 'check');
  // Not made on another line (main, another version) leaves a report about this one standing; the same, an unnamed or an
  // undistinguishable scope (two commits) is a clash, so a withdrawal that did not hold never leaves the old positive alone.
  const clash = not.filter(n => [...made, ...legacy].some(x => !separateLines(x.match.about, n.match.about)));
  const state: ItemState = clash.length ? 'mixed' : made.length ? 'made' : not.length ? 'not-made' : legacy.length ? 'unclassified' : 'none';
  // Newest first: without stances (unclassified) the newest passage leads, never the newest positive-sounding one.
  const lead = (state === 'made' ? made[0] : state === 'not-made' ? not[0] : state === 'mixed' ? current.find(x => change.includes(x) || not.includes(x)) : current[0]) ?? null;
  return { state, lead, current, history };
}
/** A brief comparison of one stored read, as its requests' items read now (the same itemReading as each folded item). */
export function requestComparison(p: Project, reading: MapReading): string | null {
  if (!reading.requests?.length) return null;
  const requests = reading.requests, all = requestMatches(p), matches = all.filter(x => x.reading === reading.id && !x.excluded);
  const pending = matches.filter(x => !x.target && x.match.targets.length > 1).length;
  const states = (q: FrozenRequest) => q.items.map(i => itemReading(all, { requestId: q.id, itemId: i.id }).state);
  if (requests.length > 1) {
    const withChange = requests.filter(q => states(q).some(s => s === 'made' || s === 'mixed')).length;
    return `요청문 ${requests.length}개 대조 · ${withChange}개 요청에 변경 보고${pending ? ` · 요청 대응 미정 ${pending}구절` : ''}`;
  }
  const q = requests[0]!, got = states(q), n = (s: ItemState) => got.filter(x => x === s).length;
  return [`원한 항목 ${q.items.length}개`, `변경 보고 ${n('made')}개`, n('mixed') ? `보고 엇갈림 ${n('mixed')}개` : '', n('not-made') ? `미구현 보고 ${n('not-made')}개` : '',
    n('unclassified') ? `미분류 보고 ${n('unclassified')}개` : '', n('none') ? `변경 근거 아직 없는 항목 ${n('none')}개` : '', pending ? `대응 미정 ${pending}구절` : ''].filter(Boolean).join(' · ');
}
const correctable = (r: ReadingEntry): r is MapReading => r.version === 'map-reading.2' || r.version === 'map-reading.3' || r.version === 'map-reading.4';
export function correctRequestMatch(p: Project, reading: string, index: number, target: RequestTarget | null): Project {
  const r = p.readings.find((r): r is MapReading => correctable(r) && r.id === reading), m = r?.matches?.[index];
  if (!r || !m || (target && !hasTarget(r.requests!, target)) || p.readings.length >= 500) throw new Error('INVALID_REQUEST_CORRECTION');
  const entry: RequestCorrection = { version: 'request-correction.1', id: `Q_${crypto.randomUUID()}`, at: new Date().toISOString(), reading, index, target: structuredClone(target) };
  return { ...p, revision: p.revision + 1, readings: [...p.readings, entry] };
}
/** The person's own act: this match's withdrawal link does not hold, and the report it named reads as current again. */
export function unlinkReplacement(p: Project, reading: string, index: number): Project {
  const x = matchLedger(p.readings, recordTexts(p)).all.find(x => x.reading === reading && x.index === index);
  if (!x?.replaces || p.readings.length >= 500) throw new Error('INVALID_REQUEST_CORRECTION');
  const entry: ReplaceCorrection = { version: 'replace-correction.1', id: `Q_${crypto.randomUUID()}`, at: new Date().toISOString(), reading, index };
  return { ...p, revision: p.revision + 1, readings: [...p.readings, entry] };
}
/** Stored origins are checked against the exact received interval, including offsets into a long record. */
export function validateStoredMatch(v: unknown, requests: FrozenRequest[], intervals: { id: string; from: number; to: number }[], texts: Map<string, string>, materialIds: Set<string>, three = false, quoteMax = 300): StoredRequestMatch {
  if (!v || typeof v !== 'object') fail();
  const { from, to, replaces, ...base } = v as StoredRequestMatch;
  if (three !== Object.hasOwn(v, 'replaces')) fail();
  const m = validateRequestMatch(three ? { ...base, replaces: null } : base, requests, three, quoteMax), source = texts.get(m.record);
  if (!Number.isSafeInteger(from) || !Number.isSafeInteger(to) || from < 0 || to <= from || !source || source.slice(from, to) !== m.quote || !intervals.some(r => r.id === m.record && from >= r.from && to <= r.to)) fail();
  if (m.about !== null && !intervals.some(r => r.id === m.record && source!.slice(r.from, r.to).includes(m.about!))) fail();
  if (['code', 'test'].includes(m.kind) && !materialIds.has(m.record)) fail();
  if (!three) return { ...m, from, to };
  if (replaces !== null && (!object(replaces, ['reading', 'index']) || !id(replaces.reading) || !Number.isSafeInteger(replaces.index) || replaces.index < 0)) fail();
  return { ...m, from, to, replaces: replaces === null ? null : { reading: replaces!.reading, index: replaces!.index } };
}
