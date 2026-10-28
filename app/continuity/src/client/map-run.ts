/* Reading records into the map (studio.map.1), for one workspace entry at a time. Sends only when the person asks, never the very
 * same request twice, and applies a reply only to the entry it was asked for, on top of the map it was asked about: a reply that
 * comes back after another reading was applied, or after a part it names has gone, is not applied. Saving is the host's
 * (commit): until it succeeds nothing is said to be done, and the records and drafts stay as they were. */
import { isMapReading, type MapReading, type Project } from '../shared/types.js';
import type { StudioView } from '../shared/studio.js';
import { buildMapAsk, applyReading, type MapInput, type Applied } from '../shared/map-reading.js';
import { askMap, AskError, ERROR_TEXT, type AiStatus } from './studio-api.js';
/** SHA-256 of the request's JSON: the very same request is never sent or applied twice. */
async function askHash(ask: unknown): Promise<string> {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(ask)));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

export interface MapRunHost {
  current(): { key: string; kind: string; project: Project; view: StudioView } | null;
  status(): AiStatus;
  accessCode(): string;
  /** Saves the project for the entry now open; text when it was not saved (nothing is applied then). */
  commit(next: Project): Promise<string | null>;
  /** A reading was applied and saved. */
  done(applied: Applied): void;
  /** Anything to show changed (pending, error). */
  changed(): void;
}
export interface MapRunState { pending: AbortController | null; error: string | null }
const MAP_ERROR: Record<string, string> = {
  MAP_CHANGED: '정리하는 동안 지도가 바뀌어(다른 정리가 반영되었거나 부분이 보관됨) 이번 결과는 반영하지 않았어요. 다시 정리해 주세요.',
  ALREADY_APPLIED: '같은 기록은 이미 지도에 정리했어요.',
  READINGS_FULL: '이 프로젝트에 더 정리할 수 없어요(정리 기록 한도).',
  INVALID_RESPONSE: 'AI 응답이 근거 규칙(원문 인용·알려진 부분)에 맞지 않아 반영하지 않았어요.'
};

export function createMapRun(host: MapRunHost) {
  const states = new Map<string, MapRunState>();
  const of = (key: string) => { let s = states.get(key); if (!s) { s = { pending: null, error: null }; states.set(key, s); } return s; };
  /** What a reading would send now (nothing is sent). */
  function input(): MapInput | null { const o = host.current(); return o && o.kind === 'saved' ? buildMapAsk(o.project, o.view) : null; }
  function can(): boolean { const st = host.status(); return st.ai === 'deepseek' && !!st.map; }
  async function run() {
    const o = host.current(); if (!o || o.kind !== 'saved') return;
    const key = o.key, state = of(key); if (state.pending) return;
    const st = host.status(), inp = buildMapAsk(o.project, o.view);
    if (!st.map || st.ai !== 'deepseek') return;
    if (inp.problem) { state.error = inp.problem === 'NOTHING_NEW' ? '새로 읽을 기록이 없어요.' : inp.problem === 'TOO_LARGE' ? '지도가 커서 한 번에 보낼 수 없어요.' : '키나 토큰처럼 보이는 글이 있는 기록이 있어 보내지 않았어요.'; host.changed(); return; }
    const hash = await askHash(inp.ask);
    if (o.project.readings.some(r => isMapReading(r) && r.hash === hash)) { state.error = MAP_ERROR.ALREADY_APPLIED!; host.changed(); return; }
    const controller = new AbortController(); state.pending = controller; state.error = null; host.changed();
    try {
      const res = await askMap(inp.ask, controller.signal, host.accessCode());
      const now = host.current();
      if (!now || now.key !== key) { state.error = '다른 프로젝트로 옮겨 이번 결과는 반영하지 않았어요. 돌아와서 다시 정리해 주세요.'; return; }
      let applied: Applied;
      try { applied = applyReading(now.project, inp, res.reply, { id: `R_${crypto.randomUUID()}`, at: new Date().toISOString(), model: res.model, prompt: st.map.prompt, hash }); }
      catch (e) { state.error = MAP_ERROR[(e as Error).message] ?? '이 결과를 지도에 반영하지 못했어요. 지도와 기록은 그대로예요.'; return; }
      const failed = await host.commit(applied.project);
      if (failed) { state.error = failed; return; }
      host.done(applied);
    } catch (e) {
      const code = e instanceof AskError ? e.code : 'NETWORK';
      if (code !== 'CANCELLED') state.error = MAP_ERROR[code] ?? ERROR_TEXT[code] ?? '지도를 정리하지 못했어요. 기록은 그대로예요.';
    } finally { state.pending = null; host.changed(); }
  }
  return {
    input, can, run,
    state: (): MapRunState => { const o = host.current(); return o ? of(o.key) : { pending: null, error: null }; },
    cancel: () => { const o = host.current(); if (o) of(o.key).pending?.abort(); },
    clearError: () => { const o = host.current(); if (o) of(o.key).error = null; },
    last: (): MapReading | null => { const o = host.current(); return o ? (o.project.readings.filter(isMapReading).at(-1) ?? null) : null; }
  };
}
export type MapRun = ReturnType<typeof createMapRun>;
/** What a request would send, said before it is sent. */
export function sendLine(inp: MapInput): string {
  const c = inp.coverage, left = c.fresh - c.sent;
  return [`기록 ${c.sent}개를 AI에 보내요`, c.partial ? `${c.partial}개는 앞부분만` : '', left > 0 ? `${left}개는 다음에` : ''].filter(Boolean).join(' · ');
}
