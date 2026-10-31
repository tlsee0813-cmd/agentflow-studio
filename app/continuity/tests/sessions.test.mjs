// Local session records: Claude Code / Codex files read into turns, the sessions service and routes, and the record text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, utimesSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseClaude, parseCodex, openSessions, SESSION_ID, SESSION_LIMITS } from '../server/sessions.mjs';
import { createStudioHandler } from '../server/studio.mjs';
import { sessionText, readSessionList, readSessionDetail } from '../dist/public/shared/session-import.js';
import { secretLike, redactSecrets } from '../dist/public/shared/secret.js';
import { PASTED_TEXT_LIMIT } from '../dist/public/shared/types.js';
import { claudeRows, codexRows, codexBareRows, writeSessionHome, CLAUDE_PROMPT, CLAUDE_REPLY, CODEX_PROMPT, CODEX_REPLY, FAKE_KEY } from './sessions-fixture.mjs';

const home = () => mkdtempSync(join(tmpdir(), 'af-sessions-test-'));
const req = (path, headers = {}) => new Request(`http://127.0.0.1:4000${path}`, { headers: { 'X-AgentFlow-Request': '1', ...headers } });
const leaks = text => /SHOULD NOT APPEAR|private reasoning|injected context/.test(text);

test('SESSIONS-C1 Claude Code: typed prompts and final replies only, one reply per prompt with the files it changed', () => {
  const { meta, turns } = parseClaude(claudeRows());
  assert.deepEqual(meta, { cwd: '/work/salon', cwds: ['/work/salon'], branch: 'main', startedAt: '2026-10-28T09:00:00.000Z', title: '휴무일 연결', thread: null, parent: null });
  assert.deepEqual(turns.map(t => t.role), ['user', 'assistant', 'user', 'assistant']);
  assert.equal(turns[0].text, CLAUDE_PROMPT, 'injected reminder removed, words kept as typed');
  assert.equal(turns[1].text, `먼저 코드를 볼게요.\n\n${CLAUDE_REPLY}`, 'tool round trip and sidechain do not split or leak into the reply');
  assert.deepEqual(turns[1].files, ['/work/salon/src/hours.ts', '/work/salon/tests/hours.test.ts'], 'Edit and Write paths, Read left out');
  assert.equal(turns[2].text, '/review hours.ts', 'a slash command reads as typed; its local output is not a prompt');
  assert.ok(!leaks(JSON.stringify(turns)));
});

test('SESSIONS-X1 Codex: event stream preferred (no doubled prompt), context and reasoning left out, patched files kept', () => {
  const { meta, turns } = parseCodex(codexRows());
  assert.equal(meta.cwd, '/work/salon'); assert.equal(meta.branch, 'notify');
  assert.deepEqual(turns, [
    { role: 'user', at: '2026-10-28T09:20:02.000Z', text: CODEX_PROMPT },
    // A reply is timed by its first piece (here the patch), so it stays one turn while it grows.
    { role: 'assistant', at: '2026-10-28T09:21:05.000Z', text: CODEX_REPLY, files: ['src/notify.ts', 'tests/notify.test.ts'] }]);
  assert.ok(!leaks(JSON.stringify(turns)));
  // Patch text inside JSON-encoded shell arguments (escaped line breaks) still names its files.
  const shell = parseCodex([{ type: 'event_msg', payload: { type: 'user_message', message: 'go' } },
    { type: 'response_item', payload: { type: 'function_call', name: 'shell', arguments: JSON.stringify({ command: ['apply_patch', '*** Begin Patch\n*** Update File: a/b.ts\n*** End Patch'] }) } }]);
  assert.deepEqual(shell.turns[1].files, ['a/b.ts']);
});

test('SESSIONS-X2 early Codex rollouts (bare items, no events) are read from their messages', () => {
  const { turns } = parseCodex(codexBareRows());
  assert.deepEqual(turns.map(t => [t.role, t.text]), [['user', '관리자 목록 정렬을 날짜순으로'], ['assistant', '날짜 내림차순으로 바꿨어요.']]);
});

