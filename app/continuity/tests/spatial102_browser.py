"""SPATIAL102 native UI -> localhost -> explicit MOCK. The enter-first space: a card body enters, '정보' only selects,
the handle only drags; 전체 공간 › 영역 › 작업 with the layer name; a read-only task screen that never changes the work the
user continues or the request target; coming back restores scroll and focus; '확인할 일' from existing records only;
start points for an empty project and an empty area; reload with a missing task. Wiring, not usability.
Run from app/: python continuity/tests/spatial102_browser.py
"""
import json, unittest
from playwright.sync_api import expect
import browser as base

CHOICE='빈자리가 나면 대기자에게 자동으로 예약을 이어 주세요'

class EnterFirstSpace(unittest.TestCase):
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp;tearDown=base.Browser.tearDown;state=base.Browser.state

    def start(self,areas):
        self.page.locator('#brief-input').fill('공방 원데이 클래스 예약');self.page.locator('#brief-start').click()
        for name in areas:
            self.page.locator('#area-name').fill(name);self.page.locator('#area-add').click()
            expect(self.page.locator('.area-node',has_text=name)).to_be_visible()
        return [next(a['id'] for a in self.state()['space']['areas'] if a['name']==n) for n in areas]
    def title(self):return self.page.locator('#space-title')
    def request_in(self,area_id,text):
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area_id}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(text);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        return self.state()['currentTaskId']
    def focused(self):return self.page.evaluate('document.activeElement && document.activeElement.id')

    def test_01_card_enters_info_selects_handle_drags(self):
        booking,notify=self.start(['예약','알림'])
        expect(self.page.locator('#space-crumb')).to_contain_text('전체 공간');expect(self.page.locator('#space-crumb .layer-chip')).to_have_text('프로젝트 전체')
        # '정보' selects (panel), it does not enter.
        self.page.locator(f'#node-info-{notify}').click();expect(self.page.locator('#area-panel')).to_contain_text('알림');expect(self.title()).to_have_text('전체 공간')
        expect(self.page.locator(f'#node-info-{notify}')).to_have_attribute('aria-pressed','true')
        # Dragging by the handle moves the card and never enters.
        box=self.page.locator(f'#node-move-{booking}').bounding_box();x,y=box['x']+box['width']/2,box['y']+box['height']/2
        before=self.state()['space']['layout']['positions'].get(booking)
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x+60,y+30,steps=6);self.page.mouse.up()
        expect(self.title()).to_have_text('전체 공간');self.assertNotEqual(self.state()['space']['layout']['positions'].get(booking),before)
        # One click on the card body enters; the path names the layer.
        saved=self.state()['space']['draftTarget'];self.page.locator(f'#node-enter-{booking}').click()
        expect(self.title()).to_have_text('예약');expect(self.page.locator('#space-crumb .layer-chip')).to_have_text('영역')
        self.assertEqual(self.state()['space']['draftTarget'],saved,'entering an area never sets the request target')
        # Back: focus returns to the card the user entered. Keyboard Enter on a card enters too.
        self.page.locator('#space-crumb-root').click();expect(self.title()).to_have_text('전체 공간');self.assertEqual(self.focused(),f'node-enter-{booking}')
        self.page.keyboard.press('Enter');expect(self.title()).to_have_text('예약')
        self.page.screenshot(path=str(base.OUT/'spatial102-area.png'))

    def test_02_task_screen_is_read_only_and_coming_back_restores_place(self):
        booking,notify=self.start(['예약','알림'])
        A=self.request_in(booking,'A: 접수 화면 입력 항목 설계');B=self.request_in(booking,'B: 확인 대기 문구')
        for i in range(6):self.request_in(notify,f'알림 문자 {i}')  # enough requests to scroll
        current=self.state()['currentTaskId'];target=self.state()['space']['draftTarget']
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{booking}').click()
        self.page.locator(f'#task-open-{A}').click()
        expect(self.title()).to_contain_text('A: 접수 화면');crumb=self.page.locator('#space-crumb')
        expect(crumb).to_contain_text('전체 공간');expect(crumb).to_contain_text('예약');expect(crumb.locator('.layer-chip')).to_have_text('작업')
        expect(self.page.locator('#task-view')).to_contain_text('요청 원문');expect(self.page.locator('#task-view-continue')).to_have_text('이 작업 이어서 하기')
        self.assertEqual(self.state()['currentTaskId'],current,'viewing a task never changes the work the user continues')
        self.assertEqual(self.state()['space']['draftTarget'],target)
        self.page.screenshot(path=str(base.OUT/'spatial102-task.png'),full_page=True)
        # Path back to the area: focus returns to that request.
        self.page.locator('#space-crumb-area').click();expect(self.title()).to_have_text('예약');self.assertEqual(self.focused(),f'task-open-{A}')
        # Entering a request from further down the list and coming back restores the area's scroll and focus.
        self.page.set_viewport_size({'width':390,'height':700});self.page.locator('#nav-space').click();self.page.locator(f'#list-enter-{notify}').click()
        oldest=self.state()['tasks'][2]['id'];link=self.page.locator(f'#task-open-{oldest}');link.scroll_into_view_if_needed()
        y=self.page.evaluate('window.scrollY');self.assertGreater(y,200,'the oldest request is further down');link.click()
        expect(self.title()).to_contain_text('알림 문자 0');self.assertLess(self.page.evaluate('window.scrollY'),50)
        self.page.locator('#space-crumb-area').click();expect(self.title()).to_have_text('알림')
        self.assertAlmostEqual(self.page.evaluate('window.scrollY'),y,delta=40);self.assertEqual(self.focused(),f'task-open-{oldest}')
        # Continuing is the explicit button only.
        self.page.set_viewport_size({'width':1440,'height':1050});self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{booking}').click()
        self.page.locator(f'#task-open-{A}').click();self.page.locator('#task-view-continue').click()
        expect(self.page.locator('#current-work')).to_be_visible();self.assertEqual(self.state()['currentTaskId'],A)

    def test_03_check_list_counts_open_questions_and_untouched_reports_only(self):
        booking,notify=self.start(['예약','알림'])
        Q=self.request_in(notify,CHOICE)
        R=self.request_in(booking,'예약 화면 만들기')
        with self.page.expect_download():self.page.locator('#download-work').click()
        self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill('보고: 예약 화면을 만들었다고 주장');self.page.locator('#send').click()
        expect(self.page.locator('#working')).to_have_text('');current=self.state()['currentTaskId']
        self.page.locator('#nav-space').click();box=self.page.locator('#check-list')
        expect(box.locator('h2')).to_have_text('확인할 일 2건');expect(box).to_contain_text('제품 선택 항목 있음');expect(box).to_contain_text('구현 보고 도착 · 앱 미검증')
        expect(box).to_contain_text('개발 도구의 실행 상태는 아니에요')
        self.page.screenshot(path=str(base.OUT/'spatial102-checks.png'),full_page=True)
        self.page.locator(f'#check-open-{Q}').click();expect(self.title()).to_contain_text('빈자리')
        self.assertEqual(self.state()['currentTaskId'],current,'opening an item does not continue it')
        # In an area: this area and the others are counted apart.
        self.page.locator('#space-crumb-root').click();self.page.locator(f'#node-enter-{booking}').click()
        expect(self.page.locator('#area-checks')).to_contain_text('이 영역 1건 · 다른 영역 1건')
        # Acting on the report (a follow-up request from it) takes it off the list; the report itself stays recorded.
        self.page.locator('#nav-work').click();self.page.locator('#compose-panel').evaluate('(e)=>e.open=true');self.page.locator('#request-tab').click()
        self.page.locator('#draft').fill('확인 대기 문구 고치기');self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.page.locator('#nav-space').click();expect(box.locator('h2')).to_have_text('확인할 일 1건');expect(box).not_to_contain_text('구현 보고 도착')
        self.assertTrue(any(s['kind']=='report' for s in self.state()['sources']))

    def test_04_start_points_for_an_empty_project_and_an_empty_area(self):
        self.page.locator('#brief-input').fill('새 프로젝트');self.page.locator('#brief-start').click()
        expect(self.page.locator('#space-start')).to_be_visible();expect(self.page.locator('#check-list')).to_have_count(0)
        self.page.locator('#start-add-area').click();self.assertEqual(self.focused(),'area-name')
        self.page.locator('#start-first-request').click();expect(self.page.locator('#draft')).to_be_focused()
        self.assertEqual(self.state()['space']['draftTarget'],{'area':None},'the first request goes without an area')
        self.page.locator('#nav-space').click()
        self.page.locator('#area-name').fill('예약');self.page.locator('#area-add').click();booking=self.state()['space']['areas'][0]['id']
        self.page.locator(f'#node-enter-{booking}').click();expect(self.page.locator('#area-start')).to_be_visible()
        self.page.locator('#area-start-request').click();expect(self.page.locator('#draft')).to_be_focused()
        self.assertEqual(self.state()['space']['draftTarget'],{'area':booking},'the explicit button sets this area')
        # An unsent draft keeps its target: the same button elsewhere opens it instead of moving it.
        self.page.locator('#draft').fill('예약 화면 초안');self.page.locator('#nav-space').click()
        self.page.locator('#area-name').fill('알림');self.page.locator('#area-add').click();notify=self.state()['space']['areas'][1]['id']
        self.page.locator(f'#node-enter-{notify}').click();self.page.locator('#area-start-request').click()
        self.assertEqual(self.state()['space']['draftTarget'],{'area':booking});expect(self.page.locator('#draft')).to_have_value('예약 화면 초안')
        self.page.locator(f'#nav-space').click();self.page.locator(f'#node-enter-{notify}').click();self.page.locator('#area-start-guide').click()
        expect(self.page.locator(f'#guide-{notify}')).to_have_attribute('open','')

    def test_05_reload_restores_the_task_screen_and_survives_a_missing_task(self):
        booking,notify=self.start(['예약','알림']);A=self.request_in(booking,'A: 접수 화면')
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{booking}').click();self.page.locator(f'#task-open-{A}').click()
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');expect(self.title()).to_contain_text('A: 접수 화면')
        # A remembered task id that does not exist falls back to its area, then to the whole space; no error.
        place=json.loads(self.page.evaluate("sessionStorage.getItem('agentflow.workspace.place')"))
        place['task']='T_missing';self.page.evaluate(f"sessionStorage.setItem('agentflow.workspace.place', {json.dumps(json.dumps(place))})")
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');expect(self.title()).to_have_text('예약')
        place['area']='A_missing';self.page.evaluate(f"sessionStorage.setItem('agentflow.workspace.place', {json.dumps(json.dumps(place))})")
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');expect(self.title()).to_have_text('전체 공간')

    def test_06_project_card_body_opens_its_buttons_stay_separate(self):
        self.start(['예약']);self.page.locator('#nav-projects').click()
        card=self.page.locator('.project-card').first;card.locator('.project-card-summary').click()
        expect(self.page.locator('#space-view')).to_be_visible()
        self.page.locator('#nav-projects').click();self.page.locator('#new-project').click()
        self.page.locator('#brief-input').fill('두 번째');self.page.locator('#brief-start').click();self.page.locator('#nav-projects').click()
        # The trash button asks first; declining it leaves the list as it is and does not open the card.
        self.page.once('dialog',lambda d:d.dismiss());self.page.locator('.project-card').nth(1).locator('.project-trash').click()
        expect(self.page.locator('#projects-view')).to_be_visible();expect(self.page.locator('.project-card')).to_have_count(2)

    def test_07_narrow_list_enters_info_opens_sheet(self):
        self.page.set_viewport_size({'width':390,'height':844});booking,notify=self.start(['예약','알림'])
        for b in [f'#list-enter-{notify}',f'#list-info-{notify}']:
            box=self.page.locator(b).bounding_box();self.assertGreaterEqual(box['height'],44);self.assertGreaterEqual(box['width'],44)
        self.page.locator(f'#list-info-{notify}').click();expect(self.page.locator('#area-panel')).to_be_visible();expect(self.title()).to_have_text('전체 공간')
        self.page.locator('#area-panel-close').click();self.page.locator(f'#list-enter-{notify}').click();expect(self.title()).to_have_text('알림')
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.screenshot(path=str(base.OUT/'spatial102-390.png'))

if __name__=='__main__':unittest.main()
