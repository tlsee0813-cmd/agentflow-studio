// Display slice S8 (viewing notes on the nanoGPT and hyperfine .43 v4 maps, 2026-11-05), its pure parts: a group reads as a group
// (its axis in the record's word, how many parts, its first parts by name; never 「유형 미상」), a bare 「한 번」 cadence is no badge
// below 가까이 (a tick, its words in the tip), a pair of summary strokes running opposite ways is one stroke with a head at each end
// (fewer tracks in the gap beside a folded group), and a lens steps back the cards it is not about. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cardTemplate, groupKind, groupGlyph, groupTip, membersRow, MEMBER_NAMES } from '../dist/public/client/card-family.js';
import { GLYPH } from '../dist/public/client/card-glyphs.js';
import { recordedAxis, groupWordOf, RECORD_AXIS_WORD, AXIS_WORD } from '../dist/public/client/map-regions.js';
import { lineBadge, badgeForms, isOnceWord, quietAt, quietTip, pairWays, BADGE_GLYPH } from '../dist/public/client/line-grammar.js';
import { tierFit } from '../dist/public/client/card-budget.js';
import { lensOffTopic } from '../dist/public/client/view-lens.js';
import { routeEdges, TRACK_GAP } from '../dist/public/client/map-route.js';
import { NODE_W, NODE_H } from '../dist/public/client/map-layout.js';

const facts = (x = {}) => ({ type: null, config: [], inputs: [], outputs: [], fields: [], loop: null, steps: [], conditions: [], ...x });
const reading = (type, x = {}) => ({ typeRead: type ? { type, quote: null, at: 'r' } : null, stateRead: null, steps: [], loop: null, ...x });
function view(spec, rels = []) {
  const parts = spec.map(([id, name, parent, r]) => ({ id, name, note: '', parentId: parent ?? null, depth: parent ? 1 : 0, childIds: [], status: 'plan', lastAt: null, recordIds: [], summary: null, changes: [], origin: null, proposal: null, reading: r ?? null }));
  const byId = new Map(parts.map(p => [p.id, p]));
  for (const p of parts) if (p.parentId) byId.get(p.parentId).childIds.push(p.id);
  return { parts, roots: parts.filter(p => !p.parentId).map(p => p.id), relations: rels.map(([from, to, kind = 'flow'], i) => ({ id: `R${i}`, from, to, kind, note: '' })), records: [] };
}

