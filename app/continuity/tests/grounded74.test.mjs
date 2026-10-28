// AF-EXPERIENCE74: evidence named by exact passage (span.2 pieces, studio.map.4, map-reading.4, project.12). The replies below are
// written for the test (a stub, not a model): they check the contract (wire, both validations, the one write, storage, backup and
// the marked place) and what it refuses, never a model's reading quality. Samples: the experience73 actual-order backup (the real
// AgentFlow73 instruction with its quoted correction as test material), the record69 Node-RED PR6019 author's text, the request72
// synthetic sequential sample, and short synthetic texts written here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as S from '../dist/public/shared/evidence-span.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as R from '../dist/public/shared/request-return.js';
import { studioView } from '../dist/public/shared/studio.js';
import { parseProject, parseBackup } from '../dist/public/shared/validation.js';
import { serializeBackup, serializeProject } from '../dist/public/shared/storage.js';
import { askMap, aiStatus } from '../dist/public/client/studio-api.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { MAP3_PROMPT, MAP4_PROMPT, MAP4_FIRST_PROMPT, MAP6_PROMPT, MAP6_FIRST_PROMPT, MAP6_RECIPE, map4Prompt } from '../server/map-prompt.mjs';
import { sample } from './understanding17-fixtures.mjs';

const ORDER_RAW = readFileSync(new URL('./fixtures/record74/actual-order-backup.json', import.meta.url), 'utf8');
const ORDER = JSON.parse(ORDER_RAW).pasted[0].text;
const PR6019 = readFileSync(new URL('./fixtures/record69/node-red-pr6019.txt', import.meta.url), 'utf8');
const SEQ = JSON.parse(readFileSync(new URL('../../../docs/cycles/2026-10-26-visual-experience-59/request72-sequential-sample.json', import.meta.url), 'utf8'));
const SAMPLE_RQ = 'RQ_efb368df-baa4-4668-ab7c-8e4f156daea8', REPORT71 = SEQ.pasted[1].text, CORRECTION72 = SEQ.pasted[2].text;

let n = 0;
const meta = () => ({ id: `R_g74_${++n}`, at: new Date().toISOString(), model: 'stub', prompt: 'm4-000000000000', hash: String(n).padStart(64, 'e') });
const ask4 = (p, scopes = [], selected) => M.buildMapAsk(p, studioView(p), scopes, selected, true);
const reply4 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
const apply4 = (p, inp, r) => M.applyReading(p, inp, M.validateMapReply(r, inp.ask), meta());
const part = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [], ...o });
const claim = (kind, text, at, o = {}) => ({ kind, text, at, about: null, replaces: null, ...o });
/** The alias of the sent piece that begins with these words (the nth such piece of that record). */
function piece(inp, words, nth = 0, rec = 'N01') {
  const hits = inp.ask.records.find(x => x.id === rec).spans.filter(x => x.t.trimStart().startsWith(words));
  assert.ok(hits.length > nth, `no piece starting with ${words}`); return hits[nth].s;
}
const lastReading = p => p.readings.filter(r => r.version.startsWith('map-reading.')).at(-1);
const round = p => parseProject(JSON.stringify(p));
const exact = (p, q) => { const t = [...p.pasted, ...p.sources].find(r => r.id === q.record).text; return t.slice(q.from, q.to) === q.quote; };
const allQuotes = r => [...r.parts.flatMap(x => [...x.basis, ...x.claims, ...(x.roleReplaces ? [x.roleReplaces] : [])]), ...r.relations.map(x => x.quote), ...r.candidates.flatMap(c => c.quote ? [c.quote] : [])];
const refused = (fn, code = 'INVALID_RESPONSE') => assert.throws(fn, e => e.message === code);
function plan(p, area, titles = ['폴더 안 마크다운 문서 일괄 변환', '파일 하나가 실패해도 나머지 계속 처리', '마지막에 파일별 성공·실패 요약 표시']) {
  const evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: titles.join(' / '), basis: '사용자 초안' }];
  const analysis = { summary: '폴더', items: titles.map((title, i) => ({ id: `change_${i + 1}`, title, description: `${title}을 원함`, partIds: [area], refs: ['INTENT'], dependsOn: [] })), impacts: [], preserve: [], unknowns: [] };
  return C.requestSnapshot(C.createPlan(p.id, '기준', evidence[0].text, evidence, analysis));
}

/* ---------- A: the codec ---------- */
const MIXED = '😀 v1은 폴더 입력을 지원하지 않습니다.\r\nv2의 feature/folder 브랜치에서만 폴더 입력을 지원합니다. main에는 아직 병합하지 않았습니다.\r\n## 제목\r\n- 항목 **하나**. 둘째 문장!\r\n\r\n```js\r\nconst a = `x`; // 😀\r\n```\r\n> 인용 줄. 다음.\r\n| a | b |\r\n끝👍. 마지막';
test('74-A span.2 cuts the excerpt exactly: pieces join back to it (CRLF, emoji, Markdown), never split a surrogate, and read the same every time', () => {
  const spans = S.indexSpans(MIXED), w = S.encodeSpans('N01', MIXED);
  assert.equal(w.lead + w.spans.map(x => x.t).join(''), MIXED);
  assert.deepEqual(S.indexSpans(MIXED), spans); assert.deepEqual(S.decodeSpans('N01', JSON.parse(JSON.stringify(w))).spans, spans);
  for (const s of spans) for (const k of [s.from, s.to]) { const c = MIXED.charCodeAt(k - 1); assert.ok(!(c >= 0xd800 && c <= 0xdbff), 'no cut after a high surrogate'); }
  const texts = spans.map(s => MIXED.slice(s.from, s.to));
  assert.deepEqual(texts.slice(0, 3), ['😀 v1은 폴더 입력을 지원하지 않습니다.', 'v2의 feature/folder 브랜치에서만 폴더 입력을 지원합니다.', 'main에는 아직 병합하지 않았습니다.']);
  assert.ok(texts.includes('- 항목 **하나**.'), 'Markdown marks stay in the passage');
  assert.ok(texts.includes('```js\r\nconst a = `x`; // 😀\r\n```'), 'a fenced block is one code piece with its CRLF');
  assert.deepEqual(spans.filter(s => s.quoted).map(s => MIXED.slice(s.from, s.to)), ['> 인용 줄.', '다음.']);
  assert.equal(spans.find(s => MIXED.slice(s.from, s.to) === '## 제목').kind, 'h');
  // A long sentence goes on in the next piece, each within SPAN_MAX, the cut on a space, never inside an emoji.
  const long = `${'가'.repeat(250)} 나다. ${'😀'.repeat(200)}`, ls = S.indexSpans(long);
  assert.ok(ls.every(s => s.to - s.from <= S.SPAN_MAX)); assert.ok(ls[0].more && !ls[1].more);
  assert.ok(ls.every(s => !/[\ud800-\udbff]$/.test(long.slice(s.from, s.to)) && !/^[\udc00-\udfff]/.test(long.slice(s.from, s.to))));
});

