import { validateFrozenRequest, validateOrigins, type FrozenRequest, type EvidenceOrigin } from './request-return.js';
import { frozenReading, validateReading, LINE, closingLine, materialHead, MATERIAL_KINDS, type ReadingMark, type RequestReading, type SectionKind } from './request-reading.js';
/** A hypothetical change is separate from project requirements and from execution evidence. */
/** record: a record pasted as it came (requests, reports and checks mixed; never promoted to one of them). reading: what the map
 * readings understood about a part, with its quotes (derived, not a record and not a verified fact). */
export interface Evidence { id: string; kind: 'user' | 'report' | 'code' | 'test' | 'record' | 'reading'; title: string; text: string; basis: string }
export const EVIDENCE_KINDS: readonly Evidence['kind'][] = MATERIAL_KINDS;
/** A source-bound reading aid, not graph operations or proof of current product behaviour. */
export interface PlanPresentation {
  partId: string;
  current: { text: string; source: 'part-note' | 'evidence'; refs: string[] };
  wanted: { text: string; refs: string[] };
  origin: 'intent' | 'suggestion';
}
export interface PlanItem { id: string; title: string; description: string; partIds: string[]; refs: string[]; dependsOn: string[]; presentation?: PlanPresentation[] }
export interface Impact { partId: string; reason: string; refs: string[] }
export interface PlanAnalysis { summary: string; items: PlanItem[]; impacts: Impact[]; preserve: string[]; unknowns: string[] }
export interface ChangePlan { version: 'change-plan.1'; id: string; projectId: string; revision: number; basis: string; intent: string; evidence: Evidence[]; analysis: PlanAnalysis; selected: string[]; createdAt: string; evidenceOrigins?: Record<string, EvidenceOrigin[]> }
/** reading: the sections of text as written (new documents only, never added to an earlier one); text stays the whole document. */
export interface RequestSnapshot { id: string; planId: string; planRevision: number; basis: string; itemIds: string[]; text: string; createdAt: string; scope?: FrozenRequest; reading?: RequestReading }
export interface ResultObservation { id: string; itemId: string; kind: 'report' | 'code' | 'test'; text: string; basis: string; refs: string[] }
export interface ScopeReview { summary: string; prerequisites: { title: string; reason: string; refs: string[] }[]; unknowns: string[] }

const MAX_ITEMS = 32, MAX_EVIDENCE = 48, MAX_IMPACTS = 64, MAX_TEXT = 12000;
const copy = <T>(value: T): T => structuredClone(value);
function check(condition: unknown): asserts condition { if (!condition) throw new Error('INVALID_CHANGE_PLAN'); }
function object(value: unknown, keys: string[], optional: string[] = []): asserts value is Record<string, unknown> {
  check(value !== null && typeof value === 'object' && !Array.isArray(value));
  check(keys.every(k => Object.hasOwn(value, k)) && Object.keys(value).every(k => keys.includes(k) || optional.includes(k)));
}
function text(value: unknown, max = MAX_TEXT): asserts value is string {
  check(typeof value === 'string' && value.length <= max && !!value.trim() && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value));
}
function id(value: unknown): asserts value is string { text(value, 100); check(/^[A-Za-z0-9_-]+$/.test(value)); }
function list(value: unknown, max: number): asserts value is unknown[] { check(Array.isArray(value) && value.length <= max); }
function ids(value: unknown, max: number, allowed?: Set<string>, nonempty = false): asserts value is string[] {
  list(value, max); check(!nonempty || value.length > 0);
  for (const v of value) { id(v); check(!allowed || allowed.has(v)); }
  check(new Set(value).size === value.length);
}
function strings(value: unknown): asserts value is string[] { list(value, 24); for (const v of value) text(v, 2000); }
function date(value: unknown): asserts value is string { text(value, 30); check(Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value); }
function evidenceList(value: unknown): asserts value is Evidence[] {
  list(value, MAX_EVIDENCE);
  for (const v of value) {
    object(v, ['id', 'kind', 'title', 'text', 'basis']); id(v.id); text(v.title, 200); text(v.text); text(v.basis, 2000);
    check(EVIDENCE_KINDS.includes(v.kind as Evidence['kind']));
  }
  check(new Set(value.map(v => (v as Evidence).id)).size === value.length);
}

