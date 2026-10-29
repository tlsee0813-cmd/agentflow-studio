// AF114: a normal entry for provided code and check sources. A new file is kept as a normal record (project.14 PastedRecord with an
// exact evidence declaration), never as a task or a new store; old records, readings and requests stay as they were. Its kind is
// evidence in both map requests (unread and the explicit request comparison), so code/test matches may rest on it, while an old
// pasted report stays pasted. A reply citing the old pasted occurrence of the same code as code is refused whole, with its path.
// Everything here is model-free: replies are author-written for their ask (source114-case.mjs); the fake CLI is the 102 test one.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as C from '../dist/public/shared/change-plan.js';
import * as S from '../dist/public/shared/storage.js';
import * as J from '../dist/public/shared/map-job.js';
import * as R from '../dist/public/shared/request-return.js';
import * as E from '../dist/public/shared/record-source.js';
import { parseProject, parseBackup } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';
import { emptyBundle } from '../dist/public/client/plan-store.js';
import { savedReading } from '../dist/public/client/digest-source.js';
import { projectInput } from '../dist/public/client/plan-source.js';
import { createStudioHandler, mapPromptId } from '../server/studio.mjs';
import { openMapJobs } from '../server/map-jobs.mjs';
import { MAP_PROMPT, MAP2_PROMPT, MAP3_PROMPT, MAP4_PROMPT, MAP4_FIRST_PROMPT, MAP5_PROMPT, MAP5_FIRST_PROMPT, MAP6_PROMPT, MAP6_FIRST_PROMPT } from '../server/map-prompt.mjs';
import { openCliExecutor } from '../../../docs/cycles/2026-10-29-owned-cli-preview-102/preview/cli-executor.mjs';
import { mapWithRequest, replyFor, CODE_FILE, TEST_FILE, CODE_META, TEST_META, OLD_REPORT } from './source114-case.mjs';

const mods = { D, M, C, S, studioView, emptyBundle };
const bytes = t => new TextEncoder().encode(t);
const sha = t => createHash('sha256').update(t).digest('hex');
/** The project.13 copy as a pre-114 writer kept it (same shape; the generated fixture for the UI is written by the old build). */
const as13 = p => JSON.stringify({ ...JSON.parse(S.serializeProject(p)), schemaVersion: 'idea015.project.13' });
function provided() {
  const c = mapWithRequest(mods), old = parseProject(as13(c.project));
  let p = D.provideRecord(old, CODE_FILE, CODE_META, null).project;
  p = D.provideRecord(p, TEST_FILE, TEST_META, null).project;
  return { ...c, old, p };
}
const meta = (id, at = new Date().toISOString()) => ({ id, at, model: 'stub-114', prompt: 'm6-000000000114', hash: sha(id) });

test('114-1 project.14: project.13 reads unchanged but its marker; a provided source is exact text plus an exact declaration', () => {
  const { project, old, p } = provided(), raw13 = JSON.parse(as13(project));
  assert.equal(D.createProject().schemaVersion, 'idea015.project.14');
  assert.equal(old.schemaVersion, 'idea015.project.14');
  assert.deepEqual({ ...old, schemaVersion: raw13.schemaVersion }, raw13, 'every old record, reading, request and claim as stored');
  for (const r of old.pasted) assert.deepEqual(Object.keys(r), ['id', 'text', 'at', 'context'], 'no declaration is derived for an old record');
  const [code, check] = p.pasted.slice(-2);
  assert.equal(code.text, CODE_FILE, 'BOM, CRLF and trailing spaces kept'); assert.ok(code.text.startsWith('﻿') && code.text.includes('\r\n  \r\n'));
  assert.deepEqual(code.evidence, CODE_META); assert.deepEqual(check.evidence, TEST_META);
  assert.deepEqual(p.pasted.slice(0, -2), old.pasted, 'old records are the same objects'); assert.deepEqual(p.readings, old.readings);
  assert.equal(p.revision, old.revision + 2); assert.equal(p.tasks.length, old.tasks.length, 'no task'); assert.equal(p.sources.length, old.sources.length, 'no source');
  assert.deepEqual(parseProject(S.serializeProject(p)), p, 'saved, read back the same');
  const b = parseBackup(S.serializeBackup(p, null)); assert.deepEqual(b.project, p, 'a backup keeps text, ids and declarations');
});