test('74-A2 a span table that is not exactly what span.2 makes is no table; a reference names one piece or two adjacent ones of a paragraph', () => {
  const w = S.encodeSpans('N01', MIXED);
  const moved = structuredClone(w); moved.spans[1].t = moved.spans[1].t.slice(0, -3); moved.spans[2].t = w.spans[1].t.slice(-3) + moved.spans[2].t;
  const renamed = structuredClone(w); renamed.spans[3].s = 'N01.09';
  const unmarked = structuredClone(w); delete unmarked.spans.find(x => x.q).q;
  const marked = structuredClone(w); marked.spans[0].q = 1;
  const other = structuredClone(w); for (const x of other.spans) x.s = x.s.replace('N01', 'N02');
  for (const bad of [moved, renamed, unmarked, marked]) assert.equal(S.decodeSpans('N01', bad), null);
  assert.equal(S.decodeSpans('N01', other), null, "another record's aliases");
  const { text, spans } = S.decodeSpans('N01', w);
  assert.deepEqual(S.resolveRef('N01.02-03', 'N01', text, spans), { from: spans[1].from, to: spans[2].to, quote: text.slice(spans[1].from, spans[2].to) });
  for (const ref of ['N01.02-04', 'N01.2', 'N01.002', 'N02.01', 'N01.03-02', 'N01.99', 'N01.01,N01.03', ' N01.01']) assert.equal(S.resolveRef(ref, 'N01', text, spans), null, ref);
  const para = spans.findIndex((s, i) => spans[i + 1] && spans[i + 1].para !== s.para);
  assert.equal(S.resolveRef(`N01.${String(para + 1).padStart(2, '0')}-${String(para + 2).padStart(2, '0')}`, 'N01', text, spans), null, 'not across a paragraph');
});

/* ---------- B/C: the actual-order backup, as saved ---------- */
function actualOrder() {
  const { project } = parseBackup(ORDER_RAW);
  return { p: project, inp: ask4(project) };
}
test('74-B the actual-order backup reads as saved; the instruction goes once as pieces, the quoted correction marked as a quotation', () => {
  const { p, inp } = actualOrder();
  assert.equal(p.schemaVersion, 'idea015.project.13'); assert.equal(p.pasted[0].text, ORDER); assert.deepEqual(p.readings, []);
  assert.equal(inp.ask.schemaVersion, 'studio.map.4'); assert.equal(inp.problem, null); M.validateMapAsk(inp.ask);
  const rec = inp.ask.records[0];
  assert.deepEqual(Object.keys(rec).sort(), ['addedAt', 'basis', 'id', 'kind', 'lead', 'note', 'spans']); assert.equal(rec.lead + rec.spans.map(x => x.t).join(''), ORDER);
  assert.ok(new TextEncoder().encode(JSON.stringify(inp.ask)).length < 1.5 * new TextEncoder().encode(JSON.stringify(ORDER)).length, 'the text once, with a compact index');
  const quoted = rec.spans.filter(x => x.q).map(x => x.t.trim());
  assert.equal(quoted[0], '“요청문 RQ_efb368df-baa4-4668-ab7c-8e4f156daea8의 폴더 안 마크다운 문서 일괄 변환 항목에 대한 정정입니다.');
  assert.equal(quoted.at(-1), '새로운 실행·검사 결과는 없습니다.”'); assert.equal(quoted.length, 7);
  assert.deepEqual(inp.ask.requests, []); assert.deepEqual(inp.ask.priors, []);
  // A table that moved one boundary is refused by the server before any model call.
  const bad = structuredClone(inp.ask); bad.records[0].spans[0].t += bad.records[0].spans[1].t.slice(0, 2); bad.records[0].spans[1].t = bad.records[0].spans[1].t.slice(2);
  assert.throws(() => M.validateMapAsk(bad), /INVALID_INPUT/);
});

/** A written first-map reply for the actual instruction: two Studio responsibilities on the instruction's own sentences, the
 * correction read as material, and (to be refused) a converter part and a not-made claim resting only on that material. */
function orderReply(inp) {
  const first = piece(inp, '“요청문'), last = piece(inp, '새로운 실행·검사 결과는 없습니다.”');
  return reply4({ summary: '후속 정정 기록을 현재 이해와 원했던 변경으로 정확히 읽고, 요청 비교와 지도 카드가 같은 집계를 쓰도록 요구하는 지시예요.',
    parts: [
      part('new:current', { name: '현재 보고 판독', role: '후속 정정 기록을 붙이면 같은 지도에서 현재 이해와 원했던 변경을 정확하게 읽는다.', basis: [piece(inp, '목적:')], claims: [
        claim('want', '보고 있음·변경 성립·명시적 철회를 혼동하지 않고 옛 기록을 일일이 제외하지 않아도 되어야 함', piece(inp, '보고 있음/변경 성립')),
        claim('want', '명시적 철회는 특정 이전 대응 하나에만 연결', piece(inp, 'B 명시적철회')),
        // Resting on the quoted correction alone: it is the sample's state, never Studio's.
        claim('reported', '폴더 입력은 미구현', piece(inp, 'feature/folder의 폴더 입력은'))] }),
      part('new:compare', { name: '요청 비교 집계', role: '접힌 항목과 지도 요약이 같은 집계로 현재 진전을 읽는다.', basis: [piece(inp, '하나의집계함수')], claims: [
        claim('want', '미구현 3항목을 진전으로 세지 않아야 함', piece(inp, '2 실제공개AI')),
        claim('want', '지도와 요청 비교가 상반되지 않게', piece(inp, 'D 지도와요청비교'))] }),
      part('new:folder', { name: '폴더 입력 일괄 변환', basis: [piece(inp, '“요청문')], claims: [claim('reported', '폴더 입력 미구현', piece(inp, '실제로는 그 입력 처리를'))] })],
    relations: [{ from: 'new:compare', to: 'new:current', kind: 'shares', note: '같은 현재 판독 집계', at: piece(inp, '하나의집계함수') },
      { from: 'new:folder', to: 'new:current', kind: 'flow', note: '예문', at: piece(inp, '앞 보고의 입력 처리를') }],
    material: [{ at: `${first}-${last.split('.')[1]}`, what: '정정 판독 검사용 예문' }] });
}
test('74-C actual-order first map: Studio responsibilities linked to reading corrections, no converter part, every passage exact where it stands', () => {
  const { p, inp } = actualOrder(), { project, created, reading } = apply4(p, inp, orderReply(inp));
  assert.deepEqual(created.map(id => project.space.areas.find(a => a.id === id).name), ['현재 보고 판독', '요청 비교 집계']);
  assert.equal(project.space.areas.filter(a => /폴더|변환/.test(a.name)).length, 0, 'no part made of the sample');
  assert.deepEqual(reading.skipped.filter(x => x.reason === 'material'), [{ what: 'part', name: '폴더 입력 일괄 변환', reason: 'material' }, { what: 'relation', name: 'new:folder→new:current', reason: 'material' }]);
  assert.equal(project.space.relations.length, 1); assert.equal(reading.relations.length, 1);
  assert.equal(reading.version, 'map-reading.4');
  const start = ORDER.indexOf('“요청문'), end = ORDER.indexOf('없습니다.”') + '없습니다.”'.length;
  assert.deepEqual(reading.material, [{ record: p.pasted[0].id, from: start, to: end, what: '정정 판독 검사용 예문' }]);
  const current = reading.parts.find(x => x.created?.name === '현재 보고 판독');
  assert.deepEqual(current.claims.map(c => c.kind), ['want', 'want'], 'the sample\'s not-made is no claim of Studio');
  assert.ok(reading.parts.flatMap(x => x.claims).every(c => c.kind !== 'reported' && c.kind !== 'checked'), 'no progress made up');
  for (const q of allQuotes(reading)) { assert.ok(exact(project, q), q.quote); assert.ok(q.to <= start || q.from >= end, 'nothing rests on the material'); }
  assert.deepEqual(reading.records, [{ id: p.pasted[0].id, from: 0, to: ORDER.length, total: ORDER.length, digest: S.textDigest(ORDER) }]);
  const u = M.partUnderstanding(project, created[0]);
  assert.equal(u.state, 'want'); assert.ok(u.claims.every(c => Number.isInteger(c.from) && ORDER.slice(c.from, c.to) === c.quote));
  assert.deepEqual(round(project), project); assert.deepEqual(parseBackup(serializeBackup(project, null)).project, project, 'backup round trip');
  assert.ok(!/폴더|미구현/.test(reading.summary));
});

