// Studio: projection of real project data, the studio.1 contract, and the fetch handler's key/origin/error boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXAMPLES, buildExample } from '../dist/public/shared/studio-examples.js';
import { studioView, subtreeRecords, buildAsk, validateAsk, validateReply } from '../dist/public/shared/studio.js';
import { parseProject, parseResultFile } from '../dist/public/shared/validation.js';
import { editArea } from '../dist/public/shared/domain.js';
import { layoutScope, NODE_W, NODE_H, ROOT, ghostId } from '../dist/public/client/map-layout.js';
import { createStudioHandler, readStudioConfig } from '../server/studio.mjs';

const salon = () => buildExample(EXAMPLES.find(e => e.id === 'salon'));
const partNamed = (v, name) => v.parts.find(p => p.name === name);

test('STUDIO-D1 examples are valid project.7 data whose returns come from real exports', () => {
  for (const spec of EXAMPLES) {
    const p = buildExample(spec);
    assert.deepEqual(parseProject(JSON.stringify(p)), p);
    for (const t of p.tasks.filter(t => t.resultFile)) {
      const f = parseResultFile(t.resultFile.rawText), parent = p.tasks.find(x => x.id === t.parentTaskId);
      assert.equal(f.taskId, parent.id);
      assert.ok(parent.handoffs.some(h => h.returnId === f.returnId && h.anchor), 'return points at an anchored export');
    }
  }
});

test('STUDIO-D2 map parts follow stored containment; records attach to the part of their task', () => {
  const p = salon(), v = studioView(p);
  for (const part of v.parts) assert.equal(part.parentId ?? undefined, p.space.containment.parents[part.id]);
  const book = partNamed(v, '예약하기');
  assert.deepEqual(book.childIds.map(id => v.parts.find(x => x.id === id).name), ['시간 고르기', '시술 선택', '예약 확인']);
  const slots = partNamed(v, '시간 고르기');
  assert.equal(slots.status, 'reported'); assert.match(slots.summary, /휴무일/);
  assert.equal(partNamed(v, '문자 알림').status, 'active');
  assert.equal(partNamed(v, '손님 정보').status, 'plan');
  assert.equal(book.status, 'reported', 'a group without its own requests reads its inside');
  const ids = new Set(p.sources.map(s => s.id));
  for (const r of v.records) assert.ok(ids.has(r.id));
  assert.ok(subtreeRecords(v, book.id).every(r => book.childIds.includes(r.partId)));
  // Report text is the external text as received, without the app's own label prefix.
  assert.ok(v.records.filter(r => r.kind === 'report').every(r => !r.text.startsWith('[Studio')));
});

const top = (id, depth) => depth === 0;
test('STUDIO-D3 layout keeps node size fixed and grows frames with children', () => {
  const p = salon(), v = studioView(p), l = layoutScope(v, null, top, {});
  for (const b of l.boxes.values()) if (b.kind === 'node') { assert.equal(b.w, NODE_W); assert.equal(b.h, NODE_H); }
  const book = partNamed(v, '예약하기'), before = l.boxes.get(book.id).h;
  assert.equal(l.boxes.get(book.id).kind, 'frame');
  // A fourth child: frame grows, node size stays.
  const more = { ...EXAMPLES[0], parts: [...EXAMPLES[0].parts, { key: 'extra', name: '대기 예약', note: '', parent: 'book' }] };
  const v2 = studioView(buildExample(more)), l2 = layoutScope(v2, null, top, {});
  assert.ok(l2.boxes.get(partNamed(v2, '예약하기').id).h > before);
  assert.equal(l2.boxes.get(partNamed(v2, '대기 예약').id).w, NODE_W);
});

test('STUDIO-D5 stored places win, children stay inside their frame, one sibling arrangement serves both views', () => {
  const v = studioView(salon()), book = partNamed(v, '예약하기'), slots = partNamed(v, '시간 고르기'), notify = partNamed(v, '문자 알림');
  const pos = { [ROOT]: { [notify.id]: { x: 900, y: 500 } }, [book.id]: { [slots.id]: { x: -120, y: 260 } } };
  const l = layoutScope(v, null, top, pos), f = l.boxes.get(book.id), c = l.boxes.get(slots.id);
  assert.deepEqual([l.boxes.get(notify.id).x, l.boxes.get(notify.id).y], [900, 500]);
  assert.ok(c.x >= f.x && c.y >= f.y && c.x + c.w <= f.x + f.w && c.y + c.h <= f.y + f.h, 'a moved child stays inside its parent frame');
  assert.deepEqual(c.rel, { x: -120, y: 260 });
  // Inside 예약하기 the same stored sibling place is used for the same part.
  const inside = layoutScope(v, book.id, top, pos);
  assert.deepEqual(inside.boxes.get(slots.id).rel, { x: -120, y: 260 });
  assert.ok(!inside.boxes.has(book.id) && !inside.boxes.has(notify.id), 'a scope shows only its inside');
});

