// canvas-study.html 작성자 상태 검사 (jsdom 24). 실제 렌더링 검사가 아님.
// 사용: node check_canvas.js <canvas-study.html>
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const html = fs.readFileSync(process.argv[2], 'utf8');
function boot(width) {
  const vc = new VirtualConsole(); const errs = [];
  vc.on('jsdomError', e => errs.push(e.message));
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, virtualConsole: vc,
    beforeParse(w) { Object.defineProperty(w, 'innerWidth', { value: width, writable: true, configurable: true }); } });
  return { dom, errs, w: dom.window, d: dom.window.document };
}
let pass = 0, fail = 0;
const ok = (c, m) => { console.log((c ? 'PASS ' : 'FAIL ') + m); c ? pass++ : fail++; };

/* ---------- 1440류 (넓은 화면) ---------- */
let { d, errs } = boot(1440);
const app = d.getElementById('app');
const q = s => app.querySelector(s), qa = s => [...app.querySelectorAll(s)];
const k = key => { const el = q(`[data-key="${key}"]`); if (!el) throw new Error('missing ' + key + ' @ ' + st()); el.click(); };
const st = () => `scene=${app.dataset.scene} dest=${app.dataset.dest} sel=${app.dataset.sel} exp=${app.dataset.expanded} list=${app.dataset.list} vp=${app.dataset.vp} stack=${app.dataset.stack}`;
const edges = () => qa('svg.edges path').map(p => p.dataset.edge + ':' + p.dataset.state).sort();
const text = s => (q(s) || {}).textContent || '';

console.log('# S1 — 부분 상세화');
ok(app.dataset.narrow === 'false', '넓은 화면 판정');
ok(qa('[data-node^="A"]').length === 6 && !!q('[data-node="B"]'), 'A 하위 6 + B 노드');
ok(JSON.stringify(edges()) === '["A-B-area:unconfirmed"]', 'S1 펼침: 영역 수준 미확인 선 1개, 자식 선 0 → ' + edges());
ok(!!q('[data-port="A-area"]') && !q('[data-port="A2"]'), 'S1 선은 A 경계(영역)에 붙음, 자식 포트 없음');
ok(text('[data-elabel="A-B-area"]').includes('세부 대상 미확인') && text('[data-elabel="A-B-area"]').includes('자식 연결 0'), 'S1 선 라벨');
ok(!qa('[data-node^="A"]').some(n => /B 관련/.test(n.textContent)), 'S1 자식 카드에 B 관련 표시 없음');
k('cv-toggleA');
ok(app.dataset.expanded === 'false' && JSON.stringify(edges()) === '["A-B-area:unconfirmed"]', 'S1 접힘: 여전히 미확인 선 1개, 자식 연결 0');
ok(!q('[data-key="cv-list"]'), 'S1 접힘: "연결된 하위 3곳" 없음');
k('cv-toggleA');

