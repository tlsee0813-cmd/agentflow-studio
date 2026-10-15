#!/usr/bin/env python3
"""cycle07 작성자검사 — 계약의 두 폭 × 세 경로를 실제 Chromium(Playwright)으로 조작.
사용: python3 -I author_check.py <change-record-study.html> <out_dir>
경로1 전후 비교  /  경로2 부분·후속 기록 왕복  /  경로3 준비·전체 복귀
측정: computed transform, 원시 getBoundingClientRect, native scrollLeft/Top(읽기만), 조상 overflow clip·viewport·
elementFromPoint 표본, 실제 activeElement. 앱 내부 state를 읽거나 DOM scroll 값을 주입하지 않는다. force 클릭 없음.
FAIL·pageerror·console error·경로 중단·파일 SHA 변화가 하나라도 있으면 exit 1.
"""
import sys, os, json, hashlib, socket, subprocess, time, datetime
from importlib.metadata import version as pkg_version
from playwright.sync_api import sync_playwright

HTML = os.path.abspath(sys.argv[1]); OUT = os.path.abspath(sys.argv[2]); os.makedirs(OUT, exist_ok=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
SHA_BEFORE = sha(HTML); BYTES = os.path.getsize(HTML)
checks, obs = [], []

def rec(size, path, name, ok, detail=None):
    checks.append({'size': size, 'path': path, 'check': name, 'status': 'PASS' if ok else 'FAIL', 'detail': detail})
    print(f"[{'PASS' if ok else 'FAIL'}] {size} {path} {name} {json.dumps(detail, ensure_ascii=False) if detail is not None else ''}", flush=True)

def note(size, path, name, detail):
    obs.append({'size': size, 'path': path, 'observation': name, 'detail': detail})
    print(f"[OBS ] {size} {path} {name} {json.dumps(detail, ensure_ascii=False)}", flush=True)

s_ = socket.socket(); s_.bind(('127.0.0.1', 0)); PORT = s_.getsockname()[1]; s_.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', os.path.dirname(HTML)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try: socket.create_connection(('127.0.0.1', PORT), 0.2).close(); break
    except OSError: time.sleep(0.1)
URL = f'http://127.0.0.1:{PORT}/{os.path.basename(HTML)}'

# 가시성: viewport, 모든 overflow 조상 clip, 5개 표본점 hit-test, 내부 잘림
VIS_JS = r"""(sel) => {
  const e = document.querySelector(sel); if (!e) return {exists:false, ok:false};
  const r = e.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return {exists:true, ok:false, zero:true};
  let L = 0, T = 0, R = innerWidth, B = innerHeight, clips = [];
  for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + ' ' + cs.overflowY)) { const q = p.getBoundingClientRect();
      const pl = q.left + p.clientLeft, pt = q.top + p.clientTop;
      L = Math.max(L, pl); T = Math.max(T, pt); R = Math.min(R, pl + p.clientWidth); B = Math.min(B, pt + p.clientHeight);
      clips.push(p.id || p.className || p.tagName); } }
  const inside = r.left >= L - 0.5 && r.top >= T - 0.5 && r.right <= R + 0.5 && r.bottom <= B + 0.5;
  const pts = [[.5,.5],[.1,.2],[.9,.2],[.1,.8],[.9,.8]].map(([fx,fy]) => [r.left + r.width*fx, r.top + r.height*fy]);
  const hits = pts.map(([x,y]) => { const h = document.elementFromPoint(x, y); return !!h && (h === e || e.contains(h)); });
  const inner = e.scrollHeight > e.clientHeight + 1 && /(hidden|clip)/.test(getComputedStyle(e).overflowY);
  return {exists:true, rect:{x:r.x,y:r.y,w:r.width,h:r.height}, clipBox:[L,T,R,B], clips, inside, hits, innerClipped: inner,
          ok: inside && hits.every(Boolean) && !inner};
}"""

GEO_JS = r"""() => {
  const ms = document.getElementById('mapScroll'), w = document.getElementById('world');
  const box = el => { const r = el.getBoundingClientRect(); return {x:r.x, y:r.y, w:r.width, h:r.height}; };
  const pr = ms.getBoundingClientRect();
  const nodes = [...document.querySelectorAll('#world .node')].map(n => { const f = n.querySelector('.face'), b = box(f);
    return {id: n.id, rect: b, pressed: n.getAttribute('aria-pressed'),
            inPane: b.x >= pr.left - .5 && b.y >= pr.top - .5 && b.x + b.w <= pr.left + ms.clientWidth + .5 && b.y + b.h <= pr.top + ms.clientHeight + .5,
            rows: [...n.querySelectorAll('.r')].map(r => r.innerText.replace(/\s+/g, ' ').trim()),
            faceClip: f.scrollHeight > f.clientHeight + 1}; });
  const edges = [...document.querySelectorAll('#edges g[data-rel]')].map(g => ({id: g.id, from: g.dataset.from, to: g.dataset.to,
            d: g.querySelector('path.ln').getAttribute('d'), rect: box(g.querySelector('path.ln')), label: g.querySelector('text').textContent}));
  const ae = document.activeElement;
  return {transform: getComputedStyle(w).transform, sl: ms.scrollLeft, st: ms.scrollTop, cw: ms.clientWidth, ch: ms.clientHeight,
          view: [...document.querySelectorAll('.seg button[aria-pressed=true]')].map(b => b.dataset.view),
          sel: nodes.filter(n => n.pressed === 'true').map(n => n.id), nodes, edges,
          active: ae ? (ae.id || ae.tagName) : null, mapShown: ms.offsetParent !== null};
}"""
READ_JS = r"""() => { const r = document.getElementById('reader'), ae = document.activeElement;
  return {shown: r.offsetParent !== null, top: r.scrollTop, max: r.scrollHeight - r.clientHeight,
          active: ae ? (ae.id || (ae.dataset && (ae.dataset.loc ? 'loc-' + ae.dataset.loc : ae.dataset.peek ? 'peek-' + ae.dataset.peek : '')) || ae.tagName) : null}; }"""
OVF_JS = "() => ({doc: document.documentElement.scrollWidth, vw: innerWidth})"
RECT_JS = "s => { const r = document.querySelector(s).getBoundingClientRect(); return {x:r.x, y:r.y, w:r.width, h:r.height}; }"

def vis(page, sel): return page.evaluate(VIS_JS, sel)
def geo(page): return page.evaluate(GEO_JS)
def rd(page): return page.evaluate(READ_JS)
def rect(page, sel): return page.evaluate(RECT_JS, sel)
def close(a, b, t=0.5): return all(abs(a[k] - b[k]) <= t for k in ('x', 'y', 'w', 'h'))

def wheel(page, sel, dx, dy):
    b = page.locator(sel).bounding_box()
    page.mouse.move(b['x'] + b['width'] / 2, b['y'] + min(b['height'] / 2, 150))
    page.mouse.wheel(dx, dy); page.wait_for_timeout(230)

def center_ok(v):
    if not v.get('rect'): return False
    r, cb = v['rect'], v['clipBox']; cx, cy = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
    return v['hits'][0] and cb[0] <= cx <= cb[2] and cb[1] <= cy <= cb[3]

def bring(page, container, sel, tries=8):
    """sel 요소 전체가 보이도록 container 위에서 실제 휠만 사용(보조 이동). 결과와 사용 여부를 반환."""
    used = 0
    for _ in range(tries):
        v = vis(page, sel)
        if v['ok'] or center_ok(v): return True, used
        r = v.get('rect') or rect(page, sel); cb = v.get('clipBox') or [0, 0, 0, 0]
        dy = (r['y'] + r['h'] / 2) - (cb[1] + cb[3]) / 2; dx = (r['x'] + r['w'] / 2) - (cb[0] + cb[2]) / 2
        wheel(page, container, max(-300, min(300, dx)) if abs(dx) > 20 else 0, max(-300, min(300, dy)) if abs(dy) > 20 else 0); used += 1
    v = vis(page, sel); return (v['ok'] or center_ok(v)), used

import re
def same_path(a, b):
    na, nb = re.findall(r'-?[\d.]+', a), re.findall(r'-?[\d.]+', b)
    return re.sub(r'-?[\d.]+', '#', a) == re.sub(r'-?[\d.]+', '#', b) and len(na) == len(nb) and all(abs(float(x) - float(y)) <= 0.01 for x, y in zip(na, nb))

def geo_diff(a, b, label_check=True):
    d = {}
    for k in ('transform', 'view', 'sel'):
        if a[k] != b[k]: d[k] = (a[k], b[k])
    for k in ('sl', 'st'):
        if abs(a[k] - b[k]) > 1: d[k] = (a[k], b[k])
    if [n['id'] for n in a['nodes']] != [n['id'] for n in b['nodes']]: d['nodeIds'] = 1
    for na, nb in zip(a['nodes'], b['nodes']):
        if not close(na['rect'], nb['rect']): d['rect.' + na['id']] = (na['rect'], nb['rect'])
    if [(e['id'], e['from'], e['to']) for e in a['edges']] != [(e['id'], e['from'], e['to']) for e in b['edges']]: d['edgeIds'] = 1
    for ea, eb in zip(a['edges'], b['edges']):
        if not close(ea['rect'], eb['rect']) or not same_path(ea['d'], eb['d']): d['edge.' + ea['id']] = (ea['d'], eb['d'])
    return d

def run(browser, W, H, size, meta):
    narrow = size == '390x844'
    ctx = browser.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1)
    page = ctx.new_page(); errors = []; doc = {}
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
    def on_resp(r):
        if r.url == URL and 'sha' not in doc:
            try: b = r.body(); doc.update(status=r.status, bytes=len(b), sha=hashlib.sha256(b).hexdigest())
            except Exception as ex: doc.update(error=str(ex))
    page.on('response', on_resp)
    page.goto(URL, wait_until='load'); page.wait_for_timeout(450)
    meta['http'][size] = doc
    rec(size, '0', '최초 HTTP 응답 status/body SHA = 원본 파일', doc.get('status') == 200 and doc.get('sha') == SHA_BEFORE, doc)
    shot = lambda n: page.screenshot(path=os.path.join(OUT, n))
    READBTN = '#panel .strip-head [data-act=read]' if narrow else '#panel .act.wide [data-act=read]'

    # ================= 경로1: 전후 비교 =================
    g0 = geo(page)
    items = {k: vis(page, k) for k in ('#purposeTxt', '#scope', '#followTxt', '#followOpen', '#vBefore', '#vAfter')}
    rec(size, '1', '초기: 목적·기록 범위·후속 기록 줄·비교 버튼 표시(clip·hit)', all(v['ok'] for v in items.values()), {k: v['ok'] for k, v in items.items()})
    rec(size, '1', '초기: 대상 3·관계 2, 관계는 P1→P3·P2→P3, 기본 보기=1월 16일 변경',
        [n['id'] for n in g0['nodes']] == ['n-P1', 'n-P2', 'n-P3'] and [(e['id'], e['from'], e['to']) for e in g0['edges']] == [('e-R1', 'P1', 'P3'), ('e-R2', 'P2', 'P3')] and g0['view'] == ['after'],
        {'nodes': [n['id'] for n in g0['nodes']], 'edges': [(e['id'], e['from'], e['to']) for e in g0['edges']], 'view': g0['view'], 'transform': g0['transform']})
    note(size, '1', '초기 지도 시야 안 대상', {n['id']: n['inPane'] for n in g0['nodes']})
    o = page.evaluate(OVF_JS); rec(size, '1', '초기 가로 넘침 없음', o['doc'] <= o['vw'], o)
    if not narrow: shot('A-1440-initial.png')
    # P1 선택(시야 안이므로 실제 클릭; 시야 밖이면 휠 보조)
    okb, used = bring(page, '#mapScroll', '#n-P1 .face'); page.click('#n-P1'); page.wait_for_timeout(150)
    ga = geo(page)
    rec(size, '1', 'P1 선택: 배치·transform·scroll 불변', not geo_diff({**g0, 'sel': ['n-P1']}, ga) and ga['sel'] == ['n-P1'], {'wheelAssist': used, 'diff': geo_diff({**g0, 'sel': ['n-P1']}, ga)})
    def content_ok(g, view):
        rows = {n['id']: n['rows'] for n in g['nodes']}
        if view == 'after':
            want = {'n-P1': ['그대로 표시 문구·분기 고르기', '옮겨 감 진행 정보 누락 확인', '옮겨 감 경과 시간 계산', '넘김 다운로드 상태로 계산 요청'],
                    'n-P3': ['그대로 남은 시간 추정', '받음 다운로드 상태 받기', '옮겨 옴 진행 정보 누락 확인', '옮겨 옴 경과 시간 계산']}
            labels = ['다운로드 상태로 계산 요청', '다운로드 상태로 같은 계산 사용']
        else:
            want = {'n-P1': ['여기서 표시 문구·분기 고르기', '여기서 진행 정보 누락 확인', '여기서 경과 시간 계산', '넘김 세 숫자로 계산 요청'],
                    'n-P3': ['이미 있음 남은 시간 추정', '받음 세 숫자 받기', '메뉴에서 진행 정보 누락 확인', '메뉴에서 경과 시간 계산']}
            labels = ['세 숫자로 계산 요청', '세 숫자로 계산 요청']
        ok = rows['n-P1'] == want['n-P1'] and rows['n-P2'] == want['n-P1'] and rows['n-P3'] == want['n-P3'] and [e['label'] for e in g['edges']] == labels
        ok = ok and not any(n['faceClip'] for n in g['nodes'])
        return ok, {'rows': rows, 'labels': [e['label'] for e in g['edges']], 'faceClip': [n['faceClip'] for n in g['nodes']]}
    ok, det = content_ok(ga, 'after'); rec(size, '1', '1월 16일 변경 보기: 이동한 책임(옮겨 감/옮겨 옴)·남은 표시·추정 본체 글자와 렌더, 카드 잘림 없음', ok, det)
    page.click('#vBefore'); page.wait_for_timeout(150)
    gb = geo(page)
    d = geo_diff({**ga, 'view': ['before']}, gb)
    rec(size, '1', '변경 전으로 전환: 대상·관계 ID/개수·rect·선 경로·transform·scroll·선택 동일', not d, d)
    ok, det = content_ok(gb, 'before'); rec(size, '1', '변경 전 보기: 두 메뉴가 확인·경과 계산, 세 숫자 전달, 공통 계산은 이미 있음', ok, det)
    items = {k: vis(page, k) for k in ('#followTxt', '#followOpen', '#scope')}
    rec(size, '1', '변경 전 보기에서도 후속 기록 줄·범위 표시 유지', all(v['ok'] for v in items.values()), {k: v['ok'] for k, v in items.items()})
    if not narrow: shot('B-1440-compare-before.png')
    # 후속 기록 대화상자: 버튼 닫기 / 재열기 / Escape
    for how in ('button', 'escape'):
        page.click('#followOpen'); page.wait_for_timeout(150)
        dv = page.evaluate("()=>{const d=document.getElementById('followDlg');return {hidden:d.hidden,links:d.querySelectorAll('a').length,items:d.querySelectorAll('li').length,text:d.innerText}}")
        rec(size, '1', f'후속 기록 열기({how} 전): 되돌림 요청 2·미병합 종료 1, 미확인 문장', not dv['hidden'] and dv['items'] == 3 and dv['links'] == 3 and '확인하지 않았습니다' in dv['text'] and 'merged=false' in dv['text'],
            {'items': dv['items'], 'links': dv['links']})
        if how == 'button': page.click('#fClose')
        else: page.keyboard.press('Escape')
        page.wait_for_timeout(150)
        dc = page.evaluate("()=>{const d=document.getElementById('followDlg');return {hidden:d.hidden,children:d.children.length,links:d.querySelectorAll('a,button').length,active:document.activeElement.id}}")
        rec(size, '1', f'후속 기록 닫기({how}): 실제 제거·출발 초점', dc['hidden'] and dc['children'] == 0 and dc['links'] == 0 and dc['active'] == 'followOpen', dc)
    page.click('#vAfter'); page.wait_for_timeout(150)
    gc = geo(page)
    d = geo_diff(ga, gc); rec(size, '1', '1월 16일 변경으로 복귀: 처음 측정과 동일', not d, d)

    # ================= 경로2: 부분·후속 기록 왕복 =================
    okb, used = bring(page, '#mapScroll', '#n-P3 .face')
    page.click('#n-P3'); page.wait_for_timeout(150)
    g_enter = geo(page)
    note(size, '2', 'P3 선택 전 지도 휠 보조 횟수', used)
    okb, used2 = bring(page, '#panel', READBTN) if not narrow else (vis(page, READBTN)['ok'], 0)
    rec(size, '2', '선택 설명에서 ‘이 부분 보기’ 접근', okb, {'wheelAssist': used2})
    p1_in_pane_at_entry = next(n['inPane'] for n in g_enter['nodes'] if n['id'] == 'n-P1')
    page.click(READBTN); page.wait_for_timeout(200)
    r0 = rd(page); note(size, '2', '읽기 자연 스크롤 여유(px)', r0['max'])
    items = {k: vis(page, k) for k in ('#rBack', '#rPrep', '#reader .crumb', '#reader h2', '#p-code .ba')}
    rec(size, '2', '읽기 시작: 복귀·준비·목적·이름·전후 변화 표시', all(v['ok'] for v in items.values()), {k: v['ok'] for k, v in items.items()})
    # 자연 비초기 위치에서 P1 위치 보기 → (좁은 폭) 읽던 곳으로
    if r0['max'] > 0: wheel(page, '#reader', 0, 180)
    okb, used = bring(page, '#reader', '[data-loc=P1]')
    rb = rd(page); rowr = rect(page, '#row-P1')
    note(size, '2', 'P1 위치 보기 직전 읽기 scrollTop(실제 휠)', {'top': rb['top'], 'assistWheels': used})
    page.click('[data-loc=P1]'); page.wait_for_timeout(200)
    gl = geo(page); moved = page.get_attribute('#n-P1', 'data-moved')
    p1 = next(n for n in gl['nodes'] if n['id'] == 'n-P1')
    same_scroll = abs(gl['sl'] - g_enter['sl']) <= 1 and abs(gl['st'] - g_enter['st']) <= 1
    honest = (moved == '0' and same_scroll and p1_in_pane_at_entry) or (moved == '1' and not p1_in_pane_at_entry and not same_scroll)
    if narrow:
        ok = gl['mapShown'] and p1['inPane'] and gl['sel'] == ['n-P3'] and honest and gl['active'] == 'backRead' and not rd(page)['shown']
    else:
        ok = p1['inPane'] and gl['sel'] == ['n-P3'] and honest and rd(page)['top'] == rb['top'] and rd(page)['active'] == 'loc-P1'
    rec(size, '2', 'P1 지도에서 위치 보기: 대상 시야 안, 선택 P3 유지, 이동 여부 정직', ok,
        {'moved': moved, 'inPaneAtEntry': p1_in_pane_at_entry, 'scrollEntry': [g_enter['sl'], g_enter['st']], 'scrollNow': [gl['sl'], gl['st']], 'active': gl['active']})
    if narrow:
        v = vis(page, '#backRead'); rec(size, '2', '‘읽던 곳으로’ 표시', v['ok'], v)
        page.click('#backRead'); page.wait_for_timeout(200)
    ra = rd(page); rowa = rect(page, '#row-P1')
    rec(size, '2', f'읽던 곳: scrollTop {rb["top"]}→{ra["top"]}, 출발 행 원시 rect, 출발 버튼 초점', ra['shown'] and abs(ra['top'] - rb['top']) <= 1 and close(rowr, rowa) and ra['active'] == 'loc-P1',
        {'before': {'top': rb['top'], 'row': rowr}, 'after': {'top': ra['top'], 'row': rowa, 'active': ra['active']}})
    # 후속 기록 peek: 버튼 닫기 / 재열기 / Escape
    okb, used = bring(page, '#reader', '[data-peek=follow]')
    top0 = rd(page)['top']; host0 = rect(page, '#p-follow h3')
    note(size, '2', '후속 기록 열기 전 읽기 scrollTop', {'top': top0, 'assistWheels': used})
    page.click('[data-peek=follow]'); page.wait_for_timeout(150)
    pv = page.evaluate("()=>{const p=document.getElementById('pk-follow');return p?{links:p.querySelectorAll('a').length,btn:p.querySelectorAll('button').length,items:p.querySelectorAll('li').length}:null}")
    rec(size, '2', '후속 기록 인라인 열림(1/21 요청 2, 2/1 미병합 1)', pv and pv['items'] == 3 and pv['links'] == 3 and pv['btn'] == 1, pv)
    for how in ('button', 'reopen-escape'):
        if how == 'button':
            okc, _ = bring(page, '#reader', '#pk-follow [data-act=peek-close]')
            t_before_click = rd(page)['top']
            if narrow: shot('C-390-selection-follow.png')  # 실제 휠로 후속 기록 본문이 보이는 위치
            page.click('#pk-follow [data-act=peek-close]')
        else:
            page.click('[data-peek=follow]'); page.wait_for_timeout(120)
            rec(size, '2', '같은 후속 기록 재열기', page.evaluate("()=>!!document.getElementById('pk-follow')"), None)
            t_before_click = rd(page)['top']; page.keyboard.press('Escape')
        page.wait_for_timeout(150)
        c = page.evaluate("()=>({peek:document.querySelectorAll('#reader .peek').length,links:document.querySelectorAll('#reader .peek a,#reader .peek button').length,exp:document.querySelector('[data-peek=follow]').getAttribute('aria-expanded')})")
        r_ = rd(page); h_ = rect(page, '#p-follow h3')
        rec(size, '2', f'후속 기록 닫기({how}): 본문·링크·닫기 실제 제거, 출발 위치·초점', c['peek'] == 0 and c['links'] == 0 and c['exp'] == 'false' and abs(r_['top'] - top0) <= 1 and close(h_, host0) and r_['active'] == 'peek-follow',
            {**c, 'top': [top0, t_before_click, r_['top']], 'host': [host0, h_], 'active': r_['active']})
    if not narrow:  # 공통 계산의 편집 전 준비문 PNG와 기본문 기록(단언 아님)
        page.click('#rPrep'); page.wait_for_timeout(200)
        note(size, '2', '공통 계산 편집 전 준비문(관측)', page.evaluate("()=>Object.fromEntries([...document.querySelectorAll('#prep textarea')].map(t=>[t.dataset.f,t.value]))"))
        shot('E-1440-prep-before-edit-common.png')
        page.keyboard.press('Escape'); page.wait_for_timeout(120)
    page.click('#rBack'); page.wait_for_timeout(200)
    gr = geo(page)
    d = geo_diff(g_enter, gr); rec(size, '2', '진입 전 지도로: 원래 상태 동일, 초점 P3 카드', not d and gr['active'] == 'n-P3', {'diff': d, 'active': gr['active']})

    # ================= 경로3: 준비·전체 복귀 =================
    page.click('#zIn'); page.wait_for_timeout(150)
    if not narrow: page.click('#zIn'); page.wait_for_timeout(150)
    ZM = 'matrix(1.15' if narrow else 'matrix(1.3'
    wheel(page, '#mapScroll', 30, 120)
    okb, used = bring(page, '#mapScroll', '#n-P2 .face')
    page.click('#n-P2'); page.wait_for_timeout(150)
    pre1 = geo(page)
    rec(size, '3', '확대·이동한 지도에서 P2 선택(비기본 배율, 비초기 scroll)', pre1['transform'].startswith(ZM) and (pre1['sl'] > 0 or pre1['st'] > 0) and pre1['sel'] == ['n-P2'],
        {'transform': pre1['transform'], 'sl': pre1['sl'], 'st': pre1['st'], 'assistWheels': used})
    def enter():
        if not narrow: bring(page, '#panel', READBTN)
        page.click(READBTN); page.wait_for_timeout(200)
    def prep_vals():
        return page.evaluate("()=>Object.fromEntries([...document.querySelectorAll('#prep textarea')].map(t=>[t.dataset.f,t.value]))")
    enter()
    ftop = rd(page)['top']
    page.click('#rPrep'); page.wait_for_timeout(200)
    d0 = prep_vals()
    want = (d0['purpose'].startswith('추정할 수 있을 때 업데이트 다운로드의 남은 시간') and '설정 메뉴의 업데이트 표시' in d0['target'] and '1월 16일 고정 변경' in d0['target']
            and d0['ask'].startswith('먼저') and '확인해 주세요' in d0['ask'] and '선택지를 근거와 함께 제안' in d0['ask'] and '1월 21일' in d0['ask']
            and '범위를 미리 정하지 않습니다' in d0['ask'] and '1월 16일 변경만' not in d0['ask']
            and '자동 수정 범위가 아님' in d0['keep'] and '영향이 없다는 보장은 아님' in d0['keep']
            and '되돌림 요청의 정확한 범위와 지금 반영 상태' in d0['unknown'] and 'PR이 병합되지 않고 닫힌 이유' in d0['unknown']
            and not any(x in ''.join(d0.values()) for x in ('완료했', '완료하', '공통화 완료', '되돌림 완료')))
    rec(size, '3', '편집 전 준비문: 목적·대상·1/16 변경·후속 기록·확인 요청+수정 제안·미확인', want, d0)
    v = vis(page, '#prepClose'); rec(size, '3', '준비 닫기 버튼 표시', v['ok'], v['ok'])
    sc = page.evaluate("()=>{const s=document.getElementById('prepScroll');return {scrollable:s.scrollHeight>s.clientHeight+1,max:s.scrollHeight-s.clientHeight}}")
    note(size, '3', '준비 영역 자연 스크롤', sc)
    if not narrow: shot('D-1440-prep-before-edit-menu.png')
    o = page.evaluate(OVF_JS); rec(size, '3', '준비 가로 넘침 없음', o['doc'] <= o['vw'], o)
    ADD = ' 확인 결과와 함께, 이 화면에서 남은 시간이 언제 보이고 언제 숨겨지는지도 한두 문장으로 적어 주세요.'
    page.click('#pf-ask'); page.keyboard.press('Control+End'); page.keyboard.type(ADD)
    edited = prep_vals()
    marks = page.evaluate("()=>[...document.querySelectorAll('#prep [data-ed]')].filter(s=>!s.hidden).map(s=>s.dataset.ed)")
    rec(size, '3', '요청 문장 실제 입력과 ‘직접 고침’ 표시', edited['ask'] == d0['ask'] + ADD and marks == ['ask'], marks)
    if sc['scrollable']:
        wheel(page, '#prepScroll', 0, 400)
        v = vis(page, '#sendNote'); rec(size, '3', '준비 하단 안내까지 실제 휠', v['ok'], v['ok'])
    page.click('#prepClose'); page.wait_for_timeout(150)
    c = page.evaluate("()=>({hidden:document.getElementById('prep').hidden,active:document.activeElement.id})"); r_ = rd(page)
    rec(size, '3', '준비 닫기: 출발 버튼 초점·읽기 위치', c['hidden'] and c['active'] == 'rPrep' and abs(r_['top'] - ftop) <= 1, {**c, 'top': [ftop, r_['top']]})
    if not narrow:  # 큰 화면은 읽는 중에도 지도 비교 버튼이 보인다
        page.click('#vBefore'); page.wait_for_timeout(150)
    page.click('#rPrep'); page.wait_for_timeout(150)
    r2 = prep_vals()
    rec(size, '3', '닫기' + ('·비교 전환' if not narrow else '') + '·재열기 뒤 편집 보존, 기준 문장 그대로', r2 == edited, None if r2 == edited else r2)
    page.keyboard.press('Escape'); page.wait_for_timeout(120)
    page.click('#rBack'); page.wait_for_timeout(200)
    post1 = geo(page); d = geo_diff(pre1, post1)
    rec(size, '3', '[복귀1] 세 대상 rect·computed transform·native scroll·비교 보기·선택·선 동일, 초점 P2', not d and post1['active'] == 'n-P2',
        {'diff': d, 'post': {k: post1[k] for k in ('transform', 'sl', 'st', 'view', 'sel', 'active')}})
    # 지도에서 비교 전환 후 재진입
    page.click('#vBefore'); page.wait_for_timeout(150)
    pre2 = geo(page)
    enter(); page.click('#rPrep'); page.wait_for_timeout(150)
    r3 = prep_vals()
    rec(size, '3', '지도에서 ‘변경 전’으로 바꾼 뒤 재진입: 준비문 편집·기준 그대로', r3 == edited, None if r3 == edited else r3)
    page.keyboard.press('Escape'); page.wait_for_timeout(120)
    page.click('#rBack'); page.wait_for_timeout(200)
    post2 = geo(page); d = geo_diff(pre2, post2)
    rec(size, '3', '[복귀2] 변경 전 보기 상태 그대로 복원(rect·transform·scroll·보기·선택)', not d and post2['view'] == ['before'] and post2['active'] == 'n-P2',
        {'diff': d, 'post': {k: post2[k] for k in ('transform', 'sl', 'st', 'view', 'sel', 'active')}})
    # 두 번째 대상(P1)의 준비가 P2 편집을 물려받지 않음
    okb, used = bring(page, '#mapScroll', '#n-P1 .face')
    page.click('#n-P1'); page.wait_for_timeout(150)
    pre3 = geo(page)
    enter(); page.click('#rPrep'); page.wait_for_timeout(150)
    p2 = prep_vals()
    rec(size, '3', '두 번째 대상(P1) 준비: 자기 기본문, P2 편집 미상속', '네이티브 메뉴의 업데이트 표시' in p2['target'] and '네이티브 메뉴바 파일' in p2['ask'] and ADD.strip() not in p2['ask'],
        {'target': p2['target'][:40], 'assistWheels': used})
    page.keyboard.press('Escape'); page.wait_for_timeout(120)
    page.click('#rBack'); page.wait_for_timeout(200)
    post3 = geo(page); d = geo_diff(pre3, post3)
    rec(size, '3', '[복귀3] P1 진입 전 상태 동일', not d and post3['active'] == 'n-P1', {'diff': d, 'active': post3['active']})
    page.click('#vAfter'); page.wait_for_timeout(120)
    o = page.evaluate(OVF_JS); rec(size, '3', '복귀 후 가로 넘침 없음', o['doc'] <= o['vw'], o)
    meta['errors'][size] = errors
    rec(size, '0', 'pageerror·console error 없음', not errors, errors)
    ctx.close()

