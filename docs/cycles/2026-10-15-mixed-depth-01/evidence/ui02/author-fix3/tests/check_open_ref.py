# 합격 9 위치별 회귀 검사 — A2 소유 미결 참조 (실제 headless Chromium). 작성자 검사(독립 검사 아님).
# 사용: PLAYWRIGHT_BROWSERS_PATH=... python3 check_open_ref.py <html> [screenshot_dir|-]
# 실패가 하나라도 있으면 종료코드 1. INFO 행은 PASS/FAIL 수에 넣지 않음.
import sys, json
from playwright.sync_api import sync_playwright

html = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "-" else None
P = F = 0
def ok(c, m):
    global P, F
    print(("PASS " if c else "FAIL ") + m)
    if c: P += 1
    else: F += 1
def info(m): print("INFO " + m)

def A(pg, n): return pg.get_attribute("#app", n)
def k(pg, key): pg.click(f'[data-key="{key}"]')
def has(pg, sel): return pg.locator(sel).count() > 0
def within(pg, scope, sel): return pg.locator(scope).locator(sel).count()
def txt(pg, sel): return pg.inner_text(sel) if has(pg, sel) else ""
def edges(pg): return sorted(pg.eval_on_selector_all("svg.edges path", "ps=>ps.map(p=>p.dataset.edge)"))
def shot(pg, name):
    if out: pg.screenshot(path=f"{out}/{name}")

def to_canvas(pg, narrow):
    if narrow and A(pg, "data-pane") != "canvas": k(pg, "pane-canvas")
def collapse(pg, narrow):
    to_canvas(pg, narrow)
    if A(pg, "data-expanded") == "true":
        if narrow:                         # 390: 배율 100% 유지, 이동 버튼으로 '접기'를 화면 안에 들임
            k(pg, "pan-r"); k(pg, "cv-toggleA"); k(pg, "pan-l")
        else:
            k(pg, "cv-toggleA")
def select_B(pg, narrow):
    if narrow: k(pg, "pane-outline"); k(pg, "ol-B")      # 390: B는 구조 목록에서 (캔버스 100%에선 화면 밖)
    else: k(pg, "node-B")
def select_kid(pg, narrow, i):
    if narrow: k(pg, "pane-outline"); k(pg, f"ol-{i}")
    else: k(pg, f"node-{i}")
def open_detail(pg, narrow):
    if narrow and A(pg, "data-pane") != "detail": k(pg, "sb-detail")

