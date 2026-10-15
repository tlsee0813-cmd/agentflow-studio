"""SPATIAL101 review prototype: small navigation checks for both alternatives (file://, no network).
Run: python tests/proto_browser.py [screens_dir]"""
import os, pathlib, sys
from playwright.sync_api import sync_playwright, expect

ROOT = pathlib.Path(__file__).resolve().parent.parent
URL = (ROOT / 'prototype' / 'index.html').as_uri()
SHOTS = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else None
results = []

def check(name, fn, page):
    try:
        fn(page); results.append((name, 'PASS', ''))
    except Exception as e:  # report every check, keep going
        results.append((name, 'FAIL', (str(e).splitlines() or [type(e).__name__])[0])); shot(page, 'FAIL-' + name[:12].replace(' ', '_'))

def shot(page, name):
    page.evaluate("document.getElementById('toast').style.display = 'none'")
    if SHOTS: SHOTS.mkdir(parents=True, exist_ok=True); page.screenshot(path=str(SHOTS / f'{name}.png'), full_page=True)

def home(page):
    link = page.locator('.crumb a:has-text("모든 프로젝트")')
    if link.count(): link.click()
    settle(page)

def settle(page):
    # the prototype moves focus after navigation on a 0 ms timer; let it land before the test moves focus itself
    page.evaluate('new Promise(r => setTimeout(r, 20))')

def layer(page): return page.locator('.layer').inner_text()
def cur(page): return page.locator('#cur').inner_text()

def a_select_then_enter(page):
    page.click('#mA'); page.click('.pcard[data-id="P_kiln"]')
    assert '1층' in layer(page)
    page.click('.card[data-id="A_book"]')                      # first click selects only
    assert '1층' in layer(page), 'click must not enter in A'
    expect(page.locator('aside.detail h2')).to_have_text('예약')
    shot(page, 'A-1-space-selected')
    page.click('#open-selected'); assert '2층' in layer(page)
    page.click('.card[data-id="T_form"]'); assert '2층' in layer(page)
    page.click('.card[data-id="T_form"]')                      # second click on the selected card enters
    expect(page.locator('main h2')).to_have_text('접수 화면 입력 항목 설계')
    shot(page, 'A-2-task')
    page.keyboard.press('Backspace'); assert '2층' in layer(page)
    expect(page.locator('.card.sel')).to_have_attribute('data-id', 'T_form')   # selection restored on return
    page.click('.crumb a:has-text("도자기 공방")'); assert '1층' in layer(page)
    expect(page.locator('.card.sel')).to_have_attribute('data-id', 'A_book')

def b_enter_first(page):
    page.click('#mB'); home(page); page.click('.pcard[data-id="P_kiln"]')
    page.click('.card[data-id="A_book"]'); assert '2층' in layer(page), 'one click enters in B'
    page.click('.card[data-id="T_pend"] button:has-text("정보")'); assert '2층' in layer(page), 'info does not enter'
    expect(page.locator('.info')).to_contain_text('들어가지 않음')
    shot(page, 'B-1-area-info')
    page.click('.card[data-id="T_pend"]'); expect(page.locator('main h2')).to_have_text('확인 대기 표시')
    assert page.locator('aside.tree').count() == 0, 'B task is a dedicated screen'
    shot(page, 'B-2-task-screen')
    page.click('#back'); assert '2층' in layer(page)
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'no horizontal page scroll (wide B)'
    page.keyboard.press('Alt+ArrowUp'); assert '1층' in layer(page)

def navigation_keeps_current_and_target(page):
    page.click('#mB'); home(page); page.click('.pcard[data-id="P_kiln"]')
    before = cur(page); assert '확인 대기 표시' in before
    page.click('.card[data-id="A_pay"]')
    assert page.locator('#quick-target').input_value() == 'A_book', 'map move must not change request target'
    expect(page.locator('.quick')).to_contain_text('지도 이동은 대상을 바꾸지 않아요')
    page.click('.card[data-id="T_paym"]'); assert cur(page) == before, 'opening a task must not change continued work'
    page.click('#continue'); assert '결제 방식 정하기' in cur(page)

def attention_across_areas(page):
    page.click('#mB'); home(page); page.click('.pcard[data-id="P_kiln"]')
    page.click('.card[data-id="A_sms"]'); expect(page.locator('#attn')).to_contain_text('2')
    expect(page.locator('main')).to_contain_text('다른 영역에도 판단할 일 2건')
    expect(page.locator('#layer-empty')).to_contain_text('아직 요청이 없어요')
    page.click('#attn'); expect(page.locator('.pop')).to_contain_text('결제 방식 정하기')
    shot(page, 'B-3-attention')
    page.click('.pop button:has-text("결제")'); expect(page.locator('main h2')).to_have_text('결제 방식 정하기')

def keyboard_a(page):
    page.click('#mA'); home(page)
    page.focus('.pcard[data-id="P_kiln"]'); page.keyboard.press('Enter'); assert '1층' in layer(page), 'Enter on project card'
    settle(page); page.focus('.card[data-id="A_book"]'); page.keyboard.press('ArrowRight')
    expect(page.locator('.card.sel')).to_have_attribute('data-id', 'A_pay')
    page.keyboard.press('Enter'); assert '2층' in layer(page), 'Enter on the selected card enters'
    page.keyboard.press('/'); assert page.evaluate('document.activeElement.id') == 'quick', '/ focuses quick input'
    page.keyboard.press('Escape'); page.locator('#quick').blur(); page.keyboard.press('Backspace'); assert '1층' in layer(page), 'Backspace goes up'
    page.keyboard.press('Escape'); assert page.locator('.card.sel').count() == 0, 'Esc clears selection'

