"""PC12: native Chromium -> real localhost HTTP -> explicit MOCK; no paid AI.
One reading flow in the existing product: the selected area's name and the user's idea read first (editing is opened on
purpose) -> a task the user picks, short context first, originals/reports/conditions opened when needed -> optional
explicit continue + the existing manual 4-field edit of the real current task -> back to the map view the reading started
from (viewport, scale, selection, scroll, focus), without rolling back the continued task or saved edits.

Data is installed through the product UI (labelled 'fixture' steps). Two boundary cases need data the UI cannot make
(a task with no saved plan copy, a task with no AI/manual text); they are installed by editing an exported backup and
importing it with the product's own import button, and are labelled as synthetic fixtures. Operations under test are
real click / key / wheel; nothing assigns app state directly. Wiring, not usability.
Run from app/: python continuity/tests/pc12_browser.py
"""
import json, unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base

LONG_A='A: 예약 접수 화면의 입력 항목을 정리해 주세요. 이름·연락처·인원은 필수, 메모는 선택. '+'세부 조건을 이어서 적습니다. '*45+'끝 문장 ZZ-END-A'
REPORT_R='R 보고: 입력 항목을 정리했다고 주장. 실제 클릭 검사는 하지 않음. '+'긴 보고 내용이 이어집니다. '*40+'끝 문장 ZZ-END-R'
LONG_IDEA='날짜와 시간을 고르는 예약 · 아직 못 정함: 결제 방식, 취소 규칙, 노쇼 처리. '*4+'구상 끝 ZZ-IDEA-END'
WORK_KEYS=['understanding','scope','next','checks']


