"""ENTRY37 first entry: a normal fresh visit opens the project home, and the unsaved space example goes
card -> whole space -> one part -> its work -> back to the space -> closed to the home. Real Chromium -> real local HTTP
-> explicit MOCK on two PCs. Wiring, geometry and storage-boundary checks only; not evidence that people understand it.
"""
import json, re, subprocess, unittest
from playwright.sync_api import expect
import browser as base

WORKSPACE='agentflow.idea015.workspace';MAP_KEY='agentflow.workspace.map';OPEN_KEY='agentflow.workspace.open'
BRIEF='동네 미용실 손님이 휴대폰으로 날짜와 시간을 골라 예약하고, 예약이 확정되면 문자로 안내받는 사이트.'
NO_LOCKS='Object.defineProperty(Navigator.prototype,"locks",{get(){return undefined},configurable:true})'
# Test-only identifiers that must not reach the default screens of the example.
TEST_IDS=re.compile(r'합성|E0\d|검사\s?\d|H_[0-9a-f]{8}|T_[0-9a-f]{8}|A_[0-9a-f]{8}|MOCK 규칙')
subprocess.run(['node',str(base.ROOT/'tests/home15-fixtures.mjs'),str(base.OUT)],check=True)
# ENTRY37-F1: the same card-geometry reader as map-priority36 (every box inside the card and its clips, controls hit).
CARD=r'''id=>{const n=document.querySelector(`.area-node[data-area-id="${id}"]`);if(!n)return null;const c=n.getBoundingClientRect();
 const box=e=>{const r=e.getBoundingClientRect();let l=0,t=0,rr=innerWidth,b=innerHeight;
  for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),q=p.getBoundingClientRect(),sx=q.width/(p.offsetWidth||1),sy=q.height/(p.offsetHeight||1);
   if(/auto|scroll|hidden|clip/.test(s.overflowX)){l=Math.max(l,q.left+p.clientLeft*sx);rr=Math.min(rr,q.left+(p.clientLeft+p.clientWidth)*sx)}
   if(/auto|scroll|hidden|clip/.test(s.overflowY)){t=Math.max(t,q.top+p.clientTop*sy);b=Math.min(b,q.top+(p.clientTop+p.clientHeight)*sy)}}
  const inside=r.width>0&&r.height>0&&r.left>=Math.max(l,c.left)-.5&&r.right<=Math.min(rr,c.right)+.5&&r.top>=Math.max(t,c.top)-.5&&r.bottom<=Math.min(b,c.bottom)+.5;
  const control=e.matches('button'),h=control?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;
  return {sel:e.id||e.className,text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,60),inside,hit:control?!!h&&e.contains(h):null}};
 // WORK41: an idea the card leaves to the panel (data-note=hidden, to keep a long name whole) is skipped here and recorded.
 const parts=[...n.querySelectorAll('.area-card-name,.area-card-path,.area-card-note,.tag,.node-info,.node-enter,.branch-toggle,.branch-signals,.branch-signals>span')].filter(e=>getComputedStyle(e).display!=='none');
 const s=n.querySelector('.branch-signals'),k=c.height/n.offsetHeight,lines=e=>e?Math.round(e.getBoundingClientRect().height/k/parseFloat(getComputedStyle(e).lineHeight)):0;
 return {noteLeftToPanel:n.dataset.note==='hidden',height:n.offsetHeight,left:n.style.left,top:n.style.top,boxes:parts.map(box),text:n.textContent.replace(/\s+/g,' '),
  signal:s?s.textContent.replace(/\s+/g,' ').trim():null,aria:s?.getAttribute('aria-label')??null,band:[...n.querySelectorAll('.area-node-foot>*')].map(e=>e.textContent.trim()),
  nameLines:lines(n.querySelector('.area-card-name')),noteLines:lines(n.querySelector('.area-card-note'))}}'''
# What the work view's notice covers right after continuing: the title must stay readable; text above it is recorded.
COVER=r'''()=>{const n=document.getElementById('notice').getBoundingClientRect(),t=document.getElementById('context-title'),r=t.getBoundingClientRect();
 const h=document.elementFromPoint(r.left+Math.min(r.width/2,40),r.top+r.height/2);
 const under=[...document.querySelectorAll('#work-view p,#work-view h2,#work-view h3,#work-view span,#work-view button')].filter(e=>{const b=e.getBoundingClientRect();
  return b.height>0&&b.bottom>n.top&&b.top<n.bottom&&b.right>n.left&&b.left<n.right&&e.textContent.trim()&&!e.closest('#notice')}).map(e=>e.textContent.trim().slice(0,40));
 return {notice:{top:n.top,bottom:n.bottom},title:{top:r.top,bottom:r.bottom},titleHit:!!h&&t.contains(h),under}}'''
