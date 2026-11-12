// Beauty v5, the first screen's focus, its pure part: the record's own first sentence at the top, and 「먼저 보는 흐름」 chosen by fixed
// rules in a fixed order (the person's kept choice, a scenario, the summary's core-flow sentence, a first-structure line, a recorded
// start, none), drawn only on relations the map has directly between consecutive named parts (a gap stays a gap). Fictional readings
// only. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { firstFlow, flowCandidates, namedFlow, flowParts, nameTokens, summarySentences, summarySource, shownSentence, headLines, hubFolds, foldWord, switcherText,
  HUB_FOLD_MIN, FLOW_RULES } from '../dist/public/client/first-flow.js';
import { readFirstView, writeFirstView, recordOf, firstView } from '../dist/public/client/first-view.js';

// A fictional bakery: an order desk takes orders, a dough mixer mixes per batch, an oven bakes, a ledger records; a timer wakes the mixer.
const P = (id, name, x = {}) => ({ id, name, ref: null, entries: [], states: [], entryRows: [], ...x });
const L = (id, from, to, channel = 'data', payload = null, when = null) => ({ id, from, to, channel, payload, when });
const PARTS = [
  P('desk', '주문 창구', { ref: 'B01' }),
  P('mix', '반죽 배합기', { ref: 'B02' }),
  P('oven', '오븐 굽기 단계', { ref: 'B03' }),
  P('book', '판매 장부', { ref: 'B04' }),
  P('timer', '새벽 타이머', { ref: 'B05', entries: ['schedule'], entryRows: [{ kind: 'schedule', name: '매일 04:00', order: null, ref: 'N02' }] }),
  P('cli', 'bake.py 수동 실행', { ref: 'B06', entries: ['command'], entryRows: [{ kind: 'command', name: 'python bake.py', order: 1, ref: 'N01' }] })];
const LINES = [
  L('l1', 'desk', 'mix', 'data', '주문서'),
  L('l2', 'mix', 'oven', 'data', '반죽'),
  L('l3', 'oven', 'book', 'data', '판매 기록'),
  L('l4', 'timer', 'mix', 'control', '깨우기'),
  L('l5', 'cli', 'oven', 'control', '굽기 시작'),
  L('l6', 'desk', 'oven', 'data', '급한 주문', '급하면'),
  L('l7', 'oven', 'mix', 'data', '덜 익은 반죽', '덜 익으면'),
  L('l8', 'mix', 'book', 'data', '버린 반죽', '덜 익으면')];
const base = (x = {}) => ({ parts: PARTS, lines: LINES, loops: [], scenarios: [], summaryFlow: null, headLines: [], kept: null, ...x });
const SC = { id: 'S1', name: '아침 주문 · 설계 · 완결', parts: ['desk', 'mix', 'oven'], links: [{ from: 'desk', to: 'mix', relation: 'l1', kind: 'next' }, { from: 'mix', to: 'oven', relation: 'l2', kind: 'branch', condition: '반죽이 충분하면' }], start: '손님 주문', end: '빵 한 판' };

test('FF-1 the rules apply in their fixed order: scenario, summary, first-structure line, recorded start', () => {
  const all = base({ scenarios: [SC], summaryFlow: '주문 창구 → 반죽 배합기 → 오븐 굽기 단계', headLines: ['반죽 배합기가 오븐 굽기 단계로 넘긴다'] });
  assert.deepEqual(FLOW_RULES, ['scenario', 'summary', 'head', 'entry']);
  assert.equal(firstFlow(all).rule, 'scenario');
  assert.equal(firstFlow({ ...all, scenarios: [] }).rule, 'summary');
  assert.equal(firstFlow({ ...all, scenarios: [], summaryFlow: null }).rule, 'head');
  assert.equal(firstFlow({ ...all, scenarios: [], summaryFlow: null, headLines: [] }).rule, 'entry');
  // Rule 5: nothing applies (no scenario, no sentence naming two joined parts, no starting entry with a line out): no flow at all.
  const bare = firstFlow(base({ parts: PARTS.map(p => ({ ...p, entries: [], entryRows: [] })) }));
  assert.deepEqual(bare, { rule: null, kept: false, candidates: [], index: -1, flow: null });
  // A scenario's flow: its relations in link order, its heads' words at the start and the end, its one branch with the condition.
  const sc = firstFlow(all).flow;
  assert.deepEqual([sc.parts, sc.lines, sc.start, sc.end, sc.branch], [['desk', 'mix', 'oven'], ['l1', 'l2'], { part: 'desk', text: '손님 주문' }, { part: 'oven', text: '빵 한 판' }, { line: 'l2', part: 'mix', text: '반죽이 충분하면' }]);
});