test('SESSIONS-S1 listing: newest first, opaque ids, no prompt-less file; reading by id only', async () => {
  const dir = home();
  try {
    const sessions = openSessions({ env: {}, roots: writeSessionHome(dir) });
    const { version, sessions: list } = await sessions.list();
    assert.equal(version, 'sessions.1');
    assert.deepEqual(list.map(s => [s.tool, s.title ?? s.preview]), [['claude', '휴무일 연결'], ['codex', CODEX_PROMPT], ['codex', '관리자 목록 정렬을 날짜순으로']]);
    for (const s of list) { assert.match(s.id, SESSION_ID); assert.ok(!JSON.stringify(s).includes(dir), 'no path of the PC in a listing but the session cwd'); }
    const one = await sessions.read(list[0].id);
    assert.equal(one.label, 'Claude Code'); assert.equal(one.omitted, 0);
    assert.deepEqual(one.turns[1].files, ['src/hours.ts', 'tests/hours.test.ts'], 'files shown relative to the session folder');
    for (const bad of ['claude-' + '0'.repeat(24), '../../etc/passwd', 'codex-zz']) await assert.rejects(sessions.read(bad), e => e.code === 'SESSION_NOT_FOUND');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-S2 off by STUDIO_SESSIONS=off; missing folders list nothing; too large a file is refused; newest turns kept within budget', async () => {
  assert.equal(openSessions({ env: { STUDIO_SESSIONS: 'off' } }), null);
  const empty = home();
  try { assert.deepEqual((await openSessions({ env: {}, home: empty }).list()).sessions, []); } finally { rmSync(empty, { recursive: true, force: true }); }
  const dir = home();
  try {
    const roots = writeSessionHome(dir);
    const small = openSessions({ env: {}, roots, limits: { list: 60, headBytes: 256 * 1024, fileBytes: 100, turnChars: 20000, replyChars: 300000, preview: 160 } });
    const [first] = (await small.list()).sessions;
    await assert.rejects(small.read(first.id), e => e.code === 'SESSION_TOO_LARGE');
    const p = join(roots.claude, 'projects', '-work-long'); mkdirSync(p, { recursive: true });
    const rows = []; for (let i = 0; i < 30; i++) rows.push({ type: 'user', cwd: '/w', timestamp: `2026-10-28T11:${String(i).padStart(2, '0')}:00Z`, message: { role: 'user', content: `질문 ${i} ${'가'.repeat(200)}` } });
    writeFileSync(join(p, 'long.jsonl'), rows.map(r => JSON.stringify(r)).join('\n'));
    const tight = openSessions({ env: {}, roots, limits: { list: 60, headBytes: 256 * 1024, fileBytes: 1e8, turnChars: 20000, replyChars: 1000, preview: 160 } });
    const long = (await tight.list()).sessions.find(s => s.preview.startsWith('질문 0'));
    const got = await tight.read(long.id);
    assert.ok(got.turns.length < 30 && got.turns.length > 0); assert.equal(got.omitted, 30 - got.turns.length);
    assert.ok(got.turns.at(-1).text.startsWith('질문 29'), 'the newest turns are the ones kept');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-H1 routes: only where a host gives the service, same origin with the request header and access code', async () => {
  const dir = home();
  try {
    const sessions = openSessions({ env: {}, roots: writeSessionHome(dir) });
    const plain = createStudioHandler({ env: {} });
    assert.equal((await (await plain(new Request('http://127.0.0.1:4000/api/studio/status'))).json()).sessions, undefined);
    assert.equal((await plain(req('/api/studio/sessions'))).status, 404, 'no service, no route (Worker, static and limited builds)');
    assert.throws(() => createStudioHandler({ env: {}, policy: 'existing-map', sessions }), /limited release/);
    const handler = createStudioHandler({ env: { STUDIO_ALLOWED_ORIGINS: 'https://allowed.example' }, sessions });
    const status = await (await handler(new Request('http://127.0.0.1:4000/api/studio/status'))).json();
    assert.deepEqual(status.sessions, { version: 'sessions.1', tools: ['claude', 'codex'] });
    assert.equal((await handler(new Request('http://127.0.0.1:4000/api/studio/sessions'))).status, 403, 'without the request header');
    assert.equal((await handler(req('/api/studio/sessions', { Origin: 'https://allowed.example' }))).status, 403, 'even an allowed origin');
    assert.equal((await handler(req('/api/studio/sessions', { Origin: 'https://evil.example' }))).status, 403);
    assert.equal((await handler(new Request('http://127.0.0.1:4000/api/studio/sessions', { method: 'POST', headers: { 'X-AgentFlow-Request': '1' } }))).status, 405);
    const list = await (await handler(req('/api/studio/sessions'))).json();
    assert.equal(list.sessions.length, 3);
    const one = await handler(req(`/api/studio/sessions/${list.sessions[1].id}`));
    assert.equal(one.status, 200); assert.equal((await one.json()).turns[0].text, CODEX_PROMPT);
    assert.equal((await handler(req('/api/studio/sessions/a/b'))).status, 404);
    const coded = createStudioHandler({ env: { STUDIO_ACCESS_CODE: 'open-sesame' }, sessions });
    assert.equal((await coded(req('/api/studio/sessions'))).status, 401);
    assert.equal((await coded(req('/api/studio/sessions', { 'X-Studio-Access': 'open-sesame' }))).status, 200);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-T1 record text: header, turns in order with files, credentials hidden, within the paste limit', async () => {
  const dir = home();
  try {
    const sessions = openSessions({ env: {}, roots: writeSessionHome(dir) });
    const list = readSessionList(await sessions.list());
    const detail = readSessionDetail(await sessions.read(list[0].id));
    const got = sessionText(detail);
    assert.match(got.text, /^\[Claude Code 세션 기록 · 휴무일 연결 · 작업 폴더 \/work\/salon · 브랜치 main · \d{4}-\d{2}-\d{2} \d{2}:\d{2} 시작 · 세션 claude-[0-9a-f]{24}\]\n\n── 사용자 요청 · \d{2}:\d{2} ──\n/);
    assert.ok(got.text.includes(`${CLAUDE_PROMPT}\n\n── Claude Code 답변`));
    assert.ok(got.text.includes('(바꾼 파일: src/hours.ts, tests/hours.test.ts)'));
    assert.ok(got.text.indexOf(CLAUDE_PROMPT) < got.text.indexOf('/review hours.ts'));
    assert.equal(got.turns, 4); assert.equal(got.left, 0); assert.equal(got.redacted, 1);
    assert.ok(!secretLike(got.text) && !got.text.includes(FAKE_KEY) && got.text.includes('[가려진 비밀값]'), 'can be saved as a pasted record');
    assert.ok(got.text.length <= PASTED_TEXT_LIMIT);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-T2 record text keeps the newest turns that fit and says how many earlier ones were left; one oversized turn is cut, not dropped', () => {
  const turns = Array.from({ length: 10 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', at: null, text: `턴${i} ${'x'.repeat(900)}` }));
  const got = sessionText({ id: 'claude-' + 'a'.repeat(24), tool: 'claude', label: '', title: null, cwd: null, branch: null, startedAt: null, turns, omitted: 2 }, 3000);
  assert.ok(got.text.length <= 3000);
  assert.ok(got.turns >= 2 && got.turns < 10); assert.equal(got.left, 10 - got.turns + 2);
  assert.ok(got.text.includes(`(앞의 대화 ${got.left}개는`)); assert.ok(got.text.includes('턴9') && !got.text.includes('턴0 '));
  const huge = sessionText({ id: 'codex-' + 'b'.repeat(24), tool: 'codex', label: '', title: null, cwd: null, branch: null, startedAt: null, turns: [{ role: 'assistant', at: null, text: 'y'.repeat(5000) }], omitted: 0 }, 1000);
  assert.equal(huge.turns, 1); assert.ok(huge.text.length <= 1000 && huge.text.endsWith('…(뒷부분 생략)'));
});

test('SESSIONS-R1 redaction hides each credential-like part, a private key block whole', () => {
  const key = '-----BEGIN RSA PRIVATE KEY-----\nMIIEow\nabc\n-----END RSA PRIVATE KEY-----';
  const r = redactSecrets(`a ${FAKE_KEY} b ghp_${'A'.repeat(24)} c\n${key}\nend`);
  assert.equal(r.count, 3); assert.equal(r.text, 'a [가려진 비밀값] b [가려진 비밀값] c\n[가려진 비밀값]\nend'); assert.ok(!secretLike(r.text));
  assert.deepEqual(redactSecrets('nothing here'), { text: 'nothing here', count: 0 });
});

test('SESSIONS-V1 malformed listings and details from a server are not read', () => {
  assert.deepEqual(readSessionList({ version: 'other', sessions: [] }), []);
  assert.deepEqual(readSessionList({ version: 'sessions.1', sessions: [{ id: '../x', preview: 'a', updatedAt: 'b' }] }), []);
  assert.equal(readSessionDetail({ version: 'sessions.1', id: 'x', turns: [{ role: 'system', text: 'a' }] }), null);
});

test('SESSIONS-P1 the shared reading: a file tells its tool by its lines; ids are the server\'s; paths are made relative', async () => {
  const P = await import('../dist/public/shared/session-parse.js');
  assert.equal(P.sniffTool(claudeRows()), 'claude');
  assert.equal(P.sniffTool(codexRows()), 'codex');
  assert.equal(P.sniffTool(codexBareRows()), 'codex');
  assert.equal(P.sniffTool([{ a: 1 }]), null);
  const { createHash } = await import('node:crypto');
  assert.equal(await P.sessionId('claude', '/x/y.jsonl'), `claude-${createHash('sha256').update('/x/y.jsonl').digest('hex').slice(0, 24)}`);
  assert.equal(P.shortPath('C:\\work\\salon\\src\\a.ts', 'C:\\work\\salon'), 'src/a.ts');
  assert.equal(P.shortPath('/work/salon/src/a.ts', '/work/salon/'), 'src/a.ts');
  assert.equal(P.shortPath('/elsewhere/a.ts', '/work/salon'), '/elsewhere/a.ts');
});

// Shapes seen in real files on a Windows PC (Codex Desktop, multi-agent; a Claude Code session that moved folders). Only their
// structure is copied here; the words are made up.
const W = 'C:\\Users\\me\\salon';
const at = m => `2026-10-29T10:${String(m).padStart(2, '0')}:00.000Z`;
const desktopUser = (m, parts) => ({ timestamp: at(m), type: 'response_item', payload: { type: 'message', role: 'user', content: parts.map(([, text]) => ({ type: 'input_text', text })),
  internal_chat_message_metadata_passthrough: { content_item_kinds: parts.map(([k]) => k) } } });
const fileChange = (m, changes, status = 'completed') => ({ timestamp: at(m), type: 'event_msg', payload: { type: 'item_completed', item: { type: 'FileChange', id: `fc${m}`, changes, status, stdout: '', stderr: '' } } });
const desktopMeta = (id, extra = {}) => ({ timestamp: at(0), type: 'session_meta', payload: { id, session_id: `s-${id}`, timestamp: at(0), cwd: W, originator: 'Codex Desktop', source: 'vscode', ...extra } });
const PARENT = '11111111-2222-3333-4444-555555555555';
function desktopParent() {
  return [desktopMeta(PARENT),
    { timestamp: at(1), type: 'response_item', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: 'DEVELOPER SHOULD NOT APPEAR' }] } },
    desktopUser(1, [['environments.environment_context', '<environment_context><cwd>C:\\x</cwd></environment_context>'], ['user.heartbeat', 'HEARTBEAT SHOULD NOT APPEAR']]),
    desktopUser(2, [['environments.environment_context', '<environment_context>x</environment_context>'],
      ['user.text', '# Files mentioned by the user:\n\n## hours.ts: C:\\Users\\me\\salon\\src\\hours.ts\n\n# In app browser:\n<in-app-browser-context>PAGE SHOULD NOT APPEAR</in-app-browser-context>\n\n## My request:\n휴무일을 예약 화면에 반영해 줘\n\n## 확인할 것\n- 테스트'],
      ['user.heartbeat', 'HEARTBEAT SHOULD NOT APPEAR']]),
    { timestamp: at(3), type: 'response_item', payload: { type: 'custom_tool_call', name: 'exec', call_id: 'e1', input: 'const p = root + "/x";\nawait apply_patch(`*** Begin Patch\n*** Update File: ${p}\n*** End Patch`)' } },
    fileChange(4, { [`${W}\\src\\hours.ts`]: { type: 'update', unified_diff: '@@', move_path: null }, [`${W}\\src\\old.ts`]: { type: 'update', unified_diff: '@@', move_path: `${W}\\src\\new.ts` } }),
    fileChange(4, { [`${W}\\src\\failed.ts`]: { type: 'add', content: 'x' } }, 'failed'),
    { timestamp: at(5), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '반영했어요.' }] } },
    desktopUser(20, [['user.text', '다음은 알림']]),
    { timestamp: at(21), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '알림을 붙였어요.' }] } }];
}
function desktopChild(id, m) {
  return [desktopMeta(id, { parent_thread_id: PARENT, source: { subagent: { thread_spawn: { parent_thread_id: PARENT, depth: 1, agent_path: 'agents/a', agent_nickname: 'helper', agent_role: null } } }, thread_source: 'subagent' }),
    { timestamp: at(m), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: '<environment_context>x</environment_context>' }],
      internal_chat_message_metadata_passthrough: { content_item_kinds: ['environments.environment_context'] } } },
    { timestamp: at(m), type: 'response_item', payload: { type: 'agent_message', content: [{ type: 'input_text', text: 'TASK SHOULD NOT APPEAR' }] } },
    fileChange(m + 1, { [`${W}\\tests\\hours.test.ts`]: { type: 'add', content: 'x' } })];
}

