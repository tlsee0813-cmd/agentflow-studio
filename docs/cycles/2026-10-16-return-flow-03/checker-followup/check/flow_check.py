"""cycle03 return-flow-study.html — BROWSER_CONTRACT 8단계 실제 브라우저 흐름 검사.

실행: (HTML 폴더에서) python3 -m http.server 8765 --bind 127.0.0.1
      python3 flow_check.py http://127.0.0.1:8765/return-flow-study.html <html 경로> <출력 폴더>

- 페이지는 실제 로컬 HTTP로 연다(file:// 아님). 외부 GitHub 링크는 클릭하지 않는다 → 외부 왕복 미실행.
- 클릭은 Playwright의 실제 입력 이벤트(마우스/터치). 스크롤은 마우스 휠 이벤트로만 한다.
  DOM scrollTo/scrollIntoView 보조는 쓰지 않는다. (390폭도 휠 이벤트이며 실제 터치 스와이프가 아님)
- 판정은 화면 관측(가시 상자, elementFromPoint, 실제 포커스, 스크롤 값)으로 하고 속성만으로 판정하지 않는다.
- 결과 상태: PASS(수행·관측된 좁은 통과) / FAIL / UNOBSERVED / NOT_RUN
"""
import hashlib, json, sys, time
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = HTML = OUT = SHA = None  # main()에서 설정 (모듈 import 가능하게)
# 뷰포트마다 완주해야 하는 필수 단계
REQUIRED_STEPS = ["1", "2", "3", "4", "5", "6", "7", "8.2", "8.3", "8.4", "8.5", "8.6", "8.7", "8"]
FORBIDDEN = ["보냈습니다", "전달 완료", "수락됨", "수락했", "인계 완료", "발송됨", "지난 방문 이후 바뀐", "승인 대기", "승인함"]

JS_STATE = """() => {
  const vis = el => { if(!el) return false; const r=el.getBoundingClientRect(); const cs=getComputedStyle(el);
     return r.width>0 && r.height>0 && cs.visibility!=='hidden' && cs.display!=='none'; };
  const areas = {};
  document.querySelectorAll('.area').forEach(a => {
    const body=a.querySelector('.area-body');
    const lis=[...a.querySelectorAll('.area-body li')].filter(vis).length;
    areas[a.dataset.id] = !vis(body) ? 0 : (lis>0 ? 2 : 1);
  });
  const sel=[...document.querySelectorAll('.part')].filter(p=>p.classList.contains('is-selected') && vis(p)).map(p=>p.dataset.id);
  const ms=document.getElementById('mapScroll');
  const ae=document.activeElement;
  return {mapVisible: vis(document.getElementById('mapView')), focusVisible: vis(document.getElementById('focusView')),
    areas, selected: sel, mapScroll:[ms.scrollLeft, ms.scrollTop], winY: Math.round(window.scrollY),
    zoom: document.getElementById('zoomVal').textContent,
    edges: document.querySelectorAll('#edges path').length,
    readingTop: Math.round(document.getElementById('reading').scrollTop),
    peeks: document.querySelectorAll('.peek').length,
    dialogOpen: document.getElementById('prep').open,
    active: ae ? (ae.id || ae.className || ae.tagName) + (ae.dataset && ae.dataset.id ? ':'+ae.dataset.id : '') + (ae.dataset && ae.dataset.claim ? ':'+ae.dataset.claim : '') : null };
}"""

JS_HIT = """([x,y]) => { const e=document.elementFromPoint(x,y); if(!e) return null;
  return {tag:e.tagName, cls:e.className && e.className.baseVal===undefined ? e.className : '', inPeek: !!e.closest('.peek'),
          inDialog: !!e.closest('dialog'), text:(e.textContent||'').trim().slice(0,30)}; }"""


def box(loc):
    try:
        if not loc.count() or not loc.first.is_visible():
            return None
        return loc.first.bounding_box()
    except Exception:
        return None


def in_viewport(b, vw, vh, top_margin=0):
    return b is not None and b["y"] >= top_margin and b["y"] + b["height"] <= vh and b["x"] >= 0 and b["x"] + b["width"] <= vw


