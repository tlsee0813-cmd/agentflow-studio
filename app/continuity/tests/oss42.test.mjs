// first-map-divided.42 (map-reading.17): model-free checks on synthetic records shaped like the two open-source test sets the .41 maps
// were judged on (a measuring CLI and an ML-style script set): fixtures/oss42/design.txt is N01 and status.txt N02, author-written and
// copying no project's text. The wires are author-written: no model quality is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as S from '../dist/public/shared/storage.js';
import { studioView } from '../dist/public/shared/studio.js';
import { validateProject } from '../dist/public/shared/validation.js';
import { productLines, summaryStructure, readingDiagnostics, combineRenderedReading, finalDiagnostics, splitBlueprintParts, fragmentKeys, mapStageIssues, loopRows,
  MAP_BLUEPRINT_PROMPT, FINAL_DIAGNOSTICS } from '../server/map-blueprint.mjs';

const fixture = name => readFileSync(new URL(`./fixtures/oss42/${name}`, import.meta.url), 'utf8');
function ofTexts(texts) {
  let project = D.createProject();
  for (const text of texts) project = D.pasteRecord(project, text, null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
  const at = head => { const hit = spans.filter(s => s.t.startsWith(head)); assert.equal(hit.length, 1, head); return hit[0].s; };
  return { project, input, ask: input.ask, at };
}
/** The synthetic records: N01 the design record, N02 the status report (the later paste is N01). */
const rec = () => ofTexts([fixture('status.txt'), fixture('design.txt')]);
const meta = (id, n) => ({ id, at: '2026-11-04T16:00:00.000Z', model: 'stub', prompt: 'm6-000000000042', hash: n.repeat(64) });
const part = (f, ref, name, head, extra = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(head)], claims: [], ...extra });
const typed = (f, type, head) => ({ type, typeAt: f.at(head) });
const claim = (f, key, head, extra = {}) => ({ key, kind: 'describes', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...extra });
const line = (f, from, to, head, extra = {}) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'data', ...extra });
const wire = (parts, relations = [], extra = {}) => ({ summary: '', parts, relations, candidates: [], gaps: [], matches: [], material: [], ...extra });
const cells = l => l.split('|').slice(1, -1).map(x => x.trim());
/** A part's 「안의 단계」 rows (design §4) as the model writes them: name, does, up to four uses, at its row. */
const stepRows = (f, name) => fixture('design.txt').split('\n').filter(l => l.startsWith(`| ${name} | `) && /^\|[^|]+\|\s*\d+\s*\|/.test(l)).map(l => {
  const c = cells(l); return { name: c[2], does: c[3], uses: c[4].split('·').slice(0, 4), at: f.at(`| ${name} | ${c[1]} | `) };
});
/** A quote's row by its first two cells (「sweeper|3」), or null. */
const rowHead = q => q ? M.tableCells(q.quote.split('\n')[0]).slice(0, 2).join('|') : null;
const devices = c => c.enforcedBy.map(e => [e.kind, e.text, e.program === true, rowHead(e.quote)]);
const categories = read => M.readingExclusions(read).map(x => `${x.path}:${x.category}`);

/** The rule parts of the records, each rule written with the decider of its 누가 정했나 cell as its person device (what the .41 maps did). */
function ruleParts(f, deciders = true) {
  const person = (head, text) => deciders ? { enforcedBy: [{ kind: 'person', text, at: f.at(head) }] } : {};
  const rule = (key, head, text, who, extra = {}) => claim(f, key, head, { topic: 'rule', text, scope: 'part', ...person(head, who), ...extra });
  return [
    part(f, 'new:verifier', 'verifier', '| verifier | 계산', { ...typed(f, 'compute', '| verifier | 계산'), claims: [rule('s1', '| verifier | 따옴표', '따옴표 밖 구분자 겹침과 빈 머리행은 거부한다.', '관리자 2026-10-20')] }),
    part(f, 'new:entry', 'entry', '| entry | [모름]'),
    part(f, 'new:sweeper', 'sweeper', '| sweeper | 루프', { ...typed(f, 'loop', '| sweeper | 루프'), steps: stepRows(f, 'sweeper'), claims: [rule('s2', '| sweeper | 첫 묶음', '첫 묶음 결과가 항상 비교 기준이다.', '관리자 2026-10-21')] }),
    part(f, 'new:worker', 'worker', '| worker | [모름]', { steps: stepRows(f, 'worker'), claims: [rule('s3', '| worker | 묶음 크기', '묶음 크기 % 일꾼 수 == 0이어야 한다.', '관리자')] }),
    part(f, 'new:reporter', 'reporter', '| reporter | 계산', { ...typed(f, 'compute', '| reporter | 계산'), claims: [rule('s4', '| reporter | 출력 표', '출력 표는 짧게 유지한다.', '관리자 2026-10-24')] }),
    part(f, 'new:admin', '관리자', '| 관리자 | 사람', { ...typed(f, 'person', '| 관리자 | 사람'), claims: [rule('s5', '| 전체 | 배포 전', '배포 전 체크리스트는 사람이 확인한다.', '관리자 2026-10-23', { scope: 'project' })] })];
}

