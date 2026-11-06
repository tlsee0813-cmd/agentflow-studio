// first-map-divided.41 (map-reading.16): model-free checks on the third test set's records, a CLI and a nightly batch (salesrec;
// fixtures/cli41/design.txt is N01 and status.txt N02, read exactly as the .40 run read them) and on the stored .40 plan
// (fixtures/cli41/plan40.json, the model's own plan); the KORU-shaped rows below copy the KORU design and status records' row shapes.
// The wires are author-written: no model quality is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as S from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';
import { validateProject } from '../dist/public/shared/validation.js';
import { planStoreFolds, storeDupParts, planClaims, planShort, readingDiagnostics, stepsCut, pathVersions, uncitedFacts, MAP_BLUEPRINT_PROMPT } from '../server/map-blueprint.mjs';
import { stripEighteen } from './strip18.mjs';

const fixture = name => readFileSync(new URL(`./fixtures/cli41/${name}`, import.meta.url), 'utf8');
function ofTexts(texts) {
  let project = D.createProject();
  for (const text of texts) project = D.pasteRecord(project, text, null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
  const at = head => { const hit = spans.filter(s => s.t.startsWith(head)); assert.equal(hit.length, 1, head); return hit[0].s; };
  return { project, input, ask: input.ask, at };
}
/** The CLI records as the .40 run read them: N01 the design record, N02 the status report (the later paste is N01). */
const cli = () => ofTexts([fixture('status.txt'), fixture('design.txt')]);
const meta = (id, n) => ({ id, at: '2026-11-04T15:00:00.000Z', model: 'stub', prompt: 'm6-000000000041', hash: n.repeat(64) });
const part = (f, ref, name, head, extra = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)], claims: [], ...extra });
const typed = (f, type, head) => ({ type, typeAt: f.at(head) });
const claim = (f, key, head, extra = {}) => ({ key, kind: 'reported', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...extra });
const line = (f, from, to, head, extra = {}) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'data', ...extra });
const wire = (parts, relations = [], extra = {}) => ({ summary: '', parts, relations, candidates: [], gaps: [], matches: [], material: [], ...extra });
const lineExclusions = read => M.readingExclusions(read).filter(x => /^relations\[\d+\]$/.test(x.path)).map(x => `${x.path}:${x.category}`);
/** A part's 「안의 단계」 rows (design §4) as the model writes them: name, does, up to four uses, at its row. */
const stepRows = (f, name) => fixture('design.txt').split('\n').filter(l => l.startsWith(`| ${name} | `) && /^\|[^|]+\|\s*\d+\s*\|/.test(l)).map(l => {
  const c = l.split('|').slice(1, -1).map(x => x.trim());
  return { name: c[2], does: c[3], uses: c[4].split('·').slice(0, 4), at: f.at(`| ${name} | ${c[1]} | `) };
});
/** A 「조건·거부·분기」 row as the model writes it (its cells as written). */
const conditionRow = (f, head) => { const l = fixture('design.txt').split('\n').find(x => x.startsWith(head)), c = l.split('|').slice(1, -1).map(x => x.trim()); return { when: c[1], then: c[2], else: c[3], at: f.at(head) }; };

