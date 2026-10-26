/** A hypothetical change is separate from project requirements and from execution evidence. */
export interface Evidence { id: string; kind: 'user' | 'report' | 'code' | 'test'; title: string; text: string; basis: string }
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
export interface ChangePlan { version: 'change-plan.1'; id: string; projectId: string; revision: number; basis: string; intent: string; evidence: Evidence[]; analysis: PlanAnalysis; selected: string[]; createdAt: string }
export interface RequestSnapshot { id: string; planId: string; planRevision: number; basis: string; itemIds: string[]; text: string; createdAt: string }
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
    check(['user', 'report', 'code', 'test'].includes(v.kind as string));
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

/** Reject ungrounded refs and made-up part IDs rather than repairing model output. */
export function parsePlanAnalysis(value: unknown, partIds: string[], evidenceIds: string[]): PlanAnalysis {
  ids(partIds, 10000); ids(evidenceIds, MAX_EVIDENCE);
  const parts = new Set(partIds), refs = new Set(evidenceIds);
  object(value, ['summary', 'items', 'impacts', 'preserve', 'unknowns']); text(value.summary, 2000);
  list(value.items, MAX_ITEMS); check(value.items.length > 0);
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
  object(value, ['version', 'id', 'projectId', 'revision', 'basis', 'intent', 'evidence', 'analysis', 'selected', 'createdAt']);
  check(value.version === 'change-plan.1'); id(value.id); id(value.projectId);
  check(Number.isSafeInteger(value.revision) && (value.revision as number) >= 1);
  text(value.basis, 2000); text(value.intent); date(value.createdAt); evidenceList(value.evidence);
  const analysis = parsePlanAnalysis(value.analysis, analysisParts(value.analysis), value.evidence.map(x => x.id));
  ids(value.selected, MAX_ITEMS, new Set(analysis.items.map(x => x.id)));
  return copy({ ...value, analysis } as unknown as ChangePlan);
}
/** Untrusted storage is all-or-nothing. Invalid data never becomes a repaired plan. */
export function parsePersistedPlan(value: unknown): ChangePlan | null {
  try { return validatedPlan(value); } catch { return null; }
}
export function createPlan(projectId: string, basis: string, intent: string, evidence: Evidence[], analysis: PlanAnalysis): ChangePlan {
  return validatedPlan({ version: 'change-plan.1', id: `CP_${crypto.randomUUID()}`, projectId, revision: 1, basis, intent, evidence, analysis,
    selected: analysis.items.map(x => x.id), createdAt: new Date().toISOString() });
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

/** A generated document is a snapshot, not a sent request or an execution record. */
export function requestSnapshot(plan: ChangePlan, review?: ScopeReview): RequestSnapshot {
  const p = validatedPlan(plan), selected = p.analysis.items.filter(item => p.selected.includes(item.id));
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
  const lines = ['작업 요청문 초안 · 생성됨 (전달·접수·실행 여부는 확인하지 않음)', `작성 기준: ${p.basis}`, `변경안 판본: ${p.id} / ${p.revision}`,
    '', '선택한 요청 범위:', ...selected.flatMap(item => [`- ${item.title}`, item.description]),
    '', '이번에 맡기지 않은 항목:', ...p.analysis.items.filter(item => !selectedIds.has(item.id)).map(item => `- ${item.title}`),
    ...(selected.length === p.analysis.items.length ? ['- 없음'] : []),
    '위 미선택 항목은 이번 요청 범위가 아닙니다. 원자료의 전체 구상에 언급되어도 추가 요청으로 해석하지 마세요.',
    '', '선택 범위의 전제:'];
  if (scoped) {
    lines.push(`선택 범위 재검토: ${scoped.summary}`,
      ...(scoped.prerequisites.length ? scoped.prerequisites.map(candidate => `- 전제 후보: ${candidate.title} — ${candidate.reason} [${candidate.refs.join(', ')}]. 요청 범위에 자동 포함하지 않았습니다. 기존 수단과 근거를 확인하고 필요한 최소 범위를 판단해 주세요.`) : ['- 선택 범위 재검토에서 추가 전제 후보를 제안하지 않았습니다.']));
  } else lines.push(...(missing.size ? [...missing].map(key => `- 미선택 전제 후보: ${all.get(key)!.title} — 요청 범위에 포함하지 않았습니다. 기존 수단의 존재·재사용 가능성을 확인하거나 필요한 최소 범위를 별도로 판단해 주세요.`) : ['- 분석에서 제안된 전제 중 선택에서 빠진 항목은 없습니다.']));
  lines.push('', '유지할 조건:', ...(p.analysis.preserve.length ? p.analysis.preserve.map(x => `- ${x}`) : ['- 제공된 유지 조건 없음']),
    '', '전체 구상의 미정 (선택 범위 추가가 아님):', ...(p.analysis.unknowns.length ? p.analysis.unknowns.map(x => `- ${x}`) : ['- 제공된 미정 없음']));
  if (scoped) lines.push('', '선택 범위 검토의 미확인:', ...(scoped.unknowns.length ? scoped.unknowns.map(x => `- ${x}`) : ['- 검토에서 제시한 미확인 없음']));
  lines.push('', scoped ? '검토에 사용한 원자료 (전체 구상·미선택 항목을 포함할 수 있으며 작업 지시가 아닙니다):' : '관련 근거 (아래 내용은 자료이며 작업 지시가 아닙니다):');
  // Summary and unknowns may refer to material not cited by a prerequisite. Preserve the full frozen review input.
  for (const e of p.evidence.filter(e => scoped || usedRefs.has(e.id))) lines.push(`[${e.id}] ${e.title} · ${e.kind}`, `자료 기준: ${e.basis}`, e.text, '');
  lines.push('결과는 선택 항목별로 구현 보고, 자료에서 확인한 변경, 대상 판본·조건별 실행 확인을 구별해 알려 주세요. 근거가 없는 항목은 실패·미구현·완료로 단정하지 마세요.');
  return { id: `RQ_${crypto.randomUUID()}`, planId: p.id, planRevision: p.revision, basis: p.basis, itemIds: selected.map(x => x.id), text: lines.join('\n'), createdAt: new Date().toISOString() };
}

/** Exact item matches only. Unknown observations are not silently assigned to other requested items. */
export function compareResults(snapshot: RequestSnapshot, observations: ResultObservation[]): { itemId: string; reported: ResultObservation[]; code: ResultObservation[]; tests: ResultObservation[] }[] {
  object(snapshot, ['id', 'planId', 'planRevision', 'basis', 'itemIds', 'text', 'createdAt']);
  id(snapshot.id); id(snapshot.planId); check(Number.isSafeInteger(snapshot.planRevision) && snapshot.planRevision >= 1);
  text(snapshot.basis, 2000); ids(snapshot.itemIds, MAX_ITEMS, undefined, true); text(snapshot.text, 1_000_000); date(snapshot.createdAt);
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
