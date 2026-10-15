#!/usr/bin/env python3
"""작성자 실제 Chromium HTTP 조작 검사 for reading-study.html.

로컬 HTTP 서버로 HTML을 제공하고 Playwright Chromium에서 실제 마우스·키보드로
조작한다. 1440x900, 1280x720, 390x664, 390x844에서 확인한다.
- fix1: 미리보기 열림/닫힘을 hidden 속성이 아니라 실제 표시·레이아웃 박스·클릭/초점 가능성으로 판정(PANEL-*)
- 가로 넘침, 근거 버튼·닫기·전환 버튼의 클릭 가림(elementFromPoint)
- 근거 미리보기 열기 → 닫기 후 초점·스크롤·선택 복원 (Esc / 닫기 버튼)
- 미리보기 안 원문 링크: 새 탭으로만 열리고 읽기 페이지 상태 유지
- A/B 전환 시 선택·미리보기 유지, 자동 승인 표기 없음
외부 GitHub 요청은 스텁 응답으로 가로챈다(외부 페이지 내용은 로드하지 않음).
이 검사는 시안 작성자의 자기검사이며 독립 검증·사람 사용성 검증이 아니다.

사용: python3 browser_check.py <reading-study.html> <out_dir>
실패가 하나라도 있으면 종료 코드 1. INFO는 검사 수에 넣지 않는다.
"""
import functools, hashlib, http.server, json, os, sys, threading, time
from playwright.sync_api import sync_playwright

html_path = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else "reading-study.html")
out_dir = os.path.abspath(sys.argv[2] if len(sys.argv) > 2 else "run")
shots = "--shots" in sys.argv
os.makedirs(out_dir, exist_ok=True)

class Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
handler = functools.partial(Quiet, directory=os.path.dirname(html_path))
srv = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()
URL = f"http://127.0.0.1:{srv.server_address[1]}/{os.path.basename(html_path)}"

results, infos, ext_requests = [], [], []
def check(vp, name, ok, detail=""):
    m = __import__("re").match(r"([A-Z][A-Z0-9-]+) ", name)
    results.append({"viewport": vp, "id": m.group(1) if m else None, "name": name, "pass": bool(ok), "detail": detail})
    print(("PASS " if ok else "FAIL ") + f"[{vp}] {name}" + (f" — {detail}" if detail and not ok else ""))
def info(vp, msg):
    infos.append({"viewport": vp, "msg": msg}); print(f"INFO [{vp}] {msg}")

S03 = "https://github.com/tlsee0813-cmd/agentflow-studio/blob/666437a427b3039fb6321dfec41edd6eb24e164f/docs/cycles/2026-10-15-mixed-depth-01/canvas-study.html"

JS_HIT = """(sel) => { const e = document.querySelector(sel); if(!e) return 'missing';
  const r = e.getBoundingClientRect(); if(r.width === 0 || r.height === 0) return 'zero';
  const x = r.left + r.width/2, y = r.top + r.height/2;
  if(x < 0 || y < 0 || x > innerWidth || y > innerHeight) return 'offscreen';
  const h = document.elementFromPoint(x, y); return (h === e || e.contains(h)) ? 'ok' : ('covered by ' + (h ? (h.id || h.className || h.tagName) : 'null')); }"""
JS_OVERFLOW = """() => { const de = document.documentElement; const bad = [];
  for (const n of document.querySelectorAll('body *')) { const cs = getComputedStyle(n); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (n.closest('[hidden]')) continue; const r = n.getBoundingClientRect(); if (r.width === 0) continue;
    if (r.right > innerWidth + 1 || r.left < -1) { if (!n.closest('.pv-scroll') || r.right > innerWidth + 1) bad.push((n.id || n.className || n.tagName) + ':' + Math.round(r.left) + '..' + Math.round(r.right)); } }
  return { sw: de.scrollWidth, cw: de.clientWidth, bad: bad.slice(0, 5), nbad: bad.length }; }"""