class Pc12(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state

    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT});self.steps=[]

    # ---------- helpers: real UI operations ----------
    def log(self,text):self.steps.append(text)
    def shot(self,name):self.page.screenshot(path=str(base.OUT/f'pc12-{self.WIDTH}-{name}.png'))
    def focused(self):return self.page.evaluate('document.activeElement && document.activeElement.id')
    def title(self):return self.page.locator('#space-title')
    def transform(self):return self.page.locator('#space-plane').evaluate('(e)=>e.style.transform')
    def task(self,tid,s=None):return next(t for t in (s or self.state())['tasks'] if t['id']==tid)
    def start(self,areas):
        self.page.locator('#brief-input').fill('공방 원데이 클래스 예약');self.page.locator('#brief-start').click()
        for name,note in areas:
            self.page.locator('#area-name').fill(name);self.page.locator('#area-note').fill(note);self.page.locator('#area-add').click()
            expect(self.page.locator('.area-node',has_text=name)).to_be_visible()
        return [next(a['id'] for a in self.state()['space']['areas'] if a['name']==n) for n,_ in areas]
    def request_in(self,area,text):
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(text);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        return self.state()['currentTaskId']
    def paste_report(self,text):
        self.page.locator('#nav-work').click();self.page.locator('#home-paste-result').click()
        self.page.locator('#draft').fill(text);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        return self.state()['tasks'][-1]['id']
    def unsent_draft(self,area,text):
        """An unsent request written for another area: reading must keep its kind, target and text."""
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(text);base.saved(self.page)
    def move_map(self):
        """Zoom twice with the buttons and pan by dragging the empty map background (real pointer)."""
        self.page.locator('#map-zoom-in').click();self.page.locator('#map-zoom-in').click()
        box=self.page.locator('#space-map').bounding_box();x,y=box['x']+box['width']*0.5,box['y']+box['height']-24
        hit=self.page.evaluate('([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.id||e.className)}',[x,y])
        self.assertIn(hit,['space-map','space-plane','relation-layer'],f'the pan starts on the empty map ({hit})')
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x-70,y-35,steps=6);self.page.mouse.up()
    def depart(self,area,task):
        """From the whole space: select the area with '정보', move the map, scroll the page with the wheel, then pick the task."""
        self.page.locator('#nav-space').click();expect(self.title()).to_have_text('전체 공간')
        self.page.locator(f'#node-info-{area}').click();expect(self.page.locator('#area-panel')).to_be_visible()
        self.move_map()
        self.page.mouse.move(self.WIDTH-20,self.HEIGHT//2);self.page.mouse.wheel(0,140);self.page.wait_for_timeout(150)
        pick=self.page.locator(f'#panel-task-{task}');expect(pick).to_be_in_viewport()
        before={'transform':self.transform(),'scale':self.page.locator('#map-scale').inner_text(),'y':self.page.evaluate('window.scrollY'),
                'selected':self.page.locator('.area-node.selected').get_attribute('data-area-id')}
        self.assertGreater(before['y'],0,'the wheel moved the reading position');self.assertNotIn('scale(1)',before['transform'])
        pick.click();expect(self.page.locator('#task-view')).to_be_visible()
        self.log(f"depart: {before}")
        return before
    def assert_back(self,before,area,task):
        expect(self.title()).to_have_text('전체 공간');expect(self.page.locator('#area-panel')).to_be_visible()
        self.assertEqual(self.transform(),before['transform']);self.assertEqual(self.page.locator('#map-scale').inner_text(),before['scale'])
        self.assertEqual(self.page.locator('.area-node.selected').get_attribute('data-area-id'),area)
        self.assertAlmostEqual(self.page.evaluate('window.scrollY'),before['y'],delta=2)
        self.assertEqual(self.focused(),f'panel-task-{task}')
        self.log(f"back: transform={self.transform()} y={self.page.evaluate('window.scrollY')} focus={self.focused()}")
    def edit_work(self,values):
        d=self.page.locator('#edit-work')
        if d.get_attribute('open') is None:d.locator('summary').first.click()
        for k in WORK_KEYS:self.page.locator(f'#work-{k}').fill(values[k])
        for k in WORK_KEYS:expect(self.page.locator(f'#manual-{k}')).to_have_text('직접 수정 · AI가 덮어쓰지 않음')
        base.saved(self.page)

    def build(self):
        """Fixture via the product UI: two areas (one with a long idea), request A + its report R, an unsent draft."""
        booking,notify=self.start([('예약',LONG_IDEA),('알림','')])
        A=self.request_in(booking,LONG_A);R=self.paste_report(REPORT_R)
        s=self.state();self.assertEqual(s['currentTaskId'],R);self.assertEqual(self.task(R,s)['parentTaskId'],A)
        self.unsent_draft(notify,'아직 보내지 않은 알림 요청 초안')
        return booking,notify,A,R

    # ---------- core path 1: reading only ----------
    def test_01_read_only_round_trip_changes_nothing(self):
        booking,notify,A,R=self.build();self.log('fixture via UI: areas, A(MOCK), R(report of A), unsent draft for 알림')
        before_state=self.state()
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{booking}').click();panel=self.page.locator('#area-panel')
        # The area is read first: name and the user's idea (an excerpt that says so), editing closed until asked.
        expect(panel.locator('.panel-top strong')).to_have_text('예약');expect(panel.locator('#panel-idea')).to_contain_text('사용자 구상')
        expect(self.page.locator('#panel-edit')).not_to_have_attribute('open','');expect(self.page.locator('#panel-name')).to_be_hidden()
        expect(self.page.locator('#panel-idea-full > summary')).to_contain_text('위는 앞부분');expect(panel.get_by_text('ZZ-IDEA-END')).to_be_hidden()
        self.assertNotIn('panel-report',self.page.content(),'no report is picked for the user')
        expect(self.page.locator(f'#panel-task-{A}')).to_be_visible();expect(self.page.locator('.panel-task')).to_have_count(1)
        self.shot('01-area-read')
        before=self.depart(booking,A)
        # Short context of the chosen task, with where each line comes from; long parts closed.
        ctx=self.page.locator('#task-view-context');expect(ctx).to_contain_text('영역 ‘예약’')
        expect(ctx.locator('[data-field="understanding"] .field-origin')).to_have_text('MOCK 제안 · 원문과 다를 수 있음')
        expect(self.page.locator('#task-view-target')).to_contain_text('받은 현재 보고')
        for d in ['task-view-request','task-view-results','task-view-work']:expect(self.page.locator(f'#{d}')).not_to_have_attribute('open','')
        expect(self.page.locator('#task-view-request .source-raw')).to_be_hidden();expect(self.page.locator('#task-view-results .source-raw').first).to_be_hidden()
        self.shot('02-task-context')
        # Open and close the long original (click), and the report (keyboard on its summary).
        self.page.locator('#task-view-request > summary').click();expect(self.page.locator('#task-view-request')).to_contain_text('ZZ-END-A')
        expect(self.page.locator('#task-view-request .source-raw')).to_be_visible();self.page.locator('#task-view-request > summary').click()
        expect(self.page.locator('#task-view-request .source-raw')).to_be_hidden()
        self.page.locator('#task-view-results > summary').focus();self.page.keyboard.press('Enter')
        expect(self.page.locator('#task-view-results')).to_have_attribute('open','');expect(self.page.locator('#task-view-results')).to_contain_text('앱 미검증')
        self.page.keyboard.press('Enter');expect(self.page.locator('#task-view-results')).not_to_have_attribute('open','')
        self.page.locator('#task-return-origin').click();self.assert_back(before,booking,A)
        after=self.state()
        self.assertEqual(after,before_state,'reading changed no saved data (current task, draft kind/target/text, manual fields)')
        self.assertEqual(after['currentTaskId'],R);self.assertEqual(after['draftKind'],'request');self.assertEqual(after['space']['draftTarget'],{'area':notify})
        # The restored focus is usable: Enter opens the same task again.
        self.page.keyboard.press('Enter');expect(self.title()).to_contain_text('A: 예약 접수')
        self.shot('03-back-read')

    # ---------- core path 2: explicit continue + manual edit, A/R and RB->A ----------
    def test_02_continue_keeps_R_then_switches_from_RB_to_A(self):
        booking,notify,A,R=self.build()
        s0=self.state();A0,R0=self.task(A,s0),self.task(R,s0)
        # (1) current = R (report of A): continuing A keeps R and edits R only.
        before=self.depart(booking,A)
        expect(self.page.locator('#task-view-target')).to_contain_text(f'작업 02의 후속 확인 작업문');expect(self.page.locator('#task-view-continue')).to_have_text('작업 화면으로')
        self.page.locator('#task-view-continue').click();expect(self.page.locator('#current-work')).to_be_visible()
        expect(self.page.locator('#notice')).to_contain_text('받은 현재 보고 작업 02에서 계속');expect(self.page.locator('#work-place')).to_contain_text('작업 01의 보고 · 후속 확인 작업문 초안')
        self.assertEqual(self.state()['currentTaskId'],R)
        vR={k:f'R만 고친 {k} · {self.WIDTH}' for k in WORK_KEYS};self.edit_work(vR);self.shot('04-edit-R')
        self.page.locator('#work-return-origin').click();self.assert_back(before,booking,A)
        s1=self.state();self.assertEqual(s1['currentTaskId'],R,'return does not roll back the continued task')
        self.assertEqual(self.task(R,s1)['manual'],vR);self.assertEqual(self.task(A,s1)['manual'],A0['manual'],'A untouched')
        self.assertEqual(s1['draft'],s0['draft']);self.assertEqual(s1['space']['draftTarget'],s0['space']['draftTarget']);self.assertEqual(s1['draftKind'],'request')
        # Fixture via UI: request B in 알림 + its report RB (the unsent 알림 draft is sent as B first, as the product does).
        self.page.locator('#nav-work').click()
        if not self.page.locator('#compose-panel').evaluate('(e)=>e.open'):self.page.locator('#compose-summary').click()
        self.page.locator('#draft').fill('B: 알림 문자에 예약 시간 넣기')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('');B=self.state()['currentTaskId']
        self.assertEqual(self.task(B)['areaId'],notify);RB=self.paste_report('RB 보고: 알림 문구 반영했다고 주장')
        s2=self.state();self.assertEqual(s2['currentTaskId'],RB);B2,RB2,R2=self.task(B,s2),self.task(RB,s2),self.task(R,s2)
        # (2) current = RB (report of another request B): continuing A switches to A (not its older report R) and edits A only.
        before=self.depart(booking,A)
        expect(self.page.locator('#task-view-target')).to_contain_text('이 요청(작업 01)으로 바꾸고');expect(self.page.locator('#task-view-target')).to_contain_text('이전 보고를 대신 고르지 않아요')
        expect(self.page.locator('#task-view-continue')).to_have_text('이 작업 이어서 하기')
        self.page.locator('#task-view-continue').click();expect(self.page.locator('#current-work')).to_be_visible()
        self.assertEqual(self.state()['currentTaskId'],A);expect(self.page.locator('#current-work h2')).to_have_text('이어갈 작업')
        vA={k:f'A만 고친 {k} · {self.WIDTH}' for k in WORK_KEYS};self.edit_work(vA);self.shot('05-edit-A')
        self.page.locator('#work-return-origin').click();self.assert_back(before,booking,A);self.shot('06-back-after-edit')
        s3=self.state();self.assertEqual(s3['currentTaskId'],A)
        self.assertEqual(self.task(A,s3)['manual'],vA);self.assertEqual(self.task(R,s3)['manual'],R2['manual']);self.assertEqual(self.task(R,s3)['manual'],vR)
        self.assertEqual(self.task(RB,s3),RB2);self.assertEqual(self.task(B,s3),B2)
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');self.assertEqual(self.state(),s3,'edits survive a reload')
        expect(self.page.locator('#task-return-origin, #work-return-origin')).to_have_count(0)


class Pc12Wide(Pc12):
    WIDTH,HEIGHT=1440,900


class Pc12Boundaries(unittest.TestCase):
    """Failure boundaries of the same flow at 1280x720 (and the 390 minimum)."""
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state
    setUp=Pc12.setUp;start=Pc12.start;request_in=Pc12.request_in;paste_report=Pc12.paste_report;task=Pc12.task;title=Pc12.title
    shot=Pc12.shot;focused=Pc12.focused;log=Pc12.log

    def test_03_empty_area_and_empty_idea_make_nothing_up(self):
        (empty,)=self.start([('빈 영역','')])
        self.page.locator(f'#node-info-{empty}').click();panel=self.page.locator('#area-panel')
        expect(panel).to_contain_text('구상 미기재');expect(self.page.locator('#panel-tasks')).to_have_text('아직 이 영역의 요청이 없어요.')
        expect(self.page.locator('.panel-task')).to_have_count(0);expect(self.page.locator('#check-list')).to_have_count(0)
        expect(self.page.locator('#task-return-origin, #work-return-origin')).to_have_count(0)
        # Editing is an explicit step; saving closes it and the read view shows the saved text.
        self.page.locator('#panel-edit > summary').click();self.page.locator('#panel-note').fill('짧은 구상');self.page.locator('#panel-save').click()
        expect(self.page.locator('#panel-edit')).not_to_have_attribute('open','');expect(self.page.locator('#panel-idea')).to_contain_text('짧은 구상')
        self.assertEqual(self.state()['tasks'],[]);self.shot('07-empty')

    def test_04_stale_ai_text_is_named_and_kept_out(self):
        (booking,)=self.start([('예약','')]);A=self.request_in(booking,'예약 확인 문구를 바꿔 주세요.')
        # Change the basis this AI text was written from (existing context panel path): the MOCK text becomes stale.
        self.page.locator('#nav-context').click();self.page.locator('#related-bases details summary').first.click()
        self.page.locator('#related-bases textarea').first.fill('예약 확인 문구를 “예약 완료”로 바꿔 주세요.');self.page.locator('#related-bases button',has_text='수정 기록').first.click()
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{booking}').click();self.page.locator(f'#panel-task-{A}').click()
        row=self.page.locator('#task-view-context [data-field="understanding"]');expect(row).to_have_attribute('data-origin','stale')
        expect(row).to_contain_text('작업문에서 제외됨');expect(row.locator('dd')).to_have_text('지금 작업문에는 들어가지 않아요.')
        expect(self.page.locator('#task-view-stale-understanding')).not_to_have_attribute('open','')
        self.shot('08-stale')

    def test_05_no_plan_copy_no_text_and_changed_plan(self):
        """Synthetic fixture: an exported backup with one task's plan copy and AI text removed, imported as a copy."""
        booking,notify=self.start([('예약','첫 구상'),('알림','')]);A=self.request_in(booking,'A: 예약 화면');B=self.request_in(notify,'B: 알림 문자')
        with self.page.expect_download() as d:self.page.locator('#backup').click()
        raw=json.loads(Path(d.value.path()).read_text(encoding='utf-8'))
        for t in raw['tasks']:
            if t['id']==B:t.update(background=None,advice=None,adviceRevision=None,mode=None)
        path=base.OUT/'pc12-fixture-import.json';path.write_text(json.dumps(raw,ensure_ascii=False),encoding='utf-8')
        self.page.once('dialog',lambda dl:dl.accept());self.page.locator('#import-file').set_input_files(str(path))
        expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요');self.log('synthetic fixture imported')
        # Plan edited after A was written (UI): A's copy says the plan changed since, not that code changed.
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{booking}').click();self.page.locator('#panel-edit > summary').click()
        self.page.locator('#panel-note').fill('바뀐 구상');self.page.locator('#panel-save').click()
        self.page.locator(f'#panel-task-{A}').click();bg=self.page.locator('#task-view-background')
        expect(bg.locator('summary')).to_contain_text('그 뒤 구상이 바뀜');bg.locator('summary').click();expect(bg).to_contain_text('첫 구상')
        expect(bg).not_to_contain_text('코드');expect(bg).not_to_contain_text('지난 방문')
        self.page.locator('#task-return-origin').click();self.page.locator(f'#node-info-{notify}').click();self.page.locator(f'#panel-task-{B}').click()
        expect(self.page.locator('#task-view-context')).to_contain_text('아직 짧은 이해·범위 기록이 없어요');expect(self.page.locator('#task-view-context dl')).to_have_count(0)
        expect(self.page.locator('#task-view-work')).to_contain_text('원문 속 조건이나 금지가 없다는 뜻은 아니');expect(self.page.locator('#task-view-background > summary')).to_contain_text('이 작업에는 없음')
        self.page.locator('#task-view-request > summary').click();expect(self.page.locator('#task-view-request')).to_contain_text('B: 알림 문자')
        self.shot('09-no-copy')

    def test_06_starting_point_dropped_on_project_switch_and_reload(self):
        (booking,)=self.start([('예약','')]);A=self.request_in(booking,'A: 예약 화면')
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{booking}').click();self.page.locator(f'#panel-task-{A}').click()
        expect(self.page.locator('#task-return-origin')).to_be_visible()
        # Reload: the per-tab starting point is not kept; no button, no selection made up, the task view itself stays.
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');expect(self.title()).to_contain_text('A: 예약')
        expect(self.page.locator('#task-return-origin')).to_have_count(0)
        # Another project: nothing of this starting point comes along.
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{booking}').click();self.page.locator(f'#panel-task-{A}').click()
        self.page.locator('#task-view-continue').click();expect(self.page.locator('#work-return-origin')).to_be_visible()
        self.page.locator('#new-project-top').click();expect(self.page.locator('#work-return-origin')).to_have_count(0)
        self.page.locator('#nav-projects').click();self.page.locator('.project-card').filter(has_text='공방').locator('.project-open').click()
        expect(self.page.locator('#task-return-origin, #work-return-origin')).to_have_count(0)
        self.assertEqual(self.state()['currentTaskId'],A)

    def test_07_narrow_390_minimum(self):
        self.page.set_viewport_size({'width':390,'height':844})
        (booking,)=self.start([('예약',LONG_IDEA)]);A=self.request_in(booking,LONG_A)
        self.page.locator('#nav-space').click();self.page.locator(f'#list-info-{booking}').click();expect(self.page.locator('#area-panel')).to_be_visible()
        pick=self.page.locator(f'#panel-task-{A}');pick.scroll_into_view_if_needed();pick.click();expect(self.page.locator('#task-view')).to_be_visible()
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.locator('#task-view-request > summary').click();self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.screenshot(path=str(base.OUT/'pc12-390-task.png'))
        self.page.locator('#task-return-origin').click();expect(self.title()).to_have_text('전체 공간')
        expect(self.page.locator('#area-panel')).to_be_visible();self.page.locator('#area-panel-close').click();expect(self.page.locator('#area-panel')).to_have_count(0)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)


if __name__=='__main__':
    unittest.main(verbosity=2)
