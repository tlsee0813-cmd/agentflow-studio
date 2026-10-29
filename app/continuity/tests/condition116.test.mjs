// AF116: studio.map.7, the later reading's raw condition references. Each condition the reply names (roleAboutAt, claim and
// statement aboutAt, match aboutAt) is a sent anchor of its owning record or null; the server resolves it to the record's exact
// passage and keeps the existing about string|null (map-reading.5, project14). A person's declaration of a provided source stays
// its own record.evidence, shown beside the record, never a condition. Map.1–6, FIRST6 and the m6 recipe are as before.
// Model-free: replies are author-written for their ask (condition116-case.mjs, a new photo-sorter case, not 113/114/115 wires);
// providers are fakes; the CLI is the 102 test stand-in. tests/fixtures/ready6-116 was written by the pre116 producer and codec
// (db63a42, docs/cycles/2026-10-30-condition-reference-116/make-ready6.mjs), not by this code.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import * as J from '../dist/public/shared/map-job.js';
import * as R from '../dist/public/shared/request-return.js';
import { parseProject, parseBackup } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { textDigest, SPAN_INDEX } from '../dist/public/shared/evidence-span.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import { savedReading } from '../dist/public/client/digest-source.js';
import { aiStatus } from '../dist/public/client/studio-api.js';
import { createMapRun } from '../dist/public/client/map-run.js';
import { JobReservations, JOBS_KEY } from '../dist/public/client/map-jobs.js';
import { createStudioHandler, mapPromptId, map7PromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import * as P from '../server/map-prompt.mjs';
import { openCliExecutor, readPolicy, wrap } from '../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs';
import * as K from './condition116-case.mjs';

const mods = { D, M, C, S, studioView, emptyBundle };
const sha = t => createHash('sha256').update(t).digest('hex');
const tick = () => new Promise(r => setTimeout(r, 5));
const until = async (f, why, n = 3000) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };
const meta = (id, prompt = 'm7-000000000116') => ({ id, at: new Date().toISOString(), model: 'stub-116', prompt, hash: sha(id) });
function later(anchored = M.MAP7_SCHEMA) {
  const c = K.conditionProject(mods), p = parseProject(JSON.stringify(c.project));
  return { ...c, p, inp: M.buildMapAsk(p, studioView(p), [c.rq], c.rq.id, anchored) };
}
const firstProject = () => D.pasteRecord(D.rename(D.createProject(), '첫 지도 116'), K.REQUIREMENT, null).project;
const refusal = (f) => { try { f(); } catch (e) { return e; } assert.fail('not refused'); };

test('116-1 the builder: a later ask goes as map.7 with the map.6 content, a first map stays map.6, map.7 is never a first map', () => {
  const { p, rq, inp } = later(), six = M.buildMapAsk(p, studioView(p), [rq], rq.id, M.MAP6_SCHEMA);
  assert.equal(inp.problem, null); assert.equal(inp.ask.schemaVersion, 'studio.map.7'); assert.equal(six.ask.schemaVersion, 'studio.map.6');
  assert.deepEqual({ ...inp.ask, schemaVersion: 'studio.map.6' }, six.ask, 'the same records, parts, requests and priors; only the schema differs');
  assert.deepEqual([...inp.records], [...six.records]); assert.deepEqual(inp.fullRequests, [rq]);
  assert.deepEqual(M.validateMapAsk(JSON.parse(JSON.stringify(inp.ask))), inp.ask);
  // A first map with the later capability: map.6 exactly as without it.
  const f = firstProject(), f7 = M.buildMapAsk(f, studioView(f), [], undefined, M.MAP7_SCHEMA), f6 = M.buildMapAsk(f, studioView(f), [], undefined, M.MAP6_SCHEMA);
  assert.equal(f7.ask.schemaVersion, 'studio.map.6'); assert.deepEqual(f7.ask, f6.ask); assert.ok(M.firstAsk(f7.ask));
  assert.throws(() => M.validateMapAsk({ ...f6.ask, schemaVersion: 'studio.map.7' }), /INVALID_INPUT/, 'map.7 is a later reading only');
  // A selected request with an empty map is later (the requests/priors predicate), not a first map.
  const onlyRq = { ...inp.ask, parts: [], relations: [] }; assert.ok(!M.firstAsk(onlyRq)); M.validateMapAsk(JSON.parse(JSON.stringify(onlyRq)));
  // The job codec carries map.7 as it carries map.6, and binds its m7 recipe.
  const wire = J.encodeMapInput(inp), back = J.decodeMapInput(JSON.parse(JSON.stringify(wire)));
  assert.equal(back.ask.schemaVersion, 'studio.map.7'); assert.deepEqual([...back.records], [...inp.records]);
  const binding = { entryId: 'E_cond0116-01', projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: 'studio.map.7', prompt: 'm7-0123456789ab', model: 'm', askHash: '0'.repeat(64), inputHash: '1'.repeat(64) };
  assert.deepEqual(J.validateBinding(binding), binding); assert.throws(() => J.validateBinding({ ...binding, prompt: 'm8-0123456789ab' }));
});

