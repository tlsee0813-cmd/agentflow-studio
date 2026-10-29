"""Smoke test of the new studio flow in a real browser (test-only stubbed DeepSeek transport, no real key).

entry -> map (no document scroll) -> part -> ask (summary, question) -> answer with evidence -> back to map;
provider failure shows a short error and a retry (never a substitute answer); a server without a key and the static
build both show the honest not-connected state. Not a visual or usability audit.
"""
import functools, hashlib, http.server, json, os, pathlib, re, subprocess, sys, tempfile, threading
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
    expect(page.locator("#ai-text")).to_have_text("AI · 접속 코드 필요")  # not ready to ask until a code is given
    page.locator('.program-head[href="#/p/ex-salon"]').click()
    page.locator(".node", has_text="시간 고르기").click()
    sheet(page, "시간 고르기")
    page.get_by_role("button", name="지금 상황 정리").click()  # no code yet: opens the box at the code field
    expect(page.locator("#access-code")).to_be_focused()
    page.locator("#access-code").fill("smoke-code")  # input events only (as with paste or autofill), no change event
    expect(page.locator("#ai-text")).to_have_text("AI 정리 가능")
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
    # EXPERIENCE70: records are the first way in; adding a part by hand is the other, one click away.
    expect(page.locator("#space-empty")).to_contain_text("기록으로 첫 지도를 만들어요")
    expect(page.locator("#part-form")).to_be_hidden()
    page.locator("#space-empty .se-direct").click()
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
    # else the change's name marked as such. '실패해도 나머지 계속' marks the conversion stage itself, not one inner part.
    expect(page.locator("#world .node", has_text="문서 읽기").locator(".plan-note")).to_have_text("폴더 안 파일을 입력받기")
    expect(page.locator("#world .frame", has_text="내용·모양 보존").locator(".frame-title .plan-note")).to_have_text("변경 실패해도 나머지 계속")
    expect(page.locator("#world .node", has_text="본문과 표").locator(".plan-note")).to_have_text("")
    expect(page.locator("#world .node", has_text="결과 설명").locator(".plan-note")).to_have_text("실패한 파일과 이유 모아 보기")
    for name in page.locator("#world .plan-direct :is(.node-name, .frame-name)").all():
        assert not name.evaluate("e => e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1"), name.inner_text()
    # The strip reads the analysis's finding on the map; the change chips are a reading choice, apart from what the request
    # takes (no checkbox-like mark on them).
    expect(page.locator(".ps-find")).to_contain_text("파일별 결과는 이미 남고 있지만, 화면에는 마지막 결과만 보여요.")
    expect(page.locator(".ps-inc")).to_have_text("요청에 포함 3/3")
    expect(page.locator(".ps-item .ps-hand")).to_have_count(0)
    # A change with two targets keeps both names and marks, but reads one target at a time.
    page.locator(".ps-item").nth(2).click()
    expect(page.locator(".ps-item").nth(2)).to_have_attribute("aria-current", "true")
    expect(page.locator(".callout")).to_have_count(1)
    expect(page.locator(".ps-target")).to_have_count(2)
    expect(page.locator(".ps-target-label")).to_have_text("바뀌는 부분 2")
    target_names = page.locator(".ps-target").all_text_contents()
    expect(page.locator(".ps-target").nth(0)).to_have_attribute("aria-selected", "true")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[0])
    # No quote for this target: '지금' says the material does not tell (never a gap to fill, never an invented current), no
    # wanted text of its own, and why the change reads this part in the analysis's words.
    expect(page.locator(".callout .co-row.now.unknown p").first).to_have_text("이 변경안의 자료로는 지금 어떻게 하는지 알 수 없어요.")
    expect(page.locator(".callout .co-row.want")).to_have_count(0)
    expect(page.locator(".callout .co-row.why")).to_contain_text("같은 이름 충돌")
    expect(page.locator("#lens")).not_to_contain_text("비교는 아직 정리 전")
    page.locator(".ps-target").nth(1).click()
    expect(page.locator(".ps-target").nth(1)).to_have_attribute("aria-selected", "true")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[1])
    expect(page.locator(".callout .co-row.now p").first).to_have_text("화면은 마지막 결과만 표시한다.")
    expect(page.locator(".callout .co-row.now")).to_contain_text("자료에서 P03")
    expect(page.locator(".callout .co-row.want p").first).to_have_text("실패한 파일과 이유 모아 보기")
    expect(page.locator(".callout .co-row.why")).to_contain_text("화면은 마지막 결과만 보여 줍니다")
    page.wait_for_timeout(300)
    in_map(page, "#world .plan-reading")  # the target being read is brought beside the pane, not under it
    pane_beside_map(page)
    # Sources replace this one reading; coming back keeps the actual target and its matching before/after text.
    target_camera = page.locator("#world").evaluate("e => e.style.transform")
    page.locator(".callout .co-row.now .co-ref").click()
    expect(page.locator("#lens .cmp-evidence")).to_be_visible()
    expect(page.locator("#lens .cmp-evidence details").first).to_contain_text("P03")
    expect(page.locator(".callout")).to_have_count(0)
    assert page.locator("#world").evaluate("e => e.style.transform") == target_camera
    page.locator("#cmp-back").click()
    expect(page.locator(".ps-target").nth(1)).to_have_attribute("aria-selected", "true")
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[1])
    expect(page.locator(".callout .co-row.want p").first).to_have_text("실패한 파일과 이유 모아 보기")
    assert page.locator("#world").evaluate("e => e.style.transform") == target_camera
    # A pan made while reading sources remains the person's camera on return; no saved-camera restore may discard it.
    page.locator(".callout .co-row.now .co-ref").click()
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
    scene, camera = page.evaluate(BOXES), page.locator("#world").evaluate(CAMERA)
    page.locator("#plan-mode").get_by_role("button", name="현재").click()
    expect(page.locator("#world .plan-direct")).to_have_count(0)
    expect(page.locator("#zoom-level")).to_have_text(zoom)
    # The mode shows or hides the change marks only: the same boxes and camera in both (the plan's comparison scene).
    assert page.evaluate(BOXES) == scene and page.locator("#world").evaluate(CAMERA) == camera
    page.locator("#plan-mode").get_by_role("button", name="변경 미리보기").click()
    expect(page.locator(".ps-target").nth(1)).to_have_attribute("aria-selected", "true")
    # 'Continue after a failure' on the conversion stage: why it is read there, with what is known and what is not.
    page.locator(".ps-item", has_text="실패해도 나머지 계속").click()
    expect(page.locator(".callout .co-head strong")).to_have_text("내용·모양 보존")
    expect(page.locator(".callout .co-row.now.unknown")).to_be_visible()
    expect(page.locator(".callout .co-row.outcome")).to_contain_text("한 문서의 실패가 다른 문서 처리를 중단하지 않는 결과를 원합니다.")
    expect(page.locator(".callout .co-row.why")).to_contain_text("변환 결과는 입력마다 성공 경로나 실패 이유로 이미 돌아와요")
    expect(page.locator(".callout .co-row.why")).to_contain_text("이미 만든 산출물이 남는지는 확인되지 않았어요")
    page.wait_for_timeout(400)
    # The wide comparison covers the map without moving it: same camera and map area underneath, the pane kept as it was.
    on_map, area_w = page.locator("#world").evaluate(CAMERA), page.locator("#viewport").bounding_box()["width"]
    page.locator("#lens .ps-wide").click()
    work = page.locator("#plan-panel.work")
    expect(work).to_be_visible()
    box = work.bounding_box(); assert box["x"] == 0 and box["width"] == 1280, box
    assert page.locator("#world").evaluate(CAMERA) == on_map and page.locator("#viewport").bounding_box()["width"] == area_w
    expect(page.locator(".pw-pick[aria-current='true']")).to_contain_text("실패해도 나머지 계속")
    expect(page.locator(".pw-pick[aria-current='true']")).to_be_focused()
    # What the workspace covers is inert (out of the tab order and the accessibility tree) but stays in place: real Tab and
    # Shift+Tab from the current row reach the workspace and the top bar only, never the pane's old include box under it.
    lens_box = page.locator("#lens").bounding_box()
    for sel in ("#lens", "#plan-strip", "#viewport", ".controls"):
        assert page.locator(sel).evaluate("e => e.inert"), sel
    assert page.locator("#lens").bounding_box() == lens_box
    def route(key, n):
        out = []
        for _ in range(n):
            page.keyboard.press(key)
            out.append(page.evaluate("""() => { const a = document.activeElement;
              return { covered: !!a.closest('[inert]'), where: a.closest('#plan-panel') ? 'work' : a.closest('.bar') ? 'top' : a.closest('#space') ? 'space' : 'page',
                       id: a.id, text: (a.textContent || a.getAttribute('aria-label') || '').trim().slice(0, 24) }; }"""))
        return out
    back_route = route("Shift+Tab", 14)
    assert not any(x["covered"] or x["where"] == "space" for x in back_route), back_route
    assert any(x["where"] == "top" for x in back_route), back_route
    page.locator(".pw-pick[aria-current='true']").focus()
    fwd_route = route("Tab", 30)
    assert not any(x["covered"] or x["where"] == "space" for x in fwd_route), fwd_route
    assert not any(x["id"].startswith("ps-hand-") for x in back_route + fwd_route)
    page.locator(".pw-pick[aria-current='true']").focus()
    expect(page.locator(".pw-found")).to_contain_text("파일별 결과는 이미 남고 있지만, 화면에는 마지막 결과만 보여요.")
    expect(page.locator(".pw-title")).to_have_text("폴더 단위 변환")  # a short heading, not every change again
    page.locator(".pw-said-btn").click()  # the whole sentence on request
    expect(page.locator("#pw-said")).to_contain_text("병렬 처리는 요청하지 않았어.")
    page.locator(".pw-said-btn").click()
    # One target and no pair of its own: the wanted result reads beside '지금', and why the stage is read is in the first view.
    expect(page.locator(".pw-what")).to_have_count(0)
    assert page.locator(".pw-part .co-row.why").evaluate("e => e.getBoundingClientRect().bottom") <= 720
    expect(work).not_to_contain_text("비교는 아직 정리 전")
    no_page_scroll(page)
    assert page.locator(".pw-list").evaluate("e => e.scrollWidth <= e.clientWidth") and page.locator(".pw-detail").evaluate("e => e.scrollWidth <= e.clientWidth")
    # Reading another change is not including it, and including is not reading: one explicit box per change.
    page.locator(".pw-item", has_text="폴더 입력").locator("input[type=checkbox]").uncheck()
    expect(page.locator(".pw-pick[aria-current='true']")).to_contain_text("실패해도 나머지 계속")
    expect(page.locator(".pw-count")).to_have_text("2/3 포함")
    page.locator(".pw-pick", has_text="성공 유지·실패 모음").click()
    expect(page.locator(".pw-item", has_text="폴더 입력").locator("input[type=checkbox]")).not_to_be_checked()
    expect(page.locator(".pw-item", has_text="성공 유지·실패 모음").locator("input[type=checkbox]")).to_be_checked()
    expect(page.locator(".pw-part")).to_have_count(2)
    # A source opens in the right column; the comparison beside it stays (same change, same scroll).
    page.locator(".pw-detail").evaluate("e => e.scrollTop = 140")
    held = page.locator(".pw-detail").evaluate("e => e.scrollTop")
    page.locator(".pw-part").nth(1).locator(".co-row.now .co-ref").evaluate("e => e.click()")  # no scroll into view first
    expect(page.locator(".pw-rail-head h3")).to_have_text("근거 P03")
    expect(page.locator("#pw-item-title")).to_have_text("성공 유지·실패 모음")
    assert page.locator(".pw-detail").evaluate("e => e.scrollTop") == held
    page.keyboard.press("Escape")
    expect(page.locator("#plan-make")).to_be_visible()
    # From the wide comparison to the part on the map, and back to the same change and scroll.
    page.locator(".pw-part").nth(1).locator(".pw-map").click()
    expect(work).to_be_hidden()
    expect(page.locator(".callout .co-head strong")).to_have_text(target_names[1])
    page.wait_for_timeout(400)
    in_map(page, "#world .plan-reading")
    expect(page.locator("#lens .ps-wide")).to_have_text("‹ 넓은 비교로")
    assert not page.locator("#lens").evaluate("e => e.inert") and not page.locator("#viewport").evaluate("e => e.inert")
    expect(page.locator("#lens .ps-wide")).to_be_focused()  # keyboard focus follows to the way back
    page.locator("#lens .ps-wide").click()
    expect(page.locator(".pw-pick[aria-current='true']")).to_contain_text("성공 유지·실패 모음")
    assert page.locator(".pw-detail").evaluate("e => e.scrollTop") == held
    # Back to the map as it was left: no re-frame.
    mapped = page.locator("#world").evaluate(CAMERA)
    page.get_by_role("button", name="지도로 돌아가기").click()
    expect(work).to_be_hidden()
    page.wait_for_timeout(300)
    assert page.locator("#world").evaluate(CAMERA) == mapped
    assert page.evaluate("[...document.getElementById('space').children].every(e => !e.inert)")
    page.keyboard.press("Escape")
    expect(page.locator("#lens")).to_be_hidden()
    # A narrow window: the workspace and the request sheet take the whole width; back to 1280.
    page.locator(".ps-more").click()
    page.set_viewport_size({"width": 700, "height": 700})
    page.wait_for_timeout(200)
    assert work.bounding_box()["width"] == 700
    assert page.evaluate("document.documentElement.scrollWidth") <= 700
    page.get_by_role("button", name="요청문 만들기").click()
    assert page.locator("#plan-sheet").bounding_box()["width"] >= 600
    page.keyboard.press("Escape")
    expect(page.locator("#plan-sheet")).to_be_hidden()
    page.set_viewport_size({"width": 1280, "height": 720})
    page.wait_for_timeout(200)
    page.keyboard.press("Escape")  # the workspace gives the map back
    expect(work).to_be_hidden()
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
    relations record a visit; a visit that changed scene goes back by the context row's existing back too, and the pane's line
    takes the same way."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    back = page.locator("#lens .visit-line")
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
    # (a shorter window, so the summary scrolls; a plain relation's ends read as one group, so the summary is short).
    page.set_viewport_size({"width": 1280, "height": 500})
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
    page.locator("#lens .visit-line").wait_for()
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
    page.wait_for_timeout(400)
    came_from = page.locator("#world").evaluate(CAMERA)
    page.locator("#lens .port", has_text="수신 · traces").click()
    expect(back).to_have_accessible_name(long + "으로 돌아가기")
    # A long name (UI67, intended): the way back wraps instead of cutting the name. The whole name reads in the pane as one
    # sentence with its arrow, the scene it came from is its own line under it, and the title and body still follow close below.
    box, pane = back.bounding_box(), page.locator("#lens").bounding_box()
    assert pane["x"] <= box["x"] and box["x"] + box["width"] <= pane["x"] + pane["width"] - 16, (box, pane)
    expect(back.locator("strong")).to_have_text(long)
    expect(back.locator(".vl-where")).to_have_text("전체 지도")
    name, where = back.locator("strong").bounding_box(), back.locator(".vl-where").bounding_box()
    assert where["y"] >= name["y"] + name["height"] - 1, (name, where)
    assert back.locator(".vl-where").evaluate("e => e.scrollWidth <= e.clientWidth")
    title = page.locator("#lens-title").bounding_box()
    assert box["y"] + box["height"] <= title["y"] and title["y"] - pane["y"] <= 140, (box, title, pane)
    back.click()
    expect(page.locator("#lens-title")).to_have_text(long)
    page.wait_for_timeout(500)
    assert page.locator("#world").evaluate(CAMERA) == came_from
    # Out of the scope from a part: the scene changes; the context row's back and the pane's line (where the reader looks) are
    # the same way back, and it brings the part, its camera and the reading back; the folds the visit opened close again.
    page.locator(".frame-head", has_text="정적 실행본 대응").locator(".enter").click()
    in_scope(page, "정적 실행본 대응")
    page.locator("#world .node", has_text="수신 · traces").click()
    page.wait_for_timeout(400)
    inside = page.locator("#world").evaluate(CAMERA)
    page.locator("#lens .port", has_text="수신 설정 ID").click()
    expect(page.locator("#lens-title")).to_have_text("수신 설정 ID")
    in_scope(page, "구성 ID 정의")
    expect(back).to_have_accessible_name("수신 · traces로 돌아가기")
    expect(back).to_contain_text("정적 실행본 대응")
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
    expect(back).to_have_accessible_name("@joplin/app-desktop(으)로 돌아가기")  # followed from the scope's own reading
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


def record_fixtures():
    """EXPERIENCE69: a saved-project backup with two parts both named '보정' (PC app, device firmware), made by the shared generator."""
    out = pathlib.Path(tempfile.mkdtemp(prefix="record69-")) / "cases"
    subprocess.run(["node", str(ROOT / "tests/record69-fixtures.mjs"), "--out", str(out)], cwd=APP, check=True, stdout=subprocess.DEVNULL)
    return out / "record69-same-name.json"


ENTRY = "key => JSON.parse(localStorage.getItem('agentflow.idea015.workspace')).entries.find(e => e.entryId === key).project"


def record_flow(browser, base, backup):
    """EXPERIENCE69: one record pasted as it came, from a selected part, read on request, beside the same map. The draft survives
    leaving the box and a reload; the saved text is exact and the canonical structure (parts, notes, relations, containment,
    records, tasks) is untouched by saving, reading or a repeat; the looked-at part is context only (never a location in the
    request); same-named candidates read apart and mark the right part; a quote opens the original with the way back pinned;
    closing comes back to the selection and camera it began from; a key-like text is neither saved nor kept as a draft; the
    reading is kept across a reload without a call; a backup carries the record and its copy shows none of the original's
    readings. Stubbed provider (synthetic sample): contract, storage and round trips, not reading quality."""
    text = (ROOT / "tests/fixtures/record69/synthetic-calibration.txt").read_text(encoding="utf-8")
    first_line = text.split("\n")[0].strip()
    device_line = next(l.strip() for l in text.split("\n") if l.strip().startswith("2)"))[:160].strip()
    context = browser.new_context(viewport={"width": 1280, "height": 720}, accept_downloads=True)
    page = context.new_page()
    errors, calls = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: calls.append(r.post_data_json) if r.url.endswith("/api/studio/digest") else None)
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(backup))
    page.wait_for_url(re.compile(r"#/p/E_"))
    entry = re.search(r"#/p/(E_[^/]+)", page.url).group(1)
    before = page.evaluate(ENTRY, entry)
    canonical = lambda p: json.dumps([p["space"], p["sources"], p["tasks"], p["bases"]], sort_keys=True, ensure_ascii=False)
    pc, dev = '#world .node[data-part="A_r69_pccal"]', '#world .node[data-part="A_r69_devcal"]'

    # The same box from a selected part; the part is named as context, apart from its same-named twin.
    page.locator(pc).click()
    expect(page.locator("#lens-title")).to_have_text("보정")
    page.locator("#lens .more summary").click()
    page.get_by_role("menuitem", name="기록 붙여넣기").click()
    expect(page.locator("#paste-text")).to_be_visible()
    expect(page.locator("#lens .rr-context .rr-part")).to_have_text("PC 앱 · 보정")
    pane_beside_map(page); no_page_scroll(page)
    head = text[:60]
    page.locator("#paste-text").fill(head)
    page.locator("#lens .rr-back").click()
    expect(page.locator("#paste-text")).to_have_count(0)
    page.locator("#lens .rr-paste-open").click()
    assert page.locator("#paste-text").input_value() == head, "the draft survives leaving the box"
    page.reload()
    page.locator(pc).click()
    expect(page.locator("#lens-title")).to_have_text("보정")
    page.wait_for_timeout(400)
    url0, cam0 = page.url, page.locator("#world").evaluate(CAMERA)
    page.locator("#lens .more summary").click()
    page.get_by_role("menuitem", name="기록 붙여넣기").click()
    assert page.locator("#paste-text").input_value() == head, "the draft survives a reload"
    page.locator("#paste-text").fill(text)
    page.get_by_role("button", name="기록 저장").click()

    # Saved exactly, as one record with its context; nothing canonical changed and nothing was sent.
    expect(page.locator("#lens .rr-raw")).to_be_visible()
    assert page.locator("#lens .rr-raw").evaluate("e => e.textContent") == text
    saved = page.evaluate(ENTRY, entry)
    assert [(r["text"], r["context"]) for r in saved["pasted"]] == [(text, "A_r69_pccal")]
    assert canonical(saved) == canonical(before) and saved["revision"] == before["revision"] + 1
    assert calls == [], "saving never calls"

    # Read on request: one call, digest.2, the record whole and unlocated, its context only in the note.
    page.get_by_role("button", name="붙인 기록 요약").click()
    expect(page.locator("#lens .rr-records")).to_be_visible()
    assert len(calls) == 1
    ask = calls[0]
    assert ask["schemaVersion"] == "studio.digest.2"
    record = ask["sources"][0]
    assert record["kind"] == "record" and record["partIds"] == [] and record["text"] == text and "PC 앱 · 보정" in record["note"]
    # The reading: its own heading, the record's first line under it, no 'no result material' line for a read record.
    expect(page.locator("#lens .rr-records > h3")).to_have_text("붙여넣은 기록에서")
    expect(page.locator("#lens .rr-map > h3")).to_contain_text("지도 정리")
    expect(page.locator("#lens .rr-rec-src")).to_have_text(first_line)
    expect(page.locator("#lens .rr-none")).to_have_count(0)
    expect(page.locator("#lens .rr-part.cand")).to_have_text(["PC 앱 · 보정", "장치 펌웨어 · 보정"])
    expect(page.get_by_role("button", name="장치 펌웨어 · 보정", exact=True)).to_have_count(1)
    expect(page.locator("#lens .rr-why")).to_have_count(0)  # reasons stay folded until a candidate is chosen
    page.locator("#lens .rr-part.cand", has_text="장치 펌웨어 · 보정").click()
    expect(page.locator("#lens .rr-why")).to_have_count(1)
    expect(page.locator("#lens .rr-rec").nth(2).locator(".rr-why")).to_have_text("장치 펌웨어 · 보정 · [스텁] 원문 줄에 이 부분과 부모 이름이 있음")
    expect(page.locator("#lens .rr-part.cand.on")).to_have_attribute("aria-pressed", "true")
    expect(page.locator("#world .read-mark")).to_have_count(1)
    expect(page.locator("#world .read-mark")).to_have_attribute("data-part", "A_r69_devcal")
    page.wait_for_timeout(400)  # after the smallest pan that brings it beside the pane
    in_map(page, dev)

    # The record itself: its readings, then the text exactly as pasted.
    page.locator("#lens .rr-rec-src").click()
    expect(page.locator("#lens .rr-records > h3")).to_have_text("이 기록에서 읽은 것")
    assert page.locator("#lens .rr-raw").evaluate("e => e.textContent") == text
    page.locator("#lens .rr-back").click()

    # A quote opens the original with the quote marked (not the readings again); the way back stays in view while it scrolls.
    page.locator("#lens .rr-rec").nth(2).locator(".rr-cite").click()
    expect(page.locator("#lens .rr-mark")).to_have_text(device_line)
    expect(page.locator("#lens .rr-records")).to_have_count(0)
    page.locator("#lens .lens-body").evaluate("e => { e.scrollTop = e.scrollHeight; }")
    expect(page.locator("#lens .rr-back")).to_be_in_viewport()
    page.locator("#lens .rr-back").click()
    expect(page.locator("#lens .rr-records > h3")).to_have_text("붙여넣은 기록에서")
    expect(page.locator("#lens .rr-map > h3")).to_contain_text("지도 정리")
    # Back from the quote: the chosen candidate, its reason and its mark are still there.
    expect(page.locator("#lens .rr-rec").nth(2).locator(".rr-why")).to_contain_text("장치 펌웨어 · 보정")
    expect(page.locator("#world .read-mark")).to_have_attribute("data-part", "A_r69_devcal")
    # By keyboard: the other candidate takes its place (one reason at a time), focus stays on it.
    page.locator("#lens .rr-part.cand", has_text="PC 앱 · 보정").focus()
    page.keyboard.press("Enter")
    expect(page.locator("#lens .rr-why")).to_have_count(1)
    expect(page.locator("#lens .rr-rec").nth(1).locator(".rr-why")).to_contain_text("PC 앱 · 보정")
    expect(page.locator("#lens .rr-part.cand", has_text="PC 앱 · 보정")).to_be_focused()
    expect(page.locator("#world .read-mark")).to_have_attribute("data-part", "A_r69_pccal")

    # Closing comes back to the scene the paste began from: same part selected, same camera; reading wrote nothing.
    page.locator("#lens .rr-head .close").click()
    expect(page).to_have_url(url0)
    expect(page.locator("#lens-title")).to_have_text("보정")
    page.wait_for_timeout(400)
    assert page.locator("#world").evaluate(CAMERA) == cam0
    assert canonical(page.evaluate(ENTRY, entry)) == canonical(before)

    # The same text again is the same record: told so, nothing added, no call.
    page.locator("#lens .more summary").click()
    page.get_by_role("menuitem", name="기록 붙여넣기").click()
    page.locator("#paste-text").fill(text)
    page.get_by_role("button", name="기록 저장").click()
    expect(page.locator("#lens .rr-foot p[role=status]")).to_contain_text("새로 저장하지 않았어요")
    again = page.evaluate(ENTRY, entry)
    assert len(again["pasted"]) == 1 and again["revision"] == saved["revision"] and len(calls) == 1

    # A key-like text is refused, the box stays editable, and it is not kept as a draft in this browser.
    page.locator("#lens .rr-paste-open").click()
    fake = "보고 끝\nAPI_KEY=sk-" + "Z" * 26
    page.locator("#paste-text").fill(fake)
    page.get_by_role("button", name="기록 저장").click()
    expect(page.locator("#lens .rr-paste-box [role=alert]")).to_contain_text("저장하지 않았어요")
    assert "sk-Z" not in (page.evaluate("() => localStorage.getItem('agentflow.studio.paste-draft.1')") or "")
    assert len(page.evaluate(ENTRY, entry)["pasted"]) == 1
    page.locator("#paste-text").fill("")

    # Reload: the record and its reading are found again, without a call.
    page.reload()
    page.locator("#return-entry").click()
    expect(page.locator("#lens .rr-records")).to_be_visible()
    expect(page.locator("#lens .rr-part.cand")).to_have_count(2)
    assert len(calls) == 1

    # Backup retains project-owned map readings and raw records, but never this entry's separate digest cache.
    page.goto(base + "/")
    # The home card counts the pasted record apart from work records; it never reads as having none.
    expect(page.locator("#saved-list .program-meta")).to_contain_text("붙인 기록 1")
    expect(page.locator("#saved-list .program-meta")).not_to_contain_text("기록 없음")
    with page.expect_download() as download:
        page.locator("#saved-list .program-backup").first.click()
    path = download.value.path()
    data = json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
    assert data["id"] == "P_record69_same_name" and [(r["text"], r["context"]) for r in data["pasted"]] == [(text, "A_r69_pccal")]
    assert "digest" not in data, "the separate digest cache is not part of a backup"
    assert data["readings"] == [], "record_flow only summarised a record; it never read it into the map"
    assert data["space"] == before["space"] and data["sources"] == before["sources"] and data["tasks"] == before["tasks"]
    page.locator("#import-file").set_input_files(path)
    page.wait_for_url(lambda u: "#/p/E_" in u and entry not in u)
    copy = re.search(r"#/p/(E_[^/]+)", page.url).group(1)
    copied_project = page.evaluate(ENTRY, copy)
    assert copied_project["pasted"] == saved["pasted"] and copied_project["readings"] == data["readings"]
    page.locator("#return-entry").click()
    expect(page.locator("#lens .rr-head")).to_be_visible()
    expect(page.locator("#lens .rr-lead")).to_have_text("아직 이 자료를 정리하지 않았어요.")
    expect(page.locator("#lens .rr-records")).to_have_count(0)
    expect(page.locator("#lens .rr-src").first).to_contain_text(first_line)
    assert len(calls) == 1 and errors == [], errors
    context.close()


