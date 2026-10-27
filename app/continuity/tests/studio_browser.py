"""Smoke test of the new studio flow in a real browser (test-only stubbed DeepSeek transport, no real key).

entry -> map (no document scroll) -> part -> ask (summary, question) -> answer with evidence -> back to map;
provider failure shows a short error and a retry (never a substitute answer); a server without a key and the static
build both show the honest not-connected state. Not a visual or usability audit.
"""
import functools, http.server, json, os, pathlib, re, subprocess, sys, tempfile, threading
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


BOXES = "() => [...document.querySelectorAll('#world [data-box]')].map(e => e.dataset.box + ':' + e.style.cssText).sort().join('|')"
CAMERA = "e => e.style.transform"


def in_map(page, sel):
    """Wholly inside the map's own viewport: not under the reading pane, the plan's strip or past an edge."""
    vp, r = page.locator("#viewport").bounding_box(), page.locator(sel).bounding_box()
    assert vp["x"] - 1 <= r["x"] and r["x"] + r["width"] <= vp["x"] + vp["width"] + 1 and vp["y"] - 1 <= r["y"] and r["y"] + r["height"] <= vp["y"] + vp["height"] + 1, (sel, r, vp)


def pane_beside_map(page):
    """The reading pane is a column of its own: the map's viewport ends where it begins."""
    page.wait_for_timeout(250)  # after its short slide in
    vp, pane = page.locator("#viewport").bounding_box(), page.locator("#lens").bounding_box()
    assert abs(vp["x"] + vp["width"] - pane["x"]) <= 1 and pane["x"] + pane["width"] >= page.viewport_size["width"] - 1, (vp, pane)


# Each list item or row is as tall as the lines it really draws: its name's rendered lines plus its own second lines (a state,
# an owner, an ambiguous name's clause), with the layout's paddings (items 14 + 17 per line, rows 20 + 18 per line). A name that
# draws one line must not keep an empty second one; a name the font really wraps is entitled to two. Nothing is cut.
ROWS_DRAWN = """() => [...document.querySelectorAll('#world .node.item, #world .node.row')].map(e => {
  const n = e.querySelector('.node-name'), r = document.createRange(); r.selectNodeContents(n);
  const lines = new Set([...r.getClientRects()].map(q => Math.round(q.top))).size, more = e.querySelectorAll('.node-meta').length;
  const want = e.classList.contains('item') ? 14 + (lines + more) * 17 : 20 + (lines + more) * 18;
  return { name: n.innerText, h: e.offsetHeight, lines, want, cut: n.scrollHeight > n.clientHeight + 1 || n.scrollWidth > n.clientWidth + 1 };
}).filter(x => x.cut || Math.abs(x.h - x.want) > 1)"""


def rows_as_drawn(page):
    bad = page.evaluate(ROWS_DRAWN)
    assert not bad, bad


def wide_font(page):
    """The page in a wide fallback font (as on a Linux runner without the system UI font)."""
    page.route("**/styles.css", lambda route: route.fulfill(response=(r := route.fetch()), body=r.text() + '\nbody, button, input { font-family: "DejaVu Sans" !important; }'))


def clear_of(page, a, b):
    ra, rb = page.locator(a).bounding_box(), page.locator(b).bounding_box()
    assert ra["x"] + ra["width"] <= rb["x"] + 1 or rb["x"] + rb["width"] <= ra["x"] + 1 or ra["y"] + ra["height"] <= rb["y"] + 1 or rb["y"] + rb["height"] <= ra["y"] + 1, (a, ra, b, rb)


def main_flow(browser, base):
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/")
    expect(page.locator("#project-list .program")).to_have_count(4)
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
    expect(page.locator("#project-list .program")).to_have_count(4)
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
    expect(page.locator("#project-list .program.is-example")).to_have_count(4)  # examples are never saved as mine
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
    # The plan reads on the map and in the pane: its strip on top, the change's marks on the parts, and the short reading of
    # the change in the pane beside the map; no whole-plan panel and no long comparison by default.
    expect(page.locator("#plan-strip")).to_be_visible()
    expect(page.locator("#plan-panel")).to_be_hidden()
    expect(page.locator("#lens .callout")).to_be_visible()
    pane_beside_map(page)
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
    expect(page.locator(".callout .co-gap")).to_have_text("현재와의 비교는 아직 정리 전이에요.")
    page.locator(".ps-target").nth(1).click()
    expect(page.locator(".ps-target").nth(1)).to_have_attribute("aria-selected", "true")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[1])
    expect(page.locator(".callout .co-row.now p")).to_contain_text("화면은 마지막 결과만 표시한다.")
    expect(page.locator(".callout .co-role")).to_have_count(0)
    expect(page.locator(".callout .co-row.want p")).to_have_text("실패한 파일과 이유 모아 보기")
    expect(page.locator(".callout .co-row.now").first).to_be_visible()
    expect(page.locator(".callout .co-row.want").first).to_be_visible()
    page.wait_for_timeout(300)
    in_map(page, "#world .plan-reading")  # the target being read is brought beside the pane, not under it
    pane_beside_map(page)
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
    in_map(page, "#world .plan-reading")  # the part being compared stays in the map beside the comparison
    # Selecting a different named target while the comparison is open reveals its real map box above that reading surface.
    page.locator(".ps-target").nth(0).click()
    expect(page.locator("#lens .cmp-fallback .cmp-name")).to_have_text(target_names[0])
    expect(page.locator("#lens .cmp-want")).to_have_count(0)
    expect(page.locator("#lens .cmp-fallback")).to_contain_text("이 부분의 역할")
    expect(page.locator("#lens .cmp-fallback .cmp-gap")).to_have_text("현재와의 비교는 아직 정리 전이에요.")
    expect(page.locator("#world .plan-reading")).to_be_in_viewport()
    page.wait_for_timeout(400)  # compare stable rectangles after the minimum-pan animation
    in_map(page, "#world .plan-reading")
    page.keyboard.press("Escape")  # the long reading gives way to the short one, in the same pane
    expect(page.locator("#lens .callout")).to_be_visible()
    scene, camera = page.evaluate(BOXES), page.locator("#world").evaluate(CAMERA)
    page.locator("#plan-mode").get_by_role("button", name="현재").click()
    expect(page.locator("#world .plan-direct")).to_have_count(0)
    expect(page.locator("#zoom-level")).to_have_text(zoom)
    # The mode shows or hides the change marks only: the same boxes and camera in both (the plan's comparison scene).
    assert page.evaluate(BOXES) == scene and page.locator("#world").evaluate(CAMERA) == camera
    page.locator("#plan-mode").get_by_role("button", name="변경 미리보기").click()
    expect(page.locator(".ps-target").nth(0)).to_have_attribute("aria-selected", "true")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[0])
    # Opening the long reading of a change whose target sits low (1280×720): one smallest pan keeps that target readable above
    # it; its sources and the way back keep that camera and still leave the target uncovered.
    page.locator(".ps-item", has_text="실패해도 나머지 계속").click()
    target = page.locator("#world .plan-reading").get_attribute("data-box")
    page.locator(".ps-link", has_text="설명").click()
    expect(page.locator("#lens .cmp-fallback")).to_be_visible()
    page.wait_for_timeout(400)  # compare stable rectangles after the minimum-pan animation
    in_map(page, f'#world [data-box="{target}"]')
    explained = page.locator("#world").evaluate(CAMERA)
    page.locator("#lens .lens-more", has_text="근거").click()
    expect(page.locator("#lens .cmp-evidence")).to_be_visible()
    in_map(page, f'#world [data-box="{target}"]')
    page.locator("#cmp-back").click()
    expect(page.locator("#lens .cmp-fallback")).to_be_visible()
    in_map(page, f'#world [data-box="{target}"]')
    assert page.locator("#world").evaluate(CAMERA) == explained
    page.keyboard.press("Escape")
    expect(page.locator("#lens .callout")).to_be_visible()
    page.keyboard.press("Escape")  # no change being read: the pane closes and the map takes the window
    expect(page.locator("#lens")).to_be_hidden()
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
    expect(page.locator("#lens .callout")).to_have_attribute("data-target", target)
    expect(page.locator("#lens .callout")).to_have_attribute("data-box", target)
    expect(page.locator(".callout-leader")).to_have_count(0)  # read in the pane: no leader drawn over the map
    expect(page.locator("#zoom-level")).to_have_text(zoom)
    scene, camera = page.evaluate(BOXES), page.locator("#world").evaluate(CAMERA)
    page.locator("#plan-mode").get_by_role("button", name="현재", exact=True).click()
    # The current view of an open plan keeps the comparison's target path; the folds come back only on closing.
    expect(page.locator("#world .frame")).to_have_count(1)
    expect(page.locator("#world .plan-direct")).to_have_count(0)
    assert page.evaluate(BOXES) == scene and page.locator("#world").evaluate(CAMERA) == camera
    page.locator("#plan-mode").get_by_role("button", name="변경 미리보기").click()
    assert page.evaluate(BOXES) == scene and page.locator("#world").evaluate(CAMERA) == camera
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


