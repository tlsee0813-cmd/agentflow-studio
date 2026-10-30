// Local session records: Claude Code / Codex files read into turns, the sessions service and routes, and the record text.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseClaude, parseCodex, openSessions, SESSION_ID } from '../server/sessions.mjs';
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
  assert.deepEqual(meta, { cwd: '/work/salon', branch: 'main', startedAt: '2026-10-28T09:00:00.000Z', title: '휴무일 연결' });
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
    { role: 'assistant', at: '2026-10-28T09:22:00.000Z', text: CODEX_REPLY, files: ['src/notify.ts', 'tests/notify.test.ts'] }]);
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