test('.41 R1 folder stores fold: a 있는 곳 under a part-table store\'s name is that store\'s; the stored .40 plan folds its four file stores into inbox; every inbox line stands', () => {
  const f = cli();
  assert.deepEqual([...M.heldPlaces(f.ask, 'inbox 폴더')], ['pos-yyyymmdd.xlsx', 'market-yyyymmdd.csv', 'bank-yyyymmdd.csv', 'shoplink-yyyymmdd-pnnn.json']);
  for (const [where, store, want] of [['inbox 폴더 pos/', 'inbox 폴더', true], ['inbox/market/', 'inbox 폴더', true], ['inbox\\bank\\', 'inbox 폴더', true], ['c:/salesrec/rejects/', 'inbox 폴더', false],
    ['inbox 폴더', 'inbox 폴더', false], ['inboxes/x/', 'inbox 폴더', false], ['orders 테이블', 'orders 테이블', false]]) assert.equal(M.storePrefix(where, store), want, where);
  // No part-table store names C:/salesrec/rejects/: the folder rule keeps its file a store of its own (the 경계 the CLI judge left open).
  assert.deepEqual([...M.heldPlaces(f.ask, 'rejects-YYYYMMDD.csv')], ['rejects-yyyymmdd.csv']);
  // The stored .40 plan, re-validated: its four file stores stand on places inbox holds now (store-dup: one plan correction).
  const plan40 = JSON.parse(fixture('plan40.json'));
  assert.deepEqual(planStoreFolds(plan40, f.ask), ['pos-YYYYMMDD.xlsx → inbox 폴더', 'market-YYYYMMDD.csv → inbox 폴더', 'bank-YYYYMMDD.csv → inbox 폴더', 'shoplink-YYYYMMDD-pNNN.json → inbox 폴더']);
  // The folded shape: one inbox store (its outputs not yet written), its four lines on their connection rows; each stands (via-store reads
  // the files the store holds by the records' tables).
  const parts = [part(f, 'new:pos', '매장 POS', '| 매장 POS | 외부 시스템', typed(f, 'external', '| 매장 POS | 외부 시스템')),
    part(f, 'new:accountant', '경리 담당자', '| 경리 담당자 | 사람', typed(f, 'person', '| 경리 담당자 | 사람')),
    part(f, 'new:plugin', '샵링크 플러그인', '| 샵링크 플러그인 | 수집기', typed(f, 'collector', '| 샵링크 플러그인 | 수집기')),
    part(f, 'new:inbox', 'inbox 폴더', '| inbox 폴더 | 행 파일', typed(f, 'store', '| inbox 폴더 | 행 파일')),
    part(f, 'new:ingest', 'ingest 명령', '| ingest 명령 | 계산', typed(f, 'compute', '| ingest 명령 | 계산'))];
  const relations = [line(f, 'new:pos', 'new:inbox', '| 매장 POS | inbox 폴더', { payload: 'pos-YYYYMMDD.xlsx 자동 내보내기' }),
    line(f, 'new:accountant', 'new:inbox', '| 경리 담당자 | inbox 폴더', { payload: 'market-YYYYMMDD.csv·bank-YYYYMMDD.csv 넣기' }),
    line(f, 'new:plugin', 'new:inbox', '| 샵링크 플러그인 | inbox 폴더', { payload: 'shoplink-YYYYMMDD-pNNN.json' }),
    line(f, 'new:inbox', 'new:ingest', '| inbox 폴더 | ingest 명령', { payload: '원천 넷의 원자료 파일' })];
  const read = M.validateMapReply(wire(parts, relations), f.ask, { setAside: true });
  assert.deepEqual([lineExclusions(read), read.relations.length], [[], 4]);
  // The .40 shape: the POS file's store sends to inbox on the POS row like the market file's on the accountant's row; the sender check
  // reads both alike now (.40 set aside the POS line alone: an .xlsx named no file), and the file store folds into inbox (store-dup).
  const files = [part(f, 'new:pos_file', 'pos-YYYYMMDD.xlsx', '| pos-YYYYMMDD.xlsx |', typed(f, 'store', '| pos-YYYYMMDD.xlsx |')),
    part(f, 'new:market_file', 'market-YYYYMMDD.csv', '| market-YYYYMMDD.csv |', typed(f, 'store', '| market-YYYYMMDD.csv |'))];
  const old = wire([...parts, ...files], [line(f, 'new:pos_file', 'new:inbox', '| 매장 POS | inbox 폴더', { payload: 'pos-YYYYMMDD.xlsx 자동 내보내기' }),
    line(f, 'new:market_file', 'new:inbox', '| 경리 담당자 | inbox 폴더', { payload: 'market-YYYYMMDD.csv' })]);
  assert.deepEqual(lineExclusions(M.validateMapReply(structuredClone(old), f.ask, { setAside: true })), []);
  assert.deepEqual(storeDupParts(old, f.ask).map(x => `${x.name} → ${x.into}`), ['pos-YYYYMMDD.xlsx → inbox 폴더', 'market-YYYYMMDD.csv → inbox 폴더']);
  assert.deepEqual(M.fileKeys('ledger.sqlite · salesrec.toml · report-YYYYMMDD.xlsx · a.tsv'), ['ledger.sqlite', 'salesrec.toml', 'report-yyyymmdd.xlsx', 'a.tsv']);
});