test('FF-2 a gap stays a gap: only relations directly between consecutive named parts, never a bridge, never a new line', () => {
  // The sentence names 주문 창구, 판매 장부, 반죽 배합기 in that order.
  const f = namedFlow('주문 창구에서 받은 것을 판매 장부에 적고 반죽 배합기로 보낸다', base());
  // desk → book: no direct relation (a path desk→mix→oven→book exists, never used); book → mix: no relation either way (l8 runs mix→book: the
  // other way counts when none runs forward).
  assert.deepEqual(f.parts, ['desk', 'book', 'mix']);
  assert.deepEqual(f.lines, ['l8']);
  assert.deepEqual(f.gaps, [['desk', 'book']]);
  // The notes say only what the lines show: the one drawn line runs against the record's order (mix → book), so neither 「시작」 nor 「끝」.
  const back = flowCandidates('summary', base({ summaryFlow: '주문 창구에서 받은 것을 판매 장부에 적고 반죽 배합기로 보낸다' }))[0];
  assert.deepEqual([back.start, back.end, back.ends], [null, null, ['book', 'mix']]);
  // A forward line skipping a named part (desk → oven, l6) is neither drawn nor context: it would read as bridging the flow.
  const c = flowCandidates('summary', base({ summaryFlow: '주문 창구 → 반죽 배합기 → 오븐 굽기 단계' }))[0];
  assert.deepEqual(c.lines, ['l1', 'l2']);
  assert.ok(!c.lines.includes('l6') && !c.context.includes('l6'));
  // The way back between its parts (oven → mix, conditional) is its context; a conditional exit of a part the flow leaves unconditionally is not.
  assert.deepEqual(c.context, ['l7']);
  // Under two named parts, or no relation between any consecutive pair: no flow from that sentence.
  assert.equal(namedFlow('주문 창구만 쓴다', base()), null);
  assert.equal(namedFlow('새벽 타이머와 판매 장부', base()), null);
});

test('FF-3 a flow needs one drawn line: a relation the view does not draw lets the next rule apply', () => {
  const inp = base({ summaryFlow: '주문 창구 → 반죽 배합기', headLines: ['오븐 굽기 단계가 판매 장부에 쓴다'] });
  assert.equal(firstFlow(inp).rule, 'summary');
  assert.equal(firstFlow({ ...inp, drawn: new Set(['l3']) }).rule, 'head', 'l1 is not drawn here (inside a folded part): the summary gives no flow');
  assert.equal(firstFlow({ ...inp, drawn: new Set() }).rule, null);
});

test('FF-4 the person\'s choice is kept over the rules; 「전체 관계」 is a choice too; a choice whose words are gone falls back', () => {
  const inp = base({ summaryFlow: '주문 창구 → 반죽 배합기', headLines: ['반죽 배합기가 오븐 굽기 단계로', '오븐 굽기 단계가 판매 장부에'] });
  const heads = flowCandidates('head', inp);
  assert.equal(heads.length, 2);
  const kept = firstFlow({ ...inp, kept: { rule: 'head', key: heads[1].key } });
  assert.deepEqual([kept.rule, kept.kept, kept.index, kept.candidates.length, kept.flow.lines], ['head', true, 1, 2, ['l3']]);
  const all = firstFlow({ ...inp, kept: { rule: 'all', key: '' } });
  assert.deepEqual([all.rule, all.kept, all.flow, all.candidates.length], ['all', true, null, 1], 'no flow drawn; the first rule\'s flow offered to come back to');
  const gone = firstFlow({ ...inp, kept: { rule: 'head', key: 'head:지워진 줄' } });
  assert.deepEqual([gone.rule, gone.kept], ['summary', false]);
  // Kept with the map's first view record: read back as written, a broken one read as none.
  const rec = { ...recordOf(firstView({ firstLines: [], parts: [], lines: [] }), 'auto'), flow: { rule: 'head', key: heads[1].key } };
  assert.deepEqual(readFirstView(writeFirstView(null, 'm1', rec), 'm1').flow, { rule: 'head', key: heads[1].key });
  assert.equal(readFirstView(writeFirstView(null, 'm1', { ...rec, flow: { rule: 'centre', key: 'x' } }), 'm1').flow ?? null, null);
  assert.equal(readFirstView(JSON.stringify({ m1: { lens: 'data' } }), 'm1').flow ?? null, null);
});