test('116-2 a lawful map.7 reply: each condition is its record\'s exact passage (trimmed), declarations stay beside the records', () => {
  const { p, inp } = later(), al = K.aliases(inp.ask, inp.records), wire = K.replyFor7(inp.ask, inp.records), raw = structuredClone(wire);
  const reply = M.validateMapReply(wire, inp.ask);
  assert.deepEqual(wire, raw, 'the incoming wire is not changed (the server returns it as it came)');
  const [webp, p01] = reply.parts;
  assert.equal(webp.roleAbout, K.COND_CRLF, 'two pieces of one record, CRLF inside kept, outer line ends trimmed');
  assert.deepEqual(p01.claims.map(c => c.about), [K.COND_CRLF, K.COND_CHECK, null, null]);
  assert.equal(reply.candidates[0].statement.about, K.C80); assert.equal(K.C80.length, 80, 'exactly the 80-unit bound');
  assert.deepEqual(reply.matches.map(m => m.about), [K.C200, null, '환경: Ubuntu 24.04 / Node 22.16 / 표본 120장', K.COND_CHECK]); assert.equal(K.C200.length, 200);
  assert.deepEqual(reply.matches.map(m => m.record), [al.report, al.code, al.check, al.report]);
  const applied = M.applyReading(p, inp, reply, meta('R_116-apply')), saved = parseProject(S.serializeProject(applied.project));
  assert.deepEqual(saved, applied.project, 'project14 reads it back the same'); assert.equal(saved.schemaVersion, 'idea015.project.14');
  assert.equal(applied.reading.version, 'map-reading.5'); assert.equal(applied.reading.prompt, 'm7-000000000116');
  assert.deepEqual(parseBackup(S.serializeBackup(saved, null)).project, saved, 'a backup keeps it');
  const stored = JSON.stringify(saved.readings.at(-1));
  assert.ok(!stored.includes('aboutAt') && !stored.includes('roleAboutAt'), 'no wire key is stored');
  for (const declared of [K.CODE_META.version, K.CHECK_META.version, K.CODE_META.origin]) assert.ok(!stored.includes(declared), `declaration never a condition: ${declared}`);
  const created = applied.reading.parts.find(x => x.created), own = applied.reading.parts.find(x => !x.created);
  assert.equal(created.roleAbout, K.COND_CRLF); assert.deepEqual(own.claims.map(c => c.about), [K.COND_CRLF, K.COND_CHECK, null, null]);
  assert.equal(applied.reading.candidates[0].statement.about, K.C80);
  const got = R.requestMatches(saved).filter(x => x.reading === 'R_116-apply');
  assert.deepEqual(got.map(x => x.match.about).sort(), [K.C200, null, '환경: Ubuntu 24.04 / Node 22.16 / 표본 120장', K.COND_CHECK].sort());
  for (const x of got) if (x.match.about) assert.ok(saved.pasted.find(r => r.id === x.match.record).text.includes(x.match.about), 'a passage of its own record');
  // Records, declarations, earlier readings and the frozen request are as they were.
  assert.deepEqual(saved.pasted, p.pasted); assert.deepEqual(saved.readings.slice(0, p.readings.length), p.readings);
  const code = saved.pasted.find(r => r.text === K.CODE), check = saved.pasted.find(r => r.text === K.CHECK);
  assert.deepEqual([code.evidence, check.evidence], [K.CODE_META, K.CHECK_META]);
  // Each cited provided source still reads with its own declaration, labelled user declared (the existing source presentation).
  const src = savedReading(studioView(saved), null, saved.pasted);
  for (const [text, e] of [[K.CODE, K.CODE_META], [K.CHECK, K.CHECK_META]]) {
    const s = src.find(x => x.evidence && x.evidence.name === e.name); assert.ok(s, e.name);
    assert.ok(s.note.includes(`판본 ${e.version}`) && s.note.includes('(사용자 기재)') && s.note.includes('앱이 실행·검증하지 않음'), s.note);
    assert.ok(!s.text.includes(e.version), 'the declaration is not in the text');
  }
});