test('114-2 declarations: exact keys, a known kind, single-line bounded non-secret text, shown in full within the map bounds', () => {
  const { p } = provided(), raw = JSON.parse(S.serializeProject(p)), i = raw.pasted.length - 2;
  const refused = (f, why) => { const v = structuredClone(raw); f(v.pasted[i]); assert.throws(() => parseProject(JSON.stringify(v)), undefined, why); };
  refused(r => { r.evidence.kind = 'log'; }, 'unknown kind'); refused(r => { r.evidence.kind = 'evidence'; }, 'not a map kind');
  refused(r => { r.evidence.extra = 1; }, 'extra key'); refused(r => { delete r.evidence.origin; }, 'missing key'); refused(r => { r.evidence = null; }, 'null');
  refused(r => { r.evidence.name = ''; }, 'empty name'); refused(r => { r.evidence.name = 'a\nb'; }, 'line break'); refused(r => { r.evidence.version = ' v1'; }, 'outer space');
  refused(r => { r.evidence.origin = 'x'.repeat(301); }, 'origin 301'); refused(r => { r.evidence.version = 'v'.repeat(81); }, 'version 81'); refused(r => { r.evidence.name = 'n'.repeat(121); }, 'name 121');
  refused(r => { r.evidence.origin = `token sk-${'A'.repeat(24)}`; }, 'secret-like');
  refused(r => { r.evidence.version = ''; }, 'empty version (absent is null)');
  // The largest declaration is kept and shown whole: basis within 300, note head within 600 with room for range and request notes.
  const big = { kind: 'code', name: 'n'.repeat(120), version: 'v'.repeat(80), origin: `https://github.com/${'o'.repeat(281)}` };
  assert.equal(big.origin.length, 300); assert.ok(E.validEvidence(big));
  assert.ok(E.mapBasis(big, new Date().toISOString()).length <= 300 && E.mapNoteHead(big).length + E.NOTE_RESERVE <= 600);
  const q = D.provideRecord(p, 'const big = 1;\n', big, null).project; assert.deepEqual(parseProject(S.serializeProject(q)).pasted.at(-1).evidence, big);
  const before = S.serializeProject(p);
  for (const bad of [{ ...big, origin: big.origin + 'x' }, { ...CODE_META, kind: 'source' }, { ...CODE_META, name: 'a\tb' }]) assert.throws(() => D.provideRecord(p, 'x = 1\n', bad, null));
  assert.throws(() => D.provideRecord(p, `key = "sk-${'B'.repeat(24)}"\n`, CODE_META, null)); assert.throws(() => D.provideRecord(p, 'x'.repeat(60001), CODE_META, null));
  assert.equal(S.serializeProject(p), before, 'a refused file leaves the project as it was');
  // A backup whose declaration looks like a key is not taken in (the same check as its text).
  assert.equal(D.secretPasted({ ...p, pasted: [...p.pasted, { ...p.pasted.at(-1), id: 'N_x', text: 'y', evidence: { ...TEST_META, origin: `ghp_${'C'.repeat(30)}` } }] }).length, 1);
});