function presentations(value: unknown, partIds: string[], itemRefs: string[]): asserts value is PlanPresentation[] {
  list(value, 8);
  const seen = new Set<string>(), parts = new Set(partIds), refs = new Set(itemRefs);
  for (const entry of value) {
    object(entry, ['partId', 'current', 'wanted', 'origin']); id(entry.partId);
    check(parts.has(entry.partId) && !seen.has(entry.partId)); seen.add(entry.partId);
    object(entry.current, ['text', 'source', 'refs']); text(entry.current.text, 140);
    check(entry.current.source === 'part-note' || entry.current.source === 'evidence');
    ids(entry.current.refs, MAX_EVIDENCE, refs, entry.current.source === 'evidence');
    if (entry.current.source === 'part-note') check(entry.current.refs.length === 0);
    object(entry.wanted, ['text', 'refs']); text(entry.wanted.text, 140);
    ids(entry.wanted.refs, MAX_EVIDENCE, refs, true);
    check(entry.origin === 'intent' || entry.origin === 'suggestion');
  }
}

/** A fresh review of the selected outcome, without treating global dependency guesses as facts. */
export function parseScopeReview(value: unknown, evidenceIds: string[]): ScopeReview {
  ids(evidenceIds, MAX_EVIDENCE);
  object(value, ['summary', 'prerequisites', 'unknowns']); text(value.summary, 2000);
  list(value.prerequisites, 12);
  for (const candidate of value.prerequisites) {
    object(candidate, ['title', 'reason', 'refs']); text(candidate.title, 200); text(candidate.reason, 2000);
    ids(candidate.refs, MAX_EVIDENCE, new Set(evidenceIds), true);
  }
  list(value.unknowns, 12); for (const unknown of value.unknowns) text(unknown, 2000);
  return copy(value as unknown as ScopeReview);
}

/** Reject ungrounded refs and made-up part IDs rather than repairing model output.
 * items=[] reads as 'no change proposed by this analysis' (not 'verified as unneeded', not 'goal done'): its impacts are [] too,
 * and its summary, preserve and unknowns are all it says. Whether a reply may be empty is the request version's rule
 * (validatePlanReply); a stored analysis is read either way. */
export function parsePlanAnalysis(value: unknown, partIds: string[], evidenceIds: string[]): PlanAnalysis {
  ids(partIds, 10000); ids(evidenceIds, MAX_EVIDENCE);
  const parts = new Set(partIds), refs = new Set(evidenceIds);
  object(value, ['summary', 'items', 'impacts', 'preserve', 'unknowns']); text(value.summary, 2000);
  list(value.items, MAX_ITEMS); list(value.impacts, MAX_IMPACTS); check(value.items.length > 0 || value.impacts.length === 0);
  for (const item of value.items) {
    object(item, ['id', 'title', 'description', 'partIds', 'refs', 'dependsOn'], ['presentation']);
    id(item.id); text(item.title, 200); text(item.description, 4000);
    // Empty partIds supports a genuinely new part whose implementation identity is not known yet.
    ids(item.partIds, 32, parts); ids(item.refs, MAX_EVIDENCE, refs, true); ids(item.dependsOn, MAX_ITEMS);
    if (Object.hasOwn(item, 'presentation')) presentations(item.presentation, item.partIds, item.refs);
  }
  const items = value.items as unknown as PlanItem[], byId = new Map(items.map(x => [x.id, x]));
  check(byId.size === items.length);
  const visiting = new Set<string>(), visited = new Set<string>();
  const visit = (item: PlanItem) => {
    check(!visiting.has(item.id)); if (visited.has(item.id)) return;
    visiting.add(item.id);
    for (const dependency of item.dependsOn) { const other = byId.get(dependency); check(other); visit(other); }
    visiting.delete(item.id); visited.add(item.id);
  };
  items.forEach(visit);
  list(value.impacts, MAX_IMPACTS);
  for (const impact of value.impacts) {
    object(impact, ['partId', 'reason', 'refs']); id(impact.partId); check(parts.has(impact.partId));
    text(impact.reason, 2000); ids(impact.refs, MAX_EVIDENCE, refs, true);
  }
  strings(value.preserve); strings(value.unknowns);
  return copy(value as unknown as PlanAnalysis);
}

