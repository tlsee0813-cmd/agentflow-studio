"""Smoke test of the new studio flow in a real browser (test-only stubbed DeepSeek transport, no real key).

entry -> map (no document scroll) -> part -> ask (summary, question) -> answer with evidence -> back to map;
provider failure shows a short error and a retry (never a substitute answer); a server without a key and the static
build both show the honest not-connected state. Not a visual or usability audit.
"""
import functools, http.server, os, pathlib, re, subprocess, sys, tempfile, threading
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


def in_scope(page, name):
    """The context row names the scope as the current step of the composition path and offers the way up."""
    expect(page.locator("#crumbs [aria-current]")).to_have_text(name)
    expect(page.locator("#scope-bar .scope-up")).to_be_visible()


def add_inside(page):
    """Structure edits sit in the quiet menu of the lens (or of the reading sheet when it is open)."""
    page.locator(".more summary:visible").click()
    page.get_by_role("menuitem", name="안에 부분 추가").click()


def sheet(page, name):
    """Sources, records, questions and edits read in the sheet that replaces the lens."""
    page.locator("#lens .lens-more").click()
    expect(page.locator("#panel-title")).to_have_text(name)
    expect(page.locator("#lens")).to_be_hidden()


def clear_of(page, a, b):
    ra, rb = page.locator(a).bounding_box(), page.locator(b).bounding_box()
    assert ra["x"] + ra["width"] <= rb["x"] + 1 or rb["x"] + rb["width"] <= ra["x"] + 1 or ra["y"] + ra["height"] <= rb["y"] + 1 or rb["y"] + rb["height"] <= ra["y"] + 1, (a, ra, b, rb)