test('74-C2 the same reply through the real handler and the browser decoder: the server validates, returns references, the client decodes them again', async () => {
  const { p, inp } = actualOrder(), written = orderReply(inp);
  let sent = null;
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-74-not-real', DEEPSEEK_PLAN_MODEL: 'stub-model' }, fetchImpl: async (_u, init) => {
    sent = JSON.parse(init.body); return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(written) } }] }));
  } });
  const oldFetch = globalThis.fetch;
  try {
    let raw = null;
    globalThis.fetch = async (url, o) => { const res = await handle(new Request(`https://studio.example${url}`, { ...o, headers: { ...o.headers, origin: 'https://studio.example' } })); raw = await res.clone().json(); return res; };
    const res = await askMap(inp.ask, new AbortController().signal, '');
    assert.equal(sent.messages[0].content, MAP4_FIRST_PROMPT, 'an empty map reads with the first-map prompt'); assert.equal(sent.messages[1].content.split('\n').slice(1).join('\n'), JSON.stringify(inp.ask));
    assert.equal(raw.reply.parts[0].basis[0], written.parts[0].basis[0], 'the server answers with the references');
    assert.deepEqual(raw.evidence, { index: 'span.2', ask: S.textDigest(JSON.stringify(inp.ask)) });
    assert.equal(res.reply.parts[0].basis[0].quote, ORDER.slice(res.reply.parts[0].basis[0].from, res.reply.parts[0].basis[0].to));
    const applied = M.applyReading(p, inp, res.reply, meta());
    assert.deepEqual(applied.created.length, 2);
    // A response that names another request body, or none, is not decoded at all.
    globalThis.fetch = async () => new Response(JSON.stringify({ ...raw, evidence: { index: 'span.2', ask: 'f1-0000000000000000' } }));
    await assert.rejects(askMap(inp.ask, new AbortController().signal, ''), e => e.code === 'INVALID_RESPONSE');
    globalThis.fetch = async () => new Response(JSON.stringify({ model: raw.model, reply: raw.reply }));
    await assert.rejects(askMap(inp.ask, new AbortController().signal, ''), e => e.code === 'INVALID_RESPONSE');
  } finally { globalThis.fetch = oldFetch; }
});

/* ---------- D: a repeated sentence keeps the place it was read ---------- */
const REPEAT = '## 판독 예문\n앞 보고의 입력 처리를 바꿨습니다.\n\n## 실제 보고\n앞 보고의 입력 처리를 바꿨습니다.\n검사는 기존 단일 문서만 했습니다.';
const SENT = '앞 보고의 입력 처리를 바꿨습니다.';
test('74-D the same sentence as a sample and as the real report: the second place is kept through the claim, the match, storage and the mark', () => {
  let p = D.addArea(D.createProject(), '입력 처리', ''); const area = p.space.areas[0].id;
  const snap = plan(p, area), q = snap.scope;
  p = D.pasteRecord(p, REPEAT, null).project;
  const inp = ask4(p, [q]), second = piece(inp, SENT, 1), first = piece(inp, SENT, 0);
  assert.equal(inp.ask.schemaVersion, 'studio.map.4'); assert.notEqual(first, second);
  const r = reply4({ parts: [part('P01', { claims: [claim('reported', '입력 처리를 바꿨다고 보고함', second)] })],
    matches: [{ at: second, text: '입력 처리를 바꿨다고 보고함', kind: 'reported', stance: 'made', about: null, targets: [{ requestId: q.id, itemId: 'change_1' }], why: '입력 처리 항목', replaces: null },
      { at: first, text: '예문', kind: 'reported', stance: 'made', about: null, targets: [{ requestId: q.id, itemId: 'change_1' }], why: '예문', replaces: null }],
    material: [{ at: `${first.replace(/\.\d+$/, '')}.01-02`, what: '판독 예문' }] });
  const { project, reading } = apply4(p, inp, r), at = REPEAT.lastIndexOf(SENT);
  assert.notEqual(at, REPEAT.indexOf(SENT));
  assert.equal(reading.parts[0].claims[0].from, at); assert.equal(reading.parts[0].claims[0].to, at + SENT.length);
  assert.deepEqual(reading.matches.map(m => [m.from, m.to]), [[at, at + SENT.length]], 'the sample passage is no report of the request');
  const u = M.partUnderstanding(project, area); assert.equal(u.claims[0].from, at);
  assert.equal(R.itemReading(R.requestMatches(project), { requestId: q.id, itemId: 'change_1' }).lead.match.from, at);
  const again = round(project); assert.equal(lastReading(again).parts[0].claims[0].from, at);
  // The copied-quote path (studio.map.3) could only find the first place: the anchored one never re-selects by its words.
  assert.equal(R.recordTexts(project).get(reading.records[0].id).read.slice(at, at + SENT.length), SENT);
});