test('S8-1 a group card: its axis and count in the kind line, its first parts in an 안에 row, never 「유형 미상」', () => {
  // nanoGPT .43 v4: 「로컬 Python 프로세스」, untyped, the record's 묶음 뜻 실행 위치, five parts.
  const names = ['데이터 준비 스크립트', 'train.py', 'sample.py', 'bench.py', '노트북'];
  const t = cardTemplate(facts({ children: 5, members: names, groupAxis: 'place', groupWord: '실행 위치', groupRecorded: true }));
  assert.equal(t.kind, '실행 위치 · 안쪽 5');
  assert.doesNotMatch(t.kind, /유형 미상/);
  assert.equal(t.glyph, 'place', 'a place reads as a place: the pin');
  assert.equal(t.family, 'neutral', 'no family is made up for it');
  assert.equal(t.structural, false);
  assert.deepEqual(t.rows[0], { label: '안에', value: '데이터 준비 스크립트 · train.py · sample.py 외 2', members: true }); // cards v2 §1: 「외 N」
  assert.deepEqual(t.group, { axis: 'place', word: '실행 위치', names, recorded: true });
  // No axis known: 묶음, with the composition squares.
  const plain = cardTemplate(facts({ children: 3, members: ['a', 'b', 'c'] }));
  assert.equal(plain.kind, '묶음 · 안쪽 3'); assert.equal(plain.glyph, 'composition');
  // A typed group keeps its type word first (as before for a composition: 「계산 · 안쪽 2」 since polish round fixes 1), and its own glyph.
  const gpt = cardTemplate(facts({ type: 'compute', children: 2, members: ['GPT.from_pretrained', 'GPT.generate'], groupAxis: 'composition', groupWord: '구성', groupRecorded: true }));
  assert.equal(gpt.kind, '계산 · 안쪽 2'); assert.equal(gpt.glyph, 'compute'); assert.equal(gpt.family, 'process');
  assert.equal(gpt.rows[0].value, 'GPT.from_pretrained · GPT.generate');
  // An untyped group with recorded steps is drawn as a group (its stack), not the structural outline; its steps keep their line.
  const steps = cardTemplate(facts({ children: 2, members: ['x', 'y'], steps: [{ name: 'a', does: null }, { name: 'b', does: null }] }));
  assert.equal(steps.structural, false); assert.equal(steps.kind, '묶음 · 안쪽 2'); assert.ok(steps.innerLine);
  // A part with no children is no group: nothing changes for it.
  const lone = cardTemplate(facts());
  assert.equal(lone.group, null); assert.equal(lone.kind, '유형 미상'); assert.equal(lone.rows.length, 0);
  assert.equal(groupKind(null, '외부', 6), '외부 · 안쪽 6'); assert.equal(groupKind('loop', null, 3), '루프·엔진 · 안쪽 3');
  assert.equal(groupGlyph('place'), 'place'); assert.equal(groupGlyph('participants'), 'composition'); assert.equal(groupGlyph(null), 'composition');
  assert.equal(membersRow([]), null); assert.equal(MEMBER_NAMES, 3);
  assert.equal(membersRow(['a', 'b', 'c']).value, 'a · b · c', 'three names whole, no +0');
});

test('S8-2 a group\'s tip says whether the record named its axis, whether it named a type, and every part in it', () => {
  const t = cardTemplate(facts({ children: 2, members: ['a', 'b'], groupAxis: 'place', groupWord: '실행 위치', groupRecorded: true }));
  assert.equal(groupTip(t, false), '실행 위치 · 안쪽 2\n묶음 뜻 「실행 위치」 · 기록의 글자\n기록이 이 묶음의 종류 단어를 말하지 않았다 (종류를 짐작하지 않음)\n안에 2: a · b');
  const read = cardTemplate(facts({ children: 1, members: ['p'], groupAxis: 'participants', groupWord: '참여자', groupRecorded: false }));
  assert.match(groupTip(read, false), /안의 부분들로 읽음 \(기록의 묶음 뜻 없음\)/);
  const none = cardTemplate(facts({ type: 'compute', children: 1, members: ['q'] }));
  assert.equal(groupTip(none, true), '계산 · 안쪽 1\n묶음 뜻 미기록\n안에 1: q');
});

test('S8-3 a group\'s axis: the record\'s 묶음 뜻 first (실행 위치 only from a record), else the app\'s reading of its children', () => {
  const v = view([
    ['L', '로컬 Python 프로세스', null, reading(null)], ['t', 'train.py', 'L', reading('loop')], ['s', 'sample.py', 'L', reading('loop')],
    ['P', 'nanoGPT 저장소', null, reading(null)], ['a', 'Andrej Karpathy', 'P', reading('person')], ['core', 'GPT', null, reading('compute')],
    ['C', 'config 파일들', null, reading('store')], ['c1', 'train_gpt2.py', 'C', reading('store')],
  ], [['a', 'core']]);
  const project = { readings: [
    { version: 'map-reading.17', parts: [{ areaId: 'L', groupAxis: 'composition' }] },
    { version: 'map-reading.18', parts: [{ areaId: 'L', groupAxis: 'place' }, { areaId: 'C', groupAxis: 'members' }] },
    { version: 'map-correction.1', areaId: 'L', text: '정정' },
  ] };
  assert.equal(recordedAxis(project, 'L'), 'place', 'the newest reading that names one');
  assert.equal(recordedAxis(project, 'C'), null, '목록 is a list, not an axis');
  assert.equal(recordedAxis(project, 'P'), null);
  assert.deepEqual(groupWordOf(v, 'L', recordedAxis(project, 'L')), { axis: 'place', word: '실행 위치', recorded: true });
  assert.deepEqual(groupWordOf(v, 'P', null), { axis: 'participants', word: AXIS_WORD.participants, recorded: false }, 'read from its children');
  assert.equal(groupWordOf(v, 'L', null), null, 'without the record nothing says where things run: no 실행 위치 from a name');
  assert.equal(groupWordOf(v, 't', 'place'), null, 'a part with no children is no group');
  assert.deepEqual(groupWordOf(v, 'C', null), { axis: 'composition', word: '구성', recorded: false });
  assert.deepEqual(RECORD_AXIS_WORD, { place: '실행 위치', composition: '구성', participants: '참여자', boundary: '외부' });
});

