# canvas-study.html 실제 렌더링 검사 (headless Chromium, Playwright).
# 사용: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 render_check.py <html> <screenshot_dir>
import sys, json
from playwright.sync_api import sync_playwright

html, out = sys.argv[1], sys.argv[2]
url = "file://" + html
P = F = 0
def info(m):
    # 정보 행: 검증이 아니므로 PASS/FAIL 수에 넣지 않음
    print("INFO " + m)

def ok(c, m):
    global P, F
    print(("PASS " if c else "FAIL ") + m)
    if c: P += 1
    else: F += 1

def rect(pg, sel):
    return pg.eval_on_selector(sel, "e=>{const r=e.getBoundingClientRect();return {x:r.left,y:r.top,w:r.width,h:r.height,r:r.right,b:r.bottom}}")
def inter(a, b):
    return not (a["r"] <= b["x"] or b["r"] <= a["x"] or a["b"] <= b["y"] or b["b"] <= a["y"])
def inside(a, b, tol=0.5):
    return a["x"] >= b["x"]-tol and a["y"] >= b["y"]-tol and a["r"] <= b["r"]+tol and a["b"] <= b["b"]+tol
def attr(pg, name): return pg.get_attribute("#app", name)
def click(pg, key): pg.click(f'[data-key="{key}"]')