test('.42 (1) who decided is not what keeps: a person device naming only the 누가 정했나 cell is set aside (decider); the program keeps the rule with a code device from its own step, from the rows its [파일: X] tag points at, or says 장치 미상', () => {
  const f = rec(), read = M.validateMapReply(wire(ruleParts(f)), f.ask, { setAside: true });
  const [verifier, , sweeper, worker, reporter, admin] = read.parts;
  assert.deepEqual(categories(read).filter(x => x.endsWith(':decider')), ['parts[0].claims[0].enforcedBy[0]:decider', 'parts[2].claims[0].enforcedBy[0]:decider',
    'parts[3].claims[0].enforcedBy[0]:decider', 'parts[4].claims[0].enforcedBy[0]:decider']);
  // The shell-syntax-like refusal: its tag [파일: src/entry.rs] is EN of the 경로 약속, whose two bail! rows keep it (and are its places).
  assert.deepEqual(devices(verifier.claims[0]), [['code', 'quote_overlap(&row) 있음 → bail!(구분자 안내)', true, 'entry|quote_overlap(&row) 있음'], ['code', 'header.is_empty() → bail!(머리행 요구)', true, 'entry|header.is_empty()']]);
  assert.deepEqual(verifier.claims[0].anchors.map(a => [a.kind, a.text, a.program === true]), [['inferred', 'quote_overlap(&row) 있음', true], ['inferred', 'header.is_empty()', true]]);
  // The baseline rule: its own part's step sharing 묶음·결과·기준 (its does shares the most).
  assert.deepEqual(devices(sweeper.claims[0]), [['code', '묶음마다 worker 실행, 첫 결과를 기준으로', true, 'sweeper|3']]);
  // The divisibility rule: its own step's 조건·분기 cell, an assert.
  assert.deepEqual(devices(worker.claims[0]), [['code', '묶음 크기 % 일꾼 수 != 0 → assert 실패', true, 'worker|1']]);
  // Nothing keeps the output rule in the records: 장치 미상, marked program.
  assert.deepEqual(devices(reporter.claims[0]), [['unknown', '장치 미상', true, null]]);
  // A rule the record says people keep by hand (사람이 확인) keeps its person.
  assert.deepEqual(devices(admin.claims[0]), [['person', '관리자 2026-10-23', false, '전체|배포 전 체크리스트는 사람이 확인']]);
  // Plain map.6 reads the person as written (no decider check outside the divided reading), and adds no device beside it.
  assert.deepEqual(devices(M.validateMapReply(wire(ruleParts(f)), f.ask).parts[2].claims[0]), [['person', '관리자 2026-10-21', false, 'sweeper|첫 묶음 결과가 항상 비교 기준']]);
  // A rule the model left with no device reads the same way (the program's devices), and its decider is never written by the program.
  const bare = M.validateMapReply(wire(ruleParts(f, false)), f.ask, { setAside: true });
  assert.deepEqual(bare.parts.map(p => p.claims.flatMap(c => c.enforcedBy.map(e => e.kind))), [['code', 'code'], [], ['code'], ['code'], ['unknown'], ['unknown']]);
  // A model code device on a step row stands (the step tables are code lines now); one on a part-table row is still set aside.
  const coded = ruleParts(f); coded[2].claims[0].enforcedBy = [{ kind: 'code', text: 'run_batch(first_result)', at: f.at('| sweeper | 3 | ') }];
  coded[3].claims[0].enforcedBy = [{ kind: 'code', text: 'split_batch', at: f.at('| worker | 묶음 하나') }];
  const kept = M.validateMapReply(wire(coded), f.ask, { setAside: true });
  assert.deepEqual([devices(kept.parts[2].claims[0]), categories(kept).filter(x => x.startsWith('parts[3].claims[0].enforcedBy'))],
    [[['code', 'run_batch(first_result)', false, 'sweeper|3']], ['parts[3].claims[0].enforcedBy[0]:enforced-by']]);
  // Stored as map-reading.17 (a program unknown has no passage); a map-reading.16 entry holds no program unknown.
  const applied = M.applyReading(f.project, f.input, read, meta('R_oss42_devices', 'a'));
  assert.equal(applied.project.readings.at(-1).version, 'map-reading.19');
  assert.deepEqual(validateProject(applied.project), applied.project);
  const old = JSON.parse(S.serializeProject(applied.project)); old.readings.at(-1).version = 'map-reading.16';
  assert.throws(() => validateProject(old));
  assert.equal(M.explainExclusion('parts[0].claims[0].enforcedBy[0]', 'contract', 'decider').includes('누가 정했나'), true);
});