test('.41 R2 sixteen steps, the tail kept: a part reads its fourteen 4절 rows, steps-cut names the rows no step stands on; map-reading.16 stores sixteen, .15 twelve', () => {
  const f = cli(), steps = stepRows(f, 'ingest 명령');
  assert.deepEqual([steps.length, steps.at(-2).name, steps.at(-1).name], [14, '쓰기', '출력']);
  // .42 (map-reading.17): 24 steps.
  assert.deepEqual([M.PART_LIST_MAX.steps, M.PART_LIST_MAX.config], [24, 12]);
  const ingest = part(f, 'new:ingest', 'ingest 명령', '| ingest 명령 | 계산', { ...typed(f, 'compute', '| ingest 명령 | 계산'), steps });
  const read = M.validateMapReply(wire([ingest]), f.ask, { setAside: true });
  assert.deepEqual([read.parts[0].steps.length, M.readingExclusions(read).filter(x => x.category === 'step')], [14, []]);
  // The .40 cap (twelve) cut the write and the summary rows unseen; a middle row left out is named alone.
  assert.deepEqual(stepsCut(f.ask, [{ name: 'ingest 명령', steps: steps.slice(0, 12) }]), { rows: 14, missing: ['ingest 명령: 13 쓰기', 'ingest 명령: 14 출력'] });
  assert.deepEqual(stepsCut(f.ask, [{ name: 'ingest 명령', steps: steps.filter((_, i) => i !== 9) }]).missing, ['ingest 명령: 10 개인정보 열 제거']);
  assert.deepEqual(stepsCut(f.ask, [{ name: 'ingest 명령', steps: [] }]), { rows: 0, missing: [] }, 'a part with no step is not named');
  const found = readingDiagnostics({ ask: f.ask, summary: '', parts: [{ ref: 'new:ingest', name: 'ingest 명령', steps: steps.slice(0, 12), claims: [] }], relations: [] }).find(x => x.rule === 'steps-cut');
  assert.deepEqual([found.expected, found.actual, found.names], [14, 12, ['ingest 명령: 13 쓰기', 'ingest 명령: 14 출력']]);
  // A 25th step is past the bound: the list is left out whole (step).
  const over = structuredClone(ingest); over.steps = [...steps, ...steps.slice(0, 11).map(s => ({ ...s, name: `${s.name} 2` }))];
  assert.deepEqual(M.readingExclusions(M.validateMapReply(wire([over]), f.ask, { setAside: true })).filter(x => x.category === 'step').map(x => x.path), ['parts[0].steps']);
  // Stored: map-reading.16 holds fourteen steps; the same entry as map-reading.15 is past its twelve.
  const applied = M.applyReading(f.project, f.input, read, meta('R_cli41_steps', 'a'));
  assert.equal(applied.reading.version, 'map-reading.19');
  assert.deepEqual(validateProject(applied.project), applied.project);
  const old = JSON.parse(S.serializeProject(applied.project)); old.readings.at(-1).version = 'map-reading.15';
  assert.throws(() => validateProject(old), undefined, 'a map-reading.15 entry holds twelve steps');
  const twelve = JSON.parse(S.serializeProject(applied.project)), r = stripEighteen(twelve.readings.at(-1)); r.version = 'map-reading.15'; r.parts[0].steps = r.parts[0].steps.slice(0, 12).map(({ when, ...s }) => s);
  assert.deepEqual(validateProject(twelve), twelve, 'a map-reading.15 entry keeps its shape');
});

test('.41 R3 a bare 「·」 list is one item, settings match by whole tokens: 「종료 코드 0·3·4·5·6」 stays whole and 「window_days 3」 holds no 「3」', () => {
  const f = cli();
  assert.deepEqual(M.listItems('--date(기본 어제 KST), --force, --dry-run, --data, max_attempts 5, tolerance_won 1000, window_days 3, 종료 코드 0·3·4·5·6'),
    ['--date(기본 어제 KST)', '--force', '--dry-run', '--data', 'max_attempts 5', 'tolerance_won 1000', 'window_days 3', '종료 코드 0·3·4·5·6']);
  assert.deepEqual([M.listItems('review·policy·state 행'), M.listItems('CL 20·DS 5 USD'), M.listItems('exit 0·1·2, rps 2')], [['review', 'policy', 'state 행'], ['CL 20', 'DS 5 USD'], ['exit 0·1·2', 'rps 2']]);
  assert.deepEqual([M.bareList(['종료 코드 0', '3', '4']), M.bareList(['TP', 'SL']), M.bareList(['review', 'policy']), M.bareList(['exit codes', '3'])], [true, true, false, false]);
  for (const [a, b, want] of [['window_days 3', '3', false], ['3', '3', true], ['종료 코드 0', '종료 코드 0·3·4·5·6', false], ['종료 코드 0·3·4·5·6', '종료 코드 0·3·4·5·6', true],
    ['--date', '--date(기본 어제 KST)', true], ['match.tolerance_won 1000', 'tolerance_won 1000', true], ['레버리지 20배', '레버리지 20', true], ['max_attempts 5', 'max_attempts 50', false], ['max_attempts 5', 'window_days 3', false]])
    assert.equal(M.sameSetting(a, b), want, `${a} ~ ${b}`);
  // plan-claims on the nightly's 3절 설정 cell: a config that lost 3 and 5 of the exit codes lands no exit-code item (.40 counted 「3」 inside
  // 「window_days 3」 and 「5」 inside 「max_attempts 5」 and named nothing).
  const plan = { parts: [{ ref: 'new:nightly', name: '야간 배치', parent: null, at: [f.at('| 야간 배치 | retry-queue.jsonl 행·sales')], focus: '야간 배치' }], global: [] };
  const config = ['--date(기본 어제 KST)', '--dry-run', 'max_attempts 5', 'tolerance_won 1000', 'window_days 3', '종료 코드 0·4·6'];
  const named = planClaims(f.ask, plan, [{ ref: 'new:nightly', name: '야간 배치', claims: [], config }]).missing.filter(x => x.includes('| 설정 |'));
  assert.deepEqual(named, ['new:nightly: 야간 배치 | 설정 | --force', 'new:nightly: 야간 배치 | 설정 | --data', 'new:nightly: 야간 배치 | 설정 | 종료 코드 0·3·4·5·6']);
  const whole = planClaims(f.ask, plan, [{ ref: 'new:nightly', name: '야간 배치', claims: [], config: [...config.slice(0, 5), '--force', '--data', '종료 코드 0·3·4·5·6'] }]).missing.filter(x => x.includes('| 설정 |'));
  assert.deepEqual(whole, []);
});

