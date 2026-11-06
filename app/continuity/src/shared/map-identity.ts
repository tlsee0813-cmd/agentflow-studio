/* Recipe .50 step 5 (기록 요청 v5.2, Astra F5 Q1–Q3, Q6, Q7(5)): the map's roster in the record ask, and the record's own C-IDENT table read
 * by the program alone.
 * - The roster: every current part of the map by its stable P number (its place among the project's areas, which are archived, never
 *   deleted, so a number never moves), official name, parent, lifecycle and a short distinguisher, with the project, the map revision (how
 *   many map readings it rests on) and a hash; past ROSTER_CHARS it says it is partial and which P IDs it holds.
 * - C-IDENT: | 행 ID | 지도 부분(Pxx) | 대응 | 이 기록 부분(Bxx) | 바뀐 때 | 근거 |, 대응 같음 / 이름 바뀜 / 대신함 / 없어짐 / 모름. The reply copies
 *   the roster line; a map changed since holds only the rows whose part it changed. A row without an F or E cite is a candidate only (held).
 * - Operations, each by evidence only, never by a name: bind (the B row is that part: the ask's partRows and the apply redirect), rename (same
 *   part, the official name updated, the old one kept; a name the person gave stays shown), retire (대신함 with its successor, 없어짐 without;
 *   in effect and whole only: a planned or partial change retires nothing; the predecessor keeps its id, its relations stay where they are)
 *   and fold (two parts the map made for one B row: the later is folded onto the earlier, whose id its references resolve to). 나뉨 and 합침
 *   are kept as written and unsupported in .50.
 * Nothing here calls a model; nothing here writes a project (applyReading applies what decideIdentity says). */
import { isMapReading, type Project, type ReadingIdentityRow, type ReadingIdentityOp, type IdentityAnswer } from './types.js';
import { fixedWord, type FoldRow } from './record-table.js';
import type { V5Fold } from './record-excerpt.js';
import { ledgerKey, IDENT_TABLE_ID } from './row-ledger.js';
import { partUnderstanding, unstampRole, likeNames, normName } from './map-reading.js';
import { sha256 } from './validation.js';
import { secretLike } from './secret.js';
import type { StudioView, PartView, RelationView } from './studio.js';

/** Review of .50 (map-roster.2): a partial roster's copied line says how far it lists; the decisions need in-effect evidence, real evidence,
 * the hash of a map no reading changed since, and never fold two rows of one record. */