test('116-3 refusals: wrong record, unknown or unsent or metadata pseudo-anchor, over its bound, material, null role, old form', () => {
  const { inp } = later(), al = K.aliases(inp.ask, inp.records), ask = inp.ask, pc = (rec, w) => K.piece(ask, rec, w);
  const cases = [
    ['claim from another record', w => { w.parts[1].claims[0].aboutAt = pc(al.code, 'export function'); }, 'parts[1].claims[0].aboutAt', 'condition-source', al.code],
    ['statement from another record', w => { w.candidates[0].statement.aboutAt = pc(al.check, '환경:'); }, 'candidates[0].statement.aboutAt', 'condition-source', al.check],
    ['match from another record', w => { w.matches[0].aboutAt = pc(al.check, '환경:'); }, 'matches[0].aboutAt', 'condition-source', al.check],
    ['role outside its basis', w => { w.parts[0].roleAboutAt = pc(al.check, '환경:'); }, 'parts[0].roleAboutAt', 'condition-source', al.check],
    ['a null role with a condition', w => { w.parts[1].roleAboutAt = pc(al.report, '검사 조건:'); }, 'parts[1].roleAboutAt', 'condition-source', 'role:null'],
    ['unknown piece', w => { w.parts[1].claims[1].aboutAt = `${al.report}.99`; }, 'parts[1].claims[1].aboutAt', 'reference', `${al.report}.99`],
    ['unsent record', w => { w.matches[3].aboutAt = 'N09.01'; }, 'matches[3].aboutAt', 'reference', 'N09.01'],
    ['reversed range', w => { const [a, b] = K.range(ask, al.report, '조건: release', '실행:').split('-'); w.parts[0].roleAboutAt = `${a.split('.')[0]}.${b}-${a.split('.')[1]}`; }, 'parts[0].roleAboutAt', 'reference', null],
    ['declared code version', w => { w.matches[1].aboutAt = K.CODE_META.version; }, 'matches[1].aboutAt', 'reference', 'not-anchor'],
    ['declared check version', w => { w.matches[2].aboutAt = K.CHECK_META.version; }, 'matches[2].aboutAt', 'reference', 'not-anchor'],
    ['declared version on a claim', w => { w.parts[1].claims[3].aboutAt = `판본 ${K.CODE_META.version}`; }, 'parts[1].claims[3].aboutAt', 'reference', 'not-anchor'],
    ['the condition copied as words', w => { w.parts[1].claims[1].aboutAt = K.COND_CHECK; }, 'parts[1].claims[1].aboutAt', 'reference', 'not-anchor'],
    ['claim over 80', w => { w.parts[1].claims[0].aboutAt = pc(al.report, '모바일 조건: Pixel 9'); }, 'parts[1].claims[0].aboutAt', 'condition-length', null],
    ['statement over 80', w => { w.candidates[0].statement.aboutAt = pc(al.report, '모바일 조건: Pixel 9'); }, 'candidates[0].statement.aboutAt', 'condition-length', null],
    ['role over 80', w => { w.parts[0].roleAboutAt = pc(al.report, '모바일 조건: Pixel 9'); }, 'parts[0].roleAboutAt', 'condition-length', null],
    ['match over 200', w => { w.matches[0].aboutAt = pc(al.report, '배포 조건: staging-us'); }, 'matches[0].aboutAt', 'condition-length', null],
    ['long environment as a claim condition', w => { w.parts[1].claims[2].aboutAt = pc(al.report, '장기 실행 환경:'); }, 'parts[1].claims[2].aboutAt', 'condition-length', null],
    ['claim in material', w => { w.parts[1].claims[0].aboutAt = pc(al.report, '조건: sample'); }, 'parts[1].claims[0].aboutAt', 'material-evidence', al.report],
    ['statement in material', w => { w.candidates[0].statement.aboutAt = pc(al.report, '조건: sample'); }, 'candidates[0].statement.aboutAt', 'material-evidence', al.report],
    ['role in material', w => { w.parts[0].roleAboutAt = pc(al.report, '조건: sample'); }, 'parts[0].roleAboutAt', 'material-evidence', al.report],
    ['match in material', w => { w.matches[3].aboutAt = pc(al.report, '조건: sample'); }, 'matches[3].aboutAt', 'material-evidence', al.report],
    ['old claim about', w => { const c = w.parts[1].claims[0]; delete c.aboutAt; c.about = 'release/2.4 브랜치'; }, 'parts[1].claims[0].about', 'condition-form', 'about'],
    ['both claim forms', w => { w.parts[1].claims[0].about = null; }, 'parts[1].claims[0].about', 'condition-form', 'about'],
    ['no claim condition key', w => { delete w.parts[1].claims[0].aboutAt; }, 'parts[1].claims[0].aboutAt', 'condition-form', 'aboutAt'],
    ['old roleAbout', w => { delete w.parts[0].roleAboutAt; w.parts[0].roleAbout = null; }, 'parts[0].roleAbout', 'condition-form', 'roleAbout'],
    ['old statement about', w => { const s = w.candidates[0].statement; delete s.aboutAt; s.about = null; }, 'candidates[0].statement.about', 'condition-form', 'about'],
    ['old match about', w => { delete w.matches[2].aboutAt; w.matches[2].about = null; }, 'matches[2].about', 'condition-form', 'about'],
    ['both match forms', w => { w.matches[2].about = '환경: Ubuntu 24.04'; }, 'matches[2].about', 'condition-form', 'about']];
  for (const [why, change, path, rule, target] of cases) {
    const w = K.replyFor7(ask, inp.records); change(w); const before = JSON.stringify(w);
    const e = refusal(() => M.validateMapReply(w, ask));
    assert.equal(e.name, 'MapReplyError', why); assert.equal(e.message, 'INVALID_RESPONSE', why);
    assert.deepEqual([e.path, e.rule], [path, rule], why); if (target !== null) assert.equal(e.target, target, why);
    for (const words of [K.CODE_META.version, K.CHECK_META.version, '조건', 'Ubuntu']) assert.ok(!e.target.includes(words), `${why}: no record or declaration words in the refusal`);
    assert.equal(JSON.stringify(w), before, `${why}: nothing of the wire is changed`);
  }
  // Wrong-record conditions refuse even when that record's passage would fit the bound: ownership comes before length.
  const w = K.replyFor7(ask, inp.records); w.parts[1].claims[1].aboutAt = K.piece(ask, al.check, '118 passed');
  assert.equal(refusal(() => M.validateMapReply(w, ask)).rule, 'condition-source');
  // A match condition may come from its record's earlier condition header, outside the match's own at.
  const head = K.replyFor7(ask, inp.records); head.matches[0].aboutAt = K.range(ask, al.report, '조건: release', '실행:');
  assert.equal(M.validateMapReply(head, ask).matches[0].about, K.COND_CRLF);
});