test('114-3 no older file brings in a declaration; older shapes read as before; a 14 file is not read as 13', () => {
  const { p } = provided(), raw = JSON.parse(S.serializeProject(p));
  for (const v of ['idea015.project.13', 'idea015.project.12', 'idea015.project.11', 'idea015.project.10', 'idea015.project.9', 'idea015.project.8'])
    assert.throws(() => parseProject(JSON.stringify({ ...raw, schemaVersion: v })), undefined, `${v} cannot carry a declaration`);
  const plain = { ...raw, pasted: raw.pasted.filter(r => !r.evidence), readings: raw.readings.filter(r => r.version !== 'map-reading.5') };
  for (const v of ['idea015.project.13', 'idea015.project.12', 'idea015.project.8']) {
    const read = parseProject(JSON.stringify({ ...plain, schemaVersion: v, ...(v === 'idea015.project.8' ? { readings: undefined } : {}) }));
    assert.deepEqual(read.pasted, plain.pasted, v);
  }
  // Before 14 a text was unique among all records: an older file with the same text twice is refused as before.
  const twice = { ...plain, schemaVersion: 'idea015.project.13', pasted: [plain.pasted[0], { ...plain.pasted[0], id: 'N_twice' }] };
  assert.throws(() => parseProject(JSON.stringify(twice)));
  assert.throws(() => parseProject(JSON.stringify({ ...raw, schemaVersion: 'idea015.project.15' })), /UNSUPPORTED_SCHEMA/);
});

test('114-4 duplicates: pasted and provided are separate identities; the same text and declaration is no write', () => {
  const { p } = provided(), T = 'export const same = 1;\n';
  const a = D.pasteRecord(p, T, null), b = D.provideRecord(a.project, T, CODE_META, null);
  assert.ok(!a.duplicate && !b.duplicate); assert.notEqual(a.record.id, b.record.id);
  assert.equal(b.project.pasted.find(r => r.id === a.record.id).evidence, undefined, 'the pasted record is not retagged');
  const again = D.provideRecord(b.project, T, { ...CODE_META }, p.space.areas[0].id);
  assert.ok(again.duplicate); assert.equal(again.record.id, b.record.id); assert.equal(again.project, b.project, 'no write, whatever part was looked at');
  const v2 = D.provideRecord(b.project, T, { ...CODE_META, version: 'commit 9e8d7c6' }, null), o2 = D.provideRecord(v2.project, T, { ...CODE_META, origin: null }, null), k2 = D.provideRecord(o2.project, T, { ...CODE_META, kind: 'test' }, null);
  assert.ok(!v2.duplicate && !o2.duplicate && !k2.duplicate, 'another version, origin or kind is another source');
  const pa = D.pasteRecord(k2.project, T, null); assert.ok(pa.duplicate); assert.equal(pa.record.id, a.record.id, 'a paste finds the pasted record, never a provided one');
  const only = D.pasteRecord(D.provideRecord(p, 'only provided\n', TEST_META, null).project, 'only provided\n', null); assert.ok(!only.duplicate, 'a provided text pasted is a new pasted record');
  const all = parseProject(S.serializeProject(k2.project)); assert.equal(all.pasted.filter(r => r.text === T).length, 5);
  const raw = JSON.parse(S.serializeProject(k2.project));
  assert.throws(() => parseProject(JSON.stringify({ ...raw, pasted: [...raw.pasted, { ...raw.pasted.find(r => r.id === b.record.id), id: 'N_dup' }] })), undefined, 'the same identity twice');
  assert.throws(() => parseProject(JSON.stringify({ ...raw, pasted: [...raw.pasted, { ...raw.pasted.find(r => r.id === a.record.id), id: 'N_dup' }] })), undefined, 'a pasted text twice');
  assert.deepEqual(all.pasted.slice(0, p.pasted.length), p.pasted);
});

