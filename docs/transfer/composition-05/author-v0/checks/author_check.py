#!/usr/bin/env python3
"""cycle05 작성자검사 — 핵심 장면만 실제 브라우저(Chromium, Playwright)로 실행.
사용: python3 author_check.py <composition-study.html> <out_dir>
장면 S1 혼합 깊이·집계선 실제 끝점 / S2 비초기 근거 닫기·재열기·Escape /
S3 준비문 직접 편집 보존 / S4 정확 지도 복귀(+짧은 반복) / S5 두 크기 접근.
하나라도 FAIL·pageerror·console error면 exit 1.
"""
import sys, os, json, hashlib, socket, subprocess, time, datetime
from playwright.sync_api import sync_playwright

HTML = os.path.abspath(sys.argv[1]); OUT = os.path.abspath(sys.argv[2])
os.makedirs(OUT, exist_ok=True)
FILE_SHA = hashlib.sha256(open(HTML, 'rb').read()).hexdigest()
FILE_BYTES = os.path.getsize(HTML)

# 원문 계약에서 직접 옮긴 기대값 (페이지 JS를 읽지 않음)
REL_ENDS = {'R1': ('G1', 'C21'), 'R2': ('C21', 'C31'), 'R3': ('C21', 'C32'),
            'R4': ('C32', 'G5'), 'R5': ('G5', 'C42'), 'R6': ('C21', 'C41')}
PARENT = {'C21': 'G2', 'C22': 'G2', 'C31': 'G3', 'C32': 'G3', 'C41': 'G4', 'C42': 'G4'}

checks = []
def rec(size, scene, name, ok, detail=None):
    checks.append({'size': size, 'scene': scene, 'check': name, 'status': 'PASS' if ok else 'FAIL', 'detail': detail})
    print(f"[{'PASS' if ok else 'FAIL'}] {size} {scene} {name} {json.dumps(detail, ensure_ascii=False) if detail is not None else ''}", flush=True)

def free_port():
    s = socket.socket(); s.bind(('127.0.0.1', 0)); p = s.getsockname()[1]; s.close(); return p

PORT = free_port()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1',
                        '--directory', os.path.dirname(HTML)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try:
        socket.create_connection(('127.0.0.1', PORT), 0.2).close(); break
    except OSError:
        time.sleep(0.1)
URL = f'http://127.0.0.1:{PORT}/{os.path.basename(HTML)}'

GEOM_JS = r"""() => {
  const world = document.getElementById('world'), wr = world.getBoundingClientRect();
  const scale = parseFloat(document.getElementById('sizer').dataset.scale);
  const toW = r => ({l:(r.left-wr.left)/scale, t:(r.top-wr.top)/scale, r:(r.right-wr.left)/scale, b:(r.bottom-wr.top)/scale});
  const out = [];
  document.querySelectorAll('#edges g[data-k]').forEach(g => {
    const p = g.querySelector('path.vis'), L = p.getTotalLength();
    const s = p.getPointAtLength(0), e = p.getPointAtLength(L);
    out.push({rels: g.dataset.rels.split(' '), from: g.dataset.from, to: g.dataset.to,
      start: [s.x, s.y], end: [e.x, e.y], ringCount: g.querySelectorAll('circle.ring').length,
      fromRect: toW(document.getElementById('n-'+g.dataset.from).getBoundingClientRect()),
      toRect: toW(document.getElementById('n-'+g.dataset.to).getBoundingClientRect())});
  });
  const depth = {}; ['G2','G3','G4'].forEach(g => depth[g] = +document.getElementById('n-'+g).dataset.depth);
  return {edges: out, depth, scale};
}"""

