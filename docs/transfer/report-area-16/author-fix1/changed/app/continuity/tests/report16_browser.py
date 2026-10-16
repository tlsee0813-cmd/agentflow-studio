"""REPORT16: native Chromium -> real localhost HTTP -> explicit MOCK; no paid AI, no external tool.
The existing read-only task screen (renderTaskView) now reads the area's CURRENT idea (Area.note, via areaIdea) beside the report
the user explicitly picks from this request's return path (rootRequest/pointedReturn, nested follow-up reports included), with
one next action named by what it really does: a new request in this area, or the unsent input opened as it is. The existing
continue (edit this task) stays a separate, secondary action. Back to the starting map/area view via the existing origin.

Fixture (isolated, installed through the product UI; labelled):
- REAL_R1 is a Korean restatement (not a quote) of a public PowerToys PR #51150 review reply (GitHub comment 4257710120,
  2026-10-13 10:51:30 UTC, in reply to 4255501266; it names commit a964f08cc6fbecb3b9f9d4fe6c1d7481330c7938). It is the author's
  claim, not run or verified by the app or the coordinator; no person's name is copied. It arrives as a result file with a
  SYNTHETIC evidence part (two sources on one report task).
- OLD_IDEA / CUR_IDEA / REQ_* / LONG_R2 / RB / FOLLOW are synthetic. CUR_IDEA is not a PowerToys requirement.
Operations under test are real click/key/wheel/pointer; nothing assigns app state. Each condition (expected vs value) and raw
page snapshot is written to report16-observations.jsonl before its assertion. Wiring and geometry, not usability.
Run from app/: python continuity/tests/report16_browser.py
"""
import json, unittest
from playwright.sync_api import expect
import browser as base

AREA,OTHER='검색으로 키 선택','알림 설정'
OLD_IDEA='[합성 · 당시 구상] 검색어로 키를 찾는다. Enter를 누를 때의 처리 방식은 아직 못 정함.'
CUR_IDEA='[합성 구상] 검색어를 제출해도 키를 바로 확정하지 않는다. 후보만 좁히고 사용자가 목록에서 명시적으로 고른 뒤 확정한다.'
REQ_A='[합성] 키 검색 상자에서 f10처럼 검색어를 입력하고 Enter를 눌렀을 때의 동작을 정리해 주세요.'
REAL_R1=('[실제 보고 재서술 · 작성자 주장] a964f08cc6에서 수정했다. '
         '제출된 검색어를 공통 필터 함수로 동기 처리하게 바꿔, f10 입력 직후 Enter를 누르면 F10이 선택된다.')
EVID_R1='[합성 관찰 · 시험용] 이 앱은 PowerToys를 실행하지 않았어요. 원문 두 개 확인용 ZZ-EVID-R1'
LONG_R2='\n'.join(['[합성 후속 보고 · 시험용] 후속 확인 결과를 적었다고 주장합니다. ZZ-HEAD-R2']+
                  [f'{i}번째 줄: 검색 후보 목록과 Enter 처리 순서에 대한 긴 설명이 이어집니다. 실제로 확인한 것은 아닙니다.' for i in range(2,15)]+['끝 문장 ZZ-END-R2'])
REQ_B='[합성 요청] 알림 문구에 예약 시간을 넣어 주세요.'
RB='[합성 다른 요청의 보고] 알림 문구를 바꿨다고 주장 ZZ-RB'
FOLLOW='[합성 후속 요청 · 미전송] 시험 조건을 유지하려면 Enter 확정 동작을 어떻게 조정할지 제안해 달라.'
WORK_KEYS=['understanding','scope','next','checks']
OBS=base.OUT/'report16-observations.jsonl';OBS.write_text('',encoding='utf-8')
SNAP_JS='''(area)=>{const p=document.getElementById('space-plane'),n=area&&document.querySelector(`.area-node[data-area-id="${area}"]`),a=document.activeElement;
  const r=n?n.getBoundingClientRect():null;
  return {windowY:window.scrollY,styleTransform:p?p.style.transform:null,computedTransform:p?getComputedStyle(p).transform:null,
    cardRect:r&&{x:Math.round(r.x*10)/10,y:Math.round(r.y*10)/10,w:r.width},selected:(document.querySelector('.area-node.selected')||{dataset:{}}).dataset.areaId||null,
    scaleLabel:(document.getElementById('map-scale')||{}).textContent||null,focusId:a&&a.id,
    openDetails:[...document.querySelectorAll('#space-view details[id]')].filter(d=>d.open).map(d=>d.id)}}'''