def main_flow(browser, base):
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/")
    expect(page.locator("#project-list .program")).to_have_count(3)
    expect(page.locator("#ai-text")).to_contain_text("AI 정리")
    page.locator('.program-head[href="#/p/ex-salon"]').click()
    expect(page.locator(".node")).to_have_count(7)
    expect(page.locator(".frame")).to_have_count(2)
    no_page_scroll(page)
    # Recent records open only when asked for, as a popover over the map tools (no reserved map room).
    expect(page.locator("#recent")).to_have_class(re.compile("collapsed"))
    page.locator("#recent-toggle").click()
    expect(page.locator("#recent")).not_to_have_class(re.compile("collapsed"))
    page.locator(".node", has_text="시간 고르기").click()
    # The selection reads in a lens beside the part, never over it.
    expect(page.locator("#lens-title")).to_have_text("시간 고르기")
    expect(page.locator("#lens .lens-text")).to_contain_text("휴무일")
    expect(page.locator("#panel")).to_be_hidden()
    page.wait_for_timeout(300)
    clear_of(page, "#lens", ".node.selected")
    expect(page.locator("#recent")).to_have_class(re.compile("collapsed"))  # folds while a part is open
    no_page_scroll(page)
    sheet(page, "시간 고르기")
    # Reading first: the question entry is one small row until it is opened.
    assert page.locator(".composer").bounding_box()["height"] < 64, page.locator(".composer").bounding_box()
    page.get_by_role("button", name="지금 상황 정리").first.click()
    expect(page.locator(".answer")).to_have_count(1)
    expect(page.locator(".answer .ans-head")).to_contain_text("[스텁 응답] 시간 고르기")
    page.locator(".answer .ref").first.click()
    expect(page.locator(".record details[open]")).to_have_count(1)
    # A draft survives switching parts (example: memory only).
    page.locator(".ask-open").click()
    page.locator("#ask-input").fill("휴무일은 어디서 정해?")
    page.locator(".kid, .panel-path a").first.click()
    expect(page.locator("#lens-title")).to_have_text("예약하기")
    page.go_back()
    expect(page.locator("#lens-title")).to_have_text("시간 고르기")
    sheet(page, "시간 고르기")
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
    page.keyboard.press("Escape")  # the sheet gives way to the same lens
    expect(page.locator("#panel")).to_be_hidden()
    expect(page.locator("#lens-title")).to_have_text("시간 고르기")
    page.keyboard.press("Escape")
    expect(page.locator("#lens")).to_be_hidden()
    expect(page.locator("#recent")).to_have_class(re.compile("collapsed"))  # working on the map closed the popover
    # Group head opens the parent part, whose records include its children. 전체 보기 first: panning may have put it under the overlay.
    page.locator("#zoom-fit").click()
    page.wait_for_timeout(300)
    page.locator(".frame-head", has_text="관리자 화면").click()
    expect(page.locator("#lens-title")).to_have_text("관리자 화면")
    expect(page.locator("#lens .go-in")).to_be_visible()  # its inside is on the map; the way in is explicit
    page.go_back()
    expect(page.locator("#lens")).to_be_hidden()
    page.locator(".brand").click()
    expect(page.locator("#project-list .program")).to_have_count(3)
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
    page.locator('.program-head[href="#/p/ex-salon"]').click()
    customer, notify = page.locator(".node", has_text="손님 정보"), page.locator(".node", has_text="문자 알림")
    gap = notify.bounding_box()["y"] - customer.bounding_box()["y"]
    drag(page, customer, 0, 160)
    expect(page.locator("#lens")).to_be_hidden()  # a drag is not a click
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
    book_head = page.locator(".frame-head", has_text="예약하기")
    place = book_head.bounding_box()
    # Inside and back: scope bar and path say where; the parent view comes back as it was.
    page.locator(".frame-head", has_text="예약하기").locator(".enter").click()
    in_scope(page, "예약하기")
    expect(page.locator(".node")).to_have_count(3)
    expect(page.locator(".ghost").first).to_be_visible()
    page.locator(".node", has_text="시간 고르기").click()
    expect(page.locator("#lens-title")).to_have_text("시간 고르기")
    page.keyboard.press("Escape")
    expect(page.locator("#lens")).to_be_hidden()
    page.keyboard.press("Escape")  # nothing selected: Esc goes up one level
    expect(page.locator("#scope-bar")).to_be_hidden()
    page.wait_for_timeout(500)  # the short move back out settles on the camera left here
    expect(page.locator("#zoom-level")).to_have_text(zoom)
    back = book_head.bounding_box()
    assert abs(back["x"] - place["x"]) < 2 and abs(back["y"] - place["y"]) < 2, (place, back)  # same camera, same place
    # The cursor zoom above pushed 관리자 화면 off the left edge under the recent list; a person would use 전체 보기 first.
    page.locator("#zoom-fit").click()
    page.wait_for_timeout(350)
    # Double-click also goes inside; the panel offers it too.
    page.locator(".frame-head", has_text="관리자 화면").locator(".frame-name").dblclick()
    in_scope(page, "관리자 화면")
    page.locator("#scope-bar .scope-up").click()
    expect(page.locator("#scope-bar")).to_be_hidden()
    page.wait_for_timeout(500)
    page.locator(".frame-head", has_text="관리자 화면").locator(".frame-name").click()
    expect(page.locator("#lens .go-in")).to_be_visible()
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


