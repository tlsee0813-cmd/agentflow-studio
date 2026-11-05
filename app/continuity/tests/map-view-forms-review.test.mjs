// Spec forms v1, review fixes: v5 nested loops (an outer loop's body holds its inner loops' bodies), C-STEP rows the program kept as
// stations, rows the stored steps skip said on the segment, an alternative's condition from its when only, start marks on whole
// names, and the detail view's and styles' fixes (row-ID matching, port lines in the line's strip, a pending condition's form, the
// map's selected and impact marks, dark loop tokens).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  lineOffer, stepLine, lineBoxes, overlaps, stateGraph, formStep, formLoop, onLine,
  LINE_TARGET, COND_TAG, APART_OUT, ALT_NO_COND, UNSTORED, skipWord
} from '../dist/public/client/view-forms.js';

// A cell given without its clauses is read as the record reading reads it: 「when → to/outcome」, or the whole clause as the outcome.
const clauses = cell => cell.split(/\s*;\s*/).filter(Boolean).map(c => { const a = c.search(/→|->/), when = a > 0 ? c.slice(0, a).trim() : null, after = a >= 0 ? c.slice(a).replace(/^(?:→|->)\s*/, '') : c;
  const to = [...after.matchAll(/(?:(B\d{1,3})\s*:\s*)?S(\d{1,3}[a-z]?)/g)].map(m => `${m[1] ?? 'B03'}:S${m[2]}`), outcome = after.replace(/(?:B\d{1,3}\s*:\s*)?S\d{1,3}[a-z]?/g, ' ').trim();
  return { when, to, max: null, outcome: outcome || null }; });
const step = (ref, name, extra = {}) => formStep({ recordRef: ref, name, does: extra.does ?? null, program: extra.program, alt: extra.alt ?? null, branch: extra.branch ?? (extra.cell ? clauses(extra.cell) : []), loopIds: extra.loopIds ?? [], when: extra.cell ?? null });
const loop = (ref, body, extra = {}) => formLoop({ recordRef: ref, parentRef: extra.parentRef ?? null, unit: extra.unit ?? null, count: extra.count ?? null, stop: extra.stop ?? null, body, bodyState: extra.bodyState ?? 'linked' });
const noOverlap = l => { const bs = lineBoxes(l); for (let i = 0; i < bs.length; i++) for (let k = i + 1; k < bs.length; k++) assert.ok(!overlaps(bs[i], bs[k]), `${bs[i].what} overlaps ${bs[k].what}`); };

test('FORM-18 v5 nested loops: an outer loop\'s body holds its inner loops\' bodies (a step names only its innermost loop); depth by nesting; never 몸통 미기록 while a child has a body', () => {
  // The outer loop has no step of its own; the inner one (parentRef the outer) runs over S02-S03.
  const a = [step('B03:S01', '준비'), step('B03:S02', '배치 읽기', { loopIds: ['B03:L02'] }), step('B03:S03', '갱신', { loopIds: ['B03:L02'] }), step('B03:S04', '저장')];
  const la = stepLine(a, [loop('B03:L01', [], { unit: '에폭', bodyState: 'unexpanded' }), loop('B03:L02', ['B03:S02', 'B03:S03'], { parentRef: 'B03:L01', unit: '배치' })], []);
  assert.equal(la.loopsApart.length, 0, 'the outer loop is not listed as 몸통 미기록');
  assert.deepEqual(la.brackets.map(b => b.ref).sort(), ['B03:L01', 'B03:L02']);
  const ao = la.brackets.find(b => b.ref === 'B03:L01'), ai = la.brackets.find(b => b.ref === 'B03:L02');
  assert.ok(ao.depth > ai.depth && ao.x < ai.x); assert.match(ao.tip, /안쪽 반복 B03:L02의 몸통 포함/);
  // The outer loop has its own step S04 after the inner loop's S02-S03: one bracket over S02-S04, the inner inside it.
  const b = [step('B03:S01', '준비'), step('B03:S02', '배치 읽기', { loopIds: ['B03:L02'] }), step('B03:S03', '갱신', { loopIds: ['B03:L02'] }), step('B03:S04', '평가', { loopIds: ['B03:L01'] }), step('B03:S05', '저장')];
  const lb = stepLine(b, [loop('B03:L01', ['B03:S04'], { unit: '에폭' }), loop('B03:L02', ['B03:S02', 'B03:S03'], { parentRef: 'B03:L01', unit: '배치' })], []);
  const bo = lb.brackets.find(x => x.ref === 'B03:L01'), bi = lb.brackets.find(x => x.ref === 'B03:L02');
  assert.ok(bo && bi); assert.ok(bo.depth > bi.depth && bo.x < bi.x);
  assert.ok(bo.y1 < bi.y1 && bo.y2 > bi.y2, 'the outer bracket covers the inner loop and S04');
  assert.match(bo.tip, /몸통 B03:S02, B03:S03, B03:S04/);
  // An inner loop with a body step on another part makes the outer one apart too (its whole body is not on this line).
  const lc = stepLine(b, [loop('B03:L01', ['B03:S04']), loop('B03:L02', ['B03:S02', 'B03:S03'], { parentRef: 'B03:L01' })], [], { elsewhere: [{ ref: 'B11:S01', loopIds: ['B03:L02'] }], ownerNames: { B11: '결제' } });
  assert.deepEqual(lc.brackets, []); assert.equal(lc.loopsApart.length, 2); assert.ok(lc.loopsApart.every(x => x.why === APART_OUT));
  noOverlap(la); noOverlap(lb);
});

