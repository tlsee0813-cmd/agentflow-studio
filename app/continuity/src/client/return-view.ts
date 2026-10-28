/* Coming back to a project: what changed in the program, which part to read now and what is still the person's to decide,
 * read in the right pane beside the same map. The reading is made by the model from prepared material (studio.digest.1) only
 * when the person asks; the same material is never sent again (the cache), and without a reading the material itself is
 * what one reads. Each sentence names its sources (one click to the exact quote and its version) and at most two parts,
 * which the map marks without changing their status or description. Nothing here writes a plan or a record.
 * A saved project also takes a record pasted as it came (one textarea; no title, kind, version or part to give first). It is
 * kept in the project as pasted (host.paste) and read only when the person asks, with the rest of the material (studio.digest.2):
 * up to three readings of it, each on an exact quote of what was sent, its related parts shown as candidates. A part looked at
 * when pasting is the reading's context, never where the record belongs; closing comes back to the scene the paste began from. */
import { DIGEST_KIND_LABEL, OUTCOME_KINDS, type DigestStatement, type RecordReading } from '../shared/digest-api.js';
import { UI62_KEY, UI62_STAGES } from '../shared/return-material.js';
import type { Evidence } from '../shared/change-plan.js';
import type { StorageLike } from '../shared/storage.js';
import { clip } from '../shared/studio.js';
import { ui62Reading, savedReading, readingInput, recordTitle, partLabel, type ReadingInput, type ReadingSource } from './digest-source.js';
import { digestStore, askHash, makeReading, type Reading } from './digest-store.js';
import { askDigest, AskError, ERROR_TEXT, type AiStatus } from './studio-api.js';
import type { PlanOpened } from './plan-view.js';
import type { PlanBundle } from './plan-store.js';
import { secretLike } from './plan-source.js';
import { h, put, fullTime, codeGate, codeNote, quotedText as quoted } from './plan-dom.js';
import { captureRequestReading, restoreRequestReading, type RequestReading } from './request-results.js';

export interface ReturnHost {
  current(): PlanOpened | null;
  kv: StorageLike;
  status(): AiStatus;
  accessCode(): string; keepAccessCode(value: string): void;
  /** The project's change plan as kept (read only); null when there is none. */
  bundle(): PlanBundle | null;
  /** Put the reading in the pane (null takes it away). The host leaves a selected part's reading in place. */
  show(content: Node[] | null): void;
  /** The one part a chosen candidate names, unfolded for the reading (only its path, until another choice; null folds it back). */
  open(part: string | null): void;
  /** The parts the reading is about now ([] clears). A mark only: no status, no selection, no camera. */
  mark(parts: string[]): void;
  /** Bring these parts beside the pane by the smallest pan (an explicit request). */
  reveal(parts: string[]): void;
  selectPart(id: string): void;
  /** Hand a sentence and its sources to the change plan as a proposal; the draft changes only if the person says so. */
  trial(text: string, sources: Evidence[]): void;
  /** Open the change plan on the change that touches these parts, same map, current/preview. */
  compare(parts: string[]): void;
  chrome(): void;
  /** Keep a pasted record in the saved project (the very same text already kept is that record again). Text when not kept. */
  paste(text: string, context: string | null): Promise<{ id: string; duplicate: boolean } | string>;
  /** The project id readings of this entry were kept under before entries had their own; null for an imported copy, which
   * shares its original's project id and so must never read the original's readings. */
  legacyKey(): string | null;
  /** Back to the scene a paste began from (selection, scope, camera), once the pane has closed. */
  restoreScene(scene: Scene): void;
  /** The map's own row in a saved project (records to read into the map, the last map reading), built by the host; null when none. */
  mapBlock(): Node | null;
  /** Parts the last map reading of this visit added or said something about (marked while nothing else is chosen). */
  mapMarks(): string[];
  /** Whether a map reading has read (some of) this record. */
  readIntoMap(recordId: string): boolean;
  /** Records wait to be read into the map: that is the pane's one main action, and this reading's summary steps back. */
  mapPrimary(): boolean;
}
/** Memory of the caller's reading surface. No source text or rendered nodes are held: the host renders current data first. */
export interface ReadingContext {
  surface: 'lens' | 'sheet' | 'scope' | 'none';
  sheetReturn: { x: number; y: number; k: number } | null;
  scroll: number;
  requests: RequestReading | null;
  /** The current part's citation control, by its reading/source identity; no old element or claim text is held. */
  claimFocus: string | null;
}
/** Where a quote or paste began: this entry, selection, scope, camera and optional reading position. */
export interface Scene { key?: string; selected: string | null; scope: string | null; camera: { x: number; y: number; k: number }; reading?: ReadingContext }

/** at: where the quote stands in the source's text when the reading kept it (a repeated sentence is marked there, not first). */
type View = { kind: 'reading' } | { kind: 'source'; source: ReadingSource; from: 'now' | 'previous' | 'material'; quote: string | null; at?: number } | { kind: 'material' } | { kind: 'paste' };
interface State {
  /** The sentence chosen; for a record reading, also the related candidate chosen in it (its reason reads under it). */
  key: string; stage: string; view: View; focus: { list: 'changes' | 'open' | 'records'; n: number; part?: string } | null;
  input: ReadingInput | null; hash: string | null; reading: Reading | null; previous: Reading | null;
  pending: AbortController | null; error: string | null; storeMsg: string | null; scroll: number;
  /** The reading's request results as left (items, history folds, focused quote), restored by identity on fresh data. */
  requests: RequestReading | null;
  /** The paste being written: the part looked at when it began (context only), and the scene to come back to on close. */
  pasteContext: string | null; back: Scene | null; pasteMsg: string | null; saving: boolean;
  /** A quote opened from a selected part: the way back at the top goes to that part's scene, not to this pane's reading. */
  quoteFrom: string | null;
}
/** Paste drafts, per workspace entry (an imported copy has its own), in this browser apart from the project. A draft that looks
 * like it holds a key stays in this tab only. */