/* ---------- E: what a reply cannot do ---------- */
test('74-E references that do not name a sent piece, copied quotes on the anchored wire and anchored replies to an older wire are all refused', () => {
  const p = D.pasteRecord(D.createProject(), MIXED, null).project, inp = ask4(p), ok = 'N01.02';
  const fresh = (o = {}) => reply4({ parts: [part('new:a', { name: '폴더 입력', basis: [ok], claims: [claim('describes', 'v2에서만 지원', ok)], ...o })] });
  M.validateMapReply(fresh(), inp.ask);
  for (const at of ['N01.99', 'N02.01', 'N01.01-03', 'N01.2', 'N01.01,N01.03', 'R01.01', '😀 v1은', 0, null]) refused(() => M.validateMapReply(fresh({ basis: [at] }), inp.ask));
  refused(() => M.validateMapReply(fresh({ basis: [{ record: 'N01', quote: 'v2의 feature/folder 브랜치에서만 폴더 입력을 지원합니다.' }] }), inp.ask));
  refused(() => M.validateMapReply(fresh({ claims: [{ kind: 'describes', text: 'x', record: 'N01', quote: 'v2의 feature/folder 브랜치에서만 폴더 입력을 지원합니다.', about: null, replaces: null }] }), inp.ask));
  refused(() => M.validateMapReply(fresh({ claims: [{ ...claim('describes', 'x', ok), record: 'N01' }] }), inp.ask));
  const { material: _m, ...noMaterial } = fresh(); refused(() => M.validateMapReply(noMaterial, inp.ask));
  refused(() => M.validateMapReply({ ...fresh(), material: [{ at: 'N01.01-99', what: '예문' }] }, inp.ask));
  refused(() => M.validateMapReply({ ...fresh(), material: [{ at: 'N01.01', what: '예문', from: 0 }] }, inp.ask));
  // An older tab's request: references mean nothing there.
  const old = M.buildMapAsk(p, studioView(p));
  assert.equal(old.ask.schemaVersion, 'studio.map.1'); refused(() => M.validateMapReply(fresh(), old.ask));
  // A reply decoded for another request does not apply to this one, even where the aliases exist in both.
  const p2 = D.pasteRecord(D.createProject(), REPEAT, null).project, other = ask4(p2), decoded = M.validateMapReply(fresh(), other.ask);
  refused(() => M.applyReading(p, inp, decoded, meta()));
});