test('FORM-19 C-STEP rows: a program step with a row ID is a station (the program\'s); rows the stored steps skip are said on the segment, never 「다음 행」; a branch into a skipped row is an exit', () => {
  // The cut kept S02 as the program's step (the reply left it out): still a C-STEP row in L01's body.
  const st = [step('B03:S01', '준비'), step('B03:S02', '항목 읽기', { program: true, loopIds: ['B03:L01'] }), step('B03:S03', '항목 검사', { loopIds: ['B03:L01'] }), step('B03:S04', '항목 저장', { loopIds: ['B03:L01'] }), step('B03:S05', '마무리')];
  assert.ok(onLine(st[1])); assert.ok(!onLine(step(null, '흐름 조각', { program: true })));
  const l = stepLine(st, [loop('B03:L01', ['B03:S02', 'B03:S03', 'B03:S04'])], []);
  assert.deepEqual(l.stations.map(s => s.ref), ['B03:S01', 'B03:S02', 'B03:S03', 'B03:S04', 'B03:S05']);
  assert.deepEqual(l.stations.map(s => s.program), [false, true, false, false, false]);
  assert.equal(l.brackets.length, 1); assert.equal(l.program, 0); assert.equal(l.skipped, 0);
  // Two recorded steps and one C-STEP program row are three stations.
  assert.equal(lineOffer([step('B03:S01', 'a'), step('B03:S02', 'b', { program: true }), step('B03:S03', 'c')]).ok, true);
  // Rows skipped (S02-S04, S06-S08 not stored): the segment says how many and is marked, its tip never 「다음 행」.
  const gap = stepLine([step('B03:S01', 'a'), step('B03:S05', 'b'), step('B03:S09', 'c'), step('B03:S10', 'd')], [], []);
  assert.equal(gap.skipped, 6);
  const segs = gap.segments.filter(s => !s.tail);
  assert.deepEqual(segs.map(s => s.skip ?? 0), [3, 3, 0]);
  assert.ok(!/다음 행/.test(segs[0].tip) && /3개는 저장된 단계에 없음/.test(segs[0].tip)); assert.match(segs[2].tip, /B03:S09 다음 행/);
  assert.deepEqual(gap.tags.map(t => t.text).filter(t => t.includes(skipWord(3))), [skipWord(3), skipWord(3)]);
  assert.match(gap.segments.find(s => s.tail).tip, /^저장된 마지막 행/);
  // A conditional segment over skipped rows says both in its one tag.
  const both = stepLine([step('B03:S01', 'a', { cell: '값이 있을 때' }), step('B03:S03', 'b'), step('B03:S04', 'c')], [], []);
  assert.ok(both.tags.some(t => t.text === `${COND_TAG} · ${skipWord(1)}`));
  // A branch into a skipped row: offered (the row is in the record), drawn as an exit, never an arc and never a refusal.
  const jump = [step('B03:S01', 'a', { branch: [{ when: '실패', to: ['B03:S03'], max: null, outcome: null }] }), step('B03:S02', 'b'), step('B03:S05', 'c'), step('B03:S06', 'd')];
  assert.equal(lineOffer(jump).ok, true);
  const lj = stepLine(jump, [], []);
  assert.equal(lj.arcs.length, 0); assert.ok(lj.stations[0].exits.some(e => e.text.includes(UNSTORED)));
  // Beyond the last station is still a missing step.
  assert.equal(lineOffer([step('B03:S01', 'a', { branch: [{ when: 'x', to: ['B03:S09'], max: null, outcome: null }] }), step('B03:S02', 'b'), step('B03:S03', 'c')]).reason.split(' · ')[0], LINE_TARGET);
  noOverlap(gap); noOverlap(both); noOverlap(l); noOverlap(lj);
});

