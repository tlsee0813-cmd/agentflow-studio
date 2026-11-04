// Recipe .45 review fixes (B1, D1, D2, N1–N10) on the fictional 물주기 v5 record (tests/fixtures/record45): a v5 row read by its v4 view
// for the sender, receiver, wrong-part and change/status checks; 13.7a's shortcut only through the C-LINK rows; the reader's own condition;
// read commands only for a run; a page's C-END against its own rows; supplementary fixes; ID-first parts of the latest record; first-structure
// C-COND rows; the v5 asks' words; a claim's grade against its row's cites; a segment's measured size.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import * as R from '../dist/public/shared/report-ask.js';
import { codeWords } from '../dist/public/shared/record-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { mapErrorText } from '../dist/public/client/map-run.js';
import * as B from '../server/map-blueprint.mjs';
import * as P from '../server/map-pipeline.mjs';

const page = n => readFileSync(new URL(`./fixtures/record45/page${n}.txt`, import.meta.url), 'utf8');
function ofPages(texts) {
  let project = D.createProject();
  for (const t of texts) project = D.pasteRecord(project, t, null).project;
  project = { ...project, pasted: project.pasted.map((r, i) => ({ ...r, at: new Date(Date.UTC(2026, 10, 5, 9, 0, i)).toISOString() })) };
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
  const at = head => { const hit = spans.filter(s => s.t.startsWith(head)); if (hit.length !== 1) throw new Error(`span ${head}: ${hit.length}`); return hit[0].s; };
  return { ask: input.ask, at };
}
const part = (f, ref, name, head, x = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)], claims: [], ...x });
const claim = (f, key, head, x = {}) => ({ key, kind: 'reported', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...x });
const line = (f, from, to, head, x = {}) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'control', mode: 'design', ...x });
const PARTS = [['new:user', '사용자', '|B01|'], ['new:app', '물주기 앱', '|B02|'], ['new:api', '화분 API', '|B03|'], ['new:calc', '일정 계산기', '|B05|'], ['new:tick', '매시 틱', '|B06|'],
  ['new:push', '푸시 발송기', '|B07|푸시'], ['new:gw', '푸시 게이트웨이', '|B08|'], ['new:login', '로그인 검사', '|B09|']];
function read(f, { relations = [], claims = {} } = {}) {
  const wire = { summary: '', candidates: [], gaps: [], matches: [], material: [], relations,
    parts: PARTS.map(([ref, name, head]) => part(f, ref, name, head, { claims: claims[ref] ?? [] })) };
  const r = M.validateMapReply(wire, f.ask, { setAside: true });
  return { r, out: M.readingExclusions(r).map(x => `${x.path}:${x.category}`) };
}
const has = (r, a, b) => r.relations.some(x => x.from === a && x.to === b && /\|LN05\|/.test(x.quote ?? ''));

test('review B1: a line on a v5 C-LINK row is read by the row\'s 보내는 부분 and 받는 부분 (B IDs as names): one between other parts is left out', () => {
  const f = ofPages([page(1), page(2)]);
  // LN05 is B06 매시 틱 → B05 일정 계산기. 사용자 → 화분 API on it (the review's case): the row's sender is another part.
  let x = read(f, { relations: [line(f, 'new:user', 'new:api', '|LN05|', { payload: '깨우기' })] });
  assert.ok(x.out.includes('relations[0]:sender'), x.out.join(' '));
  // (The 사용자 → 화분 API line the reading keeps is the program's own, on the entry row N01; none stands on LN05.)
  assert.ok(!has(x.r, 'new:user', 'new:api'));
  assert.ok(x.r.relations.some(l => l.from === 'new:user' && l.to === 'new:api' && /\|N01\|/.test(l.quote ?? '')));
  // 매시 틱 → 화분 API: the sender is the row's, the receiver is not (the row's 받는 부분 is 일정 계산기).
  x = read(f, { relations: [line(f, 'new:tick', 'new:api', '|LN05|', { payload: '깨우기' })] });
  assert.ok(x.out.includes('relations[0]:sender'), x.out.join(' '));
  // The row's own line stays; the row keeps its direction (as a v4 connection row does): 일정 계산기 → 매시 틱 on it is not the row's.
  x = read(f, { relations: [line(f, 'new:tick', 'new:calc', '|LN05|', { payload: '깨우기' }), line(f, 'new:calc', 'new:tick', '|LN05|', { payload: '끝남' })] });
  assert.deepEqual(x.out.filter(o => /^relations/.test(o)), ['relations[1]:sender']);
  assert.ok(has(x.r, 'new:tick', 'new:calc') && !has(x.r, 'new:calc', 'new:tick'));
});