/* ---------- F: the one write stays whole ---------- */
test('74-F a changed record, another reading meanwhile or a failed save leave only the records; a person\'s correction during reading stays theirs', async () => {
  const p0 = D.pasteRecord(D.createProject(), MIXED, null).project, inp = ask4(p0);
  const r = reply4({ parts: [part('new:a', { name: '폴더 입력', role: 'v2 브랜치에서만 폴더 입력을 지원한다.', basis: ['N01.02-03'], claims: [claim('describes', 'v1은 지원하지 않음', 'N01.01')] })] });
  const changed = JSON.parse(JSON.stringify(p0)); changed.pasted[0].text = MIXED.replace('v1', 'v0');
  refused(() => M.applyReading(changed, inp, M.validateMapReply(r, inp.ask), meta()), 'MAP_CHANGED');
  const first = apply4(p0, inp, r).project; refused(() => M.applyReading(first, inp, M.validateMapReply(r, inp.ask), meta()), 'MAP_CHANGED');
  assert.equal(p0.readings.length, 0);
  // The person corrects the description while a later record is read: the later description reads apart, the name stays theirs.
  const area = first.space.areas[0].id;
  let p = D.pasteRecord(first, '이제 폴더 입력은 v3에서 모든 판본에 열렸습니다. 이전 방식은 제거했습니다.', null).project;
  const inp2 = ask4(p);
  p = D.correctReadingRole(D.editArea(p, area, '내 폴더 입력', ''), area, '사용자가 바로잡은 설명');
  const later = apply4(p, inp2, reply4({ parts: [part('P01', { role: 'v3에서 모든 판본에 폴더 입력을 연다.', roleReplaces: 'N01.02', basis: ['N01.01'] })] })).project;
  const u = M.partUnderstanding(later, area);
  assert.equal(u.role, '사용자가 바로잡은 설명'); assert.ok(u.corrected); assert.equal(later.space.areas[0].name, '내 폴더 입력');
  assert.equal(u.others[0].text, 'v3에서 모든 판본에 폴더 입력을 연다.');
  // Through the map run: a save that fails keeps nothing, a cancelled call keeps nothing, and nothing reads as read.
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-74-not-real' }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(r) } }] })) });
  // An m5 server (the map.5 wire stays served after map.6): this checks the write, not which wire is current.
  const status = { ai: 'deepseek', model: 'm', access: 'open', map: { model: 'm', prompt: 'm5-0123456789ab' } };
  const oldFetch = globalThis.fetch; let project = p0, fails = true, bodies = [];
  try {
    globalThis.fetch = async (url, o) => { bodies.push(JSON.parse(o.body)); if (o.signal?.aborted) throw new DOMException('aborted', 'AbortError'); return handle(new Request(`https://studio.example${url}`, o)); };
    const run = createMapRun({ current: () => ({ key: 'e', kind: 'saved', project, view: studioView(project) }), status: () => status, accessCode: () => '',
      commit: async next => { if (fails) return '저장 실패'; project = next; return null; }, done: () => {}, changed: () => {} });
    await run.run(); assert.equal(project, p0); assert.match(run.state().error, /저장 실패/); assert.equal(M.unreadRecords(project, studioView(project)).length, 1);
    assert.equal(bodies[0].schemaVersion, 'studio.map.5', 'an m5 server is sent the anchored range wire');
    fails = false; await run.run(); assert.equal(project.readings.length, 1); assert.equal(lastReading(project).version, 'map-reading.4');
    // An m3 server (older deploy) is sent the copied-quote wire it reads.
    bodies = []; const old = createMapRun({ current: () => ({ key: 'o', kind: 'saved', project: p0, view: studioView(p0) }), status: () => ({ ...status, map: { model: 'm', prompt: 'm3-0123456789ab' } }), accessCode: () => '', commit: async () => '중단', done: () => {}, changed: () => {} });
    await old.run(); assert.equal(bodies[0].schemaVersion, 'studio.map.1');
    // A call cancelled while waiting: nothing applied, nothing said to be read.
    const fresh = D.pasteRecord(project, '새 기록입니다. 아직 읽지 않았습니다.', null).project; let kept = fresh;
    globalThis.fetch = (_u, o) => new Promise((_r, reject) => o.signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError'))));
    const run2 = createMapRun({ current: () => ({ key: 'c', kind: 'saved', project: kept, view: studioView(kept) }), status: () => status, accessCode: () => '', commit: async next => { kept = next; return null; }, done: () => {}, changed: () => {} });
    const pending = run2.run(); await new Promise(r => setTimeout(r, 5)); run2.cancel(); await pending;
    assert.equal(kept, fresh); assert.equal(run2.state().error, null); assert.equal(M.unreadRecords(kept, studioView(kept)).length, 1);
  } finally { globalThis.fetch = oldFetch; }
});

/* ---------- G: what was read, and only that ---------- */
test('74-G a long record goes up to a whole sentence; coverage is exactly that interval and the rest is read next time from there', () => {
  const sentence = i => `${i}번째 기록 문장은 폴더 입력의 조건과 예외를 설명하며 아직 정하지 않은 선택을 함께 적습니다.`;
  const text = Array.from({ length: 400 }, (_, i) => sentence(i + 1)).join(' ');
  assert.ok(text.length > M.MAP_RECORD_CHARS);
  let p = D.pasteRecord(D.createProject(), text, null).project;
  const inp = ask4(p), rec = inp.records.get('N01');
  assert.ok(rec.to < text.length && text[rec.to - 1] === '.' && text[rec.to] === ' ', 'ends where a sentence ends');
  assert.equal(inp.coverage.partial, 1); assert.match(inp.ask.records[0].note, /구간만 보냄/);
  p = apply4(p, inp, reply4({ parts: [part('new:a', { name: '폴더 입력 조건', basis: ['N01.01'] })] })).project;
  assert.deepEqual(lastReading(p).records, [{ id: p.pasted[0].id, from: 0, to: rec.to, total: text.length, digest: S.textDigest(text.slice(0, rec.to)) }]);
  const next = ask4(p); assert.equal(next.records.get('N01').from, rec.to);
  assert.equal(next.ask.records[0].lead, ' '); assert.equal(next.ask.records[0].spans[0].t.trim(), sentence(text.slice(0, rec.to).split('. ').length + 1));
  // At most SPANS_PER_RECORD pieces: a record of many short lines goes up to the last of them.
  const lines = Array.from({ length: 500 }, (_, i) => `줄 ${i + 1}.`).join('\n');
  const many = ask4(D.pasteRecord(D.createProject(), lines, null).project);
  assert.equal(many.ask.records[0].spans.length, S.SPANS_PER_RECORD); assert.equal(lines.slice(0, many.records.get('N01').to).split('\n').length, S.SPANS_PER_RECORD);
});

/* ---------- H: negation, version and merge scope stay with the passage ---------- */
test('74-H a passage keeps its own negation, branch and merge scope; a not-merged remark does not cancel the feature-branch report', () => {
  let p = D.addArea(D.createProject(), '폴더 일괄 처리', ''); const area = p.space.areas[0].id, snap = plan(p, area), q = snap.scope;
  p = D.pasteRecord(p, MIXED, null).project;
  const inp = ask4(p, [q]);
  const r = reply4({ parts: [part('P01', { claims: [claim('describes', 'v1은 폴더 입력을 지원하지 않음', 'N01.01', { about: 'v1' }), claim('reported', 'v2 feature/folder 브랜치에서만 지원, main 미병합', 'N01.02-03', { about: 'feature/folder' })] })],
    matches: [{ at: 'N01.02', text: 'feature/folder에서만 폴더 입력 지원', kind: 'reported', stance: 'made', about: 'feature/folder', targets: [{ requestId: q.id, itemId: 'change_1' }], why: '폴더 입력', replaces: null },
      { at: 'N01.03', text: 'main 미병합', kind: 'reported', stance: 'unclear', about: null, targets: [{ requestId: q.id, itemId: 'change_1' }], why: '병합 여부', replaces: null }] });
  const { project, reading } = apply4(p, inp, r), [neg, scoped] = reading.parts[0].claims;
  assert.equal(neg.quote, '😀 v1은 폴더 입력을 지원하지 않습니다.'); assert.equal(neg.from, 0);
  assert.equal(scoped.quote, 'v2의 feature/folder 브랜치에서만 폴더 입력을 지원합니다. main에는 아직 병합하지 않았습니다.');
  assert.equal(scoped.from, MIXED.indexOf('v2의'), 'UTF-16 position after an emoji and a CRLF');
  assert.ok(!S.indexSpans(MIXED).some(s => MIXED.slice(s.from, s.to) === '폴더 입력을 지원합니다.'), 'no piece is the bare positive clause');
  assert.equal(R.itemReading(R.requestMatches(project), { requestId: q.id, itemId: 'change_1' }).state, 'made');
  assert.equal(R.requestComparison(project, reading), '원한 항목 3개 · 변경 보고 1개 · 변경 근거 아직 없는 항목 2개');
});

/* ---------- I: earlier data and wires as they are ---------- */
test('74-I project.11 and earlier stay as stored (no position derived); map-reading.4 is checked where it stands; it never rides in a project.11', () => {
  const p0 = D.pasteRecord(D.createProject(), REPEAT, null).project, old = M.buildMapAsk(p0, studioView(p0));
  const legacy = M.applyReading(p0, old, M.validateMapReply({ summary: '', parts: [{ ref: 'new:a', name: '입력 처리', parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [{ record: 'N01', quote: SENT }], claims: [] }], relations: [], candidates: [], gaps: [] }, old.ask), meta()).project;
  const v11 = JSON.stringify({ ...legacy, schemaVersion: 'idea015.project.11' }), read = parseProject(v11);
  assert.equal(read.schemaVersion, 'idea015.project.13'); assert.deepEqual(read.readings, legacy.readings);
  assert.ok(!('from' in read.readings[0].parts[0].basis[0]), 'a repeated legacy quote gets no made-up position');
  const v10 = JSON.parse(ORDER_RAW); assert.equal(parseProject(ORDER_RAW).pasted[0].text, v10.pasted[0].text);
  // An anchored reading, then tampered copies of it.
  const inp = ask4(p0), good = apply4(p0, inp, reply4({ parts: [part('new:a', { name: '입력 처리', basis: [piece(inp, SENT, 1)], claims: [claim('reported', '입력 처리 보고', piece(inp, SENT, 1))] })], material: [{ at: 'N01.01-02', what: '예문' }] })).project;
  assert.deepEqual(round(good), good);
  const tamper = f => { const x = JSON.parse(JSON.stringify(good)); f(lastReading(x)); return JSON.stringify(x); };
  for (const bad of [
    tamper(r => { r.parts[0].claims[0].from += 1; }),
    tamper(r => { delete r.parts[0].claims[0].from; delete r.parts[0].claims[0].to; }),
    tamper(r => { r.records[0].digest = 'f1-0000000000000000'; }),
    tamper(r => { r.material[0].to = REPEAT.length + 5; }),
    tamper(r => { r.skipped.push({ what: 'part', name: 'x', reason: 'unknown' }); }),
    JSON.stringify({ ...good, schemaVersion: 'idea015.project.11' })
  ]) assert.throws(() => parseProject(bad));
  // Where it stands is what is stored: the same words at another place of the interval read are a place too (the file's own),
  // never derived from the words; the reading made here kept the second one.
  assert.equal(lastReading(good).parts[0].basis[0].from, REPEAT.lastIndexOf(SENT));
});

test('74-I2 server and client contracts: status names m6, an older tab\'s studio.map.3 is still answered with its own prompt and quotes', async () => {
  assert.match(await mapPromptId(), /^m6-[0-9a-f]{12}$/);
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-74-not-real' }, fetchImpl: async () => { throw new Error('status never calls the model'); } });
  const oldFetch = globalThis.fetch;
  try { globalThis.fetch = async () => handle(new Request('https://studio.example/api/studio/status')); assert.match((await aiStatus()).map.prompt, /^m6-/); } finally { globalThis.fetch = oldFetch; }
  let p = D.addArea(D.createProject(), '폴더 일괄 처리', ''); const q = plan(p, p.space.areas[0].id).scope;
  p = D.pasteRecord(p, REPORT71.replace(SAMPLE_RQ, q.id), null).project;
  const old = M.buildMapAsk(p, studioView(p), [q]); assert.equal(old.ask.schemaVersion, 'studio.map.3');
  let prompt = null;
  const h3 = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-74-not-real' }, fetchImpl: async (_u, init) => { prompt = JSON.parse(init.body).messages[0].content;
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [] }) } }] })); } });
  const res = await h3(new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body: JSON.stringify(old.ask) }));
  assert.equal(res.status, 200); assert.equal(prompt, MAP3_PROMPT); assert.ok(!('evidence' in await res.json()));
  // The anchored prompt asks for references and the material apart, and keeps the earlier boundaries (no fixed part count).
  assert.match(MAP4_PROMPT, /"N01\.07-08"/); assert.match(MAP4_PROMPT, /material/); assert.doesNotMatch(MAP4_PROMPT, /보통 3~8개/);
  assert.match(MAP4_PROMPT, /이 프로젝트와 무관한 조건/); assert.match(MAP4_PROMPT, /다음 정리에 다시 보내지지 않는다/);
});

