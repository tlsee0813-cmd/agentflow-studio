// Polish round fixes 1 (spec-cards-v2 §1, §3): the record's row IDs never lead a label, a tip, a pane row or a port; a variant reads
// by its name, once; the evidence view keeps the record as written. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plainIds, idOnly, nameVariants, variantName, plainView, labelWords, hasRowId } from '../dist/public/client/plain-ids.js';

test('IDS-1 leading row IDs leave labels, list items and brackets; an ID alone, three-digit names and one-digit names stay', () => {
  assert.equal(plainIds('D08 wandb.log 기록'), 'wandb.log 기록');
  assert.equal(plainIds('input.txt · D01 train.bin·val.bin, D02 meta.pkl'), 'input.txt · train.bin·val.bin, meta.pkl');
  assert.equal(plainIds('D02 (websocket 메시지)'), '(websocket 메시지)');
  assert.equal(plainIds('출력 (D09 표준 출력 로그)'), '출력 (표준 출력 로그)');
  assert.equal(plainIds('B03:S02 학습 단계'), '학습 단계');
  assert.equal(plainIds('보고서 → D08 pdf 파일'), '보고서 → pdf 파일');
  assert.equal(plainIds('D05: 전역 변수 덮어쓰기'), '전역 변수 덮어쓰기');
  for (const keep of ['H100 GPU 메모리', 'V8 엔진', 'A100', 'D08', 'GPT2 토큰']) assert.equal(plainIds(keep), keep, keep);
  assert.ok(idOnly('CD06') && idOnly(' X01 ') && !idOnly('CD06 이후') && !idOnly('조건'));
  // Polish round fixes 2: technical names of the ID shape stay (FP16, BF16, TF32: no record prefix; X11 when the record defines no X11).
  for (const keep of ['FP16 가중치', 'BF16 텐서', 'TF32 연산']) assert.equal(plainIds(keep), keep, keep);
  const g = { ids: new Set(['D01', 'D07', 'B04', 'CD13']), names: new Map([['D07', '검색 결과'], ['B04', 'configurator.py'], ['D01', '요청 인터셉터']]) };
  assert.equal(plainIds('X11 디스플레이', g), 'X11 디스플레이', 'an ID the record does not define stays');
  // An ID the record names reads by that name wherever it stands; an arrow target or a trailing ID too; one with a bracket reads its words.
  assert.equal(plainIds('질의·query_domains → D07', g), '질의·query_domains → 검색 결과');
  assert.equal(plainIds('B04', g), 'configurator.py');
  assert.equal(plainIds('this.defaults와 D01', g), 'this.defaults와 요청 인터셉터');
  assert.equal(plainIds('D01(요청 인터셉터 f…', g), '요청 인터셉터 f…');
  // Without a name: an arrow target goes with its arrow, a trailing ID with its joining word; one before a particle stays.
  assert.equal(plainIds('질의 → D07'), '질의'); assert.equal(plainIds('this.defaults와 D01'), 'this.defaults');
  assert.equal(plainIds('D09의 필드'), 'D09의 필드');
  // An ID alone in its bracket, a loop as a branch target.
  assert.equal(plainIds('→ _handle_deep_research(B04)', g), '→ _handle_deep_research(configurator.py)');
  assert.equal(plainIds('→ _handle_deep_research(B03)'), '→ _handle_deep_research');
  const lg = { ids: new Set(['B20:L04']), names: new Map([['B20:L04', '‘좀비 감지’ 반복']]) };
  assert.equal(plainIds('0 이하 → 좀비 감지 안 함 · 아니면 → B20:L04', lg), '0 이하 → 좀비 감지 안 함 · 아니면 → ‘좀비 감지’ 반복');
});

test('IDS-2 a variant reads by its name, once (「변형 X01」 and 「X01(… · …)」); an unknown ID stays', () => {
  const g = new Map([['X01', '다중 에이전트 그래프(…) · from agents.graph import run'], ['X02', '사용자 지정 · PUMP=relay']]);
  assert.equal(variantName('X01', g), '다중 에이전트 그래프');
  assert.equal(nameVariants('변형 X01', g), '변형 ‘다중 에이전트 그래프’');
  assert.equal(nameVariants('then=X01(다중 에이전트 그래프(…) · from agents.graph import run)', g), 'then=변형 ‘다중 에이전트 그래프’');
  assert.equal(nameVariants('변형 X02일 때', g), '변형 ‘사용자 지정’일 때');
  assert.equal(nameVariants('변형 X09', g), '변형 X09');
  assert.equal(nameVariants('변형 X01', new Map()), '변형 X01');
});