def run(pg, label, narrow):
    print(f"# {label}")
    # ---------- S1 음성 대조 ----------
    collapse(pg, narrow)
    ok(A(pg, "data-scene") == "1" and A(pg, "data-expanded") == "false", f"{label} S1 접힌 A")
    box = '[data-box="A"][data-collapsed="true"]'
    ok(within(pg, box, '[data-testid="open-ref"]') == 0 and within(pg, box, '[data-open-ref]') == 0,
       f"{label} S1 접힌 A 요약에 미결 참조 없음 (미래 미결 표시 금지)")
    ok(not has(pg, '[data-key="cv-list"]'), f"{label} S1 실제 끝점 목록 없음 (세부 대상 미확인)")
    ok(edges(pg) == ["A-B-area"], f"{label} S1 관계: 영역 수준 미확인 1개 {edges(pg)}")
    select_B(pg, narrow)
    ok(within(pg, "#insp", '[data-testid="b-endpoints"]') == 0 and within(pg, "#insp", '[data-open-ref]') == 0
       and within(pg, "#insp", '[data-testid="b-open-ref"]') == 0, f"{label} S1 B 상세에 끝점·미결 참조 없음")

    # ---------- S2: 접힌 A 요약 ----------
    k(pg, "scene-2"); collapse(pg, narrow)
    ok(edges(pg) == ["A2-B", "A4-B", "A6-B"], f"{label} S2 접힌 A: 실제 관계 3개 유지 {edges(pg)}")
    sum_txt = txt(pg, box)
    ok("네 번째 관계 아님" in sum_txt, f"{label} S2 접힌 A: 상위 이력 문구 유지")
    chg = pg.locator(box).locator('[data-testid="change-ref"]'); opn = pg.locator(box).locator('[data-testid="open-ref"]')
    ok(chg.count() == 1 and opn.count() == 1, f"{label} 접힌 A 요약: 결정 변경 참조 1 + 미결 참조 1 (별도 요소)")
    ot = opn.inner_text() if opn.count() else ""
    ok("미결" in ot and "A2" in ot and "실패 알림 정책" in ot and "결정 변경" not in ot,
       f"{label} 접힌 A 미결 참조 글: '{ot.strip()}'")
    inview = False
    if opn.count():
        r = opn.bounding_box(); c = pg.locator("#cwrap").bounding_box()
        inview = opn.is_visible() and r["x"] >= c["x"] and r["y"] >= c["y"] and r["x"]+r["width"] <= c["x"]+c["width"]+0.5 and r["y"]+r["height"] <= c["y"]+c["height"]+0.5
    ok(inview, f"{label} 접힌 A 미결 참조가 캔버스 화면 안에 실제로 보임")
    vp0 = A(pg, "data-vp"); sel0 = A(pg, "data-sel")
    if label.startswith("1440"): shot(pg, "1440_S2_collapsed_open_ref.png")
    if has(pg, '[data-key="cv-open"]'):
        k(pg, "cv-open")
        ok(A(pg, "data-sel") == "A2", f"{label} 접힌 A 미결 참조 → A2 선택")
        open_detail(pg, narrow)
        ins = txt(pg, "#insp")
        ok("미결" in ins and "실패 알림 정책" in ins and "A2 대여 신청" in ins, f"{label} A2 상세에 미결 표시")
        k(pg, "ins-back")
        ok(A(pg, "data-sel") == sel0 and A(pg, "data-expanded") == "false" and A(pg, "data-vp") == vp0,
           f"{label} 보기 복귀: 선택({sel0})·접힘·위치/배율 복원")
    else:
        ok(False, f"{label} 접힌 A 미결 참조 버튼 없음 → A2 이동·복귀 검사 불가")

    # ---------- S2: 접힌 A의 실제 끝점 목록 ----------
    to_canvas(pg, narrow)
    if A(pg, "data-list") != "true": k(pg, "cv-list")
    row = lambda i: f'[data-key="cl-{i}"]'
    ok(within(pg, row("A2"), '[data-open-ref="A2"]') == 1 and "Δ 결정 변경" in txt(pg, row("A2")),
       f"{label} 접힌 목록 A2 행: 결정 변경 + 미결(소유 A2)")
    ok(all(within(pg, row(i), '[data-open-ref]') == 0 and "Δ" not in txt(pg, row(i)) for i in ("A4", "A6")),
       f"{label} 접힌 목록 A4·A6 행: 미결·변경 전파 없음")
    ok("미결 1건" in (pg.get_attribute(row("A2"), "aria-label") or ""), f"{label} A2 행 접근 이름에 미결 포함")
    k(pg, "cl-A2")
    ok(A(pg, "data-sel") == "A2" and A(pg, "data-expanded") == "true", f"{label} 목록 A2 행 → A2")
    open_detail(pg, narrow); k(pg, "ins-back")
    ok(A(pg, "data-expanded") == "false" and A(pg, "data-list") == "true", f"{label} 복귀: 접힘·목록 열림 복원")

    # ---------- S2: B 상세 실제 끝점 A2 행 ----------
    to_canvas(pg, narrow); k(pg, "cv-toggleA")
    select_B(pg, narrow); open_detail(pg, narrow)
    ep = '[data-testid="b-endpoints"]'
    ok(within(pg, '[data-key="ins-ep-A2"]', '[data-open-ref="A2"]') == 1 and "Δ 결정 변경" in txt(pg, '[data-key="ins-ep-A2"]'),
       f"{label} B 상세 끝점 A2 행: 결정 변경 + 미결(소유 A2)")
    ok(all(within(pg, f'[data-key="ins-ep-{i}"]', '[data-open-ref]') == 0 and "Δ" not in txt(pg, f'[data-key="ins-ep-{i}"]') for i in ("A4", "A6")),
       f"{label} B 상세 끝점 A4·A6 행: 미결·변경 전파 없음")
    bi = txt(pg, "#insp")
    ok(within(pg, "#insp", '[data-open-ref]') == 1 and len(pg.locator('#insp [data-testid="b-open-ref"]').all()) == 1,
       f"{label} B 상세: 끝점 칩 1 + 미결 참조 1 (추가 중복 없음)")
    ok("소유 B" not in bi and "B 소유" not in bi and "소유 A2" in txt(pg, '[data-testid="b-open-ref"]'),
       f"{label} B 상세: B 소유로 읽히는 표현 없음")
    if label.startswith("1440"): shot(pg, "1440_S2_B_endpoints_open_ref.png")
    k(pg, "ins-ep-A2")
    ok(A(pg, "data-sel") == "A2", f"{label} B 끝점 A2 행 → A2")
    k(pg, "ins-back")
    ok(A(pg, "data-sel") == "B", f"{label} 복귀 → B")

    # ---------- A4·A6 전파 없음 (카드·상세) ----------
    for i in ("A4", "A6"):
        ok(has(pg, f'[data-node="{i}"]') and within(pg, f'[data-node="{i}"]', '[data-open-ref]') == 0, f"{label} {i} 카드에 미결 없음")
        select_kid(pg, narrow, i); open_detail(pg, narrow)
        ok(A(pg, "data-sel") == i and "미결" not in txt(pg, "#insp"), f"{label} {i} 상세에 미결 없음")

    # ---------- S3에도 같은 참조 ----------
    k(pg, "scene-3"); collapse(pg, narrow)
    ok(pg.locator(box).locator('[data-testid="open-ref"]').count() == 1, f"{label} S3 접힌 A 요약에도 미결 참조")