test('116-4 the null-overlength witness keeps its distinguishing condition in words and exact evidence; the contract alone cannot', () => {
  const { inp } = later(), reply = M.validateMapReply(K.replyFor7(inp.ask, inp.records), inp.ask), c = reply.parts[1].claims[2];
  assert.ok(K.LONG_ENV.length > 80); assert.equal(c.about, null);
  const retains = x => ['40만 장', '동시 작업 8개', '2GiB'].every(w => x.text.includes(w)) && x.quote.includes(K.LONG_ENV);
  assert.ok(retains(c), 'the positive witness names the environment and rests on the passage that states it');
  // A reply that drops the distinction is still contract-valid: it cannot be the semantic witness (meaning review decides).
  const drop = K.replyFor7(inp.ask, inp.records); drop.parts[1].claims[2].text = '72시간 메모리 증가 없음을 보고함';
  const d = M.validateMapReply(drop, inp.ask).parts[1].claims[2]; assert.ok(!retains(d));
});

test('116-5 map.1–6, FIRST6 and the m6 recipe are byte for byte pre116; map.7 is its own later recipe', async () => {
  const h = t => sha(t).slice(0, 16);
  // Computed from db63a42 (the pre116 producer) for the same texts.
  assert.deepEqual([P.MAP_PROMPT, P.MAP2_PROMPT, P.MAP3_PROMPT, P.MAP4_PROMPT, P.MAP4_FIRST_PROMPT, P.MAP5_PROMPT, P.MAP5_FIRST_PROMPT, P.MAP6_PROMPT, P.MAP6_FIRST_PROMPT].map(h),
    ['a15660a3a3e7bbe2', '53ef9b4d18d8c6b3', '6ad411b7e893733f', '5317421405406135', '4c8523a1402ca9fa', '6ce308f841f5851c', '37a8237254d69607', '24b6596338d073fa', 'cef94b26c23e8c3c']);
  assert.deepEqual([P.MAP4_RECIPE, P.MAP5_RECIPE, P.MAP6_RECIPE].map(h), ['0340413adccd30ac', 'b432f60e7d61d502', '8071e83eafdae2cd']);
  assert.equal(await mapPromptId(), 'm6-6859b864664f', 'the m6 id the pre116 server named');
  assert.match(await map7PromptId(), /^m7-[0-9a-f]{12}$/);
  const t = P.MAP7_PROMPT;
  assert.ok(t.includes('조건 참조(roleAboutAt·aboutAt') && t.includes('basis·note에 적힌 이름·판본·출처는 사용자가 기재한 자료 정보이며 원문이 아니다'));
  assert.ok(t.includes('넘으면 응답 전체가 거절되며 서버는 자르거나 null로 바꾸지 않는다') && t.includes('null은 조건을 빠뜨려도 된다는 뜻이 아니다'));
  assert.ok(t.includes('모두에 맞는 조건 하나가 없으면 roleAboutAt은 null'));
  assert.ok(!/"about"|"roleAbout"/.test(t) && t.includes('"roleAboutAt":null') && t.includes('"aboutAt":"N01.10"'), 'the reply example uses the new keys only');
  assert.ok(t.includes('{at,text,kind,stance,aboutAt,targets,why,replaces}') && t.includes('{"key","kind","text","at","aboutAt"}'));
  assert.ok(t.includes('기록의 kind가 자료 종류다') && t.includes('pasted 쪽 구간을 code·test로 인용하면 응답 전체가 거절된다'), 'the map.6 source rules stay');
});