DRAWN = "() => [...document.querySelectorAll('#world [data-box]')].map(e => e.dataset.box).sort().join('|')"


def record_fold_flow(browser, base, cases):
    """EXPERIENCE69: a chosen candidate inside a folded group is shown on the same map. Node-RED's 10-mqtt.js sits in
    network, folded by default: nothing unfolds when the reading comes, choosing the candidate unfolds only its path and
    marks the part itself (not the folded group), the choice holds through a quote and back, another candidate or letting it
    go folds that path again, and closing comes back to the scene with the folds and camera it had. Stubbed provider."""
    text = (ROOT / "tests/fixtures/record69/node-red-pr6019.txt").read_text(encoding="utf-8")
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    digest_responses = []
    page.on("response", lambda r: digest_responses.append(r) if r.url.endswith("/api/studio/digest") else None)
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(cases / "oss-node-red.json"))
    page.wait_for_url(re.compile(r"#/p/E_"))
    mqtt, change, network = (f'#world .node[data-part="A_oss-node-red_{k}"]' for k in ("10-mqtt", "15-change", "network"))
    page.locator(network).click()
    expect(page.locator("#lens-title")).to_have_text("network")
    page.wait_for_timeout(400)
    url0, cam0, drawn0 = page.url, page.locator("#world").evaluate(CAMERA), page.evaluate(DRAWN)
    expect(page.locator(mqtt)).to_have_count(0)  # inside the folded group
    page.locator("#lens .more summary").click()
    page.get_by_role("menuitem", name="기록 붙여넣기").click()
    page.locator("#paste-text").fill(text)
    page.get_by_role("button", name="기록 저장").click()
    page.get_by_role("button", name="붙인 기록 요약").click()
    try:
        expect(page.locator("#lens .rr-records")).to_be_visible()
    except AssertionError as failure:
        http = [{"status": r.status, "body": r.text()[:600]} for r in digest_responses]
        raise AssertionError(f"record_fold summary missing: http={http}, pageerrors={errors}, lens={page.locator('#lens').inner_text()[:1800]!r}") from failure
    # The reading alone unfolds nothing.
    expect(page.locator(mqtt)).to_have_count(0)
    assert page.evaluate(DRAWN) == drawn0
    # Choosing the candidate: its path opens, the part itself is drawn, marked and brought beside the pane; its reason reads.
    page.locator("#lens .rr-part.cand", has_text="10-mqtt.js").click()
    expect(page.locator(mqtt)).to_be_visible()
    expect(page.locator("#world .read-mark")).to_have_count(1)
    expect(page.locator(mqtt)).to_have_class(re.compile(r"\bread-mark\b"))
    expect(page.locator("#lens .rr-rec").nth(1).locator(".rr-why")).to_contain_text("10-mqtt.js")
    page.wait_for_timeout(400)
    in_map(page, mqtt)
    # A quote and back: the same part stays open and marked, with its reason.
    page.locator("#lens .rr-rec").nth(1).locator(".rr-cite").click()
    expect(page.locator("#lens .rr-mark")).to_be_visible()
    expect(page.locator(mqtt)).to_have_class(re.compile(r"\bread-mark\b"))
    page.locator("#lens .rr-back").click()
    expect(page.locator(mqtt)).to_have_class(re.compile(r"\bread-mark\b"))
    expect(page.locator("#lens .rr-rec").nth(1).locator(".rr-why")).to_contain_text("10-mqtt.js")
    # Another candidate: the first path folds again, the other opens; letting it go folds everything back as it was.
    page.locator("#lens .rr-part.cand", has_text="15-change.js").click()
    expect(page.locator(change)).to_have_class(re.compile(r"\bread-mark\b"))
    expect(page.locator(mqtt)).to_have_count(0)
    page.locator("#lens .rr-part.cand", has_text="15-change.js").click()
    expect(page.locator(change)).to_have_count(0)
    assert page.evaluate(DRAWN) == drawn0
    # Closing with a candidate open: back to the part, the folds and the camera the paste began from.
    page.locator("#lens .rr-part.cand", has_text="10-mqtt.js").click()
    expect(page.locator(mqtt)).to_be_visible()
    page.locator("#lens .rr-head .close").click()
    expect(page).to_have_url(url0)
    expect(page.locator("#lens-title")).to_have_text("network")
    expect(page.locator(mqtt)).to_have_count(0)
    page.wait_for_timeout(400)
    assert page.evaluate(DRAWN) == drawn0
    assert page.locator("#world").evaluate(CAMERA) == cam0
    assert errors == [], errors
    page.close()


def map70_flow(browser, base):
    """EXPERIENCE70: a new project's first map from a pasted record (saving sends nothing; reading into the map is the one action
    that sends), then select -> quote -> back to the part, the person's rename, place and plan draft kept, a later record updating
    the same part, and the change plan reading the pasted text as kind 'record' and the derived understanding as 'reading'.
    Stubbed model (labelled '[스텁]'): layout and round trips only, not reading quality."""
    cli = (ROOT / "tests/fixtures/record70/synthetic-cli.txt").read_text(encoding="utf-8")
    later = (ROOT / "tests/fixtures/record70/synthetic-cli-later.txt").read_text(encoding="utf-8")
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    errors, sent = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: sent.append(r.url) if r.url.endswith("/api/studio/map") else None)
    page.goto(base + "/")
    page.locator("#new-open").click()
    page.locator("#new-name").fill("지도 프로젝트")
    page.locator("#new-form").get_by_role("button", name="만들기").click()
    entry = page.locator("#space-empty")
    expect(entry).to_contain_text("기록으로 첫 지도를 만들어요")
    expect(entry).to_contain_text("저장만 해서는 AI에 보내지 않아요")
    # Paste and save: kept in the project, nothing sent.
    entry.get_by_role("button", name="기록 붙여넣기").click()
    page.locator("#paste-text").fill(cli)
    expect(page.locator("#lens .rr-foot")).to_contain_text("저장해도 AI에 보내지 않아요")
    page.locator("#lens").get_by_role("button", name="기록 저장").click()
    expect(page.locator("#lens .rr-map")).to_be_visible()
    assert sent == [], sent
    # The one action that sends says what it sends, then the map is there; the pane says what was understood.
    expect(entry.locator(".fine")).to_contain_text("기록 1개를 AI에 보내요")
    # One main action while records wait for the map; the separate summary steps back.
    expect(page.locator("#lens").get_by_role("button", name="붙인 기록 요약")).to_have_class(re.compile("secondary"))
    entry.get_by_role("button", name="기록으로 지도 정리").click()
    expect(page.locator("#world .node")).to_have_count(3)
    assert len(sent) == 1, sent
    expect(entry).to_be_hidden()
    # The map is what one reads now: the pane closes, the title line says what was understood, the new parts are marked.
    expect(page.locator("#lens")).to_be_hidden()
    expect(page.locator("#world .map-understood")).to_contain_text("[스텁]")
    expect(page.locator("#world .node.read-mark")).to_have_count(3)
    page.locator("#world .map-understood").get_by_role("button", name="근거").click()
    expect(page.locator("#lens .rr-map .rm-summary")).to_contain_text("[스텁]")
    page.locator("#lens .rr-head .close").click()
    no_page_scroll(page)
    # Select -> the description and a claim -> its quote, marked -> back to the same part.
    page.locator("#world .node", has_text="스텁 부분 1").click()
    expect(page.locator("#lens-title")).to_have_text("스텁 부분 1")
    expect(page.locator("#lens .lens-src")).to_contain_text("기록에서 읽은 설명")
    expect(page.locator("#lens .claims .claim")).to_have_count(1)
    page.locator("#lens .claims .cl-cite").first.click()
    expect(page.locator("#lens .rr-mark")).to_contain_text("요구:")
    # The way back at the top names the part the quote was opened from, and goes back to it.
    expect(page.locator("#lens .rr-back")).to_have_text(re.compile("스텁 부분 1"))
    page.locator("#lens .rr-back").click()
    expect(page.locator("#lens-title")).to_have_text("스텁 부분 1")
    # The person's own name, place and plan draft.
    page.locator(".more summary:visible").click()
    page.get_by_role("menuitem", name="이름·설명 고치기").click()
    page.locator("#edit-name").fill("변환기")
    page.locator(".edit-form").get_by_role("button", name="저장").click()
    expect(page.locator("#world .node", has_text="변환기")).to_have_count(1)
    page.keyboard.press("Escape")
    drag(page, page.locator("#world .node", has_text="스텁 부분 2"), 140, 60)
    placed = page.locator("#world .node", has_text="스텁 부분 2").evaluate("e => e.style.left + ',' + e.style.top")
    page.locator("#plan-entry").click()
    # The material the analysis would read is counted before a sentence is written, and follows typing without a re-render.
    expect(page.locator(".pp-sources-count").first).to_have_text(re.compile(r"읽는 자료 [1-9]\d*개"))
    page.locator("#plan-intent").click()
    page.keyboard.type("폴더째 변환하고 싶어")
    assert page.evaluate("() => document.activeElement === document.getElementById('plan-intent')")
    page.locator("#plan-entry").click()
    # A later record: saved, then read into the same map; the renamed part keeps its name and the moved one its place.
    page.locator("#return-entry").click()
    page.locator("#lens .rr-paste-open").click()
    page.locator("#paste-text").fill(later)
    page.locator("#lens").get_by_role("button", name="기록 저장").click()
    assert len(sent) == 1, sent
    page.locator("#lens .rr-map").get_by_role("button", name="기록 읽고 지도 갱신").click()
    expect(page.locator("#world .map-understood")).to_contain_text("첫 부분")
    assert len(sent) == 2, sent
    expect(page.locator("#world .node")).to_have_count(3)
    expect(page.locator("#world .node", has_text="변환기")).to_have_count(1)
    assert page.locator("#world .node", has_text="스텁 부분 2").evaluate("e => e.style.left + ',' + e.style.top") == placed
    page.locator("#world .node", has_text="변환기").click()
    expect(page.locator("#lens .claims .claim")).to_have_count(2)
    # The change plan: the draft kept; the pasted text goes as 'record', what was read as 'reading'.
    page.keyboard.press("Escape")
    bodies = []
    def plan(route):
        bodies.append(json.loads(route.request.post_data))
        route.fulfill(status=503, content_type="application/json", body=json.dumps({"error": {"code": "AI_UNAVAILABLE"}}))
    page.route("**/api/studio/plan", plan)
    page.locator("#plan-entry").click()
    expect(page.locator("#plan-intent")).to_have_value("폴더째 변환하고 싶어")
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-panel .pp-error")).to_be_visible()
    kinds = {e["kind"] for e in bodies[0]["evidence"]}
    assert {"record", "reading"} <= kinds and [e["text"] for e in bodies[0]["evidence"] if e["kind"] == "record"] == [later, cli], kinds
    page.unroute("**/api/studio/plan")
    # Reload: the map, the reading and the person's edits come back from the saved project.
    page.reload()
    expect(page.locator("#world .node")).to_have_count(3)
    expect(page.locator("#world .map-understood")).to_contain_text("[스텁]")
    assert not errors, errors
    context.close()


def text_digest(t):
    """span.2 textDigest (evidence-span.ts): two FNV-1a lanes over UTF-16 code units, as the server names the body it read."""
    units = [int.from_bytes(t.encode("utf-16-le")[i:i + 2], "little") for i in range(0, len(t.encode("utf-16-le")), 2)]
    m = 0xffffffff
    a, b = 0x811c9dc5, (0x01000193 ^ len(units)) & m
    for i, c in enumerate(units):
        a = ((a ^ c) * 0x01000193) & m
        b = (((b ^ c ^ (i & 0xff)) * 0x01000193) & m) ^ (a >> 13)
    return f"f1-{a:08x}{b:08x}"


def request71_flow(browser, base):
    """EXPERIENCE71: first map -> own demand -> frozen request -> plain partial report -> one combined map read ->
    wanted/reported/unanswered beside the same part -> exact quote and back -> durable exclusion. Written HTTP replies,
    labelled '[스텁]', test the actual UI and storage path, not AI reading quality. No direct localStorage seeding."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    errors, maps = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/")
    page.locator("#new-open").click()
    page.locator("#new-name").fill("요청과 부분 보고")
    page.locator("#new-form").get_by_role("button", name="만들기").click()
    page.wait_for_url(re.compile(r"#/p/E_"))
    entry_id = re.search(r"#/p/(E_[^/]+)", page.url).group(1)
    page.locator("#space-empty").get_by_role("button", name="기록 붙여넣기").click()
    page.locator("#paste-text").fill("작업 보고: 변환 명령으로 단일 문서를 PDF로 내보냅니다.")
    page.locator("#lens").get_by_role("button", name="기록 저장").click()
    page.locator("#space-empty").get_by_role("button", name="기록으로 지도 정리").click()
    expect(page.locator("#world .node")).to_have_count(1)
    area = page.locator("#world .node").get_attribute("data-part")

    def analysis(route):
        ask = route.request.post_data_json
        items = [{"id": f"I{i + 1}", "title": title, "description": description, "partIds": [ask["parts"][0]["id"]], "refs": ["INTENT"], "dependsOn": []}
                 for i, (title, description) in enumerate([("폴더 입력", "폴더 안 파일을 입력받는다."), ("실패 후 계속", "한 파일이 실패해도 다음 파일은 계속한다."), ("성공 유지·실패 모음", "성공 결과를 유지하고 실패를 모아 본다.")])]
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": {"summary": "[스텁] 폴더 변환의 세 요구", "items": items, "impacts": [], "preserve": ["기존 내용 보존"], "unknowns": []}}))
    page.route("**/api/studio/plan", analysis)
    page.route("**/api/studio/scope", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": {"summary": "[스텁] 선택 범위", "prerequisites": [], "unknowns": []}})))
    page.locator("#plan-entry").click()
    intent = "폴더 입력, 한 파일 실패 후 계속, 성공 유지와 실패 모음을 원해."
    page.locator("#plan-intent").fill(intent)
    page.locator("#plan-ask").click()
    expect(page.locator(".ps-intent")).to_have_text(intent)
    page.locator(".ps-more").click()
    page.locator("#plan-make").click()
    expect(page.locator(SHEET_BODY)).to_contain_text("폴더 입력")  # AF94: new documents open on their sections
    frozen_before = page.evaluate("() => JSON.parse(localStorage.getItem('agentflow.studio.plans.1'))")
    project = page.evaluate(ENTRY, entry_id)
    bundle = frozen_before["projects"][project["id"]]
    assert len(bundle["snapshots"]) == 1 and len(bundle["snapshots"][0]["scope"]["items"]) == 3
    rq = bundle["snapshots"][0]["id"]
    page.keyboard.press("Escape")
    page.get_by_role("button", name=re.compile(r"^돌아온 기록 · 요청문")).click()
    page.get_by_role("button", name="보고 원문 붙여넣기").click()
    expect(page.locator("#obs-item")).to_have_count(0)
    report = "작업 보고: feature/folder@abc1234에서 폴더 안 파일을 받는 입력을 바꿨습니다. 기존 단일 문서 검사 3개 통과."
    page.locator("#paste-text").fill(report)
    page.locator("#lens").get_by_role("button", name="기록 저장").click()
    assert maps == [], "saving the report does not read or classify it"
    def returned(route):
        ask = route.request.post_data_json
        maps.append(ask)
        # studio.map.6 (the stub server's status names m6): span.2 aliases and the exact request body remain bound.
        assert ask["schemaVersion"] == "studio.map.6" and ask["requests"][0]["id"] == rq and ask["priors"] == []
        rec = next(r for r in ask["records"] if "feature/folder" in "".join(x["t"] for x in r["spans"]))
        at = lambda words: next(x["s"] for x in rec["spans"] if x["t"].strip().startswith(words))
        match = {"at": at("작업 보고: feature/folder"), "text": "[스텁] 폴더 입력 변경 보고", "kind": "reported", "about": "feature/folder@abc1234", "targets": [{"requestId": rq, "itemId": "I1"}], "why": "[스텁] 입력 요구에 대응하는 구절", "stance": "made", "replaces": None}
        check = {**match, "kind": "checked", "stance": "unclear", "at": at("기존 단일 문서 검사"), "text": "[스텁] 단일 문서 검사만 통과했다고 보고함"}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "evidence": {"index": "span.2", "ask": text_digest(route.request.post_data)},
            "reply": {"summary": "[스텁] 폴더 입력만 부분 보고됨", "parts": [], "relations": [], "candidates": [], "gaps": [], "matches": [match, check], "material": []}}))
    page.route("**/api/studio/map", returned)
    page.locator("#lens .rr-map").get_by_role("button", name="기록 읽고 지도 갱신").click()
    expect(page.locator("#world .map-understood")).to_contain_text("폴더 입력만 부분 보고됨")
    expect(page.locator("#world .mu-comparison")).to_contain_text("원한 항목 3개 · 변경 보고 1개 · 변경 근거 아직 없는 항목 2개")
    assert len(maps) == 1
    assert page.evaluate("() => JSON.parse(localStorage.getItem('agentflow.studio.plans.1'))") == frozen_before, "return reading never writes the plan sidecar"
    page.locator(f'#world .node[data-part="{area}"]').click()
    expect(page.locator("#lens .request-item")).to_have_count(3)
    expect(page.locator("#lens .request-item > summary").nth(0)).to_contain_text("폴더 입력 변경 보고")
    expect(page.locator("#lens .request-item > summary").nth(1)).to_contain_text("연결된 원문 구절 없음")
    expect(page.locator("#lens .request-item > summary").nth(2)).to_contain_text("연결된 원문 구절 없음")
    page.locator("#lens .request-item > summary").first.click()
    expect(page.locator("#lens .request-passage").first).to_contain_text("feature/folder@abc1234")
    page.wait_for_timeout(300)
    url0, camera0 = page.url, page.locator("#world").evaluate(CAMERA)
    page.locator("#lens .request-passage", has_text="폴더 입력 변경 보고").get_by_role("button", name="근거", exact=True).click()
    expect(page.locator("#lens .rr-mark")).to_have_text("작업 보고: feature/folder@abc1234에서 폴더 안 파일을 받는 입력을 바꿨습니다.")
    page.locator("#lens .rr-back").click()
    expect(page).to_have_url(url0)
    page.wait_for_timeout(300)
    assert page.locator("#world").evaluate(CAMERA) == camera0
    # The correction is optional and local to this correspondence; it never changes the request or the map's role.
    expect(page.locator("#lens .request-item").first).to_have_attribute("open", "")
    expect(page.locator("#lens .request-passage", has_text="폴더 입력 변경 보고").get_by_role("button", name="근거", exact=True)).to_be_focused()
    page.locator("#lens .request-fix > summary").first.click()
    page.locator("#lens .request-fix select").first.select_option("")
    page.locator("#lens .request-fix").first.get_by_role("button", name="저장").click()
    expect(page.locator("#lens .request-excluded > summary")).to_contain_text("제외한 대응 1개")
    saved = page.evaluate(ENTRY, entry_id)
    assert saved["readings"][-1]["version"] == "request-correction.1" and saved["readings"][-1]["target"] is None
    assert not saved["tasks"] and not saved["sources"]
    page.reload()
    page.locator(f'#world .node[data-part="{area}"]').click()
    expect(page.locator("#lens .request-excluded > summary")).to_contain_text("제외한 대응 1개")
    no_page_scroll(page)
    assert len(maps) == 1 and not errors, errors
    # A project backup carries the full frozen RQ, the map read and the user's override; digest caches stay separate.
    page.goto(base + "/")
    with page.expect_download() as download:
        page.locator("#saved-list .program-backup").first.click()
    data = json.loads(pathlib.Path(download.value.path()).read_text(encoding="utf-8"))
    assert data["readings"] == saved["readings"] and data["space"] == saved["space"] and data["pasted"] == saved["pasted"]
    assert "digest" not in data
    assert any(r.get("requests", [{}])[0].get("id") == rq for r in data["readings"] if r.get("requests"))
    # An explicitly imported old-format request has its original words and direct observation entry, without auto CTA.
    page.goto(url0)
    page.locator("#plan-entry").click()
    legacy = json.loads(json.dumps(bundle))
    old = legacy["snapshots"][0]
    old_id = old["id"]
    old["id"], old["text"] = "RQ_legacy_fixture", "이전 형식 요청 원문: 폴더 입력과 실패 후 계속, 성공 유지."
    del old["scope"]
    del old["reading"]  # AF94: a document made here carries its reading; no .1-.3 writer kept one (a .1 file with it is refused)
    del legacy["authoring"]  # an old-format file holds the bundle's original nine keys (AF84: authoring only from format .3)
    legacy["labels"][old["id"]] = legacy["labels"].pop(old_id)
    legacy["origins"][old["id"]] = legacy["origins"].pop(old_id)
    file = {"format": "agentflow.change-plan-file.1", "project": {"id": project["id"], "name": project["name"]}, "bundle": legacy}
    page.once("dialog", lambda dialog: dialog.accept())
    page.locator("#plan-import-file").set_input_files({"name": "legacy-request.json", "mimeType": "application/json", "buffer": json.dumps(file).encode("utf-8")})
    # The import ends asynchronously and the plan stays on its strip (the panel is hidden): wait for the stored bundle, not a panel.
    page.wait_for_function("([id, rq]) => JSON.parse(localStorage.getItem('agentflow.studio.plans.1')).projects[id].snapshots[0]?.id === rq", arg=[project["id"], old["id"]])
    imported = page.evaluate("() => JSON.parse(localStorage.getItem('agentflow.studio.plans.1'))")["projects"][project["id"]]["snapshots"]
    assert [x["id"] for x in imported] == [old["id"]] and imported[0]["text"] == old["text"] and "scope" not in imported[0] and "reading" not in imported[0], imported
    page.locator(".ps-more").click()
    # Its message is in the plan's footer, shown with the wide comparison: imported, not refused with the earlier request kept.
    expect(page.locator("#plan-panel")).to_contain_text("변경안 파일을 가져왔어요.")
    page.get_by_role("button", name=re.compile(r"^돌아온 기록 · 요청문")).click()
    expect(page.locator(".pp-results")).to_contain_text("이전 형식 요청문이라 보고가 자동 대응되지 않아요")
    expect(page.locator(".pp-results").get_by_role("button", name="보고 원문 붙여넣기")).to_have_count(0)
    page.locator(".pp-results").get_by_role("button", name="돌아온 기록 직접 붙이기").click()
    page.locator("#obs-item").select_option("I1")
    page.locator("#obs-text").fill("[스텁] 이전 요청의 직접 기록")
    page.locator("#obs-basis").fill("사용자가 직접 대응한 보고")
    page.locator(".pp-results .pp-add").get_by_role("button", name="붙이기", exact=True).click()
    kept = page.evaluate("() => JSON.parse(localStorage.getItem('agentflow.studio.plans.1'))")["projects"][project["id"]]
    assert "scope" not in kept["snapshots"][0] and kept["snapshots"][0]["text"] == old["text"]
    assert kept["observations"][-1]["text"] == "[스텁] 이전 요청의 직접 기록" and kept["attached"][kept["observations"][-1]["id"]] == old["id"]
    context.close()


def uncertainty76_flow(browser, base):
    """AF76: a first map whose candidate leaves a report's part open (target attribution, its own at null, the statement with its
    place). The map row reads the open label and the statement's kind and words beside it (never as a settled claim of a part),
    gives the statement's exact passage, and the way back comes to that same passage button. Written reply (labelled '[스텁]')."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/")
    page.locator("#new-open").click()
    page.locator("#new-name").fill("귀속 미정 프로젝트")
    page.locator("#new-form").get_by_role("button", name="만들기").click()
    text = "보정 작업 정리입니다.\nPC 앱의 보정 화면은 소수점 둘째 자리까지 받습니다."
    page.locator("#space-empty").get_by_role("button", name="기록 붙여넣기").click()
    page.locator("#paste-text").fill(text)
    page.locator("#lens").get_by_role("button", name="기록 저장").click()
    def returned(route):
        ask = route.request.post_data_json
        assert ask["schemaVersion"] == "studio.map.6", ask["schemaVersion"]
        spans = ask["records"][0]["spans"]
        at = lambda words: next(x["s"] for x in spans if x["t"].strip().startswith(words))
        reply = {"summary": "[스텁] PC 앱 보정 화면의 입력 범위를 읽은 자리예요.", "relations": [], "gaps": [], "matches": [], "material": [],
            "parts": [{"ref": "new:pc", "name": "PC 보정 화면", "parent": None, "role": "[스텁] 보정 값을 입력받는다.", "roleAbout": None, "roleReplaces": None, "basis": [at("PC 앱")],
                "claims": [{"kind": "describes", "text": "[스텁] 소수점 둘째 자리까지 받는다", "at": at("PC 앱"), "about": None, "replaces": None, "key": "s1"}]}],
            "candidates": [{"text": "이 보고의 귀속은 미정입니다.", "target": "attribution", "parts": ["new:pc"], "at": None,
                "statement": {"key": "s2", "kind": "reported", "text": "보정 작업을 정리했다", "at": at("보정 작업"), "about": None}}]}
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "evidence": {"index": "span.2", "ask": text_digest(route.request.post_data)}, "reply": reply}))
    page.route("**/api/studio/map", returned)
    page.locator("#space-empty").get_by_role("button", name="기록으로 지도 정리").click()
    expect(page.locator("#world .node")).to_have_count(1)
    page.locator("#world .map-understood").get_by_role("button", name="근거").click()
    item = page.locator("#lens .rm-cands li").first
    expect(item).to_contain_text("귀속 미정 · 이 보고의 귀속은 미정입니다.")
    expect(item).to_contain_text("귀속 미정 진술 · 작업 보고 · 보정 작업을 정리했다")
    cites = item.locator(".rr-cite")
    expect(cites).to_have_count(1)  # its own at is null: the statement's passage, once
    cites.first.click()
    expect(page.locator("#lens .rr-mark")).to_have_text("보정 작업 정리입니다.")
    page.locator("#lens .rr-back").click()
    back = page.locator("#lens .rm-cands li").first.locator(".rr-cite").first
    expect(back).to_be_focused()
    assert '"statement"' in back.get_attribute("data-request-focus")
    # The settled claim of the part stays a claim of that part; the open statement is not among them.
    page.locator("#lens .rr-head .close").click()
    page.locator("#world .node", has_text="PC 보정 화면").click()
    expect(page.locator("#lens .claims .claim")).to_have_count(1)
    expect(page.locator("#lens .claims")).not_to_contain_text("보정 작업을 정리했다")
    page.unroute("**/api/studio/map")
    assert not errors, errors
    context.close()


