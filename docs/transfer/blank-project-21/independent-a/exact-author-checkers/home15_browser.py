"""HOME15: the project home (list) as the first screen, at PC 1280x720 and 1440x900, plus a 390 minimum.
Native Chromium -> real localhost HTTP -> explicit MOCK; no paid AI. Synthetic isolated workspaces only
(tests/home15-fixtures.mjs, built with the app's own domain code; never user data).
Checks: layout numbers of the contract, what each card says (name, purpose = space.brief, never the last request; the time is
named as the work-record time it is), card click / keyboard open -> that project's space (or the existing start path), back to
the list with that card focused, the '더보기' menu never opening a card, and that opening/returning writes nothing.
Every measured value is appended to home15-observations.jsonl before it is asserted. Screens: home15-<w>-<scene>.png.
Follow-up: '이름·목적 전체 보기' in the card's '더보기' opens a read-only window (test_08/09, read-open PNG).
Run from app/: python continuity/tests/home15_browser.py (writes the fixtures first)
"""
import json, subprocess, unittest
from playwright.sync_api import expect
import browser as base

FX=base.OUT
OBS=base.OUT/'home15-observations.jsonl';OBS.write_text('',encoding='utf-8')
subprocess.run(['node',str(base.ROOT/'tests/home15-fixtures.mjs'),str(FX)],check=True)
A_BRIEF='손님이 휴대폰으로 날짜와 시간을 골라 예약하고, 예약하면 문자로 확인을 받는 서비스'
B_BRIEF='매달 모임 날짜를 투표로 정하고 참석자에게 알림을 보내는 웹앱'
LAYOUT_JS='''()=>{const r=e=>{if(!e||!e.getClientRects().length)return null;const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,right:b.right,bottom:b.bottom}};
  const cards=[...document.querySelectorAll('#project-list .project-card')];const cs=e=>getComputedStyle(e);
  const text=document.getElementById('projects-view').innerText;
  return {vw:innerWidth,vh:innerHeight,docWidth:document.documentElement.scrollWidth,sidebar:r(document.querySelector('.sidebar')),topbarShown:!!r(document.querySelector('.topbar')),
    title:r(document.getElementById('projects-title')),titleText:document.getElementById('projects-title').innerText,cta:r(document.getElementById('new-project')),
    mode:r(document.getElementById('connection-details')),modeText:document.getElementById('mode').textContent,
    sidebarCurrent:!!r(document.querySelector('.sidebar-current')),sidebarBottom:!!r(document.querySelector('.sidebar-bottom')),
    myProjectsEyebrow:/MY PROJECTS/.test(text),titleCount:(text.match(/내 프로젝트/g)||[]).length,
    cards:cards.map(c=>({id:c.dataset.entryId,box:r(c),name:(c.querySelector('.project-card-name')||{}).innerText,purpose:(c.querySelector('.project-card-purpose')||{}).innerText,
      missing:!!c.querySelector('.project-card-purpose.missing'),meta:(c.querySelector('.project-card-meta')||{}).innerText,text:c.innerText,
      pad:parseFloat(cs(c).paddingLeft),nameSize:parseFloat(cs(c.querySelector('.project-card-name')).fontSize),
      purposeSize:parseFloat(cs(c.querySelector('.project-card-purpose')).fontSize),metaSize:parseFloat(cs(c.querySelector('.project-card-meta')).fontSize),
      nameLines:Math.round(r(c.querySelector('.project-card-name')).h/parseFloat(cs(c.querySelector('.project-card-name')).lineHeight)),
      purposeLines:Math.round(r(c.querySelector('.project-card-purpose')).h/parseFloat(cs(c.querySelector('.project-card-purpose')).lineHeight)),
      nested:c.querySelectorAll('button button,button a,a button,button summary,summary button').length})),
    tools:r(document.querySelector('.projects-view .list-tools')),listNotice:!document.getElementById('list-notice').hidden}}'''