test('FORM-20 an alternative\'s condition is its clauses\' when (or a plain clause), never a jump target; a jump-only alternative reads 조건 미기재', () => {
  const st = [step('B03:S01', 'a'), step('B03:S02', 'b'),
    step('B03:S03a', '캐시 사용', { alt: { group: 'S03', branch: 'a' }, cell: '→ B03:S05' }), step('B03:S03b', '새로 계산', { alt: { group: 'S03', branch: 'b' }, cell: '캐시 없음 → S04' }),
    step('B03:S04', 'c'), step('B03:S05', 'd')];
  const l = stepLine(st, [], []), a = l.stations.find(s => s.ref === 'B03:S03a'), b = l.stations.find(s => s.ref === 'B03:S03b');
  assert.equal(a.cond, ALT_NO_COND); assert.equal(a.condBlank, true);
  assert.equal(b.cond, '캐시 없음'); assert.equal(b.condBlank, false);
  assert.match(l.forks[0].tag.tip, /S03a: 조건 미기재/); assert.match(l.forks[0].tag.tip, /S03b: 캐시 없음/);
  assert.ok(!/S03a: →/.test(l.forks[0].tag.tip));
  assert.ok(l.arcs.some(x => x.label === '→ S05'), 'the jump stays an arc');
  noOverlap(l);
});

test('FORM-21 start marks: a whole name says initial; an event exactly start marks the state it leaves, said as the event\'s; prefixes never', () => {
  const g = stateGraph([{ name: 'created', event: null, next: 'started' }, { name: 'started', event: null, next: 'done' }]);
  assert.deepEqual(g.nodes.filter(n => n.start).map(n => n.name), []);
  const k = stateGraph([{ name: '대기', event: '시작 요청', next: '실행 중' }, { name: '시작됨', event: null, next: '완료' }, { name: 'starting', event: null, next: '완료' }]);
  assert.deepEqual(k.nodes.filter(n => n.start).map(n => n.name), []);
  const n = stateGraph([{ name: '초기 상태', event: null, next: '열림' }, { name: '열림', event: '닫기', next: '닫힘' }, { name: 'Initial', event: null, next: '닫힘' }]);
  assert.deepEqual(n.nodes.filter(q => q.start).map(q => [q.name, q.startBy]), [['초기 상태', 'name'], ['Initial', 'name']]);
  const e = stateGraph([{ name: '대기', event: 'start', next: '실행' }, { name: '실행', event: '멈춤', next: '대기' }]);
  assert.deepEqual(e.nodes.filter(q => q.start).map(q => [q.name, q.startBy]), [['대기', 'event']]);
});

