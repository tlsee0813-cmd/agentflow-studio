/* A handover document: what a new AI session needs to carry this project (or one part of it) on, made from what the map and the
 * records already hold. Nothing is asked of a model and nothing is added: reports stay reports, open choices stay open. The document
 * carries a marker (af-handover:CODE[:part]) so that a session which starts from it is known as the one that took it over, and the
 * document itself is not taken back in as a new record of work (foldHandover). */
import { isMapReading, type ClaimKind, type MapReading, type Project } from './types.js';
import { CLAIM_LABEL, candidateReading, unreadRecords } from './map-reading.js';
import { studioView, type PartView, type StudioView } from './studio.js';
import { relLabel } from './relation-groups.js';
import { stamp, RECORD_HEAD, HEAD_FIELD } from './session-import.js';
import { TOOL_NAME, type SessionTool } from './session-parse.js';
import { HANDOVER_TAG, foldHandover, quoteReceived, receivedHandovers } from './handover-mark.js';
export { HANDOVER_TAG, foldHandover, handoverCode, receivedHandovers } from './handover-mark.js';

/* ---------- which session a record came from ---------- */
/** start: when the session began, as its header writes it (YYYY-MM-DD HH:MM), when it does. */
export interface SessionOrigin { id: string | null; tool: SessionTool | 'web'; title: string | null; cwd: string | null; branch: string | null; start?: string }
const ORIGIN_NAME: Record<SessionOrigin['tool'], string> = { ...TOOL_NAME, web: '웹 AI' };
const EMPTY_FIELD = /^(?:(?:작업 폴더|브랜치)\s*)?(?:\(?(?:없음|없어요|없습니다|해당 없음|모름|알 수 없음|n\/a|none|null|unknown|-+|—)\)?|\([^()]*(?:있으면|짧은 제목)[^()]*\))$/i;
/** The session a record was taken from (its header line, session-import.ts), or null for any other record. */
export function sessionOrigin(text: string): SessionOrigin | null {
  const m = RECORD_HEAD.exec(text); if (!m) return null;
  // A field a web AI filled with nothing (브랜치 없음, 작업 폴더 (없음), N/A) or left as the ask's placeholder says nothing.
  const tool = m[1] === 'Codex' ? 'codex' : m[1] === '웹 AI' ? 'web' : 'claude';
  const raw = (m[2] ?? '').split(' · ').map(f => f.trim()).filter(Boolean), fields = raw.filter(f => !(tool === 'web' && EMPTY_FIELD.test(f)));
  // The title comes first: in 「」 when it reads like a field (sessionText puts it so), and always first in a web AI's header
  // (WEB_RECORD_ASK asks for it there) unless that field is a folder, a time or an id. In 「」 it runs to the last field ending
  // in 」 that only fields follow (a title can hold 」 · 「, and end in what reads as a field: 「결제」 · 브랜치 정리).
  let title: string[] = [], rest = fields;
  const closes = fields[0]?.startsWith('「') ? fields.flatMap((f, i) => (f.endsWith('」') ? [i] : [])) : [];
  const end = [...closes].reverse().find(i => fields.slice(i + 1).every(f => Object.values(HEAD_FIELD).some(r => r.test(f)))) ?? closes[0] ?? -1;
  if (end >= 0) { title = [fields.slice(0, end + 1).join(' · ').slice(1, -1)]; rest = fields.slice(end + 1); }
  else if (tool === 'web' && fields[0] && fields[0] === raw[0] && !(['id', 'start', 'cwd'] as const).some(k => HEAD_FIELD[k].test(fields[0]!))) { title = [fields[0]]; rest = fields.slice(1); }
  // The other fields are told by their shape, wherever they stand (a web AI may add one or change the order): a session id, a start
  // time, a branch name (no spaces, as git has it), a folder path. Each is taken once, from the end, where sessionText writes them;
  // anything else belongs to the title ('세션 만료 처리', '작업 폴더 정리', a title that holds ' · ').
  const got: Partial<Record<keyof typeof HEAD_FIELD, string>> = {}, more: string[] = [];
  for (const f of [...rest].reverse()) {
    const kind = (Object.keys(HEAD_FIELD) as (keyof typeof HEAD_FIELD)[]).find(k => !got[k] && HEAD_FIELD[k].test(f));
    if (kind) got[kind] = HEAD_FIELD[kind].exec(f)![1]!.trim(); else more.unshift(f);
  }
  return { id: got.id ?? null, tool, title: [...title, ...more].join(' · ') || null, cwd: got.cwd ?? null, branch: got.branch ?? null, ...(got.start ? { start: got.start } : {}) };
}
/** A session record pasted by hand (a web session's, written back with WEB_RECORD_ASK): each request folded as the import folds
 * it, so a handover document the session started from is not kept again as a record of work. Any other text stays as written. */
