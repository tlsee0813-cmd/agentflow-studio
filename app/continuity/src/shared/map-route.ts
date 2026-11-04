/* Which way one map reading goes: the one decision the browser (src/client/map-run.ts) and the PC server (server/studio.mjs,
 * server/map-pipeline.mjs) both make, so a job is bound to the very recipe and model the server will run it with (a mismatch is
 * PROMPT_CHANGED). Nothing here sends, stores or retries anything.
 *   divided-first  studio.map.6 with no part, request or prior: the PC's divided pipeline (first-map recipe)
 *   divided-later  studio.map.7 (always a later reading): the PC's divided pipeline (later-map recipe)
 *   single         everything else, and every ask on a host that offers no divided pipeline (the Worker, a PC without the
 *                  OpenAI settings, a preview executor): one DeepSeek call (or the executor's one run) under the schema's recipe
 * The shape rule alone (dividedKind) decides the divided family; whether the host offers it comes from its advertised status. */
import { MAP6_SCHEMA, MAP7_SCHEMA, MAP_BYTES, MAP_RECORDS, MAP_RECORD_CHARS, MAP_FIRST_BYTES, MAP_FIRST_RECORDS, MAP_FIRST_RECORD_CHARS, MAP_FIRST_SPANS, firstAsk, recordPartial, type MapAsk, type MapInput } from './map-reading.js';
import { SPANS_PER_RECORD } from './evidence-span.js';

/** Defaults of the PC's divided pipeline (createFirstMapPipeline): partition core text, partition count, workers per stage. A
 * server that advertises its own values (status map.first/later partitions, partitionChars) is read instead. */
export const DIVIDED_PARTITION_CHARS = 3500;
export const DIVIDED_PARTITIONS = 12;
/** Recipe .47: a divided first map reads up to 24 partitions (a whole folded v5 record: the 8 measured ones cut into 14–22), a later map 12. */
export const DIVIDED_FIRST_PARTITIONS = 24;
export const DIVIDED_PARALLEL = 2;
/** The DeepSeek calls a divided reading is assumed to make at most when a server does not say its own number: the largest batch a
 * PC host can be configured with (12 extractions, and rendering on DeepSeek with one semantic rewrite and one format correction).
 * Pipeline .31: 64 (twelve render fragments of a 36-part first map: 12 + 12 x 2 x 2 + the global stages 2 x 2 on DeepSeek).
 * Recipe .47: 76 (a first map's 24 extractions + 12 x 2 x 2 + 2 x 2). */
export const DEEPSEEK_CALLS_UNSTATED = 76;

export type MapRouteName = 'divided-first' | 'divided-later' | 'single';
/** Why a route was chosen: a first map or later reading of the divided pipeline; a host offering no divided pipeline for this kind;
 * an ask whose schema or shape the divided pipeline never takes (a later studio.map.6 from a tab without the m7 recipe, map.1–5). */
export type MapRouteReason = 'first-map' | 'later-map' | 'no-divided' | 'not-divided-schema';
/** What a PC server advertises for one divided family (status map.first / map.later). */
export interface DividedOffer { model: string; prompt: string; ready: boolean; method: 'divided'; monthlyUsd: number; runUsd: number;
  deepseekMaxCalls?: number; partitions?: number; partitionChars?: number }
/** What a server advertises for map readings (status map): the single-call model and recipes, and its divided families if any. */
export interface MapRouteOffer { model: string; prompt: string; laterPrompt?: string; first?: DividedOffer; later?: DividedOffer }
export interface MapRouteLimits {
  /** Records per ask, characters per record excerpt, bytes of the whole ask (shared/map-reading.ts); recipe .47: pieces per record. */
  records: number; recordChars: number; bytes: number; spans?: number;
  /** Divided only: partitions of at most partitionChars core characters, DeepSeek call bound, OpenAI USD caps, workers per stage. */
  partitions?: number; partitionChars?: number; deepseekMaxCalls?: number; runUsd?: number; monthlyUsd?: number; parallel?: number;
}
export interface MapRoute {
  route: MapRouteName; schema: MapAsk['schemaVersion']; promptId: string; model: string;
  /** false: the host offers this divided family but cannot run it now (no key, no durable store); nothing is sent. */
  ready: boolean; limits: MapRouteLimits; reason: MapRouteReason;
}