test('FF-5 a recorded start: its part and the relations the record draws out of it, by hand-run order then row ID', () => {
  const cs = flowCandidates('entry', base());
  assert.deepEqual(cs.map(c => c.parts), [['cli', 'oven'], ['timer', 'mix']], 'python bake.py (1) first, then the timer (N02)');
  assert.deepEqual(cs[0].lines, ['l5']);
  assert.deepEqual([cs[0].start, cs[0].end, cs[0].context], [{ part: 'cli', text: 'python bake.py' }, null, []]);
  assert.equal(cs[0].name, '기록된 시작');
  // A start with no line out is no flow.
  assert.deepEqual(flowCandidates('entry', base({ lines: LINES.filter(l => l.id !== 'l5' && l.id !== 'l4') })), []);
});

test('FF-6 the top sentence is the newest record\'s own C-SUMMARY first sentence; none without one', () => {
  const body = (t) => t.split('\n').map((text, i) => ({ text, from: i * 100 }));
  const older = { id: 'r1', body: body('옛 문장이다(F01). 옛 흐름이다.') };
  const newer = { id: 'r2', body: body('빵집 주문 앱은 손님이 주문하고 제빵사가 굽는 데 쓴다(F01+E02). 핵심 흐름은 주문 창구 → bake.py → 판매 장부다(F03).') };
  const s = summarySource([older, newer, { id: 'r3', body: [] }]);
  assert.deepEqual([s.record, s.first, s.shown, s.flow], ['r2', '빵집 주문 앱은 손님이 주문하고 제빵사가 굽는 데 쓴다(F01+E02).', '빵집 주문 앱은 손님이 주문하고 제빵사가 굽는 데 쓴다.', '핵심 흐름은 주문 창구 → bake.py → 판매 장부다(F03).']);
  // The two sentences on two lines read the same; a dot inside a file name ends nothing.
  assert.deepEqual(summarySentences('train.py와 ckpt.pt를 쓰는 도구이다(F02).\n핵심 흐름은 a → b이다(F05).'), ['train.py와 ckpt.pt를 쓰는 도구이다(F02).', '핵심 흐름은 a → b이다(F05).']);
  assert.equal(shownSentence('무엇이다(F01)'), '무엇이다', 'only a closing evidence group is left to the hover');
  assert.equal(shownSentence('괄호(설명)는 남는다.'), '괄호(설명)는 남는다.');
  assert.equal(summarySource([{ id: 'r1', body: [] }]), null, 'no record summary: nothing is shown (never the model\'s summary or the brief)');
});

test('FF-7 the first-structure row splits at its own numbering, never inside a path', () => {
  assert.deepEqual(headLines('① A→B ② C→D'), ['A→B', 'C→D']);
  assert.deepEqual(headLines('1) A→B 2) C→D 3) E'), ['A→B', 'C→D', 'E']);
  assert.deepEqual(headLines('가 → 나 / 다 → 라; 마'), ['가 → 나', '다 → 라', '마']);
  assert.deepEqual(headLines('스크립트가 data/{dataset}/에 쓴다'), ['스크립트가 data/{dataset}/에 쓴다']);
  assert.deepEqual(headLines(''), []);
});

test('FF-8 the prose names a part by a word only that part\'s name holds (never a short Hangul word, never a count)', () => {
  const parts = [P('t', 'train.py 학습 실행기'), P('c', '체크포인트 {out_dir}/ckpt.pt'), P('s', '저장소 검사 워크플로'), P('n', 'npm 게시 작업'), P('m', '요청 관문 미들웨어'), P('k', '자료 준비 스크립트 2개'), P('g', 'GPT 모델')];
  const tk = nameTokens(parts);
  assert.deepEqual(tk.get('t').map(w => w.word), ['train.py', 'train.py 학습']);
  assert.ok(tk.get('c').some(w => w.word === 'ckpt.pt'));
  assert.ok(!(tk.get('s') ?? []).some(w => w.word === '저장소'), 'a three-syllable word alone names many things in prose');
  assert.ok(tk.get('m').some(w => w.word === '미들웨어'));
  assert.ok(!(tk.get('k') ?? []).some(w => /2개/.test(w.word)));
  assert.ok(!tk.has('g') || !tk.get('g').some(w => w.word === 'GPT'), 'an ASCII word under four characters is no name');
  assert.deepEqual(flowParts('train.py 학습 반복 → ckpt.pt → npm 게시 → 미들웨어 → 저장소에 쓴다', parts), ['t', 'c', 'n', 'm']);
  // An ASCII word counts only whole: 「retrain.pyc」 is not train.py.
  assert.deepEqual(flowParts('retrain.pyc', parts), []);
});