export function foldRecord(text: string): string {
  if (!text.includes(HANDOVER_TAG) || !sessionOrigin(text)) return text;
  return text.split(/^(?=── )/m).map(b => (b.startsWith('── 사용자 요청') ? foldHandover(b) : b)).join('');
}
const originKey = (o: SessionOrigin) => o.id ?? `${o.tool}|${o.title ?? ''}|${o.cwd ?? ''}`;
/** A session by its title (partSessions gives one without a title its first request), else by when it started. */
export const originLabel = (o: Pick<SessionOrigin, 'tool' | 'title' | 'start'>) => `${ORIGIN_NAME[o.tool]}${o.title ? ` 「${o.title}」` : ` 세션${o.start ? ` (${o.start.slice(5)} 시작)` : ''}`}`;
/** The first words of a record's first request, as the paste box's list names a session; a handover it started from is not them. */
function askName(text: string): string | null {
  const ask = text.split(/^── /m).find(b => b.startsWith('사용자 요청'));
  const line = ask?.split('\n').slice(1).map(l => l.trim()).find(l => l && !l.startsWith('[AgentFlow 인수인계 문서를 받아 이어감'));
  return line ? one(line, 25) : null;
}

export interface PartSession extends SessionOrigin { key: string; lastAt: string; worked: boolean; tookOver: boolean }
/** The sessions behind a part: those whose records the map quotes for it (it worked on it), and those that started from a handover
 * of it (it took it over), newest first. With no part, the sessions that took the whole project over and every session recorded.
 * One without a title (every Codex session) is named by the first request its records hold, the same in every part. */