def basics_flow(browser, base):
    """Studio 45 fixes: stable example links, observation labels, no note text on the map, recent records range,
    temporary unfold for a record, and the access code kept from an input event."""
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(base + "/")
    page.locator('.program-head[href="#/p/ex-salon"]').click()
    # Labels say what was observed, not that work is running; relation notes are not drawn over the map.
    expect(page.locator(".node", has_text="문자 알림")).to_contain_text("요청만 있음")
    expect(page.locator("#space")).not_to_contain_text("진행 중")
    expect(page.locator("#world .edge text")).to_have_count(0)
    # Recent records: newest 7 of all, with the way to all of them.
    page.locator("#recent-toggle").click()
    expect(page.locator("#recent-title")).to_have_text("최근 기록")
    expect(page.locator("#recent-count")).to_have_text("최신 7 / 14")
    page.get_by_role("button", name="전체 14개 보기").click()
    expect(page.locator(".recent-item")).to_have_count(14)
    page.get_by_role("button", name="최신 7개만 보기").click()
    expect(page.locator(".recent-item")).to_have_count(7)
    # A fold the person made comes back after a record was opened for reference.
    page.locator(".frame-head", has_text="예약하기").locator(".toggle").click()
    expect(page.locator(".node", has_text="시간 고르기")).to_have_count(0)
    page.locator("#recent-toggle").click()  # folding on the map closed the popover; open it again
    page.locator(".recent-item", has_text="시간 고르기").first.click()
    expect(page.locator("#panel-title")).to_have_text("시간 고르기")  # a record opens in the reading sheet
    expect(page.locator(".node", has_text="시간 고르기")).to_be_visible()
    expect(page.locator(".record details[open]")).to_have_count(1)
    page.keyboard.press("Escape")
    expect(page.locator("#panel")).to_be_hidden()
    expect(page.locator("#lens-title")).to_have_text("시간 고르기")
    page.keyboard.press("Escape")
    expect(page.locator("#lens")).to_be_hidden()
    expect(page.locator(".node", has_text="시간 고르기")).to_have_count(0)
    expect(page.locator(".node", has_text="예약하기")).to_be_visible()
    page.locator(".node", has_text="예약하기").locator(".toggle").click()
    # Panel: observation wording, the relation note in 연결, the line highlighted on the map.
    page.locator(".node", has_text="문자 알림").click()
    expect(page.locator("#lens .lens-src")).to_contain_text("요청 있음 · 보고 없음")
    expect(page.locator("#lens .lens-ports")).to_contain_text("예약이 확정되면 문자를 보낸다")
    expect(page.locator("#world .edge.on")).to_have_count(1)
    sheet(page, "문자 알림")
    expect(page.locator(".panel .summary")).to_contain_text("요청 기록은 있고")
    expect(page.locator(".panel .links")).to_contain_text("예약이 확정되면 문자를 보낸다")
    page.keyboard.press("Escape")
    # An example link (scope + part) opens the same part after a reload and in a new browser, although ids are rebuilt.
    page.keyboard.press("Escape")
    page.locator(".frame-head", has_text="예약하기").locator(".enter").click()
    page.locator(".node", has_text="시간 고르기").click()
    expect(page.locator("#lens-title")).to_have_text("시간 고르기")
    assert re.search(r"#/p/ex-salon/in/book/slots$", page.url), page.url
    link = page.url
    page.reload()
    expect(page.locator("#lens-title")).to_have_text("시간 고르기")
    in_scope(page, "예약하기")
    other = browser.new_context(viewport={"width": 1440, "height": 900})
    fresh = other.new_page()
    fresh.goto(link)
    expect(fresh.locator("#lens-title")).to_have_text("시간 고르기")
    in_scope(fresh, "예약하기")
    other.close()
    page.close()


def code_flow(browser, base):
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(base + "/")
    page.locator('.program-head[href="#/p/ex-salon"]').click()
    page.locator(".node", has_text="시간 고르기").click()
    sheet(page, "시간 고르기")
    page.get_by_role("button", name="지금 상황 정리").click()  # no code yet: opens the box at the code field
    expect(page.locator("#access-code")).to_be_focused()
    page.locator("#access-code").fill("smoke-code")  # input events only (as with paste or autofill), no change event
    page.get_by_role("button", name="지금 상황 정리").click()
    expect(page.locator(".answer")).to_have_count(1)
    page.close()