JS_PANEL = """() => { const b = document.getElementById('pvBody'), c = document.getElementById('pvClose'), e = document.getElementById('pvEmpty'), p = document.getElementById('preview');
  const box = n => { const r = n.getBoundingClientRect(); return [Math.round(r.width * 10) / 10, Math.round(r.height * 10) / 10]; };
  const vis = n => n.checkVisibility({ checkVisibilityCSS: true });
  const hit = n => { const r = n.getBoundingClientRect(); if (!r.width || !r.height) return false; const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return false; const h = document.elementFromPoint(x, y); return h === n || n.contains(h); };
  const prev = document.activeElement; c.focus({ preventScroll: true }); const focusable = document.activeElement === c;
  if (focusable && prev && prev.focus) prev.focus({ preventScroll: true });
  return { bodyHiddenAttr: b.hidden, bodyDisplay: getComputedStyle(b).display, bodyBox: box(b), bodyVis: vis(b),
    closeBox: box(c), closeVis: vis(c), closeHit: hit(c), closeFocusable: focusable,
    emptyVis: vis(e), previewDisplay: getComputedStyle(p).display, headText: b.textContent.trim().slice(0, 30) }; }"""

def panel_closed(pg, vp, cid, label):
    """hidden 속성이 아니라 실제 표시·레이아웃 박스·클릭/초점 가능성으로 '닫힘'을 판정."""
    st = pg.evaluate(JS_PANEL)
    wide = pg.viewport_size["width"] >= 760
    # bodyDisplay는 기록만 한다: 좁은 화면에서는 부모 시트가 display:none이라 본문 자체 값이 flex여도 실제로 보이지 않는다.
    ok = (st["bodyBox"] == [0, 0] and not st["bodyVis"]
          and st["closeBox"] == [0, 0] and not st["closeVis"] and not st["closeHit"] and not st["closeFocusable"]
          and (st["emptyVis"] if wide else st["previewDisplay"] == "none"))
    check(vp, f"{cid} {label}: 미리보기 본문·닫기 버튼이 실제로 표시되지 않고 박스 0·클릭/초점 불가" + (", 빈자리 안내만 보임" if wide else ", 시트 없음"),
          ok, json.dumps(st, ensure_ascii=False))

def panel_open(pg, vp, cid, label):
    st = pg.evaluate(JS_PANEL)
    ok = (st["bodyDisplay"] != "none" and st["bodyBox"][0] > 0 and st["bodyBox"][1] > 0 and st["bodyVis"]
          and st["closeVis"] and st["closeHit"] and st["closeFocusable"] and not st["emptyVis"])
    check(vp, f"{cid} {label}: 미리보기 본문·닫기 버튼이 실제로 보이고 조작 가능, 빈자리 안내는 숨김", ok, json.dumps(st, ensure_ascii=False))

def place(pg, sel, frac=0.42):
    """Scroll the page so that the element sits around `frac` of the viewport (reading position)."""
    pg.evaluate("""([sel, frac]) => { const e = document.querySelector(sel); const r = e.getBoundingClientRect();
      window.scrollTo(0, Math.max(0, window.scrollY + r.top - innerHeight * frac)); }""", [sel, frac])
    pg.wait_for_timeout(60)

def snap(pg, trig):
    return pg.evaluate("""(t) => { const b = document.getElementById(t); return { y: window.scrollY, top: b.getBoundingClientRect().top,
      active: document.activeElement ? document.activeElement.id : null, open: !document.getElementById('pvBody').hidden,
      sel: [...document.querySelectorAll('.sel')].map(n => n.id), rep: window.__study.state.rep, url: location.href,
      pad: document.body.style.paddingBottom }; }""", trig)

def click_center(pg, sel):
    box = pg.locator(sel).bounding_box()
    pg.mouse.click(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2)
    pg.wait_for_timeout(80)

