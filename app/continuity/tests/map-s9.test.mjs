// Display slice S9 (viewing notes on the hyperfine and pocketbase .44 v4 maps, 2026-11-05), its pure parts: the 구조 tab reads like an
// explanation for a newcomer — the record's own terms said in plain Korean (an unknown still on screen, never hidden), the loop's
// fields in one line with one mark for what the program filled, the loop table nested, a variant by what it is and when it is
// chosen, the evidence numbered in the new reading order (no first-screen chain), and a group with no steps entered on a
// double-click instead of opened as an empty expansion. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { ladderWords, plainBlank, plainScope, anchorPlain, enforcePlain, designProgramLine, unplacedPlain, loopLinePlain, loopTree, showLoopRows, loopRowPlain,
  variantPlain, portModeWord, conditionPlain, READING_GUIDE, PLAIN_UNSAID, PLAIN_PROGRAM, PLAIN_PROGRAM_FIELD, PLAIN_KEPT, noPortsPlain } from '../dist/public/client/pane-plain.js';
import { UNLINKED_HEAD } from '../dist/public/client/pane-view.js';
import { RULE_BLANKS, RULE_DESIGN_PROGRAM, GATE_BLANK, ruleView, ruleSaid } from '../dist/public/client/signs-view.js';
import { evidenceItems, STRUCTURE_ORDER, STRUCTURE_TITLE } from '../dist/public/client/pane-view.js';
import { opensInto } from '../dist/public/client/expansion.js';

// The words the viewing notes called out as debug-dump jargon.
const JARGON = /미해결|배치 미정|설계 대응|프로그램 대응|항목 근거 미연결|추출값|했다는 보고|확인 전|미상|미기재|미확인|미정/;

test('S9-2 the head line says how far the records go in plain words, never 「했다는 보고가 있음 · 아직 확인 전」', () => {
  const all = [];
  for (const ask of [false, true]) for (const report of [false, true]) for (const check of [false, true]) all.push(ladderWords({ ask, report, check }));
  assert.equal(new Set(all.slice(0, 6)).size >= 5, true, 'each state its own words');
  for (const w of all) assert.doesNotMatch(w, JARGON, w);
  assert.equal(ladderWords({ ask: false, report: true, check: false }), '결과 보고만 있음 · 확인 자료는 아직 없음', 'a report without a check still says no check (the unknown stays)');
  assert.match(ladderWords({ ask: false, report: false, check: false }), /아직 없음/);
});

test('S9-2 a rule\'s blanks in plain words: every RULE_BLANKS value has its sentence, other words pass through as written', () => {
  for (const v of Object.values(RULE_BLANKS)) { const p = plainBlank(v); assert.notEqual(p, v, v); assert.doesNotMatch(p, JARGON, p); assert.match(p, /기록|지도/, 'it still says what is missing'); }
  assert.equal(plainBlank(RULE_BLANKS.anchors), '어느 단계·입출력에 해당하는지 기록에 없음');
  assert.equal(plainBlank('단계 미상'), '어느 단계인지 기록에 없음');
  assert.equal(plainBlank('시각 미기재'), '작성 시각 기록에 없음');
  assert.doesNotMatch(plainBlank(GATE_BLANK), JARGON);
  assert.equal(plainBlank('B/executor.rs'), 'B/executor.rs', 'a value the record wrote is never rewritten');
  assert.equal(plainBlank('미상'), PLAIN_UNSAID);
});

