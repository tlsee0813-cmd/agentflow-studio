"""Smoke test of the new studio flow in a real browser (test-only stubbed DeepSeek transport, no real key).

entry -> map (no document scroll) -> part -> ask (summary, question) -> answer with evidence -> back to map;
provider failure shows a short error and a retry (never a substitute answer); a server without a key and the static
build both show the honest not-connected state. Not a visual or usability audit.
"""
import functools, http.server, os, pathlib, re, subprocess, sys, threading
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parents[1]
APP = ROOT.parent


def start(stub):
    env = {**os.environ, "STUDIO_STUB": stub, "PORT": "0"}
    proc = subprocess.Popen(["node", str(ROOT / "tests/studio-smoke-server.mjs")], cwd=APP, env=env, stdout=subprocess.PIPE, text=True)
    line = proc.stdout.readline()
    m = re.search(r"READY (http://\S+)", line)
    if not m:
        proc.kill(); raise RuntimeError(f"server did not start: {line!r}")
    return proc, m.group(1)


def no_page_scroll(page):
    sizes = page.evaluate("[document.documentElement.scrollHeight, document.documentElement.scrollWidth, innerHeight, innerWidth]")
    assert sizes[0] <= sizes[2] and sizes[1] <= sizes[3], f"document scrolls: {sizes}"


def main_flow(browser, base):
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/")
    expect(page.locator(".project-card")).to_have_count(2)
    expect(page.locator("#ai-text")).to_contain_text("AI 정리")
    page.locator(".project-card").first.click()
    expect(page.locator(".node")).to_have_count(7)
    expect(page.locator(".frame")).to_have_count(2)
    no_page_scroll(page)
    expect(page.locator("#recent")).not_to_have_class(re.compile("collapsed"))
    page.locator(".node", has_text="시간 고르기").click()
    expect(page.locator("#panel-title")).to_have_text("시간 고르기")
    expect(page.locator(".panel .summary")).to_contain_text("휴무일")
    expect(page.locator("#recent")).to_have_class(re.compile("collapsed"))  # folds while a part is open
    no_page_scroll(page)
    page.get_by_role("button", name="지금 상황 정리").first.click()
    expect(page.locator(".answer")).to_have_count(1)
    expect(page.locator(".answer .ans-head")).to_contain_text("[스텁 응답] 시간 고르기")
    page.locator(".answer .ref").first.click()
    expect(page.locator(".record details[open]")).to_have_count(1)
    # A draft survives switching parts (example: memory only).
    page.locator("#ask-input").fill("휴무일은 어디서 정해?")
    page.locator(".kid, .panel-path a").first.click()
    expect(page.locator("#panel-title")).to_have_text("예약하기")
    page.go_back()
    expect(page.locator("#panel-title")).to_have_text("시간 고르기")
    expect(page.locator("#ask-input")).to_have_value("휴무일은 어디서 정해?")
    page.locator("#ask-input").press("Enter")
    expect(page.locator(".answer")).to_have_count(2)
    card = page.locator(".answer").nth(1)
    # Question first: the question, then the short direct answer, evidence; the structured rest is one closed fold.
    expect(card.locator(".ans-ask")).to_contain_text("휴무일은 어디서 정해?")
    expect(card.locator(":scope > :nth-child(2)")).to_have_class("ans-text")
    expect(card.locator(".ans-text")).to_contain_text("스텁 답변: 휴무일은 어디서 정해?")
    expect(card.locator(".ans-more")).not_to_have_attribute("open", "")
    assert all(not b.is_visible() for b in card.locator(".ans-block").all())
    page.wait_for_timeout(200)
    top = page.evaluate("""() => { const c = document.querySelectorAll('.answer')[1].getBoundingClientRect(), b = document.querySelector('.panel-body').getBoundingClientRect(); return [c.top, b.top, b.bottom]; }""")
    assert top[1] - 1 <= top[0] < top[2], f"new answer's top is not in view: {top}"
    expect(page.locator("#ask-input")).to_have_value("")
    page.keyboard.press("Escape")
    expect(page.locator("#panel")).to_be_hidden()
    expect(page.locator("#recent")).not_to_have_class(re.compile("collapsed"))  # earlier state back
    # Group head opens the parent part, whose records include its children. 전체 보기 first: panning may have put it under the overlay.
    page.locator("#zoom-fit").click()
    page.wait_for_timeout(300)
    page.locator(".frame-head", has_text="관리자 화면").click()
    expect(page.locator("#panel-title")).to_have_text("관리자 화면")
    expect(page.locator(".panel .kid")).to_have_count(2)
    page.go_back()
    expect(page.locator("#panel")).to_be_hidden()
    page.locator(".brand").click()
    expect(page.locator(".project-card")).to_have_count(2)
    assert not errors, errors
    page.close()


def drag(page, locator, dx, dy):
    box = locator.bounding_box()
    x, y = box["x"] + box["width"] / 2, box["y"] + box["height"] / 2
    page.mouse.move(x, y); page.mouse.down(); page.mouse.move(x + dx, y + dy, steps=8); page.mouse.up()
    page.wait_for_timeout(150)