test('SESSIONS-D1 Codex Desktop: only typed parts of a prompt, the request under its attachments, files from FileChange items, not from scripts', async () => {
  const P = await import('../dist/public/shared/session-parse.js');
  const s = parseCodex(desktopParent());
  assert.deepEqual(s.meta.thread, PARENT); assert.equal(s.meta.parent, null);
  assert.deepEqual(s.turns.map(t => [t.role, t.text]), [['user', '휴무일을 예약 화면에 반영해 줘\n\n## 확인할 것\n- 테스트'], ['assistant', '반영했어요.'], ['user', '다음은 알림'], ['assistant', '알림을 붙였어요.']]);
  assert.deepEqual(s.turns[1].files, [`${W}\\src\\hours.ts`, `${W}\\src\\old.ts`, `${W}\\src\\new.ts`], 'moved file named at both ends; a failed change and a script are not files');
  assert.ok(!/SHOULD NOT APPEAR/.test(JSON.stringify(s.turns)));
  assert.deepEqual(P.sessionDetail('codex-' + 'a'.repeat(24), 'codex', s).turns[1].files, ['src/hours.ts', 'src/old.ts', 'src/new.ts'], 'Windows paths shown relative to the folder');
  // Several tag blocks before what was typed, in one part.
  assert.equal(parseCodex([desktopUser(1, [['user.text', '<recommended_plugins>a</recommended_plugins>\n<environment_context>b</environment_context>\n이것만 남아요']])]).turns[0].text, '이것만 남아요');
});

