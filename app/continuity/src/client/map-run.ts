/* Reading records into the map (studio.map.1), for one workspace entry at a time. Sends only when the person asks, never the very
 * same request twice, and applies a reply only to the entry it was asked for, on top of the map it was asked about: a reply that
 * comes back after another reading was applied, or after a part it names has gone, is not applied. Saving is the host's
 * (commit): until it succeeds nothing is said to be done, and the records and drafts stay as they were. A reply that comes back while
 * the person is elsewhere (another project, home, or a later visit of the same one) is kept ready for its entry in this page only
 * (not across a reload) and applied when they come back and ask for it, without asking again. */
import { isMapReading, type MapReading, type Project } from '../shared/types.js';
import type { StudioView } from '../shared/studio.js';
import { buildMapAsk, applyReading, MAP5_SCHEMA, MAP6_SCHEMA, type MapInput, type MapReply, type Applied } from '../shared/map-reading.js';
import { askMap, AskError, ERROR_TEXT, type AiStatus } from './studio-api.js';
import type { FrozenRequest } from '../shared/request-return.js';
/** SHA-256 of the request's JSON: the very same request is never sent or applied twice. */
async function askHash(ask: unknown): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ask)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export interface MapRunHost {
  /** ref: the workspace entry's lifecycle this visit read (trash and restore make a new one). */
  current(): { key: string; kind: string; project: Project; view: StudioView; ref?: { lifecycle: number } | null } | null;
  /** This visit of the open entry: a new one each time it is opened again, even under the same key (the key when not given). */
  visit?(): unknown;
  status(): AiStatus;
  accessCode(): string;
  requests?(): FrozenRequest[];
  /** Saves the project for the entry now open; text when it was not saved (nothing is applied then). */
  commit(next: Project): Promise<string | null>;
  /** A reading was applied and saved, in the visit it was applied from. */
  done(applied: Applied): void;
  /** Anything to show changed (pending, ready, error). */
  changed(): void;
}
/** pending: asked (or about to be) and still cancellable; committing: being saved, no longer cancellable; ready: a checked reply to
 * the very request sent, kept for this entry in this page until the person applies or discards it (never said to be saved). */
export interface MapRunState { pending: AbortController | null; committing: boolean; ready: boolean; error: string | null }
const MAP_ERROR: Record<string, string> = {
  MAP_CHANGED: '정리하는 동안 지도가 바뀌어(다른 정리가 반영되었거나 부분이 보관됨) 이번 결과는 반영하지 않았어요. 다시 정리해 주세요.',
  ALREADY_APPLIED: '같은 기록은 이미 지도에 정리했어요.',
  READINGS_FULL: '이 프로젝트에 더 정리할 수 없어요(정리 기록 한도).',
  INVALID_RESPONSE: 'AI 응답이 근거 규칙(원문 인용·알려진 부분)에 맞지 않아 반영하지 않았어요.',
  // The reply did not end (the server read none of it): nothing about its evidence is said, and nothing was applied.
  AI_RESPONSE_INCOMPLETE: 'AI가 응답을 끝내지 못해 지도에 반영하지 않았어요. 원문과 기존 지도는 그대로예요.',
  AI_RESPONSE_UNFINISHED: 'AI 응답이 정상적으로 끝나지 않아 지도에 반영하지 않았어요. 원문과 기존 지도는 그대로예요.',
  NOTHING_READ: '이번 응답에서 정리할 내용을 얻지 못했어요. 원문은 보존됐어요.',
  LIFECYCLE: '이 프로젝트가 보관되었다가 다시 열려 이번 정리 결과는 반영하지 않았어요. 원문과 지도는 그대로예요. 다시 정리해 주세요.',
  HASH: '요청을 준비하지 못해 보내지 않았어요. 기록은 그대로예요.'
};
/** One request of one entry: reserved before anything is awaited, so a second click (or another reading of the same entry) sends
 * nothing. It belongs to the entry (entryId, the project it holds, the lifecycle it was read in) and to the visit it was asked
 * from; the reply keeps the very input, wire, model, prompt and hash it was made with, and is never re-asked or re-read. */
interface Attempt {
  key: string; project: string; lifecycle: number | null; visit: unknown;
  phase: 'hashing' | 'asking' | 'ready' | 'committing';
  controller: AbortController; inp: MapInput; prompt: string; hash: string;
  reply: MapReply | null; model: string; meta: { id: string; at: string } | null;
}
interface Slot { attempt: Attempt | null; error: string | null }

