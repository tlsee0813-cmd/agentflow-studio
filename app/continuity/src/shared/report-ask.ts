/* The status-report request: the words a person pastes into the AI session that knows their project (a supervising session,
 * one that can read the files, or a chat that only heard about it), so that session writes the report the map reads best:
 * the units the project names, what holds what, every arrow with what it hands over, the state of each unit with the kind of
 * evidence behind it, withdrawn decisions, the next gate, and what it does not know. Three shapes: with file access, chat only,
 * and the delta since the last report (built from the current map, so the names match). Nothing here is sent to any model:
 * the person carries the words. */
import type { StudioView } from './studio.js';
import { STATUS_SHORT } from './studio.js';
import { stateLabel } from './map-reading.js';
import type { ReadingEntry } from './types.js';
import { isMapReading } from './types.js';

/** The tags the report marks its sentences with; the map reads [실행] as checked and [보고] as reported. */
export const REPORT_TAGS = ['[파일: 경로]', '[보고: 출처·날짜]', '[실행: 명령]', '[추정]', '[모름]'] as const;
export const REPORT_ASK_VERSION = 'v2';

/** With file access: the full report. Sections in the order the map reads them; a withdrawal table before the cut (the first
 * reading takes the first 12,000 characters); an upper bound only, since a lower bound makes an AI fill the room. No example
 * values: an example is copied. */
export const PROJECT_REPORT_ASK = `[AgentFlow 현황 기록 요청 ${REPORT_ASK_VERSION}]
이 프로젝트를 처음 보는 사람이 이어서 일할 수 있게 지금 상태를 보고서로 써 줘. 아래 제목과 순서를 지키고 12,000자를 넘기지 마. 할 말이 적으면 짧아도 된다. 모르는 것은 지어내지 말고 [모름]으로 남겨. 빈 칸이 꾸민 칸보다 낫다.

근거 표시 — 모든 문장·표 줄 끝에 하나:
[파일: 경로] 지금 직접 읽은 파일 / [보고: 출처·날짜] 다른 세션·문서·사람의 말을 옮김 / [실행: 명령] 네가 이 대화에서 직접 돌린 것과 그 결과 / [추정] 네 판단 / [모름]
‘통과·OK·완료’는 [실행]이 아니면 모두 인용이다.

0. 기준: 오늘 날짜, 브랜치·커밋 sha·버전, 파일을 읽을 수 있는지, 이 대화의 앞부분이 요약됐는지.
1. 한 줄 요약: 무엇을 위한 것이고 지금 어디까지 왔나.
2. 부분(표): 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태(돌고 있음/작업 중/미구현/멈춤/폐기/모름) | 근거. 이름은 프로젝트가 부르는 그대로. 파일 하나하나가 아니라 맡은 일 단위로 5~25개. 묶음은 표 아래에 “A 안에 B·C”로, 없으면 없다고.
3. 연결(한 줄에 하나): A → B: 넘기는 것 (언제·얼마나 자주) [설계] 또는 [관찰]. [설계]는 코드·문서상의 흐름, [관찰]은 실제로 돈 것을 본 경우. 둘이 다르면 둘 다. 사람(소유자 등)에게 보고하거나 사람이 지시하는 화살표도 넣어.
4. 최근 소유자 요청과 실제 변화(표): 날짜 | 원한 것(원문 짧게 따옴표) | 실제로 바뀐 것 | 확인 방법.
5. 철회·변경(표): 옛 결정 → 지금 → 근거·날짜. 철회·폐기·채택 안 함을 빠뜨리지 마.
6. 지켜야 할 요구사항과 하지 않기로 한 것: 한 줄에 하나.
7. 오류·미해결·할 일: 부분 이름을 앞에.
8. 다음 관문: “무엇이 확인되면 → 무엇을 한다” 2~5줄.
9. 모르는 것: 무엇을, 어떻게 확인할 수 있나.
10. 가장 자신 없는 내용 3가지.
여러 작업 세션을 감독하는 세션이면 각 세션의 말은 [보고: 세션 이름]으로.

키·토큰·비밀번호·접속 주소의 비밀 부분·경로 속 사용자 이름은 [가림]으로 바꿔. .env 같은 비밀 파일은 열지 마. 이 요청문은 옮기지 말고 보고서 밖의 말은 쓰지 마.`;

