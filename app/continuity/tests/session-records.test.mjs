// Session records the automatic connection takes: credential-like text hidden (the header too), control characters taken out, a
// reply taken while it was still being written continued without repeating it, turns a reading left out said so, a draft holding
// several sessions kept as one record each, and the look itself (each session saved on its own, limits, marks). All values fake.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import { redactSecrets, secretLike } from '../dist/public/shared/secret.js';
import { sessionText, sessionChunks, newTurns, markAfter, leftSince, recordParts, readSessionDetail, stamp } from '../dist/public/shared/session-import.js';
import { sessionDetail, within } from '../dist/public/shared/session-parse.js';
import { sessionOrigin, partSessions } from '../dist/public/shared/handover.js';
import { PASTED_TEXT_LIMIT } from '../dist/public/shared/types.js';

globalThis.document = { getElementById: () => null, visibilityState: 'visible', addEventListener() {} };
const { createAutoSync, AUTOSYNC_KEY } = await import('../dist/public/client/auto-sync.js');

const ID = 'claude-0123456789abcdef01234567', OLD = 'claude-89abcdef0123456789abcdef';
const T = m => new Date(Date.parse('2026-10-30T09:00:00.000Z') + m * 60000).toISOString();
const session = (turns, extra = {}) => ({ id: ID, tool: 'claude', label: '', title: null, cwd: '/work/salon', branch: 'main', startedAt: null, turns, omitted: 0, ...extra });
const hidden = '[가려진 비밀값]';
// Fake credentials, put together at run time so no file holds one whole.
const f = (...p) => p.join('');
const JWT = f('eyJ', 'hbGciOiJIUzI1NiJ9', '.', 'eyJyb2xlIjoic2VydmljZSJ9', '.', 'FAKEsignatureFAKEsig');

test('SESSIONS-RD1 redaction hides the common credentials a session can hold, keeps their names and leaves ordinary text alone', () => {
  const cases = [
    [`SUPABASE_SERVICE_ROLE_KEY=${JWT}`, JWT, 'SUPABASE_SERVICE_ROLE_KEY='],
    ['curl -H "Authorization: Bearer abc.FAKE-token-0123456789" https://api.example.test', 'abc.FAKE-token-0123456789', 'Authorization: Bearer '],
    ['Authorization: Basic ZmFrZTpmYWtlcGFzcw==', 'ZmFrZTpmYWtlcGFzcw==', 'Authorization: Basic '],
    ['DATABASE_URL=postgres://admin:FakePassw0rd!@db.example.test:5432/app', 'FakePassw0rd!', 'postgres://admin:'],
    [f('STRIPE_SECRET_KEY=', 'sk_', 'live_', 'FAKE'.repeat(6)), f('sk_', 'live_'), 'STRIPE_SECRET_KEY='],
    [f('결제 키는 ', 'rk_', 'test_', 'FAKE'.repeat(4), ' 이에요'), 'FAKEFAKE', '결제 키는 '],
    ['AWS_SECRET_ACCESS_KEY=FAKEfakeFAKEfake/FAKEfakeFAKEfake0123', 'FAKEfakeFAKEfake/', 'AWS_SECRET_ACCESS_KEY='],
    ['aws_secret_access_key = FAKEfakeFAKEfake/FAKEfake0123', 'FAKEfakeFAKEfake/', 'aws_secret_access_key = '],
    [f('//registry.npmjs.org/:_authToken=', 'npm_', 'FAKE'.repeat(9)), 'npm_', '_authToken='],
    [f('토큰 ', 'glpat-', 'FAKE'.repeat(5), ' 으로 푸시'), 'glpat-', '으로 푸시'],
    [f('모델 받을 때 ', 'hf_', 'FAKE'.repeat(8)), 'hf_', '모델 받을 때 '],
    [f('알림은 ', 'https://hooks.slack.com/', 'services/T000FAKE/B000FAKE/', 'FAKE'.repeat(6)), 'T000FAKE', 'https://hooks.slack.com/'],
    [f('봇 ', '123456789:', 'AA', 'FAKE'.repeat(8)), '123456789:AA', '봇 '],
    ['DB_PASSWORD=Fake&pass123', 'Fake&pass123', 'DB_PASSWORD='],
    ['{"apiKey": "fake-api-key-0000", "password": "fakepass1"}', 'fake-api-key-0000', '"apiKey": "'],
    ['{"apiKey": "fake-api-key-0000", "password": "fakepass1"}', 'fakepass1', '"password": "'],
    ["settings = { secret_key: 'fake-secret-value', client_secret: `fake-client-0000` }", 'fake-secret-value', "secret_key: '"],
    ["settings = { secret_key: 'fake-secret-value', client_secret: `fake-client-0000` }", 'fake-client-0000', 'client_secret: `'],
    ['https://example.test/cb?token=fake0123token&next=1', 'fake0123token', '&next=1'],
    ['-----BEGIN PGP PRIVATE KEY BLOCK-----\nFAKEBODY\n-----END PGP PRIVATE KEY BLOCK-----\n끝', 'FAKEBODY', '\n끝'],
    ['-----BEGIN OPENSSH PRIVATE KEY-----\nFAKEBODY\n-----END OPENSSH PRIVATE KEY-----', 'FAKEBODY', ''],
    ['PuTTY-User-Key-File-3: ssh-ed25519\nPublic-Lines: 1\nAAAAC3FAKEPUBLIC\nPrivate-Lines: 1\nAAAAIFAKEPRIVATEBODY\nPrivate-MAC: 00ff', 'FAKEPRIVATEBODY', 'Private-MAC: 00ff']
  ];
  for (const [text, secret, keep] of cases) {
    const r = redactSecrets(text);
    assert.ok(!r.text.includes(secret), `${text} -> ${r.text}`); assert.ok(r.text.includes(keep) && r.text.includes(hidden), `${text} -> ${r.text}`);
    assert.ok(r.count >= 1 && !secretLike(r.text));
    assert.deepEqual(redactSecrets(r.text), { text: r.text, count: 0 }, 'hidden once, never again');
  }
  // Talk about keys, code that names them and ordinary links stay as written.
  for (const text of ['Basic authentication is used; the Bearer token goes in the header.', 'interface A { password: string; token: string | null }',
    'const API_KEY = process.env.API_KEY; MAX_TOKENS=4096', 'id INTEGER PRIMARY KEY, KEYBOARD 설정', 'git clone https://github.com/org/repo.git, ssh://git@host:22/x, http://localhost:3000/@me',
    '예약 화면에서 휴무일을 영업시간 설정과 연결해 줘', 'GITHUB_TOKEN=${{ secrets.GITHUB_TOKEN }}'])
    assert.deepEqual(redactSecrets(text), { text, count: 0 }, text);
});