test('FF-9 the hub fold: a flow card with six or more drawn lines off the flow folds them behind one chip', () => {
  const ls = (n, card) => Array.from({ length: n }, (_, i) => ({ key: `${card}${i}`, from: card, to: `x${i}`, flow: false }));
  const lines = [...ls(6, 'a'), ...ls(5, 'b'), { key: 'f', from: 'a', to: 'b', flow: true }];
  const folds = hubFolds(['a', 'b'], lines);
  assert.equal(HUB_FOLD_MIN, 6);
  assert.deepEqual([...folds.keys()], ['a']);
  assert.equal(folds.get('a').length, 6, 'N counted from the drawn lines, the flow\'s own never folded');
  assert.deepEqual([foldWord(6, false), foldWord(6, true)], ['다른 연결 6개', '접기']);
});

test('FF-10 the switcher says where the flow starts and ends, its source and 1/N', () => {
  const inp = base({ headLines: ['반죽 배합기가 오븐 굽기 단계로', '오븐 굽기 단계가 판매 장부에'] });
  const name = id => PARTS.find(p => p.id === id).name;
  assert.equal(switcherText(firstFlow(inp), name), '먼저 보는 흐름: 반죽 배합기 → 오븐 굽기 단계 · 첫 구조 줄 1 · 1/2');
  assert.equal(switcherText(firstFlow(base({ summaryFlow: '주문 창구 → 반죽 배합기' })), name), '먼저 보는 흐름: 주문 창구 → 반죽 배합기 · 기록 요약');
  assert.equal(switcherText(firstFlow(base()), name), '먼저 보는 흐름: bake.py 수동 실행에서 · 기록된 시작 · 1/2');
  assert.equal(switcherText({ rule: 'all', kept: true, candidates: [], index: -1, flow: null }), null);
});

test('FF-11 the app reads the sentence from the record, draws only existing lines, and never fades card text in focus', async () => {
  const app = await readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  const whole = app.slice(app.indexOf('/* ---------- the first screen\'s focus (beauty v5'), app.indexOf('/* ---------- the scenario on the map'));
  assert.ok(whole.length > 2000);
  const block = whole.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(block, /latestMapSummary|brief|\.spine|degree|central/, 'never the model\'s summary, the person\'s brief, the computed spine or a centrality');
  assert.doesNotMatch(block, /svg\('path'|createElementNS/, 'nothing new drawn on the lines: classes on the existing ones only');
  assert.match(app, /own\(document\.getElementById\('focus-top'\), 6\)/, 'the camera\'s fit keeps the map off the top line');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="scope-sticky"[^>]*><\/div>\s*<div id="focus-top" class="focus-top"[^>]*hidden><\/div>/);
  const css = (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sel) => css.split('\n').find(l => l.startsWith(sel)) ?? '';
  assert.match(rule('#space.ff-on .world .edge.ff-flow:not(.on):not(.lg-hover):not(.picked) {'), /--bw: 3;/);
  assert.match(rule('#space.ff-on .world .edge.ff-flow:not(.on):not(.lg-hover):not(.picked) .edge-line'), /stroke: var\(--accent\)/);
  assert.match(rule('#space.ff-on .world .edge.ff-ctx:not(.on)'), /--bw: 2\.25;/);
  assert.match(rule('#space.ff-on .world .edge:not(.ff-flow)'), /--bw: 1\.15;/);
  const off = css.split('\n').filter(l => /#space\.ff-on .*(lens-off|lg-fade)/.test(l)).join('\n');
  assert.match(off, /opacity: 1; filter: none;/, 'a card off the lens keeps its words whole in focus');
  assert.match(css, /\.focus-top \.ft-sentence \{[^}]*font-size: 19px;[^}]*-webkit-line-clamp: 2;/);
});
