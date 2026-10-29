/* What a return reading reads: the UI62 example's material, or a saved project's own records with the material the person
 * attached to its change plan (added sources, results read against a request document, the plan's own sources). The model
 * request uses short aliases (P01 for parts; R/U/O/V/S + number for sources) and the reply is mapped back to the real ids.
 * Nothing here writes a project, a plan or a record. */
import type { Project, RecordEvidence } from '../shared/types.js';
import { EVIDENCE_KIND_LABEL, NOT_EXECUTED, provenanceLine } from '../shared/record-source.js';
import { RECORD_LABEL, clip, type StudioView, type RecordKind } from '../shared/studio.js';
import { DIGEST_SCHEMA, DIGEST2_SCHEMA, DIGEST_BYTES, RECORD_SENT_MAX, digestBytes, type DigestAsk, type DigestKind, type DigestReply } from '../shared/digest-api.js';
import { ui62Sources, ui62Keys } from '../shared/return-material.js';
import type { PlanBundle } from './plan-store.js';
import { EVIDENCE_LABEL } from './plan-source.js';
import { fullTime } from './plan-dom.js';

/** One readable source with real part ids; url only for public material. A pasted record also names its own id (recordId) and,
 * once sent, how many of its characters went (sent): its readings quote only that part. */
export interface ReadingSource { id: string; kind: DigestKind; title: string; text: string; note: string; basis: string; partIds: string[]; url: string | null; recordId?: string; sent?: number;
  /** A provided source's declaration (project.14), shown beside it; the digest still reads it as a record, nothing more. */
  evidence?: RecordEvidence }
export interface ReadingInput {
  ask: DigestAsk;
  /** alias → source as shown (real part ids) */
  sources: Map<string, ReadingSource>;
  /** alias → real part id */
  parts: Map<string, string>;
  /** all sources the project holds for this reading and how many went (newest records first) */
  coverage: { total: number; sent: number };
}

const TEXT_MAX = 6000, NOTE_MAX = 2000;
const clean = (text: string) => text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ');
const excerptNote = (text: string, sent: number, note: string) => [sent < text.length ? `AI에는 원자료 ${text.length}자 중 앞 ${sent}자만 보냄. 인용자료 보관본은 전체 내용.` : '', note].filter(Boolean).join(' · ');
/** A pasted record's preview line: its first non-empty line, as written. A preview, not a title the record claims. */
export const recordTitle = (text: string, n = 80) => { const line = text.split('\n').find(l => l.trim())?.trim() ?? ''; return line.length > n ? `${line.slice(0, n)}…` : line; };
/** How many of the newest pasted records lead the material, ahead of whatever else the project holds. */
const LEAD_RECORDS = 3;
const RECORD_KIND: Record<RecordKind, DigestKind> = { request: 'user', answer: 'user', decision: 'user', report: 'report', evidence: 'test' };

export function ui62Reading(project: Project, stageId: string): ReadingSource[] {
  const keys = ui62Keys(project);
  return ui62Sources(stageId).map(s => ({ id: s.id, kind: s.kind, title: s.title, text: s.text, note: s.note, basis: s.basis, url: s.url,
    partIds: s.partKeys.map(k => keys.get(k)!).filter(Boolean) }));
}

/** A part's name as read beside the map; where another part has the same name, with its parents (up to two) in front until
 * it differs: 'PC 앱 · 보정' and '장치 펌웨어 · 보정'. */