test('SESSIONS-RT1 the whole record is hidden and cleaned, its header too, so it can always be kept', () => {
  const d = session([{ role: 'user', at: T(0), text: '색 출력 \u001b[31m빨강\u001b[0m 그리고 제목\u000b부제목\u0007' }, { role: 'assistant', at: T(1), text: '고쳤어요', files: ['src/a.ts'] }],
    { cwd: 'C:\\work\\sk-telecom-portal-renewal', branch: 'feature/sk-1234-fix-login-redirect', title: `키 ${f('sk-', 'proj-', 'FAKE'.repeat(6))} 넣고 테스트` });
  for (const text of [sessionText(d).text, sessionChunks(d, d.turns)[0]]) {
    assert.ok(!secretLike(text) && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text), text);
    assert.ok(text.includes('색 출력 빨강 그리고 제목\n부제목'), text);
    assert.doesNotThrow(() => D.pasteRecord(D.createProject(), text, null));
    // Still read as that session's record, the parts that looked like keys hidden.
    const o = sessionOrigin(text);
    assert.equal(o.id, ID); assert.equal(o.cwd, `C:\\work\\${hidden}`); assert.equal(o.branch, `feature/${hidden}`);
  }
  assert.equal(sessionText(d).redacted, 3);
});

const PART1 = 'PART-ONE 먼저 테스트를 돌려 볼게요.', PART2 = 'PART-TWO 다 통과해요.';
test('SESSIONS-RC1 a reply taken while it was being written comes back with only what it gained, as its continuation', () => {
  const look1 = session([{ role: 'user', at: T(0), text: '테스트 고쳐 줘' }, { role: 'assistant', at: T(1), text: PART1, files: ['src/a.ts'] }]);
  assert.equal(newTurns(look1, null).length, 2);
  const mark = markAfter(look1, null, T(2));
  assert.equal(mark.lastAt, T(1)); assert.equal(mark.reply.chars, PART1.length); assert.equal(mark.reply.files, 1);
  // Read from the mark on: the reply (its time is its first piece's) went on and changed another file; a new prompt followed.
  const grown = [{ role: 'assistant', at: T(1), text: `${PART1}\n\n${PART2}`, files: ['src/a.ts', 'src/b.ts'] }, { role: 'user', at: T(9), text: '다음 것도' }];
  const taken = newTurns(session(grown), mark);
  assert.deepEqual(taken.map(t => [t.role, t.text, t.files ?? null, !!t.cont]), [['assistant', PART2, ['src/b.ts'], true], ['user', '다음 것도', null, false]]);
  const record = sessionChunks(session(grown), taken)[0];
  assert.ok(record.includes(`── Claude Code 답변(이어서) · `) && record.includes(`${PART2}\n(바꾼 파일: src/b.ts)`) && !record.includes('PART-ONE'), record);
  // Taken in full: the same reading again gives nothing.
  assert.deepEqual(newTurns(session(grown), markAfter(session(grown), mark, T(10))), []);
  // A reading whose reply has not gone on gives nothing either.
  assert.deepEqual(newTurns(look1, mark), []);
  // A reply whose time moved with its last piece (an older reading) is still known by how it starts.
  assert.deepEqual(newTurns(session([{ ...grown[0], at: T(5) }, grown[1]]), mark).map(t => [t.text, !!t.cont]), [[PART2, true], ['다음 것도', false]]);
  // A reply cut at its length limit reads differently once it grew: only its new files come in, never its start again.
  const clipped = `${'x'.repeat(50)}\n…(이후 5자 생략)`, cmark = markAfter(session([{ role: 'assistant', at: T(1), text: clipped, files: ['a.ts'] }]), null, T(2));
  assert.deepEqual(newTurns(session([{ role: 'assistant', at: T(1), text: `${'x'.repeat(50)}\n…(이후 900자 생략)`, files: ['a.ts', 'c.ts'] }]), cmark).map(t => [t.text, t.files, !!t.cont]), [['', ['c.ts'], true]]);
  const files = sessionChunks(session([]), [{ role: 'assistant', at: T(1), text: '', files: ['c.ts'], cont: true }])[0];
  assert.ok(files.endsWith(`── Claude Code 답변(이어서) · ${stamp(T(1))} ──\n(바꾼 파일: c.ts)`), files);
  // A mark from before (no reply kept): the turn at its time counts as taken, as it did.
  assert.deepEqual(newTurns(session(grown), { lastAt: T(1), count: 2, updatedAt: T(2) }).map(t => t.text), ['다음 것도']);
  // Turns with no times go by count: the reply taken last is the count's last.
  const untimed = turns => session(turns.map(t => ({ ...t, at: null })));
  const umark = markAfter(untimed(look1.turns), null, T(2));
  assert.deepEqual(newTurns(untimed([look1.turns[0], ...grown]), umark).map(t => [t.text, !!t.cont]), [[PART2, true], ['다음 것도', false]]);
});

