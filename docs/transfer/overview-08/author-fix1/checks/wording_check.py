#!/usr/bin/env python3
"""cycle08 fix1 좁은 검사 — 바뀐 ‘진행 정보 누락 확인’ 문구가 세 폭의 초기·전후·선택 상세에서 실제로 보이고 잘리지 않는지만 본다.
사용: python3 -I wording_check.py <overview-study.html> <out_dir>
측정: 원시 rect, overflow 조상 padding box clip, 5점 elementFromPoint, 카드·예약 줄 내부 잘림(scrollHeight>clientHeight), 실제 글자.
앱 state 읽기/주입·DOM scroll 주입·force 클릭 없음. 기존 흐름(맞춤·왕복·준비)은 v0 검사 범위이며 여기서 반복하지 않는다.
FAIL·pageerror·console error·미완주·파일 SHA 변화 시 exit 1."""
import sys, os, json, hashlib, socket, subprocess, time, datetime
from importlib.metadata import version as pkg_version
from playwright.sync_api import sync_playwright

HTML = os.path.abspath(sys.argv[1]); OUT = os.path.abspath(sys.argv[2]); os.makedirs(OUT, exist_ok=True)
sha = lambda p: hashlib.sha256(open(p, 'rb').read()).hexdigest()
SHA_BEFORE = sha(HTML); checks = []

def rec(size, name, ok, detail=None):
    checks.append({'size': size, 'check': name, 'status': 'PASS' if ok else 'FAIL', 'detail': detail})
    print(f"[{'PASS' if ok else 'FAIL'}] {size} {name} {json.dumps(detail, ensure_ascii=False) if detail is not None else ''}", flush=True)