def roundtrip(pg, vp, rep, fact, close_by):
    pre = "ab-" if rep == "A" else "bb-"
    trig = pre + fact; sel = "#" + trig
    place(pg, sel)
    s0 = snap(pg, trig)
    hit = pg.evaluate(JS_HIT, sel)
    check(vp, f"{rep} {fact} 근거 버튼이 가려지지 않음", hit == "ok", hit)
    click_center(pg, sel)
    st = pg.evaluate("""() => ({ open: !document.getElementById('pvBody').hidden, active: document.activeElement.id,
       h: document.getElementById('pvH').textContent, where: document.querySelector('#pvOrigin .where').textContent,
       exp: document.querySelector('.evbtn[aria-expanded="true"]') ? document.querySelector('.evbtn[aria-expanded="true"]').id : null })""")
    check(vp, f"{rep} {fact} 미리보기 열림·초점이 미리보기 제목으로 이동",
          st["open"] and st["active"] == "pvH" and st["exp"] == trig, json.dumps(st, ensure_ascii=False))
    check(vp, f"{rep} {fact} 출발 위치가 현재 표현으로 표시", st["where"].startswith("표현 " + rep), st["where"])
    panel_open(pg, vp, "PANEL-OPEN", f"{rep} {fact} 열림")
    top_ok = pg.evaluate("""() => { const sc = document.getElementById('pvScroll'); const q = document.querySelector('#pvOrigin blockquote').getBoundingClientRect();
        const r = sc.getBoundingClientRect(); return { st: sc.scrollTop, inside: q.top >= r.top - 1 && q.top < r.bottom }; }""")
    check(vp, f"PV-TOP {rep} {fact} 새로 연 미리보기는 처음(출발 문장)부터 보임", top_ok["st"] == 0 and top_ok["inside"], json.dumps(top_ok))
    hit_close = pg.evaluate(JS_HIT, "#pvClose")
    check(vp, f"{rep} {fact} 닫기 버튼이 보이고 가려지지 않음", hit_close == "ok", hit_close)
    hit_sw = pg.evaluate(JS_HIT, "#repB" if rep == "A" else "#repA")
    check(vp, f"SHEET-SWITCH-HIT {rep} {fact} 미리보기 중에도 A/B 전환 버튼이 가려지지 않음", hit_sw == "ok", hit_sw)
    if pg.viewport_size["width"] < 760:
        geo = pg.evaluate("""(t) => { const b = document.getElementById(t); const r = b.getBoundingClientRect();
            const sh = document.getElementById('preview').getBoundingClientRect(); const hb = document.querySelector('.hdr').getBoundingClientRect().bottom;
            return { btop: r.top, bbot: r.bottom, sheetTop: sh.top, hdr: hb }; }""", trig)
        check(vp, f"SHEET-ORIGIN-VIS {rep} {fact} 좁은 화면: 출발 버튼이 헤더와 시트 사이에 보임",
              geo["btop"] >= geo["hdr"] - 1 and geo["bbot"] <= geo["sheetTop"] + 1, json.dumps(geo))
    if close_by == "esc":
        pg.keyboard.press("Escape")
    else:
        # 미리보기를 연 채 본문을 실제 휠로 더 읽은 뒤 닫는 경우
        hb = pg.evaluate("document.querySelector('.hdr').getBoundingClientRect().bottom")
        pg.mouse.move(pg.viewport_size["width"] * (0.45 if pg.viewport_size["width"] >= 760 else 0.5), hb + 30)
        y_before = pg.evaluate("scrollY"); pg.mouse.wheel(0, 500); pg.wait_for_timeout(200)
        info(vp, f"{rep} {fact} 미리보기 연 채 휠 스크롤 {y_before}→{pg.evaluate('scrollY')}")
        click_center(pg, "#pvClose")
    pg.wait_for_timeout(80)
    s1 = snap(pg, trig)
    check(vp, f"{rep} {fact} 닫기({close_by}) 후 상태값이 닫힘(hidden 속성) — 표시 판정은 PANEL-CLOSED", not s1["open"], "")
    check(vp, f"RT-FOCUS {rep} {fact} 닫기({close_by}) 후 초점이 출발 버튼으로 복귀", s1["active"] == trig, str(s1["active"]))
    panel_closed(pg, vp, "PANEL-CLOSED-" + ("ESC" if close_by == "esc" else "BTN"), f"{rep} {fact} 닫기({close_by}) 후")
    check(vp, f"RT-SCROLL {rep} {fact} 닫기({close_by}) 후 읽던 스크롤 위치 복원(±2px)", abs(s1["y"] - s0["y"]) <= 2 and abs(s1["top"] - s0["top"]) <= 2,
          f"y {s0['y']}→{s1['y']}, top {s0['top']:.1f}→{s1['top']:.1f}")
    unit = ("a-" if rep == "A" else "b-") + fact
    check(vp, f"{rep} {fact} 닫은 뒤 근거 버튼으로 고른 사실의 선택 표시 유지", unit in s1["sel"], str(s1["sel"]))
    check(vp, f"{rep} {fact} 닫은 뒤 시트 여백 해제", s1["pad"] == "", s1["pad"])