/** Chat only: the session cannot read the files, so [파일] and [실행] are not allowed; whoever said "done" is named. */
export const CHAT_REPORT_ASK = `[AgentFlow 대화 기록 요청 ${REPORT_ASK_VERSION}]
너는 이 프로젝트의 파일을 볼 수 없다고 가정하고, 이 대화에서 오간 내용만으로 지금 상태를 보고서로 써 줘. 12,000자 이하, 지어내지 말고 모르면 [모름].
근거 표시 — 줄마다 하나: [대화: 언제쯤·누가] 이 대화에서 나온 말 / [붙임] 내가 붙여 준 코드·로그 / [추정] / [모름]. [파일]·[실행]은 쓰지 마. ‘됐다·통과’는 누가 말했는지 적어.
0. 기준: 오늘 날짜, 이 대화가 시작된 때, 앞부분이 요약·잘렸는지.
1. 한 줄 요약.
2. 부분(표): 이름(대화에서 부른 그대로) | 하는 일 | 언급된 파일 이름(없으면 [모름]) | 상태 | 근거. 묶음은 “A 안에 B·C”.
3. 연결: A → B: 넘기는 것 (언제) — 대화에서 설명된 것만.
4. 내가 원한 것(원문 짧게) | 네가 했다고 한 것 | 내가 확인했다고 말한 것.
5. 철회·변경(표): 옛 결정 → 지금 → 언제·누가.
6. 지켜야 할 것. 7. 미해결·할 일. 8. 다음 관문(무엇이 확인되면 → 무엇을). 9. 모르는 것.
비밀값은 [가림]. 이 요청문은 옮기지 마.`;

/** What the person gets, beside the copy button. */
export const REPORT_ASK_EXPLAIN = '프로젝트를 보고 있는 AI 대화(감독 세션 등)에 붙여 넣으면, 그 AI가 부분 목록·연결 화살표·상태·철회된 결정·모르는 것·다음 관문을 적은 보고서를 써 줘요. 문장마다 [파일]·[보고]·[실행]·[추정]·[모름]이 붙어 있어서 지도는 직접 확인된 것과 누가 그렇다고 한 것을 나눠 그려요. 답이 짧아도 괜찮아요. 붙여 넣기 전에 키·토큰이 [가림]으로 바뀌었는지 한 번 봐 주세요.';

/** The delta request, built from the current map so the names match: each part with the state the map holds, the gaps and
 * unsettled statements of the last reading as the open questions, with "still unknown" and "could not check" as answers the
 * session may give (a pointed question invites an invented answer). */
