/* What a change plan reads: the converter example project and its authored material, or a saved project's own records turned
 * into Evidence. The model request uses short aliases for parts and sources (P01, E01, INTENT) and maps the reply back to the
 * real ids, so a mistyped long id can never land on a different part. Nothing here writes to a project. */
import type { Project } from '../shared/types.js';
import { createProject, rename, setBrief, addArea, addChildArea, addRelation } from '../shared/domain.js';
import { parseProject } from '../shared/validation.js';
import { partPath, RECORD_LABEL, clip, type StudioView, type RecordKind } from '../shared/studio.js';
import { CONVERTER_PARTS, CONVERTER_RELATIONS, CONVERTER_INTENT, converterEvidence } from '../shared/change-plan-example.js';
import { parsePlanAnalysis, type ChangePlan, type Evidence, type PlanAnalysis } from '../shared/change-plan.js';
import { SCOPE_BYTES, type ScopeAsk } from '../shared/scope-api.js';
import { PLAN_BYTES, type PlanAsk } from '../shared/plan-api.js';
import { fullTime } from './plan-dom.js';
import { CLAIM_LABEL } from '../shared/map-reading.js';
import { secretLike } from '../shared/secret.js';

export const CONVERTER_KEY = 'ex-converter';
export type Condition = 'A' | 'B';
export const CONDITION_LABEL: Record<Condition, string> = { A: '파일별 결과가 있는 코드', B: '파일별 결과가 없는 코드' };

/** The converter map: areas, children and relations only (no records, returns or anchors). */
export function buildConverterProject(): Project {
  let p = setBrief(rename(createProject(), '문서 변환기'), '마크다운 문서를 PDF와 docx로 바꾸는 도구. 본문·표·문단 모양을 그대로 옮긴다.');
  const ids: Record<string, string> = {};
  for (const part of CONVERTER_PARTS) {
    p = part.parent ? addChildArea(p, ids[part.parent]!, part.name, part.note) : addArea(p, part.name, part.note);
    ids[part.key] = p.space.areas.at(-1)!.id;
  }
  for (const [from, to, kind, note] of CONVERTER_RELATIONS) p = addRelation(p, ids[from]!, ids[to]!, kind, note);
  return parseProject(JSON.stringify({ ...p, notice: null }));
}
/** Stable keys of the converter parts (CONVERTER_PARTS order is the area order). */
export function converterKeys(p: Project): Map<string, string> {
  const keys = new Map<string, string>();
  CONVERTER_PARTS.forEach((part, i) => { const area = p.space.areas[i]; if (area) keys.set(part.key, area.id); });
  return keys;
}

const EVIDENCE_KIND: Record<RecordKind, Evidence['kind']> = { request: 'user', answer: 'user', decision: 'user', report: 'report', evidence: 'test' };
export const EVIDENCE_LABEL: Record<Evidence['kind'], string> = { user: '사용자 발언', report: '담당 보고', code: '코드 자료', test: '검사', record: '붙여넣은 기록', reading: '기록에서 읽은 이해' };
const TEXT_MAX = 12000;
/** The plan contract refuses control characters; records may carry them from pasted terminal output. */
const clean = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');

/** Looks like a credential: never sent, the person is told which text holds it (one rule, shared with the domain). */
export { secretLike } from '../shared/secret.js';

export interface PlanInput {
  /** Evidence as stored in the plan (real ids are the aliases themselves; evidence never names a project id). */
  evidence: Evidence[];
  ask: PlanAsk;
  /** alias → real part id */
  parts: Map<string, string>;
  records: { total: number; sent: number };
  /** null when it fits; otherwise why nothing is sent. */
  problem: 'TOO_LARGE' | { secret: string } | null;
  basis: string;
}
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;

/** The draft sentence as its own source, so the model can ground items in what was written now rather than an older plan. */
export function intentEvidence(intent: string, example: boolean): Evidence {
  return { id: 'INTENT', kind: 'user', title: '지금 쓴 변경 구상', text: clip(clean(intent.trim()), TEXT_MAX),
    basis: example ? '변경 구상 초안 · 지금 입력한 문장이 이번 분석의 기준 · R03·R04는 예제에 앞서 기록된 구상' : '변경 구상 초안 · 지금 입력한 문장이 이번 분석의 기준' };
}

/** The person's added material (taken from the return reading) is read with the example's own, as in a saved project. */
export function exampleInput(o: { project: Project; view: StudioView }, condition: Condition, intent: string, keys: Map<string, string>, extra: Evidence[] = []): PlanInput {
  const changed = intent.trim() !== CONVERTER_INTENT;
  const evidence = [...converterEvidence(condition), ...(changed ? [intentEvidence(intent, true)] : []), ...extra];
  const parts = new Map([...keys].map(([k, id]) => [k, id]));
  const toKey = new Map([...keys].map(([k, id]) => [id, k]));
  const ask: PlanAsk = { schemaVersion: 'studio.plan.1', intent: intent.trim(),
    parts: o.view.parts.map(p => ({ id: toKey.get(p.id)!, name: p.name, note: p.note, parentId: p.parentId ? toKey.get(p.parentId)! : null })), evidence };
  return finish({ evidence, ask, parts, records: { total: 0, sent: 0 }, problem: null, basis: `합성 예제 자료 · ${CONDITION_LABEL[condition]} · main@S0` });
}