test('SESSIONS-D2 Codex subagents: their files join the reply to the prompt that was running; listed and read through the session that started them', async () => {
  const P = await import('../dist/public/shared/session-parse.js');
  const child = parseCodex(desktopChild('c1', 10));
  assert.equal(child.meta.parent, PARENT); assert.equal(child.turns.filter(t => t.role === 'user').length, 0);
  const merged = P.withSubagents(parseCodex(desktopParent()), [child, parseCodex(desktopChild('c2', 25))]);
  assert.deepEqual(merged.turns[1].files.at(-1), `${W}\\tests\\hours.test.ts`);
  assert.deepEqual(merged.turns[3].files, [`${W}\\tests\\hours.test.ts`], 'a change after the second prompt joins its reply');
  const dir = home();
  try {
    const roots = writeSessionHome(dir), day = join(roots.codex, 'sessions', '2026', '10', '29'); mkdirSync(day, { recursive: true });
    const write = (name, rows) => writeFileSync(join(day, name), rows.map(r => JSON.stringify(r)).join('\r\n'));
    write('rollout-2026-10-29T10-00-00-parent.jsonl', desktopParent()); write('rollout-2026-10-29T10-10-00-child.jsonl', desktopChild('c1', 10));
    const sessions = openSessions({ env: {}, roots });
    const list = (await sessions.list()).sessions;
    assert.equal(list.filter(x => x.preview.startsWith('휴무일을 예약')).length, 1, 'the subagent is not its own session');
    const parent = list.find(x => x.preview.startsWith('휴무일을 예약'));
    assert.deepEqual((await sessions.list('c:/users/ME/salon/')).sessions.map(x => x.id), [parent.id], 'a Windows folder matches whatever its letter case and separators');
    const got = await sessions.read(parent.id);
    assert.deepEqual(got.turns[1].files, ['src/hours.ts', 'src/old.ts', 'src/new.ts', 'tests/hours.test.ts']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-D3 a Claude Code session that moved folders is found under each; within() compares Windows folders as Windows does', async () => {
  const P = await import('../dist/public/shared/session-parse.js');
  const rows = [{ type: 'user', cwd: '/tmp/scratch', timestamp: at(1), message: { role: 'user', content: '시작' } },
    { type: 'relocated', sessionId: 'x', relocatedCwd: '/work/salon' },
    { type: 'user', cwd: '/work/salon', timestamp: at(2), message: { role: 'user', content: '이어서' } }];
  const { meta } = parseClaude(rows);
  assert.equal(meta.cwd, '/work/salon'); assert.deepEqual(meta.cwds, ['/tmp/scratch', '/work/salon']);
  assert.ok(P.within(meta.cwds, '/tmp/scratch') && P.within(meta.cwds, '/work/salon') && !P.within(meta.cwds, '/work'.concat('/sal')));
  assert.ok(P.within('C:\\Users\\Me\\Proj\\app', 'c:/users/me/proj') && !P.within('/Work/Salon', '/work/salon'));
  const dir = home();
  try {
    const roots = writeSessionHome(dir), p = join(roots.claude, 'projects', 'C--Users-Me-Moved'); mkdirSync(p, { recursive: true });
    writeFileSync(join(p, 'moved.jsonl'), rows.map(r => JSON.stringify(r)).join('\n'));
    const sessions = openSessions({ env: {}, roots });
    for (const f of ['/tmp/scratch', '/work/salon']) assert.ok((await sessions.list(f)).sessions.some(x => x.preview === '시작'), f);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-D4 a long file is listed by what lies past its head: a first prompt in a line too long for it, a folder the session moved to at its end', async () => {
  const dir = home();
  try {
    const roots = writeSessionHome(dir), limits = { list: 60, scan: 400, headBytes: 4096, promptBytes: 64 * 1024, tailBytes: 2048, fileBytes: 1e8, turnChars: 20000, replyChars: 300000, preview: 160 };
    const day = join(roots.codex, 'sessions', '2026', '10', '29'); mkdirSync(day, { recursive: true });
    writeFileSync(join(day, 'rollout-2026-10-29T11-00-00-img.jsonl'), [desktopMeta('img'),
      desktopUser(1, [['plugins.recommendations', '<recommended_plugins>a</recommended_plugins>'], ['environments.environment_context', '<environment_context>b</environment_context>']]),
      desktopUser(2, [['user.image', `<image>${'A'.repeat(20000)}</image>`], ['user.text', '이 화면대로 바꿔 줘']])].map(r => JSON.stringify(r)).join('\n'));
    const p = join(roots.claude, 'projects', '-tmp-scratch'); mkdirSync(p, { recursive: true });
    const rows = [{ type: 'user', cwd: '/tmp/scratch', timestamp: at(1), message: { role: 'user', content: '시작 ' + '가'.repeat(3000) } }];
    for (let i = 0; i < 20; i++) rows.push({ type: 'assistant', cwd: '/tmp/scratch', timestamp: at(2), message: { role: 'assistant', content: [{ type: 'text', text: '진행 '.repeat(100) }] } });
    rows.push({ type: 'relocated', sessionId: 'x', relocatedCwd: '/work/moved' }, { type: 'user', cwd: '/work/moved', timestamp: at(3), message: { role: 'user', content: '이어서' } });
    writeFileSync(join(p, 'late.jsonl'), rows.map(r => JSON.stringify(r)).join('\n'));
    const sessions = openSessions({ env: {}, roots, limits });
    assert.ok((await sessions.list()).sessions.some(x => x.preview === '이 화면대로 바꿔 줘'), 'first prompt past the head');
    const moved = (await sessions.list('/work/moved')).sessions;
    assert.equal(moved.length, 1); assert.ok(moved[0].preview.startsWith('시작')); assert.equal(moved[0].cwd, '/work/moved');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-K1 ids come from the session itself (same on the server and in the page), the path-made id is an alias; since leaves out what was taken', async () => {
  const P = await import('../dist/public/shared/session-parse.js');
  const { createHash } = await import('node:crypto');
  // The server's own realpath (native: on Windows a temp folder's short 8.3 name comes back long, unlike realpathSync).
  const { realpath } = await import('node:fs/promises');
  const dir = home();
  try {
    const roots = writeSessionHome(dir), day = join(roots.codex, 'sessions', '2026', '10', '29'); mkdirSync(day, { recursive: true });
    writeFileSync(join(day, 'rollout-2026-10-29T10-00-00-parent.jsonl'), desktopParent().map(r => JSON.stringify(r)).join('\n'));
    const sessions = openSessions({ env: {}, roots }), list = (await sessions.list()).sessions;
    const parent = list.find(x => x.preview.startsWith('휴무일을 예약'));
    assert.equal(parent.id, await P.sessionId('codex', `codex:${PARENT}`), 'a Codex id is its thread id');
    const claude = list.find(x => x.tool === 'claude');
    assert.match(claude.id, SESSION_ID);
    const real = await realpath(join(day, 'rollout-2026-10-29T10-00-00-parent.jsonl'));
    assert.deepEqual(parent.aliases, [`codex-${createHash('sha256').update(real).digest('hex').slice(0, 24)}`]);
    assert.deepEqual(readSessionList({ version: 'sessions.1', sessions: [parent] })[0].aliases, parent.aliases);
    // since: turns before it are left out and do not count as omitted.
    const all = await sessions.read(parent.id), later = await sessions.read(parent.id, { since: at(20) });
    assert.equal(all.turns.length, 4); assert.deepEqual(later.turns.map(t => t.text), ['다음은 알림', '알림을 붙였어요.']); assert.equal(later.omitted, 0);
    const handler = createStudioHandler({ env: {}, sessions });
    assert.equal((await handler(req(`/api/studio/sessions/${parent.id}?since=nonsense`))).status, 400);
    assert.equal((await handler(req('/api/studio/sessions/%E0%A4%A'))).status, 404);
    const viaRoute = await (await handler(req(`/api/studio/sessions/${parent.id}?since=${encodeURIComponent(at(20))}`))).json();
    assert.equal(viaRoute.turns.length, 2);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// Claude Code lines in a working folder /w, timed by minute.
const cu = (m, content, extra = {}) => ({ type: 'user', cwd: '/w', timestamp: at(m), ...extra, message: { role: 'user', content } });
const ca = (m, content, extra = {}) => ({ type: 'assistant', cwd: '/w', timestamp: at(m), ...extra, message: { role: 'assistant', content: typeof content === 'string' ? [{ type: 'text', text: content }] : content } });
const jl = rows => rows.map(r => JSON.stringify(r)).join('\n');

test('SESSIONS-M1 a prompt that starts with markup the person pasted stays as typed; only the tools\' own tags are context', () => {
  const said = text => parseClaude([cu(1, '첫 요청'), ca(2, '첫 답'), cu(3, text), ca(4, '둘째 답')]).turns.map(t => [t.role, t.text]);
  for (const text of ['<button class="primary">저장</button>\n이 버튼 색을 파랗게 바꿔 줘', '<div class="a"><div class="b">x</div></div> 이 중첩 구조 정리해 줘', '<template>\n  <div>{{ name }}</div>\n</template>', '<Header title="x"></Header> 컴포넌트 이름 바꿔 줘'])
    assert.deepEqual(said(text), [['user', '첫 요청'], ['assistant', '첫 답'], ['user', text], ['assistant', '둘째 답']], text);
  // What Claude Code puts in a user message: IDE state, hook output, a background task's notice.
  assert.equal(said('<ide_opened_file>The user opened /w/a.ts</ide_opened_file>\n<ide_selection>lines 1-2</ide_selection>\na.ts 고쳐 줘')[2][1], 'a.ts 고쳐 줘');
  assert.equal(said('<user-prompt-submit-hook>hook said</user-prompt-submit-hook>\n저장 버튼 고쳐 줘')[2][1], '저장 버튼 고쳐 줘');
  assert.deepEqual(said('<task-notification>task done</task-notification>').map(t => t[1]), ['첫 요청', '첫 답\n\n둘째 답'], 'a notice is not a prompt');
  // What Codex puts there: a shell command, an interruption, an image's wrapper, its environment, the IDE extension's headings.
  const codex = parts => parseCodex([{ type: 'response_item', payload: { type: 'message', role: 'user', content: parts.map(text => ({ type: 'input_text', text })) } }]).turns.map(t => t.text);
  assert.deepEqual(codex(['<image name=[Image #1]>', '</image>', '이 화면대로 바꿔 줘']), ['이 화면대로 바꿔 줘']);
  assert.deepEqual(codex(['<user_shell_command>\n<command>ls</command>\n</user_shell_command>']), []);
  assert.deepEqual(codex(['<turn_aborted>\nThe user interrupted\n</turn_aborted>']), []);
  assert.deepEqual(codex(['<environment_context>\n<cwd>/w</cwd>\n</environment_context>\n이어서 해 줘']), ['이어서 해 줘']);
  assert.deepEqual(codex(['# Context from my IDE setup:\n\n## Open tabs:\n- a.ts\n\n## My request for Codex:\n탭 정리해 줘']), ['탭 정리해 줘']);
  assert.deepEqual(codex(['<section>\n<h1>제목</h1>\n</section>']), ['<section>\n<h1>제목</h1>\n</section>']);
});

test('SESSIONS-W1 a session a Claude project drives (a thread, Remote Control): each prompt is the person\'s words from its wake, not the envelope', async () => {
  const msg = (attrs, text) => `      <message ${attrs}>${text}</message>\n`;
  const wake = (reason, messages, notes = ['Reply in this thread.']) => `<wake reason="${reason}" current-time="${at(0)}">\n  <project id="chan_test" type="project">\n    <thread ts="cmsg_test">\n${messages.join('')}    </thread>\n  </project>\n${notes.map(n => `  <system-note>${n}</system-note>\n`).join('')}</wake>\n`;
  const human = 'from="human" trust="principal" author="A" id="cmsg_a" sent-at="2026-10-30T00:00:00Z" surface="app" mention="true"';
  const rows = [
    cu(0, `<session-context nonce="n1">project rules</session-context nonce="n1">\n\n${wake('spawn', [msg('trigger="true" from="system" trust="principal"', 'You are a thread')])}\n<relay from="coordinator"><note>start the work</note></relay>`),
    cu(1, wake('mention', [msg('from="human" trust="peer" author="B"', '옆 사람 말'), msg(`trigger="true" ${human}`, '로그인 버튼 고쳐 줘: a &lt; b &amp;&amp; c &#39;저장&#39; &#x1F600;')]), { promptSource: 'sdk', origin: { kind: 'human' } }),
    ca(2, '고쳤어요.'),
    cu(3, wake('remote-control-session-status', [], ['connected', 'idle'])),
    cu(4, `<system-reminder>ctx</system-reminder>\n${wake('decision-chosen', [msg('trigger="true" from="system" trust="principal"', '카드 알림'), msg(human, '예전 말')])}`),
    cu(5, `<system-reminder>ctx</system-reminder>\n${wake('decision-chosen', [msg(`trigger="true" ${human}`, '첫째 안')])}`),
    ca(6, '첫째 안으로 할게요.')
  ];
  const want = [['user', '로그인 버튼 고쳐 줘: a < b && c \'저장\' 😀'], ['assistant', '고쳤어요.'], ['user', '첫째 안'], ['assistant', '첫째 안으로 할게요.']];
  assert.deepEqual(parseClaude(rows).turns.map(t => [t.role, t.text]), want);
  // Listed by those words too (the reading the server and a picked folder share).
  const P = await import('../dist/public/shared/session-parse.js'), lines = P.jsonLines(jl(rows));
  assert.equal(P.sessionSummary('claude-' + 'a'.repeat(24), P.sniffTool(lines), P.parseSession(P.sniffTool(lines), lines), at(9), 1).preview, want[0][1]);
  // Only a whole envelope is unwrapped: markup the person typed or pasted that starts with a wake, or goes on after one, stays as typed.
  const one = text => parseClaude([cu(0, text)]).turns.map(t => t.text);
  for (const text of ['<wake> 태그가 왜 남는지 봐 줘', '<wake>와 </wake> 사이를 지우는 코드 짜 줘', `${wake('mention', [msg(`trigger="true" ${human}`, 'a')])}\n이 봉투는 어디서 와?`])
    assert.deepEqual(one(text), [text], text);
  assert.deepEqual(one(`${wake('mention', [msg(`trigger="true" ${human}`, '고쳐 줘')])}\n<relay from="coordinator"><note>context</note></relay>`), ['고쳐 줘']);
  assert.deepEqual(one(`${wake('mention', [msg(`trigger="true" ${human}`, '고쳐 줘')])}\n<relay from="coordinator"><note>the </wake> tag</note></relay>`), ['고쳐 줘'], 'a relay quoting a wake tag');
  // A wake with no message that woke it is not a prompt, even when it shows the person's earlier words; a tag that only starts like
  // a message, or closes itself, is not one.
  assert.deepEqual(one(wake('status', [msg(human, '예전 말')])), []);
  assert.deepEqual(one(wake('mention', ['<message-ref id="x">', '<message from="human" trigger="true"/>', msg(`trigger="true" ${human}`, '이것만')])), ['이것만']);
  // The project's context ends at the tag closed with its own nonce, whatever it quotes; it is context only before a wake.
  for (const open of ['<session-context nonce="n2">', '<session-context nonce="n2" v="2">'])
    assert.deepEqual(one(`${open}a </session-context> b</session-context nonce="n2">\n\n${wake('mention', [msg(`trigger="true" ${human}`, '시작해 줘')])}`), ['시작해 줘'], open);
  const codexOne = text => parseCodex([{ type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } }]).turns.map(t => t.text);
  for (const text of ['<session-context>로그인 화면</session-context>\n이 태그 뭐야?', '<session-context nonce="a">x</session-context nonce="a">\n이 태그 뭐야?']) {
    assert.deepEqual(one(text), [text], text); assert.deepEqual(codexOne(text), [text], text);
  }
  // Read once however it is made: a pasted prompt full of openers that never close is read in time.
  const started = Date.now();
  one(`${wake('mention', [])}`.replace('</wake>', `${'<message x'.repeat(90000)}</wake>`)); one(`${'<system-reminder>'.repeat(60000)} 질문`); one(`<wake reason="x">${'<message>x'.repeat(90000)}</wake>`);
  one(`<command-name>/x</command-name>${'<command-args>'.repeat(100000)}`); one(`<system-reminder>${'</system-reminder '.repeat(50000)}`); one(`<a>${'</a '.repeat(100000)}`);
  assert.ok(Date.now() - started < 3000, `${Date.now() - started}ms`);
  // What the person sends while the tool is still working is a queued command, read as a prompt; a background task's notice,
  // another Claude's message and notes queued the same way are not.
  const queued = (m, prompt, extra = {}) => ({ type: 'attachment', cwd: '/w', timestamp: at(m), attachment: { type: 'queued_command', prompt, ...extra } });
  const busy = [cu(0, '테스트 돌려 줘'), ca(1, '돌리는 중이에요.'),
    queued(2, '실패하면 로그도 보여 줘'),
    queued(3, [{ type: 'text', text: '이 화면도 봐 줘' }, { type: 'image', source: { type: 'base64', data: 'AAAA' } }], { commandMode: 'prompt' }),
    queued(4, wake('mention', [msg(`trigger="true" ${human}`, '됐음?')]), { commandMode: 'prompt', origin: { kind: 'human' } }),
    queued(5, '<task-notification><status>completed</status></task-notification>', { commandMode: 'task-notification', origin: { kind: 'task-notification' } }),
    queued(6, '<relay from="coordinator"><cited author="user">x</cited><note>y</note></relay>', { commandMode: 'prompt', origin: { kind: 'task-notification', subkind: 'projects-relay' }, isMeta: true }),
    queued(7, 'ls', { commandMode: 'bash' }),
    queued(8, '[Subagent hand-back] report', { commandMode: 'prompt', origin: { kind: 'peer' }, isMeta: true }),
    ca(9, '다 됐어요.')];
  assert.deepEqual(parseClaude(busy).turns.map(t => [t.role, t.text, t.at]), [['user', '테스트 돌려 줘', at(0)], ['assistant', '돌리는 중이에요.', at(1)],
    ['user', '실패하면 로그도 보여 줘', at(2)], ['user', '이 화면도 봐 줘', at(3)], ['user', '됐음?', at(4)], ['assistant', '다 됐어요.', at(9)]]);
  assert.deepEqual(parseClaude([{ ...queued(0, '하위 작업'), isSidechain: true }]).turns, [], 'a subagent\'s queue is its own');
  // A queued row keeps the time it was sent but is written when the tool reads it, after the work done meanwhile. It is timed just
  // after that work, so a mark set during the work (a quiet long command) does not leave it behind.
  const work = [cu(0, '테스트 돌려 줘'), ca(2, '돌릴게요.'), ca(3, [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'npm test' } }])];
  const late = parseClaude([...work, cu(5, [{ type: 'tool_result', tool_use_id: 'b1', content: 'ok' }]), queued(1, '실패하면 로그도 보여 줘'), ca(6, '다 됐어요.')]);
  assert.deepEqual(late.turns.map(t => [t.role, t.at]), [['user', at(0)], ['assistant', at(2)], ['user', '2026-10-29T10:05:00.001Z'], ['assistant', at(6)]]);
  const detail = P.sessionDetail('claude-' + 'b'.repeat(24), 'claude', late, undefined, at(3));
  assert.deepEqual(detail.turns.map(t => t.text), ['실패하면 로그도 보여 줘', '다 됐어요.']);
  const { newTurns } = await import('../dist/public/shared/session-import.js');
  assert.deepEqual(newTurns(P.sessionDetail('claude-' + 'b'.repeat(24), 'claude', late), { lastAt: at(2), count: 2, updatedAt: at(3) }).map(t => t.text), ['실패하면 로그도 보여 줘', '다 됐어요.']);
  // Several read together follow one another, so a look between their lines leaves none behind.
  const two = parseClaude([...work, cu(5, [{ type: 'tool_result', tool_use_id: 'b1', content: 'ok' }]), queued(1, 'Q1'), queued(4, 'Q2'), ca(6, '다 됐어요.')]);
  assert.deepEqual(two.turns.map(t => t.at), [at(0), at(2), '2026-10-29T10:05:00.001Z', '2026-10-29T10:05:00.002Z', at(6)]);
  assert.deepEqual(newTurns(P.sessionDetail('claude-' + 'b'.repeat(24), 'claude', two), { lastAt: '2026-10-29T10:05:00.001Z', count: 3, updatedAt: at(5) }).map(t => t.text), ['Q2', '다 됐어요.']);
  // A line with a time in another form, or far off (a clock set wrong), does not move the prompts after it.
  const odd = parseClaude([cu(0, '시작'), { type: 'queue-operation', timestamp: 'garbage' }, { type: 'queue-operation', timestamp: '2031-01-01T00:00:00.000Z' }, queued(2, 'Q'), ca(3, '답')]);
  assert.deepEqual(odd.turns.map(t => t.at), [at(0), at(2), at(3)]);
});

test('SESSIONS-G1 a reply keeps the time of its first piece while it grows: the same turn at each look, and since brings it back whole', async () => {
  const P = await import('../dist/public/shared/session-parse.js');
  const rows = [cu(0, '마이그레이션 돌려 줘'), ca(1, 'PART1'), ca(2, [{ type: 'tool_use', id: 'b1', name: 'Bash', input: { command: 'x' } }]),
    cu(7, [{ type: 'tool_result', tool_use_id: 'b1', content: 'ok' }]), ca(8, 'PART2')];
  assert.equal(parseClaude(rows.slice(0, 3)).turns[1].at, at(1));
  assert.deepEqual(parseClaude(rows).turns[1], { role: 'assistant', at: at(1), text: 'PART1\n\nPART2', files: [] });
  assert.deepEqual(P.sessionDetail('claude-' + 'a'.repeat(24), 'claude', parseClaude(rows), undefined, at(1)).turns.map(t => t.text), ['PART1\n\nPART2']);
  // A subagent's change gives a reply its time only when it has none: a reply keeps its own time, so a change that comes back late
  // (an edit approved later, timed when it was asked) never moves a reply taken before back behind its mark.
  const said = { timestamp: at(5), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: '붙였어요.' }] } };
  const parent = [desktopMeta(PARENT), desktopUser(1, [['user.text', '알림 붙여 줘']])], child = [parseCodex(desktopChild('c1', 2))];
  assert.equal(P.withSubagents(parseCodex(parent), child).turns[1].at, at(3));
  assert.equal(P.withSubagents(parseCodex([...parent, said]), child).turns[1].at, at(5));
});

test('SESSIONS-X3 a Codex thread continued across the CLI and Desktop keeps both sides, each prompt once', () => {
  const itemU = (m, text, kinds) => ({ timestamp: at(m), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }], ...(kinds ? { internal_chat_message_metadata_passthrough: { content_item_kinds: kinds } } : {}) } });
  const itemA = (m, text) => ({ timestamp: at(m), type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] } });
  const ev = (m, type, message) => ({ timestamp: at(m), type: 'event_msg', payload: { type, message } });
  const read = rows => parseCodex([desktopMeta('t'), ...rows]).turns.map(t => [t.role, t.text]);
  const cli = [itemU(1, 'CLI 요청'), ev(1, 'user_message', 'CLI 요청'), itemA(2, 'CLI 답'), ev(2, 'agent_message', 'CLI 답')], desk = [itemU(10, 'Desktop 요청', ['user.text']), itemA(11, 'Desktop 답')];
  assert.deepEqual(read([...cli, ...desk]), [['user', 'CLI 요청'], ['assistant', 'CLI 답'], ['user', 'Desktop 요청'], ['assistant', 'Desktop 답']]);
  assert.deepEqual(read([...desk, ...cli]), [['user', 'Desktop 요청'], ['assistant', 'Desktop 답'], ['user', 'CLI 요청'], ['assistant', 'CLI 답']]);
  // An event written before its response item is the same prompt; a stray event does not hide Desktop's replies.
  assert.deepEqual(read([ev(1, 'user_message', 'CLI 요청'), itemU(1, 'CLI 요청'), ev(2, 'agent_message', 'CLI 답'), itemA(2, 'CLI 답')]), [['user', 'CLI 요청'], ['assistant', 'CLI 답']]);
  assert.deepEqual(read([...desk, ev(12, 'agent_message', 'stray')]), [['user', 'Desktop 요청'], ['assistant', 'Desktop 답']]);
  // The same words asked again after a reply are a new prompt.
  assert.equal(read([...cli, itemU(3, 'CLI 요청'), ev(3, 'user_message', 'CLI 요청'), ev(4, 'agent_message', '또 답')]).length, 4);
});