test('SESSIONS-RC2 turns after the mark that a reading left out (its budget) are said in the first record, never dropped silently', () => {
  const turns = [{ role: 'user', at: T(0), text: '시작' }, { role: 'assistant', at: T(1), text: '좋아요' }];
  for (let i = 0; i < 10; i++) turns.push({ role: 'user', at: T(10 + 2 * i), text: `요청 ${i}` }, { role: 'assistant', at: T(11 + 2 * i), text: 'r'.repeat(1000) });
  const mark = markAfter(session(turns.slice(0, 2)), null, T(2));
  const parsed = { meta: { cwd: '/work/salon', cwds: ['/work/salon'], branch: 'main', startedAt: null, title: null, thread: null, parent: null }, turns, changes: [] };
  const read = (limits, since) => readSessionDetail(JSON.parse(JSON.stringify(sessionDetail(ID, 'claude', parsed, limits, since))));
  const d = read({ turnChars: 20000, replyChars: 5000 }, mark.lastAt);
  assert.ok(d.omitted > 1 && d.turns[0].at > mark.lastAt);
  // The reply taken last is the oldest left out: the rest are the new ones not read.
  assert.equal(leftSince(d, mark), d.omitted - 1);
  const first = sessionChunks(d, newTurns(d, mark), undefined, leftSince(d, mark))[0];
  assert.ok(first.includes(`(앞의 대화 ${d.omitted - 1}개는 길이 제한으로 넣지 않았어요.)`), first);
  // Nothing left out, or a reading that still holds the mark's turn (no gap): nothing to say.
  assert.equal(leftSince(read({ turnChars: 20000, replyChars: 300000 }, mark.lastAt), mark), 0);
  assert.equal(leftSince({ ...session(turns.slice(0, 6)), omitted: 2 }, mark), 0, 'a reading from before the mark (no since) has no gap');
  assert.equal(leftSince({ ...d, omitted: 3 }, null), 3, 'with no mark, every turn left out is said');
});