console.log('# S2 — 관계와 결정 변경');
k('scene-2');
ok(JSON.stringify(edges()) === '["A2-B:confirmed","A4-B:confirmed","A6-B:confirmed"]', 'S2 펼침: 실제 관계 정확히 3개, 상위 선 없음 → ' + edges());
ok(['A2','A4','A6'].every(id => q(`[data-port="${id}"]`)), 'S2 경계 통과점 A2·A4·A6');
const chgNodes = qa('[data-node]').filter(n => /Δ 결정 변경/.test(n.textContent)).map(n => n.dataset.node);
ok(JSON.stringify(chgNodes) === '["A2"]', 'Δ 결정 변경은 A2 카드에만 → ' + chgNodes);
ok(/참조: A2 결정 변경 1/.test(text('[data-node="B"]')), 'B 카드에 A2 결정 변경 참조');
ok(qa('[data-node="A1"],[data-node="A3"],[data-node="A5"]').every(n => /관측 연결 없음/.test(n.textContent)), 'A1·A3·A5 "관측 연결 없음"');
ok(!/[→←↔]/.test(qa('[data-elabel]').map(e => e.textContent).join('')), '관계 라벨에 방향 화살표 없음');
k('cv-toggleA');
ok(JSON.stringify(edges()) === '["A2-B:confirmed","A4-B:confirmed","A6-B:confirmed"]', 'S2 접힘: 원래 끝점 3개 유지 → ' + edges());
ok(qa('.elabel').map(e => e.textContent).sort().join(',') === 'A2,A4,A6', 'S2 접힘: 끝점 이름 라벨 A2·A4·A6');
ok(/네 번째 관계 아님/.test(text('[data-box="A"]')), '접힌 A: 상위 관측은 이력, 네 번째 관계 아님');
k('cv-list');
ok(qa('[data-testid="collapsed-list"] [data-relation]').map(b => b.dataset.relation).join(',') === 'A2-B,A4-B,A6-B', '연결된 하위 3곳 목록');
k('cl-A4');
ok(app.dataset.sel === 'A4' && app.dataset.expanded === 'true' && app.dataset.stack === '1:none', '목록에서 A4로 이동(펼침, 복귀점 저장)');
k('ins-back');
ok(app.dataset.sel === 'none' && app.dataset.expanded === 'false' && app.dataset.list === 'true', '보기 복귀: 접힘·목록 열림 복원');
k('cv-toggleA');

console.log('# 핵심 비교 장면 ① 전체 펼침: A4 → A2 변경+B 관계 → A4 복귀');
k('node-A4'); k('pan-r'); k('pan-d');
const before1 = st(); const vp1 = app.dataset.vp;
console.log('  A4 보는 중:', before1);
ok(/A4 — B 알림 구상/.test(text('#insp')) && !!q('[data-key="ins-peer-A2"]'), 'A4 상세: B 관계 + 같은 B의 다른 끝점(A2 변경 표시)');
k('ins-peer-A2');
console.log('  A2 읽는 중:', st());
const ins = text('#insp');
ok(app.dataset.sel === 'A2' && /신청 즉시 확정/.test(ins) && /재고 확인 뒤 확정/.test(ins) && /신청 시 알림/.test(ins) && /대여 확정 후 알림/.test(ins), 'A2 상세: 설명·D2 변경 전후');
ok(/재고 불일치 방지/.test(ins) && /실패 알림 정책/.test(ins) && /E04/.test(ins), 'A2 상세: 이유·근거·미결');
ok(/A2 — B 알림 구상/.test(ins) && /관계 자체의 변경이 아님/.test(ins), 'A2 상세: B 관계, 관계 변경 아님');
ok(!/W2|SESSION/.test(ins), 'S2 A2 상세에 작업·세션 식별자 섞이지 않음');
ok(q('[data-edge="A2-B"]').dataset.hi === 'true' && q('[data-edge="A4-B"]').dataset.hi === 'false', 'A2 선택 시 A2–B 선만 강조');
k('ins-back');
console.log('  복귀 후:', st());
ok(app.dataset.sel === 'A4' && app.dataset.vp === vp1 && app.dataset.expanded === 'true' && app.dataset.stack === '0', 'A4·위치/배율·펼침 복원, 복귀점 소진');
ok(/재고 확인 뒤 확정/.test(text('[data-node="A2"]') + (k('node-A2'), text('#insp'))), '복귀는 데이터 되돌림 아님 (A2는 여전히 E04 현재값)');
k('node-A4');

