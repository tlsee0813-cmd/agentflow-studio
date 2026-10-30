/* A handover document: what a new AI session needs to carry this project (or one part of it) on, made from what the map and the
 * records already hold. Nothing is asked of a model and nothing is added: reports stay reports, open choices stay open. The document
 * carries a marker (af-handover:CODE[:part]) so that a session which starts from it is known as the one that took it over, and the
 * document itself is not taken back in as a new record of work (foldHandover). */
import { isMapReading, type ClaimKind, type MapReading, type Project } from './types.js';
import { CLAIM_LABEL, candidateReading } from './map-reading.js';
import { studioView, type PartView, type StudioView } from './studio.js';
import { REL_LABEL } from './relation-groups.js';
import { stamp } from './session-import.js';
import { HANDOVER_TAG, foldHandover, quoteReceived, receivedHandovers } from './handover-mark.js';
export { HANDOVER_TAG, foldHandover, handoverCode, receivedHandovers } from './handover-mark.js';

/* ---------- which session a record came from ---------- */
export interface SessionOrigin { id: string | null; tool: 'claude' | 'codex' | 'web'; title: string | null; cwd: string | null; branch: string | null }
const ORIGIN_NAME: Record<SessionOrigin['tool'], string> = { claude: 'Claude Code', codex: 'Codex', web: '웹 AI' };
/** The header line of a session record: written by the import (Claude Code, Codex) or by a web session asked with WEB_RECORD_ASK. */
const HEAD = /^\[(Claude Code|Codex|웹 AI) 세션 기록(?: · ([^\n]*))?\]/;
/** The session a record was taken from (its header line, session-import.ts), or null for any other record. */
export function sessionOrigin(text: string): SessionOrigin | null {
  const m = HEAD.exec(text); if (!m) return null;
  const tool = m[1] === 'Codex' ? 'codex' : m[1] === '웹 AI' ? 'web' : 'claude', fields = (m[2] ?? '').split(' · ').map(f => f.trim()).filter(Boolean);
  // sessionText writes the title first, then folder, branch, start and id, each only when known: they are read back from the end in
  // that order and what is left is the title, so a title that starts like a field ('세션 만료 처리') or holds ' · ' stays whole.
  const back = (re: RegExp) => { const x = fields.length ? re.exec(fields.at(-1)!) : null; if (x) fields.pop(); return x?.[1]?.trim() || null; };
  const id = back(/^세션 ((?:claude|codex)-[0-9a-f]{24})$/); back(/^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}) 시작$/);
  const branch = back(/^브랜치 (.+)$/), cwd = back(/^작업 폴더 (.+)$/);
  return { id, tool, title: fields.join(' · ') || null, cwd, branch };
}
/** A session record pasted by hand (a web session's, written back with WEB_RECORD_ASK): each request folded as the import folds
 * it, so a handover document the session started from is not kept again as a record of work. Any other text stays as written. */
export function foldRecord(text: string): string {
  if (!text.includes(HANDOVER_TAG) || !sessionOrigin(text)) return text;
  return text.split(/^(?=── )/m).map(b => (b.startsWith('── 사용자 요청') ? foldHandover(b) : b)).join('');
}
const originKey = (o: SessionOrigin) => o.id ?? `${o.tool}|${o.title ?? ''}|${o.cwd ?? ''}`;
export const originLabel = (o: Pick<SessionOrigin, 'tool' | 'title'>) => `${ORIGIN_NAME[o.tool]}${o.title ? ` 「${o.title}」` : ' 세션'}`;

export interface PartSession extends SessionOrigin { key: string; lastAt: string; worked: boolean; tookOver: boolean }
/** The sessions behind a part: those whose records the map quotes for it (it worked on it), and those that started from a handover
 * of it (it took it over), newest first. With no part, the sessions that took the whole project over and every session recorded. */
