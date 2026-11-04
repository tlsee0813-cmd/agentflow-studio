// first-map-divided.44 (map-reading.18 kept): the program-side fixes from the blind judging of the .43 v4 maps. The records here are
// fictional (화분 물주기 도우미, written for this test, and the .43 책갈피 정리기 fixture); no model quality is claimed.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { record43, fieldsOf, variantGloss, glossVariants } from '../dist/public/shared/record-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { maintenanceOf } from '../dist/public/client/card-family.js';
import * as P from '../server/map-pipeline.mjs';
import { ofChunks, wire43 } from './fixtures/record43/wire.mjs';

// A fictional v4 record: a plant-watering helper (one chunk; every table the program reads for these fixes).
const RECORD = [
  '〔기록 AF4-0a1b2c3d · 덩이 1 · 기준 1234567〕 화분 물주기 도우미 기록 v4 (시험)',
  'C-PART 부분',
  '| 이름 | 유형 | 하는 일 한 줄 | 담당 파일·폴더 | 구현 상태 | 행 ID | 근거 |',
  '|---|---|---|---|---|---|---|',
  '| 정원사 | 사람 | 물주기를 시작한다 | — | 해당 없음 | B01 | [추정] |',
  '| 물주기 루프 | 루프·엔진 | 화분마다 물을 준다 | S/loop.py | 구현됨 | B02 | [파일: S/loop.py] |',
  '| 습도 센서 | 확장점·플러그인 | 습도를 읽는다 | S/sensor.py | 구현됨 | B03 | [파일: S/sensor.py] |',
  '| log.csv | 행 파일·저장소 | 물준 기록을 쌓는다 | D/log.csv | 구현됨 | B04 | [파일: S/log.py] |',
  '| 옛 타이머 | 타이머·일정 | 예전 주기 실행기 | S/old_timer.py | 제거됨 | B05 | [파일: CHANGELOG.md] |',
  '| 보고서 | 화면 | 기록을 표로 보여 준다 | S/report.py | 구현됨 | B06 | [파일: S/report.py] |',
  '| 펌프 | 모름 | 물을 민다 | — | 해당 없음 | B07 | [추정] |',
  'C-LINK 연결',
  '| 보내는 부분 | 받는 부분 | 넘기는 것 | 박자 | 조건·선택 | 경계 | 설계/관찰 | 근거 |',
  '|---|---|---|---|---|---|---|---|',
  '| 정원사 | 물주기 루프 | 명령 water | 한 번 | — | 사람 | 설계 | [파일: S/cli.py] |',
  '| 물주기 루프 | 펌프 | 켜기 신호 | 항목마다 | 변형 X01 | 같은 프로세스 | 설계 | [파일: S/loop.py] |',
  '| 물주기 루프 | 보고서 | D01 log.csv | 끝에 한 번 | — | 같은 프로세스 | 설계 | [파일: S/loop.py] |',
  'C-DATA 산출물',
  '| 이름 | 종류 | 필드·모양 | 만드는 부분 | 읽는 부분 | 있는 곳·쓰기 방식 | 행 ID | 근거 |',
  '|---|---|---|---|---|---|---|---|',
  '| log.csv | 저장 | pot_id, moisture, watered_at | 물주기 루프 | 보고서 | D/log.csv (덧붙임) | D01 | [파일: S/log.py] |',
  '| 습도 값 | 내부 자료 | pot_id·percent | 습도 센서 | 물주기 루프 | 메모리 | D02 | [파일: S/sensor.py] |',
  '| 알림 | 메시지·신호 | 한 줄 문장 | 물주기 루프 · 보고서 | 정원사 | 표준 출력 | D03 | [파일: S/notify.py] |',
  'C-LOOP 반복',
  '| 소유 부분 | 부모 반복 ID | 몸통 단계 ID | 반복 단위 | 횟수·계속 조건 | 종료·탈출 조건 | 행 ID | 근거 |',
  '|---|---|---|---|---|---|---|---|',
  '| 물주기 루프 | — | B02:S01–S03 | 화분마다 | len(pots) | 목록 끝 | B02:L01 | [파일: S/loop.py] |',
  '| 물주기 루프 | B02:L01 | B02:S02 | 재시도 | 최대 3번 | 흙이 젖음 | B02:L02 | [파일: S/loop.py] |',
  'C-VARIANT 변형',
  '| 공통 계약·접점 ID | 구현 부분 | 선택 주체·시점 | 선택 조건 | 함께 사용 가능 여부 | 행 ID | 근거 |',
  '|---|---|---|---|---|---|---|',
  '| B07: 켜기 | 펌프 | 사용자 설정 시작 시 | PUMP=relay | 배타 | X01 | [파일: S/pump.py] |',
  ''].join('\n');