console.log('# 핵심 비교 장면 ② A 집중: A4 → (A 집중) A2 → 경로 "전체" → A4');
k('zoom-in');
const vp2 = app.dataset.vp; const ovSnap = app.dataset.overview;
console.log('  집중 직전(전체):', st());
k('cv-focusA');
console.log('  A 집중 진입:', st());
ok(app.dataset.dest === 'focus' && app.dataset.sel === 'A4', 'A에 집중: A4 선택 유지해 진입');
ok(/외부 참조 · 원본 B \(복제 아님\)/.test(text('[data-node="B"]')) && q('[data-node="B"]').classList.contains('ext'), '집중 화면: B는 같은 식별자의 외부 참조');
ok(JSON.stringify(edges()) === '["A2-B:confirmed","A4-B:confirmed","A6-B:confirmed"]', '집중 화면도 실제 관계 3개 유지');
ok(/재고 확인 뒤 확정/.test(text('[data-node="A2"]')), '집중 화면 카드: A2 짧은 설명(읽기 집중)');
k('node-A2'); k('pan-l');
const focusSnap = app.dataset.focusstate;
ok(app.dataset.sel === 'A2' && /대여 확정 후 알림/.test(text('#insp')), '집중 화면에서 A2 변경 읽기');
ok(app.dataset.overview === ovSnap, '집중 화면 조작이 전체 저장값을 바꾸지 않음');
k('crumb-root');
console.log('  경로 "전체" 복귀:', st());
ok(app.dataset.dest === 'overview' && app.dataset.sel === 'A4' && app.dataset.vp === vp2 && app.dataset.expanded === 'true', '전체 복귀: A4·펼침·위치/배율 복원');
k('dest-focus');
ok(app.dataset.dest === 'focus' && app.dataset.focusstate === focusSnap && app.dataset.sel === 'A2', '도구줄로 다시 집중: 집중 화면 자신의 선택(A2)·위치 복원');
k('dest-overview');

console.log('# 배율 불변 (상세 수준은 배율로 바뀌지 않음)');
const worldText = () => q('#world').textContent;
const nodesBefore = qa('[data-node]').length, wt = worldText(), eb = JSON.stringify(edges()), exb = app.dataset.expanded;
k('zoom-in'); k('zoom-in'); k('zoom-out'); k('zoom-out'); k('zoom-out'); k('zoom-out');
ok(qa('[data-node]').length === nodesBefore && worldText() === wt && JSON.stringify(edges()) === eb && app.dataset.expanded === exb, '배율 변경 전후 노드·글·관계·펼침 동일 (vp ' + app.dataset.vp + ')');
k('zoom-100');
ok(app.dataset.vp.endsWith(',1'), '100%로 복귀');
const kBefore = app.dataset.vp.split(',')[2];
k('node-A1'); k('node-B'); k('node-A6');
ok(app.dataset.vp.split(',')[2] === kBefore, '선택만으로 자동 전체맞춤·배율 변경 없음');

console.log('# B 선택 상세');
k('node-B');
const bi = text('#insp');
ok(/실제 끝점 3/.test(bi) && ['A2','A4','A6'].every(x => q(`[data-key="ins-ep-${x}"]`)), 'B: 실제 끝점 3 이동 버튼');
ok(/신청 시 알림/.test(text('[data-testid="b-change-ref"]')) && /대여 확정 후 알림/.test(text('[data-testid="b-change-ref"]')), 'B: A2 결정 변경 참조');
ok(/A4·A6 전파 없음/.test(bi) && /실패 알림 정책/.test(text('[data-testid="b-open-ref"]')), 'B: 전파 없음, 미결 참조(소유 A2)');
ok(['A2-B','A4-B','A6-B'].every(e => q(`[data-edge="${e}"]`).dataset.hi === 'true'), 'B 선택 시 세 관계 모두 강조');

console.log('# S3 — 재방문·인계');
k('scene-3');
ok(/합성 열람 E03 \/ 반영 E04/.test(text('[data-testid="baseline"]')), 'S3 기준 표시');
k('scene-1'); k('scene-2'); k('scene-3');
ok(/합성 열람 E03 \/ 반영 E04/.test(text('[data-testid="baseline"]')), '장면 전환 후에도 기준 불변');
k('bn-chg');
ok(app.dataset.sel === 'A2' && /E03 이후/.test(text('[data-node="A2"]')), '띠의 변경 바로가기 → A2, E03 이후 표시');
ok(/W2/.test(text('[data-testid="work"]')) && /SESSION-02/.test(text('[data-testid="work"]')) && text('[data-testid="work-state"]') === '준비·미전달', '작업·세션 별도 구역, 준비·미전달');
k('ins-handoff');
const ho = text('[data-testid="handoff-doc"]');
['작은 도서 대여 서비스','A2 대여 신청의 실패 알림 정책 검토','A2 대여 신청만','E04','A2 — B 알림 구상','미세분화','재고 확인 뒤 확정','D2 대여 확정 후 알림','D2 신청 시 알림','재고 불일치 방지','실패 알림 정책','E01','E02','E03','완료 조건','SESSION-02','준비·미전달','A4·A6는 범위 아님']
  .forEach(s => ok(ho.includes(s), '인계문: ' + s));