test('STUDIO-D6 folding keeps relations on the visible part; partners outside a scope appear as ghosts', () => {
  const v = studioView(salon()), book = partNamed(v, '예약하기'), confirm = partNamed(v, '예약 확인'), list = partNamed(v, '예약 목록'), admin = partNamed(v, '관리자 화면');
  const folded = layoutScope(v, null, () => false, {});
  assert.equal(folded.boxes.get(book.id).kind, 'node');
  assert.ok(!folded.boxes.has(confirm.id));
  assert.ok(folded.edges.some(e => e.from === book.id && e.to === admin.id), 'confirm→list is carried by the folded parents');
  const inside = layoutScope(v, book.id, top, {});
  assert.ok(inside.edges.some(e => e.from === confirm.id && e.to === ghostId(list.id)));
  assert.equal(inside.boxes.get(ghostId(list.id)).kind, 'ghost');
});

test('STUDIO-D4 renaming a part keeps the stored format valid', () => {
  const p = salon(), id = partNamed(studioView(p), '손님 정보').id;
  const n = editArea(p, id, '손님 정보 · "예약자"', '이름/전화번호 {메모}');
  assert.deepEqual(parseProject(JSON.stringify(n)), n);
  assert.throws(() => editArea(p, id, '', ''));
});

test('STUDIO-C1 ask/reply contract: refs must be records that were sent', () => {
  const p = salon(), v = studioView(p), part = partNamed(v, '시간 고르기');
  const { ask, refs } = buildAsk(p, v, part.id, 'question', '휴무일은 어디서 정해?');
  assert.deepEqual(validateAsk(JSON.parse(JSON.stringify(ask))), ask);
  assert.equal(refs.size, ask.records.length);
  const good = { headline: 'h', situation: ['s'], changes: [], next: [], answer: 'a', refs: ['R1'] };
  assert.deepEqual(validateReply(good, ask).refs, ['R1']);
  assert.throws(() => validateReply({ ...good, refs: ['R99'] }, ask));
  assert.throws(() => validateReply({ ...good, answer: null }, ask), 'a question needs an answer');
  assert.throws(() => validateReply({ ...good, extra: 1 }, ask));
  assert.throws(() => validateAsk({ ...ask, version: 'studio.0' }));
});

const ask = () => { const p = salon(), v = studioView(p); return buildAsk(p, v, partNamed(v, '시간 고르기').id, 'summary', null).ask; };
const post = (body, headers = {}) => new Request('https://studio.example/api/studio/ask', { method: 'POST',
  headers: { 'content-type': 'application/json', 'x-agentflow-request': '1', origin: 'https://studio.example', ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body) });
const providerReply = content => async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(content) } }] }), { status: 200 });
const okContent = { headline: '휴무일 연결 전', situation: ['보고에 따르면 휴무일은 월요일로 임시 고정이다.'], changes: [], next: ['저장 위치를 정한다.'], answer: null, refs: ['R1'] };

test('STUDIO-S1 without a key: status off, ask fails with AI_NOT_CONFIGURED and never calls out', async () => {
  const handle = createStudioHandler({ env: {}, fetchImpl: () => assert.fail('no provider call') });
  const s = await handle(new Request('https://studio.example/api/studio/status'));
  assert.deepEqual(await s.json(), { ai: 'off', model: null, access: 'open' });
  const r = await handle(post(ask()));
  assert.equal(r.status, 503); assert.deepEqual(await r.json(), { error: { code: 'AI_NOT_CONFIGURED' } });
  // --mock keeps studio off even if a key is present in the environment.
  assert.equal(readStudioConfig({ AI_MODE: 'mock', DEEPSEEK_API_KEY: 'k' }).apiKey, '');
});