function analysisParts(analysis: unknown): string[] {
  // Only recover the persisted allow-list, never assume these still exist in the current project.
  object(analysis, ['summary', 'items', 'impacts', 'preserve', 'unknowns']); list(analysis.items, MAX_ITEMS); list(analysis.impacts, MAX_IMPACTS);
  const parts: string[] = [];
  for (const item of analysis.items) { object(item, ['id', 'title', 'description', 'partIds', 'refs', 'dependsOn'], ['presentation']); ids(item.partIds, 32); parts.push(...item.partIds); }
  for (const impact of analysis.impacts) { object(impact, ['partId', 'reason', 'refs']); id(impact.partId); parts.push(impact.partId); }
  return [...new Set(parts)];
}
function validatedPlan(value: unknown): ChangePlan {
  object(value, ['version', 'id', 'projectId', 'revision', 'basis', 'intent', 'evidence', 'analysis', 'selected', 'createdAt'], ['evidenceOrigins']);
  check(value.version === 'change-plan.1'); id(value.id); id(value.projectId);
  check(Number.isSafeInteger(value.revision) && (value.revision as number) >= 1);
  text(value.basis, 2000); text(value.intent); date(value.createdAt); evidenceList(value.evidence);
  const analysis = parsePlanAnalysis(value.analysis, analysisParts(value.analysis), value.evidence.map(x => x.id));
  const sources = new Map(value.evidence.map(e => [e.id, e]));
  if (value.evidenceOrigins !== undefined) {
    check(!!value.evidenceOrigins && typeof value.evidenceOrigins === 'object' && !Array.isArray(value.evidenceOrigins));
    for (const [ref, origins] of Object.entries(value.evidenceOrigins as Record<string, unknown>)) { check(sources.has(ref)); validateOrigins(origins); }
  }
  const normal = (text: string) => text.replace(/\s+/g, ' ').trim();
  for (const item of analysis.items) for (const view of item.presentation ?? []) {
    if (view.origin === 'intent') check(view.wanted.refs.some(ref => sources.get(ref)!.kind === 'user'));
    if (view.current.source === 'evidence') check(view.current.refs.some(ref => normal(sources.get(ref)!.text).includes(normal(view.current.text))));
    // A saved plan holds evidence but no part-note snapshot: only validatePlanReply with the original ask can check that
    // quote. Neither an exact excerpt nor valid refs establishes factual accuracy or current product behaviour.
  }
  ids(value.selected, MAX_ITEMS, new Set(analysis.items.map(x => x.id)));
  return copy({ ...value, analysis } as unknown as ChangePlan);
}
/** Untrusted storage is all-or-nothing. Invalid data never becomes a repaired plan. */
export function parsePersistedPlan(value: unknown): ChangePlan | null {
  try { return validatedPlan(value); } catch { return null; }
}
export function createPlan(projectId: string, basis: string, intent: string, evidence: Evidence[], analysis: PlanAnalysis, evidenceOrigins?: Record<string, EvidenceOrigin[]>): ChangePlan {
  return validatedPlan({ version: 'change-plan.1', id: `CP_${crypto.randomUUID()}`, projectId, revision: 1, basis, intent, evidence, analysis,
    selected: analysis.items.map(x => x.id), createdAt: new Date().toISOString(), ...(evidenceOrigins ? { evidenceOrigins } : {}) });
}
export function selectItems(plan: ChangePlan, selected: string[]): ChangePlan {
  const next = validatedPlan(plan); ids(selected, MAX_ITEMS, new Set(next.analysis.items.map(x => x.id)));
  const ordered = next.analysis.items.filter(x => selected.includes(x.id)).map(x => x.id);
  if (JSON.stringify(next.selected) !== JSON.stringify(ordered)) { next.revision++; next.selected = ordered; }
  return validatedPlan(next);
}
export function revisePlan(plan: ChangePlan, analysis: PlanAnalysis): ChangePlan {
  const next = validatedPlan(plan);
  next.analysis = parsePlanAnalysis(analysis, analysisParts(analysis), next.evidence.map(x => x.id));
  next.selected = next.selected.filter(x => next.analysis.items.some(item => item.id === x));
  next.revision++;
  return validatedPlan(next);
}