test('.42 (2) loops the record names: a step saying 루프 with a count is its part\'s loop unit, a step row or condition giving the way out is its stop; 「…반복일 때만」 and plain sequences make none', () => {
  const f = rec(), parts = ruleParts(f, false), read = M.validateMapReply(wire(parts), f.ask, { setAside: true });
  const sweeper = read.parts[2];
  assert.deepEqual([sweeper.loop.unit, sweeper.loop.stop, sweeper.loop.resume, sweeper.loop.program, rowHead(sweeper.loop.quote)],
    ['본 루프: rounds-1회 열기 → 측정 → 닫기', 'round > max_rounds → break', null, true, 'sweeper|4']);
  // The worker's 「카운터는 본 반복일 때만」 says which round it is, not that the worker repeats; the reporter's two steps follow one another.
  assert.deepEqual([read.parts[3].loop, read.parts[4].loop], [null, null]);
  // The model's loop keeps its unit (a named loop is a unit now) and takes the way out as its stop.
  const own = structuredClone(parts); own[2].loop = { unit: '예열 루프', stop: null, resume: null, at: f.at('| sweeper | 2 | ') };
  const mine = M.validateMapReply(wire(own), f.ask, { setAside: true }).parts[2].loop;
  assert.deepEqual([mine.unit, mine.stop, mine.program], ['예열 루프', 'round > max_rounds → break', true]);
  // Without the exit step, a condition row's bare break is the stop with its condition.
  const less = structuredClone(parts); less[2].steps = less[2].steps.slice(0, 4);
  less[2].conditions = [{ when: 'round == 0 and dry_run', then: 'break', else: '계속', at: f.at('| sweeper | round == 0') }];
  assert.equal(M.validateMapReply(wire(less), f.ask, { setAside: true }).parts[2].loop.stop, 'round == 0 and dry_run → break');
  // A retired part repeats nothing; loop-missing does not name a part whose step names its loop.
  const retired = structuredClone(parts); Object.assign(retired[2], { state: 'retired', stateAt: f.at('| sweeper | 묶음 반복 | src') });
  assert.equal(M.validateMapReply(wire(retired), f.ask, { setAside: true }).parts[2].loop, null);
  assert.deepEqual(loopRows(f.ask, [{ ...parts[2], loop: null }]).missing, []);
  assert.equal(M.programLoopStep([{ name: '분할', does: '카운터는 본 반복일 때만' }]), null);
  assert.equal(M.programLoopStep([{ name: '행마다 검사', does: 'for each row 검사' }])?.unit, '행마다 검사: for each row 검사');
});

test('.42 (3) the summary keeps the status report\'s structural first sentence: a 1절 arrow chain the summary drops is named by uncited 「한 줄 요약(구조)」, never refusing', () => {
  const f = rec();
  assert.deepEqual(summaryStructure(f.ask, 'rowcheck는 CSV 행을 검사하는 작은 CLI다. 마지막 변경은 2026-10-30이다.'),
    { rows: 1, missing: ['한 줄 요약(구조): entry → sweeper → reporter가 메모리 안에서 이어진다'] });
  assert.deepEqual(summaryStructure(f.ask, 'rowcheck는 CSV 행을 검사하는 작은 CLI로, entry → sweeper → reporter가 이어진다.'), { rows: 1, missing: [] });
  const parts = [{ ref: 'new:entry', name: 'entry', claims: [{ text: '인자를 읽는다.', at: f.at('| entry | 인자를') }] }];
  const found = readingDiagnostics({ ask: f.ask, summary: 'rowcheck는 CSV 행을 검사하는 작은 CLI다.', parts, relations: [] }).find(x => x.rule === 'uncited');
  assert.equal(found.names[0], '한 줄 요약(구조): entry → sweeper → reporter가 메모리 안에서 이어진다');
});

