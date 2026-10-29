/* Reading records into the map (studio.map.1), for one workspace entry at a time. Sends only when the person asks, never the very
 * same request twice, and applies a reply only to the entry it was asked for, on top of the map it was asked about: a reply that
 * comes back after another reading was applied, or after a part it names has gone, is not applied. Saving is the host's
 * (commit): until it succeeds nothing is said to be done, and the records and drafts stay as they were. A reply that comes back while
 * the person is elsewhere (another project, home, or a later visit of the same one) is kept ready for its entry in this page only
 * (not across a reload) and applied when they come back and ask for it, without asking again. */
import { isMapReading, type MapReading, type Project } from '../shared/types.js';
import type { StudioView } from '../shared/studio.js';
import { buildMapAsk, applyReading, validateMapReply, MAP5_SCHEMA, MAP6_SCHEMA, type MapInput, type MapReply, type Applied } from '../shared/map-reading.js';
import { askMap, AskError, ERROR_TEXT, type AiStatus } from './studio-api.js';
import { encodeMapInput, decodeMapInput, jobHash, MAP_JOB_VERSION, type MapJobBinding } from '../shared/map-job.js';
import { SPAN_INDEX, textDigest } from '../shared/evidence-span.js';
import { jobApi, JobError, sameJob, type JobReservations, type JobView, type Reservation } from './map-jobs.js';
import type { FrozenRequest } from '../shared/request-return.js';
/** SHA-256 of the request's JSON: the very same request is never sent or applied twice. */
async function askHash(ask: unknown): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ask)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export interface MapRunHost {
  /** ref: the workspace entry's lifecycle this visit read (trash and restore make a new one). */
  current(): { key: string; kind: string; project: Project; view: StudioView; ref?: { lifecycle: number; seq?: number } | null } | null;
  /** This visit of the open entry: a new one each time it is opened again, even under the same key (the key when not given). */
  visit?(): unknown;
  status(): AiStatus;
  accessCode(): string;
  requests?(): FrozenRequest[];
  /** Saves the project for the entry now open; text when it was not saved (nothing is applied then). */
  commit(next: Project): Promise<string | null>;
  /** A reading was applied and saved, in the visit it was applied from. */
  done(applied: Applied): void;
  /** Anything to show changed (pending, ready, error) for this entry: the host redraws only what belongs to it (another project
   * open now is left as it is). */
  changed(key: string): void;
  /** AF100: this address's job reservations (null: this page cannot keep any). Used only when the server keeps durable jobs. */
  jobs?(): JobReservations | null;
  /** AF100: the entry as saved now (a fresh read, another tab's save included), to tell a reading already applied. */
  stored?(key: string): { project: Project; lifecycle: number } | null;
  /** AF100: this page itself saved the entry's save number seq (from seq - 1). */
  ownSave?(key: string, seq: number): boolean;
  /** AF100: how often a job is looked at while it runs (ms). */
  pollMs?: number;
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
/* AF100: a job the local server keeps. Said in what the person can do (continue, see the result, stopped, cancel), not how. */
const JOB_ERROR: Record<string, string> = {
  RESERVE: '정리 작업을 이 브라우저에 기록하지 못해 보내지 않았어요. 기록과 지도는 그대로예요.',
  INTERRUPTED: 'PC의 Studio 실행기가 종료되어 이번 정리는 중단됐어요. 결과는 없고 기록과 지도는 그대로예요. AI 서비스가 그 요청을 계속 처리했는지는 알 수 없어요. 다시 정리할 수 있어요.',
  NOT_ACCEPTED: '정리 요청이 PC의 Studio 실행기에 접수되지 않았어요. 기록과 지도는 그대로예요. 다시 정리할 수 있어요.',
  GONE: 'PC의 Studio 실행기에서 이 정리 작업의 기록을 찾을 수 없어요. 기록과 지도는 그대로예요.',
  OPERATION_DAMAGED: '이 정리 작업의 기록이 손상되어 결과를 확인할 수 없어요. 기록과 지도는 그대로예요.',
  MISMATCH: '받은 정리 결과가 이 프로젝트가 보낸 요청과 맞지 않아 반영하지 않았어요. 기록과 지도는 그대로예요.',
  CONFLICT: '같은 정리 결과로 표시된 다른 내용이 이미 지도에 있어 반영하지 않았어요. 지도와 기록은 그대로예요.',
  CANCEL_UNCONFIRMED: '취소를 확인하지 못했어요. 정리는 계속될 수 있어요. 잠시 뒤 다시 취소해 주세요.',
  UNREACHABLE: 'PC의 Studio 실행기에 연결되지 않아 정리 상태를 확인하지 못하고 있어요. 실행기가 다시 켜지면 이어서 확인해요.',
  UNAVAILABLE: '이 주소의 서버에서는 앞서 맡긴 정리 작업을 확인할 수 없어요. 기록과 지도는 그대로예요.',
  JOB_STORE_FAILED: 'PC의 Studio 실행기가 정리 결과를 저장하지 못해 보여 드리지 않아요. 기록과 지도는 그대로예요.',
  JOB_STORE_FULL: '확인하지 않은 정리 결과가 많거나 PC의 작업 기록이 가득해 새 정리를 시작하지 않았어요.',
  JOB_STORE_UNAVAILABLE: 'PC의 Studio 실행기가 작업 기록을 열 수 없어 정리를 시작하지 않았어요.',
  ENTRY_BUSY: '이 프로젝트의 앞선 정리가 아직 끝나지 않았어요.',
  /* AF102: the local preview's map executor (one at a time, first map only). */
  EXECUTOR_BUSY: 'PC의 지도 실행기가 다른 정리를 하고 있어 시작하지 않았어요. 기록과 지도는 그대로예요.',
  EXECUTOR_UNSETTLED: '이전 지도 실행이 끝났는지 확인되지 않아 새 정리를 시작하지 않았어요. PC의 Studio 실행기를 확인해 주세요.',
  EXECUTOR_UNAVAILABLE: 'PC의 지도 실행기를 쓸 수 없어 정리를 시작하지 않았어요. 기록과 지도는 그대로예요.',
  EXECUTOR_SCOPE: '이 미리보기 실행기는 아직 부분이 없는 프로젝트의 첫 지도만 정리해요.',
  EXECUTOR_SCHEMA: '이 미리보기 실행기는 현재 지도 형식(studio.map.6)만 정리해요. 화면을 새로 고친 뒤 다시 정리해 주세요.',
  EXECUTOR_CHANGED: 'PC의 지도 실행기 설정이 바뀌어 이 정리는 실행하지 않았어요. 기록과 지도는 그대로예요.',
  AI_RESPONSE_REJECTED: 'AI 응답이 실행 규칙에 맞지 않아(도구 사용·오류·형식) 반영하지 않았어요. 원문과 기존 지도는 그대로예요.',
  PROMPT_CHANGED: 'PC의 Studio 실행기 설정이 바뀌어 보내지 않았어요. 화면을 새로 고친 뒤 다시 정리해 주세요.',
  ELSEWHERE: '다른 창에서 이미 이 정리 결과를 지도에 반영했어요. 새로 고치면 보여요.',
  DISCARD_FAILED: '결과를 버리지 못했어요(이 브라우저에도 PC의 Studio 실행기에도 기록하지 못함). 결과는 그대로 있어요. 다시 버려 주세요.',
  SAVED_SINCE: '정리를 맡긴 뒤 이 프로젝트가 다른 화면에서 저장되어 이번 결과는 반영하지 않았어요. 기록과 지도는 그대로예요. 다시 정리해 주세요.'
};
export const JOB_NOTE = {
  durable: '창을 닫아도 이 PC의 Studio 실행기가 켜져 있으면 계속 정리해요. 실행기를 끄면 중단돼요.',
  cancelled: '취소했어요. 결과는 반영하지 않아요. 이미 AI 서비스에 보낸 요청의 처리·요금까지 멈췄는지는 알 수 없어요.'
};
/** One request of one entry: reserved before anything is awaited, so a second click (or another reading of the same entry) sends
 * nothing. It belongs to the entry (entryId, the project it holds, the lifecycle it was read in) and to the visit it was asked
 * from; the reply keeps the very input, wire, model, prompt and hash it was made with, and is never re-asked or re-read.
 * AF100: op is its durable job. A job found in storage (a reload, another tab) has no visit of this page and no input until its
 * result is fetched: it is then applied only when the person asks, from its own entry. */
/** owned: asked from this page (found again otherwise: a reload, another tab). Either way a result is applied only on the save it
 * was asked from (binding.seq) or on saves this page made itself since (onItsSave). release: this page's hold while it sends. */
interface Op { id: string; cap: string; binding: MapJobBinding; payload: string | null; receipt: boolean; state: string; cancelling: boolean; misses: number; tick: number; owned: boolean; release: (() => void) | null }
interface Attempt {
  key: string; project: string; lifecycle: number | null; visit: unknown;
  phase: 'hashing' | 'reserving' | 'asking' | 'ready' | 'committing' | 'closing';
  controller: AbortController; inp: MapInput | null; prompt: string; hash: string;
  reply: MapReply | null; model: string; meta: { id: string; at: string } | null;
  op: Op | null;
}
interface Slot { attempt: Attempt | null; error: string | null; notice: string | null }

export function createMapRun(host: MapRunHost) {
  const slots = new Map<string, Slot>();
  const of = (key: string) => { let s = slots.get(key); if (!s) { s = { attempt: null, error: null, notice: null }; slots.set(key, s); } return s; };
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
  /** AF100: the server keeps map readings as durable jobs, and this page can reserve them. */
  const durable = (): boolean => host.status().jobs?.durable === true && !!host.jobs?.()?.usable;
  /** Why a reading cannot start although an AI server answered (a job store it cannot use), or null. */
  function blocked(): string | null {
    const st = host.status(), j = st.jobs, viaJobs = st.map?.via === 'jobs';
    if (!j) return viaJobs ? JOB_ERROR.JOB_STORE_UNAVAILABLE! : null;
    if (!j.durable) return `${JOB_ERROR.JOB_STORE_UNAVAILABLE} ${j.problem === 'STORE_BUSY' ? '같은 작업 기록을 다른 Studio 실행기가 쓰고 있어요.' : ''}`.trim();
    if (viaJobs && (j.executor?.state === 'unsettled' || j.executor?.state === 'unavailable')) return JOB_ERROR[j.executor.state === 'unsettled' ? 'EXECUTOR_UNSETTLED' : 'EXECUTOR_UNAVAILABLE']!;
    return host.jobs?.()?.usable ? null : '이 브라우저에서는 정리 작업을 예약할 수 없어 시작하지 않아요.';
  }
  /** A map reading can be asked: with the AI key, or (AF102) only as a durable job of the server's own map executor. */
  const mapAi = (st: AiStatus): boolean => !!st.map && (st.ai === 'deepseek' || (st.map.via === 'jobs' && !!st.jobs));
  function can(): boolean { return mapAi(host.status()) && !blocked(); }
  async function run(requestId?: string, mapOnly = false) {
    const o = host.current(); if (!o || o.kind !== 'saved') return;
    const key = o.key, slot = of(key); if (slot.attempt) return;
    const st = host.status(); if (!st.map || !mapAi(st)) return;
    const inp = buildMapAsk(o.project, o.view, mapOnly ? [] : host.requests?.() ?? [], requestId, anchored());
    if (inp.problem) { slot.error = inp.problem === 'NOTHING_NEW' ? '이 범위에서 새로 읽을 기록이 없어요.' : inp.problem === 'REQUEST_CONTEXT_TOO_LARGE' ? '요청 문맥을 한 번에 대조하기 어려워 보고를 읽지 않았어요. 비교할 요청문을 골라 주세요.' : inp.problem === 'TOO_LARGE' ? '지도가 커서 한 번에 보낼 수 없어요.' : '키나 토큰처럼 보이는 글이 있는 기록이 있어 보내지 않았어요.'; host.changed(key); return; }
    if (blocked()) return;
    const a: Attempt = { key, project: o.project.id, lifecycle: o.ref?.lifecycle ?? null, visit: visitOf(), phase: 'hashing', controller: new AbortController(), inp, prompt: st.map.prompt, hash: '', reply: null, model: '', meta: null, op: null };
    slot.attempt = a; slot.error = null; slot.notice = null; host.changed(key);
    const live = () => slot.attempt === a;
    try { a.hash = await askHash(inp.ask); }
    catch { if (live()) { slot.attempt = null; slot.error = MAP_ERROR.HASH!; host.changed(key); } return; }
    if (!live()) return; // cancelled before it left: nothing was sent
    // Moved to another entry (or out and back) before it left: nothing goes, for this entry or the one open now.
    const now = host.current();
    if (!same(a, now) || visitOf() !== a.visit) { slot.attempt = null; host.changed(key); return; }
    if (now!.project.readings.some(r => isMapReading(r) && r.hash === a.hash)) { slot.attempt = null; slot.error = MAP_ERROR.ALREADY_APPLIED!; host.changed(key); return; }
    if (durable()) return runJob(a, inp, st.map.model, now!.ref?.seq ?? null);
    if (st.map.via === 'jobs') { slot.attempt = null; slot.error = blocked() ?? JOB_ERROR.JOB_STORE_UNAVAILABLE!; host.changed(key); return; } // never asked directly
    a.phase = 'asking';
    let res: { model: string; reply: MapReply };
    try { res = await askMap(inp.ask, a.controller.signal, host.accessCode()); }
    catch (e) {
      if (!live()) return; // cancelled or discarded: a later attempt or its result is not touched
      const code = e instanceof AskError ? e.code : 'NETWORK';
      slot.attempt = null; if (code !== 'CANCELLED') slot.error = MAP_ERROR[code] ?? ERROR_TEXT[code] ?? '지도를 정리하지 못했어요. 기록은 그대로예요.';
      host.changed(key); return;
    }
    if (!live() || a.controller.signal.aborted) return;
    a.reply = res.reply; a.model = res.model; a.phase = 'ready';
    // Still the visit it was asked from: applied now, as before. Otherwise it waits for this entry until the person comes back
    // to it and asks for it (another project, the home page or a new visit of this one is never changed or moved by it).
    if (visitOf() === a.visit && same(a, host.current())) await apply(a); else host.changed(key);
  }
  /** Applies a ready reply to the entry open now, on top of the map as it is now, and saves it. No network: the reply is the one
   * already checked against the request that was sent. Saving cannot be cancelled once begun; a failed save keeps the reply
   * ready, so trying again saves the same result (another tab's change still refuses it). */
  async function apply(a: Attempt): Promise<void> {
    const slot = of(a.key);
    if (slot.attempt !== a || a.phase !== 'ready' || !a.reply) return;
    const o = host.current();
    if (!same(a, o)) { if (o?.key === a.key) { slot.attempt = null; slot.error = MAP_ERROR.LIFECYCLE!; if (a.op) void letGo(a); host.changed(a.key); } return; }
    if (!a.inp) return;
    if (a.op) {
      // Saved before (its acknowledgement was lost), here or in another tab: its reading id and hash say so, before any other check
      // of applyReading (MAP_CHANGED comes first there). Then nothing is applied again; a different reading under that id stops it.
      const here = appliedIn(o!.project, a), saved = here ?? appliedIn(ownStored(a), a);
      if (saved === 'conflict') { slot.error = JOB_ERROR.CONFLICT!; host.changed(a.key); return; }
      if (saved === 'applied') { await forget(a, null, 'applied', here ? null : JOB_ERROR.ELSEWHERE!); return; }
      // Found again, not asked from this page: only on the very save it was asked from. A save since then (another tab, or the
      // earlier page) is never rebased onto, even when the map and records would still pass applyReading.
      if (!onItsSave(a, o!.ref?.seq ?? null)) { slot.attempt = null; slot.error = JOB_ERROR.SAVED_SINCE!; void settle(a, 'discarded'); host.changed(a.key); return; }
    }
    a.meta ??= { id: `R_${crypto.randomUUID()}`, at: new Date().toISOString() };
    let applied: Applied;
    try { applied = applyReading(o!.project, a.inp, a.reply, { ...a.meta, model: a.model, prompt: a.prompt, hash: a.hash }); }
    catch (e) {
      const code = (e as Error).message;
      slot.attempt = null; slot.error = code === 'NOTHING_READ' ? [MAP_ERROR.NOTHING_READ!, ...a.reply.gaps].join(' ') : MAP_ERROR[code] ?? '이 결과를 지도에 반영하지 못했어요. 지도와 기록은 그대로예요.';
      // A durable result that cannot go on this map as it is now is let go on the server too (never rebased or asked again).
      if (a.op) void settle(a, 'discarded');
      host.changed(a.key); return;
    }
    a.phase = 'committing'; slot.error = null; host.changed(a.key);
    const visit = visitOf();
    let failed: string | null;
    try { failed = await host.commit(applied.project); } catch { failed = '저장하지 못했어요. 바뀐 내용은 적용하지 않았어요.'; }
    if (slot.attempt !== a) return;
    if (failed) { a.phase = 'ready'; slot.error = failed; host.changed(a.key); return; }
    slot.attempt = null;
    // Saved: the job is told so. Two stores, no shared transaction: a lost acknowledgement is settled later by the reading id.
    if (a.op) void settle(a, 'applied');
    // Saved to the entry it was asked for; shown only in the visit it was applied from (a later one is left as it is).
    if (visitOf() === visit && host.current()?.key === a.key) host.done(applied);
    host.changed(a.key);
  }
  /** What one entry's reading stands at. An attempt of an earlier lifecycle of the open entry is let go here (it says so). */
  function stateOf(key: string): MapRunState {
    const slot = of(key), a = slot.attempt, o = host.current();
    if (a && a.phase !== 'committing' && o?.key === key && !same(a, o)) { a.controller.abort(); slot.attempt = null; slot.error = MAP_ERROR.LIFECYCLE!; if (a.op) void letGo(a); }
    const b = slot.attempt;
    return { pending: b && (b.phase === 'hashing' || b.phase === 'reserving' || b.phase === 'asking') ? b.controller : null, committing: b?.phase === 'committing', ready: b?.phase === 'ready', error: slot.error };
  }
  /* ---------- AF100: durable jobs ---------- */
  const NO_VISIT = Symbol('job found in storage');
  const store = () => host.jobs?.() ?? null;
  const liveOp = (a: Attempt) => of(a.key).attempt === a && !!a.op;
  /** On the save it was asked from, or on saves since then that this page made itself, each from the one before (the workspace
   * takes a save only on the save it read, so no other tab's save is among them). A new visit's fresher read is not one of them. */
  const onItsSave = (a: Attempt, seq: number | null): boolean => {
    const from = a.op!.binding.seq; if (seq === from) return true;
    if (seq === null || from === null || seq < from) return false;
    for (let k = from + 1; k <= seq; k++) if (!host.ownSave?.(a.key, k)) return false;
    return true;
  };
  /** The entry as saved now, only while it is still the job's own (the same entry, project and lifecycle). */
  const ownStored = (a: Attempt): Project | null => { const e = host.stored?.(a.key); return e && e.project.id === a.op!.binding.projectId && e.lifecycle === a.op!.binding.lifecycle ? e.project : null; };
  const appliedIn = (p: Project | null, a: Attempt): 'applied' | 'conflict' | null => {
    const r = p?.readings.find(x => isMapReading(x) && x.id === a.meta?.id); return !r ? null : isMapReading(r) && r.hash === a.hash ? 'applied' : 'conflict';
  };
  const errorText = (code: string) => JOB_ERROR[code] ?? MAP_ERROR[code] ?? ERROR_TEXT[code] ?? '지도를 정리하지 못했어요. 기록은 그대로예요.';
  /** Reserve (or reuse the entry's reservation), then send. Nothing goes when the reservation cannot be written. */
  async function runJob(a: Attempt, inp: MapInput, model: string, seq: number | null) {
    const slot = of(a.key), live = () => slot.attempt === a, jobs = store()!;
    a.phase = 'reserving'; host.changed(a.key);
    let binding: MapJobBinding, wire;
    try { wire = encodeMapInput(inp); binding = { entryId: a.key, projectId: a.project, lifecycle: a.lifecycle ?? 1, seq, after: inp.after, schemaVersion: inp.ask.schemaVersion, prompt: a.prompt, model, askHash: a.hash, inputHash: await jobHash(wire) }; }
    catch { if (live()) { slot.attempt = null; slot.error = MAP_ERROR.HASH!; host.changed(a.key); } return; }
    if (!live()) return;
    let got: { res: Reservation; reused: boolean }, release: () => void = () => {};
    try { const id = jobs.newId(); release = await jobs.hold(id); got = await jobs.reserve(binding, id); }
    catch { release(); if (live()) { slot.attempt = null; slot.error = JOB_ERROR.RESERVE!; host.changed(a.key); } return; }
    if (got.reused) { release(); if (live()) { slot.attempt = null; attach(got.res); schedule(0); } return; }
    if (!live()) { await jobs.remove(got.res.id).catch(() => {}); release(); return; } // cancelled before it left: nothing was sent
    a.op = { id: got.res.id, cap: got.res.cap, binding: got.res.binding, payload: JSON.stringify({ version: MAP_JOB_VERSION, id: got.res.id, binding: got.res.binding, input: wire }), receipt: false, state: 'reserved', cancelling: false, misses: 0, tick: 0, owned: true, release };
    a.phase = 'asking'; host.changed(a.key);
    await submit(a); schedule();
  }
  /** Sends the job, again with the same id and body while its receipt is not known; a definite refusal ends the reservation. */
  async function submit(a: Attempt): Promise<void> {
    const op = a.op!;
    for (let i = 0; i < 3 && liveOp(a) && !op.receipt; i++) {
      try { const v = await jobApi.submit(op.payload!, op.cap, host.accessCode()); op.receipt = true; await store()?.update(op.id, { receipt: true }).catch(() => {}); op.release?.(); op.release = null; await seen(a, v); return; }
      catch (e) {
        if (e instanceof JobError && e.answered) { await forget(a, errorText(e.code), null); return; }
        await new Promise(r => setTimeout(r, 200 * 2 ** i));
      }
    }
  }
  /** What the server says of a job, said for its entry. */
  async function seen(a: Attempt, v: JobView): Promise<void> {
    if (!liveOp(a)) return;
    // An answer about another job, or a reservation whose binding is not the one the job was accepted under (another entry,
    // project, lifecycle or save): nothing is loaded, applied or acknowledged for it here.
    if (!await sameJob(v, a.op!)) { if (liveOp(a)) await forget(a, JOB_ERROR.MISMATCH!, null); return; }
    if (!liveOp(a)) return;
    const op = a.op!, was = op.state; op.state = v.state; op.misses = 0;
    if (v.acked) { await forget(a, null, null); return; } // applied, discarded or seen elsewhere
    if (v.state === 'accepted' || v.state === 'running') { if (was !== v.state || of(a.key).notice === JOB_ERROR.UNREACHABLE) { of(a.key).notice = null; host.changed(a.key); } return; }
    if (v.state === 'ready') { if (a.phase === 'asking') await load(a, v); return; }
    if (v.state === 'cancelled') { await forget(a, op.cancelling ? null : '정리가 취소됐어요. 결과는 없고 기록과 지도는 그대로예요.', 'seen', op.cancelling ? JOB_NOTE.cancelled : null); return; }
    await forget(a, v.state === 'interrupted' ? JOB_ERROR.INTERRUPTED! : errorText(v.error?.code ?? 'AI_UNAVAILABLE'), 'seen');
  }
  /** The kept result, checked again here against the input reserved for it before it can be applied. */
  async function load(a: Attempt, v: JobView) {
    const op = a.op!;
    let inp: MapInput, reply: MapReply, r = v.result;
    try {
      if (!r || !v.input) throw new Error();
      inp = decodeMapInput(v.input);
      if (await jobHash(v.input) !== op.binding.inputHash || await jobHash(inp.ask) !== op.binding.askHash || r.askHash !== op.binding.askHash || r.prompt !== op.binding.prompt) throw new Error();
      if (r.evidence?.index !== SPAN_INDEX || r.evidence.ask !== textDigest(JSON.stringify(inp.ask)) || typeof r.model !== 'string') throw new Error();
      if (!/^R_[0-9a-f-]{36}$/.test(r.reading?.id ?? '') || typeof r.reading.at !== 'string' || new Date(r.reading.at).toISOString() !== r.reading.at) throw new Error();
      reply = validateMapReply(r.wire, inp.ask);
    } catch { if (liveOp(a)) await forget(a, JOB_ERROR.MISMATCH!, 'discarded'); return; }
    if (!liveOp(a) || a.phase !== 'asking') return;
    Object.assign(a, { inp, reply, model: r.model, prompt: op.binding.prompt, hash: op.binding.askHash, meta: { id: r.reading.id, at: r.reading.at }, phase: 'ready' });
    // Its save landed but the acknowledgement did not: settled without applying anything again.
    const saved = appliedIn(ownStored(a), a);
    if (saved === 'applied') { await forget(a, null, 'applied'); return; }
    if (visitOf() === a.visit && same(a, host.current())) await apply(a); else host.changed(a.key);
  }
  /** Ends this page's hold on a job: acknowledges it when asked (outcome), forgets the reservation once that is done. */
  async function forget(a: Attempt, error: string | null, outcome: 'applied' | 'discarded' | 'seen' | null, notice: string | null = null) {
    const slot = of(a.key);
    if (slot.attempt === a) { slot.attempt = null; slot.error = error; slot.notice = notice; host.changed(a.key); }
    if (outcome) await settle(a, outcome); else await store()?.remove(a.op!.id).catch(() => {});
    a.op!.release?.(); a.op!.release = null;
  }
  /** Reservations this page is acknowledging now: not shown again meanwhile (a failed acknowledgement is tried again later). */
  const closing = new Set<string>();
  /** Tells the job how it ended here. True once that is kept somewhere: the intent in this address's storage (tried again from there)
   * or the server's acknowledgement. False when neither took it: nothing is said to be done then. */
  async function settle(a: Attempt, outcome: 'applied' | 'discarded' | 'seen'): Promise<boolean> {
    const op = a.op!; closing.add(op.id);
    try {
      // The intent is kept first: a lost acknowledgement is tried again, and the result is never shown again meanwhile.
      const noted = await (store()?.update(op.id, outcome === 'applied' ? (a.meta ? { applied: a.meta.id } : {}) : { outcome }) ?? Promise.reject()).then(() => true, () => false);
      try { await jobApi.ack(op.id, op.cap, host.accessCode(), outcome); }
      catch (e) { if (!(e instanceof JobError && e.answered && ['OPERATION_NOT_FOUND', 'OPERATION_DAMAGED', 'OPERATION_CONFLICT'].includes(e.code))) return noted; } // kept: tried again later
      await store()?.remove(op.id).catch(() => {});
      return true;
    } finally { closing.delete(op.id); }
  }
  /** The person lets a kept result go: held (no apply, no new reading) until that is kept locally or by the server; when neither
   * takes it, the result stays ready and says so, to be let go again. */
  async function discardJob(a: Attempt) {
    const slot = of(a.key); a.phase = 'closing'; slot.error = null; slot.notice = null; host.changed(a.key);
    const kept = await settle(a, 'discarded');
    if (slot.attempt !== a) return;
    if (kept) slot.attempt = null; else { a.phase = 'ready'; slot.error = JOB_ERROR.DISCARD_FAILED!; }
    host.changed(a.key);
  }
  /** A reservation whose reading is saved (the acknowledgement owed): acknowledged quietly, never shown as a reading again. */
  async function owed(r: Reservation) {
    if (closing.has(r.id)) return; closing.add(r.id);
    try {
      if (r.outcome && !r.applied) {
        // Let go or seen here before: only that acknowledgement is owed (to this very job).
        let v: JobView; try { v = await jobApi.get(r.id, r.cap, host.accessCode()); }
        catch (e) { if (e instanceof JobError && e.answered && ['OPERATION_NOT_FOUND', 'OPERATION_DAMAGED'].includes(e.code)) await store()?.remove(r.id).catch(() => {}); return; }
        if (!await sameJob(v, r)) { await store()?.remove(r.id).catch(() => {}); return; }
        try { if (!v.acked) await jobApi.ack(r.id, r.cap, host.accessCode(), r.outcome); }
        catch (e) { if (!(e instanceof JobError && e.answered && ['OPERATION_CONFLICT', 'OPERATION_STATE'].includes(e.code))) return; }
        await store()?.remove(r.id).catch(() => {}); return;
      }
      // Acknowledged as applied only when the server's job is this reservation's, its result carries that reading id, and the
      // entry as saved (the job's own entry, project and lifecycle) holds that reading with the job's hash. Otherwise the note is
      // dropped and the job is looked at as any other.
      let v: JobView; try { v = await jobApi.get(r.id, r.cap, host.accessCode()); } catch { return; }
      if (!await sameJob(v, r)) { await store()?.update(r.id, { applied: null }).catch(() => {}); return; }
      if (!v.acked) {
        const e = host.stored?.(r.binding.entryId), hit = e && e.project.id === r.binding.projectId && e.lifecycle === r.binding.lifecycle
          ? e.project.readings.find(x => isMapReading(x) && x.id === r.applied) : null;
        if (v.state !== 'ready' || v.result?.reading?.id !== r.applied || !hit || !isMapReading(hit) || hit.hash !== r.binding.askHash) { await store()?.update(r.id, { applied: null }).catch(() => {}); return; }
      }
      try { if (!v.acked) await jobApi.ack(r.id, r.cap, host.accessCode(), 'applied'); }
      catch (e) { if (!(e instanceof JobError && e.answered && ['OPERATION_NOT_FOUND', 'OPERATION_DAMAGED', 'OPERATION_CONFLICT', 'OPERATION_STATE'].includes(e.code))) return; }
      await store()?.remove(r.id).catch(() => {});
    } finally { closing.delete(r.id); }
  }
  /** A job of an earlier lifecycle of its entry (trashed and restored meanwhile): stopped or let go on the server. */
  async function letGo(a: Attempt) {
    const op = a.op!;
    try { const v = op.state === 'ready' ? null : await jobApi.cancel(op.id, op.cap, host.accessCode()); await settle(a, v?.state === 'ready' || !v ? 'discarded' : 'seen'); } catch { /* kept for later */ }
  }
  /** A reservation found in storage, shown as its entry's reading until the server says what it is. */
  function attach(r: Reservation) {
    const slot = of(r.binding.entryId);
    slot.attempt = { key: r.binding.entryId, project: r.binding.projectId, lifecycle: r.binding.lifecycle, visit: NO_VISIT, phase: 'asking', controller: new AbortController(), inp: null,
      prompt: r.binding.prompt, hash: r.binding.askHash, reply: null, model: '', meta: null,
      op: { id: r.id, cap: r.cap, binding: r.binding, payload: null, receipt: r.receipt, state: 'unknown', cancelling: false, misses: 0, tick: 0, owned: false, release: null } };
    slot.error = null; slot.notice = null; host.changed(r.binding.entryId);
  }
  async function poll(a: Attempt) {
    const op = a.op!;
    try { await seen(a, await jobApi.get(op.id, op.cap, host.accessCode())); }
    catch (e) {
      if (!liveOp(a)) return;
      if (e instanceof JobError && e.answered) {
        if (e.code === 'OPERATION_ACCEPTING') return;
        if (e.code === 'OPERATION_NOT_FOUND') {
          // Not found: sent again with the same id and body while this page still has it. Otherwise it is closed for good before
          // the reservation goes: a cancel under the same capability is recorded first, so a submission still on its way can never
          // start later (if it did arrive meanwhile, it is cancelled, or its result is kept, as the server answers).
          if (!op.receipt && op.payload) { await submit(a); return; }
          // Only once the page sending it is gone (its hold is free): a page still sending it is waited for.
          const closed = await store()?.orphan(op.id, async () => { try { return await jobApi.cancel(op.id, op.cap, host.accessCode()); } catch { return null; } });
          if (closed === undefined) return;
          if (closed === null) { if (++op.misses === 3) { of(a.key).notice = JOB_ERROR.UNREACHABLE!; host.changed(a.key); } return; }
          const v: JobView = closed;
          if (v.state === 'cancelled' && v.remote === 'not-sent') { await forget(a, op.receipt ? JOB_ERROR.GONE! : JOB_ERROR.NOT_ACCEPTED!, 'seen'); return; }
          await seen(a, v); return;
        }
        if (e.code === 'OPERATION_DAMAGED') { await forget(a, JOB_ERROR.OPERATION_DAMAGED!, null); return; }
      }
      if (++op.misses === 3) { of(a.key).notice = JOB_ERROR.UNREACHABLE!; host.changed(a.key); }
    }
  }
  let timer: ReturnType<typeof setTimeout> | null = null, syncing = false, disposed = false;
  function schedule(ms = host.pollMs ?? 1500) { if (timer === null && !disposed && durable()) timer = setTimeout(() => { timer = null; void sync(); }, ms); }
  /** Every reservation of this address is its entry's reading; running ones are looked at, ready ones now and then (another tab
   * may apply or discard them). A look never costs a call to the AI service. */
  async function sync() {
    if (syncing || disposed) return; syncing = true;
    let more = false;
    try {
      const jobs = store(); let list: Reservation[] = [];
      try { list = jobs?.list() ?? []; } catch { list = []; }
      const owing = list.filter(r => (r.applied || r.outcome) && !closing.has(r.id));
      for (const r of list) if (!r.applied && !r.outcome && !closing.has(r.id) && !of(r.binding.entryId).attempt) attach(r);
      const watched = [...slots.values()].map(x => x.attempt).filter((a): a is Attempt => !!a?.op && (a.phase === 'asking' || a.phase === 'ready'));
      more = watched.length > 0 || owing.length > 0;
      await Promise.all(owing.map(owed));
      await Promise.all(watched.map(a => a.phase === 'asking' || ++a.op!.tick % 4 === 0 ? poll(a) : null));
    } finally { syncing = false; if (more) schedule(); }
  }
  /** After the server's status is known: jobs kept from earlier (a reload, another tab) come back to their entries. */
  function resume() {
    if (durable()) { schedule(0); return; }
    let list: Reservation[] = []; try { list = store()?.list() ?? []; } catch { list = []; }
    for (const r of list) { const slot = of(r.binding.entryId); if (!slot.attempt && !slot.error) { slot.error = JOB_ERROR.UNAVAILABLE!; host.changed(r.binding.entryId); } }
  }
  async function cancelJob(a: Attempt) {
    const op = a.op!; if (op.cancelling) return;
    op.cancelling = true; host.changed(a.key);
    try { await seen(a, await jobApi.cancel(op.id, op.cap, host.accessCode())); }
    catch { op.cancelling = false; if (liveOp(a)) { of(a.key).error = JOB_ERROR.CANCEL_UNCONFIRMED!; host.changed(a.key); } }
  }
  const openSlot = () => { const o = host.current(); return o ? of(o.key) : null; };
  const openKey = () => host.current()?.key ?? '';
  return {
    input, can, blocked, run, runMapOnly: () => run(undefined, true), resume,
    /** The page is going: nothing more is looked at or sent from it (its jobs stay with the server and the reservations). */
    dispose: () => { disposed = true; if (timer !== null) clearTimeout(timer); timer = null; for (const slot of slots.values()) { slot.attempt?.op?.release?.(); slot.attempt = null; } },
    /** AF100: what the person is told beside the state: the reading continues without this window, cancelling, a notice. */
    detail: (key?: string): { durable: boolean; cancelling: boolean; notice: string | null } => {
      const k = key ?? host.current()?.key; const slot = k ? of(k) : null, a = slot?.attempt;
      return { durable: !!a?.op || (!!a && a.phase !== 'ready' && a.phase !== 'committing' && durable()), cancelling: !!a?.op?.cancelling, notice: slot?.notice ?? null };
    },
    /** The ready reply of the entry open now, applied (a second click while it is applied does nothing). */
    applyReady: (): Promise<void> => { const a = openSlot()?.attempt; return a ? apply(a) : Promise.resolve(); },
    state: (): MapRunState => { const o = host.current(); return o ? stateOf(o.key) : { pending: null, committing: false, ready: false, error: null }; },
    stateOf,
    /** Cancels a request still on its way; once saving has begun there is nothing to cancel. */
    cancel: () => {
      const s = openSlot(), a = s?.attempt; if (!s || !a || (a.phase !== 'hashing' && a.phase !== 'reserving' && a.phase !== 'asking')) return;
      // A job: its cancel is recorded by the server first; only then is it called off (a reply ready before that is kept).
      if (a.op) { void cancelJob(a); return; }
      a.controller.abort(); s.attempt = null; host.changed(openKey());
    },
    /** Lets a ready reply go unapplied (nothing is saved). A job's result is let go on the server too. */
    discard: () => { const s = openSlot(), a = s?.attempt; if (!s || !a || a.phase !== 'ready') return; if (a.op) { void discardJob(a); return; } s.attempt = null; s.error = null; s.notice = null; host.changed(openKey()); },
    clearError: () => { const s = openSlot(); if (s) { s.error = null; s.notice = null; } },
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