test('SESSIONS-C2 Claude Code: an edit counts once its result came back without an error; a refused or failed one changed nothing', () => {
  const edit = (m, id, file) => ca(m, [{ type: 'tool_use', id, name: 'Edit', input: { file_path: file, old_string: 'a', new_string: 'b' } }]);
  const result = (m, id, extra = {}) => cu(m, [{ type: 'tool_result', tool_use_id: id, content: 'ok', ...extra }]);
  const rows = [cu(0, '설정 바꿔 줘'), edit(1, 'e1', '/w/config/prod.json'), result(2, 'e1', { is_error: true, content: "The user doesn't want to proceed with this tool use." }),
    edit(3, 'e2', '/w/src/missing.ts'), result(4, 'e2', { content: '<tool_use_error>String to replace not found in file.</tool_use_error>' }),
    edit(5, 'e3', '/w/config/dev.json'), result(6, 'e3'), edit(7, 'e4', '/w/src/pending.ts'), ca(8, 'dev 설정만 바꿨어요.')];
  assert.deepEqual(parseClaude(rows).turns[1], { role: 'assistant', at: at(5), text: 'dev 설정만 바꿨어요.', files: ['/w/config/dev.json'] }, 'an edit still waiting for its result is not listed yet');
  assert.deepEqual(parseClaude([...rows, result(9, 'e4')]).turns[1].files, ['/w/config/dev.json', '/w/src/pending.ts']);
});