test('S9-2 a rule\'s reach, place and keeper read plainly; the record\'s term stays only in the tip', () => {
  assert.equal(plainScope('범위 · 부분 전체'), '이 부분 전체에 적용');
  assert.equal(plainScope('범위 · 프로젝트 전체'), '프로젝트 전체에 적용');
  assert.equal(plainScope('범위 · 단계 ‘판정’'), '단계 ‘판정’에 적용');
  assert.equal(plainScope(`범위 · 포트 ‘x’ · ${RULE_BLANKS.nowhere}`), '포트 ‘x’에 적용 · 이 지도에 그 자리가 없음', 'a scope found nowhere keeps saying so');
  assert.equal(plainScope(RULE_BLANKS.scope), '어디까지 적용되는지 기록에 없음');
  assert.equal(plainScope('범위 · ‘Executor’ 전체 · 세부 접점 미정'), '‘Executor’ 전체에 적용 · 정확한 단계는 기록에 없음', 'an earlier reading\'s part-wide line');
  assert.deepEqual(['명시', '해석', '프로그램', '기타'].map(anchorPlain), ['기록에 적힘', '다른 줄에서 이어 읽음', PLAIN_PROGRAM, '기타']);
  assert.equal(enforcePlain('code', '코드 · run_intermediate_command_and_measure'), '코드 run_intermediate_command_and_measure');
  assert.equal(enforcePlain('gate', '관문 · 검사'), '관문 검사');
  assert.equal(enforcePlain('none', '기록상 미설계'), '지키는 장치가 없다고 기록됨');
  assert.equal(enforcePlain('unknown', '장치 미상'), '무엇이 지키는지 기록에 없음');
});

test('S9-2 「설계 대응 · 프로그램 대응」 is said once: not at all when a 지키는 것 line already carries the program\'s mark', () => {
  // hyperfine .44 v4 Executor: 훅 실패는 -i와 무관하게 오류다 — a program code device and a gate.
  const rule = { scope: 'part', scopeName: null, anchors: [], enforcedBy: [
    { kind: 'code', text: 'run_intermediate_command_and_measure', quote: { record: 'R', quote: 'q' }, program: true },
    { kind: 'gate', text: 'run_intermediate_command_and_measure', quote: { record: 'R', quote: 'q2' } }] };
  const v = ruleView(rule, { steps: [], inputs: [], outputs: [], fields: [] }, 'Executor');
  assert.equal(v.designProgram, RULE_DESIGN_PROGRAM);
  assert.equal(designProgramLine(v.designProgram, v.enforce), null, 'the 지키는 것 line already says it');
  assert.equal(designProgramLine(RULE_DESIGN_PROGRAM, [{ program: false }]), '지키는 코드는 앱이 조건 표에서 이어 붙임');
  assert.equal(designProgramLine(null, []), null);
  assert.equal(plainBlank(v.anchorsBlank), '어느 단계·입출력에 해당하는지 기록에 없음', 'the unknown place is still said');
  assert.equal(plainBlank(ruleSaid({ text: 't', record: 'R', quote: '[파일] q', about: null, kind: 'reported' }).when), '작성 시각 기록에 없음');
  assert.equal(unplacedPlain(1, 1), null, 'one rule\'s own row already says it');
  assert.equal(unplacedPlain(2, 3), '2개는 어느 단계에 붙는지 기록에 없음');
  assert.equal(unplacedPlain(0, 3), null);
});

// The line as 구조 draws it (app.ts loopFieldNodes): each field, then 「표에서」 right after it when the program filled that field.
const drawn = segs => segs.map(x => `${x.text}${x.program ? ` 「${PLAIN_PROGRAM_FIELD}」` : ''}`).join(' · ');