class Run:
    def __init__(self, name, page, vw, vh, mobile):
        self.name, self.page, self.vw, self.vh, self.mobile = name, page, vw, vh, mobile
        self.steps, self.log = [], []

    def st(self):
        return self.page.evaluate(JS_STATE)

    def note(self, msg):
        self.log.append(msg)

    def act(self, loc, label):
        b = box(loc)
        if b is None:
            raise RuntimeError(f"보이지 않아 누를 수 없음: {label}")
        if self.mobile:
            self.page.touchscreen.tap(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
        else:
            self.page.mouse.click(b["x"] + b["width"] / 2, b["y"] + b["height"] / 2)
        self.page.wait_for_timeout(250)
        self.note(f"{'tap' if self.mobile else 'click'} {label} @({int(b['x'])},{int(b['y'])})")

    def wheel_until_visible(self, loc, label, over=None, top_margin=0, max_steps=25):
        """휠 이벤트만으로 대상이 뷰포트에 완전히 들어오게 한다."""
        for i in range(max_steps):
            b = box(loc)
            if in_viewport(b, self.vw, self.vh, top_margin):
                return i
            dy = 160 if (b is None or b["y"] + b["height"] > self.vh) else -160
            x, y = over if over else (self.vw / 2, self.vh / 2)
            self.page.mouse.move(x, y)
            self.page.mouse.wheel(0, dy)
            self.page.wait_for_timeout(120)
        raise RuntimeError(f"휠로 보이게 하지 못함: {label}")

    def shot(self, tag):
        p = OUT / f"{self.name}_{tag}.png"
        self.page.screenshot(path=str(p))
        return p.name

    def step(self, no, title, fn):
        rec = {"step": no, "title": title, "checks": [], "status": "PASS"}
        try:
            fn(rec)
        except Exception as e:  # 실제 실패는 실패로 남긴다
            rec["status"] = "FAIL"
            rec["error"] = repr(e)
        if any(c[1] is False for c in rec["checks"]):
            rec["status"] = "FAIL"
        self.steps.append(rec)
        return rec

    @staticmethod
    def chk(rec, what, ok, detail=None):
        rec["checks"].append([what, bool(ok), detail])


def flow(run, round_no, base, rec_all):
    """2~7단계. round_no=1 첫 회, 2 반복. base=1단계 기준 상태."""
    pg, P = run.page, f"r{round_no}"
    sfx = "" if round_no == 1 else " (반복)"
    mapper = None if run.mobile else (900, 450)
    ctx = {}

    def s2(rec):
        before = run.st()
        part = pg.locator('.part[data-id="purpose"]')
        if run.mobile:
            run.wheel_until_visible(part, "목적 정정 부분")
            before = run.st()
        run.act(part, "목적 정정 부분")
        after = run.st()
        run.chk(rec, "선택 표시가 화면에 보임", after["selected"] == ["purpose"] and pg.locator('.part.is-selected').is_visible())
        run.chk(rec, "선택이 다른 영역 펼침 깊이를 바꾸지 않음", after["areas"] == before["areas"], after["areas"])
        run.chk(rec, "선택이 지도 위치·배율을 바꾸지 않음(전체맞춤 없음)",
                after["mapScroll"] == before["mapScroll"] and after["zoom"] == before["zoom"] and after["winY"] == before["winY"],
                {"before": [before["mapScroll"], before["winY"], before["zoom"]], "after": [after["mapScroll"], after["winY"], after["zoom"]]})
        if not run.mobile:
            run.chk(rec, "관련 영역 연결선이 그려짐(4개)", after["edges"] == 4, after["edges"])
        else:
            n = pg.locator('.area.is-related .rel-mark').evaluate_all("els=>els.filter(e=>e.offsetWidth>0).length")
            run.chk(rec, "관련 영역 표시가 보임(4개)", n == 4, n)
        ctx["pre_enter"] = after
        rec["preEnterState"] = after
        rec["shot_selected"] = run.shot(f"{P}_s2_selected")
        enter = pg.locator("#enterFocus")
        run.act(enter, "이 부분 읽기")
        f = run.st()
        run.chk(rec, "읽기 공간이 보이고 지도는 가려짐", f["focusVisible"] and not f["mapVisible"])
        h = pg.locator("#focusTitle").inner_text()
        run.chk(rec, "제목이 목적 정정과 작업 지시를 구별", "목적 정정" in h and "작업 지시" in h, h)
        run.chk(rec, "작업 지시와의 경계 문장이 보임", pg.locator(".boundary .claim").is_visible())
        loc_txt = pg.locator(".rail .crumb").inner_text()
        run.chk(rec, "현재 위치(전체 지도 › 목적 정정) 표시", "목적 정정" in loc_txt, loc_txt)
        run.chk(rec, "문서 기준 표시", "이 개발 기록에서 보고한 변경" in pg.locator(".col .sub").inner_text())

    def s3(rec):
        btn = pg.locator('.evbtn[data-claim="p3"]')
        # 읽는 위치를 만들기 위해 휠로 해당 문장 근처까지 읽어 내려감
        run.wheel_until_visible(btn, "p3 근거 버튼", over=None if run.mobile else (800, 500), top_margin=70 if run.mobile else 0)
        # 읽던 위치를 0이 아닌 곳으로: 휠로 조금 더 읽어 내려간 뒤 대상이 여전히 보이는지 확인
        ox, oy = (195, 500) if run.mobile else (800, 500)
        pg.mouse.move(ox, oy); pg.mouse.wheel(0, 120); pg.wait_for_timeout(150)
        run.note("wheel reading (0,120)")
        run.wheel_until_visible(btn, "p3 근거 버튼", over=(ox, oy), top_margin=70 if run.mobile else 0)
        before = run.st()
        para_b = box(pg.locator("#c-p3"))
        ctx["before_peek"] = before
        ctx["para_y"] = para_b["y"]
        run.act(btn, "p3 '근거'")
        after = run.st()
        peek = pg.locator("#peek-p3")
        pb = box(peek)
        run.chk(rec, "근거 미리보기 1개가 실제 표시", after["peeks"] == 1 and pb is not None, after["peeks"])
        para_after = box(pg.locator("#c-p3"))
        run.chk(rec, "출발 문장이 화면에 남고 강조됨",
                para_after is not None and para_after["y"] >= (60 if run.mobile else 49) and pg.locator("#c-p3.is-origin").count() == 1,
                {"origin_y": para_after and int(para_after["y"])})
        txt = peek.inner_text()
        run.chk(rec, "문서 보고·발췌·해석·미확인 구분",
                all(k in txt for k in ["문서 보고", "발췌", "원문 전체가 아닙니다", "이 설명이 읽은 방식", "이 기록으로 알 수 없는 것"]))
        run.chk(rec, "목적 정정 소유·관련 범위 유지", ("목적 정정" in pg.locator(".rail .crumb").inner_text()))
        link = peek.locator("a")
        run.chk(rec, "외부 원문 링크는 고정 커밋 행 위치(클릭 안 함)", "f0fa5326" in (link.get_attribute("href") or "") and "#L226-L237" in link.get_attribute("href"))
        close = peek.locator(".peek-close")
        steps = 0
        if not in_viewport(box(close), run.vw, run.vh):
            steps = run.wheel_until_visible(close, "근거 닫기 버튼")
        rec["wheel_to_close"] = steps
        cb = box(close)
        hit = pg.evaluate(JS_HIT, [cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] / 2])
        run.chk(rec, "닫기 버튼이 실제 클릭 지점의 최상단 요소", hit and hit["inPeek"] and "닫기" in hit["text"], hit)
        ctx["close_pt"] = [cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] / 2]
        rec["shot_peek"] = run.shot(f"{P}_s3_peek_open")

    def s4(rec):
        before = ctx["before_peek"]
        run.act(pg.locator("#peek-p3 .peek-close"), "근거 닫기 버튼")
        a = run.st()
        run.chk(rec, "닫은 미리보기가 DOM·화면에서 사라짐", a["peeks"] == 0)
        hit = pg.evaluate(JS_HIT, ctx["close_pt"])
        run.chk(rec, "옛 닫기 위치에 미리보기 요소 없음", not (hit and hit["inPeek"]), hit)
        run.chk(rec, "초점이 출발 '근거' 버튼으로", a["active"] == "evbtn:p3", a["active"])
        pos_now = a["winY"] if run.mobile else a["readingTop"]
        pos_before = before["winY"] if run.mobile else before["readingTop"]
        para = box(pg.locator("#c-p3"))
        run.chk(rec, "출발 문장이 화면에 보임(재탐색 불필요)", para is not None and 0 <= para["y"] < run.vh, int(para["y"]) if para else None)
        rec["read_pos"] = {"before_open": pos_before, "after_close": pos_now}
        run.chk(rec, "닫은 뒤 읽던 위치가 열기 전과 같음", pos_now == pos_before, rec["read_pos"])
        # 같은 근거 다시 열기 → 키보드 Escape 로 닫기
        btn = pg.locator('.evbtn[data-claim="p3"]')
        if not in_viewport(box(btn), run.vw, run.vh):
            run.wheel_until_visible(btn, "p3 근거 버튼(재)")
        run.act(btn, "p3 '근거' 다시")
        r = run.st()
        head = pg.locator("#peek-p3 .peek-head .t").inner_text()
        run.chk(rec, "다시 열어도 미리보기 1개, 출발 인용이 첫 줄에 보임", r["peeks"] == 1 and "AI 해석이 낡아도" in head and box(pg.locator("#peek-p3 .peek-head")) is not None, head)
        pg.keyboard.press("Escape"); pg.wait_for_timeout(200)
        run.note("key Escape (초점: p3 근거 버튼)")
        e = run.st()
        pe = e["winY"] if run.mobile else e["readingTop"]
        run.chk(rec, "Escape로 닫은 뒤에도 읽던 위치가 열기 전과 같음", pe == pos_before, {"before_open": pos_before, "after_esc": pe})
        run.chk(rec, "키보드 Escape로 닫힘·초점 복귀", e["peeks"] == 0 and e["active"] == "evbtn:p3", e["active"])
        rec["shot_closed"] = run.shot(f"{P}_s4_peek_closed")

    def s5(rec):
        pb = pg.locator("#prepBtn")
        run.wheel_until_visible(pb, "준비 제안 버튼", over=None if run.mobile else (800, 500), top_margin=70 if run.mobile else 0)
        before = run.st()
        ctx["before_prep"] = before
        run.act(pb, "이 부분을 이어 맡길 내용 보기")
        a = run.st()
        dlg = pg.locator("#prep")
        run.chk(rec, "준비 화면이 실제 표시", a["dialogOpen"] and dlg.is_visible())
        t = dlg.inner_text()
        for k in ["대상", "범위", "기준 기록", "지켜야 할 조건", "이 기록으로 알 수 없는 것"]:
            run.chk(rec, f"준비본 항목: {k}", k in t)
        run.chk(rec, "작업 지시 경계가 준비본에 있음", "작업 지시" in t)
        run.chk(rec, "받을 담당자를 지어내지 않음", "받을 담당자: 기록에 없음" in t)
        run.chk(rec, "보내지 않음 명시", "보내지 않습니다" in t)
        btns = dlg.locator("button").all_inner_texts()
        run.chk(rec, "준비 화면 버튼은 닫기뿐(보내기 없음)", [b.strip() for b in btns] == ["닫기"], btns)
        run.chk(rec, "발송·수락·완료 표현 없음", not any(f in t for f in FORBIDDEN))
        cb = box(dlg.locator("#prepClose"))
        ctx["prep_close_pt"] = [cb["x"] + cb["width"] / 2, cb["y"] + cb["height"] / 2]
        hit = pg.evaluate(JS_HIT, ctx["prep_close_pt"])
        run.chk(rec, "닫기 버튼이 최상단 요소", hit and hit["inDialog"], hit)
        rec["shot_prep"] = run.shot(f"{P}_s5_prep_open")

    def s6(rec):
        before = ctx["before_prep"]
        run.act(pg.locator("#prepClose"), "준비 닫기")
        a = run.st()
        run.chk(rec, "준비 화면이 닫히고 보이지 않음", (not a["dialogOpen"]) and not pg.locator("#prep").is_visible())
        hit = pg.evaluate(JS_HIT, ctx["prep_close_pt"])
        run.chk(rec, "옛 닫기 위치를 준비 화면이 가리지 않음", not (hit and hit["inDialog"]), hit)
        run.chk(rec, "초점이 준비 버튼으로 복귀", a["active"] == "prepBtn", a["active"])
        pos_b = before["winY"] if run.mobile else before["readingTop"]
        pos_a = a["winY"] if run.mobile else a["readingTop"]
        run.chk(rec, "읽기 위치 유지", pos_a == pos_b, {"before": pos_b, "after": pos_a})
        run.chk(rec, "같은 부분 유지", "목적 정정" in pg.locator(".rail .crumb").inner_text())
        body = pg.locator("body").inner_text()
        run.chk(rec, "보냄·배정 표시 없음", not any(f in body for f in FORBIDDEN))

    def s7(rec):
        ret = pg.locator("#returnAll")
        b = box(ret)
        run.chk(rec, "전체 복귀 버튼이 현재 화면에서 바로 보임(스크롤 불필요)", in_viewport(b, run.vw, run.vh), b and int(b["y"]))
        run.act(ret, "전체 지도로 돌아가기")
        pg.wait_for_timeout(200)
        a = run.st()
        pre = ctx["pre_enter"]
        run.chk(rec, "지도가 보이고 읽기 공간이 닫힘", a["mapVisible"] and not a["focusVisible"])
        run.chk(rec, "같은 목적 정정 부분 선택", a["selected"] == ["purpose"])
        run.chk(rec, "다른 영역 펼침 깊이가 1단계와 동일", a["areas"] == base["areas"], {"base": base["areas"], "now": a["areas"]})
        run.chk(rec, "지도 위치·스크롤·배율이 진입 직전과 동일",
                a["mapScroll"] == pre["mapScroll"] and a["winY"] == pre["winY"] and a["zoom"] == pre["zoom"],
                {"pre": [pre["mapScroll"], pre["winY"], pre["zoom"]], "now": [a["mapScroll"], a["winY"], a["zoom"]]})
        if not run.mobile:
            run.chk(rec, "연결선이 같은 수로 다시 그려짐", a["edges"] == pre["edges"], a["edges"])
        run.chk(rec, "초점이 선택 부분 노드에", a["active"] == "part is-selected:purpose", a["active"])
        nb = box(pg.locator('.part[data-id="purpose"]'))
        run.chk(rec, "선택 노드가 화면 안에 보임", in_viewport(nb, run.vw, run.vh), nb and [int(nb["x"]), int(nb["y"])])
        run.chk(rec, "근거·준비 잔여 없음", a["peeks"] == 0 and not a["dialogOpen"])
        rec["shot_return"] = run.shot(f"{P}_s7_return")
        rec["state"] = a

    for no, title, fn in [(2, "목적 정정 부분 선택" + sfx, s2), (3, "필요한 근거 한 곳 열기" + sfx, s3),
                          (4, "근거 닫기와 다시 열기" + sfx, s4), (5, "선택 부분의 인계 준비 읽기" + sfx, s5),
                          (6, "준비 닫기" + sfx, s6), (7, "전체로 복귀" + sfx, s7)]:
        r = run.step(no if round_no == 1 else f"8.{no}", title, fn)
        rec_all.append(r)
        if r["status"] == "FAIL" and no in (2, 7):
            break


