'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const guide = require('../label-lookup.js');

const SHORT = {
  label: 'HINK-E0213',
  display: 'Good Display GDEH0213B1',
  controller: 'SSD1673',
  driver: 'ssd16xx',
  boardDesignation: 'reel_board',
};
const LONG = {
  label: 'HINK-E0213A22',
  display: 'Good Display GDEH0213B72',
  controller: 'SSD1675A',
  driver: 'ssd16xx',
  boardDesignation: 'reel_board@2',
};

function assertNeedsCheck(input, reason) {
  const result = guide.describe(input);
  assert.equal(result.state, 'needs-check', JSON.stringify(input));
  assert.equal(result.reason, reason, JSON.stringify(input));
  assert.equal(result.entry, null, JSON.stringify(input));
  assert.equal(guide.findEntry(input), null, JSON.stringify(input));
}

test('문서 표의 두 행만 그대로 담는다', () => {
  assert.deepEqual(guide.ENTRIES.map((e) => ({ ...e })), [SHORT, LONG]);
  assert.deepEqual([...guide.KNOWN_LABELS], ['HINK-E0213', 'HINK-E0213A22']);
  assert.ok(Object.isFrozen(guide.ENTRIES));
  assert.ok(guide.ENTRIES.every(Object.isFrozen));
});

test('짧은 라벨은 짧은 라벨 행에만 대응한다', () => {
  const result = guide.describe('HINK-E0213');
  assert.equal(result.state, 'match');
  assert.deepEqual({ ...result.entry }, SHORT);
});

test('긴 라벨은 긴 라벨 행에 대응하고 짧은 라벨 접두어로 매칭되지 않는다', () => {
  const result = guide.describe('HINK-E0213A22');
  assert.equal(result.state, 'match');
  assert.deepEqual({ ...result.entry }, LONG);
  assert.notEqual(result.entry.boardDesignation, SHORT.boardDesignation);
});

test('두 정상 라벨은 서로 다른 화면·컨트롤러·보드 지정과 같은 driver를 가진다', () => {
  const a = guide.findEntry(SHORT.label);
  const b = guide.findEntry(LONG.label);
  assert.notEqual(a.display, b.display);
  assert.notEqual(a.controller, b.controller);
  assert.notEqual(a.boardDesignation, b.boardDesignation);
  assert.equal(a.driver, 'ssd16xx');
  assert.equal(b.driver, 'ssd16xx');
});

test('앞뒤 공백만 무시한다', () => {
  for (const input of ['  HINK-E0213  ', '\tHINK-E0213\n', '　HINK-E0213 ']) {
    assert.equal(guide.describe(input).entry.label, 'HINK-E0213', JSON.stringify(input));
  }
  assert.equal(guide.describe(' HINK-E0213A22 ').entry.label, 'HINK-E0213A22');
});

test('빈 값과 공백만 있는 값은 확인 필요', () => {
  for (const input of ['', ' ', '   ', '\t\n', '　']) assertNeedsCheck(input, 'empty');
  for (const input of [undefined, null, 42, {}]) assertNeedsCheck(input, 'empty');
});

test('접두어·부분 일치는 확인 필요', () => {
  for (const input of ['HINK', 'HINK-', 'HINK-E', 'HINK-E021', 'E0213', 'E0213A22', 'HINK-E0213A', 'HINK-E0213A2', 'A22']) {
    assertNeedsCheck(input, 'unrecognized');
  }
});

test('긴 라벨 뒤에 더 붙은 값이나 앞에 붙은 값은 확인 필요', () => {
  for (const input of ['HINK-E0213A222', 'HINK-E0213A22X', 'XHINK-E0213', 'HINK-E0213 A22', 'HINK-E0213/HINK-E0213A22']) {
    assertNeedsCheck(input, 'unrecognized');
  }
});

test('대소문자 변형은 보정하지 않는다', () => {
  for (const input of ['hink-e0213', 'Hink-E0213', 'HINK-e0213', 'hink-e0213a22', 'HINK-E0213a22']) {
    assertNeedsCheck(input, 'unrecognized');
  }
});

test('하이픈·유사 문자 변형은 보정하지 않는다', () => {
  const variants = [
    'HINKE0213', 'HINK E0213', 'HINK_E0213', 'HINK–E0213', 'HINK‑E0213',
    'HINK-EO213', 'HINK-E02l3', 'ＨＩＮＫ-Ｅ0213', 'HINK-E0213​', '​HINK-E0213A22',
  ];
  for (const input of variants) assertNeedsCheck(input, 'unrecognized');
});

test('PCB 버전이나 보드 지정·모델명 입력으로 대상을 고르지 않는다', () => {
  for (const input of ['1507.1', '1507.2', 'reel_board', 'reel_board@2', 'GDEH0213B72', 'SSD1675A', 'ssd16xx']) {
    assertNeedsCheck(input, 'unrecognized');
  }
});

test('정상 → 미상 전환 결과에는 이전 대상 값이 없다', () => {
  const sequence = ['HINK-E0213A22', 'HINK-E0213A2', 'HINK-E0213', 'hink-e0213', '', 'HINK-E0213A22', '<b>x</b>'];
  const expected = ['match', 'needs-check', 'match', 'needs-check', 'needs-check', 'match', 'needs-check'];
  sequence.forEach((input, i) => {
    const result = guide.describe(input);
    assert.equal(result.state, expected[i], JSON.stringify(input));
    if (result.state !== 'match') assert.equal(result.entry, null);
  });
});

test('HTML처럼 보이는 입력은 그대로 문자열로 남고 대상이 없다', () => {
  const input = '<img src=x onerror="alert(1)">';
  const result = guide.describe(input);
  assert.equal(result.state, 'needs-check');
  assert.equal(result.label, input);
  assert.equal(result.entry, null);
});

test('Low Power 절전 불가 제한과 고정 문서 주소를 가진다', () => {
  assert.match(guide.LOW_POWER_LIMIT.title, /Low Power/);
  assert.match(guide.LOW_POWER_LIMIT.detail, /두 전압이 항상 켜져/);
  assert.equal(
    guide.SOURCE.url,
    'https://github.com/zephyrproject-rtos/zephyr/blob/3568e1b6d5cdd51a6b964a2a1d6d29200fea2056/boards/phytec/reel_board/doc/index.rst#L9-L112',
  );
});

test('화면 코드는 HTML 삽입 API와 네트워크 API를 쓰지 않는다', () => {
  const dir = path.join(__dirname, '..');
  for (const file of ['app.js', 'label-lookup.js']) {
    const source = fs.readFileSync(path.join(dir, file), 'utf8');
    assert.doesNotMatch(source, /innerHTML|outerHTML|insertAdjacentHTML|document\.write|\beval\(|new Function/, file);
    assert.doesNotMatch(source, /fetch\(|XMLHttpRequest|WebSocket|EventSource|sendBeacon/, file);
  }
  const html = fs.readFileSync(path.join(dir, 'index.html'), 'utf8');
  assert.match(html, /Content-Security-Policy/);
  assert.match(html, /connect-src 'none'/);
  const hrefs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs.sort(), ['app.js', 'label-lookup.js', 'styles.css']);
});