test('114-5 file bytes: strict UTF-8 with the byte order mark kept; bounded first; the record rules after', () => {
  const ok = E.decodeProvided(new Uint8Array([0xef, 0xbb, 0xbf, ...bytes('  a\r\nb 🙂 한\t\r\n  ')]));
  assert.deepEqual(ok, { text: '﻿  a\r\nb 🙂 한\t\r\n  ' });
  assert.deepEqual(E.decodeProvided(bytes(CODE_FILE)), { text: CODE_FILE });
  assert.deepEqual(E.decodeProvided(new Uint8Array([0x61, 0xff, 0x62])), { problem: 'NOT_UTF8' });
  assert.deepEqual(E.decodeProvided(new Uint8Array([0x61, 0xed, 0xa0, 0x80])), { problem: 'NOT_UTF8' }, 'an encoded surrogate');
  assert.deepEqual(E.decodeProvided(new Uint8Array([0xef, 0xbb, 0xbf, 0x20, 0x0a])), { problem: 'EMPTY' });
  assert.deepEqual(E.decodeProvided(bytes('a\u0007b')), { problem: 'CHARACTERS' });
  assert.deepEqual(E.decodeProvided(bytes(`x = "sk-${'D'.repeat(24)}"`)), { problem: 'SECRET' });
  assert.deepEqual(E.decodeProvided(bytes('가'.repeat(60001))), { problem: 'TOO_LONG' }, 'UTF-16 length, not bytes');
  assert.equal(E.decodeProvided(bytes('가'.repeat(60000))).text.length, 60000, 'the largest text fits the byte bound');
  assert.deepEqual(E.decodeProvided(new Uint8Array(E.PROVIDED_FILE_BYTES + 1).fill(0x61)), { problem: 'TOO_LARGE' });
});

test('114-6 one projection for both map requests: provided sources are evidence, the old report stays pasted, raw spans exact', async () => {
  const { p, rq, bundle, old } = provided(), view = studioView(p);
  for (const inp of [M.buildMapAsk(p, view, [rq], undefined, M.MAP6_SCHEMA), M.buildMapAsk(p, view, [rq], rq.id, M.MAP6_SCHEMA)]) {
    assert.equal(inp.problem, null);
    const recOf = text => inp.ask.records.find(r => inp.records.get(r.id).text === text);
    const code = recOf(CODE_FILE), check = recOf(TEST_FILE), old = recOf(OLD_REPORT);
    assert.deepEqual([code.kind, check.kind, old.kind], ['evidence', 'evidence', 'pasted']);
    assert.equal(M.askRecords(inp.ask).get(code.id).text, CODE_FILE, 'the raw file text, BOM and CRLF included, and nothing else');
    assert.ok(code.basis.includes('사용자 제공 코드 자료') && code.basis.includes('이름 convert.ts') && code.basis.includes('사용자 기재 판본 commit 3f2a1c9'));
    assert.ok(code.note.includes('앱이 실행·검증하지 않음') && code.note.includes(CODE_META.origin), 'declared origin in full');
    assert.ok(check.basis.includes('판본 기록 없음') && check.note.includes('출처 기록 없음'));
    assert.equal(old.basis.startsWith('붙여넣은 기록 · '), true); assert.ok(!old.note.includes('사용자 제공'));
    assert.ok(!JSON.stringify(inp.ask.records.map(r => r.spans)).includes('commit 3f2a1c9'), 'the declaration is never in the text');
    assert.deepEqual(inp.fullRequests, [rq], 'the full frozen request');
    M.validateMapAsk(JSON.parse(JSON.stringify(inp.ask)));
  }
  // The largest declaration with eight later requests still fits the note whole (the request ids give way to their count).
  const big = { kind: 'code', name: 'n'.repeat(120), version: 'v'.repeat(80), origin: `https://github.com/${'o'.repeat(281)}` };
  const q = D.provideRecord(p, 'const big = 1;\n', big, null).project;
  await new Promise(r => setTimeout(r, 5));
  const later = Array.from({ length: 8 }, () => C.requestSnapshot(bundle.plan).scope);
  const inp = M.buildMapAsk(q, studioView(q), later, undefined, M.MAP6_SCHEMA), rec = inp.ask.records.find(r => inp.records.get(r.id).text === 'const big = 1;\n');
  assert.ok(rec.note.length <= 600 && rec.note.includes(big.origin) && rec.note.includes('다음 요청문 8개 생성 전'), rec.note);
  M.validateMapAsk(JSON.parse(JSON.stringify(inp.ask)));
  // The same pasted-only project asks exactly as before 114 (no provided source: the same records, basis and notes).
  const plain = M.buildMapAsk(old, studioView(old), [rq], rq.id, M.MAP6_SCHEMA);
  assert.ok(plain.ask.records.every(r => r.kind === 'pasted' && r.basis.startsWith('붙여넣은 기록 · ') && r.basis.endsWith('(가져온 시각이며 원문 작성·판본 시각이 아님)')));
});