def relation_context_flow(browser, base, cases):
    """Node-RED real-model plan: existing relations between the actual target and its candidate read above the groups in both
    modes; the candidate's other existing users keep their lines without a label or a reserved line; one scene for both modes."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-node-red.json"))
    # The baseline is the imported project's own map: its name in the path and its parts drawn, not the page before import.
    expect(page.locator("#crumbs")).to_contain_text("Node-RED 이벤트·네트워크·데이터 처리")
    expect(page.locator("#world .frame-head", has_text="@node-red/nodes")).to_be_visible()
    expect(page.locator("#world .node", has_text="network")).to_be_visible()
    before = page.evaluate(BOXES)
    page.locator("#plan-entry").click()
    page.locator("#plan-import-file").set_input_files(str(ROOT.parents[1] / "docs/cycles/2026-10-26-visual-experience-59/node-red-real-plan.json"))
    expect(page.locator("#world .plan-reading .node-name")).to_have_text("10-mqtt.js")
    ctx = page.locator("#world .edges-top .edge.ctx")
    expect(ctx).to_have_count(3)
    keys = ctx.evaluate_all("es => es.map(e => e.dataset.key)")
    assert any("10-mqtt" in k and "05-tls" in k for k in keys), keys
    assert all("05-tls" in k for k in keys), keys  # lines of the named candidate only; no line is drawn or inferred
    expect(page.locator("#world .node", has_text="05-tls.js").locator(".plan-note")).to_have_text("영향 후보")
    for name in ["21-httprequest.js", "22-websocket.js"]:
        row = page.locator("#world .node", has_text=name)
        expect(row.locator(".plan-note")).to_have_text("")
        assert row.evaluate("e => e.offsetHeight") == 38, name  # no empty line kept for a label it does not show
    scene, camera = page.evaluate(BOXES), page.locator("#world").evaluate(CAMERA)
    page.locator("#plan-mode").get_by_role("button", name="현재", exact=True).click()
    # Existing relations, not change lines: they read in the current view too; only the change marks go.
    expect(ctx).to_have_count(3)
    expect(page.locator("#world .plan-impact")).to_have_count(0)
    assert page.evaluate(BOXES) == scene and page.locator("#world").evaluate(CAMERA) == camera
    page.locator("#plan-mode").get_by_role("button", name="변경 미리보기").click()
    expect(ctx).to_have_count(3)
    assert page.evaluate(BOXES) == scene and page.locator("#world").evaluate(CAMERA) == camera
    page.locator(".ps-close").click()
    expect(page.locator("#world .edge.ctx")).to_have_count(0)
    assert page.evaluate(BOXES) == before
    context.close()


def overview_flow(browser, base, cases):
    """UI62: a large source list opens as an overview of its real groups (names, counts, outside lines), every part stays
    reachable by name with a way back; a scope's own relations read as the scope's; the selection reads in the pane beside the
    map with its relations by verb; unlinked parts of a scope sit in balanced columns."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-vscode.json"))
    expect(page.locator("#crumbs")).to_contain_text("VS Code")
    for name in ["문서와 편집기", "확장 실행과 연결", "공통과 기타", "대화와 AI", "공개 API 계약"]:
        expect(page.locator("#world [data-part]", has_text=name).first).to_be_in_viewport()
    common = page.locator("#world .node.has-kids", has_text="공통과 기타")
    expect(common.locator(".enter")).to_contain_text("43")  # folded at first, with its count and its way in
    expect(page.locator("#world .node.item")).to_have_count(0)  # no catalogue spread over the overview
    assert page.locator("#world [data-part]").count() < 40
    # The first view is decided by its room too: every group's name and count reads in the map at the opening scale.
    tops = page.evaluate("[...document.querySelectorAll('#world > .node.unit, #world > .frame.region')].map(e => e.dataset.box)")
    assert len(tops) == 9, tops
    for box in tops:
        in_map(page, f'#world [data-box="{box}"]')
    # A folded group reads by its name and count; its note is the selection's.
    expect(page.locator("#world .node.unit.has-kids .node-note")).to_have_count(0)
    page.locator("#world .node.unit.has-kids", has_text="대화와 AI").click()
    expect(page.locator("#lens .lens-text")).to_contain_text("검토자 분류")
    expect(page.locator("#lens .lens-src")).to_have_count(0)  # no repeated "no records" line in the default reading
    page.keyboard.press("Escape")
    # Two real parts named Types under one parent: told apart by their own first clause, never merged.
    page.locator("#find-toggle").click()
    page.locator("#find-input").fill("Types")
    found = page.locator(".find-item", has_text=re.compile(r"^Types"))
    expect(found).to_have_count(2)
    texts = found.all_inner_texts()
    assert texts[0] != texts[1] and any("extHostTypes.ts" in t for t in texts), texts
    page.keyboard.press("Escape")
    # Any part by name: the same part, inside its own group when that group is folded here; the way back to the overview.
    overview = page.locator("#world").evaluate(CAMERA)
    page.locator("#find-toggle").click()
    page.locator("#find-input").fill("Telemetry")
    page.locator(".find-item", has_text="Telemetry").first.click()
    expect(page.locator("#lens-title")).to_have_text("Telemetry")
    in_scope(page, "공통과 기타")
    expect(page.locator("#world .node.item")).to_have_count(43)  # the whole list at full size, all of it reachable
    # Every row is as tall as what it draws (a one-line name keeps no empty second line); the ambiguous Types rows keep theirs.
    rows_as_drawn(page)
    expect(page.locator("#world .node.item:has(.alias)")).to_have_count(2)
    wide = context.new_page()
    wide_font(wide)
    wide.goto(page.url)
    expect(wide.locator("#world .node.item")).to_have_count(43)
    rows_as_drawn(wide)  # the same in a wide font, where some names may truly need two lines
    wide.close()
    expect(page.locator("#world .node.selected")).to_have_text(re.compile("Telemetry"))
    page.locator("#scope-bar .scope-up").click()  # the overview came before it: up is the way back, to the same view
    expect(page.locator("#scope-bar")).to_be_hidden()
    expect(page.locator("#world .node.has-kids", has_text="공통과 기타")).to_be_visible()
    page.wait_for_timeout(500)
    assert page.locator("#world").evaluate(CAMERA) == overview
    # Collector: many lines; those going round other parts step back (still drawn, same kind) until the selection's.
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-collector.json"))
    expect(page.locator("#space")).to_have_class(re.compile("dense-lines"))
    assert page.locator("#world .edge.detour").count() > 0
    page.locator("#world .node", has_text="logs/1").click()
    expect(page.locator("#world .edge.on")).to_have_count(2)
    page.keyboard.press("Escape")
    # scikit-learn: its four groups read whole in the first view (no group past the window's edge).
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-scikit-learn.json"))
    expect(page.locator("#crumbs")).to_contain_text("scikit-learn")
    for box in page.evaluate("[...document.querySelectorAll('#world > .node.unit, #world > .frame.region')].map(e => e.dataset.box)"):
        in_map(page, f'#world [data-box="{box}"]')
    # A plan with no analysis yet, opened the first time: the panel takes its column at once and the map ends where it begins.
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-micro-javascript.json"))
    # The pane has the room: a relation's recorded note reads whole there (the map's cards stay short).
    page.locator("#world .node", has_text="설치 패키지").click()
    notes = page.locator("#lens .port-note")
    expect(notes).not_to_have_count(0)
    assert notes.evaluate_all("ns => ns.every(n => n.scrollHeight <= n.clientHeight + 1)")
    page.keyboard.press("Escape")
    page.locator("#plan-entry").click()
    expect(page.locator("#plan-panel")).to_be_visible()
    page.wait_for_timeout(250)
    vp, panel, strip = (page.locator(x).bounding_box() for x in ("#viewport", "#plan-panel", "#plan-strip"))
    assert abs(vp["x"] + vp["width"] - panel["x"]) <= 1 and strip["x"] + strip["width"] <= panel["x"], (vp, panel, strip)
    page.locator("#plan-intent").fill("폴더 단위로 바꾸고 싶어")
    page.locator("#plan-entry").click()  # close: the draft stays, the map takes the window back
    expect(page.locator("#plan-panel")).to_be_hidden()
    assert abs(page.locator("#viewport").bounding_box()["width"] - 1280) <= 1
    page.locator("#plan-entry").click()
    expect(page.locator("#plan-intent")).to_have_value("폴더 단위로 바꾸고 싶어")
    page.wait_for_timeout(250)
    assert abs(page.locator("#viewport").bounding_box()["width"] - page.locator("#plan-panel").bounding_box()["x"]) <= 1
    page.locator("#plan-entry").click()
    # A toast belongs to its project: leaving it takes the toast and its action away, and a new project's first view is the
    # map alone (no reading pane left from the project before).
    page.goto(base + "/#/p/ex-converter")
    page.locator("#world .node", has_text="문서 읽기").click()
    page.locator("#plan-entry").click()
    # Opening frames the plan's changed parts together once; reading the next change or the current view does not move it,
    # and the current view keeps a neutral mark on the target the pane reads (no change words).
    page.wait_for_timeout(400)
    opened_at = page.locator("#world").evaluate(CAMERA)
    for i in range(page.locator("#world .plan-direct").count()):
        in_map(page, f"#world .plan-direct >> nth={i}")
    page.locator(".ps-item").nth(1).click()
    page.locator(".ps-item").nth(2).click()
    page.locator("#plan-mode").get_by_role("button", name="현재", exact=True).click()
    page.wait_for_timeout(300)
    assert page.locator("#world").evaluate(CAMERA) == opened_at
    expect(page.locator("#world .plan-reading-now")).to_have_count(1)
    expect(page.locator("#world .plan-direct")).to_have_count(0)
    expect(page.locator("#world .plan-note:visible")).to_have_count(0)
    page.locator(".ps-close").click()
    expect(page.locator("#toast")).to_be_visible()
    page.goto(base + "/#/p/ex-salon")
    expect(page.locator("#toast")).to_be_hidden()
    expect(page.locator("#lens")).to_be_hidden()
    assert abs(page.locator("#viewport").bounding_box()["width"] - 1280) <= 1
    # Joplin: the desktop app's own relations read under its title inside it (no line drawn from one of its children).
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-joplin.json"))
    page.locator("#world .node", has_text="@joplin/renderer").click()
    pane_beside_map(page)
    expect(page.locator("#lens .lens-ports h3").first).to_contain_text("이 부분을 필요로 함")
    expect(page.locator("#world .edge-label.on")).not_to_have_count(0)
    page.keyboard.press("Escape")
    page.locator(".frame-head", has_text="@joplin/app-desktop").locator(".enter").click()
    in_scope(page, "@joplin/app-desktop")
    rels = page.locator(".map-title .scope-rel")
    expect(rels).to_have_count(1)
    expect(rels).to_contain_text("이 범위가 필요로 함")
    for name in ["@joplin/lib", "@joplin/editor", "@joplin/renderer"]:
        expect(rels.locator(".sr-part", has_text=name)).to_have_count(1)
    expect(page.locator("#world .ghost")).to_have_count(0)
    xs = page.evaluate("[...document.querySelectorAll('#world > .node, #world > .frame')].filter(e => !e.closest('.frame') || true).map(e => e.style.left)")
    assert len(set(xs)) >= 2, xs  # four unlinked parts are not one tall column
    # The scope reads whole in the pane on request; its relations there too.
    page.locator(".map-title .map-more").click()
    expect(page.locator("#lens.scope-read")).to_be_visible()
    expect(page.locator("#lens .lens-text")).to_contain_text("architecture.md")
    page.keyboard.press("Escape")
    expect(page.locator("#lens")).to_be_hidden()
    rels.locator(".sr-part", has_text="@joplin/lib").click()
    expect(page.locator("#scope-bar")).to_be_hidden()
    expect(page.locator("#lens-title")).to_have_text("@joplin/lib")
    context.close()