test('review B1: a claim on another part\'s v5 C-PART row, or on a change row whose 바뀐 부분 names another part, is wrong-part; on its own row it stays', () => {
  const f = ofPages([page(1), page(2)]);
  // The review's case: B09 로그인 검사's C-PART row quoted by a claim on 푸시 발송기.
  let x = read(f, { claims: { 'new:push': [claim(f, 's1', '|B09|')] } });
  assert.ok(x.out.includes('parts[5].claims[0]:wrong-part'), x.out.join(' '));
  assert.equal(x.r.parts.find(p => p.name === '푸시 발송기').claims.length, 0);
  // CH01's 바뀐 부분 is B07 (푸시 발송기): on 일정 계산기 it is wrong-part, on 푸시 발송기 it stays.
  x = read(f, { claims: { 'new:calc': [claim(f, 's2', '|CH01|', { topic: 'change' })], 'new:push': [claim(f, 's3', '|CH01|', { topic: 'change' })] } });
  assert.ok(x.out.includes('parts[3].claims[0]:wrong-part'), x.out.join(' '));
  assert.equal(x.r.parts.find(p => p.name === '푸시 발송기').claims.length, 1);
  // ST02's 대상 is B07: a status claim on 화분 API is wrong-part.
  x = read(f, { claims: { 'new:api': [claim(f, 's4', '|ST02|', { topic: 'status' })] } });
  assert.ok(x.out.includes('parts[2].claims[0]:wrong-part'), x.out.join(' '));
  // A claim on the part's own C-PART row stays.
  x = read(f, { claims: { 'new:login': [claim(f, 's5', '|B09|')] } });
  assert.deepEqual(x.out.filter(o => /claims/.test(o)), []);
});

test('review N9: a claim on a v5 row whose grade its row\'s cites do not reach is left out (cite-grade); one within them stays', () => {
  const f = ofPages([page(1), page(2)]);
  // CH01 cites E05 (보고): a run-grade claim on it is left out; a report-grade one stays.
  let x = read(f, { claims: { 'new:push': [claim(f, 's31', '|CH01|', { topic: 'change', evidence: 'run' }), claim(f, 's32', '|CH02|', { topic: 'change', evidence: 'report' })] } });
  assert.ok(x.out.includes('parts[5].claims[0]:cite-grade'), x.out.join(' '));
  assert.deepEqual(x.r.parts.find(p => p.name === '푸시 발송기').claims.map(c => c.key), ['s32']);
  // RU01 cites F04 (a file read): file grade stays, run grade does not.
  x = read(f, { claims: { 'new:push': [claim(f, 's33', '|RU01|', { topic: 'rule', evidence: 'file' }), claim(f, 's34', '|RU01|', { topic: 'rule', evidence: 'run' })] } });
  assert.deepEqual(x.r.parts.find(p => p.name === '푸시 발송기').claims.map(c => c.key), ['s33']);
  assert.ok(x.out.includes('parts[5].claims[1]:cite-grade'));
  // A guess on a guess-only row (DB01 추정(F03)) stays; a report claim on it does not.
  x = read(f, { claims: { 'new:tick': [claim(f, 's35', '|DB01|', { evidence: 'guess' }), claim(f, 's36', '|DB01|', { evidence: 'report' })] } });
  assert.deepEqual(x.r.parts.find(p => p.name === '매시 틱').claims.map(c => c.key), ['s35']);
});