export function partSessions(p: Project, areaId: string | null): PartSession[] {
  const quoted = new Set<string>();
  if (areaId) for (const r of p.readings) {
    if (!isMapReading(r)) continue;
    const part = r.parts.find(x => x.areaId === areaId); if (!part) continue;
    for (const q of part.basis) quoted.add(q.record);
    for (const c of part.claims) quoted.add(c.record);
  }
  const out = new Map<string, PartSession>();
  for (const rec of p.pasted) {
    const o = sessionOrigin(rec.text); if (!o) continue;
    const worked = areaId ? quoted.has(rec.id) : true, tookOver = receivedHandovers(rec.text).some(h => h.areaId === areaId);
    if (!worked && !tookOver) continue;
    const key = originKey(o), was = out.get(key);
    out.set(key, { ...o, key, lastAt: was && was.lastAt > rec.at ? was.lastAt : rec.at, worked: worked || !!was?.worked, tookOver: tookOver || !!was?.tookOver });
  }
  return [...out.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

/* ---------- the document ---------- */
export interface HandoverOptions { scope: string | null; code: string; at: string }
/** A document, and how many of its parts were written shorter (or by name only) to keep it within HANDOVER_CHARS. */
export interface Handover { text: string; trimmed: number }
/** The longest document made. It is pasted as a new session's first prompt, and a prompt is read whole only up to 20,000 characters
 * (session-parse.ts turnChars): past that its end line and the person's own words after it would be cut off. */
export const HANDOVER_CHARS = 15000;
const CLAIM_ORDER: ClaimKind[] = ['want', 'idea', 'reported', 'checked', 'describes', 'open', 'differs'];
const CLAIMS_PER_PART = 10, RECENT_REQUESTS = 6, RECENT_FILES = 24, LINE = 240, NAMES = 600;
const one = (t: string, n = LINE) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
/** How much of a part is written: in full, or briefly when the whole document would be too long. */
const FULL = { text: 400, claims: CLAIMS_PER_PART, claim: LINE, rels: 10, sessions: 4 }, BRIEF = { text: 160, claims: 3, claim: 120, rels: 3, sessions: 2 };

function subtree(view: StudioView, id: string): PartView[] {
  const out: PartView[] = [], walk = (x: string) => { const part = view.parts.find(q => q.id === x); if (!part) return; out.push(part); part.childIds.forEach(walk); };
  walk(id); return out;
}
function partBlock(view: StudioView, part: PartView, sessions: PartSession[], top: number, k = FULL): string[] {
  const lines = [`${'#'.repeat(Math.min(6, 3 + part.depth - top))} ${part.name}`];
  const u = part.reading;
  const role = u?.role ?? part.summary ?? null;
  if (role) lines.push(`역할: ${one(role, k.text)}${u?.corrected ? ' (사용자가 고친 설명)' : ''}`);
  if (part.note) lines.push(`사용자 메모: ${one(part.note, k.text)}`);
  const claims = (u?.claims ?? []).slice().sort((a, b) => CLAIM_ORDER.indexOf(a.kind) - CLAIM_ORDER.indexOf(b.kind));
  for (const c of claims.slice(0, k.claims)) lines.push(`- ${CLAIM_LABEL[c.kind]}: ${one(c.text, k.claim)}${c.about ? ` (${one(c.about, 80)})` : ''}`);
  if (claims.length > k.claims) lines.push(`- (그 밖에 ${claims.length - k.claims}개는 지도에서 볼 수 있어요)`);
  if (!role && !part.note && !claims.length) lines.push('- 아직 이 부분에 대해 읽힌 내용이 없어요.');
  const rels = view.relations.filter(r => r.from === part.id || r.to === part.id).map(r => {
    const out = r.from === part.id, other = view.parts.find(x => x.id === (out ? r.to : r.from));
    return other ? `${out ? '→' : '←'} ${other.name} (${REL_LABEL[r.kind] ?? r.kind}${r.note ? ` · ${one(r.note, 80)}` : ''})` : null;
  }).filter(Boolean);
  if (rels.length) lines.push(`관련: ${rels.slice(0, k.rels).join(', ')}${rels.length > k.rels ? ` 외 ${rels.length - k.rels}개` : ''}`);
  if (sessions.length) lines.push(`다룬 세션: ${sessions.slice(0, k.sessions).map(s => `${originLabel(s)}${s.tookOver ? ' (인수인계로 이어받음)' : ''}`).join(', ')}`);
  return lines;
}

interface Turn { at: string; text: string; files: string[]; origin: SessionOrigin }
/** The person's requests in session records, oldest first, with the files the tool's next answer reported changing. */
function sessionTurns(p: Project, only: Set<string> | null): Turn[] {
  // An answer's files belong to the last request of its own session, which may sit in an earlier record (taken before the reply
  // came), never to another session's request; when that request's record is outside the scope, they are not shown.
  const out: Turn[] = [], asked = new Map<string, Turn | null>();
  for (const rec of p.pasted) {
    const origin = sessionOrigin(rec.text); if (!origin) continue;
    const key = originKey(origin), shown = !only || only.has(rec.id);
    for (const part of rec.text.split(/^── /m).slice(1)) {
      const nl = part.indexOf('\n'), head = part.slice(0, nl), body = part.slice(nl + 1).trim();
      if (head.startsWith('사용자 요청')) { const t = shown ? { at: `${rec.at}|${out.length}`, text: body, files: [], origin } : null; if (t) out.push(t); asked.set(key, t); continue; }
      // The list is the answer's last line, read to its last ')' so a name like app/(auth)/page.tsx stays whole.
      const f = /^\(바꾼 파일: (.+)\)$/.exec(body.slice(body.lastIndexOf('\n') + 1).trim()), last = asked.get(key);
      if (f && last) last.files.push(...f[1]!.split(', '));
    }
  }
  return out;
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
    '- 먼저 아래 내용을 끝까지 읽고, 작업 폴더의 코드와 git 상태를 직접 보고 시작하세요.',
    '- "작업 보고"와 "확인 보고"는 이전 세션이 그렇게 말했다는 기록일 뿐 검증된 사실이 아니에요. 코드에서 확인한 뒤 믿으세요.',
    '- "남은 선택"과 "아직 정하지 않은 것"은 혼자 정하지 말고 사용자에게 물어보세요.',
    '- 이 문서와 코드 어디에도 없는 사실은 추측하지 말고 모른다고 하세요.',
    ...(scoped ? [`- 이 인수인계의 범위는 "${scoped.name}"이에요. 범위 밖 부분을 바꿔야 하면 먼저 사용자에게 확인하세요.`] : []),
    '- 시작할 때 이해한 현재 상태와 첫 할 일을 짧게 말하고, 사용자의 확인을 받은 뒤 진행하세요.',
    ''
  ];
  const summary = [...maps].reverse().find(r => r.summary)?.summary;
  if (summary) out.push('## 프로젝트 한눈에', one(summary, 1200), '');
  // Where the work happens: the sessions behind this scope (their folder and branch), newest first.
  const scopeIds = new Set(parts.map(x => x.id)), by = new Map(parts.map(x => [x.id, partSessions(p, x.id)]));
  const sessions = scoped ? dedupe(parts.flatMap(x => by.get(x.id)!)) : partSessions(p, null);
  if (sessions.length) {
    out.push('## 작업 장소와 세션');
    for (const s of sessions.slice(0, 8)) out.push(one(`- ${originLabel(s)}${s.cwd ? ` · 작업 폴더 ${s.cwd}` : ''}${s.branch ? ` · 브랜치 ${s.branch}` : ''} · 마지막 기록 ${stamp(s.lastAt, true)}${s.tookOver ? ' · 인수인계로 이어받은 세션' : ''}`, 320));
    out.push('');
  }
  out.push(scoped ? '## 이 범위의 현재 상태' : '## 부분별 현재 상태');
  if (!parts.length) out.push('아직 지도에 부분이 없어요. 아래 최근 흐름과 사용자의 설명에서 시작하세요.');
  const after: string[] = [];
  // What is undecided: candidates the readings left open and what the latest reading could not tell, for this scope.
  const open: string[] = [];
  for (const r of maps) for (const c of r.candidates) {
    if (scoped && !c.areaIds.some(a => scopeIds.has(a))) continue;
    const read = candidateReading(c), names = c.areaIds.map(a => view.parts.find(x => x.id === a)?.name).filter(Boolean);
    open.push(`- ${read.label ? `${read.label}: ` : ''}${one(read.statement?.text ?? c.text)}${names.length ? ` (${one(names.join(', '), 80)})` : ''}`);
  }
  if (!scoped && latest) for (const g of latest.gaps) open.push(`- 기록에서 알 수 없었음: ${one(g)}`);
  if (open.length) after.push('## 아직 정하지 않은 것', ...dedupeLines(open).slice(-12), '');
  // The latest requests the person made in the sessions, with the files changed answering them. A request that started from an
  // earlier handover names it in words, so this document quoting it is not read as that takeover when it is pasted in turn.
  const only = scoped ? new Set(maps.flatMap(r => r.parts.filter(x => scopeIds.has(x.areaId)).flatMap(x => [...x.basis.map(q => q.record), ...x.claims.map(c => c.record)]))) : null;
  const turns = sessionTurns(p, only).slice(-RECENT_REQUESTS);
  if (turns.length) {
    after.push('## 최근 흐름 (사용자가 세션에서 한 요청, 오래된 것부터)');
    for (const t of turns) after.push(`- ${one(quoteReceived(t.text), 300)}${t.files.length ? ` → 바꾼 파일: ${one([...new Set(t.files)].slice(0, 8).join(', '), 300)}` : ''}`);
    const files = [...new Set(turns.flatMap(t => t.files))].slice(-RECENT_FILES);
    if (files.length) after.push('', `최근에 바뀐 파일: ${one(files.join(', '), NAMES)}`);
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
  return { text: compose([...shown, ...names], trimmed ? [`(문서가 길어서 부분 ${trimmed}개는 줄여 적었어요. 빠진 내용은 AgentFlow 지도에 있어요.)`, ''] : []), trimmed };
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
  '[AgentFlow 기록 요청] 이 대화에서 지금까지 내가 한 요청과 네가 한 작업을 아래 형식 그대로 적어 줘. 요약하지 말고 내가 쓴 요청은 원문 그대로 옮기고, 네 답변은 실제로 한 일·바꾼 파일·확인한 것·남은 일을 중심으로 적어 줘. 키·토큰·비밀번호는 [가려진 비밀값]으로 바꿔 줘. 형식 밖의 말은 쓰지 마.',
  '',
  '[웹 AI 세션 기록 · (이 대화의 짧은 제목) · 작업 폴더 (있으면 경로) · 브랜치 (있으면 이름)]',
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