def relation_visit_flow(browser, base, cases):
    """Following a relation keeps where it was followed from, apart from the composition path: the reading pane names that
    part and goes back to its selection, camera, surface and scroll; the browser's Back is the same step. Only explicit
    relations record a visit; a visit that changed scene goes back by the context row's existing back, never by two."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    back = page.locator("#lens .visit-back")
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-collector.json"))
    page.get_by_role("button", name="구성 ID 정의 접기", exact=True).click()
    page.locator("#world .node", has_text="traces/1").click()
    page.wait_for_timeout(400)
    origin = page.locator("#world").evaluate(CAMERA)
    expect(back).to_have_count(0)  # a selection on the map is not a visit
    # A -> B in the same scene: the pane names where it came from; the composition path still reads where B really sits.
    page.locator("#lens .port", has_text="수신 · traces").click()
    expect(page.locator("#lens-title")).to_have_text("수신 · traces")
    expect(back).to_have_accessible_name("traces/1로 돌아가기")
    expect(page.locator("#lens .lens-path")).to_have_text("정적 실행본 대응")
    expect(page.locator("#lens .port.came")).to_have_text(re.compile("traces/1"))
    expect(page.locator("#scene-back")).to_be_hidden()
    in_map(page, "#world .node.selected")
    # B -> C inside a group the person folded: it opens only for the visit. A fold made meanwhile stays the person's.
    page.locator("#lens .port", has_text="수신 설정 ID").click()
    expect(page.locator("#lens-title")).to_have_text("수신 설정 ID")
    expect(back).to_have_accessible_name("수신 · traces로 돌아가기")
    expect(page.locator("#world .node", has_text="처리 설정 ID")).to_be_visible()
    fold = page.get_by_role("button", name="파이프라인 정의 접기", exact=True)
    vp = page.locator("#viewport").bounding_box()
    page.mouse.move(vp["x"] + 180, vp["y"] + vp["height"] - 100)  # pan by the empty map below the groups, as a person would
    page.mouse.down(); page.mouse.move(vp["x"] + 640, vp["y"] + vp["height"] - 100, steps=8); page.mouse.up()
    in_map(page, '#world .frame-head:has-text("파이프라인 정의")')
    fold.click()
    back.click()
    expect(page.locator("#lens-title")).to_have_text("수신 · traces")
    expect(back).to_have_accessible_name("traces/1로 돌아가기")
    expect(page.locator("#world .node", has_text="처리 설정 ID")).to_have_count(0)
    expect(page.get_by_role("button", name="파이프라인 정의 펼치기", exact=True)).to_be_visible()
    expect(page.locator("#lens .port", has_text="수신 설정 ID")).to_be_focused()
    page.get_by_role("button", name="파이프라인 정의 펼치기", exact=True).click()
    # The browser's Back is the same step: the first part, its camera, no way back left.
    page.go_back()
    expect(page.locator("#lens-title")).to_have_text("traces/1")
    expect(back).to_have_count(0)
    page.wait_for_timeout(400)
    assert page.locator("#world").evaluate(CAMERA) == origin
    page.go_forward()
    expect(page.locator("#lens-title")).to_have_text("수신 · traces")
    expect(back).to_have_accessible_name("traces/1로 돌아가기")
    # Two steps at once (the browser's history menu): from C straight to A, and forward again to C with both ways back.
    page.go_forward()
    expect(page.locator("#lens-title")).to_have_text("수신 설정 ID")
    page.evaluate("history.go(-2)")
    expect(page.locator("#lens-title")).to_have_text("traces/1")
    expect(back).to_have_count(0)
    page.wait_for_timeout(400)
    assert page.locator("#world").evaluate(CAMERA) == origin
    page.evaluate("history.go(2)")
    expect(page.locator("#lens-title")).to_have_text("수신 설정 ID")
    expect(back).to_have_accessible_name("수신 · traces로 돌아가기")
    back.click()
    expect(page.locator("#lens-title")).to_have_text("수신 · traces")
    expect(back).to_have_accessible_name("traces/1로 돌아가기")
    # A0 -> B -> A1: the same part again is a visit of its own, with its own way back; two steps back to A0 leave none.
    page.locator("#lens .port", has_text="traces/1").click()
    expect(page.locator("#lens-title")).to_have_text("traces/1")
    expect(back).to_have_accessible_name("수신 · traces로 돌아가기")
    page.evaluate("history.go(-2)")  # the same address as A1: the step is told by its entry, not its hash
    expect(back).to_have_count(0)
    expect(page.locator("#lens-title")).to_have_text("traces/1")
    expect(page.locator("#lens .port.came")).to_have_count(0)
    page.evaluate("history.go(2)")
    expect(back).to_have_accessible_name("수신 · traces로 돌아가기")
    back.click()
    # The same part left in its summary and met again in its sheet: two steps back read the summary it left, at its scroll
    # (a shorter window, so the summary scrolls).
    page.set_viewport_size({"width": 1280, "height": 600})
    page.locator("#world .node", has_text="수신 · traces").click()
    lens_body = page.locator("#lens .lens-body")
    lens_body.evaluate("e => { e.scrollTop = e.scrollHeight }")
    left = lens_body.evaluate("e => e.scrollTop")
    assert left > 20, left
    page.locator("#lens .port").filter(has=page.get_by_text("traces", exact=True)).click()
    page.locator("#lens .port", has_text="수신 · traces").click()
    page.locator("#lens .lens-more").click()
    expect(page.locator("#panel-title")).to_have_text("수신 · traces")
    page.evaluate("history.go(-2)")
    expect(page.locator("#panel")).to_be_hidden()
    expect(page.locator("#lens-title")).to_have_text("수신 · traces")
    expect(back).to_have_accessible_name("traces/1로 돌아가기")  # A0's own way back (it was reached from traces/1) stays
    assert abs(lens_body.evaluate("e => e.scrollTop") - left) <= 1
    page.set_viewport_size({"width": 1280, "height": 720})
    page.locator("#world .node", has_text="traces/1").click()
    page.locator("#lens .port", has_text="수신 · traces").click()
    expect(page.locator("#lens-title")).to_have_text("수신 · traces")
    back.click()
    expect(page.locator("#lens-title")).to_have_text("traces/1")
    expect(back).to_have_count(0)
    # Selecting on the map lets the visits go; it records none of its own.
    page.locator("#lens .port", has_text="수신 · traces").click()
    page.locator("#world .node", has_text="metrics/1").click()
    expect(back).to_have_count(0)
    page.locator("#world .node", has_text="수신 · traces").click()
    expect(back).to_have_count(0)
    # From the reading sheet: the sheet, its scroll and the question draft come back; the draft is the latest, never a copy.
    page.locator("#world .node", has_text="traces").first.click()
    expect(page.locator("#lens-title")).to_have_text("traces")
    page.locator("#lens .lens-more").click()
    page.locator(".ask-open").click()
    page.locator("#ask-input").fill("receiver 식별은 어디서 와?")
    body = page.locator("#panel .panel-body")
    body.evaluate("e => { e.scrollTop = e.scrollHeight }")
    scrolled = body.evaluate("e => e.scrollTop")
    assert scrolled > 40, scrolled
    page.locator("#panel .links a", has_text="처리 · traces").click()
    expect(page.locator("#lens-title")).to_have_text("처리 · traces")
    expect(back).to_have_accessible_name("traces로 돌아가기")
    back.click()
    expect(page.locator("#panel-title")).to_have_text("traces")
    expect(page.locator("#lens")).to_be_hidden()
    expect(page.locator("#ask-input")).to_have_value("receiver 식별은 어디서 와?")
    assert abs(body.evaluate("e => e.scrollTop") - scrolled) <= 1, (body.evaluate("e => e.scrollTop"), scrolled)
    expect(page.locator(".answer")).to_have_count(0)  # nothing was sent by coming back
    page.locator("#panel .links a", has_text="처리 · traces").click()
    page.locator("#lens .visit-back").wait_for()
    page.go_back()
    expect(page.locator("#panel-title")).to_have_text("traces")
    expect(page.locator("#ask-input")).to_have_value("receiver 식별은 어디서 와?")
    # A reload or another project keeps no stale way back.
    page.locator("#panel .links a", has_text="처리 · traces").click()
    expect(back).to_have_count(1)
    page.reload()
    expect(page.locator("#lens-title")).to_have_text("처리 · traces")
    expect(back).to_have_count(0)
    page.go_back()
    expect(page.locator("#panel-title, #lens-title").first).to_have_text("traces")
    expect(back).to_have_count(0)
    page.locator("#world .node", has_text="traces/1").click()
    page.locator("#lens .port", has_text="수신 · traces").click()
    expect(back).to_have_count(1)
    page.goto(base + "/#/p/ex-salon")
    page.go_back()
    expect(page.locator("#lens-title")).to_have_text("수신 · traces")
    expect(back).to_have_count(0)
    # A long name: one small line in the pane, cut only on screen; its accessible name keeps the whole name.
    long = "traces/1 · 수신기와 내보내기만 있는 두 번째 추적 파이프라인 정의, 처리기 없음"
    assert len(long) <= 60
    page.locator("#world .node", has_text="traces/1").click()
    page.locator("#lens .more summary").click()
    page.get_by_role("menuitem", name="이름·설명 고치기").click()
    page.locator("#edit-name").fill(long)
    page.get_by_role("button", name="저장").click()
    page.locator("#panel .close").click()
    page.locator("#lens .port", has_text="수신 · traces").click()
    expect(back).to_have_accessible_name(long + "으로 돌아가기")
    box, pane = back.bounding_box(), page.locator("#lens").bounding_box()
    assert box["height"] <= 26 and box["x"] + box["width"] <= pane["x"] + pane["width"] - 16, (box, pane)
    back.click()
    expect(page.locator("#lens-title")).to_have_text(long)
    # Out of the scope from a part: the scene changes, so the context row's back is the way back (one, not two), and it
    # brings the part, its camera and the reading back; the folds the visit opened close again.
    page.locator(".frame-head", has_text="정적 실행본 대응").locator(".enter").click()
    in_scope(page, "정적 실행본 대응")
    page.locator("#world .node", has_text="수신 · traces").click()
    page.wait_for_timeout(400)
    inside = page.locator("#world").evaluate(CAMERA)
    page.locator("#lens .port", has_text="수신 설정 ID").click()
    expect(page.locator("#lens-title")).to_have_text("수신 설정 ID")
    in_scope(page, "구성 ID 정의")
    expect(back).to_have_count(0)
    expect(page.locator("#scene-back")).to_have_text(re.compile("정적 실행본 대응"))
    page.locator("#scene-back").click()
    in_scope(page, "정적 실행본 대응")
    expect(page.locator("#lens-title")).to_have_text("수신 · traces")
    expect(page.locator("#scene-back")).to_be_hidden()
    page.wait_for_timeout(500)
    assert page.locator("#world").evaluate(CAMERA) == inside
    # Out of the scope: inside the desktop app, its own relation to @joplin/lib leaves the scene. The context row's back is the
    # one way back (as before), now with why, and it brings the scope's reading and camera back.
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-joplin.json"))
    page.locator(".frame-head", has_text="@joplin/app-desktop").locator(".enter").click()
    in_scope(page, "@joplin/app-desktop")
    page.wait_for_timeout(500)
    inside = page.locator("#world").evaluate(CAMERA)
    page.locator(".map-title .map-more").click()
    expect(page.locator("#lens.scope-read")).to_be_visible()
    page.locator("#lens .port", has_text="@joplin/lib").click()
    expect(page.locator("#lens-title")).to_have_text("@joplin/lib")
    expect(page.locator("#scope-bar")).to_be_hidden()
    expect(back).to_have_count(0)
    expect(page.locator("#scene-back")).to_be_visible()
    expect(page.locator("#scene-back")).to_have_text(re.compile("@joplin/app-desktop"))
    assert "관계를 따라 왔어요" in page.locator("#scene-back").get_attribute("title")
    page.locator("#scene-back").click()
    in_scope(page, "@joplin/app-desktop")
    expect(page.locator("#lens.scope-read")).to_be_visible()
    expect(page.locator("#lens .port", has_text="@joplin/lib")).to_be_focused()  # the restored reading, not the map title's
    expect(page.locator("#scene-back")).to_be_hidden()
    page.wait_for_timeout(500)
    assert page.locator("#world").evaluate(CAMERA) == inside
    # The map title's relation too; the browser's Back takes the same way.
    page.keyboard.press("Escape")
    page.locator(".map-title .sr-part", has_text="@joplin/lib").click()
    expect(page.locator("#lens-title")).to_have_text("@joplin/lib")
    expect(page.locator("#scene-back")).to_be_visible()
    page.go_back()
    in_scope(page, "@joplin/app-desktop")
    expect(page.locator("#scene-back")).to_be_hidden()
    no_page_scroll(page)
    assert not errors, errors
    context.close()


def return_flow(browser, base, cases):
    """EXPERIENCE63: the return reading beside the same map. The UI62 material opens without a call; one explicit call per
    material (stage), never again for the same material; each sentence leads to its exact quote and version and back with the
    camera kept; a part read from it comes back to it; a sentence offered to the change plan never overwrites a draft.
    A saved project with a real AI plan and no returned result reads 'no result yet'; its reading is kept across a reload.
    Stubbed provider: layout and boundaries only, not reading quality."""
    material = json.loads((ROOT.parents[1] / "docs/cycles/2026-10-27-return-experience-63/MATERIAL.json").read_text(encoding="utf-8"))
    excerpt = {r["id"]: r["text"]["publicExcerpt"] for r in material["records"]}
    stage_sizes = {s["id"]: len(s["sourceIds"]) for s in material["checkpoints"]}
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    calls = []
    page.on("request", lambda r: calls.append(r.url) if r.url.endswith("/api/studio/digest") else None)
    page.goto(base + "/")
    page.locator('.program-try[href="#/p/ex-ui62"]').click()
    expect(page.locator("#lens .rr-head")).to_be_visible()
    expect(page.locator("#lens .rr-src")).to_have_count(min(5, stage_sizes["reading_1"]))  # material preview, before any reading
    pane_beside_map(page); no_page_scroll(page)
    assert calls == [], "opening never calls"
    page.get_by_role("button", name="AI로 정리하기").click()
    expect(page.locator("#lens .rr-st").first).to_be_visible()
    assert len(calls) == 1
    expect(page.locator("#lens .rr-sec > h3")).to_have_text(["지금 읽을 부분", "달라진 점"])
    expect(page.locator('#lens .rr-st.on')).to_have_count(0)
    changes = page.locator('#lens .rr-st-select[data-list="changes"]')
    expect(changes.first).to_have_attribute("aria-expanded", "false")
    first = page.locator("#lens .rr-st").first
    expect(first.locator(".rr-expand")).to_have_text("펼쳐 읽기")
    expect(first.locator(".rr-part")).to_have_count(0)
    expect(first.locator(".rr-ref").first).to_be_visible()  # collapsed sentences still lead straight to their sources
    read_part = page.locator("#lens .rr-go").inner_text().replace("›", "").strip()
    expect(page.locator("#world .read-mark")).to_have_count(1)
    expect(page.locator("#world .read-mark")).to_contain_text(read_part)
    initial_camera = page.locator("#world").evaluate(CAMERA)
    first.locator(".rr-ref").first.click()
    collapsed_sid = page.locator("#lens .rr-source-kind span").last.inner_text()
    expect(page.locator("#lens .rr-quote")).to_have_text(excerpt[collapsed_sid])
    page.keyboard.press("Escape")
    expect(changes.first).to_have_attribute("aria-expanded", "false")
    expect(page.locator('#lens .rr-st.on')).to_have_count(0)  # source buttons never select the surrounding change
    assert page.locator("#world").evaluate(CAMERA) == initial_camera
    # Only an explicit choice expands a change; the initial mark comes from read.partId, not an automatic first change.
    changes.first.click()
    expect(changes.first).to_have_attribute("aria-expanded", "true")
    expect(first).to_have_class(re.compile(r"\bon\b"))
    part = first.locator(".rr-part").first.inner_text().strip()
    expect(page.locator("#world .read-mark")).to_have_count(1)
    expect(page.locator("#world .read-mark")).to_contain_text(part)
    in_map(page, "#world .read-mark")
    # The quote, exactly as published, with its version; back to the same reading with the camera untouched.
    camera = page.locator("#world").evaluate(CAMERA)
    ref = first.locator(".rr-ref").first
    version = ref.locator("code").inner_text()
    ref.scroll_into_view_if_needed()
    reading_scroll = page.locator("#lens .lens-body").evaluate("e => e.scrollTop")
    ref.click()
    sid = page.locator("#lens .rr-source-kind span").last.inner_text()
    expect(page.locator("#lens .rr-quote")).to_have_text(excerpt[sid])
    expect(page.locator("#lens .rr-meta")).to_contain_text(version)
    page.keyboard.press("Escape")
    expect(page.locator("#lens .rr-st")).not_to_have_count(0)
    expect(changes.first).to_have_attribute("aria-expanded", "true")
    expect(page.locator("#lens .lens-body")).to_have_js_property("scrollTop", reading_scroll)
    assert page.locator("#world").evaluate(CAMERA) == camera
    # A part read from the reading, and back (Esc) to the reading with the same camera.
    page.locator("#lens .rr-go").click()
    expect(page.locator("#lens .rr-head")).to_have_count(0)
    page.keyboard.press("Escape")
    expect(page.locator("#lens .rr-head")).to_be_visible()
    page.wait_for_timeout(400)
    assert page.locator("#world").evaluate(CAMERA) == camera
    # Another stage is other material (a call when asked); back to stage 1 reads the kept reading without a call.
    page.get_by_role("button", name="3단계").click()
    expect(page.locator("#lens .rr-src")).to_have_count(min(5, stage_sizes["reading_3"]))  # first-page material preview
    page.get_by_role("button", name="AI로 정리하기").click()
    expect(page.locator("#lens .rr-st").first).to_be_visible()
    expect(page.locator("#lens .rr-sec > h3")).to_have_text(["지금 읽을 부분", "정할 것", "달라진 점"])
    expect(page.locator('#lens .rr-st-select[data-list="changes"][aria-expanded="true"]')).to_have_count(0)
    expect(page.get_by_role("button", name="이걸로 시험")).to_be_visible()  # actual open item stays full and actionable
    # Different excerpts from one review document are named before opening, even when kind and revision are identical.
    for record in (r for r in material["records"] if r["type"].startswith("retrospective_")):
        chip = page.locator("#lens .rr-ref").filter(has=page.locator(".rr-ref-title", has_text=re.compile("^" + re.escape(record["title"]) + "$"))).first
        expect(chip).to_be_visible()
        expect(chip).to_have_attribute("aria-label", re.compile(re.escape(record["title"])))
        expect(chip.locator(".rr-ref-kind")).to_have_text("검토·검사 기록")
        expect(chip.locator("code")).to_have_text(record["sourceSHA"][:7])
        bounds = chip.evaluate("""e => {
          const box = e.getBoundingClientRect(), kind = e.querySelector('.rr-ref-kind').getBoundingClientRect(),
            title = e.querySelector('.rr-ref-title').getBoundingClientRect(), version = e.querySelector('code').getBoundingClientRect();
          return { oneLine: box.height <= 24, titleWidth: title.width,
            fixedVisible: kind.left >= box.left && version.right <= box.right && kind.right <= title.left && title.right <= version.left };
        }""")
        assert bounds["oneLine"] and bounds["fixedVisible"] and bounds["titleWidth"] >= 50, bounds
    page.get_by_role("button", name="1단계").click()
    expect(page.locator("#lens .rr-st").first).to_be_visible()
    expect(page.locator('#lens .rr-st.on')).to_have_count(0)
    page.get_by_role("button", name="3단계").click()
    expect(page.locator("#lens .rr-st").first).to_be_visible()
    assert len(calls) == 2, calls
    no_page_scroll(page)
    # A sentence offered to the change plan: no draft yet, so it may become the draft; only when said so.
    page.get_by_role("button", name="이걸로 시험").click()
    expect(page.locator(".pp-proposal")).to_be_visible()
    offered = page.locator(".pp-proposal blockquote").inner_text()
    expect(page.locator("#plan-intent")).to_have_value("")  # offering alone never changes the draft
    page.get_by_role("button", name="초안으로 쓰기").click()
    expect(page.locator("#plan-intent")).to_have_value(offered)
    # Replace immediately, without waiting for an animation frame. A deferred caret change must not append to the offer.
    page.locator("#plan-intent").fill("내 초안 한 줄")
    expect(page.locator("#plan-intent")).to_have_value("내 초안 한 줄")
    page.locator("#return-entry").click()
    expect(page.locator("#lens .rr-st").first).to_be_visible()
    page.get_by_role("button", name="이걸로 시험").click()
    page.get_by_role("button", name="넣지 않기").click()
    expect(page.locator("#plan-intent")).to_have_value("내 초안 한 줄")
    page.locator("#return-entry").click()
    page.get_by_role("button", name="이걸로 시험").click()
    page.get_by_role("button", name="초안 끝에 덧붙이기").click()
    expect(page.locator("#plan-intent")).to_have_value("내 초안 한 줄\n" + offered)
    assert page.evaluate("localStorage.getItem('agentflow.studio.digest.1')") is None, "examples are never stored"
    context.close()

    # 1440: the same first reading reads beside the map without page scroll.
    context = browser.new_context(viewport={"width": 1440, "height": 900})
    page = context.new_page()
    page.goto(base + "/#/p/ex-ui62")
    expect(page.locator("#lens .rr-src")).to_have_count(min(5, stage_sizes["reading_1"]))
    page.get_by_role("button", name="AI로 정리하기").click()
    expect(page.locator("#lens .rr-st").first).to_be_visible()
    pane_beside_map(page); no_page_scroll(page); in_map(page, "#world .read-mark")
    context.close()

    # Node-RED: a real AI change plan, no returned result. Plan material only; no change is claimed; kept across a reload.
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    calls.clear()
    page.on("request", lambda r: calls.append(r.url) if r.url.endswith("/api/studio/digest") else None)
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-node-red.json"))
    expect(page.locator("#crumbs")).to_contain_text("Node-RED")
    page.locator("#plan-entry").click()
    plan_path = ROOT.parents[1] / "docs/cycles/2026-10-26-visual-experience-59/node-red-real-plan.json"
    plan_bundle = json.loads(plan_path.read_text(encoding="utf-8"))["bundle"]
    plan = plan_bundle["plan"]
    # No observations or project records in this fixture: evidence sources plus the plan-wide preserve/unknowns context.
    assert not plan_bundle["observations"] and not plan_bundle["extra"]
    plan_evidence = [e for e in plan["evidence"] if not re.fullmatch(r"E\d+|U\d+|BRIEF", e["id"])]
    context_source = bool(plan["analysis"]["preserve"] or plan["analysis"]["unknowns"])
    page.locator("#plan-import-file").set_input_files(str(plan_path))
    expect(page.locator("#world .plan-reading .node-name")).to_have_text("10-mqtt.js")
    page.locator("#return-entry").click()
    expect(page.locator("#plan-strip")).to_be_hidden()
    expect(page.locator("#lens .rr-src")).to_have_count(len(plan_evidence) + int(context_source))
    for i, evidence in enumerate(plan_evidence):
        expect(page.locator("#lens .rr-src strong").nth(i)).to_contain_text(evidence["title"])
    if context_source:
        page.locator("#lens .rr-src", has_text="변경안의 유지 범위와 미정").click()
        for line in plan["analysis"]["preserve"] + plan["analysis"]["unknowns"]:
            expect(page.locator("#lens .rr-quote")).to_contain_text(line)
        page.keyboard.press("Escape")
    page.get_by_role("button", name="AI로 정리하기").click()
    expect(page.locator("#lens .rr-none")).to_contain_text("돌아온 결과 자료가 아직 없어요")
    expect(page.locator("#lens .rr-gaps")).to_be_visible()
    expect(page.locator("#lens .rr-meet")).to_contain_text("변경 구상")
    page.locator("#lens .rr-meet .link-button").click()
    expect(page.locator("#plan-strip")).to_be_visible()
    expect(page.locator("#world .plan-reading .node-name")).to_have_text("10-mqtt.js")
    url = page.url
    page.reload()
    page.locator("#return-entry").click()
    expect(page.locator("#lens .rr-none")).to_be_visible()
    assert len(calls) == 1, calls  # read from this browser's kept reading, not sent again
    assert page.url == url
    context.close()


def plan_reply(route, title):
    """A valid analysis of exactly what the page sent (test-only, routed in the browser): one change on the first part, cited
    to the sentence itself. Never a model's reading."""
    ask = route.request.post_data_json
    first = ask["parts"][0]["id"]
    reply = {"summary": "[테스트 응답] 보낸 문장만 근거로 한 분석 자리입니다.", "items": [{"id": "ask", "title": title,
        "description": "[테스트 응답] 지금 문장에서 온 변경 자리입니다.", "partIds": [first], "refs": ["INTENT"], "dependsOn": []}],
        "impacts": [], "preserve": [], "unknowns": []}
    route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": reply}))


