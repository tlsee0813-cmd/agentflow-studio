// Beauty v5, the first screen's focus (ruling F6 Q2), its pure part: the record's own first sentence at the top, and 「먼저 볼 연결」 chosen
// by fixed rules in a fixed order (the person's kept choice, a scenario, the summary's core-flow sentence, a first-structure line, a
// recorded start, none), drawn only on relations the map has from one named step to the next in their own direction (name order is never a
// direction; alternatives in one step are never paired; a gap stays a gap). Notes only from the record (a C-ENTRY start, a scenario's
// recorded start and end, a plain condition), never a row ID. Fictional readings only. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { firstFlow, flowCandidates, namedFlow, flowParts, flowSteps, nameTokens, summarySentences, summarySource, shownSentence, headLines, hubFolds, foldedLines, foldWord,
  switcherText, sourceText, branchWords, statesOrder, recordWords, codeLike, HUB_FOLD_MIN, FLOW_RULES, FLOW_CONTROL, FLOW_SOURCE, ENTRY_SOFT_OVER } from '../dist/public/client/first-flow.js';
import { readFirstView, writeFirstView, recordOf, firstView } from '../dist/public/client/first-view.js';
import { COND_UNSAID } from '../dist/public/client/line-grammar.js';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { studioView } from '../dist/public/shared/studio.js';

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
const name = id => PARTS.find(p => p.id === id)?.name ?? id;

test('FF-1 the rules apply in their fixed order: scenario, summary, first-structure line, recorded start', () => {
  const all = base({ scenarios: [SC], summaryFlow: '주문 창구 → 반죽 배합기 → 오븐 굽기 단계', headLines: ['반죽 배합기가 오븐 굽기 단계로 넘긴다'] });
  assert.deepEqual(FLOW_RULES, ['scenario', 'summary', 'head', 'entry']);
  assert.equal(firstFlow(all).rule, 'scenario');
  assert.equal(firstFlow({ ...all, scenarios: [] }).rule, 'summary');
  assert.equal(firstFlow({ ...all, scenarios: [], summaryFlow: null }).rule, 'head');
  assert.equal(firstFlow({ ...all, scenarios: [], summaryFlow: null, headLines: [] }).rule, 'entry');
  // Rule 5: nothing applies (no scenario, no sentence naming two joined parts, no starting entry with a line out): nothing picked at all.
  const bare = firstFlow(base({ parts: PARTS.map(p => ({ ...p, entries: [], entryRows: [] })) }));
  assert.deepEqual(bare, { rule: null, kept: false, candidates: [], index: -1, flow: null });
  // A scenario's lines: its relations in link order, its recorded heads' words at the start and the end, its one branch with the condition.
  const sc = firstFlow(all).flow;
  assert.deepEqual([sc.parts, sc.lines, sc.start, sc.end, sc.branch], [['desk', 'mix', 'oven'], ['l1', 'l2'], { part: 'desk', text: '손님 주문' }, { part: 'oven', text: '빵 한 판' }, { line: 'l2', part: 'mix', text: '반죽이 충분하면' }]);
});

test('FF-2 a gap stays a gap: only lines from a named step to the next, never a bridge, never the other way', () => {
  // The sentence names 주문 창구, 판매 장부, 반죽 배합기 in that order: desk → book has no line (a path desk→mix→oven→book exists, never
  // used); book → mix has none (l8 runs mix → book: against the sentence, never picked): no lines at all, so no candidate.
  assert.equal(namedFlow('주문 창구에서 받은 것을 판매 장부에 적고 반죽 배합기로 보낸다', base()), null);
  assert.deepEqual(flowCandidates('summary', base({ summaryFlow: '주문 창구에서 받은 것을 판매 장부에 적고 반죽 배합기로 보낸다' })), []);
  // A gap among picked lines: desk → book gap, book … (nothing), oven → book drawn.
  const g = namedFlow('주문 창구, 그 뒤 판매 장부를 보고 오븐 굽기 단계가 판매 장부에 쓴다', base());
  assert.equal(g, null, 'the sentence names 판매 장부 first: its later naming is no second step');
  const f = namedFlow('주문 창구 다음 오븐 굽기 단계, 그 뒤 판매 장부', base({ lines: LINES.filter(l => l.id !== 'l6') }));
  assert.deepEqual([f.parts, f.lines, f.gaps], [['desk', 'oven', 'book'], ['l3'], [['desk', 'oven']]]);
  // A forward line skipping a named step (desk → oven, l6) is neither picked nor context: it would read as bridging the flow.
  const c = flowCandidates('summary', base({ summaryFlow: '주문 창구 → 반죽 배합기 → 오븐 굽기 단계' }))[0];
  assert.deepEqual(c.lines, ['l1', 'l2']);
  assert.ok(!c.lines.includes('l6') && !c.context.includes('l6'));
  // The way back between its parts (oven → mix, conditional) is its context; a conditional exit of a part the flow leaves unconditionally is not.
  assert.deepEqual(c.context, ['l7']);
  assert.equal(namedFlow('주문 창구만 쓴다', base()), null);
  assert.equal(namedFlow('새벽 타이머와 판매 장부', base()), null);
});