def reading72_flow(browser, base):
    """Read the saved actual 71 response, not another AI call: expanded request -> second quote -> named part return.
    Disclosure, pane scroll and focus survive repeated trips in the lens and the sheet; another part starts its own reading.
    A separate component replay checks fresh contents and exact frozen request/revision identity (never old DOM replay)."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    errors, calls = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: calls.append(r.url) if r.method == "POST" and "/api/studio/" in r.url else None)
    page.goto(base + "/")
    sample = ROOT.parents[1] / "docs/cycles/2026-10-26-visual-experience-59/request71-sample.json"
    data = json.loads(sample.read_text(encoding="utf-8"))
    area = next(a["id"] for a in data["space"]["areas"] if a["name"] == "폴더 일괄 처리")
    other = next(a["id"] for a in data["space"]["areas"] if a["name"] == "터미널 명령 실행")
    page.locator("#import-file").set_input_files(str(sample))
    page.wait_for_url(re.compile(r"#/p/E_"))
    entry = re.search(r"#/p/(E_[^/]+)", page.url).group(1)
    # This saved part has a child: its selectable map surface is the group head, not a leaf node.
    page.locator(f'#world .frame-head[data-part="{area}"]').locator(".frame-name").click()
    expect(page.locator("#lens-title")).to_have_text("폴더 일괄 처리")
    page.locator("#lens .request-item > summary").first.click()

    def roundtrip(pane):
        item = page.locator(pane + " .request-item").first
        cite = item.locator(".request-passage .cl-cite").nth(1)
        cite.scroll_into_view_if_needed()
        cite.focus()
        scroll = page.locator(pane + (" .panel-body" if pane == "#panel" else " .lens-body")).evaluate("e => e.scrollTop")
        assert scroll > 0, "the test must return to a scrolled reading, not its start"
        url0, camera0 = page.url, page.locator("#world").evaluate(CAMERA)
        quote = cite.get_attribute("title")
        cite.click()
        expect(page.locator("#lens .rr-mark")).to_have_text(quote)
        expect(page.locator("#lens .rr-back")).to_contain_text("폴더 일괄 처리")
        page.locator("#lens .rr-back").click()
        expect(page).to_have_url(url0)
        expect(item).to_have_attribute("open", "")
        expect(cite).to_be_focused()
        body = page.locator(pane + (" .panel-body" if pane == "#panel" else " .lens-body"))
        assert abs(body.evaluate("e => e.scrollTop") - scroll) <= 1
        page.wait_for_timeout(250)
        assert page.locator("#world").evaluate(CAMERA) == camera0

    roundtrip("#lens")
    roundtrip("#lens")
    # A current part's ordinary claim is not inside a request item. Its exact citation regains keyboard focus too, while
    # the request disclosure and the pane's reading position stay where they were. No implementation-key assertions.
    def part_roundtrip(pane):
        cite = page.locator(pane + " .claims .cl-cite").last
        cite.scroll_into_view_if_needed()
        cite.focus()
        body = page.locator(pane + (" .panel-body" if pane == "#panel" else " .lens-body"))
        scroll, title, url0 = body.evaluate("e => e.scrollTop"), cite.get_attribute("title"), page.url
        camera0 = page.locator("#world").evaluate(CAMERA)
        cite.click()
        expect(page.locator("#lens .rr-mark")).to_have_count(1)
        expect(page.locator("#lens .rr-back")).to_contain_text("폴더 일괄 처리")
        page.locator("#lens .rr-back").click()
        expect(page).to_have_url(url0)
        expect(cite).to_have_attribute("title", title)
        expect(cite).to_be_focused()
        expect(page.locator(pane + " .request-item").first).to_have_attribute("open", "")
        assert abs(body.evaluate("e => e.scrollTop") - scroll) <= 1
        page.wait_for_timeout(250)
        assert page.locator("#world").evaluate(CAMERA) == camera0

    part_roundtrip("#lens")
    # Reusing the same item ids in another part does not unfold them there.
    page.goto(base + f"/#/p/{entry}/{other}")
    expect(page.locator("#lens-title")).to_have_text("터미널 명령 실행")
    expect(page.locator("#lens .request-item")).to_have_count(1)
    expect(page.locator("#lens .request-item[open]")).to_have_count(0)
    page.goto(base + f"/#/p/{entry}/{area}")
    sheet(page, "폴더 일괄 처리")
    page.locator("#panel .request-item > summary").first.click()
    roundtrip("#panel")
    part_roundtrip("#panel")
    no_page_scroll(page)
    assert not calls and not errors, (calls, errors)

    # The memory contains only identity/disclosure/focus. Rebuild with fresh contents, then replace the request identity.
    result = page.evaluate("""async p => {
      const UI = await import('/client/request-results.js');
      const q = p.readings.find(r => r.version === 'map-reading.2').requests[0];
      const box = document.createElement('div'); document.body.append(box);
      const render = () => box.replaceChildren(UI.requestResults(p, [], {partId:q.items[0].partIds[0],compact:true,quote:()=>{},correct:async()=>null}));
      render(); const item = box.querySelector('.request-item'); item.open=true;
      item.querySelectorAll('.cl-cite')[1].focus(); const saved=UI.captureRequestReading(box);
      q.items[0].description='[검사] 지금 원자료의 요청 설명';
      render(); const fresh=UI.restoreRequestReading(box,saved);
      const current=box.querySelector('.request-want').textContent;
      const focused=box.contains(document.activeElement) && document.activeElement.dataset.requestFocus===saved.focus;
      // Same RQ/item id, a new frozen plan revision: none of the old disclosure/focus belongs to it.
      q.planRevision+=1; render(); const revision=UI.restoreRequestReading(box,saved);
      const revisionClosed=!box.querySelector('.request-item').open;
      q.planRevision-=1; q.id+='-different-request'; render(); const request=UI.restoreRequestReading(box,saved);
      const requestClosed=!box.querySelector('.request-item').open; box.remove();
      return {fresh,current,focused,revision,revisionClosed,request,requestClosed};
    }""", data)
    assert result == {"fresh": True, "current": "원함[검사] 지금 원자료의 요청 설명", "focused": True, "revision": False, "revisionClosed": True, "request": False, "requestClosed": True}, result
    context.close()


def continue72_flow(browser, base):
    """The home link resumes both scope and selection of this workspace entry. An imported copy with the same project id
    starts from its own visit; old ambiguous project-key memory is not silently assigned to either imported copy."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/")
    fixture = page.evaluate("""async () => {
      const D=await import('/shared/domain.js'), S=await import('/shared/storage.js');
      let p=D.addArea(D.rename(D.createProject(),'이어가기 검사'),'그룹'); const group=p.space.areas[0].id;
      p=D.addChildArea(p,group,'첫 부분'); const first=p.space.areas.at(-1).id;
      p=D.addChildArea(p,group,'둘째 부분'); const second=p.space.areas.at(-1).id;
      return {id:p.id,group,first,second,backup:S.serializeBackup(p,null)};
    }""")
    backup = {"name": "continue72.json", "mimeType": "application/json", "buffer": fixture["backup"].encode("utf-8")}
    page.locator("#import-file").set_input_files(backup)
    page.wait_for_url(re.compile(r"#/p/E_"))
    first_entry = re.search(r"#/p/(E_[^/]+)", page.url).group(1)
    first_url = base + f'/#/p/{first_entry}/in/{fixture["group"]}/{fixture["first"]}'
    page.goto(first_url)
    expect(page.locator("#lens-title")).to_have_text("첫 부분")
    in_scope(page, "그룹")
    page.locator(".brand").click()
    card = page.locator("#saved-list .program", has=page.locator(f'.program-head[href="#/p/{first_entry}"]'))
    expect(card.locator(".program-continue")).to_have_attribute("href", first_url.split(base + "/")[1])
    card.locator(".program-continue").click()
    expect(page.locator("#lens-title")).to_have_text("첫 부분")
    in_scope(page, "그룹")
    page.locator(".brand").click()
    # An old shared memory names a plausible place, but cannot identify which imported entry it came from.
    page.evaluate("f => {const k='agentflow.studio.last.1',v=JSON.parse(localStorage.getItem(k));v[f.id]={scope:f.group,part:f.first,at:new Date().toISOString()};localStorage.setItem(k,JSON.stringify(v));}", fixture)
    page.locator("#import-file").set_input_files(backup)
    page.wait_for_url(re.compile(r"#/p/E_"))
    second_entry = re.search(r"#/p/(E_[^/]+)", page.url).group(1)
    assert second_entry != first_entry
    page.locator(".brand").click()
    copy = page.locator("#saved-list .program", has=page.locator(f'.program-head[href="#/p/{second_entry}"]'))
    expect(copy.locator(".program-continue")).to_have_count(0)
    page.goto(base + f'/#/p/{second_entry}/in/{fixture["group"]}/{fixture["second"]}')
    expect(page.locator("#lens-title")).to_have_text("둘째 부분")
    page.locator(".brand").click()
    expect(card.locator(".program-continue strong")).to_have_text("첫 부분")
    expect(copy.locator(".program-continue strong")).to_have_text("둘째 부분")
    stored = page.evaluate("() => JSON.parse(localStorage.getItem('agentflow.studio.last.1'))")
    assert stored[first_entry]["part"] == fixture["first"] and stored[second_entry]["part"] == fixture["second"]
    assert stored[fixture["id"]]["part"] == fixture["first"], "visiting a copy must not overwrite ambiguous old memory"
    assert page.evaluate(ENTRY, first_entry) == page.evaluate(ENTRY, second_entry), "continue never edits either project"
    context.close()


def role80_flow(browser, base):
    """AF80: a description read from records opens the passages it rests on (its own basis): folded to a count under the
    description, each passage exact, and the way back comes to the same part, the same button, the fold open, the same scroll and
    camera; one passage reads the same way; the part's claim stays its own; the full reading (sheet) the same. Written fixture
    (role80-fixture.mjs), no AI call."""
    built = json.loads(subprocess.run(["node", str(ROOT / "tests/role80-fixture.mjs")], cwd=APP, check=True, capture_output=True, text=True).stdout)
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    errors, calls = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: calls.append(r.url) if r.method == "POST" and "/api/studio/" in r.url else None)
    page.goto(base + "/")
    with tempfile.TemporaryDirectory() as tmp:
        backup = pathlib.Path(tmp) / "role80.json"
        backup.write_text(json.dumps(built["project"], ensure_ascii=False), encoding="utf-8")
        page.locator("#import-file").set_input_files(str(backup))
        page.wait_for_url(re.compile(r"#/p/E_"))

    def roundtrip(surface, index, quote, title):
        fold = page.locator(f"{surface} .role-basis")
        cite = fold.locator(".cl-cite").nth(index)
        cite.scroll_into_view_if_needed()
        body = page.locator(f"{surface} .lens-body" if surface == "#lens" else f"{surface} .panel-body")
        url0, camera0, scroll0 = page.url, page.locator("#world").evaluate(CAMERA), body.evaluate("e => e.scrollTop")
        cite.click()
        expect(page.locator("#lens .rr-mark")).to_have_text(quote)
        expect(page.locator("#lens .rr-back")).to_contain_text(title)
        page.locator("#lens .rr-back").click()
        expect(page).to_have_url(url0)
        expect(page.locator(f"{surface} .role-basis")).to_have_attribute("open", "")
        expect(page.locator(f"{surface} .role-basis .cl-cite").nth(index)).to_be_focused()
        assert abs(body.evaluate("e => e.scrollTop") - scroll0) <= 1
        page.wait_for_timeout(250)
        assert page.locator("#world").evaluate(CAMERA) == camera0

    page.locator(f'#world .node[data-part="{built["eval"]}"]').click()
    expect(page.locator("#lens-title")).to_have_text("평가 경로")
    fold = page.locator("#lens .role-basis")
    expect(fold.locator(":scope > summary")).to_have_text("설명 근거 4")
    assert fold.evaluate("e => e.open") is False, "folded by default"
    expect(page.locator("#lens .claims .claim")).to_have_count(0)
    fold.locator(":scope > summary").click()
    expect(fold.locator(".cl-cite")).to_have_count(4)
    # The fourth passage is no claim's quote: it opens exactly, and the way back is to this very button.
    roundtrip("#lens", 3, "return self.to_host(value)", "평가 경로")
    roundtrip("#lens", 0, "def evaluate(self, code):\n        tree = Parser(code).parse()", "평가 경로")
    # One passage reads the same way; the narrower report stays the part's own claim.
    page.locator(f'#world .node[data-part="{built["limit"]}"]').click()
    expect(page.locator("#lens-title")).to_have_text("실행 한도")
    expect(page.locator("#lens .role-basis > summary")).to_have_text("설명 근거 1")
    expect(page.locator("#lens .claims .claim")).to_have_count(1)
    expect(page.locator("#lens .claims .cl-kind")).to_have_text("작업 보고")
    page.locator("#lens .role-basis > summary").click()
    roundtrip("#lens", 0, "요구: 실행 시간이 한도를 넘으면 평가를 멈춘다.", "실행 한도")
    # The full reading (sheet): the same evidence under the description there.
    page.locator(f'#world .node[data-part="{built["eval"]}"]').click()
    page.locator("#lens .lens-more").click()
    sheet = page.locator("#panel .sec-understood .role-basis")
    expect(sheet.locator(":scope > summary")).to_have_text("설명 근거 4")
    sheet.locator(":scope > summary").click()
    roundtrip("#panel", 3, "return self.to_host(value)", "평가 경로")
    assert not calls, calls
    assert not errors, errors
    context.close()


def history73_flow(browser, base):
    """A withdrawn report's history fold: open it, follow its old quote and come back by the named way. The item, the history
    fold, the quote's focus, the pane scroll and the camera are as they were; the current-quote path still holds. The same from the
    map's root (the comparison above the map, nothing selected). The same item answering another part does not open its history
    there. Written fixture (history73-fixture.mjs), no AI call."""
    built = json.loads(subprocess.run(["node", str(ROOT / "tests/history73-fixture.mjs")], cwd=APP, check=True, capture_output=True, text=True).stdout)
    area, other = built["area"], built["other"]
    context = browser.new_context(viewport={"width": 1280, "height": 640})
    page = context.new_page()
    errors, calls = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.on("request", lambda r: calls.append(r.url) if r.method == "POST" and "/api/studio/" in r.url else None)
    page.goto(base + "/")
    with tempfile.TemporaryDirectory() as tmp:
        backup = pathlib.Path(tmp) / "history73.json"
        backup.write_text(json.dumps(built["project"], ensure_ascii=False), encoding="utf-8")
        page.locator("#import-file").set_input_files(str(backup))
        page.wait_for_url(re.compile(r"#/p/E_"))
    entry = re.search(r"#/p/(E_[^/]+)", page.url).group(1)
    page.locator(f'#world .node[data-part="{area}"]').click()
    expect(page.locator("#lens-title")).to_have_text("폴더 일괄 처리")
    item = page.locator("#lens .request-item").first
    item.locator(":scope > summary").click()
    history = item.locator(".request-history")
    expect(history.locator(":scope > summary")).to_contain_text("철회·정정된 앞 보고 1개")
    history.locator(":scope > summary").click()
    body = page.locator("#lens .lens-body")

    def roundtrip(cite, back_to="폴더 일괄 처리"):
        cite.scroll_into_view_if_needed()
        cite.focus()
        scroll = body.evaluate("e => e.scrollTop")
        assert scroll > 0, "the test must return to a scrolled reading, not its start"
        url0, camera0, history0 = page.url, page.locator("#world").evaluate(CAMERA), history.evaluate("e => e.open")
        quote = cite.get_attribute("title")
        cite.click()
        expect(page.locator("#lens .rr-mark")).to_have_text(quote)
        if back_to:
            expect(page.locator("#lens .rr-back")).to_contain_text(back_to)
        page.locator("#lens .rr-back").click()
        expect(page).to_have_url(url0)
        expect(item).to_have_attribute("open", "")
        assert history.evaluate("e => e.open") == history0
        expect(cite).to_be_focused()
        assert abs(body.evaluate("e => e.scrollTop") - scroll) <= 1
        page.wait_for_timeout(250)
        assert page.locator("#world").evaluate(CAMERA) == camera0

    # The old (withdrawn) quote: the history fold comes back open, with that quote focused.
    old = history.locator(".request-withdrawn .cl-cite").first
    roundtrip(old)
    expect(history).to_have_attribute("open", "")
    roundtrip(old)
    # The current quote path is unchanged (its history fold stays as the reader left it, open).
    roundtrip(item.locator(":scope > .request-passage .cl-cite").first)
    expect(history).to_have_attribute("open", "")
    # The map's root (nothing selected): the comparison above the map opens the same request reading in the pane; its old quote
    # and the way back keep that reading's item, history fold, quote focus and scroll too, with no part selected.
    page.goto(base + f"/#/p/{entry}")
    page.locator("#world .mu-comparison").click()
    expect(page.locator("#lens-title")).to_contain_text("돌아와 읽기")
    item = page.locator("#lens .request-results .request-item").first
    expect(item).not_to_have_attribute("open", "")
    item.locator(":scope > summary").click()
    history = item.locator(".request-history")
    history.locator(":scope > summary").click()
    old = history.locator(".request-withdrawn .cl-cite").first
    roundtrip(old, back_to=None)
    expect(history).to_have_attribute("open", "")
    roundtrip(item.locator(":scope > .request-passage .cl-cite").first, back_to=None)
    page.keyboard.press("Escape")
    # The same RQ item answers the other part too: nothing opened here opens there.
    page.goto(base + f"/#/p/{entry}/{other}")
    expect(page.locator("#lens-title")).to_have_text("터미널 명령 실행")
    expect(page.locator("#lens .request-item")).to_have_count(1)
    expect(page.locator("#lens .request-item[open]")).to_have_count(0)
    expect(page.locator("#lens .request-history[open]")).to_have_count(0)
    no_page_scroll(page)
    assert not calls and not errors, (calls, errors)
    context.close()


def revised73_flow(browser, base):
    """The saved public 72 sequential backup: the folder-input -> converter relation rests only on the withdrawn 71 report. Selected
    from either end, its line carries one visible '근거 정정' mark clear of parts, heads and other verbs; an ordinary relation's
    line never does. 1280 and 1440, no AI call."""
    sample = ROOT.parents[1] / "docs/cycles/2026-10-26-visual-experience-59/request72-sequential-sample.json"
    data = json.loads(sample.read_text(encoding="utf-8"))
    area = {a["name"]: a["id"] for a in data["space"]["areas"]}
    overlaps = """() => { const m = document.querySelector('#world .edge-label.revised'); if (!m) return ['missing'];
      const r = m.getBoundingClientRect(), hit = e => { const q = e.getBoundingClientRect(); return r.left < q.right && q.left < r.right && r.top < q.bottom && q.top < r.bottom; };
      return [...document.querySelectorAll('#world .node, #world .frame-head, #world .edge-label')].filter(e => e !== m && hit(e)).map(e => e.className); }"""
    for width in (1280, 1440):
        context = browser.new_context(viewport={"width": width, "height": 720})
        page = context.new_page()
        errors, calls = [], []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda r: calls.append(r.url) if r.method == "POST" and "/api/studio/" in r.url else None)
        page.goto(base + "/")
        page.locator("#import-file").set_input_files(str(sample))
        page.wait_for_url(re.compile(r"#/p/E_"))
        entry = re.search(r"#/p/(E_[^/]+)", page.url).group(1)
        for name in ("폴더 입력", "변환기"):
            page.goto(base + f"/#/p/{entry}/{area[name]}")
            expect(page.locator("#lens-title")).to_have_text(name)
            expect(page.locator("#world .edge.revised.on")).to_have_count(1)
            mark = page.locator("#world .edge-label.revised")
            expect(mark).to_have_count(1)
            expect(mark).to_be_visible()
            expect(mark).to_contain_text("근거 정정")
            assert page.evaluate(overlaps) == [], (width, name, page.evaluate(overlaps))
            expect(page.locator("#world .edge-label:not(.revised)", has_text="근거 정정")).to_have_count(0)
        # A part whose relations rest on current reports: no mark anywhere on the map.
        page.goto(base + f"/#/p/{entry}/{area['입력 경로 읽기']}")
        expect(page.locator("#lens-title")).to_have_text("입력 경로 읽기")
        expect(page.locator("#world .edge.on")).not_to_have_count(0)
        expect(page.locator("#world .edge.revised.on")).to_have_count(0)
        expect(page.locator("#world .edge-label", has_text="근거 정정")).to_have_count(0)
        no_page_scroll(page)
        assert not calls and not errors, (width, calls, errors)
        context.close()