test('.41 settings cap twelve: a 설정 cell past twelve items names the rest 「(설정 상한 12 밖)」, which never refuse a render\'s first pass', () => {
  const items = Array.from({ length: 14 }, (_, i) => `opt_${i} ${i + 1}`);
  const f = ofTexts([['3. 부분별 설계', '| 이름 | 받는 산출물 | 안의 단계 | 내는 산출물 | 설정 | 꼬리표 |', '|---|---|---|---|---|---|', `| 배치 | — | 4절 | — | ${items.join(', ')} | [파일: x] |`].join('\n')]);
  const plan = { parts: [{ ref: 'new:batch', name: '배치', parent: null, at: [f.at('| 배치 |')], focus: '배치' }], global: [] };
  const got = planClaims(f.ask, plan, [{ ref: 'new:batch', name: '배치', claims: [], config: items.slice(0, 12) }]);
  assert.deepEqual(got.missing, ['new:batch: 배치 | 설정 | opt_12 13 (설정 상한 12 밖)', 'new:batch: 배치 | 설정 | opt_13 14 (설정 상한 12 밖)']);
  assert.deepEqual(planShort(f.ask, plan, [{ ref: 'new:batch', name: '배치', claims: [], config: items.slice(0, 12) }], null), []);
  assert.deepEqual(planShort(f.ask, plan, [{ ref: 'new:batch', name: '배치', claims: [], config: items.slice(0, 11) }], null), ['new:batch: 배치 | 설정 | opt_11 12'], 'an item within the cap still refuses');
  // The reply takes twelve settings; a thirteenth leaves the list out.
  const reply = wire([part(f, 'new:batch', '배치', '| 배치 |', { config: items.slice(0, 12) })]);
  assert.equal(M.validateMapReply(reply, f.ask, { setAside: true }).parts[0].config.length, 12);
  reply.parts[0].config = items.slice(0, 13);
  assert.deepEqual(M.validateMapReply(reply, f.ask, { setAside: true }).parts[0].config, []);
});