test('SESSIONS-RC3 a long stretch becomes several records within the limit, every turn once and in order', () => {
  const turns = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', at: T(i), text: `턴${String(i).padStart(2, '0')} ${'가'.repeat(5000)}` }));
  const chunks = sessionChunks(session(turns), turns, PASTED_TEXT_LIMIT, 4);
  assert.ok(chunks.length > 1);
  for (const c of chunks) { assert.ok(c.length <= PASTED_TEXT_LIMIT && c.startsWith('[Claude Code 세션 기록 · ')); assert.doesNotThrow(() => D.pasteRecord(D.createProject(), c, null)); }
  const order = chunks.join('\n').match(/턴\d\d/g);
  assert.deepEqual(order, turns.map((_, i) => `턴${String(i).padStart(2, '0')}`));
  assert.ok(chunks[0].includes('(앞의 대화 4개는') && !chunks.slice(1).some(c => c.includes('(앞의 대화')));
});

test('SESSIONS-RT2 a draft holding sessions after other text is kept as one record per session, each told by its own header', () => {
  const A = sessionText(session([{ role: 'user', at: T(0), text: '화면 고쳐 줘' }, { role: 'assistant', at: T(1), text: '했어요', files: ['a.ts'] }], { cwd: '/work/front' })).text;
  const B = sessionText(session([{ role: 'user', at: T(2), text: '[AgentFlow 인수인계 문서를 받아 이어감 · af-handover:QW3RTY:A_api · 나의 프로젝트 › 서버]\n서버 이어서' }], { id: OLD, cwd: '/work/server', branch: 'api' })).text;
  assert.deepEqual(recordParts(A), [A], 'one session: the text exactly as written');
  assert.deepEqual(recordParts('메모만 있어요\n\n둘째 줄'), ['메모만 있어요\n\n둘째 줄']);
  assert.deepEqual(recordParts(`${A}\n\n${B}`), [A, B]);
  assert.deepEqual(recordParts(`서버 쪽 작업 기록\n\n${B}\n\n`), ['서버 쪽 작업 기록', B]);
  let p = D.createProject();
  for (const t of recordParts(`${A}\n\n${B}`)) p = D.pasteRecord(p, t, null).project;
  assert.deepEqual(partSessions(p, null).map(s => [s.id, s.cwd]).sort(), [[ID, '/work/front'], [OLD, '/work/server']].sort());
  assert.deepEqual(partSessions(p, 'A_api').map(s => [s.id, s.tookOver]), [[OLD, true]], 'the takeover is credited to the session that took it');
});

/* ---------- the look itself, on a stand-in host (a project in memory, sessions read by the real sessionDetail) ---------- */
function memKv() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) }; }
const settle = () => new Promise(r => setTimeout(r, 20));
const ago = min => new Date(Date.now() - min * 60000).toISOString();
function source(sessions, { fail = () => false, limits } = {}) {
  return { kind: 'server', reads: [],
    async list(folder) { return sessions.filter(s => within([s.cwd], folder)).map(s => ({ id: s.id, tool: 'claude', title: null, preview: 'p', cwd: s.cwd, branch: null, startedAt: null, updatedAt: s.updatedAt, bytes: 1, ...(s.aliases ? { aliases: s.aliases } : {}) })); },
    async read(id, since = null) {
      this.reads.push([id, since]); if (fail(id)) throw Object.assign(new Error('x'), { code: 'NETWORK' });
      const s = sessions.find(x => x.id === id), parsed = { meta: { cwd: s.cwd, cwds: [s.cwd], branch: null, startedAt: null, title: null, thread: null, parent: null }, turns: structuredClone(s.turns), changes: [] };
      return readSessionDetail(JSON.parse(JSON.stringify(sessionDetail(id, 'claude', parsed, limits, since))));
    } };
}
/** One tab: its own open project; save refuses a text holding REFUSE-ME (as a text the domain refuses), and holds at most `limit`. */
function tab(src, { kv = memKv(), limit = Infinity, opened = { key: 'E1', kind: 'saved', project: D.createProject() }, conflict = () => false } = {}) {
  const host = { current: () => opened, kv, sources: { offered: () => true, current: () => src, usesServer: () => true, folderState: () => 'none', folders: () => [] },
    async save(key, texts) {
      if (conflict()) return { error: 'CONFLICT', refused: false };
      if (opened.project.pasted.length + texts.length > limit) return { error: 'FULL', refused: false };
      if (texts.some(t => t.includes('REFUSE-ME'))) return { error: 'REFUSED', refused: true };
      for (const t of texts) opened.project = D.pasteRecord(opened.project, t, null).project;
      return null;
    },
    full: () => (opened.project.pasted.length >= limit ? 'FULL' : null), canRead: () => false, read() {}, readBlocked: () => null };
  return { sync: createAutoSync(host), opened, kv, texts: () => opened.project.pasted.map(r => r.text), binding: () => JSON.parse(kv.getItem(AUTOSYNC_KEY))[opened.key] };
}
const pair = (min, ask, answer) => [{ role: 'user', at: ago(min), text: ask }, { role: 'assistant', at: ago(min - 1), text: answer }];