def request71_projection_flow(browser, base):
    """Written, validated fixture in the actual request-results DOM: unrelated excerpts stay folded outside parts, a real
    older-RQ report precedes a newer unanswered RQ, and the shared original component marks/scrolls its exact interval."""
    page = browser.new_page(viewport={"width": 1280, "height": 720})
    page.goto(base + "/")
    fixture = page.evaluate("""async () => {
      const D = await import('/shared/domain.js'), C = await import('/shared/change-plan.js'), M = await import('/shared/map-reading.js');
      const V = await import('/shared/studio.js'), UI = await import('/client/request-results.js');
      let p = D.addArea(D.createProject(), '입력'), a = p.space.areas[0].id;
      p = D.addArea(p, '실패 모음'); const b = p.space.areas[1].id;
      const plan = C.createPlan(p.id, '스텁 기준', '입력과 실패 모음', [{id:'INTENT',kind:'user',title:'요구',text:'입력과 실패 모음',basis:'작성 표본'}], {
        summary:'스텁',items:[{id:'I1',title:'폴더 입력',description:'폴더 안 파일을 받는다',partIds:[a],refs:['INTENT'],dependsOn:[]},
          {id:'I2',title:'실패 모음',description:'실패를 모은다',partIds:[b],refs:['INTENT'],dependsOn:[]}],impacts:[],preserve:[],unknowns:[]});
      const old = C.requestSnapshot(plan), newer = C.requestSnapshot(plan);
      const report = '배경 설명을 그대로 보관합니다.\\n'.repeat(300) + `요청문 참조: ${old.id}\\n폴더 입력 처리를 바꿨습니다. 단일 문서 검사 보고입니다. README 오타도 고쳤습니다.`;
      p = D.pasteRecord(p, report, null).project;
      const inp = M.buildMapAsk(p, V.studioView(p), [old.scope,newer.scope]);
      const match = (quote,text,targets,kind='reported') => ({record:'N01',quote,text,targets,kind,about:null,why:'스텁 대응',stance:kind==='reported'?'made':'unclear',replaces:null});
      const reply = M.validateMapReply({summary:'스텁',parts:[],relations:[],candidates:[],gaps:[],matches:[
        match('폴더 입력 처리를 바꿨습니다','[스텁] 입력 변경 보고',[{requestId:old.id,itemId:'I1'}]),
        match('단일 문서 검사 보고입니다','[스텁] 단일 문서 검사',[],'checked'),match('README 오타도 고쳤습니다','[스텁] README 수정',[])]}, inp.ask);
      p = M.applyReading(p,inp,reply,{id:'R_projection',at:new Date().toISOString(),model:'stub',prompt:'m3-000000000000',hash:'9'.repeat(64)}).project;
      const box = document.createElement('div'); box.id='request-fixture'; box.style.cssText='position:fixed;right:0;top:0;width:420px;height:700px;overflow:auto;background:white;padding:12px;z-index:2000';document.body.append(box);
      const render = partId => {box.replaceChildren(UI.requestResults(p,[old.scope,newer.scope],{...(partId?{partId}:{}),correct:async()=>null}));};
      window.renderRequestFixture=render; render(b); return {a,b,old:old.id};
    }""")
    expect(page.locator("#request-fixture .request-ambiguous")).to_have_count(0)
    expect(page.locator("#request-fixture .request-fix")).to_have_count(0)
    expect(page.locator("#request-fixture .request-unrelated")).to_have_count(0)
    page.evaluate("a => window.renderRequestFixture(a)", fixture["a"])
    expect(page.locator("#request-fixture .request-group").first.locator(".request-at")).to_have_attribute("title", re.compile(re.escape(fixture["old"])))
    expect(page.locator("#request-fixture .request-group").first).to_contain_text("입력 변경 보고")
    expect(page.locator("#request-fixture .request-group").nth(1)).to_contain_text("연결된 원문 구절 없음")
    page.locator("#request-fixture .request-quote > summary").click()
    expect(page.locator("#request-fixture .request-quote .rr-mark")).to_have_text("폴더 입력 처리를 바꿨습니다")
    page.wait_for_timeout(100)
    assert page.locator("#request-fixture .request-quote pre").evaluate("e => e.scrollTop > 0")
    page.evaluate("() => window.renderRequestFixture(null)")
    expect(page.locator("#request-fixture .request-unrelated")).to_have_count(1)
    expect(page.locator("#request-fixture .request-unrelated")).not_to_have_attribute("open", "")
    expect(page.locator("#request-fixture .request-unrelated .request-fix")).to_have_count(0)
    page.close()


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
    page.locator("#plan-panel").get_by_role("button", name="문장 고치기").click()
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
    expect(page.locator(SHEET_BODY)).to_contain_text("- 폴더 입력")  # AF94: the sections' text (folded material included)
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
    expect(page.locator(SHEET_BODY)).to_contain_text("- 이름 충돌 때 덮어쓰기 막기")
    expect(page.locator(SHEET_BODY)).not_to_contain_text("- 폴더 입력")
    page.keyboard.press("Escape")
    page.unroute("**/api/studio/plan")
    # A saved project: material added while its analysis is in flight makes that reply outdated; the plan is not made.
    page.goto(base + "/")
    page.locator("#new-open").click()
    page.locator("#new-name").fill("자료 프로젝트")
    page.locator("#new-form").get_by_role("button", name="만들기").click()
    page.locator("#space-empty .se-direct").click()
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
        fields = page.evaluate("() => ['src-title', 'src-text', 'src-basis'].map(id => document.getElementById(id)?.value ?? null)")
        page.locator(".pp-add").get_by_role("button", name="추가").click()
        # The material must be added as typed; on failure say what the fields held and what the form answered.
        if page.locator(".pp-add").count():
            raise AssertionError(f"material not added: fields={fields} message={page.locator('.pp-add .form-msg').inner_text()!r}")
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
    page.locator("#pw-rail-back").click()  # the material list opens in the right column in place of the request
    expect(make).to_be_disabled()
    expect(page.locator("#plan-make-note")).to_have_text("바뀐 자료로 먼저 살펴본 뒤 만들 수 있어요")
    expect(page.locator("#plan-ask")).to_have_text("바뀐 자료로 살펴보기")
    page.get_by_role("button", name=re.compile("읽는 자료")).click()
    add_material()
    page.locator("#pw-rail-back").click()
    expect(make).to_be_enabled()
    # Kept as analysed after a reload: the saved plan still answers what is written.
    page.reload()
    page.locator("#plan-entry").click()
    page.locator(".ps-more").click()
    expect(make).to_be_enabled()
    # A late frame must not move focus into a field being typed in (Windows CI: the form was focused one frame after it
    # rendered; on a slow runner that landed in the text field mid-entry, the text went into the title and the material
    # was refused). Frames are held here and run at the worst moment: after focus has moved on to the text field.
    slow = browser.new_context(viewport={"width": 1280, "height": 720})
    slow.add_init_script("{ window.__frames = []; window.requestAnimationFrame = cb => window.__frames.push(cb); }")
    page = slow.new_page()
    page.goto(base + "/")
    page.locator("#new-open").click()
    page.locator("#new-name").fill("느린 화면")
    page.locator("#new-form").get_by_role("button", name="만들기").click()
    page.locator("#space-empty .se-direct").click()
    page.locator("#part-name").fill("변환")
    page.get_by_role("button", name="만들기").click()
    page.keyboard.press("Escape")
    page.locator("#plan-entry").click()
    page.get_by_role("button", name=re.compile("읽는 자료")).click()
    page.evaluate("() => window.__frames.splice(0).forEach(cb => cb(performance.now()))")
    page.get_by_role("button", name="+ 자료 추가").click()
    expect(page.locator("#src-title")).to_be_focused()  # focused by the click itself, not a frame later
    page.keyboard.type("저장 함수 발췌")
    page.locator("#src-text").focus()
    page.evaluate("() => window.__frames.splice(0).forEach(cb => cb(performance.now()))")
    page.keyboard.type("save.ts: 같은 이름이 있으면 덮어쓴다.")
    page.locator("#src-basis").fill("main save.ts")
    fields = page.evaluate("() => ['src-title', 'src-text', 'src-basis'].map(id => document.getElementById(id)?.value ?? null)")
    assert fields == ["저장 함수 발췌", "save.ts: 같은 이름이 있으면 덮어쓴다.", "main save.ts"], fields
    page.locator(".pp-add").get_by_role("button", name="추가").click()
    expect(page.locator(".pp-extra")).to_contain_text("저장 함수 발췌")
    slow.close()
    # The converter example: material taken from the return reading and added to the draft is read by the next analysis and
    # kept in its plan, so the plan made from it is current (the request comes on).
    page = context.new_page()
    page.goto(base + "/#/p/ex-converter")
    page.locator("#plan-entry").click()
    page.locator(".ps-more").click()
    make = page.get_by_role("button", name="요청문 만들기", exact=True)
    make.click()
    page.keyboard.press("Escape")
    page.get_by_role("button", name=re.compile("^돌아온 기록 · 요청문")).click()  # returned results open in the right column
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


# An actual analysis reply (source: the EXP65 lead's own call on commit 5cbd1db, ex-converter, real DeepSeek, HTTP 200) for
# "폴더 변환은 추가하지 말고, 파일 이름 충돌 때 덮어쓰지만 막아줘.". Fields as reported; its summary text was not recorded
# with it, so the summary below is a marked placeholder, and preserve/unknowns were not reported (empty here). No presentation:
# a normal case for an actual reply, which the reading must make readable without inventing the current overwrite behaviour.
ACTUAL_COLLISION = {
    "summary": "[테스트 자리: 실제 응답의 요약 원문은 함께 전달되지 않았음. 내용은 기존 ok/error 누적 결과의 재사용 설명]",
    "items": [{"id": "change_1", "title": "이름 충돌 시 덮어쓰기 차단",
               "description": "현재 단일 문서 변환과 저장 흐름을 재사용하되, 저장 대상과 같은 이름의 기존 파일이 있으면 덮어쓰지 않고 저장을 막는다. 폴더 단위 변환은 새로 추가하지 않는다.",
               "partIds": ["files"], "refs": ["INTENT", "P03"], "dependsOn": []}],
    "impacts": [{"partId": "results", "reason": "충돌로 저장을 막았을 때 현재 화면은 마지막 결과만 설명하므로, 차단 사실과 이유를 결과 설명에서 어떻게 보여줄지 함께 확인해야 한다.",
                 "refs": ["INTENT", "P03", "R05"]}],
    "preserve": [], "unknowns": []}


def actual_reply_flow(browser, base):
    """EXP65 wide comparison on an actual reply without presentation, scope reviews that outlive a material change, and
    four changes without horizontal scroll."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/#/p/ex-converter")
    page.locator("#plan-entry").click()
    page.locator(".ps-edit").click()
    page.locator("#plan-intent").fill("폴더 변환은 추가하지 말고, 파일 이름 충돌 때 덮어쓰지만 막아줘.")
    page.route("**/api/studio/plan", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": ACTUAL_COLLISION})))
    page.locator("#plan-ask").click()
    expect(page.locator(".ps-item")).to_have_count(1)
    # On the map: the change's own words, the target with no claimed current behaviour, and the part's role as the reason.
    expect(page.locator(".callout .co-head strong")).to_have_text("변환한 파일")
    expect(page.locator(".callout .co-row.outcome")).to_contain_text("덮어쓰지 않고 저장을 막는다")
    expect(page.locator("#lens .cmp-desc")).to_have_count(0)  # the description once, as the wanted result
    expect(page.locator(".callout .co-row.now.unknown p").first).to_have_text("이 변경안의 자료로는 지금 어떻게 하는지 알 수 없어요.")
    expect(page.locator(".callout .co-row.why")).to_contain_text("변환 형식과 저장한 산출물을 다룬다.")
    expect(page.locator("#lens")).not_to_contain_text("비교는 아직 정리 전")
    # Wide: the whole description and its sources, the target, and the part to look at with it with the analysis's reason.
    page.locator("#lens .ps-wide").click()
    expect(page.locator(".pw-title")).to_have_text("변경안 · 1가지 변화")
    expect(page.locator(".pw-part .co-row.outcome p").first).to_have_text(ACTUAL_COLLISION["items"][0]["description"])
    expect(page.locator(".pw-part .co-row.outcome .co-ref")).to_have_count(2)
    expect(page.locator(".pw-part")).to_have_count(1)
    expect(page.locator(".pw-near li")).to_have_count(1)
    expect(page.locator(".pw-near li")).to_contain_text("결과 설명")
    expect(page.locator(".pw-near li")).to_contain_text("차단 사실과 이유를 결과 설명에서 어떻게 보여줄지")
    expect(page.locator(".pw-near .co-ref")).to_have_count(3)
    # Its part to look at, read on the map: the part and its reason, and the way back.
    page.locator(".pw-near .pw-map").click()
    expect(page.locator("#lens-title")).to_have_text("결과 설명")
    expect(page.locator("#lens")).to_contain_text("차단 사실과 이유")
    page.locator("#lens .ps-wide").click()
    expect(page.locator("#plan-panel.work")).to_be_visible()
    expect(page.locator(".pw-pick[aria-current='true']")).to_contain_text("이름 충돌 시 덮어쓰기 차단")
    # A scope review still in flight when the example material is switched: its reply makes no document in either.
    held = []
    page.route("**/api/studio/scope", lambda route: held.append(route))
    page.locator("#plan-make").click()
    expect(page.locator(".pw-req .pending")).to_be_visible()
    page.locator(".pp-cond").get_by_role("button", name="없음").click()
    expect(page.locator(".pw-item")).to_have_count(4)  # condition B's authored analysis: four changes
    try: held[0].fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": {"summary": "[테스트 응답] 늦은 검토", "prerequisites": [], "unknowns": []}}))
    except Exception: pass
    page.wait_for_timeout(300)
    expect(page.locator("#plan-sheet")).to_be_hidden()
    expect(page.get_by_role("button", name=re.compile("마지막 요청문"))).to_have_count(0)
    # Four changes and long names: no horizontal scroll anywhere in the workspace.
    for sel in (".pw-list", ".pw-detail", ".pw-rail-body"):
        assert page.locator(sel).evaluate("e => e.scrollWidth <= e.clientWidth + 1"), sel
    no_page_scroll(page)
    page.locator(".pp-cond").get_by_role("button", name="있음").click()
    expect(page.locator(".pw-item")).to_have_count(1)
    expect(page.get_by_role("button", name=re.compile("마지막 요청문"))).to_have_count(0)
    expect(page.locator(".pw-req .pp-error")).to_have_count(0)
    page.unroute("**/api/studio/scope")
    # A saved project: material added while its scope review is in flight makes that review unused; no document is made.
    page.goto(base + "/")
    page.locator("#new-open").click()
    page.locator("#new-name").fill("검토 프로젝트")
    page.locator("#new-form").get_by_role("button", name="만들기").click()
    page.locator("#space-empty .se-direct").click()
    page.locator("#part-name").fill("변환")
    page.get_by_role("button", name="만들기").click()
    page.keyboard.press("Escape")
    page.locator("#plan-entry").click()
    page.locator("#plan-intent").fill("이름 충돌 때 덮어쓰지 않게 해줘.")
    page.unroute("**/api/studio/plan")
    page.route("**/api/studio/plan", lambda route: plan_reply(route, "덮어쓰기 막기"))
    page.locator("#plan-ask").click()
    page.locator(".ps-more").click()
    held.clear()
    page.route("**/api/studio/scope", lambda route: held.append(route))
    page.locator("#plan-make").click()
    expect(page.locator(".pw-req .pending")).to_be_visible()
    page.get_by_role("button", name=re.compile("읽는 자료")).click()
    page.get_by_role("button", name="+ 자료 추가").click()
    page.locator("#src-title").fill("저장 함수 발췌")
    page.locator("#src-text").fill("save.ts: 같은 이름이 있으면 덮어쓴다.")
    page.locator("#src-basis").fill("main save.ts")
    page.locator(".pp-add").get_by_role("button", name="추가").click()
    held[0].fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": {"summary": "[테스트 응답] 늦은 검토", "prerequisites": [], "unknowns": []}}))
    page.locator("#pw-rail-back").click()
    expect(page.locator(".pw-req .pp-error")).to_contain_text("검토하는 동안 변경안이나 고른 항목이 바뀌어 이 검토는 쓰지 않았어요")
    expect(page.get_by_role("button", name=re.compile("마지막 요청문"))).to_have_count(0)
    expect(page.locator("#plan-make")).to_be_disabled()
    context.close()


def stale_work_flow(browser, base):
    """EXP65: writing in the wide comparison makes its ways to the map follow at once: no part reading of the earlier plan
    (a forced click changes nothing, the editor and caret stay), and an honest way out to the current map with the draft
    kept; reopening finds the same draft; the analysed sentence written back gives the ways back."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    page = context.new_page()
    page.goto(base + "/#/p/ex-converter")
    before = page.locator("#world").evaluate(CAMERA)
    page.locator("#plan-entry").click()
    page.locator(".ps-more").click()
    work, maps, back = page.locator("#plan-panel.work"), page.locator("#plan-panel .pw-map"), page.locator("#pw-back")
    expect(back).to_have_text("지도로 돌아가기")
    expect(maps.first).to_be_enabled()
    # Cloud's sequence on '성공 유지·실패 모음': the whole sentence plus a line, the caret moved once, the second part's way to
    # the map: the way is off at once and the caret stays where it was put.
    page.locator(".pw-pick", has_text="성공 유지·실패 모음").click()
    page.locator("#plan-panel").get_by_role("button", name="문장 고치기").click()
    area = page.locator("#plan-intent")
    original = area.input_value()
    area.fill(original + "\n사용자 검토 초안")
    page.keyboard.press("ArrowLeft")
    at = area.evaluate("a => [a.selectionStart, a.selectionEnd]")
    second = page.locator(".pw-part").nth(1).locator(".pw-map")
    expect(second).to_be_disabled()
    second.evaluate("b => { b.disabled = false; b.click(); }")
    expect(work).to_be_visible()
    assert area.evaluate("a => [a.selectionStart, a.selectionEnd]") == at, at
    expect(back).to_have_text("현재 지도로 (초안 유지)")
    area.fill(original)
    expect(area).to_be_focused()
    area.evaluate("a => { a.dataset.same = '1'; a.setSelectionRange(a.value.length, a.value.length); }")
    page.keyboard.type(" 이름 충돌도 막아줘.")
    draft = area.input_value()
    # At once, without a re-render: the ways to the map are off with their reason, the way out says what it does.
    for i in range(maps.count()):
        expect(maps.nth(i)).to_be_disabled()
    expect(back).to_have_text("현재 지도로 (초안 유지)")
    expect(page.locator(".pw-stale")).to_be_visible()
    expect(page.locator("#plan-stale")).to_be_visible()
    # A forced click on an outdated '지도에서 보기' changes nothing: same workspace, same editor element, draft, caret, focus.
    maps.first.evaluate("b => { b.disabled = false; b.click(); }")
    expect(work).to_be_visible()
    expect(maps.first).to_be_disabled()
    assert area.evaluate("a => a.dataset.same === '1' && document.activeElement === a && a.selectionStart === a.value.length"), "editor kept"
    expect(area).to_have_value(draft)
    # Reading a source re-renders the workspace: the editor keeps its caret.
    area.evaluate("a => a.setSelectionRange(3, 3)")
    page.locator("#plan-panel .co-ref").first.click()
    expect(page.locator(".pw-rail-head h3")).to_contain_text("근거")
    assert page.locator("#plan-intent").evaluate("a => a.selectionStart === 3 && a.selectionEnd === 3")
    page.locator("#pw-rail-back").click()
    # The honest way out: the current map, the plan closed with the draft kept and said so.
    back.click()
    expect(page.locator("#plan-panel")).to_be_hidden()
    expect(page.locator("#plan-strip")).to_be_hidden()
    expect(page.locator("#toast")).to_contain_text("초안과 변경안은 그대로 남아 있어요")
    page.wait_for_timeout(300)
    assert page.locator("#world").evaluate(CAMERA) == before
    assert page.evaluate("[...document.getElementById('space').children].every(e => !e.inert)")
    # Reopening finds the same draft, still ahead of the plan; the earlier plan's request stays off.
    page.locator("#plan-entry").click()
    expect(work).to_be_visible()
    expect(page.locator("#plan-intent")).to_have_value(draft)
    expect(page.locator("#plan-make")).to_be_disabled()
    expect(maps.first).to_be_disabled()
    # The analysed sentence written back: the ways to the map come back at once, and a part reads on the map.
    page.locator("#plan-intent").fill(original)
    expect(maps.first).to_be_enabled()
    expect(back).to_have_text("지도로 돌아가기")
    maps.first.click()
    expect(work).to_be_hidden()
    expect(page.locator("#lens .callout")).to_be_visible()
    expect(page.locator("#lens .ps-wide")).to_have_text("‹ 넓은 비교로")
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


def authoring84_flow(browser, base):
    """AF84: an older draft of the exact micro-javascript backup (unrecorded context) at 1280 and device scale 1.25. Setting the
    context from the screen and removing it keep the draft, its caret and selection direction; focus lands on a control of the new
    line that can act (never a disabled one, never the page). The visible boundary line shows only while a context is kept."""
    context = browser.new_context(viewport={"width": 1280, "height": 800}, device_scale_factor=1.25)
    page = context.new_page()
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(ROOT / "tests/fixtures/context75/micro-javascript-backup.json"))
    expect(page.locator("#crumbs")).to_contain_text("micro-javascript")
    project = page.evaluate(ENTRY, re.search(r"#/p/([^/]+)", page.url).group(1))
    draft = ("이 부분은 실패해도 다음 단계로 넘어가게 해줘. " * 4)[:90]
    old = {"draft": draft, "extra": [], "plan": None, "by": None, "snapshots": [], "labels": {}, "origins": {}, "observations": [], "attached": {}}
    page.evaluate("([id, b]) => localStorage.setItem('agentflow.studio.plans.1', JSON.stringify({ version: 'studio.plans.2', projects: { [id]: b } }))", [project["id"], old])
    page.reload()
    page.locator("#plan-entry").click()
    area, line, note = page.locator("#plan-intent"), page.locator("#plan-ctx"), page.locator("#plan-ctx-note")
    expect(area).to_have_value(draft)
    expect(line).to_contain_text("기록되지 않음")
    expect(note).to_be_hidden()
    area.click()
    page.keyboard.press("Control+Home")
    page.keyboard.press("ArrowRight")
    caret = "a => [a.selectionStart, a.selectionEnd, a.selectionDirection, a.value.length]"
    active = "() => [document.activeElement.tagName, document.activeElement.textContent, !!document.activeElement.disabled]"
    assert area.evaluate(caret)[:2] == [1, 1] and len(draft) == 90
    line.get_by_role("button", name="현재 화면 맥락으로 지정").click()
    assert area.evaluate(caret)[:2] == [1, 1], area.evaluate(caret)
    # The same-screen replace is off in the new line: focus goes to the control that can act.
    expect(line.get_by_role("button", name="현재 화면으로 바꾸기")).to_be_disabled()
    assert page.evaluate(active) == ["BUTTON", "없애기", False], page.evaluate(active)
    expect(note).to_be_visible()
    expect(note).to_have_text("변경할 범위는 쓴 문장을 따라요.")
    page.keyboard.press("Enter")  # removes by keyboard from where focus landed
    expect(line).to_contain_text("없앤 뒤로 다시 잡지 않아요")
    assert area.evaluate(caret)[:2] == [1, 1], area.evaluate(caret)
    assert page.evaluate(active) == ["BUTTON", "현재 화면 맥락으로 지정", False], page.evaluate(active)
    expect(note).to_be_hidden()
    # A backward selection keeps its direction through another change; the draft itself is never touched.
    area.evaluate("a => { a.focus(); a.setSelectionRange(3, 10, 'backward'); }")
    line.get_by_role("button", name="현재 화면 맥락으로 지정").click()
    assert area.evaluate(caret) == [3, 10, "backward", 90], area.evaluate(caret)
    expect(area).to_have_value(draft)
    kept = page.evaluate("() => JSON.parse(localStorage.getItem('agentflow.studio.plans.1'))")
    assert kept["version"] == "studio.plans.4" and "legacy" not in kept, kept.get("legacy")  # AF94: the writer is .4
    assert kept["projects"][project["id"]]["authoring"]["draft"]["context"]["how"] == "explicit"
    assert kept["projects"][project["id"]]["draft"] == draft
    # Closing and reopening the plan in this tab puts the caret back where it was left in this draft (the same text), also after
    # moving on the map while it was closed; a backward selection keeps its direction.
    area.click()
    page.keyboard.press("Control+Home")
    for _ in range(5): page.keyboard.press("ArrowRight")
    before = area.evaluate(caret)
    assert before[:2] == [5, 5], before
    page.get_by_role("button", name="변경 구상 닫고 현재 지도로").click()
    expect(page.locator("#plan-panel")).to_be_hidden()
    page.locator("#plan-entry").click()
    expect(area).to_have_value(draft)
    assert area.evaluate(caret) == before, area.evaluate(caret)
    assert page.evaluate("() => document.activeElement.id") == "plan-intent"
    area.evaluate("a => a.setSelectionRange(12, 40, 'backward')")
    page.locator("#plan-entry").click()  # closed by its toggle
    page.locator("#world .node").first.click()
    page.keyboard.press("Escape")
    page.locator("#plan-entry").click()
    expect(area).to_have_value(draft)
    assert area.evaluate(caret) == [12, 40, "backward", 90], area.evaluate(caret)
    expect(line).to_contain_text("작성 맥락")
    # A (this screen) is analysed; the context is removed while the reply is held; the reply comes late and reads as made from A
    # (stale, nothing made from it). Taking this screen again is A: the plan is current again, and the editor the person was
    # writing in stays open with its caret, selection and a live control focused. Stubbed reply, not a model.
    line.get_by_role("button", name="없애기").click()
    line.get_by_role("button", name="현재 화면 맥락으로 지정").click()
    held = []
    page.route("**/api/studio/plan", lambda route: held.append(route))
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-panel .pending")).to_be_visible()
    line.get_by_role("button", name="없애기").click()
    body = json.loads(held[0].request.post_data)
    assert body["authoring"]["state"] == "recorded", body["authoring"]
    held[0].fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": {"summary": "[스텁] 실패 후 다음 단계.",
        "items": [{"id": "c1", "title": "[스텁] 실패 후 계속", "description": "한 단계 실패에도 다음 단계로.", "partIds": [body["parts"][0]["id"]], "refs": ["INTENT"], "dependsOn": []}],
        "impacts": [], "preserve": [], "unknowns": []}}))
    expect(page.locator("#plan-stale")).to_contain_text("작성 맥락")
    expect(page.locator("#plan-make")).to_be_disabled()
    area.evaluate("a => { a.focus(); a.setSelectionRange(7, 20, 'backward'); }")
    line.get_by_role("button", name="현재 화면 맥락으로 지정").click()
    expect(page.locator("#plan-stale")).to_be_hidden()
    expect(page.locator("#plan-make")).to_be_enabled()
    expect(area).to_be_visible()
    expect(area).to_have_value(draft)
    assert area.evaluate(caret) == [7, 20, "backward", 90], area.evaluate(caret)
    assert page.evaluate(active) == ["BUTTON", "없애기", False], page.evaluate(active)
    page.unroute("**/api/studio/plan")
    context.close()


ZERO85_SENTENCE = "이 부분에서 메모리 제한과 시간 제한으로 끝난 이유를 호출자가 구별해 설명할 수 있게 하고 싶다. 기존 eval 실행 순서와 전역 객체 공유 동작은 유지한다."
ZERO85_PIPE = "A_49bad1f8-971b-4bff-8030-a62d8a470c16"
# Written by the reviewer, not a model reply: no change proposed; the docstring already names both errors, the callers' side unknown.
ZERO85_EMPTY = {"summary": "제공된 eval docstring(N01)은 메모리 초과에 MemoryLimitError, 시간 초과에 TimeLimitError를 이미 구별해 명명한다. 호출자가 두 경우를 어떻게 안내받는지는 제공된 자료로 확인되지 않음.",
    "items": [], "impacts": [], "preserve": ["eval의 parse→compile→VM 실행 순서", "전역 객체를 복사하지 않고 공유하는 동작"],
    "unknowns": ["두 예외의 구체 메시지와 생성자: 제공된 자료로 확인되지 않음", "호출자 쪽 안내·처리: 제공된 자료로 확인되지 않음"]}