def new_project_flow(browser, base):
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/")
    page.locator("#new-open").click()  # the name form opens on request
    page.locator("#new-name").fill("테스트 프로젝트")
    page.locator("#new-form").get_by_role("button", name="만들기").click()
    expect(page.locator("#crumbs")).to_contain_text("테스트 프로젝트")
    expect(page.locator("#part-form")).to_contain_text("첫 부분 만들기")
    page.locator("#part-name").fill("로그인")
    page.get_by_role("button", name="만들기").click()
    expect(page.locator(".node")).to_have_count(1)
    expect(page.locator("#lens-title")).to_have_text("로그인")
    add_inside(page)
    page.locator("#part-name").fill("비밀번호 찾기")
    page.locator("#part-form").get_by_role("button", name="만들기").click()
    expect(page.locator(".frame")).to_have_count(1)
    expect(page.locator("#lens-title")).to_have_text("비밀번호 찾기")
    # A saved project's draft survives a reload.
    sheet(page, "비밀번호 찾기")
    page.locator(".ask-open").click()
    page.locator("#ask-input").fill("어디까지 됐어?")
    page.reload()
    expect(page.locator("#lens-title")).to_have_text("비밀번호 찾기")
    sheet(page, "비밀번호 찾기")
    expect(page.locator("#ask-input")).to_have_value("어디까지 됐어?")
    # Third level, then down and back up through it.
    add_inside(page)
    page.locator("#part-name").fill("메일 발송")
    page.locator("#part-form").get_by_role("button", name="만들기").click()
    expect(page.locator("#lens-title")).to_have_text("메일 발송")
    page.keyboard.press("Escape")
    page.locator(".frame-head", has_text="로그인").locator(".enter").click()
    in_scope(page, "로그인")
    page.locator(".frame-head", has_text="비밀번호 찾기").locator(".enter").click()
    expect(page.locator("#crumbs")).to_contain_text("테스트 프로젝트›로그인›비밀번호 찾기")
    expect(page.locator("#scope-bar .scope-up")).to_contain_text("로그인")
    expect(page.locator("#scene-back")).to_be_hidden()  # the previous scene is the parent: the way up is enough
    expect(page.locator(".node")).to_have_count(1)
    page.locator("#scope-bar .scope-up").click()
    in_scope(page, "로그인")
    page.locator("#crumbs a", has_text="테스트 프로젝트").click()
    expect(page.locator("#scope-bar")).to_be_hidden()
    # A second top part; its dragged place in a saved project survives a reload.
    page.locator("#add-part").click()
    page.locator("#part-name").fill("결제")
    page.locator("#part-form").get_by_role("button", name="만들기").click()
    expect(page.locator("#lens-title")).to_have_text("결제")
    page.keyboard.press("Escape")
    expect(page.locator("#lens")).to_be_hidden()
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
    expect(page.locator("#saved-list .program")).to_have_count(1)
    expect(page.locator("#project-list .program.is-example")).to_have_count(3)  # examples are never saved as mine
    # The program reads by its real top parts, and offers to continue where this browser last was.
    expect(page.locator("#saved-list .program-section li")).to_have_count(2)
    expect(page.locator("#saved-list .program-continue")).to_have_count(0)  # left at the whole map with nothing selected
    expect(page.locator("#saved-list .is-example")).to_have_count(0)
    # My projects lead; the examples step back once there is one.
    assert page.locator("#saved-list").bounding_box()["y"] < page.locator("#project-list").bounding_box()["y"]
    context.close()


def oss_fixtures():
    """Backup files of the pinned OSS cases (docs/cycles/2026-10-26-visual-experience-58), made by the shared generator."""
    out = pathlib.Path(tempfile.mkdtemp(prefix="visual58-")) / "cases"
    subprocess.run(["node", str(ROOT / "tests/visual58-fixtures.mjs"), "--out", str(out)], cwd=APP, check=True, stdout=subprocess.DEVNULL)
    return out