/* ---------- J: a public sample's first map, a later record, then the sequential correction and its comparison ---------- */
test('74-J Node-RED PR6019 first map and a later record on the anchored wire; reported checks keep their scope; the 71→72 correction still reads 0 progress', () => {
  let p = D.pasteRecord(D.createProject(), PR6019, null).project;
  const inp = ask4(p);
  p = apply4(p, inp, reply4({ summary: 'MQTT broker 노드가 connect 동작의 url을 항상 쓰도록 바꿨다고 작성자가 보고하고, 범위를 밝힌 검사 결과를 적었어요.', parts: [
    part('new:broker', { name: 'MQTT broker 연결', role: 'connect 동작의 broker 설정으로 MQTT broker에 연결한다.', basis: [piece(inp, 'The broker node only applied')], claims: [
      claim('reported', 'connect 동작의 url을 항상 쓰도록 바꿨다고 보고함', piece(inp, 'Now a `url`')),
      claim('checked', '수정 후 MQTT spec 4 통과·28 보류(실제 broker 필요)라고 보고함', `${piece(inp, '- main 7f8d1ac').split('-')[0]}-${piece(inp, '- with the fix').split('.')[1]}`),
      claim('checked', 'lint 통과(편집기 클라이언트 소스만)라고 보고함', piece(inp, '`npm run lint` passes'))] })] })).project;
  const r1 = lastReading(p), [, check, lint] = r1.parts[0].claims;
  assert.match(check.quote, /^- main 7f8d1ac with the new test: 3 passing, 28 pending, 1 failing/); assert.match(check.quote, /- with the fix: 4 passing, 28 pending \(same on Node 24\.11\.1\)$/);
  assert.equal(lint.quote, '`npm run lint` passes, though it only covers the editor-client sources.');
  assert.equal(p.space.areas.length, 1, 'a responsibility, not the test file');
  for (const q of allQuotes(r1)) assert.ok(exact(p, q));
  // A later record about the same part attaches to it (P01); nothing is renamed.
  p = D.pasteRecord(p, '후속 보고: broker 노드의 재연결은 이번에도 같은 url을 씁니다. 전체 `npm run test`는 실행하지 않았습니다.', null).project;
  const inp2 = ask4(p);
  p = apply4(p, inp2, reply4({ parts: [part('P01', { claims: [claim('checked', '전체 npm run test는 실행하지 않았다고 밝힘', piece(inp2, '전체'))] })] })).project;
  assert.equal(p.space.areas[0].name, 'MQTT broker 연결'); assert.equal(M.partUnderstanding(p, p.space.areas[0].id).claims[0].quote, '전체 `npm run test`는 실행하지 않았습니다.');
  // 71 then 72 on the anchored wire: the explicit withdrawal by prior key, the item reads not made, history kept.
  let s = D.addArea(D.createProject(), '폴더 일괄 처리', ''); const area = s.space.areas[0].id, q = plan(s, area).scope;
  s = D.pasteRecord(s, REPORT71.replace(SAMPLE_RQ, q.id), area).project;
  const a71 = ask4(s, [q]), t = id => [{ requestId: q.id, itemId: id }];
  const mm = (at, item, o = {}) => ({ at, text: '범위', kind: 'reported', stance: 'made', about: null, targets: item ? t(item) : [], why: '스텁', replaces: null, ...o });
  s = apply4(s, a71, reply4({ matches: [mm(piece(a71, 'feature/folder 브랜치에서'), 'change_1', { about: 'feature/folder 브랜치' }), mm(piece(a71, 'main에는'), 'change_1', { stance: 'unclear' }),
    mm(piece(a71, '한 파일 실패 후'), 'change_2', { kind: 'open', stance: 'unclear' }), mm(piece(a71, '한 파일 실패 후'), 'change_3', { kind: 'open', stance: 'unclear' })] })).project;
  assert.equal(R.requestComparison(s, lastReading(s)), '원한 항목 3개 · 변경 보고 1개 · 변경 근거 아직 없는 항목 2개');
  s = D.pasteRecord(s, CORRECTION72.replace(SAMPLE_RQ, q.id), null).project;
  const a72 = ask4(s, [q]), key = a72.ask.priors.find(x => x.quote.startsWith('feature/folder 브랜치에서')).key;
  s = apply4(s, a72, reply4({ matches: [mm(`${piece(a72, '실제로는').split('.')[0]}.${piece(a72, '실제로는').split('.')[1]}-${piece(a72, 'feature/folder의').split('.')[1]}`, 'change_1', { stance: 'not-made', about: 'feature/folder', replaces: key }),
    mm(piece(a72, '한 파일 실패 후'), 'change_2', { stance: 'not-made' }), mm(piece(a72, '한 파일 실패 후'), 'change_3', { stance: 'not-made' })] })).project;
  assert.equal(R.requestComparison(s, lastReading(s)), '원한 항목 3개 · 변경 보고 0개 · 미구현 보고 3개');
  const one = R.itemReading(R.requestMatches(s), { requestId: q.id, itemId: 'change_1' });
  assert.equal(one.state, 'not-made'); assert.equal(one.lead.match.quote, '실제로는 그 입력 처리를 구상만 했으며 아직 구현하지 않았습니다. feature/folder의 폴더 입력은 미구현 상태입니다.');
  assert.equal(one.history[0].match.quote.startsWith('feature/folder 브랜치에서'), true);
  assert.deepEqual(round(s), s); assert.deepEqual(parseBackup(serializeBackup(s, null)).project, s);
  assert.equal(JSON.parse(serializeProject(s)).schemaVersion, 'idea015.project.13');
});

