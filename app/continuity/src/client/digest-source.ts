/* What a return reading reads: the UI62 example's material, or a saved project's own records with the material the person
 * attached to its change plan (added sources, results read against a request document, the plan's own sources). The model
 * request uses short aliases (P01 for parts; R/U/O/V/S + number for sources) and the reply is mapped back to the real ids.
 * Nothing here writes a project, a plan or a record. */
import type { Project } from '../shared/types.js';
import { RECORD_LABEL, clip, type StudioView, type RecordKind } from '../shared/studio.js';
import { DIGEST_SCHEMA, DIGEST_BYTES, digestBytes, type DigestAsk, type DigestKind, type DigestReply } from '../shared/digest-api.js';
import { ui62Sources, ui62Keys } from '../shared/return-material.js';
import type { PlanBundle } from './plan-store.js';
import { EVIDENCE_LABEL } from './plan-source.js';
import { fullTime } from './plan-dom.js';

/** One readable source with real part ids; url only for public material. */
export interface ReadingSource { id: string; kind: DigestKind; title: string; text: string; note: string; basis: string; partIds: string[]; url: string | null }
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
const RECORD_KIND: Record<RecordKind, DigestKind> = { request: 'user', answer: 'user', decision: 'user', report: 'report', evidence: 'test' };

export function ui62Reading(project: Project, stageId: string): ReadingSource[] {
  const keys = ui62Keys(project);
  return ui62Sources(stageId).map(s => ({ id: s.id, kind: s.kind, title: s.title, text: s.text, note: s.note, basis: s.basis, url: s.url,
    partIds: s.partKeys.map(k => keys.get(k)!).filter(Boolean) }));
}

/** A saved project: its own records (newest first), then what the person attached to its change plan. */
export function savedReading(view: StudioView, bundle: PlanBundle | null): ReadingSource[] {
  const out: ReadingSource[] = [], name = (id: string | null) => (id ? view.parts.find(p => p.id === id)?.name ?? null : null);
  const plan = bundle?.plan ?? null, items = plan?.analysis.items ?? [];
  const citedBy = (ref: string) => [...new Set(items.filter(i => i.refs.includes(ref)).flatMap(i => i.partIds))].filter(id => view.parts.some(p => p.id === id));
  for (const [i, o] of (bundle?.observations ?? []).slice(-16).reverse().entries()) {
    const snap = bundle!.snapshots.find(s => s.id === bundle!.attached[o.id]), label = snap ? bundle!.labels[snap.id]?.[o.itemId] : undefined;
    const item = items.find(x => x.id === o.itemId);
    out.push({ id: `O${String(i + 1).padStart(2, '0')}`, kind: 'result', title: `돌아온 기록 · ${EVIDENCE_LABEL[o.kind]} · ${label ?? item?.title ?? o.itemId}`,
      text: clip(clean(o.text), TEXT_MAX), note: snap ? `요청문(${fullTime(snap.createdAt)})의 항목에 붙인 기록` : '', basis: clip(clean(o.basis), 600),
      partIds: (item?.partIds ?? []).filter(id => view.parts.some(p => p.id === id)), url: null });
  }
  for (const e of bundle?.extra ?? []) out.push({ id: e.id, kind: e.kind === 'user' ? 'user' : e.kind, title: clip(e.title, 200), text: clip(clean(e.text), TEXT_MAX),
    note: '변경 구상에 붙인 자료', basis: clip(clean(e.basis), 600), partIds: citedBy(e.id), url: null });
  // The plan's own sources that are neither a project record (E..) nor attached material (U..) nor the project purpose.
  let v = 0;
  for (const e of plan?.evidence ?? []) {
    if (/^(E\d+|U\d+|BRIEF)$/.test(e.id)) continue;
    out.push({ id: `V${String(++v).padStart(2, '0')}`, kind: 'plan', title: clip(`변경안 근거 · ${EVIDENCE_LABEL[e.kind]} · ${e.title}`, 200), text: clip(clean(e.text), TEXT_MAX),
      note: '변경 구상이 읽은 자료', basis: clip(clean(e.basis), 600), partIds: citedBy(e.id), url: null });
  }
  for (const [i, r] of view.records.entries()) {
    const part = name(r.partId);
    out.push({ id: `R${String(i + 1).padStart(2, '0')}`, kind: RECORD_KIND[r.kind], title: clip(`${RECORD_LABEL[r.kind]}${part ? ` · ${part}` : ''}`, 200),
      text: clip(clean(r.text), TEXT_MAX), note: r.text.length > TEXT_MAX ? `앞 ${TEXT_MAX}자` : '', basis: `프로젝트 기록 · ${fullTime(r.at)}`,
      partIds: r.partId && part ? [r.partId] : [], url: null });
    if (i >= 98) break;
  }
  return out;
}

/** The request: every part (aliased), and as many sources as fit, in the given order (records last, so the oldest go first). */
export function readingInput(o: { project: Project; view: StudioView }, all: ReadingSource[], bundle: PlanBundle | null): ReadingInput {
  const parts = new Map<string, string>(), alias = new Map<string, string>();
  o.view.parts.slice(0, 200).forEach((p, i) => { const a = `P${String(i + 1).padStart(2, '0')}`; parts.set(a, p.id); alias.set(p.id, a); });
  const ap = (ids: string[]) => ids.map(id => alias.get(id)).filter((x): x is string => !!x);
  const plan = bundle?.plan ?? null;
  const ask: DigestAsk = {
    schemaVersion: DIGEST_SCHEMA,
    project: { name: clip(o.project.name, 120), purpose: o.project.space.brief ? clip(clean(o.project.space.brief.text), 2000) : null },
    parts: o.view.parts.slice(0, 200).map(p => ({ id: alias.get(p.id)!, name: clip(p.name, 120), note: clip(clean(p.note), 2000), parentId: p.parentId ? alias.get(p.parentId) ?? null : null })),
    sources: [],
    plan: plan ? { intent: clip(clean(plan.intent), 6000), items: plan.analysis.items.slice(0, 32).map(i => ({ title: clip(i.title, 200), partIds: ap(i.partIds).slice(0, 32) })) } : null
  };
  const sources = new Map<string, ReadingSource>();
  for (const s of all.slice(0, 48)) {
    const sent = { id: s.id, kind: s.kind, title: s.title, text: s.text, note: clip(s.note, NOTE_MAX), basis: s.basis, partIds: ap(s.partIds) };
    ask.sources.push(sent);
    if (digestBytes(ask) > DIGEST_BYTES - 256) { ask.sources.pop(); break; }
    sources.set(s.id, s);
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
