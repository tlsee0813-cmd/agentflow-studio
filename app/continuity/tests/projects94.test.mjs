// Sessions a Claude project drives, as their files hold them on a real PC (2026-10-31): Remote Control's wake has no thread in it,
// and the coordinator's relays are lines of their own (promptSource 'system'). Read as the person's words and as requests.
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseClaude } from '../server/sessions.mjs';
import { sessionDetail } from '../dist/public/shared/session-parse.js';
import { sessionText, readSessionDetail } from '../dist/public/shared/session-import.js';

const at = m => `2026-10-31T11:${String(m).padStart(2, '0')}:00.000Z`;
const top = { userType: 'external', entrypoint: 'claude-desktop', isSidechain: false, cwd: '/w' };
const human = (m, content) => ({ type: 'user', ...top, timestamp: at(m), turnOrigin: 'human', origin: { kind: 'human' }, promptSource: 'sdk', message: { role: 'user', content } });
const relay = (m, content, extra = {}) => ({ type: 'user', ...top, timestamp: at(m), turnOrigin: 'peer', origin: { kind: 'task-notification', subkind: 'projects-relay' }, promptSource: 'system', message: { role: 'user', content }, ...extra });
const reply = (m, text) => ({ type: 'assistant', ...top, timestamp: at(m), message: { role: 'assistant', content: [{ type: 'text', text }] } });
const FIXED = '\n  The note below was written by the coordinator session, a Claude session, not by your user.\n  ';

test('PROJECTS-1 a Remote Control wake (the message right in the project) is read as the person\'s words', () => {
  const rc = `<wake reason="mention" current-time="${at(0)}">\n<project id="chan_x" type="project">\n<message trigger="true" from="human" trust="principal" author-id="u" id="cmsg_x" sent-at="${at(0)}" mention="true">검토는 이렇대&#x9;어떻게 생각해?</message>\n</project>\n</wake>`;
  assert.deepEqual(parseClaude([human(0, rc), reply(1, '맞아요.')]).turns.map(t => [t.role, t.text]), [['user', '검토는 이렇대\t어떻게 생각해?'], ['assistant', '맞아요.']]);
  // Only that whole shape: a message followed by more of the person's own text stays as typed.
  const more = `${rc}\n이건 뭐야?`;
  assert.deepEqual(parseClaude([human(0, more)]).turns.map(t => t.text), [more]);
});

test('PROJECTS-2 work another Claude handed on is a request of its own: its replies are not joined to the reply before it, nor dated by it', () => {
  const rows = [
    relay(0, `<relay from="coordinator" session="s" current-time="${at(0)}" reason="spawn">${FIXED}<note>저장소를 검토해 줘</note></relay>`, { isMeta: true, parentUuid: null, turnOrigin: 'system', origin: undefined }),
    reply(1, '검토했어요.'),
    human(2, `<wake reason="mention" current-time="${at(2)}">\n<project id="c" type="project">\n<thread ts="t">\n<message trigger="true" from="human" trust="principal" id="m">좋아</message>\n</thread>\n</project>\n</wake>`),
    reply(3, '네.'),
    relay(40, `<relay from="coordinator" session="s" current-time="${at(40)}">${FIXED}<note>PC에서 확인해 줘 &amp; 고쳐 줘</note></relay>`),
    reply(41, '확인했어요.'), reply(45, '고쳤어요.'),
    relay(50, `<coordinator-relay>\n<relay from="coordinator" session="s"><cited author="user" name="leek">그래 확인해봐</cited><cited author="coordinator">전달했어요</cited><note>이어서</note></relay>\n</coordinator-relay>`),
    reply(51, '이어서 했어요.')
  ];
  assert.deepEqual(parseClaude(rows).turns.map(t => [t.role, t.text, t.at]), [
    ['user', '(다른 Claude가 전달한 지시) 저장소를 검토해 줘', at(0)], ['assistant', '검토했어요.', at(1)],
    ['user', '좋아', at(2)], ['assistant', '네.', at(3)],
    ['user', '(다른 Claude가 전달한 지시) PC에서 확인해 줘 & 고쳐 줘', at(40)], ['assistant', '확인했어요.\n\n고쳤어요.', at(41)],
    ['user', '그래 확인해봐\n\n(다른 Claude가 전달한 지시) 이어서', at(50)], ['assistant', '이어서 했어요.', at(51)]]);
  // The queue's own copy of a relay (type queue-operation) is not read again.
  assert.equal(parseClaude([{ type: 'queue-operation', operation: 'enqueue', timestamp: at(39), content: rows[4].message.content }, ...rows]).turns.length, 8);
  // A relay the person typed or pasted in their own message stays as typed.
  const pasted = '<relay from="coordinator"><note>이거 왜 남아?</note></relay>';
  assert.deepEqual(parseClaude([human(0, pasted)]).turns.map(t => t.text), [pasted]);
  // And the record says so.
  const text = sessionText(readSessionDetail(JSON.parse(JSON.stringify(sessionDetail('claude-' + 'a'.repeat(24), 'claude', parseClaude(rows)))))).text;
  assert.ok(text.includes('── 사용자 요청 · 11:40 ──\n(다른 Claude가 전달한 지시) PC에서 확인해 줘 & 고쳐 줘'), text);
});