test('114-7 code/test on a provided source apply and reload; the old pasted occurrence of the same code is refused with its path', () => {
  const { p, rq, old } = provided(), inp = M.buildMapAsk(p, studioView(p), [rq], rq.id, M.MAP6_SCHEMA);
  const reply = M.validateMapReply(replyFor(inp.ask), inp.ask), applied = M.applyReading(p, inp, reply, meta('R_114-apply'));
  const saved = parseProject(S.serializeProject(applied.project)); assert.deepEqual(saved, applied.project, 'evidence ids of provided sources are accepted on reload');
  const got = R.requestMatches(saved).filter(x => x.reading === 'R_114-apply'), code = saved.pasted.find(r => r.text === CODE_FILE), check = saved.pasted.find(r => r.text === TEST_FILE), report = saved.pasted.find(r => r.text === OLD_REPORT);
  assert.deepEqual(got.map(x => [x.match.kind, x.match.record]).sort(), [['code', code.id], ['reported', report.id], ['test', check.id]].sort());
  for (const x of got) assert.equal(saved.pasted.find(r => r.id === x.match.record).text.slice(x.match.from, x.match.to), x.match.quote, 'exact where it stands');
  const claims = applied.reading.parts[0].claims; assert.deepEqual(claims.map(c => [c.kind, c.record]), [['reported', report.id], ['checked', report.id], ['describes', report.id]], 'old prose and its code read truthfully, still pasted');
  assert.deepEqual(saved.readings.slice(0, old.readings.length), old.readings, 'earlier readings unchanged');
  assert.equal(applied.reading.requests[0].id, rq.id); assert.deepEqual(applied.reading.requests, [rq], 'the full frozen request kept with the reading');
  // A hand-made file moving the code match onto the pasted report is not read.
  const raw = JSON.parse(S.serializeProject(saved)), r5 = raw.readings.at(-1), m = r5.matches.find(x => x.kind === 'code');
  const at = OLD_REPORT.indexOf('export function convert'); Object.assign(m, { record: report.id, from: at, to: at + m.quote.length, quote: OLD_REPORT.slice(at, at + m.quote.length) });
  assert.throws(() => parseProject(JSON.stringify(raw)));
  // The same code cited at the old pasted record: refused whole, with where and which record (never its text).
  let err = null; try { M.validateMapReply(replyFor(inp.ask, { pastedCode: true }), inp.ask); } catch (e) { err = e; }
  const pastedAlias = inp.ask.records.find(r => inp.records.get(r.id).text === OLD_REPORT).id;
  assert.equal(err?.name, 'MapReplyError'); assert.deepEqual([err.path, err.rule, err.target, err.message], ['matches[1].kind', 'source-kind', `${pastedAlias}:pasted`, 'INVALID_RESPONSE']);
  // map.5 and earlier keep their plain refusal (no structured detail outside map.6).
  const five = M.buildMapAsk(p, studioView(p), [rq], rq.id, M.MAP5_SCHEMA), bad5 = replyFor(five.ask, { pastedCode: true }); for (const c of bad5.parts[0].claims) delete c.key;
  assert.throws(() => M.validateMapReply(bad5, five.ask), e => e.name !== 'MapReplyError' && e.message === 'INVALID_RESPONSE');
  // Same project, the legacy source-kind gate itself is unchanged: an ordinary pasted record alone never takes a code match.
  const a0 = M.buildMapAsk(old, studioView(old), [rq], rq.id, M.MAP6_SCHEMA), n = a0.ask.records.find(r => r.spans.some(s => s.t.startsWith('작업 보고: feature'))).id;
  const only = { summary: '', parts: [], relations: [], candidates: [], gaps: [], material: [], matches: [{ at: a0.ask.records.find(r => r.id === n).spans.find(s => s.t.startsWith('export function')).s, text: '코드', kind: 'code', stance: 'unclear', about: null, targets: [{ requestId: rq.id, itemId: 'change_1' }], why: '스텁', replaces: null }] };
  assert.throws(() => M.validateMapReply(only, a0.ask), e => e.rule === 'source-kind');
});