/* ---------- the standard provider: /map and the durable job, dispatched by schema ---------- */
const providerReply = content => new Response(JSON.stringify({ choices: [{ finish_reason: 'stop', message: { content } }] }), { status: 200 });
function provider(answer) {
  const seen = [];
  const fetchImpl = async (url, init) => { const body = JSON.parse(init.body), ask = JSON.parse(body.messages[1].content.replace(/^INPUT JSON \(자료\):\n/, '')); seen.push({ system: body.messages[0].content, ask }); return providerReply(JSON.stringify(answer(ask))); };
  return { seen, fetchImpl };
}
const post = (path, body) => new Request(`http://127.0.0.1/api/studio/${path}`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-agentflow-request': '1' }, body });
const jcall = async (h, method, path, cap, body) => {
  const res = await h(new Request(`http://127.0.0.1/api/studio/jobs${path}`, { method, headers: { 'x-agentflow-request': '1', 'x-studio-operation': cap, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body } : {}) }));
  return { status: res.status, ...(await res.json()) };
};
const newCap = () => Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
async function submission(inp, p, prompt, model, entryId = 'E_cond0116-02') {
  const id = `MJ_${crypto.randomUUID()}`, wire = J.encodeMapInput(inp);
  const binding = { entryId, projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: inp.ask.schemaVersion, prompt, model, askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
  return { id, cap: newCap(), binding, body: JSON.stringify({ version: 'map-job.1', id, binding, input: wire }) };
}
const answerFor = ask => ask.schemaVersion === 'studio.map.7' ? K.replyFor7(ask, M.askRecords(ask)) : K.replyFor6(ask, M.askRecords(ask));

test('116-6 standard provider: m6 and the later m7 named; map.7 asked with its one prompt, its raw wire returned and checked again', async () => {
  const prov = provider(answerFor), handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-116', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: prov.fetchImpl });
  const st = await (await handle(new Request('http://127.0.0.1/api/studio/status'))).json();
  assert.deepEqual(st.map, { model: 'deepseek-flash', prompt: await mapPromptId(), laterPrompt: await map7PromptId() });
  const { inp } = later(), body = JSON.stringify(inp.ask), res = await handle(post('map', body)), out = await res.json();
  assert.equal(res.status, 200); assert.equal(prov.seen.at(-1).system, P.MAP7_PROMPT);
  assert.deepEqual(out.reply, K.replyFor7(inp.ask, inp.records), 'the raw map.7 wire, aboutAt and all, never a normalized copy');
  assert.deepEqual(out.evidence, { index: SPAN_INDEX, ask: textDigest(body) });
  assert.equal(M.validateMapReply(out.reply, inp.ask).parts[1].claims[0].about, K.COND_CRLF, 'the browser decodes it against its own ask');
  // map.6 later and first asks are answered as before; a first map.7 is not an ask; a refused map.7 reply names where.
  const six = later(M.MAP6_SCHEMA).inp, f = firstProject(), first = M.buildMapAsk(f, studioView(f), [], undefined, M.MAP7_SCHEMA);
  assert.equal((await handle(post('map', JSON.stringify(six.ask)))).status, 200); assert.equal(prov.seen.at(-1).system, P.MAP6_PROMPT);
  const firstReply = { summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [] }, prov2 = provider(() => firstReply);
  const h2 = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-116', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: prov2.fetchImpl });
  assert.equal((await h2(post('map', JSON.stringify(first.ask)))).status, 200); assert.equal(prov2.seen.at(-1).system, P.MAP6_FIRST_PROMPT);
  const calls = prov2.seen.length;
  const r7 = await h2(post('map', JSON.stringify({ ...first.ask, schemaVersion: 'studio.map.7' })));
  assert.equal(r7.status, 400); assert.equal((await r7.json()).error.code, 'INVALID_INPUT'); assert.equal(prov2.seen.length, calls, 'no call');
  const bad = provider(ask => { const w = K.replyFor7(ask, M.askRecords(ask)); w.matches[1].aboutAt = K.CODE_META.version; return w; });
  const h3 = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-116', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: bad.fetchImpl }), r3 = await h3(post('map', body));
  assert.equal(r3.status, 502); assert.deepEqual((await r3.json()).error, { code: 'INVALID_RESPONSE', detail: { path: 'matches[1].aboutAt', rule: 'reference', target: 'not-anchor' } });
});

test('116-7 standard provider jobs: a map.7 job is bound to m7 (m6 refused for it), runs MAP7_PROMPT, and its ready wire applies', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'af116-jobs-')), prov = provider(answerFor), jobs = await openMapJobs({ dir });
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-116', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: prov.fetchImpl, jobs });
  try {
    const { p, inp } = later(), m6 = await mapPromptId(), m7 = await map7PromptId();
    const wrong = await submission(inp, p, m6, 'deepseek-flash', 'E_cond0116-03');
    assert.deepEqual([(await jcall(handle, 'POST', '', wrong.cap, wrong.body)).status], [409]); assert.equal(prov.seen.length, 0);
    const x = await submission(inp, p, m7, 'deepseek-flash');
    assert.equal((await jcall(handle, 'POST', '', x.cap, x.body)).status, 202);
    let v; await until(async () => (v = await jcall(handle, 'GET', `/${x.id}`, x.cap)).state === 'ready', 'ready');
    assert.equal(prov.seen.length, 1); assert.equal(prov.seen[0].system, P.MAP7_PROMPT);
    assert.equal(v.result.prompt, m7); assert.deepEqual(v.result.wire, K.replyFor7(inp.ask, inp.records), 'the raw wire is kept');
    const back = J.decodeMapInput(v.input), applied = M.applyReading(p, back, M.validateMapReply(v.result.wire, back.ask), meta('R_116-job', v.result.prompt));
    const saved = parseProject(S.serializeProject(applied.project)); assert.equal(saved.readings.at(-1).version, 'map-reading.5');
    assert.equal(saved.readings.at(-1).parts.find(x => !x.created).claims[0].about, K.COND_CRLF);
    // An old client's later map.6 job with m6 is still taken.
    const six = later(M.MAP6_SCHEMA), y = await submission(six.inp, six.p, m6, 'deepseek-flash', 'E_cond0116-04');
    assert.equal((await jcall(handle, 'POST', '', y.cap, y.body)).status, 202);
    await until(async () => (await jcall(handle, 'GET', `/${y.id}`, y.cap)).state === 'ready', 'ready6'); assert.equal(prov.seen.at(-1).system, P.MAP6_PROMPT);
  } finally { await jobs.close(); }
});