export function deltaReportAsk(view: StudioView, readings: readonly ReadingEntry[], at: Date = new Date()): string {
  const last = [...readings].filter(isMapReading).at(-1) ?? null;
  const name = (id: string) => view.parts.find(p => p.id === id)?.name ?? id;
  // The state as the map shows it: what the records said (a reported state) before the bare "planned" of a part without a request.
  const state = (id: string) => { const p = view.parts.find(x => x.id === id); return !p ? '모름' : p.status === 'plan' ? (p.reading ? stateLabel(p.reading) : null) ?? STATUS_SHORT.plan : STATUS_SHORT[p.status]; };
  const roots = view.roots.map(id => `- ${name(id)} — ${state(id)}${(view.parts.find(p => p.id === id)?.childIds.length ?? 0) ? ` (안에 ${view.parts.find(p => p.id === id)!.childIds.map(name).join('·')})` : ''}`);
  const open = [...(last?.gaps ?? []), ...(last?.candidates.map(c => c.text) ?? [])].slice(0, 8).map(t => `- ${t}`);
  const when = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return `[AgentFlow 변경 기록 요청 ${REPORT_ASK_VERSION} · 지난 기준: ${last ? last.at.slice(0, 10) : when}]
지난 보고 이후 바뀐 것만 써 줘. 6,000자 이하. 근거 표시는 지난번과 같다: [파일: 경로] [보고: 출처] [실행: 명령] [추정] [모름]. ‘통과’는 [실행]이 아니면 인용.
아래 부분 이름을 그대로 써. 이름이 바뀌었으면 “옛 이름 → 새 이름”.
${roots.join('\n') || '- (아직 부분이 없음)'}
부분마다 한 줄: 상태 전→후 (근거) / 바뀐 것 없음 / 확인 못 함 중 하나.
그다음:
- 새 부분: 이름 — 어디 안에 — 담당 파일
- 없어진 부분·연결
- 새 연결: A → B: 넘기는 것 [설계]/[관찰]
- 철회·변경: 옛 결정 → 지금 → 근거·날짜
- 지난번 비어 있던 것: 풀렸으면 무엇으로·근거, 아니면 “여전히 모름”
${open.join('\n')}
- 다음 관문: 지난 관문은 어떻게 됐나, 새 관문
- 새 기준: 날짜·sha
비밀값은 [가림]. 지난 보고를 다시 쓰지 마.`;
}

/** The first reading takes this many characters of a record; a report longer than that is read in later passes. */
export const REPORT_FIRST_CHARS = 12000;
const TAG = /\[(파일|보고|실행|추정|모름|대화|붙임)(:[^\]]*)?\]/g;
/** An arrow line is marked [설계] or [관찰] in place of an evidence tag: it counts as tagged. */
const LINE_TAG = /\[(파일|보고|실행|추정|모름|대화|붙임|설계|관찰)(:[^\]]*)?\]/;
const PASS = /통과|\bOK\b|rc 0|완료|성공/;
const SECTIONS: [string, RegExp][] = [['부분', /부분/], ['연결', /연결|→/], ['철회·변경', /철회|변경/], ['다음 관문', /다음 관문/], ['모르는 것', /모르는 것|\[모름\]/]];
export interface ReportCheck {
  chars: number;
  /** Lines of content with at least one evidence tag, and without one (headings, table rules and short lines are not counted). */
  tagged: number; untagged: number;
  /** Lines that say a pass (통과·OK·rc 0·완료·성공) with no [실행] and no [보고] tag: a pass nobody vouches for. */
  passesUnrun: number;
  /** Sections the request asked for that the text does not seem to have. */
  missing: string[];
  /** Sections that begin past the first reading's cut. */
  cut: string[];
}
/** What a pasted report looks like against the request, or null when the text does not read as one (fewer than five tags): a
 * transcript or a plain note is checked by nothing here. */