const rowAt = head => { const from = RECORD.indexOf(head); assert.ok(from >= 0, head); const to = RECORD.indexOf('\n', from); return { record: 'N01', quote: RECORD.slice(from, to), from, to }; };
const part = (ref, name, extra = {}) => ({ ref, name, claims: [], steps: [], conditions: [], fileRoles: [], loop: null, type: null, typeQuote: null, ...extra });
const line = (from, to, head, extra = {}) => { const q = rowAt(head); return { from, to, kind: 'flow', note: '', record: 'N01', quote: q.quote, span: { from: q.from, to: q.to }, payload: null, cadence: null, mode: 'design', channel: 'data', payloadFields: [], ...extra }; };
function read44() {
  const parts = [part('new:gardener', '정원사'), part('new:loop', '물주기 루프', { loop: { unit: 'LLM이 고른 화분', stop: null, resume: null, quote: rowAt('| 물주기 루프 | 루프·엔진'), program: true } }),
    part('new:sensor', '습도 센서', { type: 'collector', typeQuote: rowAt('| 습도 센서 |') }), part('new:log', 'log.csv'), part('new:old', '옛 타이머'), part('new:report', '보고서'),
    part('new:pump', '펌프', { type: 'actor', typeQuote: rowAt('| 펌프 |') })];
  const relations = [line('new:loop', 'new:pump', '| 물주기 루프 | 펌프 |'), line('new:loop', 'new:log', '| 물주기 루프 | 보고서 |', { payload: 'D01 log.csv' })];
  const out = record43({ texts: new Map([['N01', { text: RECORD }]]), parts, relations, nameOf: () => '', onMaterial: () => false, maxLines: 48 });
  return { parts, relations, out, by: name => parts.find(p => p.name === name) };
}

test('.44 types: a v4 part\'s type is its C-PART row\'s 유형 alone, on that row; 모름 or a word outside the list gives none (the model\'s word is not kept)', () => {
  const { by } = read44();
  assert.deepEqual(['정원사', '물주기 루프', 'log.csv', '옛 타이머', '보고서'].map(n => [n, by(n).type, by(n).typeQuote?.quote.slice(0, 8)]), [
    ['정원사', 'person', '| 정원사 | '], ['물주기 루프', 'loop', '| 물주기 루프'], ['log.csv', 'store', '| log.cs'], ['옛 타이머', 'timer', '| 옛 타이머 '], ['보고서', 'screen', '| 보고서 | ']]);
  assert.deepEqual([by('습도 센서').type, by('습도 센서').typeQuote], [null, null], '확장점·플러그인 is no fixed word: none, not the model\'s collector');
  assert.deepEqual([by('펌프').type, by('펌프').typeQuote], [null, null], '모름 gives none');
  assert.deepEqual([by('옛 타이머').implementation, by('옛 타이머').state], ['removed', 'retired'], '제거됨 reads retired');
});

test('.44 loops: every C-LOOP row of a part with its parent loop; a loop standing on none of the part\'s own rows gives way to the outermost row', () => {
  const { by } = read44(), loop = by('물주기 루프');
  assert.deepEqual(loop.loops.map(l => [l.recordRef, l.parentRef, l.unit, l.stop]), [['B02:L01', null, '화분마다', '목록 끝'], ['B02:L02', 'B02:L01', '재시도', '흙이 젖음']]);
  assert.deepEqual([loop.loop.unit, loop.loop.stop, loop.loop.program, loop.loop.quote.quote.startsWith('| 물주기 루프 | — |')], ['화분마다', '목록 끝', true, true]);
});