SPACE=r'''()=>{const m=document.getElementById('space-map'),r=m.getBoundingClientRect(),n=document.getElementById('notice'),o=document.getElementById('map-offscreen');
 return {map:{top:r.top,bottom:r.bottom,h:r.height},vh:innerHeight,notice:n.hidden?null:n.textContent,offscreen:!!o&&!o.hidden,
  areas:[...document.querySelectorAll('.area-node')].map(e=>e.dataset.areaId),matrix:document.getElementById('space-plane').style.transform}}'''

class Entry37(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    start_at_home=True # this suite checks the home itself, so setUp does not take '새 프로젝트'
    setUpClass=classmethod(base.Browser.setUpClass.__func__);tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state
    def setUp(self):base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
    def keys(self,page=None):return sorted((page or self.page).evaluate('Object.keys(localStorage)'))
    def raw(self,key=WORKSPACE,page=None):return (page or self.page).evaluate('(k)=>localStorage.getItem(k)',key)
    def session(self,key):return self.page.evaluate('(k)=>sessionStorage.getItem(k)',key)
    def shot(self,name,page=None):(page or self.page).screenshot(path=str(base.OUT/f'entry37-{self.WIDTH}-{name}.png'))
    def box(self,selector):return self.page.locator(selector).evaluate('(e)=>{const b=e.getBoundingClientRect();return {x:b.x,y:b.y,w:b.width,h:b.height,bottom:b.bottom,right:b.right}}')
    def fits(self):self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),self.WIDTH,'no horizontal overflow')
    def install(self,name):
        raw=(base.OUT/f'home15-{name}.json').read_text(encoding='utf-8')
        self.page.evaluate('(raw)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",raw)}',raw)
        self.page.reload();expect(self.page.locator('#projects-view')).to_be_visible();return raw
    def open_example(self,page=None):
        page=page or self.page;page.locator('#example-list .example-open').click()
        expect(page.locator('#example-banner')).to_be_visible();expect(page.locator('#space-view')).to_be_visible()
        expect(page.locator('#space-title')).to_be_focused();expect(page.locator('#saved')).to_have_text('예제 · 저장하지 않음')
    def plane(self):return self.page.locator('#space-plane').evaluate('(e)=>e.style.transform')
    def no_test_ids(self,where):
        text=self.page.locator('main').inner_text();found=TEST_IDS.findall(text)
        self.assertEqual(found,[],f'{where}: no test identifiers on the default screen')

    def test_01_fresh_home_example_space_part_work_and_back(self):
        p=self.page
        expect(p.locator('#projects-view')).to_be_visible();self.assertEqual(p.evaluate('document.body.dataset.route'),'projects')
        expect(p.locator('.project-empty')).to_be_visible();expect(p.locator('#project-list .project-card')).to_have_count(0)
        expect(p.locator('#projects-count')).to_have_text('');expect(p.locator('#list-notice')).to_be_hidden();expect(p.locator('#storage-error')).to_be_hidden()
        card=p.locator('#example-list .example-card');expect(card).to_have_count(1);expect(card).to_be_visible()
        expect(card.locator('.project-card-purpose')).to_have_text(BRIEF);expect(card.locator('.project-card-name')).to_have_text('예제 · 동네 미용실 예약')
        expect(card.locator('.project-card-meta')).to_contain_text('저장 안 됨 · 실제 실행 아님');expect(card.locator('.project-card-meta')).to_contain_text('영역 4개')
        self.assertEqual(card.locator('.project-more,.project-open').count(),0,'the example has no project menu or project open control')
        name=p.locator('#example-list .project-card-name').evaluate('(e)=>Math.round(e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight))')
        self.assertEqual(name,1,'the example name reads on one line');c=self.box('#example-list .example-card');self.assertLessEqual(c['bottom'],self.HEIGHT,'example card in the first screen');self.assertGreaterEqual(c['h'],170)
        self.assertEqual(self.keys(),[],'the home wrote nothing');self.fits();self.shot('1-home')

        self.open_example();self.assertEqual(self.keys(),[])
        expect(p.locator('#nav-space')).to_be_visible();expect(p.locator('#space-brief')).to_have_text(BRIEF)
        expect(p.locator('#example-banner')).to_contain_text('저장되지 않고')
        for name in ['예약하기','알림','시간 고르기','예약 확인']:expect(p.locator(f'.node-enter[aria-label="{name} 영역 열기"]')).to_be_visible()
        # WORK41: the card body selects; '열기' (same label) is its own button, so the path is read from the same card.
        expect(p.locator('.area-node:has(.node-enter[aria-label="시간 고르기 영역 열기"]) .area-card-path')).to_have_text('소속 · 예약하기')
        expect(p.locator('.area-node:has(.node-enter[aria-label="예약하기 영역 열기"]) .area-card-path')).to_have_text('독립 영역')
        self.no_test_ids('space');self.fits();self.shot('2-space');camera=self.plane()

        p.locator('.node-enter[aria-label="시간 고르기 영역 열기"]').click()
        expect(p.locator('#area-tasks')).to_be_visible();expect(p.locator('#space-title')).to_be_focused()
        expect(p.locator('#space-crumb')).to_contain_text('시간 고르기');expect(p.locator('#area-tasks')).to_contain_text('빈 시간')
        expect(p.locator('#space-view')).to_contain_text('영업시간 안의 빈 시간만 고를 수 있게 보여 준다.')
        self.no_test_ids('area');self.fits();self.shot('3-part')

        p.locator('#area-tasks .task-open-link').first.click()
        expect(p.locator('#task-reports')).to_be_visible();expect(p.locator('#task-reports')).to_contain_text('예제 보고 · 실제로 실행한 결과가 아니에요')
        expect(p.locator('#task-view-continue')).to_be_visible();self.no_test_ids('task');self.fits();self.shot('4-task')

        p.locator('#task-view-continue').click()
        expect(p.locator('#work-view')).to_be_visible();expect(p.locator('#current-work')).to_be_visible()
        bar=p.locator('#work-place');expect(bar).to_be_visible();expect(bar).to_contain_text('시간 고르기')
        expect(p.locator('#example-banner')).to_be_visible();self.no_test_ids('work');self.fits();self.shot('5-work');p.evaluate('window.scrollTo(0,0)');self.shot('5-work-top')

        p.locator('#place-space').click()
        expect(p.locator('#space-view')).to_be_visible();expect(p.locator('#space-map')).to_be_visible()
        self.assertEqual(self.plane(),camera,'back at the same map view');self.shot('6-space-again')
        self.assertEqual(self.keys(),[],'nothing from the example is written');self.assertIsNone(self.session(MAP_KEY),'no map memo from the example')

        p.locator('#example-close').click();expect(p.locator('#projects-view')).to_be_visible()
        expect(p.locator('#example-banner')).to_be_hidden();expect(p.locator('#project-list .project-card')).to_have_count(0)
        expect(p.locator('.project-empty')).to_be_visible();self.assertEqual(self.keys(),[]);self.shot('7-closed')

    def test_02_start_my_own_from_the_example_starts_empty(self):
        p=self.page;self.open_example()
        p.locator('.node-enter[aria-label="알림 영역 열기"]').click();expect(p.locator('#area-tasks')).to_be_visible()
        p.locator('#example-start').click();expect(p.locator('#example-banner')).to_be_hidden()
        expect(p.locator('#empty')).to_be_visible();expect(p.locator('#brief-form')).to_be_visible()
        expect(p.locator('#brief-input')).to_have_value('');expect(p.locator('#draft')).to_have_value('');expect(p.locator('#brief-input')).to_be_focused() # WORK41: starts at the purpose
        self.assertEqual(self.keys(),[]);p.evaluate('window.scrollTo(0,0)');self.shot('8-start-own')
        p.locator('#brief-input').fill('동네 빵집 픽업 주문을 받는 사이트');p.locator('#brief-start').click()
        expect(p.locator('#space-view')).to_be_visible();base.saved(p)
        env=json.loads(self.raw());self.assertEqual([(e['origin'],e['state']) for e in env['entries']],[('new','active')])
        s=env['entries'][0]['project'];text=json.dumps(s,ensure_ascii=False)
        self.assertEqual(s['space']['brief']['text'],'동네 빵집 픽업 주문을 받는 사이트')
        self.assertEqual([s['space']['areas'],s['tasks'],s['bases'],s['sources'],s['space']['relations']],[[],[],[],[],[]])
        self.assertIsNone(s['currentTaskId'])
        for word in ['미용실','시간 고르기','예약하기','예제']:self.assertNotIn(word,text)

    def test_03_real_projects_current_draft_seq_and_map_memo_survive_repeated_examples(self):
        p=self.page;raw=self.install('six')
        a=p.locator('#project-list .project-card').filter(has_text='동네 미용실 예약');entry=a.get_attribute('data-entry-id')
        a.locator('.project-open').click();expect(p.locator('#space-map')).to_be_visible()
        p.locator('#map-zoom-in').click();p.locator('#map-zoom-in').click();camera=self.plane()
        memo=json.loads(self.session(MAP_KEY));real=memo['project']
        p.locator('#nav-projects').click();expect(p.locator('#projects-view')).to_be_visible()
        self.assertEqual(self.raw(),raw,'opening and zooming the map wrote nothing')
        # 13 openings: without the guard each would take one of the 12 per-tab memo slots and push the real one out.
        for i in range(13):
            self.open_example()
            if i%4==0:
                p.locator('.node-enter[aria-label="시간 고르기 영역 열기"]').click();expect(p.locator('#area-tasks')).to_be_visible()
                p.locator('#area-tasks .task-open-link').first.click();p.locator('#task-view-continue').click();expect(p.locator('#current-work')).to_be_visible()
                p.locator('#edit-work').evaluate('(e)=>e.open=true');p.locator('#work-next').fill(f'예제에서 고친 문장 {i}')
            p.locator('#example-close').click();expect(p.locator('#projects-view')).to_be_visible()
        expect(p.locator('#project-list .project-card')).to_have_count(6);expect(p.locator('#projects-count')).to_have_text('6')
        self.assertEqual(self.raw(),raw,'every real entry (current task, unsent draft, seq) is byte-identical')
        memos=json.loads(self.session(MAP_KEY));ids={memos['project'],*memos.get('others',{}).keys()}
        self.assertIn(real,ids,'the real project map memo is kept');self.assertEqual(ids,{real},'no example memo was added')
        a.locator('.project-open').click();expect(p.locator('#space-map')).to_be_visible()
        self.assertEqual(self.plane(),camera,'the real project reopens at its own remembered view')
        s=self.state();src=json.loads(raw)['entries'];orig=next(e for e in src if e['entryId']==entry)['project']
        self.assertEqual([s['draft'],s['currentTaskId'],s['tasks'][0]['manual']['next']],[orig['draft'],orig['currentTaskId'],orig['tasks'][0]['manual']['next']])

    def test_04_session_restore_errors_unsupported_and_legacy_keep_their_entry(self):
        p=self.page;self.install('six')
        with self.subTest('valid session restore keeps its place'):
            p.locator('#project-list .project-card').filter(has_text='동네 미용실 예약').locator('.project-open').click()
            p.locator('.node-enter[aria-label="예약 영역 열기"]').click();expect(p.locator('#area-tasks')).to_be_visible()
            p.reload();expect(p.locator('#mode')).to_contain_text('MOCK');expect(p.locator('#projects-view')).to_be_hidden()
            expect(p.locator('#area-tasks')).to_be_visible();expect(p.locator('#breadcrumb-project')).to_have_text('동네 미용실 예약')
        with self.subTest('unreadable saves: a home with the reason, never an empty normal home'):
            p.evaluate('()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace","{broken")}');p.reload()
            expect(p.locator('#projects-view')).to_be_visible();expect(p.locator('#list-notice')).to_contain_text('읽지 못해')
            expect(p.locator('.project-empty')).to_have_count(0);expect(p.locator('#new-project')).to_be_disabled()
            self.open_example();p.locator('#example-close').click();expect(p.locator('#projects-view')).to_be_visible()
            expect(p.locator('#list-notice')).to_contain_text('읽지 못해');self.assertEqual(self.raw(),'{broken');self.shot('9-unreadable')
        with self.subTest('refused storage keeps the in-memory start with its reason'):
            tab=self.ctx.new_page();tab.on('pageerror',lambda e:self.errors.append(str(e)));tab.set_default_timeout(6000)
            tab.add_init_script('Object.defineProperty(window,"localStorage",{get(){throw new DOMException("denied","SecurityError")},configurable:true})')
            tab.goto(self.url);expect(tab.locator('#mode')).to_contain_text('MOCK')
            expect(tab.locator('#empty')).to_be_visible();expect(tab.locator('#storage-error')).to_contain_text('저장소');expect(tab.locator('#projects-view')).to_be_hidden()
            tab.locator('#open-example').click();expect(tab.locator('#space-view')).to_be_visible();tab.locator('#example-close').click()
            expect(tab.locator('#projects-view')).to_be_visible();expect(tab.locator('#list-notice')).to_contain_text('읽지 못해');expect(tab.locator('.project-empty')).to_have_count(0)
            tab.close()
        with self.subTest('without Web Locks a fresh visit keeps the in-memory start and never says saved'):
            ctx=self.browser.new_context(viewport={'width':self.WIDTH,'height':self.HEIGHT});ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(self.url) else (self.external.append(r.request.url),r.abort()))
            tab=ctx.new_page();tab.on('pageerror',lambda e:self.errors.append(str(e)));tab.set_default_timeout(6000);tab.add_init_script(NO_LOCKS)
            tab.goto(self.url);expect(tab.locator('#mode')).to_contain_text('MOCK')
            expect(tab.locator('#empty')).to_be_visible();expect(tab.locator('#projects-view')).to_be_hidden();expect(tab.locator('#storage-error')).to_contain_text('Web Locks')
            tab.locator('#open-example').click();expect(tab.locator('#space-view')).to_be_visible();tab.locator('#example-close').click()
            expect(tab.locator('#empty')).to_be_visible();expect(tab.locator('#projects-view')).to_be_hidden()
            tab.locator('#draft').fill('잠금 없이 쓴 입력');expect(tab.locator('#saved')).to_have_text('저장되지 않은 변경 있음')
            self.assertEqual(self.keys(tab),[]);self.shot('10-no-locks',tab)
            with self.subTest('legacy value without Web Locks: read-only card, remembered on reload, example closes to the home'):
                subprocess.run(['node',str(base.ROOT/'tests/fixtures.mjs'),str(base.OUT)],check=True)
                legacy=(base.OUT/'legacy-68.json').read_text(encoding='utf-8')
                tab.evaluate('(raw)=>localStorage.setItem("agentflow.idea015.project.v1",raw)',legacy);tab.goto(self.url)
                expect(tab.locator('#projects-view')).to_be_visible();expect(tab.locator('.project-card[data-entry-id="legacy"]')).to_be_visible()
                tab.locator('.project-card[data-entry-id="legacy"] .project-open').click();expect(tab.locator('#storage-error')).to_be_visible()
                tab.reload();expect(tab.locator('#mode')).to_contain_text('MOCK');expect(tab.locator('#projects-view')).to_be_hidden()
                self.assertEqual(tab.evaluate('document.documentElement.dataset.entryId'),'legacy')
                tab.locator('#nav-projects').click();self.open_example(tab);tab.locator('#example-close').click()
                expect(tab.locator('#projects-view')).to_be_visible();expect(tab.locator('.project-card[data-entry-id="legacy"]')).to_be_visible()
                self.assertEqual(self.raw('agentflow.idea015.project.v1',tab),legacy);self.assertIsNone(self.raw(WORKSPACE,tab))
            ctx.close()

    # ---------- ENTRY37-F1: the continue notice belongs to the work view it explained ----------
    def space_state(self,label):
        v=self.page.evaluate(SPACE);cards={a:self.page.evaluate(CARD,a) for a in v['areas']}
        rec={'label':label,'width':self.WIDTH,**{k:v[k] for k in ['map','vh','notice','offscreen','matrix']},
             'bad':{a:[b for b in c['boxes'] if not b['inside'] or b['hit'] is False] for a,c in cards.items()},
             'names':{a:c['text'][:24] for a,c in cards.items()},'reasons':{a:c['signal'] for a,c in cards.items()}}
        with open(base.OUT/'entry37-f1-observations.jsonl','a',encoding='utf-8') as fh:fh.write(json.dumps(rec,ensure_ascii=False)+'\n')
        return rec
    def record_cover(self,way,cover):
        with open(base.OUT/'entry37-f1-observations.jsonl','a',encoding='utf-8') as fh:fh.write(json.dumps({'label':f'work-{way}','width':self.WIDTH,**cover},ensure_ascii=False)+'\n')
    def assert_map_room(self,before,after,label):
        self.assertIsNone(after['notice'],f'{label}: the continue notice is not carried onto the map')
        self.assertLessEqual(abs(after['map']['h']-before['map']['h']),1,f'{label}: same available map height as before leaving')
        self.assertLessEqual(after['map']['bottom'],after['vh']+.5,f'{label}: the map frame ends inside the window')
        self.assertFalse(after['offscreen'],f'{label}: no part is pushed off the map')
        self.assertEqual(after['bad'],{a:[] for a in after['bad']},f'{label}: every name, membership, idea, reason and control inside its card and the map clip')
        self.assertEqual([after['names'],after['reasons']],[before['names'],before['reasons']],f'{label}: same names and reasons')
        self.assertEqual(after['matrix'],before['matrix'],f'{label}: same camera (with the checks above, not alone)')
    def continue_from_part(self):
        p=self.page;p.locator('.node-enter[aria-label="시간 고르기 영역 열기"]').click();expect(p.locator('#area-tasks')).to_be_visible()
        p.locator('#area-tasks .task-open-link').first.click();expect(p.locator('#task-view-continue')).to_be_visible()
        p.locator('#task-view-continue').click();expect(p.locator('#current-work')).to_be_visible()
        notice=p.locator('#notice');expect(notice).to_be_visible();expect(notice).to_contain_text('이어가기')
        return notice.inner_text()

    def test_05_the_continue_notice_ends_with_its_work_view_and_never_shrinks_the_map(self):
        p=self.page;self.open_example();before=self.space_state('before')
        self.assertIsNone(before['notice']);self.assertFalse(before['offscreen'])
        self.assertEqual(before['bad'],{a:[] for a in before['bad']},'start: every card part inside');self.shot('11-f1-before')
        # Three real ways back: the work-place crumb, the sidebar, and '출발한 지도 보기로' (back to the part it started from)
        # followed by that screen's own '전체 공간' crumb.
        for way,controls in [('crumb',['#place-space']),('sidebar',['#nav-space']),('origin',['#work-return-origin','#space-crumb-root'])]:
            with self.subTest(way):
                # An unsent draft typed in the work view first (typing ends any earlier notice: existing change() rule).
                draft=f'지도 복귀 뒤에도 남는 초안 · {way}'
                p.locator('#nav-work').click();expect(p.locator('#work-view')).to_be_visible()
                p.locator('#compose-panel').evaluate('(e)=>e.open=true');p.locator('#draft').fill(draft)
                p.locator('#nav-space').click();expect(p.locator('#space-map')).to_be_visible()
                text=self.continue_from_part() # the work view shows its continue notice while it is open
                expect(p.locator('#draft')).to_have_value(draft);self.shot(f'12-f1-work-{way}')
                cover=p.evaluate(COVER);self.record_cover(way,cover)
                with self.subTest(f'{way}: work view under the notice'):
                    self.assertTrue(cover['titleHit'],'the continued work title is not covered by the notice')
                    self.assertEqual(cover['under'],[],'no text or control of the work view (its way back included) under the notice')
                for control in controls:
                    expect(p.locator(control)).to_be_visible();p.locator(control).click()
                    if control=='#work-return-origin':
                        expect(p.locator('#space-view')).to_be_visible();expect(p.locator('#notice')).to_be_hidden() # left the work view
                expect(p.locator('#space-view')).to_be_visible();expect(p.locator('#space-map')).to_be_visible();p.wait_for_timeout(50)
                after=self.space_state(f'after-{way}');self.shot(f'13-f1-after-{way}')
                with self.subTest(f'{way}: map room after the return'):
                    self.assert_map_room(before,after,way);self.assertNotIn(text,p.locator('main').inner_text())
                p.locator('#nav-work').click();expect(p.locator('#current-work')).to_be_visible()
                expect(p.locator('#draft')).to_have_value(draft);expect(p.locator('#notice')).to_be_hidden()
                self.assertEqual(self.keys(),[],'nothing from the example is written');self.assertIsNone(self.session(MAP_KEY))
                p.locator('#nav-space').click();expect(p.locator('#space-map')).to_be_visible()
        p.locator('#example-close').click();expect(p.locator('#projects-view')).to_be_visible()
        expect(p.locator('#project-list .project-card')).to_have_count(0);self.assertEqual(self.keys(),[])
        p.locator('#new-project').click();expect(p.locator('#empty')).to_be_visible();expect(p.locator('#draft')).to_have_value('')
        expect(p.locator('#notice')).to_be_hidden();self.assertEqual(self.keys(),[])

class Entry37Wide(Entry37):
    WIDTH,HEIGHT=1440,900

if __name__=='__main__':unittest.main(verbosity=2)