def run_viewport(pw, name, vw, vh, mobile):
    browser = pw.chromium.launch()
    ctxo = browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1,
                               is_mobile=mobile, has_touch=mobile, locale="ko-KR")
    page = ctxo.new_page()
    errors, page_errors, requests = [], [], []
    page.on("pageerror", lambda e: page_errors.append(str(e)))
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("request", lambda r: requests.append(r.url))
    resp = page.goto(URL)
    page.wait_for_timeout(300)
    run = Run(name, page, vw, vh, mobile)
    info = {"viewport": f"{vw}x{vh}", "mobile_emulation": mobile, "browser": browser.version, "url": URL,
            "http_status": resp.status, "zoom_browser": "100%"}
    allrec = []

    def s1(rec):
        st0 = run.st()
        rec["initial"] = st0
        body = page.locator("body").inner_text()
        run.chk(rec, "첫 화면 요약 제목", page.locator("#briefTitle").is_visible() and "목적 정정은 별도로" in page.locator("#briefTitle").inner_text())
        run.chk(rec, "관련 영역 4곳이 사용자 언어로 보임", all(k in page.locator(".areas-named").inner_text() for k in ["홈", "작업문", "다음 AI 요청", "저장 복구"]))
        run.chk(rec, "기록의 한계 한 줄", page.locator(".limit").is_visible())
        run.chk(rec, "다른 영역의 서로 다른 펼침 깊이", len(set(st0["areas"].values())) == 3, st0["areas"])
        run.chk(rec, "사건ID·해시·검사 수 기본 노출 없음",
                not any(k in body for k in ["d5ef9a4", "f0fa532", "intent-edit", "manual.", "H1", "E09"]))
        run.chk(rec, "근거 없는 방문·인계·승인 표시 없음", not any(f in body for f in FORBIDDEN))
        run.chk(rec, "기본에 근거 버튼 없음", page.locator(".evbtn").count() == 0)
        run.chk(rec, "연구 배치(모듈 구조 아님) 표시", "모듈 구조나 포함 관계가 아닙니다" in body)
        if not mobile:
            run.act(page.locator("#zoomIn"), "지도 확대(+)")
            page.mouse.move(900, 450); page.mouse.wheel(60, 140); page.wait_for_timeout(250)
            run.note("wheel map (60,140)")
        else:
            page.mouse.move(195, 420); page.mouse.wheel(0, 300); page.wait_for_timeout(250)
            run.note("wheel page (0,300)")
            # 모바일 핵심 조작 크기
            pb = box(page.locator('.part[data-id="purpose"]'))
            run.chk(rec, "모바일 부분 버튼이 누를 만한 크기(높이≥44, 폭≥300)", pb and pb["height"] >= 44 and pb["width"] >= 300, pb)
            sw = page.evaluate("document.documentElement.scrollWidth")
            run.chk(rec, "가로 넘침 없음", sw <= vw, sw)
        st1 = run.st()
        run.chk(rec, "기준 위치 기록(비초기 스크롤)", (st1["mapScroll"] != [0, 0]) if not mobile else st1["winY"] > 0,
                {"mapScroll": st1["mapScroll"], "winY": st1["winY"], "zoom": st1["zoom"]})
        rec["base"] = st1
        rec["shot"] = run.shot("s1_base")

    r1 = run.step(1, "전체에서 변화 파악", s1)
    allrec.append(r1)
    base = r1.get("base") or run.st()
    flow(run, 1, base, allrec)
    flow(run, 2, base, allrec)
    s7s = [r for r in allrec if str(r["step"]) in ("7", "8.7")]
    if len(s7s) == 2 and "state" in s7s[0] and "state" in s7s[1]:
        a, b = s7s[0]["state"], s7s[1]["state"]
        same = {k: a[k] == b[k] for k in ["areas", "selected", "mapScroll", "winY", "zoom", "edges", "peeks", "dialogOpen"]}
        rec8 = {"step": 8, "title": "같은 작은 흐름 반복(1회차 복귀 상태와 대조)", "checks": [["두 번째 복귀 상태 = 첫 번째", all(same.values()), same]],
                "status": "PASS" if all(same.values()) else "FAIL"}
        sub = [r for r in allrec if str(r["step"]).startswith("8.")]
        if any(r["status"] != "PASS" for r in sub):
            rec8["status"] = "FAIL"
        allrec.append(rec8)
    ext = [u for u in requests if not u.startswith(URL.rsplit("/", 1)[0])]
    info["external_requests"] = ext
    info["console_errors"] = errors
    info["page_errors"] = page_errors
    info["external_source_roundtrip"] = "NOT_RUN (링크 존재·href만 확인, 클릭·외부 페이지 왕복 관측 안 함)"
    browser.close()
    return {"info": info, "steps": allrec, "actions": run.log}


