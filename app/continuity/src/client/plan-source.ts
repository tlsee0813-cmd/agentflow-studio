/* What a change plan reads: the converter example project and its authored material, or a saved project's own records turned
 * into Evidence. The model request uses short aliases for parts and sources (P01, E01, INTENT) and maps the reply back to the
 * real ids, so a mistyped long id can never land on a different part. Nothing here writes to a project. */
import type { Project } from '../shared/types.js';
import { createProject, rename, setBrief, addArea, addChildArea, addRelation } from '../shared/domain.js';
import { parseProject } from '../shared/validation.js';
import { partPath, RECORD_LABEL, clip, type StudioView, type RecordKind } from '../shared/studio.js';
import { CONVERTER_PARTS, CONVERTER_RELATIONS, CONVERTER_INTENT, converterEvidence } from '../shared/change-plan-example.js';
import { parsePlanAnalysis, type ChangePlan, type Evidence, type PlanAnalysis } from '../shared/change-plan.js';
import type { ScopeAsk } from './plan-request.js';
import { PLAN_BYTES, type PlanAsk } from '../shared/plan-api.js';
import { fullTime } from './plan-dom.js';

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
export const EVIDENCE_LABEL: Record<Evidence['kind'], string> = { user: '사용자 발언', report: '담당 보고', code: '코드 자료', test: '검사' };
const TEXT_MAX = 12000;
/** The plan contract refuses control characters; records may carry them from pasted terminal output. */
const clean = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');