class Home15(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state
    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
    def record(self,kind,name,value,expected=None):
        rec={'test':self.id().split('.',1)[-1],'width':self.WIDTH,'height':self.HEIGHT,'kind':kind,'name':name,'value':value}
        if kind=='condition':rec['expected']=expected
        with open(OBS,'a',encoding='utf-8') as fh:fh.write(json.dumps(rec,ensure_ascii=False)+'\n')
    def check(self,name,value,expected):self.record('condition',name,value,expected);self.assertEqual(value,expected,name)
    def within(self,name,value,lo,hi):self.record('condition',name,value,[lo,hi]);self.assertTrue(lo<=value<=hi,f'{name}: {value} not in [{lo},{hi}]')
    def shot(self,name):self.page.screenshot(path=str(base.OUT/f'home15-{self.WIDTH}-{name}.png'))
    def install(self,name):
        raw=(FX/f'home15-{name}.json').read_text(encoding='utf-8')
        self.page.evaluate('(raw)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",raw)}',raw)
        self.page.reload();expect(self.page.locator('#projects-view')).to_be_visible();return json.loads(raw)
    def envelope(self):base.saved(self.page);return self.page.evaluate('()=>localStorage.getItem("agentflow.idea015.workspace")')
    def layout(self,name):v=self.page.evaluate(LAYOUT_JS);self.record('actual',name,v);return v
    def card(self,name):return self.page.locator('#project-list .project-card').filter(has_text=name)

    # ---------- layout and information ----------
    def assert_home(self,g,count):
        self.check('sidebar width (kept 222: same in every screen; see REPORT)',g['sidebar']['w'],222)
        self.within('content starts after the sidebar (px)',g['title']['x']-g['sidebar']['right'],24,32)
        self.check('no top bar on the list',g['topbarShown'],False)
        self.check('title once, no MY PROJECTS eyebrow',[g['myProjectsEyebrow'],g['titleCount']],[False,1])
        self.check('no previous-project sidebar text or tutorial on the list',[g['sidebarCurrent'],g['sidebarBottom']],[False,False])
        self.check_true('CTA on the title row, right side',abs((g['cta']['y']+g['cta']['h']/2)-(g['title']['y']+g['title']['h']/2))<6 and g['cta']['x']>g['title']['right'])
        self.check_true('mode fact visible, not the subject',g['mode'] is not None and 'MOCK' in g['modeText'] and g['mode']['h']<=40)
        self.check('no horizontal overflow',g['docWidth']<=g['vw'],True)
        self.check('card count',len(g['cards']),count)
        for c in g['cards']:
            self.within(f'card width {c["id"]}',round(c['box']['w'],1),280,360)
            self.within(f'card height {c["id"]}',round(c['box']['h'],1),170,210)
            self.check(f'card no nested controls {c["id"]}',c['nested'],0)
            self.within('card padding',c['pad'],18,20);self.within('name size',c['nameSize'],16,18);self.within('purpose size',c['purposeSize'],13,14);self.within('meta size',c['metaSize'],12,12)
            self.check_true(f'name/purpose at most 2 lines {c["id"]}',c['nameLines']<=2 and c['purposeLines']<=2,{'name':c['nameLines'],'purpose':c['purposeLines']})
        if g['cards']:
            first=g['cards'][0]['box'];self.within('first card top',round(first['y'],1),100,160)
    def check_true(self,name,value,detail=None):self.record('condition',name,detail if detail is not None else value,True);self.assertTrue(value,name)

    def test_01_six_projects_three_columns_and_honest_cards(self):
        self.install('six');g=self.layout('six');self.assert_home(g,6)
        xs=sorted({round(c['box']['x']) for c in g['cards']});ys=sorted({round(c['box']['y']) for c in g['cards']})
        self.check('3 columns x 2 rows',[len(xs),len(ys)],[3,2])
        gap=g['cards'][1]['box']['x']-g['cards'][0]['box']['right'];self.within('column gap',round(gap,1),16,20)
        self.within('row gap',round(g['cards'][3]['box']['y']-g['cards'][0]['box']['bottom'],1),16,20)
        by={c['name'].split('\n')[0][:8]:c for c in g['cards']}
        a=next(c for c in g['cards'] if c['name']=='동네 미용실 예약')
        self.check('A purpose is its brief',a['purpose'],A_BRIEF)
        self.check_true('A meta names the work-record time and areas',a['meta'].startswith('작업 기록 · ') and '영역 2개' in a['meta'],a['meta'])
        self.check_true('A card shows no request text, counts, or old buttons',all(x not in a['text'] for x in ['예약 확정 문구','마지막 요청','요청 1개','이어서 하기','휴지통으로']),a['text'])
        d=next(c for c in g['cards'] if c['name']=='사내 문의 접수 페이지')
        self.check('D without purpose says so',[d['purpose'],d['missing']],['목적을 아직 적지 않았어요',True])
        self.check_true('D: its request is not shown as the purpose',('첨부 파일' not in d['text']),d['text'])
        long=next(c for c in g['cards'] if c['name'].startswith('지역 소상공인'))
        self.check('long title and purpose clamp to 2 lines',[long['nameLines'],long['purposeLines']],[2,2])
        e=next(c for c in g['cards'] if c['name']=='가계부 정리 도구')
        self.check('E: brief only, no work record (not called an edit time)',e['meta'],'작업 기록 없음')
        self.check('newest work record first',g['cards'][0]['name'],'동네 미용실 예약')
        self.check_true('secondary tools reachable in the first screen',g['tools']['bottom']<=g['vh'],g['tools'])
        self.shot('six')

    def test_02_one_and_zero(self):
        self.install('one');g=self.layout('one');self.assert_home(g,1)
        self.check_true('one card keeps the block width (not a full row)',g['cards'][0]['box']['w']<=360);self.shot('one')
        self.install('zero');g=self.layout('zero');self.assert_home(g,0)
        expect(self.page.locator('.project-empty')).to_have_text('아직 프로젝트가 없어요. ‘새 프로젝트’로 바로 시작하거나 아래에서 예제를 둘러보세요.')
        expect(self.page.locator('#trash-section')).to_be_visible();expect(self.page.locator('#projects-count')).to_have_text('')
        self.check('nothing written for the empty list',json.loads(self.envelope())['entries'][0]['state'],'trashed');self.shot('zero')
        # A real empty workspace still starts at the existing new-project path; the list is reachable and stays empty.
        self.page.evaluate('()=>{localStorage.clear();sessionStorage.clear()}');self.page.reload();expect(self.page.locator('#empty')).to_be_visible()
        self.page.locator('#nav-projects').click();expect(self.page.locator('.project-empty')).to_be_visible()
        self.check('no placeholder project saved',self.page.evaluate('()=>localStorage.getItem("agentflow.idea015.workspace")'),None)

    # ---------- entering, coming back ----------
    def open_and_check(self,name,brief,manual,draft,before):
        expect(self.page.locator('#space-view')).to_be_visible();expect(self.page.locator('#space-brief')).to_have_text(brief)
        expect(self.page.locator('#breadcrumb-project')).to_have_text(name);expect(self.page.locator('#space-title')).to_be_focused()
        s=self.state();self.check(f'{name}: manual line kept',s['tasks'][0]['manual']['next'],manual);self.check(f'{name}: unsent draft kept',s['draft'],draft)
        self.check(f'{name}: opening wrote nothing',self.envelope(),before)
    def back(self,name):
        self.page.locator('#nav-projects').click();expect(self.page.locator('#projects-view')).to_be_visible()
        expect(self.card(name).locator('.project-open')).to_be_focused()

    def test_03_A_B_click_and_keyboard_enter_their_own_space_and_return(self):
        env=self.install('ab');before=self.envelope();cur={e['project']['name']:e['project']['currentTaskId'] for e in env['entries']}
        self.card('동네 미용실 예약').locator('.project-card-purpose').click()
        self.open_and_check('동네 미용실 예약',A_BRIEF,'A 수동 문장: 확정 문구만 바꾸고 예약 흐름은 그대로 둔다','A 미전송 초안: 취소 안내 문구도 볼 것',before)
        self.check('A: current task unchanged',self.state()['currentTaskId'],cur['동네 미용실 예약']);self.shot('A-space')
        self.back('동네 미용실 예약')
        # Keyboard only: from A's focused card, Tab past A's menu to B, Enter.
        self.page.keyboard.press('Tab');expect(self.card('동네 미용실 예약').locator('.project-more-button')).to_be_focused()
        self.page.keyboard.press('Tab');expect(self.card('독서 모임 일정 도우미').locator('.project-open')).to_be_focused();self.page.keyboard.press('Enter')
        self.open_and_check('독서 모임 일정 도우미',B_BRIEF,'B 수동 문장: 마감 시간은 모임장만 바꾼다','B 미전송 초안: 마감 알림 시각',before)
        expect(self.page.locator('#space-view')).not_to_contain_text('A 수동 문장');expect(self.page.locator('#space-view')).not_to_contain_text('미용실')
        self.back('독서 모임 일정 도우미');self.check('round trips wrote nothing',self.envelope(),before)

    def test_04_list_goes_to_the_space_not_the_last_task_screen_and_keeps_the_map_view(self):
        self.install('ab');a=self.card('동네 미용실 예약')
        a.locator('.project-open').click();expect(self.page.locator('#space-map')).to_be_visible()
        before=self.envelope()
        # Leave A on its read-only task screen (the per-tab place says 'task'), with the map zoomed by the user first.
        self.page.locator('#map-zoom-in').click();self.page.wait_for_timeout(50)
        t0=self.page.locator('#space-plane').evaluate('(e)=>e.style.transform')
        area=self.state()['space']['areas'][0]['id'];self.page.locator(f'#node-enter-{area}').click()
        self.page.locator('.task-open-link').first.click();expect(self.page.locator('#space-crumb')).to_contain_text('작업')
        self.back('동네 미용실 예약')
        self.card('독서 모임 일정 도우미').locator('.project-open').click();expect(self.page.locator('#space-map')).to_be_visible();self.back('독서 모임 일정 도우미')
        self.card('동네 미용실 예약').locator('.project-open').click()
        expect(self.page.locator('#space-crumb')).to_contain_text('전체 공간');expect(self.page.locator('#space-map')).to_be_visible()
        self.check('A map view reused after visiting B (no fit over it)',self.page.locator('#space-plane').evaluate('(e)=>e.style.transform'),t0)
        self.check('nothing written by looking around',self.envelope(),before)
        # A reload still keeps this tab's place (existing behavior).
        self.page.locator(f'#node-enter-{area}').click();self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK')
        expect(self.page.locator('#space-crumb')).to_contain_text('예약')

    def test_05_more_menu_never_opens_the_card_and_trash_keeps_its_protection(self):
        self.install('six');a=self.card('동네 미용실 예약');more=a.locator('.project-more-button')
        more.click();menu=a.locator('.project-more-menu');expect(menu).to_be_visible();expect(self.page.locator('#projects-view')).to_be_visible()
        box=menu.bounding_box();self.page.mouse.click(box['x']+box['width']/2,box['y']+3) # the menu's own top padding (corners are rounded)
        expect(menu).to_be_visible()
        expect(self.page.locator('#projects-view')).to_be_visible()
        self.page.keyboard.press('Escape');expect(menu).to_be_hidden();expect(more).to_be_focused()
        more.click();self.card('독서 모임 일정 도우미').locator('.project-card-purpose').click() # outside click: only closes
        expect(menu).to_be_hidden();expect(self.page.locator('#projects-view')).to_be_visible()
        before=self.envelope()
        more.click();self.page.once('dialog',lambda d:(self.assertIn('휴지통으로 옮길까요',d.message),d.dismiss()));a.locator('.project-trash').click()
        expect(self.page.locator('#projects-view')).to_be_visible();expect(self.page.locator('#project-list .project-card')).to_have_count(6)
        expect(menu).to_be_hidden();expect(more).to_be_focused();self.check('declined trash wrote nothing',self.envelope(),before)
        more.click();self.page.once('dialog',lambda d:d.accept());a.locator('.project-trash').click()
        expect(self.page.locator('#list-notice')).to_contain_text('휴지통으로 옮겼어요');expect(self.page.locator('#project-list .project-card')).to_have_count(5)
        self.page.locator('#undo-trash').click();expect(self.page.locator('#project-list .project-card')).to_have_count(6)
        # Keyboard: Enter on the menu button opens the menu, not the project.
        self.card('독서 모임 일정 도우미').locator('.project-more-button').focus();self.page.keyboard.press('Enter')
        expect(self.card('독서 모임 일정 도우미').locator('.project-more-menu')).to_be_visible();expect(self.page.locator('#projects-view')).to_be_visible()

    def test_06_projects_without_a_space_use_the_existing_start_path(self):
        self.install('six')
        self.card('사내 문의 접수 페이지').locator('.project-open').click();expect(self.page.locator('#work-view')).to_be_visible()
        expect(self.page.locator('#space-view')).to_be_hidden();self.back('사내 문의 접수 페이지')
        self.card('포트폴리오 사이트').locator('.project-open').click();expect(self.page.locator('#work-view')).to_be_visible()
        expect(self.page.locator('#draft')).to_have_value('아직 보내지 않은 첫 요청 초안')

    def test_07_read_error_is_shown_not_hidden(self):
        self.page.evaluate('()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace","{broken")}')
        self.page.reload();expect(self.page.locator('#list-notice')).to_contain_text('읽지 못해');expect(self.page.locator('#new-project')).to_be_disabled()
        self.check('unreadable list left as it was',self.page.evaluate('()=>localStorage.getItem("agentflow.idea015.workspace")'),'{broken')


    # ---------- HOME15 follow-up: full name and purpose before entering ----------
    def visible_text(self,el_id,needle):
        """Real visibility of a text part: its rects lie inside the dialog body's visible box and hit-test to the element."""
        return self.page.evaluate("""([id,needle])=>{const el=document.getElementById(id),t=el.firstChild;if(!t)return {found:false};
          const i=t.textContent.indexOf(needle);if(i<0)return {found:false};const r=document.createRange();r.setStart(t,i);r.setEnd(t,i+needle.length);
          const b=r.getBoundingClientRect(),v=document.getElementById('project-read-body').getBoundingClientRect(),x=b.left+Math.min(b.width/2,8),y=b.top+b.height/2;
          const h=document.elementFromPoint(x,y);
          return {found:true,inside:b.top>=v.top-1&&b.bottom<=v.bottom+1&&b.left>=v.left-1&&b.right<=v.right+1,hit:!!h&&(h===el||el.contains(h)),rect:[b.left,b.top,b.right,b.bottom],body:[v.left,v.top,v.right,v.bottom]}}""",[el_id,needle])
    def dialog_geom(self):
        return self.page.evaluate("""()=>{const d=document.getElementById('project-read'),b=document.getElementById('project-read-body'),r=d.getBoundingClientRect();
          return {open:d.open,rect:[r.left,r.top,r.right,r.bottom],vw:innerWidth,vh:innerHeight,bodyScroll:b.scrollTop,bodyOverflowX:b.scrollWidth-b.clientWidth,
            canScroll:b.scrollHeight>b.clientHeight,docWidth:document.documentElement.scrollWidth,active:document.activeElement&&(document.activeElement.id||document.activeElement.className),
            inDialog:d.contains(document.activeElement),route:document.body.dataset.route,winY:scrollY}}""")
    def read_card(self,name):return self.page.locator('#project-list .project-card').filter(has=self.page.locator('.project-card-name',has_text=name))
    def envelope_project(self,name_part):
        return next(e['project'] for e in json.loads(self.envelope())['entries'] if name_part in e['project']['name'])
    def page_scroll_phase(self,label):
        """Read-only facts: distinguish pointer/focus/opening movement from a later native key's background scroll."""
        value=self.page.evaluate('''()=>{const d=document.getElementById('project-read'),b=document.getElementById('project-read-body');
          return {time:performance.now(),y:scrollY,max:Math.max(0,document.documentElement.scrollHeight-innerHeight),open:d.open,
            active:document.activeElement&&(document.activeElement.id||document.activeElement.className),bodyY:b.scrollTop,
            bodyMax:Math.max(0,b.scrollHeight-b.clientHeight),route:document.body.dataset.route}}''')
        self.record('actual','HOME15 page scroll phase: '+label,value);return value

    def test_08_read_full_name_and_purpose_before_entering(self):
        self.install('read');before=self.envelope();alerts=[];self.page.on('dialog',lambda d:(alerts.append(d.message),d.dismiss()))
        a=self.read_card('강남 지점');b=self.read_card('마포 지점')
        self.check('card keeps its 2-line clamp (suffix cut on the card)',a.locator('.project-card-name').evaluate('(e)=>e.scrollHeight>e.clientHeight+1'),True)
        a.scroll_into_view_if_needed();self.page.mouse.wheel(0,120);self.page.wait_for_timeout(150);y0=self.page.evaluate('scrollY')
        self.check_true('list scrolled before opening',y0>0,y0)
        self.page_scroll_phase('A before native menu click');a.locator('.project-more-button').click()
        self.page_scroll_phase('A menu open, immediately before native read click');a.locator('.project-read-open').click()
        self.page_scroll_phase('A immediately after native read click')
        g=self.dialog_geom();self.record('actual','A opened',g)
        self.check('opened by click: dialog open, menu closed, still the list',[g['open'],a.locator('.project-more').evaluate('e=>e.open'),g['route']],[True,False,'projects'])
        self.check('focus starts at the top of the text (name first)',[g['active'],g['bodyScroll']],['project-read-body',0])
        full=self.envelope_project('강남 지점')
        self.check('A full name',self.page.locator('#project-read-name').text_content(),full['name'])
        self.check('A full purpose (plain text)',self.page.locator('#project-read-purpose').text_content(),full['space']['brief']['text'])
        v=self.visible_text('project-read-name','· 강남 지점');self.check_true('A name suffix actually visible',v['inside'] and v['hit'],v)
        self.check_true('long purpose scrolls inside the window, no sideways overflow',g['canScroll'] and g['bodyOverflowX']<=0 and g['docWidth']<=g['vw'],g)
        self.check_true('window inside the viewport',g['rect'][0]>=0 and g['rect'][2]<=g['vw'] and g['rect'][1]>=0 and g['rect'][3]<=g['vh'],g['rect'])
        self.shot('read-open')
        end=self.visible_text('project-read-purpose','강남 지점은 현장 결제만');self.check('purpose end not visible before scrolling',end['inside'],False)
        # Keyboard only: PageDown steps through the text, End reaches the distinguishing end, Home goes back to the name.
        tops=[]
        for _ in range(2):
            self.page_scroll_phase(f'A before PageDown {_+1}');self.page.keyboard.press('PageDown');self.page_scroll_phase(f'A immediately after PageDown {_+1}')
            self.page.wait_for_timeout(150);tops.append(self.dialog_geom()['bodyScroll']);self.page_scroll_phase(f'A existing PageDown observation {_+1}')
        self.check_true('PageDown scrolls the text (it may already reach the end)',tops[0]>0 and tops[1]>=tops[0],tops)
        self.page_scroll_phase('A before End');self.page.keyboard.press('End');self.page_scroll_phase('A immediately after End')
        self.page.wait_for_timeout(250);end=self.visible_text('project-read-purpose','강남 지점은 현장 결제만');self.page_scroll_phase('A existing End observation')
        self.check_true('End: purpose end actually visible',end['inside'] and end['hit'],end)
        self.page_scroll_phase('A before Home');self.page.keyboard.press('Home');self.page_scroll_phase('A immediately after Home')
        self.page.wait_for_timeout(250);v=self.visible_text('project-read-name','· 강남 지점');self.page_scroll_phase('A existing Home observation')
        self.check_true('Home: back to the full name',v['inside'] and v['hit'],v)
        box=self.page.locator('#project-read-body').bounding_box();self.page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2)
        for _ in range(30):self.page.mouse.wheel(0,400)
        self.page.wait_for_timeout(200);end=self.visible_text('project-read-purpose','강남 지점은 현장 결제만')
        self.page_scroll_phase('A existing native wheel observation')
        self.check_true('wheel: purpose end visible after scrolling inside',end['inside'] and end['hit'],end)
        self.check('background list did not scroll',round(self.page.evaluate('scrollY')),round(y0))
        self.page.locator('#project-read-name').click(click_count=3)
        self.check_true('name selectable as text','강남 지점' in self.page.evaluate('getSelection().toString()'))
        trail=[]
        for key in ['Tab','Tab','Tab','Shift+Tab','Shift+Tab','Shift+Tab']:
            self.page_scroll_phase('A before '+key);self.page.keyboard.press(key);trail.append(self.dialog_geom()['inDialog']);self.page_scroll_phase('A immediately after '+key)
        self.check('Tab/Shift+Tab never reach the background',trail,[True]*6)
        self.page_scroll_phase('A before Escape');self.page.keyboard.press('Escape');self.page_scroll_phase('A immediately after Escape');g=self.dialog_geom()
        self.check('Escape closes, list stays at the same scroll',[g['open'],g['route'],round(g['winY'])],[False,'projects',round(y0)])
        expect(a.locator('.project-more-button')).to_be_focused();self.check('reading wrote nothing',self.envelope(),before)
        # B by keyboard only: Enter on its menu button, Tab to the item, Space.
        b.locator('.project-more-button').focus();self.page.keyboard.press('Enter');self.page.keyboard.press('Tab')
        expect(b.locator('.project-read-open')).to_be_focused();self.page.keyboard.press('Space')
        g=self.dialog_geom();self.check('B opened by Space, body back at the top',[g['open'],g['bodyScroll']],[True,0])
        expect(self.page.locator('#project-read')).not_to_contain_text('강남');expect(self.page.locator('#project-read-name')).to_contain_text('· 마포 지점')
        self.page.keyboard.press('Tab');expect(self.page.locator('#project-read-close')).to_be_focused();self.page.keyboard.press('Enter')
        expect(self.page.locator('#project-read')).not_to_be_visible();expect(b.locator('.project-more-button')).to_be_focused()
        # HTML-like characters and a long unbroken string: text, not markup; no overflow.
        c=self.read_card('표시 시험');c.locator('.project-more-button').click();c.locator('.project-read-open').click()
        self.check('name shown literally',self.page.locator('#project-read-name').text_content(),'<b>굵게</b> & "따옴표" <script>x</script> 표시 시험')
        self.check('no markup created',self.page.locator('#project-read img, #project-read b, #project-read script').count(),0)
        g=self.dialog_geom();self.check_true('no horizontal overflow with a long unbroken string',g['bodyOverflowX']<=0 and g['docWidth']<=g['vw'],g)
        self.page.locator('#project-read-close').click()
        # No purpose: says so, never the request.
        d=self.read_card('목적 없음');d.locator('.project-more-button').click();d.locator('.project-read-open').click()
        expect(self.page.locator('#project-read-purpose')).to_have_text('목적을 아직 적지 않았어요');expect(self.page.locator('#project-read')).not_to_contain_text('첨부 파일')
        self.page.mouse.click(5,5) # the backdrop
        expect(self.page.locator('#project-read')).not_to_be_visible();expect(d.locator('.project-more-button')).to_be_focused()
        self.check('no script ran, all reads wrote nothing',[alerts,self.page.title().startswith('XSS'),self.envelope()==before],[[],False,True])
        # The usual entry still works from the same card.
        a.locator('.project-card-purpose').click();expect(self.page.locator('#space-view')).to_be_visible()

    def test_09_another_tab_changes_while_reading(self):
        self.install('read');a=self.read_card('강남 지점')
        a.locator('.project-more-button').click();a.locator('.project-read-open').click();expect(self.page.locator('#project-read')).to_be_visible()
        other=self.ctx.new_page();other.goto(self.url);expect(other.locator('#projects-view')).to_be_visible()
        oa=other.locator('#project-list .project-card').filter(has=other.locator('.project-card-name',has_text='강남 지점'))
        other.once('dialog',lambda d:d.accept());oa.locator('.project-more-button').click();oa.locator('.project-trash').click()
        expect(other.locator('#list-notice')).to_contain_text('휴지통으로 옮겼어요');base.saved(other);after_trash=self.envelope();other.close()
        self.page.locator('#project-read-close').click();expect(a.locator('.project-more-button')).to_be_focused()
        self.check('closing a stale window saves nothing',self.envelope(),after_trash)
        # The stale card shows no reading, and nothing is attached to another card.
        a.locator('.project-more-button').click();a.locator('.project-read-open').click()
        expect(self.page.locator('#project-read')).not_to_be_visible();expect(self.page.locator('#list-notice')).to_contain_text('다른 탭에서 바뀌어')
        expect(self.page.locator('#projects-title')).to_be_focused();self.check('still nothing saved',self.envelope(),after_trash)
        # A purpose changed elsewhere is read fresh when the window opens (not the old list text).
        raw=json.loads(self.envelope());e=next(x for x in raw['entries'] if '마포 지점' in x['project']['name'])
        e['project']['space']['brief']['text']='다른 탭에서 바꾼 목적 · 마포 끝';self.page.evaluate('(r)=>localStorage.setItem("agentflow.idea015.workspace",r)',json.dumps(raw,ensure_ascii=False))
        b=self.read_card('마포 지점');b.locator('.project-more-button').click();b.locator('.project-read-open').click()
        expect(self.page.locator('#project-read-purpose')).to_have_text('다른 탭에서 바꾼 목적 · 마포 끝')
        self.page.keyboard.press('Escape');self.check('nothing written back by this tab',json.loads(self.envelope()),raw)

    def test_10_no_background_key_scroll_from_any_focus_in_the_window(self):
        """fix2: independent run found PageDown/End on '닫기' scrolling the list behind (1280 0->272, 1440 0->92)."""
        self.install('read');a=self.read_card('강남 지점')
        a.locator('.project-more-button').click();a.locator('.project-read-open').click();expect(self.page.locator('#project-read')).to_be_visible()
        y_open=round(self.page.evaluate('scrollY'))
        for start in [0,'end']: # the test itself moves the page (not a user path) to try both directions
            self.page.evaluate('(t)=>scrollTo({top:t==="end"?document.documentElement.scrollHeight:0})',start);self.page.wait_for_timeout(100)
            y=round(self.page.evaluate('scrollY'));self.page.locator('#project-read-close').focus();expect(self.page.locator('#project-read-close')).to_be_focused()
            ys=[]
            for key in ['PageDown','End','ArrowDown','PageUp','Home','ArrowUp']:self.page.keyboard.press(key);self.page.wait_for_timeout(120);ys.append(round(self.page.evaluate('scrollY')))
            self.check(f'list behind does not move with keys on 닫기 (start {start}, Y {y})',ys,[y]*6)
            self.page.locator('#project-read-title').click() # focus leaves the controls (dialog itself)
            for key in ['PageDown','End','Home']:self.page.keyboard.press(key);self.page.wait_for_timeout(120);ys.append(round(self.page.evaluate('scrollY')))
            self.check(f'nor with focus on the window itself (start {start})',ys[-3:],[y]*3)
            self.check('window still open',self.dialog_geom()['open'],True)
        y=round(self.page.evaluate('scrollY'))
        # The text is still read to its end by keyboard, and Space on 닫기 still closes.
        self.page.keyboard.press('Tab');self.page.keyboard.press('Tab')
        if self.dialog_geom()['active']!='project-read-body':self.page.locator('#project-read-body').focus()
        self.page_scroll_phase('body End: focus established before synthetic background setup')
        # Existing test_10 already positions the background programmatically at its two ends. This labelled setup
        # additionally places it in the actual middle AFTER focus, so End cannot pass just because the page is at max.
        middle=self.page.evaluate('''()=>{const max=Math.max(0,document.documentElement.scrollHeight-innerHeight),before=scrollY;
          scrollTo({top:max/2,behavior:'instant'});return {before,y:scrollY,max,setup:'synthetic background positioning, not a user path'}}''')
        self.record('fixture','body End background has real room in both directions',middle)
        self.check_true('body End starts strictly between page limits',0<middle['y']<middle['max'],middle);y=round(middle['y'])
        key_start=self.page_scroll_phase('body End: actual middle immediately before native key')
        self.check_true('body End has text left to scroll',key_start['bodyY']<key_start['bodyMax'],key_start)
        self.page.keyboard.press('End');self.page_scroll_phase('body End: immediately after native key')
        self.page.wait_for_timeout(250);end=self.visible_text('project-read-purpose','강남 지점은 현장 결제만');self.page_scroll_phase('body End: existing final observation')
        self.check_true('End in the text still reaches the end',end['inside'] and end['hit'],end)
        self.check('text keys do not move the list either',round(self.page.evaluate('scrollY')),y)
        self.page.keyboard.press('Tab');expect(self.page.locator('#project-read-close')).to_be_focused();self.page.keyboard.press('Space')
        expect(self.page.locator('#project-read')).not_to_be_visible();expect(a.locator('.project-more-button')).to_be_focused()
        self.check('Space on 닫기 closes, list back where the window was opened',round(self.page.evaluate('scrollY')),y_open)

class Home15Wide(Home15):
    WIDTH,HEIGHT=1440,900


class Home15Narrow(unittest.TestCase):
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state
    def setUp(self):base.Browser.setUp(self);self.page.set_viewport_size({'width':390,'height':844})
    def test_390_minimum(self):
        raw=(FX/'home15-six.json').read_text(encoding='utf-8')
        self.page.evaluate('(raw)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",raw)}',raw);self.page.reload()
        expect(self.page.locator('#projects-view')).to_be_visible();self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        for b in ['#new-project','.project-more-button >> nth=0']:
            box=self.page.locator(b).bounding_box();self.assertGreaterEqual(min(box['width'],box['height']),32)
        self.page.screenshot(path=str(base.OUT/'home15-390-six.png'),full_page=True)
        first=self.page.locator('.project-card').first;first.locator('.project-more-button').click();first.locator('.project-read-open').click()
        r=self.page.locator('#project-read').bounding_box();self.assertGreaterEqual(r['x'],0);self.assertLessEqual(r['x']+r['width'],390)
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390);self.page.keyboard.press('Escape')
        first.locator('.project-card-purpose').click();expect(self.page.locator('#space-view')).to_be_visible()


if __name__=='__main__':unittest.main(verbosity=2)