/* ---------- K: counterexamples of the 48cb real replies and the returned-report record ---------- */
test('74-K1 a returned report (return.2 import) is read, applied, stored and checked as the text it was sent as, never the prefixed source', () => {
  const s = sample(); let p = D.importResultFile(s.p, JSON.stringify(s.file));
  const src = p.sources.find(x => x.kind === 'report'), view = studioView(p).records.find(r => r.id === src.id);
  assert.equal(view.text, s.file.report); assert.notEqual(src.text, s.file.report, 'the stored source carries the app\'s own label');
  const inp = ask4(p), alias = [...inp.records].find(([, r]) => r.id === src.id)[0];
  const at = inp.ask.records.find(r => r.id === alias).spans[0].s;
  const { project, reading } = apply4(p, inp, reply4({ parts: [part('P01', { claims: [claim('reported', '반환 보고의 첫 구절', at)] })] }));
  const c = reading.parts[0].claims[0];
  assert.equal(s.file.report.slice(c.from, c.to), c.quote); assert.equal(reading.records.find(r => r.id === src.id).total, s.file.report.length);
  assert.deepEqual(round(project), project); assert.equal(R.recordTexts(project).get(src.id).read, s.file.report);
});

test('74-K2 indented code goes as one piece per block (a call and the line using its result stay together); a range never joins across a blank line', () => {
  const code = 'Excerpt: eval path\n\n    def eval(self, code):\n        # Parse the code\n        parser = Parser(code)\n        ast = parser.parse()\n\n        result = vm.run(compiled)\n\n        return self._to_python(result)\n';
  const spans = S.indexSpans(code), texts = spans.map(x => code.slice(x.from, x.to));
  assert.ok(texts.includes('def eval(self, code):\n        # Parse the code\n        parser = Parser(code)\n        ast = parser.parse()'));
  assert.ok(spans.filter(x => x.kind === 'c').length === 3);
  const i = texts.indexOf('result = vm.run(compiled)') + 1;
  assert.equal(S.resolveRef(`N01.${String(i).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`, 'N01', code, spans), null, 'a blank line between: another paragraph');
  // A list item indented four spaces is still a list item, not code.
  assert.equal(S.indexSpans('- a\n    - nested item. second.')[1].kind, 'l');
});

test('74-K3 an anchored reply that gets nothing and gives gaps as the reason is not kept (records stay unread); a reply with nothing to change is', async () => {
  const dts = 'Source: boards/x/x.dtsi\n\narduino_i2c: &i2c0 {\n\tcompatible = "nordic,nrf-twim";\n\tstatus = "okay";\n};\n';
  const p = D.pasteRecord(D.rename(D.createProject(), 'x-board'), dts, null).project, inp = ask4(p), empty = reply4({ gaps: ['작업 보고를 붙여 주세요.'] });
  refused(() => apply4(p, inp, empty), 'NOTHING_READ');
  assert.equal(M.unreadRecords(p, studioView(p)).length, 1);
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-74-not-real' }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(empty) } }] })) });
  const oldFetch = globalThis.fetch, prompt = await mapPromptId(); let saved = 0;
  try {
    globalThis.fetch = async (url, o) => handle(new Request(`https://studio.example${url}`, o));
    const run = createMapRun({ current: () => ({ key: 'z', kind: 'saved', project: p, view: studioView(p) }), status: () => ({ ai: 'deepseek', model: 'm', access: 'open', map: { model: 'm', prompt } }), accessCode: () => '', commit: async () => { saved++; return null; }, done: () => {}, changed: () => {} });
    await run.run(); assert.equal(saved, 0); assert.equal(run.state().error, '이번 응답에서 정리할 내용을 얻지 못했어요. 원문은 보존됐어요. 작업 보고를 붙여 주세요.');
  } finally { globalThis.fetch = oldFetch; }
  // Nothing to change and no reason given (the records add nothing to the map as it is) is a reading, kept as before.
  assert.equal(apply4(p, inp, reply4({})).reading.parts.length, 0);
  // What a source defines is a reading (describes), not a report: kept, and the record counts as read.
  const read = apply4(p, inp, reply4({ parts: [part('new:i2c', { name: 'I2C 버스', role: 'I2C 컨트롤러 설정을 정의한다.', basis: ['N01.03-04'], claims: [claim('describes', 'nrf-twim 호환 I2C로 정의됨', 'N01.04')] })] })).project;
  assert.equal(M.unreadRecords(read, studioView(read)).length, 0);
});

test('74-K4 the anchored prompt states every hard limit the validator holds, reads sources as describes, and keeps material out of gaps', () => {
  assert.match(MAP4_PROMPT, /부분마다 basis 4개\(새 부분은 1~4개\)·claims 4개, relations 12개, candidates 6개\(각 parts 2개\), gaps 2개, material 6개, matches 24개/);
  assert.match(MAP4_PROMPT, /parts 24개\(그중 새 부분 12개\)/);
  assert.match(MAP4_PROMPT, /소스 코드·설정·장치 정의\(DTS·스키마 등\)·설명 문서뿐이어도/); assert.match(MAP4_PROMPT, /실행·검사·구현 진전\(reported·checked\)이 아니다/);
  assert.match(MAP4_PROMPT, /summary·gaps·candidates에서도 그것을 이 프로젝트의 누락/); assert.match(MAP4_PROMPT, /빈 줄\(줄바꿈 두 번\)로 끝나면/);
  // The validator holds those limits: a fifth basis is refused, not cut.
  const p = D.pasteRecord(D.createProject(), MIXED, null).project, inp = ask4(p);
  refused(() => M.validateMapReply(reply4({ parts: [part('new:a', { name: 'a', basis: ['N01.01', 'N01.02', 'N01.03', 'N01.04', 'N01.05'] })] }), inp.ask));
});