s_ = socket.socket(); s_.bind(('127.0.0.1', 0)); PORT = s_.getsockname()[1]; s_.close()
srv = subprocess.Popen([sys.executable, '-m', 'http.server', str(PORT), '--bind', '127.0.0.1', '--directory', os.path.dirname(HTML)],
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
for _ in range(50):
    try: socket.create_connection(('127.0.0.1', PORT), 0.2).close(); break
    except OSError: time.sleep(0.1)
URL = f'http://127.0.0.1:{PORT}/{os.path.basename(HTML)}'

# 선택자에 맞는 모든 요소 각각: 글자, 원시 rect, clip 안, 5점 hit, 자신 내부 잘림
VIS_ALL = r"""(sel) => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null).map(e => {
  const r = e.getBoundingClientRect();
  let L = 0, T = 0, R = innerWidth, B = innerHeight;
  for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    const cs = getComputedStyle(p);
    if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + ' ' + cs.overflowY)) { const q = p.getBoundingClientRect();
      const pl = q.left + p.clientLeft, pt = q.top + p.clientTop;
      L = Math.max(L, pl); T = Math.max(T, pt); R = Math.min(R, pl + p.clientWidth); B = Math.min(B, pt + p.clientHeight); } }
  const inside = r.width > 0 && r.left >= L - .5 && r.top >= T - .5 && r.right <= R + .5 && r.bottom <= B + .5;
  const hits = [[.5,.5],[.08,.5],[.92,.5],[.5,.2],[.5,.8]].map(([fx,fy]) => { const h = document.elementFromPoint(r.left + r.width*fx, r.top + r.height*fy); return !!h && (h === e || e.contains(h)); });
  return {text: e.innerText.trim(), rect: {x: r.x, y: r.y, w: r.width, h: r.height}, inside, hits, ok: inside && hits.every(Boolean)};
})"""
CLIP_JS = r"""(sel) => [...document.querySelectorAll(sel)].filter(e => e.offsetParent !== null).map(e => ({id: e.id || e.parentElement.id, sh: e.scrollHeight, ch: e.clientHeight, clipped: e.scrollHeight > e.clientHeight + 1}))"""

def items(page, sel): return page.evaluate(VIS_ALL, sel)

def run(br, W, H, meta):
    size = f'{W}x{H}'; narrow = W < 700
    ctx = br.new_context(viewport={'width': W, 'height': H}, device_scale_factor=1); page = ctx.new_page()
    errors, doc = [], {}
    page.on('pageerror', lambda e: errors.append('pageerror: ' + str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append('console: ' + m.text))
    def on_resp(r):
        if r.url == URL and 'sha' not in doc:
            b = r.body(); doc.update(status=r.status, bytes=len(b), sha=hashlib.sha256(b).hexdigest())
    page.on('response', on_resp)
    page.goto(URL, wait_until='load'); page.wait_for_timeout(450)
    meta['http'][size] = doc
    rec(size, '최초 HTTP status/body SHA = 원본', doc.get('status') == 200 and doc.get('sha') == SHA_BEFORE, doc)
    for view in ('after', 'before'):
        if view == 'before': page.click('#vBefore'); page.wait_for_timeout(150)
        chips = items(page, '#world .c'); cues = items(page, '#world .cue'); faces = page.evaluate(CLIP_JS, '#world .face')
        txt = [c['text'] for c in chips] + [c['text'] for c in cues]
        want = (['진행 정보 누락 확인'] if view == 'after' else ['진행 정보 누락 확인', '진행 정보 누락 확인'])
        ok_words = [t for t in txt if '진행 정보' in t] == want and all('누락 확인' in c['text'] for c in cues)
        ok_vis = all(c['ok'] for c in chips + cues) and not any(f['clipped'] for f in faces)
        if view == 'after': ok_words = ok_words and txt.count('진행 정보 누락 확인') == 1 and sum('누락 확인·경과 계산은 공통 계산으로 옮김' in t for t in txt) == 2
        else: ok_words = ok_words and sum('누락 확인·경과 계산은 두 메뉴에서 함' in t for t in txt) == 1
        rec(size, f'{view}: 카드 칩·짧은 설명이 ‘누락 확인’으로 일관, 모두 지도 영역 안·hit·카드 내부 잘림 없음', ok_words and ok_vis,
            {'texts': txt, 'notOk': [c['text'] for c in chips + cues if not c['ok']], 'faces': faces})
        if not narrow:
            sm = items(page, '#summary')[0]
            exp = '진행 정보 누락 확인' in sm['text'] and (('표시 조건·분기와 두 호출은 그대로' in sm['text']) if view == 'after' else True)
            rec(size, f'{view}: 위쪽 변화 설명에 ‘누락 확인’, 표시 조건·분기 유지 명시, 잘림 없음', exp and sm['ok'] and sm['rect']['h'] > 0, {'text': sm['text'], 'ok': sm['ok']})
    page.click('#vAfter'); page.wait_for_timeout(150)
    if W == 1280: page.click('#n-P1'); page.wait_for_timeout(150); page.screenshot(path=os.path.join(OUT, 'A-1280-initial-selected-menu.png'))
    for pid in ('P1', 'P3'):
        page.click(f'#n-{pid}'); page.wait_for_timeout(150)
        if narrow:
            strip = page.evaluate("()=>{const p=document.getElementById('panel');return {sh:p.scrollHeight,ch:p.clientHeight}}")
            line = items(page, '#panel .strip-c')
            ok = strip['sh'] <= strip['ch'] and line and line[0]['ok'] and '누락 확인·경과 계산' in line[0]['text']
            rec(size, f'{pid} 선택 예약 줄: ‘누락 확인’ 문구 표시, 예약 줄 잘림 없음', bool(ok), {'strip': strip, 'line': line[0]['text'] if line else None})
            if pid == 'P3': page.screenshot(path=os.path.join(OUT, 'B-390-selected-common.png'))
            page.locator('#panel .strip-head [data-act=read]').click(); page.wait_for_timeout(200)
            cells = items(page, '#reader .rt-tbl th, #reader .rt-tbl td')
            first = [c['text'] for c in cells][3:6]
            rec(size, f'{pid} 부분 읽기 상세표: 첫 행 ‘진행 정보 누락 확인’, 표 칸 모두 보임', first[0] == '진행 정보 누락 확인' and all(c['ok'] for c in cells), {'row1': first, 'notOk': [c['text'] for c in cells if not c['ok']]})
            page.click('#rBack'); page.wait_for_timeout(150)
        else:
            cells = items(page, '#panel .rt-tbl th, #panel .rt-tbl td')
            first = [c['text'] for c in cells][3:6]
            rec(size, f'{pid} 선택 상세표: 첫 행 ‘진행 정보 누락 확인’, 표 칸 모두 패널 안·hit', first[0] == '진행 정보 누락 확인' and all(c['ok'] for c in cells), {'row1': first, 'notOk': [c['text'] for c in cells if not c['ok']]})
    meta['errors'][size] = errors
    rec(size, 'pageerror·console error 없음', not errors, errors)
    ctx.close()

meta = {'started': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'html': os.path.basename(HTML), 'file_sha256_before': SHA_BEFORE,
        'file_bytes': os.path.getsize(HTML), 'http': {}, 'errors': {}, 'playwright_python': pkg_version('playwright')}
fatal = None; done = []
try:
    with sync_playwright() as pw:
        br = pw.chromium.launch(); meta['browser'] = f'chromium {br.version} headless'
        for W, H in ((1280, 720), (1440, 900), (390, 844)):
            try: run(br, W, H, meta); done.append(f'{W}x{H}')
            except Exception as ex: rec(f'{W}x{H}', '실행 중단', False, repr(ex))
        br.close()
except Exception as ex: fatal = repr(ex)
finally:
    srv.terminate()
    try: srv.wait(5)
    except Exception: srv.kill()
    meta['http_server_exit'] = srv.returncode
meta['file_sha256_after'] = sha(HTML); meta['file_unchanged'] = meta['file_sha256_after'] == SHA_BEFORE; meta['sizes_completed'] = done
nfail = sum(c['status'] == 'FAIL' for c in checks)
meta.update(finished=datetime.datetime.now(datetime.timezone.utc).isoformat(), fatal=fatal, failed=nfail)
json.dump({'meta': meta, 'checks': checks}, open(os.path.join(OUT, 'results.json'), 'w'), ensure_ascii=False, indent=1)
print(f'== failed {nfail} fatal {fatal} completed {done} file_unchanged {meta["file_unchanged"]}')
sys.exit(1 if (nfail or fatal or not meta['file_unchanged'] or len(done) != 3) else 0)