test('S9 B1 the loop\'s fields in one line, a 「표에서」 mark right after each field the program filled, never after another field', () => {
  // hyperfine .44 v4 Executor: the unit and the stop carried over by the program, the resume not.
  const loop = { unit: '빈 명령 1회', stop: '끝 또는 측정 실패 bail', resume: null, program: true };
  const l = loopLinePlain(loop, [], []);
  assert.equal(l.text, '단위 빈 명령 1회 · 멈춤 끝 또는 측정 실패 bail · 다시 시작 기록에 없음');
  assert.deepEqual(l.segs.map(x => [x.key, x.program]), [['unit', true], ['stop', true], ['resume', false]], 'a mark per filled field');
  assert.equal(drawn(l.segs), `단위 빈 명령 1회 「${PLAIN_PROGRAM_FIELD}」 · 멈춤 끝 또는 측정 실패 bail 「${PLAIN_PROGRAM_FIELD}」 · 다시 시작 기록에 없음`);
  assert.doesNotMatch(drawn(l.segs), new RegExp(`다시 시작 기록에 없음 「`), 'no mark after the field the program did not fill (the review\'s B1)');
  assert.deepEqual(l.program, ['단위', '멈춤']);
  assert.doesNotMatch(l.text, /프로그램|미상/);
  const own = loopLinePlain({ unit: '행마다', stop: null, resume: null }, [], []);
  assert.deepEqual(own.program, [], 'the model\'s loop carries no mark');
  assert.equal(own.segs.some(x => x.program), false);
  assert.equal(own.text, '단위 행마다 · 멈춤 기록에 없음 · 다시 시작 기록에 없음', 'an unsaid field is still on the line');
  const told = loopLinePlain({ unit: 'cadence 5s', stop: 'STALE', resume: null, program: true }, ['cadence 5s'], [{ then: 'x', else: null }]);
  assert.deepEqual(told.segs.map(x => x.program), [true, false, false], 'only the field the program can be told to have filled');
  // The picked step's 「실패·재개」 line: the stop the program filled keeps its own mark (it was plain text in S9).
  const fail = loopLinePlain(loop, [], [], { only: ['stop', 'resume'] });
  assert.equal(drawn(fail.segs), `멈춤 끝 또는 측정 실패 bail 「${PLAIN_PROGRAM_FIELD}」 · 다시 시작 기록에 없음`);
  assert.match(READING_GUIDE.map(x => x.term).join(' '), new RegExp(PLAIN_PROGRAM_FIELD), '「읽는 법」 says what the small mark means');
});

test('S9 N3 with the loop table under it, the loop line leaves out a unit or a stop a table row already says (the resume stays)', () => {
  // hyperfine .44 v4 Benchmark: 「단위 워밍업 1회 · 멈춤 끝 또는 ? 오류」 above 「워밍업 1회 · … · 멈춤 끝 또는 ? 오류」.
  const loop = { unit: '워밍업 1회', stop: '끝 또는 ? 오류', resume: null, program: true };
  const rows = [{ unit: '워밍업 1회', stop: '끝 또는 ? 오류' }, { unit: '측정 1회', stop: '끝 또는 ? 오류' }];
  const l = loopLinePlain(loop, [], [], { shown: rows });
  assert.equal(l.text, '다시 시작 기록에 없음');
  assert.deepEqual(l.segs.map(x => x.key), ['resume']);
  const other = loopLinePlain({ unit: '명령마다', stop: '끝 또는 ? 오류', resume: '다음 명령', program: false }, [], [], { shown: rows });
  assert.equal(other.text, '단위 명령마다 · 다시 시작 다음 명령', 'a unit no row says stays on the line');
  assert.equal(loopLinePlain(loop, [], [], { shown: [] }).segs.length, 3, 'no table shown: every field');
});

test('S9 B3 받는 것 · 내는 것 with no inputs/outputs item: never 「이름은 기록에 없음」 over rows that name them', () => {
  assert.equal(noPortsPlain(true), '이 부분이 받는 것·내는 것을 항목으로 적은 기록은 없음 · 아래는 선에서 읽은 것');
  assert.equal(noPortsPlain(false), '받는 것·내는 것을 적은 기록 없음');
  for (const w of [noPortsPlain(true), noPortsPlain(false)]) { assert.doesNotMatch(w, /이름은 기록에 없음/); assert.doesNotMatch(w, JARGON); }
});