def zero85_flow(browser, base, width, shots=None):
    """AF85: the exact micro-javascript backup with the fixed draft written on the evaluation pipeline (selection and scope). A
    reviewer-written empty reply (routed in the browser; no provider) reads at once as '제안된 변경 없음' with its summary, what to
    keep and what is unknown; a source opens and comes back to the same button; close, reopen, reload and a plan file keep it.
    Then a positive plan with a frozen request and a return: a later empty analysis keeps the request text, labels and return as
    made and makes no new request. A positive plan with nothing chosen reads apart from an empty one."""
    context = browser.new_context(viewport={"width": width, "height": 800})
    page = context.new_page()
    shot = lambda name: shots and page.screenshot(path=str(pathlib.Path(shots) / f"zero85-{width}-{name}.png"))
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(ROOT / "tests/fixtures/context75/micro-javascript-backup.json"))
    expect(page.locator("#crumbs")).to_contain_text("micro-javascript")
    project = page.evaluate(ENTRY, re.search(r"#/p/([^/]+)", page.url).group(1))
    assert project["id"] == "P_6a74a281-f0dd-4dd8-8e00-d5b013112326", project["id"]
    ref = {"id": ZERO85_PIPE, "name": "평가 실행 파이프라인"}
    bundle = {"draft": ZERO85_SENTENCE, "extra": [], "plan": None, "by": None, "snapshots": [], "labels": {}, "origins": {}, "observations": [], "attached": {},
        "authoring": {"version": "authoring-context.1", "draft": {"state": "set", "context": {"projectId": project["id"], "selection": ref, "scope": ref, "at": "2026-10-28T00:00:00.000Z", "how": "explicit"}}, "analyzed": None}}
    page.evaluate("([id, b]) => localStorage.setItem('agentflow.studio.plans.1', JSON.stringify({ version: 'studio.plans.3', projects: { [id]: b } }))", [project["id"], bundle])
    page.reload()
    expect(page.locator("#crumbs")).to_contain_text("micro-javascript")
    stored = lambda: page.evaluate("id => JSON.parse(localStorage.getItem('agentflow.studio.plans.1')).projects[id]", project["id"])
    where = lambda: [page.url, page.locator("#crumbs").inner_text(), page.locator("#world .selected").count()]
    before = where()
    page.locator("#plan-entry").click()
    area, panel = page.locator("#plan-intent"), page.locator("#plan-panel")
    expect(area).to_have_value(ZERO85_SENTENCE)
    expect(page.locator("#plan-ctx")).to_contain_text("평가 실행 파이프라인")
    sent = []
    def reply(analysis):
        def handle(route):
            sent.append(route.request.post_data_json)
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": analysis(sent[-1]) if callable(analysis) else analysis}))
        page.unroute("**/api/studio/plan"); page.route("**/api/studio/plan", handle)
    reply(ZERO85_EMPTY)
    page.locator("#plan-ask").click()
    # 1) The request the page sent: .3, the whole map, the draft, its context on the pipeline; then the empty reply reads at once.
    body = sent[-1]
    assert body["schemaVersion"] == "studio.plan.3" and body["intent"] == ZERO85_SENTENCE, body["schemaVersion"]
    assert len(body["parts"]) == 6 and [e["id"] for e in body["evidence"]] == ["INTENT", "M01", "M02", "M03", "M04", "M05", "M06", "N01", "N02"]
    assert body["authoring"]["selection"]["nameThen"] == "평가 실행 파이프라인" and body["authoring"]["scope"] == body["authoring"]["selection"]
    sources = {e["id"]: e for e in body["evidence"]}
    work = panel.locator(".pw-nochange")
    expect(page.locator("#plan-title")).to_have_text("제안된 변경 없음")
    expect(work).to_contain_text(ZERO85_EMPTY["summary"])
    expect(work).to_contain_text("변경이 필요 없다고 확인했거나 바라는 결과가 이미 이루어졌다는 뜻은 아니에요")
    for line in ZERO85_EMPTY["preserve"] + ZERO85_EMPTY["unknowns"]: expect(work.locator("li", has_text=line)).to_have_count(1)
    # AF87: the material list is the right column's work (once, not in the body); no request button for an empty analysis.
    expect(panel.locator(".pw-rail .pw-srcs .pw-src")).to_have_count(9)
    expect(work.locator("[data-ref]")).to_have_count(0)
    expect(panel.locator(".pw-pick, .callout, .pw-list")).to_have_count(0)
    expect(panel).not_to_contain_text("0/0")
    expect(page.locator("#plan-make")).to_have_count(0)
    expect(work).to_contain_text("요청에 넣을 변경이 없어 요청문은 만들지 않아요")
    no_page_scroll(page)
    shot("1-empty")
    # The exact source and back to the same button; draft and context untouched.
    panel.locator('.pw-srcs [data-ref="N01"]').click()
    expect(panel.locator(".pw-rail-head h3")).to_have_text("자료 N01")
    assert panel.locator(".pw-rail .pp-sources details > p").first.text_content() == sources["N01"]["text"]
    expect(panel.locator(".pw-rail")).to_contain_text("MemoryLimitError")
    shot("2-source")
    page.locator("#pw-rail-back").click()
    assert page.evaluate("() => document.activeElement.dataset.ref") == "N01"
    kept = stored()
    assert kept["draft"] == ZERO85_SENTENCE and kept["authoring"]["draft"] == bundle["authoring"]["draft"]
    assert kept["authoring"]["analyzed"]["authoring"] == bundle["authoring"]["draft"]
    assert kept["plan"]["analysis"] == ZERO85_EMPTY and kept["plan"]["selected"] == [] and kept["by"]["model"] == "stub-model"
    # Escape closes to the same map (selection, scope); reopen, reload and a plan file read the same analysis.
    page.keyboard.press("Escape")
    expect(panel).to_be_hidden()
    assert where() == before, (where(), before)
    page.locator("#toast").get_by_role("button", name="다시 열기").click()
    expect(page.locator("#plan-title")).to_have_text("제안된 변경 없음")
    page.reload()
    page.locator("#plan-entry").click()
    expect(page.locator("#plan-title")).to_have_text("제안된 변경 없음")
    expect(work).to_contain_text(ZERO85_EMPTY["summary"])
    with page.expect_download() as dl: page.get_by_role("button", name="파일로 내보내기").click()
    plan_path = dl.value.path()
    assert json.loads(pathlib.Path(plan_path).read_text(encoding="utf-8"))["format"] == "agentflow.change-plan-file.4"  # AF94: files are .4
    page.once("dialog", lambda d: d.accept())
    page.locator("#plan-import-file").set_input_files(plan_path)
    expect(panel).to_contain_text("변경안 파일을 가져왔어요.")
    expect(page.locator("#plan-title")).to_have_text("제안된 변경 없음")
    assert stored()["plan"] == kept["plan"]
    # A draft edited after the analysis: the analysis keeps its own material apart from what would be sent next.
    panel.get_by_role("button", name="문장 고치기").click()
    area.press("End"); area.type(" 추가")
    expect(work.locator(".pw-stale")).to_be_visible()
    expect(panel.locator(".pw-srcs h3")).to_have_text("이번 분석에 넣은 자료 9")
    expect(page.locator("#plan-ask")).to_have_text("고친 문장으로 살펴보기")
    area.fill(ZERO85_SENTENCE)
    expect(work.locator(".pw-stale")).to_be_hidden()
    # 4) + 2) A positive plan: nothing chosen reads apart from an empty analysis; then a frozen request and a return.
    def positive(ask):
        alias = next(p["id"] for p in ask["parts"] if p["name"] == "오류 처리")
        return {"summary": "[테스트 응답] 두 예외 이름을 재사용한다.", "items": [{"id": "c1", "title": "[테스트] 제한 종류별 안내", "description": "[테스트 응답] 두 예외를 구별해 알린다.",
            "partIds": [alias], "refs": ["INTENT", "N01"], "dependsOn": []}], "impacts": [], "preserve": [], "unknowns": []}
    reply(positive)
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-strip .ps-item")).to_have_text("[테스트] 제한 종류별 안내")
    page.locator("#plan-strip .ps-more").click()
    expect(page.locator("#plan-title")).to_have_text("변경안 · 1가지 변화")
    page.locator("#pw-inc-c1").uncheck()
    expect(panel.locator(".pw-count")).to_have_text("0/1 포함")
    expect(panel.locator(".pw-req")).to_contain_text("왼쪽 목록에서 ‘이번 요청에 포함’을 고르세요")
    expect(page.locator("#plan-make")).to_be_disabled()
    expect(panel.locator(".pw-nochange")).to_have_count(0)
    shot("4-positive-none-chosen")
    page.locator("#pw-inc-c1").check()
    page.route("**/api/studio/scope", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model",
        "reply": {"summary": "[테스트 응답] 추가 전제 없음.", "prerequisites": [], "unknowns": []}})))
    page.locator("#plan-make").click()
    expect(page.locator("#plan-sheet")).to_be_visible()
    page.keyboard.press("Escape")
    obs = {"id": "O_zero85", "itemId": "c1", "kind": "report", "text": "[테스트] 돌아온 보고 원문", "basis": "[테스트] 작업 보고", "refs": []}
    page.evaluate("([id, o]) => { const env = JSON.parse(localStorage.getItem('agentflow.studio.plans.1')); const b = env.projects[id]; b.observations.push(o); b.attached[o.id] = b.snapshots[0].id; localStorage.setItem('agentflow.studio.plans.1', JSON.stringify(env)); }", [project["id"], obs])
    page.reload()
    frozen = stored()
    assert len(frozen["snapshots"]) == 1 and frozen["snapshots"][0]["scope"]["items"][0]["title"] == "[테스트] 제한 종류별 안내"
    page.locator("#plan-entry").click()
    page.locator("#plan-strip").get_by_role("button", name="문장 고치기").click()
    reply(ZERO85_EMPTY)
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-title")).to_have_text("제안된 변경 없음")
    expect(page.locator("#plan-make")).to_have_count(0)
    expect(panel.locator(".pw-earlier")).to_contain_text("마지막 요청문 뒤로 다시 살펴봤어요")
    shot("3-empty-after-request")
    after = stored()
    for k in ["snapshots", "labels", "origins", "observations", "attached"]: assert after[k] == frozen[k], k
    assert after["plan"]["analysis"]["items"] == [] and after["plan"]["id"] != frozen["snapshots"][0]["planId"]
    panel.get_by_role("button", name=re.compile("^마지막 요청문")).click()
    assert page.evaluate(SHEET_TEXT) == frozen["snapshots"][0]["text"]  # AF94: its sections joined are the text
    expect(page.locator("#plan-sheet header")).to_contain_text("[테스트] 제한 종류별 안내")
    page.keyboard.press("Escape")
    panel.get_by_role("button", name=re.compile("^돌아온 기록 · 요청문 1개")).click()
    expect(panel.locator(".pw-rail")).to_contain_text("[테스트] 돌아온 보고 원문")
    page.locator("#pw-rail-back").click()
    page.reload()
    page.locator("#plan-entry").click()
    expect(page.locator("#plan-title")).to_have_text("제안된 변경 없음")
    assert stored()["snapshots"] == frozen["snapshots"]
    page.unroute("**/api/studio/plan"); page.unroute("**/api/studio/scope")
    context.close()


def reading87_flow(browser, base, size, shots=None):
    """AF87: the stored real 85 reply (actual-model.json: its ask and outcome.reply, replayed in the browser; no provider) after an
    earlier request with a return. The empty analysis's right column lists the material it was given, frozen with the plan (ids,
    kinds, whole titles, order); a source read there comes back to the same button with the list and the body where they were. The
    earlier request and its return are opened and read; a draft edited since and new material stay apart from the frozen list."""
    actual = json.loads((ROOT.parents[1] / "docs/cycles/2026-10-29-real-context-reading-85/evidence/final/actual-model.json").read_text(encoding="utf-8"))
    real, asked = actual["outcome"]["reply"], actual["ask"]
    assert real["items"] == [] and actual["providerRequests"] == 1
    w, hgt = size
    context = browser.new_context(viewport={"width": w, "height": hgt})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    shot = lambda name: shots and page.screenshot(path=str(pathlib.Path(shots) / f"reading87-{w}x{hgt}-{name}.png"))
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(ROOT / "tests/fixtures/context75/micro-javascript-backup.json"))
    expect(page.locator("#crumbs")).to_contain_text("micro-javascript")
    project = page.evaluate(ENTRY, re.search(r"#/p/([^/]+)", page.url).group(1))
    ref = {"id": ZERO85_PIPE, "name": "평가 실행 파이프라인"}
    draft_ctx = {"state": "set", "context": {"projectId": project["id"], "selection": ref, "scope": ref, "at": "2026-10-28T00:00:00.000Z", "how": "explicit"}}
    bundle = {"draft": asked["intent"], "extra": [], "plan": None, "by": None, "snapshots": [], "labels": {}, "origins": {}, "observations": [], "attached": {},
        "authoring": {"version": "authoring-context.1", "draft": draft_ctx, "analyzed": None}}
    page.evaluate("([id, b]) => localStorage.setItem('agentflow.studio.plans.1', JSON.stringify({ version: 'studio.plans.3', projects: { [id]: b } }))", [project["id"], bundle])
    page.reload()
    stored = lambda: page.evaluate("id => JSON.parse(localStorage.getItem('agentflow.studio.plans.1')).projects[id]", project["id"])
    panel, area = page.locator("#plan-panel"), page.locator("#plan-intent")
    sent = []
    def reply(analysis):
        def handle(route):
            sent.append(route.request.post_data_json)
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "deepseek-flash", "reply": analysis(sent[-1]) if callable(analysis) else analysis}))
        page.unroute("**/api/studio/plan"); page.route("**/api/studio/plan", handle)
    # An earlier positive plan, its frozen request and a return (written for this check: [테스트]), then the stored real empty reply.
    page.locator("#plan-entry").click()
    reply(lambda ask: {"summary": "[테스트 응답] 두 예외 이름을 재사용한다.", "items": [{"id": "c1", "title": "[테스트] 제한 종류별 안내", "description": "[테스트 응답] 두 예외를 구별해 알린다.",
        "partIds": [next(p["id"] for p in ask["parts"] if p["name"] == "오류 처리")], "refs": ["INTENT", "N01"], "dependsOn": []}], "impacts": [], "preserve": [], "unknowns": []})
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-strip .ps-item")).to_have_text("[테스트] 제한 종류별 안내")
    page.locator("#plan-strip .ps-more").click()
    page.route("**/api/studio/scope", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model",
        "reply": {"summary": "[테스트 응답] 추가 전제 없음.", "prerequisites": [], "unknowns": []}})))
    page.locator("#plan-make").click()
    expect(page.locator("#plan-sheet")).to_be_visible()
    page.keyboard.press("Escape")
    obs = {"id": "O_reading87", "itemId": "c1", "kind": "report", "text": "[테스트] 돌아온 보고 원문 · 두 예외를 구별해 안내하도록 바꿨다는 담당 보고", "basis": "[테스트] 작업 보고", "refs": []}
    page.evaluate("([id, o]) => { const env = JSON.parse(localStorage.getItem('agentflow.studio.plans.1')); const b = env.projects[id]; b.observations.push(o); b.attached[o.id] = b.snapshots[0].id; localStorage.setItem('agentflow.studio.plans.1', JSON.stringify(env)); }", [project["id"], obs])
    page.reload()
    frozen = stored()
    page.locator("#plan-entry").click()
    page.locator("#plan-strip").get_by_role("button", name="문장 고치기").click()
    reply(real)
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-title")).to_have_text("제안된 변경 없음")
    body = sent[-1]
    view = lambda list: [[e["id"], e["kind"], e["title"], e["text"]] for e in list]
    assert body["schemaVersion"] == "studio.plan.3" and body["intent"] == asked["intent"] and view(body["evidence"]) == view(asked["evidence"]), "same material as the real request (basis times aside)"
    # The right column: every material once, in the plan's order, its whole title readable at this width; none in the body.
    plan = stored()["plan"]
    assert view(plan["evidence"]) == view(body["evidence"])
    rail, srcs, work = panel.locator(".pw-rail-body"), panel.locator(".pw-srcs .pw-src"), panel.locator(".pw-nochange")
    expect(panel.locator(".pw-srcs h3")).to_have_text(f"이번 분석에 넣은 자료 {len(plan['evidence'])}")
    expect(srcs).to_have_count(len(plan["evidence"]))
    expect(work.locator("[data-ref]")).to_have_count(0)
    expect(page.locator("#plan-make")).to_have_count(0)
    expect(panel.locator(".pw-rail")).to_have_attribute("aria-label", "이번 분석에 넣은 자료")
    kinds = {"user": "사용자 발언", "reading": "기록에서 읽은 이해", "record": "붙여넣은 기록"}
    for n, e in enumerate(plan["evidence"]):
        row = srcs.nth(n)
        assert row.get_attribute("data-ref") == e["id"]
        assert row.locator(".pw-src-id").inner_text() == e["id"] and row.locator(".pp-kind").inner_text() == kinds[e["kind"]]
        title = row.locator(".pw-src-title")
        assert title.inner_text().replace("\n", "") == e["title"], (title.inner_text(), e["title"])
        fit = title.evaluate("t => { const r = t.getBoundingClientRect(), p = t.closest('.pw-rail-body').getBoundingClientRect(), lh = parseFloat(getComputedStyle(t).lineHeight); return [t.scrollWidth <= t.clientWidth + 1, r.left >= p.left - 1 && r.right <= p.right + 1, Math.round(r.height / lh), Math.round(r.height / lh) === 1 || r.width >= p.width - 64]; }")
        # Whole and wide: never clipped or squeezed into a narrow column (a long source URL may take a few lines).
        assert fit[0] and fit[1] and fit[3] and fit[2] <= 6, (e["id"], fit)
    assert rail.evaluate("r => r.scrollWidth <= r.clientWidth"), "no sideways scroll in the column"
    # The body reads the analysis whole: neutral note, summary, what to keep, what is unknown.
    expect(work).to_contain_text("변경이 필요 없다고 확인했거나 바라는 결과가 이미 이루어졌다는 뜻은 아니에요")
    for line in [real["summary"], *real["preserve"], *real["unknowns"]]: assert line in work.inner_text(), line
    no_page_scroll(page)
    shot("1-list")
    # With the draft open (unchanged, so the plan stays current) the body scrolls at 720 too: body and list scrolled to different
    # places, a backward selection in the draft; N01 brought into view in the list (its own scroll), then opened.
    page.locator(".pw-head-tools").get_by_role("button", name="문장 고치기").click()
    area.evaluate("a => a.setSelectionRange(5, 12, 'backward')")
    caret = "a => [a.selectionStart, a.selectionEnd, a.selectionDirection, a.value]"
    left = area.evaluate(caret)
    work.evaluate("d => { d.scrollTop = Math.floor((d.scrollHeight - d.clientHeight) / 2); }")
    n01 = panel.locator('.pw-srcs [data-ref="N01"]')
    rail.evaluate("r => { r.scrollTop = r.scrollHeight; }")
    n01.scroll_into_view_if_needed()
    at = [work.evaluate("d => d.scrollTop"), rail.evaluate("r => r.scrollTop")]
    scrollable = rail.evaluate("r => r.scrollHeight > r.clientHeight")
    body_scrolls = work.evaluate("d => d.scrollHeight > d.clientHeight")
    assert (not scrollable or at[1] > 0) and (not body_scrolls or at[0] > 0) and (body_scrolls or hgt > 720), (at, scrollable, body_scrolls)
    n01.click()
    expect(panel.locator(".pw-rail-head h3")).to_have_text("자료 N01")
    expect(page.locator("#pw-rail-back")).to_have_text("‹ 자료 목록으로")
    source = panel.locator(".pw-rail .pp-sources details")
    expect(source).to_have_attribute("open", "")
    text = source.locator("> p").first
    expect(text).to_be_visible()
    n01_text = next(e["text"] for e in plan["evidence"] if e["id"] == "N01")
    assert text.text_content() == n01_text
    rail.evaluate("r => { r.scrollTop = r.scrollHeight; }")  # reads the long excerpt to its end
    assert text.evaluate("p => p.getBoundingClientRect().bottom <= p.closest('.pw-rail-body').getBoundingClientRect().bottom + 1")
    assert "MemoryLimitError" in text.inner_text() and "TimeLimitError" in text.inner_text()
    shot("2-source-end")
    page.locator("#pw-rail-back").click()
    assert page.evaluate("() => document.activeElement.dataset.ref") == "N01"
    assert [work.evaluate("d => d.scrollTop"), rail.evaluate("r => r.scrollTop")] == at, ([work.evaluate("d => d.scrollTop"), rail.evaluate("r => r.scrollTop")], at)
    assert area.evaluate(caret) == left, area.evaluate(caret)
    # Escape from a source comes back the same way.
    n01.click(); page.keyboard.press("Escape")
    assert page.evaluate("() => document.activeElement.dataset.ref") == "N01" and rail.evaluate("r => r.scrollTop") == at[1]
    shot("3-back")
    panel.get_by_role("button", name="접기", exact=True).click()
    # The earlier request and its return, opened and read on screen (not a closed fold's text).
    earlier = panel.locator(".pw-earlier")
    earlier.get_by_role("button", name=re.compile("^마지막 요청문")).click()
    pre = page.locator(SHEET_BODY)  # AF94: a document made here opens on its sections; its pieces joined are the text
    expect(pre).to_be_visible()
    assert page.evaluate(SHEET_TEXT) == frozen["snapshots"][0]["text"]
    page.keyboard.press("Escape")
    # DELTA1: the returned results open from the list's end and come back to the same place and the same control (back and Esc).
    results = earlier.locator('[data-entry="results"]')
    expect(results).to_have_text("돌아온 기록 · 요청문 1개")
    active_entry = "() => [document.activeElement.dataset.entry ?? null, document.activeElement.tagName]"
    rail.evaluate("r => { r.scrollTop = r.scrollHeight; }")
    list_at = rail.evaluate("r => r.scrollTop")
    assert list_at > 0 or not rail.evaluate("r => r.scrollHeight > r.clientHeight"), list_at
    for way in ("back", "escape"):
        results.click()
        expect(panel.locator(".pw-rail-head h3")).to_have_text("돌아온 기록")
        item = panel.locator(".pw-rail .pp-res li.has details").first
        if item.get_attribute("open") is None: item.locator("summary").click()
        expect(item).to_have_attribute("open", "")
        expect(item.locator("p", has_text=obs["text"])).to_be_visible()
        if way == "back": shot("4-return")
        page.locator("#pw-rail-back").click() if way == "back" else page.keyboard.press("Escape")
        expect(srcs).to_have_count(9)
        assert rail.evaluate("r => r.scrollTop") == list_at and page.evaluate(active_entry) == ["results", "BUTTON"], (way, rail.evaluate("r => r.scrollTop"), list_at, page.evaluate(active_entry))
    shot("4b-back-from-return")
    for k in ["snapshots", "labels", "origins", "observations", "attached"]: assert stored()[k] == frozen[k], k
    # A draft edited since and new material: the frozen list stays the plan's; what the next analysis would read is listed apart.
    panel.get_by_role("button", name="문장 고치기").click()
    area.press("End"); area.type(" 추가")
    expect(work.locator(".pw-stale")).to_be_visible()
    expect(srcs).to_have_count(9)
    # The next analysis's material (the editor's count) opens in the list's place and closes back to it: back, Esc, the toggle.
    toggle = panel.locator(".pp-intent .pp-sources-count")
    on_toggle = "() => document.activeElement.classList.contains('pp-sources-count')"
    rail.evaluate("r => { r.scrollTop = r.scrollHeight; }")
    list_at = rail.evaluate("r => r.scrollTop")
    for way in ("escape", "toggle"):
        toggle.click()
        expect(panel.locator(".pw-rail-head h3")).to_contain_text("읽는 자료")
        page.keyboard.press("Escape") if way == "escape" else toggle.click()
        expect(srcs).to_have_count(9)
        assert rail.evaluate("r => r.scrollTop") == list_at and page.evaluate(on_toggle), (way, rail.evaluate("r => r.scrollTop"), list_at)
    toggle.click()
    expect(panel.locator(".pw-rail-head h3")).to_contain_text("읽는 자료")
    panel.get_by_role("button", name="+ 자료 추가").click()
    page.locator("#src-title").fill("[테스트] 새로 붙인 보고"); page.locator("#src-text").fill("[테스트] 새 자료 원문"); page.locator("#src-basis").fill("[테스트] 기준")
    panel.get_by_role("button", name="추가", exact=True).click()
    expect(panel.locator(".pp-extra")).to_contain_text("[테스트] 새로 붙인 보고")
    page.locator("#pw-rail-back").click()
    expect(srcs).to_have_count(9)
    assert rail.evaluate("r => r.scrollTop") == list_at and page.evaluate(on_toggle), (rail.evaluate("r => r.scrollTop"), list_at)
    assert [srcs.nth(i).get_attribute("data-ref") for i in range(9)] == [e["id"] for e in plan["evidence"]]
    expect(panel.locator(".pw-srcs")).not_to_contain_text("[테스트] 새로 붙인 보고")
    shot("5-stale-new-material")
    kept = stored()
    assert kept["plan"] == plan and kept["extra"][0]["title"] == "[테스트] 새로 붙인 보고" and kept["authoring"]["draft"] == draft_ctx
    assert kept["draft"] == asked["intent"] + " 추가"
    # Closing keeps the draft; reopening shows the same list.
    page.keyboard.press("Escape")  # the plan is behind the draft: Escape closes to the current map, the draft kept
    expect(panel).to_be_hidden()
    page.locator("#plan-entry").click()
    expect(area).to_have_value(asked["intent"] + " 추가")
    expect(srcs).to_have_count(9)
    assert errors == [], errors
    page.unroute("**/api/studio/plan"); page.unroute("**/api/studio/scope")
    context.close()