STATE_JS = r"""() => {
  const ms = document.getElementById('mapScroll'), main = document.getElementById('main');
  const depth = {}; ['G2','G3','G4'].forEach(g => depth[g] = +document.getElementById('n-'+g).dataset.depth);
  const pressed = [...document.querySelectorAll('[data-sel][aria-pressed=true]')].map(e => e.dataset.sel);
  const r = document.getElementById('n-C32').getBoundingClientRect();
  const ae = document.activeElement;
  return {sl: ms.scrollLeft, st: ms.scrollTop, mainSt: main.scrollTop, scale: parseFloat(document.getElementById('sizer').dataset.scale),
          depth, pressed, rect: {x: r.x, y: r.y, w: r.width, h: r.height},
          active: ae ? (ae.id || ae.dataset.sel || ae.tagName) : null,
          mapVisible: !document.getElementById('app').classList.contains('focusing')};
}"""

OVERFLOW_JS = "() => ({doc: document.documentElement.scrollWidth, body: document.body.scrollWidth, vw: window.innerWidth})"

def expected_rep(node, depth):
    p = PARENT.get(node)
    return p if (p and depth[p] == 0) else node

def check_geometry(page, size, scene, label):
    g = page.evaluate(GEOM_JS)
    depth = g['depth']; problems = []
    # 1) 관계별 기대 대표 끝(계약 + 현재 깊이)과 실제 그려진 묶음 일치
    seen = {}
    for e in g['edges']:
        for r in e['rels']:
            seen[r] = (e['from'], e['to'])
    for rid, (a, b) in REL_ENDS.items():
        exp = (expected_rep(a, depth), expected_rep(b, depth))
        if seen.get(rid) != exp:
            problems.append({'rel': rid, 'drawn': seen.get(rid), 'expected': exp})
    if set(seen) != set(REL_ENDS):
        problems.append({'rel_set': sorted(seen)})
    # 2) 실제 path 시작/끝 좌표가 대표 요소 rect의 좌/우 변 중앙에 붙어 있는지
    for e in g['edges']:
        for pt, rc, nm in ((e['start'], e['fromRect'], 'start'), (e['end'], e['toRect'], 'end')):
            onx = min(abs(pt[0] - rc['l']), abs(pt[0] - rc['r'])) <= 0.75
            ony = abs(pt[1] - (rc['t'] + rc['b']) / 2) <= 0.75
            if not (onx and ony):
                problems.append({'edge': e['rels'], nm: pt, 'rect': rc})
        # 집계 표시(ring)는 실제 끝과 대표가 다를 때만
        agg = sum(1 for r in e['rels'] if REL_ENDS[r][0] != e['from']) > 0
        agg_to = sum(1 for r in e['rels'] if REL_ENDS[r][1] != e['to']) > 0
        if e['ringCount'] != int(agg) + int(agg_to):
            problems.append({'edge': e['rels'], 'rings': e['ringCount'], 'expected': int(agg) + int(agg_to)})
    rec(size, scene, f'관계 실제 끝점·집계 ({label})', not problems,
        {'depth': depth, 'bundles': [[e['from'], e['to'], e['rels']] for e in g['edges']], 'problems': problems})
    return g

def change_marks(page, size, scene, label):
    d = page.evaluate("""() => ({kidChg: [...document.querySelectorAll('.kid.chg')].map(e=>e.id),
      kchg: [...document.querySelectorAll('.kchg')].length,
      grpChg: [...document.querySelectorAll('.grp.chg')].length,
      agg: Object.fromEntries(['G2','G3','G4'].map(g=>{const el=document.getElementById('n-'+g);
        const a=el.querySelector('.gfold .agg'); return [g, el.classList.contains('collapsed') ? (a? el.querySelector('.gfold').innerText : '') : null];}))})""")
    ok = d['kidChg'] == ['n-C32'] and d['kchg'] == 1 and d['grpChg'] == 0 \
        and (d['agg']['G2'] in (None, '')) and (d['agg']['G4'] in (None, '')) \
        and (d['agg']['G3'] is None or ('작업문과 미리보기' in d['agg']['G3'] and '전체 변경 아님' in d['agg']['G3']))
    rec(size, scene, f'변경 소유는 작업문과 미리보기 한 곳 ({label})', ok, d)

def overflow_ok(page, size, scene, label):
    o = page.evaluate(OVERFLOW_JS)
    rec(size, scene, f'가로 넘침 없음 ({label})', o['doc'] <= o['vw'] and o['body'] <= o['vw'], o)