test('.42 (4) product lines: an artifact row\'s maker × reader line between two parts a line already joins merges into it (payload list), one a recorded path through another part draws is a shortcut; both named by product-lines', async () => {
  const f = rec();
  const names = [['new:entry', 'entry', '| entry | [모름]'], ['new:sweeper', 'sweeper', '| sweeper | 루프'], ['new:worker', 'worker', '| worker | [모름]'],
    ['new:sampler', 'sampler', '| sampler | 수집기'], ['new:reporter', 'reporter', '| reporter | 계산'], ['new:user', '사용자', '| 사용자 | 사람']];
  const sample = ['wall_ms', 'rss_kb', 'status'];
  const relations = [line(f, 'new:entry', 'new:sweeper', '| entry | sweeper', { payload: '설정', cadence: '실행마다 1회' }),
    line(f, 'new:sweeper', 'new:worker', '| sweeper | worker', { payload: '묶음·retry_policy', cadence: '묶음마다(앞뒤 open_batch·close_batch), setup·teardown 1회' }),
    line(f, 'new:worker', 'new:sampler', '| worker | sampler', { payload: '측정 요청', cadence: '실행 1회마다' }),
    line(f, 'new:sampler', 'new:worker', '| sampler | worker', { payload: 'Sample', cadence: '실행 1회마다' }),
    line(f, 'new:worker', 'new:sweeper', '| worker | sweeper', { payload: 'Sample', cadence: '묶음마다' }),
    line(f, 'new:sweeper', 'new:reporter', '| sweeper | reporter', { payload: '결과', cadence: '끝에 1회' }),
    line(f, 'new:reporter', 'new:user', '| reporter | 사용자', { payload: '결과 표', cadence: '끝에 1회' }),
    line(f, 'new:sampler', 'new:worker', '| Sample |', { payload: 'Sample', payloadFields: sample }),
    line(f, 'new:sampler', 'new:sweeper', '| Sample |', { payload: 'Sample', payloadFields: sample }),
    line(f, 'new:reporter', 'new:user', '| 요약 JSON |', { payload: '요약 JSON' }),
    line(f, 'new:reporter', 'new:user', '| 요약 CSV |', { payload: '요약 CSV' })];
  const parts = names.map(([ref, name, head]) => part(f, ref, name, head));
  assert.deepEqual(productLines(wire(parts, relations), f.ask), { merges: [{ index: 7, into: 3 }, { index: 9, into: 6 }, { index: 10, into: 6 }], shortcuts: [{ index: 8, via: 'new:worker' }], candidates: [] });
  // Through the combine step: the kept wire, the reasons, and the final diagnostic.
  const blueprint = { parts: names.map(([ref, name, head]) => ({ ref, name, parent: null, focus: `${name}의 책임`, at: [f.at(head)] })), global: [] };
  const fragments = splitBlueprintParts(blueprint).map((group, index) => ({ ...wire([]), parts: group.parts.map((p, i) => ({ ...part(f, p.ref, p.name, names.find(n => n[0] === p.ref)[2]),
    claims: [claim(f, `s${fragmentKeys(index).keyStart + i}`, names.find(n => n[0] === p.ref)[2])] })) }));
  const global = wire([], relations, { summary: 'rowcheck는 CSV 행을 검사하는 작은 CLI로, entry → sweeper → reporter가 메모리 안에서 이어진다.', portMap: [] });
  const { wire: kept, exclusions } = combineRenderedReading(fragments, global, f.ask, blueprint);
  assert.equal(kept.relations.length, 7);
  assert.deepEqual([kept.relations[3].payload, kept.relations[3].payloadFields, kept.relations[6].payload], ['Sample', sample, '결과 표 · 요약 JSON · 요약 CSV']);
  assert.deepEqual(exclusions.filter(x => /^relations\[\d+\]$/.test(x.path)).map(x => `${x.path}:${x.category}`),
    ['relations[7]:product-merge', 'relations[9]:product-merge', 'relations[10]:product-merge', 'relations[8]:product-shortcut']);
  const plain = M.validateMapReply(kept, f.ask);
  assert.equal(M.setAside(plain).length, 0);
  const diagnostic = finalDiagnostics(fragments, global, f.ask, blueprint).find(x => x.rule === 'product-lines');
  assert.deepEqual(diagnostic.names, ['new:sampler → new:worker: Sample (합침 → new:sampler → new:worker)', 'new:reporter → new:user: 요약 JSON (합침 → new:reporter → new:user)',
    'new:reporter → new:user: 요약 CSV (합침 → new:reporter → new:user)', 'new:sampler → new:sweeper: Sample (지름길 · new:worker 거침)']);
  assert.ok(FINAL_DIAGNOSTICS.includes('product-lines'));
  assert.ok(!finalDiagnostics(fragments, global, f.ask, blueprint).some(x => x.rule === 'plan-relations' || x.rule === 'connections'));
  // A product line with no line between its ends and no recorded path stays; a control line between the same ends takes no data list.
  assert.deepEqual(productLines(wire(parts, [relations[8]]), f.ask), { merges: [], shortcuts: [], candidates: [] });
  const control = [{ ...relations[6], channel: 'control' }, relations[9]];
  assert.deepEqual(productLines(wire(parts, control), f.ask), { merges: [], shortcuts: [], candidates: [] });
  const P = await import('../server/map-pipeline.mjs');
  assert.ok(P.GLOBAL_RULES.includes('product-shortcut') && P.GLOBAL_RULES.includes('product-merge'));
  assert.ok(MAP_BLUEPRINT_PROMPT.includes('지름길'));
});