def run_vp(browser, w, h):
    vp = f"{w}x{h}"
    ctx = browser.new_context(viewport={"width": w, "height": h})
    def stub(route):
        ext_requests.append(route.request.url)
        route.fulfill(status=200, content_type="text/html", body="<!doctype html><title>stub</title><p>external stub</p>")
    ctx.route("https://github.com/**", stub)
    pg = ctx.new_page()
    errors = []
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    resp = pg.goto(URL)
    check(vp, "HTTP 200으로 로드", resp.status == 200, str(resp.status))
    panel_closed(pg, vp, "PANEL-INIT", "첫 화면")
    counts = pg.evaluate("""() => ({ a: document.querySelectorAll('#viewA .unit').length, b: document.querySelectorAll('#viewB tr[data-fact]').length,
       ab: document.querySelectorAll('#viewA .evbtn').length, bb: document.querySelectorAll('#viewB .evbtn').length,
       same: [...document.querySelectorAll('#viewA .unit')].map(n => n.dataset.fact).join() === [...document.querySelectorAll('#viewB tr[data-fact]')].map(n => n.dataset.fact).join(),
       summaryShared: !document.getElementById('summary').closest('#viewA, #viewB') })""")
    check(vp, "A 문장 25·B 행 25·근거 버튼 각 25, 같은 사실 순서", counts["a"] == counts["b"] == counts["ab"] == counts["bb"] == 25 and counts["same"], json.dumps(counts))
    check(vp, "요약은 A/B 밖의 공통 영역", counts["summaryShared"])
    for rep in ("A", "B"):
        if rep == "B": click_center(pg, "#repB")
        pg.evaluate("window.scrollTo(0, 0)")
        ov = pg.evaluate(JS_OVERFLOW)
        check(vp, f"{rep} 가로 넘침 없음(문서·요소)", ov["sw"] <= ov["cw"] and ov["nbad"] == 0, json.dumps(ov, ensure_ascii=False))
        maxy = pg.evaluate("document.documentElement.scrollHeight - innerHeight")
        pg.evaluate(f"window.scrollTo(0, {maxy})"); pg.wait_for_timeout(40)
        ov = pg.evaluate(JS_OVERFLOW)
        check(vp, f"{rep} 끝까지 스크롤해도 가로 넘침 없음", ov["sw"] <= ov["cw"] and ov["nbad"] == 0, json.dumps(ov, ensure_ascii=False))
    click_center(pg, "#repA")

    # 1) 근거 미리보기 → 닫기 (E09 위치 C 문장/셀, E10 셀)
    roundtrip(pg, vp, "A", "f14", "esc")
    roundtrip(pg, vp, "A", "f19", "button")
    click_center(pg, "#repB")
    roundtrip(pg, vp, "B", "f14", "button")
    roundtrip(pg, vp, "B", "f19", "esc")
    click_center(pg, "#repA")

    # 2) 미리보기 안 원문 링크: 새 탭으로만 열리고 읽기 페이지 상태 유지
    place(pg, "#ab-f14"); click_center(pg, "#ab-f14")
    link = pg.locator('#pvScroll li[data-src="S03"] a.srclink')
    attrs = link.evaluate("a => ({ t: a.target, rel: a.rel, label: a.getAttribute('aria-label'), text: a.textContent, href: a.href })")
    check(vp, "LINK-NEWTAB 원문 링크가 새 탭·noopener·'새 탭' 표기", attrs["t"] == "_blank" and "noopener" in attrs["rel"] and "새 탭" in attrs["text"] and "새 탭" in attrs["label"], json.dumps(attrs, ensure_ascii=False))
    link.scroll_into_view_if_needed(); pg.wait_for_timeout(60)
    hit = pg.evaluate(JS_HIT, '#pvScroll li[data-src="S03"] a.srclink')
    check(vp, "원문 링크가 가려지지 않음", hit == "ok", hit)
    before = snap(pg, "ab-f14")
    pv_scroll_before = pg.evaluate("document.getElementById('pvScroll').scrollTop")
    with pg.expect_popup(timeout=5000) as pop:  # 새 탭이 안 열리면 LINK-NEWTAB 실패 뒤 이 화면 시나리오가 ABORT로 중단됨
        click_center(pg, '#pvScroll li[data-src="S03"] a.srclink')
    popup = pop.value; popup.wait_for_load_state()
    after = snap(pg, "ab-f14")
    check(vp, "링크 클릭은 새 탭 하나를 고정 출처 URL로 엶", popup.url == S03, popup.url)
    check(vp, "링크 클릭 뒤 읽기 페이지 URL·스크롤·미리보기·선택·표현 유지",
          after["url"] == before["url"] and abs(after["y"] - before["y"]) <= 1 and after["open"] and after["sel"] == before["sel"] and after["rep"] == "A",
          json.dumps({"before": before, "after": after}, ensure_ascii=False))
    check(vp, "링크 클릭 뒤 미리보기 안 스크롤도 유지",
          abs(pg.evaluate("document.getElementById('pvScroll').scrollTop") - pv_scroll_before) <= 1)
    popup.close()
    pg.keyboard.press("Escape"); pg.wait_for_timeout(60)

    # 3) 원문 없는 출처(P01): 링크 대신 없는 이유
    place(pg, "#ab-f04"); click_center(pg, "#ab-f04")
    st0 = pg.evaluate("document.getElementById('pvScroll').scrollTop")
    check(vp, "PV-TOP-AFTER 앞 미리보기 안을 스크롤한 뒤 새로 연 미리보기도 처음부터 보임", st0 == 0, f"scrollTop={st0}")
    p01 = pg.evaluate("""() => { const li = document.querySelector('#pvScroll li[data-src="P01"]');
       return { link: !!li.querySelector('a'), why: li.querySelector('.nolink') ? li.querySelector('.nolink').textContent : '' }; }""")
    check(vp, "P01은 원문 링크 없이 '원문 링크 미제공'과 이유를 보임", (not p01["link"]) and "원문 링크 미제공" in p01["why"] and "독립 열람하지 않았" in p01["why"], json.dumps(p01, ensure_ascii=False))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(60)

    # 4) A/B 전환: 미리보기 열린 채 전환해도 같은 사실 유지, 닫으면 새 표현의 같은 셀로 복귀
    body_before = pg.evaluate("document.body.innerText")
    place(pg, "#ab-f13"); click_center(pg, "#ab-f13")
    click_center(pg, "#repB")
    st = pg.evaluate("""() => { const b = document.getElementById('bb-f13'); const r = b.getBoundingClientRect();
       const bottom = (innerWidth < 760) ? document.getElementById('preview').getBoundingClientRect().top : innerHeight;
       const hb = document.querySelector('.hdr').getBoundingClientRect().bottom;
       return { open: !document.getElementById('pvBody').hidden, h: document.getElementById('pvH').textContent,
         where: document.querySelector('#pvOrigin .where').textContent, exp: b.getAttribute('aria-expanded'),
         rowSel: document.getElementById('b-f13').classList.contains('sel'), visible: r.top >= hb - 1 && r.bottom <= bottom + 1 }; }""")
    check(vp, "SW-ORIGIN 열린 채 A→B 전환: 같은 사실(E07) 미리보기 유지, 출발이 B 셀로 바뀜",
          st["open"] and st["h"].startswith("E07") and st["where"].startswith("표현 B") and st["exp"] == "true" and st["rowSel"], json.dumps(st, ensure_ascii=False))
    check(vp, "열린 채 A→B 전환: B의 같은 셀 버튼이 화면에 보임", st["visible"], json.dumps(st, ensure_ascii=False))
    pg.keyboard.press("Escape"); pg.wait_for_timeout(60)
    fin = pg.evaluate("""() => { const b = document.getElementById('bb-f13'); const r = b.getBoundingClientRect();
       return { active: document.activeElement.id, top: r.top, bottom: r.bottom, ih: innerHeight }; }""")
    check(vp, "전환 뒤 닫기: 초점이 B의 같은 사실 버튼으로, 화면 안", fin["active"] == "bb-f13" and fin["top"] >= 0 and fin["bottom"] <= fin["ih"], json.dumps(fin))
    # 미리보기 없이 선택만 있는 상태에서 B→A 전환
    place(pg, "#bb-f19"); click_center(pg, "#bb-f19"); pg.keyboard.press("Escape"); pg.wait_for_timeout(60)
    t_b = pg.evaluate("document.getElementById('b-f19').getBoundingClientRect().top")
    click_center(pg, "#repA")
    st2 = pg.evaluate("""() => { const u = document.getElementById('a-f19'); const r = u.getBoundingClientRect();
      return { sel: u.classList.contains('sel'), top: r.top, bottom: r.bottom, ih: innerHeight, y: scrollY, maxy: document.documentElement.scrollHeight - innerHeight }; }""")
    clamped = st2["y"] <= 0 or st2["y"] >= st2["maxy"] - 1
    check(vp, "선택 상태로 B→A 전환: A의 같은 문장이 선택된 채 같은 높이에 보임",
          st2["sel"] and st2["top"] >= 0 and st2["bottom"] <= st2["ih"] and (abs(st2["top"] - t_b) <= 2 or clamped),
          json.dumps({"bTop": t_b, **st2}))
    body_after = pg.evaluate("document.body.innerText")
    words = ["승인함", "승인 완료", "확인 완료", "수정 완료", "읽음"]
    added = [w for w in words if body_after.count(w) > body_before.count(w)]
    check(vp, "조작 뒤 승인·수정·읽음 같은 자동 표기가 생기지 않음", not added, str(added))

    # 5) 키보드만으로 열기·닫기 (Tab으로 닫기 버튼까지)
    place(pg, "#ab-f09"); pg.focus("#ab-f09"); s0 = snap(pg, "ab-f09")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(80)
    a1 = pg.evaluate("document.activeElement.id")
    pg.keyboard.press("Tab"); a2 = pg.evaluate("document.activeElement.id")
    pg.keyboard.press("Enter"); pg.wait_for_timeout(80)
    s1 = snap(pg, "ab-f09")
    panel_closed(pg, vp, "PANEL-CLOSED-KEY", "키보드 Enter로 닫은 뒤")
    check(vp, "키보드: Enter로 열기 → Tab으로 닫기 버튼 → Enter로 닫고 출발로 복귀",
          a1 == "pvH" and a2 == "pvClose" and s1["active"] == "ab-f09" and not s1["open"] and abs(s1["y"] - s0["y"]) <= 2,
          json.dumps({"a1": a1, "a2": a2, "s0": s0, "s1": s1}, ensure_ascii=False))

    check(vp, "페이지 오류·콘솔 오류 없음", not errors, str(errors[:3]))

    if shots and vp == "1280x720":  # fix1 대표 PNG 1: 넓은 화면, 근거를 열었다 닫기 버튼으로 닫은 장면
        click_center(pg, "#repA"); place(pg, "#ab-f14"); click_center(pg, "#ab-f14"); click_center(pg, "#pvClose")
        pg.wait_for_timeout(120)
        name = os.path.join(out_dir, f"fix1_closed_A_{vp}.png"); pg.screenshot(path=name)
        info(vp, f"screenshot {os.path.basename(name)} (E09 미리보기를 닫기 버튼으로 닫은 뒤)")
    if shots and vp == "390x664":  # fix1 대표 PNG 2: 모바일 기존 경로, 보완한 f15 문장의 근거 미리보기
        click_center(pg, "#repA"); place(pg, "#ab-f15"); click_center(pg, "#ab-f15")
        pg.wait_for_timeout(120)
        name = os.path.join(out_dir, f"fix1_open_A_f15_{vp}.png"); pg.screenshot(path=name)
        info(vp, f"screenshot {os.path.basename(name)} (A f15 근거 미리보기 열림)")
        pg.keyboard.press("Escape"); pg.wait_for_timeout(60)
    ctx.close()