export function createMapRun(host: MapRunHost) {
  const slots = new Map<string, Slot>();
  const of = (key: string) => { let s = slots.get(key); if (!s) { s = { attempt: null, error: null }; slots.set(key, s); } return s; };
  const visitOf = () => (host.visit ? host.visit() : host.current()?.key ?? null);
  /** The entry an attempt was made for, still in the lifecycle it was read in (an archived and restored copy is not it). */
  const same = (a: Attempt, o: ReturnType<MapRunHost['current']>) => !!o && o.kind === 'saved' && o.key === a.key && o.project.id === a.project && (o.ref?.lifecycle ?? null) === a.lifecycle;
  /** The wire the server advertises: m6 (candidates state their target), m5 (contiguous ranges), m4; earlier servers keep theirs. */
  const anchored = (): boolean | typeof MAP5_SCHEMA | typeof MAP6_SCHEMA => {
    const prompt = host.status().map?.prompt ?? '';
    return /^m6-[0-9a-f]{12}$/.test(prompt) ? MAP6_SCHEMA : /^m5-[0-9a-f]{12}$/.test(prompt) ? MAP5_SCHEMA : /^m4-[0-9a-f]{12}$/.test(prompt);
  };
  /** What a reading would send now (nothing is sent). */
  function input(requestId?: string): MapInput | null { const o = host.current(); return o && o.kind === 'saved' ? buildMapAsk(o.project, o.view, host.requests?.() ?? [], requestId, anchored()) : null; }
  function can(): boolean { const st = host.status(); return st.ai === 'deepseek' && !!st.map; }
  async function run(requestId?: string, mapOnly = false) {
    const o = host.current(); if (!o || o.kind !== 'saved') return;
    const key = o.key, slot = of(key); if (slot.attempt) return;
    const st = host.status(); if (!st.map || st.ai !== 'deepseek') return;
    const inp = buildMapAsk(o.project, o.view, mapOnly ? [] : host.requests?.() ?? [], requestId, anchored());
    if (inp.problem) { slot.error = inp.problem === 'NOTHING_NEW' ? '이 범위에서 새로 읽을 기록이 없어요.' : inp.problem === 'REQUEST_CONTEXT_TOO_LARGE' ? '요청 문맥을 한 번에 대조하기 어려워 보고를 읽지 않았어요. 비교할 요청문을 골라 주세요.' : inp.problem === 'TOO_LARGE' ? '지도가 커서 한 번에 보낼 수 없어요.' : '키나 토큰처럼 보이는 글이 있는 기록이 있어 보내지 않았어요.'; host.changed(); return; }
    const a: Attempt = { key, project: o.project.id, lifecycle: o.ref?.lifecycle ?? null, visit: visitOf(), phase: 'hashing', controller: new AbortController(), inp, prompt: st.map.prompt, hash: '', reply: null, model: '', meta: null };
    slot.attempt = a; slot.error = null; host.changed();
    const live = () => slot.attempt === a;
    try { a.hash = await askHash(inp.ask); }
    catch { if (live()) { slot.attempt = null; slot.error = MAP_ERROR.HASH!; host.changed(); } return; }
    if (!live()) return; // cancelled before it left: nothing was sent
    // Moved to another entry (or out and back) before it left: nothing goes, for this entry or the one open now.
    const now = host.current();
    if (!same(a, now) || visitOf() !== a.visit) { slot.attempt = null; host.changed(); return; }
    if (now!.project.readings.some(r => isMapReading(r) && r.hash === a.hash)) { slot.attempt = null; slot.error = MAP_ERROR.ALREADY_APPLIED!; host.changed(); return; }
    a.phase = 'asking';
    let res: { model: string; reply: MapReply };
    try { res = await askMap(inp.ask, a.controller.signal, host.accessCode()); }
    catch (e) {
      if (!live()) return; // cancelled or discarded: a later attempt or its result is not touched
      const code = e instanceof AskError ? e.code : 'NETWORK';
      slot.attempt = null; if (code !== 'CANCELLED') slot.error = MAP_ERROR[code] ?? ERROR_TEXT[code] ?? '지도를 정리하지 못했어요. 기록은 그대로예요.';
      host.changed(); return;
    }
    if (!live() || a.controller.signal.aborted) return;
    a.reply = res.reply; a.model = res.model; a.phase = 'ready';
    // Still the visit it was asked from: applied now, as before. Otherwise it waits for this entry until the person comes back
    // to it and asks for it (another project, the home page or a new visit of this one is never changed or moved by it).
    if (visitOf() === a.visit && same(a, host.current())) await apply(a); else host.changed();
  }
  /** Applies a ready reply to the entry open now, on top of the map as it is now, and saves it. No network: the reply is the one
   * already checked against the request that was sent. Saving cannot be cancelled once begun; a failed save keeps the reply
   * ready, so trying again saves the same result (another tab's change still refuses it). */
  async function apply(a: Attempt): Promise<void> {
    const slot = of(a.key);
    if (slot.attempt !== a || a.phase !== 'ready' || !a.reply) return;
    const o = host.current();
    if (!same(a, o)) { if (o?.key === a.key) { slot.attempt = null; slot.error = MAP_ERROR.LIFECYCLE!; host.changed(); } return; }
    a.meta ??= { id: `R_${crypto.randomUUID()}`, at: new Date().toISOString() };
    let applied: Applied;
    try { applied = applyReading(o!.project, a.inp, a.reply, { ...a.meta, model: a.model, prompt: a.prompt, hash: a.hash }); }
    catch (e) {
      const code = (e as Error).message;
      slot.attempt = null; slot.error = code === 'NOTHING_READ' ? [MAP_ERROR.NOTHING_READ!, ...a.reply.gaps].join(' ') : MAP_ERROR[code] ?? '이 결과를 지도에 반영하지 못했어요. 지도와 기록은 그대로예요.';
      host.changed(); return;
    }
    a.phase = 'committing'; slot.error = null; host.changed();
    const visit = visitOf();
    let failed: string | null;
    try { failed = await host.commit(applied.project); } catch { failed = '저장하지 못했어요. 바뀐 내용은 적용하지 않았어요.'; }
    if (slot.attempt !== a) return;
    if (failed) { a.phase = 'ready'; slot.error = failed; host.changed(); return; }
    slot.attempt = null;
    // Saved to the entry it was asked for; shown only in the visit it was applied from (a later one is left as it is).
    if (visitOf() === visit && host.current()?.key === a.key) host.done(applied);
    host.changed();
  }
  /** What one entry's reading stands at. An attempt of an earlier lifecycle of the open entry is let go here (it says so). */
  function stateOf(key: string): MapRunState {
    const slot = of(key), a = slot.attempt, o = host.current();
    if (a && a.phase !== 'committing' && o?.key === key && !same(a, o)) { a.controller.abort(); slot.attempt = null; slot.error = MAP_ERROR.LIFECYCLE!; }
    const b = slot.attempt;
    return { pending: b && (b.phase === 'hashing' || b.phase === 'asking') ? b.controller : null, committing: b?.phase === 'committing', ready: b?.phase === 'ready', error: slot.error };
  }
  const openSlot = () => { const o = host.current(); return o ? of(o.key) : null; };
  return {
    input, can, run, runMapOnly: () => run(undefined, true),
    /** The ready reply of the entry open now, applied (a second click while it is applied does nothing). */
    applyReady: (): Promise<void> => { const a = openSlot()?.attempt; return a ? apply(a) : Promise.resolve(); },
    state: (): MapRunState => { const o = host.current(); return o ? stateOf(o.key) : { pending: null, committing: false, ready: false, error: null }; },
    stateOf,
    /** Cancels a request still on its way; once saving has begun there is nothing to cancel. */
    cancel: () => { const s = openSlot(), a = s?.attempt; if (!s || !a || (a.phase !== 'hashing' && a.phase !== 'asking')) return; a.controller.abort(); s.attempt = null; host.changed(); },
    /** Lets a ready reply go unapplied (nothing is saved). */
    discard: () => { const s = openSlot(), a = s?.attempt; if (!s || !a || a.phase !== 'ready') return; s.attempt = null; s.error = null; host.changed(); },
    clearError: () => { const s = openSlot(); if (s) s.error = null; },
    last: (): MapReading | null => { const o = host.current(); return o ? (o.project.readings.filter(isMapReading).at(-1) ?? null) : null; }
  };
}
export type MapRun = ReturnType<typeof createMapRun>;
/** What a request would send, said before it is sent. */
export function sendLine(inp: MapInput): string {
  const c = inp.coverage, left = c.fresh - c.sent;
  if (inp.problem === 'REQUEST_CONTEXT_TOO_LARGE') return '요청 문맥이 커서 아직 보고를 읽지 않았어요. 비교할 요청문을 골라 주세요.';
  return [`기록 ${c.sent}개를 AI에 보내요`, c.partial ? `${c.partial}개는 일부 구간만` : '', left > 0 ? `${left}개는 다음에` : '', inp.requestCoverage?.sent ? `고정 요청 ${inp.requestCoverage.sent}개와 대조` : ''].filter(Boolean).join(' · ');
}