test('.41 R4 hand-kept rules: a rule left to unknown, placed nowhere, whose 누가 정했나 names a person the records say keeps it, takes a program person device', () => {
  const f = cli(), unknown = [{ kind: 'unknown', text: '장치 미상', at: null }];
  const rule = (key, head, text, extra = {}) => claim(f, key, head, { kind: 'want', topic: 'rule', text, scope: 'part', enforcedBy: unknown, ...extra });
  const owner = part(f, 'new:owner', '소유자', '| 소유자 | 사람', { ...typed(f, 'person', '| 소유자 | 사람'), claims: [
    rule('s1', '| 전체 | 매달 28일', '매달 28일~다음 달 3일에는 사무실 PC에 새 판본을 설치하지 않는다.', { scope: 'project' }),
    rule('s2', '| 전체 | 태그·설치는', '태그·설치는 릴리스 관문 통과 뒤에만 한다.', { scope: 'project' }),
    rule('s3', '| 전체 | 고객 이름', '고객 이름·전화번호는 ledger에 저장하지 않는다.', { scope: 'project' })] });
  const accountant = part(f, 'new:accountant', '경리 담당자', '| 경리 담당자 | 사람', { ...typed(f, 'person', '| 경리 담당자 | 사람'), claims: [
    rule('s4', '| 경리 담당자 | 은행 거래내역은', '은행 거래내역은 경리 담당자만 내려받고 인증서는 사무실 PC 밖으로 옮기지 않는다.')] });
  const read = M.validateMapReply(wire([owner, accountant]), f.ask, { setAside: true });
  const devices = c => c.enforcedBy.map(e => [e.kind, e.text, e.program, e.quote?.quote.slice(0, 12) ?? null]);
  // The month-end ban (전체, a 「실제 변화」 row 「28일~다음 달 3일 설치 금지(문서에만)」) and the certificate rule (its part a person).
  assert.deepEqual(devices(read.parts[0].claims[0]), [['person', '소유자 10-24 [파일: docs/RUNBOOK.md]', true, '| 전체 | 매달 28']]);
  assert.deepEqual(devices(read.parts[1].claims[0]), [['person', '소유자 10-02 [파일: docs/RUNBOOK.md]', true, '| 경리 담당자 | 은']]);
  // The release gate rule and the PII rule have no record saying people keep them: 장치 미상 stays.
  assert.deepEqual([devices(read.parts[0].claims[1]), devices(read.parts[0].claims[2])], [[['unknown', '장치 미상', undefined, null]], [['unknown', '장치 미상', undefined, null]]]);
  // The model's own devices are never changed (a none, a place).
  const none = structuredClone(owner); none.claims[0].enforcedBy = [{ kind: 'none', text: '기록상 미설계', at: f.at('| 전체 | 매달 28일') }];
  assert.deepEqual(devices(M.validateMapReply(wire([none]), f.ask, { setAside: true }).parts[0].claims[0]).map(x => x.slice(0, 3)), [['none', '기록상 미설계', undefined]]);
  const placed = structuredClone(accountant); placed.claims[0].anchors = [{ kind: 'inferred', text: '인증서', at: f.at('| 경리 담당자 | 은행 거래내역은') }];
  assert.deepEqual(devices(M.validateMapReply(wire([placed]), f.ask, { setAside: true }).parts[0].claims[0]).map(x => x[0]), ['unknown']);
  // Stored as map-reading.16; a map-reading.15 entry holds code devices only.
  const applied = M.applyReading(f.project, f.input, read, meta('R_cli41_person', 'b'));
  assert.deepEqual(validateProject(applied.project), applied.project);
  const old = JSON.parse(S.serializeProject(applied.project)); old.readings.at(-1).version = 'map-reading.15';
  assert.throws(() => validateProject(old));
});

test('.41 R6 port direction: a lookup step is never a write line\'s port step; the write step takes it; portmap-missing says 「후보 있음 · 방향 불일치」', () => {
  const f = cli(), steps = stepRows(f, 'ingest 명령');
  assert.deepEqual([M.stepVerb(steps[6]), M.stepVerb(steps[12]), M.stepVerb({ name: '슬랙', does: '요약 한 줄', uses: ['slack.post'] }), M.stepVerb({ name: '큐 다시 쓰기', does: '남은 줄만 임시 파일에 써서 바꿔치기', uses: ['retry.rewrite'] })],
    ['read', 'write', 'none', 'write']);
  const make = list => {
    const ingest = part(f, 'new:ingest', 'ingest 명령', '| ingest 명령 | 계산', { ...typed(f, 'compute', '| ingest 명령 | 계산'), outputs: ['sales 행', 'bank_tx 행', 'ingest_files 행', 'rejects-YYYYMMDD.csv'], steps: list });
    const ledger = part(f, 'new:ledger', 'ledger.sqlite', '| ledger.sqlite | 행 파일', { ...typed(f, 'store', '| ledger.sqlite | 행 파일'), outputs: ['sales 행', 'bank_tx 행', 'ingest_files 행', 'matches 행', 'runs 행'] });
    return wire([ingest, ledger], [line(f, 'new:ingest', 'new:ledger', '| ingest 명령 | ledger.sqlite', { payload: 'sales·bank_tx·ingest_files 행' })]);
  };
  // Twelve steps (the .40 cut): 「중복 파일」 (「sha256으로 ingest_files 조회」) was the .40 program row on this write line; now no row, the side crossed.
  const cut = M.validateMapReply(make(steps.slice(0, 12)), f.ask, { setAside: true });
  assert.deepEqual(cut.portMap, []);
  assert.deepEqual(M.portSides(f.ask, cut.parts, cut.relations).find(s => s.direction === 'out'), { relation: 0, direction: 'out', hits: [], chain: [], port: null, crossed: [6] });
  const named = readingDiagnostics({ ask: f.ask, summary: '', parts: make(steps.slice(0, 12)).parts, relations: make(steps.slice(0, 12)).relations, portMap: [] }).find(x => x.rule === 'portmap-missing');
  assert.ok(named.names.includes('후보 있음 · 방향 불일치: new:ingest → new:ledger: sales·bank_tx·ingest_files 행 (후보: 중복 파일)'), JSON.stringify(named.names));
  // Fourteen steps: 「쓰기」 (ledger.write_rows, 「한 트랜잭션 INSERT」) is the write line's step, marked program.
  const all = M.validateMapReply(make(steps), f.ask, { setAside: true });
  assert.deepEqual(all.portMap.map(m => [m.direction, m.port, m.step, m.program]), [['out', 'ingest_files 행', '쓰기', true]]);
});