/* ---------- the CLI executor: scopes and a full map7-later run ---------- */
const FAKE = fileURLToPath(new URL('./fake-cli102.mjs', import.meta.url)), NODE_SHA = sha(readFileSync(process.execPath));
const policyFor = (ctl, o = {}) => ({ executor: 'codex-cli-preview.102', exe: process.execPath, binarySha256: NODE_SHA, version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl],
  args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'], model: 'fake-model-102', reasoning: 'high', selectionMs: 20000, verdictMs: 21000, ...o });
async function cli(scope, modes = ['file']) {
  const ctl = mkdtempSync(join(tmpdir(), 'af116-ctl-')), dir = mkdtempSync(join(tmpdir(), 'af116-cjobs-')), state = mkdtempSync(join(tmpdir(), 'af116-state-'));
  writeFileSync(join(ctl, 'mode'), modes.join('\n'));
  const jobs = await openMapJobs({ dir }), executor = await openCliExecutor({ policy: policyFor(ctl, scope === undefined ? {} : { scope }), stateDir: state });
  return { ctl, jobs, executor, handle: createStudioHandler({ env: { STUDIO_REQUESTS_PER_MINUTE: '60' }, jobs, mapExecutor: executor }), close: async () => { await jobs.close(); await executor.close(); } };
}

test('116-8 CLI scopes: first and map6-later unchanged (map.7 refused), map7-later takes FIRST6 and later7 only, unknown fails closed', async () => {
  const f = firstProject(), first6 = M.buildMapAsk(f, studioView(f), [], undefined, M.MAP6_SCHEMA).ask, later6 = later(M.MAP6_SCHEMA).inp.ask, later7 = later().inp.ask;
  const code = async (ex, ask) => { try { await ex.prepare(ask); return null; } catch (e) { return e.code; } };
  const want = { first: [null, 'EXECUTOR_SCOPE', 'EXECUTOR_SCOPE'], 'map6-later': [null, null, 'EXECUTOR_SCHEMA'], 'map7-later': [null, 'EXECUTOR_SCHEMA', null] };
  for (const scope of ['first', 'map6-later', 'map7-later']) {
    const s = await cli(scope === 'first' ? undefined : scope);
    try {
      assert.deepEqual([await code(s.executor, first6), await code(s.executor, later6), await code(s.executor, later7)], want[scope], scope);
      const st = await (await s.handle(new Request('http://127.0.0.1/api/studio/status'))).json();
      assert.equal(st.map.prompt, await mapPromptId(), scope); assert.equal(st.jobs.executor.scope, scope);
      assert.equal(st.map.laterPrompt, scope === 'map7-later' ? await map7PromptId() : undefined, `${scope}: m7 named only under map7-later`);
    } finally { await s.close(); }
  }
  // A first map.7 never reaches the executor (it is not an ask); the refusal rule still names it for map7-later.
  assert.throws(() => readPolicy(policyFor('/x', { scope: 'map7' })), e => e.field === 'scope');
  assert.throws(() => readPolicy(policyFor('/x', { scope: 'map8-later' })), e => e.field === 'scope');
  // The wrapper bytes are the same; only the instructions between them follow the schema.
  assert.ok(wrap(later7).includes(P.MAP7_PROMPT) && !wrap(later7).includes(P.MAP6_PROMPT)); assert.ok(wrap(first6).includes(P.MAP6_FIRST_PROMPT));
  // The policy hash of 'first' and 'map6-later' is the one they had; map7-later is its own.
  const hashes = []; for (const scope of [undefined, 'map6-later', 'map7-later']) { const s = await cli(scope); hashes.push(s.executor.describe().policy); await s.close(); }
  assert.equal(new Set(hashes).size, 3);
});

test('116-9 CLI map7-later: a later job bound to m7 and MAP7_PROMPT runs one child, its raw wire is ready, decoded and applied', async () => {
  const s = await cli('map7-later', ['file', 'file']);
  try {
    const { p, inp } = later(), m7 = await map7PromptId();
    writeFileSync(join(s.ctl, 'reply-1.json'), JSON.stringify(K.replyFor7(inp.ask, inp.records)));
    const x = await submission(inp, p, m7, 'fake-model-102');
    assert.equal((await jcall(s.handle, 'POST', '', x.cap, x.body)).status, 202);
    let v; await until(async () => !['accepted', 'running'].includes((v = await jcall(s.handle, 'GET', `/${x.id}`, x.cap)).state), 'ended');
    assert.equal(v.state, 'ready', JSON.stringify(v.error));
    assert.deepEqual([v.execution.scope, v.execution.promptKind, v.execution.promptSha256, v.execution.askSha256], ['map7-later', 'later7', sha(P.MAP7_PROMPT), sha(JSON.stringify(inp.ask))]);
    const back = J.decodeMapInput(v.input), applied = M.applyReading(p, back, M.validateMapReply(v.result.wire, back.ask), meta('R_116-cli', v.result.prompt));
    assert.equal(parseProject(S.serializeProject(applied.project)).readings.at(-1).version, 'map-reading.5');
    // A refused wire is failed with the structured detail; one child each, no retry.
    const bad = K.replyFor7(inp.ask, inp.records); bad.parts[1].claims[0].aboutAt = K.piece(inp.ask, K.aliases(inp.ask, inp.records).code, 'export function');
    writeFileSync(join(s.ctl, 'reply-2.json'), JSON.stringify(bad));
    await until(() => s.executor.describe().state === 'ready', 'slot free');
    const y = await submission(inp, p, m7, 'fake-model-102', 'E_cond0116-05');
    assert.equal((await jcall(s.handle, 'POST', '', y.cap, y.body)).status, 202);
    await until(async () => !['accepted', 'running'].includes((v = await jcall(s.handle, 'GET', `/${y.id}`, y.cap)).state), 'ended');
    assert.deepEqual([v.state, v.error.code, v.error.detail], ['failed', 'INVALID_RESPONSE', { path: 'parts[1].claims[0].aboutAt', rule: 'condition-source', target: K.aliases(inp.ask, inp.records).code }]);
    assert.equal(readFileSync(join(s.ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).length, 2);
  } finally { await s.close(); }
});

/* ---------- the browser: capability, selection, binding, and an old ready6 recovered ---------- */
function locks() {
  const chains = new Map(), held = new Set();
  return { request(name, a, b) {
    const opts = typeof a === 'function' ? {} : a, cb = typeof a === 'function' ? a : b;
    if (opts.ifAvailable && held.has(name)) return Promise.resolve(cb(null));
    const next = (chains.get(name) ?? Promise.resolve()).then(async () => { held.add(name); try { return await cb({ name }); } finally { held.delete(name); } });
    chains.set(name, next.catch(() => {})); return next;
  } };
}
function memoryKv() { const m = new Map(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), map: m }; }
/** One page over a handler: an entry (key, project, seq), the status it read, and its saves. */
function page(handle, status, project, { kv = null } = {}) {
  const w = { cur: null, done: [] }, store = kv ? new JobReservations(kv, locks()) : null;
  globalThis.fetch = async (url, o = {}) => handle(new Request(`http://127.0.0.1${url}`, o));
  w.cur = { key: 'E_ready6-116a', kind: 'saved', project, view: studioView(project), ref: { lifecycle: 1, seq: 1 } };
  w.run = createMapRun({ current: () => w.cur, visit: () => w.cur, status: () => status, accessCode: () => '', requests: () => w.requests ?? [], pollMs: 2, ...(store ? { jobs: () => store, stored: () => ({ project: w.cur.project, lifecycle: 1 }), ownSave: () => false } : {}),
    commit: async next => { Object.assign(w.cur, { project: next, view: studioView(next), ref: { lifecycle: 1, seq: w.cur.ref.seq + 1 } }); return null; }, done: a => w.done.push(a), changed: () => {} });
  return w;
}
let savedFetch;
test.before(() => { savedFetch = globalThis.fetch; });
test.afterEach(() => { globalThis.fetch = savedFetch; });

test('116-10 browser capability: m7 only beside m6 and as an exact id; later asks go as map.7 bound to m7, first maps and old servers as map.6', async () => {
  const m6 = await mapPromptId(), m7 = await map7PromptId();
  const statusWith = map => async () => new Response(JSON.stringify({ ai: 'deepseek', model: 'x', access: 'open', map }), { status: 200 });
  for (const [map, expect] of [[{ model: 'm', prompt: m6, laterPrompt: m7 }, m7], [{ model: 'm', prompt: m6 }, undefined], [{ model: 'm', prompt: m6, laterPrompt: 'm7-xyz' }, undefined], [{ model: 'm', prompt: 'm5-0123456789ab', laterPrompt: m7 }, undefined]]) {
    globalThis.fetch = statusWith(map); assert.equal((await aiStatus()).map.laterPrompt, expect, JSON.stringify(map));
  }
  globalThis.fetch = async () => new Response(JSON.stringify({ ai: 'deepseek', model: 'x', access: 'open', map: { model: 'm', prompt: m6 }, jobs: { version: 'map-job.1', durable: true, problem: null, executor: { state: 'ready', problem: null, scope: 'map7-later' } } }), { status: 200 });
  assert.equal((await aiStatus()).jobs.executor.scope, 'map7-later');
  const runOnce = async (status, project, requests) => {
    const prov = provider(answerFor), handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-116', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: prov.fetchImpl });
    const w = page(handle, status, project); w.requests = requests; await w.run.run(requests[0]?.id);
    await until(() => w.done.length === 1 || w.run.state().error, 'applied'); assert.equal(w.run.state().error, null);
    return { sent: prov.seen[0], reading: w.done[0].reading, project: w.cur.project };
  };
  const base = { ai: 'deepseek', model: 'x', access: 'open' }, c = later();
  const n = await runOnce({ ...base, map: { model: 'deepseek-flash', prompt: m6, laterPrompt: m7 } }, c.p, [c.rq]);
  assert.deepEqual([n.sent.ask.schemaVersion, n.sent.system === P.MAP7_PROMPT, n.reading.prompt, n.reading.version], ['studio.map.7', true, m7, 'map-reading.5']);
  assert.equal(n.reading.parts.find(x => !x.created).claims[0].about, K.COND_CRLF);
  const o = await runOnce({ ...base, map: { model: 'deepseek-flash', prompt: m6 } }, c.p, [c.rq]);
  assert.deepEqual([o.sent.ask.schemaVersion, o.sent.system === P.MAP6_PROMPT, o.reading.prompt], ['studio.map.6', true, m6], 'an old server: map.6 as before');
  const f = firstProject(), prov = provider(() => ({ summary: '', parts: [{ ref: 'new:a', name: '썸네일', parent: null, role: null, roleAbout: null, roleReplaces: null, basis: ['N01.01'], claims: [] }], relations: [], candidates: [], gaps: [], matches: [], material: [] }));
  const w = page(createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-116', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: prov.fetchImpl }), { ...base, map: { model: 'deepseek-flash', prompt: m6, laterPrompt: m7 } }, f);
  await w.run.run(); await until(() => w.done.length === 1 || w.run.state().error, 'first applied');
  assert.deepEqual([prov.seen[0].ask.schemaVersion, prov.seen[0].system === P.MAP6_FIRST_PROMPT, w.done[0].reading.prompt], ['studio.map.6', true, m6], 'a first map stays map.6 bound to m6');
});

test('116-11 a lawful ready6 written by the pre116 producer is recovered by this reader under the new status: its own input and prompt, no call', async () => {
  const fixture = fileURLToPath(new URL('./fixtures/ready6-116/', import.meta.url)), manifest = JSON.parse(readFileSync(join(fixture, 'manifest.json'), 'utf8'));
  assert.equal(manifest.producer.commit, 'db63a4293aad5983feafca70c4016ec1abc4874d'); assert.equal(manifest.producer.status.laterPrompt, undefined, 'a pre116 server');
  for (const [f, h] of Object.entries(manifest.files)) assert.equal(sha(readFileSync(join(fixture, f))), h, `${f} as the producer wrote it`);
  const dir = mkdtempSync(join(tmpdir(), 'af116-ready6-')); cpSync(fixture, dir, { recursive: true });
  let calls = 0; const jobs = await openMapJobs({ dir });
  const handle = createStudioHandler({ env: { DEEPSEEK_API_KEY: 'k-116', STUDIO_REQUESTS_PER_MINUTE: '60' }, fetchImpl: async () => { calls++; throw new Error('no call'); }, jobs });
  try {
    const st = await (await handle(new Request('http://127.0.0.1/api/studio/status'))).json();
    assert.equal(st.map.laterPrompt, await map7PromptId(), 'the new status names m7');
    const v = await jcall(handle, 'GET', `/${manifest.job.id}`, manifest.job.cap);
    assert.deepEqual([v.state, v.binding.schemaVersion, v.binding.prompt, v.result.prompt], ['ready', 'studio.map.6', manifest.job.prompt, manifest.job.prompt]);
    // The browser that reserved it, now on this code with the new status, finds it again and applies it when asked.
    const project = parseProject(JSON.stringify(manifest.project)), kv = memoryKv();
    kv.setItem(JOBS_KEY, JSON.stringify({ version: 'map-jobs.1', ops: [{ id: manifest.job.id, cap: manifest.job.cap, binding: v.binding, receipt: true, applied: null, outcome: null, reservedAt: new Date().toISOString() }] }));
    const w = page(handle, { ...st, ai: 'deepseek', jobs: { durable: true, problem: null } }, project, { kv });
    w.run.resume(); await until(() => w.run.state().ready, 'found ready');
    await w.run.applyReady(); await until(() => w.done.length === 1, 'applied');
    const reading = w.done[0].reading;
    assert.deepEqual([reading.version, reading.prompt, reading.hash], ['map-reading.5', manifest.job.prompt, manifest.job.askHash], 'read with its saved map.6 input and m6 prompt');
    assert.equal(reading.parts[0].claims[0].about, 'release/2.4 브랜치', 'an old plain about string keeps its map.6 meaning');
    assert.equal(calls, 0, 'no second call'); assert.deepEqual(parseProject(S.serializeProject(w.cur.project)), w.cur.project);
    await until(async () => (await jcall(handle, 'GET', `/${manifest.job.id}`, manifest.job.cap)).acked === 'applied', 'acknowledged');
  } finally { await jobs.close(); }
  // The producer's job file itself is left as written (the copy was used).
  for (const [f, h] of Object.entries(manifest.files)) assert.equal(sha(readFileSync(join(fixture, f))), h);
  assert.ok(existsSync(join(fixture, 'store.json')));
});