FIT = """(sel) => { const e = document.querySelector(sel); if (!e) return null;
  const r = e.getBoundingClientRect();
  const parts = [...e.querySelectorAll('.chip, b, span')].map(c => c.getBoundingClientRect()).filter(c => c.width > 0);
  const clipped = parts.some(c => c.left < r.left - 0.5 || c.right > r.right + 0.5 || c.top < r.top - 0.5 || c.bottom > r.bottom + 0.5);
  const cut = [...e.querySelectorAll('*')].some(c => c.scrollWidth > c.clientWidth + 1 && getComputedStyle(c).overflowX !== 'visible');
  return {sw: e.scrollWidth, cw: e.clientWidth, clipped, cut, right: r.right, vw: innerWidth,
          docSW: document.scrollingElement.scrollWidth}; }"""

def not_cut(pg, label, sel, name):
    f = pg.evaluate(FIT, sel)
    ok(bool(f) and f["sw"] <= f["cw"] + 1 and not f["clipped"] and not f["cut"] and f["right"] <= f["vw"] + 0.5 and f["docSW"] <= f["vw"],
       f"{label} {name}: 이름·배지·조작 잘림/가로넘침 없음 {f}")

def run_fix3(pg, label, narrow):
    print(f"# {label} — fix3: 구조 목록 관계 행 · B 상세 미결 버튼")
    # S1 음성
    select_B(pg, narrow); open_detail(pg, narrow)
    ok(A(pg, "data-scene") == "1" and within(pg, "#insp", '[data-testid="b-open-ref"]') == 0, f"{label} S1 B 상세에 미결 버튼 없음")
    if narrow:
        k(pg, "pane-outline")
        ok(pg.locator('#outline [data-key^="ol-rel-"]').count() == 0 and within(pg, "#outline", "[data-open-ref]") == 0,
           f"{label} S1 구조 목록 관계: 끝점 행·미결 없음 (세부 대상 미확인)")
    else:
        info(f"{label}: 구조 목록은 좁은 화면 전용(넓은 화면에서 숨김) → 관계 행 검사는 390에서 수행")
    for sc in (2, 3):
        k(pg, f"scene-{sc}")
        if narrow:
            k(pg, "pane-outline"); k(pg, "ol-A5"); k(pg, "ins-to-outline")     # 이전 선택 = A5
            r2 = '[data-key="ol-rel-A2"]'
            ok(within(pg, r2, '[data-open-ref="A2"]') == 1 and "Δ 결정 변경 1" in txt(pg, r2) and "E03 확인" in txt(pg, r2),
               f"{label} S{sc} 구조 목록 관계 A2 행: E03 확인 + 결정 변경 1 + 미결 1·소유 A2")
            ok("미결 1건" in (pg.get_attribute(r2, "aria-label") or ""), f"{label} S{sc} 관계 A2 행 접근 이름에 미결")
            ok(all(within(pg, f'[data-key="ol-rel-{i}"]', "[data-open-ref]") == 0 and "Δ" not in txt(pg, f'[data-key="ol-rel-{i}"]') for i in ("A4", "A6")),
               f"{label} S{sc} 구조 목록 관계 A4·A6 행: 미결·변경 전파 없음")
            pg.locator(r2).scroll_into_view_if_needed()
            not_cut(pg, f"{label} S{sc}", r2, "관계 A2 행")
            if sc == 2: shot(pg, "390_S2_outline_relations.png")
            k(pg, "ol-rel-A2")
            ok(A(pg, "data-pane") == "detail" and A(pg, "data-sel") == "A2" and A(pg, "data-stack") == "1:A5",
               f"{label} S{sc} 관계 A2 행 → A2 상세 (복귀점 A5)")
            ok("실패 알림 정책" in txt(pg, "#insp"), f"{label} S{sc} A2 상세에서 미결 확인")
            k(pg, "ins-back")
            ok(A(pg, "data-sel") == "A5", f"{label} S{sc} 보기 복귀 → 이전 선택 A5")
            k(pg, "ins-to-outline")
        # B 상세: 미결 참조 = A2 이동 버튼
        select_B(pg, narrow); open_detail(pg, narrow)
        bo = '#insp [data-testid="b-open-ref"]'
        tag = pg.eval_on_selector(bo, "e=>[e.tagName, e.dataset.action, e.dataset.val]") if has(pg, bo) else None
        ok(tag == ["BUTTON", "jump", "A2"], f"{label} S{sc} B 상세 미결 참조가 A2 이동 버튼 {tag}")
        bt = txt(pg, bo)
        ok("미결" in bt and "실패 알림 정책" in bt and "소유 A2" in bt and "결정 변경" not in bt, f"{label} S{sc} 미결 버튼 글: '{bt.strip()}'")
        ok(txt(pg, "#insp").count("실패 알림 정책") == 1 and within(pg, "#insp", 'p[data-testid="b-open-ref"]') == 0,
           f"{label} S{sc} B 상세: 미결 정책명은 버튼 한 곳뿐 (문단 중복 없음)")
        ins = txt(pg, "#insp")
        ok("소유 B" not in ins and "B 소유" not in ins, f"{label} S{sc} B 상세: B 소유 표현 없음")
        if narrow:
            not_cut(pg, f"{label} S{sc}", '[data-key="ins-ep-A2"]', "B 끝점 A2 행")
            not_cut(pg, f"{label} S{sc}", '[data-testid="b-open-ref"]', "B 미결 버튼")
            if sc == 2:
                pg.locator(bo).scroll_into_view_if_needed(); shot(pg, "390_S2_B_detail.png")
        if has(pg, '[data-key="ins-bopen"]'):
            k(pg, "ins-bopen")
            ok(A(pg, "data-sel") == "A2" and A(pg, "data-stack").endswith(":B") and "실패 알림 정책" in txt(pg, "#insp"),
               f"{label} S{sc} B 미결 버튼 → A2 상세 (결정 변경 링크 우회 불필요)")
            k(pg, "ins-back")
            ok(A(pg, "data-sel") == "B", f"{label} S{sc} 보기 복귀 → 이전 선택 B")
        else:
            ok(False, f"{label} S{sc} B 미결 이동 버튼 없음 → A2 이동·복귀 검사 불가")
        # A4·A6 상세에 미결 버튼·문구 없음
        for i in ("A4", "A6"):
            select_kid(pg, narrow, i); open_detail(pg, narrow)
            ok(within(pg, "#insp", '[data-testid="b-open-ref"]') == 0 and "미결" not in txt(pg, "#insp"), f"{label} S{sc} {i} 상세 미결 없음")
    k(pg, "scene-1")

with sync_playwright() as p:
    b = p.chromium.launch()
    errs = []
    w = b.new_page(viewport={"width":1440,"height":900})
    w.on("pageerror", lambda e: errs.append("1440:" + str(e)))
    w.goto("file://" + html); run(w, "1440", False)
    w2 = b.new_page(viewport={"width":1440,"height":900})
    w2.on("pageerror", lambda e: errs.append("1440b:" + str(e)))
    w2.goto("file://" + html); run_fix3(w2, "1440", False)
    n = b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    n.on("pageerror", lambda e: errs.append("390:" + str(e)))
    n.goto("file://" + html)
    info("390: 캔버스는 배율 100% 유지, 화면 밖 버튼은 이동 버튼으로 들임. B·A4·A6은 구조 목록에서 엶")
    run(n, "390", True)
    n2 = b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    n2.on("pageerror", lambda e: errs.append("390b:" + str(e)))
    n2.goto("file://" + html); run_fix3(n2, "390", True)
    ok(not errs, "브라우저 오류 없음 " + "; ".join(errs))
    b.close()
print(f"open-ref pass {P} fail {F}")
sys.exit(1 if F else 0)