test('SESSIONS-X4 Codex patches name their files in any form: raw Windows paths, JSON arguments, heredocs, string commands', async () => {
  const P = await import('../dist/public/shared/session-parse.js');
  const patch = f => `*** Begin Patch\n*** Update File: ${f}\n@@\n-a\n+b\n*** End Patch\n`, fn = (name, args) => ({ type: 'function_call', name, call_id: 'c', arguments: JSON.stringify(args) });
  const read = payload => parseCodex([desktopMeta('t'), { type: 'event_msg', payload: { type: 'user_message', message: '고쳐 줘' } }, { type: 'response_item', payload }]);
  const files = payload => read(payload).turns[1]?.files ?? [];
  const raw = { type: 'custom_tool_call', name: 'apply_patch', call_id: 'c', input: patch(`${W}\\src\\notify.ts`) };
  assert.deepEqual(files(raw), [`${W}\\src\\notify.ts`], 'a raw patch is read as it is: no \\n in a Windows path is a line break');
  assert.deepEqual(P.sessionDetail('codex-' + 'a'.repeat(24), 'codex', read(raw)).turns[1].files, ['src/notify.ts']);
  assert.deepEqual(P.sessionDetail('codex-' + 'a'.repeat(24), 'codex', read({ ...raw, input: patch('src\\routes\\reserve.ts') })).turns[1].files, ['src/routes/reserve.ts'], 'a relative Windows name shown as the others');
  assert.equal(P.shortPath('src\\odd.ts', '/work/salon'), 'src\\odd.ts', 'a backslash in a POSIX name is a character');
  assert.deepEqual(files(fn('shell', { command: ['apply_patch', patch(`${W}\\src\\a.ts`)] })), [`${W}\\src\\a.ts`], 'JSON escapes undone once');
  assert.deepEqual(files(fn('shell', { workdir: '/w', command: ['bash', '-lc', `cd /w && apply_patch <<'EOF'\n${patch('src/a.ts')}EOF\n`] })), ['src/a.ts']);
  assert.deepEqual(files(fn('exec_command', { cmd: `apply_patch <<'EOF'\n${patch('src/b.ts')}EOF\n` })), ['src/b.ts']);
  assert.deepEqual(files(fn('shell_command', { command: `apply_patch <<'EOF'\n${patch('src/c.ts')}EOF\n` })), ['src/c.ts']);
  assert.deepEqual(files(fn('apply_patch', { input: patch('src/d.ts') })), ['src/d.ts']);
  assert.deepEqual(files({ type: 'local_shell_call', call_id: 'c', status: 'completed', action: { type: 'exec', command: ['apply_patch', patch('src/e.ts')] } }), ['src/e.ts']);
  // Patch text a command only writes somewhere, or a Desktop script (its FileChange item names the files), changes nothing here.
  assert.deepEqual(files(fn('shell', { command: ['bash', '-lc', `cat > notes.md <<'EOF'\n${patch('src/x.ts')}EOF\n`] })), []);
  assert.deepEqual(files({ type: 'custom_tool_call', name: 'exec', call_id: 'c', input: `await apply_patch(\`${patch('src/y.ts')}\`)` }), []);
});