test('.41 R9 page loops and condition states: the plugin\'s 「next_cursor면 다음 페이지」 is its loop unit with 「끝」 its stop; next_cursor, prev.complete and line[\'attempt\'] are kept states, never cfg or args', () => {
  const f = cli();
  const plugin = part(f, 'new:plugin', '샵링크 플러그인', '| 샵링크 플러그인 | 수집기', { ...typed(f, 'collector', '| 샵링크 플러그인 | 수집기'),
    conditions: [conditionRow(f, '| 샵링크 플러그인 | not bucket'), conditionRow(f, '| 샵링크 플러그인 | r.status_code'), conditionRow(f, "| 샵링크 플러그인 | body.get('next_cursor')")] });
  const nightly = part(f, 'new:nightly', '야간 배치', '| 야간 배치 | 계산', { ...typed(f, 'compute', '| 야간 배치 | 계산'), steps: stepRows(f, '야간 배치'),
    conditions: [conditionRow(f, '| 야간 배치 | prev and'), conditionRow(f, "| 야간 배치 | line['attempt']")] });
  const read = M.validateMapReply(wire([plugin, nightly]), f.ask, { setAside: true });
  const [p, n] = read.parts;
  // The plugin's steps are its 3절 chain (the program's), the last piece goes page by page.
  assert.deepEqual(p.steps.map(s => [s.name, s.program]).at(-1), ['next_cursor면 다음 페이지', true]);
  assert.deepEqual([p.loop.unit, p.loop.stop, p.loop.resume, p.loop.program], ['next_cursor면 다음 페이지', '끝', null, true]);
  assert.deepEqual(p.stateVars.map(v => [v.name, v.scope, v.program]), [['next_cursor', null, true]]);
  assert.equal(n.loop, null, 'a nightly run is one pass: no page step, no loop');
  assert.deepEqual(n.stateVars.map(v => [v.name, v.program]), [['prev.complete', true], ["line['attempt']", true]]);
  assert.deepEqual(M.conditionKeys("line['attempt'] >= cfg.shoplink.max_attempts").map(k => [k.name, k.leaf, k.root]), [["line['attempt']", 'attempt', 'line'], ['cfg.shoplink.max_attempts', 'max_attempts', 'cfg']]);
  assert.deepEqual(M.conditionKeys('retry_count > MAX_RETRY && queue_left > 0').map(k => k.name), ['retry_count']);
  // The model's own page unit is read now (a page is a unit), never changed; a timer or a store takes no page loop.
  const own = structuredClone(plugin); own.loop = { unit: '다음 페이지가 없을 때까지', stop: null, resume: null, at: f.at('| 샵링크 플러그인 | 샵링크 주문 페이지') };
  const mine = M.validateMapReply(wire([own]), f.ask, { setAside: true }).parts[0].loop;
  assert.deepEqual([mine.unit, mine.program], ['다음 페이지가 없을 때까지', undefined]);
  const timer = structuredClone(plugin); Object.assign(timer, typed(f, 'timer', '| 샵링크 플러그인 | 수집기'));
  assert.equal(M.validateMapReply(wire([timer]), f.ask, { setAside: true }).parts[0].loop, null);
});