/** A first map: studio.map.6 with nothing of the map, no request and no prior (the divided first-map pipeline's scope). */
export const isFirstMap = (ask: unknown): boolean => {
  const a = ask as Partial<MapAsk> | null | undefined;
  return a?.schemaVersion === MAP6_SCHEMA && Array.isArray(a.parts) && firstAsk(a as MapAsk);
};
/** The divided family an ask belongs to by its shape alone, or null (it is never read by the divided pipeline). */
export function dividedKind(ask: unknown): 'first' | 'later' | null {
  if (isFirstMap(ask)) return 'first';
  return (ask as Partial<MapAsk> | null | undefined)?.schemaVersion === MAP7_SCHEMA ? 'later' : null;
}

/** The divided family offer that reads this ask on a host advertising `offer`, or null (it goes the single way). */
export function dividedOfferOf(ask: unknown, offer: Pick<MapRouteOffer, 'first' | 'later'>): DividedOffer | null {
  const kind = dividedKind(ask);
  return kind ? offer[kind] ?? null : null;
}

const BASE: MapRouteLimits = { records: MAP_RECORDS, recordChars: MAP_RECORD_CHARS, bytes: MAP_BYTES };
/** Recipe .47: the divided first-map route's ask bounds (a whole folded v5 record; shared/map-reading.ts askLimits). Every other route BASE. */
const FIRST: MapRouteLimits = { records: MAP_FIRST_RECORDS, recordChars: MAP_FIRST_RECORD_CHARS, bytes: MAP_FIRST_BYTES, spans: MAP_FIRST_SPANS };
const count = (n: unknown, max: number): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= max;

/** The route of one ask on a server advertising `offer`, or null when that server names no recipe for it (a map.7 ask to a server
 * without the later m7 recipe: nothing can be bound, so nothing is sent). */
export function mapRoute(ask: Pick<MapAsk, 'schemaVersion' | 'parts' | 'requests' | 'priors'>, offer: MapRouteOffer): MapRoute | null {
  const kind = dividedKind(ask), divided = dividedOfferOf(ask, offer);
  if (kind && divided) return {
    route: kind === 'first' ? 'divided-first' : 'divided-later', schema: ask.schemaVersion, promptId: divided.prompt, model: divided.model, ready: divided.ready,
    limits: { ...(kind === 'first' ? FIRST : BASE), partitions: count(divided.partitions, 64) ? divided.partitions : kind === 'first' ? DIVIDED_FIRST_PARTITIONS : DIVIDED_PARTITIONS,
      partitionChars: count(divided.partitionChars, 100000) ? divided.partitionChars : DIVIDED_PARTITION_CHARS,
      deepseekMaxCalls: count(divided.deepseekMaxCalls, 1000) ? divided.deepseekMaxCalls : DEEPSEEK_CALLS_UNSTATED,
      runUsd: divided.runUsd, monthlyUsd: divided.monthlyUsd, parallel: DIVIDED_PARALLEL },
    reason: kind === 'first' ? 'first-map' : 'later-map'
  };
  const promptId = ask.schemaVersion === MAP7_SCHEMA ? offer.laterPrompt : offer.prompt;
  if (!promptId) return null;
  return { route: 'single', schema: ask.schemaVersion, promptId, model: offer.model, ready: true, limits: { ...BASE }, reason: kind ? 'no-divided' : 'not-divided-schema' };
}

/** The partitions a divided reading cuts its records into: consecutive whole spans (in record order) whose core text stays within
 * targetChars, a new partition starting where the next span would pass it. Indices into sizes. server/map-partition.mjs plans the
 * real partitions with this same grouping; the browser counts with it before sending. */
export function partitionGroups(sizes: readonly number[], targetChars: number): number[][] {
  const groups: number[][] = []; let group: number[] = [], size = 0;
  sizes.forEach((n, i) => {
    if (group.length && size + n > targetChars) { groups.push(group); group = []; size = 0; }
    group.push(i); size += n;
  });
  if (group.length) groups.push(group);
  return groups;
}
const spanSizes = (records: MapAsk['records']) => records.flatMap(r => (r.spans ?? []).map(s => s.t.length));
/** How many partitions the divided pipeline would cut this ask's records into. */
export const partitionCount = (ask: Pick<MapAsk, 'records'>, targetChars: number): number => partitionGroups(spanSizes(ask.records), targetChars).length;