export function partLabel(view: StudioView, id: string): string {
  const of = (x: string | null) => (x ? view.parts.find(p => p.id === x) ?? null : null), part = of(id);
  if (!part) return '부분';
  const same = view.parts.filter(p => p.id !== id && p.name === part.name); if (!same.length) return part.name;
  const pathOf = (p: { name: string; parentId: string | null }, n: number) => { const q = [p.name]; for (let u = of(p.parentId), k = 0; u && k < n; u = of(u.parentId), k++) q.unshift(u.name); return q.join(' · '); };
  let label = part.name;
  for (let n = 1; n <= 2; n++) { label = pathOf(part, n); if (!same.some(o => pathOf(o, n) === label)) break; }
  return label;
}
/** A pasted record as material: the text as pasted, never located (its context part is a note only). */
function pastedSource(r: Project['pasted'][number], alias: string, view: StudioView): ReadingSource {
  const at = r.context && view.parts.some(p => p.id === r.context) ? partLabel(view, r.context) : null;
  const where = at ? `붙일 때 보던 부분: ${at} (읽기 맥락일 뿐 본문 전체가 이 부분에 관한 근거는 아님)` : '';
  // A provided source reads as a record too (its kind is the person's declaration, not a check the app made); its name, version and
  // origin go beside the text, never into it.
  if (r.evidence) return { id: alias, kind: 'record', title: clip(`${EVIDENCE_KIND_LABEL[r.evidence.kind]} · ${r.evidence.name}`, 200), text: clean(r.text),
    note: [`${NOT_EXECUTED} · ${provenanceLine(r.evidence)}`, where].filter(Boolean).join(' · '),
    basis: `가져온 시각 ${fullTime(r.at)} (원문 작성·판본 시각 아님)`, partIds: [], url: null, recordId: r.id, evidence: { ...r.evidence } };
  return { id: alias, kind: 'record', title: clip(recordTitle(clean(r.text)) || '붙여넣은 기록', 200), text: clean(r.text),
    note: ['사용자가 붙여넣은 원문 그대로', where].filter(Boolean).join(' · '),
    basis: `붙여넣은 시각 ${fullTime(r.at)} (원문 작성·판본 시각 아님)`, partIds: [], url: null, recordId: r.id };
}
/** A saved project: the newest pasted records first (so a large project's other material never pushes a new one out), then the
 * material the person attached to its change plan, its own records (newest first) and any older pasted records. */
export function savedReading(view: StudioView, bundle: PlanBundle | null, pasted: Project['pasted'] = []): ReadingSource[] {
  const out: ReadingSource[] = [], name = (id: string | null) => (id ? view.parts.find(p => p.id === id)?.name ?? null : null);
  const newest = [...pasted].reverse().map((r, i) => pastedSource(r, `N${String(i + 1).padStart(2, '0')}`, view));
  out.push(...newest.slice(0, LEAD_RECORDS));
  const plan = bundle?.plan ?? null, items = plan?.analysis.items ?? [];
  const citedBy = (ref: string) => [...new Set(items.filter(i => i.refs.includes(ref)).flatMap(i => i.partIds))].filter(id => view.parts.some(p => p.id === id));
  for (const [i, o] of [...(bundle?.observations ?? [])].reverse().entries()) {
    const snap = bundle!.snapshots.find(s => s.id === bundle!.attached[o.id]), label = snap ? bundle!.labels[snap.id]?.[o.itemId] : undefined;
    // Item ids are local to a plan revision. A later plan may reuse the same id for another target.
    const samePlan = !!snap && snap.planId === plan?.id && snap.planRevision === plan?.revision && snap.itemIds.includes(o.itemId);
    const item = samePlan ? items.find(x => x.id === o.itemId) : undefined;
    out.push({ id: `O${String(i + 1).padStart(2, '0')}`, kind: 'result', title: clip(`돌아온 기록 · ${EVIDENCE_LABEL[o.kind]} · ${label ?? item?.title ?? o.itemId}`, 200),
      text: clean(o.text), note: snap ? `요청문(${fullTime(snap.createdAt)}, ${snap.planId} / ${snap.planRevision})의 항목에 붙인 기록${samePlan ? '' : ' · 현재 변경안과 판본이 달라 현재 부분 연결은 추정하지 않음'}` : '연결된 요청문을 찾을 수 없어 현재 부분 연결은 추정하지 않음', basis: clip(clean(o.basis), 600),
      partIds: (item?.partIds ?? []).filter(id => view.parts.some(p => p.id === id)), url: null });
  }
  for (const e of bundle?.extra ?? []) out.push({ id: e.id, kind: e.kind === 'user' ? 'user' : e.kind === 'reading' ? 'plan' : e.kind, title: clip(e.title, 200), text: clean(e.text),
    note: '변경 구상에 붙인 자료', basis: clip(clean(e.basis), 600), partIds: citedBy(e.id), url: null });
  // The plan's own sources that are neither a project record (E..) nor attached material (U..) nor the project purpose.
  let v = 0;
  for (const e of plan?.evidence ?? []) {
    if (/^(E\d+|U\d+|N\d+|M\d+|BRIEF)$/.test(e.id)) continue;
    out.push({ id: `V${String(++v).padStart(2, '0')}`, kind: 'plan', title: clip(`변경안 근거 · ${EVIDENCE_LABEL[e.kind]} · ${e.title}`, 200), text: clean(e.text),
      note: '변경 구상이 읽은 자료', basis: clip(clean(e.basis), 600), partIds: citedBy(e.id), url: null });
  }
  if (plan && (plan.analysis.unknowns.length || plan.analysis.preserve.length)) out.push({
    id: `V${String(++v).padStart(2, '0')}`, kind: 'plan', title: '변경안의 유지 범위와 미정',
    text: clean(['유지할 범위:', ...plan.analysis.preserve.map(x => `- ${x}`), '구상에 남은 미정:', ...plan.analysis.unknowns.map(x => `- ${x}`)].join('\n')),
    note: '변경안 분석의 맥락이며 결과나 사용자 결정으로 확정된 내용은 아님', basis: clip(clean(`${plan.basis} · ${plan.id} / ${plan.revision}`), 600),
    partIds: [], url: null
  });
  for (const [i, r] of view.records.entries()) {
    const part = name(r.partId);
    out.push({ id: `R${String(i + 1).padStart(2, '0')}`, kind: RECORD_KIND[r.kind], title: clip(`${RECORD_LABEL[r.kind]}${part ? ` · ${part}` : ''}`, 200),
      text: clean(r.text), note: '', basis: `프로젝트 기록 · ${fullTime(r.at)}`,
      partIds: r.partId && part ? [r.partId] : [], url: null });
  }
  out.push(...newest.slice(LEAD_RECORDS));
  return out;
}

