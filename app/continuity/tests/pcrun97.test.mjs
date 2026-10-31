// What a run on a real PC (this repository's own Claude Code sessions, connected through the folder list) showed in the handover
// document, each reproduced here first, then closed:
//   1. a session another Claude started (a project's thread) was named by the relayed mark alone: 「(다른 Claude가 전달한 지시) Agen…」;
//   2. a scratch file the tool wrote outside the working folder was listed with the project's changed files, by its whole path;
//   3. an answer was shown from a cut in the middle of a word ("…27.0.0.1:4317`. My analysis…"), so what was done did not read;
//   4. requests before the latest ones were left out with nothing saying so, so the first one listed read as where the work began.
// (The folder list splitting one repository in two is checked in studio_browser.py, where the list is drawn.)
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import { sessionText } from '../dist/public/shared/session-import.js';
import { RELAYED } from '../dist/public/shared/session-parse.js';
import { handoverText, sessionOrigin, sessionName } from '../dist/public/shared/handover.js';

const ID = 'claude-0123456789abcdef01234567', AT = '2026-10-31T06:00:00.000Z';
const T = m => new Date(Date.parse('2026-10-31T01:00:00.000Z') + m * 60000).toISOString();
const session = (turns, extra = {}) => ({ id: ID, tool: 'claude', label: '', title: null, cwd: 'C:\\work\\agentflow-studio', branch: 'main', startedAt: T(0), turns, omitted: 0, ...extra });
const project = (...texts) => texts.reduce((p, t) => D.pasteRecord(p, t, null).project, D.createProject());
const flow = t => t.slice(t.indexOf('## 최근 흐름')).split('\n\n')[0].split('\n');
const doc = p => handoverText(p, { scope: null, code: 'PCR234', at: AT });

test('PCRUN-1 a session another Claude started is named by the first request the person typed, else by the relayed words', () => {
  const relayed = `${RELAYED} AgentFlow Studio 저장소를 대상으로 처음부터 끝까지 확인해 주세요.`;
  const both = project(sessionText(session([
    { role: 'user', at: T(0), text: relayed }, { role: 'assistant', at: T(1), text: '확인했어요.' },
    { role: 'user', at: T(2), text: '키는 app/.env에 넣어 뒀어' }, { role: 'assistant', at: T(3), text: '다시 켰어요.' }])).text);
  const t = doc(both);
  assert.ok(t.includes('- Claude Code 「키는 app/.env에 넣어 뒀어」 · 작업 폴더 C:\\work\\agentflow-studio'), t);
  assert.equal(sessionName(both, sessionOrigin(both.pasted[0].text)), 'Claude Code 「키는 app/.env에 넣어 뒀어」');
  // Only relayed requests: their own words, not the mark that fills the name.
  const only = project(sessionText(session([{ role: 'user', at: T(0), text: relayed }, { role: 'assistant', at: T(1), text: '확인했어요.' }])).text);
  assert.equal(sessionName(only, sessionOrigin(only.pasted[0].text)), 'Claude Code 「AgentFlow Studio 저장소를 대상…」');
  assert.ok(!doc(only).includes(`「${RELAYED}`), doc(only));
  // The person's own request in a later record of the same session names it once it comes in.
  const later = project(sessionText(session([{ role: 'user', at: T(0), text: relayed }, { role: 'assistant', at: T(1), text: '확인했어요.' }])).text,
    sessionText(session([{ role: 'user', at: T(5), text: '지도도 만들어 줘' }, { role: 'assistant', at: T(6), text: '만들었어요.' }])).text);
  assert.equal(sessionName(later, sessionOrigin(later.pasted[0].text)), 'Claude Code 「지도도 만들어 줘」');
});

test('PCRUN-2 a file changed outside the working folder is counted in the recent flow, not listed by its path', () => {
  const scratch = 'C:\\Users\\me\\AppData\\Local\\Temp\\claude\\scratchpad\\probe.mjs';
  const p = project(sessionText(session([
    { role: 'user', at: T(0), text: '연결기 확인해 줘' }, { role: 'assistant', at: T(1), text: '확인했어요.', files: ['app/continuity/src/shared/handover.ts', scratch] },
    { role: 'user', at: T(2), text: '분석 스크립트만 돌려 줘' }, { role: 'assistant', at: T(3), text: '돌렸어요.', files: [scratch] }])).text);
  const t = doc(p);
  assert.ok(!t.includes('AppData') && !t.includes('scratchpad'), t);
  assert.deepEqual(flow(t).slice(1).filter(l => l.startsWith('- ')), [
    '- 연결기 확인해 줘 → 바꾼 파일: app/continuity/src/shared/handover.ts (그 밖에 작업 폴더 밖 파일 1개)',
    '- 분석 스크립트만 돌려 줘 → 바꾼 파일: 작업 폴더 밖 파일 1개']);
  // The record keeps the whole path: only the document, which the next session takes as the project's, leaves it out.
  assert.ok(p.pasted[0].text.includes(scratch));
});

test('PCRUN-3 an answer is shown from where a sentence or paragraph starts, ending where it ends', () => {
  const said = '변경 사항을 확인했어요. 서버는 http://127.0.0.1:4317 에서 다시 켰고 자동 연결도 그대로예요. 분석 스크립트는 임시 폴더에 두었어요. '.repeat(3)
    + '남은 일: 지도 정리는 AI 키가 생기면 이어서 해요.';
  const p = project(sessionText(session([{ role: 'user', at: T(0), text: '확인해 줘' }, { role: 'assistant', at: T(1), text: said }])).text);
  const line = flow(doc(p)).find(l => l.startsWith('  - 답변: '));
  assert.ok(line.startsWith('  - 답변: … ') && line.endsWith('남은 일: 지도 정리는 AI 키가 생기면 이어서 해요.') && line.length <= 215, line);
  // From the start of a sentence, not inside a word.
  const from = line.slice('  - 답변: … '.length);
  assert.ok(said.includes(from) && ['변경 사항', '서버는', '분석 스크립트', '남은 일'].some(w => from.startsWith(w)), from);
  // Paragraphs that fit are kept whole: the last ones, as they were written.
  const paras = project(sessionText(session([{ role: 'user', at: T(0), text: '확인해 줘' }, { role: 'assistant', at: T(1), text: `${'처음 확인한 것. '.repeat(20)}\n\n테스트는 모두 통과했어요.\n\n남은 일은 없어요.` }])).text);
  assert.ok(flow(doc(paras)).includes('  - 답변: … 테스트는 모두 통과했어요. 남은 일은 없어요.'), doc(paras));
});

test('PCRUN-4 the requests before the latest ones are said to be left out', () => {
  const asks = Array.from({ length: 8 }, (_, i) => [{ role: 'user', at: T(i * 2), text: `${i + 1}단계 해 줘` }, { role: 'assistant', at: T(i * 2 + 1), text: '했어요.' }]).flat();
  const lines = flow(doc(project(sessionText(session(asks)).text)));
  assert.equal(lines[1], '(그 앞의 요청 2개는 이 문서에 넣지 않았어요. 필요하면 사용자에게 물어보세요.)');
  assert.equal(lines[2], '- 3단계 해 줘');
  // Six or fewer: nothing is said.
  assert.ok(!doc(project(sessionText(session(asks.slice(0, 12))).text)).includes('그 앞의 요청'));
});