// ---- The KORU .40 judge (e)–(g): a 「전체」 rule written twice, a store taking a nested row's fields, 질감 v3's 065ce38b standing only in
// the 경로 약속 line, the card runner's 5d31b880 lost with a restated claim. Rows copied in the KORU records' shapes. ----
test('.41 KORU (8) a 「전체」 row has one home: the first plan part holding it carries it, another part never answers for it, and it never refuses a render', () => {
  const f = ofTexts([['2. 부분', '| 이름 | 하는 일 한 줄 | 상태 단어 |', '|---|---|---|', '| 감독자 세션 | 감독 | 돌고 있음 |', '| 트리거 | 깨우기 | 돌고 있음 |',
    '7. 지켜야 할 것과 하지 않기로 한 것', '| 부분 이름 | 규칙 한 줄 | 누가 정했나·언제 |', '|---|---|---|', '| 전체 | 달력 대기 없이 바로 진입하지 않는다 | 소유자 11-01 |',
    '| 트리거 | 트리거는 하루 세 번만 깨운다 | 소유자 11-01 |'].join('\n')]);
  const whole = f.at('| 전체 |'), own = f.at('| 트리거 | 트리거는');
  const plan = { parts: [{ ref: 'new:supervisor', name: '감독자 세션', parent: null, at: [f.at('| 감독자 세션 |'), whole], focus: '감독' },
    { ref: 'new:trigger', name: '트리거', parent: null, at: [f.at('| 트리거 | 깨우기'), whole, own], focus: '깨우기' }], global: [] };
  const written = { ref: 'new:supervisor', name: '감독자 세션', claims: [{ at: whole, text: '달력 대기 없이 진입하지 않는다.' }] }, trigger = { ref: 'new:trigger', name: '트리거', claims: [] };
  assert.deepEqual(planClaims(f.ask, plan, [trigger]).missing, ['new:trigger: 트리거 | 트리거는 하루 세 번만 깨운다 | 소유자 11-01'], 'the trigger answers for its own rule only');
  assert.deepEqual(planShort(f.ask, plan, [trigger], null), ['new:trigger: 트리거 | 트리거는 하루 세 번만 깨운다 | 소유자 11-01']);
  assert.deepEqual(planClaims(f.ask, plan, [written, trigger]).missing, ['new:trigger: 트리거 | 트리거는 하루 세 번만 깨운다 | 소유자 11-01']);
  // Nobody wrote it: named once, on its home, and never a refusal.
  assert.deepEqual(planClaims(f.ask, plan, [{ ...written, claims: [] }, trigger]).missing.filter(x => x.includes('전체')), ['new:supervisor: 전체 | 달력 대기 없이 바로 진입하지 않는다 | 소유자 11-01']);
  assert.deepEqual(planShort(f.ask, plan, [{ ...written, claims: [] }], null), []);
  assert.ok(MAP_BLUEPRINT_PROMPT.includes('「전체」 행(부분 이름 칸이 「전체」)은 한 부분에만 맡긴다'));
});

test('.41 KORU (9) a store\'s fields keep one level: the inner names of 「card(카드 안)」 beside 「card」 are set aside one by one (fields)', () => {
  const f = ofTexts([['1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| 카드 러너 | AI 판단 | 세 팔 카드 [파일: C/card_runner.py] |',
    '2. 산출물', '| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 | 꼬리표 |', '|---|---|---|---|---|---|',
    '| cards-{CX,CL,DS}.jsonl | schema·card_id·arm·card·answer | 카드 러너 | 카드 러너 | /var/lib/koru-desk/cards/ | [파일: C/card_runner.py] |',
    '| card(카드 안) | side·watch·horizon_h | 카드 러너 | 카드 러너 | cards-*.jsonl 안 | [파일: C/schemas.json] |'].join('\n')]);
  const store = fields => part(f, 'new:cards', 'cards-{CX,CL,DS}.jsonl', '| cards-{CX,CL,DS}.jsonl |', { ...typed(f, 'store', '| cards-{CX,CL,DS}.jsonl |'), fields });
  const read = M.validateMapReply(wire([store(['schema', 'card_id', 'arm', 'card', 'answer', 'side', 'watch', 'horizon_h'])]), f.ask, { setAside: true });
  assert.deepEqual([read.parts[0].fields, M.readingExclusions(read).filter(x => x.category === 'fields').map(x => x.path)],
    [['schema', 'card_id', 'arm', 'card', 'answer'], ['parts[0].fields[5]', 'parts[0].fields[6]', 'parts[0].fields[7]']]);
  // Without the head the inner names are not judged; plain map.6 reads the list as written.
  assert.deepEqual(M.validateMapReply(wire([store(['schema', 'side'])]), f.ask, { setAside: true }).parts[0].fields, ['schema', 'side']);
  assert.deepEqual(M.validateMapReply(wire([store(['card', 'side'])]), f.ask).parts[0].fields, ['card', 'side']);
  assert.ok(MAP_BLUEPRINT_PROMPT.includes('그 안 이름을 저장소 필드로 「접는다」고 focus에 쓰지 않는다'));
});

test('.41 KORU (10) the 경로 약속 line\'s versions count: a part row tagged [파일: T] answers for T\'s sha (uncited 「판본 065ce38b: 질감 v3」)', () => {
  const f = ofTexts([['KORU 설계 기록 v1 (검토 세션, 2026-11-03 09:xxZ; 코드는 git show로 라이브 sha를 읽음)',
    '경로 약속: R = koru-wt/d4 git 618df374:code/exec/race_rung.py · C = /home/[가림]/koru git 5d31b880:code/.cardrunner/ · T = git ops/texture-v3(065ce38b):code/.texture-v3/',
    '1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| 질감 v3 | 계산 | 분마다 TX 라벨 [파일: T] |', '| 엔진 | 루프·엔진 | 경주 [파일: R] |', '| 카드 러너 | AI 판단 | 세 팔 카드 [파일: C/card_runner.py] |'].join('\n')]);
  assert.deepEqual([...pathVersions(f.ask)], [['R', ['618df374']], ['C', ['5d31b880']], ['T', ['065ce38b']]]);
  const parts = [{ ref: 'new:texture', name: '질감 v3', claims: [{ text: '분마다 라벨', at: f.at('| 질감 v3 |') }] }, { ref: 'new:engine', name: '엔진', claims: [{ text: '라이브 618df374 엔진', at: f.at('| 엔진 |') }] },
    { ref: 'new:card', name: '카드 러너', claims: [], config: [], files: ['C/card_runner.py'] }];
  assert.deepEqual(uncitedFacts(f.ask, parts).uncited, ['판본 065ce38b: 질감 v3', '판본 5d31b880: 카드 러너']);
  parts[2].roleAbout = 'sha 5d31b880';
  assert.deepEqual(uncitedFacts(f.ask, parts).uncited, ['판본 065ce38b: 질감 v3']);
});