/** Looks like a credential: never sent, the person is told which text holds it. */
const SECRET = /\bsk-[A-Za-z0-9_-]{16,}|\bgh[pousr]_[A-Za-z0-9]{20,}|\bgithub_pat_[A-Za-z0-9_]{20,}|\bAKIA[0-9A-Z]{16}\b|\bxox[abpr]-[A-Za-z0-9-]{10,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bAIza[0-9A-Za-z_-]{30,}/;
export const secretLike = (text: string) => SECRET.test(text);

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

export function exampleInput(o: { project: Project; view: StudioView }, condition: Condition, intent: string, keys: Map<string, string>): PlanInput {
  const changed = intent.trim() !== CONVERTER_INTENT;
  const evidence = [...converterEvidence(condition), ...(changed ? [intentEvidence(intent, true)] : [])];
  const parts = new Map([...keys].map(([k, id]) => [k, id]));
  const toKey = new Map([...keys].map(([k, id]) => [id, k]));
  const ask: PlanAsk = { schemaVersion: 'studio.plan.1', intent: intent.trim(),
    parts: o.view.parts.map(p => ({ id: toKey.get(p.id)!, name: p.name, note: p.note, parentId: p.parentId ? toKey.get(p.parentId)! : null })), evidence };
  return finish({ evidence, ask, parts, records: { total: 0, sent: 0 }, problem: null, basis: `합성 예제 자료 · ${CONDITION_LABEL[condition]} · main@S0` });
}

/** A saved project's own records, newest first, as whole sources until the request's byte limit. Nothing is cut silently: the
 * count of records left out is shown before sending and kept with the analysis. */
export function projectInput(o: { project: Project; view: StudioView }, intent: string, extra: Evidence[] = []): PlanInput {
  const v = o.view, parts = new Map<string, string>(), alias = new Map<string, string>();
  v.parts.forEach((p, i) => { const a = `P${String(i + 1).padStart(2, '0')}`; parts.set(a, p.id); alias.set(p.id, a); });
  const ask: PlanAsk = { schemaVersion: 'studio.plan.1', intent: intent.trim(),
    parts: v.parts.map(p => ({ id: alias.get(p.id)!, name: clip(p.name, 200), note: clip(p.note, 3000), parentId: p.parentId ? alias.get(p.parentId)! : null })),
    evidence: [intentEvidence(intent, false)] };
  const brief = o.project.space.brief?.text?.trim();
  if (brief) ask.evidence.push({ id: 'BRIEF', kind: 'user', title: '프로젝트 목적', text: clip(clean(brief), TEXT_MAX), basis: `프로젝트에 적힌 목적 · ${fullTime(o.project.space.brief!.at)}` });
  ask.evidence.push(...extra);
  const input: PlanInput = { evidence: ask.evidence, ask, parts, records: { total: v.records.length, sent: 0 }, problem: null,
    basis: `프로젝트 기록 ${v.records.length}개 · 판 ${o.project.revision} · ${fullTime(new Date().toISOString())}` };
  if (bytes(ask) > PLAN_BYTES) return finish({ ...input, problem: 'TOO_LARGE' });
  for (const [i, r] of v.records.entries()) {
    if (ask.evidence.length >= 48) break;
    const part = r.partId ? partPath(v, r.partId).map(x => x.name).join(' › ') : '부분 미지정';
    const e: Evidence = { id: `E${String(i + 1).padStart(2, '0')}`, kind: EVIDENCE_KIND[r.kind], title: clip(`${part.split(' › ').at(-1)} · ${RECORD_LABEL[r.kind]}`, 200),
      text: clip(clean(r.text), TEXT_MAX), basis: clip(`프로젝트 기록 · ${fullTime(r.at)} · ${part}${r.text.length > TEXT_MAX ? ` · 앞 ${TEXT_MAX}자` : ''}`, 2000) };
    ask.evidence.push(e);
    if (bytes(ask) > PLAN_BYTES - 64) { ask.evidence.pop(); break; }
    input.records.sent++;
  }
  input.basis = `프로젝트 기록 ${input.records.sent === v.records.length ? `${v.records.length}개` : `${v.records.length}개 중 최신 ${input.records.sent}개`}${extra.length ? ` + 붙인 자료 ${extra.length}개` : ''} · 판 ${o.project.revision} · ${fullTime(new Date().toISOString())}`;
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
  const mapped: PlanAnalysis = { ...sent, items: sent.items.map(i => ({ ...i, partIds: i.partIds.map(real) })), impacts: sent.impacts.map(x => ({ ...x, partId: real(x.partId) })) };
  return parsePlanAnalysis(mapped, [...input.parts.values()], input.evidence.map(e => e.id));
}

/** The request-scope review: the plan's own evidence and only the chosen items (their parts under the same aliases as an
 * analysis of the map as it is now), plus the titles left out. Same refusals as an analysis: nothing is cut or hidden. */
export function scopeInput(o: { key: string; project: Project; view: StudioView; alias: { toId: Map<string, string> } | null }, plan: ChangePlan): { ask: ScopeAsk; problem: PlanInput['problem'] } {
  const toAlias = new Map<string, string>();
  if (o.key === CONVERTER_KEY && o.alias) for (const [k, id] of o.alias.toId) toAlias.set(id, k);
  else o.view.parts.forEach((p, i) => toAlias.set(p.id, `P${String(i + 1).padStart(2, '0')}`));
  const chosen = plan.analysis.items.filter(i => plan.selected.includes(i.id));
  const ask = { schemaVersion: 'studio.scope.1', intent: plan.intent,
    parts: o.view.parts.map(p => ({ id: toAlias.get(p.id)!, name: clip(p.name, 200), note: clip(p.note, 3000), parentId: p.parentId ? toAlias.get(p.parentId)! : null })),
    evidence: plan.evidence,
    // A part removed from the map since the analysis has no alias now; the item keeps its words and sources.
    selected: chosen.map(i => ({ id: i.id, title: i.title, description: i.description, partIds: i.partIds.map(id => toAlias.get(id)).filter((x): x is string => !!x), refs: i.refs })),
    excluded: plan.analysis.items.filter(i => !plan.selected.includes(i.id)).map(i => i.title) } as unknown as ScopeAsk;
  if (bytes(ask) > PLAN_BYTES) return { ask, problem: 'TOO_LARGE' };
  if (secretLike(plan.intent) || chosen.some(i => secretLike(i.title) || secretLike(i.description))) return { ask, problem: { secret: '변경안 항목' } };
  const leak = plan.evidence.find(e => secretLike(e.text) || secretLike(e.title));
  return { ask, problem: leak ? { secret: leak.title } : null };
}