test('114-8 the provided source in digest and plan inputs: a record with its declaration beside it, never a verified outcome', () => {
  const { p } = provided(), view = studioView(p), src = savedReading(view, null, p.pasted), code = src.find(s => s.text === CODE_FILE.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' '));
  assert.equal(code.kind, 'record'); assert.deepEqual(code.evidence, CODE_META);
  assert.ok(code.title.includes('convert.ts') && code.note.includes('앱이 실행·검증하지 않음') && code.note.includes(CODE_META.origin) && !code.text.includes('commit 3f2a1c9'));
  const plan = projectInput({ project: p, view }, '변환을 고친다'), e = plan.ask.evidence.find(x => x.text === CODE_FILE);
  assert.equal(e.kind, 'record'); assert.ok(e.title.includes('사용자 제공 코드 자료 · convert.ts') && e.basis.includes('앱이 실행·검증하지 않음') && e.basis.includes('판본 commit 3f2a1c9'));
});

test('114-9 map.6 prompt: only map.6 gains the source-kind clarification; map.1-5 are byte for byte as before', () => {
  const h = t => sha(t).slice(0, 16);
  // The values the start commit 71f473a computes for the same seven texts.
  assert.deepEqual([MAP_PROMPT, MAP2_PROMPT, MAP3_PROMPT, MAP4_PROMPT, MAP4_FIRST_PROMPT, MAP5_PROMPT, MAP5_FIRST_PROMPT].map(h),
    ['a15660a3a3e7bbe2', '53ef9b4d18d8c6b3', '6ad411b7e893733f', '5317421405406135', '4c8523a1402ca9fa', '6ce308f841f5851c', '37a8237254d69607']);
  for (const t of [MAP6_PROMPT, MAP6_FIRST_PROMPT]) assert.ok(t.includes('기록의 kind가 자료 종류다') && !MAP5_PROMPT.includes('기록의 kind가 자료 종류다'));
  assert.ok(MAP6_PROMPT.includes('pasted 쪽 구간을 code·test로 인용하면 응답 전체가 거절된다'));
});