def map_flow(browser, base):
    """Drag, wheel zoom, going inside and back with the view kept; example places are not saved."""
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(base + "/")
    page.locator(".project-card").first.click()
    customer, notify = page.locator(".node", has_text="손님 정보"), page.locator(".node", has_text="문자 알림")
    gap = notify.bounding_box()["y"] - customer.bounding_box()["y"]
    drag(page, customer, 0, 160)
    expect(page.locator("#panel")).to_be_hidden()  # a drag is not a click
    moved = notify.bounding_box()["y"] - customer.bounding_box()["y"]
    assert abs((gap - moved) - 160) < 4, (gap, moved)
    # A group moves with its children.
    kid = page.locator(".node", has_text="예약 목록")
    before = kid.bounding_box()["x"]
    drag(page, page.locator(".frame-head", has_text="관리자 화면").locator(".frame-name"), -80, 0)
    assert abs(kid.bounding_box()["x"] - (before - 80)) < 4
    # Plain wheel zooms at the cursor.
    vp = page.locator("#viewport").bounding_box()
    page.mouse.move(vp["x"] + vp["width"] - 120, vp["y"] + vp["height"] - 120)
    page.mouse.wheel(0, -240)
    expect(page.locator("#zoom-level")).not_to_have_text("100%")
    zoom = page.locator("#zoom-level").inner_text()
    # Inside and back: scope bar and path say where; the parent view comes back as it was.
    page.locator(".frame-head", has_text="예약하기").locator(".enter").click()
    expect(page.locator("#scope-bar")).to_contain_text("예약하기 안")
    expect(page.locator("#crumbs")).to_contain_text("예약하기")
    expect(page.locator(".node")).to_have_count(3)
    expect(page.locator(".ghost").first).to_be_visible()
    page.locator(".node", has_text="시간 고르기").click()
    expect(page.locator("#panel-title")).to_have_text("시간 고르기")
    page.keyboard.press("Escape")
    expect(page.locator("#panel")).to_be_hidden()
    page.keyboard.press("Escape")  # nothing selected: Esc goes up one level
    expect(page.locator("#scope-bar")).to_be_hidden()
    expect(page.locator("#zoom-level")).to_have_text(zoom)
    # Double-click also goes inside; the panel offers it too.
    page.locator(".frame-head", has_text="관리자 화면").locator(".frame-name").dblclick()
    expect(page.locator("#scope-bar")).to_contain_text("관리자 화면 안")
    page.locator("#scope-bar .scope-up").click()
    expect(page.locator("#scope-bar")).to_be_hidden()
    page.locator(".frame-head", has_text="관리자 화면").locator(".frame-name").click()
    expect(page.locator(".panel .go-in")).to_be_visible()
    # Fold in place keeps the scope.
    page.keyboard.press("Escape")
    page.locator(".frame-head", has_text="예약하기").locator(".toggle").click()
    expect(page.locator(".node", has_text="예약하기")).to_be_visible()
    expect(page.locator(".node", has_text="시간 고르기")).to_have_count(0)
    # Example places live in memory only: a reload brings the automatic arrangement back.
    page.reload()
    customer, notify = page.locator(".node", has_text="손님 정보"), page.locator(".node", has_text="문자 알림")
    assert abs((notify.bounding_box()["y"] - customer.bounding_box()["y"]) - gap) < 4
    page.close()


