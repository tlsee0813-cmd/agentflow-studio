#!/usr/bin/env python3
"""cycle06 작성자검사 — 계약의 핵심 3경로만 실제 Chromium(Playwright)으로 실행.
사용: python3 -I author_check.py <purpose-study.html> <out_dir>
경로1 두 폭 초기/선택/읽기에서 목적·역할·조건/자료·대상 접근(가림·잘림·표시)
경로2 맥락 위치보기↔읽던곳, 원문 닫기/재열기/Escape, 준비 직접편집·재열기
경로3 115% 비초기 지도→읽기→맥락 왕복→준비→진입 전 지도 복귀 (2회)
FAIL·pageerror·console error·중단이 하나라도 있으면 exit 1.
"""
import sys, os, json, hashlib, socket, subprocess, time, datetime
from importlib.metadata import version as pkg_version
from playwright.sync_api import sync_playwright

HTML = os.path.abspath(sys.argv[1]); OUT = os.path.abspath(sys.argv[2]); os.makedirs(OUT, exist_ok=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
SHA_BEFORE = sha(HTML); BYTES = os.path.getsize(HTML)
checks = []; obs = []

def rec(size, path, name, ok, detail=None):
    checks.append({'size': size, 'path': path, 'check': name, 'status': 'PASS' if ok else 'FAIL', 'detail': detail})
    print(f"[{'PASS' if ok else 'FAIL'}] {size} {path} {name} {json.dumps(detail, ensure_ascii=False) if detail is not None else ''}", flush=True)

def note(size, path, name, detail):
    obs.append({'size': size, 'path': path, 'observation': name, 'detail': detail})
    print(f"[OBS ] {size} {path} {name} {json.dumps(detail, ensure_ascii=False)}", flush=True)

s = socket.socket(); s.bind(('127.0.0.1', 0)); PORT = s.getsockname()[1]; s.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', os.path.dirname(HTML)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try: socket.create_connection(('127.0.0.1', PORT), 0.2).close(); break
    except OSError: time.sleep(0.1)
URL = f'http://127.0.0.1:{PORT}/{os.path.basename(HTML)}'

# 요소가 보이는 상태인지: 크기>0, 스크롤 컨테이너·뷰포트 안, 가운데 점이 자기 자신(또는 자손)을 가리킴, 잘림 없음
VIS_JS = r"""(sel) => {
  const e = document.querySelector(sel); if (!e) return {exists:false};
  const r = e.getBoundingClientRect();
  let clip = null, p = e.parentElement;
  while (p && p !== document.body) { const cs = getComputedStyle(p);
    if (/(auto|scroll|hidden)/.test(cs.overflow + cs.overflowX + cs.overflowY)) { const pr = p.getBoundingClientRect();
      clip = {t: pr.top, b: pr.bottom, l: pr.left, r: pr.right, id: p.id || p.className}; break; } p = p.parentElement; }
  const inVp = r.top >= -0.5 && r.bottom <= innerHeight + 0.5 && r.left >= -0.5 && r.right <= innerWidth + 0.5;
  const inClip = !clip || (r.top >= clip.t - 0.5 && r.bottom <= clip.b + 0.5 && r.left >= clip.l - 0.5 && r.right <= clip.r + 0.5);
  const cx = r.left + r.width / 2, cy = r.top + Math.min(r.height / 2, 12);
  const hit = document.elementFromPoint(cx, cy);
  const uncovered = !!hit && (hit === e || e.contains(hit));
  const textClipped = e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).overflowX !== 'visible';
  return {exists:true, w:r.width, h:r.height, top:r.top, bottom:r.bottom, inVp, inClip, uncovered,
          hit: hit ? (hit.id || hit.className || hit.tagName) : null, textClipped, clip: clip ? clip.id : null,
          ok: r.width > 0 && r.height > 0 && inVp && inClip && uncovered && !textClipped};
}"""

MAP_JS = r"""() => {
  const ms = document.getElementById('mapScroll'), sz = document.getElementById('sizer'), w = document.getElementById('world');
  const sc = parseFloat(sz.dataset.scale), pr = ms.getBoundingClientRect();
  const rect = id => { const r = document.querySelector('#n-'+id+' .face').getBoundingClientRect();
    return {x:r.x, y:r.y, w:r.width, h:r.height, inPane: r.left>=pr.left-0.5 && r.right<=pr.right+0.5 && r.top>=pr.top-0.5 && r.bottom<=pr.bottom+0.5}; };
  const ae = document.activeElement;
  return {scale: sc, transform: w.style.transform, sl: ms.scrollLeft, st: ms.scrollTop,
          center: [(ms.scrollLeft + ms.clientWidth/2)/sc, (ms.scrollTop + ms.clientHeight/2)/sc],
          sel: [...document.querySelectorAll('.node[aria-pressed=true]')].map(e => e.dataset.id),
          P1: rect('P1'), X1: rect('X1'), X2: rect('X2'),
          active: ae ? (ae.id || ae.dataset.id || ae.dataset.loc || ae.tagName) : null,
          mapShown: ms.offsetParent !== null,
          app: document.getElementById('app').className};
}"""
READ_JS = r"""() => { const r = document.getElementById('reader'); const ae = document.activeElement;
  return {shown: r.offsetParent !== null, top: r.scrollTop, max: r.scrollHeight - r.clientHeight,
          active: ae ? (ae.id || (ae.dataset && (ae.dataset.loc || ae.dataset.peek)) || ae.tagName) : null}; }"""
OVF_JS = "() => ({doc: document.documentElement.scrollWidth, vw: innerWidth})"

def vis(page, sel): return page.evaluate(VIS_JS, sel)

def wheel(page, sel, dx, dy):
    b = page.locator(sel).bounding_box()
    page.mouse.move(b['x'] + b['width'] / 2, b['y'] + min(b['height'] / 2, 160))
    page.mouse.wheel(dx, dy); page.wait_for_timeout(220)

def same_map(a, b):
    d = {}
    for k in ('scale', 'transform', 'sel'):
        if a[k] != b[k]: d[k] = (a[k], b[k])
    for k in ('sl', 'st'):
        if abs(a[k] - b[k]) > 1: d[k] = (a[k], b[k])
    for i in (0, 1):
        if abs(a['center'][i] - b['center'][i]) > 1: d['center'] = (a['center'], b['center'])
    for n in ('P1', 'X1', 'X2'):
        for k in 'xywh':
            if abs(a[n][k] - b[n][k]) > 0.5: d[f'{n}.{k}'] = (a[n][k], b[n][k])
    return d

def ev_rect(page, sel):
    return page.evaluate("s=>{const e=document.querySelector(s).getBoundingClientRect();return {x:e.x,y:e.y,w:e.width,h:e.height}}", sel)

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
    page.goto(URL, wait_until='load'); page.wait_for_timeout(400)
    meta['http'][size] = doc
    rec(size, '0', '첫 HTTP 응답 본문 SHA = 원본 파일 SHA', doc.get('status') == 200 and doc.get('sha') == SHA_BEFORE, doc)
    shot = lambda n: page.screenshot(path=os.path.join(OUT, n))
    READBTN = '#panel .strip-head [data-act=read]' if narrow else '#panel .act.wide [data-act=read]'

    # ===== 경로1: 초기 / 선택 / 읽기 접근 =====
    m0 = page.evaluate(MAP_JS)
    v = vis(page, '#purposeTxt')
    rec(size, '1', '초기: 목적 문장 표시(가림·잘림 없음)', v['ok'], v)
    note(size, '1', '초기 지도 시야 안 대상', {n: m0[n]['inPane'] for n in ('X1', 'P1', 'X2')})
    if not narrow:
        rec(size, '1', '초기(큰 화면): 세 대상이 지도 시야 안', all(m0[n]['inPane'] for n in ('X1', 'P1', 'X2')), {n: m0[n] for n in ('X1', 'P1', 'X2')})
    o = page.evaluate(OVF_JS); rec(size, '1', '초기: 가로 넘침 없음', o['doc'] <= o['vw'], o)
    shot(f'{"B-390" if narrow else "A-1440"}-initial.png')
    # 선택(지도 카드 실제 클릭) — 배치·배율 불변
    page.click('#n-P1'); page.wait_for_timeout(150)
    m1 = page.evaluate(MAP_JS)
    d = same_map({**m0, 'sel': ['P1']}, m1)
    rec(size, '1', '선택해도 지도 배치·배율·스크롤 불변, 선택=P1', not d and m1['sel'] == ['P1'], d or m1['sel'])
    if narrow:
        pm = page.evaluate("()=>{const p=document.getElementById('panel');return {sh:p.scrollHeight,ch:p.clientHeight}}")
        items = {s_: vis(page, s_) for s_ in ('#panel h2', '#panel .strip-role', '#panel .strip-keep', '#panel .strip-ctx span:nth-child(1)', '#panel .strip-ctx span:nth-child(2)', READBTN)}
        ok = pm['sh'] <= pm['ch'] and all(x['ok'] for x in items.values())
        txt = page.inner_text('#panel')
        ok = ok and all(t in txt for t in ('소개글 재사용', '담당자 확인·게시 선택 뒤에만 공개', '출연자가 낸 소개글', '행사 홈페이지'))
        rec(size, '1', '선택(예약영역): 역할·조건·두 맥락 이름·역할읽기 표시, 잘림 없음, 지도와 겹치지 않음', ok, {'panel': pm, 'items': {k: x.get('ok') for k, x in items.items()}})
        mp = page.locator('#mapScroll').bounding_box(); pb = page.locator('#panel').bounding_box()
        rec(size, '1', '예약영역이 지도를 덮지 않음', pb['y'] >= mp['y'] + mp['height'] - 0.5, {'mapBottom': mp['y'] + mp['height'], 'panelTop': pb['y']})
        shot('C-390-role-condition.png')
    else:
        items = {s_: vis(page, s_) for s_ in ('#panel h2', '#panel .keepbox', '#panel [data-pick=X1]', '#panel [data-pick=X2]', READBTN)}
        rec(size, '1', '선택(측면 설명): 역할·조건·두 맥락·역할읽기 표시', all(x['ok'] for x in items.values()), {k: x.get('ok') for k, x in items.items()})
    # 읽기
    page.click(READBTN); page.wait_for_timeout(200)
    items = {s_: vis(page, s_) for s_ in ('#rBack', '#rPrep', '#reader .crumb', '#p-role', '#p-keep')}
    rec(size, '1', '읽기 시작 화면: 복귀·준비·목적·역할·조건이 스크롤 없이 표시', all(x['ok'] for x in items.values()), {k: x.get('ok') for k, x in items.items()})
    r0 = page.evaluate(READ_JS)
    note(size, '1', '읽기 본문 자연 스크롤 여유(px)', r0['max'])
    for n in ('X1', 'X2'):
        vv = vis(page, f'#row-{n}')
        note(size, '1', f'읽기 첫 화면에 맥락 행 {n} 보임', vv['ok'])
    o = page.evaluate(OVF_JS); rec(size, '1', '읽기: 가로 넘침 없음', o['doc'] <= o['vw'], o)

    # ===== 경로2: 위치보기↔읽던곳 / 원문 / 준비 =====
    pre_map_view = page.evaluate(MAP_JS) if not narrow else m1  # 좁은 폭에서는 읽기 진입 직전 지도 상태
    for n in ('X2', 'X1'):
        if not vis(page, f'[data-loc={n}]')['ok']:
            for _ in range(6):
                wheel(page, '#reader', 0, 140)
                if vis(page, f'[data-loc={n}]')['ok']: break
        rb = page.evaluate(READ_JS); rowr = ev_rect(page, f'#row-{n}')
        note(size, '2', f'{n} 위치 보기 직전 읽기 scrollTop', rb['top'])
        before = page.evaluate(MAP_JS)
        mv = page.evaluate("()=>window.__study.state.mapView")  # 좁은 폭: 숨겨진 지도의 마지막 시야
        page.click(f'[data-loc={n}]'); page.wait_for_timeout(200)
        a = page.evaluate(MAP_JS); moved = page.evaluate(f"()=>document.getElementById('n-{n}').dataset.moved")
        base = {'sl': mv['sl'], 'st': mv['st'], n: pre_map_view[n] if n == 'X2' else {'inPane': None}} if narrow else before
        target_in = a[n]['inPane'] and a['mapShown']
        same = abs(a['sl'] - base['sl']) <= 1 and abs(a['st'] - base['st']) <= 1
        consistent = (moved == '0' and same) or (moved == '1' and not same and base[n]['inPane'] is not True)
        ok = target_in and a['sel'] == ['P1'] and consistent
        if narrow:
            ok = ok and a['active'] == 'backRead' and not page.evaluate(READ_JS)['shown']
        else:
            ok = ok and page.evaluate(READ_JS)['top'] == rb['top'] and a['active'] == n
        rec(size, '2', f'{n} 지도에서 위치 보기: 대상 시야 안·선택 P1 유지·이동 여부 정직', ok,
            {'moved': moved, 'scrollBefore': [base['sl'], base['st']], 'scrollAfter': [a['sl'], a['st']], 'targetInPaneBefore': base[n]['inPane'], 'active': a['active']})
        if narrow and n == 'X2': shot('D-390-locate-homepage.png')
        if narrow:
            sv = vis(page, '#backRead'); rec(size, '2', '위치 화면에서 ‘읽던 곳으로’ 표시', sv['ok'], sv)
            page.click('#backRead'); page.wait_for_timeout(200)
            ra = page.evaluate(READ_JS); rowa = ev_rect(page, f'#row-{n}')
            ok = ra['shown'] and abs(ra['top'] - rb['top']) <= 1 and ra['active'] == n and all(abs(rowa[k] - rowr[k]) <= 0.5 for k in 'xywh')
            rec(size, '2', f'{n} 읽던 곳으로: 읽기 위치·행 rect·출발 버튼 초점', ok, {'before': rb['top'], 'after': ra['top'], 'active': ra['active']})
    # 원문 미리보기: 자연 스크롤 끝에서 보이는 근거 하나
    wheel(page, '#reader', 0, 600)
    top0 = page.evaluate(READ_JS)['top']
    note(size, '2', '원문 열기 전 실제 읽기 scrollTop(자연 길이 한계)', top0)
    key = page.evaluate("""()=>{const bar=document.querySelector('.rbar').getBoundingClientRect().bottom;
      const c=[...document.querySelectorAll('#reader .ev')].find(b=>{const r=b.getBoundingClientRect();return r.top>bar+8&&r.bottom<innerHeight-160});return c?c.dataset.peek:null}""")
    if not key:
        rec(size, '2', '현재 위치에서 보이는 원문 버튼', False, None)
    else:
        host = {'role': '#p-role', 'keep': '#p-keep', 'unk': '#p-unk'}[key]
        hr0 = ev_rect(page, host)
        page.click(f'.ev[data-peek={key}]'); page.wait_for_timeout(120)
        st = page.evaluate("k=>({open:!!document.getElementById('pk-'+k),n:document.querySelectorAll('.peek').length,exp:document.querySelector('.ev[data-peek='+k+']').getAttribute('aria-expanded'),top:document.getElementById('reader').scrollTop})", key)
        rec(size, '2', f'원문 열기({key}) 인라인', st['open'] and st['n'] == 1 and st['exp'] == 'true' and abs(st['top'] - top0) <= 1, st)
        for how in ('button', 'reopen-escape'):
            if how == 'button':
                cbv = vis(page, '.peek [data-act=peek-close]')
                page.click('.peek [data-act=peek-close]')
            else:
                page.click(f'.ev[data-peek={key}]'); page.wait_for_timeout(100)
                re = page.evaluate("k=>!!document.getElementById('pk-'+k)", key)
                rec(size, '2', '같은 원문 재열기', re, None)
                cbv = None; page.keyboard.press('Escape')
            page.wait_for_timeout(120)
            c = page.evaluate("""k=>({peeks:document.querySelectorAll('.peek').length,
                links:document.querySelectorAll('#reader .peek a, #reader .peek button').length,
                exp:document.querySelector('.ev[data-peek='+k+']').getAttribute('aria-expanded'),
                active:document.activeElement.dataset?document.activeElement.dataset.peek:null,
                top:document.getElementById('reader').scrollTop})""", key)
            hr = ev_rect(page, host)
            ok = c['peeks'] == 0 and c['links'] == 0 and c['exp'] == 'false' and c['active'] == key and abs(c['top'] - top0) <= 1 and all(abs(hr[k] - hr0[k]) <= 0.5 for k in 'xywh')
            rec(size, '2', f'원문 닫기({how}): 본문·링크·버튼 제거, 읽기 위치·출발 초점 유지', ok, {**c, 'before': top0, 'closeBtn': cbv and cbv.get('ok')})
    # 준비 직접 편집
    ftop = page.evaluate(READ_JS)['top']
    page.click('#rPrep'); page.wait_for_timeout(150)
    d0 = page.evaluate("()=>({open:!document.getElementById('prep').hidden,active:document.activeElement.id,ask:document.getElementById('pf-ask').value,keep:document.getElementById('pf-keep').value})")
    ok = d0['open'] and d0['active'] == 'pf-ask' and '담당자가 내용을 확인하고 게시를 선택한 뒤에만' in d0['keep'] and '운영 홈페이지에 바로 배포하지 않는다' in d0['keep'] and '먼저 만들 작은 작업' in d0['ask']
    rec(size, '2', '준비 기본문: 작은 작업 정리 요청 + 유지 조건 + 운영 배포 금지', ok, d0)
    o = page.evaluate(OVF_JS); rec(size, '2', '준비: 가로 넘침 없음', o['doc'] <= o['vw'], o)
    page.click('#pf-ask'); page.keyboard.press('Control+A'); page.keyboard.type('작성자검사: 직접 고친 요청 문장')
    page.click('#pf-keep'); page.keyboard.press('Control+End'); page.keyboard.type('\n- 작성자검사: 직접 덧붙인 조건')
    ed = page.evaluate("()=>({ask:document.getElementById('pf-ask').value,keep:document.getElementById('pf-keep').value,marks:[...document.querySelectorAll('[data-ed]')].filter(s=>!s.hidden).map(s=>s.dataset.ed)})")
    rec(size, '2', '직접 편집과 ‘직접 고침’ 표시', ed['ask'] == '작성자검사: 직접 고친 요청 문장' and ed['keep'].endswith('- 작성자검사: 직접 덧붙인 조건') and ed['marks'] == ['ask', 'keep'], ed['marks'])
    sc = page.evaluate("()=>{const s=document.getElementById('prepScroll');return {scrollable:s.scrollHeight>s.clientHeight+1}}")
    note(size, '2', '준비 영역 스크롤 필요 여부', sc)
    if not narrow: shot('E-1440-prep-edited.png')
    page.click('#prepClose'); page.wait_for_timeout(120)
    c = page.evaluate("()=>({hidden:document.getElementById('prep').hidden,active:document.activeElement.id,top:document.getElementById('reader').scrollTop})")
    rec(size, '2', '준비 닫기: 출발 버튼 초점·읽기 위치', c['hidden'] and c['active'] == 'rPrep' and abs(c['top'] - ftop) <= 1, {**c, 'before': ftop})
    page.click('#rPrep'); page.wait_for_timeout(120)
    r2 = page.evaluate("()=>({ask:document.getElementById('pf-ask').value,keep:document.getElementById('pf-keep').value})")
    rec(size, '2', '준비 재열기: 직접 고친 문장 보존', r2 == {'ask': ed['ask'], 'keep': ed['keep']}, None)
    page.keyboard.press('Escape'); page.wait_for_timeout(120)
    c = page.evaluate("()=>({hidden:document.getElementById('prep').hidden,active:document.activeElement.id})")
    rec(size, '2', '준비 Escape 닫기', c['hidden'] and c['active'] == 'rPrep', c)
    page.click('#rBack'); page.wait_for_timeout(150)
    back1 = page.evaluate(MAP_JS)
    rec(size, '2', '진입 전 지도로(초기 시야에서 진입한 경우)', not same_map(m1, back1) and back1['active'] == 'n-P1', same_map(m1, back1) or back1['active'])

    # ===== 경로3: 115% 비초기 지도 → 읽기 → 맥락 왕복 → 준비 → 복귀 (2회) =====
    page.click('#zIn'); page.wait_for_timeout(120)
    wheel(page, '#mapScroll', 70, 90)
    pre = page.evaluate(MAP_JS)
    rec(size, '3', '진입 전 지도: 115% 배율·비초기 스크롤·선택 P1', pre['scale'] == 1.15 and (pre['sl'] > 0 or pre['st'] > 0) and pre['sel'] == ['P1'], {k: pre[k] for k in ('scale', 'transform', 'sl', 'st', 'center', 'sel')})
    for rnd in (1, 2):
        rv = vis(page, READBTN)
        rec(size, '3', f'[{rnd}] 역할 읽기 버튼이 그 자리에서 접근 가능', rv['ok'], rv)
        page.click(READBTN); page.wait_for_timeout(150)
        for n in ('X1', 'X2'):
            if not vis(page, f'[data-loc={n}]')['ok']:
                for _ in range(6):
                    wheel(page, '#reader', 0, 140)
                    if vis(page, f'[data-loc={n}]')['ok']: break
            page.click(f'[data-loc={n}]'); page.wait_for_timeout(150)
            a = page.evaluate(MAP_JS)
            rec(size, '3', f'[{rnd}] {n} 위치 보기: 대상 시야 안·선택 P1', a[n]['inPane'] and a['sel'] == ['P1'], {'sl': a['sl'], 'st': a['st'], 'moved': page.evaluate(f"()=>document.getElementById('n-{n}').dataset.moved")})
            if narrow: page.click('#backRead'); page.wait_for_timeout(150)
        page.click('#rPrep'); page.wait_for_timeout(120)
        r3 = page.evaluate("()=>({ask:document.getElementById('pf-ask').value,keep:document.getElementById('pf-keep').value})")
        rec(size, '3', f'[{rnd}] 전체 복귀를 거쳐도 직접 고친 준비문 보존', r3 == {'ask': ed['ask'], 'keep': ed['keep']}, None)
        page.keyboard.press('Escape'); page.wait_for_timeout(100)
        page.click('#rBack'); page.wait_for_timeout(150)
        post = page.evaluate(MAP_JS)
        diff = same_map(pre, post)
        rec(size, '3', f'[{rnd}] 진입 전 지도 복귀: transform·scroll·중심·선택·3대상 rect 동일, 초점 P1', not diff and post['active'] == 'n-P1' and post['mapShown'],
            {'diff': diff, 'post': {k: post[k] for k in ('scale', 'transform', 'sl', 'st', 'center', 'sel', 'active')}})
        if narrow and rnd == 2: pass
    o = page.evaluate(OVF_JS); rec(size, '3', '복귀 후 가로 넘침 없음', o['doc'] <= o['vw'], o)
    meta['errors'][size] = errors
    rec(size, '0', 'pageerror·console error 없음', not errors, errors)
    ctx.close()

meta = {'started': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'html': os.path.basename(HTML),
        'file_sha256_before': SHA_BEFORE, 'file_bytes': BYTES, 'url': URL, 'http': {}, 'errors': {},
        'playwright_python': pkg_version('playwright')}
fatal = None
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch()
        meta['browser'] = f'chromium {br.version} headless'
        for W, H, size in ((1440, 900, '1440x900'), (390, 844, '390x844')):
            try: run(br, W, H, size, meta)
            except Exception as ex: rec(size, 'FATAL', '경로 실행 중단', False, repr(ex))
        br.close()
except Exception as ex:
    fatal = repr(ex)
finally:
    srv.terminate()
    try: srv.wait(5)
    except Exception: srv.kill()
    meta['http_server_exit'] = srv.returncode
meta['file_sha256_after'] = sha(HTML)
meta['file_unchanged'] = meta['file_sha256_after'] == SHA_BEFORE
nfail = sum(c['status'] == 'FAIL' for c in checks)
meta.update(finished=datetime.datetime.now(datetime.timezone.utc).isoformat(), fatal=fatal, failed=nfail)
json.dump({'meta': meta, 'checks': checks, 'observations': obs}, open(os.path.join(OUT, 'results.json'), 'w'), ensure_ascii=False, indent=1)
print(f'== failed {nfail} fatal {fatal} file_unchanged {meta["file_unchanged"]}')
sys.exit(1 if (nfail or fatal or not meta['file_unchanged']) else 0)
