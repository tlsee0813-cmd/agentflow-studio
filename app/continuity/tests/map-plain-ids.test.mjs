// Polish round fixes 1 (spec-cards-v2 §1, §3): the record's row IDs never lead a label, a tip, a pane row or a port; a variant reads
// by its name, once; the evidence view keeps the record as written. No browser.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { plainIds, idOnly, nameVariants, variantName, plainView } from '../dist/public/client/plain-ids.js';

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
  assert.ok(src.includes('view: plainView(studioView(project))') && src.includes('o.view = plainView(studioView(next))'));
  assert.ok(/function relationPayloads[\s\S]{0,800}plainIds\(nameVariants\(x\.payload, g\)\)/.test(src), 'the pane rows hand over without IDs');
  assert.ok(/function relationLines[\s\S]{0,1400}plainIds\(nameVariants\(x\.payload, g\)\)/.test(src), 'the line labels and tips too');
  assert.ok(!/glossVariants/.test(src), 'no 「X01(…)」 gloss on a map surface');
  const forms = readFileSync(new URL('../src/client/view-forms.ts', import.meta.url), 'utf8');
  assert.match(forms, /STATE_CAPTION = '이 부분에 기록된 상태 전이만/);
  assert.ok(!/STATE_CAPTION = '[^']*C-STATE/.test(forms));
});