def in_view(page, sel):
    return page.evaluate("""s => {const e=document.querySelector(s); if(!e) return null; const r=e.getBoundingClientRect();
      return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,ok:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth&&r.width>0}}""", sel)

def wheel_over(page, sel, dx, dy):
    b = page.locator(sel).bounding_box()
    page.mouse.move(b['x'] + b['width'] / 2, b['y'] + min(b['height'] / 2, 200))
    page.mouse.wheel(dx, dy); page.wait_for_timeout(250)

def bring_into_map_view(page, sel):
    """지도 안 요소가 보이도록 실제 휠로 이동 (보조 이동으로 기록)."""
    for _ in range(12):
        v = page.evaluate("""s=>{const m=document.getElementById('mapScroll').getBoundingClientRect(),r=document.querySelector(s).getBoundingClientRect();
          return {dy:(r.top+r.height/2)-(m.top+m.height/2),dx:(r.left+r.width/2)-(m.left+m.width/2),ok:r.top>=m.top&&r.bottom<=m.bottom&&r.left>=m.left&&r.right<=m.right}}""", sel)
        if v['ok']: return True
        wheel_over(page, '#mapScroll', max(-400, min(400, v['dx'])), max(-400, min(400, v['dy'])))
    return False

def scroll_main_to(page, sel):
    for _ in range(12):
        v = in_view(page, sel)
        if v and v['ok']: return True
        wheel_over(page, '#panel', 0, 160 if v['bottom'] > page.viewport_size['height'] else -160)
    return False

def same_state(a, b):
    diffs = {}
    for k in ('sl', 'st', 'mainSt'):
        if abs(a[k] - b[k]) > 1: diffs[k] = (a[k], b[k])
    for k in ('scale', 'depth', 'pressed'):
        if a[k] != b[k]: diffs[k] = (a[k], b[k])
    for k in ('x', 'y', 'w', 'h'):
        if abs(a['rect'][k] - b['rect'][k]) > 0.5: diffs['rect.' + k] = (a['rect'][k], b['rect'][k])
    return diffs

def peek_cycle(page, size, scene, how, ev_key, p_rect0, top0):
    """열린 근거를 how(button|escape)로 닫고 위치·초점·제거를 대조."""
    if how == 'button':
        cb = in_view(page, '.peek [data-act=peek-close]')
        page.click('.peek [data-act=peek-close]')
    else:
        cb = None
        page.keyboard.press('Escape')
    page.wait_for_timeout(120)
    d = page.evaluate("""k=>{const p=document.getElementById('p-'+k).getBoundingClientRect(),b=document.querySelector('.ev[data-key="'+k+'"]');
      return {peek: !!document.getElementById('pk-'+k), anyPeek: document.querySelectorAll('.peek').length, exp: b.getAttribute('aria-expanded'),
        activeKey: document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.key : null,
        top: document.getElementById('focusView').scrollTop, pr: {x:p.x,y:p.y,w:p.width,h:p.height}}}""", ev_key)
    ok = (not d['peek'] and d['anyPeek'] == 0 and d['exp'] == 'false' and d['activeKey'] == ev_key
          and abs(d['top'] - top0) <= 1 and all(abs(d['pr'][k] - p_rect0[k]) <= 0.5 for k in 'xywh'))
    rec(size, scene, f'근거 닫기({how}) 후 위치·초점·제거', ok, {'before_top': top0, 'before_rect': p_rect0, 'after': d, 'closeBtnInView': cb})