def workspace_flow(browser, base, cases):
    """UI58 workspace: one inspector width, no zoom on opening or closing the plan, the plan's way back, long same-prefix
    names told apart on the map, the previous scene apart from the way up, and no recent entry without records."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/#/p/ex-converter")
    page.locator(".node", has_text="문서 읽기").click()
    zoom, before = page.locator("#zoom-level").inner_text(), page.locator("#world").evaluate("e => e.style.transform")
    page.locator("#plan-entry").click()
    # The plan reads on the map: its strip on top and short notes beside the parts of the change being read; no right panel
    # and no long comparison by default.
    expect(page.locator("#plan-strip")).to_be_visible()
    expect(page.locator("#plan-panel")).to_be_hidden()
    expect(page.locator("#lens")).to_be_hidden()
    expect(page.locator(".callout").first).to_be_visible()
    expect(page.locator("#zoom-level")).to_have_text(zoom)  # opening never re-zooms
    page.wait_for_timeout(400)
    expect(page.locator(".frame")).to_have_count(3)
    expect(page.locator("#world .plan-direct")).not_to_have_count(0)
    expect(page.locator(".plan-badge")).to_have_count(0)
    # Each target's own row reads what is to change under its whole name: the target's wanted text when the plan has one,
    # else the change's name marked as such (no '구상' placeholder, no part description set against it).
    expect(page.locator("#world .node", has_text="문서 읽기").locator(".plan-note")).to_have_text("폴더 안 파일을 입력받기")
    expect(page.locator("#world .node", has_text="본문과 표").locator(".plan-note")).to_have_text("변경 실패해도 나머지 계속")
    expect(page.locator("#world .node", has_text="결과 설명").locator(".plan-note")).to_have_text("실패한 파일과 이유 모아 보기")
    for name in page.locator("#world .plan-direct :is(.node-name, .frame-name)").all():
        assert not name.evaluate("e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1"), name.inner_text()
    # A change with two targets keeps both names and marks, but reads one actual current/wanted pair at a time.
    page.locator(".ps-item").nth(2).click()
    expect(page.locator(".ps-item").nth(2)).to_have_attribute("aria-pressed", "true")
    expect(page.locator(".callout")).to_have_count(1)
    expect(page.locator(".ps-target")).to_have_count(2)
    expect(page.locator(".ps-target-label")).to_have_text("바뀌는 부분 2")
    target_names = page.locator(".ps-target").all_text_contents()
    expect(page.locator(".ps-target").nth(0)).to_have_attribute("aria-selected", "true")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[0])
    # No same-side data for this target: the change, the part's role apart from it, no before/after pair.
    expect(page.locator(".callout .co-row.want p")).to_have_text("성공 유지·실패 모음")
    expect(page.locator(".callout .co-row.now")).to_have_count(0)
    expect(page.locator(".callout .co-role")).to_contain_text("변환 형식과 저장한 산출물을 다룬다.")
    expect(page.locator(".callout .co-gap")).to_have_text("현재와 비교할 내용은 아직 정리되지 않았어요.")
    page.locator(".ps-target").nth(1).click()
    expect(page.locator(".ps-target").nth(1)).to_have_attribute("aria-selected", "true")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[1])
    expect(page.locator(".callout .co-row.now p")).to_contain_text("화면은 마지막 결과만 표시한다.")
    expect(page.locator(".callout .co-role")).to_have_count(0)
    expect(page.locator(".callout .co-row.want p")).to_have_text("실패한 파일과 이유 모아 보기")
    expect(page.locator(".callout .co-row.now").first).to_be_visible()
    expect(page.locator(".callout .co-row.want").first).to_be_visible()
    page.wait_for_timeout(300)
    if "docked" in page.locator(".callout").get_attribute("class"):
        vp, card = page.locator("#viewport").bounding_box(), page.locator(".callout").bounding_box()
        assert vp["y"] + vp["height"] <= card["y"]  # the actual map ends before the reading row
        assert page.locator(".callout").evaluate("e => e.scrollHeight <= e.clientHeight")
    else:
        for j in range(page.locator(".node").count()):
            clear_of(page, ".callout", f".node >> nth={j}")
    # Sources replace this one reading; coming back keeps the actual target and its matching before/after text.
    target_camera = page.locator("#world").evaluate("e => e.style.transform")
    page.locator(".callout .co-src").click()
    expect(page.locator("#lens .cmp-evidence")).to_be_visible()
    expect(page.locator(".callout")).to_have_count(0)
    assert page.locator("#world").evaluate("e => e.style.transform") == target_camera
    page.locator("#cmp-back").click()
    expect(page.locator(".ps-target").nth(1)).to_have_attribute("aria-selected", "true")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[1])
    expect(page.locator(".callout .co-row.want p")).to_have_text("실패한 파일과 이유 모아 보기")
    assert page.locator("#world").evaluate("e => e.style.transform") == target_camera
    # A pan made while reading sources remains the person's camera on return; no saved-camera restore may discard it.
    page.locator(".callout .co-src").click()
    expect(page.locator("#lens .cmp-evidence")).to_be_visible()
    vp = page.locator("#viewport").bounding_box()
    page.mouse.move(vp["x"] + 6, vp["y"] + 24)
    page.mouse.down()
    page.mouse.move(vp["x"] + 24, vp["y"] + 42, steps=4)
    page.mouse.up()
    panned_camera = page.locator("#world").evaluate("e => e.style.transform")
    assert panned_camera != target_camera
    page.locator("#cmp-back").click()
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[1])
    assert page.locator("#world").evaluate("e => e.style.transform") == panned_camera
    # Keyboard navigation names the targets too, and supports a return to the same selected target.
    page.locator(".ps-target").nth(1).focus()
    page.keyboard.press("ArrowLeft")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[0])
    expect(page.locator(".ps-target").nth(0)).to_be_focused()
    page.keyboard.press("ArrowRight")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[1])
    # The long reading on request still pairs only the target currently being read with its own wanted text.
    page.locator(".ps-link", has_text="설명").click()
    expect(page.locator("#lens .cmp-now .cmp-part")).to_have_count(1)
    expect(page.locator("#lens .cmp-now .cmp-text")).to_have_text("화면은 마지막 결과만 표시한다.")
    expect(page.locator("#lens .cmp-want .cmp-text")).to_have_count(1)
    expect(page.locator("#lens .cmp-hand input")).to_be_checked()
    page.wait_for_timeout(400)
    for i in range(page.locator(".plan-focus").count()):  # the parts being compared stay clear of the comparison
        clear_of(page, f".plan-focus >> nth={i}", "#lens")
    # Selecting a different named target while the comparison is open reveals its real map box above that reading surface.
    page.locator(".ps-target").nth(0).click()
    expect(page.locator("#lens .cmp-fallback .cmp-name")).to_have_text(target_names[0])
    expect(page.locator("#lens .cmp-want")).to_have_count(0)
    expect(page.locator("#lens .cmp-fallback")).to_contain_text("이 부분의 역할")
    expect(page.locator("#lens .cmp-fallback .cmp-gap")).to_have_text("현재와 비교할 내용은 아직 정리되지 않았어요.")
    expect(page.locator("#world .plan-reading")).to_be_in_viewport()
    page.wait_for_timeout(400)  # compare stable rectangles after the minimum-pan animation
    clear_of(page, "#world .plan-reading", "#lens")
    page.keyboard.press("Escape")
    expect(page.locator("#lens")).to_be_hidden()
    page.locator("#plan-mode").get_by_role("button", name="현재").click()
    expect(page.locator("#world .plan-direct")).to_have_count(0)
    expect(page.locator("#zoom-level")).to_have_text(zoom)
    page.locator("#plan-mode").get_by_role("button", name="변경 미리보기").click()
    expect(page.locator(".ps-target").nth(0)).to_have_attribute("aria-selected", "true")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[0])
    # The whole plan opens on request. A narrow window: the panel and the request sheet take the whole width; back to 1280.
    page.locator(".ps-more").click()
    expect(page.locator("#plan-panel")).to_be_visible()
    page.set_viewport_size({"width": 700, "height": 700})
    page.wait_for_timeout(200)
    assert page.evaluate("getComputedStyle(document.getElementById('space')).getPropertyValue('--plan-w')").strip() == "700px"
    assert page.locator("#plan-panel").bounding_box()["width"] == 700
    page.get_by_role("button", name="요청문 만들기").click()
    assert page.locator("#plan-sheet").bounding_box()["width"] >= 600
    page.keyboard.press("Escape")
    expect(page.locator("#plan-sheet")).to_be_hidden()
    page.set_viewport_size({"width": 1280, "height": 720})
    page.wait_for_timeout(200)
    page.locator("#plan-panel .close").click()  # back to the map comparison
    expect(page.locator("#plan-panel")).to_be_hidden()
    page.locator(".ps-close").click()
    expect(page.locator("#lens-title")).to_have_text("문서 읽기")  # selection and camera come back
    page.wait_for_timeout(300)
    assert page.locator("#world").evaluate("e => e.style.transform") == before
    # No records: no recent entry and no reserved room.
    expect(page.locator("#recent-toggle")).to_be_hidden()
    # The ⋯ menu closes first on Esc, focus back on its button; the part stays selected.
    page.locator("#lens .more summary").click()
    expect(page.locator(".more-menu")).to_be_visible()
    page.keyboard.press("Escape")
    expect(page.locator(".more-menu")).to_be_hidden()
    expect(page.locator("#lens-title")).to_have_text("문서 읽기")
    expect(page.locator("#lens .more summary")).to_be_focused()
    # Long names sharing a 41-character prefix stay apart by their endings (two lines, nothing cut).
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "long-prefix-restic.json"))
    expect(page.locator("#crumbs")).to_contain_text("long-prefix-restic")
    page.locator(".node", has_text="restic repair").locator(".enter").click()
    in_scope(page, "restic repair")
    names = page.locator(".node .node-name")
    expect(names).to_have_count(3)
    for i in range(3):
        cut = names.nth(i).evaluate("e => e.scrollHeight > e.clientHeight + 1")
        assert not cut, names.nth(i).inner_text()
    assert len({names.nth(i).inner_text() for i in range(3)}) == 3
    # The same in a wide fallback font (as on a Linux runner without the system UI font): long cards widen, nothing is cut.
    wide = context.new_page()
    wide.route("**/styles.css", lambda route: route.fulfill(response=(r := route.fetch()), body=r.text() + '\nbody, button, input { font-family: "DejaVu Sans" !important; }'))
    wide.goto(page.url)
    expect(wide.locator(".node .node-name")).to_have_count(3)
    for i in range(3):
        name = wide.locator(".node .node-name").nth(i)
        assert not name.evaluate("e => e.scrollHeight > e.clientHeight + 1"), name.inner_text()
    wide.close()
    # Arrived from the whole map, not from the parent: a way back to that scene, apart from the way up.
    expect(page.locator("#scene-back")).to_be_visible()
    expect(page.locator("#scope-bar .scope-up")).to_contain_text("restic")
    page.locator("#scene-back").click()
    expect(page.locator("#scope-bar")).to_be_hidden()
    expect(page.locator("#scene-back")).to_be_hidden()
    # A long group name reads in full on two head lines; the group makes room for it.
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-node-red.json"))
    page.locator(".frame-head", has_text="@node-red/nodes").locator(".frame-name").click()
    page.locator("#lens .more summary").click()
    page.get_by_role("menuitem", name="이름·설명 고치기").click()
    page.locator("#edit-name").fill("@node-red/nodes 기본 제공 노드 묶음 · 네트워크·데이터·파일 처리")
    page.get_by_role("button", name="저장").click()
    head = page.locator(".frame-head.tall .frame-name")
    expect(head).to_have_text("@node-red/nodes 기본 제공 노드 묶음 · 네트워크·데이터·파일 처리")
    assert not head.evaluate("e => e.scrollHeight > e.clientHeight + 1")
    context.close()


def preview_context_flow(browser, base):
    """Only an explicit preview focus exposes a target's ancestors; sources and user folds keep their own ownership."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/#/p/ex-converter")
    parents = ["읽어들이기", "내용·모양 보존", "내보내기와 결과"]
    for name in parents:
        page.get_by_role("button", name=name + " 접기", exact=True).click()
    expect(page.locator("#world .frame")).to_have_count(0)
    zoom = page.locator("#zoom-level").inner_text()
    page.locator("#plan-entry").click()
    expect(page.locator("#world .frame")).to_have_count(1)  # only the input path, not the other two groups
    expect(page.locator("#world .plan-reading .node-name")).to_have_text("문서 읽기")
    target = page.locator("#world .plan-reading").get_attribute("data-box")
    expect(page.locator(".callout")).to_have_attribute("data-target", target)
    expect(page.locator(".callout")).to_have_attribute("data-box", target)
    expect(page.locator(".callout-leader")).to_have_count(1)
    assert page.locator(".callout-leader path").get_attribute("marker-end") is None
    expect(page.locator("#zoom-level")).to_have_text(zoom)
    page.locator("#plan-mode").get_by_role("button", name="현재", exact=True).click()
    expect(page.locator("#world .frame")).to_have_count(0)
    page.locator("#plan-mode").get_by_role("button", name="변경 미리보기").click()
    expect(page.locator("#world .plan-reading .node-name")).to_have_text("문서 읽기")
    # A direct user fold wins until another explicit focus, even across evidence renders and viewport changes.
    page.get_by_role("button", name="읽어들이기 접기", exact=True).click()
    expect(page.locator("#world .node-name", has_text="문서 읽기")).to_have_count(0)
    # The folded parent names its inner target; the inner wanted text is not shown as a change of the whole parent.
    expect(page.locator("#world .node", has_text="읽어들이기").locator(".plan-note")).to_have_text("안쪽 ‘문서 읽기’ 변경")
    expect(page.locator("#world .plan-note", has_text="폴더 안 파일을 입력받기")).to_have_count(0)
    camera = page.locator("#world").evaluate("e => e.style.transform")
    page.locator(".ps-focus .ps-link", has_text="근거").click()
    expect(page.locator("#lens .cmp-evidence")).to_be_visible()
    page.locator("#cmp-back").click()
    expect(page.locator("#world .node-name", has_text="문서 읽기")).to_have_count(0)
    assert page.locator("#world").evaluate("e => e.style.transform") == camera
    page.set_viewport_size({"width": 1270, "height": 720})
    expect(page.locator("#world .node-name", has_text="문서 읽기")).to_have_count(0)
    page.set_viewport_size({"width": 1280, "height": 720})
    # Another item releases the input path and exposes only the output target. Target navigation retains its real names.
    page.locator(".ps-item").nth(2).click()
    expect(page.locator("#world .frame")).to_have_count(1)
    expect(page.locator("#world .plan-reading .node-name")).to_have_text("변환한 파일")
    page.locator(".ps-target").nth(1).click()
    expect(page.locator("#world .plan-reading .node-name")).to_have_text("결과 설명")
    expect(page.locator(".callout")).to_have_count(1)
    page.locator(".ps-item").nth(0).click()
    expect(page.locator("#world .plan-reading .node-name")).to_have_text("문서 읽기")
    expect(page.locator("#world .frame")).to_have_count(1)
    # User changes made during preview survive release; there is no whole-fold snapshot restore on close.
    page.get_by_role("button", name="내용·모양 보존 펼치기", exact=True).click()
    page.locator(".ps-close").click()
    expect(page.get_by_role("button", name="읽어들이기 펼치기", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name="내용·모양 보존 접기", exact=True)).to_be_visible()
    expect(page.get_by_role("button", name="내보내기와 결과 펼치기", exact=True)).to_be_visible()
    expect(page.locator("#zoom-level")).to_have_text(zoom)
    context.close()


