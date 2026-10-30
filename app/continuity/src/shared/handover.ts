/* A handover document: what a new AI session needs to carry this project (or one part of it) on, made from what the map and the
 * records already hold. Nothing is asked of a model and nothing is added: reports stay reports, open choices stay open. The document
 * carries a marker (af-handover:CODE[:part]) so that a session which starts from it is known as the one that took it over, and the
 * document itself is not taken back in as a new record of work (foldHandover). */
import { isMapReading, type ClaimKind, type MapReading, type Project } from './types.js';
import { CLAIM_LABEL, candidateReading } from './map-reading.js';
import { studioView, type PartView, type StudioView } from './studio.js';
import { REL_LABEL } from './relation-groups.js';
import { TOOL_NAME, stamp } from './session-import.js';
import { HANDOVER_TAG, receivedHandovers } from './handover-mark.js';
export { HANDOVER_TAG, foldHandover, handoverCode, receivedHandovers } from './handover-mark.js';

/* ---------- which session a record came from ---------- */
export interface SessionOrigin { id: string | null; tool: 'claude' | 'codex'; title: string | null; cwd: string | null; branch: string | null }
const HEAD = /^\[(Claude Code|Codex) 세션 기록(?: · ([^\n]*))?\]/;
/** The session a record was taken from (its header line, session-import.ts), or null for any other record. */
export function sessionOrigin(text: string): SessionOrigin | null {
  const m = HEAD.exec(text); if (!m) return null;
  const tool = m[1] === 'Codex' ? 'codex' : 'claude', fields = (m[2] ?? '').split(' · ');
  const field = (prefix: string) => fields.find(f => f.startsWith(prefix))?.slice(prefix.length).trim() || null;
  const id = field('세션 '), known = /^(작업 폴더 |브랜치 |세션 |\d{4}-\d{2}-\d{2} \d{2}:\d{2} 시작$)/;
  const title = fields.filter(f => f && !known.test(f)).join(' · ') || null;
  return { id: id && /^(claude|codex)-[0-9a-f]{24}$/.test(id) ? id : null, tool, title, cwd: field('작업 폴더 '), branch: field('브랜치 ') };
}
const originKey = (o: SessionOrigin) => o.id ?? `${o.tool}|${o.title ?? ''}|${o.cwd ?? ''}`;
export const originLabel = (o: Pick<SessionOrigin, 'tool' | 'title'>) => `${TOOL_NAME[o.tool]}${o.title ? ` 「${o.title}」` : ' 세션'}`;

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
const CLAIM_ORDER: ClaimKind[] = ['want', 'idea', 'reported', 'checked', 'describes', 'open', 'differs'];
const CLAIMS_PER_PART = 10, RECENT_REQUESTS = 6, RECENT_FILES = 24, LINE = 240;
const one = (t: string, n = LINE) => { const s = t.replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

function subtree(view: StudioView, id: string): PartView[] {
  const out: PartView[] = [], walk = (x: string) => { const part = view.parts.find(q => q.id === x); if (!part) return; out.push(part); part.childIds.forEach(walk); };
  walk(id); return out;
}
function partBlock(p: Project, view: StudioView, part: PartView, top: number): string[] {
  const lines = [`${'#'.repeat(Math.min(6, 3 + part.depth - top))} ${part.name}`];
  const u = part.reading;
  const role = u?.role ?? part.summary ?? null;
  if (role) lines.push(`역할: ${one(role, 400)}${u?.corrected ? ' (사용자가 고친 설명)' : ''}`);
  if (part.note) lines.push(`사용자 메모: ${one(part.note, 400)}`);
  const claims = (u?.claims ?? []).slice().sort((a, b) => CLAIM_ORDER.indexOf(a.kind) - CLAIM_ORDER.indexOf(b.kind));
  for (const c of claims.slice(0, CLAIMS_PER_PART)) lines.push(`- ${CLAIM_LABEL[c.kind]}: ${one(c.text)}${c.about ? ` (${c.about})` : ''}`);
  if (claims.length > CLAIMS_PER_PART) lines.push(`- (그 밖에 ${claims.length - CLAIMS_PER_PART}개는 지도에서 볼 수 있어요)`);
  if (!role && !part.note && !claims.length) lines.push('- 아직 이 부분에 대해 읽힌 내용이 없어요.');
  const rels = view.relations.filter(r => r.from === part.id || r.to === part.id).map(r => {
    const out = r.from === part.id, other = view.parts.find(x => x.id === (out ? r.to : r.from));
    return other ? `${out ? '→' : '←'} ${other.name} (${REL_LABEL[r.kind] ?? r.kind}${r.note ? ` · ${one(r.note, 80)}` : ''})` : null;
  }).filter(Boolean);
  if (rels.length) lines.push(`관련: ${rels.join(', ')}`);
  const sessions = partSessions(p, part.id);
  if (sessions.length) lines.push(`다룬 세션: ${sessions.slice(0, 4).map(s => `${originLabel(s)}${s.tookOver ? ' (인수인계로 이어받음)' : ''}`).join(', ')}`);
  return lines;
}

interface Turn { at: string; text: string; files: string[]; origin: SessionOrigin }
/** The person's requests in session records, oldest first, with the files the tool's next answer reported changing. */
function sessionTurns(p: Project, only: Set<string> | null): Turn[] {
  const out: Turn[] = [];
  for (const rec of p.pasted) {
    if (only && !only.has(rec.id)) continue;
    const origin = sessionOrigin(rec.text); if (!origin) continue;
    const parts = rec.text.split(/^── /m).slice(1);
    for (const part of parts) {
      const nl = part.indexOf('\n'), head = part.slice(0, nl), body = part.slice(nl + 1).trim();
      if (head.startsWith('사용자 요청')) out.push({ at: `${rec.at}|${out.length}`, text: body, files: [], origin });
      else { const f = /\(바꾼 파일: ([^)\n]+)\)\s*$/.exec(body); const last = out.at(-1); if (f && last) last.files.push(...f[1]!.split(', ')); }
    }
  }
  return out;
}