def run_size(pw, browser, w, h, size, meta):
    ctx = browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1)
    page = ctx.new_page()
    errors = []; first_doc = {}
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
    def on_resp(r):
        if r.url == URL and 'sha' not in first_doc:
            try:
                body = r.body(); first_doc.update(status=r.status, bytes=len(body), sha=hashlib.sha256(body).hexdigest())
            except Exception as ex:
                first_doc.update(error=str(ex))
    page.on('response', on_resp)
    page.goto(URL, wait_until='load'); page.wait_for_timeout(400)
    meta['http'][size] = first_doc
    rec(size, 'S0', '첫 HTTP 응답 본문 SHA = 원본 파일 SHA', first_doc.get('sha') == FILE_SHA and first_doc.get('status') == 200, first_doc)
    shot = lambda n: page.screenshot(path=os.path.join(OUT, n))

    # ---------- S1 혼합 깊이 / 집계선 실제 끝점 ----------
    init = page.evaluate(GEOM_JS)['depth']
    rec(size, 'S1', '초기 깊이 (요청 맥락 접힘·전달할 내용 펼침·결과 연결 접힘)', init == {'G2': 0, 'G3': 1, 'G4': 0}, init)
    check_geometry(page, size, 'S1', '초기')
    change_marks(page, size, 'S1', '초기')
    overflow_ok(page, size, 'S1', '지도')
    for g in ('G2', 'G3'):
        bring_into_map_view(page, f'[data-tog={g}]'); page.click(f'[data-tog={g}]'); page.wait_for_timeout(120)
    d = page.evaluate(GEOM_JS)['depth']
    rec(size, 'S1', '두 영역을 서로 다르게 직접 조정 (다른 영역 불변)', d == {'G2': 1, 'G3': 0, 'G4': 0}, d)
    check_geometry(page, size, 'S1', '요청 맥락 펼침·전달할 내용 접힘')
    change_marks(page, size, 'S1', '전달할 내용 접힘')
    # 집계선(R2+R3 → 접힌 '전달할 내용') 실제 클릭
    pt = page.evaluate("""() => {const g=[...document.querySelectorAll('#edges g[data-k]')].find(g=>g.dataset.rels.split(' ').includes('R2'));
      const p=g.querySelector('path.hit'),L=p.getTotalLength(),q=p.getPointAtLength(L*0.5);
      const wr=document.getElementById('world').getBoundingClientRect(),s=parseFloat(document.getElementById('sizer').dataset.scale);
      return {rels:g.dataset.rels, x:wr.left+q.x*s, y:wr.top+q.y*s}}""")
    m = page.locator('#mapScroll').bounding_box()
    if not (m['y'] + 10 < pt['y'] < m['y'] + m['height'] - 10 and m['x'] + 10 < pt['x'] < m['x'] + m['width'] - 10):
        wheel_over(page, '#mapScroll', 0, pt['y'] - (m['y'] + m['height'] / 2))
        pt = page.evaluate("""() => {const g=[...document.querySelectorAll('#edges g[data-k]')].find(g=>g.dataset.rels.split(' ').includes('R2'));
          const p=g.querySelector('path.hit'),L=p.getTotalLength(),q=p.getPointAtLength(L*0.5);
          const wr=document.getElementById('world').getBoundingClientRect(),s=parseFloat(document.getElementById('sizer').dataset.scale);
          return {rels:g.dataset.rels, x:wr.left+q.x*s, y:wr.top+q.y*s, wheel:true}}""")
    hit_el = page.evaluate("([x,y]) => {const e=document.elementFromPoint(x,y); return e ? (e.getAttribute('class')||e.tagName) : null}", [pt['x'], pt['y']])
    page.mouse.click(pt['x'], pt['y']); page.wait_for_timeout(150)
    ptxt = page.inner_text('#panel')
    ok = pt['rels'] == 'R2 R3' and hit_el == 'hit' and all(s in ptxt for s in ('R2', 'R3', 'AI 입력', '작업문과 미리보기', '새 요청의 배경 고정'))
    rec(size, 'S1', '집계선 클릭 → 실제 관계 2개와 실제 끝 표시', ok, {'clickPoint': pt, 'elementAtPoint': hit_el, 'panelHead': ptxt[:160]})
    if size == '1440x900': shot('A-1440-map-mixed-aggregate.png')
    # 높이 변화 후 재선택 없이 선 끝
    bring_into_map_view(page, '[data-tog=G3]'); page.click('[data-tog=G3]'); page.wait_for_timeout(150)
    sel_after = page.evaluate("() => JSON.stringify(window.__study.state.sel)")
    rec(size, 'S1', '펼침(높이 변화) 뒤 선택 유지', json.loads(sel_after) == {'t': 'bundle', 'ids': ['R2', 'R3']}, sel_after)
    check_geometry(page, size, 'S1', '전달할 내용 다시 펼침')
    change_marks(page, size, 'S1', '다시 펼침')

    # ---------- S4 준비: 비초기 지도 위치·비기본 배율·선택 ----------
    bring_into_map_view(page, '#n-C32'); page.click('#n-C32'); page.wait_for_timeout(100)
    page.click('#zIn'); page.wait_for_timeout(100)
    if size == '1440x900': page.click('#zIn'); page.wait_for_timeout(100)
    wheel_over(page, '#mapScroll', 90, 70)
    s_mid = page.evaluate(STATE_JS)
    init_scale = 0.9 if size == '1440x900' else 1.0
    rec(size, 'S4', '진입 전 상태가 비초기 위치·비기본 배율', (s_mid['sl'] > 0 or s_mid['st'] > 0) and s_mid['scale'] != init_scale, s_mid)
    rel_btns_ok = page.locator('#panel [data-rel=R3]').count() == 1 and page.locator('#panel [data-rel=R4]').count() == 1
    scroll_main_to(page, '#panel [data-act=focus]')
    pre = page.evaluate(STATE_JS)
    rec(size, 'S5', '선택 설명에서 관계(R3·R4)와 ‘이 부분 보기’ 접근', rel_btns_ok and in_view(page, '#panel [data-act=focus]')['ok'], {'mainSt': pre['mainSt']})
    page.click('#panel [data-act=focus]'); page.wait_for_timeout(200)
    fstate = page.evaluate("""() => ({focusing: document.getElementById('app').classList.contains('focusing'),
      rail: document.querySelector('.rail').innerText, active: document.activeElement.id})""")
    ok = fstate['focusing'] and '전달할 내용' in fstate['rail'] and '새 요청의 배경 고정' in fstate['rail'] and '저장·복구' in fstate['rail'] and 'R3' in fstate['rail'] and 'R4' in fstate['rail']
    rec(size, 'S4', '집중: 상위 묶음 한 줄과 바깥 실제 연결 R3·R4 유지', ok, fstate)
    overflow_ok(page, size, 'S5', '집중')

    # ---------- S2 비초기 근거 닫기·재열기·Escape ----------
    wheel_over(page, '#focusView', 0, 520)
    top0 = page.evaluate("() => document.getElementById('focusView').scrollTop")
    rec(size, 'S2', '실제 휠로 비초기 읽기 위치', top0 >= 200, {'scrollTop': top0})
    bar = in_view(page, '#fBack'); barp = in_view(page, '#fPrep')
    rec(size, 'S5', '스크롤 중에도 전체 복귀·준비 버튼 화면 안', bar['ok'] and barp['ok'], {'fBack': bar, 'fPrep': barp})
    cand = page.evaluate("""() => {const fb=document.querySelector('.fbar').getBoundingClientRect().bottom;
      return [...document.querySelectorAll('.ev')].map(b=>{const r=b.getBoundingClientRect();return {k:b.dataset.key,t:r.top}})
        .filter(o=>o.t>fb+30&&o.t<innerHeight-330)}""")
    if not cand:
        rec(size, 'S2', '보이는 근거 버튼 찾기', False, {'note': 'no candidate'})
    else:
        key = cand[0]['k']
        pr0 = page.evaluate("k=>{const r=document.getElementById('p-'+k).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}}", key)
        page.click(f'.ev[data-key="{key}"]'); page.wait_for_timeout(120)
        o = page.evaluate("k=>({peek:!!document.getElementById('pk-'+k),exp:document.querySelector('.ev[data-key=\"'+k+'\"]').getAttribute('aria-expanded'),top:document.getElementById('focusView').scrollTop})", key)
        rec(size, 'S2', '근거 열림 (인라인)', o['peek'] and o['exp'] == 'true' and abs(o['top'] - top0) <= 1, {'key': key, **o})
        if size == '1440x900': shot('B-1440-focus-evidence-open.png')
        peek_cycle(page, size, 'S2', 'button', key, pr0, top0)
        page.click(f'.ev[data-key="{key}"]'); page.wait_for_timeout(120)
        reo = page.evaluate("k=>!!document.getElementById('pk-'+k)", key)
        rec(size, 'S2', '같은 근거 재열기', reo, None)
        peek_cycle(page, size, 'S2', 'escape', key, pr0, top0)

    # ---------- S3 준비문 직접 편집 · 닫기/재열기 보존 ----------
    ftop = page.evaluate("() => document.getElementById('focusView').scrollTop")
    page.click('#fPrep'); page.wait_for_timeout(150)
    o = page.evaluate("() => ({open: !document.getElementById('prep').hidden, active: document.activeElement.id, title: document.getElementById('prepTitle').textContent, target: document.getElementById('pf-target').value})")
    rec(size, 'S3', '준비문 열림 (선택한 작업문 배경 동작에 한정된 대상)', o['open'] and o['active'] == 'pf-target' and o['title'] == '작업문과 미리보기' and '동작만' in o['target'] and '구현하라는 요청이 아니다' in o['target'], o)
    overflow_ok(page, size, 'S5', '준비문')
    page.click('#pf-target'); page.keyboard.press('Control+A'); page.keyboard.type('작성자검사: 직접 고친 대상 문장')
    page.click('#pf-keep'); page.keyboard.press('Control+End'); page.keyboard.type('\n- 작성자검사: 직접 추가한 조건')
    edited = page.evaluate("() => ({target: document.getElementById('pf-target').value, keep: document.getElementById('pf-keep').value, marks: [...document.querySelectorAll('[data-ed]')].filter(s=>!s.hidden).map(s=>s.dataset.ed)})")
    rec(size, 'S3', '직접 편집 반영과 ‘직접 고침’ 표시', edited['target'] == '작성자검사: 직접 고친 대상 문장' and edited['keep'].endswith('- 작성자검사: 직접 추가한 조건') and edited['marks'] == ['target', 'keep'], edited)
    wheel_over(page, '#prepScroll', 0, 900)
    bt = page.evaluate("""() => {const s=document.getElementById('prepScroll'),sr=s.getBoundingClientRect(),n=document.getElementById('sendNote').getBoundingClientRect();
      return {scrollTop:s.scrollTop, scrollable:s.scrollHeight>s.clientHeight+1, noteInView:n.top>=sr.top-1&&n.bottom<=sr.bottom+1, note:document.getElementById('sendNote').innerText}}""")
    rec(size, 'S3', '준비문 하단(보내지 않음 안내) 화면 안 — scrollable=false면 휠 스크롤은 미발생', bt['noteInView'] and '보내지 않았습니다' in bt['note'], bt)
    if size == '1440x900': shot('C-1440-prep-edited.png')
    page.click('#prepClose'); page.wait_for_timeout(120)
    c = page.evaluate("() => ({hidden: document.getElementById('prep').hidden, active: document.activeElement.id, top: document.getElementById('focusView').scrollTop})")
    rec(size, 'S3', '닫기 버튼 → 출발 버튼 초점·읽기 위치', c['hidden'] and c['active'] == 'fPrep' and abs(c['top'] - ftop) <= 1, {'before': ftop, **c})
    page.click('#fPrep'); page.wait_for_timeout(120)
    r2 = page.evaluate("() => ({target: document.getElementById('pf-target').value, keep: document.getElementById('pf-keep').value, startTop: document.getElementById('prepScroll').scrollTop})")
    rec(size, 'S3', '재열기에서 직접 고친 문장 보존', r2['target'] == edited['target'] and r2['keep'] == edited['keep'], {'reopenStartScrollTop': r2['startTop']})
    page.keyboard.press('Escape'); page.wait_for_timeout(120)
    c = page.evaluate("() => ({hidden: document.getElementById('prep').hidden, active: document.activeElement.id, top: document.getElementById('focusView').scrollTop})")
    rec(size, 'S3', 'Escape 닫기 → 출발 버튼 초점·읽기 위치', c['hidden'] and c['active'] == 'fPrep' and abs(c['top'] - ftop) <= 1, {'before': ftop, **c})

    # ---------- S4 전체 복귀 ----------
    page.click('#fBack'); page.wait_for_timeout(150)
    post = page.evaluate(STATE_JS)
    diffs = same_state(pre, post)
    rec(size, 'S4', '전체 복귀: 위치·배율·선택·깊이·실제 대상 rect', post['mapVisible'] and not diffs, {'pre': pre, 'post': post, 'diffs': diffs})
    rec(size, 'S4', '복귀 초점이 선택한 작업문과 미리보기 카드', post['active'] == 'n-C32', post['active'])
    check_geometry(page, size, 'S4', '복귀 후')
    if size == '390x844': shot('D-390-map-after-return.png')
    # 짧은 반복: 다시 진입 → 근거 1회 열고 Escape → 준비문 보존 → 복귀
    page.click('#panel [data-act=focus]'); page.wait_for_timeout(150)
    k2 = page.evaluate("() => document.querySelector('.ev').dataset.key")
    page.click(f'.ev[data-key="{k2}"]'); page.wait_for_timeout(80); page.keyboard.press('Escape'); page.wait_for_timeout(80)
    page.click('#fPrep'); page.wait_for_timeout(120)
    r3 = page.evaluate("() => ({target: document.getElementById('pf-target').value, keep: document.getElementById('pf-keep').value})")
    rec(size, 'S3', '전체 복귀 후 재진입에도 직접 고친 준비문 보존', r3['target'] == edited['target'] and r3['keep'] == edited['keep'], None)
    if size == '390x844': shot('E-390-prep-after-reentry.png')
    page.keyboard.press('Escape'); page.wait_for_timeout(80)
    page.click('#fBack'); page.wait_for_timeout(150)
    post2 = page.evaluate(STATE_JS)
    diffs2 = same_state(pre, post2)
    rec(size, 'S4', '두 번째 복귀: 누적·상쇄 없음', not diffs2 and post2['active'] == 'n-C32', {'post2': post2, 'diffs': diffs2})
    overflow_ok(page, size, 'S5', '복귀 후 지도')

    meta['errors'][size] = list(errors)
    rec(size, 'S0', 'pageerror·console error 없음', not errors, errors)
    ctx.close()