test('S8-4 the place pin is a glyph of its own shape, with no colour in it', () => {
  assert.ok(/<(path|circle)/.test(GLYPH.place));
  assert.ok(!Object.entries(GLYPH).some(([k, v]) => k !== 'place' && v === GLYPH.place));
  assert.doesNotMatch(GLYPH.place, /fill="#|stroke="#|style=/);
});

test('S8-5 a bare 「한 번」 is quiet: no badge at the overview and the middle tier, its words near, selected and in the tip', () => {
  for (const w of ['한 번', '한번', ' 한 번 ', '1회', 'once', '한 번.']) assert.ok(isOnceWord(w), w);
  for (const w of ['prepare 한 번', '시작 시 한 번', '끝에 한 번', '실행마다 1회', '한 번씩', '호출마다', '']) assert.ok(!isOnceWord(w), w);
  // nanoGPT .43 v4: 「한 번」, 「한 번 (1/2)」.
  const once = lineBadge([{ cadence: '한 번' }]), half = lineBadge([{ cadence: '한 번' }, {}]);
  assert.equal(once.quiet, true); assert.equal(half.quiet, true); assert.equal(half.short, '한 번 (1/2)');
  for (const tier of ['far', 'dots', 'mid']) { assert.deepEqual(badgeForms(once, false, tier), [], tier); assert.equal(quietAt(once, false, tier), true); }
  assert.deepEqual(badgeForms(once, false, 'near'), ['한 번', BADGE_GLYPH], 'near: the words as written');
  assert.deepEqual(badgeForms(once, true, 'mid'), ['한 번', BADGE_GLYPH], 'selected: the words as written');
  assert.equal(badgeForms(half, true, 'far')[0], '한 번 (1/2)');
  assert.equal(quietTip(once), '한 번 · 가까이 보거나 선을 고르면 글자로\n박자 · 기록의 글자 그대로\n“한 번”');
  // 「한 번 외 2」: the stroke also says more; it leads with the first word that does, the count is the record's.
  const mixed = lineBadge([{ cadence: '한 번' }, { cadence: '항목마다' }, { cadence: '호출마다' }]);
  assert.equal(mixed.quiet, false); assert.equal(mixed.lead, '항목마다'); assert.equal(mixed.short, '항목마다 외 2');
  assert.deepEqual(mixed.words, ['한 번', '항목마다', '호출마다'], 'the words keep their order and every one reads in the tip');
  assert.deepEqual(badgeForms(mixed, false, 'mid'), ['항목마다 외 2', BADGE_GLYPH]);
  // A condition is never quiet; nor are the informative cadences.
  const cond = lineBadge([{ cadence: '한 번', when: "init_from == 'resume'" }]);
  assert.equal(cond.kind, 'condition'); assert.equal(cond.quiet, false); assert.deepEqual(badgeForms(cond, false, 'mid')[0], '조건', 'polish round: the cue; the words in the tip');
  for (const w of ['호출마다', '주기: eval_interval', '사건 때', '항목마다', '끝에 한 번']) assert.equal(lineBadge([{ cadence: w }]).quiet, false, w);
  assert.equal(quietAt(lineBadge([{ cadence: '호출마다' }]), false, 'mid'), false);
});

const sum = (from, to, ch = 'data', head = ch === 'data' ? 'filled' : ch === 'control' ? 'open' : 'ref', ids = [`${from}${to}`]) =>
  ({ key: `sum:${from}|${to}|${ch}|${head}`, from, to, kind: ch === 'uses' ? 'needs' : 'flow', notes: [], ids, agg: true });
test('S8-6 two summary strokes of one pair running opposite ways are one stroke with a head at each end; its key is stable', () => {
  const out = pairWays([sum('g', 'a'), sum('a', 'g', 'data', 'filled', ['x1', 'x2']), sum('g', 'b', 'uses'), sum('b', 'g', 'uses'), sum('g', 'c', 'control'), sum('c', 'g', 'data')]);
  const two = out.find(e => e.key === 'sum:a|g|data|filled|both');
  assert.ok(two, JSON.stringify(out.map(e => e.key)));
  assert.equal(two.from, 'a'); assert.equal(two.to, 'g'); assert.equal(two.both, true);
  assert.deepEqual(two.ids, ['x1', 'x2', 'ga'], 'every relation once: lo → hi first, then the way back');
  assert.deepEqual(two.back, ['ga']);
  assert.ok(out.some(e => e.key === 'sum:g|b|uses|ref') && out.some(e => e.key === 'sum:b|g|uses|ref'), 'a reference keeps its own strokes (its ear says where it starts)');
  assert.ok(out.some(e => e.key === 'sum:g|c|control|open') && out.some(e => e.key === 'sum:c|g|data|filled'), 'different channels never share a stroke');
  assert.equal(out.length, 5);
  // The same pair found the other way round: the same key.
  assert.equal(pairWays([sum('a', 'g'), sum('g', 'a')])[0].key, 'sum:a|g|data|filled|both');
  // Beside a selection one direction may be gone: a stroke drawn two-way at rest keeps its key.
  const kept = pairWays([sum('g', 'a')], new Set(['sum:a|g|data|filled|both']));
  assert.equal(kept[0].key, 'sum:a|g|data|filled|both'); assert.deepEqual(kept[0].back, ['ga']); assert.deepEqual(kept[0].ids, ['ga']);
  assert.equal(pairWays([sum('g', 'a')])[0].key, 'sum:g|a|data|filled', 'one way alone: as before');
  // Not a summary stroke (a line of its own): untouched.
  const own = { key: 'R1', from: 'g', to: 'a', kind: 'flow', notes: [], ids: ['R1'], agg: false }, back = { ...own, key: 'R2', from: 'a', to: 'g', ids: ['R2'] };
  assert.deepEqual(pairWays([own, back]), [own, back]);
});

test('S8-7 beside a folded group with six partners both ways, the paired strokes take half the tracks and keep TRACK_GAP apart', () => {
  const box = (id, x, y) => ({ id, x, y, w: NODE_W, h: NODE_H, kind: 'node', depth: 0, container: 'root', kids: 0, rel: { x, y }, head: 0, face: 'unit' });
  const g = box('g', 0, 300), ts = Array.from({ length: 6 }, (_, i) => box(`t${i}`, NODE_W + 76, i * 120));
  const boxes = new Map([g, ...ts].map(b => [b.id, b]));
  const both = ts.flatMap(t => [sum('g', t.id), sum(t.id, 'g')]);
  const paired = pairWays(both);
  assert.equal(paired.length, 6);
  const segs = r => [...r.values()].flatMap(x => x.pts.slice(1, -2).map((p, i) => ({ p, q: x.pts[i + 2] })).filter(s => Math.abs(s.p.x - s.q.x) < 0.01 && Math.abs(s.p.y - s.q.y) > 1));
  const runs = r => segs(r).map(s => s.p.x);
  const rb = routeEdges(boxes, both), ra = routeEdges(boxes, paired), xsBefore = runs(rb), after = segs(ra), xsAfter = after.map(s => s.p.x);
  // Beauty v3 (D.3): ends past a side's budget take a face (both sets alike), so the gap runs no longer count the pairing's saving: the
  // paired strokes take half the group's ends and at most half the ink of the twelve, and never more gap runs than before (at most one
  // each).
  const endsOn = r => new Set([...r.values()].flatMap(x => [x.pts[0], x.pts.at(-1)]).filter(p => p.x >= g.x - 0.5 && p.x <= g.x + g.w + 0.5 && p.y >= g.y - 0.5 && p.y <= g.y + g.h + 0.5).map(p => `${Math.round(p.x)},${Math.round(p.y)}`)).size;
  const ink = r => [...r.values()].reduce((a, x) => a + x.pts.reduce((s, q, i) => (i ? s + Math.abs(q.x - x.pts[i - 1].x) + Math.abs(q.y - x.pts[i - 1].y) : 0), 0), 0);
  assert.ok(endsOn(ra) <= endsOn(rb) / 2, `ends on the group ${endsOn(rb)} → ${endsOn(ra)}`);
  assert.ok(ink(ra) <= ink(rb) / 2, `ink ${Math.round(ink(rb))} → ${Math.round(ink(ra))}`);
  assert.ok(xsAfter.length <= Math.min(xsBefore.length, paired.length), `${xsBefore.length} → ${xsAfter.length} runs for ${paired.length} strokes`);
  // Beauty v3 (D.3): with the side over its budget one end takes the top face, and runs that never meet may share an x band; runs that
  // overlap along their length keep TRACK_GAP apart.
  for (let i = 0; i < after.length; i++) for (let j = i + 1; j < after.length; j++) {
    const a = after[i], b = after[j], ov = Math.min(Math.max(a.p.y, a.q.y), Math.max(b.p.y, b.q.y)) - Math.max(Math.min(a.p.y, a.q.y), Math.min(b.p.y, b.q.y));
    if (ov > 1) assert.ok(Math.abs(a.p.x - b.p.x) >= TRACK_GAP - 1.01, `tracks ${a.p.x}, ${b.p.x}`);
  }
});

test('S8-8 a folded group\'s 안에 row reads at 중간 before its bottom line', () => {
  const shape = { nameLines: 1, rows: 1, contract: 0, inner: 0, signs: 0, total: 136, status: 1, vals: 0, blank: 0 };
  assert.equal(tierFit(shape, 0.6, 'mid').rows, 0, 'any other first row gives way to the bottom line, as before');
  const g = tierFit({ ...shape, members: 1 }, 0.6, 'mid');
  assert.equal(g.rows, 1); assert.equal(g.kind, true);
  assert.equal(tierFit({ ...shape, members: 1 }, 0.5, 'far').rows, 0, 'the overview keeps the head only');
  assert.equal(tierFit({ ...shape, members: 1, rows: 0 }, 0.6, 'mid').rows, 0);
});

test('S8-9 a lens steps back the cards it is not about; 구성 · 상태 step back none; never all', () => {
  const parts = [{ id: 'u', family: 'participant', loop: false }, { id: 'run', family: 'process', loop: true }, { id: 'db', family: 'store', loop: false },
    { id: 'cron', family: 'trigger', loop: false }, { id: 'x', family: 'neutral', loop: false }];
  const lines = [{ channel: 'data', from: 'run', to: 'db' }, { channel: 'control', from: 'u', to: 'run' }, { channel: 'uses', from: 'run', to: 'x' }];
  assert.deepEqual([...lensOffTopic('data', parts, lines)].sort(), ['cron', 'u', 'x']);
  assert.deepEqual([...lensOffTopic('start', parts, lines)].sort(), ['db', 'x'], 'control ends, triggers and loops are about starting');
  for (const id of ['compose', 'state', 'scenario']) assert.equal(lensOffTopic(id, parts, lines).size, 0, id);
  assert.equal(lensOffTopic('data', [{ id: 'u', family: 'participant', loop: false }], []).size, 0, 'nothing about the lens: nothing steps back');
});