/** A divided route reads at most limits.partitions partitions; more is refused whole (MAP_PARTITION_LIMIT) after the job is
 * accepted, and the very same ask would be refused again every time. So the records that would not fit are left for the next
 * reading before anything is hashed or sent: whole records from the end (the oldest of the newest-first selection), never part
 * of one, at least one kept. The records left read as "다음에" (coverage.sent drops); what does go is the built excerpt as is.
 * Single routes, inputs with a problem and asks that fit come back unchanged (the very same object). */
export function fitMapInput(inp: MapInput, route: MapRoute | null): MapInput {
  const max = route?.limits.partitions, room = route?.limits.partitionChars;
  if (!route || route.route === 'single' || inp.problem || !max || !room) return inp;
  if (partitionCount(inp.ask, room) <= max || inp.ask.records.length <= 1) return inp;
  const ask: MapAsk = { ...inp.ask, records: [...inp.ask.records] }, records = new Map(inp.records);
  while (ask.records.length > 1 && partitionCount(ask, room) > max) records.delete(ask.records.pop()!.id);
  const partial = [...records.values()].filter(recordPartial).length;
  return { ...inp, ask, records, coverage: { fresh: inp.coverage.fresh, sent: ask.records.length, partial } };
}

/** Recipe .47: an ask within its route's bounds (a single route never takes more than the shared bounds, whatever its shape). */
export function withinRoute(ask: MapAsk, route: MapRoute): boolean {
  const l = route.limits, b = new TextEncoder().encode(JSON.stringify(ask)).length;
  return b <= l.bytes && ask.records.length <= l.records && ask.records.every(r => (r.spans?.length ?? 0) <= (l.spans ?? SPANS_PER_RECORD) && [r.lead ?? '', ...(r.spans ?? []).map(x => x.t)].join('').length <= l.recordChars);
}

/* ---------- what the person is told (Korean UI copy, derived from the route) ---------- */
const chars = (n: number) => n.toLocaleString('ko-KR');
/** The lines said before a reading starts: how this reading is batched and what bounds it. */
export function mapBatchLines(route: MapRoute | null): string[] {
  if (!route) return [];
  const l = route.limits;
  if (route.route === 'single') return [route.reason === 'no-divided'
    ? `기록을 AI 요청 한 번으로 읽어요. 한 번에 기록 최대 ${l.records}개(기록마다 ${chars(l.recordChars)}자까지)를 보내고 남은 기록은 다음 정리에서 읽어요. 구간별로 나눠 읽는 정리는 OpenAI 설정을 둔 PC 실행기에서만 해요.`
    : `이 요청 형식은 나눠 읽지 않고 AI 요청 한 번으로 읽어요. 한 번에 기록 최대 ${l.records}개(기록마다 ${chars(l.recordChars)}자까지)를 보내요.`];
  return [
    `근거 찾기, 전체 조건 대조, 부분별 정리를 나눠 진행해요. 한 번에 기록 최대 ${l.records}개를 최대 ${l.partitions}구간(구간당 ${chars(l.partitionChars!)}자 안팎)으로 나눠 동시에 ${l.parallel}개씩 읽어요.${route.route === 'divided-later' ? ' 기존 지도와 직접 고친 내용도 함께 확인해요.' : ''} 끝난 단계는 PC에 보관해 같은 작업에서 다시 처리하지 않아요.`,
    `OpenAI 사용 상한: 정리당 $${l.runUsd}, 월 $${l.monthlyUsd}. DeepSeek 요금은 별도이며 교정을 포함해 정리당 최대 ${l.deepseekMaxCalls}회로 제한돼요.`
  ];
}
/** What a running reading says until the server reports a stage. */
export function mapPendingText(route: MapRouteName | null): string {
  return route === 'divided-first' || route === 'divided-later' ? '구간별 근거를 읽고 전체 조건을 대조해 지도를 합치는 중…' : '기록을 읽고 지도를 정리하는 중…';
}
/** The route a bound reading went (a job found again after a reload has its binding's recipe, not its input). */
export function routeOfPrompt(prompt: string, offer: MapRouteOffer | null | undefined): MapRouteName | null {
  if (!offer) return null;
  return offer.first?.prompt === prompt ? 'divided-first' : offer.later?.prompt === prompt ? 'divided-later' : prompt === offer.prompt || prompt === offer.laterPrompt ? 'single' : null;
}