# Where the current idea's text, the picked report's text and the next action are, in the viewport, measured as rendered.
READ_JS='''()=>{const box=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right}};
  const idea=document.querySelector('#task-view-idea .area-idea-text'),lead=document.querySelector('#task-pointed .report-lead'),act=document.getElementById('task-next-action');
  const fs=e=>e?parseFloat(getComputedStyle(e).fontSize):null;
  return {vh:innerHeight,vw:innerWidth,docWidth:document.documentElement.scrollWidth,idea:box(idea),lead:box(lead),action:box(act),
    ideaText:idea&&idea.innerText,leadText:lead&&lead.innerText,ideaFont:fs(idea),leadFont:fs(lead),
    openDetails:[...document.querySelectorAll('#space-view details[id]')].filter(d=>d.open).map(d=>d.id)}}'''
# Is the given marker text actually painted inside its scroll box (not only present in the DOM)?
SEEN_JS='''([sel,marker])=>{const root=document.querySelector(sel);if(!root)return null;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){const i=n.data.indexOf(marker);if(i<0)continue;const g=document.createRange();g.setStart(n,i);g.setEnd(n,i+marker.length);
    const r=g.getBoundingClientRect(),c=n.parentElement.closest('.source-raw,.report-lead')||root,b=c.getBoundingClientRect();
    const shown=n.parentElement.checkVisibility({contentVisibilityAuto:true,visibilityProperty:true});
    return {h:r.height,shown,inBox:shown&&r.height>0&&r.top>=b.top-1&&r.bottom<=b.bottom+1,inView:r.top>=0&&r.bottom<=innerHeight,top:r.top,boxTop:b.top,boxBottom:b.bottom}}
  return {h:0,shown:false,inBox:false,inView:false}}'''