test('FF-3 a candidate needs one drawn line: a relation the view does not draw lets the next rule apply', () => {
  const inp = base({ summaryFlow: '주문 창구 → 반죽 배합기', headLines: ['오븐 굽기 단계가 판매 장부에 쓴다'] });
  assert.equal(firstFlow(inp).rule, 'summary');
  assert.equal(firstFlow({ ...inp, drawn: new Set(['l3']) }).rule, 'head', 'l1 is not drawn here (inside a folded part): the summary gives nothing');
  assert.equal(firstFlow({ ...inp, drawn: new Set() }).rule, null);
});

test('FF-4 the person\'s choice is kept over the rules; 「전체 관계」 is a choice too; a choice whose words are gone falls back', () => {
  const inp = base({ summaryFlow: '주문 창구 → 반죽 배합기', headLines: ['반죽 배합기가 오븐 굽기 단계로', '오븐 굽기 단계가 판매 장부에'] });
  const heads = flowCandidates('head', inp);
  assert.equal(heads.length, 2);
  const kept = firstFlow({ ...inp, kept: { rule: 'head', key: heads[1].key } });
  assert.deepEqual([kept.rule, kept.kept, kept.index, kept.candidates.length, kept.flow.lines], ['head', true, 1, 2, ['l3']]);
  assert.equal(sourceText(kept), '선택한 보기 · 기록의 첫 구조');
  const all = firstFlow({ ...inp, kept: { rule: 'all', key: '' } });
  assert.deepEqual([all.rule, all.kept, all.flow, all.candidates.length, sourceText(all)], ['all', true, null, 1, '전체 관계'], 'nothing drawn; the first rule\'s lines offered to come back to');
  const gone = firstFlow({ ...inp, kept: { rule: 'head', key: 'head:지워진 줄' } });
  assert.deepEqual([gone.rule, gone.kept], ['summary', false]);
  // Kept with the map's first view record: read back as written, a broken one read as none.
  const rec = { ...recordOf(firstView({ firstLines: [], parts: [], lines: [] }), 'auto'), flow: { rule: 'head', key: heads[1].key } };
  assert.deepEqual(readFirstView(writeFirstView(null, 'm1', rec), 'm1').flow, { rule: 'head', key: heads[1].key });
  assert.equal(readFirstView(writeFirstView(null, 'm1', { ...rec, flow: { rule: 'centre', key: 'x' } }), 'm1').flow ?? null, null);
  assert.equal(readFirstView(JSON.stringify({ m1: { lens: 'data' } }), 'm1').flow ?? null, null);
});