test('SESSIONS-AS1 each session is saved on its own: a refused one leaves the others in, and only it is read again', async () => {
  const bad = { id: OLD, cwd: '/w', updatedAt: ago(30), turns: pair(40, 'REFUSE-ME', 'x') }, good = { id: ID, cwd: '/w', updatedAt: ago(20), turns: pair(35, 'GOOD-PROMPT', 'ok') };
  const src = source([bad, good]), t = tab(src);
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 1); assert.ok(t.texts()[0].includes('GOOD-PROMPT'));
  assert.deepEqual(Object.keys(t.binding().marks), [ID]); assert.equal(t.binding().error, 'REFUSED'); assert.equal(t.binding().folders[0].backfilled, false);
  src.reads.length = 0; await t.sync.tick();
  assert.deepEqual(src.reads.map(r => r[0]), [OLD], 'only the refused session is read again');
});

test('SESSIONS-AS2 a project that can take no more stops with one lasting message: nothing is read again until asked', async () => {
  const s1 = { id: OLD, cwd: '/w', updatedAt: ago(30), turns: pair(40, 'ONE', 'x') }, s2 = { id: ID, cwd: '/w', updatedAt: ago(20), turns: pair(35, 'TWO', 'y') };
  const src = source([s1, s2]), t = tab(src, { limit: 1 });
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 1); assert.deepEqual(Object.keys(t.binding().marks), [OLD], 'only what was kept is marked');
  assert.equal(t.binding().error, 'FULL');
  src.reads.length = 0; for (let i = 0; i < 3; i++) await t.sync.tick();
  assert.equal(src.reads.length, 0, 'no session read again'); assert.equal(t.binding().error, 'FULL');
  // A save that fails for another reason (another tab saved meanwhile) stops this tab's looks too, until '지금 확인'.
  const u = tab(source([{ ...s2 }]), { conflict: () => true });
  u.sync.connect('/w'); await settle();
  assert.equal(u.binding().error, 'CONFLICT'); assert.deepEqual(u.binding().marks, {});
  await u.sync.tick(); await u.sync.tick(true);
  assert.equal(u.binding().error, 'CONFLICT');
});

test('SESSIONS-AS3 a folder\'s first look is done only when every session of it was read: one not read, or still being written, is taken whole later', async () => {
  let failing = true;
  const A = { id: OLD, cwd: '/w', updatedAt: ago(30), turns: pair(300, 'HISTORY-A', 'done A') }, B = { id: ID, cwd: '/w', updatedAt: ago(60), turns: pair(200, 'HISTORY-B', 'done B') };
  const t = tab(source([A, B], { fail: id => id === OLD && failing && !(failing = false) }));
  t.sync.connect('/w'); await settle();
  assert.equal(t.binding().folders[0].backfilled, false); assert.ok(t.binding().error.startsWith('w: '));
  await t.sync.tick();
  assert.ok(t.texts().some(x => x.includes('HISTORY-A')), 'its history before the connection still came in');
  assert.equal(t.binding().folders[0].backfilled, true); assert.equal(t.binding().error, null);
  // Without force a session still being written waits, and the folder's first look waits with it.
  const C = { id: ID, cwd: '/v', updatedAt: ago(0.5), turns: pair(300, 'HISTORY-C', 'done C') }, u = tab(source([C]));
  u.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/v', connectedAt: ago(1), since: ago(20000), backfilled: false }], marks: {}, runs: { day: 'x', n: 0, last: null }, taken: 0, lastCheck: null, error: null } }));
  await u.sync.tick();
  assert.equal(u.texts().length, 0); assert.equal(u.binding().folders[0].backfilled, false);
  C.updatedAt = ago(5); await u.sync.tick();
  assert.ok(u.texts()[0].includes('HISTORY-C')); assert.equal(u.binding().folders[0].backfilled, true);
});