test('.42 (5) cells with parentheses and commas: a format row\'s field group past 60 is read by its name 「counters(…)」, a 메모리 row is never a store by a part\'s 하는 일 words, a step name runs to 60 and a cadence to 80', () => {
  const f = rec();
  const row = M.artifactRows(f.ask).find(r => r.name === 'Sample');
  assert.deepEqual([row.store, row.format, row.fields.length], [false, true, 4]);
  assert.equal(M.fieldGroupHead('counters(cycles·instructions·cache_hits·cache_misses·branch_misses·stalls)'), 'counters(…)');
  assert.equal(M.fieldGroupHead('wall_ms'), null);
  const parts = [part(f, 'new:sampler', 'sampler', '| sampler | 수집기'), part(f, 'new:worker', 'worker', '| worker | [모름]'), part(f, 'new:sweeper', 'sweeper', '| sweeper | 루프')];
  const group = 'counters(cycles·instructions·cache_hits·cache_misses·branch_misses·stalls)';
  assert.ok(group.length > 60);
  const lines = [line(f, 'new:sampler', 'new:worker', '| sampler | worker', { payload: 'Sample', cadence: '실행 1회마다', payloadFields: ['wall_ms', group, 'status'] }),
    line(f, 'new:sweeper', 'new:worker', '| sweeper | worker', { payload: '묶음·retry_policy', cadence: '묶음마다(앞뒤 open_batch·close_batch), setup·teardown 1회' }),
    line(f, 'new:worker', 'new:sweeper', '| worker | sweeper', { payload: 'Sample', cadence: '묶음마다', payloadFields: ['counters(…)', 'bogus(…)'] })];
  const read = M.validateMapReply(wire(parts, lines), f.ask, { setAside: true });
  assert.deepEqual(read.relations.map(r => r.payloadFields), [['wall_ms', 'counters(…)', 'status'], [], ['counters(…)']]);
  assert.deepEqual(categories(read), ['relations[2].payloadFields[1]:payload-fields']);
  assert.equal(read.relations[1].cadence.length > 40 && read.relations[1].cadence.length <= 80, true);
  assert.deepEqual(M.validateMapReply(wire(parts, lines.slice(0, 2)), f.ask).relations.map(r => r.payloadFields), [['wall_ms', 'counters(…)', 'status'], []], 'plain map.6 reads the group by its name too');
  const long = structuredClone(lines); long[1].cadence = 'x'.repeat(81);
  assert.deepEqual(categories(M.validateMapReply(wire(parts, long), f.ask, { setAside: true })), ['relations[1].cadence:cadence', 'relations[2].payloadFields[1]:payload-fields']);
  // A 3절 chain piece of 41–60 is a step; past 60 it is set aside alone.
  const piece = '실패면 retry_policy를 보고 measured_ms에서 base_ms를 빼 0 미만은 0으로';
  assert.ok(piece.length > 40 && piece.length <= 60);
  const worker = part(f, 'new:worker', 'worker', '| worker | [모름]', { steps: ['열기', '측정', '닫기', piece, 'x'.repeat(61)].map(name => ({ name, does: null, uses: [], at: f.at('| worker | 묶음·Sample') })) });
  const stepped = M.validateMapReply(wire([worker]), f.ask, { setAside: true });
  assert.deepEqual([stepped.parts[0].steps.map(s => s.name).at(-1), categories(stepped)], [piece, ['parts[0].steps[4]:step']]);
  // Stored as map-reading.17; a map-reading.16 entry keeps 40 for both.
  const applied = M.applyReading(f.project, f.input, M.validateMapReply(wire([worker, ...parts.slice(0, 1), parts[2]], lines.slice(1, 2)), f.ask, { setAside: true }), meta('R_oss42_bounds', 'b'));
  assert.deepEqual(validateProject(applied.project), applied.project);
  const old = JSON.parse(S.serializeProject(applied.project)); old.readings.at(-1).version = 'map-reading.16';
  assert.throws(() => validateProject(old));
  // The stage feedback names the new bounds (a group head is no length issue).
  const issues = mapStageIssues({ ...wire([], [{ ...lines[0], payloadFields: [group, 'y'.repeat(61)] }, { ...lines[1], cadence: 'z'.repeat(81) }]) }, null);
  assert.deepEqual(issues.filter(x => x.rule === 'length').map(x => [x.path, x.expected]), [['relations[0].payloadFields[1]', 60], ['relations[1].cadence', 80]]);
});