def stale_request_flow(browser, base):
    """EXP65 P1: a request document is made only from the analysis of what is written now. Typing a new sentence turns the
    request off at once (the caret stays where it was), a forced call makes nothing, writing the analysed sentence back turns
    it on again; a cancelled or outdated analysis never becomes the plan; added material counts like the sentence."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/#/p/ex-converter")
    page.locator("#plan-entry").click()
    page.locator(".ps-more").click()
    page.get_by_role("button", name="문장 고치기").click()
    area, make = page.locator("#plan-intent"), page.get_by_role("button", name="요청문 만들기", exact=True)
    original = area.input_value()
    expect(make).to_be_enabled()
    new = "폴더 변환은 추가하지 말고, 파일 이름 충돌 때 덮어쓰지만 막아줘."
    area.evaluate("a => { a.dataset.same = '1'; }")
    area.fill(new)  # one input event, no other step
    expect(make).to_be_disabled()
    expect(page.locator("#plan-make-note")).to_have_text("고친 문장을 먼저 살펴본 뒤 만들 수 있어요")
    expect(page.locator("#plan-ask")).to_have_text("고친 문장으로 살펴보기")
    expect(page.locator("#plan-stale")).to_be_visible()
    # Typing keeps the same field and caret (no re-render while writing).
    area.evaluate("a => a.setSelectionRange(5, 5)")
    page.keyboard.type("꼭 ")
    expect(area).to_have_value(new[:5] + "꼭 " + new[5:])
    assert area.evaluate("a => a.dataset.same === '1' && a.selectionStart === 7 && document.activeElement === a")
    area.fill(new)
    # The handler itself refuses: a button forced on makes no document, and the request goes back off.
    make.evaluate("b => { b.disabled = false; b.click(); }")
    expect(page.locator("#plan-sheet")).to_be_hidden()
    expect(page.get_by_role("button", name=re.compile("마지막 요청문"))).to_have_count(0)
    expect(make).to_be_disabled()
    # Writing the analysed sentence back: the prepared example request is made as before.
    area.fill(original)
    expect(make).to_be_enabled()
    expect(page.locator("#plan-make-note")).to_be_hidden()
    make.click()
    expect(page.locator("#plan-sheet pre")).to_contain_text("- 폴더 입력")
    page.keyboard.press("Escape")
    # A cancelled analysis of the new sentence ends without a plan, even when its reply comes after the cancel.
    held = []
    page.route("**/api/studio/plan", lambda route: held.append(route))
    area.fill(new)
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-panel .pending")).to_be_visible()
    expect(make).to_be_disabled()
    page.locator("#plan-panel .pending").get_by_role("button", name="취소").click()
    expect(page.locator("#plan-panel .pending")).to_have_count(0)
    try: plan_reply(held[0], "늦게 온 응답")
    except Exception: pass
    page.wait_for_timeout(200)
    expect(page.locator(".ps-intent")).to_have_text(original)
    expect(page.locator("#plan-panel .pp-error")).to_have_count(0)
    expect(make).to_be_disabled()
    # Analysed now: the request comes from that analysis, never from the earlier plan.
    page.unroute("**/api/studio/plan")
    page.route("**/api/studio/plan", lambda route: plan_reply(route, "이름 충돌 때 덮어쓰기 막기"))
    page.route("**/api/studio/scope", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps(
        {"model": "stub-model", "reply": {"summary": "[테스트 응답] 범위 검토 자리입니다.", "prerequisites": [], "unknowns": []}})))
    page.locator("#plan-ask").click()
    expect(page.locator(".ps-intent")).to_have_text(new)
    page.locator(".ps-more").click()
    expect(make).to_be_enabled()
    make.click()
    expect(page.locator("#plan-sheet pre")).to_contain_text("- 이름 충돌 때 덮어쓰기 막기")
    expect(page.locator("#plan-sheet pre")).not_to_contain_text("- 폴더 입력")
    page.keyboard.press("Escape")
    page.unroute("**/api/studio/plan")
    # A saved project: material added while its analysis is in flight makes that reply outdated; the plan is not made.
    page.goto(base + "/")
    page.locator("#new-open").click()
    page.locator("#new-name").fill("자료 프로젝트")
    page.locator("#new-form").get_by_role("button", name="만들기").click()
    page.locator("#part-name").fill("변환")
    page.get_by_role("button", name="만들기").click()
    page.keyboard.press("Escape")
    page.locator("#plan-entry").click()
    page.locator("#plan-intent").fill("이름 충돌 때 덮어쓰지 않게 해줘.")
    held.clear()
    page.route("**/api/studio/plan", lambda route: held.append(route))
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-panel .pending")).to_be_visible()
    def add_material():
        page.get_by_role("button", name="+ 자료 추가").click()
        page.locator("#src-title").fill("저장 함수 발췌")
        page.locator("#src-text").fill("save.ts: 같은 이름이 있으면 덮어쓴다.")
        page.locator("#src-basis").fill("main save.ts")
        page.locator(".pp-add").get_by_role("button", name="추가").click()
    page.get_by_role("button", name=re.compile("읽는 자료")).click()
    add_material()
    plan_reply(held[0], "덮어쓰기 막기")
    expect(page.locator("#plan-panel .pp-error")).to_contain_text("살펴보는 동안 문장이나 자료가 바뀌어 이 결과는 쓰지 않았어요")
    expect(page.locator(".ps-intent")).to_have_text("오른쪽에 바꾸고 싶은 모습을 적어 주세요")
    # Analysed with the material: removing it puts the request off, adding the same material back puts it on again.
    page.unroute("**/api/studio/plan")
    page.route("**/api/studio/plan", lambda route: plan_reply(route, "덮어쓰기 막기"))
    page.locator("#plan-ask").click()
    expect(page.locator(".ps-intent")).to_have_text("이름 충돌 때 덮어쓰지 않게 해줘.")
    page.locator(".ps-more").click()
    expect(make).to_be_enabled()
    sources = page.get_by_role("button", name=re.compile("읽는 자료"))
    if sources.get_attribute("aria-expanded") != "true": sources.click()
    page.get_by_role("button", name="‘저장 함수 발췌’ 자료 빼기").click()
    expect(make).to_be_disabled()
    expect(page.locator("#plan-make-note")).to_have_text("바뀐 자료로 먼저 살펴본 뒤 만들 수 있어요")
    expect(page.locator("#plan-ask")).to_have_text("바뀐 자료로 살펴보기")
    add_material()
    expect(make).to_be_enabled()
    # Kept as analysed after a reload: the saved plan still answers what is written.
    page.reload()
    page.locator("#plan-entry").click()
    page.locator(".ps-more").click()
    expect(make).to_be_enabled()
    # The converter example: material taken from the return reading and added to the draft is read by the next analysis and
    # kept in its plan, so the plan made from it is current (the request comes on).
    page = context.new_page()
    page.goto(base + "/#/p/ex-converter")
    page.locator("#plan-entry").click()
    page.locator(".ps-more").click()
    make = page.get_by_role("button", name="요청문 만들기", exact=True)
    make.click()
    page.keyboard.press("Escape")
    page.get_by_role("button", name="돌아온 기록 살펴보기").click()
    def digest(route):
        ask = route.request.post_data_json
        src = next(x for x in ask["sources"] if x["kind"] in ("authored", "report", "code", "test", "review", "result") and x["partIds"])
        reply = {"changes": [], "read": None, "open": [{"text": "[테스트 응답] 이름이 같은 결과 파일을 덮어쓰지 않게 하고 싶어.", "partIds": src["partIds"][:1], "refs": [src["id"]]}],
                 "notCovered": ["[테스트 응답] 돌아온 자료로 말할 수 없는 것 자리입니다."]}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": reply}))
    page.route("**/api/studio/digest", digest)
    page.locator("#plan-panel").get_by_role("button", name="돌아와 읽기").click()
    page.get_by_role("button", name=re.compile("AI로 정리")).first.click()
    page.get_by_role("button", name="이걸로 시험").click()
    page.get_by_role("button", name="초안 끝에 덧붙이기").click()
    expect(make).to_be_disabled()
    expect(page.locator("#plan-reach")).to_contain_text("+ 붙인 자료 1개")
    sent = []
    page.route("**/api/studio/plan", lambda route: (sent.append(route.request.post_data_json), plan_reply(route, "같은 이름 덮어쓰기 막기")))
    page.locator("#plan-ask").click()
    expect(page.locator(".ps-intent")).to_contain_text("덮어쓰지 않게")
    assert any(e["id"] == "U01" for e in sent[0]["evidence"]), [e["id"] for e in sent[0]["evidence"]]
    page.locator(".ps-more").click()
    expect(make).to_be_enabled()
    expect(page.locator("#plan-make-note")).to_be_hidden()
    context.close()


def return_failure_flow(browser, base):
    """A failed return reading: a short error and the material itself, never a substitute reading; asking again works."""
    material = json.loads((ROOT.parents[1] / "docs/cycles/2026-10-27-return-experience-63/MATERIAL.json").read_text(encoding="utf-8"))
    stage = next(s for s in material["checkpoints"] if s["id"] == "reading_1")
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(base + "/#/p/ex-ui62")
    page.get_by_role("button", name="AI로 정리하기").click()
    expect(page.locator("#lens .pp-error")).to_contain_text("AI 서비스가 응답하지 않아요")
    expect(page.locator("#lens .rr-st")).to_have_count(0)
    expect(page.locator("#lens .rr-src")).to_have_count(min(5, len(stage["sourceIds"])))
    page.get_by_role("button", name="AI로 정리하기").click()
    expect(page.locator("#lens .rr-st").first).to_be_visible()
    expect(page.locator("#lens .pp-error")).to_have_count(0)
    page.close()


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
            workspace_flow(browser, base, oss_fixtures()); print("ok  plan strip and comparison in the pane, open/close without zoom, long same-prefix names, way back apart from way up")
            preview_context_flow(browser, base); print("ok  preview exposes only its target path; current, sources and user folds preserve ownership")
            relation_context_flow(browser, base, oss_fixtures()); print("ok  existing relations of target and candidate read above groups; current and preview share one scene")
            overview_flow(browser, base, oss_fixtures()); print("ok  large list as an overview of real groups, find with way back, scope relations, pane beside the map, verbs")
            relation_visit_flow(browser, base, oss_fixtures()); print("ok  relation visit: named way back to its part, selection, camera, sheet and scroll; browser Back the same; no stale way back")
            return_flow(browser, base, oss_fixtures()); print("ok  return reading: no call on open, one per material, exact quote and back, draft never overwritten, Node-RED plan without result")
            stale_request_flow(browser, base); print("ok  request only from the analysis of what is written now: typed, forced, A-B-A, cancelled and outdated replies, material")
            proc, base = start("code"); procs.append(proc); code_flow(browser, base); print("ok  access code kept from an input event")
            proc, base = start("fail"); procs.append(proc); failure_flow(browser, base); print("ok  provider failure -> short error -> retry")
            proc, base = start("fail"); procs.append(proc); return_failure_flow(browser, base); print("ok  return reading failure -> short error and the material -> asking again")
            proc, base = start("nokey"); procs.append(proc); off_flow(browser, base + "/", "AI 키 없음"); print("ok  server without key -> honest off state")
            if (ROOT / "static-dist/index.html").exists():
                server = serve_static()
                off_flow(browser, f"http://127.0.0.1:{server.server_address[1]}/", "AI 서버 미연결"); server.shutdown(); print("ok  static build -> not connected state")
            browser.close()
    finally:
        for proc in procs: proc.kill()


if __name__ == "__main__":
    main()