class Report16(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state

    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        self.posts=[];self.page.on('request',lambda r:self.posts.append(r.url) if r.method=='POST' else None)

    # ---------- raw observations ----------
    def record(self,kind,name,value,expected=None):
        rec={'test':self.id().split('.',1)[-1],'width':self.WIDTH,'kind':kind,'name':name,'value':value}
        if kind=='condition':rec['expected']=expected
        with open(OBS,'a',encoding='utf-8') as fh:fh.write(json.dumps(rec,ensure_ascii=False)+'\n')
    def check(self,name,value,expected,delta=None):
        self.record('condition',name,value,expected if delta is None else {'value':expected,'delta':delta})
        if delta is None:self.assertEqual(value,expected,name)
        else:self.assertAlmostEqual(value,expected,delta=delta,msg=name)
    def check_true(self,name,value,detail=None):self.record('condition',name,detail if detail is not None else value,True);self.assertTrue(value,name)
    def snap(self,name,area=None):v=self.page.evaluate(SNAP_JS,area);self.record('actual',name,v);return v
    def read(self,name):v=self.page.evaluate(READ_JS);self.record('actual',name,v);return v
    def seen(self,sel,marker,name):v=self.page.evaluate(SEEN_JS,[sel,marker]);self.record('actual',name,v);return v
    def shot(self,name):self.page.mouse.move(1,1);self.page.screenshot(path=str(base.OUT/f'report16-{self.WIDTH}-{name}.png'))
    def title(self):return self.page.locator('#space-title')
    def task(self,tid,s=None):return next(t for t in (s or self.state())['tasks'] if t['id']==tid)

    # ---------- fixture through the product UI ----------
    def start(self,areas):
        self.page.locator('#brief-input').fill('[합성] 단축키 앱의 키 검색');self.page.locator('#brief-start').click()
        for name,note in areas:
            self.page.locator('#area-name').fill(name);self.page.locator('#area-note').fill(note);self.page.locator('#area-add').click()
            expect(self.page.locator('.area-node',has_text=name)).to_be_visible()
        return {a['name']:a['id'] for a in self.state()['space']['areas']}
    def to_work(self):
        self.page.locator('#nav-work').click()
        if not self.page.locator('#compose-panel').evaluate('(e)=>e.open'):self.page.locator('#compose-summary').click()
    def request_in(self,area,text):
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(text);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        return self.state()['currentTaskId']
    def export_current(self):
        self.page.locator('#nav-work').click()
        with self.page.expect_download():self.page.locator('#download-work').click()
        base.saved(self.page)
    def paste_report(self,text,target=None):
        self.page.locator('#nav-work').click();self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill(text)
        if target:self.page.locator('#return-task').select_option(target)
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        return self.state()['tasks'][-1]['id']
    def file_report(self,task,report,evidence):
        """The product's own file-return path: export a file handoff for the current task, then import a result file for it."""
        self.page.locator('#nav-work').click();self.page.locator('#file-return-options').evaluate('(e)=>e.open=true')
        with self.page.expect_download():self.page.locator('#download-file-work').click()
        s=self.state();h=self.task(task,s)['handoffs'][-1]
        f={'schemaVersion':'agentflow.return.1','projectId':s['id'],'taskId':task,'returnId':h['returnId'],'report':report,'evidence':evidence}
        path=base.OUT/f'report16-{self.WIDTH}-result.json';path.write_text(json.dumps(f,ensure_ascii=False),encoding='utf-8')
        self.to_work();self.page.locator('#result-file-panel').evaluate('(e)=>e.open=true')
        self.page.locator('#result-file-input').set_input_files(str(path));self.page.locator('#accept-result-file').click()
        expect(self.page.locator('#result-file-message')).to_contain_text('앱 미검증');base.saved(self.page)
        return self.state()['tasks'][-1]['id']
    def edit_idea(self,area,text):
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{area}').click()
        self.page.locator('#panel-edit > summary').click();self.page.locator('#panel-note').fill(text);self.page.locator('#panel-save').click()
        expect(self.page.locator('#panel-idea')).to_contain_text(text[:20]);base.saved(self.page)
    def build(self):
        ids=self.start([(AREA,OLD_IDEA),(OTHER,'[합성] 알림 설정')])
        A=self.request_in(ids[AREA],REQ_A)
        R1=self.file_report(A,REAL_R1,EVID_R1);self.check('fixture: R1 returns to A',self.task(R1)['parentTaskId'],A)
        self.check('fixture: R1 has two sources (report + evidence)',len(self.task(R1)['sourceIds']),2)
        self.export_current();R2=self.paste_report(LONG_R2,R1);self.check('fixture: R2 returns to R1 (nested)',self.task(R2)['parentTaskId'],R1)
        B=self.request_in(ids[OTHER],REQ_B);self.export_current();RBid=self.paste_report(RB,B)
        self.edit_idea(ids[AREA],CUR_IDEA)
        s=self.state();self.check('fixture: current is RB',s['currentTaskId'],RBid)
        self.check('fixture: A keeps the idea copy it was written with',self.task(A,s)['background']['area']['note'],OLD_IDEA)
        self.record('step','fixture via UI: areas, A (MOCK), R1 (file: real restatement + synthetic evidence), R2 (synthetic, nested via R1), B + RB, idea edited after A',None)
        return ids[AREA],ids[OTHER],A,R1,R2,B,RBid
    def move_map(self):
        self.page.locator('#map-zoom-in').click();self.page.locator('#map-zoom-in').click()
        box=self.page.locator('#space-map').bounding_box();x,y=box['x']+box['width']*0.5,box['y']+box['height']-24
        hit=self.page.evaluate('([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.id||e.className)}',[x,y])
        self.assertIn(hit,['space-map','space-plane','relation-layer'],f'the pan starts on the empty map ({hit})')
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x-70,y-35,steps=6);self.page.mouse.up()
    def depart(self,area,task):
        """Whole space: select the area ('정보'), open its idea in full, zoom + pan, scroll with the wheel, then pick the task."""
        self.page.locator('#nav-space').click();expect(self.title()).to_have_text('전체 공간')
        self.page.locator(f'#node-info-{area}').click();expect(self.page.locator('#area-panel')).to_be_visible()
        self.move_map();self.page.mouse.move(self.WIDTH-20,self.HEIGHT//2);self.page.mouse.wheel(0,140);self.page.wait_for_timeout(150)
        pick=self.page.locator(f'#panel-task-{task}');expect(pick).to_be_in_viewport()
        before=self.snap('depart',area);self.check_true('depart: map zoomed',' scale(1)' not in before['styleTransform'] and 'scale(1)' not in before['styleTransform'],before['styleTransform'])
        self.check_true('depart: page scrolled by the wheel',before['windowY']>0,before['windowY'])
        pick.click();expect(self.page.locator('#task-view')).to_be_visible()
        return before
    def assert_back(self,before,area,task):
        expect(self.title()).to_have_text('전체 공간');expect(self.page.locator('#area-panel')).to_be_visible()
        after=self.snap('back',area);pos=lambda r:r and {k:r[k] for k in ('x','y','w')}
        for k in ('styleTransform','computedTransform','scaleLabel','openDetails'):self.check(f'back: {k}',after[k],before[k])
        self.check('back: selected card rect x/y/w',pos(after['cardRect']),pos(before['cardRect']))
        self.check('back: selected area',after['selected'],area);self.check('back: windowY',after['windowY'],before['windowY'],delta=2)
        self.check('back: focus id',after['focusId'],f'panel-task-{task}')
    def unsent_request(self,area,text):
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(text);base.saved(self.page)
    def pick(self,rid):
        self.page.locator(f'#task-report-pick-{rid}').click();expect(self.page.locator(f'#task-report-pick-{rid}')).to_have_attribute('aria-pressed','true')
    def no_writes(self,label,saved):
        s=self.state();self.check(f'{label}: saved project unchanged (current/manual/draft/kind/target/notes)',s,saved)
        self.check(f'{label}: no POST',self.posts,[])

    # ---------- 1/2/3/5/11: the F10 reading screen, picking, full text, and back to the map ----------
    def test_01_f10_current_idea_beside_the_picked_report_and_back(self):
        area,other,A,R1,R2,B,RBid=self.build()
        self.unsent_request(other,FOLLOW);saved=self.state();self.posts.clear()
        before=self.depart(area,A)
        # Nothing is picked for the user; the list is exactly A's return path (R1 direct, R2 via R1), never RB.
        expect(self.page.locator('#task-pointed')).to_have_count(0);expect(self.page.locator('#task-report-none')).to_contain_text('대신 고르지 않아요')
        picks=self.page.locator('#task-report-list .report-pick');ids=[e.get_attribute('id') for e in picks.all()]
        self.check('pick list = return path of A, record order',ids,[f'task-report-pick-{R1}',f'task-report-pick-{R2}'])
        self.check('nothing pre-selected',[e.get_attribute('aria-pressed') for e in picks.all()],['false','false'])
        expect(self.page.locator('#task-report-list')).not_to_contain_text('ZZ-RB');expect(self.page.locator('#task-view')).not_to_contain_text('ZZ-END-R2')
        idea=self.page.locator('#task-view-idea');expect(idea).to_contain_text('지금의 영역 구상');expect(idea).to_contain_text(CUR_IDEA)
        expect(idea).not_to_contain_text('아직 못 정함');expect(idea.locator('.task-idea-changed')).to_be_visible()
        self.shot('01-before-pick')
        # Explicit pick of the real restatement: shown whole beside the current idea, both read at once on the first screen.
        self.pick(R1);p=self.page.locator('#task-pointed')
        expect(p).to_contain_text('a964f08cc6');expect(p).to_contain_text('ZZ-EVID-R1');expect(p).not_to_contain_text('ZZ-HEAD-R2')
        expect(p.locator('.report-source')).to_have_count(2)
        g=self.read('F10 first screen')
        for k in ('idea','lead','action'):self.check_true(f'F10: {k} fully inside the first screen',g[k] is not None and g[k]['top']>=0 and g[k]['bottom']<=g['vh'],g[k])
        self.check_true('F10: idea and report side by side (left and right columns of the same first screen)',g['idea']['right']<=g['lead']['left'],[g['idea'],g['lead']])
        self.check_true('F10: real sentences on screen',CUR_IDEA[:20] in g['ideaText'] and 'F10이 선택된다' in g['leadText'],[g['ideaText'],g['leadText']])
        self.check('F10: report text is not shrunk below the idea text',g['leadFont'],g['ideaFont'])
        self.check('F10: no horizontal scroll',g['docWidth'],self.WIDTH)
        expect(self.page.locator('#task-next-action')).to_have_text('작성 중인 요청 열기')
        expect(self.page.locator('#task-next-target')).to_contain_text(f'대상 그대로 · 영역 ‘{OTHER}’')
        self.shot('02-f10-picked')
        # The nested long report: opening lines as written, said to be an opening, the whole text one click away.
        self.pick(R2);p=self.page.locator('#task-pointed')
        expect(p).to_contain_text('ZZ-HEAD-R2');expect(p).not_to_contain_text('a964f08cc6');expect(p.locator('.report-lead-note')).to_contain_text('위는 앞부분')
        expect(p.locator('#task-report-path > summary')).to_contain_text('이전 보고에 연결된 보고')
        full=self.page.locator(f'#task-pointed details[id^="task-report-src-"]');expect(full).not_to_have_attribute('open','');self.shot('03-r2-opening')
        self.check_true('R2 closed: end sentence not rendered',not self.seen('#task-pointed','ZZ-END-R2','R2 closed')['shown'])
        lines=p.locator('.report-lead').evaluate('(e)=>Math.round(e.getBoundingClientRect().height/parseFloat(getComputedStyle(e).lineHeight))')
        self.check_true('R2 opening shows at most six lines',lines<=6,lines)
        full.locator('summary').click();raw=full.locator('.source-raw');expect(raw).to_be_visible()
        raw.evaluate('(e)=>{e.scrollTop=e.scrollHeight}');raw.scroll_into_view_if_needed()
        v=self.seen('#task-pointed details[open]','ZZ-END-R2','R2 opened end');self.check_true('R2 opened: end sentence painted inside its box',v['inBox'] and v['h']>0,v)
        self.check('R2 opened: whole text, not a summary',' '.join(raw.inner_text().split()),' '.join(LONG_R2.split()))
        self.shot('04-r2-full')
        # A redraw of the same request and report keeps it open; another report does not inherit it; coming back starts closed.
        self.page.locator(f'#task-report-pick-{R2}').click();expect(full).to_have_attribute('open','')
        self.pick(R1);self.pick(R2);expect(self.page.locator(f'#task-pointed details[id^="task-report-src-"]')).not_to_have_attribute('open','')
        full.locator('summary').click();expect(raw).to_be_visible();full.locator('summary').click();expect(raw).to_be_hidden()
        space=full.evaluate('(d)=>Math.round(d.getBoundingClientRect().height-d.querySelector("summary").getBoundingClientRect().height)')
        self.check_true('closed: the full text takes no space (details height = its summary)',space<4,space)
        self.check('closed: full text not rendered',raw.evaluate('(e)=>e.checkVisibility({contentVisibilityAuto:true})'),False)
        self.no_writes('reading + picking + opening',saved)
        self.page.locator('#task-return-origin').click();self.assert_back(before,area,A);self.no_writes('after return',saved)

    # ---------- 6: an empty input + active area: a new request prepared in this area only ----------
    def test_02_new_request_in_this_area_prepares_input_only(self):
        area,other,A,R1,R2,B,RBid=self.build();s0=self.state();self.posts.clear()
        before=self.depart(area,A);self.pick(R1)
        expect(self.page.locator('#task-next-action')).to_have_text('이 영역에 새 요청');expect(self.page.locator('#task-next-target')).to_contain_text(f'영역 ‘{AREA}’')
        self.page.locator('#task-next-action').click();expect(self.page.locator('#draft')).to_be_focused()
        s=self.state();self.check('new: target is this area',s['space']['draftTarget'],{'area':area})
        self.check('new: kind request, empty text',[s['draftKind'],s['draft']],['request',''])
        self.check('new: no task created, current kept',[len(s['tasks']),s['currentTaskId']],[len(s0['tasks']),s0['currentTaskId']])
        self.check('new: the report is not pasted into the input',self.page.locator('#draft').input_value(),'')
        self.check('new: no POST (no send, no AI)',self.posts,[])
        expect(self.page.locator('#compose-area')).to_have_value(area)
        self.page.locator('#draft').fill(FOLLOW);base.saved(self.page)
        expect(self.page.locator('#work-return-origin')).to_be_visible();self.page.locator('#work-return-origin').click()
        self.assert_back(before,area,A)
        s=self.state();self.check('back: the written input stays (no rollback)',[s['draft'],s['space']['draftTarget']],[FOLLOW,{'area':area}])

    # ---------- 7/8: an unsent input keeps its kind, text and target; null vs {area:null} ----------
    def test_03_unsent_inputs_open_as_they_are(self):
        area,other,A,R1,R2,B,RBid=self.build()
        self.unsent_request(other,FOLLOW);s0=self.state()
        self.depart(area,A);self.pick(R1)
        expect(self.page.locator('#task-next-action')).to_have_text('작성 중인 요청 열기')
        expect(self.page.locator('#task-next-target')).to_contain_text(f'대상 그대로 · 영역 ‘{OTHER}’')
        self.check('before click: saved unchanged',self.state(),s0)
        self.page.locator('#task-next-action').click();expect(self.page.locator('#draft')).to_be_focused()
        s=self.state();self.check('open: kind/text/target kept',[s['draftKind'],s['draft'],s['space']['draftTarget']],['request',FOLLOW,{'area':other}])
        expect(self.page.locator('#compose-area')).to_have_value(other);expect(self.page.locator('#notice')).to_contain_text(f'영역 ‘{OTHER}’')
        self.shot('05-unsent-opened')
        # The composer's own choices: '영역 없이' ({area:null}) and '지금 작업을 따라감' (null) are told apart on the task screen.
        for value,expected,label in [('@none','대상 그대로 · 영역 없이','영역 없이'),('@follow','대상 그대로 · 지금 작업을 따라감',None)]:
            self.page.locator('#compose-area').select_option(value);base.saved(self.page)
            dt=self.state()['space']['draftTarget'];self.record('actual',f'draftTarget after {value}',dt)
            self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{area}').click();self.page.locator(f'#panel-task-{A}').click()
            t=self.page.locator('#task-next-target');expect(t).to_contain_text(expected)
            if label:expect(t).not_to_contain_text('따라감')
            else:expect(t).not_to_contain_text('영역 없이')
            self.page.locator('#task-next-action').click();self.check(f'{value}: target kept by opening',self.state()['space']['draftTarget'],dt)
        self.check('null and {area:null} are different saved values',[None,{'area':None}],[None,{'area':None}])
        # An unsent report with an explicitly chosen return task (tab memory) keeps both.
        self.page.locator('#draft').fill('');base.saved(self.page)
        self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill('[합성 미전송 보고] 아직 보내지 않음')
        self.page.locator('#return-task').select_option(A);base.saved(self.page);s1=self.state()
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{area}').click();self.page.locator(f'#panel-task-{A}').click();self.pick(R2)
        expect(self.page.locator('#task-next-action')).to_have_text('작성 중인 보고 열기')
        expect(self.page.locator('#task-next-target')).to_contain_text('연결 예정 그대로 · [합성] 키 검색')
        self.page.locator('#task-next-action').click()
        s=self.state();self.check('report: kind/text kept, saved unchanged',s,s1)
        self.check('report: chosen return task kept (not the picked report)',self.page.locator('#return-task').input_value(),A)

    # ---------- 4: stale / foreign / non-report ids are said, never swapped; then an explicit pick works ----------
    def test_04_stale_or_foreign_report_is_not_replaced(self):
        area,other,A,R1,R2,B,RBid=self.build();saved=self.state()
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{area}').click();self.page.locator(f'#panel-task-{A}').click();self.pick(R1)
        place=json.loads(self.page.evaluate("sessionStorage.getItem('agentflow.workspace.place')"));self.check('tab memory keeps the pick',place['ret'],R1)
        for bad,label in [('T_missing','missing'),(RBid,'foreign RB (a real report of B)'),(B,'not a report')]:
            place['ret']=bad;self.page.evaluate(f"sessionStorage.setItem('agentflow.workspace.place', {json.dumps(json.dumps(place))})")
            self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');expect(self.title()).to_contain_text('[합성] 키 검색')
            p=self.page.locator('#task-pointed');expect(p).to_contain_text('찾을 수 없어요')
            for text in ['a964f08cc6','ZZ-HEAD-R2','ZZ-RB','ZZ-EVID-R1']:expect(p).not_to_contain_text(text)
            self.check(f'{label}: nothing pressed',[e.get_attribute('aria-pressed') for e in self.page.locator('.report-pick').all()],['false','false'])
            expect(self.page.locator('#task-to-space')).to_have_text('전체 공간으로');expect(self.page.locator('#task-return-origin')).to_have_count(0)
        self.shot('06-stale')
        self.pick(R2);expect(self.page.locator('#task-pointed')).to_contain_text('ZZ-HEAD-R2');self.check('reading never writes',self.state(),saved)
        self.page.locator('#task-to-space').click();expect(self.title()).to_have_text('전체 공간')

    # ---------- 9: the existing continue, kept apart from the new request ----------
    def test_05_continue_policy_unchanged_and_apart(self):
        area,other,A,R1,R2,B,RBid=self.build()
        # current RB (report of B): reading B and continuing keeps RB.
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{other}').click();self.page.locator(f'#panel-task-{B}').click();self.pick(RBid)
        expect(self.page.locator('#task-view-continue')).to_have_text('작업 화면으로');expect(self.page.locator('#task-view-target')).to_contain_text('받은 현재 보고')
        self.page.locator('#task-view-continue').click();expect(self.page.locator('#current-work')).to_be_visible();self.check('RB kept',self.state()['currentTaskId'],RBid)
        # Reading A with R2 picked: continue edits A (never the picked R2), the new-request button is a different button.
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{area}').click();self.page.locator(f'#panel-task-{A}').click();self.pick(R2)
        expect(self.page.locator('#task-view-continue')).to_have_text('이 작업 이어서 하기');expect(self.page.locator('#task-view-target')).to_contain_text('이 요청(작업 01)으로 바꾸고')
        self.check_true('continue and next action are different controls',self.page.locator('#task-view-continue').evaluate('(e)=>e.id')!=self.page.locator('#task-next-action').evaluate('(e)=>e.id'))
        self.page.locator('#task-view-continue').click();expect(self.page.locator('#current-work')).to_be_visible()
        s=self.state();self.check('A becomes current, not R2',s['currentTaskId'],A);self.check('no draft written',[s['draft'],s['space']['draftTarget']],['',None])

    # ---------- 10: archived area / unassigned request: no new request, no substitute area, no un-archive ----------
    def test_06_archived_and_unassigned_never_retarget(self):
        area,other,A,R1,R2,B,RBid=self.build()
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{other}').click();self.page.locator('#area-archive').click();base.saved(self.page)
        s0=self.state();self.check('fixture: other archived',next(a['archived'] for a in s0['space']['areas'] if a['id']==other),True)
        self.page.locator('#nav-space').click();self.page.locator('#archived-areas > summary').click()
        self.page.locator('#archived-areas button',has_text='열어 보기').click();self.page.locator(f'#task-open-{B}').click()
        n=self.page.locator('#task-next-action');expect(n).to_be_disabled();expect(self.page.locator('#task-next-target')).to_contain_text('보관된 영역')
        expect(self.page.locator('#task-view-idea')).to_contain_text('(보관됨)');self.shot('07-archived')
        self.check('archived: nothing changed',self.state(),s0)
        # An unassigned request (written '영역 없이'): no area idea, no area new request; a later unsent input still opens as it is.
        self.to_work();self.page.locator('#request-tab').click();self.page.locator('#compose-area').select_option('@none');self.page.locator('#draft').fill('[합성 요청] 영역 없이 쓴 요청')
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('');U=self.state()['currentTaskId']
        self.check('fixture: unassigned',self.task(U).get('areaId'),None);s1=self.state()
        self.page.locator('#nav-space').click();self.page.locator('#open-unplaced').click()
        self.page.locator(f'#task-open-{U}').click();expect(self.page.locator('#task-next-action')).to_be_disabled()
        expect(self.page.locator('#task-next-target')).to_contain_text('영역 미지정');expect(self.page.locator('#task-view-idea')).to_contain_text('영역 구상이 없어요')
        self.check('unassigned: nothing changed',self.state(),s1)
        self.to_work();self.page.locator('#draft').fill(FOLLOW);base.saved(self.page);s2=self.state()
        self.page.locator('#nav-space').click();self.page.locator('#open-unplaced').click();self.page.locator(f'#task-open-{U}').click()
        expect(self.page.locator('#task-next-action')).to_be_enabled();expect(self.page.locator('#task-next-action')).to_have_text('작성 중인 요청 열기')
        self.page.locator('#task-next-action').click();self.check('unassigned: input opened as it is',self.state(),s2)
        self.check('no area un-archived',[a['archived'] for a in self.state()['space']['areas']],[a['archived'] for a in s0['space']['areas']])

    # ---------- 12 (part): area screen with a long idea opened -> new request written -> back ----------
    # Checks the area round trip and that the saved input is kept. It does NOT check the fallback when the starting area is gone
    # (fix1: the old conditional check never ran; that fallback is verified separately by the coordinator).
    def test_07_area_round_trip_keeps_saved_input(self):
        long='[합성 긴 구상] 후보만 좁히고 명시적으로 고른 뒤 확정한다. '+'세부 조건이 이어집니다. '*30+'구상 끝 ZZ-IDEA-END'
        ids=self.start([(AREA,long),(OTHER,'[합성]')]);A=self.request_in(ids[AREA],REQ_A);R=self.paste_report('[합성 보고] 짧은 보고 ZZ-R')
        for i in range(4):self.request_in(ids[AREA],f'[합성 요청] 채우기 {i}')
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{ids[AREA]}').click();self.page.locator('#area-idea-full > summary').click()
        link=self.page.locator(f'#task-open-{A}');link.scroll_into_view_if_needed();y=self.page.evaluate('window.scrollY');self.check_true('area: scrolled down',y>0,y)
        link.click();expect(self.page.locator('#task-view-idea')).to_contain_text('지금의 영역 구상')
        self.page.locator('#task-view-idea-full > summary').click();expect(self.page.locator('#task-view-idea-full')).to_contain_text('ZZ-IDEA-END')
        self.pick(R);self.page.locator('#task-next-action').click();self.page.locator('#draft').fill(FOLLOW);base.saved(self.page)
        self.page.locator('#work-return-origin').click();expect(self.title()).to_have_text(AREA)
        self.check('area back: long idea still open',self.page.locator('#area-idea-full').get_attribute('open'),'')
        self.check('area back: focus on the request',self.page.evaluate('document.activeElement.id'),f'task-open-{A}')
        self.check('area back: windowY',self.page.evaluate('window.scrollY'),y,delta=2)
        s=self.state();self.check('area back: saved input kept',[s['draft'],s['space']['draftTarget']],[FOLLOW,{'area':ids[AREA]}])

    # ---------- fix1: a picked report's disclosures never carry over to another report; request-wide ones and redraws keep ----------
    def open_d(self,sel):
        d=self.page.locator(sel)
        if d.get_attribute('open') is None:d.locator('> summary').click()
        expect(d).to_have_attribute('open','')
    def is_open(self,sel):return self.page.locator(sel).evaluate('(d)=>d.open')
    def test_09_report_disclosures_do_not_leak_and_survive_redraws(self):
        area,other,A,R1,R2,B,RBid=self.build()
        # A redraw the reading does not cause: a MOCK reply held back (labelled fault injection) and released later.
        parked=[];self.page.route('**/api/continuity',lambda route:parked.append((route,route.fetch())))
        self.request_in_pending(other,'[합성 요청] 보류된 응답으로 다시 그리기 확인')
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{area}').click();self.page.locator(f'#panel-task-{A}').click()
        self.open_d('#task-view-request');self.open_d('#task-view-work')               # request-wide disclosures
        self.pick(R1);self.open_d('#task-report-path')                                   # R1's own disclosure
        self.pick(R2)
        self.check('① R1 path open does not carry over to R2',self.is_open('#task-report-path'),False)
        self.check('③ request original stays open across a report change',self.is_open('#task-view-request'),True)
        self.check('③ work details stay open across a report change',self.is_open('#task-view-work'),True)
        src=f'#task-pointed details[id^="task-report-src-"]';self.open_d('#task-report-path');self.open_d(src)
        self.pick(R2)
        self.check('② same report picked again: its path stays open',self.is_open('#task-report-path'),True)
        self.check('② same report picked again: its full text stays open',self.is_open(src),True)
        self.pick(R1);self.check('① back to R1: path closed (R2 open state not carried)',self.is_open('#task-report-path'),False)
        self.pick(R2);self.check('① back to R2: starts closed again',[self.is_open('#task-report-path'),self.is_open(src)],[False,False])
        self.open_d('#task-report-path');self.open_d(src)
        self.check_true('the held reply is still pending',len(parked)==1 and self.state()['pending'] is not None,len(parked))
        route,response=parked.pop();route.fulfill(response=response)
        for _ in range(100):
            if self.state()['pending'] is None:break
            self.page.wait_for_timeout(50)
        self.check('④ late reply landed (a redraw not caused by reading)',self.state()['pending'],None)
        self.check('④ still the same request and report',[self.title().inner_text().startswith('[합성] 키 검색'),self.page.locator(f'#task-report-pick-{R2}').get_attribute('aria-pressed')],[True,'true'])
        self.check('④ after the redraw: report disclosures kept',[self.is_open('#task-report-path'),self.is_open(src)],[True,True])
        self.check('④ after the redraw: request-wide disclosures kept',[self.is_open('#task-view-request'),self.is_open('#task-view-work')],[True,True])
        self.shot('09-redraw-kept')
    def request_in_pending(self,area,text):
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(text);self.page.locator('#send').click()
        for _ in range(100):
            if self.state()['pending'] is not None:break
            self.page.wait_for_timeout(50)
        self.check('fixture: request pending while reading',self.state()['pending'] is not None,True)


class Report16Wide(Report16):
    WIDTH,HEIGHT=1440,900
    # The data-boundary variants run once (at 1280); both PC widths run the reading, action and return paths.
    test_04_stale_or_foreign_report_is_not_replaced=None
    test_06_archived_and_unassigned_never_retarget=None
    test_09_report_disclosures_do_not_leak_and_survive_redraws=None
    test_07_area_round_trip_keeps_saved_input=None


class Report16Narrow(Report16):
    WIDTH,HEIGHT=390,844
    for _n in [n for n in dir(Report16) if n.startswith('test_')]:locals()[_n]=None
    def setUp(self):
        Report16.setUp(self);self.page.set_viewport_size({'width':1280,'height':720})  # the fixture uses the map
    def test_08_narrow_390_reachable(self):
        area,other,A,R1,R2,B,RBid=self.build();self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        self.page.locator('#nav-space').click();self.page.locator(f'#list-info-{area}').click()
        pick=self.page.locator(f'#panel-task-{A}');pick.scroll_into_view_if_needed();pick.click();self.pick(R1)
        expect(self.page.locator('#task-pointed')).to_contain_text('F10');expect(self.page.locator('#task-next-action')).to_be_visible()
        self.check('390: no horizontal scroll',self.page.evaluate('document.documentElement.scrollWidth'),390)


if __name__=='__main__':unittest.main()