test('FF-5 a recorded start: its part and the relations the record draws out of it; a fan over three reads at the context weight', () => {
  const cs = flowCandidates('entry', base());
  assert.deepEqual(cs.map(c => c.parts), [['cli', 'oven'], ['timer', 'mix']], 'one line each: hand-run order (1) first, then the timer (N02)');
  assert.deepEqual(cs[0].lines, ['l5']);
  assert.deepEqual([cs[0].start, cs[0].end, cs[0].context, cs[0].soft], [{ part: 'cli', text: 'python bake.py' }, null, [], false]);
  assert.equal(cs[0].source, '기록된 시작');
  assert.deepEqual(flowCandidates('entry', base({ lines: LINES.filter(l => l.id !== 'l5' && l.id !== 'l4') })), [], 'a start with no line out is nothing');
  // Evidence first among entries: the start with more drawn lines out goes first; a fan of more than three is soft.
  const fan = ['desk', 'oven', 'book', 'mix'].map((to, i) => L(`t${i}`, 'timer', to));
  const ec = flowCandidates('entry', base({ lines: [...LINES, ...fan] }));
  assert.deepEqual([ec[0].parts[0], ec[0].drawnLines, ec[0].soft, ENTRY_SOFT_OVER], ['timer', 5, true, 3]);
});

test('FF-6 the top sentence is the newest record\'s own C-SUMMARY first sentence; a line break after an evidence group ends a sentence', () => {
  const body = (t) => t.split('\n').map((text, i) => ({ text, from: i * 100 }));
  const older = { id: 'r1', body: body('옛 문장이다(F01). 옛 흐름이다.') };
  const newer = { id: 'r2', body: body('빵집 주문 앱은 손님이 주문하고 제빵사가 굽는 데 쓴다(F01+E02). 핵심 흐름은 주문 창구 → bake.py → 판매 장부다(F03).') };
  const s = summarySource([older, newer, { id: 'r3', body: [] }]);
  assert.deepEqual([s.record, s.first, s.shown, s.flow], ['r2', '빵집 주문 앱은 손님이 주문하고 제빵사가 굽는 데 쓴다(F01+E02).', '빵집 주문 앱은 손님이 주문하고 제빵사가 굽는 데 쓴다.', '핵심 흐름은 주문 창구 → bake.py → 판매 장부다(F03).']);
  assert.deepEqual(summarySentences('train.py와 ckpt.pt를 쓰는 도구이다(F02).\n핵심 흐름은 a → b이다(F05).'), ['train.py와 ckpt.pt를 쓰는 도구이다(F02).', '핵심 흐름은 a → b이다(F05).']);
  // Review note: no full stop, but a line break right after the evidence group: two sentences.
  assert.deepEqual(summarySentences('빵을 굽는 앱(F01)\n주문 창구 → 오븐 순으로 돈다(F02)'), ['빵을 굽는 앱(F01)', '주문 창구 → 오븐 순으로 돈다(F02)']);
  assert.deepEqual(summarySentences('빵을 굽는\n앱이다(F01).'), ['빵을 굽는 앱이다(F01).'], 'a plain line break inside a sentence ends nothing');
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
  assert.deepEqual(flowParts('retrain.pyc', parts), [], 'an ASCII word counts only whole');
});

test('FF-9 the hub fold: a view card with six or more drawn lines off the view folds them behind one chip', () => {
  const ls = (n, card) => Array.from({ length: n }, (_, i) => ({ key: `${card}${i}`, from: card, to: `x${i}`, flow: false }));
  const lines = [...ls(6, 'a'), ...ls(5, 'b'), { key: 'f', from: 'a', to: 'b', flow: true }];
  const folds = hubFolds(['a', 'b'], lines);
  assert.equal(HUB_FOLD_MIN, 6);
  assert.deepEqual([...folds.keys()], ['a']);
  assert.equal(folds.get('a').length, 6, 'the view\'s own line is never folded');
  assert.deepEqual([foldWord(6, false), foldWord(6, true)], ['다른 연결 6개', '접기']);
});