def failure_flow(browser, base):
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(base + "/")
    page.locator('.program-head[href="#/p/ex-salon"]').click()
    page.locator(".node", has_text="문자 알림").click()
    sheet(page, "문자 알림")
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
    page.locator('.program-head[href="#/p/ex-salon"]').click()
    page.locator(".node", has_text="시간 고르기").click()
    sheet(page, "시간 고르기")
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
            proc, base = start("ok"); procs.append(proc); main_flow(browser, base); print("ok  entry -> map -> part lens -> sheet -> ask -> evidence -> lens -> map")
            basics_flow(browser, base); print("ok  stable example link (reload, new browser), labels, no map note text, recent range, fold restored")
            map_flow(browser, base); print("ok  drag (node, group), wheel zoom, inside/back with view kept, fold, example places not saved")
            new_project_flow(browser, base); print("ok  new project -> three levels -> path and back -> saved place and draft kept on reload")
            workspace_flow(browser, base, oss_fixtures()); print("ok  plan strip and docked comparison, open/close without zoom, long same-prefix names, way back apart from way up")
            preview_context_flow(browser, base); print("ok  preview exposes only its target path; current, sources and user folds preserve ownership")
            proc, base = start("code"); procs.append(proc); code_flow(browser, base); print("ok  access code kept from an input event")
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