def new_project_flow(browser, base):
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/")
    page.locator("#new-name").fill("테스트 프로젝트")
    page.get_by_role("button", name="내 프로젝트 시작").click()
    expect(page.locator("#crumbs")).to_contain_text("테스트 프로젝트")
    expect(page.locator("#part-form")).to_contain_text("첫 부분 만들기")
    page.locator("#part-name").fill("로그인")
    page.get_by_role("button", name="만들기").click()
    expect(page.locator(".node")).to_have_count(1)
    expect(page.locator("#panel-title")).to_have_text("로그인")
    page.get_by_role("button", name="안에 부분 추가").click()
    page.locator("#part-name").fill("비밀번호 찾기")
    page.get_by_role("button", name="만들기").click()
    expect(page.locator(".frame")).to_have_count(1)
    expect(page.locator("#panel-title")).to_have_text("비밀번호 찾기")
    # A saved project's draft survives a reload.
    page.locator("#ask-input").fill("어디까지 됐어?")
    page.reload()
    expect(page.locator("#panel-title")).to_have_text("비밀번호 찾기")
    expect(page.locator("#ask-input")).to_have_value("어디까지 됐어?")
    # Third level, then down and back up through it.
    page.get_by_role("button", name="안에 부분 추가").click()
    page.locator("#part-name").fill("메일 발송")
    page.get_by_role("button", name="만들기").click()
    expect(page.locator("#panel-title")).to_have_text("메일 발송")
    page.keyboard.press("Escape")
    page.locator(".frame-head", has_text="로그인").locator(".enter").click()
    expect(page.locator("#scope-bar")).to_contain_text("로그인")
    page.locator(".frame-head", has_text="비밀번호 찾기").locator(".enter").click()
    expect(page.locator("#crumbs")).to_contain_text("테스트 프로젝트/로그인/비밀번호 찾기")
    expect(page.locator("#scope-bar .scope-up")).to_contain_text("로그인")
    expect(page.locator(".node")).to_have_count(1)
    page.locator("#scope-bar .scope-up").click()
    expect(page.locator("#scope-bar")).to_contain_text("로그인 안")
    page.locator("#crumbs a", has_text="테스트 프로젝트").click()
    expect(page.locator("#scope-bar")).to_be_hidden()
    # A second top part; its dragged place in a saved project survives a reload.
    page.locator("#add-part").click()
    page.locator("#part-name").fill("결제")
    page.get_by_role("button", name="만들기").click()
    expect(page.locator("#panel-title")).to_have_text("결제")
    page.keyboard.press("Escape")
    expect(page.locator("#panel")).to_be_hidden()
    pay, login = page.locator(".node", has_text="결제"), page.locator(".frame", has_text="로그인").first
    gap = pay.bounding_box()["y"] - login.bounding_box()["y"]
    drag(page, pay, 0, 200)
    moved = pay.bounding_box()["y"] - login.bounding_box()["y"]
    assert abs(moved - gap - 200) < 4, (gap, moved)
    page.reload()
    pay, login = page.locator(".node", has_text="결제"), page.locator(".frame", has_text="로그인").first
    expect(pay).to_be_visible()
    assert abs((pay.bounding_box()["y"] - login.bounding_box()["y"]) - moved) < 4
    # The automatic arrangement only on request, with one undo.
    page.locator("#arrange").click()
    page.wait_for_timeout(350)
    assert abs((pay.bounding_box()["y"] - login.bounding_box()["y"]) - moved) > 50
    page.locator("#toast").get_by_role("button", name="되돌리기").click()
    page.wait_for_timeout(200)
    assert abs((pay.bounding_box()["y"] - login.bounding_box()["y"]) - moved) < 4
    page.locator(".brand").click()
    expect(page.locator("#saved-list .project-card")).to_have_count(1)
    expect(page.locator(".project-card", has_text="예제")).to_have_count(2)  # examples are never saved as mine
    context.close()


def failure_flow(browser, base):
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(base + "/")
    page.locator(".project-card").first.click()
    page.locator(".node", has_text="문자 알림").click()
    page.get_by_role("button", name="다음에 판단할 것").click()
    expect(page.locator(".failed")).to_contain_text("AI 서비스가 응답하지 않아요")
    expect(page.locator(".answer")).to_have_count(0)
    page.get_by_role("button", name="다시 시도").click()
    expect(page.locator(".answer")).to_have_count(1)
    expect(page.locator(".failed")).to_have_count(0)
    page.close()


def off_flow(browser, base, expected_pill):
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(base)
    expect(page.locator("#ai-text")).to_have_text(expected_pill)
    page.locator(".project-card").first.click()
    page.locator(".node", has_text="시간 고르기").click()
    expect(page.locator(".composer .ai-off")).to_be_visible()
    expect(page.locator("#ask-input")).to_have_count(0)
    no_page_scroll(page)
    page.close()


def serve_static():
    class Handler(http.server.SimpleHTTPRequestHandler):
        # Windows can map .js to text/plain from the registry, which blocks module scripts.
        extensions_map = {**http.server.SimpleHTTPRequestHandler.extensions_map, ".js": "text/javascript", ".css": "text/css", ".html": "text/html"}
        def log_message(self, *a): pass
    handler = functools.partial(Handler, directory=str(ROOT / "static-dist"))
    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server


def main():
    procs = []
    try:
        with sync_playwright() as p:
            exe = os.environ.get("STUDIO_CHROMIUM")
            browser = p.chromium.launch(**({"executable_path": exe} if exe else {}))
            proc, base = start("ok"); procs.append(proc); main_flow(browser, base); print("ok  entry -> map -> part -> ask -> evidence -> map")
            map_flow(browser, base); print("ok  drag (node, group), wheel zoom, inside/back with view kept, fold, example places not saved")
            new_project_flow(browser, base); print("ok  new project -> three levels -> path and back -> saved place and draft kept on reload")
            proc, base = start("fail"); procs.append(proc); failure_flow(browser, base); print("ok  provider failure -> short error -> retry")
            proc, base = start("nokey"); procs.append(proc); off_flow(browser, base + "/", "AI 키 없음"); print("ok  server without key -> honest off state")
            if (ROOT / "static-dist/index.html").exists():
                server = serve_static()
                off_flow(browser, f"http://127.0.0.1:{server.server_address[1]}/", "AI 서버 미연결"); server.shutdown(); print("ok  static build -> not connected state")
            browser.close()
    finally:
        for proc in procs: proc.kill()


if __name__ == "__main__":
    main()