/** The document for the whole project (scope null) or one part with everything inside it. */
export function handoverText(p: Project, opts: HandoverOptions): string {
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
  const scopeIds = new Set(parts.map(x => x.id));
  const sessions = scoped ? dedupe(parts.flatMap(x => partSessions(p, x.id))) : partSessions(p, null);
  if (sessions.length) {
    out.push('## 작업 장소와 세션');
    for (const s of sessions.slice(0, 8)) out.push(`- ${originLabel(s)}${s.cwd ? ` · 작업 폴더 ${s.cwd}` : ''}${s.branch ? ` · 브랜치 ${s.branch}` : ''} · 마지막 기록 ${stamp(s.lastAt, true)}${s.tookOver ? ' · 인수인계로 이어받은 세션' : ''}`);
    out.push('');
  }
  out.push(scoped ? '## 이 범위의 현재 상태' : '## 부분별 현재 상태');
  if (!parts.length) out.push('아직 지도에 부분이 없어요. 아래 최근 흐름과 사용자의 설명에서 시작하세요.');
  const top = scoped ? scoped.depth : 0;
  for (const part of parts) out.push(...partBlock(p, view, part, top), '');
  // What is undecided: candidates the readings left open and what the latest reading could not tell, for this scope.
  const open: string[] = [];
  for (const r of maps) for (const c of r.candidates) {
    if (scoped && !c.areaIds.some(a => scopeIds.has(a))) continue;
    const read = candidateReading(c), names = c.areaIds.map(a => view.parts.find(x => x.id === a)?.name).filter(Boolean);
    open.push(`- ${read.label ? `${read.label}: ` : ''}${one(read.statement?.text ?? c.text)}${names.length ? ` (${names.join(', ')})` : ''}`);
  }
  if (!scoped && latest) for (const g of latest.gaps) open.push(`- 기록에서 알 수 없었음: ${one(g)}`);
  if (open.length) out.push('## 아직 정하지 않은 것', ...dedupeLines(open).slice(-12), '');
  // The latest requests the person made in the sessions, with the files changed answering them.
  const only = scoped ? new Set(maps.flatMap(r => r.parts.filter(x => scopeIds.has(x.areaId)).flatMap(x => [...x.basis.map(q => q.record), ...x.claims.map(c => c.record)]))) : null;
  const turns = sessionTurns(p, only).slice(-RECENT_REQUESTS);
  if (turns.length) {
    out.push('## 최근 흐름 (사용자가 세션에서 한 요청, 오래된 것부터)');
    for (const t of turns) out.push(`- ${one(t.text, 300)}${t.files.length ? ` → 바꾼 파일: ${[...new Set(t.files)].slice(0, 8).join(', ')}` : ''}`);
    const files = [...new Set(turns.flatMap(t => t.files))].slice(-RECENT_FILES);
    if (files.length) out.push('', `최근에 바뀐 파일: ${files.join(', ')}`);
    out.push('');
  }
  out.push(`──────── 인수인계 문서 끝 · ${HANDOVER_TAG}:${opts.code} ────────`);
  return out.join('\n');
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
