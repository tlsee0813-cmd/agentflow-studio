"""cycle04 fix1 좁은 실제 브라우저 확인 — B 마지막 문장 변경만 대상.

실행: (fix1 HTML 폴더에서) python3 -m http.server 8771 --bind 127.0.0.1
      python3 fix1_check.py http://127.0.0.1:8771/orientation-study.html <fix1 HTML> <출력 폴더>
범위: B(?v=b) 390×844·1280×720 초기 화면, 390에서 마지막 문장의 '저장 복구' 참조 → 설명으로 돌아가기 한 장면.
      v0의 다른 장면은 다시 실행하지 않는다. 각 탐색의 브라우저 응답 body SHA256을 기대 파일과 직접 비교한다.
종료: 모든 확인 통과 0, 그 밖(불일치·실패·pageerror·예외·정리 오류) 1.
"""
import hashlib, json, sys, time, traceback
from pathlib import Path
from playwright.sync_api import sync_playwright

NEW = "이 지도에서 저장 복구와 작업 카드의 직접 수정 동작·사용자 결정 표시의 연결은 미지정입니다. 무관하다는 뜻은 아닙니다."
OLD = "이 기록에 적혀 있지 않습니다"
UNSPEC_REF = '#explainBody p.unspec .ref[data-ref="a:restore"]'


def main(argv):
    url, html, out = argv[1], Path(argv[2]), Path(argv[3])
    out.mkdir(parents=True, exist_ok=True)
    exp = hashlib.sha256(html.read_bytes()).hexdigest()
    res = {"started": time.strftime("%Y-%m-%dT%H:%M:%S%z"), "expected_sha256": exp, "runs": [], "checks": []}
    ok_all = True

    def chk(where, what, ok, detail=None):
        nonlocal ok_all
        res["checks"].append([where, what, bool(ok), detail])
        ok_all = ok_all and bool(ok)

    try:
        with sync_playwright() as pw:
            b = pw.chromium.launch()
            res["browser"] = f"chromium {b.version}"
            try:
                for vp, (w, h, mob) in {"390": (390, 844, True), "1280": (1280, 720, False)}.items():
                    ctx = b.new_context(viewport={"width": w, "height": h}, device_scale_factor=1, is_mobile=mob, has_touch=mob, locale="ko-KR")
                    pg = ctx.new_page(); errs = []
                    pg.on("pageerror", lambda e: errs.append(str(e)))
                    resp = pg.goto(url + "?v=b"); body = resp.body()
                    sha = hashlib.sha256(body).hexdigest()
                    res["runs"].append({"vp": vp, "url": url + "?v=b", "status": resp.status, "body_sha256": sha, "body_bytes": len(body)})
                    chk(vp, "응답 body sha256·HTTP 200이 기대 파일과 일치", sha == exp and resp.status == 200, sha)
                    pg.wait_for_timeout(300)
                    u = pg.locator("#explainBody p.unspec")
                    txt = u.inner_text().strip()
                    chk(vp, "마지막 문장이 새 한정 문장", txt == NEW, txt)
                    chk(vp, "옛 표현 없음", OLD not in pg.locator("#explainBody").inner_text())
                    chk(vp, "마지막 문장의 동일 대상 참조 1개 유지", pg.locator(UNSPEC_REF).count() == 1 and pg.locator('#explainBody p.unspec .ref').count() == 1)
                    bb = pg.locator("#explainBody p.unspec").bounding_box()
                    chk(vp, "마지막 문장이 초기 화면 안에 온전히(상자 기준)", bb and bb["y"] >= 0 and bb["y"] + bb["height"] <= h, bb)
                    pg.screenshot(path=str(out / f"b_{vp}_initial.png"))
                    if vp == "390":
                        rb = pg.locator(UNSPEC_REF).bounding_box()
                        y0 = pg.evaluate("scrollY")
                        pg.touchscreen.tap(rb["x"] + rb["width"] / 2, rb["y"] + rb["height"] / 2); pg.wait_for_timeout(300)
                        st = pg.evaluate("""() => ({winY: scrollY, pointed:[...document.querySelectorAll('.is-pointed')].map(e=>e.dataset.id),
                            n: document.querySelectorAll('.area[data-id="restore"]').length, sel:[...document.querySelectorAll('.part.is-selected')].map(e=>e.dataset.id),
                            bar: getComputedStyle(document.getElementById('refbar')).display!=='none', text: document.getElementById('refText').textContent})""")
                        tb = pg.locator('.area[data-id="restore"]').bounding_box()
                        bar = pg.locator("#refbar").bounding_box()
                        chk(vp, "원래 저장 복구 카드(1개)를 가리킴, 선택은 그대로 없음", st["pointed"] == ["restore"] and st["n"] == 1 and st["sel"] == [], st)
                        chk(vp, "가리킨 카드가 고정 안내줄 아래 화면 안", tb and bar and tb["y"] >= bar["y"] + bar["height"] and tb["y"] + tb["height"] <= h, [tb, bar])
                        chk(vp, "안내줄: 함께 언급 목적 정정 · 미지정 두 동작", "목적 정정" in st["text"] and "미지정: 작업 지시, 사용자 결정 표시" in st["text"], st["text"])
                        res["app_auto_move_winY"] = [y0, st["winY"]]
                        pg.screenshot(path=str(out / "b_390_restore_ref_pointed.png"))
                        bk = pg.locator("#refBack").bounding_box()
                        pg.touchscreen.tap(bk["x"] + bk["width"] / 2, bk["y"] + bk["height"] / 2); pg.wait_for_timeout(300)
                        back = pg.evaluate("""() => ({winY: scrollY, bar: getComputedStyle(document.getElementById('refbar')).display!=='none',
                            pointed: document.querySelectorAll('.is-pointed').length, ref: document.activeElement.dataset.ref || null,
                            inUnspec: !!(document.activeElement.closest && document.activeElement.closest('p.unspec'))})""")
                        chk(vp, "설명으로 돌아가기: 참조 직전 창 위치·출발 참조 초점·안내줄 닫힘",
                            back["winY"] == y0 and back["ref"] == "a:restore" and back["inUnspec"] and not back["bar"] and back["pointed"] == 0, back)
                        res["back"] = back
                    chk(vp, "pageerror 없음", not errs, errs)
                    ctx.close()
            finally:
                b.close()
    except Exception as e:
        res["fatal"] = repr(e); res["trace"] = traceback.format_exc(limit=3); ok_all = False
    code = 0 if ok_all else 1
    res["exit_code"] = code
    (out / "fix1_check.json").write_text(json.dumps(res, ensure_ascii=False, indent=1), encoding="utf-8")
    lines = [f"기대 HTML sha256={exp}", f"{res.get('browser')} 시작 {res['started']}"]
    lines += [f"응답 {r['vp']}: {r['status']} {r['body_sha256']} {r['body_bytes']}B" for r in res["runs"]]
    lines += [f"[{'PASS' if c[2] else 'FAIL'}] {c[0]} {c[1]}" + ("" if c[2] else f" :: {c[3]}") for c in res["checks"]]
    if res.get("fatal"):
        lines.append(f"FATAL {res['fatal']}")
    lines.append(f"exit {code}")
    (out / "fix1_check.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(lines))
    return code


if __name__ == "__main__":
    sys.exit(main(sys.argv))