const readingFrame = (s: Pick<RequestSnapshot, 'id' | 'basis' | 'planId' | 'planRevision' | 'text'>, scope: FrozenRequest) => ({ id: s.id, basis: s.basis, planId: s.planId,
  planRevision: s.planRevision, text: s.text, items: scope.items, sources: scope.items.flatMap(i => i.sources) });
/** A generated document is a snapshot, not a sent request or an execution record. */
export function requestSnapshot(plan: ChangePlan, review?: ScopeReview): RequestSnapshot {
  const p = validatedPlan(plan), selected = p.analysis.items.filter(item => p.selected.includes(item.id));
  const id = `RQ_${crypto.randomUUID()}`, createdAt = new Date().toISOString();
  check(selected.length > 0);
  const scoped = review === undefined ? undefined : parseScopeReview(review, p.evidence.map(e => e.id));
  const selectedIds = new Set(selected.map(x => x.id)), all = new Map(p.analysis.items.map(x => [x.id, x]));
  const missing = new Set<string>(), visited = new Set<string>();
  const walk = (item: PlanItem) => {
    if (visited.has(item.id)) return; visited.add(item.id);
    for (const dependency of item.dependsOn) { if (!selectedIds.has(dependency)) missing.add(dependency); walk(all.get(dependency)!); }
  };
  // Legacy dependency candidates are used only when the caller has no scope-specific review.
  if (!scoped) selected.forEach(walk);
  const usedRefs = new Set(selected.flatMap(item => item.refs));
  for (const dependency of missing) all.get(dependency)!.refs.forEach(ref => usedRefs.add(ref));
  for (const candidate of scoped?.prerequisites ?? []) candidate.refs.forEach(ref => usedRefs.add(ref));
  // The same lines as before 94, with where each section starts; the reading is only ranges of the joined text.
  const lines: string[] = [], marks: ReadingMark[] = [];
  const section = (kind: SectionKind, ...more: string[]) => { marks.push({ kind, line: lines.length }); lines.push(...more); };
  section('head', LINE.head, `요청문 참조: ${id}`, `작성 기준: ${p.basis}`, `변경안 판본: ${p.id} / ${p.revision}`, '');
  section('selected', LINE.selected, ...selected.flatMap(item => [`- ${item.title}`, item.description]), '');
  section('excluded', LINE.excluded, ...p.analysis.items.filter(item => !selectedIds.has(item.id)).map(item => `- ${item.title}`),
    ...(selected.length === p.analysis.items.length ? ['- 없음'] : []), LINE.excludedNote, '');
  section('prerequisites', LINE.prerequisites);
  if (scoped) {
    lines.push(`${LINE.reviewSummary}${scoped.summary}`,
      ...(scoped.prerequisites.length ? scoped.prerequisites.map(candidate => `- 전제 후보: ${candidate.title} — ${candidate.reason} [${candidate.refs.join(', ')}]. 요청 범위에 자동 포함하지 않았습니다. 기존 수단과 근거를 확인하고 필요한 최소 범위를 판단해 주세요.`) : ['- 선택 범위 재검토에서 추가 전제 후보를 제안하지 않았습니다.']));
  } else lines.push(...(missing.size ? [...missing].map(key => `- 미선택 전제 후보: ${all.get(key)!.title} — 요청 범위에 포함하지 않았습니다. 기존 수단의 존재·재사용 가능성을 확인하거나 필요한 최소 범위를 별도로 판단해 주세요.`) : ['- 분석에서 제안된 전제 중 선택에서 빠진 항목은 없습니다.']));
  lines.push('');
  section('preserve', LINE.preserve, ...(p.analysis.preserve.length ? p.analysis.preserve.map(x => `- ${x}`) : ['- 제공된 유지 조건 없음']), '');
  section('unknowns', LINE.unknowns, ...(p.analysis.unknowns.length ? p.analysis.unknowns.map(x => `- ${x}`) : ['- 제공된 확인할 것 없음']));
  if (scoped) { lines.push(''); section('review-unknowns', LINE.reviewUnknowns, ...(scoped.unknowns.length ? scoped.unknowns.map(x => `- ${x}`) : ['- 검토에서 제시한 미확인 없음'])); }
  lines.push('');
  section('materials', scoped ? LINE.reviewedMaterials : LINE.relatedMaterials);
  // Summary and unknowns may refer to material not cited by a prerequisite. Preserve the full frozen review input.
  for (const e of p.evidence.filter(e => scoped || usedRefs.has(e.id))) {
    marks.push({ kind: 'material', line: lines.length, ref: e.id, source: e.kind, title: e.title, basis: e.basis, length: e.text.length });
    lines.push(materialHead(e.id, e.title, e.kind), `자료 기준: ${e.basis}`, e.text, '');
  }
  section('closing', closingLine(id));
  const scope = validateFrozenRequest({ version: 'request-scope.1', id, projectId: p.projectId, planId: p.id, planRevision: p.revision, createdAt, basis: p.basis, intent: p.intent,
    items: selected.map(i => ({ id: i.id, title: i.title, description: i.description, partIds: i.partIds,
      sources: i.refs.map(ref => { const e = p.evidence.find(e => e.id === ref)!; return { id: ref, title: e.title, basis: e.basis, origins: p.evidenceOrigins?.[ref] ?? [] }; }) })) });
  const text = lines.join('\n'), reading = validateReading(frozenReading(lines, marks), readingFrame({ id, basis: p.basis, planId: p.id, planRevision: p.revision, text }, scope));
  return { id, planId: p.id, planRevision: p.revision, basis: p.basis, itemIds: selected.map(x => x.id), text, createdAt, scope, reading };
}

