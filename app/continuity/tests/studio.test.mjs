// Studio: projection of real project data, the studio.1 contract, and the fetch handler's key/origin/error boundary.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { EXAMPLES, buildExample } from '../dist/public/shared/studio-examples.js';
import { studioView, subtreeRecords, buildAsk, validateAsk, validateReply, askBytes, ASK_BYTES, ASK_RECORDS, RECORD_CHARS } from '../dist/public/shared/studio.js';
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
test('STUDIO-D3 parts never shrink below their reading size; frames grow with children, siblings keep theirs', () => {
  const p = salon(), v = studioView(p), l = layoutScope(v, null, top, {});
  // Units (direct children of the scope) are cards with room for name, note and state; rows inside a group are compact.
  for (const b of l.boxes.values()) if (b.kind === 'node') { assert.ok(b.w >= NODE_W); assert.ok(b.h >= (b.face === 'unit' ? NODE_H : 38), `${b.id} ${b.face} ${b.h}`); }
  const book = partNamed(v, '예약하기'), before = l.boxes.get(book.id).h, slots = partNamed(v, '시간 고르기'), slotH = l.boxes.get(slots.id).h;
  assert.equal(l.boxes.get(book.id).kind, 'frame');
  // A fourth child: frame grows, the other rows keep their size.
  const more = { ...EXAMPLES[0], parts: [...EXAMPLES[0].parts, { key: 'extra', name: '대기 예약', note: '', parent: 'book' }] };
  const v2 = studioView(buildExample(more)), l2 = layoutScope(v2, null, top, {});
  assert.ok(l2.boxes.get(partNamed(v2, '예약하기').id).h > before);
  assert.ok(l2.boxes.get(partNamed(v2, '대기 예약').id).w >= NODE_W);
  assert.equal(l2.boxes.get(partNamed(v2, '시간 고르기').id).h, slotH);
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
    assert.equal(init.redirect, 'manual', 'Workers-compatible; never follow a redirect carrying the provider key');
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
  const cases = [[302, 'AI_UNAVAILABLE'], [307, 'AI_UNAVAILABLE'], [401, 'AI_AUTH_FAILED'], [402, 'AI_BALANCE_REQUIRED'], [429, 'AI_RATE_LIMIT'], [400, 'AI_CONFIG_REJECTED'], [500, 'AI_UNAVAILABLE']];
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

// Long Korean records (3 bytes per character), an emoji at a cut point and many long relation notes, all through the normal domain path.
function heavyProject() {
  const long = (seed, n) => `${seed} `.padEnd(n, '가나다라마바사아자차카타파하');
  const emoji = (n) => '기록😀'.repeat(Math.ceil(n / 4)).slice(0, n);
  const others = Array.from({ length: 30 }, (_, i) => ({ key: `o${i}`, name: `연결 부분 ${i + 1}`, note: '' }));
  const kinds = ['flow', 'needs', 'shares', 'related'];
  return buildExample({ id: 'heavy', name: '긴 기록 프로젝트', brief: long('목적', 1900),
    parts: [{ key: 'main', name: '결제 흐름', note: long('계획', 1900) }, ...others],
    relations: others.flatMap((o, i) => kinds.slice(0, i % 2 ? 4 : 3).map(k => ['main', o.key, k, long(`관계 ${i}`, 200)])),
    records: Array.from({ length: 7 }, (_, i) => ({ part: 'main', minutesAgo: 1000 - i * 100, request: long(`요청 ${i + 1}`, 3000),
      reply: { minutesAgo: 990 - i * 100, report: i === 6 ? emoji(3000) : long(`보고 ${i + 1}`, 3000), origin: 'Claude Code 세션 기록에서 정리', summary: long('설명', 1900), changes: [long('변화', 290)] } })) });
}

test('STUDIO-C2 long Korean material fits ASK_BYTES as UTF-8: newest first, excerpt marked, the rest counted, refs only to sent records', async () => {
  const p = heavyProject(), v = studioView(p), part = v.parts.find(x => x.name === '결제 흐름');
  const all = subtreeRecords(v, part.id);
  assert.equal(all.length, 14);
  // The earlier construction (first 14 records cut at 2,400 characters, every relation) was over the limit.
  const old = { ...buildAsk(p, v, part.id, 'summary', null).ask, coverage: undefined };
  delete old.coverage;
  old.records = all.slice(0, ASK_RECORDS).map((r, i) => ({ ref: `R${i + 1}`, kind: r.kind, at: r.at, part: '결제 흐름', text: r.text.slice(0, RECORD_CHARS), cut: r.text.length > RECORD_CHARS }));
  old.part.links = v.relations.filter(r => r.from === part.id).slice(0, 200).map(r => ({ other: 'x', direction: 'to', kind: r.kind, note: r.note }));
  assert.ok(askBytes(old) > ASK_BYTES, `old size ${askBytes(old)}`);

  const { ask, refs, coverage } = buildAsk(p, v, part.id, 'question', '이모지😀 포함 질문: 결제는 어디까지 됐어?');
  assert.ok(askBytes(ask) <= ASK_BYTES, `new size ${askBytes(ask)}`);
  assert.deepEqual(validateAsk(JSON.parse(JSON.stringify(ask))), JSON.parse(JSON.stringify(ask)));
  assert.equal(coverage.records.total, 14);
  assert.ok(coverage.records.sent > 0 && coverage.records.sent < 14, 'some records are left out and counted');
  assert.equal(coverage.records.sent, ask.records.length);
  assert.ok(coverage.links.sent >= 1 && coverage.links.sent < coverage.links.total, 'large relation metadata keeps at least one representative');
  assert.deepEqual(ask.records.map(r => refs.get(r.ref)), all.slice(0, ask.records.length).map(r => r.id), 'newest first, refs map to the records actually sent');
  for (const r of ask.records) assert.ok(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(r.text) && !/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(r.text), 'no half emoji');
  assert.ok(ask.records.every(r => r.cut === (r.text.length < (all.find(x => x.id === refs.get(r.ref)).text.length))));

  // The real handler accepts it and reaches the (stub) provider; a reply may only cite sent records.
  let called = 0;
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k' }, fetchImpl: async (...a) => { called++; return providerReply({ ...okContent, answer: '답', refs: ['R1'] })(...a); } });
  const r = await handle(post(ask));
  assert.equal(r.status, 200); assert.equal(called, 1);
  assert.throws(() => validateReply({ ...okContent, answer: '답', refs: [`R${ask.records.length + 1}`] }, ask));
  // A request from an older open tab (no coverage) is still valid.
  const legacy = JSON.parse(JSON.stringify(ask)); delete legacy.coverage;
  assert.equal((await handle(post(legacy))).status, 200);
  // A coverage that does not match the records is refused.
  assert.throws(() => validateAsk({ ...JSON.parse(JSON.stringify(ask)), coverage: { ...coverage, records: { ...coverage.records, sent: 99 } } }));
});