test('STUDIO-S2 key stays server-side: sent only as the provider Authorization header, never in a response', async () => {
  const key = 'test-key-not-real-0123456789'; let seen = null;
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: key }, fetchImpl: async (url, init) => {
    seen = { url, auth: init.headers.Authorization, body: JSON.parse(init.body) };
    return providerReply(okContent)();
  } });
  const r = await handle(post(ask())), text = await r.text();
  assert.equal(r.status, 200); assert.ok(!text.includes(key));
  assert.equal(seen.url, 'https://api.deepseek.com/chat/completions'); assert.equal(seen.auth, `Bearer ${key}`);
  assert.equal(seen.body.response_format.type, 'json_object'); assert.match(seen.body.messages[0].content, /JSON/);
  assert.equal(JSON.parse(text).reply.headline, '휴무일 연결 전');
  const status = await (await handle(new Request('https://studio.example/api/studio/status'))).text();
  assert.ok(!status.includes(key));
  // A model reply that echoes the key is refused.
  const echo = createStudioHandler({ env: { DEEPSEEK_API_KEY: key }, fetchImpl: providerReply({ ...okContent, headline: key }) });
  assert.equal((await echo(post(ask()))).status, 502);
});

test('STUDIO-S3 provider failures are short codes, never substitute answers', async () => {
  const cases = [[401, 'AI_AUTH_FAILED'], [402, 'AI_BALANCE_REQUIRED'], [429, 'AI_RATE_LIMIT'], [400, 'AI_CONFIG_REJECTED'], [500, 'AI_UNAVAILABLE']];
  for (const [status, code] of cases) {
    const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k' }, fetchImpl: async () => new Response('{"error":"raw upstream"}', { status }) });
    const r = await handle(post(ask())), body = await r.json();
    assert.deepEqual(body, { error: { code } }); assert.ok(r.status >= 400);
  }
  const bad = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k' }, fetchImpl: providerReply({ headline: 'x' }) });
  assert.deepEqual(await (await bad(post(ask()))).json(), { error: { code: 'INVALID_RESPONSE' } });
  const down = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k' }, fetchImpl: async () => { throw new TypeError('fetch failed'); } });
  assert.deepEqual(await (await down(post(ask()))).json(), { error: { code: 'AI_NETWORK_ERROR' } });
});

test('STUDIO-S4 origin and access boundary', async () => {
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k', STUDIO_ALLOWED_ORIGINS: 'https://ui.example' }, fetchImpl: providerReply(okContent) });
  assert.equal((await handle(post(ask(), { origin: 'https://evil.example' }))).status, 403);
  assert.equal((await handle(post(ask(), { 'x-agentflow-request': '' }))).status, 403);
  assert.equal((await handle(post(ask(), { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await handle(post('{broken'))).status, 400);
  assert.equal((await handle(post('x'.repeat(70000)))).status, 413);
  const cross = await handle(post(ask(), { origin: 'https://ui.example' }));
  assert.equal(cross.status, 200); assert.equal(cross.headers.get('access-control-allow-origin'), 'https://ui.example');
  const same = await handle(post(ask()));
  assert.equal(same.status, 200); assert.equal(same.headers.get('access-control-allow-origin'), null);
  const pre = await handle(new Request('https://studio.example/api/studio/ask', { method: 'OPTIONS', headers: { origin: 'https://ui.example' } }));
  assert.equal(pre.status, 204);
  const coded = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k', STUDIO_ACCESS_CODE: 'open-sesame' }, fetchImpl: providerReply(okContent) });
  assert.equal((await coded(post(ask()))).status, 401);
  assert.equal((await coded(post(ask(), { 'x-studio-access': 'open-sesame' }))).status, 200);
});

test('STUDIO-S5 handler and adapter modules import nothing from node:', async () => {
  for (const f of ['../server/studio.mjs', '../server/worker.mjs', '../../server/errors.mjs', '../../server/limiter.mjs']) {
    const src = await readFile(new URL(f, import.meta.url), 'utf8');
    assert.ok(!/from\s+['"]node:|require\(|process\./.test(src.replace(/\/\/.*$/gm, '')), f);
  }
  const worker = (await import('../server/worker.mjs')).default;
  const r = await worker.fetch(new Request('https://studio.example/api/studio/status'), {});
  assert.deepEqual(await r.json(), { ai: 'off', model: null, access: 'open' });
  assert.equal((await worker.fetch(new Request('https://studio.example/other'), {})).status, 404);
});