test('review D1: 13.7a — a 1×1 D row is never a product; a reader the C-LINK rows reach from the maker (through a part, or into its composition) is a shortcut, one they draw elsewhere but never reach is kept as a C-LINK 누락 후보', () => {
  // D02 푸시 요청 read by 푸시 발송기 (LN07 carries it), 푸시 게이트웨이 (reached: LN07 then LN08), 화분 API (on lines of its own, never reached
  // from 일정 계산기) and 설정 모음 (on no C-LINK row at all).
  const p2 = page(2).replace('|D02|푸시 요청|내부 자료|token, title, at|B05|B07|메모리|F03|', '|D02|푸시 요청|내부 자료|token, title, at|B05|B07·B08·B03·B10|메모리|F03|');
  assert.notEqual(p2, page(2));
  const f = ofPages([page(1), p2]), d = f.at('|D02|');
  const parts = [['new:calc', '일정 계산기'], ['new:push', '푸시 발송기'], ['new:gw', '푸시 게이트웨이'], ['new:api', '화분 API'], ['new:cfg', '설정 모음']].map(([ref, name]) => ({ ref, name }));
  const l = to => ({ from: 'new:calc', to, kind: 'flow', note: '', at: d, channel: 'data', payload: '푸시 요청' });
  const wire = { parts, relations: [l('new:push'), l('new:gw'), l('new:api'), l('new:cfg')] };
  const got = B.productLines(wire, f.ask);
  assert.deepEqual(got.shortcuts, [{ index: 1, via: 'C-LINK' }, { index: 3, via: 'C-LINK' }]);
  assert.deepEqual(got.candidates, [{ index: 2 }]);
  // The 1×1 D row of the unchanged page: 일정 계산기 → 푸시 발송기 and nothing else; a model line to another part on it is no product shortcut.
  const one = ofPages([page(1), page(2)]);
  assert.deepEqual(B.productLines({ parts, relations: [{ ...l('new:gw'), at: one.at('|D02|') }] }, one.ask), { merges: [], shortcuts: [], candidates: [] });
});

test("review D2: a store reader's half keeps a condition its own C-STEP or C-COND rows write (code words); another stays the writer's", () => {
  // A training-script-like hand-over: 화분 API writes a table file the 일정 계산기 reads (LN10, D04 in 급수 기록 DB), the row's condition an
  // existence check. The reader's half keeps it when the reader's own C-STEP row writes that check.
  const p1 = page(1).replace('|LN09|B03|B02|등록 결과|호출마다|—|네트워크|정의된 관계|F02|', '|LN09|B03|B02|등록 결과|호출마다|—|네트워크|정의된 관계|F02|\n|LN10|B03|B05|D04 waterings.json|한 번|os.path.exists(meta_path)|프로세스 사이|정의된 관계|F02|');
  const p2 = page(2).replace('|D03|급수 일정|', '|D04|급수 표|저장|plant_id, at|B03|B05|data/waterings.json (통째 교체)|F03|\n|D03|급수 일정|');
  const own = p2.replace('|B05:S01|기록 읽기|화분의 마지막 급수 기록을 읽는다|loadHistory()|B05:L01|—|', '|B05:S01|기록 읽기|화분의 마지막 급수 기록을 읽는다|loadHistory()|B05:L01|os.path.exists(meta_path) 아니면 건너뜀|');
  assert.ok(p1 !== page(1) && p2 !== page(2) && own !== p2);
  const run = texts => {
    const f = ofPages(texts), db = part(f, 'new:db', '급수 기록 DB', '|B04|', { type: 'store', typeAt: f.at('|B04|'), outputs: ['waterings.json'] });
    const wire = { summary: '', candidates: [], gaps: [], matches: [], material: [], parts: [...PARTS.map(([ref, name, head]) => part(f, ref, name, head)), db],
      relations: [line(f, 'new:api', 'new:db', '|LN10|', { channel: 'data', payload: 'waterings.json' }), line(f, 'new:db', 'new:calc', '|LN10|', { channel: 'data', payload: 'waterings.json' })] };
    const r = M.validateMapReply(wire, f.ask, { setAside: true }), out = M.readingExclusions(r).map(x => `${x.path}:${x.category}`);
    return { out, when: (a, b) => { const l = r.relations.find(x => x.from === a && x.to === b && /\|LN10\|/.test(x.quote ?? '')); assert.ok(l, `${a} → ${b} on LN10 (${out.join(' ')})`); return l.when; } };
  };
  let x = run([p1, own]);
  assert.deepEqual(x.out.filter(o => /^relations/.test(o)), [], 'both halves of a stored hand-over stand on its row (B1 leaves a store end unnamed)');
  assert.equal(x.when('new:api', 'new:db'), 'os.path.exists(meta_path)');
  assert.equal(x.when('new:db', 'new:calc'), 'os.path.exists(meta_path)', 'the reader checks it itself (its own step row)');
  x = run([p1, p2]);
  assert.equal(x.when('new:api', 'new:db'), 'os.path.exists(meta_path)');
  assert.equal(x.when('new:db', 'new:calc'), null, "no row of the reader writes it: the writer's");
  assert.deepEqual(codeWords('os.path.exists(meta_path)'), ['os.path.exists', 'meta_path']);
  assert.deepEqual(codeWords("(losses['val'] < best_val_loss or always_save_checkpoint) 그리고 iter_num > 0"), ['best_val_loss', 'always_save_checkpoint', 'iter_num']);
  assert.deepEqual(codeWords('토큰이 유효할 때만'), []);
});