test('.41 KORU (11) a restated claim carrying the only copy of a sha stays; once another claim carries it, the restate rule sets it aside', () => {
  const f = ofTexts([['2. 부분', '| 이름 | 하는 일 한 줄 | 담당 파일·폴더 | 상태 단어 | 상태의 기준 시각 |', '|---|---|---|---|---|', '| 카드 러너 | 세 팔 카드 sha 2 5d31b880 | C | 돌고 있음 | 11-03 07:33Z |',
    '8. 오류·미해결·할 일', '| 부분 이름 | 무엇이 | 언제부터·근거 |', '|---|---|---|', '| 카드 러너 | 카드 한 장이 늦게 남 | 11-03 |'].join('\n')]);
  const runner = extra => part(f, 'new:card', '카드 러너', '| 카드 러너 | 세 팔', { state: 'running', stateAt: f.at('| 카드 러너 | 세 팔'), claims: [
    claim(f, 's1', '| 카드 러너 | 세 팔', { topic: 'status', text: '세 팔 카드 sha 2 5d31b880 카드 러너가 11-03 07:33Z 기준 돌고 있다고 보고됐다.' }), ...extra] });
  const kept = M.validateMapReply(wire([runner([])]), f.ask, { setAside: true });
  assert.deepEqual([kept.parts[0].claims.map(c => c.key), M.readingExclusions(kept).filter(x => x.category === 'restate')], [['s1'], []]);
  const other = claim(f, 's2', '| 카드 러너 | 카드 한 장', { topic: 'defect', text: '5d31b880 카드 러너의 카드 한 장이 늦게 남았다.' });
  const gone = M.validateMapReply(wire([runner([other])]), f.ask, { setAside: true });
  assert.deepEqual([gone.parts[0].claims.map(c => c.key), M.readingExclusions(gone).filter(x => x.category === 'restate').map(x => x.path)], [['s2'], ['parts[0].claims[0]']]);
});

test('.41 prompts: recipe .41, the plan\'s folder and 「전체」 rules, the render\'s caps, bare lists, person devices, page loops, condition states, port direction, kept shas; the summary says what the project is first', async () => {
  const P = await import('../server/map-pipeline.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.50', 'later-map-divided.50']);
  for (const rule of ['「있는 곳」이 부분 표 저장소 행의 이름으로 시작하면(「inbox 폴더 pos/」', '파일 ref → 폴더 ref 「담김」 선은 쓰지 않는다', '「있는 곳」이 부분 표의 어느 저장소도 이름 대지 않는 폴더'])
    assert.ok(MAP_BLUEPRINT_PROMPT.includes(rule), rule);
  for (const rule of ['순번 순서로 최대 24개다', '꼬리를 자르지 않는다', '진단 steps-cut', '적힌 그대로 최대 12개', '「종료 코드 0·3·4·5·6」)은 나누지 않고 한 항목으로 쓴다', '「설정 상한 12 밖」',
    '{"kind":"person","text":"그 누가 정했나 칸 그대로(80자 이내)","at":"그 규칙 행"}', '「next_cursor면 다음 페이지」', "「line['attempt']」", '부분 표 저장소 이름으로 시작하는 산출물 행(「inbox 폴더 pos/」)도 그 저장소에 접힌 행이다',
    '그 안 이름을 fields에 함께 쓰지 않는다', '판본 낱말(sha)을 담은 주장은 그 판본을 다른 주장·config·files·fileRoles·role의 about이 담지 않으면'])
    assert.ok(P.RENDER_RULES.includes(rule), rule);
  for (const rule of ['첫 문장은 프로젝트가 무엇인지다', '둘째 문장은 기록의 기준 시각(basisAt)의 운영 상태다', '「후보 있음 · 방향 불일치」']) assert.ok(P.GLOBAL_RULES.includes(rule), rule);
});