def request93_flow(browser, base, size, shots=None):
    """AF93: closing a request document (X, the footer's 닫기, Esc) returns to the control that opened it, at the same place: right
    after making one, '마지막 요청문' beside an enabled '요청문 만들기', the same with a stale draft (make disabled), and a no-change
    analysis's '이전 요청'. Reading the long frozen document keeps its scroll across a copy; Tab from the text reaches the close
    controls. Opening and closing makes, sends and changes nothing. Author-written fixture: the exact micro backup with stubbed
    replies routed in the browser ([테스트]), not a model reply and not root's 88 saved-file check.
    AF94: documents made here now open on their sections. The reading body ([data-sheet-part=text]) takes the pre's place for scroll
    and focus; the text shown is compared as the sections' pieces joined (SHEET_TEXT); Tab from the text reaches copy through the
    reader's own material folds (each stop inside the sheet), and the place a copy must keep is taken where the copy is pressed; a
    copy blocked while reading by sections says to use the text view (no partial selection)."""
    w, hgt = size
    context = browser.new_context(viewport={"width": w, "height": hgt})
    page = context.new_page()
    errors, calls = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    shot = lambda name: shots and page.screenshot(path=str(pathlib.Path(shots) / f"request93-{w}x{hgt}-{name}.png"))
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(ROOT / "tests/fixtures/context75/micro-javascript-backup.json"))
    expect(page.locator("#crumbs")).to_contain_text("micro-javascript")
    project = page.evaluate(ENTRY, re.search(r"#/p/([^/]+)", page.url).group(1))
    ref = {"id": ZERO85_PIPE, "name": "평가 실행 파이프라인"}
    bundle = {"draft": ZERO85_SENTENCE, "extra": [], "plan": None, "by": None, "snapshots": [], "labels": {}, "origins": {}, "observations": [], "attached": {},
        "authoring": {"version": "authoring-context.1", "draft": {"state": "set", "context": {"projectId": project["id"], "selection": ref, "scope": ref, "at": "2026-10-28T00:00:00.000Z", "how": "explicit"}}, "analyzed": None}}
    page.evaluate("([id, b]) => localStorage.setItem('agentflow.studio.plans.1', JSON.stringify({ version: 'studio.plans.3', projects: { [id]: b } }))", [project["id"], bundle])
    page.reload()
    stored = lambda: page.evaluate("id => JSON.parse(localStorage.getItem('agentflow.studio.plans.1')).projects[id]", project["id"])
    panel, sheet, area = page.locator("#plan-panel"), page.locator("#plan-sheet"), page.locator("#plan-intent")
    rail, pre = panel.locator(".pw-rail-body"), page.locator(SHEET_BODY)
    def tab_to(part):
        """Tab until focus is on this part of the sheet, never leaving it (AF94: the material folds sit between text and copy)."""
        for _ in range(40):
            if page.evaluate(focused)[1] == part: return
            page.keyboard.press("Tab"); assert page.evaluate(focused)[3] == "sheet", page.evaluate(focused)
        assert page.evaluate(focused)[1] == part, page.evaluate(focused)
    def reply(analysis):
        def handle(route):
            calls.append(route.request.url)
            route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": analysis(route.request.post_data_json) if callable(analysis) else analysis}))
        page.unroute("**/api/studio/plan"); page.route("**/api/studio/plan", handle)
    page.route("**/api/studio/scope", lambda route: (calls.append(route.request.url), route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model",
        "reply": {"summary": "[테스트 응답] 추가 전제 없음.", "prerequisites": [], "unknowns": []}}))))
    positive = lambda ask: {"summary": "[테스트 응답] 두 예외 이름을 재사용한다.", "items": [{"id": "c1", "title": "[테스트] 제한 종류별 안내", "description": "[테스트 응답] 두 예외를 구별해 알린다.",
        "partIds": [next(p["id"] for p in ask["parts"] if p["name"] == "오류 처리")], "refs": ["INTENT", "N01"], "dependsOn": []}], "impacts": [], "preserve": [], "unknowns": []}
    world = lambda: [page.url, page.evaluate("() => document.getElementById('world')?.style.transform ?? ''")]
    focused = "() => { const a = document.activeElement; return [a.id || null, a.dataset.sheetEntry ?? a.dataset.sheetPart ?? null, a.textContent.trim().slice(0, 24), a.closest('#plan-sheet') ? 'sheet' : a.closest('.pw-earlier') ? 'earlier' : a.closest('.pw-req') ? 'request' : a.tagName]; }"
    page.locator("#plan-entry").click()
    reply(positive)
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-strip .ps-item")).to_have_text("[테스트] 제한 종류별 안내")
    page.locator("#plan-strip .ps-more").click()
    # 1) Right after making it: the document opens on 복사; Tab goes on to 닫기; closing returns to 요청문 만들기 (still enabled).
    page.locator("#plan-make").click()
    expect(sheet).to_be_visible()
    assert page.evaluate(focused)[0] == "plan-copy", page.evaluate(focused)
    made = stored()
    assert len(made["snapshots"]) == 1
    text = made["snapshots"][0]["text"]
    assert page.evaluate(SHEET_TEXT) == text and pre.evaluate("p => p.scrollHeight > p.clientHeight"), "a long frozen document that scrolls"
    page.keyboard.press("Tab")
    assert page.evaluate(focused)[1] == "close", page.evaluate(focused)
    shot("1-made-tab-close")
    before = [world(), rail.evaluate("r => r.scrollTop")]
    page.keyboard.press("Enter")
    expect(sheet).to_be_hidden()
    assert page.evaluate(focused)[0] == "plan-make" and page.locator("#plan-make").is_enabled(), page.evaluate(focused)
    assert [world(), rail.evaluate("r => r.scrollTop")] == before
    # 2) '마지막 요청문' beside an enabled make: reading starts in the text; a copy keeps the read place and focus; every way closes
    #    back to '마지막 요청문', never to make.
    last = panel.locator('[data-sheet-entry="last"]')
    for way in ("x", "close", "escape"):
        last.click()
        expect(sheet).to_be_visible()
        assert page.evaluate(focused)[1] == "text", page.evaluate(focused)
        pre.evaluate("p => { p.scrollTop = Math.floor((p.scrollHeight - p.clientHeight) / 2); }")
        top = pre.evaluate("p => p.scrollTop")
        assert top > 0
        if way == "close":
            tab_to("copy")  # AF94: through the material folds; focusing them may scroll the reading, so the place is taken here
            top = pre.evaluate("p => p.scrollTop")
            page.keyboard.press("Enter")  # copy (or the copy-blocked message): the same document re-renders in place
            expect(sheet.locator("footer [role=status]")).not_to_have_text("복사는 이 글을 옮기는 일이에요. 접수·실행·완료를 기록하지 않아요.")
            assert page.evaluate(focused)[1] == "copy" and pre.evaluate("p => p.scrollTop") == top, (page.evaluate(focused), pre.evaluate("p => p.scrollTop"), top)
            page.keyboard.press("Tab")
            assert page.evaluate(focused)[1] == "close", page.evaluate(focused)
            shot("2-last-read-copy-tab")
            page.keyboard.press("Enter")
        elif way == "x": sheet.locator('[data-sheet-part="x"]').click()
        else: page.keyboard.press("Escape")
        expect(sheet).to_be_hidden()
        assert page.evaluate(focused)[1:] == ["last", last.inner_text().strip()[:24], "request"], (way, page.evaluate(focused))
    # 3) A long stale draft (make disabled), selected backward by keyboard and scrolled inside the field: opening, a copy in the
    #    same document and closing (× by keyboard, Esc) keep the text, the selection and the field's own scroll; focus back on
    #    '마지막 요청문'. (DELTA1: the field's scrollTop was lost on every workspace render.)
    panel.locator(".pw-head-tools").get_by_role("button", name="문장 고치기").click()
    long_draft = ZERO85_SENTENCE + "".join(f"\n[AF93 복귀 검사 사본] {n + 1}번째 줄 · 긴 초안 안에서 읽던 위치" for n in range(35))
    area.fill(long_draft)
    expect(page.locator("#plan-make")).to_be_disabled()
    area.focus(); page.keyboard.press("Control+Home")
    for _ in range(15): page.keyboard.press("ArrowRight")
    for _ in range(11): page.keyboard.press("Shift+ArrowLeft")
    area.evaluate("a => { a.scrollTop = 200; }")
    caret = "a => [a.selectionStart, a.selectionEnd, a.selectionDirection, a.scrollTop, a.value]"
    left, kept = area.evaluate(caret), stored()
    assert left[:4] == [4, 15, "backward", 200] and left[4] == long_draft, left[:4]
    for way in ("keyboard", "copy", "escape"):
        last.click()
        expect(sheet).to_be_visible()
        assert page.evaluate(SHEET_TEXT) == text and page.evaluate(focused)[1] == "text", page.evaluate(focused)
        assert area.evaluate(caret) == left, ("open", way, area.evaluate(caret)[:4])
        if way == "keyboard":  # from the text by keyboard alone: Shift+Tab reaches × and Enter closes
            page.keyboard.press("Shift+Tab")
            assert page.evaluate(focused)[1] == "x", page.evaluate(focused)
            page.keyboard.press("Enter")
        elif way == "copy":  # the same document re-renders for its copy message; the draft behind it stays as it was read
            tab_to("copy"); page.keyboard.press("Enter")
            expect(sheet.locator("footer [role=status]")).not_to_have_text("복사는 이 글을 옮기는 일이에요. 접수·실행·완료를 기록하지 않아요.")
            assert page.evaluate(focused)[1] == "copy" and area.evaluate(caret) == left, area.evaluate(caret)[:4]
            page.keyboard.press("Escape")
        else: page.keyboard.press("Escape")
        expect(sheet).to_be_hidden()
        assert page.evaluate(focused)[1] == "last", (way, page.evaluate(focused))
        assert page.locator("#plan-make").is_disabled() and area.evaluate(caret) == left, (way, area.evaluate(caret)[:4])
    shot("3-stale-back-to-last")
    assert stored() == kept, "reading changes nothing stored"
    # DELTA1: a copy still pending when its document closes, is reopened, or the plan itself closes and opens again (a synthetic
    # clipboard held by the test: writeText is replaced in the page and settled by hand). Its late end says nothing anywhere.
    page.evaluate("() => { window.__clips = []; window.__late = []; navigator.clipboard.writeText = () => new Promise((res, rej) => window.__clips.push({ res, rej, done: false })); addEventListener('unhandledrejection', e => window.__late.push(String(e.reason))); }")
    status, quiet = sheet.locator("footer [role=status]"), "복사는 이 글을 옮기는 일이에요. 접수·실행·완료를 기록하지 않아요."
    boundaries = []
    def press_copy():
        n = page.evaluate("() => window.__clips.length")
        sheet.locator('[data-sheet-part="copy"]').click()
        assert page.evaluate("() => window.__clips.length") == n + 1, "the copy made its own pending attempt"
        return n
    def held_copy():
        last.click(); expect(sheet).to_be_visible()
        return press_copy()
    def settle(n, how, at):
        """Settle attempt n by hand: it must exist and still be pending (never a silent no-op). Recorded with where it ended."""
        ok = page.evaluate("([n, how]) => { const c = window.__clips[n]; if (!c || c.done) return false; c.done = true; how === 'res' ? c.res() : c.rej(new Error('late')); return true; }", [n, how])
        assert ok, (n, how, at)
        page.wait_for_timeout(100)
        boundaries.append({"attempt": n, "settled": how, "at": at, "url": page.url, "sheetOpen": sheet.is_visible(), "status": status.inner_text() if sheet.is_visible() else None,
            "focus": page.evaluate(focused), "late": page.evaluate("() => window.__late"), "errors": list(errors)})
        if shots: (pathlib.Path(shots) / f"request93-{w}x{hgt}-boundaries.json").write_text(json.dumps(boundaries, ensure_ascii=False, indent=1), encoding="utf-8")
    first = held_copy(); page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    settle(first, "res", "after its document closed")
    page.wait_for_timeout(100)
    assert sheet.is_hidden() and sheet.inner_html() == "" and page.evaluate(focused)[1] == "last", page.evaluate(focused)
    second = held_copy(); page.keyboard.press("Escape"); last.click(); expect(sheet).to_be_visible()
    settle(second, "rej", "the same document opened again (a new opening)")
    expect(status).to_have_text(quiet)
    assert page.evaluate(focused)[1] == "text" and page.evaluate("() => getSelection().toString()") == "", page.evaluate(focused)
    page.keyboard.press("Escape")
    third = held_copy(); page.keyboard.press("Escape")
    page.keyboard.press("Escape")  # the stale plan closes to the current map (draft kept); its session ends
    expect(panel).to_be_hidden()
    settle(third, "res", "no plan open (its session closed)")
    page.locator("#plan-entry").click(); expect(page.locator("#plan-title")).to_have_text("변경안 · 1가지 변화")
    expect(area).to_have_value(long_draft)
    last.click(); expect(sheet).to_be_visible()
    page.wait_for_timeout(100)
    expect(status).to_have_text(quiet)  # a new session's document never shows an old attempt's message
    page.keyboard.press("Escape")
    assert page.evaluate("() => window.__late") == [] and errors == [], (page.evaluate("() => window.__late"), errors)
    shot("3b-late-copy-quiet")
    area.fill(ZERO85_SENTENCE)
    expect(page.locator("#plan-make")).to_be_enabled()
    # 4) A no-change analysis: '이전 요청' at the list's end; closing comes back there at the same list place. The list's own way
    #    back (AF87: a material and back) is untouched by the document's.
    reply(ZERO85_EMPTY)
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-title")).to_have_text("제안된 변경 없음")
    earlier = panel.locator('.pw-earlier [data-sheet-entry="last"]')
    rail.evaluate("r => { r.scrollTop = r.scrollHeight; }")
    list_at = rail.evaluate("r => r.scrollTop")
    for way in ("close", "escape"):
        earlier.click()
        expect(sheet).to_be_visible()
        assert page.evaluate(SHEET_TEXT) == text
        sheet.locator('[data-sheet-part="close"]').click() if way == "close" else page.keyboard.press("Escape")
        expect(sheet).to_be_hidden()
        assert page.evaluate(focused)[1:] == ["last", earlier.inner_text().strip()[:24], "earlier"] and rail.evaluate("r => r.scrollTop") == list_at, (way, page.evaluate(focused), rail.evaluate("r => r.scrollTop"), list_at)
    shot("4-zero-earlier")
    panel.locator('.pw-srcs [data-ref="N01"]').click()
    page.locator("#pw-rail-back").click()
    assert page.evaluate("() => document.activeElement.dataset.ref") == "N01"
    # Nothing was made, sent or changed by reading: one request, the same text, labels, origins, returns; no other call.
    after = stored()
    for k in ["snapshots", "labels", "origins", "observations", "attached"]: assert after[k] == made[k], k
    assert len(calls) == 3, calls  # the positive analysis, its one scope review, the empty analysis
    assert errors == [], errors
    # TEST DELTA: two attempts left pending in this document; the plan closes and another project (the converter example, opened
    # through the normal UI) makes its own request document; only then do the old attempts end. Neither reaches that document.
    earlier.click(); expect(sheet).to_be_visible()
    old_fail, old_ok = press_copy(), press_copy()
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    page.keyboard.press("Escape"); expect(panel).to_be_hidden()  # the no-change plan closes to the map; its session ends
    page.locator('#crumbs a[href="#/"]').click()
    page.locator('.program-head[href="#/p/ex-converter"]').click()
    expect(page.locator("#crumbs")).to_contain_text("문서 변환기")
    page.locator("#plan-entry").click()
    page.locator("#plan-strip .ps-more").click()
    page.locator("#plan-make").click()  # the authored example's request: made locally, no call
    expect(sheet).to_be_visible()
    other = page.evaluate(SHEET_TEXT)
    assert other != text and page.evaluate(focused)[0] == "plan-copy", page.evaluate(focused)
    settle(old_fail, "rej", "another project's plan session open on its own new document")
    settle(old_ok, "res", "another project's plan session open on its own new document")
    expect(status).to_have_text(quiet)
    assert page.evaluate(focused)[0] == "plan-copy" and page.evaluate(SHEET_TEXT) == other and page.evaluate("() => getSelection().toString()") == ""
    # The latest of two attempts in one open document decides; the earlier one ending later changes nothing.
    older, newer = press_copy(), press_copy()
    settle(newer, "rej", "latest attempt, same open document")
    # AF94: read by its sections, a blocked copy points to the text view (which selects the whole text) instead of a partial selection.
    blocked = "자동 복사가 막혀 있어요. ‘원문 그대로’를 누르면 원문 전체가 선택돼요. 그대로 직접 복사하세요."
    expect(status).to_have_text(blocked)
    settle(older, "res", "earlier attempt ending after the latest, same open document")
    expect(status).to_have_text(blocked)
    shot("5-other-project-late-copy")
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    assert page.evaluate(focused)[0] == "plan-make", page.evaluate(focused)
    assert page.evaluate("() => window.__clips.every(c => c.done)") and len(boundaries) == 7, boundaries
    for k in ["snapshots", "labels", "origins", "observations", "attached"]: assert stored()[k] == made[k], k  # the micro project's own
    assert len(calls) == 3 and page.evaluate("() => window.__late") == [] and errors == [], (calls, page.evaluate("() => window.__late"), errors)
    page.unroute("**/api/studio/plan"); page.unroute("**/api/studio/scope")
    context.close()


# AF94: a document made from 94 on opens on its sections. Every shown piece of its text carries data-at; joined in order they are
# the text (the text view and documents made before 94 show it whole in a pre). Used wherever a check compared the sheet's pre.
SHEET_TEXT = "() => { const s = document.getElementById('plan-sheet'), pre = s.querySelector('pre'); return pre ? pre.textContent : [...s.querySelectorAll('[data-at]')].map(e => e.textContent).join(''); }"
SHEET_BODY = '#plan-sheet [data-sheet-part="text"]'
AF94_FAKE = "\n".join(["# 작업 요청문 초안 · 생성됨 (전달·접수·실행 여부는 확인하지 않음)", "요청문 참조: RQ_fake", "", "선택한 요청 범위:", "- [테스트] 가짜 항목", "",
    "유지할 조건:", "- [테스트] 가짜 유지", "", "전체 구상의 미정 (선택 범위 추가가 아님):", "- 가짜 미정", "", "[N09] 가짜 자료 · user", "자료 기준: 가짜", "```js",
    'throw new MemoryLimitError("## 선택 범위의 전제:") // 🧪👩‍💻', "```", "", *[f"- 반복 구절 {n % 3}: 선택한 요청 범위:" for n in range(24)], "",
    "결과에 이 요청문 참조 RQ_fake를 함께 남겨 주세요."])
AF94_U01 = {"id": "U01", "kind": "report", "title": "[테스트] 붙여 넣은 보고 · 가짜 제목 포함 🧪", "text": AF94_FAKE, "basis": "[테스트] 작성자가 만든 자료"}
AF94_REVIEW = {"summary": "[테스트 응답] 추가 전제 없이 두 예외 이름을 재사용한다.", "prerequisites": [{"title": "[테스트] 예외 이름 확인", "reason": "[테스트 응답] 이름이 이미 있는지 확인 필요", "refs": ["N01"]}],
    "unknowns": ["[테스트 응답] 메시지 문구"]}


def platform_clipboard_text(text, platform=None):
    """AF94 DELTA7: the exact text the operating system clipboard holds after copying text (an oracle for the native copy check
    only; the frozen text, its DOM, store and file stay exact). On Windows (sys.platform win32) writing plain text applies the
    platform's line breaks: every CR LF, lone CR and lone LF of the text becomes CR LF (W3C Clipboard API, write content to the
    clipboard; WPT 63738). Anywhere else it is the text itself. This computes the expected string from the copied text; the read
    value is never trimmed or normalized, so a missing or extra character, lost whitespace or a wrong line break still fails."""
    return re.sub(r"\r\n|\r|\n", "\r\n", text) if (platform or sys.platform) == "win32" else text


def clipboard_read(page, text, where, known=None):
    """AF94 DELTA6 diagnostic, tests only: read the clipboard once, as the check always did (readText is the first call, as before;
    the caller still asserts the very same equality on this first read), and keep what came back next to what was copied. Native
    clipboard methods are used as they are, never replaced; nothing is normalized. The first comparison is written before any
    further look. Text from the clipboard is kept raw only when it is one of the texts the flow made (the expected text, it with
    other line endings, or a known text); anything else is kept as length, SHA-256 and line endings only. It returns the raw read;
    the caller compares it with platform_clipboard_text(text), recorded here as platformExact apart from exact. On a mismatch it then
    reads again 300 ms later and asks which kinds it holds; a failure of those further looks is recorded and changes nothing
    else. Written to $EVIDENCE_DIR (CI uploads app/test-results) and one line to stdout. It decides nothing."""
    clip = page.evaluate("() => navigator.clipboard.readText()")
    try: read_at = page.evaluate("() => performance.now()")  # after the read: no timestamp is taken before it
    except Exception as e: read_at = f"unavailable: {type(e).__name__}"
    u16 = lambda t: len(t.encode("utf-16-le")) // 2
    ends = lambda t: {"crlf": t.count("\r\n"), "lf_alone": t.count("\n") - t.count("\r\n"), "cr_alone": t.count("\r") - t.count("\r\n")}
    facts = lambda t: {"length": len(t), "utf16": u16(t), "sha256": hashlib.sha256(t.encode("utf-8")).hexdigest(), "endings": ends(t)}
    same = {name: clip == t for name, t in (known or {}).items()}
    platform_text = platform_clipboard_text(text)
    made = clip == text or clip == platform_text or clip.replace("\r\n", "\n") == text or any(same.values())  # its words are the flow's own
    first = next((i for i, (a, b) in enumerate(zip(text, clip)) if a != b), None if len(text) == len(clip) else min(len(text), len(clip)))
    window = None if first is None else clip[max(0, first - 40):first + 40]
    diag = {"where": where, "viewport": page.viewport_size, "platform": sys.platform, "exact": clip == text, "platformExact": clip == platform_text,
        "readAtMs": read_at, "expected": facts(text), "platformExpected": facts(platform_text), "clip": facts(clip),
        "firstDiff": first, "clipIsExpectedWithCRLF": clip == text.replace("\n", "\r\n"), "clipIsExpectedWithOtherEndings": clip != text and clip.replace("\r\n", "\n") == text,
        "clipIsPrefixOfExpected": text.startswith(clip), "expectedIsPrefixOfClip": clip.startswith(text), "clipIsKnownText": same, "clipRawKept": made,
        "around": None if first is None else {"expected": repr(text[max(0, first - 40):first + 40]), "clip": repr(window) if made else facts(window)}}
    out = os.environ.get("EVIDENCE_DIR")
    path = pathlib.Path(out) / f"af94-clipboard-{re.sub(r'[^A-Za-z0-9]+', '-', where)}.json" if out else None
    def keep():
        if path:
            try: path.parent.mkdir(parents=True, exist_ok=True); path.write_text(json.dumps(diag, ensure_ascii=False, indent=1), encoding="utf-8")
            except Exception as e: print(f"diag  AF94 clipboard {where}: could not write {path}: {type(e).__name__}", flush=True)
    keep()
    print(f"diag  AF94 clipboard {where}: platform={sys.platform} platformExact={diag['platformExact']} exact={diag['exact']} len={len(text)}/{len(clip)} endings={ends(text)}/{ends(clip)} firstDiff={first} crlfForm={diag['clipIsExpectedWithCRLF']} known={same}", flush=True)
    if clip != platform_text:
        try:
            page.wait_for_timeout(300)
            later = page.evaluate("() => navigator.clipboard.readText()")
            diag["later"] = {**facts(later), "sameAsFirstRead": later == clip, "exact": later == text, "platformExact": later == platform_text}
        except Exception as e: diag["later"] = f"failed: {type(e).__name__}: {str(e)[:200]}"
        try: diag["kinds"] = page.evaluate("async () => { try { return (await navigator.clipboard.read()).map(i => i.types); } catch (e) { return 'read() failed: ' + e.name; } }")
        except Exception as e: diag["kinds"] = f"failed: {type(e).__name__}"
        keep()
        print(f"diag  AF94 clipboard {where}: later={diag['later'] if isinstance(diag['later'], str) else {k: diag['later'][k] for k in ('length', 'sameAsFirstRead', 'exact')}} kinds={diag['kinds']}", flush=True)
    return clip