EDGE_GEOM = """() => {
  const res = [];
  const svg = document.querySelector('svg.edges');
  const frame = document.querySelector('[data-box="A"]').getBoundingClientRect();
  const nodes = [...document.querySelectorAll('[data-node]')].map(n => ({id:n.dataset.node, r:n.getBoundingClientRect()}));
  for (const p of svg.querySelectorAll('path')) {
    const L = p.getTotalLength(), m = p.getScreenCTM();
    const pts = [];
    for (let i = 0; i <= 200; i++) { const q = p.getPointAtLength(L*i/200); pts.push({x:m.a*q.x+m.c*q.y+m.e, y:m.b*q.x+m.d*q.y+m.f}); }
    const owner = p.dataset.edge.split('-')[0];
    const hitsOther = [];
    for (const n of nodes) {
      if (n.id === owner || n.id === 'B') continue;
      if (pts.some(q => q.x > n.r.left+1 && q.x < n.r.right-1 && q.y > n.r.top+1 && q.y < n.r.bottom-1)) hitsOther.push(n.id);
    }
    const nearBorder = pts.filter(q => Math.abs(q.x - frame.right) < 2.5);
    const ys = nearBorder.map(q => q.y);
    const crossSpread = ys.length ? Math.max(...ys) - Math.min(...ys) : 0;
    const alongTop = pts.filter(q => Math.abs(q.y - frame.top) < 2 || Math.abs(q.y - frame.bottom) < 2).length;
    res.push({edge:p.dataset.edge, hitsOther, crossSpread, alongTop});
  }
  return res;
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    errs = []
    # ---------- 1440 ----------
    pg = b.new_page(viewport={"width":1440,"height":900})
    pg.on("pageerror", lambda e: errs.append("1440:" + str(e)))
    pg.on("console", lambda m: errs.append("1440 console:" + m.text) if m.type == "error" else None)
    pg.goto(url)
    print("# 1440 × 900")
    pg.screenshot(path=f"{out}/1440_S1_overview.png")
    g = pg.evaluate(EDGE_GEOM)
    ok(len(g) == 1 and g[0]["edge"] == "A-B-area" and g[0]["hitsOther"] == [] , "S1 렌더: 영역 수준 선 1개, 자식 카드를 지나지 않음 " + json.dumps(g, ensure_ascii=False))
    click(pg, "scene-2")
    cw, ins = rect(pg, "#cwrap"), rect(pg, "#insp")
    fr, bn = rect(pg, '[data-box="A"]'), rect(pg, '[data-node="B"]')
    kids = [rect(pg, f'[data-node="A{i}"]') for i in range(1, 7)]
    ok(inside(fr, cw) and all(inside(k, cw) for k in kids) and inside(bn, cw), "S2 A 경계·여섯 부분·B 모두 캔버스 안에 보임")
    ok(not inter(bn, ins) and ins["w"] >= 340, f"선택 상세(폭 {ins['w']:.0f})가 B를 가리지 않음")
    fs = pg.eval_on_selector('[data-node="A3"] .n-name', "e=>parseFloat(getComputedStyle(e).fontSize)")
    ok(fs >= 13, f"100% 카드 이름 글자 {fs}px")
    g = pg.evaluate(EDGE_GEOM)
    ok(sorted(x["edge"] for x in g) == ["A2-B","A4-B","A6-B"], "S2 렌더 관계선 3개")
    ok(all(x["hitsOther"] == [] for x in g), "관계선이 다른 카드(A1·A3·A5 등)를 지나지 않음 " + json.dumps([x["hitsOther"] for x in g]))
    ok(all(x["crossSpread"] <= 3 for x in g), "관계선이 포함 경계를 한 점(경계 통과점)에서만 직각 통과 " + json.dumps([round(x["crossSpread"],1) for x in g]))
    ok(all(x["alongTop"] == 0 for x in g), "관계선이 경계 위·아래 변을 따라 달리지 않음")
    pg.screenshot(path=f"{out}/1440_S2_overview.png")

    print("# 핵심 장면 ① 실제 자동 최소 이동 + 복귀")
    click(pg, "node-A4")
    for _ in range(3): click(pg, "pan-d")   # 화면을 위로 밀어 A2가 화면 밖으로
    vpA4 = attr(pg, "data-vp")
    a2 = rect(pg, '[data-node="A2"]'); cw = rect(pg, "#cwrap")
    ok(not inside(a2, cw), f"준비: A2가 화면 밖 (vp {vpA4})")
    pg.screenshot(path=f"{out}/1440_S2_A4_panned.png")
    click(pg, "ins-peer-A2")
    vpA2 = attr(pg, "data-vp")
    a2 = rect(pg, '[data-node="A2"]'); cw = rect(pg, "#cwrap"); bn = rect(pg, '[data-node="B"]'); ins = rect(pg, "#insp")
    ok(attr(pg, "data-sel") == "A2" and inside(a2, cw), f"A2로 이동 시 최소 이동으로 A2 보임 (vp {vpA4} → {vpA2})")
    ok(vpA2.split(",")[2] == vpA4.split(",")[2], "이동 중 배율 유지(자동 전체맞춤 없음)")
    ok(not inter(bn, ins), "A2 상세가 열려도 B를 가리지 않음")
    pg.screenshot(path=f"{out}/1440_S2_A2_from_A4.png")
    click(pg, "ins-back")
    ok(attr(pg, "data-sel") == "A4" and attr(pg, "data-vp") == vpA4, f"A4로 보기 복귀: 선택·위치·배율 정확히 복원 ({attr(pg,'data-vp')})")
    pg.screenshot(path=f"{out}/1440_S2_back_A4.png")

    print("# 핵심 장면 ② A 집중 왕복")
    click(pg, "zoom-in")
    vpOv = attr(pg, "data-vp")
    fh = rect(pg, '[data-key="cv-focusA"]'); cw = rect(pg, "#cwrap")
    info(f"프레임 머리글의 'A에 집중'은 화면 밖일 수 있음 (보임={inside(fh, cw)}) → 선택 상세의 진입 버튼 사용")
    click(pg, "ins-focusA")
    cw, ins, bn = rect(pg, "#cwrap"), rect(pg, "#insp"), rect(pg, '[data-node="B"]')
    ok(inside(bn, cw) and not inter(bn, ins), f"집중 화면: 외부 B가 보이고 패널(폭 {ins['w']:.0f})에 가리지 않음")
    click(pg, "node-A2")
    pg.screenshot(path=f"{out}/1440_S2_focus_A2.png")
    g = pg.evaluate(EDGE_GEOM)
    ok(all(x["hitsOther"] == [] and x["crossSpread"] <= 3 for x in g), "집중 화면 관계선도 카드·경계 겹침 없음")
    click(pg, "crumb-root")
    ok(attr(pg, "data-sel") == "A4" and attr(pg, "data-vp") == vpOv and attr(pg, "data-expanded") == "true", f"경로 '전체' 복귀: A4·펼침·위치/배율 복원 ({vpOv})")

    print("# 끌기 이동·배율 (실제 포인터)")
    click(pg, "zoom-100")
    cw = rect(pg, "#cwrap")
    v0 = attr(pg, "data-vp")
    pg.mouse.move(cw["x"] + 700, cw["y"] + 600); pg.mouse.down(); pg.mouse.move(cw["x"] + 640, cw["y"] + 560, steps=5); pg.mouse.up()
    v1 = attr(pg, "data-vp")
    ok(v0 != v1 and v1.endswith(",1"), f"배경 끌기로 이동 ({v0} → {v1}), 배율 불변")
    txt0 = pg.inner_text("#world")
    click(pg, "zoom-out"); click(pg, "zoom-out")
    ok(pg.inner_text("#world") == txt0, "축소해도 카드 글·구조 동일(상세 수준 불변)")
    pg.screenshot(path=f"{out}/1440_S2_zoom67.png")
    click(pg, "zoom-100")

    print("# 접힘 + 목록")
    click(pg, "fit")   # 사용자가 명시적으로 '전체 맞춤'
    kf = attr(pg, "data-vp").split(",")[2]
    ok(float(kf) <= 1, f"명시적 전체 맞춤만 배율을 바꿈 (k={kf})")
    click(pg, "node-A4"); click(pg, "cv-toggleA"); click(pg, "cv-list")
    pg.screenshot(path=f"{out}/1440_S2_collapsed_list.png")
    g = pg.evaluate(EDGE_GEOM)
    ok(sorted(x["edge"] for x in g) == ["A2-B","A4-B","A6-B"], "접힌 A에서도 원래 끝점 3개 선")
    click(pg, "cv-toggleA")

    print("# S3 인계")
    click(pg, "scene-3"); click(pg, "bn-chg"); click(pg, "ins-handoff")
    pg.screenshot(path=f"{out}/1440_S3_A2_handoff.png")
    ok(pg.is_visible('[data-testid="handoff-doc"]') and "준비·미전달" in pg.inner_text('[data-testid="ho-state"]'), "S3 인계문 표시, 준비·미전달")
    bn, ins = rect(pg, '[data-node="B"]'), rect(pg, "#insp")
    ok(not inter(bn, ins), "인계문을 펼쳐도 B 가림 없음")

    print("# 키보드")
    pg.goto(url)
    seen = []
    for _ in range(40):
        pg.keyboard.press("Tab")
        k = pg.evaluate("document.activeElement && document.activeElement.dataset.key")
        seen.append(k)
        if k == "node-A2": break
    ok("node-A2" in seen, f"Tab으로 A2 카드 도달 ({len(seen)}회)")
    outline = pg.evaluate("getComputedStyle(document.activeElement).outlineStyle + ' ' + getComputedStyle(document.activeElement).outlineWidth")
    ok(outline.startswith("solid"), "키보드 초점 테두리 표시: " + outline)
    pg.keyboard.press("Enter")
    ok(attr(pg, "data-sel") == "A2", "Enter로 A2 선택")
    pg.focus("#cwrap"); v0 = attr(pg, "data-vp"); pg.keyboard.press("ArrowLeft"); pg.keyboard.press("ArrowUp")
    ok(attr(pg, "data-vp") != v0, "캔버스 초점에서 방향키 이동")

    # 어두운 테마
    dk = b.new_page(viewport={"width":1440,"height":900}, color_scheme="dark")
    dk.goto(url); dk.click('[data-key="scene-2"]'); dk.click('[data-key="node-A2"]')
    dk.screenshot(path=f"{out}/1440_S2_dark.png")

    # ---------- 390 ----------
    print("# 390 × 844")
    m = b.new_page(viewport={"width":390,"height":844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m.on("pageerror", lambda e: errs.append("390:" + str(e)))
    m.goto(url)
    sw = m.evaluate("document.scrollingElement.scrollWidth")
    ok(sw <= 390, f"가로 넘침 없음 (scrollWidth {sw})")
    m.click('[data-key="scene-2"]')
    ok(m.is_visible("#outline") and not m.is_visible("#cwrap"), "기본: 구조 목록 표시")
    m.screenshot(path=f"{out}/390_S2_outline.png")
    fs = m.eval_on_selector('[data-key="ol-A4"]', "e=>parseFloat(getComputedStyle(e).fontSize)")
    ok(fs >= 13, f"목록 글자 {fs}px")
    m.click('[data-key="ol-A4"]')
    ok(m.is_visible("#insp") and attr(m, "data-sel") == "A4", "A4 → 상세 탭")
    m.click('[data-key="ins-peer-A2"]')
    m.screenshot(path=f"{out}/390_S2_A2_detail.png")
    ok("대여 확정 후 알림" in m.inner_text("#insp"), "390 상세: A2 변경 읽힘")
    m.click('[data-key="ins-back"]')
    ok(attr(m, "data-sel") == "A4", "390: A4로 보기 복귀")
    m.click('[data-key="ins-to-canvas"]')
    ok(m.is_visible("#cwrap") and attr(m, "data-vp").endswith(",1"), "캔버스에서 보기: 배율 100% 유지")
    a4 = rect(m, '[data-node="A4"]'); cw = rect(m, "#cwrap")
    ok(inter(a4, cw), "캔버스에서 보기: 선택한 A4가 화면 안으로 이동")
    m.screenshot(path=f"{out}/390_S2_canvas_A4.png")
    sw = m.evaluate("document.scrollingElement.scrollWidth")
    ok(sw <= 390, f"캔버스 탭에서도 가로 넘침 없음 (scrollWidth {sw})")

    ok(not errs, "브라우저 오류 없음 " + "; ".join(errs))
    b.close()
print(f"render pass {P} fail {F}")
# 실패가 하나라도 있으면 0이 아닌 종료코드 (예외로 중단돼도 Python이 1로 종료)
sys.exit(1 if F else 0)