test('.42 (6) the sender check reads whose row it is: the receiver\'s own design or step row places its sender (a row naming it as a whole word too), an artifact row\'s 만드는 부분 places its maker; a third part\'s row still sets the line aside', () => {
  const f = rec();
  const parts = [part(f, 'new:codec', 'codec', '| codec | 외부', typed(f, 'external', '| codec | 외부')), part(f, 'new:verifier', 'verifier', '| verifier | 계산', typed(f, 'compute', '| verifier | 계산')),
    part(f, 'new:sampler', 'sampler', '| sampler | 수집기', typed(f, 'collector', '| sampler | 수집기')), part(f, 'new:reporter', 'reporter', '| reporter | 계산', typed(f, 'compute', '| reporter | 계산'))];
  const relations = [line(f, 'new:codec', 'new:verifier', '| verifier | 행 |', { payload: '문자 인코딩', channel: 'uses' }),
    line(f, 'new:sampler', 'new:verifier', '| verifier | 행 |', { payload: 'Sample' }),
    line(f, 'new:sampler', 'new:reporter', '| verifier | 행 |', { payload: 'Sample' }),
    line(f, 'new:reporter', 'new:sampler', '| reporter | 1 | ', { payload: '요약', channel: 'uses' })];
  const read = M.validateMapReply(wire(parts, relations), f.ask, { setAside: true });
  // The sender's own row (reporter's step row) stands as before.
  assert.deepEqual([read.relations.map(r => `${r.from}>${r.to}`), categories(read)], [['new:codec>new:verifier', 'new:sampler>new:verifier', 'new:reporter>new:sampler'], ['relations[2]:sender']]);
  // An artifact row named like a part: its 만드는 부분 cell is the sender (the .41 library map's settle → caller on the error row).
  const g = ofTexts([['1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| settle | 계산 | 결과 판정 |', '| Fault | 계산 | 오류 객체 |', '| 호출자 | 사람 | 결과를 받음 |',
    '2. 산출물', '| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 | 꼬리표 |', '|---|---|---|---|---|---|', '| Fault | code·message | settle·Fault | 호출자 | 메모리 | [파일: F] |'].join('\n')]);
  const gp = [part(g, 'new:settle', 'settle', '| settle |'), part(g, 'new:fault', 'Fault', '| Fault | 계산'), part(g, 'new:caller', '호출자', '| 호출자 |')];
  const back = M.validateMapReply(wire(gp, [line(g, 'new:settle', 'new:caller', '| Fault | code', { payload: 'Fault' }), line(g, 'new:caller', 'new:settle', '| Fault | code', { payload: 'Fault' })]), g.ask, { setAside: true });
  assert.deepEqual([back.relations.map(r => `${r.from}>${r.to}`), categories(back)], [['new:settle>new:caller'], ['relations[1]:sender']]);
  assert.equal(M.namesWord('모델 적재 → 인코더(사전 또는 codec) → 생성', 'codec'), true);
  assert.equal(M.namesWord('codecs와 사전', 'codec'), false);
  assert.equal(M.namesWord('codec이 바꾼다', 'codec'), true);
});

test('.42 (7) the summary runs to 360: a 300-character summary reads in every reading and is stored as map-reading.17; one past 360 is refused; the global prompt states the limit', async () => {
  const f = rec(), summary = `rowcheck는 CSV 행을 검사해 결과를 내는 작은 CLI로, entry → sweeper → reporter가 메모리 안에서 이어진다. ${'마지막 변경은 2026-10-30 검사 규칙 정리이고 다음 관문은 없다. '.repeat(8)}`.slice(0, 300);
  assert.equal(summary.length, 300);
  const parts = [part(f, 'new:entry', 'entry', '| entry | [모름]')];
  assert.equal(M.validateMapReply(wire(parts, [], { summary }), f.ask).summary, summary.trim());
  const read = M.validateMapReply(wire(parts, [], { summary }), f.ask, { setAside: true });
  assert.equal(read.summary, summary.trim());
  assert.equal(M.MAP_SUMMARY_MAX, 360);
  assert.throws(() => M.validateMapReply(wire(parts, [], { summary: '가'.repeat(361) }), f.ask));
  assert.throws(() => M.validateMapReply(wire(parts, [], { summary: '가'.repeat(361) }), f.ask, { setAside: true }));
  const applied = M.applyReading(f.project, f.input, read, meta('R_oss42_summary', 'c'));
  assert.deepEqual(validateProject(applied.project), applied.project);
  const old = JSON.parse(S.serializeProject(applied.project)); old.readings.at(-1).version = 'map-reading.16';
  assert.throws(() => validateProject(old), 'a map-reading.16 entry keeps 200');
  assert.deepEqual(mapStageIssues(wire([], [], { summary: '가'.repeat(361) }), null).filter(x => x.path === 'summary').map(x => [x.rule, x.expected, x.actual]), [['length', 360, 361]]);
  const P = await import('../server/map-pipeline.mjs');
  assert.ok(P.GLOBAL_RULES.includes('360자를 절대 넘기지 않는다'));
  assert.ok(!P.GLOBAL_RULES.includes('200자를 절대 넘기지 않는다'));
});