export const ROSTER_VERSION = 'map-roster.2';
/** The roster block's bound in characters (the v5.1 request is about 11,000), a name's and a distinguisher's, and the detail lines'. */
export const ROSTER_CHARS = 8000, ROSTER_NAME_CHARS = 60, ROSTER_NOTE_CHARS = 60, ROSTER_DETAIL_CHARS = 2000;
/** A reading keeps up to 256 C-IDENT row decisions. */
export const IDENTITY_ROWS_MAX = 256;
const pad = (n: number) => String(n).padStart(2, '0');
const one = (s: string, n: number) => { const t = s.replace(/\s+/g, ' ').replace(/\|/g, '/').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

/* ---------- stable P numbers ---------- */
/** A part's P number: its place among the project's areas (P01 the first), archived ones counted, so it never changes. */
export const partNumber = (p: Pick<Project, 'space'>, areaId: string): string | null => { const i = p.space.areas.findIndex(a => a.id === areaId); return i < 0 ? null : `P${pad(i + 1)}`; };
/** The area a P number names, or null. */
export function areaOfNumber(p: Pick<Project, 'space'>, pid: string): string | null {
  const m = /^P(\d{2,3})$/.exec(pid.trim()); if (!m) return null;
  return p.space.areas[Number(m[1]) - 1]?.id ?? null;
}

/* ---------- what the identity operations made of the map ---------- */
export interface IdentityState {
  /** The name each part a reading made was made with. */
  created: Map<string, string>;
  /** Each part's renames, oldest first (from, to, the reading, its time, the record the row stood in). */
  renames: Map<string, { from: string; to: string; reading: string; at: string; record: string }[]>;
  /** The parts retired by a record's C-IDENT row, with the successor (null: none), 바뀐 때 and the reading. */
  retired: Map<string, { successor: string | null; when: string | null; reading: string; at: string; record: string; row: string }>;
  /** A folded duplicate → the canonical part it is. */
  folded: Map<string, string>;
}
const stateCache = new WeakMap<object, IdentityState>();
export function identityState(p: Pick<Project, 'readings'>): IdentityState {
  const hit = stateCache.get(p.readings); if (hit) return hit;
  const s: IdentityState = { created: new Map(), renames: new Map(), retired: new Map(), folded: new Map() };
  for (const r of p.readings) {
    if (!isMapReading(r)) continue;
    for (const x of r.parts) if (x.created && !s.created.has(x.areaId)) s.created.set(x.areaId, x.created.name);
    for (const x of r.identity ?? []) {
      const op = x.op; if (!op) continue;
      if (op.kind === 'rename' && op.from && op.to) s.renames.set(op.areaId, [...s.renames.get(op.areaId) ?? [], { from: op.from, to: op.to, reading: r.id, at: r.at, record: x.record }]);
      if (op.kind === 'retire') s.retired.set(op.areaId, { successor: op.successor, when: x.when, reading: r.id, at: r.at, record: x.record, row: x.id });
      if (op.kind === 'fold' && op.into) s.folded.set(op.areaId, op.into);
    }
  }
  stateCache.set(p.readings, s);
  return s;
}
/** A part as it resolves: a folded duplicate's canonical part (through any chain), else itself. */
export function canonicalPart(s: IdentityState, id: string): string {
  let at = id; for (let g = 0; g < 16 && s.folded.has(at); g++) at = s.folded.get(at)!;
  return at;
}
/** The part's official name: its last rename, else the name a reading made it with, else its own (a part the person made). */
export function officialName(p: Pick<Project, 'readings' | 'space'>, areaId: string): string {
  const s = identityState(p);
  return s.renames.get(areaId)?.at(-1)?.to ?? s.created.get(areaId) ?? p.space.areas.find(a => a.id === areaId)?.name ?? '';
}
/** The part's earlier official names (oldest first, each once), with when a reading renamed it and the record that said so. */
export function partAliases(p: Pick<Project, 'readings' | 'space'>, areaId: string): { name: string; at: string; record: string }[] {
  const out: { name: string; at: string; record: string }[] = [], now = normName(officialName(p, areaId));
  for (const x of identityState(p).renames.get(areaId) ?? []) if (normName(x.from) !== now && !out.some(y => normName(y.name) === normName(x.from))) out.push({ name: x.from, at: x.at, record: x.record });
  return out;
}

/* ---------- the roster ---------- */
export interface RosterEntry { pid: string; areaId: string; name: string; parent: string | null; life: string; note: string; old: string[]; folded: string[]; detail: string | null }
export interface MapRoster { version: typeof ROSTER_VERSION; projectId: string; revision: number; hash: string; count: number; entries: RosterEntry[];
  /** How many entries the text lists (the first ones) and whether that is all of them. */
  shown: number; scope: 'full' | 'partial'; head: string; text: string }
const LIFE: Readonly<Record<string, string>> = { running: '실행 중', unbuilt: '미구현', stopped: '정지', retired: '없어짐' };
/** The map's roster as a record ask carries it (null when the project has no live part): every live part that is no folded duplicate, by P
 * number, with detail (role, files, old names) for the parts in `detail` within ROSTER_DETAIL_CHARS. Shortened in fixed steps until it fits
 * `max`: the detail left out, distinguishers cut to 30, then left out; then only the first parts are listed and the text says so. */
export function mapRoster(p: Project, opts: { detail?: readonly string[]; max?: number } = {}): MapRoster | null {
  const s = identityState(p), max = opts.max ?? ROSTER_CHARS;
  const live = p.space.areas.filter(a => !a.archived && !s.folded.has(a.id)); if (!live.length) return null;
  const pid = (id: string) => partNumber(p, id)!, liveIds = new Set(live.map(a => a.id));
  const entries: RosterEntry[] = live.map(a => {
    const up = p.space.containment.parents[a.id], parent = up && liveIds.has(canonicalPart(s, up)) ? pid(canonicalPart(s, up)) : null;
    const u = partUnderstanding(p, a.id), retired = s.retired.get(a.id);
    const life = retired ? (retired.successor ? `대신함→${pid(retired.successor)}` : '없어짐') : LIFE[u?.stateRead?.state ?? ''] ?? '있음';
    const role = u?.role ? unstampRole(u.role).role : '', note = role ? one(role, ROSTER_NOTE_CHARS) : u?.files[0] ? one(u.files[0], ROSTER_NOTE_CHARS) : '';
    const name = officialName(p, a.id), files = (u?.files ?? []).slice(0, 3);
    const want = opts.detail?.includes(a.id) ? [role ? `역할: ${one(role, 140)}` : '', files.length ? `파일: ${files.map(f => one(f, 60)).join(', ')}` : ''].filter(Boolean).join('; ') : '';
    return { pid: pid(a.id), areaId: a.id, name: secretLike(name) ? '[가림]' : one(name, ROSTER_NAME_CHARS), parent, life, note: secretLike(note) ? '' : note,
      old: partAliases(p, a.id).slice(0, 3).map(x => one(x.name, 40)), folded: [...s.folded].filter(([, to]) => canonicalPart(s, to) === a.id).map(([from]) => pid(from)).slice(0, 4),
      detail: want && !secretLike(want) ? want : null };
  });
  const revision = p.readings.filter(isMapReading).length, count = p.space.areas.length;
  const hash = rosterHash(entries), base = `프로젝트 ${p.id} · 판 ${revision} · 해시 ${hash} · P01–P${pad(count)}`;
  // Review of .50 (K4): a partial roster says in the line the reply copies how far it lists (「목록 P01–P35」), so a row on a part it does
  // not list is held.
  const headOf = (shown: number) => shown >= entries.length ? base : `${base} · 목록 ${entries[0]!.pid}–${entries[shown - 1]!.pid}`;
  const line = (e: RosterEntry, note: number, detail: boolean) => [`${e.pid} ${e.name} · ${e.parent ? `${e.parent} 안` : '—'} · ${e.life}${note && e.note ? ` · ${one(e.note, note)}` : ''}${e.old.length ? ` · 옛 이름 ${e.old.join('·')}` : ''}${e.folded.length ? ` · 옛 ID ${e.folded.join('·')}` : ''}`,
    ...(detail && e.detail ? [`  └ ${e.detail}`] : [])].join('\n');
  const build = (note: number, detail: boolean, shown: number) => {
    const scope = shown >= entries.length ? `범위: 전체 ${entries.length}개` : `범위: 일부 ${shown}/${entries.length}개(${entries[0]!.pid}–${entries[shown - 1]!.pid}만; 나머지 부분은 C-IDENT에 쓰지 않는다)`;
    let room = ROSTER_DETAIL_CHARS;
    const lines = entries.slice(0, shown).map(e => { const withDetail = detail && !!e.detail && room >= e.detail.length; if (withDetail) room -= e.detail!.length; return line(e, note, withDetail); });
    return [`[대장] ${headOf(shown)}`, scope, 'P ID 공식 이름 · 부모 · 상태 · 구별 말(역할 또는 파일)', ...lines].join('\n');
  };
  let text = '', shown = entries.length;
  for (const [note, detail] of [[ROSTER_NOTE_CHARS, true], [ROSTER_NOTE_CHARS, false], [30, false], [0, false]] as const) { text = build(note, detail, shown); if (text.length <= max) break; }
  while (text.length > max && shown > 1) { shown--; text = build(0, false, shown); }
  return { version: ROSTER_VERSION, projectId: p.id, revision, hash, count, entries, shown, scope: shown >= entries.length ? 'full' : 'partial', head: headOf(shown), text };
}
/** The roster's hash: its P numbers, names, parents and lifecycles (8 hex). */
export const rosterHash = (entries: readonly Pick<RosterEntry, 'pid' | 'name' | 'parent' | 'life'>[]): string => sha256(entries.map(e => [e.pid, e.name, e.parent ?? '', e.life].join('\t')).join('\n')).slice(0, 8);

/* ---------- the record's C-IDENT table ---------- */
export interface RosterEcho { project: string | null; revision: number | null; hash: string | null; count: number | null; listed: number | null }
const ECHO = /^대장\s*[:：]\s*(.+)$/;
/** The roster line the reply copied under its C-IDENT title (「대장: 프로젝트 … · 판 12 · 해시 3f9a2c1d · P01–P56」), or null. */
export function rosterEcho(rows: readonly FoldRow[]): RosterEcho | null {
  for (const t of new Set(rows.map(r => r.source))) for (const b of t.body) {
    const m = ECHO.exec(b.text.trim()); if (!m) continue;
    const s = m[1]!, num = (re: RegExp) => { const x = re.exec(s); return x ? Number(x[1]) : null; };
    return { project: /프로젝트\s+([^\s·]+)/.exec(s)?.[1] ?? null, revision: num(/판\s+(\d{1,4})/), hash: /해시\s+([0-9a-f]{8})/i.exec(s)?.[1]?.toLowerCase() ?? null, count: num(/P\d{2,3}\s*[–—~-]\s*P(\d{2,3})/),
      listed: num(/목록\s+P\d{2,3}\s*[–—~-]\s*P(\d{2,3})/) };
  }
  return null;
}
const ANSWER_WORDS: Readonly<Record<string, IdentityAnswer>> = Object.freeze({ 같음: 'same', '이름 바뀜': 'renamed', 이름바뀜: 'renamed', 대신함: 'replaced', 없어짐: 'gone', 모름: 'unknown', 나뉨: 'split', 합침: 'merged' });
/** A change the record says is still planned, or partial: neither retires anything (ruling F5 Q3). */
const PLANNED = /계획|예정|하기로|할\s*것|나중에|아직/, PARTIAL = /일부|부분적|병행|함께\s*남/;
/** Review of .50 (K3): a 바뀐 때 that says no time (모름, 불명, 미상, ?) shows no change in effect. */
const NO_TIME = /모름|불명|미상|알\s*수\s*없|unknown|\?/i;
/** Review of .50 (K3): a successor's C-PART 구현 상태 that is not built in whole: unbuilt or planned, and partly built. */
const UNBUILT_IMPL = /미구현|계획|예정|안\s*됨/, PARTIAL_IMPL = /일부|부분|진행|작업\s*중/;
/** Review of .50 (K5): an evidence row whose source is the app's own roster or the request is no evidence of the record: the roster is
 * what the session was given, not what it found. */
const ROSTER_SOURCE = /대장|앱이\s*(?:준|보낸|만든|제공)|지도\s*(?:목록|번호)|기록\s*요청|요청\s*(?:문|본문)|roster/i;
const said = (v: string | undefined, n: number): string | null => { const t = (v ?? '').trim(); return !t || /^[—–-]+$/.test(t) ? null : one(t, n); };
const COL_P = '지도 부분(Pxx)', COL_B = '이 기록 부분(Bxx)';

/** What the program decides for each C-IDENT row of fold f on project p as it is now, given the C-PART row → part bindings the ledger holds
 * (bound, ledgerKey(record, 'C-PART', B) → part) and the current roster (its hash: the reply's roster line equal to it means nothing changed).
 * Pure: the same project, fold and bindings decide the same. */
export function decideIdentity(p: Project, f: V5Fold, bound: ReadonlyMap<string, string>, roster: MapRoster | null = mapRoster(p)): ReadingIdentityRow[] {
  const rows = f.fold.rows.get(IDENT_TABLE_ID) ?? []; if (!rows.length) return [];
  const s = identityState(p), maps = p.readings.filter(isMapReading), echo = rosterEcho(rows);
  const index = (id: string) => p.space.areas.findIndex(a => a.id === id), area = (id: string) => p.space.areas.find(a => a.id === id);
  const partRows = new Map((f.fold.rows.get('C-PART') ?? []).map(r => [r.id, r]));
  // The map since the record's roster: a part an identity operation of another record changed, a part made after it, a part past its count.
  let status: 'ok' | 'other' | 'unverified' = 'ok'; const affected = new Set<string>();
  // Review of .50 (K4): no reading since the roster, so its hash must be that of the roster now, the parts made after it aside (this
  // reading's own); a different one is a map the person changed meanwhile, or a line not copied, and nothing of it is taken as current.
  const sinceOwn = (n: number | null) => rosterHash((roster?.entries ?? []).filter(e => n === null || index(e.areaId) < n));
  if (!echo || !echo.project || echo.revision === null) status = 'unverified';
  else if (echo.project !== p.id) status = 'other';
  else if (echo.hash === null || echo.revision > maps.length) status = 'unverified';
  else if (echo.revision === maps.length) { if (echo.hash !== roster?.hash && echo.hash !== sinceOwn(echo.count)) status = 'unverified'; }
  else if (echo.hash !== roster?.hash) {
    for (const r of maps.slice(echo.revision)) {
      for (const x of r.identity ?? []) if (x.op && x.record !== f.key) for (const id of [x.op.areaId, x.op.successor, x.op.into]) if (id) affected.add(id);
      for (const x of r.parts) if (x.created) affected.add(x.areaId);
    }
    if (echo.count !== null) p.space.areas.forEach((a, i) => { if (i >= echo.count!) affected.add(a.id); });
  }
  const out: ReadingIdentityRow[] = [], valid: ReadingIdentityRow[] = [];
  const set = (e: ReadingIdentityRow, state: ReadingIdentityRow['state'], reason: string | null, op: ReadingIdentityOp | null = null) => { e.state = state; e.reason = reason; e.op = op; };
  for (const fr of rows) {
    const c = fr.row.byColumn, map = /P\d{2,3}/.exec(c[COL_P] ?? '')?.[0] ?? null, answer = fixedWord(c['대응'] ?? '', ANSWER_WORDS)?.value ?? null;
    const bs = [...new Set((c[COL_B] ?? '').match(/(?<![A-Za-z0-9])B\d{1,3}(?!\d)/g) ?? [])];
    const evidence = [...new Set(fr.cites.filter(x => /^[FE]\d{1,3}$/.test(x.ref) && x.grade !== 'unknown' && x.grade !== 'guess' && !ROSTER_SOURCE.test(`${x.source ?? ''} ${x.place ?? ''}`)).map(x => x.ref))].slice(0, 8);
    const at = map ? areaOfNumber(p, map) : null;
    const e: ReadingIdentityRow = { record: f.key, id: fr.id, map, answer, part: bs[0] ?? null, state: 'rejected', reason: 'form', areaId: at ? canonicalPart(s, at) : null, op: null,
      when: said(c['바뀐 때'], 60), evidence, at: { record: fr.record, from: fr.row.from, to: fr.row.to } };
    out.push(e);
    if (answer === null) continue;
    if (answer === 'split' || answer === 'merged') { set(e, 'rejected', 'unsupported'); continue; }
    if (answer === 'unknown') { set(e, 'rejected', 'undecided'); continue; }
    if (!e.areaId) { set(e, 'rejected', 'unknown-part'); continue; }
    if (status === 'other') { set(e, 'rejected', 'other-project'); continue; }
    if (answer === 'gone' ? bs.length > 0 : bs.length !== 1 || !partRows.has(bs[0]!)) continue;
    if (status === 'unverified' || affected.has(e.areaId) || area(e.areaId)?.archived) { set(e, 'held', 'roster'); continue; }
    // Review of .50 (K4): a partial roster's row on a part it did not list is held (the session never saw that part's line).
    if (echo?.listed && Number(map!.slice(1)) > echo.listed) { set(e, 'held', 'roster'); continue; }
    // Ruling F5 Q1: a roster correspondence that cites nothing of the record is a candidate only.
    if (!evidence.length) { set(e, 'held', 'identity'); continue; }
    valid.push(e);
  }
  // 같음 and 이름 바뀜: the B row is that part. One part for two B rows (a split?) or a part retired already is held; two parts the map made
  // for one B row are one part (the later folded onto the earlier); a B row the ledger binds to another part is held, unless both are parts
  // the map made with names alike (a duplicate the map made: folded the same way).
  const same = valid.filter(e => e.answer === 'same' || e.answer === 'renamed'), binds = new Map<string, string>();
  const made = (id: string) => s.created.has(id) && !area(id)?.archived;
  // Review of .50 (K1, deadlock 9): two parts are one duplicate the map made only when both are the map's and no record has them on two
  // different C-PART rows of its own (two rows of one record are two parts: folding them is a real merge, never applied in .50). A B row the
  // ledger binds to another part folds with it only when, in addition, their names are alike.
  const rowsOf = new Map<string, Map<string, Set<string>>>();
  for (const [k, v] of bound) { const [rec, table, b] = k.split('\u0000'); if (table !== 'C-PART' || !rec || !b) continue; const to = canonicalPart(s, v);
    const m = rowsOf.get(to) ?? new Map<string, Set<string>>(); m.set(rec, new Set([...m.get(rec) ?? [], b])); rowsOf.set(to, m); }
  const twoRows = (a: string, b: string) => { const x = rowsOf.get(a), y = rowsOf.get(b); if (!x || !y) return false;
    for (const [rec, rows] of x) { const other = y.get(rec); if (other && [...other].some(r => !rows.has(r)) && [...rows].some(r => !other.has(r))) return true; } return false; };
  const duplicates = (ids: readonly string[]) => ids.every(a => made(a) && !s.retired.has(a)) && ids.every(a => ids.every(b => a === b || !twoRows(a, b)));
  const own = (e: ReadingIdentityRow, to: string): ReadingIdentityOp | null => {
    if (e.answer !== 'renamed') return { kind: 'bind', areaId: to, successor: null, into: null, from: null, to: null, renamed: false };
    const name = one((partRows.get(e.part!)!.row.byColumn['이름'] ?? '').replace(/[*`]/g, ''), 60), was = officialName(p, to);
    return name && normName(name) !== normName(was) && !secretLike(name) ? { kind: 'rename', areaId: to, successor: null, into: null, from: was, to: name, renamed: false } : { kind: 'bind', areaId: to, successor: null, into: null, from: null, to: null, renamed: false };
  };
  const fold = (dup: string, into: string): ReadingIdentityOp | null => s.folded.get(dup) === into ? null : { kind: 'fold', areaId: dup, successor: null, into, from: null, to: null, renamed: false };
  for (const e of same) if (same.some(o => o.areaId === e.areaId && o.part !== e.part)) set(e, 'held', 'identity');
  for (const b of new Set(same.filter(e => e.state !== 'held').map(e => e.part!))) {
    const list = same.filter(e => e.part === b && e.state !== 'held'), areas = [...new Set(list.map(e => e.areaId!))];
    if (areas.length > 1) {
      if (!duplicates(areas)) { for (const e of list) set(e, 'held', 'identity'); continue; }
      const canon = areas.reduce((x, y) => index(x) <= index(y) ? x : y);
      for (const e of list) set(e, 'reflected', null, e.areaId === canon ? own(e, canon) : fold(e.areaId!, canon));
      binds.set(b, canon); continue;
    }
    const a = areas[0]!, x0 = bound.get(ledgerKey(f.key, 'C-PART', b)), x = x0 ? canonicalPart(s, x0) : null;
    if (s.retired.has(a)) { for (const e of list) set(e, 'held', 'identity'); continue; }
    if (x && x !== a) {
      if (!duplicates([x, a]) || !likeNames(officialName(p, x), officialName(p, a))) { for (const e of list) set(e, 'held', 'identity'); continue; }
      const canon = index(x) <= index(a) ? x : a, dup = canon === x ? a : x;
      list.forEach((e, i) => set(e, 'reflected', null, i ? null : fold(dup, canon)));
      binds.set(b, canon); continue;
    }
    list.forEach((e, i) => set(e, 'reflected', null, i ? null : own(e, a)));
    binds.set(b, a);
  }
  // 대신함 and 없어짐: in effect and whole only. The successor is the part the record's B row is (by this table or the ledger); a B row on no part
  // yet waits for it. A part the same table also calls 같음 is held (the record says both).
  for (const e of valid.filter(v => v.answer === 'replaced' || v.answer === 'gone')) {
    const a = e.areaId!;
    if (same.some(o => o.areaId === a)) { set(e, 'held', 'identity'); continue; }
    const impl = e.part ? partRows.get(e.part)?.row.byColumn['구현 상태'] ?? '' : '';
    if (PLANNED.test(e.when ?? '') || UNBUILT_IMPL.test(impl)) { set(e, 'rejected', 'planned'); continue; }
    if (PARTIAL.test(e.when ?? '') || PARTIAL_IMPL.test(impl)) { set(e, 'rejected', 'partial'); continue; }
    // Review of .50 (K3): retirement needs the change in effect: a time it happened, and for 대신함 a successor row that says it is built.
    if (!e.when || NO_TIME.test(e.when) || e.answer === 'replaced' && !/구현/.test(impl)) { set(e, 'rejected', 'unconfirmed'); continue; }
    const was = s.retired.get(a);
    let successor: string | null = null;
    if (e.answer === 'replaced') {
      const b = bound.get(ledgerKey(f.key, 'C-PART', e.part!)), to = binds.get(e.part!) ?? (b ? canonicalPart(s, b) : null);
      if (!to) { set(e, 'waiting', 'unresolved-endpoint'); continue; }
      if (to === a) { set(e, 'rejected', 'form'); continue; }
      if (area(to)?.archived) { set(e, 'held', 'roster'); continue; }
      successor = to;
    }
    if (was) { if (was.successor === successor) set(e, 'reflected', null); else set(e, 'held', 'identity'); continue; }
    set(e, 'reflected', null, { kind: 'retire', areaId: a, successor, into: null, from: null, to: null, renamed: false });
  }
  return out.slice(0, IDENTITY_ROWS_MAX);
}
/** The C-PART row → part bindings the C-IDENT rows of the folds make (같음 and 이름 바뀜 rows reflected now, a folded part's to its canonical
 * one), by ledgerKey(record, 'C-PART', B). live(id) says which parts may be bound (an ask's parts). */
export function identityBindings(p: Project, folds: readonly V5Fold[], bound: ReadonlyMap<string, string>, live: (id: string) => boolean = () => true): Map<string, string> {
  const out = new Map<string, string>(), roster = folds.some(f => f.fold.rows.get(IDENT_TABLE_ID)?.length) ? mapRoster(p) : null, s = identityState(p);
  for (const f of folds) for (const e of decideIdentity(p, f, bound, roster)) {
    if (e.state !== 'reflected' || !e.part || !(e.answer === 'same' || e.answer === 'renamed')) continue;
    const to = canonicalPart(s, e.op?.kind === 'fold' ? e.op.into! : e.areaId!);
    if (live(to)) out.set(ledgerKey(f.key, 'C-PART', e.part), to);
  }
  return out;
}

/** Review of .50 (K9, ruling F5 Q1: a conflict is never dodged by a new P): the C-PART rows whose 같음 or 이름 바뀜 row of the folds is held,
 * each with the part the record says it is (by ledgerKey(record, 'C-PART', B)). A new part on such a row is held with that part, not made. */
export function identityHolds(p: Project, folds: readonly V5Fold[], bound: ReadonlyMap<string, string>): Map<string, string> {
  const out = new Map<string, string>(), roster = folds.some(f => f.fold.rows.get(IDENT_TABLE_ID)?.length) ? mapRoster(p) : null;
  for (const f of folds) for (const e of decideIdentity(p, f, bound, roster))
    if (e.state === 'held' && e.part && e.areaId && (e.answer === 'same' || e.answer === 'renamed')) out.set(ledgerKey(f.key, 'C-PART', e.part), e.areaId);
  return out;
}

/* ---------- the current map ---------- */
/** The current map (ruling F5 Q3): a part a record retired, and a duplicate folded onto its canonical part, are not drawn. A retired part's
 * children hang under its own parent; a folded part's children and relations go to its canonical part (a relation that would join a part
 * to itself, or repeat one drawn already, is left out); a retired part's relations are not drawn and never move to its successor. The parts
 * stay in the project with their history (the pane, partUnderstanding, partAliases). */
export function currentView(p: Project, v: StudioView): StudioView {
  const s = identityState(p); if (!s.retired.size && !s.folded.size) return v;
  const byId = new Map(v.parts.map(x => [x.id, x])), hide = new Set([...s.retired.keys(), ...s.folded.keys()].filter(id => byId.has(id)));
  if (!hide.size) return v;
  const to = (id: string) => (s.folded.has(id) ? canonicalPart(s, id) : id), kept = v.parts.filter(x => !hide.has(x.id)), ids = new Set(kept.map(x => x.id));
  const parentOf = (x: PartView): string | null => {
    let q = x.parentId;
    for (let g = 0; q && g < 64; g++) { const c = to(q); if (ids.has(c) && c !== x.id) return c; if (!s.retired.has(q)) return null; q = byId.get(q)?.parentId ?? null; }
    return null;
  };
  const parents = new Map(kept.map(x => [x.id, parentOf(x)]));
  const depth = (id: string) => { let d = 0; for (let q = parents.get(id) ?? null, g = 0; q && g < 64; q = parents.get(q) ?? null, g++) d++; return d; };
  const parts: PartView[] = kept.map(x => ({ ...x, parentId: parents.get(x.id) ?? null, depth: depth(x.id), childIds: kept.filter(c => parents.get(c.id) === x.id).map(c => c.id) }));
  const seen = new Set<string>(), relations: RelationView[] = [];
  for (const r of v.relations) {
    if (s.retired.has(r.from) || s.retired.has(r.to)) continue;
    const from = to(r.from), dest = to(r.to), key = `${from}\u0000${dest}\u0000${r.kind}`;
    if (from === dest || !ids.has(from) || !ids.has(dest) || seen.has(key)) continue;
    seen.add(key); relations.push(from === r.from && dest === r.to ? r : { ...r, from, to: dest });
  }
  return { ...v, parts, roots: parts.filter(x => x.parentId === null).map(x => x.id), relations };
}
