// Session records as Claude Code and Codex keep them on a PC, written under a home folder for tests (synthetic content).
// Claude Code: one project with a typed prompt, injected context, a tool round trip, a sidechain and a slash command.
// Codex: a current rollout (session_meta / response_item / event_msg, prompts recorded twice) and an early bare one.
import { mkdirSync, writeFileSync, utimesSync } from 'node:fs';
import { join } from 'node:path';

const jsonl = rows => rows.map(r => JSON.stringify(r)).join('\n') + '\n';
const T = (m, s = 0) => `2026-10-28T09:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.000Z`;
export const CLAUDE_PROMPT = '예약 화면에서 휴무일을 영업시간 설정과 연결해 줘';
export const CLAUDE_REPLY = '휴무일을 영업시간 설정에서 읽도록 바꿨어요. 월요일 고정은 지웠고 테스트를 추가했어요.';
export const CODEX_PROMPT = '문자 알림 발송 실패 시 재시도를 넣어 줘';
export const CODEX_REPLY = '발송 실패 시 3번까지 재시도하도록 했어요.';
export const FAKE_KEY = 'sk-' + 'abcdefghijklmnopqrstuvwx';

export function claudeRows(cwd = '/work/salon') {
  const base = { cwd, gitBranch: 'main', sessionId: 'c1', version: '2.1.0', userType: 'external' };
  return [
    { type: 'user', ...base, timestamp: T(0), isMeta: true, message: { role: 'user', content: '<local-command-caveat>Caveat</local-command-caveat>' } },
    { type: 'user', ...base, timestamp: T(1), message: { role: 'user', content: `${CLAUDE_PROMPT}<system-reminder>injected context</system-reminder>` } },
    { type: 'assistant', ...base, timestamp: T(2), message: { role: 'assistant', content: [{ type: 'thinking', thinking: 'private reasoning' }, { type: 'text', text: '먼저 코드를 볼게요.' }, { type: 'tool_use', id: 't1', name: 'Read', input: { file_path: `${cwd}/src/hours.ts` } }] } },
    { type: 'user', ...base, timestamp: T(3), message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'TOOL OUTPUT SHOULD NOT APPEAR' }] } },
    { type: 'assistant', ...base, timestamp: T(4), message: { role: 'assistant', content: [{ type: 'tool_use', id: 't2', name: 'Edit', input: { file_path: `${cwd}/src/hours.ts`, old_string: 'a', new_string: 'b' } }] } },
    { type: 'assistant', ...base, timestamp: T(4, 30), isSidechain: true, message: { role: 'assistant', content: [{ type: 'text', text: 'SIDECHAIN SHOULD NOT APPEAR' }] } },
    { type: 'assistant', ...base, timestamp: T(5), message: { role: 'assistant', content: [{ type: 'tool_use', id: 't3', name: 'Write', input: { file_path: `${cwd}/tests/hours.test.ts`, content: 'x' } }, { type: 'text', text: CLAUDE_REPLY }] } },
    { type: 'user', ...base, timestamp: T(6), message: { role: 'user', content: '<command-name>/review</command-name>\n<command-message>review</command-message>\n<command-args>hours.ts</command-args>' } },
    { type: 'user', ...base, timestamp: T(6, 5), message: { role: 'user', content: '<local-command-stdout>LOCAL OUTPUT SHOULD NOT APPEAR</local-command-stdout>' } },
    { type: 'assistant', ...base, timestamp: T(7), message: { role: 'assistant', content: [{ type: 'text', text: `검토했어요. 설정 파일의 ${FAKE_KEY} 같은 키는 커밋하지 마세요.` }] } },
    { type: 'ai-title', sessionId: 'c1', aiTitle: '휴무일 연결' }
  ];
}
export function codexRows(cwd = '/work/salon') {
  return [
    { timestamp: T(20), type: 'session_meta', payload: { id: 'x1', timestamp: T(20), cwd, originator: 'codex_cli_rs', cli_version: '0.50.0', git: { branch: 'notify' } } },
    { timestamp: T(20, 1), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: `<environment_context>\n  <cwd>${cwd}</cwd>\n</environment_context>` }] } },
    { timestamp: T(20, 2), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: CODEX_PROMPT }] } },
    { timestamp: T(20, 2), type: 'event_msg', payload: { type: 'user_message', message: CODEX_PROMPT, images: [] } },
    { timestamp: T(21), type: 'response_item', payload: { type: 'reasoning', summary: [{ type: 'summary_text', text: 'REASONING SHOULD NOT APPEAR' }] } },
    { timestamp: T(21, 5), type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch', call_id: 'p1', input: '*** Begin Patch\n*** Update File: src/notify.ts\n@@\n-a\n+b\n*** Add File: tests/notify.test.ts\n+x\n*** End Patch' } },
    { timestamp: T(21, 6), type: 'response_item', payload: { type: 'custom_tool_call_output', call_id: 'p1', output: 'PATCH OUTPUT SHOULD NOT APPEAR' } },
    { timestamp: T(22), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: CODEX_REPLY }] } },
    { timestamp: T(22), type: 'event_msg', payload: { type: 'agent_message', message: CODEX_REPLY } }
  ];
}
/** An early rollout: a bare first line and bare items, no events. */
export function codexBareRows() {
  return [
    { id: 'old', timestamp: T(30), instructions: null },
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<user_instructions>\nrules\n</user_instructions>' }] },
    { type: 'message', role: 'user', content: [{ type: 'input_text', text: '관리자 목록 정렬을 날짜순으로' }] },
    { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '날짜 내림차순으로 바꿨어요.' }] }
  ];
}

/** Writes both tools' folders under home, the Claude session newest. Returns the roots openSessions takes. */
/** The synthetic session files as they lie under a home folder: [root, path inside it, text, modified time (ms)]. */
export function sessionFiles() {
  const at = n => Date.parse('2026-10-28T10:00:00Z') + n;
  return [
    ['.codex', 'sessions/2026/10/28/rollout-2026-10-28T09-00-00-old.jsonl', jsonl(codexBareRows()), at(1000)],
    ['.codex', 'sessions/2026/10/28/rollout-2026-10-28T09-20-00-x1.jsonl', jsonl(codexRows()), at(2000)],
    ['.claude', 'projects/-work-salon/c1.jsonl', jsonl(claudeRows()), at(3000)],
    // A file with no prompt (only injected context) is not listed.
    ['.claude', 'projects/-work-salon/empty.jsonl', jsonl([claudeRows()[0]]), at(4000)]
  ];
}
export function writeSessionHome(home) {
  for (const [root, path, text, at] of sessionFiles()) {
    const f = join(home, root, ...path.split('/'));
    mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, text); utimesSync(f, new Date(at), new Date(at));
  }
  return { claude: join(home, '.claude'), codex: join(home, '.codex') };
}
// `node sessions-fixture.mjs` prints the files as JSON (the browser flow builds a picked folder from them).
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop())) console.log(JSON.stringify(sessionFiles()));