def request94_flow(browser, base, size, shots=None):
    """AF94 (same steps as tests/request94-flow.mjs, its Node port): a request document made from now on opens on the sections its
    generator wrote, frozen with the text (맡긴 일 · 맡기지 않음 · 전제 후보 · 유지 · 미정 · 검토 미확인 · 자료 · 결과 안내). Material
    (the micro records and a pasted report full of fake request headings, repeated lines, a code fence and emoji) makes no section and
    reads folded, by its own id, title and kind, with the number of materials and that they are not instructions. Moving, unfolding,
    the text view and copying keep each other's place, focus and folds and the draft behind; another opening starts afresh; the copy
    is always the whole text. A document kept by the 93 app (its reading removed: the same pre-94 text) reads as its whole text as
    before. A .3 store with a .2 entry moves to .4 keeping that entry and its marker; reload, export and import keep the reading.
    Author-written fixture: the exact micro backup with stubbed replies routed in the browser ([테스트 응답]); not a model reply."""
    w, hgt = size
    context = browser.new_context(viewport={"width": w, "height": hgt}, accept_downloads=True)
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin=base)
    page = context.new_page()
    errors, calls, record = [], [], {}
    page.on("pageerror", lambda e: errors.append(str(e)))
    def shot(name):
        if shots: page.wait_for_timeout(250); page.screenshot(path=str(pathlib.Path(shots) / f"request94-{w}x{hgt}-{name}.png"))
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(ROOT / "tests/fixtures/context75/micro-javascript-backup.json"))
    expect(page.locator("#crumbs")).to_contain_text("micro-javascript")
    project = page.evaluate(ENTRY, re.search(r"#/p/([^/]+)", page.url).group(1))
    ref = {"id": ZERO85_PIPE, "name": "평가 실행 파이프라인"}
    other = {"draft": "[테스트] 다른 프로젝트의 .2 초안", "extra": [], "plan": None, "by": None, "snapshots": [], "labels": {}, "origins": {}, "observations": [], "attached": {}}
    bundle = {"draft": ZERO85_SENTENCE, "extra": [AF94_U01], "plan": None, "by": None, "snapshots": [], "labels": {}, "origins": {}, "observations": [], "attached": {},
        "authoring": {"version": "authoring-context.1", "draft": {"state": "set", "context": {"projectId": project["id"], "selection": ref, "scope": ref, "at": "2026-10-28T00:00:00.000Z", "how": "explicit"}}, "analyzed": None}}
    put3 = "([id, b, o]) => localStorage.setItem('agentflow.studio.plans.1', JSON.stringify({ version: 'studio.plans.3', projects: { [id]: b, P_other94: o }, legacy: { P_other94: 'studio.plans.2' } }))"
    page.evaluate(put3, [project["id"], bundle, other])
    page.reload()
    env = lambda: page.evaluate("() => JSON.parse(localStorage.getItem('agentflow.studio.plans.1'))")
    stored = lambda: env()["projects"][project["id"]]
    panel, sheet, area = page.locator("#plan-panel"), page.locator("#plan-sheet"), page.locator("#plan-intent")
    status, body, last = sheet.locator("footer [role=status]"), page.locator(SHEET_BODY), panel.locator('[data-sheet-entry="last"]')
    quiet = "복사는 이 글을 옮기는 일이에요. 접수·실행·완료를 기록하지 않아요."
    focused = "() => { const a = document.activeElement; return [a.id || null, a.dataset.sheetEntry ?? a.dataset.sheetPart ?? null, a.closest('#plan-sheet') ? 'sheet' : a.closest('.pw-req') ? 'request' : a.tagName]; }"
    def reopen():
        page.locator("#plan-entry").click()
        if not last.is_visible(): page.locator("#plan-strip .ps-more").click()
        expect(last).to_be_visible()
    def plan_route(route):
        calls.append(route.request.url)
        ask = route.request.post_data_json
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": {"summary": "[테스트 응답] 두 예외 이름을 재사용한다.",
            "items": [{"id": "c1", "title": "[테스트] 제한 종류별 안내", "description": "[테스트 응답] 두 예외를 구별해 알린다.", "partIds": [next(p["id"] for p in ask["parts"] if p["name"] == "오류 처리")],
                "refs": ["INTENT", "N01"], "dependsOn": []}], "impacts": [], "preserve": ["[테스트 응답] eval의 parse→compile→VM 실행 순서", "[테스트 응답] 전역 객체 공유"], "unknowns": ["[테스트 응답] 호출자 쪽 안내"]}}))
    page.route("**/api/studio/plan", plan_route)
    page.route("**/api/studio/scope", lambda route: (calls.append(route.request.url), route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": AF94_REVIEW}))))
    page.locator("#plan-entry").click()
    page.locator("#plan-ask").click()
    expect(page.locator("#plan-strip .ps-item")).to_have_text("[테스트] 제한 종류별 안내")
    page.locator("#plan-strip .ps-more").click()
    # 1) A document as the 93 app kept it (no reading) reads as its whole text, exactly as before: no sections, no switch.
    page.locator("#plan-make").click(); expect(sheet).to_be_visible()
    first = stored(); assert first["snapshots"][0].get("reading"), "made by 94 with its reading"
    pre94 = json.loads(json.dumps(first)); del pre94["snapshots"][0]["reading"]
    page.evaluate(put3, [project["id"], pre94, other])
    page.reload()
    reopen(); last.click(); expect(sheet).to_be_visible()
    old_text = pre94["snapshots"][0]["text"]
    assert sheet.locator("pre").text_content() == old_text
    expect(sheet.locator(".rq-views, .rq-read, [data-at]")).to_have_count(0)
    assert page.evaluate(focused)[1] == "text" and sheet.locator("#plan-copy").text_content() == "복사"
    record["old"] = {"length": len(old_text), "sha256": hashlib.sha256(old_text.encode("utf-8")).hexdigest()}
    shot("0-old-document-text")
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    assert page.evaluate(focused)[1:] == ["last", "request"], page.evaluate(focused)
    # 2) A new document: made with its reading, which opens on its sections.
    page.locator("#plan-make").click(); expect(sheet).to_be_visible()
    assert page.evaluate(focused)[0] == "plan-copy"
    made = stored(); snap = made["snapshots"][-1]; text, spans = snap["text"], snap["reading"]["spans"]
    assert len(made["snapshots"]) == 2 and "reading" not in made["snapshots"][0] and made["snapshots"][0]["text"] == old_text, "never backfilled"
    up = env(); assert up["version"] == "studio.plans.4" and up["legacy"] == {"P_other94": "studio.plans.2"} and up["projects"]["P_other94"] == other, up.get("legacy")
    expect(sheet.locator('[data-sheet-part="view-reading"]')).to_have_attribute("aria-pressed", "true")
    assert page.evaluate(SHEET_TEXT) == text, "its pieces in order are the whole text"
    kinds = [x["kind"] for x in spans if x["kind"] != "material"]; materials = [x for x in spans if x["kind"] == "material"]
    assert kinds == ["head", "selected", "excluded", "prerequisites", "preserve", "unknowns", "review-unknowns", "materials", "closing"], kinds
    assert sheet.locator(".rq-read > [data-sec]").evaluate_all("es => es.map(e => e.dataset.sec)") == kinds
    expect(sheet.locator(".rq-h")).to_have_count(len(kinds))  # material text (fake headings) adds no heading
    evidence = made["plan"]["evidence"]; selected_refs = [x["id"] for i in snap["scope"]["items"] for x in i["sources"]]
    assert [m["ref"] for m in materials] == [e["id"] for e in evidence] and len(materials) > len(selected_refs) and "U01" in [m["ref"] for m in materials]
    assert sheet.locator(".rq-mat-name").all_text_contents() == [f"[{e['id']}] {e['title']} · {e['kind']}\n" for e in evidence]
    expect(sheet.locator(".rq-mat .rq-text:visible")).to_have_count(0)
    for k in ["selected", "prerequisites", "preserve", "unknowns", "review-unknowns", "closing"]: expect(sheet.locator(f'[data-sec="{k}"] .rq-text')).to_be_visible()
    expect(sheet.locator(".rq-mat-note")).to_contain_text(f"자료 {len(materials)}개 · 작업 지시가 아니라")
    expect(sheet.locator("#plan-copy")).to_have_text(f"전체 복사 · 자료 {len(materials)}개 포함")
    expect(sheet.locator(".rq-nav button")).to_have_count(len(kinds) - 1)
    record["made"] = {"length": len(text), "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(), "sections": kinds, "materials": [m["ref"] for m in materials], "selectedRefs": selected_refs, "origin": made["origins"][snap["id"]]}
    shot("1-reading-default")
    sheet.locator("#plan-copy").click()
    expect(status).to_contain_text("복사했어요")
    clip, on_clipboard = clipboard_read(page, text, f"request94 {w}x{hgt} first copy", {"pre-94 document": old_text}), platform_clipboard_text(text)
    assert clip == on_clipboard
    record["copy"] = {"platform": sys.platform, "length": len(clip), "exact": clip == text, "platformExact": clip == on_clipboard, "sha256": hashlib.sha256(clip.encode("utf-8")).hexdigest(),
        "platformExpected": {"length": len(on_clipboard), "sha256": hashlib.sha256(on_clipboard.encode("utf-8")).hexdigest()}}
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    assert page.evaluate(focused)[0] == "plan-make"
    # 3) A long stale draft, selected backward and scrolled: nothing done in the document touches it.
    panel.locator(".pw-head-tools").get_by_role("button", name="문장 고치기").click()
    long_draft = ZERO85_SENTENCE + "".join(f"\n[AF94 읽기 검사 사본] {n + 1}번째 줄 · 긴 초안 안에서 읽던 위치" for n in range(35))
    area.fill(long_draft)
    expect(page.locator("#plan-make")).to_be_disabled()
    area.focus(); page.keyboard.press("Control+Home")
    for _ in range(15): page.keyboard.press("ArrowRight")
    for _ in range(11): page.keyboard.press("Shift+ArrowLeft")
    area.evaluate("a => { a.scrollTop = 200; }")
    caret = "a => [a.selectionStart, a.selectionEnd, a.selectionDirection, a.scrollTop, a.value]"
    left, kept = area.evaluate(caret), stored()
    assert left[:4] == [4, 15, "backward", 200], left[:4]
    last.click(); expect(sheet).to_be_visible()
    assert page.evaluate(focused)[1] == "text"
    page.keyboard.press("Shift+Tab"); assert page.evaluate(focused)[1] == "x"
    page.keyboard.press("Tab"); assert page.evaluate(focused)[1] == "text"
    stops = []
    for _ in range(40):
        if page.evaluate(focused)[1] == "copy": break
        page.keyboard.press("Tab"); f = page.evaluate(focused); assert f[2] == "sheet", f; stops.append(f[1])
    assert stops == ["mat-all", *[f"mat-{m['ref']}" for m in materials], "copy"], stops
    page.keyboard.press("Tab"); assert page.evaluate(focused)[1] == "close"
    expect(sheet.locator(".rq-mat .rq-text:visible")).to_have_count(0)
    body.evaluate("b => { b.scrollTop = 0; }")
    record["keyboard"] = stops
    sheet.locator('[data-sheet-part="go-preserve"]').click()
    jumped = body.evaluate("b => b.scrollTop")
    head_top = sheet.locator('[data-sec="preserve"] .rq-h').evaluate("h => h.getBoundingClientRect().top - h.closest('.rq-read').getBoundingClientRect().top")
    assert jumped > 0 and 0 <= head_top < 40, (jumped, head_top)
    assert page.evaluate(focused)[1] == "sec-preserve"
    sheet.locator('[data-sheet-part="go-materials"]').click()
    u01, u = sheet.locator('[data-ref="U01"]'), next(x for x in spans if x.get("ref") == "U01")
    u01.locator("button").click()
    expect(u01.locator("button")).to_have_attribute("aria-expanded", "true")
    assert [u["source"], u["title"], u["basis"], u["length"]] == [AF94_U01["kind"], AF94_U01["title"], AF94_U01["basis"], len(AF94_U01["text"].encode("utf-16-le")) // 2], "frozen as the pasted material"
    # Reading offsets are UTF-16 code units (JavaScript), not Python code points: slice the UTF-16 encoding (the title has an emoji).
    u16 = lambda t, a, b: t.encode("utf-16-le")[2 * a:2 * b].decode("utf-16-le")
    assert u01.locator(".rq-text").text_content() == u16(text, u["start"] + len(f"[U01] {u['title']} · report\n".encode("utf-16-le")) // 2, u["end"] - 2)
    assert "유지할 조건:\n- [테스트] 가짜 유지" in u01.locator(".rq-text").text_content()
    assert page.evaluate(focused)[1] == "mat-U01"
    body.evaluate("b => { b.scrollTop = Math.floor((b.scrollHeight - b.clientHeight) / 2); }")
    mid = body.evaluate("b => b.scrollTop"); assert mid > 0
    sheet.locator("#plan-copy").click()
    expect(status).to_contain_text("복사했어요")
    assert clipboard_read(page, text, f"request94 {w}x{hgt} copy with U01 open", {"pre-94 document": old_text}) == platform_clipboard_text(text)
    assert [page.evaluate(focused)[1], body.evaluate("b => b.scrollTop"), u01.locator("button").get_attribute("aria-expanded")] == ["copy", mid, "true"]
    assert area.evaluate(caret) == left, "the draft behind stays as it was read"
    shot("2-material-open-copied")
    sheet.locator('[data-sheet-part="view-text"]').click()
    assert sheet.locator("pre").text_content() == text and page.evaluate(focused)[1] == "view-text"
    body.evaluate("b => { b.scrollTop = Math.floor(b.scrollHeight / 3); }")
    text_at = body.evaluate("b => b.scrollTop"); assert text_at > 0
    shot("3-text-view")
    sheet.locator('[data-sheet-part="view-reading"]').click()
    assert [body.evaluate("b => b.scrollTop"), u01.locator("button").get_attribute("aria-expanded"), page.evaluate(focused)[1]] == [mid, "true", "view-reading"]
    assert page.evaluate(SHEET_TEXT) == text
    sheet.locator('[data-sheet-part="view-text"]').click()
    assert body.evaluate("b => b.scrollTop") == text_at
    sheet.locator('[data-sheet-part="view-reading"]').click()
    record["reading"] = {"jumpedTo": jumped, "headingOffset": head_top, "mid": mid, "textAt": text_at}
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    assert page.evaluate(focused)[1] == "last" and area.evaluate(caret) == left
    last.click(); expect(sheet).to_be_visible()
    assert [sheet.locator('[data-sheet-part="view-reading"]').get_attribute("aria-pressed"), sheet.locator(".rq-mat .rq-text:visible").count(), body.evaluate("b => b.scrollTop"), status.text_content()] == ["true", 0, 0, quiet]
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    # 4) Copies that end late or are blocked (writeText replaced in the page and settled by hand; not the OS clipboard order).
    page.evaluate("() => { window.__clips = []; window.__late = []; navigator.clipboard.writeText = () => new Promise((res, rej) => window.__clips.push({ res, rej, done: false })); addEventListener('unhandledrejection', e => window.__late.push(String(e.reason))); }")
    def settle(n, how):
        assert page.evaluate("([n, how]) => { const c = window.__clips[n]; if (!c || c.done) return false; c.done = true; how === 'res' ? c.res() : c.rej(new Error('late')); return true; }", [n, how]), (n, how)
        page.wait_for_timeout(100)
    boundaries = []
    last.click(); expect(sheet).to_be_visible()
    sheet.locator('[data-sheet-part="go-materials"]').click(); u01.locator("button").click()
    sheet.locator("#plan-copy").click()
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    last.click(); expect(sheet).to_be_visible()
    settle(0, "rej")
    boundaries.append({"attempt": 0, "settled": "rej", "at": "the same document opened again (a new opening)", "status": status.text_content(),
        "unfolded": sheet.locator(".rq-mat .rq-text:visible").count(), "scrollTop": body.evaluate("b => b.scrollTop"), "focus": page.evaluate(focused)})
    assert status.text_content() == quiet and sheet.locator(".rq-mat .rq-text:visible").count() == 0
    sheet.locator("#plan-copy").click(); settle(1, "rej")
    blocked = status.text_content()
    assert "원문 그대로" in blocked and page.evaluate("() => getSelection().toString()") == "" and page.evaluate(focused)[1] == "copy", blocked
    sheet.locator('[data-sheet-part="view-text"]').click()
    selected = page.evaluate("() => getSelection().toString()")
    boundaries.append({"attempt": 1, "settled": "rej", "at": "blocked in the reading view, then the text view", "status": blocked, "selectedLength": len(selected), "selectedExact": selected == text})
    assert selected == text
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    assert area.evaluate(caret) == left and page.evaluate("() => window.__late") == []
    record["lateCopies"] = boundaries
    # 5) Saved, reloaded, exported and imported: the same text and reading.
    assert stored() == kept, "reading, folding, moving and copying store nothing"
    page.reload()
    reopen(); last.click(); expect(sheet).to_be_visible()
    assert page.evaluate(SHEET_TEXT) == text and stored()["snapshots"][-1] == snap
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    with page.expect_download() as dl: page.get_by_role("button", name="파일로 내보내기").click()
    plan_path = dl.value.path()
    file = json.loads(pathlib.Path(plan_path).read_text(encoding="utf-8"))
    assert file["format"] == "agentflow.change-plan-file.4" and file["bundle"]["snapshots"] == made["snapshots"]
    page.once("dialog", lambda d: d.accept())
    page.locator("#plan-import-file").set_input_files(plan_path)
    expect(panel).to_contain_text("변경안 파일을 가져왔어요.")
    back = stored(); assert back["snapshots"] == made["snapshots"] and back["labels"] == made["labels"] and back["origins"] == made["origins"]
    last.click(); expect(sheet).to_be_visible(); assert page.evaluate(SHEET_TEXT) == text
    page.keyboard.press("Escape")
    fin = env(); assert fin["projects"]["P_other94"] == other and fin["legacy"] == {"P_other94": "studio.plans.2"}
    record["storage"] = {"envelope": fin["version"], "legacy": fin["legacy"], "file": file["format"], "otherEntryUnchanged": True}
    assert len(calls) == 3, calls  # the analysis and one scope review per made document; reading and copying call nothing
    record["calls"], record["errors"] = len(calls), errors
    assert errors == [], errors
    if shots: (pathlib.Path(shots) / f"request94-{w}x{hgt}-boundaries.json").write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
    context.close()


def request94_resize_flow(browser, base, shots=None):
    """AF94 DELTA2 (same steps as `request94-flow.mjs resize`): a document open at 1280x720 (U01 unfolded, both views scrolled,
    focus on its fold) while the window goes to 700, 606 and back to 1280. Below 720 the pane is the whole window and the sheet
    covers the window instead of the empty strip beside it (it fell to a 2px column). Nothing re-renders on resize: the same body,
    the same slice at the top of the view (the browser's scroll anchoring may move the pixel offset), folds, view and focus; copy and
    close stay in view; the text view keeps its own place; closing returns to its opener; nothing is stored. Stubbed replies."""
    context = browser.new_context(viewport={"width": 1280, "height": 720})
    context.grant_permissions(["clipboard-read", "clipboard-write"], origin=base)
    page = context.new_page()
    errors, record = [], []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(base + "/")
    page.locator("#import-file").set_input_files(str(ROOT / "tests/fixtures/context75/micro-javascript-backup.json"))
    expect(page.locator("#crumbs")).to_contain_text("micro-javascript")
    project = page.evaluate(ENTRY, re.search(r"#/p/([^/]+)", page.url).group(1))
    page.evaluate("([id, b]) => localStorage.setItem('agentflow.studio.plans.1', JSON.stringify({ version: 'studio.plans.4', projects: { [id]: b } }))",
        [project["id"], {"draft": ZERO85_SENTENCE, "extra": [AF94_U01], "plan": None, "by": None, "snapshots": [], "labels": {}, "origins": {}, "observations": [], "attached": {}}])
    page.reload()
    def plan_route(route):
        ask = route.request.post_data_json
        route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": {"summary": "[테스트 응답] 두 예외 이름을 재사용한다.",
            "items": [{"id": "c1", "title": "[테스트] 제한 종류별 안내", "description": "[테스트 응답] 두 예외를 구별해 알린다.", "partIds": [next(p["id"] for p in ask["parts"] if p["name"] == "오류 처리")],
                "refs": ["INTENT", "N01"], "dependsOn": []}], "impacts": [], "preserve": ["[테스트 응답] 유지"], "unknowns": []}}))
    page.route("**/api/studio/plan", plan_route)
    page.route("**/api/studio/scope", lambda route: route.fulfill(status=200, content_type="application/json", body=json.dumps({"model": "stub-model", "reply": AF94_REVIEW})))
    sheet, body, last = page.locator("#plan-sheet"), page.locator(SHEET_BODY), page.locator('#plan-panel [data-sheet-entry="last"]')
    u01 = sheet.locator('[data-ref="U01"] button')
    stored = lambda: page.evaluate("id => JSON.parse(localStorage.getItem('agentflow.studio.plans.1')).projects[id]", project["id"])
    focused = "() => document.activeElement.dataset.sheetEntry ?? document.activeElement.dataset.sheetPart ?? document.activeElement.tagName"
    page.locator("#plan-entry").click(); page.locator("#plan-ask").click()
    page.locator("#plan-strip .ps-more").click(); page.locator("#plan-make").click(); expect(sheet).to_be_visible()
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    kept = stored(); text = kept["snapshots"][-1]["text"]
    last.click(); expect(sheet).to_be_visible()
    sheet.locator('[data-sheet-part="go-materials"]').click(); u01.click()
    sheet.locator('[data-sheet-part="view-text"]').click(); body.evaluate("b => { b.scrollTop = 900; }")
    sheet.locator('[data-sheet-part="view-reading"]').click(); body.evaluate("b => { b.scrollTop = 600; }")
    u01.focus(); body.evaluate("b => { b.__kept = true; }")
    top_slice = lambda: body.evaluate("b => { const t = b.getBoundingClientRect().top; return [...b.querySelectorAll('[data-at]')].find(e => e.getClientRects().length && e.getBoundingClientRect().bottom > t + 1)?.dataset.at ?? null; }")
    def state():
        return {"cls": sheet.get_attribute("class"), "box": sheet.bounding_box(), "copy": sheet.locator("#plan-copy").bounding_box(), "x": sheet.locator('[data-sheet-part="x"]').bounding_box(),
            "view": sheet.get_attribute("data-view"), "same": body.evaluate("b => b.__kept === true"), "place": top_slice(), "top": body.evaluate("b => b.scrollTop"),
            "unfolded": u01.get_attribute("aria-expanded"), "focus": page.evaluate(focused), "shown": page.evaluate(SHEET_TEXT) == text}
    in_view = lambda b, w, hgt: b and b["x"] >= 0 and b["y"] >= 0 and b["x"] + b["width"] <= w + 0.5 and b["y"] + b["height"] <= hgt + 0.5
    place = top_slice()
    for w in (1280, 700, 606, 1280):
        page.set_viewport_size({"width": w, "height": 720}); page.wait_for_timeout(250)
        at = {"w": w, **state()}; record.append(at)
        if shots: page.screenshot(path=str(pathlib.Path(shots) / f"request94-resize-{len(record)}-{w}x720.png"))
        assert in_view(at["box"], w, 720) and at["box"]["width"] >= min(680, w - 24) - 1, at
        assert in_view(at["copy"], w, 720) and in_view(at["x"], w, 720), at
        assert [at["cls"], at["view"], at["same"], at["place"], at["unfolded"], at["focus"], at["shown"]] == ["plan-sheet", "reading", True, place, "true", "mat-U01", True], at
        if w == 606:
            read_top = at["top"]
            sheet.locator('[data-sheet-part="view-text"]').click(); assert body.evaluate("b => b.scrollTop") == 900
            sheet.locator('[data-sheet-part="view-reading"]').click(); assert body.evaluate("b => b.scrollTop") == read_top
            sheet.locator("#plan-copy").click(); expect(sheet.locator("footer [role=status]")).to_contain_text("복사했어요")
            assert clipboard_read(page, text, "request94 resize copy at 606x720") == platform_clipboard_text(text) and top_slice() == place
            u01.focus(); body.evaluate("b => { b.__kept = true; }")
    page.set_viewport_size({"width": 700, "height": 720}); page.wait_for_timeout(250)
    page.keyboard.press("Escape"); expect(sheet).to_be_hidden()
    assert page.evaluate(focused) == "last"
    last.click(); expect(sheet).to_be_visible(); page.wait_for_timeout(250)  # after the sheet's pop-in (its keyframe moves it meanwhile)
    reopened = {"w": 700, "reopened": True, **state()}; record.append(reopened)
    assert in_view(reopened["box"], 700, 720) and reopened["box"]["width"] >= 675 and reopened["top"] == 0 and reopened["unfolded"] == "false" and reopened["focus"] == "text" and not reopened["same"], reopened
    assert stored() == kept, "resizing, folding and copying store nothing"
    assert errors == [], errors
    if shots: (pathlib.Path(shots) / "request94-resize.json").write_text(json.dumps(record, ensure_ascii=False, indent=1), encoding="utf-8")
    context.close()


MAP97_W = "agentflow.idea015.workspace"
MAP97_A, MAP97_B = "E_flow97-aaaa-0001", "E_flow97-bbbb-0002"
# Built in the page with the app's own modules (the same scripts as map97-flow.mjs).
MAP97_SEED = """async ([w, a, b]) => {
  const D = await import('./shared/domain.js'), S = await import('./shared/storage.js');
  const make = (name, text) => JSON.parse(S.serializeProject(D.pasteRecord(D.rename(D.createProject(), name), text, null).project));
  const entry = (entryId, project) => ({ entryId, state: 'active', lifecycle: 1, seq: 1, createdAt: new Date().toISOString(), trashedAt: null, origin: 'new', project });
  localStorage.setItem(w, JSON.stringify({ version: 'agentflow.workspace.1', migratedFromLegacy: false, entries: [
    entry(a, make('A 변환기', '요구: 폴더 안의 문서를 한 번에 변환한다.\\n작업 보고: 변환기는 문서마다 PDF 하나를 만든다.')), entry(b, make('B 메모', '요구: B는 일정표를 보여 준다.'))] }));
}"""
MAP97_ADD = """async ([w, k, text]) => {
  const D = await import('./shared/domain.js'), S = await import('./shared/storage.js');
  const env = JSON.parse(localStorage.getItem(w)), e = env.entries.find(x => x.entryId === k);
  e.project = JSON.parse(S.serializeProject(D.pasteRecord(e.project, text, null).project)); e.seq++; localStorage.setItem(w, JSON.stringify(env));
}"""
MAP97_STORED = "([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k)"
MAP97_PASTE = """() => { const t = document.getElementById('paste-text'), body = document.querySelector('#lens .lens-body');
  return { length: t.value.length, value: t.value, start: t.selectionStart, end: t.selectionEnd, direction: t.selectionDirection, scroll: t.scrollTop, pane: body ? body.scrollTop : null, focus: document.activeElement === t, same: t === window.__paste97 }; }"""
MAP97_SET_PASTE = """() => { const t = document.getElementById('paste-text'); t.focus(); t.setSelectionRange(t.value.length - 48, t.value.length, 'backward'); t.scrollTop = t.scrollHeight;
  const body = document.querySelector('#lens .lens-body'); if (body) body.scrollTop = body.scrollHeight; window.__paste97 = t; }"""
MAP97_LONG = "\n".join(f"{i + 1:02d} B의 미저장 붙여넣기: 일정표 화면의 주간 보기와 월간 보기를 견주어 적은 보고 문장입니다." for i in range(60))


def map97_flow(browser, base, size, shots=None):
    """AF97 (same steps as the auxiliary `map97-flow.mjs`): a map reading asked in A, its reply let through while the person is
    elsewhere. 1. On B with a long unsaved paste (backward selection, scrolled): B's paste, selection and its direction, scroll and
    focus stay; A's result waits for A and applies on return without asking again. 2. On B with its reading button focused: the
    same button keeps the focus. 3. At home typing a new project's name: A's card changes in place, the draft, focus and list stay.
    4. Saving held (the workspace lock taken in the page) while the person goes to B and back: no cancel while saving, and the visit
    opened meanwhile takes the saved project, so the next edit saves without a conflict. Stubbed provider, no model."""
    w, hgt = size
    context = browser.new_context(viewport={"width": w, "height": hgt})
    page = context.new_page()
    errors, held, opened = [], [], {3}
    page.on("pageerror", lambda e: errors.append(str(e)))
    shot = lambda name: shots and page.screenshot(path=f"{shots}/map97-{w}x{hgt}-{name}.png")
    stored = lambda key: page.evaluate(MAP97_STORED, [MAP97_W, key])
    go = lambda key: page.evaluate("k => { location.hash = k ? `#/p/${k}` : ''; }", key)

    def fresh():
        # Projects open from a page that already has the server's status (a reload straight into a project draws its empty map first).
        go(None); page.reload(); page.wait_for_function("() => document.getElementById('ai-text')?.textContent === 'AI 정리 가능'"); page.wait_for_timeout(100)

    def hold(route):
        # Each map request waits in the browser until let through, then goes on to the real local server (its provider is the stub).
        held.append(route)
        if len(held) - 1 in opened: route.continue_()
    page.route("**/api/studio/map", hold)

    def let_through(i):
        while len(held) <= i: page.wait_for_timeout(50)
        with page.expect_response(lambda r: r.url.endswith("/api/studio/map")): held[i].continue_()
        page.wait_for_timeout(300)

    space, line, card = page.locator("#space-empty"), page.locator("#world .map-understood"), page.locator(f'#saved-list [data-run-entry="{MAP97_A}"]')

    def apply_on_a(n):
        go(MAP97_A); page.locator(".mu-apply").get_by_text("정리 결과 보기").wait_for(); page.locator(".mu-apply").click()
        page.wait_for_function("([w, k, n]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === n", arg=[MAP97_W, MAP97_A, n])
        assert len(held) == n, ("applied without another request", len(held), n)

    page.goto(base + "/"); page.evaluate(MAP97_SEED, [MAP97_W, MAP97_A, MAP97_B]); fresh()

    # 1. A asks; on B the person pastes a long record and selects its end backwards; A's reply comes in meanwhile.
    go(MAP97_A); space.locator(".se-run").click(); space.get_by_text("기록을 읽고 지도를 정리하는 중…").wait_for()
    go(MAP97_B); space.locator(".se-run").wait_for()
    assert space.get_by_text("기록을 읽고 지도를 정리하는 중…").count() == 0, "B shows nothing of A"
    space.get_by_role("button", name="기록 붙여넣기").click(); page.locator("#paste-text").fill(MAP97_LONG); page.evaluate(MAP97_SET_PASTE)
    before = page.evaluate(MAP97_PASTE)
    assert before["direction"] == "backward" and before["scroll"] > 0 and before["focus"], before
    let_through(0)
    after = page.evaluate(MAP97_PASTE)
    assert after == before, ("B's paste, selection, its direction, scroll and focus stay", {k: (before[k], after[k]) for k in before if k != "value"})
    shot("b-paste")
    assert len(stored(MAP97_A)["project"]["readings"]) == 0 and stored(MAP97_B)["seq"] == 1, "A not saved while away, B untouched"
    go(None); card.get_by_text("지도 정리 결과 도착 · 열어서 보기").wait_for()
    go(MAP97_A); page.locator(".mu-apply").wait_for()
    assert space.locator(".se-run").count() == 0, "no ordinary reading button while a result is ready"
    shot("a-ready")
    apply_on_a(1); page.locator("#world .node").first.wait_for(); assert stored(MAP97_A)["seq"] == 2

    # 2. A asks again; on B the reading button has the focus when A's reply comes in.
    page.evaluate(MAP97_ADD, [MAP97_W, MAP97_A, "작업 보고: 폴더 입력은 다음 판에서 구현한다."]); fresh()
    go(MAP97_A); line.locator(".mu-run").click(); line.get_by_text("기록을 읽고 지도를 갱신하는 중…").wait_for()
    go(MAP97_B); space.locator(".se-run").wait_for(); page.evaluate("() => { const b = document.querySelector('#space-empty .se-run'); b.focus(); window.__button97 = b; }")
    let_through(1)
    assert page.evaluate("() => document.activeElement === window.__button97 && window.__button97.isConnected"), "B's reading button keeps the focus"
    apply_on_a(2)

    # 3. A asks again; at home the person types a new project's name when A's reply comes in.
    page.evaluate(MAP97_ADD, [MAP97_W, MAP97_A, "작업 보고: 결과 파일은 한 폴더에 모은다."]); fresh()
    go(MAP97_A); line.locator(".mu-run").click(); line.get_by_text("기록을 읽고 지도를 갱신하는 중…").wait_for()
    go(None); card.get_by_text("지도 정리 중…").wait_for()
    assert page.locator(f'#saved-list [data-run-entry="{MAP97_B}"]').is_hidden(), "B has no reading of its own"
    page.locator("#new-open").click(); page.locator("#new-name").fill("작성 중인 이름")
    page.evaluate("() => { window.__list97 = document.querySelector('#saved-list > li'); }")
    let_through(2)
    card.get_by_text("지도 정리 결과 도착 · 열어서 보기").wait_for(); shot("home-ready")
    assert page.locator("#new-name").input_value() == "작성 중인 이름"
    assert page.evaluate("() => document.activeElement?.id") == "new-name", "focus kept"
    assert page.evaluate("() => document.querySelector('#saved-list > li') === window.__list97"), "the home list is not drawn again"
    apply_on_a(3); assert stored(MAP97_A)["seq"] == 6

    # 4. Saved while the person goes to B and back: the save is held by taking the workspace lock in the page.
    page.evaluate(MAP97_ADD, [MAP97_W, MAP97_A, "작업 보고: 변환 실패는 문서 이름과 함께 알린다."]); fresh()
    go(MAP97_A)
    page.evaluate("w => { window.__held = new Promise(r => { window.__release97 = r; }); void navigator.locks.request(w, () => window.__held); }", MAP97_W)
    line.locator(".mu-run").click()
    # The reply is back while A is still open in the same visit: it goes straight to saving, which the lock holds.
    line.get_by_text("지도에 반영하는 중…").wait_for(); shot("a-committing")
    assert line.get_by_role("button", name="취소").count() == 0, "no cancel while saving"
    go(MAP97_B); space.locator(".se-run").wait_for()
    go(MAP97_A); page.locator("#world .node").first.wait_for()
    page.evaluate("() => window.__release97()")
    page.wait_for_function("([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === 4", arg=[MAP97_W, MAP97_A])
    page.wait_for_function("() => !document.querySelector('#world .mu-committing')")
    # The visit opened during the save took the saved project: adding a part saves on top of it, with no conflict.
    page.locator("#add-part").click(); page.locator("#part-name").fill("직접 추가한 부분"); page.locator("#part-form button[type=submit]").click()
    page.wait_for_function("([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.space.areas.some(a => a.name === '직접 추가한 부분')", arg=[MAP97_W, MAP97_A])
    last = stored(MAP97_A)
    assert len(last["project"]["readings"]) == 4 and last["seq"] == 9 and len(held) == 4, (len(last["project"]["readings"]), last["seq"], len(held))
    shot("a-edited")
    assert not errors, errors
    context.close()


MAP100_JOBS = "agentflow.studio.map-jobs.1"


def free_port():
    import socket
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0)); return sock.getsockname()[1]