/** A saved project's own material, newest first, as whole sources until the request's byte limit: what the map readings understood
 * per part (derived, kind 'reading'), then records pasted as they came (kind 'record', never promoted to a request, report or
 * check) and the project's own records, by time. Nothing is cut silently: the count left out is shown before sending and kept. */
export function projectInput(o: { project: Project; view: StudioView }, intent: string, extra: Evidence[] = []): PlanInput {
  const v = o.view, parts = new Map<string, string>(), alias = new Map<string, string>();
  v.parts.forEach((p, i) => { const a = `P${String(i + 1).padStart(2, '0')}`; parts.set(a, p.id); alias.set(p.id, a); });
  const ask: PlanAsk = { schemaVersion: 'studio.plan.1', intent: intent.trim(),
    parts: v.parts.map(p => ({ id: alias.get(p.id)!, name: clip(p.name, 200), note: clip(p.note, 3000), parentId: p.parentId ? alias.get(p.parentId)! : null })),
    evidence: [intentEvidence(intent, false)] };
  const brief = o.project.space.brief?.text?.trim();
  if (brief) ask.evidence.push({ id: 'BRIEF', kind: 'user', title: '프로젝트 목적', text: clip(clean(brief), TEXT_MAX), basis: `프로젝트에 적힌 목적 · ${fullTime(o.project.space.brief!.at)}` });
  ask.evidence.push(...extra);
  const pasted = [...o.project.pasted].reverse(), total = v.records.length + pasted.length;
  const input: PlanInput = { evidence: ask.evidence, ask, parts, records: { total, sent: 0 }, problem: null,
    basis: `프로젝트 기록 ${total}개 · 판 ${o.project.revision} · ${fullTime(new Date().toISOString())}` };
  if (bytes(ask) > PLAN_BYTES) return finish({ ...input, problem: 'TOO_LARGE' });
  // What was read per part: small, so it goes first; each line keeps its kind, its version as the record named it, its quote and
  // the id of the record it quotes in this same request (N.. pasted, E.. project records), and says it is not verified.
  const recordRef = new Map<string, string>([...pasted.map((r, i) => [r.id, `N${String(i + 1).padStart(2, '0')}`] as const), ...v.records.map((r, i) => [r.id, `E${String(i + 1).padStart(2, '0')}`] as const)]);
  const cite = (q: { record: string; quote: string }) => `“${q.quote}”${recordRef.has(q.record) ? ` (${recordRef.get(q.record)})` : ''}`;
  let m = 0;
  for (const p of v.parts) {
    const u = p.reading; if (!u || ask.evidence.length >= 24) continue;
    const lines = [
      u.role ? `설명${u.corrected ? '(사용자가 바로잡음)' : ''}${u.roleAbout ? ` · ${u.roleAbout} 기준` : u.corrected ? '' : ' · 판본 미기재'}: ${u.role}${u.roleBasis.length ? ` — ${u.roleBasis.slice(0, 2).map(cite).join(' / ')}` : ''}` : '',
      ...u.others.slice(0, 2).map(x => `다른 기록의 설명(현재 설명을 대체한다는 근거 없음)${x.about ? ` · ${x.about}` : ''}: ${x.text}`),
      ...u.claims.slice(0, 6).map(c => `- [${CLAIM_LABEL[c.kind]}${c.about ? ` · ${c.about}` : ''}] ${c.text} — ${cite(c)}`)].filter(Boolean);
    if (!lines.length) continue;
    const e: Evidence = { id: `M${String(++m).padStart(2, '0')}`, kind: 'reading', title: clip(`${partPath(v, p.id).map(x => x.name).join(' › ')} · 기록에서 읽은 이해`, 200),
      text: clip(clean(lines.join('\n')), 3000), basis: clip(`붙여넣은 기록을 AI가 읽어 정리한 이해 · 앱이 확인한 사실 아님 · ${fullTime(u.history.at(-1)!.at)}`, 2000) };
    ask.evidence.push(e);
    if (bytes(ask) > PLAN_BYTES - 64) { ask.evidence.pop(); m--; break; }
  }
  type Item = { at: string; e: Evidence };
  const items: Item[] = [
    ...pasted.map((r, i): Item => ({ at: r.at, e: { id: `N${String(i + 1).padStart(2, '0')}`, kind: 'record', title: clip(`붙여넣은 기록 · ${r.text.split('\n').find(l => l.trim())?.trim() ?? ''}`, 200),
      text: clip(clean(r.text), TEXT_MAX), basis: clip(`붙여넣은 원문 그대로 · 요구·보고·검사가 섞일 수 있음 · 붙여넣은 시각 ${fullTime(r.at)}(원문 작성·판본 시각 아님)${r.text.length > TEXT_MAX ? ` · 앞 ${TEXT_MAX}자` : ''}`, 2000) } })),
    ...v.records.map((r, i): Item => {
      const part = r.partId ? partPath(v, r.partId).map(x => x.name).join(' › ') : '부분 미지정';
      return { at: r.at, e: { id: `E${String(i + 1).padStart(2, '0')}`, kind: EVIDENCE_KIND[r.kind], title: clip(`${part.split(' › ').at(-1)} · ${RECORD_LABEL[r.kind]}`, 200),
        text: clip(clean(r.text), TEXT_MAX), basis: clip(`프로젝트 기록 · ${fullTime(r.at)} · ${part}${r.text.length > TEXT_MAX ? ` · 앞 ${TEXT_MAX}자` : ''}`, 2000) } };
    })
  ].sort((a, b) => b.at.localeCompare(a.at));
  for (const { e } of items) {
    if (ask.evidence.length >= 48) break;
    ask.evidence.push(e);
    if (bytes(ask) > PLAN_BYTES - 64) { ask.evidence.pop(); break; }
    input.records.sent++;
  }
  input.basis = `프로젝트 기록 ${input.records.sent === total ? `${total}개` : `${total}개 중 최신 ${input.records.sent}개`}${m ? ` + 읽은 이해 ${m}개` : ''}${extra.length ? ` + 붙인 자료 ${extra.length}개` : ''} · 판 ${o.project.revision} · ${fullTime(new Date().toISOString())}`;
  return finish(input);
}
function finish(input: PlanInput): PlanInput {
  if (input.problem) return input;
  if (bytes(input.ask) > PLAN_BYTES) return { ...input, problem: 'TOO_LARGE' };
  if (secretLike(input.ask.intent)) return { ...input, problem: { secret: '변경 구상 문장' } };
  const leak = input.ask.evidence.find(e => secretLike(e.text) || secretLike(e.title));
  return leak ? { ...input, problem: { secret: leak.title } } : input;
}