export function partSessions(p: Project, areaId: string | null): PartSession[] {
  const quoted = new Set<string>();
  if (areaId) for (const r of p.readings) {
    if (!isMapReading(r)) continue;
    const part = r.parts.find(x => x.areaId === areaId); if (!part) continue;
    for (const q of part.basis) quoted.add(q.record);
    for (const c of part.claims) quoted.add(c.record);
  }
  const out = new Map<string, PartSession>(), named = new Map<string, string>();
  for (const rec of p.pasted) {
    const o = sessionOrigin(rec.text); if (!o) continue;
    const key = originKey(o), name = !o.title && !named.has(key) && askName(rec.text); if (name) named.set(key, name);
    const worked = areaId ? quoted.has(rec.id) : true, tookOver = receivedHandovers(rec.text).some(h => h.areaId === areaId);
    if (!worked && !tookOver) continue;
    const was = out.get(key);
    out.set(key, { ...o, key, lastAt: was && was.lastAt > rec.at ? was.lastAt : rec.at, worked: worked || !!was?.worked, tookOver: tookOver || !!was?.tookOver });
  }
  return [...out.values()].map(s => (s.title ? s : { ...s, title: named.get(s.key) ?? null })).sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/* ---------- the document ---------- */
export interface HandoverOptions { scope: string | null; code: string; at: string }
/** A document, and how many of its parts were written shorter (or by name only) to keep it within HANDOVER_CHARS. */
export interface Handover { text: string; trimmed: number }
/** The longest document made. It is pasted as a new session's first message (a web chat's too), so it stays short enough to copy
 * and read whole. Its length costs nothing of the words the person writes after it: a session import folds it to one line before
 * a prompt is clipped (session-parse.ts sessionDetail). */
export const HANDOVER_CHARS = 15000;
const CLAIM_ORDER: ClaimKind[] = ['want', 'idea', 'reported', 'checked', 'describes', 'open', 'differs'];
const CLAIMS_PER_PART = 10, RECENT_REQUESTS = 6, FILES_PER_ASK = 8, RECENT_FILES = 24, LINE = 240, NAMES = 600;
const one = (t: string, n = LINE) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
/** The claims a part keeps when it holds more than it has room for: what is left to ask first (an open choice is what the next
 * session must not decide alone), then what was wanted and reported. */
const KEEP_FIRST: ClaimKind[] = ['open', 'differs', 'want', 'reported', 'checked', 'idea', 'describes'];
/** How much of a part is written: in full, or briefly when the whole document would be too long (then what is left to ask is also
 * written first). */
const FULL = { text: 400, claims: CLAIMS_PER_PART, claim: LINE, rels: 10, sessions: 4, order: CLAIM_ORDER };
const BRIEF = { text: 160, claims: 3, claim: 120, rels: 3, sessions: 2, order: KEEP_FIRST };

function subtree(view: StudioView, id: string): PartView[] {
  const out: PartView[] = [], walk = (x: string) => { const part = view.parts.find(q => q.id === x); if (!part) return; out.push(part); part.childIds.forEach(walk); };
  walk(id); return out;
}
function partBlock(view: StudioView, part: PartView, sessions: PartSession[], top: number, k = FULL): string[] {
  const lines = [`${'#'.repeat(Math.min(6, 3 + part.depth - top))} ${part.name}`];
  const u = part.reading;
  const role = u?.role ?? part.summary ?? null;
  // Every line a list item: in a Markdown viewer a plain line after a list runs into its last item.
  if (role) lines.push(`- 역할: ${one(role, k.text)}${u?.corrected ? ' (사용자가 고친 설명)' : ''}`);
  if (part.note) lines.push(`- 사용자 메모: ${one(part.note, k.text)}`);
  // Chosen by KEEP_FIRST in either mode (the newest of a kind first, as the map lists them), then written in the mode's order.
  const all = u?.claims ?? [], keep = new Set(all.slice().sort((a, b) => KEEP_FIRST.indexOf(a.kind) - KEEP_FIRST.indexOf(b.kind)).slice(0, k.claims));
  const claims = all.filter(c => keep.has(c)).sort((a, b) => k.order.indexOf(a.kind) - k.order.indexOf(b.kind));
  for (const c of claims) lines.push(`- ${CLAIM_LABEL[c.kind]}: ${one(c.text, k.claim)}${c.about ? ` (${one(c.about, 80)})` : ''}`);
  // The next session cannot see the map: it is told what is left out, not where to look.
  if (all.length > claims.length) lines.push(`- (그 밖에 ${all.length - claims.length}개는 이 문서에 넣지 않았어요)`);
  if (!role && !part.note && !all.length) lines.push('- 아직 이 부분에 대해 읽힌 내용이 없어요.');
  const rels = view.relations.filter(r => r.from === part.id || r.to === part.id).map(r => {
    const out = r.from === part.id, other = view.parts.find(x => x.id === (out ? r.to : r.from));
    // Read from this part, as its panel reads it: '이 부분이 필요로 함' or '이 부분을 필요로 함', never an arrow to decode. Sharing has
    // no direction (the panel's arrow only says which end was recorded first), so it reads the same from both ends.
    return other ? `${other.name} (${r.kind === 'shares' ? '이 부분과 함께 씀' : relLabel(r.kind, out)}${r.note ? ` · ${one(r.note, 80)}` : ''})` : null;
  }).filter(Boolean);
  if (rels.length) lines.push(`- 관련: ${rels.slice(0, k.rels).join(', ')}${rels.length > k.rels ? ` 외 ${rels.length - k.rels}개` : ''}`);
  if (sessions.length) lines.push(`- 다룬 세션: ${sessions.slice(0, k.sessions).map(s => `${originLabel(s)}${s.tookOver ? ' (인수인계로 이어받음)' : ''}`).join(', ')}`);
  return lines;
}

// A web record saved by an older page, from a document copied without its end line, has the answer's head glued to the folded line
// ('…]── 웹 AI 답변 ──'): read with that head on a line of its own, its answer stays the AI's. The stored text is not changed.
const GLUED = /(\[AgentFlow 인수인계 문서를 받아 이어감 · [^\]\n]*\])(?=── (?:웹 AI|Claude Code|Codex) 답변)/g;
/** A request, the files changed answering it, and the records both came from. */
interface Ask { text: string; files: string[]; records: string[] }
/** The person's requests in session records, oldest first, with the files the tool's next answer reported changing: all of them, or
 * those of the records in `only` and of the records `also` admits (by their session's key and the record's id). */