t0 = time.time()
with sync_playwright() as p:
    br = p.chromium.launch()
    info("-", f"chromium {br.version}, url {URL}")
    for w, h in [(1440, 900), (1280, 720), (390, 664), (390, 844)]:
        try:
            run_vp(br, w, h)
        except Exception as e:  # 조작 중단도 실패로 기록하고 다음 화면으로 진행
            check(f"{w}x{h}", "ABORT 조작 시나리오가 중단 없이 끝남", False, f"{type(e).__name__}: {str(e).splitlines()[0][:160]}")
    br.close()
srv.shutdown()
info("-", f"external requests intercepted by stub: {sorted(set(ext_requests))}")
fails = [r for r in results if not r["pass"]]
print(f"browser: pass {len(results) - len(fails)} fail {len(fails)} (INFO {len(infos)} 별도, 검사 수 미포함) · {time.time() - t0:.1f}s")
json.dump({"kind": "author Chromium HTTP interaction check (not independent; no human usability)",
           "html": os.path.basename(html_path), "html_sha256": hashlib.sha256(open(html_path, "rb").read()).hexdigest(),
           "checker_sha256": hashlib.sha256(open(__file__, "rb").read()).hexdigest(),
           "external_pages": "GitHub requests fulfilled by local stub; real external page content not loaded",
           "results": results, "info": infos, "pass": len(results) - len(fails), "fail": len(fails)},
          open(os.path.join(out_dir, "browser_results.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
sys.exit(1 if fails else 0)