/** Validates the reply against what was sent, then maps aliases back to the real part ids (sources keep their aliases). */
export function mapReply(reply: unknown, input: PlanInput): PlanAnalysis {
  const sent = parsePlanAnalysis(reply, [...input.parts.keys()], input.evidence.map(e => e.id));
  const real = (a: string) => input.parts.get(a)!;
  const mapped: PlanAnalysis = { ...sent, items: sent.items.map(i => ({ ...i, partIds: i.partIds.map(real),
    ...(i.presentation ? { presentation: i.presentation.map(p => ({ ...p, partId: real(p.partId) })) } : {}) })), impacts: sent.impacts.map(x => ({ ...x, partId: real(x.partId) })) };
  return parsePlanAnalysis(mapped, [...input.parts.values()], input.evidence.map(e => e.id));
}

/** The request-scope review: the plan's own evidence and only the chosen items (their parts under the same aliases as an
 * analysis of the map as it is now), plus the titles left out. Same refusals as an analysis: nothing is cut or hidden. */
export function scopeInput(o: { key: string; project: Project; view: StudioView; alias: { toId: Map<string, string> } | null }, plan: ChangePlan): { ask: ScopeAsk; problem: PlanInput['problem'] } {
  const toAlias = new Map<string, string>();
  if (o.key === CONVERTER_KEY && o.alias) for (const [k, id] of o.alias.toId) toAlias.set(id, k);
  else o.view.parts.forEach((p, i) => toAlias.set(p.id, `P${String(i + 1).padStart(2, '0')}`));
  const chosen = plan.analysis.items.filter(i => plan.selected.includes(i.id));
  const ask: ScopeAsk = { schemaVersion: 'studio.scope.1', intent: plan.intent,
    parts: o.view.parts.map(p => ({ id: toAlias.get(p.id)!, name: clip(p.name, 200), note: clip(p.note, 3000), parentId: p.parentId ? toAlias.get(p.parentId)! : null })),
    evidence: plan.evidence,
    // A part removed from the map since the analysis has no alias now; the item keeps its words and sources.
    selected: chosen.map(i => ({ id: i.id, title: i.title, description: i.description, partIds: i.partIds.map(id => toAlias.get(id)).filter((x): x is string => !!x), refs: i.refs })),
    excluded: [...new Set(plan.analysis.items.filter(i => !plan.selected.includes(i.id)).map(i => i.title))] };
  if (bytes(ask) > SCOPE_BYTES) return { ask, problem: 'TOO_LARGE' };
  if (secretLike(plan.intent) || chosen.some(i => secretLike(i.title) || secretLike(i.description))) return { ask, problem: { secret: '변경안 항목' } };
  const leak = plan.evidence.find(e => secretLike(e.text) || secretLike(e.title));
  return { ask, problem: leak ? { secret: leak.title } : null };
}
