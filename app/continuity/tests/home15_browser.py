"""HOME15: the project home (list) as the first screen, at PC 1280x720 and 1440x900, plus a 390 minimum.
Native Chromium -> real localhost HTTP -> explicit MOCK; no paid AI. Synthetic isolated workspaces only
(tests/home15-fixtures.mjs, built with the app's own domain code; never user data).
Checks: layout numbers of the contract, what each card says (name, purpose = space.brief, never the last request; the time is
named as the work-record time it is), card click / keyboard open -> that project's space (or the existing start path), back to
the list with that card focused, the '더보기' menu never opening a card, and that opening/returning writes nothing.
Every measured value is appended to home15-observations.jsonl before it is asserted. Screens: home15-<w>-<scene>.png.
Run from app/: node continuity/tests/home15-fixtures.mjs continuity/test-results && python continuity/tests/home15_browser.py
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
        self.page.locator('.project-card').first.locator('.project-card-purpose').click();expect(self.page.locator('#space-view')).to_be_visible()


if __name__=='__main__':unittest.main(verbosity=2)