test('SESSIONS-AS4 a reply read while being written is continued, reading from the mark on; a gap is said', async () => {
  const S1 = { id: ID, cwd: '/w', updatedAt: ago(30), turns: [{ role: 'user', at: ago(40), text: '마이그레이션 돌려 줘' }, { role: 'assistant', at: ago(39), text: PART1 }] };
  const src = source([S1]), t = tab(src);
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 1);
  S1.turns[1].text = `${PART1}\n\n${PART2}`; S1.updatedAt = ago(10);
  await t.sync.tick();
  assert.deepEqual(src.reads.at(-1), [ID, S1.turns[1].at], 'read from the mark on');
  assert.equal(t.texts().length, 2); assert.ok(t.texts()[1].includes(PART2) && !t.texts()[1].includes('PART-ONE'), t.texts()[1]);
  // A long stretch after the mark that the reading cannot send whole: the first record says how much was left out.
  const S2 = { id: OLD, cwd: '/x', updatedAt: ago(100), turns: pair(120, '시작', '좋아요') }, src2 = source([S2], { limits: { turnChars: 20000, replyChars: 5000 } }), u = tab(src2);
  u.sync.connect('/x'); await settle();
  for (let i = 0; i < 10; i++) S2.turns.push({ role: 'user', at: ago(90 - 2 * i), text: `요청 ${i}` }, { role: 'assistant', at: ago(89 - 2 * i), text: 'r'.repeat(1000) });
  S2.updatedAt = ago(5); await u.sync.tick();
  assert.match(u.texts()[1], /\(앞의 대화 \d+개는 길이 제한으로 넣지 않았어요\.\)/);
  assert.ok(u.texts()[1].includes('요청 9') && !u.texts()[1].includes('요청 0\n'));
});

test('SESSIONS-AS5 marks hold across ids, disconnecting and other tabs: nothing is taken twice', async () => {
  // A mark kept under the id the session had before (made from its file's path) is found by the listing's alias and moved.
  const S1 = { id: ID, aliases: [OLD], cwd: '/w', updatedAt: ago(10), turns: [...pair(60, 'PROMPT-ONE', 'one'), ...pair(20, 'PROMPT-TWO', 'two')] };
  const t = tab(source([S1]));
  t.kv.setItem(AUTOSYNC_KEY, JSON.stringify({ E1: { folders: [{ path: '/w', connectedAt: ago(100), since: ago(20000), backfilled: true }], marks: { [OLD]: { lastAt: ago(59), count: 2, updatedAt: ago(50) } }, runs: { day: 'x', n: 0, last: null }, taken: 1, lastCheck: null, error: null } }));
  await t.sync.tick();
  assert.equal(t.texts().length, 1); assert.ok(t.texts()[0].includes('PROMPT-TWO') && !t.texts()[0].includes('PROMPT-ONE'));
  assert.deepEqual(Object.keys(t.binding().marks), [ID]);
  // Disconnecting keeps the marks: connecting again takes nothing already taken.
  t.sync.disconnect();
  assert.equal(t.sync.bindingOf('E1'), null); assert.deepEqual(Object.keys(t.binding().marks), [ID]);
  t.sync.connect('/w'); await settle();
  assert.equal(t.texts().length, 1); assert.equal(t.binding().taken, 2);
  // Another tab whose look ran on an older copy and could not save never takes a session's mark back.
  const B = tab(source([S1]), { kv: t.kv, opened: t.opened, conflict: () => true }), before = t.binding().marks[ID];
  S1.turns.push(...pair(5, 'PROMPT-THREE', 'three')); S1.updatedAt = ago(3);
  const late = B.sync.tick(true); await t.sync.tick(); await late;
  assert.notDeepEqual(t.binding().marks[ID], before); assert.ok(t.binding().marks[ID].lastAt > before.lastAt);
  await t.sync.tick(true);
  assert.equal(t.texts().filter(x => x.includes('PROMPT-THREE')).length, 1);
});