ok(text('[data-testid="ho-project"]') !== text('[data-testid="ho-work"]'), '프로젝트 목적과 작업 목적 별도 행');
ok(!/수신함|수락함|전달 완료|전달됨/.test(ho), '인계문이 수신·수락·전달을 주장하지 않음');
k('node-A4');
ok(/W2 인계 범위 아님/.test(text('#insp')), 'A4: W2 인계 범위 아님');
k('scene-1');
ok(app.dataset.sel === 'none' && JSON.stringify(edges()) === '["A-B-area:unconfirmed"]', '장면별 독립: S1 상태 그대로');

console.log('# 접근성·표시 (DOM 수준)');
const acts = qa('[data-action]');
ok(acts.every(b => b.tagName === 'BUTTON' && b.type === 'button'), '모든 조작이 실제 button (' + acts.length + '개)');
ok(acts.every(b => (b.getAttribute('aria-label') || b.textContent).trim().length > 0), '모든 button에 이름');
k('scene-2'); k('node-A4');
ok(/● 선택/.test(text('[data-node="A4"]')) && q('[data-node="A4"]').getAttribute('aria-pressed') === 'true', '선택은 색 외에 "● 선택" 글자·aria-pressed');
ok(/Δ/.test(text('[data-node="A2"]')), '변경은 Δ 글자 표시');
k('scene-1');
ok(/\?/.test(text('[data-node="B"]')) && /미확인/.test(text('[data-elabel="A-B-area"]')), '미확인은 ? 글자 + 점선 라벨');
ok(!/undefined|NaN/.test(app.textContent), 'undefined/NaN 없음');
ok(errs.length === 0, 'JS 오류 없음 ' + errs.join(' | '));

/* ---------- 390류 (좁은 화면) ---------- */
console.log('# 390 — 구조 목록 우선');
({ d, errs } = boot(390));
const app2 = d.getElementById('app');
const q2 = s => app2.querySelector(s);
const k2 = key => { const el = q2(`[data-key="${key}"]`); if (!el) throw new Error('missing ' + key); el.click(); };
ok(app2.dataset.narrow === 'true' && app2.dataset.pane === 'outline', '좁은 화면 판정, 구조 목록이 기본');
k2('scene-2');
ok(/A2 D2 결정 변경 1건/.test(q2('#outline').textContent) && /A2/.test(q2('[data-key="ol-rel-A2"]').textContent), '구조 목록: 변경·관계 3곳 바로 보임');
k2('ol-A4');
ok(app2.dataset.pane === 'detail' && app2.dataset.sel === 'A4', '목록에서 A4 → 상세');
k2('ins-peer-A2');
ok(app2.dataset.sel === 'A2' && /대여 확정 후 알림/.test(q2('#insp').textContent), '상세에서 A2 변경 읽기');
k2('ins-back');
ok(app2.dataset.sel === 'A4' && app2.dataset.pane === 'detail', 'A4로 보기 복귀');
k2('ins-to-outline');
ok(app2.dataset.pane === 'outline', '← 구조 목록');
k2('pane-canvas');
ok(app2.dataset.pane === 'canvas' && app2.dataset.vp.endsWith(',1'), '캔버스 탭은 배율 100% 유지 (축소해 통과시키지 않음)');
ok(errs.length === 0, '390 JS 오류 없음 ' + errs.join(' | '));

console.log(`canvas pass ${pass} fail ${fail}`);
/* 실패가 하나라도 있으면 0이 아닌 종료코드 (예외로 중단돼도 Node가 1로 종료) */
process.exitCode = fail > 0 ? 1 : 0;