// The executor's final reader tells syntax from contract (the 102 fake CLI answers with each file as written, byte for byte).
const FAKE = fileURLToPath(new URL('./fake-cli102.mjs', import.meta.url)), NODE_SHA = sha(readFileSync(process.execPath));
const tick = () => new Promise(r => setTimeout(r, 5));
const until = async (f, why, n = 3000) => { for (let i = 0; i < n; i++) { if (await f()) return; await tick(); } assert.fail(`timed out: ${why}`); };
const jcall = async (h, method, path, cap, body) => {
  const res = await h(new Request(`http://127.0.0.1/api/studio/jobs${path}`, { method, headers: { 'x-agentflow-request': '1', 'x-studio-operation': cap, ...(body !== undefined ? { 'content-type': 'application/json' } : {}) }, ...(body !== undefined ? { body } : {}) }));
  return { status: res.status, ...(await res.json()) };
};
test('114-10 executor: invalid JSON is JSON, valid JSON a validator refuses is CONTRACT, a structured refusal keeps path/rule/target; a lawful reply is ready', async () => {
  const ctl = mkdtempSync(join(tmpdir(), 'af114-ctl-')), dir = mkdtempSync(join(tmpdir(), 'af114-jobs-')), state = mkdtempSync(join(tmpdir(), 'af114-state-'));
  writeFileSync(join(ctl, 'mode'), 'file\nfile\nfile\nfile');
  const policy = { executor: 'codex-cli-preview.102', exe: process.execPath, binarySha256: NODE_SHA, version: 'fake-cli 102-test', versionArgs: [FAKE, '--version', '--ctl', ctl],
    args: [FAKE, '--ctl', ctl, '--final', '{final}', '--cwd', '{cwd}', '--model', '{model}', '--reasoning', '{reasoning}'], model: 'fake-model-102', reasoning: 'high', selectionMs: 20000, verdictMs: 21000, scope: 'map6-later' };
  const jobs = await openMapJobs({ dir }), executor = await openCliExecutor({ policy, stateDir: state }), handle = createStudioHandler({ env: { STUDIO_REQUESTS_PER_MINUTE: '60' }, jobs, mapExecutor: executor });
  try {
    const { p, rq } = provided(), inp = M.buildMapAsk(p, studioView(p), [rq], rq.id, M.MAP6_SCHEMA), wire = J.encodeMapInput(inp);
    const lawful = JSON.stringify(replyFor(inp.ask));
    const cases = [['{"summary":', 'JSON'], ['{}', 'CONTRACT'], [JSON.stringify(replyFor(inp.ask, { pastedCode: true })), 'source-kind'], [lawful, null]];
    for (const [n, [text]] of cases.entries()) writeFileSync(join(ctl, `reply-${n + 1}.json`), text);
    for (const [n, [, rule]] of cases.entries()) {
      const id = `MJ_${crypto.randomUUID()}`, cap = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url');
      const binding = { entryId: `E_src00114-0${n}`, projectId: p.id, lifecycle: 1, seq: 1, after: inp.after, schemaVersion: inp.ask.schemaVersion, prompt: await mapPromptId(), model: 'fake-model-102', askHash: await J.jobHash(inp.ask), inputHash: await J.jobHash(wire) };
      assert.equal((await jcall(handle, 'POST', '', cap, JSON.stringify({ version: 'map-job.1', id, binding, input: wire }))).status, 202);
      let v; await until(async () => !['accepted', 'running'].includes((v = await jcall(handle, 'GET', `/${id}`, cap)).state), `job ${n}`);
      if (rule === null) {
        assert.equal(v.state, 'ready', JSON.stringify(v.error));
        const back = J.decodeMapInput(v.input), applied = M.applyReading(p, back, M.validateMapReply(v.result.wire, back.ask), meta('R_114-job'));
        assert.equal(R.requestMatches(applied.project).filter(x => x.reading === 'R_114-job' && ['code', 'test'].includes(x.match.kind)).length, 2);
      } else {
        assert.deepEqual([v.state, v.error.code], ['failed', 'INVALID_RESPONSE']);
        assert.equal(v.error.detail.rule, rule);
        if (rule === 'source-kind') assert.deepEqual([v.error.detail.path, v.error.detail.target], ['matches[1].kind', `${inp.ask.records.find(r => inp.records.get(r.id).text === OLD_REPORT).id}:pasted`]);
        else assert.equal(v.error.detail.path, undefined);
      }
      await until(() => executor.describe().state === 'ready', 'slot free');
    }
    assert.equal(readFileSync(join(ctl, 'invocations'), 'utf8').split('\n').filter(Boolean).length, 4, 'one child each, no retry');
  } finally { await jobs.close(); await executor.close(); }
});