meta = {'started': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'html': os.path.basename(HTML),
        'file_sha256_before': SHA_BEFORE, 'file_bytes': BYTES, 'url': URL, 'http': {}, 'errors': {},
        'playwright_python': pkg_version('playwright'), 'python': sys.version.split()[0]}
fatal = None; done = []
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        meta['browser'] = f'chromium {br.version} headless'
        for W, H, size in ((1440, 900, '1440x900'), (390, 844, '390x844')):
            try: run(br, W, H, size, meta); done.append(size)
            except Exception as ex: rec(size, 'FATAL', '경로 실행 중단', False, repr(ex))
        br.close()
except Exception as ex:
    fatal = repr(ex)
finally:
    srv.terminate()
    try: srv.wait(5)
    except Exception: srv.kill()
    meta['http_server_exit'] = srv.returncode
meta['file_sha256_after'] = sha(HTML); meta['file_unchanged'] = meta['file_sha256_after'] == SHA_BEFORE
meta['sizes_completed'] = done
nfail = sum(c['status'] == 'FAIL' for c in checks)
meta.update(finished=datetime.datetime.now(datetime.timezone.utc).isoformat(), fatal=fatal, failed=nfail)
json.dump({'meta': meta, 'checks': checks, 'observations': obs}, open(os.path.join(OUT, 'results.json'), 'w'), ensure_ascii=False, indent=1)
print(f'== failed {nfail} fatal {fatal} completed {done} file_unchanged {meta["file_unchanged"]}')
sys.exit(1 if (nfail or fatal or not meta['file_unchanged'] or len(done) != 2) else 0)