test('.42 (A, D, E, F) an escaped 「\\|」 stays in its cell; 24 steps and steps-cut naming the 3절 chain pieces no step carries; each step keeps its row\'s 조건·분기 cell; 「매 프레임」 is a loop unit', async () => {
  // A: a condition 「!res.status \|\| check(res)」 is one cell, read with 「||」; written either way it stands in its row.
  const g = ofTexts([['5. 조건·거부·분기', '| 부분 이름 | 조건 | 참이면 | 거짓이면 | 꼬리표 |', '|---|---|---|---|---|', '| client | !res.status \\|\\| check(res) | resolve | reject | [파일: C] |',
    '1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| client | 계산 | 요청 |'].join('\n')]);
  assert.deepEqual(M.conditionRows(g.ask).map(r => [r.part, r.condition, r.then, r.otherwise]), [['client', '!res.status || check(res)', 'resolve', 'reject']]);
  assert.deepEqual(M.tableCells('| a \\| b | c |'), ['a | b', 'c']);
  for (const when of ['!res.status || check(res)', '!res.status \\|\\| check(res)']) {
    const client = part(g, 'new:client', 'client', '| client | 계산', { conditions: [{ when, then: 'resolve', else: 'reject', at: g.at('| client | !res') }] });
    const read = M.validateMapReply(wire([client]), g.ask, { setAside: true });
    assert.deepEqual([read.parts[0].conditions.length, categories(read)], [1, []], when);
  }
  // D: 24 steps; steps-cut names the 3절 chain pieces no step of the part carries.
  assert.equal(M.PART_LIST_MAX.steps, 24);
  const f = rec(), { stepsCut } = await import('../server/map-blueprint.mjs');
  assert.deepEqual(stepsCut(f.ask, [{ ref: 'new:entry', name: 'entry', steps: [{ name: '인자 해석', at: f.at('| entry | 인자 |') }] }]).missing, ['entry: 3절 「행 문법 거부」', 'entry: 3절 「run_sweep」']);
  // E: each step keeps its own 4절 row's 조건·분기 cell (a dash keeps none); stored as map-reading.17.
  const parts = ruleParts(f, false), read = M.validateMapReply(wire(parts), f.ask, { setAside: true });
  assert.deepEqual(read.parts[2].steps.map(s => s.when ?? null), [null, 'warmup > 0일 때만', '오류면 중단', null, 'round > max_rounds → break']);
  const applied = M.applyReading(f.project, f.input, read, meta('R_oss42_when', 'd'));
  assert.deepEqual(applied.reading.parts.find(p => p.steps.length === 5).steps.map(s => s.when), [null, 'warmup > 0일 때만', '오류면 중단', null, 'round > max_rounds → break']);
  assert.deepEqual(validateProject(applied.project), applied.project);
  // F: a per-frame unit is a unit as written.
  const framed = structuredClone(parts); framed[2].loop = { unit: '매 프레임', stop: null, resume: null, at: f.at('| sweeper | 2 | ') };
  assert.equal(M.validateMapReply(wire(framed), f.ask, { setAside: true }).parts[2].loop.unit, '매 프레임');
  assert.ok(M.LOOP_UNIT.test('요청마다') && M.LOOP_UNIT.test('frame tick') && !M.LOOP_UNIT.test('없으면 다시 읽기'));
});

