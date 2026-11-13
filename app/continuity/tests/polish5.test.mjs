// Polish 5 of the first screen (after beauty v5 focus and lanes): the top sentence from the record about the latest target time, the
// focus notes clear of line labels and lane captions, plan words kept in every cut, the fit stateless across maps, code labels as quoted
// code. Fictional records only. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { summarySource, byTarget } from '../dist/public/client/first-flow.js';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import * as T from '../dist/public/shared/record-table.js';
import { parseProject } from '../dist/public/shared/validation.js';

const app = () => readFile(new URL('../src/client/app.ts', import.meta.url), 'utf8');
const pad = n => String(n).padStart(2, '0');
const headOf = (record, basis, date) => `〔기록 ${record} · 쪽 1 · 기준 ${basis} · 앞 쪽 —〕 성장 시험 기록 v5 (시험 세션${date ? ` · 기준 시점 ${date} 10:00:00 +0000` : ''} · 작성 2026-11-13)`;
const table = (id, rows) => { const d = T.V5_TABLE_DEFS.get(id); return [`${id} ${d.title}`, T.headerLine(d), `|${d.columns.map(() => '---').join('|')}|`, ...rows.map(r => `|${r.join('|')}|`)].join('\n'); };
function record(id, basis, date, summary, names) {
  return [headOf(id, basis, date), table('C-SRC', [['F01', 'src/', 'B01', '읽음', '코드']]), table('C-EVID', [['E01', '보고', 'c0ffee2 커밋', '—', '옮김']]),
    table('C-HEAD', T.HEAD_ITEMS.map((item, k) => [item, `값 ${k + 1}`, 'F01'])), `C-SUMMARY 요약\n${summary}`,
    table('C-PART', names.map((n, k) => [`B${pad(k + 1)}`, n, '처리 · 계산', `${n}의 일`, 'F01', '구현됨', 'F01'])),
    table('C-END', [['C-HEAD', '끝남', '—', '—', '—'], ['C-PART', '끝남', `B01–B${pad(names.length)}`, '—', '—']]), '완료 단계: 첫 구조 완료'].join('\n');
}

test('P5-1 the top sentence comes from the record about the latest target time; paste order only where a date is missing or equal', () => {
  // Record A about 2020-11-18 pasted first; record B, a backlog record about 2015-12-20, pasted after it.
  let p = D.addArea({ ...D.createProject(), name: '성장 시험' }, '기존 부분', '사람이 만든 부분');
  p = D.pasteRecord(p, record('AF5-p5a1b2c3', 'a5c0de1', '2020-11-18', '새 판의 성장 시험 서비스다 (F01). 수집기 → 정리기 순서로 흐른다 (F01).', ['수집기', '정리기']), null).project;
  p = D.pasteRecord(p, record('AF5-p5e1e2e3', 'e5c0de3', '2015-12-20', '옛 판의 성장 시험 서비스였다 (F01). 수집 서비스가 정리기에 넘긴다 (F01).', ['수집 서비스', '정리기']), null).project;
  p = parseProject(JSON.stringify(p));
  const [a, b] = p.pasted, tg = M.pastedTargets(p.pasted);
  assert.deepEqual([tg.get(a.id), tg.get(b.id)], ['2020-11-18', '2015-12-20'], 'each pasted text\'s 기준 시점');
  const recs = p.pasted.map(x => { const t = T.readRecordTables(x.text); return { id: x.id, target: tg.get(x.id), body: (t.byId.get('C-SUMMARY') ?? []).filter(y => y.body.length).at(-1)?.body ?? [] }; });
  const s = summarySource(recs);
  assert.equal(s.record, a.id, 'the backlog record pasted later never speaks for the map');
  assert.equal(s.shown, '새 판의 성장 시험 서비스다.');
  assert.match(s.flow, /수집기 → 정리기/, 'its core-flow sentence comes from the same record');
  // Paste order among the undated and where the dates are equal; an undated record never outranks a dated one (polish 6).
  const body = t => [{ text: t, from: 0 }];
  assert.equal(summarySource([{ id: 'x', target: '2020-01-01', body: body('앞이다.') }, { id: 'y', target: null, body: body('뒤다.') }]).record, 'x');
  assert.equal(summarySource([{ id: 'x', target: '2020-01-01', body: body('앞이다.') }, { id: 'y', target: '2020-01-01', body: body('뒤다.') }]).record, 'y');
  assert.equal(summarySource([{ id: 'x', body: body('앞이다.') }, { id: 'y', body: body('뒤다.') }]).record, 'y', 'no dates at all: paste order, as before');
  assert.deepEqual(byTarget([{ id: 'n', target: '2024-05-01' }, { id: 'o', target: '2019-01-01' }, { id: 'm', target: '2021-03-03' }]).map(x => x.id), ['o', 'm', 'n']);
});

