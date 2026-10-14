"""FLOW090 native UI -> localhost -> explicit MOCK. The plan space with the user's own areas: empty start, areas,
an area's request and report, reload, the project list, and an older project without areas. Wiring, not usability.
Run from app/: python continuity/tests/flow090_browser.py
"""
import json, unittest
from playwright.sync_api import expect
import browser as base

class SpatialWorkspace(unittest.TestCase):
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp;tearDown=base.Browser.tearDown;state=base.Browser.state

    def add_area(self,name,note=''):
        self.page.locator('#area-name').fill(name);self.page.locator('#area-note').fill(note);self.page.locator('#area-add').click()
        expect(self.page.locator('.area-card',has_text=name)).to_be_visible()
    def area_id(self,name):return next(a['id'] for a in self.state()['space']['areas'] if a['name']==name)
    def download(self,button,name):
        with self.page.expect_download() as event:self.page.locator(button).click()
        path=base.OUT/name;event.value.save_as(path);return path

    def test_01_empty_start_areas_area_work_report_and_reload(self):
        calls=[];self.page.on('request',lambda r:calls.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
        brief='동네 미용실 손님이 휴대폰으로 날짜와 시간을 골라 예약하는 서비스'
        expect(self.page.locator('#brief-input')).to_be_visible();expect(self.page.locator('#brief-start')).to_be_disabled()
        self.page.screenshot(path=str(base.OUT/'flow090-start.png'))
        self.page.locator('#brief-input').fill(brief);self.page.locator('#brief-start').click()
        expect(self.page.locator('#space-title')).to_have_text('전체 공간');expect(self.page.locator('#space-brief')).to_have_text(brief)
        self.assertEqual(self.state()['space']['brief']['text'],brief);self.assertEqual(self.state()['sources'],[],'the purpose is not a request')
        self.add_area('예약','날짜와 시간을 골라 예약');self.add_area('알림')
        expect(self.page.locator('.area-card',has_text='알림')).to_contain_text('미정')
        # Rename an area; looking at it changes nothing else.
        self.page.locator('.area-card',has_text='알림').click();expect(self.page.locator('#space-title')).to_have_text('알림')
        self.page.locator('#area-edit').evaluate('(e)=>e.open=true');self.page.locator('#area-edit-name').fill('알림 문자');self.page.locator('#area-edit-save').click()
        expect(self.page.locator('#space-title')).to_have_text('알림 문자');self.page.locator('#space-crumb-root').click()
        booking,notify=self.area_id('예약'),self.area_id('알림 문자')
        self.page.locator('#relation-add').evaluate('(e)=>e.open=true');self.page.locator('#relation-from').select_option(booking);self.page.locator('#relation-to').select_option(notify)
        self.page.locator('#relation-kind').select_option('flow');self.page.locator('#relation-note').fill('예약하면 알림');self.page.locator('#relation-save').click()
        expect(self.page.locator('#area-relations')).to_contain_text('예약 → 알림 문자 · 이어서 사용 · 예약하면 알림')
        # Write the first request for the booking area.
        self.page.locator('.area-card',has_text='예약').click();self.page.locator('#area-new-request').click()
        expect(self.page.locator('#compose-area')).to_have_value(booking)
        self.page.locator('#draft').fill('예약 화면에서 날짜와 시간을 고르게 해줘');self.page.locator('#send').click()
        expect(self.page.locator('#working')).to_have_text('');expect(self.page.locator('#current-work')).to_be_visible()
        s=self.state();task=s['tasks'][0];self.assertEqual(task['areaId'],booking);self.assertEqual(s['currentTaskId'],task['id']);self.assertEqual(len(calls),1)
        expect(self.page.locator('#work-place')).to_contain_text('예약')
        handoff=self.download('#download-work','flow090-booking.md').read_text(encoding='utf-8')
        self.assertNotIn(brief,handoff,'the purpose text is not sent as a work instruction')
        self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill('보고: 날짜 선택 화면을 만들었다고 주장. 실제 확인 없음.')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        s=self.state();report=s['tasks'][-1];self.assertEqual(report['parentTaskId'],task['id']);self.assertNotIn('areaId',report)
        # The area shows the request with its result (unverified); looking around never changes the open work.
        self.page.locator('#place-area').click();expect(self.page.locator('#space-title')).to_have_text('예약')
        item=self.page.locator('.area-task',has_text='예약 화면에서')
        expect(item).to_contain_text('돌아온 결과 1개 · 앱 미검증');expect(item).to_contain_text('지금 이어가는 작업')
        self.page.screenshot(path=str(base.OUT/'flow090-area.png'),full_page=True)
        self.page.set_viewport_size({'width':390,'height':844});self.page.screenshot(path=str(base.OUT/'flow090-area-390.png'),full_page=True)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390);self.page.set_viewport_size({'width':1440,'height':1050})
        current=self.state()['currentTaskId'];self.page.locator('#space-crumb-root').click();self.page.locator('.area-card',has_text='알림 문자').click()
        expect(self.page.locator('#area-tasks')).to_contain_text('아직 이 영역의 요청이 없어요');self.assertEqual(self.state()['currentTaskId'],current)
        saved=self.state();self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK')
        expect(self.page.locator('#space-title')).to_have_text('알림 문자');self.assertEqual(self.state(),saved)
        # The list shows the areas; opening the project returns to the space.
        self.page.locator('#nav-projects').click();card=self.page.locator('.project-card').first;expect(card).to_contain_text('영역 2개')
        card.locator('.project-open').click();expect(self.page.locator('#space-view')).to_be_visible()
        # Archive keeps everything and can be undone.
        self.page.locator('#nav-space').click();self.page.locator('.area-card',has_text='예약').click();self.page.locator('#area-archive').click()
        expect(self.page.locator('#archived-areas > summary')).to_have_text('보관한 영역 1개');self.assertEqual(self.state()['tasks'][0]['areaId'],booking)
        self.page.locator('#archived-areas').evaluate('(e)=>e.open=true');self.page.locator('#archived-areas button',has_text='되살리기').click()
        expect(self.page.locator('.area-card',has_text='예약')).to_be_visible();self.assertEqual(len(calls),2,'only the request and the report analysis called the MOCK; areas never do')
        self.page.screenshot(path=str(base.OUT/'flow090-space.png'),full_page=True)

    def test_02_an_older_project_without_areas_opens_whole_and_can_be_placed(self):
        self.page.locator('#draft').fill('예약 확정 문구를 바꿔줘');self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        old=self.state();old['schemaVersion']='idea015.project.3';del old['space']
        for t in old['tasks']:t.pop('areaId',None)
        entry=self.page.evaluate('document.documentElement.dataset.entryId')
        self.page.evaluate('''([key,entry,project])=>{const env=JSON.parse(localStorage.getItem(key));env.entries.find(e=>e.entryId===entry).project=project;localStorage.setItem(key,JSON.stringify(env));}''',[base.WORKSPACE,entry,old])
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');expect(self.page.locator('#current-work')).to_be_visible()
        self.assertEqual(self.state(),old,'opening reads the older value without rewriting it')
        self.page.locator('#nav-space').click();expect(self.page.locator('#open-unplaced')).to_contain_text('요청 1개')
        self.add_area('확정 화면');self.page.locator('#open-unplaced').click()
        self.page.locator('.area-task').locator('.area-place').click()
        expect(self.page.locator('#area-tasks')).to_contain_text('영역 미지정 요청이 없어요')
        s=self.state();self.assertEqual(s['schemaVersion'],'idea015.project.4');self.assertEqual(s['tasks'][0]['areaId'],self.area_id('확정 화면'))
        for k in ['sources','bases','currentTaskId']:self.assertEqual(s[k],old[k],k)
        backup=self.download('#backup','flow090-backup.json');data=json.loads(backup.read_text(encoding='utf-8'))
        self.assertEqual(data['schemaVersion'],'idea015.project.4');self.assertEqual(data['space'],s['space']);self.assertEqual(data['tasks'][0]['areaId'],s['tasks'][0]['areaId'])
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(backup))
        expect(self.page.locator('#notice')).to_contain_text('사본');copy=self.state()
        self.assertEqual(copy['space'],s['space']);self.assertEqual(copy['tasks'][0]['areaId'],s['tasks'][0]['areaId'])

    def start(self,areas):
        self.page.locator('#brief-input').fill('예약 서비스');self.page.locator('#brief-start').click()
        for name in areas:self.add_area(name)
        return [self.area_id(n) for n in areas]
    def request_in(self,area,text,export=True):
        self.page.locator('#nav-space').click();self.page.locator('.area-card',has_text=area).click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(text);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        if export:self.download('#download-work',f'flow090-{len(self.state()["tasks"])}.md')
        return self.state()['currentTaskId']

    def test_03_returning_to_an_area_continues_its_latest_request_not_a_late_old_report(self):
        booking,notify=self.start(['예약','알림'])
        A=self.request_in('예약','A: 예약 화면 전체 변경');B=self.request_in('예약','B: 예약 버튼 문구만');C=self.request_in('알림','C: 알림 문자')
        self.page.locator('#home-paste-result').click();self.page.locator('#return-task').select_option(A)
        self.page.locator('#draft').fill('늦은 A 보고: 전체 화면을 고쳤다고 주장');self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(self.state()['currentTaskId'],C)
        self.request_in('예약','예약 새 요청',export=False)
        s=self.state();self.assertEqual(s['tasks'][-1]['parentTaskId'],B);self.assertEqual(s['tasks'][-1]['areaId'],booking)

    def test_04_an_unsent_report_or_request_keeps_its_kind_and_target(self):
        booking,notify=self.start(['예약','알림'])
        self.request_in('예약','A: 예약 화면');self.page.locator('#home-paste-result').click()
        self.page.locator('#draft').fill('작성 중인 보고 원문');self.page.wait_for_timeout(100)
        self.page.locator('#nav-space').click();self.page.locator('.area-card',has_text='알림').click();self.page.locator('#area-new-request').click()
        s=self.state();self.assertEqual(s['draftKind'],'report');self.assertEqual(s['draft'],'작성 중인 보고 원문')
        expect(self.page.locator('#notice')).to_contain_text('작성 중인')
        # An unsent request keeps the area it was written for.
        self.page.locator('#draft').fill('');self.page.locator('#request-tab').click()
        self.page.locator('#nav-space').click();self.page.locator('.area-card',has_text='알림').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill('알림 쪽 요청 작성 중');self.page.wait_for_timeout(100)
        self.page.locator('#nav-space').click();self.page.locator('.area-card',has_text='예약').click();self.page.locator('#area-new-request').click()
        expect(self.page.locator('#compose-area')).to_have_value(notify);expect(self.page.locator('#notice')).to_contain_text('작성 중인')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(self.state()['tasks'][-1]['areaId'],notify)

    def test_05_area_edit_drafts_stay_with_their_area(self):
        booking,notify=self.start(['예약','알림'])
        def edit(area):
            self.page.locator('#nav-space').click();self.page.locator('.area-card',has_text=area).click()
            self.page.locator('#area-edit').evaluate('(e)=>e.open=true')
        edit('예약');self.page.locator('#area-edit-name').fill('예약 바꾸는 중');self.page.locator('#area-edit-note').fill('예약 설명 초안')
        edit('알림');expect(self.page.locator('#area-edit-name')).to_have_value('알림');expect(self.page.locator('#area-edit-note')).to_have_value('')
        edit('예약');expect(self.page.locator('#area-edit-name')).to_have_value('예약 바꾸는 중')
        self.page.locator('#area-edit-cancel').click();self.page.locator('#area-edit').evaluate('(e)=>e.open=true')
        expect(self.page.locator('#area-edit-name')).to_have_value('예약');self.assertEqual(self.state()['space']['areas'][1]['name'],'알림')

    def test_06_a_backup_copy_keeps_the_unsent_requests_area(self):
        booking,notify=self.start(['예약','알림'])
        self.request_in('예약','A: 예약 화면')
        self.page.locator('#nav-space').click();self.page.locator('.area-card',has_text='알림').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill('알림 쪽 미제출 요청');self.page.wait_for_timeout(100)
        backup=self.download('#backup','flow090-draft-target.json')
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(backup))
        expect(self.page.locator('#notice')).to_contain_text('사본');self.page.locator('#nav-work').click()
        if not self.page.locator('#compose-panel').evaluate('(e)=>e.open'):self.page.locator('#compose-summary').click()
        expect(self.page.locator('#draft')).to_have_value('알림 쪽 미제출 요청');expect(self.page.locator('#compose-area')).to_have_value(notify)
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(self.state()['tasks'][-1]['areaId'],notify)

if __name__=='__main__':unittest.main(verbosity=2)