test('FORM-22 the detail view and its styles: stations matched by row ID, port lines kept in the line\'s strip, a condition opened in a form that shows it; the map\'s marks keep their colours', () => {
  const app = readFileSync(new URL('../dist/public/client/app.js', import.meta.url), 'utf8');
  const body = name => { const i = app.indexOf(`function ${name}(`); assert.ok(i >= 0, name); let d = 0, j = app.indexOf('{', i); for (let k = j; k < app.length; k++) { if (app[k] === '{') d++; else if (app[k] === '}' && --d === 0) return app.slice(j, k + 1); } return ''; };
  assert.ok(/x\.recordRef === s\.ref/.test(body('formInput')), 'a stored step meets its list step by its C-STEP row ID first');
  const draw = body('drawDetailLines');
  assert.ok(draw.includes('.sl-route .sl-scroll') && /Math\.min\(Math\.max\(x, SC\.left\), SC\.right\)/.test(draw), 'port lines end at the strip');
  const detail = body('renderDetail');
  assert.ok(/addEventListener\(["']scroll["']/.test(detail), 'the strip redraws its port lines when it scrolls');
  assert.ok(detail.includes('pendingCondition') && detail.includes('hosted.has(pcAt)'), 'a pending condition picks a form that draws its step');
  assert.ok(detail.includes('프로그램 단계로 · 목록에서') && detail.includes('정거장 없는 단계의'), 'what sits on steps with no station is said');
  const css = readFileSync(new URL('../dist/public/styles.css', import.meta.url), 'utf8');
  assert.ok(/\.edge\.agg\.near:not\(\.on\):not\(\.lit\) \.edge-line \{ stroke: #7a8390/.test(css) && !/^\.edge\.agg\.near \.edge-line \{ stroke: #7a8390/m.test(css), 'a selected summary line keeps its colour under the pointer');
  assert.ok(/:not\(\.plan-impact\):not\(\.lit\) \{ outline: 2px solid var\(--fam-edge\)/.test(css), 'the family edge never replaces the impact or lit outline');
  assert.ok(/:root\[data-theme="dark"\] :is\(\.sl-route, \.dv-states\) \{ --sl-loop:/.test(css) && /color: var\(--form-on-ink\)/.test(css), 'loop tokens and the entry pill have dark values');
});

// Spec line fixes (2026-11-05, the screen check on real v5 maps): the training-project shape. Stored steps S01-S07, then S21-S35
// (S08-S20 past the map reading's step bound), then three steps the record gave no C-STEP row ID, at the end out of row order;
// nested loops L01 (outer) and L02 (inner) inside S21-S35, one loop over the gap and one with a body row the map does not hold.
test('FORM-23 training shape: the line is offered over the steps with row IDs; ID-less steps listed apart; the gap is said between S07 and S21; only whole contiguous loops get brackets', async () => {
  const vf = await import('../dist/public/client/view-forms.js');
  const n2 = n => String(n).padStart(2, '0');
  const steps = [];
  for (let n = 1; n <= 7; n++) steps.push(step(`B05:S${n2(n)}`, `준비 ${n}`, { loopIds: n >= 6 ? ['B05:L03'] : [] }));
  for (let n = 21; n <= 35; n++) steps.push(step(`B05:S${n2(n)}`, `학습 ${n}`, { loopIds: n >= 24 && n <= 33 ? [n >= 26 && n <= 30 ? 'B05:L02' : 'B05:L01'] : n === 21 ? ['B05:L03'] : [] }));
  steps.push(step(null, '체크포인트 저장'), step(null, '평가 기록'), step(null, '로그 정리'));
  const loops = [loop('B05:L01', ['B05:S24', 'B05:S25', 'B05:S31', 'B05:S32', 'B05:S33'], { unit: '에폭마다' }), loop('B05:L02', ['B05:S26', 'B05:S27', 'B05:S28', 'B05:S29', 'B05:S30'], { parentRef: 'B05:L01', unit: '배치마다' }),
    loop('B05:L03', ['B05:S06', 'B05:S07', 'B05:S21']), loop('B05:L04', ['B05:S34', 'B05:S12'])];
  const offer = lineOffer(steps, 'B05');
  assert.equal(offer.ok, true, offer.reason);
  const l = stepLine(steps, loops, [], { owner: 'B05' });
  assert.equal(l.stations.length, 22); assert.ok(l.stations.every(s => s.ref));
  assert.deepEqual(l.noRef.map(x => x.name), ['체크포인트 저장', '평가 기록', '로그 정리']); assert.equal(l.program, 0);
  assert.equal(vf.noRefWord(3), '행 ID 없는 단계 3개 · 순서 미상 · 목록에서');
  // The gap: the segment from S07 to S21 is the dotted skip segment with its tag; never a plain next-row segment.
  const s07 = l.stations.find(s => s.ref === 'B05:S07'), s21 = l.stations.find(s => s.ref === 'B05:S21');
  const gapSeg = l.segments.find(s => s.y1 === s07.y && s.y2 === s21.y);
  assert.equal(gapSeg.skip, 13); assert.ok(!/다음 행/.test(gapSeg.tip));
  const tag = l.tags.find(t => t.text === skipWord(13)); assert.ok(tag && tag.y > s07.top && tag.y < s21.top, 'the gap tag sits between S07 and S21');
  assert.equal(l.skipped, 13);
  // Brackets: L01 (outer, whole with L02's rows) and L02; L03 crosses the gap (split), L04 holds a row this map does not hold.
  assert.deepEqual(l.brackets.map(b => b.ref).sort(), ['B05:L01', 'B05:L02']);
  assert.ok(l.brackets.find(b => b.ref === 'B05:L01').depth > l.brackets.find(b => b.ref === 'B05:L02').depth);
  const apart = Object.fromEntries(l.loopsApart.map(x => [x.ref, x.why]));
  assert.equal(apart["B05:L03"], vf.APART_SPLIT); assert.equal(apart['B05:L04'], vf.APART_UNREAD);
  noOverlap(l);
  // The consistency checks read the steps with IDs only: the ID-less tail out of row order is no LINE_ORDER refusal; a duplicate among
  // the ID'd steps still is.
  assert.equal(lineOffer([...steps, step('B05:S35', '다시')], 'B05').reason.split(' · ')[0], vf.LINE_DUP);
  // The detail view lists the ID-less steps under the line and counts the program's apart from them.
  const app = readFileSync(new URL('../dist/public/client/app.js', import.meta.url), 'utf8');
  assert.ok(app.includes('pre.noRef.length') && app.includes('NO_REF_TIP'));
  assert.ok(/progCount = fi\.steps\.filter\(\(?s\)? => s\.program && !onLine\(s\)\)/.test(app));
  const css = readFileSync(new URL('../dist/public/styles.css', import.meta.url), 'utf8');
  // cards v2 review: the port column keeps 88px (a port's name stays readable beside the 520px line).
  assert.ok(/\.dv-inner\.has-line \{ grid-template-columns: minmax\(88px, 120px\) minmax\(520px, 1fr\)/.test(css), 'the line keeps at least 520px');
  assert.ok(/\.dv-inner\.has-line \.dv-port \{[^}]*white-space: nowrap/.test(css), 'ports are one-line chips in 노선');
});