test('74-K5 an earlier reading keeps the coordinates it was stored in (the labelled Source.text); it reads where it stands in the report as received, across versions', () => {
  const s = sample(); let p = s.p; const q = plan(p, s.area).scope;
  p = D.importResultFile(p, JSON.stringify(s.file));
  const src = p.sources.find(x => x.kind === 'report'), shift = src.text.length - s.file.report.length, first = '[공개 고정 코드의 재서술 · 실제 실행 미검증] a964f08은 QuerySubmitted에서 args.QueryText를 FilterKeyList로 전달한다.';
  assert.ok(shift > 0 && src.text.endsWith(s.file.report));
  // The older wire (an m3 server): the match is stored against Source.text, as map-reading.3 always was.
  const old = M.buildMapAsk(p, studioView(p), [q]), alias = [...old.records].find(([, r]) => r.id === src.id)[0];
  p = M.applyReading(p, old, M.validateMapReply({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [{ record: alias, quote: first, text: '전달 변경 보고', kind: 'reported', about: null, targets: [{ requestId: q.id, itemId: 'change_1' }], why: '스텁', stance: 'made', replaces: null }] }, old.ask), meta()).project;
  const stored = lastReading(p).matches[0];
  assert.equal(lastReading(p).version, 'map-reading.3'); assert.deepEqual([stored.from, stored.to], [shift, shift + first.length]); assert.equal(src.text.slice(stored.from, stored.to), first);
  assert.equal(lastReading(p).records.find(r => r.id === src.id).total, src.text.length);
  const v11 = JSON.stringify({ ...p, schemaVersion: 'idea015.project.11' }); assert.deepEqual(parseProject(v11).readings, p.readings, 'a project.11 with it reads as stored');
  // Read where it stands in the report as received: the ledger, the mark and coverage.
  const lead = () => R.itemReading(R.requestMatches(p), { requestId: q.id, itemId: 'change_1' }).lead;
  assert.equal(lead().match.from, 0); assert.equal(s.file.report.slice(lead().match.from, lead().match.to), first);
  assert.ok(!M.unreadRecords(p, studioView(p)).some(r => r.id === src.id), 'the report counts as read');
  // An anchored correction withdraws it by its prior key, in one coordinate system.
  p = D.pasteRecord(p, `요청문 ${q.id}의 정정입니다. 앞 보고의 전달 변경 구현 주장을 철회합니다. 실제로는 아직 구현하지 않았습니다.`, null).project;
  const inp = ask4(p, [q]), key = inp.ask.priors.find(x => x.quote === first).key;
  p = apply4(p, inp, reply4({ matches: [{ at: `${piece(inp, '앞 보고의')}-${piece(inp, '실제로는').split('.')[1]}`, text: '철회', kind: 'reported', stance: 'not-made', about: null, targets: [{ requestId: q.id, itemId: 'change_1' }], why: '철회', replaces: key }] })).project;
  const now = R.itemReading(R.requestMatches(p), { requestId: q.id, itemId: 'change_1' });
  assert.equal(now.state, 'not-made'); assert.equal(now.history[0].match.from, 0); assert.deepEqual(round(p), p);
});

test('74-K6 the independent project.11 backup (a map-reading.3 match stored at 164..326 of the labelled report) opens as saved and reads at the report as received', () => {
  const raw = readFileSync(new URL('./fixtures/record74/legacy-return-match.json', import.meta.url), 'utf8').trimEnd(), saved = JSON.parse(raw);
  const p = parseProject(raw), b = parseBackup(raw).project;
  assert.deepEqual(b, p); assert.equal(p.schemaVersion, 'idea015.project.13');
  assert.deepEqual(p.readings, saved.readings, 'the stored reading, its places and its records as they were');
  assert.deepEqual(JSON.parse(serializeProject(p)).readings, saved.readings, 'saving again writes the same places');
  const m = R.requestMatches(p)[0], report = R.recordTexts(p).get(m.match.record).read;
  assert.equal(saved.readings[0].matches[0].from, 164); assert.equal(m.match.from, 0); assert.equal(report.slice(m.match.from, m.match.to), m.match.quote);
  assert.equal(R.itemReading(R.requestMatches(p), { requestId: 'RQ_4be30332-aba3-4b69-889e-6aebb89440d7', itemId: 'I1' }).state, 'made');
  assert.ok(!M.unreadRecords(p, studioView(p)).some(r => r.id === m.match.record), 'the report reads as read (326 of the labelled text is all 162 of it)');
});

/* ---------- M: the first map reads with its own short prompt; everything else as 8d ---------- */
test('74-M1 the first-map prompt is chosen only for an empty map with no request or prior; a later reading keeps MAP4_PROMPT', () => {
  const { p, inp } = actualOrder();
  assert.equal(map4Prompt(inp.ask), MAP4_FIRST_PROMPT);
  assert.equal(map4Prompt({ ...inp.ask, requests: [{ id: 'RQ_x' }] }), MAP4_PROMPT); assert.equal(map4Prompt({ ...inp.ask, priors: [{ key: 'M01' }] }), MAP4_PROMPT);
  // After the first map, the next record reads against those parts with the full prompt (replacements, versions, requests).
  const after = apply4(p, inp, orderReply(inp)).project, later = ask4(D.pasteRecord(after, '후속 보고: 요청 비교 집계를 접힌 항목에도 썼다고 보고합니다.', null).project);
  assert.ok(later.ask.parts.length > 0); assert.equal(map4Prompt(later.ask), MAP4_PROMPT);
  // A map the person drew by hand (parts, no reading yet) is not a first map either.
  const drawn = D.pasteRecord(D.addArea(D.createProject(), '내가 그린 부분', ''), '요구: 단일 문서를 변환한다.', null).project;
  assert.equal(map4Prompt(ask4(drawn).ask), MAP4_PROMPT);
  // The first-map prompt leaves out what a first map has nothing to apply to, and keeps the reading rules.
  for (const gone of ['priors: 앞서 저장된', '기존 role이 있으면', 'stance:']) assert.ok(!MAP4_FIRST_PROMPT.includes(gone), gone);
  for (const kept of ['같은 문단에서 바로 이어지는 두 구간', '빈 줄(줄바꿈 두 번)로 끝나면', 'material에', '연결·사용·접속', '소스 코드·설정·장치 정의·설명 문서뿐이어도', '정리 작업의 보고로 쓰지 않는다', '부분마다 basis 1~4개·claims 4개']) assert.ok(MAP4_FIRST_PROMPT.includes(kept), kept);
  assert.ok(MAP4_FIRST_PROMPT.length < MAP4_PROMPT.length * 0.6);
});

test('74-M2 map.4 goes as in 8d (JSON, thinking enabled, low effort, 16384) with the chosen prompt; the id names the recipe of both prompts', async () => {
  const { p, inp } = actualOrder(), bodies = [], urls = [];
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'test-74-not-real' }, fetchImpl: async (u, init) => { urls.push(u); bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content: JSON.stringify(orderReply(inp)) } }] })); } });
  const post = ask => handle(new Request('https://studio.example/api/studio/map', { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body: JSON.stringify(ask) }));
  assert.equal((await post(inp.ask)).status, 200);
  const b = bodies[0];
  assert.equal(urls[0], 'https://api.deepseek.com/chat/completions'); assert.equal(b.messages[0].content, MAP4_FIRST_PROMPT);
  assert.deepEqual(b.response_format, { type: 'json_object' }); assert.deepEqual(b.thinking, { type: 'enabled' }); assert.equal(b.reasoning_effort, 'low'); assert.equal(b.max_tokens, 16384);
  assert.ok(!('tools' in b) && !('tool_choice' in b));
  const later = ask4(D.pasteRecord(apply4(p, inp, orderReply(inp)).project, '후속 보고: 요청 비교 집계를 접힌 항목에도 썼다고 보고합니다.', null).project);
  await post(later.ask); assert.equal(bodies[1].messages[0].content, MAP4_PROMPT);
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify({ recipe: MAP6_RECIPE, first: MAP6_FIRST_PROMPT, later: MAP6_PROMPT })));
  assert.equal(await mapPromptId(), `m6-${[...new Uint8Array(bytes)].slice(0, 6).map(x => x.toString(16).padStart(2, '0')).join('')}`);
});
