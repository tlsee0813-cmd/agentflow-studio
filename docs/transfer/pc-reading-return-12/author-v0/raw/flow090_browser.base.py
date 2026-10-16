"""FLOW090 native UI -> localhost -> explicit MOCK. The plan space with the user's own areas: empty start, areas,
an area's request and report, reload, the project list, and an older project without areas. Wiring, not usability.
Run from app/: python continuity/tests/flow090_browser.py
SPATIAL102 changed the card click contract (docs/spatial102-enter-first.md): the card body / list row now enters
(#node-enter-*, #list-enter-*) and selection moved to the separate '정보' button (#node-info-*, #list-info-*).
Each former select click became an info click and each former open click an enter click; what is checked is unchanged.
"""
import json, re, unittest
from playwright.sync_api import expect
import browser as base

class SpatialWorkspace(unittest.TestCase):
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp;tearDown=base.Browser.tearDown;state=base.Browser.state

    def add_area(self,name,note=''):
        self.page.locator('#area-name').fill(name);self.page.locator('#area-note').fill(note);self.page.locator('#area-add').click()
        expect(self.page.locator('.area-node',has_text=name)).to_be_visible()
    def open_area(self,name):
        # SPATIAL102: the card body enters the area (it was 'select' + a separate open button before).
        self.page.locator('.area-node',has_text=name).first.locator('.node-enter').click()
        expect(self.page.locator('#space-title')).to_contain_text(name.split()[0])
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
        expect(self.page.locator('.area-node',has_text='알림')).to_contain_text('구상 미기재')
        # Rename an area; looking at it changes nothing else.
        self.open_area('알림');expect(self.page.locator('#space-title')).to_have_text('알림')
        self.page.locator('#area-edit').evaluate('(e)=>e.open=true');self.page.locator('#area-edit-name').fill('알림 문자');self.page.locator('#area-edit-save').click()
        expect(self.page.locator('#space-title')).to_have_text('알림 문자');self.page.locator('#space-crumb-root').click()
        booking,notify=self.area_id('예약'),self.area_id('알림 문자')
        self.page.locator('#relation-add').evaluate('(e)=>e.open=true');self.page.locator('#relation-from').select_option(booking);self.page.locator('#relation-to').select_option(notify)
        self.page.locator('#relation-kind').select_option('flow');self.page.locator('#relation-note').fill('예약하면 알림');self.page.locator('#relation-save').click()
        expect(self.page.locator('#area-relations')).to_contain_text('예약 → 알림 문자 · 이어서 사용 · 예약하면 알림')
        # Write the first request for the booking area.
        self.open_area('예약');self.page.locator('#area-new-request').click()
        expect(self.page.locator('#compose-area')).to_have_value(booking)
        self.page.locator('#draft').fill('예약 화면에서 날짜와 시간을 고르게 해줘');self.page.locator('#send').click()
        expect(self.page.locator('#working')).to_have_text('');expect(self.page.locator('#current-work')).to_be_visible()
        s=self.state();task=s['tasks'][0];self.assertEqual(task['areaId'],booking);self.assertEqual(s['currentTaskId'],task['id']);self.assertEqual(len(calls),1)
        expect(self.page.locator('#work-place')).to_contain_text('예약')
        handoff=self.download('#download-work','flow090-booking.md').read_text(encoding='utf-8')
        # FLOW091-C replaced 'never sent': the purpose goes out only inside the separated background block, not as an instruction.
        bg=handoff.split('## 프로젝트 배경·영역 구상 — 이번 요청 범위와 구분')
        self.assertEqual(len(bg),2);self.assertIn(brief,bg[1].split('\n## ')[0]);self.assertNotIn(brief,bg[0]);self.assertNotIn(brief,bg[1].split('\n## ',1)[1])
        self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill('보고: 날짜 선택 화면을 만들었다고 주장. 실제 확인 없음.')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        s=self.state();report=s['tasks'][-1];self.assertEqual(report['parentTaskId'],task['id']);self.assertNotIn('areaId',report)
        # The area shows the request with its result (unverified); looking around never changes the open work.
        self.page.locator('#place-area').click();expect(self.page.locator('#space-title')).to_have_text('예약')
        item=self.page.locator('.area-task',has_text='예약 화면에서')
        expect(item).to_contain_text('돌아온 결과 1개 · 앱 미검증');expect(item).to_contain_text('앱에서 이어갈 작업')
        self.page.screenshot(path=str(base.OUT/'flow090-area.png'),full_page=True)
        self.page.set_viewport_size({'width':390,'height':844});self.page.screenshot(path=str(base.OUT/'flow090-area-390.png'),full_page=True)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390);self.page.set_viewport_size({'width':1440,'height':1050})
        current=self.state()['currentTaskId'];self.page.locator('#space-crumb-root').click();self.open_area('알림 문자')
        expect(self.page.locator('#area-tasks')).to_contain_text('아직 이 영역의 요청이 없어요');self.assertEqual(self.state()['currentTaskId'],current)
        saved=self.state();self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK')
        expect(self.page.locator('#space-title')).to_have_text('알림 문자');self.assertEqual(self.state(),saved)
        # The list shows the areas; opening the project returns to the space.
        self.page.locator('#nav-projects').click();card=self.page.locator('.project-card').first;expect(card).to_contain_text('영역 2개')
        card.locator('.project-open').click();expect(self.page.locator('#space-view')).to_be_visible()
        # Archive keeps everything and can be undone.
        self.page.locator('#nav-space').click();self.open_area('예약');self.page.locator('#area-archive').click()
        expect(self.page.locator('#archived-areas > summary')).to_have_text('보관한 영역 1개');self.assertEqual(self.state()['tasks'][0]['areaId'],booking)
        self.page.locator('#archived-areas').evaluate('(e)=>e.open=true');self.page.locator('#archived-areas button',has_text='되살리기').click()
        expect(self.page.locator('.area-node',has_text='예약')).to_be_visible();self.assertEqual(len(calls),2,'only the request and the report analysis called the MOCK; areas never do')
        self.page.screenshot(path=str(base.OUT/'flow090-space.png'),full_page=True)

    def test_02_an_older_project_without_areas_opens_whole_and_can_be_placed(self):
        self.page.locator('#draft').fill('예약 확정 문구를 바꿔줘');self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        old=self.state();old['schemaVersion']='idea015.project.3';del old['space']
        for t in old['tasks']:
            t.pop('areaId',None);t.pop('background',None)  # project.3 had neither areas nor background copies
            for h in t['handoffs']:h.pop('background',None)
        entry=self.page.evaluate('document.documentElement.dataset.entryId')
        self.page.evaluate('''([key,entry,project])=>{const env=JSON.parse(localStorage.getItem(key));env.entries.find(e=>e.entryId===entry).project=project;localStorage.setItem(key,JSON.stringify(env));}''',[base.WORKSPACE,entry,old])
        self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');expect(self.page.locator('#current-work')).to_be_visible()
        self.assertEqual(self.state(),old,'opening reads the older value without rewriting it')
        self.page.locator('#nav-space').click();expect(self.page.locator('#open-unplaced')).to_contain_text('요청 1개')
        self.add_area('확정 화면');self.page.locator('#open-unplaced').click()
        self.page.locator('.area-task').locator('.area-place').click()
        expect(self.page.locator('#area-tasks')).to_contain_text('영역 미지정 요청이 없어요')
        s=self.state();self.assertEqual(s['schemaVersion'],'idea015.project.5');self.assertEqual(s['tasks'][0]['areaId'],self.area_id('확정 화면'))
        for k in ['sources','bases','currentTaskId']:self.assertEqual(s[k],old[k],k)
        backup=self.download('#backup','flow090-backup.json');data=json.loads(backup.read_text(encoding='utf-8'))
        self.assertEqual(data['schemaVersion'],'idea015.project.5');self.assertEqual(data['space'],s['space']);self.assertEqual(data['tasks'][0]['areaId'],s['tasks'][0]['areaId'])
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(backup))
        expect(self.page.locator('#notice')).to_contain_text('사본');copy=self.state()
        self.assertEqual(copy['space'],s['space']);self.assertEqual(copy['tasks'][0]['areaId'],s['tasks'][0]['areaId'])

    def start(self,areas):
        self.page.locator('#brief-input').fill('예약 서비스');self.page.locator('#brief-start').click()
        for name in areas:self.add_area(name)
        return [self.area_id(n) for n in areas]
    def request_in(self,area,text,export=True):
        self.page.locator('#nav-space').click();self.open_area(area);self.page.locator('#area-new-request').click()
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
        self.page.locator('#nav-space').click();self.open_area('알림');self.page.locator('#area-new-request').click()
        s=self.state();self.assertEqual(s['draftKind'],'report');self.assertEqual(s['draft'],'작성 중인 보고 원문')
        expect(self.page.locator('#notice')).to_contain_text('작성 중인')
        # An unsent request keeps the area it was written for.
        self.page.locator('#draft').fill('');self.page.locator('#request-tab').click()
        self.page.locator('#nav-space').click();self.open_area('알림');self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill('알림 쪽 요청 작성 중');self.page.wait_for_timeout(100)
        self.page.locator('#nav-space').click();self.open_area('예약');self.page.locator('#area-new-request').click()
        expect(self.page.locator('#compose-area')).to_have_value(notify);expect(self.page.locator('#notice')).to_contain_text('작성 중인')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(self.state()['tasks'][-1]['areaId'],notify)

    def test_05_area_edit_drafts_stay_with_their_area(self):
        booking,notify=self.start(['예약','알림'])
        def edit(area):
            self.page.locator('#nav-space').click();self.open_area(area)
            self.page.locator('#area-edit').evaluate('(e)=>e.open=true')
        edit('예약');self.page.locator('#area-edit-name').fill('예약 바꾸는 중');self.page.locator('#area-edit-note').fill('예약 설명 초안')
        edit('알림');expect(self.page.locator('#area-edit-name')).to_have_value('알림');expect(self.page.locator('#area-edit-note')).to_have_value('')
        edit('예약');expect(self.page.locator('#area-edit-name')).to_have_value('예약 바꾸는 중')
        self.page.locator('#area-edit-cancel').click();self.page.locator('#area-edit').evaluate('(e)=>e.open=true')
        expect(self.page.locator('#area-edit-name')).to_have_value('예약');self.assertEqual(self.state()['space']['areas'][1]['name'],'알림')

    def test_06_a_backup_copy_keeps_the_unsent_requests_area(self):
        booking,notify=self.start(['예약','알림'])
        self.request_in('예약','A: 예약 화면')
        self.page.locator('#nav-space').click();self.open_area('알림');self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill('알림 쪽 미제출 요청');self.page.wait_for_timeout(100)
        backup=self.download('#backup','flow090-draft-target.json')
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(backup))
        expect(self.page.locator('#notice')).to_contain_text('사본');self.page.locator('#nav-work').click()
        if not self.page.locator('#compose-panel').evaluate('(e)=>e.open'):self.page.locator('#compose-summary').click()
        expect(self.page.locator('#draft')).to_have_value('알림 쪽 미제출 요청');expect(self.page.locator('#compose-area')).to_have_value(notify)
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.assertEqual(self.state()['tasks'][-1]['areaId'],notify)

    def pos(self,area):
        s=self.state();a=next(x for x in s['space']['areas'] if x['id']==area);return s['space']['layout']['positions'].get(area)
    def drag(self,area,dx,dy):
        box=self.page.locator(f'#node-move-{area}').bounding_box();x,y=box['x']+box['width']/2,box['y']+box['height']/2
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x+dx/2,y+dy/2,steps=4);self.page.mouse.move(x+dx,y+dy,steps=4);self.page.mouse.up()
    def scale(self):return float(self.page.locator('#space-plane').evaluate('(e)=>new DOMMatrix(getComputedStyle(e).transform).a'))

    def test_07_map_select_move_open_zoom_fit_undo_and_restore(self):
        booking,notify=self.start(['예약','알림'])
        before=self.pos(booking);s0=self.scale()
        self.drag(booking,120,60);expect(self.page.locator('#space-title')).to_have_text('전체 공간')
        after=self.pos(booking);self.assertAlmostEqual(after['x']-before['x'],120/s0,delta=2);self.assertAlmostEqual(after['y']-before['y'],60/s0,delta=2)
        # '정보' shows the short panel; it never opens the area (SPATIAL102: was the card click).
        self.page.locator(f'#node-info-{notify}').click();expect(self.page.locator('#area-panel')).to_contain_text('알림')
        expect(self.page.locator('#space-title')).to_have_text('전체 공간')
        # Zoomed in, a drag moves by screen distance / scale.
        self.page.locator('#map-zoom-in').click();self.page.locator('#map-zoom-in').click();s1=self.scale();self.assertGreater(s1,s0)
        n0=self.pos(notify);self.drag(notify,100,0);n1=self.pos(notify)
        self.assertAlmostEqual(n1['x']-n0['x'],100/s1,delta=2);self.assertAlmostEqual(n1['y'],n0['y'],delta=1)
        # Fit changes the view only.
        stored=self.state()['space']['layout'];self.page.locator('#map-fit').click();self.assertEqual(self.state()['space']['layout'],stored)
        # Position undo: the last move first (button), then the one before (Ctrl+Z outside text fields).
        expect(self.page.locator('#map-undo')).to_contain_text('알림');self.page.locator('#map-undo').click()
        self.assertEqual(self.pos(notify),n0);self.page.locator('#space-title').click();self.page.keyboard.press('Control+z')
        self.assertEqual(self.pos(booking),before)
        # Ctrl+Z in a text field edits text, not positions.
        self.drag(notify,40,40);moved=self.pos(notify);self.page.locator(f'#node-info-{notify}').click()
        self.page.locator('#panel-name').fill('알림 바꾸는 중');self.page.locator('#panel-name').press('Control+z');self.assertEqual(self.pos(notify),moved)
        self.page.locator('#panel-cancel').click();expect(self.page.locator('#panel-name')).to_have_value('알림')
        # A report that arrives between a move and its undo stays.
        self.request_in('예약','예약 화면 만들기');self.page.locator('#nav-space').click();p0=self.pos(booking);self.drag(booking,80,0);p1=self.pos(booking)
        self.page.locator('#nav-work').click();self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill('보고: 화면을 만들었다고 주장')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('');tasks=len(self.state()['tasks'])
        self.page.locator('#nav-space').click();self.page.locator('#map-undo').click();self.assertEqual(self.pos(booking),p0)
        self.assertEqual(len(self.state()['tasks']),tasks);self.assertEqual(self.state()['sources'][-1]['kind'],'report')
        # Keyboard: move with arrows (one nudge = 20), open with Enter.
        k0=self.pos(notify);self.page.locator(f'#node-move-{notify}').focus();self.page.keyboard.press('ArrowRight')
        self.assertEqual(self.pos(notify)['x'],k0['x']+20)
        # View, scale and selection come back after an area round trip and after reload.
        self.page.locator(f'#node-info-{notify}').click();self.page.locator('#map-zoom-out').click();t0=self.page.locator('#space-plane').evaluate('(e)=>e.style.transform')
        self.page.locator(f'#node-enter-{booking}').click();expect(self.page.locator('#space-title')).to_have_text('예약');self.page.locator('#space-crumb-root').click()
        self.assertEqual(self.page.locator('#space-plane').evaluate('(e)=>e.style.transform'),t0)
        saved=self.state();self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK')
        self.assertEqual(self.page.locator('#space-plane').evaluate('(e)=>e.style.transform'),t0);expect(self.page.locator('#area-panel')).to_contain_text('알림')
        self.assertEqual(self.state(),saved)
        self.page.locator(f'#node-enter-{notify}').focus();self.page.keyboard.press('Enter');expect(self.page.locator('#space-title')).to_have_text('알림')
        self.page.locator('#space-crumb-root').click();self.page.screenshot(path=str(base.OUT/'flow090-map.png'),full_page=True)

    def test_08_narrow_screen_sheet_and_direct_open(self):
        self.page.set_viewport_size({'width':390,'height':844})
        booking,notify=self.start(['예약','알림'])
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        # Narrow: the map shows a part at a time; 'fit' brings every area into view without moving any.
        stored=self.state()['space']['layout'];self.page.locator('#map-fit').click();self.assertEqual(self.state()['space']['layout'],stored)
        self.page.locator(f'#node-info-{booking}').click();expect(self.page.locator('#area-panel')).to_be_visible()
        self.page.screenshot(path=str(base.OUT/'flow090-map-390-sheet.png'))
        self.page.locator('#area-panel-close').click();expect(self.page.locator('#area-panel')).to_have_count(0)
        self.page.locator(f'#node-enter-{notify}').click();expect(self.page.locator('#space-title')).to_have_text('알림')
        self.page.locator('#space-crumb-root').click();self.page.screenshot(path=str(base.OUT/'flow090-map-390.png'))

    def place(self,positions,notes={}):
        """Stores positions/notes as saved project data (the same envelope a reload reads), then reloads."""
        entry=self.page.evaluate('document.documentElement.dataset.entryId')
        self.page.evaluate("""([key,entry,positions,notes])=>{const env=JSON.parse(localStorage.getItem(key));const p=env.entries.find(e=>e.entryId===entry).project;
          Object.assign(p.space.layout.positions,positions);for(const a of p.space.areas)if(notes[a.id])a.note=notes[a.id];localStorage.setItem(key,JSON.stringify(env));}""",[base.WORKSPACE,entry,positions,notes])
        self.page.evaluate("sessionStorage.removeItem('agentflow.workspace.map')");self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK')
    def all_cards_inside(self):
        m=self.page.locator('#space-map').bounding_box()
        for box in [self.page.locator('.area-node').nth(i).bounding_box() for i in range(self.page.locator('.area-node').count())]:
            self.assertGreaterEqual(box['x'],m['x']-0.5);self.assertGreaterEqual(box['y'],m['y']-0.5)
            self.assertLessEqual(box['x']+box['width'],m['x']+m['width']+0.5);self.assertLessEqual(box['y']+box['height'],m['y']+m['height']+0.5)

    def test_09_fit_brings_every_card_into_view_at_any_spread(self):
        self.page.set_viewport_size({'width':390,'height':844})
        booking,notify=self.start(['예약','알림'])
        long='아주 긴 한 줄 구상이 들어가서 카드 높이가 달라지는 경우도 화면 안에 다 들어와야 합니다 '*3
        for spread in [{'x':2000,'y':0},{'x':200000,'y':-200000}]:
            self.place({booking:{'x':0,'y':0},notify:spread},{notify:long})
            self.all_cards_inside()  # the first visit to the map without a saved view fits
            self.page.locator('#map-zoom-in').click();self.page.locator('#map-fit').click();self.all_cards_inside()
            stored=self.state()['space']['layout'];t0=self.page.locator('#space-plane').evaluate('(e)=>e.style.transform')
            self.page.locator('#map-zoom-out').click();self.page.locator('#map-fit').click()
            self.assertEqual(self.state()['space']['layout'],stored)
            # A small fitted scale is kept across reload; zoom-out never jumps it back up to the button floor.
            self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK')
            self.assertEqual(self.page.locator('#space-plane').evaluate('(e)=>e.style.transform'),t0);self.all_cards_inside()

    def test_10_a_saved_target_in_the_last_archived_area_stays_visible(self):
        (booking,)=self.start(['예약'])
        self.open_area('예약');self.page.locator('#area-new-request').click();self.page.locator('#draft').fill('예약 쪽 미제출 요청');self.page.wait_for_timeout(100)
        self.page.locator('#nav-space').click();self.open_area('예약');self.page.locator('#area-archive').click()
        self.page.locator('#nav-work').click()
        if not self.page.locator('#compose-panel').evaluate('(e)=>e.open'):self.page.locator('#compose-summary').click()
        expect(self.page.locator('#compose-area-row')).to_be_visible();expect(self.page.locator('#compose-area')).to_have_value(booking)
        expect(self.page.locator('#compose-area')).to_contain_text('보관된 영역');self.page.locator('#send').click()
        expect(self.page.locator('#notice')).to_contain_text('보관돼 있어요');self.assertEqual(self.state()['space']['draftTarget'],{'area':booking})

    # ---------- FLOW091-U: usability cleanup of existing screens (wording, duplicate entries, map-first, narrow screens) ----------
    def test_11_task_goal_is_not_repeated_and_one_entry_each(self):
        self.page.set_viewport_size({'width':1265,'height':712})
        self.start(['예약']);request='예약 화면에서 날짜와 시간을 고르게 해줘'
        # Map first: the compact head keeps the full purpose and its editing one click away.
        expect(self.page.locator('#space-brief')).to_have_text('예약 서비스')
        self.assertLess(self.page.locator('#space-map').bounding_box()['y'],380,'the map starts in the first screen')
        self.page.locator('#brief-edit > summary').click();expect(self.page.locator('#brief-edit-text')).to_have_value('예약 서비스')
        self.request_in('예약',request,export=False)
        self.assertLess(self.page.locator('#next-actions').bounding_box()['y'],330,'the next action starts in the first screen')
        expect(self.page.locator('#intent-home h3')).to_have_text('이 작업의 목표 · MOCK 정리');expect(self.page.locator('#intent-goal')).to_have_text(request)
        # The same sentence is not shown twice; the original stays one click away.
        raw=self.page.locator('#outcome-request-raw');expect(raw).to_have_count(1);expect(self.page.locator('#outcome-purpose')).to_be_hidden()
        expect(self.page.locator('#outcome-purpose')).to_have_text(request);raw.locator('summary').click();expect(self.page.locator('#outcome-purpose')).to_be_visible()
        # One entry to the work text and one new-request button (plus the composer itself); both still work.
        work=self.page.locator('#work-view')
        expect(work.locator('button',has_text=re.compile('작업문.*보기'))).to_have_count(1);expect(work.locator('button',has_text='새 요청')).to_have_count(0)
        expect(work.locator('button',has_text='다음 요청')).to_have_count(1)
        self.page.locator('#next-preview').click();expect(self.page.locator('#handoff-text')).to_be_visible()
        self.page.locator('#change-direction').click();expect(self.page.locator('#draft')).to_be_focused()
        # A corrected goal differs from the original, which is then shown open again.
        self.page.locator('#intent-details > summary').click();self.page.locator('#intent-edit-goal').fill('날짜 고르기 화면만 먼저');self.page.locator('#intent-correct').click()
        expect(self.page.locator('#intent-home h3')).to_have_text('이 작업의 목표 · 직접 정정')
        expect(self.page.locator('#outcome-request-raw')).to_have_count(0);expect(self.page.locator('#outcome-purpose')).to_be_visible()

    def test_12_a_received_report_is_kept_on_its_task_and_the_next_text_is_a_follow_up_draft(self):
        (booking,)=self.start(['예약']);task=self.request_in('예약','예약 화면에서 날짜와 시간을 고르게 해줘')
        report='보고: 날짜 선택 화면을 만들었다고 함. 테스트는 미검사. '+'세부 내용이 길게 이어집니다. '*40+'끝 문장 ZZ-END'
        self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill(report);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        s=self.state();rt=s['tasks'][-1]
        self.assertEqual([t['id'] for t in s['tasks']][0],task);self.assertEqual(rt['parentTaskId'],task);self.assertEqual(len(s['tasks']),2)
        self.assertEqual(next(x for x in s['sources'] if x['id']==rt['sourceIds'][0])['kind'],'report')
        expect(self.page.locator('#task-number')).to_contain_text('작업 01에 받은 보고');expect(self.page.locator('#task-number')).to_contain_text('후속 확인 작업문 초안')
        expect(self.page.locator('#context-title')).to_contain_text('작업 01에 보관');expect(self.page.locator('#context-sub')).to_contain_text('검증하지 않았어요')
        expect(self.page.locator('#work-place')).to_contain_text('작업 01의 보고 · 후속 확인 작업문 초안')
        expect(self.page.locator('#current-work h2')).to_have_text('후속 확인 작업문 초안');expect(self.page.locator('#last-result-summary')).to_contain_text('앱 미검증')
        self.assertEqual(self.state()['tasks'],s['tasks'],'labels only: ids, parents and history unchanged')
        # Map and panel: what the app has open (not live execution), and a short raw excerpt of the latest report.
        self.page.locator('#nav-space').click();node=self.page.locator(f'.area-node[data-area-id="{booking}"]')
        expect(node).to_contain_text('앱에서 이어갈 작업');expect(self.page.locator('#space-view')).not_to_contain_text('지금 이어가는')
        self.page.locator(f'#node-info-{booking}').click();panel=self.page.locator('#panel-report')
        expect(self.page.locator('#area-panel')).to_contain_text('외부 도구에서 지금 실행 중이라는 뜻이 아니에요')
        expect(panel).to_contain_text('원문 앞부분');expect(panel).to_contain_text('미검증')
        excerpt=self.page.locator('.panel-excerpt').inner_text().rstrip('…')
        self.assertTrue(' '.join(report.split()).startswith(excerpt.strip()),'raw text, not a summary');self.assertNotIn('ZZ-END',panel.inner_text(),'the full report stays out of the panel')
        self.page.locator('#panel-report-more').click();expect(self.page.locator('#space-title')).to_have_text('예약')
        expect(self.page.locator(f'#raw-{task}')).to_have_attribute('open','');expect(self.page.locator(f'#raw-{task}')).to_contain_text('ZZ-END')
        self.page.locator('#space-crumb-root').click();self.page.locator(f'#node-info-{booking}').click()
        expect(self.page.locator('#panel-report-continue')).to_have_text('작업 화면으로');self.page.locator('#panel-report-continue').click()
        expect(self.page.locator('#current-work')).to_be_visible();self.assertEqual(self.state()['currentTaskId'],rt['id'])

    def test_13_bases_from_other_areas_are_not_called_common(self):
        booking,notify=self.start(['예약','알림'])
        def basis(text):
            if not self.page.locator('#context-panel').is_visible():self.page.locator('#nav-context').click()
            n=len(self.state()['bases']);self.page.locator('#add-basis').evaluate('(e)=>e.open=true')
            self.page.locator('#basis-draft').fill(text);self.page.locator('#basis-form button').click();self.page.wait_for_timeout(50);self.assertEqual(len(self.state()['bases']),n+1)
        self.request_in('예약','예약 화면 만들기',export=False);basis('예약은 하루 전까지만 바꿀 수 있다')
        self.request_in('알림','알림 문자 보내기',export=False);basis('문자는 밤 10시 이후 보내지 않는다')
        self.page.locator('#nav-space').click();self.open_area('알림');box=self.page.locator('#area-bases')
        expect(box.locator('summary')).to_have_text('기준 · 이 영역 2개 · 다른 영역·미분류 기준 2개')  # each area: its request and its recorded basis;box.locator('summary').click()
        expect(box).to_contain_text('문자는 밤 10시');expect(box).not_to_contain_text('하루 전까지만');expect(box).not_to_contain_text('프로젝트 공통')
        expect(box).to_contain_text('합의한 공통 기준이라는 뜻은 아니에요')
        expect(self.page.locator(f'.area-node[data-area-id="{booking}"]')).to_have_count(0)  # area screen, not the map

    def test_14_narrow_screen_finds_and_opens_both_areas_without_scrolling_or_zooming(self):
        self.page.set_viewport_size({'width':390,'height':844})
        booking,notify=self.start(['예약','알림']);stored=self.state()['space']['layout']
        chip=self.page.locator('#map-offscreen');expect(chip).to_be_visible();expect(chip).to_contain_text('화면 밖 영역')
        s0=self.scale();self.assertEqual(s0,1.0,'nothing re-scaled on its own')
        chip.click();expect(chip).to_be_hidden();self.all_cards_inside();self.assertEqual(self.state()['space']['layout'],stored,'fit moves the view only')
        for _ in range(3):self.page.locator('#map-zoom-in').click()
        expect(chip).to_be_visible()
        # The list names the same areas (same IDs) and is not affected by zoom.
        lst=self.page.locator('#area-list');expect(lst).to_be_visible();expect(lst).to_have_attribute('open','')
        ids=self.page.locator('.area-list-row').evaluate_all('(r)=>r.map(e=>e.dataset.areaId)')
        self.assertEqual(sorted(ids),sorted(self.page.locator('.area-node').evaluate_all('(r)=>r.map(e=>e.dataset.areaId)')))
        for _ in range(4):self.page.locator('#map-zoom-out').click()
        box=self.page.locator(f'#list-enter-{notify}').bounding_box();self.assertGreaterEqual(box['height'],40);self.assertGreaterEqual(box['width'],44)
        self.page.locator(f'#list-enter-{notify}').click();expect(self.page.locator('#space-title')).to_have_text('알림')
        self.page.locator('#space-crumb-root').click();self.page.locator(f'#list-info-{booking}').click()
        expect(self.page.locator('#area-panel')).to_be_visible();expect(self.page.locator(f'.area-node[data-area-id="{booking}"]')).to_have_class(re.compile('selected'))
        self.page.locator(f'#area-panel #panel-open').click();expect(self.page.locator('#space-title')).to_have_text('예약')
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.screenshot(path=str(base.OUT/'flow091-map-390.png'))
        self.page.set_viewport_size({'width':1265,'height':712});self.page.locator('#space-crumb-root').click();expect(self.page.locator('#area-list')).to_be_hidden()

    def test_15_back_to_the_map_closes_the_sheet_and_keeps_an_unsaved_draft(self):
        self.page.set_viewport_size({'width':390,'height':844})
        booking,notify=self.start(['예약','알림']);self.page.locator('#map-fit').click()
        self.page.locator(f'#node-info-{booking}').click();expect(self.page.locator('#area-panel')).to_be_visible()
        view=self.page.locator('#space-plane').evaluate('(e)=>e.style.transform')
        self.page.locator('#panel-open').click();self.page.locator('#space-crumb-root').click()
        expect(self.page.locator('#area-panel')).to_be_hidden();expect(self.page.locator('#map-sheet-reopen')).to_have_count(0)
        expect(self.page.locator(f'.area-node[data-area-id="{booking}"]')).to_have_class(re.compile('selected'))
        self.assertEqual(self.page.locator('#space-plane').evaluate('(e)=>e.style.transform'),view,'viewport kept')
        # An unsaved edit: the sheet still closes, the value stays and the sheet can be reopened.
        self.page.locator(f'#node-info-{booking}').click();self.page.locator('#panel-note').fill('아직 못 정한 점: 취소 규칙')
        self.page.locator('#panel-open').click();self.page.locator('#nav-space').click()
        expect(self.page.locator('#area-panel')).to_be_hidden();reopen=self.page.locator('#map-sheet-reopen');expect(reopen).to_be_visible()
        reopen.click();expect(self.page.locator('#area-panel')).to_be_visible();expect(self.page.locator('#panel-note')).to_have_value('아직 못 정한 점: 취소 규칙')
        s=self.state();self.assertEqual(next(a for a in s['space']['areas'] if a['id']==booking)['note'],'','not saved until 반영');self.assertIsNone(s['currentTaskId'])

    # ---------- FLOW091-C: the saved plan reaches the work text as a fixed background copy (real HTTP, MOCK) ----------
    def test_16_background_copy_walkthrough(self):
        calls=[];self.page.on('request',lambda r:calls.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
        booking,notify=self.start(['예약','알림'])
        self.open_area('예약');self.page.locator('#area-edit').evaluate('(e)=>e.open=true')
        self.page.locator('#area-edit-note').fill('날짜와 시간 고르기 · 아직 못 정함: 결제');self.page.locator('#area-edit-save').click()
        self.request_in('예약','A: 예약 화면에서 날짜를 고르게 해줘',export=False);A=self.state()['currentTaskId']
        s=self.state();bg=next(t for t in s['tasks'] if t['id']==A)['background']
        self.assertEqual(bg['brief'],'예약 서비스');self.assertEqual(bg['area'],{'id':booking,'name':'예약','note':'날짜와 시간 고르기 · 아직 못 정함: 결제'})
        self.assertEqual(calls[-1]['background'],bg,'the AI request carries the same copy as its own field')
        self.assertTrue(all('예약 서비스' not in x['text'] for x in calls[-1]['sources']))
        box=self.page.locator('#background-preview');box.locator('summary').click()
        expect(box).to_contain_text('예약 서비스');expect(box).to_contain_text('아직 못 정함: 결제');expect(box).not_to_contain_text('알림')
        md=self.download('#download-work','flow091c-A.md').read_text(encoding='utf-8')
        self.assertIn('## 프로젝트 배경·영역 구상 — 이번 요청 범위와 구분',md);self.assertIn('아직 못 정함: 결제',md);self.assertNotIn('알림',md)
        self.page.locator('#next-preview').click();self.assertIn('아직 못 정함: 결제',self.page.locator('#handoff-text').input_value())
        rec=next(t for t in self.state()['tasks'] if t['id']==A)['handoffs'][-1];self.assertEqual(rec['background'],bg)
        self.assertEqual(len(self.state()['bases']),1,'the background is not recorded as a basis')
        # Edit the plan: A keeps its copy (and says the plan changed since), B gets the latest.
        self.page.locator('#nav-space').click();self.page.locator('#brief-edit > summary').click();self.page.locator('#brief-edit-text').fill('미용실과 네일숍 예약');self.page.locator('#brief-save').click()
        self.page.locator('#nav-work').click();expect(self.page.locator('#background-preview > summary')).to_contain_text('그 뒤 구상이 바뀜')
        expect(box).to_have_attribute('open','');self.page.wait_for_timeout(300);expect(self.page.locator('#background-changed')).to_be_visible()  # the opened preview stays open across views and redraws
        self.assertEqual(next(t for t in self.state()['tasks'] if t['id']==A)['background'],bg)
        self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill('A 보고: 만들었다고 주장');self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        report=self.state()['tasks'][-1];self.assertEqual(report['parentTaskId'],A);self.assertEqual(report['background'],bg)
        self.request_in('알림','B: 알림 문자 보내기',export=False);B=self.state()['tasks'][-1]
        self.assertEqual(B['background']['brief'],'미용실과 네일숍 예약');self.assertEqual(B['background']['area']['name'],'알림');self.assertIsNone(B['background']['area']['note'])
        saved=self.state();self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');self.assertEqual(self.state(),saved)
        backup=json.loads(self.download('#backup','flow091c-backup.json').read_text(encoding='utf-8'))
        self.assertEqual(backup['schemaVersion'],'idea015.project.5');self.assertEqual([t['background'] for t in backup['tasks']],[t['background'] for t in saved['tasks']])

    # ---------- FLOW093-U: the narrow settings sheet scrolls; its fields keep their height (real HTTP) ----------
    def test_17_narrow_sheet_fields_keep_their_height(self):
        self.page.set_viewport_size({'width':390,'height':844})
        booking,notify=self.start(['예약','알림'])
        self.page.locator(f'#list-enter-{booking}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill('예약 화면');self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill('보고: 만들었다고 주장 '*10);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        self.page.locator('#nav-space').click()
        size=lambda sel:self.page.locator(sel).bounding_box()['height']
        self.page.locator(f'#list-info-{booking}').click();panel=self.page.locator('#area-panel');expect(panel).to_be_visible()
        self.assertGreater(panel.evaluate('(e)=>e.scrollHeight-e.clientHeight'),0,'the panel content is taller than the sheet')
        note0,name0=size('#panel-note'),size('#panel-name');self.assertGreaterEqual(note0,80);self.assertGreaterEqual(name0,36)
        long='날짜와 시간을 골라 예약 · 아직 못 정함: 결제 방식과 취소 규칙 '*12
        self.page.locator('#panel-note').fill(long);self.page.locator('#panel-note').focus();self.assertEqual(size('#panel-note'),note0,'focus and long text do not squeeze it')
        self.page.locator('#panel-open').click();self.page.locator('#nav-space').click();expect(panel).to_be_hidden()
        self.page.locator(f'#list-info-{booking}').click();expect(panel).to_be_visible()
        expect(self.page.locator('#panel-note')).to_have_value(long);self.assertEqual(size('#panel-note'),note0);self.assertEqual(size('#panel-name'),name0)
        self.page.locator('#panel-open').scroll_into_view_if_needed();expect(self.page.locator('#panel-open')).to_be_in_viewport()
        self.page.screenshot(path=str(base.OUT/'flow093-sheet-390.png'))
        self.page.set_viewport_size({'width':1265,'height':712});self.assertGreaterEqual(size('#panel-note'),80)

    # ---------- FLOW095: the full handoff shows the current request once; copy, Markdown and preview are the same text ----------
    def test_18_repeated_request_shown_once_and_copy_markdown_preview_match(self):
        req='지도 다중선택·그룹 처리 방식을 검토해 주세요. 코드·실행·배포 변경 없이 선택조건과 보류이유만 제안해 주세요.'
        (booking,)=self.start(['예약']);self.request_in('예약',req);self.request_in('예약',req,export=False)
        s=self.state();self.assertEqual([x['text'] for x in s['sources']],[req,req],'both inputs are stored in full')
        self.page.evaluate('()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:t=>(window.__copied=t,Promise.resolve())},configurable:true})')
        self.page.locator('#copy-work').click();expect(self.page.locator('#notice')).to_contain_text('복사')
        copied=self.page.evaluate('()=>window.__copied')
        md=self.download('#download-work','flow095-handoff.md').read_text(encoding='utf-8')
        self.page.locator('#next-preview').click();preview=self.page.locator('#handoff-text').input_value()
        # Each recorded export advances the project revision, so only the '기준 rN' header line can differ between them.
        import re as _re;body=lambda t:_re.sub(r' / 기준 r\d+\n',' / 기준 r#\n',t,count=1)
        self.assertEqual(body(copied),body(md));self.assertEqual(body(md),body(preview))
        self.assertEqual(md.count(req),1,'one full copy of the request')
        for src in s['sources']:self.assertIn(f"[{src['id']}] 사용자 요청 원문",md)
        for b in s['bases']:self.assertIn(f"[{b['id']}] 요청 원문 · 해석 미확정",md)
        rec=self.state()['tasks'][-1]['handoffs'];self.assertEqual(rec[-1]['chars'],len(md),'the export record describes the text that went out')
        self.assertEqual([x['text'] for x in self.state()['sources']],[req,req])

if __name__=='__main__':unittest.main(verbosity=2)