test('.44 lines: the record\'s own lines the reply left undrawn, each on its row (store halves, one maker → one reader, a C-LINK row naming both ends); never a cross product', () => {
  const { relations } = read44(), drawn = relations.map(r => [r.from, r.to, r.payload, r.payloadRef, r.payloadFields, r.quote.slice(0, 12)]);
  assert.deepEqual(drawn, [
    ['new:loop', 'new:pump', null, null, [], '| 물주기 루프 | 펌'], ['new:loop', 'new:log', 'D01 log.csv', 'D01', ['pot_id', 'moisture', 'watered_at'], '| 물주기 루프 | 보'],
    // C-LINK 정원사 → 물주기 루프 (no artifact row: its channel unsaid); D01's reader half through the store part log.csv.
    ['new:gardener', 'new:loop', '명령 water', null, [], '| 정원사 | 물주기 '], ['new:log', 'new:report', 'D01 log.csv', 'D01', ['pot_id', 'moisture', 'watered_at'], '| 물주기 루프 | 보'],
    // C-DATA D02: one maker, one reader, in memory; D03 has two makers and draws nothing.
    ['new:sensor', 'new:loop', '습도 값', 'D02', ['pot_id', 'percent'], '| 습도 값 | 내부 ']]);
  assert.equal(relations.find(r => r.from === 'new:gardener').channel, null);
  assert.deepEqual(relations.find(r => r.to === 'new:pump').variantRef, 'X01');
});

test('.44 fields of a 필드·모양 cell: items outside brackets, a leading type left off; a shape, a contract ID or one thing gives none', () => {
  assert.deepEqual(fieldsOf('pot_id, moisture, watered_at'), ['pot_id', 'moisture', 'watered_at']);
  assert.deepEqual(fieldsOf('map[str]: pot, level, note'), ['pot', 'level', 'note']);
  assert.deepEqual(fieldsOf('stamp, rows[], meta{pot, size} [파일: S/log.py]'), ['stamp', 'rows[]', 'meta{pot, size}']);
  assert.deepEqual(fieldsOf('limits{low, high}, interval_s, 그 밖 4개'), ['limits{low, high}', 'interval_s']);
  for (const shape of ['uint8 2차원 습도 격자', 'K02', '—', '한 줄 문장', 'float32 배열 (n, 3), 마지막 칸은 비율']) assert.deepEqual(fieldsOf(shape), [], shape);
});

test('.44 variants: an ID reads with what its row says it is (implementing part · choice condition) wherever it is named; the stored words stay', () => {
  const { by } = read44(), gloss = variantGloss(by('펌프').variants);
  assert.deepEqual([...gloss], [['X01', '펌프 · PUMP=relay']]);
  assert.equal(glossVariants('then=X01 else=X09', gloss), 'then=X01(펌프 · PUMP=relay) else=X09');
  assert.equal(glossVariants('X01(펌프 · PUMP=relay)', gloss), 'X01(펌프 · PUMP=relay)', 'glossed once');
  assert.equal(variantGloss([{ recordRef: 'X02', implementer: 'user', condition: null }]).get('X02'), '사용자 지정');
});