/** Exact item matches only. Unknown observations are not silently assigned to other requested items. */
export function compareResults(snapshot: RequestSnapshot, observations: ResultObservation[]): { itemId: string; reported: ResultObservation[]; code: ResultObservation[]; tests: ResultObservation[] }[] {
  object(snapshot, ['id', 'planId', 'planRevision', 'basis', 'itemIds', 'text', 'createdAt'], ['scope', 'reading']);
  id(snapshot.id); id(snapshot.planId); check(Number.isSafeInteger(snapshot.planRevision) && snapshot.planRevision >= 1);
  text(snapshot.basis, 2000); ids(snapshot.itemIds, MAX_ITEMS, undefined, true); text(snapshot.text, 1_000_000); date(snapshot.createdAt);
  if (snapshot.scope !== undefined) {
    const scope = validateFrozenRequest(snapshot.scope);
    check(scope.id === snapshot.id && scope.planId === snapshot.planId && scope.planRevision === snapshot.planRevision && scope.basis === snapshot.basis && scope.createdAt === snapshot.createdAt && JSON.stringify(scope.items.map(i => i.id)) === JSON.stringify(snapshot.itemIds));
  }
  // A reading belongs to a document made with its frozen scope; it is checked against that text, never repaired or dropped.
  if (snapshot.reading !== undefined) { check(snapshot.scope !== undefined); validateReading(snapshot.reading, readingFrame(snapshot, snapshot.scope)); }
  list(observations, 256);
  const seen = new Set<string>();
  for (const observation of observations) {
    object(observation, ['id', 'itemId', 'kind', 'text', 'basis', 'refs']);
    id(observation.id); id(observation.itemId); check(!seen.has(observation.id)); seen.add(observation.id);
    check(['report', 'code', 'test'].includes(observation.kind)); text(observation.text); text(observation.basis, 2000); ids(observation.refs, MAX_EVIDENCE);
  }
  return snapshot.itemIds.map(itemId => ({ itemId,
    reported: copy(observations.filter(o => o.itemId === itemId && o.kind === 'report')),
    code: copy(observations.filter(o => o.itemId === itemId && o.kind === 'code')),
    tests: copy(observations.filter(o => o.itemId === itemId && o.kind === 'test')) }));
}
