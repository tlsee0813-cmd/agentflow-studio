# 390폭 구조 목록 스크롤 복귀 재현 (실제 headless Chromium). 작성자 검사.
# 사용: PLAYWRIGHT_BROWSERS_PATH=... python3 repro_outline_scroll.py <html> [screenshot_dir]
import sys
from playwright.sync_api import sync_playwright

html = sys.argv[1]; out = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2] != "-" else None
H = int(sys.argv[3]) if len(sys.argv) > 3 else 844
WANT = 120 if H < 800 else 40
P = F = 0
def ok(c, m):
    global P, F
    print(("PASS " if c else "FAIL ") + m)
    if c: P += 1
    else: F += 1
def info(m): print("INFO " + m)

MEASURE = """() => {
  const ol = document.getElementById('outline'), se = document.scrollingElement;
  const ins = document.getElementById('insp');
  return {olTop: ol ? ol.scrollTop : null, olH: ol ? ol.clientHeight : null, olSH: ol ? ol.scrollHeight : null,
          docTop: se.scrollTop, docH: se.clientHeight, docSH: se.scrollHeight,
          insTop: ins ? ins.scrollTop : null,
          pane: document.getElementById('app').dataset.pane, sel: document.getElementById('app').dataset.sel,
          vp: document.getElementById('app').dataset.vp}
}"""

with sync_playwright() as p:
    b = p.chromium.launch()
    errs = []
    m = b.new_page(viewport={"width":390,"height":H}, device_scale_factor=2, is_mobile=True, has_touch=True)
    m.on("pageerror", lambda e: errs.append(str(e)))
    m.goto("file://" + html)
    m.click('[data-key="scene-2"]')
    s0 = m.evaluate(MEASURE)
    info(f"S2 구조 목록 크기: 목록 client {s0['olH']} / scroll {s0['olSH']}, 문서 client {s0['docH']} / scroll {s0['docSH']}")
    ol_scrolls = s0["olSH"] > s0["olH"] + 1
    doc_scrolls = s0["docSH"] > s0["docH"] + 1
    info(f"실제 스크롤 주체: 목록={ol_scrolls}, 문서={doc_scrolls}")
    ok(ol_scrolls, f"390×{H} S2에서 구조 목록 자체가 스크롤되는 높이 (목록 내용 > 보이는 높이)")

    # 실제 휠 입력으로 목록을 내림 (스크립트로 scrollTop을 직접 넣지 않음)
    box = m.eval_on_selector("#outline", "e=>{const r=e.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}}")
    m.mouse.move(box["x"], box["y"])
    for _ in range(12):
        m.mouse.wheel(0, 10)
        m.wait_for_timeout(15)
    m.wait_for_timeout(250)
    s1 = m.evaluate(MEASURE)
    target = s1["olTop"]
    info(f"휠 후 목록 y={target}, 문서 y={s1['docTop']}")
    ok(target and target >= WANT, f"목록이 실제로 y≥{WANT}까지 스크롤됨 (y={target}, 최대 {s1['olSH']-s1['olH']})")
    if out: m.screenshot(path=f"{out}/390x{H}_S2_outline_scrolled.png")

    # 목록 → 상세 → 목록
    m.click('[data-key="ol-A4"]')
    s2 = m.evaluate(MEASURE)
    ok(s2["pane"] == "detail" and s2["sel"] == "A4", "목록에서 A4 → 상세")
    m.click('[data-key="ins-peer-A2"]')
    m.click('[data-key="ins-back"]')
    ok(m.evaluate(MEASURE)["sel"] == "A4", "상세에서 A2 → 보기 복귀 → A4 (기존 의미 유지)")
    vp_before_canvas = m.evaluate(MEASURE)["vp"]
    m.click('[data-key="ins-to-outline"]')
    s3 = m.evaluate(MEASURE)
    ok(s3["pane"] == "outline" and s3["olTop"] == target, f"구조 목록 복귀 시 스크롤 복원 ({target} → {s3['olTop']})")
    if out: m.screenshot(path=f"{out}/390x{H}_S2_outline_restored.png")

    # 목록 → 캔버스 탭 → 목록 (탭 전환도 같은 저장 경로)
    m.click('[data-key="pane-canvas"]')
    s4 = m.evaluate(MEASURE)
    ok(s4["vp"] == vp_before_canvas, "목록 스크롤이 캔버스 위치(vp)에 섞이지 않음")
    m.click('[data-key="pane-outline"]')
    ok(m.evaluate(MEASURE)["olTop"] == target, "캔버스 탭 왕복 후에도 목록 스크롤 복원")

    # 장면별 분리: S3 목록 스크롤은 S2 값을 물려받지 않음
    m.click('[data-key="scene-3"]')
    s5 = m.evaluate(MEASURE)
    ok(s5["olTop"] == 0, f"다른 장면(S3) 목록은 S2 스크롤을 물려받지 않음 (y={s5['olTop']})")
    m.click('[data-key="scene-2"]')
    ok(m.evaluate(MEASURE)["olTop"] == target, "S2로 돌아오면 S2 목록 스크롤 복원")

    ok(not errs, "브라우저 오류 없음 " + "; ".join(errs))
    b.close()
print(f"outline-scroll pass {P} fail {F}")
sys.exit(1 if F else 0)
