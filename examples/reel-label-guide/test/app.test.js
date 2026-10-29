'use strict';

// 브라우저 없이 app.js의 화면 갱신을 확인하는 최소 가짜 DOM.
// 실제 렌더링·레이아웃·키보드 포커스 이동은 브라우저에서 따로 확인한다.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const dir = path.join(__dirname, '..');
const FIELDS = ['display', 'controller', 'driver', 'boardDesignation'];
const IDS = [
  'label-input', 'label-form', 'clear-button', 'status-badge', 'status-message',
  'status-echo', 'result-rows', 'known-labels', 'limit-title', 'limit-detail',
  'source-link', 'source-meta',
];

function fakeElement() {
  const listeners = {};
  return {
    value: '',
    textContent: '',
    href: '',
    dataset: {},
    focused: 0,
    children: {},
    addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
    dispatch(type, extra = {}) {
      const event = { type, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; }, ...extra };
      for (const fn of listeners[type] || []) fn(event);
      return event;
    },
    querySelector(selector) { return this.children[selector] || null; },
    focus() { this.focused += 1; },
  };
}

function loadApp() {
  const elements = {};
  for (const id of IDS) elements[id] = fakeElement();
  for (const field of FIELDS) {
    elements['result-rows'].children['[data-field="' + field + '"]'] = fakeElement();
  }
  const context = {
    document: { getElementById: (id) => elements[id] || null },
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(dir, 'label-lookup.js'), 'utf8'), context);
  vm.runInContext(fs.readFileSync(path.join(dir, 'app.js'), 'utf8'), context);

  const input = elements['label-input'];
  return {
    elements,
    type(value) { input.value = value; input.dispatch('input'); },
    view() {
      return {
        badge: elements['status-badge'].textContent,
        state: elements['status-badge'].dataset.state,
        rowsState: elements['result-rows'].dataset.state,
        message: elements['status-message'].textContent,
        echo: elements['status-echo'].textContent,
        values: FIELDS.map((f) => elements['result-rows'].children['[data-field="' + f + '"]'].textContent),
      };
    },
  };
}

const BLANK = ['—', '—', '—', '—'];

test('처음 화면은 확인 필요이고 대상 값이 없으며 제한·출처가 채워진다', () => {
  const app = loadApp();
  const v = app.view();
  assert.equal(v.state, 'needs-check');
  assert.equal(v.badge, '확인 필요');
  assert.deepEqual(v.values, BLANK);
  assert.match(app.elements['limit-title'].textContent, /Low Power/);
  assert.match(app.elements['limit-detail'].textContent, /항상 켜져/);
  assert.equal(app.elements['known-labels'].textContent, 'HINK-E0213, HINK-E0213A22');
  assert.match(app.elements['source-link'].href, /^https:\/\/github\.com\/zephyrproject-rtos\/zephyr\/blob\/3568e1b6d5cdd51a6b964a2a1d6d29200fea2056\//);
  assert.equal(app.elements['label-input'].focused, 1);
});

test('한 글자씩 입력할 때마다 현재 입력의 결과만 보인다', () => {
  const app = loadApp();
  const steps = [
    ['HINK-E021', 'needs-check', BLANK],
    ['HINK-E0213', 'match', ['Good Display GDEH0213B1', 'SSD1673', 'ssd16xx', 'reel_board']],
    ['HINK-E0213A', 'needs-check', BLANK],
    ['HINK-E0213A2', 'needs-check', BLANK],
    ['HINK-E0213A22', 'match', ['Good Display GDEH0213B72', 'SSD1675A', 'ssd16xx', 'reel_board@2']],
    ['HINK-E0213A2', 'needs-check', BLANK],
    ['hink-e0213a22', 'needs-check', BLANK],
    ['   ', 'needs-check', BLANK],
    ['HINK-E0213', 'match', ['Good Display GDEH0213B1', 'SSD1673', 'ssd16xx', 'reel_board']],
    ['1507.2', 'needs-check', BLANK],
  ];
  for (const [value, state, values] of steps) {
    app.type(value);
    const v = app.view();
    assert.equal(v.state, state, value);
    assert.equal(v.rowsState, state, value);
    assert.equal(v.badge, state === 'match' ? '대응 확인' : '확인 필요', value);
    assert.deepEqual(v.values, values, value);
    assert.equal(v.echo, value.trim() === '' ? '(비어 있음)' : value.trim(), value);
  }
});

test('Esc와 지우기 버튼은 이전 대상을 남기지 않고 빈 상태로 돌린다', () => {
  const app = loadApp();
  const input = app.elements['label-input'];
  app.type('HINK-E0213A22');
  const esc = input.dispatch('keydown', { key: 'Escape' });
  assert.equal(esc.defaultPrevented, true);
  assert.equal(input.value, '');
  assert.deepEqual(app.view().values, BLANK);
  assert.match(app.view().message, /비어 있습니다/);

  app.type('HINK-E0213');
  app.elements['clear-button'].dispatch('click');
  assert.equal(input.value, '');
  assert.deepEqual(app.view().values, BLANK);
  assert.equal(input.focused, 2);
});

test('Enter 제출은 페이지 이동 없이 같은 결과를 다시 그린다', () => {
  const app = loadApp();
  app.type('HINK-E0213A22');
  const submit = app.elements['label-form'].dispatch('submit');
  assert.equal(submit.defaultPrevented, true);
  assert.equal(app.view().values[3], 'reel_board@2');
});

test('HTML처럼 보이는 입력은 글자 그대로 textContent에 들어간다', () => {
  const app = loadApp();
  const payload = '<img src=x onerror="alert(1)">';
  app.type(payload);
  assert.equal(app.view().echo, payload);
  assert.deepEqual(app.view().values, BLANK);
});