test('FF-10 the switcher: 「먼저 볼 연결」, the drawn lines in their own direction, the source by rule, 보기 i/N', () => {
  const inp = base({ headLines: ['반죽 배합기가 오븐 굽기 단계로', '오븐 굽기 단계가 판매 장부에'] });
  assert.equal(FLOW_CONTROL, '먼저 볼 연결');
  assert.equal(switcherText(firstFlow(inp), name), '먼저 볼 연결: 반죽 배합기 → 오븐 굽기 단계 · 기록의 첫 구조 · 보기 1/2');
  assert.equal(switcherText(firstFlow(base({ summaryFlow: '주문 창구 → 반죽 배합기' })), name), '먼저 볼 연결: 주문 창구 → 반죽 배합기 · 기록이 설명한 흐름');
  assert.equal(switcherText(firstFlow(base({ summaryFlow: '주문 창구와 반죽 배합기가 함께 일한다' })), name), '먼저 볼 연결: 주문 창구 → 반죽 배합기 · 요약에 나온 연결', 'no stated order: only 「요약에 나온 연결」');
  assert.equal(switcherText(firstFlow(base()), name), '먼저 볼 연결: bake.py 수동 실행에서 나가는 연결 1개 · 기록된 시작 · 보기 1/2');
  assert.equal(switcherText(firstFlow(base({ scenarios: [SC] })), name), '먼저 볼 연결: 주문 창구 → 반죽 배합기 → 오븐 굽기 단계 · 기록된 시나리오 · 아침 주문 · 설계 · 완결');
  assert.equal(switcherText({ rule: 'all', kept: true, candidates: [], index: -1, flow: null }), null);
  assert.deepEqual([statesOrder('A 다음에 B'), statesOrder('A → B'), statesOrder('A와 B가 있다')], [true, true, false]);
  assert.deepEqual(Object.values(FLOW_SOURCE).sort(), ['기록된 시나리오', '기록된 시작', '기록의 첫 구조', '기록이 설명한 흐름', '선택한 보기', '요약에 나온 연결', '전체 관계'].sort());
});