def sub_idea_is_proposal(page):
    page.click('#mB'); home(page); page.click('.pcard[data-id="P_kiln"]'); page.click('.card[data-id="A_book"]')
    page.click('.card[data-id="S_wait"]'); assert '2층' in layer(page)
    expect(page.locator('#toast')).to_contain_text('제안')

def empty_first_screen(page):
    home(page); page.click('#toggle-empty')
    expect(page.locator('.empty')).to_contain_text('무엇을 만들고 싶나요?'); shot(page, 'X-empty'); page.click('#toggle-empty')

def narrow(page):
    page.set_viewport_size({'width': 390, 'height': 800})
    for mode in ('A', 'B'):
        page.click(f'#m{mode}'); home(page); page.click('.pcard[data-id="P_kiln"]')
        assert not page.locator('.canvas').is_visible() and page.locator('.listview').is_visible()
        expect(page.locator('.lrow[data-id="A_book"] code')).to_have_text('A_book')
        if mode == 'A':
            page.click('.lrow[data-id="A_book"] button:has-text("상세")'); assert page.locator('aside.detail').is_visible()
            shot(page, 'A-narrow-sheet')
        box = page.locator('.lrow[data-id="A_book"] button:has-text("열기")').bounding_box()
        assert box['height'] >= 44, f'open button is {box["height"]}px high'
        page.click('.lrow[data-id="A_book"] button:has-text("열기")'); assert '2층' in layer(page)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'no horizontal page scroll'
        if mode == 'B': shot(page, 'B-narrow-list')
    page.set_viewport_size({'width': 1280, 'height': 860})


ERRORS = []

def d1_empty_area_request_targets_this_area(page):
    page.click('#mB'); home(page); page.click('.pcard[data-id="P_kiln"]'); page.click('.card[data-id="A_sms"]')
    page.click('#layer-empty .start-request')
    assert page.locator('#quick-target').input_value() == 'A_sms', 'explicit request action targets the open area'
    assert page.evaluate('document.activeElement.id') == 'quick'
    page.fill('#quick', '문자 문구 초안')                      # an unsent draft for 알림 문자
    page.click('.crumb a:has-text("도자기 공방")'); page.click('.card[data-id="A_work"]')
    page.click('#layer-empty .start-request')
    assert page.locator('#quick-target').input_value() == 'A_sms', 'unsent draft keeps its target'
    assert page.locator('#quick').input_value() == '문자 문구 초안', 'unsent draft kept'
    expect(page.locator('#toast')).to_contain_text('작성 중인 요청')
    page.fill('#quick', ''); page.click('#request-here')
    assert page.locator('#quick-target').input_value() == 'A_work'

def d2_b_task_keeps_bases(page):
    page.click('#mB'); home(page); page.click('.pcard[data-id="P_kiln"]'); page.click('.card[data-id="A_book"]'); page.click('.card[data-id="T_pend"]')
    page.click('#task-bases summary'); expect(page.locator('#task-bases')).to_contain_text('D3 사용자 답변')

def d3_projects_without_attention_or_areas(page):
    before = len(ERRORS)
    for mode in ('A', 'B'):
        page.click(f'#m{mode}'); home(page); page.click('.pcard[data-id="P_csv"]')
        expect(page.locator('main .next')).to_contain_text('이 프로젝트에서 판단할 일은 없어요')
        page.click('.card[data-id="A_rows"]')
        if mode == 'A': page.click('#open-selected')
        expect(page.locator('#layer-empty')).to_contain_text('이 영역에 아직 요청이 없어요')
        home(page); page.click('.pcard[data-id="P_new"]')
        expect(page.locator('#layer-empty')).to_contain_text('아직 영역이 없어요')
    assert len(ERRORS) == before, ERRORS[before:]

with sync_playwright() as pw:
    b = pw.chromium.launch(executable_path=os.environ.get('CHROMIUM') or None)
    page = b.new_page(viewport={'width': 1280, 'height': 860})
    errors, requests = ERRORS, []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: m.type == 'error' and errors.append(m.text))
    page.on('request', lambda r: not r.url.startswith('file:') and requests.append(r.url))
    page.goto(URL)
    for name, fn in [('A select-first: click selects, open enters, return restores', a_select_then_enter),
                     ('B enter-first: one click enters, info is separate, task is its own screen', b_enter_first),
                     ('map navigation keeps continued work and request target', navigation_keeps_current_and_target),
                     ('attention covers other areas', attention_across_areas),
                     ('keyboard (A): Enter, arrows, /, Backspace, Esc', keyboard_a),
                     ('sub-idea is shown as proposal, does not enter', sub_idea_is_proposal),
                     ('empty first screen', empty_first_screen),
                     ('narrow: list with IDs, open, A sheet, no horizontal scroll', narrow),
                     ('D1 empty-area request targets that area; unsent draft protected', d1_empty_area_request_targets_this_area),
                     ('D2 B task screen keeps bases/sources (folded)', d2_b_task_keeps_bases),
                     ('D3 project without attention, empty area and empty project open without errors', d3_projects_without_attention_or_areas)]:
        check(name, fn, page)
    results.append(('no page errors', 'PASS' if not errors else 'FAIL', '; '.join(errors)))
    results.append(('no network requests', 'PASS' if not requests else 'FAIL', '; '.join(requests)))
    b.close()
for n, s, d in results: print(f'{s}  {n}' + (f'  -- {d}' if d else ''))
sys.exit(0 if all(s == 'PASS' for _, s, _ in results) else 1)
