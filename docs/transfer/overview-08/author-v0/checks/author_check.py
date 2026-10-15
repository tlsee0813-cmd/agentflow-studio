#!/usr/bin/env python3
"""cycle08 작성자검사 — 세 폭(1280x720, 1440x900, 390x844) × 계약의 두 흐름.
 A 첫 조망·전후·맞춤 / B 한 부분 이해·명시 왕복(준비 편집 보존)
사용: python3 -I author_check.py <overview-study.html> <out_dir>
측정: computed transform, 원시 getBoundingClientRect, native scrollLeft/Top(읽기만), overflow 조상 padding box clip,
5점 elementFromPoint, 실제 activeElement, 글자 computed font-size × 배율(유효 px, 관측).
앱 내부 state 읽기/주입, DOM scroll 주입, force 클릭, 복귀 직후 보정 없음. 이동은 실제 휠·클릭.
FAIL·pageerror·console error·폭 미완주·파일 SHA 변화가 있으면 exit 1.
"""
import sys, os, re, json, hashlib, socket, subprocess, time, datetime
from importlib.metadata import version as pkg_version
from playwright.sync_api import sync_playwright

HTML = os.path.abspath(sys.argv[1]); OUT = os.path.abspath(sys.argv[2]); os.makedirs(OUT, exist_ok=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
SHA_BEFORE = sha(HTML); BYTES = os.path.getsize(HTML)
checks, obs = [], []
# cycle07 fix1에서 정정한 네이티브 메뉴 준비 요청 문장(그대로여야 함)
FIX1_ASK_P1 = ('먼저 다음을 확인해 주세요. ① 지금 코드에서 이 화면이 공통 계산에 무엇을 넘기는지 ② 1월 21일 이 네이티브 메뉴바 파일 변경에 대한 되돌림 요청이 정확히 무엇을 가리켰는지(대상·범위)와 지금 반영 상태 ③ 그 요청과 현재 목적의 관계. '
               '확인한 근거를 바탕으로, 이 화면에 실제로 필요한 확인·수정 선택지를 근거와 함께 제안해 주세요. 지난 요청을 그대로 실행하거나 되돌릴 범위를 미리 정하지 않습니다.')
FIX1_UNK_P1 = '- 되돌림 요청의 정확한 범위와 지금 반영 상태\n- 2월 1일 PR이 병합되지 않고 닫힌 이유\n- 실제 화면 동작·추정 정확도·CI 결과'

def rec(size, flow, name, ok, detail=None):
    checks.append({'size': size, 'flow': flow, 'check': name, 'status': 'PASS' if ok else 'FAIL', 'detail': detail})
    print(f"[{'PASS' if ok else 'FAIL'}] {size} {flow} {name} {json.dumps(detail, ensure_ascii=False) if detail is not None else ''}", flush=True)

def note(size, flow, name, detail):
    obs.append({'size': size, 'flow': flow, 'observation': name, 'detail': detail})
    print(f"[OBS ] {size} {flow} {name} {json.dumps(detail, ensure_ascii=False)}", flush=True)

s_ = socket.socket(); s_.bind(('127.0.0.1', 0)); PORT = s_.getsockname()[1]; s_.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', os.path.dirname(HTML)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try: socket.create_connection(('127.0.0.1', PORT), 0.2).close(); break
    except OSError: time.sleep(0.1)
URL = f'http://127.0.0.1:{PORT}/{os.path.basename(HTML)}'

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
  return {exists:true, rect:{x:r.x,y:r.y,w:r.width,h:r.height}, clipBox:[L,T,R,B], inside, hits, innerClipped: inner,
          ok: inside && hits.every(Boolean) && !inner};
}"""

GEO_JS = r"""() => {
  const ms = document.getElementById('mapScroll'), w = document.getElementById('world');
  const box = el => { const r = el.getBoundingClientRect(); return {x:r.x, y:r.y, w:r.width, h:r.height}; };
  const pr = ms.getBoundingClientRect(), PL = pr.left + ms.clientLeft, PT = pr.top + ms.clientTop, PR = PL + ms.clientWidth, PB = PT + ms.clientHeight;
  const inPane = b => b.x >= PL - .5 && b.y >= PT - .5 && b.x + b.w <= PR + .5 && b.y + b.h <= PB + .5;
  const sc = parseFloat((getComputedStyle(w).transform.match(/matrix\(([^,]+)/) || [0, 1])[1]);
  const wr = w.getBoundingClientRect();
  const nodes = [...document.querySelectorAll('#world .node')].map(n => { const f = n.querySelector('.face'), b = box(f);
    return {id: n.id, rect: b, inPane: inPane(b), pressed: n.getAttribute('aria-pressed'),
      chips: [...n.querySelectorAll('.c')].map(c => c.innerText.trim()), cue: (n.querySelector('.cue') || {innerText: ''}).innerText.trim(),
      faceClip: f.scrollHeight > f.clientHeight + 1,
      nmPx: parseFloat(getComputedStyle(n.querySelector('.nm')).fontSize) * sc, rolePx: parseFloat(getComputedStyle(n.querySelector('.role')).fontSize) * sc}; });
  const edges = [...document.querySelectorAll('#edges g[data-rel]')].map(g => { const p = g.querySelector('path.ln'), L = p.getTotalLength(),
      a = p.getPointAtLength(0), b = p.getPointAtLength(L), lab = g.querySelector('.lab rect').getBoundingClientRect();
    const S = [wr.left + a.x * sc, wr.top + a.y * sc], E = [wr.left + b.x * sc, wr.top + b.y * sc];
    const pin = q => q[0] >= PL - .5 && q[0] <= PR + .5 && q[1] >= PT - .5 && q[1] <= PB + .5;
    return {id: g.id, from: g.dataset.from, to: g.dataset.to, d: p.getAttribute('d'), rect: box(p), start: S, end: E,
            endsInPane: pin(S) && pin(E), label: g.querySelector('text').textContent,
            labelInPane: inPane({x: lab.x, y: lab.y, w: lab.width, h: lab.height})}; });
  const ae = document.activeElement;
  return {transform: getComputedStyle(w).transform, scale: sc, sl: ms.scrollLeft, st: ms.scrollTop, pane: [PL, PT, PR, PB],
          view: [...document.querySelectorAll('.seg button[aria-pressed=true]')].map(b => b.dataset.view),
          sel: nodes.filter(n => n.pressed === 'true').map(n => n.id), nodes, edges,
          summary: document.getElementById('summary').innerText, active: ae ? (ae.id || ae.tagName) : null, mapShown: ms.offsetParent !== null};
}"""
READ_JS = r"""() => { const r = document.getElementById('reader'), ae = document.activeElement;
  return {shown: r.offsetParent !== null, top: r.scrollTop, max: r.scrollHeight - r.clientHeight,
          active: ae ? (ae.id || (ae.dataset && (ae.dataset.loc ? 'loc-' + ae.dataset.loc : '')) || ae.tagName) : null}; }"""
OVF_JS = "() => ({doc: document.documentElement.scrollWidth, vw: innerWidth})"
RECT_JS = "s => { const r = document.querySelector(s).getBoundingClientRect(); return {x:r.x, y:r.y, w:r.width, h:r.height}; }"
PREP_JS = "()=>Object.fromEntries([...document.querySelectorAll('#prep textarea')].map(t=>[t.dataset.f,t.value]))"

def vis(page, sel): return page.evaluate(VIS_JS, sel)
def geo(page): return page.evaluate(GEO_JS)
def rd(page): return page.evaluate(READ_JS)
def rect(page, sel): return page.evaluate(RECT_JS, sel)
def close(a, b, t=0.5): return all(abs(a[k] - b[k]) <= t for k in ('x', 'y', 'w', 'h'))
def same_path(a, b):
    na, nb = re.findall(r'-?[\d.]+', a), re.findall(r'-?[\d.]+', b)
    return re.sub(r'-?[\d.]+', '#', a) == re.sub(r'-?[\d.]+', '#', b) and len(na) == len(nb) and all(abs(float(x) - float(y)) <= 0.01 for x, y in zip(na, nb))

def wheel(page, sel, dx, dy):
    b = page.locator(sel).bounding_box()
    page.mouse.move(b['x'] + b['width'] / 2, b['y'] + min(b['height'] / 2, 150))
    page.mouse.wheel(dx, dy); page.wait_for_timeout(230)

def center_ok(v):
    if not v.get('rect'): return False
    r, cb = v['rect'], v['clipBox']; cx, cy = r['x'] + r['w'] / 2, r['y'] + r['h'] / 2
    return v['hits'][0] and cb[0] <= cx <= cb[2] and cb[1] <= cy <= cb[3]

def bring(page, container, sel, tries=8):
    used = 0
    for _ in range(tries):
        v = vis(page, sel)
        if v['ok'] or center_ok(v): return True, used
        r = v.get('rect') or rect(page, sel); cb = v.get('clipBox') or [0, 0, 0, 0]
        dy = (r['y'] + r['h'] / 2) - (cb[1] + cb[3]) / 2; dx = (r['x'] + r['w'] / 2) - (cb[0] + cb[2]) / 2
        wheel(page, container, max(-300, min(300, dx)) if abs(dx) > 20 else 0, max(-300, min(300, dy)) if abs(dy) > 20 else 0); used += 1
    v = vis(page, sel); return (v['ok'] or center_ok(v)), used

def geo_diff(a, b):
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

def exposure(g):
    return {'nodesInPane': {n['id']: n['inPane'] for n in g['nodes']}, 'edgeEndsInPane': {e['id']: e['endsInPane'] for e in g['edges']},
            'labelsInPane': {e['id']: e['labelInPane'] for e in g['edges']}, 'faceClip': [n['faceClip'] for n in g['nodes']]}

def all_exposed(g):
    return all(n['inPane'] and not n['faceClip'] for n in g['nodes']) and all(e['endsInPane'] and e['labelInPane'] for e in g['edges'])

def content(g, view):
    ch = {n['id']: n['chips'] for n in g['nodes']}; cue = {n['id']: n['cue'] for n in g['nodes']}
    if view == 'after':
        ok = (ch['n-P1'] == ['표시 문구·분기'] and ch['n-P2'] == ['표시 문구·분기'] and '공통 계산으로 옮김' in cue['n-P1'] and '공통 계산으로 옮김' in cue['n-P2']
              and ch['n-P3'] == ['남은 시간 추정', '진행 정보 확인', '경과 시간 계산'] and [e['label'] for e in g['edges']] == ['다운로드 상태 전달'] * 2
              and '옮겼' in g['summary'] and '두 호출은 그대로' in g['summary'])
    else:
        ok = (ch['n-P1'] == ['표시 문구·분기', '진행 정보 확인', '경과 시간 계산'] and ch['n-P2'] == ch['n-P1'] and cue['n-P1'] == ''
              and ch['n-P3'] == ['남은 시간 추정'] and '두 메뉴에서 함' in cue['n-P3'] and [e['label'] for e in g['edges']] == ['세 숫자 전달'] * 2
              and '이미 있었' in g['summary'])
    return ok, {'chips': ch, 'cue': cue, 'labels': [e['label'] for e in g['edges']], 'summary': g['summary']}

def run(browser, W, H, size, meta):
    narrow = W < 700
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
    rec(size, '0', '최초 HTTP status/body SHA = 원본 파일', doc.get('status') == 200 and doc.get('sha') == SHA_BEFORE, doc)
    shot = lambda n: page.screenshot(path=os.path.join(OUT, n))
    READBTN = '#panel .strip-head [data-act=read]' if narrow else '#panel .act.wide [data-act=read]'

    # ================= 흐름 A: 첫 조망·전후·맞춤 =================
    g0 = geo(page)
    hdr = {k: vis(page, k)['ok'] for k in ('#purposeTxt', '#scope', '#followTxt', '#followOpen', '#vBefore', '#vAfter', '#fitAll')}
    rec(size, 'A', '초기 머리: 목적·1/16 범위·후속 요청·비교·전체 맞춤 표시', all(hdr.values()), hdr)
    ex = exposure(g0)
    rec(size, 'A', '초기 지도: 세 역할 카드 전체·두 호출 양끝·라벨이 지도 영역 안, 카드 내부 잘림 없음 (스크롤·맞춤 없이)', all_exposed(g0), {**ex, 'transform': g0['transform']})
    names = {k: vis(page, f'#n-{k} .nm')['ok'] and vis(page, f'#n-{k} .role')['ok'] for k in ('P1', 'P2', 'P3')}
    cues = {'P1cue': vis(page, '#n-P1 .cue')['ok'], 'P2cue': vis(page, '#n-P2 .cue')['ok'], 'P3moved': vis(page, '#n-P3 .c.mv')['ok']}
    rec(size, 'A', '초기: 세 이름·역할 줄·이동 단서(메뉴의 →옮김, 공통의 ←칩) hit 표시', all(names.values()) and all(cues.values()), {**names, **cues})
    ok, det = content(g0, 'after'); rec(size, 'A', '1월 16일 보기 내용: 실제 담당 부분에만 확인·경과 계산', ok, det)
    note(size, 'A', '초기 유효 글자 크기(px = computed font-size × 배율)', {n['id']: [round(n['nmPx'], 2), round(n['rolePx'], 2)] for n in g0['nodes']})
    o = page.evaluate(OVF_JS); rec(size, 'A', '초기 가로 넘침 없음', o['doc'] <= o['vw'], o)
    if size == '1280x720': shot('A-1280-initial.png')
    if size == '390x844': shot('B-390-initial.png')
    page.click('#vBefore'); page.wait_for_timeout(150)
    gb = geo(page)
    d = geo_diff({**g0, 'view': ['before']}, gb)
    rec(size, 'A', '변경 전 전환: 카드·선 raw rect·경로·transform·scroll 동일(외곽·배치 고정)', not d, d)
    ok, det = content(gb, 'before'); rec(size, 'A', '변경 전 내용: 두 메뉴가 확인·경과 계산, 공통 카드엔 추정만(가짜 행 없음)+짧은 설명', ok, det)
    rec(size, 'A', '변경 전에서도 세 역할·두 호출 노출 유지', all_exposed(gb), exposure(gb))
    if size == '1280x720': shot('D-1280-before-view.png')
    page.click('#vAfter'); page.wait_for_timeout(150)
    rec(size, 'A', '1월 16일로 복귀: 처음 측정과 동일', not geo_diff(g0, geo(page)), geo_diff(g0, geo(page)))
    # 선택 → 실제 확대·휠 이동 → 전체 맞춤
    page.click('#n-P1'); page.wait_for_timeout(120)
    page.click('#zIn'); page.wait_for_timeout(120); page.click('#zIn'); page.wait_for_timeout(120)
    wheel(page, '#mapScroll', 80, 120)
    gz = geo(page)
    note(size, 'A', '확대·이동 후(맞춤 전) 노출', {**exposure(gz), 'transform': gz['transform'], 'sl': gz['sl'], 'st': gz['st']})
    page.click('#fitAll'); page.wait_for_timeout(200)
    gf = geo(page)
    rec(size, 'A', '전체 맞춤: 세 역할·두 호출 양끝·라벨 다시 지도 영역 안 (새 보기)', all_exposed(gf),
        {**exposure(gf), 'transform': gf['transform'], 'sl': gf['sl'], 'st': gf['st'], 'zoomedTransform': gz['transform']})
    rec(size, 'A', '전체 맞춤이 선택·비교 보기를 바꾸지 않음', gf['sel'] == ['n-P1'] and gf['view'] == ['after'], {'sel': gf['sel'], 'view': gf['view']})
    note(size, 'A', '맞춤 후 유효 글자 크기(px)', {n['id']: [round(n['nmPx'], 2), round(n['rolePx'], 2)] for n in gf['nodes']})

    # ================= 흐름 B: 한 부분 이해·명시 왕복 =================
    # 비초기 출발: 맞춤 상태에서 실제 확대·휠
    page.click('#zIn'); page.wait_for_timeout(120)
    if geo(page)['scale'] < 1.15: page.click('#zIn'); page.wait_for_timeout(120)  # 390: 맞춤(0.99)→100%는 스크롤 여유가 없어 한 단계 더
    wheel(page, '#mapScroll', 40, 90)
    okb, used = bring(page, '#mapScroll', '#n-P1 .face')
    pre = geo(page)
    rec(size, 'B', '진입 전 지도가 초기와 다름(비기본 배율·실제 휠 이동)', pre['transform'] != g0['transform'] and (pre['sl'] > 0 or pre['st'] > 0),
        {'transform': pre['transform'], 'sl': pre['sl'], 'st': pre['st']})
    note(size, 'B', '진입 전 지도', {'transform': pre['transform'], 'sl': pre['sl'], 'st': pre['st'], 'sel': pre['sel'], 'assistWheels': used})
    if narrow:
        sv = {k: vis(page, k)['ok'] for k in ('#panel h2', '#panel .strip-c', '#panel .strip-r', READBTN)}
        txt = page.inner_text('#panel')
        rec(size, 'B', '좁은 선택 줄: 대상 이름·현재 시점 책임 위치·호출 관계·이 부분 보기 표시', all(sv.values()) and '공통 계산으로 옮김' in txt and '공통 계산을 씀' in txt, sv)
    else:
        sv = {k: vis(page, k)['ok'] for k in ('#panel h2', '#panel .rt-tbl', READBTN)}
        tbl = page.inner_text('#panel .rt-tbl')
        ok = all(sv.values()) and all(x in tbl for x in ('진행 정보 확인', '경과 시간 계산', '공통 계산에 넘김', '세 숫자', '다운로드 상태', '이 메뉴', '공통 계산'))
        rec(size, 'B', '선택 상세(기존 패널): 두 책임의 전후 담당·넘기는 값·남는 역할', ok and '남는 역할' in page.inner_text('#panel'), {**sv, 'table': tbl})
        if size == '1440x900': shot('C-1440-selected-detail.png')
    gsel = geo(page)
    rec(size, 'B', '상세를 열어도 카드·선 위치 그대로(다른 카드 밀림 없음)', not geo_diff(pre, gsel), geo_diff(pre, gsel))
    page.click(READBTN); page.wait_for_timeout(200)
    tv = vis(page, '#p-code .rt-tbl')
    rec(size, 'B', '부분 읽기: 두 책임 표·복귀·준비 버튼 표시', tv['ok'] and vis(page, '#rBack')['ok'] and vis(page, '#rPrep')['ok'], {'table': tv['ok']})
    r0 = rd(page); note(size, 'B', '읽기 자연 스크롤 여유(px)', r0['max'])
    if r0['max'] > 0: wheel(page, '#reader', 0, 160)
    okb, used = bring(page, '#reader', '[data-loc=P3]')
    rb = rd(page); rowr = rect(page, '#row-P3')
    note(size, 'B', '위치 보기 직전 읽기 scrollTop(실제 휠)', {'top': rb['top'], 'assistWheels': used})
    page.click('[data-loc=P3]'); page.wait_for_timeout(200)
    gl = geo(page); p3 = next(n for n in gl['nodes'] if n['id'] == 'n-P3')
    if narrow:
        ok = gl['mapShown'] and p3['inPane'] and gl['sel'] == ['n-P1'] and gl['active'] == 'backRead' and not rd(page)['shown'] and vis(page, '#backRead')['ok']
        ctxok = '선택은 그대로' in page.inner_text('#panel')
        rec(size, 'B', '좁은 폭 위치 보기: 공통 계산이 지도 안, 선택 네이티브 메뉴 유지, 읽던 곳 버튼', ok and ctxok, {'sel': gl['sel'], 'moved': page.get_attribute('#n-P3', 'data-moved'), 'scroll': [gl['sl'], gl['st']]})
        page.click('#backRead'); page.wait_for_timeout(200)
    else:
        rec(size, 'B', '위치 보기: 공통 계산이 지도 안, 선택 유지, 읽기 위치 그대로', p3['inPane'] and gl['sel'] == ['n-P1'] and rd(page)['top'] == rb['top'],
            {'moved': page.get_attribute('#n-P3', 'data-moved'), 'scroll': [gl['sl'], gl['st']]})
    ra = rd(page); rowa = rect(page, '#row-P3')
    rec(size, 'B', f'읽던 곳: scrollTop {rb["top"]}→{ra["top"]}, 출발 행 rect·출발 버튼 초점', ra['shown'] and abs(ra['top'] - rb['top']) <= 1 and close(rowr, rowa) and ra['active'] == 'loc-P3',
        {'before': rowr, 'after': rowa, 'active': ra['active']})
    # 준비: 편집 전 → 의미 있는 편집 → 닫기 → 전체 복귀
    page.click('#rPrep'); page.wait_for_timeout(200)
    d0 = page.evaluate(PREP_JS)
    rec(size, 'B', '편집 전 준비문: cycle07 fix1 요청·미확인 문장 그대로', d0['ask'] == FIX1_ASK_P1 and d0['unknown'] == FIX1_UNK_P1, None if d0['ask'] == FIX1_ASK_P1 else d0)
    ADD = ' 확인 결과와 함께, 이 메뉴에서 남은 시간이 언제 보이고 언제 숨겨지는지도 한두 문장으로 적어 주세요.'
    page.click('#pf-ask'); page.keyboard.press('Control+End'); page.keyboard.type(ADD)
    edited = page.evaluate(PREP_JS)
    page.click('#prepClose'); page.wait_for_timeout(150)
    page.click('#rBack'); page.wait_for_timeout(200)
    post = geo(page); d = geo_diff(pre, post)
    rec(size, 'B', '전체 복귀: 진입 전 raw rect·computed transform·native scroll·비교 보기·선택 동일, 초점 선택 카드', not d and post['active'] == 'n-P1',
        {'diff': d, 'post': {k: post[k] for k in ('transform', 'sl', 'st', 'view', 'sel', 'active')}})
    # 복귀가 편집을 되돌리지 않음 / 맞춤도 되돌리지 않음
    page.click(READBTN); page.wait_for_timeout(150); page.click('#rPrep'); page.wait_for_timeout(150)
    v1 = page.evaluate(PREP_JS)
    rec(size, 'B', '복귀 뒤 재진입: 직접 고친 요청 유지', v1 == edited and v1['ask'] == FIX1_ASK_P1 + ADD, None)
    page.keyboard.press('Escape'); page.wait_for_timeout(100); page.click('#rBack'); page.wait_for_timeout(150)
    page.click('#fitAll'); page.wait_for_timeout(150)
    gf2 = geo(page)
    rec(size, 'B', '전체 맞춤 뒤 선택·비교 보기 유지', gf2['sel'] == ['n-P1'] and gf2['view'] == ['after'], {'sel': gf2['sel'], 'view': gf2['view'], 'transform': gf2['transform']})
    bring(page, '#panel', READBTN) if not narrow else None
    page.click(READBTN); page.wait_for_timeout(150); page.click('#rPrep'); page.wait_for_timeout(150)
    v2 = page.evaluate(PREP_JS)
    rec(size, 'B', '전체 맞춤 뒤에도 직접 고친 요청 유지', v2 == edited, None)
    page.keyboard.press('Escape'); page.wait_for_timeout(100); page.click('#rBack'); page.wait_for_timeout(150)
    rec(size, 'B', '맞춤 뒤 진입·복귀: 그 진입 전(맞춤) 보기로 돌아옴', not geo_diff(gf2, geo(page)), geo_diff(gf2, geo(page)))
    o = page.evaluate(OVF_JS); rec(size, 'B', '끝 상태 가로 넘침 없음', o['doc'] <= o['vw'], o)
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
        for W, H in ((1280, 720), (1440, 900), (390, 844)):
            size = f'{W}x{H}'
            try: run(br, W, H, size, meta); done.append(size)
            except Exception as ex: rec(size, 'FATAL', '흐름 실행 중단', False, repr(ex))
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
sys.exit(1 if (nfail or fatal or not meta['file_unchanged'] or len(done) != 3) else 0)