test('FF-11 the app reads the sentence from the record, draws only existing lines, and fades card text only under 상태·공백', async () => {
  const app = await readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  const whole = app.slice(app.indexOf('/* ---------- the first screen\'s focus (beauty v5'), app.indexOf('/* ---------- the scenario on the map'));
  assert.ok(whole.length > 2000);
  const block = whole.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(block, /latestMapSummary|brief|\.spine|degree|central/, 'never the model\'s summary, the person\'s brief, the computed spine or a centrality');
  assert.doesNotMatch(block, /svg\('path'|createElementNS/, 'nothing new drawn on the lines: classes on the existing ones only');
  assert.doesNotMatch(block, /\(C-SUMMARY\)|먼저 보는 흐름/, 'no table name and no old control name on screen');
  assert.match(block, /출처: 기록 요약의 첫 문장/, 'the top sentence\'s hover says it is the record\'s summary');
  assert.match(app, /own\(document\.getElementById\('focus-top'\), 6\)/, 'the camera\'s fit keeps the map off the top line');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.match(html, /<div id="scope-sticky"[^>]*><\/div>\s*<div id="focus-top" class="focus-top" role="region" aria-label="이 지도가 하는 일과 먼저 볼 연결" hidden><\/div>/);
  const css = (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const rule = (sel) => css.split('\n').find(l => l.startsWith(sel)) ?? '';
  assert.match(rule('#space.ff-on.ff-rest .world .edge.ff-flow:not(.on):not(.lg-hover):not(.picked) {'), /--bw: 3;/);
  assert.match(rule('#space.ff-on.ff-rest .world .edge.ff-flow:not(.on):not(.lg-hover):not(.picked) .edge-line'), /stroke: var\(--accent\)/);
  assert.match(rule('#space.ff-on.ff-rest .world .edge.ff-ctx:not(.on)'), /--bw: 2\.25;/);
  assert.match(rule('#space.ff-on.ff-rest .world .edge.lf-bg:not(.ff-flow)'), /--bw: 1\.15;/);
  const off = css.split('\n').filter(l => /#space\.ff-on.*(lens-off|lg-fade)/.test(l)).join('\n');
  assert.match(off, /opacity: 1; filter: none;/, 'a card off the lens keeps its words whole in focus');
  assert.match(css, /\.focus-top \.ft-sentence \{[^}]*font-size: 19px;[^}]*-webkit-line-clamp: 2;/);
});

test('FF-12 alternatives in one step are never paired with each other (review #1)', () => {
  const parts = [P('a', '수집기'), P('pg', 'PostgreSQL'), P('ch', 'ClickHouse'), P('kf', 'Kafka 브로커'), P('w', '화면')];
  const lines = [L('a1', 'a', 'pg'), L('a2', 'a', 'ch'), L('a3', 'a', 'kf'), L('kc', 'kf', 'ch'), L('cw', 'ch', 'w')];
  const inp = { parts, lines };
  assert.deepEqual(flowSteps('수집기가 PostgreSQL·ClickHouse·Kafka 중 하나에 저장 → 화면', parts), [['a'], ['pg', 'ch', 'kf'], ['w']]);
  assert.deepEqual(flowSteps('수집기가 PostgreSQL, ClickHouse, Kafka 중 하나에 쓴다', parts), [['a'], ['pg', 'ch', 'kf']]);
  assert.deepEqual(flowSteps('PostgreSQL 또는 ClickHouse', parts), [['pg', 'ch']]);
  assert.deepEqual(flowSteps('PostgreSQL, ClickHouse에 쓴다', parts), [['pg'], ['ch']], 'a comma alone is no alternative');
  const f = namedFlow('수집기가 PostgreSQL·ClickHouse·Kafka 중 하나에 저장 → 화면', inp);
  assert.deepEqual(f.lines, ['a1', 'a2', 'a3', 'cw']);
  assert.ok(!f.lines.includes('kc'), 'Kafka → ClickHouse joins two alternatives: never picked');
  const c = flowCandidates('summary', { ...inp, summaryFlow: '수집기가 PostgreSQL·ClickHouse·Kafka 중 하나에 저장 → 화면' })[0];
  assert.ok(!c.context.includes('kc'), 'nor read as a way back');
  assert.equal(switcherText(firstFlow({ ...inp, summaryFlow: '수집기가 PostgreSQL·ClickHouse·Kafka 중 하나에 저장 → 화면' }), id => parts.find(p => p.id === id).name),
    '먼저 볼 연결: 수집기 → PostgreSQL, ClickHouse, Kafka 브로커 → 화면 · 기록이 설명한 흐름');
});

test('FF-13 name order never sets direction: a line against the sentence is never picked, and the switcher follows the drawn lines', () => {
  // The sentence names ClickHouse before Kafka; the map's line runs Kafka → ClickHouse: nothing from that sentence.
  const parts = [P('ch', 'ClickHouse'), P('kf', 'Kafka 브로커'), P('w', '화면')];
  const lines = [L('kc', 'kf', 'ch'), L('cw', 'ch', 'w')];
  assert.equal(namedFlow('ClickHouse → Kafka 브로커', { parts, lines }), null);
  assert.deepEqual(flowCandidates('summary', { parts, lines, summaryFlow: 'ClickHouse → Kafka 브로커' }), []);
  // A sentence with one line along it and one against: the one along is picked; the one against is its context (a way back), and the
  // switcher names the drawn line in its own direction.
  const c = flowCandidates('summary', { parts, lines: [...lines, L('wk', 'w', 'kf')], summaryFlow: '화면 → Kafka 브로커 → ClickHouse' })[0];
  assert.deepEqual([c.lines, c.context, c.chain], [['wk', 'kc'], ['cw'], [['w'], ['kf'], ['ch']]], 'ClickHouse → 화면 runs back to an earlier step: context, drawn its own way');
  const d = flowCandidates('summary', { parts, lines, summaryFlow: 'Kafka 브로커와 ClickHouse, 그 뒤 화면' })[0];
  assert.deepEqual([d.lines, d.chain], [['kc', 'cw'], [['kf'], ['ch'], ['w']]]);
  // A drawn run in its own direction even when the sentence names its parts the other way round inside one candidate.
  const e = flowCandidates('summary', { parts: [...parts, P('z', '보관소')], lines: [...lines, L('wz', 'w', 'z')], summaryFlow: 'Kafka 브로커 → ClickHouse → 화면 → 보관소' })[0];
  assert.equal(switcherText({ rule: 'summary', kept: false, candidates: [e], index: 0, flow: e }, id => ({ ch: 'ClickHouse', kf: 'Kafka 브로커', w: '화면', z: '보관소' })[id]),
    '먼저 볼 연결: Kafka 브로커 → ClickHouse → 화면 → 보관소 · 기록이 설명한 흐름');
});

test('FF-14 no automatic 시작 or 결과: only a C-ENTRY row and a scenario\'s recorded start and end are said', () => {
  const s = flowCandidates('summary', base({ summaryFlow: '주문 창구 → 반죽 배합기 → 오븐 굽기 단계 → 판매 장부' }))[0];
  assert.deepEqual([s.start, s.end], [null, null], 'the first and the last named part carry nothing');
  const h = flowCandidates('head', base({ headLines: ['주문 창구 → 반죽 배합기'] }))[0];
  assert.deepEqual([h.start, h.end], [null, null]);
  const e = flowCandidates('entry', base())[0];
  assert.deepEqual([e.start, e.end], [{ part: 'cli', text: 'python bake.py' }, null], 'a C-ENTRY row backs 기록된 시작');
  const sc = flowCandidates('scenario', base({ scenarios: [{ ...SC, start: null, end: null }] }))[0];
  assert.deepEqual([sc.start, sc.end], [null, null], 'a scenario with no recorded heads says nothing either');
});

test('FF-15 a note passes the labels\' row-ID guard: a branch only in plain words, dropped when nothing plain is left (review #2)', () => {
  assert.equal(branchWords('CD01이 거짓일 때'), null, 'without the record\'s words for CD01 nothing plain is left');
  const plain = t => t.replace(/CD01/g, 'pb.skipBootstrap()');
  assert.equal(branchWords('CD01이 거짓일 때', { plain }), 'pb.skipBootstrap()이 거짓일 때');
  assert.equal(branchWords('CD01이 거짓일 때', { plain: () => null }), null);
  assert.equal(branchWords(COND_UNSAID), null, 'a condition the record left unsaid is no note');
  assert.equal(branchWords('변형 ‘로컬 실행’'), null, 'a variant\'s name is no condition');
  assert.equal(branchWords('반죽이 충분하면'), '반죽이 충분하면');
  // On a candidate: a conditional line whose words carry an ID the record does not gloss gives no branch; the next plain one does.
  const lines = LINES.map(l => (l.id === 'l1' ? { ...l, when: 'CD07이 참이면' } : l));
  const c = flowCandidates('summary', base({ lines, summaryFlow: '주문 창구 → 반죽 배합기 → 오븐 굽기 단계' }))[0];
  assert.deepEqual(c.branch, { line: 'l7', part: 'oven', text: '덜 익으면' });
  // The entry's name too: a start named only by a row ID shows the bare mark.
  const parts = PARTS.map(p => (p.id === 'cli' ? { ...p, entryRows: [{ kind: 'command', name: 'N01', order: 1, ref: 'N01' }] } : p));
  assert.deepEqual(flowCandidates('entry', base({ parts }))[0].start, { part: 'cli', text: null });
});

test('FF-16 the basis sentence shows under the switcher when it is not the top one; rest-only weights; 상태·공백 keeps its fade', async () => {
  const app = await readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  const whole = app.slice(app.indexOf('/* ---------- the first screen\'s focus (beauty v5'), app.indexOf('/* ---------- the scenario on the map'));
  assert.match(whole, /if \(c\.text && shownSentence\(c\.text\) !== s\?\.shown\)/, 'the basis shows only when it differs from the top sentence');
  assert.match(whole, /class: 'ft-basis', title: `\$\{FLOW_CONTROL\}의 근거 문장/, 'whole in its hover');
  assert.match(app, /ffRest = ffLit\(\)/, 'the accent heads only at rest');
  assert.match(whole, /const ffLit = \(\) => ffActive\(\) && !selected && !planView\.isOpen\(\) && !ffLensPicked/);
  assert.match(app, /setLens\(b\.dataset\.lens as LensId, true\)/, 'a lens the person picks steps the lines back');
  assert.match(whole, /ftFull = el\.offsetHeight/, 'the fit measures the sentence whole even while it steps back');
  const css = (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');
  const ff = css.split('\n').filter(l => /#space\.ff-on/.test(l));
  for (const l of ff.filter(x => /ff-flow|ff-ctx|lf-bg/.test(x) && /--bw|stroke:/.test(x))) assert.match(l, /^#space\.ff-on\.ff-rest/, `weights at rest only: ${l.slice(0, 60)}`);
  assert.ok(ff.some(l => l.startsWith('#space.ff-on.ff-rest.ff-soft .world .edge.ff-flow') && /--bw: 2\.25;/.test(l)), 'a picked lens: the lines at the context weight');
  for (const l of ff.filter(x => /lens-off|lg-fade/.test(x))) assert.match(l, /#space\.ff-on:not\(\.lens-state\)/, '상태·공백 keeps its card fade');
  assert.ok(ff.some(l => /edge-labels > :not\(\.ff-keep\):not\(\.edge-cue\):not\(\.near\) \{ visibility: hidden; \}/.test(l)), 'background labels wait for a hover');
  assert.match(css, /\.focus-top \.ft-basis \{[^}]*white-space: nowrap;[^}]*text-overflow: ellipsis;/);
});

test('FF-17 the fold: N is exactly the lines a chip hides; a line two hubs hold shows while either is open', () => {
  const folds = new Map([['a', ['x1', 'x2', 's']], ['b', ['y1', 's']]]);
  const closed = foldedLines(folds, new Set());
  assert.deepEqual([[...closed.hide].sort(), closed.byHub.get('a'), closed.byHub.get('b')], [['s', 'x1', 'x2', 'y1'], ['x1', 'x2', 's'], ['y1', 's']]);
  const openA = foldedLines(folds, new Set(['a']));
  assert.deepEqual([[...openA.hide], openA.byHub.get('a'), openA.byHub.get('b')], [['y1'], [], ['y1']], 'b\'s chip counts only what it still hides');
});

test('FF-18 the record\'s own words name the parts first: bound rows\' entries, files and steps; a word two parts hold picks none', () => {
  const pad = n => String(n).padStart(2, '0');
  const RECORD = 'AF5-ff18a1b2', BASIS = 'f18c0de';
  const headOf = n => `〔기록 ${RECORD} · 쪽 ${n} · 기준 ${BASIS} · 앞 쪽 ${n > 1 ? n - 1 : '—'}〕 이름 시험 기록 v5 (시험 세션, 2026-11-13 10:${pad(n)})`;
  const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
  const NAMES = ['수집기', '정리기', '저장소'];
  const page1 = [headOf(1), table('C-SRC', [['F01', 'src/gather/gatherer.ts', 'B01', '읽음', '수집'], ['F02', 'src/tidy/sweepRows.ts', 'B02', '읽음', '정리'], ['F03', 'src/shared/common_util.ts', 'B01·B02', '읽음', '공용']]),
    table('C-EVID', [['E01', '파일', 'F01', 'main()', '연다']]), table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, `값 ${k + 1}`, 'F01'])), 'C-SUMMARY 요약\n이름 시험 서비스 (F01).',
    table('C-PART', NAMES.map((n, k) => [`B${pad(k + 1)}`, n, '처리 · 계산', `${n}의 일`, 'F01', '구현됨', 'F01'])),
    table('C-LINK', [['LN01', 'B01', 'B02', '자료', '호출마다', '—', '같은 프로세스', '정의된 관계', 'F01'], ['LN02', 'B02', 'B03', '정리본', '호출마다', '—', '같은 프로세스', '정의된 관계', 'F02']]),
    table('C-STEP', [['B01:S01', '모으기 단계', '모은다', 'gatherAll, helper_fn', '—', '—', 'F01'], ['B02:S01', '줄 고르기', '고른다', 'helper_fn', '—', '—', 'F02']]),
    table('C-ENTRY', [['N01', 'POST /api/gather', 'B01', '사용자', 'HTTP·WS 요청', '—', 'F01']]),
    table('C-END', [['C-HEAD', '끝남', '—', '—', '—'], ['C-PART', '끝남', 'B01–B03', '—', '—'], ['C-LINK', '끝남', 'LN01–LN02', '—', '—'], ['C-STEP', '끝남', 'B01:S01–B02:S01', '—', '—'], ['C-ENTRY', '끝남', 'N01', '—', '—']]), '완료 단계: 첫 구조 완료'].join('\n');
  let p = parseProject(JSON.stringify(D.pasteRecord(D.addArea({ ...D.createProject(), name: '이름 시험' }, '기존 부분', '사람이 만든 부분'), page1, null).project));
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP7_SCHEMA), ask = inp.ask;
  const at = words => { for (const r of ask.records) { const s = r.spans.find(x => x.t.trimStart().startsWith(words)); if (s) return s.s; } throw new Error(`no piece ${words}`); };
  const wire = { summary: '', candidates: [], gaps: [], matches: [], material: [],
    parts: NAMES.map((n, k) => ({ ref: `new:b${k + 1}`, name: n, parent: null, role: `${n}의 일을 맡는다.`, roleAboutAt: null, roleReplaces: null, basis: [at(`|B${pad(k + 1)}|`)], claims: [] })),
    relations: [{ from: 'new:b1', to: 'new:b2', kind: 'flow', note: '자료', at: at('|LN01|') }, { from: 'new:b2', to: 'new:b3', kind: 'flow', note: '정리본', at: at('|LN02|') }] };
  p = M.applyReading(p, inp, M.validateMapReply(wire, ask), { id: 'R_ff18', at: '2026-11-13T01:00:00.000Z', model: 'stub', prompt: 'm7-000000000052', hash: 'f'.repeat(64) }).project;
  const id = n => p.space.areas.find(a => a.name === n && !a.archived)?.id;
  assert.ok(id('수집기') && id('정리기'), 'the reading placed the parts');
  const words = recordWords(p, p.pasted[0].id), of = w => words.find(x => x.word === w)?.part ?? null;
  assert.equal(of('/api/gather'), id('수집기'), 'an entry point\'s code word');
  assert.equal(of('gatherAll'), id('수집기'), 'a step\'s function');
  assert.equal(of('sweepRows'), id('정리기'), 'a file\'s stem');
  assert.equal(of('모으기 단계'), id('수집기'), 'a step\'s name of four or more characters');
  assert.equal(of('helper_fn'), null, 'two parts\' steps use it: it picks none');
  assert.equal(of('common_util.ts'), null, 'a file of two parts belongs to neither');
  assert.equal(of('POST'), null, 'a plain word is no code word');
  assert.deepEqual([codeLike('runQuery'), codeLike('/api/send'), codeLike('fetch'), codeLike('POST')], [true, true, false, false]);
  const parts = [P(id('수집기'), '수집기'), P(id('정리기'), '정리기'), P(id('저장소'), '저장소')];
  assert.deepEqual(flowSteps('/api/gather로 받아 sweepRows가 다듬는다', parts, [], words), [[id('수집기')], [id('정리기')]]);
  assert.deepEqual(flowSteps('/api/gather로 받아 sweepRows가 다듬는다', parts, [], []), [], 'without the record\'s words the sentence names no part');
});

test('FF-19 the switcher names the cards drawn now: a part inside a folded group is its group, a line inside one card is drawn as nothing', () => {
  // 반죽 배합기 and 오븐 굽기 단계 are drawn inside one folded group 「굽기 묶음」: the line between them is inside one card.
  const rep = id => (id === 'mix' || id === 'oven' ? 'grp' : id);
  const nm = id => (id === 'grp' ? '굽기 묶음' : name(id));
  const f = firstFlow(base({ summaryFlow: '주문 창구 → 반죽 배합기 → 오븐 굽기 단계 → 판매 장부', rep }));
  assert.deepEqual([f.flow.chain, f.flow.more], [[['desk'], ['grp'], ['book']], 0], 'desk → mix drawn as desk → 굽기 묶음; mix → oven inside it; oven → book drawn as 굽기 묶음 → book');
  assert.equal(switcherText(f, nm), '먼저 볼 연결: 주문 창구 → 굽기 묶음 → 판매 장부 · 기록이 설명한 흐름');
  assert.equal(branchWords('(validateStatus(status))'), 'validateStatus(status)', 'a condition written whole in brackets reads without them');
  assert.equal(branchWords('(a) 또는 (b)'), '(a) 또는 (b)');
});