test('.42 (H, I, K, L, M) code names take no Hangul noun, a removal piece is no store port step, a line naming another artifact takes only its fields, a store keeps the file rows its cells or ends name, a 「/」 chain piece is one step', () => {
  // K: 「ir.DAG·Progress·CANCEL_REQUESTED·소켓 요청」 shares no 요청; 「review·policy·state 행」 still shares 행.
  assert.deepEqual(M.sharedItems('ir.Spec·RunUpdate·STOP_REQUESTED·소켓 요청'), ['ir.Spec', 'RunUpdate', 'STOP_REQUESTED', '소켓 요청']);
  assert.deepEqual(M.sharedItems('review·policy·state 행'), ['review 행', 'policy 행', 'state 행']);
  const gText = ['1. 부분 유형', '| 이름 | 유형 | 한 줄 |', '|---|---|---|', '| 보관소 | 행 파일·저장소 | 실행 디렉터리(state.jsonl 등) |', '| 기록함 | 행 파일·저장소 | 보고서 모음 |',
    '| 실행기 | 계산 | 실행 |', '| 화면 | 계산 | 보여 줌 |', '| 등록부 | 계산 | 신호 |',
    '2. 산출물', '| 이름 | 필드 | 만드는 부분 | 읽는 부분 | 있는 곳 | 꼬리표 |', '|---|---|---|---|---|---|',
    '| 실행 상태 | name·status | 실행기 | 화면 | runs/…/state.jsonl | [파일: R] |', '| 실행 표 | name·status | 실행기 | 화면 | 보관소 table/ | [파일: R] |',
    '| 보고 기록 | id·text | 실행기 | 기록함·화면 | data/reports.json | [파일: R] |',
    '| 신호 | a·b·c | 등록부 | 실행기·화면 | 메모리 | [파일: G] |', '| 설정 | k·v | 등록부 | 실행기 | 메모리 | [파일: G] |',
    '3. 부분별 설계', '| 이름 | 받는 산출물 | 안의 단계 | 내는 산출물 | 설정 | 꼬리표 |', '|---|---|---|---|---|---|',
    '| 실행기 | 신호 | 준비 → 옛 .backup 삭제 후 교체 | 실행 표 | — | [파일: R] |', '| 화면 | 실행 상태 | 요청→Get/Start/Stop | — | — | [파일: V] |'].join('\n'), g = ofTexts([gText]);
  // I: the store named in a reader cell holds the report file (a plan store on it folds there); M: a store whose own cell names
  // state.jsonl holds nothing by that (the plan makes the file's store its child: folding would set its lines aside).
  assert.deepEqual([[...M.heldPlaces(g.ask, '보관소')].includes('state.jsonl'), [...M.heldPlaces(g.ask, '기록함')]], [false, ['reports.json']]);
  assert.ok(MAP_BLUEPRINT_PROMPT.includes('그 산출물로 세운 저장소 부분의 parent는 그 저장소이고'));
  // H: a line naming another artifact row carries that row's fields only; by its ends alone a line takes the rows its ends make and read.
  assert.deepEqual(M.formatRows(g.ask, '등록부', '실행기', '설정').map(r => r.name), ['설정']);
  assert.deepEqual(M.formatRows(g.ask, '등록부', '실행기', '준비 알림').map(r => r.name), ['신호', '설정']);
  // H: 「옛 .backup 삭제 후 교체」 is no write step of the store the chain's row makes (a bare last piece still is).
  const chained = last => { const h = ofTexts([gText.replace('준비 → 옛 .backup 삭제 후 교체', `준비 → ${last}`)]);
    const ps = [part(h, 'new:runner', '실행기', '| 실행기 | 계산', { steps: [{ name: '준비', does: null, uses: [], at: h.at('| 실행기 | 신호') }] }),
      part(h, 'new:vault', '보관소', '| 보관소 |', { type: 'store', typeAt: h.at('| 보관소 |'), outputs: ['실행 표'] })];
    return M.portSides(h.ask, ps, [line(h, 'new:runner', 'new:vault', '| 실행 표 |', { payload: '실행 표' })], ref => ps.find(p => p.ref === ref)?.name ?? '').find(s => s.direction === 'out')?.chain; };
  assert.deepEqual([chained('옛 .backup 삭제 후 교체'), chained('render')], [[], ['render']]);
  // L: a 3절 piece listing alternatives with 「/」 is one step (its name within 60).
  const screen = part(g, 'new:screen', '화면', '| 화면 | 계산', { steps: [{ name: '요청', does: null, uses: [], at: g.at('| 화면 | 실행') }, { name: 'Get/Start/Stop', does: null, uses: [], at: g.at('| 화면 | 실행') }] });
  const read = M.validateMapReply(wire([screen]), g.ask, { setAside: true });
  assert.deepEqual([read.parts[0].steps.map(s => s.name), categories(read)], [['요청', 'Get/Start/Stop'], []]);
  assert.ok(MAP_BLUEPRINT_PROMPT.includes('그 산출물은 그 저장소에 접힌다'));
});

test('.42 prompts: recipe .42, the decider rule, named loops, the summary\'s structural first sentence, product lines, field groups and the new bounds', async () => {
  const P = await import('../server/map-pipeline.mjs');
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.48', 'later-map-divided.48']);
  for (const rule of ['「누가 정했나」 칸의 사람은 그 규칙을 정한 사람이지 지키는 장치가 아니다', 'decider', '[파일: X] 꼬리표가 가리키는', '{"kind":"person","text":"그 누가 정했나 칸 그대로(80자 이내)","at":"그 규칙 행"}',
    '단계 이름이나 하는 일이 스스로 반복을 말하면', '빠져나가는 조건', '단계 이름(60자 이내)', '조각 그대로(60자 이내)'])
    assert.ok(P.RENDER_RULES.includes(rule), rule);
  for (const rule of ['한 줄 요약(구조)', '화살표째', '추정', 'cadence는 그 박자·시각(80자 이내', '「name(…)」', 'product-merge', 'product-shortcut']) assert.ok(P.GLOBAL_RULES.includes(rule), rule);
});