test('S9 B2 the variant rows and the loop table rows are cited like every other row: numbered in 구조\'s order, filed under 동작 and 안쪽 · 연결', () => {
  const q = (t, from) => ({ record: 'R1', quote: t, from, to: from + t.length });
  // hyperfine .44 v4 Executor / Benchmark: X01–X03, B11:L01–L02 (the second row listed first, read after the first by the tree).
  const book = evidenceItems({ roleBasis: [q('설명', 0)], type: null, state: null,
    relations: [{ id: 'i1', label: 'i1', quote: q('선 i1', 30), dir: 'in' }, { id: 'w', label: 'w', quote: q('선 w', 60), dir: 'with' }],
    loop: { quote: q('반복', 90) }, steps: [{ name: 'a', quote: q('단계 a', 100) }], conditions: [], portMap: [], fileRoles: [{ path: 'a.rs', quote: q('파일', 220) }],
    recordLoops: [{ index: 1, ref: 'B11:L01', label: '반복 표 · 워밍업 1회', quote: q('| B11:L01 |', 92) }, { index: 0, ref: 'B11:L02', label: '반복 표 · 측정 1회', quote: q('| B11:L02 |', 95) }],
    variants: [{ ref: 'X01', label: '변형 · RawExecutor', quote: q('| X01 |', 400) }, { ref: 'X02', label: '변형 · ShellExecutor', quote: q('| X02 |', 410) }],
    claims: [], rules: [], chain: { ports: 0, steps: 0 } });
  const by = k => book.thing.get(k)?.n ?? null;
  assert.deepEqual(['role:0', 'relation:i1', 'loop', 'recordLoop:1', 'recordLoop:0', 'step:0', 'relation:w', 'variant:0', 'variant:1', 'file:a.rs'].map(by), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(book.groups.map(g => [g.section, g.items.map(x => x.n)]), [['role', [1]], ['contract', [2]], ['behaviour', [3, 4, 5, 6]], ['links', [7, 8, 9]], ['where', [10]]],
    'they read in 근거 under the sections 구조 shows them in');
  assert.deepEqual(['recordLoop:1', 'variant:0'].map(k => [book.thing.get(k).kind, book.thing.get(k).uses[0].ref]), [['recordLoop', 'recordLoop:B11:L01'], ['variant', 'variant:X01']], 'the note key is the record\'s row ID');
  const same = evidenceItems({ roleBasis: [], type: null, state: null, relations: [], loop: { quote: q('| B11:L01 |', 92) }, steps: [], conditions: [], portMap: [], fileRoles: [],
    recordLoops: [{ ref: 'B11:L01', label: '반복 표 · 워밍업 1회', quote: q('| B11:L01 |', 92) }], claims: [], rules: [], chain: { ports: 0, steps: 0 } });
  assert.equal(same.items.length, 1, 'the loop and its own table row quoting the same span are one item');
  assert.equal(same.thing.get('recordLoop:0').n, 1);
});

test('S9-5 the record\'s loop table nests every C-LOOP row under the loop it runs in; an outer loop of another part is named', () => {
  const L = (recordRef, parentRef = null, parentPart = null, unit = 'u') => ({ recordRef, parentRef, parentPart, unit, count: null, stop: null, body: [], quote: { record: 'R', quote: recordRef } });
  // hyperfine .44 v4 Benchmark: two loops, each inside Scheduler's.
  const bench = loopTree([L('B11:L01', 'B10:L01', 'Scheduler', '워밍업 1회'), L('B11:L02', 'B10:L01', 'Scheduler', '측정 1회')]);
  assert.deepEqual(bench.map(x => [x.loop.recordRef, x.depth, x.outer]), [['B11:L01', 0, 'Scheduler'], ['B11:L02', 0, 'Scheduler']]);
  assert.equal(loopRowPlain(bench[0].loop, bench[0].outer), '워밍업 1회 · Scheduler의 반복 안에서');
  const tree = loopTree([L('c', 'b'), L('a'), L('b', 'a'), L('d', 'a')]);
  assert.deepEqual(tree.map(x => [x.loop.recordRef, x.depth]), [['a', 0], ['b', 1], ['c', 2], ['d', 1]], 'each row after the row it runs in');
  const cyc = loopTree([L('x', 'y'), L('y', 'x')]);
  assert.equal(cyc.length, 2, 'a cycle of parents places each row once');
  assert.equal(showLoopRows(2, true), true); assert.equal(showLoopRows(1, true), false, 'one row beside the loop line repeats it'); assert.equal(showLoopRows(1, false), true); assert.equal(showLoopRows(0, false), false);
  assert.equal(loopRowPlain({ recordRef: 'L', parentRef: null, parentPart: null, unit: null, count: '3번', stop: '실패' }, null), `단위 ${PLAIN_UNSAID} · 3번 · 멈춤 실패`);
});

test('S9-5 a variant reads by its implementation, when it is chosen and whether it goes beside the others', () => {
  // hyperfine .44 v4 Executor: Raw / Shell / Mock.
  const v = variantPlain({ implementer: 'RawExecutor', condition: '--shell 없음·-N·--shell=none', together: 'exclusive', togetherScope: '실행 전체', selector: { who: '사용자 설정' } });
  assert.deepEqual(v, { name: 'RawExecutor', when: '--shell 없음·-N·--shell=none일 때', note: '한 번에 하나만 (실행 전체) · 고르는 쪽 사용자 설정' });
  const u = variantPlain({ implementer: 'user', condition: null, together: 'unknown', togetherScope: null, selector: { who: null } });
  assert.equal(u.name, '사용자 지정 구현'); assert.equal(u.when, `고르는 조건 ${PLAIN_UNSAID}`, 'an unsaid condition is said'); assert.equal(u.note, '함께 쓸 수 있는지 기록에 없음');
});

test('S9-2 a line\'s row does not end in 「· 설계」; a line seen running says so; a condition row drops the 「조건 」 its section says', () => {
  assert.equal(portModeWord('design'), null); assert.equal(portModeWord(null), null); assert.equal(portModeWord('observed'), '실행에서 봄');
  assert.equal(conditionPlain('조건 !codes.contains(&exit_code) → 실패 · 아니면 → 무시'), '!codes.contains(&exit_code) → 실패 · 아니면 → 무시');
  assert.equal(conditionPlain('x → y'), 'x → y');
});

test('S9-2 「읽는 법」 explains the few words the pane still uses, each in a sentence', () => {
  const terms = READING_GUIDE.map(x => x.term).join(' ');
  for (const t of [PLAIN_PROGRAM, PLAIN_UNSAID, '목록으로만 적힌 값']) assert.match(terms, new RegExp(t));
  for (const x of READING_GUIDE) { assert.ok(x.text.length > 10); assert.doesNotMatch(x.text, /미해결|배치 미정|추출값/); }
});

test('S9-3 구조 has no first-screen chain: with chain {0, 0} the numbers follow the new order (head, 하는 일, 확인 필요, 받는 것, 내는 것, 동작, 조건, 규칙, 연결, 어디에)', () => {
  const q = (t, from) => ({ record: 'R1', quote: t, from, to: from + t.length });
  const C = (x) => ({ kind: 'reported', text: '', record: 'R1', quote: 'q', about: null, topic: null, evidence: null, when: null, where: null, before: null, ...x });
  const rule = C({ text: '상한', topic: 'rule', quote: '[보고] 상한', from: 300, to: 308 }), unknown = C({ text: '재개 미상', topic: 'unknown', quote: '[모름] 재개', from: 310, to: 317 });
  const steps = ['a', 'b', 'c', 'd', 'e', 'f'].map((name, i) => ({ name, quote: q(`단계 ${name}`, 100 + i * 10) }));
  const book = evidenceItems({ roleBasis: [q('설명', 0)], type: null, state: null,
    relations: [{ id: 'i1', label: 'i1', quote: q('선 i1', 30), dir: 'in' }, { id: 'i2', label: 'i2', quote: q('선 i2', 40), dir: 'in' }, { id: 'o1', label: 'o1', quote: q('선 o1', 50), dir: 'out' }, { id: 'w', label: 'w', quote: q('선 w', 60), dir: 'with' }],
    loop: { quote: q('반복', 90) }, steps, conditions: [{ when: 'X', quote: q('조건', 200) }], portMap: [], fileRoles: [{ path: 'a.rs', quote: q('파일', 220) }],
    claims: [rule, unknown], rules: [rule], chain: { ports: 0, steps: 0 } });
  const by = k => book.thing.get(k)?.n ?? null;
  assert.deepEqual(['role:0', 'claim:1', 'relation:i1', 'relation:i2', 'relation:o1', 'loop', 'step:0', 'step:5', 'condition:0', 'claim:0', 'relation:w', 'file:a.rs'].map(by),
    [1, 2, 3, 4, 5, 6, 7, 12, 13, 14, 15, 16]);
  assert.deepEqual(book.items.map(x => x.n), book.items.map((_, i) => i + 1));
  assert.deepEqual(STRUCTURE_ORDER.slice(2, 5).map(k => STRUCTURE_TITLE[k]), ['받는 것 · 내는 것', '동작', '조건']);
});

test('S9-4 a group with parts inside and no steps of its own is entered on a double-click; a part with steps opens as before', () => {
  // hyperfine .44 v4 top level: 「hyperfine 프로세스 · 실행 위치 · 부분 14」 has no steps: its expansion held only its name and 「운영 기록 없음」.
  assert.equal(opensInto(14, 0), true);
  assert.equal(opensInto(2, 8), false, 'Executor (two parts inside, eight steps) opens its steps');
  assert.equal(opensInto(0, 0), false, 'a leaf part opens as before');
  assert.equal(opensInto(0, 3), false);
});

test('S9 N2 구조 and 근거 call the same groups by the same names (the 「근거 탭에서 ›」 button lands on a group with its name)', async () => {
  assert.equal(UNLINKED_HEAD, '목록으로만 적힌 값'); assert.equal(PLAIN_KEPT, '기억하는 값');
  assert.ok(READING_GUIDE.some(x => x.term === UNLINKED_HEAD));
  const app = await readFile(new URL('../dist/public/client/app.js', import.meta.url), 'utf8');
  const body = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(j, k + 1); } return ''; };
  const ev = body('unlinkedEvidence'), st = body('unlinkedSection');
  assert.match(ev, /UNLINKED_HEAD/, '근거\'s group head is 구조\'s name'); assert.doesNotMatch(ev, /'항목 근거 미연결'|'유지 상태'/);
  assert.match(ev, /PLAIN_KEPT/); assert.match(st, /PLAIN_KEPT/);
  // B2: the variant rows and the loop table rows carry their own marks; N1: the kind word's dot is never followed by a 「·」.
  assert.match(body('linksSection'), /fnMarks\(c, \[`variant:\$\{i\}`\]/);
  assert.match(body('behaviourSection'), /fnMarks\(c, \[`recordLoop:\$\{i\}`\]/);
  assert.doesNotMatch(body('contractSection'), /이름은 기록에 없음/);
  const kl = body('kindLine');
  assert.match(kl, /kind && !typeMark \? sep\(\)/);
  // Polish round fixes 2: the head's kind line carries no record bookkeeping (the 요청 · 보고 · 확인 ladder reads in 근거).
  assert.match(kl, /return kind \? h\('p', \{ class: 'lens-ladder lens-kind-line' \}, kind, typeMark\) : null;/); assert.ok(!kl.includes('ladderLine('));
  assert.match(body('evidenceTab'), /out\.push\(ladderLine\(o\.view, part\)\)/);
});
