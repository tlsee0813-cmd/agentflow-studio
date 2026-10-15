const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const sourcePath = path.resolve(__dirname, '../../prototype.html');
const bytes = fs.readFileSync(sourcePath);
const hash = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
const expectedHash = '5B9B42CC48DDF5488814495BDB20E96CAB1DD3D749EEC59599BF96AD83E4B09C';
if (hash !== expectedHash) throw new Error('Version mismatch: ' + hash);
const script = bytes.toString('utf8').match(/<script>([\s\S]*?)<\/script>/)[1];

// Independent minimal application-state harness. No real browser, DOM or layout engine.
function boot() {
  const scrollCalls = [];
  const app = { innerHTML: '', attrs: {}, handler: null };
  const doc = { activeElement: null, getElementById: id => id === 'app' ? app : null };
  app.setAttribute = (name, value) => { app.attrs[name] = String(value); };
  app.addEventListener = (type, handler) => { if (type === 'click') app.handler = handler; };
  app.querySelector = selector => {
    const match = selector.match(/^\[data-key="([^"]+)"\]$/);
    if (!match || !app.innerHTML.includes('data-key="' + match[1] + '"')) return null;
    const element = { getAttribute: name => name === 'data-key' ? match[1] : null };
    element.focus = () => { doc.activeElement = element; };
    return element;
  };
  const win = { scrollY: 0, pageYOffset: 0, scrollTo: (x, y) => {
    scrollCalls.push({ x, y }); win.scrollY = y; win.pageYOffset = y;
  } };
  vm.runInNewContext(script, { document: doc, window: win }, { filename: sourcePath });
  return {
    app, win, scrollCalls,
    click(action, value = null) {
      const button = { disabled: false, getAttribute: name => name === 'data-action' ? action : name === 'data-val' ? value : null };
      app.handler({ target: { closest: () => button } });
    },
    scroll(y) { win.scrollY = y; win.pageYOffset = y; },
    state() { return win.__proto_state.v[win.__proto_state.scene]; }
  };
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const clone = value => JSON.parse(JSON.stringify(value));
const results = [];
function record(id, checks, observed) {
  results.push({ id, status: Object.values(checks).every(Boolean) ? 'PASS' : 'FAIL', checks, observed });
}

{
  const t = boot();
  t.click('scene', '3'); t.click('goto', 'A2'); t.click('handoff');
  const h = t.app.innerHTML.match(/<article class="handoff"[\s\S]*?<\/article>/)?.[0] || '';
  record('F3-01-handoff-purpose-retained', {
    projectPurpose: h.includes('프로젝트 목적') && h.includes('작은 도서 대여 서비스'),
    separateWorkPurpose: h.includes('작업 목적') && h.includes('실패 알림 정책 검토'),
    priorDecision: h.includes('대체된 결정') && h.includes('신청 시 알림'),
    unresolvedPolicy: h.includes('정책 미정'),
    candidateNotAssigned: h.includes('후보이며 배정·전달 아님'),
    notTransmitted: h.includes('준비·미전달')
  }, { handoffMarkupFound: h.length > 0 });
}
{
  const t = boot();
  t.click('scene', '2'); t.click('plan', 'B'); t.click('goto', 'B'); t.click('rel'); t.scroll(250);
  t.click('bgo', 'A'); t.click('goto', 'A2'); t.click('rel'); t.scroll(900);
  t.click('bgo', 'root');
  const root = { selected: t.state().selected, relOpen: t.state().relOpen, bLoc: t.state().bLoc, scrollY: t.win.scrollY };
  t.click('bgo', 'A');
  const focused = { selected: t.state().selected, relOpen: t.state().relOpen, bLoc: t.state().bLoc, scrollY: t.win.scrollY };
  record('F3-02-B-breadcrumb-roundtrip', {
    rootState: same(root, { selected: 'B', relOpen: true, bLoc: 'root', scrollY: 250 }),
    focusedStateOnReentry: same(focused, { selected: 'A2', relOpen: false, bLoc: 'A', scrollY: 900 })
  }, { root, focused, scrollCalls: t.scrollCalls });
}
{
  const t = boot();
  t.click('scene', '2'); t.click('plan', 'B'); t.click('goto', 'B'); t.click('rel'); t.scroll(275);
  // This action is used by relation-list and change-reference buttons and bypasses bgo('A').
  t.click('goto', 'A4'); t.click('rel'); t.scroll(880); t.click('bgo', 'root');
  const actual = { selected: t.state().selected, relOpen: t.state().relOpen, bLoc: t.state().bLoc, scrollY: t.win.scrollY };
  record('F3-03-B-direct-child-return', {
    rootState: same(actual, { selected: 'B', relOpen: true, bLoc: 'root', scrollY: 275 })
  }, { actual, scrollCalls: t.scrollCalls });
}
{
  const t = boot();
  t.click('scene', '2'); t.click('toggleA'); t.click('goto', 'A4'); t.click('rel'); t.scroll(640);
  t.click('focusA');
  const before = clone(t.state().aSnap);
  t.click('goto', 'A2'); t.click('rel'); t.scroll(880); t.click('bgo', 'root');
  t.click('goto', 'B'); t.click('rel'); t.scroll(220); t.click('bgo', 'A');
  const afterReentry = clone(t.state().aSnap);
  t.click('goto', 'A6'); t.scroll(1000); t.click('bgo', 'root');
  const afterSecondReturn = clone(t.state().aSnap);
  t.click('backA');
  const returned = { plan: t.win.__proto_state.plan, selected: t.state().selected, expanded: t.state().expanded, relOpen: t.state().relOpen, scrollY: t.win.scrollY, aSnap: t.state().aSnap };
  record('F3-04-A-snapshot-isolation', {
    correctOriginalSnapshot: same(before, { selected: 'A4', expanded: true, relOpen: true, scrollY: 640 }),
    stableThroughBReentry: same(before, afterReentry),
    stableThroughBSecondReturn: same(before, afterSecondReturn),
    AStateRestored: same(returned, { plan: 'A', selected: 'A4', expanded: true, relOpen: true, scrollY: 640, aSnap: null })
  }, { before, afterReentry, afterSecondReturn, returned, scrollCalls: t.scrollCalls });
}

const report = {
  sourcePath: path.relative(__dirname, sourcePath).split(path.sep).join('/'), sha256: hash, timestampUTC: new Date().toISOString(),
  environment: 'Node.js ' + process.version + '; minimal document/event stubs; no browser; no layout engine; no jsdom',
  limitation: 'Scroll values are synthetic; only scrollTo invocation/state is checked. No visual, viewport, DOM accessibility or network observation.',
  results
};
fs.writeFileSync(path.resolve(__dirname, 'results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
if (results.some(result => result.status === 'FAIL')) process.exitCode = 1;