test('IDS-3 the view the map reads has its ports without IDs (port-map rows too, so a line still finds its port); the stored view is not changed', () => {
  const reading = { inputs: ['D01 train.bin', 'D02 meta.pkl의 vocab_size'], outputs: ['D05 전역 변수 덮어쓰기'], portMap: [{ relationId: 'r1', direction: 'in', port: 'D01 train.bin', step: 's' }] };
  const v = { parts: [{ id: 'a', reading }, { id: 'b', reading: null }], relations: [], records: [], roots: [] };
  const p = plainView(v);
  assert.deepEqual(p.parts[0].reading.inputs, ['train.bin', 'meta.pkl의 vocab_size']);
  assert.deepEqual(p.parts[0].reading.outputs, ['전역 변수 덮어쓰기']);
  assert.equal(p.parts[0].reading.portMap[0].port, 'train.bin');
  assert.equal(reading.inputs[0], 'D01 train.bin', 'the stored reading keeps the record as written');
  assert.equal(p.parts[1].reading, null);
});

test('IDS-4 the app reads every map surface through the plain view and the plain payloads; the state graph caption names no table', () => {
  const src = readFileSync(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  assert.ok(src.includes('view: plainMapView(project)') && src.includes('o.view = plainMapView(next)') && /function plainMapView[\s\S]{0,160}plainView\(v, idGloss\(project, v\)\)/.test(src));
  assert.ok(/function relationPayloads[\s\S]{0,800}plainIds\(nameVariants\(x\.payload, g\), ig\)/.test(src), 'the pane rows hand over without IDs');
  assert.ok(/function relationLines[\s\S]{0,1400}plainIds\(nameVariants\(x\.payload, g\), ig\)/.test(src), 'the line labels and tips too');
  assert.ok(!/glossVariants/.test(src), 'no 「X01(…)」 gloss on a map surface');
  const forms = readFileSync(new URL('../src/client/view-forms.ts', import.meta.url), 'utf8');
  assert.match(forms, /STATE_CAPTION = '이 부분에 기록된 상태 전이만/);
  assert.ok(!/STATE_CAPTION = '[^']*C-STATE/.test(forms));
});

test('IDS-5 beauty v4 (P3): a line label never shows a record row ID: the row\'s own words, else the rest without it, else none (hover)', () => {
  const g = { ids: new Set(['CD01', 'CD02', 'B12', 'LN13']), names: new Map([['CD01', 'pb.skipBootstrap()'], ['B12', 'serve-HTTP 서버']]) };
  // Named by the record: its words stand where the ID stood, the particle kept.
  assert.equal(labelWords('CD01이 거짓일 때', g), 'pb.skipBootstrap()이 거짓일 때');
  assert.equal(labelWords('B12로 넘김', g), 'serve-HTTP 서버로 넘김');
  // Named by nothing: the ID goes with the sign joining it, the rest stays.
  assert.equal(labelWords('CD02 && 컬렉션 있음', g), '컬렉션 있음');
  assert.equal(labelWords('컬렉션 있음 && CD02', g), '컬렉션 있음');
  assert.equal(labelWords('N02.63 기준 요청', g), '기준 요청');
  // Nothing of its own left: the label is left to the hover.
  assert.equal(labelWords('CD02가 거짓일 때', g), null);
  assert.equal(labelWords('LN13', g), null);
  // No ID: unchanged; technical names of the ID shape outside the record prefixes stay.
  for (const keep of ['요청마다', 'FP16 가중치', 'H100 GPU', '명령 python…']) assert.equal(labelWords(keep, g), keep, keep);
  for (const t of ['CD01이 거짓일 때', 'B12로 넘김', 'CD02 && 컬렉션 있음', 'N02.63 기준 요청']) { const w = labelWords(t, g); assert.ok(w === null || !hasRowId(w), t); }
  assert.ok(hasRowId('S03 단계') && hasRowId('LN27') && !hasRowId('H100') && !hasRowId('V8'));
  // The app reads every line label through it, with a last guard over every label on the map.
  const app = readFileSync(new URL('../src/client/app.ts', import.meta.url), 'utf8');
  assert.match(app, /function dropRowIds\(\)/); assert.match(app, /placeLineLabels\(\); dropRowIds\(\);/); assert.match(app, /const said = labelPlain\(w\)/);
});