/** The request: every part (aliased), then sources in the given order up to the source/byte caps. Coverage counts all material. */
export function readingInput(o: { project: Project; view: StudioView }, all: ReadingSource[], bundle: PlanBundle | null): ReadingInput {
  const parts = new Map<string, string>(), alias = new Map<string, string>();
  o.view.parts.slice(0, 200).forEach((p, i) => { const a = `P${String(i + 1).padStart(2, '0')}`; parts.set(a, p.id); alias.set(p.id, a); });
  const ap = (ids: string[]) => ids.map(id => alias.get(id)).filter((x): x is string => !!x);
  const plan = bundle?.plan ?? null;
  const ask: DigestAsk = {
    // Material with a pasted record is read under digest.2; anything else exactly as before.
    schemaVersion: all.slice(0, 48).some(s => s.kind === 'record') ? DIGEST2_SCHEMA : DIGEST_SCHEMA,
    project: { name: clip(o.project.name, 120), purpose: o.project.space.brief ? clip(clean(o.project.space.brief.text), 2000) : null },
    parts: o.view.parts.slice(0, 200).map(p => ({ id: alias.get(p.id)!, name: clip(p.name, 120), note: clip(clean(p.note), 2000), parentId: p.parentId ? alias.get(p.parentId) ?? null : null })),
    sources: [],
    plan: plan ? { intent: clip(clean(plan.intent), 6000), items: plan.analysis.items.slice(0, 32).map(i => ({ title: clip(i.title, 200), partIds: ap(i.partIds).slice(0, 32) })) } : null
  };
  const sources = new Map<string, ReadingSource>();
  const room = DIGEST_BYTES - 256;
  for (const s of all.slice(0, 48)) {
    const record = s.kind === 'record';
    let text = clip(s.text, record ? RECORD_SENT_MAX : TEXT_MAX);
    const sent = { id: s.id, kind: s.kind, title: s.title, text, note: clip(excerptNote(s.text, text.length, s.note), NOTE_MAX), basis: s.basis, partIds: ask.schemaVersion === DIGEST2_SCHEMA && record ? [] : ap(s.partIds).slice(0, 32) };
    ask.sources.push(sent);
    // A pasted record takes the room that is left rather than being dropped, down to a readable excerpt.
    for (let g = 0; record && digestBytes(ask) > room && text.length > 1500 && g < 40; g++) {
      text = clip(text, Math.floor(text.length * 0.9)); sent.text = text; sent.note = clip(excerptNote(s.text, text.length, s.note), NOTE_MAX);
    }
    if (digestBytes(ask) > room) { ask.sources.pop(); if (record) continue; break; }
    sources.set(s.id, { ...s, partIds: sent.partIds.map(id => parts.get(id)!), note: excerptNote(s.text, text.length, s.note), ...(record ? { sent: text.length } : {}) });
  }
  return { ask, sources, parts, coverage: { total: all.length, sent: ask.sources.length } };
}

/** The reply in real ids. Validation already bound every alias to a sent part or source. */
export function mapDigest(reply: DigestReply, input: ReadingInput): DigestReply {
  const part = (a: string) => input.parts.get(a)!;
  const st = (s: DigestReply['changes'][number]) => ({ text: s.text, partIds: s.partIds.map(part), refs: [...s.refs] });
  return { changes: reply.changes.map(st), read: reply.read ? { partId: part(reply.read.partId), why: reply.read.why, refs: [...reply.read.refs] } : null,
    open: reply.open.map(st), notCovered: [...reply.notCovered] };
}