export function checkReport(text: string): ReportCheck | null {
  const tags = text.match(TAG); if (!tags || tags.length < 5) return null;
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length >= 12 && !/^[|\-:\s]+$/.test(l) && !/^(#+\s|\d+\.\s)/.test(l));
  let tagged = 0, untagged = 0, passesUnrun = 0;
  for (const l of lines) {
    if (LINE_TAG.test(l)) tagged++; else untagged++;
    if (PASS.test(l) && !/\[실행/.test(l) && !/\[보고/.test(l) && !/\[대화/.test(l)) passesUnrun++;
  }
  const missing = SECTIONS.filter(([, re]) => !re.test(text)).map(([n]) => n);
  const cut = text.length > REPORT_FIRST_CHARS ? SECTIONS.filter(([, re]) => { const m = re.exec(text); return !!m && m.index >= REPORT_FIRST_CHARS; }).map(([n]) => n) : [];
  return { chars: text.length, tagged, untagged, passesUnrun, missing, cut };
}
/** The check in one quiet line, and the line to paste back into the AI chat when something should be written again. */
export function reportCheckLine(c: ReportCheck): { text: string; again: string | null } {
  const parts = [`꼬리표 있는 줄 ${c.tagged}`, c.untagged ? `없는 줄 ${c.untagged}` : '', c.passesUnrun ? `[실행]·[보고] 없는 통과 ${c.passesUnrun}` : '', c.missing.length ? `빠진 절: ${c.missing.join('·')}` : '', c.cut.length ? `${REPORT_FIRST_CHARS.toLocaleString()}자 넘음: ${c.cut.join('·')}은 첫 읽기 밖` : ''].filter(Boolean);
  const again = [c.untagged > c.tagged / 4 ? '꼬리표 없는 문장마다 [파일]/[보고]/[실행]/[추정]/[모름] 하나를 붙여 다시 써 줘.' : '', c.passesUnrun ? '네가 직접 돌리지 않은 통과·OK·완료는 [보고: 출처]로 표시해 줘.' : '', c.missing.length ? `${c.missing.join('·')} 절을 채워 줘(없으면 없다고).` : '', c.cut.length ? `${REPORT_FIRST_CHARS.toLocaleString()}자 안에 들도록 줄이되 ${c.cut.join('·')}은 남겨 줘.` : ''].filter(Boolean).join(' ');
  return { text: `보고서 점검 · ${parts.join(' · ')}`, again: again || null };
}

/** The three lines only the person can write (no AI knows them): what they want next, which report they do not trust, which
 * decision they themselves reversed. Saved as a record of its own, marked as the person's own words, so a reading gives them
 * the authority of a request. */
export const OWN_LINES = ['다음에 원하는 것', '믿지 못하는 보고', '직접 뒤집은 결정'] as const;
export function ownLinesTemplate(at: Date = new Date()): string {
  const when = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`;
  return [`[프로젝트 소유자가 직접 적음 · ${when}]`, ...OWN_LINES.map(l => `${l}: `)].join('\n');
}

/** A relation the record states as a plan (its note says so): drawn as planned, never as a flow that runs. */
export const plannedNote = (note: string) => /계획|예정|할 것이다|지시할/.test(note);

/** The map's understanding, numbered, for the AI that knows the project to correct line by line: the summary, each part with
 * its description, each relation with what it hands over, the gaps. Only wrong lines come back, with the record behind the
 * correction; nothing new is asked for, so nothing new is invented. */
export function reflectAsk(view: StudioView, readings: readonly ReadingEntry[]): string {
  const last = [...readings].filter(isMapReading).at(-1) ?? null, name = (id: string) => view.parts.find(p => p.id === id)?.name ?? id;
  const lines: string[] = [];
  if (last?.summary) lines.push(`요약: ${last.summary}`);
  for (const p of view.parts) { const role = p.reading?.role ?? p.summary ?? p.note; lines.push(`부분 ${name(p.id)}${p.parentId ? ` (${name(p.parentId)} 안)` : ''}: ${role ? role.replace(/\s+/g, ' ').slice(0, 160) : '설명 없음'}`); }
  for (const rel of view.relations) lines.push(`연결 ${name(rel.from)} → ${name(rel.to)}: ${rel.note || rel.kind}`);
  for (const g of last?.gaps ?? []) lines.push(`빈틈: ${g}`);
  const body = lines.slice(0, 60).map((l, i) => `${i + 1}. ${l}`).join('\n');
  return `[AgentFlow 이해 확인 요청 ${REPORT_ASK_VERSION}]
아래는 지도가 기록에서 읽은 것이다. 틀린 줄만 「번호: 맞는 내용 (근거: [파일]/[보고]/[실행]/[모름])」로 고쳐 답하고, 맞는 줄은 쓰지 마. 모르면 「번호: 확인 못 함」. 새로 지어내거나 없는 줄을 더하지 마. 비밀값은 [가림].
${body}`;
}