function sessionAsks(p: Project, only: Set<string> | null, also: (key: string, id: string) => boolean): Ask[] {
  // An answer's files belong to the last request of its own session, which may sit in an earlier record (taken before the reply
  // came), never to another session's request; when that request's record is outside the scope, they are not shown.
  const out: Ask[] = [], asked = new Map<string, Ask | null>();
  for (const rec of p.pasted) {
    const origin = sessionOrigin(rec.text); if (!origin) continue;
    const key = originKey(origin), shown = !only || only.has(rec.id) || also(key, rec.id);
    for (const part of rec.text.replace(GLUED, '$1\n').split(/^── /m).slice(1)) {
      const nl = part.indexOf('\n'), head = part.slice(0, nl), body = part.slice(nl + 1).trim();
      if (head.startsWith('사용자 요청')) { const t = shown ? { text: body, files: [], records: [rec.id] } : null; if (t) out.push(t); asked.set(key, t); continue; }
      // The list is on the answer's last line (a web AI may put it after a bullet), read to its last ')' so a name like
      // app/(auth)/page.tsx stays whole.
      const f = /\(바꾼 파일: (.+)\)\s*$/.exec(body.slice(body.lastIndexOf('\n') + 1).trim()), last = asked.get(key);
      // A web AI may write the line with nothing in it ('(바꾼 파일: 없음)'): no file is named so.
      if (f && last) { last.files.push(...f[1]!.split(', ').filter(x => !(origin.tool === 'web' && EMPTY_FIELD.test(x.trim())))); last.records.push(rec.id); }
    }
  }
  return out;
}
/** What the note above the parts says of the records the map has not read: how many there are and where this document has them.
 * inFlow of them have their requests and changed files in the recent flow (some only their latest requests, when cut); in a part's
 * document those are the records of the sessions behind it. The rest are not in the document. */
function unreadWhere(count: number, inFlow: number, scoped: boolean, cut: boolean): string {
  const lead = `아직 지도에 담기지 않은 기록이 ${count}개 있어요.`, what = `${cut ? '최근 ' : ''}요청과 바꾼 파일`;
  if (inFlow === count) return `${lead} 그 기록의 ${what}은 아래 최근 흐름에 있어요.`;
  if (!inFlow) return `${lead} 그 내용은 이 문서에 없으니, 필요하면 사용자에게 물어보세요.`;
  return `${lead} 그중 ${scoped ? '이 범위를 다룬 세션의 기록 ' : ''}${inFlow}개는 ${what}이 아래 최근 흐름에 있고, 나머지 ${count - inFlow}개는 이 문서에 없어요. 필요하면 사용자에게 물어보세요.`;
}

/** The document for the whole project (scope null) or one part with everything inside it. */
export function handoverText(p: Project, opts: HandoverOptions): string { return handoverDoc(p, opts).text; }
/** The document and how much of it was shortened: past HANDOVER_CHARS its parts are written briefly from the last one back, and
 * those that still do not fit are named only; the document says so, and the map keeps everything. */