def verdict(run):
    """한 뷰포트 결과의 실패 사유 목록. 빈 목록이어야 통과."""
    reasons = []
    if run.get("crash"):
        reasons.append(f"실행 중단: {run['crash']}")
    seen = {str(s["step"]): s["status"] for s in run.get("steps", [])}
    for st in REQUIRED_STEPS:
        if st not in seen:
            reasons.append(f"미완주: 단계 {st} 기록 없음")
        elif seen[st] != "PASS":
            reasons.append(f"단계 {st} {seen[st]}")
    pe = run.get("info", {}).get("page_errors") or []
    if pe:
        reasons.append(f"pageerror {len(pe)}건: {pe[:3]}")
    return reasons


def main(argv):
    global URL, HTML, OUT, SHA
    URL, HTML, OUT = argv[1], Path(argv[2]), Path(argv[3])
    OUT.mkdir(parents=True, exist_ok=True)
    SHA = hashlib.sha256(HTML.read_bytes()).hexdigest()
    t0 = time.strftime("%Y-%m-%dT%H:%M:%S%z")
    out = {"started": t0, "html_sha256": SHA, "html": HTML.name,
           "inputs": {"brief_commit": "16e417af220361bc1926538b729decb3b3008208",
                      "source_doc": "docs/flow049-outcome-home.md @ f0fa5326c0f1c96fbc4360f7968b6be636836056 L175-187, L226-237"},
           "runs": {}}
    try:
        with sync_playwright() as pw:
            for name, w, h, m in [("d1440", 1440, 900, False), ("m390", 390, 844, True)]:
                try:
                    out["runs"][name] = run_viewport(pw, name, w, h, m)
                except Exception as e:  # 뷰포트 실행 자체가 죽어도 기록하고 실패로 종료
                    out["runs"][name] = {"info": {"viewport": f"{w}x{h}"}, "steps": [], "crash": repr(e)}
    except Exception as e:
        out["crash"] = repr(e)
    failures = {}
    if out.get("crash"):
        failures["*"] = [f"브라우저 시작/종료 실패: {out['crash']}"]
    for name in ("d1440", "m390"):
        r = out["runs"].get(name)
        reasons = ["실행 기록 없음"] if r is None else verdict(r)
        if reasons:
            failures[name] = reasons
    exit_code = 1 if failures else 0
    out["verdict"] = {"exit_code": exit_code, "failures": failures}
    (OUT / "flow_log.json").write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    lines = [f"HTML {HTML.name} sha256={SHA}", f"시작 {t0}"]
    for name, r in out["runs"].items():
        i = r.get("info", {})
        lines.append(f"\n== {name} {i.get('viewport')} {i.get('browser', '-')} HTTP {i.get('http_status', '-')} {i.get('url', '-')}")
        if r.get("crash"):
            lines.append(f"   실행 중단: {r['crash']}")
        for s in r.get("steps", []):
            lines.append(f"[{s['status']}] {s['step']} {s['title']}" + (f"  ERROR {s['error']}" if 'error' in s else ""))
            for c in s["checks"]:
                if not c[1]:
                    lines.append(f"     - FAIL {c[0]} :: {c[2]}")
        if "external_requests" in i:
            lines.append(f"   외부 요청: {i['external_requests'] or '없음'} / 콘솔 오류: {i['console_errors'] or '없음'} / pageerror: {i['page_errors'] or '없음'}")
            lines.append(f"   외부 원문 왕복: {i['external_source_roundtrip']}")
    lines.append("")
    if failures:
        lines.append(f"판정: FAIL (exit {exit_code})")
        for k, v in failures.items():
            for x in v:
                lines.append(f"   {k}: {x}")
    else:
        lines.append(f"판정: 두 뷰포트 필수 단계 {len(REQUIRED_STEPS)}개 모두 PASS, pageerror 없음 (exit 0)")
    (OUT / "flow_log.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return exit_code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