meta = {'started': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'html': os.path.basename(HTML),
        'file_sha256': FILE_SHA, 'file_bytes': FILE_BYTES, 'url': URL, 'http': {}, 'errors': {}}
fatal = None
try:
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        meta['browser'] = f'chromium {browser.version} (Playwright, headless)'
        for w, h, size in ((1440, 900, '1440x900'), (390, 844, '390x844')):
            try:
                run_size(pw, browser, w, h, size, meta)
            except Exception as ex:
                rec(size, 'FATAL', '장면 실행 중단', False, repr(ex))
        browser.close()
except Exception as ex:
    fatal = repr(ex)
finally:
    srv.terminate()
    try: srv.wait(5)
    except Exception: srv.kill()
    meta['server_exit'] = srv.returncode

nfail = sum(1 for c in checks if c['status'] == 'FAIL')
meta.update(finished=datetime.datetime.now(datetime.timezone.utc).isoformat(), fatal=fatal,
            total=len(checks), failed=nfail, scenes_note='S1~S5 장면 단위 단언. 안내 문구 존재만 보는 단언은 넣지 않음.')
json.dump({'meta': meta, 'checks': checks}, open(os.path.join(OUT, 'results.json'), 'w'), ensure_ascii=False, indent=1)
print(f'== total {len(checks)} failed {nfail} fatal {fatal}')
sys.exit(1 if (nfail or fatal) else 0)