test('.44 claims on v4 rows: a change row naming another part in 바뀐 부분 is wrong-part; a change claim naming another change row\'s actor is set aside (actor); the row\'s own actor stays', () => {
  const f = ofChunks({ D, M, studioView }), wire = wire43(f), engine = wire.parts.find(p => p.name === '정리 엔진'), cli = wire.parts.find(p => p.name === 'tidy 명령');
  // 정리 엔진 quotes tidy 명령's 2026-10-20 change row (its first cell a date, its 바뀐 부분 tidy 명령).
  engine.claims.push({ key: 's9', kind: 'reported', text: '의존성 3건이 갱신됐다.', at: f.at('| 2026-10-20 |'), about: null, replaces: null, topic: 'change' });
  cli.claims[1].text = '기여자 han-dev가 의존성 3건을 갱신했다.';
  const read = M.validateMapReply(wire, f.ask, { setAside: true }), aside = M.readingExclusions(read).map(x => [x.path, x.category]);
  assert.ok(aside.some(([p, c]) => c === 'wrong-part' && p === `parts[${wire.parts.indexOf(engine)}].claims[3]`), JSON.stringify(aside));
  assert.ok(aside.some(([p, c]) => c === 'actor' && p === `parts[${wire.parts.indexOf(cli)}].claims[1]`), JSON.stringify(aside));
  assert.match(M.explainExclusion('parts[1].claims[1]', 'contract', 'actor'), /다른 행의 주체/);
  // The row's own actor named in the claim keeps it.
  const ok = wire43(f); ok.parts.find(p => p.name === 'tidy 명령').claims[1].text = '봇 deps-bot이 의존성 3건을 갱신했다.';
  assert.ok(!M.readingExclusions(M.validateMapReply(ok, f.ask, { setAside: true })).some(x => x.category === 'actor'));
});

test('.44 program places: a code name both sides write counts once (retry_limit is not retry and limit); one only the row writes is read word by word', () => {
  const said = 'retry_limit=5 고정', words = M.contentWords(said), row = 'job.retry_limit > attempts';
  assert.equal([...words].filter(w => M.contentWords(row).has(w)).length, 2, 'retry and limit, read word by word');
  assert.equal(M.sharedPlace(words, said, row), 1);
  // A rule that writes 스탑 and 상주 shares stop and resident with a row that names them in one code name it does not write.
  const rule = M.contentWords('스탑 상주 돈 안전'), row2 = 'not 1 <= stop <= 250 STOP_NOT_RESIDENT', plain = [...rule].filter(w => M.contentWords(row2).has(w)).length;
  assert.ok(plain >= 2);
  assert.equal(M.sharedPlace(rule, '스탑 상주 돈 안전', row2), plain);
});

test('.44 display: a part\'s every C-LOOP row and its variants reach the part\'s understanding; a deprecated part reads 사용 중단 권고 with its successor', () => {
  const f = ofChunks({ D, M, studioView }), read = M.validateMapReply(wire43(f), f.ask, { setAside: true });
  const applied = M.applyReading(f.project, f.input, read, { id: 'R_r44', at: '2026-11-05T02:00:00.000Z', model: 'stub', prompt: 'm6-000000000044', hash: '5'.repeat(64) });
  const engine = applied.reading.parts.find(p => p.recordRef === 'B03'), u = M.partUnderstanding(applied.project, engine.areaId);
  assert.deepEqual([u.recordLoops.map(l => l.recordRef), u.variants.map(v => v.recordRef)], [['B03:L01'], ['X01', 'X02']]);
  assert.deepEqual([...M.projectVariantGloss(applied.project).keys()].sort(), ['X01', 'X02', 'X03']);
  assert.equal(maintenanceOf([{ dimension: 'maintenance', value: 'deprecated', successor: 'pump2' }]), '사용 중단 권고 → pump2');
  assert.equal(maintenanceOf([{ dimension: 'maintenance', value: 'ended', successor: null }]), '유지 종료');
  assert.equal(maintenanceOf([{ dimension: 'release', value: 'released', successor: null }]), null);
});

test('.44 recipe and prompt: first-map-divided.44; the global stage draws both halves of a stored file\'s C-LINK line', () => {
  assert.deepEqual([P.PIPELINE_RECIPE, P.LATER_PIPELINE_RECIPE], ['first-map-divided.44', 'later-map-divided.44']);
  assert.ok(P.GLOBAL_RULES.includes('쓰는 쪽 반만 쓰고 읽는 쪽(받는 부분)을 빼지 않으며'));
});