test('P5-1b the app passes each record\'s target time and reads the words and the first-structure row from the sentence\'s record', async () => {
  const a = await app();
  assert.match(a, /target: tg\.get\(p\.id\) \?\? null, body: table\?\.body/, 'summaryOf carries each record\'s 기준 시점');
  assert.match(a, /const hq = headQuote\(own \? \[\.\.\.hrecs\.filter\(x => x\.id !== own\), \.\.\.hrecs\.filter\(x => x\.id === own\)\] : hrecs\);/, 'the head quote prefers the sentence\'s record');
  assert.match(a, /words: ffWords\(o, ffSrc\?\.record \?\? hq\?\.record \?\? null\)/, 'the words come from the sentence\'s record');
});

const css = async () => (await readFile(new URL('../public/styles.css', import.meta.url), 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');

test('P5-2 a focus note or fold chip never covers a line label, badge or lane caption (axios 갈림 over 요청 인터셉터 · 기동 · bind)', async () => {
  const a = await app();
  assert.match(a, /const marks = shownMarkRects\(world\);\n  taken\.push\(\.\.\.marks\.map\(m => m\.r\), \.\.\.bandRects\);/, 'the shown labels and the lane captions are taken places');
  assert.match(a, /for \(const el of world\.querySelectorAll<HTMLElement>\('\.edge-labels > \*'\)\)/);
  assert.match(a, /const gave = !free\(at, own\);/, 'a card\'s own chip with no free place makes the labels under it give way');
  assert.match(a, /m\.el\.classList\.add\('ff-gave'\)/);
  assert.match(a, /const along = pts\.flatMap\(\(p, i\) => \(i \? \[\{ x: \(pts\[i - 1\]!\.x \+ p\.x\) \/ 2/, 'the branch note tries the whole route, then over or under its card');
  assert.match(await css(), /\.space \.edge-labels > \.ff-gave \{ visibility: hidden; \}/);
});

test('P5-3 a cut never loses a plan word: the notes\' 48 characters, the top sentence\'s clamp and the basis line\'s ellipsis', async () => {
  const { clipKeepPlan, planCutNeeded } = await import('../dist/public/shared/studio.js');
  // The box's own measure: 10 units per character; two lines of 160 hold about 30 characters.
  const w = t => [...t].length * 10, s = '수집기는 원문을 모아 정리기에 넘기고 검색 색인은 다음 판에서 붙이기로 계획되어 있다';
  assert.ok(planCutNeeded(s, 300, w), 'a plain cut of the clamp would drop 「계획」');
  const c = clipKeepPlan(s, 300, w);
  assert.ok(c.includes('계획'), c); assert.ok(w(c) <= 300, c);
  const a = await app();
  assert.match(a, /h\('span', \{ class: 'ff-note-text' \}, clipKeepPlan\(text, 48, undefined, false, KEEP_WORD\)\)/, 'a note\'s 48 characters keep the plan word');
  assert.doesNotMatch(a, /text\.length > 48 \? `\$\{text\.slice\(0, 47\)\}…`/, 'never the plain 47-character cut');
  assert.match(a, /function keepPlanFit\(el: HTMLElement, text: string, lines: number, less = 0, words = false\): string/);
  // v11 (ruling F8 Q2): the top sentence is never cut (a whole sentence of the summary or none, v11-text); the basis line keeps its cut.
  assert.match(a, /if \(basis\) t\.textContent = keepPlanFit\(basis, t\.dataset\.text \?\? '', 1, \(lead\?\.offsetWidth \?\? 0\) \+ 6, true\);/,
    'the basis line measured to its box');
  assert.match(a, /sent\.dataset\.text = it\.text \?\? '';/); assert.match(a, /class: 'ft-basis-t', 'data-text': said/);
  assert.match(a, /t1 = keepPlanFit\(nt, t0, 2\); fillLabel\(nt, t1\);/, 'a note\'s two clamped lines too');
});

test('P5-4 at rest the first screen\'s lines are routed as the summary strokes they stand for (hyperfine 19 → 5 crossings)', async () => {
  const a = await app();
  assert.match(a, /const s = restSums\.find\(x => x\.from === e\.from && x\.to === e\.to && x\.ids\.length === e\.ids\.length && e\.ids\.every\(id => x\.ids\.includes\(id\)\)\);/,
    'the summary stroke of the same pair and direction holding exactly its relations');
  assert.match(a, /alias\.set\(s\.key, e\.key\); return s;/);
  assert.match(a, /\.sort\(\(p, q\) => \(restAt\.get\(p\.key\) \?\? 1e9\) - \(restAt\.get\(q\.key\) \?\? 1e9\)\);/, 'in the summary\'s own order');
  assert.match(a, /const d = alias\.get\(k\) \?\? k; return \[d, d === k \? r : \{ \.\.\.r, key: d \}\]/, 'drawn back on the lit line itself');
  assert.match(a, /const ffRest = !selected && !scView && ffActive\(\)/, 'only at rest: a selection\'s or a scenario\'s lines are routed as before');
});

test('P5-5/6 the sentence shows before it steps back; the fit is the same whatever map came before; the title is never given up for the top line', async () => {
  const a = await app();
  assert.match(a, /placedInv = syncZoom\(at\.k, true\); placeEdgeLabels\(\);/, 'labels placed at the frame\'s own zoom, the tier and face fresh');
  assert.match(a, /function syncZoom\(k: number, fresh = false\): number \{/);
  assert.match(a, /tier = zoomTier\(k, fresh \? null : tier\);/); assert.match(a, /face = cardFace\(k, fresh \? null : face\);/);
  assert.match(a, /const least = Math\.max\(at\.k - FT_GIVE, at\.k >= TITLE_FLOOR_K \? TITLE_FLOOR_K : 0\) - 1e-9;/, 'the give stops at the title\'s floor');
  assert.match(a, /el\.classList\.remove\(\.\.\.FT_FORMS\); el\.style\.left = ''; el\.style\.maxWidth = ''; ftFull = el\.offsetHeight; ftPlace\(el, camera, ink\);/, 'the whole height measured at the left, never as placed before');
  // Merge v7: the growth view's room at the same scale made fitView longer; the whole function is read.
  const fit = a.slice(a.indexOf('function fitView('), a.indexOf('\n}\n', a.indexOf('function fitView(')));
  // v10: the sentence's forms with the give and the free height are first-flow sentenceRoom's.
  assert.ok(fit.indexOf('sentenceRoom(FT_SAID') > 0 && fit.indexOf('sentenceRoom(FT_SAID') < fit.indexOf("give(['ft-under'])") && fit.indexOf('for (let d = 8; d <= most && !done; d += 8)') < fit.indexOf("give(['ft-under'])"), 'room above for the sentence comes before stepping it back');
});

test('P5-7 code in a label reads as quoted code: a monospace chip, words kept as words, cut only between tokens', async () => {
  const { labelParts, tokenCut, codeToken, hasCode } = await import('../dist/public/client/line-grammar.js');
  const show = t => labelParts(t).map(p => (p.code ? `[${p.t}]` : p.t)).join('');
  assert.equal(show('iter_num %…'), '[iter_num %]…', 'the cut\'s 「…」 outside the chip');
  assert.equal(show('{out_dir}/ckpt.pt'), '[{out_dir}/ckpt.pt]');
  assert.equal(show('validateStatus(status)'), '[validateStatus(status)]');
  assert.equal(show('pb.skipBootstrap()이…'), '[pb.skipBootstrap()]이…', 'a Hangul ending stays words');
  assert.equal(show('(src/main.rs main)'), '[(src/main.rs main)]');
  assert.equal(show('REDIS_URL 있을 때'), '[REDIS_URL] 있을 때', 'words and a code part: the words kept, the code in the chip');
  for (const t of ['기동 · bind…', '명령 python…', 'HTTP 요청', '넘겨줌 3', 'PR(병합 요청)', 'type이 event·identify·performance']) assert.equal(hasCode(t), false, t);
  assert.deepEqual([codeToken('fetch'), codeToken('POST'), codeToken('runQuery'), codeToken('a_b')], [false, false, true, true]);
  assert.equal(tokenCut('len(files) == 0 이면 건너뜀', 1), 'len(files) == 0…', 'never inside a token (polish 7: the expression is one unit)');
  assert.equal(tokenCut('a_b c_d', 5), 'a_b c_d');
  const a = await app();
  // Polish 6 (P6-1 to P6-3) keeps these sites and the cut, and makes them say when no cut fits.
  assert.match(a, /function fillLabel\(el: HTMLElement, text: string, full = text\): boolean \{/);
  for (const site of ['box.append(label); if (!fillLabel(label, cutWord, word))', 'box.append(label); fillLabel(label, verb);', 'fillLabel(s.el, s.text);', "filled = fillLabel(el, text); if (!filled) continue; el.classList.toggle('glyph'"]) assert.ok(a.includes(site), site);
  assert.match(a, /for \(let n = cutCount\(text\) - 1; n >= 1; n--\) \{ const c = tokenCut\(text, n\); if \(c === null\) continue; draw\(c\); el\.dataset\.full = full; if \(!over\(\)\) return done\(true\); \}/, 'wider than its room: whole units off the end, the whole text in the tip');
  const c = await css();
  assert.match(c, /\.edge-labels code\.lb-code, \.ff-note code\.lb-code \{ font-family: ui-monospace,[^}]*font-size: 1em;[^}]*background: none;/, 'monospace at the label\'s own size (polish 7: on the label\'s own halo, no chip)');
  assert.match(c, /\.edge-labels > \.has-code \{ text-overflow: clip; \}/, 'the CSS never cuts inside a token');
});