const PASTE_DRAFT_KEY = 'agentflow.studio.paste-draft.1';
/** A note (what the record explains as it stands) carries no tag: it is neither a change nor a check. */
const READING_KIND: Record<RecordReading['kind'], string | null> = { change: '변화', check: '확인 범위', open: '남은 판단', note: null };
const STAGE_MEMORY = new Map<string, string>();
const short = (text: string, n: number) => { const t = text.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n)}…` : t; };
/** A version named in a source's basis (a commit), else nothing. */
const versionOf = (basis: string) => /\b[0-9a-f]{7}\b/.exec(basis)?.[0] ?? null;

export function createReturnView(host: ReturnHost) {
  const saved = digestStore(host.kv), memory = digestStore(null);
  let s: State | null = null, seq = 0;
  const storeFor = () => (host.current()?.kind === 'saved' ? saved : memory);
  const memoryDrafts = new Map<string, string>();
  function draftOf(key: string): string {
    if (memoryDrafts.has(key)) return memoryDrafts.get(key)!;
    try { const v = (JSON.parse(host.kv.getItem(PASTE_DRAFT_KEY) ?? '{}') as Record<string, unknown>)[key]; return typeof v === 'string' ? v : ''; } catch { return ''; }
  }
  function keepDraft(key: string, text: string) {
    memoryDrafts.set(key, text);
    try {
      const all = JSON.parse(host.kv.getItem(PASTE_DRAFT_KEY) ?? '{}') as Record<string, string>;
      if (text.trim() && !secretLike(text)) all[key] = text; else delete all[key];
      const keys = Object.keys(all); for (const k of keys.slice(0, Math.max(0, keys.length - 30))) if (k !== key) delete all[k];
      host.kv.setItem(PASTE_DRAFT_KEY, JSON.stringify(all));
    } catch { /* this tab keeps it */ }
  }
  const partName = (id: string) => { const v = host.current()?.view; return v ? partLabel(v, id) : '부분'; };

  /* ---------- material and the reading of it ---------- */
  function sources(): ReadingSource[] {
    const o = host.current()!;
    return o.key === UI62_KEY ? ui62Reading(o.project, s!.stage) : savedReading(o.view, host.bundle(), o.project.pasted);
  }
  /** Recompute the request for the material as it is now and look up a reading of exactly it (no call). */
  async function refresh() {
    const o = host.current(); if (!s || !o) return;
    const mine = ++seq, input = readingInput(o, sources(), o.key === UI62_KEY ? null : host.bundle());
    const hash = await askHash(input.ask);
    if (mine !== seq || !s) return;
    const st = host.status(), store = storeFor();
    if (s.hash !== hash) s.focus = null;
    s.input = input; s.hash = hash;
    const prompt = input.ask.schemaVersion === 'studio.digest.2' ? st.digest?.record : st.digest?.prompt;
    s.reading = st.digest && prompt ? store.find(o.key, host.legacyKey(), hash, input.ask, st.digest.model, prompt) : null;
    s.previous = o.key === UI62_KEY ? null : store.previous(o.key, host.legacyKey(), hash);
    render();
  }
  async function analyze() {
    const o = host.current(); if (!s || !o || !s.input || !s.hash || s.pending) return;
    const st = host.status();
    const prompt = s.input.ask.schemaVersion === 'studio.digest.2' ? st.digest?.record : st.digest?.prompt;
    if (st.ai !== 'deepseek' || !st.digest || !prompt) return;
    const secret = s.input.ask.sources.find(x => secretLike(`${x.title}\n${x.text}\n${x.basis}`));
    if (secret) { s.error = `‘${secret.title}’에 키나 토큰처럼 보이는 글이 있어 보내지 않았어요.`; render(); return; }
    // The entry this reading is for, and where it is kept, are fixed now: a reply that comes back after a switch stays with it.
    const input = s.input, hash = s.hash, key = s.key, controller = new AbortController(), store = storeFor(), legacy = host.legacyKey();
    s.pending = controller; s.error = null; render();
    try {
      const res = await askDigest(input.ask, controller.signal, host.accessCode());
      const reading = makeReading(input, hash, res.model, prompt, res.reply), msg = store.keep(key, legacy, reading);
      if (s && s.key === key && s.hash === hash) { s.reading = reading; s.storeMsg = msg; s.focus = null; s.view = { kind: 'reading' }; }
    } catch (e) {
      const code = e instanceof AskError ? e.code : 'NETWORK';
      if (s && s.key === key && code !== 'CANCELLED') s.error = ERROR_TEXT[code] ?? '정리하지 못했어요. 원자료는 그대로 읽을 수 있어요.';
    } finally { if (s && s.key === key) s.pending = null; }
    render();
  }

  /* ---------- open / close ---------- */
  function open() {
    const o = host.current(); if (!o || o.kind === 'legacy') return;
    if (!s || s.key !== o.key) {
      s = { key: o.key, stage: STAGE_MEMORY.get(o.key) ?? UI62_STAGES[0]!.id, view: { kind: 'reading' }, focus: null, input: null, hash: null, reading: null, previous: null,
        pending: null, error: null, storeMsg: null, scroll: 0, requests: null, pasteContext: null, back: null, pasteMsg: null, saving: false, quoteFrom: null };
    }
    host.chrome(); render(); void refresh();
  }
  function close() {
    if (!s) return;
    const back = s.back;
    s.pending?.abort(); s = null; host.open(null); host.mark([]); host.show(null); host.chrome();
    if (back) host.restoreScene(back);
  }
  /** The paste box, in this pane. context: the part being looked at (null from the reading itself); scene: where to come back to,
   * captured by the host before opening the pane cleared the selection. */
  function openPaste(context: string | null, scene: Scene | null) {
    const o = host.current(); if (!o || o.kind !== 'saved') return;
    open(); if (!s) return;
    keep();
    s.pasteContext = context; s.quoteFrom = null; if (scene) s.back = scene;
    s.view = { kind: 'paste' }; s.pasteMsg = null; render();
    requestAnimationFrame(() => document.querySelector<HTMLTextAreaElement>('#paste-text')?.focus({ preventScroll: true }));
  }
  async function savePaste() {
    const o = host.current(); if (!s || !o || s.saving) return;
    const key = s.key, text = draftOf(key);
    if (!text.trim()) { s.pasteMsg = '붙여 넣을 글이 아직 없어요.'; render(); return; }
    if (secretLike(text)) { s.pasteMsg = '키나 토큰처럼 보이는 글이 있어 저장하지 않았어요. 그 부분을 지우고 다시 저장하세요.'; render(); return; }
    // The box stays editable while saving: only the text that was saved leaves the draft. Whatever was written meanwhile stays,
    // and the box stays open with it. A pane closed or reopened meanwhile is another state: it is only told by the draft.
    const st = s; st.saving = true; render();
    const done = await host.paste(text, st.pasteContext);
    st.saving = false;
    const kept = typeof done !== 'string', untouched = draftOf(key) === text;
    if (kept && untouched) keepDraft(key, '');
    if (s !== st) return;
    if (!kept) { st.pasteMsg = done; render(); return; }
    const r = host.current()?.project.pasted.find(x => x.id === done.id);
    const said = done.duplicate ? `같은 글을 ${r ? fullTime(r.at) : '앞서'}에 붙여 넣었어요. 새로 저장하지 않았어요.` : '기록을 저장했어요. AI에는 아직 보내지 않았어요.';
    if (!untouched) { st.pasteMsg = `${said} 저장하는 동안 쓴 글은 초안으로 남겨 두었어요.`; render(); void refresh(); return; }
    st.pasteContext = null; st.pasteMsg = null; st.storeMsg = said;
    await refresh();
    const src = s === st ? sources().find(x => x.recordId === done.id) : null;
    if (s === st && src) { st.view = { kind: 'source', source: structuredClone(src), from: 'material', quote: null }; render(); }
  }
  function setStage(id: string) {
    if (!s || s.stage === id || s.pending) return;
    s.stage = id; STAGE_MEMORY.set(s.key, id); s.view = { kind: 'reading' }; s.focus = null; s.reading = null; s.error = null; s.scroll = 0;
    render(); void refresh();
  }

  /* ---------- reading ---------- */
  const shown = (): Reading | null => s?.reading ?? s?.previous ?? null;
  function sourceOf(r: Reading | null, id: string): ReadingSource | null {
    // A reading's citations stay as held when it was made, even if an unsent suffix has changed since.
    return r?.cited[id] ?? null;
  }
  function statements(r: Reading): { changes: DigestStatement[]; open: DigestStatement[]; read: Reading['reply']['read'] } {
    // Aliases of the request the reading was made from; a part no longer on the map is simply not named.
    const known = (aliases: string[]) => aliases.map(a => r.parts[a]).filter((id): id is string => !!id && !!host.current()?.view.parts.some(p => p.id === id));
    const st = (x: DigestStatement) => ({ text: x.text, partIds: known(x.partIds), refs: [...x.refs] });
    const read = r.reply.read ? known([r.reply.read.partId])[0] : undefined;
    return { changes: r.reply.changes.map(st), open: r.reply.open.map(st), read: r.reply.read && read ? { partId: read, why: r.reply.read.why, refs: [...r.reply.read.refs] } : null };
  }
  function focusParts(): string[] {
    const r = shown(); if (!s || !r) return [];
    const st = statements(r);
    // Before a sentence is chosen, mark the suggested reading, or the first actual decision's known parts.
    if (s.focus?.list === 'records') { const rel = recordReadings(r)[s.focus.n]?.related ?? []; return s.focus.part && rel.some(c => c.partId === s!.focus!.part) ? [s.focus.part] : rel.map(c => c.partId); }
    if (!s.focus) return st.read ? [st.read.partId] : st.open[0]?.partIds ?? [];
    return (s.focus.list === 'changes' ? st.changes : st.open)[s.focus.n]?.partIds ?? [];
  }
  /** A reading's readings of pasted records, with candidates only for parts still on the map (in real ids). */
  function recordReadings(r: Reading): (RecordReading & { source: ReadingSource | null })[] {
    const live = (id: string | undefined) => !!id && !!host.current()?.view.parts.some(p => p.id === id);
    return (r.reply.recordReadings ?? []).map(x => ({ ...x, source: r.cited[x.ref] ?? null,
      related: x.related.map(c => ({ ...c, partId: r.parts[c.partId] ?? '' })).filter(c => live(c.partId)) }));
  }
  function quoteChip(src: ReadingSource | null, quote: string, from: 'now' | 'previous') {
    if (!src) return null;
    return h('button', { type: 'button', class: 'rr-ref rr-cite', title: `원문에서 보기 · ${src.title}`, onclick: (e: Event) => { e.stopPropagation(); openSource(src, from, quote); } },
      h('span', { class: 'rr-ref-title' }, `“${short(quote, 46)}”`));
  }
  /** Choosing a candidate (click or keyboard) chooses its sentence too: the map marks that part alone and its reason reads under
   * the sentence. Choosing it again lets it go. The choice stays while a quote is read and comes back with the reading. */
  function candidateChip(c: { partId: string; why: string; quote: string }, n: number) {
    const on = s!.focus?.list === 'records' && s!.focus.n === n && s!.focus.part === c.partId;
    return h('button', { type: 'button', class: `rr-part cand${on ? ' on' : ''}`, 'aria-pressed': String(on), 'data-index': String(n), 'data-part': c.partId,
      title: `관련 후보 · ${c.why}`, onclick: (e: Event) => {
        e.stopPropagation();
        s!.focus = on ? { list: 'records', n } : { list: 'records', n, part: c.partId }; render();
        if (!on) host.reveal([c.partId]);
        if ((e as MouseEvent).detail === 0) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`#lens .rr-part.cand[data-index="${n}"][data-part="${CSS.escape(c.partId)}"]`)?.focus({ preventScroll: true }));
      } }, h('i', { 'aria-hidden': 'true' }), partName(c.partId));
  }
  function recordItem(x: ReturnType<typeof recordReadings>[number], n: number, from: 'now' | 'previous') {
    const active = s!.focus?.list === 'records' && s!.focus.n === n;
    const why = active ? x.related.find(c => c.partId === s!.focus!.part) ?? null : null;
    const choose = (keyboard = false) => {
      s!.focus = { list: 'records', n }; render(); if (x.related.length) host.reveal(x.related.map(c => c.partId));
      if (keyboard) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.rr-st-select[data-list="records"][data-index="${n}"]`)?.focus({ preventScroll: true }));
    };
    return h('article', { class: `rr-st rr-rec${active ? ' on' : ''}`, 'aria-current': active ? 'true' : 'false', onclick: () => choose() },
      h('button', { type: 'button', class: 'rr-st-select', 'data-list': 'records', 'data-index': String(n), onclick: (e: Event) => { e.stopPropagation(); choose((e as MouseEvent).detail === 0); } },
        READING_KIND[x.kind] ? h('span', { class: `rr-rec-kind k-${x.kind}` }, READING_KIND[x.kind]) : null, h('span', { class: 'rr-text' }, x.text)),
      h('div', { class: 'rr-chips' }, quoteChip(x.source, x.quote, from),
        x.related.length ? h('span', { class: 'rr-cand-label' }, '관련 후보') : null, ...x.related.map(c => candidateChip(c, n))),
      why ? h('p', { class: 'rr-why', role: 'status' }, h('strong', {}, partName(why.partId)), ` · ${why.why}`) : null);
  }
  function recordSection(r: Reading, from: 'now' | 'previous', only: string | null): Node | null {
    const all = recordReadings(r).map((x, n) => ({ x, n })).filter(({ x }) => !only || x.source?.recordId === only);
    if (!all.length) return null;
    const titles = [...new Set(all.map(({ x }) => x.source?.recordId))];
    const head = !only && titles.length === 1 && all[0]!.x.source
      ? h('button', { type: 'button', class: 'rr-rec-src', title: '붙여넣은 원문 보기', onclick: () => openSource(all[0]!.x.source!, from, null) }, all[0]!.x.source.title) : null;
    return h('section', { class: 'rr-sec rr-records' }, h('h3', {}, only ? '이 기록에서 읽은 것' : '붙여넣은 기록에서'), head,
      ...all.map(({ x, n }) => recordItem(x, n, from)));
  }
  function chipFor(id: string, r: Reading | null, from: 'now' | 'previous') {
    const src = sourceOf(r, id); if (!src) return null;
    const v = versionOf(src.basis);
    const label = `${src.title} · ${DIGEST_KIND_LABEL[src.kind]} · ${src.basis}`;
    return h('button', { type: 'button', class: `rr-ref k-${src.kind}`, title: label, 'aria-label': label, onclick: (e: Event) => { e.stopPropagation(); openSource(src, from); } },
      h('span', { class: 'rr-ref-kind' }, DIGEST_KIND_LABEL[src.kind]), h('span', { class: 'rr-ref-title' }, src.title), v ? h('code', {}, v) : null);
  }
  function partChip(id: string) {
    return h('button', { type: 'button', class: 'rr-part', title: `지도에서 ‘${partName(id)}’ 보기`, onclick: (e: Event) => { e.stopPropagation(); host.mark([id]); host.reveal([id]); } },
      h('i', { 'aria-hidden': 'true' }), partName(id));
  }
  function statement(list: 'changes' | 'open', n: number, x: DigestStatement, r: Reading, from: 'now' | 'previous', extra: Node | null) {
    const active = s!.focus?.list === list && s!.focus.n === n;
    const compact = list === 'changes' && !active;
    const choose = (keyboard = false) => {
      s!.focus = { list, n }; render(); if (x.partIds.length) host.reveal(x.partIds);
      // Rendering replaces the pane. Keep keyboard focus on the selected sentence, without scrolling the map or pane.
      if (keyboard) requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(`.rr-st-select[data-list="${list}"][data-index="${n}"]`)?.focus({ preventScroll: true }));
    };
    const el = h('article', { class: `rr-st${active ? ' on' : ''}${compact ? ' compact' : ''}`, 'aria-current': active ? 'true' : 'false', onclick: () => choose() },
      h('button', { type: 'button', class: 'rr-st-select', 'data-list': list, 'data-index': String(n),
        ...(list === 'changes' ? { 'aria-expanded': String(active) } : {}),
        onclick: (e: Event) => { e.stopPropagation(); choose((e as MouseEvent).detail === 0); } },
        h('span', { class: 'rr-text' }, x.text), compact ? h('span', { class: 'rr-expand' }, '펼쳐 읽기') : null),
      h('div', { class: 'rr-chips' }, ...(!compact ? x.partIds.map(partChip) : []), ...x.refs.map(id => chipFor(id, r, from))), compact ? null : extra);
    return el;
  }
  /** Where a change meets the open change plan: the same parts read current/preview on the same map. */
  function planMeet(parts: string[]): Node | null {
    const p = host.bundle()?.plan; if (!p || !parts.length) return null;
    if (!p.analysis.items.some(i => i.partIds.some(id => parts.includes(id)))) return null;
    return h('p', { class: 'rr-meet' }, h('span', {}, `변경 구상 ‘${short(p.intent, 28)}’의 대상이에요`),
      h('button', { type: 'button', class: 'link-button', onclick: (e: Event) => { e.stopPropagation(); host.compare(parts); } }, '같은 지도에서 비교 ›'));
  }
  function trialButton(x: DigestStatement, r: Reading, from: 'now' | 'previous', label: string) {
    return h('button', { type: 'button', class: 'rr-try', onclick: (e: Event) => {
      e.stopPropagation();
      // The plan sidecar accepts outcome evidence only. A direction or hypothetical plan must never become a report.
      const ev: Evidence[] = x.refs.map(id => sourceOf(r, id)).filter((q): q is ReadingSource => !!q && OUTCOME_KINDS.includes(q.kind)).map(q => {
        const text = clip(q.text, 12000), excerpt = text.length < q.text.length ? ` · 원자료 ${q.text.length}자 중 앞 ${text.length}자 발췌` : '';
        return { id: q.id, kind: q.kind === 'code' || q.kind === 'test' ? q.kind : 'report', title: clip(q.title, 200), text,
          basis: clip(`돌아와 읽기에서 가져온 ${DIGEST_KIND_LABEL[q.kind]}${excerpt} · ${q.basis}${q.note ? ` · ${q.note}` : ''}`, 2000) };
      });
      host.trial(x.text, ev);
    } }, label);
  }

  function header(o: PlanOpened): Node {
    const ex = o.key === UI62_KEY;
    return h('header', { class: 'lens-head rr-head' },
      h('h2', { id: 'lens-title' }, '돌아와 읽기', ex ? h('span', { class: 'tag', title: '공개 commit과 결과 문서에서 사후 편집한 자료예요. 당시 실시간으로 받은 기록이 아니에요.' }, '공개 자료 · 사후 편집') : null),
      ex ? stageSwitch() : null,
      h('div', { class: 'head-tools' },
        o.kind === 'saved' && s!.view.kind !== 'paste' ? h('button', { type: 'button', class: 'rr-paste-open', title: '작업 AI가 돌려준 글을 그대로 붙여 넣어요', onclick: () => openPaste(null, null) }, '기록 붙여넣기') : null,
        h('button', { type: 'button', class: 'close', 'aria-label': '돌아와 읽기 닫기', title: '닫기 (Esc)', onclick: close }, '×')));
  }
  function stageSwitch(): Node {
    const st = s!, cur = UI62_STAGES.find(x => x.id === st.stage)!;
    return h('div', { class: 'rr-stage' },
      h('div', { class: 'rr-steps', role: 'group', 'aria-label': '읽을 자료 단계' }, ...UI62_STAGES.map((x, i) => h('button', { type: 'button', 'aria-pressed': String(x.id === st.stage), disabled: !!st.pending,
        title: `${x.label} · 자료 ${x.sourceIds.length}개`, onclick: () => setStage(x.id) }, `${i + 1}단계`))),
      h('p', { class: 'rr-stage-note', title: '자료를 나누어 읽는 단계예요. 당시 받은 순서나 시각이 아니에요.' }, `${cur.label} · 자료 ${cur.sourceIds.length}개 · 기준 `, h('code', {}, cur.basis.slice(0, 7))));
  }

  function readingBody(o: PlanOpened): Node[] {
    const st = s!, r = st.reading, prev = !r ? st.previous : null, use = r ?? prev, from: 'now' | 'previous' = r ? 'now' : 'previous';
    const out: Node[] = [];
    const map = o.kind === 'saved' ? host.mapBlock() : null;
    if (map) out.push(map);
    const total = st.input?.coverage.total ?? 0, sent = st.input?.coverage.sent ?? 0;
    const outcome = !!st.input?.ask.sources.some(x => OUTCOME_KINDS.includes(x.kind) || x.kind === 'record');
    if (!st.input) { out.push(h('p', { class: 'fine' }, '자료를 읽는 중…')); return out; }
    if (prev) out.push(h('p', { class: 'rr-older', role: 'status' }, `앞서 보낸 자료 ${prev.coverage.sent}개로 만든 정리예요. 지금 원자료는 ${total}개이고, 새로 정리하면 ${sent}개를 보내요.`));
    if (use) {
      const m = statements(use);
      const records = recordSection(use, from, null);
      if (records) out.push(records);
      if (m.read) out.push(h('section', { class: 'rr-sec rr-read' }, h('h3', {}, '지금 읽을 부분'),
        h('div', { class: 'rr-readrow' }, h('button', { type: 'button', class: 'rr-go', onclick: () => host.selectPart(m.read!.partId) }, partName(m.read.partId), h('span', { 'aria-hidden': 'true' }, ' ›')),
          h('p', {}, m.read.why), h('div', { class: 'rr-chips' }, ...m.read.refs.map(id => chipFor(id, use, from))), planMeet([m.read.partId]))));
      if (m.open.length) out.push(h('section', { class: 'rr-sec' }, h('h3', {}, '정할 것'),
        ...m.open.map((x, n) => statement('open', n, x, use, from, h('div', { class: 'rr-acts' }, trialButton(x, use, from, '이걸로 시험'))))));
      if (m.changes.length) out.push(h('section', { class: 'rr-sec' }, h('h3', {}, '달라진 점'),
        ...m.changes.map((x, n) => statement('changes', n, x, use, from, planMeet(x.partIds)))));
      // A pasted record read in its own readings is not 'no result material'.
      else if (!records) out.push(h('section', { class: 'rr-sec' }, h('h3', {}, '달라진 점'),
        h('p', { class: 'rr-none' }, outcome ? '이 자료에서 프로그램의 달라진 점을 말하지 않았어요.' : '돌아온 결과 자료가 아직 없어요. 반영 실패나 변화 없음이라는 뜻은 아니에요.')));
      if (use.reply.notCovered.length) out.push(h('section', { class: 'rr-sec rr-gaps' }, h('h3', {}, '이 자료로는 말할 수 없는 것'),
        h('ul', {}, ...use.reply.notCovered.map(t => h('li', {}, t)))));
      const f = st.focus && st.focus.list === 'changes' ? m.changes[st.focus.n] : null;
      if (f && !m.open.length) out.push(h('div', { class: 'rr-acts' }, trialButton(f, use, from, '이 변화에 이어 바꿀 모습 시험')));
    } else if (!st.pending) {
      out.push(h('p', { class: 'rr-lead' }, st.error ? '정리를 만들지 못했어요. 아래 원자료로 읽을 수 있어요.' : '아직 이 자료를 정리하지 않았어요.'));
      out.push(materialList(o, 5));
    }
    return out;
  }
  /** The material itself: kind, title and version per source; the quote one click away. */
  function materialList(o: PlanOpened, max: number): Node {
    const all = sources();
    const list = all.slice(0, max);
    return h('section', { class: 'rr-sec rr-material' }, h('h3', {}, '원자료', h('small', {}, `${all.length}`)),
      h('ol', {}, ...list.map(x => h('li', {}, h('button', { type: 'button', class: 'rr-src', onclick: () => openSource(x, 'material') },
        h('span', { class: `rr-kind k-${x.kind}` }, DIGEST_KIND_LABEL[x.kind]), h('strong', {}, x.title),
        h('small', {}, [versionOf(x.basis), x.partIds.map(partName).join(' · ')].filter(Boolean).join(' · ')))))),
      all.length > max ? h('button', { type: 'button', class: 'link-button', onclick: () => { s!.view = { kind: 'material' }; render(); } }, `${all.length}개 모두 보기`) : null,
      !all.length ? h('p', { class: 'fine' }, '읽을 기록이나 붙인 자료가 아직 없어요.') : null);
  }
  function footer(o: PlanOpened): Node {
    const state = s!, status = host.status(), r = state.reading, out = h('footer', { class: 'lens-foot rr-foot' });
    if (state.pending) {
      out.append(h('div', { class: 'pending' }, h('span', { class: 'spinner', 'aria-hidden': 'true' }),
        h('span', {}, `${status.digest?.model ?? 'AI'}가 자료 ${state.input?.coverage.sent ?? 0}개를 읽고 있어요…`),
        h('button', { type: 'button', class: 'link-button', onclick: () => state.pending?.abort() }, '취소')));
      return out;
    }
    if (state.error) out.append(h('p', { class: 'pp-error', role: 'alert' }, state.error));
    if (state.storeMsg) out.append(h('p', { class: 'pp-error', role: 'status' }, state.storeMsg));
    const can = status.ai === 'deepseek' && !!status.digest && !!state.input?.ask.sources.length;
    if (r) {
      const cov = r.coverage.sent < r.coverage.total ? `자료 ${r.coverage.total}개 중 ${r.coverage.sent}개` : `자료 ${r.coverage.sent}개`;
      out.append(h('p', { class: 'rr-prov', title: `같은 자료는 다시 보내지 않아요. 정리는 지도 부분의 상태나 설명을 바꾸지 않아요. 정리 지시 ${r.prompt}` },
        h('span', { class: 'tag ai' }, `AI 정리 · ${r.model}`), h('span', {}, `${cov} · ${fullTime(r.at)}`),
        state.view.kind === 'reading' ? h('button', { type: 'button', class: 'link-button quiet', onclick: () => { state.view = { kind: 'material' }; render(); } }, '원자료') : null));
      return out;
    }
    if (status.access === 'code' && can) {
      const code = h('input', { id: 'return-access', type: 'password', placeholder: '접속 코드', autocomplete: 'off', value: host.accessCode() }) as HTMLInputElement;
      const keep = () => host.keepAccessCode(code.value); code.addEventListener('input', keep); code.addEventListener('change', keep);
      out.append(h('div', { class: 'access' }, h('label', { for: 'return-access' }, '접속 코드'), code));
    }
    const sent = state.input?.coverage.sent ?? 0, total = state.input?.coverage.total ?? 0;
    // A pasted record is read with the rest of the material, newest records first; say when one goes only in part or not at all.
    const recs = [...(state.input?.sources.values() ?? [])].filter(x => x.kind === 'record'), kept = host.current()?.project.pasted.length ?? 0;
    const cut = recs.filter(x => (x.sent ?? 0) < x.text.length).length, left = Math.max(0, kept - recs.length);
    const range = [cut ? `기록 ${cut}개는 앞부분만` : '', left ? `붙여넣은 기록 ${left}개는 이번에 안 보냄` : ''].filter(Boolean).join(' · ');
    const label = recs.length ? '붙인 기록 요약' : state.previous ? '지금 자료로 정리하기' : 'AI로 정리하기';
    const gated = status.access === 'code' && can, go = codeGate(h('button', { type: 'button', class: host.mapPrimary() ? 'secondary small' : 'primary small', title: recs.length ? '붙인 기록을 따로 요약해 읽어요. 지도는 바꾸지 않아요.' : '', onclick: () => void analyze() }, label), gated, !!host.accessCode(), !can);
    out.append(h('div', { class: 'pp-row' }, go, codeNote(gated, !!host.accessCode()),
      h('span', { class: 'fine' }, can ? `자료 ${sent < total ? `${total}개 중 ${sent}개` : `${sent}개`}를 보내요${range ? ` · ${range}` : ''}` : status.ai === 'off' ? '서버에 AI 키가 없어요 · 원자료로 읽어요' : status.ai === 'none' ? '이 주소에는 AI 서버가 없어요 · 원자료로 읽어요' : ''),
      state.view.kind === 'reading' ? h('button', { type: 'button', class: 'link-button quiet', onclick: () => { state.view = { kind: 'material' }; render(); } }, '원자료') : null));
    return out;
  }

  function sourceBody(src: ReadingSource, from: 'now' | 'previous' | 'material', quote: string | null, at?: number): Node[] {
    const v = versionOf(src.basis);
    if (src.kind === 'record') return recordBody(src, quote, at);
    return [h('article', { class: 'rr-source' },
      h('p', { class: 'rr-source-kind' }, h('span', { class: `rr-kind k-${src.kind}` }, DIGEST_KIND_LABEL[src.kind]), v ? h('code', {}, v) : null, h('span', {}, src.id)),
      h('h3', {}, src.title),
      h('blockquote', { class: `rr-quote${src.kind === 'code' ? ' code' : ''}` }, ...quoted(src.text, quote, quote && at !== undefined ? { at, length: quote.length } : undefined)),
      from !== 'material' ? h('p', { class: 'fine' }, '이 정리를 만들 때 함께 보관한 자료예요.') : null,
      h('dl', { class: 'rr-meta' },
        h('dt', {}, '판본·출처'), h('dd', {}, src.basis, src.url ? h('a', { href: src.url, target: '_blank', rel: 'noopener noreferrer' }, ' 공개 원문 ↗') : null),
        src.note ? h('dt', {}, '편집 설명') : null, src.note ? h('dd', {}, src.note) : null,
        src.partIds.length ? h('dt', {}, '다루는 부분') : null, src.partIds.length ? h('dd', { class: 'rr-chips' }, ...src.partIds.map(partChip)) : null))];
  }
  /** A pasted record: what was read from it (when a reading covers it), then the text as pasted with the quote marked. The
   * time is when it was added here; the part is where the person was looking, shown as such. */
  function recordBody(src: ReadingSource, quote: string | null, at?: number): Node[] {
    const kept = host.current()?.project.pasted.find(x => x.id === src.recordId) ?? null;
    const use = shown(), from: 'now' | 'previous' = s?.reading ? 'now' : 'previous';
    const read = use && src.recordId ? recordSection(use, from, src.recordId) : null;
    const sentTo = s?.input?.sources.get(src.id)?.sent;
    const ctx = kept?.context && host.current()?.view.parts.some(p => p.id === kept.context) ? kept.context : null;
    const map = quote ? null : host.mapBlock();
    return [...(map ? [map] : []), h('article', { class: 'rr-source rr-record' },
      h('p', { class: 'rr-source-kind' }, h('span', { class: 'rr-kind k-record' }, DIGEST_KIND_LABEL.record), kept ? h('span', {}, `붙여넣음 ${fullTime(kept.at)}`) : null),
      h('h3', { title: '원문의 첫 줄이에요' }, src.title),
      ctx ? h('p', { class: 'rr-context' }, h('span', {}, '붙일 때 보던 부분'), partChip(ctx)) : null,
      // Arrived by a quote: the original, with the quote marked, is what this view is for (the readings are one step back).
      quote ? null : read ?? h('p', { class: 'rr-lead' }, s?.pending ? '읽는 중이에요…' : src.recordId && host.readIntoMap(src.recordId) ? '지도 정리에 읽힌 기록이에요. 이 기록의 따로 요약은 아직 없어요.' : '아직 이 기록을 읽지 않았어요.'),
      h('blockquote', { class: 'rr-quote rr-raw' }, ...quoted(kept?.text ?? src.text, quote, quote && at !== undefined ? { at, length: quote.length } : undefined)),
      sentTo !== undefined && sentTo < (kept?.text ?? src.text).length ? h('p', { class: 'fine' }, `읽을 때 앞 ${sentTo.toLocaleString()}자만 보내요 · 전체 ${(kept?.text ?? src.text).length.toLocaleString()}자`) : null)];
  }
  function pasteBody(o: PlanOpened): Node[] {
    const st = s!, text = draftOf(st.key), ctx = st.pasteContext && o.view.parts.some(p => p.id === st.pasteContext) ? st.pasteContext : null;
    const area = h('textarea', { id: 'paste-text', class: 'rr-paste', rows: '14', spellcheck: 'false', 'aria-label': '붙여 넣을 기록 원문',
      placeholder: '작업 AI가 돌려준 보고나 대화를 그대로 붙여 넣어요.' }) as HTMLTextAreaElement;
    area.value = text;
    const count = h('span', { class: 'fine rr-count' }, text ? `${text.length.toLocaleString()}자` : '');
    const warn = h('p', { class: 'pp-error', role: 'status', hidden: !secretLike(text) }, '키나 토큰처럼 보이는 글이 있어요. 이 탭에만 두고 저장·전송하지 않아요.');
    area.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); backToReading(); } });
    area.addEventListener('input', () => {
      keepDraft(st.key, area.value); count.textContent = area.value ? `${area.value.length.toLocaleString()}자` : ''; warn.hidden = !secretLike(area.value);
    });
    return [h('section', { class: 'rr-sec rr-paste-box' }, h('h3', {}, '기록 붙여넣기'),
      h('p', { class: 'fine' }, '나누거나 종류·부분을 고르지 않아도 돼요. 저장한 뒤 지도 정리나 요약을 누를 때만 AI에 보내요.'),
      ctx ? h('p', { class: 'rr-context' }, h('span', {}, '보던 부분'), partChip(ctx),
        h('button', { type: 'button', class: 'link-button quiet', title: '읽기 맥락에서 빼요', onclick: () => { st.pasteContext = null; render(); } }, '빼기')) : null,
      area, warn, count, st.pasteMsg ? h('p', { class: 'pp-error', role: 'alert' }, st.pasteMsg) : null)];
  }
  function pasteFooter(): Node {
    const st = s!;
    return h('footer', { class: 'lens-foot rr-foot' }, h('div', { class: 'pp-row' },
      h('button', { type: 'button', class: 'primary small', disabled: st.saving, onclick: () => void savePaste() }, st.saving ? '저장 중…' : '기록 저장'),
      h('span', { class: 'fine' }, '저장해도 AI에 보내지 않아요'),
      h('button', { type: 'button', class: 'link-button quiet', onclick: backToReading }, '닫기')));
  }

  function render() {
    const o = host.current(); if (!s || !o || o.key !== s.key) return;
    // The way back stays at the top of the pane while a long original scrolls under it.
    const back = (label: string) => h('div', { class: 'rr-backbar' }, h('button', { type: 'button', class: 'rr-back', onclick: backToReading },
      h('span', { 'aria-hidden': 'true' }, '←'), label));
    const body = h('div', { class: 'lens-body rr-body' });
    if (s.view.kind === 'paste') {
      // Re-rendering keeps the caret where the person was typing.
      const area = document.querySelector<HTMLTextAreaElement>('#paste-text'), caret = area ? [area.selectionStart, area.selectionEnd, document.activeElement === area] as const : null;
      put(body, back('정리로'), ...pasteBody(o));
      host.show([header(o), body, pasteFooter()]); host.mark(s.pasteContext ? [s.pasteContext] : []);
      const next = document.querySelector<HTMLTextAreaElement>('#paste-text');
      if (next && caret) { next.setSelectionRange(caret[0], caret[1]); if (caret[2]) next.focus({ preventScroll: true }); }
      return;
    }
    if (s.view.kind === 'source' && s.quoteFrom) {
      const name = partName(s.quoteFrom);
      put(body, h('div', { class: 'rr-backbar' }, h('button', { type: 'button', class: 'rr-back', title: `‘${name}’ 선택으로 돌아가기 (Esc)`, onclick: close }, h('span', { 'aria-hidden': 'true' }, '←'), name)),
        ...sourceBody(s.view.source, s.view.from, s.view.quote, s.view.at));
    } else if (s.view.kind === 'source') put(body, back('정리로'), ...sourceBody(s.view.source, s.view.from, s.view.quote, s.view.at));
    else if (s.view.kind === 'material') {
      const all = sources();
      put(body, back('정리로'), h('section', { class: 'rr-sec rr-material' }, h('h3', {}, '원자료', h('small', {}, `${all.length}`)),
        h('ol', {}, ...all.map(x => h('li', {}, h('button', { type: 'button', class: 'rr-src', onclick: () => openSource(x, 'material') },
          h('span', { class: `rr-kind k-${x.kind}` }, DIGEST_KIND_LABEL[x.kind]), h('strong', {}, x.title),
          h('small', {}, [versionOf(x.basis), x.partIds.map(partName).join(' · ')].filter(Boolean).join(' · '))))))));
    } else put(body, ...readingBody(o));
    // A quote opened from a part is read and left: no reading action under it.
    host.show(s.view.kind === 'source' && s.quoteFrom ? [header(o), body] : [header(o), body, footer(o)]);
    const v = s.view;
    host.open(s.focus?.list === 'records' && s.focus.part ? s.focus.part : null);
    const marks = v.kind === 'source' ? (v.source.kind === 'record' ? focusParts() : v.source.partIds) : focusParts();
    host.mark(marks.length || s.focus ? marks : host.mapMarks());
    if (v.kind === 'source' && v.quote) requestAnimationFrame(() => document.querySelector('#lens .rr-mark')?.scrollIntoView({ block: 'center' }));
  }
  /** Leaving the reading for a source or the paste box: where it was read (scroll, request items, history folds, focus). held: a
   * capture the host made before opening the pane again re-rendered it (a quote from the pane's own reading), used once. */
  let held = false;
  function keep() {
    if (!s || s.view.kind !== 'reading') return;
    const body = document.querySelector('#lens .lens-body');
    s.scroll = body?.scrollTop ?? 0; s.requests = body ? captureRequestReading(body) : null;
  }
  function openSource(source: ReadingSource, from: 'now' | 'previous' | 'material', quote: string | null = null, kept = false, at?: number) {
    if (!s) return;
    if (!kept) keep();
    held = false;
    s.view = { kind: 'source', source: structuredClone(source), from, quote, ...(at !== undefined ? { at } : {}) }; render();
    requestAnimationFrame(() => document.querySelector<HTMLElement>('#lens .rr-back')?.focus({ preventScroll: true }));
  }
  function backToReading() {
    if (!s) return;
    s.quoteFrom = null;
    s.view = { kind: 'reading' }; render();
    // The fresh data first, then the same items and folds by their exact identity; an item gone leaves the reading at its start.
    const body = document.querySelector('#lens .lens-body'), saved = s.requests; s.requests = null;
    if (body && (!saved || restoreRequestReading(body, saved))) body.scrollTop = s.scroll;
  }

  /** A quote of a record a map reading rests on, in the pane, marked (at from, where the reading kept its place); closing comes
   * back to the scene it was opened from. */
  function openQuote(record: string, quote: string, scene: Scene | null, from?: number) {
    const o = host.current(); if (!o || o.kind !== 'saved') return;
    // From this pane's own reading (the map's root, nothing selected) the host kept it before reopening the pane re-rendered it.
    const kept = held && !!s && s.key === o.key; held = false;
    open(); if (!s) return;
    if (scene) s.back = scene;
    s.quoteFrom = scene?.selected ?? null;
    let src = sources().find(x => x.recordId === record) ?? null;
    if (!src) {
      const r = o.view.records.find(x => x.id === record); if (!r) return;
      src = { id: r.id, kind: r.kind === 'report' ? 'report' : r.kind === 'evidence' ? 'test' : 'user', title: `프로젝트 기록 · ${r.text.split('\n').find(l => l.trim())?.trim().slice(0, 80) ?? ''}`, text: r.text, note: '', basis: `프로젝트 기록 · ${fullTime(r.at)}`, partIds: r.partId ? [r.partId] : [], url: null };
    }
    openSource(src, 'material', quote, kept, from);
  }

  return {
    isOpen: () => !!s,
    open, close, toggle: () => (s ? close() : open()), openPaste, openQuote,
    /** Keep where this pane's reading is (its request items, history folds, focus, scroll) before a quote from it re-renders the pane. */
    keepReading: () => { held = false; if (s && s.view.kind === 'reading') { keep(); held = true; } },
    /** A map reading was applied: a note that the record had not been sent yet is no longer true. */
    mapApplied: () => { if (s) { s.storeMsg = null; render(); } },
    /** Re-render (the pane came back after a part's reading, or the AI status arrived). */
    render: () => { if (s) { render(); void refresh(); } },
    /** Esc: from a source back to the reading, else close. */
    escape: () => { if (!s) return; if (s.view.kind === 'source' && s.quoteFrom) close(); else if (s.view.kind !== 'reading') backToReading(); else close(); },
    projectChanged: () => { if (s && host.current()?.key !== s.key) { s.pending?.abort(); s = null; host.mark([]); } }
  };
}