test('review N1: a run\'s source is a read command (or backticked); a commit, a changelog or an issue is a report', () => {
  for (const s of ['git log --oneline -5', 'rg -n "tick" logs/sample.log', 'grep -R x .', 'ls server/', 'cat a.txt', 'sed -n 1,5p a', 'wc -l a', 'find . -name x', 'head -3 a', 'tail -3 a',
    'Get-Content a.txt', 'Select-String -Path a -Pattern x', 'node -e "1"', 'python -c "1"', 'LC_ALL=C.UTF-8 wc -m a', '`make check`']) assert.ok(T.commandLike(s), s);
  for (const s of ['commit 3f2a1b', 'changelog 2026-10', 'issue 12', 'PR #3 본문', '세션 메모 10:40', 'npm test', 'gitlab 이슈']) assert.ok(!T.commandLike(s), s);
  const p1 = page(1).replace('|E02|실행|rg -n "tick" logs/sample.log|', '|E02|실행|commit 3f2a1b|');
  const f = T.foldTexts([p1])[0];
  assert.equal(f.ledger.evidence.get('E02').grade, 'report');
  assert.ok(f.diagnostics.some(d => d.category === 'grade-source' && d.ref === 'E02'));
});

test('review N2: an earlier page\'s C-END is read against that page\'s own rows: a later 교체 or C-DROP never makes it wrong', () => {
  // Page 2 replaces B10 and drops LN09, both written on page 1 (C-END B01–B10, LN01–LN09).
  const f = T.foldTexts([page(1), page(2)])[0];
  assert.ok(f.deleted.has('LN09') && f.byId.get('B10').page === 2);
  assert.deepEqual(f.diagnostics.filter(d => d.category === 'end-mismatch'), []);
  // A page whose C-END says rows it does not hold is still said.
  const wrong = T.foldTexts([page(1).replace('|C-STATE|끝남|SM01–SM02|', '|C-STATE|끝남|SM01–SM03|'), page(2)])[0];
  assert.ok(wrong.diagnostics.some(d => d.category === 'end-mismatch' && d.table === 'C-STATE' && d.page === 1));
});

test('review N3: a supplementary row\'s fault keeps the detail level; the supplementary request asks for the fix, the page request does not come back', () => {
  const p3 = page(3).replace('|N01|2|B03: 본문 검사|{name, species}|형식이 틀리면 400으로 멈춤|P1-02.2|F02|', '|N01|2|B03: 본문 검사|{name, species}|형식이 틀리면 400으로 멈춤||F02|');
  assert.notEqual(p3, page(3));
  const texts = [page(1), page(2), p3], f = T.latestFold(texts);
  assert.ok(f.obligations.some(o => o.kind === 'fix' && o.table === 'P1-02' && !o.candidate));
  assert.equal(f.level, 2);
  assert.equal(R.pageAsk(texts), null);
  const sup = R.supplementaryAsk(texts);
  assert.ok(sup && sup.text.includes('고칠 보충 행 (1개') && sup.text.includes('- P1-02') && sup.text.includes('P1-02 처리 사슬'), sup?.text.slice(0, 400));
});

test('review N4/N5: v5 parts join their C-PART rows by ID first (name only as a fallback); a model part on no row is said; only the latest record makes parts', () => {
  const f = ofPages([page(1), page(2)]);
  // 「API 서버」 stands within B03's row (화분 API): it takes B03 by ID, and 「화분 API」 standing only on LN04 stands on no C-PART row.
  const wire = { summary: '', candidates: [], gaps: [], matches: [], material: [], relations: [],
    parts: [part(f, 'new:srv', 'API 서버', '|B03|'), part(f, 'new:api', '화분 API', '|LN04|'), part(f, 'new:user', '사용자', '|B01|')] };
  const r = M.validateMapReply(wire, f.ask, { setAside: true });
  const srv = r.parts.find(p => p.name === 'API 서버'), api = r.parts.find(p => p.name === '화분 API');
  assert.equal(srv.recordRef, 'B03');
  assert.ok(!api.recordRef);
  assert.ok((r.recordDiagnostics ?? []).some(d => d.category === 'part-no-row'), JSON.stringify((r.recordDiagnostics ?? []).map(d => d.category)));
  assert.ok(!r.parts.some(p => /^new:rec-b03$/.test(p.ref)), 'B03 is not added again under its name');
  // N5: an older record (another basis) whose part the newer one never had makes no part.
  const old = page(1).replace('기준 9f2c1ab', '기준 1111111').replace('|B10|설정 모음|미정 · 서로 다른 역할 혼재(처리·저장)|', '|B10|옛 설정 파일|미정 · 서로 다른 역할 혼재(처리·저장)|');
  const g = ofPages([old, page(1), page(2)]);
  const r2 = M.validateMapReply({ ...wire, parts: [] }, g.ask, { setAside: true });
  assert.ok(!r2.parts.some(p => p.name === '옛 설정 파일'), r2.parts.map(p => p.name).join(' '));
  assert.ok(r2.parts.some(p => p.name === '설정 모음'));
});