export function handoverDoc(p: Project, opts: HandoverOptions): Handover {
  const view = studioView(p), scoped = opts.scope ? view.parts.find(x => x.id === opts.scope) ?? null : null;
  if (opts.scope && !scoped) throw new Error('HANDOVER_SCOPE');
  const tag = `${HANDOVER_TAG}:${opts.code}${scoped ? `:${scoped.id}` : ''}`;
  const path = scoped ? [...pathOf(view, scoped.id).map(x => x.name)] : [];
  const title = [p.name, ...path].join(' › ');
  const parts = scoped ? subtree(view, scoped.id) : roots(view).flatMap(r => subtree(view, r.id));
  const maps = p.readings.filter(isMapReading) as MapReading[], latest = maps.at(-1) ?? null;
  const out: string[] = [
    `──────── AgentFlow 인수인계 문서 · ${tag} ────────`,
    `# 인수인계: ${title}`,
    `만든 때: ${stamp(opts.at, true)} · 범위: ${scoped ? `부분 하나 (${scoped.name}${scoped.childIds.length ? `, 안쪽 부분 ${parts.length - 1}개 포함` : ''})` : `프로젝트 전체 (부분 ${parts.length}개)`}`,
    '',
    '이 문서는 AgentFlow Studio가 지금까지의 작업 기록과 그 기록으로 그린 프로젝트 지도에서 만든 인수인계예요. 이전 세션이 하던 작업을 이 세션이 이어받아요.',
    '',
    '## 이어받는 방법',
    // The person usually writes what to do next under the document: that is the task, not something to confirm first.
    '- 이 문서 앞이나 뒤에 사용자가 할 일을 적었다면 그것이 첫 할 일이에요. 없으면 이해한 현재 상태와 첫 할 일을 짧게 말하고 확인을 받은 뒤 시작하세요.',
    '- 시작하기 전에 작업 폴더의 코드와 git 상태(브랜치, 커밋하지 않은 변경)를 직접 보세요. 폴더를 볼 수 없는 대화라면 그렇다고 먼저 말하세요.',
    '- "작업 보고"와 "확인 보고"는 이전 세션이 그렇게 말했다는 기록일 뿐이에요. 코드나 테스트로 확인한 뒤에 사실로 다루세요.',
    '- "원함"은 사용자가 바란 것이고, "구상"은 아직 하기로 정하지 않은 생각이에요. "다른 근거"는 기록이 사용자의 설명과 다르게 말하는 곳이에요.',
    '- "남은 선택", "다른 근거"와 "아직 정하지 않은 것"은 혼자 정하지 말고 사용자에게 물어보세요.',
    // Ended on '부분이에요', so the particle is right whatever the name ends in ("결제"이에요 is not).
    ...(scoped ? [`- 이 인수인계의 범위는 "${scoped.name}" 부분이에요. 범위 밖 부분을 바꿔야 하면 먼저 사용자에게 확인하세요.`] : []),
    '- 이 문서와 코드 어디에도 없는 사실은 추측하지 말고 모른다고 하세요.',
    ''
  ];
  const summary = [...maps].reverse().find(r => r.summary)?.summary;
  if (summary) out.push('## 프로젝트 한눈에', one(summary, 1200), '');
  // Where the work happens: the sessions behind this scope (their folder and branch), newest first. No time is written: a record's
  // is when AgentFlow took it in (a folder's past sessions all at once), not when its session ran.
  const scopeIds = new Set(parts.map(x => x.id)), by = new Map(parts.map(x => [x.id, partSessions(p, x.id)]));
  const sessions = scoped ? dedupe(parts.flatMap(x => by.get(x.id)!)) : partSessions(p, null);
  if (sessions.length) {
    out.push('## 작업 장소와 세션');
    for (const s of sessions.slice(0, 8)) out.push(one(`- ${originLabel(s)}${s.cwd ? ` · 작업 폴더 ${s.cwd}` : ''}${s.branch ? ` · 브랜치 ${s.branch}` : ''}${s.tookOver ? ' · 인수인계로 이어받은 세션' : ''}`, 320));
    out.push('');
  }
  // The latest requests the person made in the sessions, with the files changed answering them: in a part's document, those of the
  // records the readings quoted for it, every record of a session that started from a handover of it (its work is the newest here,
  // read or not), and the records not read yet of the other sessions behind it. A request that started from an earlier handover
  // names it in words, so this document quoting it is not read as that takeover when it is pasted in turn.
  const fresh = new Set(unreadRecords(p, view).map(r => r.id)), behind = new Set(sessions.map(s => s.key)), took = new Set(sessions.filter(s => s.tookOver).map(s => s.key));
  const only = scoped ? new Set(maps.flatMap(r => r.parts.filter(x => scopeIds.has(x.areaId)).flatMap(x => [...x.basis.map(q => q.record), ...x.claims.map(c => c.record)]))) : null;
  const listed = sessionAsks(p, only, (key, id) => took.has(key) || behind.has(key) && fresh.has(id)), asks = listed.slice(-RECENT_REQUESTS);
  // The records not read yet that the recent flow holds (cut: one of them has older requests it leaves out); the rest are not here.
  const seen = new Set(asks.flatMap(a => a.records)), inFlow = [...fresh].filter(id => seen.has(id)).length;
  const cut = listed.slice(0, -RECENT_REQUESTS).some(a => a.records.some(id => fresh.has(id) && seen.has(id))), absent = fresh.size - inFlow;
  out.push(scoped ? '## 이 범위의 현재 상태' : '## 부분별 현재 상태');
  // The parts are what the last reading saw: records it has not read (often the newest work) are not in them, and the document says
  // so and where they are. With no part yet, nothing is below but the recent flow, if any.
  if (parts.length && fresh.size) out.push(`(${latest ? `지도는 ${stamp(latest.at, true)}에 읽은 기록까지예요.` : '지도는 아직 기록을 읽지 않았어요.'} ${unreadWhere(fresh.size, inFlow, !!scoped, cut)})`, '');
  if (!parts.length) out.push(`아직 지도에 부분이 없어요. ${asks.length ? `아래 최근 흐름과 사용자의 설명에서 시작하세요.${absent ? ` 다른 기록 ${absent}개는 이 문서에 없으니, 필요하면 사용자에게 물어보세요.` : ''}`
    : absent ? `기록이 ${absent}개 있지만 이 문서에는 없으니, 사용자에게 지금까지의 상황을 먼저 물어보세요.` : '사용자의 설명에서 시작하세요.'}`, '');
  const after: string[] = [];
  // What is undecided: candidates the readings left open and what the latest reading could not tell, for this scope.
  const open: string[] = [];
  for (const r of maps) for (const c of r.candidates) {
    // A candidate on a part since put away is not asked about, as the map leaves it out.
    if (scoped && !c.areaIds.some(a => scopeIds.has(a)) || c.areaIds.some(a => !view.parts.some(x => x.id === a))) continue;
    const read = candidateReading(c), names = c.areaIds.map(a => view.parts.find(x => x.id === a)?.name).filter(Boolean);
    open.push(`- ${read.label ? `${read.label}: ` : ''}${one(read.statement?.text ?? c.text)}${names.length ? ` (${one(names.join(', '), 80)})` : ''}`);
  }
  if (!scoped && latest) for (const g of latest.gaps) open.push(`- 기록에서 알 수 없었음: ${one(g)}`);
  if (open.length) after.push('## 아직 정하지 않은 것', ...dedupeLines(open).slice(-12), '');
  if (asks.length) {
    after.push('## 최근 흐름 (사용자가 세션에서 한 요청, 오래된 것부터)');
    // Each request names its own files, as many as FILES_PER_ASK and one line hold.
    const each = asks.map(t => [...new Set(t.files)]), list = (f: string[]) => f.slice(0, FILES_PER_ASK).join(', ');
    asks.forEach((t, i) => after.push(`- ${one(quoteReceived(t.text), 300)}${each[i]!.length ? ` → 바꾼 파일: ${one(list(each[i]!), 300)}` : ''}`));
    // All of them once, written only when it names a file the lines above leave out (a request's list was cut short): otherwise it
    // would only repeat them, even when a file was changed more than once.
    const files = [...new Set(each.flat())].slice(-RECENT_FILES);
    if (each.some(f => f.length > FILES_PER_ASK || list(f).length > 300)) after.push('', `최근에 바뀐 파일: ${one(files.join(', '), NAMES)}`);
    after.push('');
  }
  after.push(`──────── 인수인계 문서 끝 · ${tag} ────────`);
  // The parts within HANDOVER_CHARS: each in full while every part after it still fits briefly, else briefly, else by name only.
  const top = scoped ? scoped.depth : 0, full = parts.map(x => partBlock(view, x, by.get(x.id)!, top)), size = (b: string[]) => b.join('\n').length + 2;
  const compose = (blocks: string[][], note: string[]) => [...out, ...note, ...blocks.flatMap(b => [...b, '']), ...after].join('\n');
  const whole = compose(full, []);
  if (whole.length <= HANDOVER_CHARS) return { text: whole, trimmed: 0 };
  const brief = parts.map(x => partBlock(view, x, by.get(x.id)!, top, BRIEF)), rest = brief.map(size);
  for (let i = rest.length - 2; i >= 0; i--) rest[i] = rest[i]! + rest[i + 1]!;
  const room = HANDOVER_CHARS - compose([], ['x'.repeat(120), '']).length - NAMES - 2, shown: string[][] = [];
  for (let i = 0, used = 0; i < parts.length; i++) {
    const b = used + size(full[i]!) + (rest[i + 1] ?? 0) <= room ? full[i]! : used + size(brief[i]!) <= room ? brief[i]! : null;
    if (!b) break;
    shown.push(b); used += size(b);
  }
  const left = parts.slice(shown.length), trimmed = left.length + shown.filter((b, i) => b.join('\n') !== full[i]!.join('\n')).length;
  const names = left.length ? [[one(`그 밖의 부분 ${left.length}개 (이름만): ${left.map(x => x.name).join(', ')}`, NAMES)]] : [];
  return { text: compose([...shown, ...names], trimmed ? [`(문서가 길어서 부분 ${trimmed}개는 줄여 적었어요. 어느 부분을 더 알아야 하면, 그 부분만 담은 인수인계 문서를 사용자에게 따로 부탁하세요.)`, ''] : []), trimmed };
}
function pathOf(view: StudioView, id: string): PartView[] {
  const out: PartView[] = []; for (let x = view.parts.find(q => q.id === id), g = 0; x && g < 64; x = x.parentId ? view.parts.find(q => q.id === x!.parentId) : undefined, g++) out.unshift(x);
  return out;
}
const roots = (view: StudioView) => view.roots.map(id => view.parts.find(x => x.id === id)).filter((x): x is PartView => !!x);
function dedupe(list: PartSession[]): PartSession[] {
  const m = new Map<string, PartSession>();
  for (const s of list) { const was = m.get(s.key); m.set(s.key, was ? { ...was, lastAt: was.lastAt > s.lastAt ? was.lastAt : s.lastAt, worked: was.worked || s.worked, tookOver: was.tookOver || s.tookOver } : s); }
  return [...m.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}
const dedupeLines = (l: string[]) => [...new Set(l)];

/** What to paste into a session that keeps no file on this PC (a web chat): it asks that session to write its own record in the
 * shape a session import has, so pasting its answer back gives a record that reads (and is attributed) like an imported one. */
export const WEB_RECORD_ASK = [
  '[AgentFlow 기록 요청] 이 대화에서 지금까지 내가 한 요청과 네가 한 작업을 아래 형식 그대로 적어 줘. 내 요청은 요약하지 말고 원문 그대로 옮기고, 네 답변은 실제로 한 일·바꾼 파일·확인한 것·남은 일만 적어 줘. 이 기록 요청은 넣지 마. 내 요청에 AgentFlow 인수인계 문서가 들어 있었다면 문서 본문은 옮기지 말고 af-handover가 적힌 첫 줄과 끝 줄만 그대로 적어 줘. 바꾼 파일이 없으면 (바꾼 파일: …) 줄은 빼 줘. 키·토큰·비밀번호는 [가려진 비밀값]으로 바꿔 줘. 형식 밖의 말은 쓰지 마.',
  '',
  '[웹 AI 세션 기록 · (이 대화의 짧은 제목) · 작업 폴더 (있으면 경로, 없으면 이 칸을 빼) · 브랜치 (있으면 이름, 없으면 이 칸을 빼)]',
  '',
  '── 사용자 요청 ──',
  '(내가 쓴 요청 원문)',
  '',
  '── 웹 AI 답변 ──',
  '(한 일, 확인한 것, 남은 일)',
  '(바꾼 파일: 경로1, 경로2)',
  '',
  '(요청마다 위의 사용자 요청·답변 두 덩어리를 차례로 되풀이)'
].join('\n');