def start_jobs(store, gate, port):
    """The smoke server keeping map readings as durable jobs (STUDIO_JOBS_DIR) with each provider call held (STUDIO_STUB_GATE)."""
    env = {**os.environ, "STUDIO_STUB": "ok", "PORT": str(port), "STUDIO_JOBS_DIR": store, "STUDIO_STUB_GATE": gate}
    proc = subprocess.Popen(["node", str(ROOT / "tests/studio-smoke-server.mjs")], cwd=APP, env=env, stdout=subprocess.PIPE, text=True)
    line = proc.stdout.readline()
    if "jobs=durable" not in line:
        proc.kill(); raise RuntimeError(f"job server did not start: {line!r}")
    return proc


def map100_flow(browser, size, shots=None):
    """AF100: a map reading kept by the PC's Studio as a durable job (stubbed provider held per call, no model).
    1. A asks; the page says it goes on without the window; reloaded, home says so on A's card. 2. On B with a long unsaved paste
    (backward selection, scrolled) the result arrives: B's paste, selection, scroll and focus stay, A is not saved. 3. On A the
    result waits for the person (a new visit after the reload) and applies once, asking nothing again. 4. Saved but the
    acknowledgement lost: after a reload it is settled without applying again. 5. Cancel: said with what it cannot promise; the
    call is stopped. 6. The Studio server killed during a job and started again: the page says it stopped; nothing sent again.
    7. A second tab of the same address shows the first tab's job and never sends its own."""
    w, hgt = size
    store, gate, port = tempfile.mkdtemp(prefix="af100-store-"), tempfile.mkdtemp(prefix="af100-gate-"), free_port()
    procs = [start_jobs(store, gate, port)]
    base = f"http://127.0.0.1:{port}"
    context = browser.new_context(viewport={"width": w, "height": hgt})
    page = context.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    shot = lambda name, pg=page: shots and pg.screenshot(path=f"{shots}/map100-{w}x{hgt}-{name}.png")
    stored = lambda key: page.evaluate(MAP97_STORED, [MAP97_W, key])
    go = lambda key, pg=page: pg.evaluate("k => { location.hash = k ? `#/p/${k}` : ''; }", key)
    reservations = lambda: page.evaluate("k => JSON.parse(localStorage.getItem(k) ?? '{\"ops\":[]}').ops", MAP100_JOBS)
    calls = lambda: len([f for f in os.listdir(gate) if f.startswith("called-")])

    def wait(cond, why, ms=15000):
        for _ in range(ms // 50):
            if cond(): return
            page.wait_for_timeout(50)
        raise AssertionError(f"timed out: {why}")

    def fresh(pg=page):
        go(None, pg); pg.reload(); pg.wait_for_function("() => document.getElementById('ai-text')?.textContent === 'AI 정리 가능'"); pg.wait_for_timeout(100)

    def release(n):
        pathlib.Path(gate, f"release-{n}").write_text("")

    def server_state(op):
        import urllib.request
        req = urllib.request.Request(f"{base}/api/studio/jobs/{op['id']}", headers={"X-AgentFlow-Request": "1", "X-Studio-Operation": op["cap"]})
        with urllib.request.urlopen(req) as r: return json.loads(r.read())

    def no_scroll(pg=page):
        sizes = pg.evaluate("[document.documentElement.scrollWidth, innerWidth]")
        assert sizes[0] <= sizes[1], f"horizontal page scroll: {sizes}"

    space, line, card = page.locator("#space-empty"), page.locator("#world .map-understood"), page.locator(f'#saved-list [data-run-entry="{MAP97_A}"]')
    try:
        page.goto(base + "/"); page.evaluate(MAP97_SEED, [MAP97_W, MAP97_A, MAP97_B]); fresh()

        # 1. A asks; the page says it goes on without the window. Reloaded: home says so on A's card (B has nothing).
        go(MAP97_A); space.locator(".se-run").click(); space.get_by_text("기록을 읽고 지도를 정리하는 중…").wait_for()
        space.locator(".mu-durable").get_by_text("창을 닫아도 이 PC의 Studio 실행기가 켜져 있으면 계속 정리해요").wait_for()
        wait(lambda: calls() == 1, "one provider call"); no_scroll(); shot("a-pending")
        op = reservations()[0]; assert "cap" in op and op["cap"] not in page.url
        assert op["cap"] not in json.dumps(stored(MAP97_A)), "the capability is not in the project"
        fresh(); card.get_by_text("지도 정리 중… · 창을 닫아도 PC에서 계속").wait_for(); shot("home-pending")
        assert page.locator(f'#saved-list [data-run-entry="{MAP97_B}"]').is_hidden()

        # 2. On B with a long unsaved paste the result arrives; nothing of B moves and A is not saved.
        go(MAP97_B); space.locator(".se-run").wait_for()
        space.get_by_role("button", name="기록 붙여넣기").click(); page.locator("#paste-text").fill(MAP97_LONG); page.evaluate(MAP97_SET_PASTE)
        before = page.evaluate(MAP97_PASTE)
        assert before["direction"] == "backward" and before["scroll"] > 0 and before["focus"], before
        release(1); wait(lambda: server_state(op)["state"] == "ready", "ready on the server")
        with page.expect_response(lambda r: f"/api/studio/jobs/{op['id']}" in r.url): pass
        page.wait_for_timeout(300)
        after = page.evaluate(MAP97_PASTE)
        assert after == before, ("B's paste, selection, scroll and focus stay", {k: (before[k], after[k]) for k in before if k != "value"})
        assert len(stored(MAP97_A)["project"]["readings"]) == 0 and stored(MAP97_B)["seq"] == 1, "A not saved while away, B untouched"
        shot("b-paste")

        # 3. A's result waits for the person and applies once, asking nothing again.
        go(None); card.get_by_text("지도 정리 결과 도착 · 열어서 보기").wait_for()
        go(MAP97_A); page.locator(".mu-apply").get_by_text("정리 결과 보기").wait_for()
        assert len(stored(MAP97_A)["project"]["readings"]) == 0, "not applied before the person asks"
        no_scroll(); shot("a-ready")
        page.locator(".mu-apply").click()
        page.wait_for_function("([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === 1", arg=[MAP97_W, MAP97_A])
        reading = stored(MAP97_A)["project"]["readings"][0]
        assert reading["id"].startswith("R_") and calls() == 1
        wait(lambda: reservations() == [], "acknowledged"); assert server_state(op)["acked"] == "applied"
        page.locator("#world .node").first.wait_for()

        # 4. Saved but the acknowledgement lost: after a reload it is settled without applying again.
        page.evaluate(MAP97_ADD, [MAP97_W, MAP97_A, "작업 보고: 폴더 입력은 다음 판에서 구현한다."]); fresh()
        page.route("**/api/studio/jobs/*/ack", lambda route: route.abort())
        go(MAP97_A); line.locator(".mu-run").click(); wait(lambda: calls() == 2, "second call"); release(2)
        page.wait_for_function("([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === 2", arg=[MAP97_W, MAP97_A])
        wait(lambda: reservations() and reservations()[0]["applied"], "saved, acknowledgement owed")
        op2 = reservations()[0]; assert server_state(op2)["acked"] is None
        page.unroute("**/api/studio/jobs/*/ack"); fresh()
        wait(lambda: reservations() == [], "settled after the reload"); assert server_state(op2)["acked"] == "applied"
        assert len(stored(MAP97_A)["project"]["readings"]) == 2 and calls() == 2

        # 5. Cancel: said with what it cannot promise; the provider call is stopped; nothing applied.
        page.evaluate(MAP97_ADD, [MAP97_W, MAP97_A, "작업 보고: 결과 파일은 한 폴더에 모은다."]); fresh()
        go(MAP97_A); line.locator(".mu-run").click(); wait(lambda: calls() == 3, "third call")
        line.get_by_role("button", name="취소").click()
        line.get_by_text("요금까지 멈췄는지는 알 수 없어요", exact=False).wait_for(); shot("a-cancelled")
        wait(lambda: os.path.exists(os.path.join(gate, "aborted-3")), "the call was stopped")
        wait(lambda: reservations() == [], "closed")
        assert len(stored(MAP97_A)["project"]["readings"]) == 2

        # 6. The Studio server is killed during a job and started again: the page says it stopped; nothing is sent again.
        go(MAP97_A); line.locator(".mu-run").click(); wait(lambda: calls() == 4, "fourth call")
        procs[0].kill(); procs[0].wait()
        procs.append(start_jobs(store, gate, port))
        line.get_by_text("PC의 Studio 실행기가 종료되어 이번 정리는 중단됐어요", exact=False).wait_for(timeout=20000); shot("a-interrupted")
        assert calls() == 4, "nothing sent again"
        wait(lambda: reservations() == [], "seen")

        # 7. A second tab of the same address shows the first tab's job and sends nothing of its own; the asking tab applies.
        second = context.new_page(); second.on("pageerror", lambda e: errors.append(str(e)))
        posts = []; second.on("request", lambda r: posts.append(r.url) if r.method == "POST" and r.url.endswith("/api/studio/jobs") else None)
        second.goto(base + "/"); fresh(second); go(MAP97_A, second); second.locator("#world .map-understood .mu-run").wait_for()
        line.locator(".mu-run").click(); wait(lambda: calls() == 5, "fifth call")
        second.locator("#world .map-understood").get_by_text("기록을 읽고 지도를 갱신하는 중…").wait_for()
        assert second.locator("#world .map-understood .mu-run").count() == 0, "no second request offered"
        no_scroll(second); shot("second-tab", second)
        release(5)
        page.wait_for_function("([w, k]) => JSON.parse(localStorage.getItem(w)).entries.find(e => e.entryId === k).project.readings.length === 3", arg=[MAP97_W, MAP97_A])
        second.wait_for_function("() => !document.querySelector('#world .map-understood .mu-pending')")
        assert posts == [] and calls() == 5, (posts, calls())
        assert second.locator(".mu-apply").count() == 0, "the other tab offers no second apply"
        assert not errors, errors
        context.close()
    finally:
        for proc in procs: proc.kill()


def main():
    procs = []
    try:
        with sync_playwright() as p:
            exe = os.environ.get("STUDIO_CHROMIUM")
            browser = p.chromium.launch(**({"executable_path": exe} if exe else {}))
            if sys.argv[1:2] == ["zero85"]:
                # Only the AF85 flow (screenshots into the folder named after it, when given); stubbed replies, no provider.
                proc, base = start("ok"); procs.append(proc)
                for width in (1280, 1440): zero85_flow(browser, base, width, sys.argv[2] if len(sys.argv) > 2 else None); print(f"ok  AF85 empty analysis at {width}")
                browser.close(); return
            if sys.argv[1:2] == ["request93"]:
                # Only the AF93 flow: closing a request document goes back to its opener; stubbed replies, no provider.
                proc, base = start("ok"); procs.append(proc)
                for size in ((1280, 720), (1440, 900)): request93_flow(browser, base, size, sys.argv[2] if len(sys.argv) > 2 else None); print(f"ok  AF93 request document back to its opener at {size[0]}x{size[1]}")
                browser.close(); return
            if sys.argv[1:2] == ["request94"]:
                # Only the AF94 flow: a new request document read by its frozen sections; stubbed replies, no provider.
                proc, base = start("ok"); procs.append(proc)
                for size in ((1280, 720), (1440, 900)): request94_flow(browser, base, size, sys.argv[2] if len(sys.argv) > 2 else None); print(f"ok  AF94 request reading at {size[0]}x{size[1]}")
                browser.close(); return
            if sys.argv[1:2] == ["request94resize"]:
                # Only the AF94 DELTA2 check: an open document through 1280 -> 700 -> 606 -> 1280; stubbed replies, no provider.
                proc, base = start("ok"); procs.append(proc)
                request94_resize_flow(browser, base, sys.argv[2] if len(sys.argv) > 2 else None); print("ok  AF94 DELTA2 open document through 1280 -> 700 -> 606 -> 1280")
                browser.close(); return
            if sys.argv[1:2] == ["map97"]:
                # Only the AF97 flow: a map reading's reply let through while another project or home is open; stubbed provider.
                proc, base = start("ok"); procs.append(proc)
                for size in ((1280, 720), (1440, 900)): map97_flow(browser, base, size, sys.argv[2] if len(sys.argv) > 2 else None); print(f"ok  AF97 map return at {size[0]}x{size[1]}")
                browser.close(); return
            if sys.argv[1:2] == ["map100"]:
                # Only the AF100 flow: map readings kept by the PC's Studio as durable jobs; stubbed provider held per call.
                for size in ((1280, 720), (1440, 900)): map100_flow(browser, size, sys.argv[2] if len(sys.argv) > 2 else None); print(f"ok  AF100 durable map job at {size[0]}x{size[1]}")
                browser.close(); return
            if sys.argv[1:2] == ["reading87"]:
                # Only the AF85/87 flows: the stored real 85 reply replayed in the browser, no provider.
                proc, base = start("ok"); procs.append(proc)
                for size in ((1280, 720), (1440, 900)): reading87_flow(browser, base, size, sys.argv[2] if len(sys.argv) > 2 else None); print(f"ok  AF87 material list at {size[0]}x{size[1]}")
                for width in (1280, 1440): zero85_flow(browser, base, width); print(f"ok  AF85 empty analysis at {width}")
                browser.close(); return
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
            record_flow(browser, base, record_fixtures()); print("ok  pasted record: draft kept, exact text, structure untouched, read on request, same-named candidates apart, quote and back, scene restored, repeat/key refused, backup copy without readings")
            map70_flow(browser, base); print("ok  first map from a pasted record (save sends nothing), quote and back, rename/place/draft kept, later record on the same part, plan reads record and reading")
            request71_flow(browser, base); print("ok  own map -> frozen three-item request -> plain partial report -> one combined read -> unanswered items, feature scope, exact quote/back, durable exclusion; stubbed replies")
            request71_projection_flow(browser, base); print("ok  request projection: unrelated excerpts do not spread into parts; older report precedes newer unanswered RQ; exact quoted interval marked/scrolled; written fixture")
            uncertainty76_flow(browser, base); print("ok  AF76 candidate: open attribution label, the statement's kind and words, its exact passage and the way back to the same button; the part's claims apart; stubbed reply")
            reading72_flow(browser, base); print("ok  saved actual request: second quote/back keeps disclosure, scroll, focus and surface; current contents, exact RQ/revision and other-part isolation")
            continue72_flow(browser, base); print("ok  home continue: scope and selection per workspace entry; imported copies and ambiguous old project memory kept apart")
            role80_flow(browser, base); print("ok  AF80 description evidence: folded count, exact passages (the fourth no claim's), way back to the same part/button/fold/scroll/camera, one passage, claim apart, sheet; written fixture")
            history73_flow(browser, base); print("ok  withdrawn report history: old quote and way back keep the item, its history fold, quote focus, scroll and camera, from a part and from the map root; current quote path; other part untouched")
            revised73_flow(browser, base); print("ok  corrected-basis relation: selected from either end its line keeps one clear '근거 정정' mark at 1280/1440; ordinary lines never carry it")
            record_fold_flow(browser, base, oss_fixtures()); print("ok  pasted record on Node-RED: a chosen candidate in a folded group opens only its path, holds through a quote, folds back on another choice and on close")
            stale_request_flow(browser, base); print("ok  request only from the analysis of what is written now: typed, forced, A-B-A, cancelled and outdated replies, material")
            actual_reply_flow(browser, base); print("ok  wide comparison of an actual reply without presentation; scope reviews outliving a material change; four changes")
            stale_work_flow(browser, base); print("ok  writing in the wide comparison: map ways off at once (forced click a no-op, caret kept), honest way out, draft on reopen")
            authoring84_flow(browser, base); print("ok  AF84 older micro draft at 1280/DPR1.25: set and remove the authoring context keep caret, direction and draft; focus on a live control; boundary line; caret back after close/reopen")
            for width in (1280, 1440): zero85_flow(browser, base, width)
            for size in ((1280, 720), (1440, 900)): reading87_flow(browser, base, size)
            for size in ((1280, 720), (1440, 900)): request93_flow(browser, base, size)
            for size in ((1280, 720), (1440, 900)): request94_flow(browser, base, size)
            request94_resize_flow(browser, base)
            for size in ((1280, 720), (1440, 900)): map97_flow(browser, base, size)
            for size in ((1280, 720), (1440, 900)): map100_flow(browser, size)
            print("ok  AF100 durable map job at 1280/1440: kept through a reload, B's paste untouched, applied once on request, lost acknowledgement settled, cancel stopped, server restart said as stopped with nothing resent, second tab sends nothing")
            print("ok  AF97 map return at 1280/1440: B's paste, selection, scroll and focus, B's reading button and the home draft kept while A's reply comes; applied on return without asking again; saving not cancellable; a visit opened during the save takes it")
            print("ok  AF85 empty analysis on the micro draft at 1280/1440: reads at once, source and back, close/reopen/reload/file, earlier request and return kept, positive with none chosen apart")
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