test('review N6/N7: first-structure C-COND and C-VARIANT rows go in Q1 (no out-of-order, the table stays open for the detail); the v5 asks say C-END 남은 것', () => {
  const cond = 'C-COND 조건·거부·분기\n|행 ID|부분|조건|참이면|거짓이면|갈리는 때|근거|\n|---|---|---|---|---|---|---|\n|CD01|B07|PUSH_ENABLED=1|발송|발송 안 함|설정 읽을 때|F04|\n';
  const p1 = page(1).replace('C-END 쪽 끝', `${cond}C-END 쪽 끝`);
  assert.notEqual(p1, page(1));
  const f = T.foldTexts([p1])[0];
  assert.deepEqual(f.diagnostics.filter(d => d.category === 'out-of-order' && d.table === 'C-COND'), []);
  assert.equal(f.states.get('C-COND').state, 'open');
  assert.equal(f.level, 1);
  assert.ok(f.obligations.some(o => o.kind === 'table-open' && o.table === 'C-COND' && o.text === '첫 구조 행만'));
  // Page 2 writes C-COND again (CD01 then CD02 would be a duplicate ID: the fixture's CD01 replaces nothing) and closes it.
  const ask = R.recordAskV5();
  assert.ok(ask.includes('첫 구조를 바꾸는 C-COND·C-VARIANT 행은 첫 구조 쪽에 함께 쓰고'));
  assert.ok(ask.includes('첫 구조를 바꾸는 변형'));
  for (const text of [ask, R.pageAsk([p1]).text, R.supplementaryAsk([page(1), page(2), page(3)])?.text ?? R.supplementaryAsk([page(1), page(2)]).text]) {
    assert.ok(text.includes('분량 때문에 생략한 내용은 C-END 남은 것에 남겨라.'));
    assert.ok(!text.includes('완료표'));
  }
});

test('review N10: an extraction segment is measured as sent (원문·열쇠 characters, the whole request\'s bytes); over a bound it fails with MAP_SEGMENT_TOO_LARGE, never cut', () => {
  const input = { partition: { records: [{ lead: 'ab', spans: [{ t: '가나다' }, { t: 'xyz' }] }] }, keys: [{ parts: [] }] };
  const size = P.segmentSize('지시', input);
  assert.equal(size.chars, 2 + 3 + 3 + JSON.stringify(input.keys).length);
  assert.equal(size.bytes, new TextEncoder().encode('지시' + JSON.stringify(input)).length);
  assert.deepEqual(P.checkSegmentSize('extract-1', '지시', input), size);
  assert.throws(() => P.checkSegmentSize('extract-2', '지시', input, { total: 3, limits: { chars: 5, bytes: 1e6 } }),
    e => e.code === 'MAP_SEGMENT_TOO_LARGE' && e.detail.stage === 'extract-2' && e.detail.chars === size.chars && e.detail.maxChars === 5 && e.detail.total === 3);
  assert.throws(() => P.checkSegmentSize('extract-1', '지시', input, { limits: { chars: 1e6, bytes: 10 } }), e => e.code === 'MAP_SEGMENT_TOO_LARGE' && e.detail.maxBytes === 10);
  const text = mapErrorText('MAP_SEGMENT_TOO_LARGE', { stage: 'extract-2', total: 3, chars: 13000, maxChars: 12000, bytes: 70000, maxBytes: 65536 });
  assert.ok(text.includes('근거 읽기 2/3 구간') && text.includes('13,000자') && text.includes('65,536바이트') && text.includes('잘라서 보내지 않았고'), text);
  assert.ok(mapErrorText('MAP_SEGMENT_TOO_LARGE').includes('잘라서 보내지 않았고'));
});