test('SESSIONS-C3 Claude Code subagents: the files they changed join the reply they worked for (not their words), in the file or beside it', async () => {
  const side = { isSidechain: true }, task = (m, id) => ca(m, [{ type: 'tool_use', id, name: 'Task', input: { prompt: '고쳐' } }]);
  const done = (m, id, extra = {}) => cu(m, [{ type: 'tool_result', tool_use_id: id, content: 'TOOL OUTPUT SHOULD NOT APPEAR' }], extra);
  const work = (m, file, extra) => [cu(m, '고쳐', extra), ca(m, [{ type: 'text', text: 'SIDECHAIN SHOULD NOT APPEAR' }, { type: 'tool_use', id: `s${m}`, name: 'Write', input: { file_path: file, content: 'x' } }], extra), done(m, `s${m}`, extra)];
  const s = parseClaude([cu(0, '알림 모듈 고쳐 줘'), task(1, 'k1'), ...work(2, '/w/src/notify.ts', side), done(3, 'k1'), ca(4, '서브에이전트가 notify.ts를 고쳤어요.')]);
  assert.deepEqual(s.turns.map(t => [t.role, t.text, t.files]), [['user', '알림 모듈 고쳐 줘', undefined], ['assistant', '서브에이전트가 notify.ts를 고쳤어요.', ['/w/src/notify.ts']]]);
  const dir = home();
  try {
    const roots = writeSessionHome(dir), p = join(roots.claude, 'projects', '-w'); mkdirSync(join(p, 'main', 'subagents'), { recursive: true });
    writeFileSync(join(p, 'main.jsonl'), jl([cu(0, '알림이랑 예약 고쳐 줘'), task(1, 'k1'), done(5, 'k1'), ca(6, '둘 다 고쳤어요.')]));
    // Beside the session (<session>/subagents/), or in earlier versions agent-*.jsonl in its project folder naming it.
    writeFileSync(join(p, 'main', 'subagents', 'agent-a1.jsonl'), jl(work(2, '/w/src/notify.ts', { ...side, sessionId: 'main' })));
    writeFileSync(join(p, 'agent-b2.jsonl'), jl(work(3, '/w/src/booking.ts', { ...side, sessionId: 'main' })));
    writeFileSync(join(p, 'agent-c3.jsonl'), jl(work(3, '/w/src/other.ts', { ...side, sessionId: 'other' })));
    const sessions = openSessions({ env: {}, roots }), list = (await sessions.list('/w')).sessions;
    assert.deepEqual(list.map(x => x.preview), ['알림이랑 예약 고쳐 줘'], 'a subagent file is not a session of its own');
    const got = await sessions.read(list[0].id);
    assert.deepEqual(got.turns.map(t => [t.role, t.text, t.files]), [['user', '알림이랑 예약 고쳐 줘', undefined], ['assistant', '둘 다 고쳤어요.', ['src/notify.ts', 'src/booking.ts']]]);
    assert.ok(!leaks(JSON.stringify(got)));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-B1 a folder picked in the browser reads Claude Code subagents as the server does: same id, same files', async () => {
  const { readdirSync } = await import('node:fs'), { basename } = await import('node:path');
  // File System Access stand-ins over the real folder (a File is a snapshot of the file, as in Chrome).
  const file = path => ({ kind: 'file', name: basename(path), getFile: async () => new File([readFileSync(path)], basename(path), { lastModified: statSync(path).mtimeMs }) });
  const folder = path => ({ kind: 'directory', name: basename(path), queryPermission: async () => 'granted',
    async *values() { for (const d of readdirSync(path, { withFileTypes: true })) yield d.isDirectory() ? folder(join(path, d.name)) : file(join(path, d.name)); } });
  const { createSessionSources } = await import('../dist/public/client/session-source.js');
  const side = { isSidechain: true }, task = (m, id) => ca(m, [{ type: 'tool_use', id, name: 'Task', input: { prompt: '고쳐' } }]);
  const done = (m, id, extra = {}) => cu(m, [{ type: 'tool_result', tool_use_id: id, content: 'TOOL OUTPUT SHOULD NOT APPEAR' }], extra);
  const work = (m, path, extra) => [cu(m, '고쳐', extra), ca(m, [{ type: 'tool_use', id: `s${m}`, name: 'Write', input: { file_path: path, content: 'x' } }], extra), done(m, `s${m}`, extra)];
  const dir = home(), had = globalThis.window;
  try {
    const roots = writeSessionHome(dir), p = join(roots.claude, 'projects', '-w'); mkdirSync(join(p, 'main', 'subagents'), { recursive: true });
    writeFileSync(join(p, 'main.jsonl'), jl([cu(0, '알림이랑 예약 고쳐 줘'), task(1, 'k1'), done(5, 'k1'), ca(6, '둘 다 고쳤어요.')]));
    writeFileSync(join(p, 'main', 'subagents', 'agent-a1.jsonl'), jl(work(2, '/w/src/notify.ts', { ...side, sessionId: 'main' })));
    writeFileSync(join(p, 'agent-b2.jsonl'), jl(work(3, '/w/src/booking.ts', { ...side, sessionId: 'main' })));
    writeFileSync(join(p, 'agent-c3.jsonl'), jl(work(3, '/w/src/other.ts', { ...side, sessionId: 'other' })));
    const server = openSessions({ env: {}, roots }), [s] = (await server.list('/w')).sessions;
    globalThis.window = { showDirectoryPicker: async () => folder(roots.claude) };
    const sources = createSessionSources({ status: () => ({ ai: 'none' }), accessCode: () => '' });
    await sources.load(); assert.equal(await sources.pick(), true);
    const list = await sources.current().list('/w');
    assert.deepEqual(list.map(x => [x.id, x.preview]), [[s.id, '알림이랑 예약 고쳐 줘']]);
    const got = await sources.current().read(s.id), want = await server.read(s.id);
    assert.deepEqual(got.turns, readSessionDetail(want).turns);
    assert.deepEqual(got.turns.at(-1).files, ['src/notify.ts', 'src/booking.ts']);
  } finally { globalThis.window = had; rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-F1 a handover document longer than a turn is folded before the prompt is clipped, so the words after it are kept', async () => {
  const P = await import('../dist/public/shared/session-parse.js');
  const doc = ['──────── AgentFlow 인수인계 문서 · af-handover:QW3RTY ────────', '# 인수인계: 나의 프로젝트', ...Array.from({ length: 400 }, (_, i) => `- 부분 ${i}: ${'설명 '.repeat(20)}`),
    '──────── 인수인계 문서 끝 · af-handover:QW3RTY ────────'].join('\n');
  assert.ok(doc.length > SESSION_LIMITS.turnChars);
  const d = P.sessionDetail('claude-' + 'a'.repeat(24), 'claude', parseClaude([cu(1, `${doc}\n\n결제 화면부터 이어서 해 줘`), ca(2, '이어서 할게요.')]));
  assert.equal(d.turns[0].text, '[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:QW3RTY · 나의 프로젝트]\n\n결제 화면부터 이어서 해 줘');
  assert.ok(sessionText(readSessionDetail(d)).text.includes('결제 화면부터 이어서 해 줘'));
});

test('SESSIONS-L1 a line too long to be a session line is skipped, the lines around it still read, the read itself never fails for it', async () => {
  const dir = home();
  try {
    const roots = writeSessionHome(dir), p = join(roots.claude, 'projects', '-w'); mkdirSync(p, { recursive: true });
    // A reply line longer than one read chunk, with characters cut between chunks; a line over the cap mid-file (skipped whole,
    // though it is whole JSON) and damage over it at the end.
    const long = '뒤 답 ' + 'ㅋ'.repeat(70000);
    writeFileSync(join(p, 'big.jsonl'), [jl([cu(1, '앞 요청'), ca(2, '앞 답'), ca(2, `OVER THE CAP ${'x'.repeat(400 * 1024)}`)]), jl([cu(3, '뒤 요청'), ca(4, long)]), '\0'.repeat(400 * 1024)].join('\n'));
    const sessions = openSessions({ env: {}, roots, limits: { ...SESSION_LIMITS, lineBytes: 300 * 1024, turnChars: 100000 } }), [s] = (await sessions.list('/w')).sessions;
    assert.deepEqual((await sessions.read(s.id)).turns.map(t => t.text), ['앞 요청', '앞 답', '뒤 요청', long]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-L2 a listing reads a file again only when its size or time changed', async () => {
  const dir = home();
  try {
    const roots = writeSessionHome(dir), f = join(roots.claude, 'projects', '-work-salon', 'c1.jsonl'), sessions = openSessions({ env: {}, roots });
    const title = async () => (await sessions.list()).sessions.find(s => s.tool === 'claude').title;
    assert.equal(await title(), '휴무일 연결');
    const st = statSync(f); writeFileSync(f, readFileSync(f, 'utf8').replace('휴무일 연결', '휴무일 이음')); utimesSync(f, st.atime, st.mtime);
    assert.equal(statSync(f).size, st.size);
    assert.equal(await title(), '휴무일 연결', 'same size and time: what was read before holds');
    utimesSync(f, st.atime, new Date(st.mtimeMs + 1000));
    assert.equal(await title(), '휴무일 이음');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-A1 a Codex thread archived before a look took it is still listed (archived_sessions), once by its id', async () => {
  const dir = home();
  try {
    const roots = writeSessionHome(dir), arch = join(roots.codex, 'archived_sessions'); mkdirSync(arch, { recursive: true });
    writeFileSync(join(arch, 'rollout-2026-10-29T10-00-00-parent.jsonl'), desktopParent().map(r => JSON.stringify(r)).join('\n'));
    const sessions = openSessions({ env: {}, roots });
    const listed = (await sessions.list()).sessions.filter(x => x.preview.startsWith('휴무일을 예약'));
    assert.equal(listed.length, 1); assert.equal(listed[0].id, await (await import('../dist/public/shared/session-parse.js')).sessionId('codex', `codex:${PARENT}`));
    // The same thread still in sessions/ too (a copy left behind): one session, the newest file.
    const day = join(roots.codex, 'sessions', '2026', '10', '29'); mkdirSync(day, { recursive: true });
    writeFileSync(join(day, 'rollout-2026-10-29T10-00-00-parent.jsonl'), desktopParent().map(r => JSON.stringify(r)).join('\n'));
    assert.equal((await openSessions({ env: {}, roots }).list()).sessions.filter(x => x.preview.startsWith('휴무일을 예약')).length, 1);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-A2 an archived Codex thread also carries the id its sessions/ path gave, so a mark kept under that id still holds', async () => {
  // The server's own realpath (fs/promises): on Windows the sync one can keep an 8.3 short name.
  const { realpath } = await import('node:fs/promises'), { sessionId } = await import('../dist/public/shared/session-parse.js');
  const dir = home();
  try {
    const roots = writeSessionHome(dir), arch = join(roots.codex, 'archived_sessions'), name = 'rollout-2026-10-29T10-00-00-parent.jsonl'; mkdirSync(arch, { recursive: true });
    writeFileSync(join(arch, name), desktopParent().map(r => JSON.stringify(r)).join('\n'));
    const [row] = (await openSessions({ env: {}, roots }).list()).sessions.filter(x => x.preview.startsWith('휴무일을 예약'));
    assert.ok(row.aliases.includes(await sessionId('codex', join(await realpath(roots.codex), 'sessions', '2026', '10', '29', name))), row.aliases.join());
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-B2 picked folders: one inside another reads each session once (the scan is not spent twice), a folder that cannot be read is said, labels name one folder each', async () => {
  const { readdirSync } = await import('node:fs'), { basename } = await import('node:path'), { sessionId } = await import('../dist/public/shared/session-parse.js');
  const file = path => ({ kind: 'file', name: basename(path), getFile: async () => new File([readFileSync(path)], basename(path), { lastModified: statSync(path).mtimeMs }) });
  const folder = (path, name = basename(path), bad = false) => ({ kind: 'directory', name, queryPermission: async () => 'granted',
    async *values() { if (bad) throw new DOMException('gone', 'NotFoundError'); for (const d of readdirSync(path, { withFileTypes: true })) yield d.isDirectory() ? folder(join(path, d.name)) : file(join(path, d.name)); } });
  const { createSessionSources } = await import('../dist/public/client/session-source.js');
  const dir = home(), had = globalThis.window;
  try {
    const me = join(dir, 'me'), other = join(me, '.claude', 'projects', '-other'), target = join(me, '.claude', 'projects', '-target');
    mkdirSync(other, { recursive: true }); mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 't.jsonl'), jl([cu(0, '오래된 대상 작업', { cwd: '/target' }), ca(1, '했어요', { cwd: '/target' })]));
    utimesSync(join(target, 't.jsonl'), new Date(Date.now() - 86400000), new Date(Date.now() - 86400000));
    for (let i = 0; i < 260; i++) writeFileSync(join(other, `o${i}.jsonl`), jl([cu(0, `다른 작업 ${i}`, { cwd: '/other' })]));
    const arch = join(me, '.codex', 'archived_sessions'), name = 'rollout-2026-10-29T10-00-00-parent.jsonl'; mkdirSync(arch, { recursive: true });
    writeFileSync(join(arch, name), desktopParent().map(r => JSON.stringify(r)).join('\n')); utimesSync(join(arch, name), new Date(Date.now() + 60000), new Date(Date.now() + 60000));
    const picks = [folder(join(me, '.claude')), folder(me), folder(dir, 'broken', true)];
    globalThis.window = { showDirectoryPicker: async () => picks.shift() };
    const sources = createSessionSources({ status: () => ({ ai: 'none' }), accessCode: () => '' });
    await sources.load(); for (let i = 0; i < 3; i++) assert.equal(await sources.pick(), true);
    const src = sources.current(), found = await src.list('/target');
    assert.deepEqual(found.map(x => x.preview), ['오래된 대상 작업'], 'found past 260 newer sessions, read through both folders');
    assert.equal(src.partial(), 'broken 폴더를 읽지 못했어요. 옮겼거나 지웠다면 빼고 다시 골라 주세요.');
    const all = await src.list();
    assert.equal(new Set(all.map(x => x.id)).size, all.length, 'each session once');
    const thread = all.find(x => x.preview.startsWith('휴무일을 예약'));
    assert.ok(thread.aliases.includes(await sessionId('codex', `me/.codex/sessions/2026/10/29/${name}`)), 'the id its sessions/ path gave');
    await sources.forget('broken'); await src.list(); assert.equal(src.partial(), null);
    // Two .claude folders and one named like a numbered label: each label names one folder, and leaving one leaves that one.
    picks.push(folder(join(me, '.claude'), '.claude'), folder(join(me, '.claude'), '.claude (1)'));
    await sources.pick(); await sources.pick();
    const labels = sources.folders(); assert.equal(new Set(labels).size, labels.length, labels.join(' | '));
    await sources.forget(labels[3]);
    assert.deepEqual(sources.folders(), ['.claude (1)', 'me', '.claude (2)']);
  } finally { globalThis.window = had; rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-Q1 files with no session in them (Codex subagents\' rollouts) do not use up the scan, up to ten times as many of them', async () => {
  const dir = home();
  try {
    const roots = { codex: join(dir, '.codex') }, day = join(roots.codex, 'sessions', '2026', '10', '29'); mkdirSync(day, { recursive: true });
    const put = (name, rows, minutesAgo) => { const f = join(day, name); writeFileSync(f, rows.map(r => JSON.stringify(r)).join('\n')); const t = new Date(Date.now() - minutesAgo * 60000); utimesSync(f, t, t); };
    put('rollout-2026-10-29T10-00-00-parent.jsonl', desktopParent(), 60);
    for (let i = 0; i < 9; i++) put(`rollout-2026-10-29T10-0${i}-30-c${i}.jsonl`, desktopChild(`c${i}`, 10 + i), 50 - i);
    const salon = async scan => (await openSessions({ env: {}, roots, limits: { ...SESSION_LIMITS, scan } }).list(W)).sessions.map(x => x.preview);
    assert.deepEqual(await salon(3), ['휴무일을 예약 화면에 반영해 줘 ## 확인할 것 - 테스트'], 'nine newer subagent rollouts do not hide the session');
    assert.equal((await salon(1)).length, 1, 'nine quiet files are within ten times a scan of one');
    put('rollout-2026-10-29T10-09-30-c9.jsonl', desktopChild('c9', 19), 40);
    assert.deepEqual(await salon(1), [], 'the tenth quiet file ends a look with a scan of one');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('SESSIONS-K2 a whole listing that stops short of a folder\'s older session (another tab) leaves it readable while its file is there', async () => {
  const dir = home();
  try {
    const roots = { claude: join(dir, '.claude') };
    const put = (folder, cwd, prompt, minutesAgo) => {
      const d = join(roots.claude, 'projects', folder), f = join(d, `${folder.slice(1)}.jsonl`), t = new Date(Date.now() - minutesAgo * 60000); mkdirSync(d, { recursive: true });
      writeFileSync(f, jl([cu(0, prompt, { cwd }), ca(1, '했어요', { cwd })])); utimesSync(f, t, t); return f;
    };
    const file = put('-work-salon', '/work/salon', '오래된 살롱 작업', 60); put('-work-other', '/work/other', '다른 작업', 1);
    const sessions = openSessions({ env: {}, roots, limits: { ...SESSION_LIMITS, list: 1 } });
    const [old] = (await sessions.list('/work/salon')).sessions;
    assert.equal(old.preview, '오래된 살롱 작업');
    assert.deepEqual((await sessions.list()).sessions.map(x => x.preview), ['다른 작업'], 'the whole listing stops before it');
    assert.equal((await sessions.read(old.id)).turns[0].text, '오래된 살롱 작업', 'the folder\'s look still reads it');
    rmSync(file); await sessions.list();
    await assert.rejects(sessions.read(old.id), e => e.code === 'SESSION_NOT_FOUND', 'a session whose file is gone is not kept');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
