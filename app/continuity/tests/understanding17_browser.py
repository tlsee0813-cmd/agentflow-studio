"""AREA17: native Chromium -> real localhost HTTP -> explicit MOCK; no paid AI, no external tool.
One organised return (agentflow.return.2) is received through the product's real result-file selection, updates the same
area's current description, is located on the existing map only by the user's explicit action, read briefly beside the
user's own idea, its evidence opened without picking anything, and the next handoff carries it as attributed reference.
Back to the starting map view via the explicit return.

Fixtures (tests/understanding17-fixtures.mjs, read through node): Korean restatements of bounded public records (PowerToys
review -> fixed code) and of an internal AI assignment (product13 -> fix1). They are NOT original user speech, automatic
extraction or verified completion. Proposals and conflicting prose are explicitly SYNTHETIC boundaries. Long-content strings
and the second area are synthetic test scaffolding. Every condition (expected vs value) and raw measurement is written to
understanding17-observations.jsonl before its assertion. Wiring and geometry, not usability; not semantic-conflict detection.
Run from app/: python continuity/tests/understanding17_browser.py
"""
import json, subprocess, unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base

APP=Path(__file__).resolve().parents[2]
CASES={c['id']:c for c in json.loads(subprocess.check_output(['node','-e',"import('./continuity/tests/understanding17-fixtures.mjs').then(m=>console.log(JSON.stringify(m.cases)))"],cwd=APP,text=True))}
OTHER,OTHER_NOTE='비교 영역 · 합성','변경이 번지지 않는지 확인하는 합성 영역'
UNSENT='[합성 · 미전송] 비교 영역에서 아직 보내지 않은 요청 본문'
BUFFER='[합성 · 저장 안 한 편집] 비교 영역 구상 고치는 중'
OBS=base.OUT/'understanding17-observations.jsonl';OBS.write_text('',encoding='utf-8')
FNV='''(t)=>{let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193);}return {chars:t.length,digest:(h>>>0).toString(16).padStart(8,'0')}}'''
SNAP_JS='''(area)=>{const p=document.getElementById('space-plane'),n=area&&document.querySelector(`.area-node[data-area-id="${area}"]`),a=document.activeElement;
  const box=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return {x:Math.round(r.x*10)/10,y:Math.round(r.y*10)/10,w:Math.round(r.width*10)/10,h:Math.round(r.height*10)/10,right:Math.round(r.right*10)/10,bottom:Math.round(r.bottom*10)/10}};
  return {windowY:window.scrollY,styleTransform:p?p.style.transform:null,computedTransform:p?getComputedStyle(p).transform:null,card:box(n),map:box(document.getElementById('space-map')),
    panel:box(document.getElementById('area-panel')),vw:innerWidth,vh:innerHeight,docWidth:document.documentElement.scrollWidth,
    offscreen:n?n.classList.contains('offscreen'):null,located:n?n.classList.contains('located'):null,
    selected:(document.querySelector('.area-node.selected')||{dataset:{}}).dataset.areaId||null,scaleLabel:(document.getElementById('map-scale')||{}).textContent||null,
    focusId:a&&a.id,openDetails:[...document.querySelectorAll('#space-view details[id]')].filter(d=>d.open).map(d=>d.id)}}'''
SEEN_JS='''([sel,marker])=>{const root=document.querySelector(sel);if(!root)return null;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
  while((n=w.nextNode())){const i=n.data.indexOf(marker);if(i<0)continue;const g=document.createRange();g.setStart(n,i);g.setEnd(n,i+marker.length);
    const r=g.getBoundingClientRect(),shown=n.parentElement.checkVisibility({contentVisibilityAuto:true,visibilityProperty:true});
    return {shown:shown&&r.height>0,top:r.top,bottom:r.bottom,inView:r.top>=0&&r.bottom<=innerHeight}}
  return {shown:false}}'''
HEIGHT_JS='''(sel)=>{const e=document.querySelector(sel);if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();
  return {h:Math.round(r.height),chars:e.innerText.length,top:Math.round(r.top),bottom:Math.round(r.bottom),vh:innerHeight}}'''
READABLE_JS='''(sel)=>{const e=document.querySelector(sel);if(!e||!e.getClientRects().length)return {found:!!e,readable:false};
  const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while((n=w.nextNode())&&!n.data.trim());if(!n)return {found:true,readable:false,text:''};
  const i=n.data.search(/\\S/),g=document.createRange();g.setStart(n,i);g.setEnd(n,Math.min(n.data.length,i+8));const r=g.getBoundingClientRect();
  const inView=r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,hit=inView?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;
  return {found:true,text:e.innerText.slice(0,40),top:Math.round(r.top),bottom:Math.round(r.bottom),inView,unobscured:!!hit&&e.contains(hit),hit:hit&&(hit.id||hit.className),readable:inView&&!!hit&&e.contains(hit)}}'''
def inside(a,b,pad=0):return a and b and a['x']>=b['x']-pad and a['y']>=b['y']-pad and a['right']<=b['right']+pad and a['bottom']<=b['bottom']+pad
def overlaps(a,b):return bool(a and b and a['x']<b['right'] and b['x']<a['right'] and a['y']<b['bottom'] and b['y']<a['bottom'])


class Area17(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state

    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        self.ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=self.url)
        self.posts=[];self.page.on('request',lambda r:self.posts.append(r.url) if r.method=='POST' else None)

    # ---------- raw observations ----------
    def record(self,kind,name,value,expected=None,detail=None):
        rec={'test':self.id().split('.',1)[-1],'width':self.WIDTH,'height':self.HEIGHT,'kind':kind,'name':name,'value':value}
        if kind=='condition':rec['expected']=expected
        if detail is not None:rec['detail']=detail
        with open(OBS,'a',encoding='utf-8') as fh:fh.write(json.dumps(rec,ensure_ascii=False)+'\n')
    def check(self,name,value,expected):self.record('condition',name,value,expected);self.assertEqual(value,expected,name)
    def check_true(self,name,value,detail=None):
        # 'value' is exactly the boolean asserted; 'detail' only carries the measurements behind it.
        self.record('condition',name,bool(value),True,detail);self.assertTrue(value,name)
    def snap(self,name,area=None):v=self.page.evaluate(SNAP_JS,area);self.record('actual',name,v);return v
    def seen(self,sel,marker,name):v=self.page.evaluate(SEEN_JS,[sel,marker]);self.record('actual',name,v);return v
    def readable(self,sel,name):
        v=self.page.evaluate(READABLE_JS,sel);self.check_true(f'readable on screen (first line in view, not covered): {name}',v['readable'],v);return v
    def height(self,sel,name):v=self.page.evaluate(HEIGHT_JS,sel);self.record('actual',name,v);return v
    def shot(self,name):self.page.mouse.move(1,1);self.page.screenshot(path=str(base.OUT/f'area17-{self.WIDTH}x{self.HEIGHT}-{name}.png'))
    def task(self,tid,s=None):return next(t for t in (s or self.state())['tasks'] if t['id']==tid)
    def clipboard(self):return self.page.evaluate('()=>navigator.clipboard.readText()')

    # ---------- fixture through the product UI ----------
    def start(self,c):
        self.page.locator('#brief-input').fill(c['brief']);self.page.locator('#brief-start').click()
        for name,note in [(c['area'],c['note']),(OTHER,OTHER_NOTE)]:
            self.page.locator('#area-name').fill(name);self.page.locator('#area-note').fill(note);self.page.locator('#area-add').click()
            expect(self.page.locator('.area-node',has_text=name)).to_be_visible()
        ids={a['name']:a['id'] for a in self.state()['space']['areas']};return ids[c['area']],ids[OTHER]
    def request_in(self,area,text):
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(text);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        return self.state()['currentTaskId']
    def to_work(self):
        self.page.locator('#nav-work').click()
        if not self.page.locator('#compose-panel').evaluate('(e)=>e.open'):self.page.locator('#compose-summary').click()
    def file_export(self,task,how='clipboard'):
        """The product's file-return export of the current task. Returns (text actually copied/saved, the stored record)."""
        self.page.locator('#nav-work').click();self.page.locator('#file-return-options').evaluate('(e)=>e.open=true')
        if how=='clipboard':
            self.page.locator('#copy-file-work').click();expect(self.page.locator('#notice')).to_contain_text('클립보드에 복사');text=self.clipboard()
        else:
            with self.page.expect_download() as d:self.page.locator('#download-file-work').click()
            text=Path(d.value.path()).read_text(encoding='utf-8')
        base.saved(self.page);return text,self.task(task)['handoffs'][-1]
    def check_record(self,label,text,h):
        got=self.page.evaluate(FNV,text);self.check(f'{label}: record chars = copied text length (JS)',h['chars'],got['chars'])
        self.check(f'{label}: record digest = FNV of copied text',h['digest'],got['digest'])
    def result_file(self,name,s,task,returnId,c,area,basedOn,**over):
        u={'version':'understanding.1','areaId':area,'basedOn':basedOn,'summary':c['summary'],'changes':c['changes'],'proposal':c['proposal'],'origin':c['origin']};u.update(over)
        f={'schemaVersion':'agentflow.return.2','projectId':s['id'],'taskId':task,'returnId':returnId,'report':c['report'],'evidence':None,'understanding':u}
        path=base.OUT/f'area17-{self.WIDTH}-{name}.json';path.write_text(json.dumps(f,ensure_ascii=False),encoding='utf-8');return path,f
    def import_file(self,path,expect_text='앱 미검증'):
        self.to_work();self.page.locator('#result-file-panel').evaluate('(e)=>e.open=true')
        self.page.locator('#result-file-input').set_input_files(str(path));self.page.locator('#accept-result-file').click()
        expect(self.page.locator('#result-file-message')).to_contain_text(expect_text);base.saved(self.page)
    def make_offscreen(self,area,other):
        """User view state before receiving: the other area selected (panel open, an unsaved idea edit), map zoomed and panned so the
        target card is outside the visible map, and the page scrolled by the wheel."""
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{other}').click();expect(self.page.locator('#area-panel')).to_be_visible()
        self.page.locator('#panel-edit > summary').click();self.page.locator('#panel-note').fill(BUFFER)
        for _ in range(3):self.page.locator('#map-zoom-in').click()
        for _ in range(4):
            if self.snap('offscreen probe',area)['offscreen']:break
            box=self.page.locator('#space-map').bounding_box();x,y=box['x']+box['width']*0.5,box['y']+box['height']-20
            hit=self.page.evaluate('([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.id||e.className)}',[x,y])
            self.assertIn(hit,['space-map','space-plane','relation-layer'],f'pan starts on the empty map ({hit})')
            self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x-260,y-10,steps=6);self.page.mouse.up()
        self.page.mouse.move(self.WIDTH//2,self.HEIGHT-30);self.page.mouse.wheel(0,90);self.page.wait_for_timeout(150)
        s=self.snap('before receipt',area);self.check_true('setup: target card outside the visible map',s['offscreen'],s);return s
    def keep(self,s,n=None):
        """User values and other parts that receiving / reading must never change (tasks: the first n, those that existed before)."""
        n=len(s['tasks']) if n is None else n;tasks=s['tasks'][:n]
        return {'tasks':tasks,'areas':s['space']['areas'],'relations':s['space']['relations'],'layout':s['space']['layout'],'bases':s['bases'],'draft':s['draft'],
                'draftKind':s['draftKind'],'draftTarget':s['space']['draftTarget'],'brief':s['space']['brief'],
                'manual':[t['manual'] for t in tasks],'background':[t['background'] for t in tasks]}

    # ---------- the whole flow for one fixture ----------
    def flow(self,cid):
        c=CASES[cid];area,other=self.start(c);A=self.request_in(area,c['request'])
        text,h=self.file_export(A);self.record('raw','file handoff text (clipboard)',text);self.check_record('file export',text,h)
        self.check_true('file export: return.2 template with the same anchor',all(x in text for x in ['"schemaVersion": "agentflow.return.2"',f'"areaId": "{area}"',f'"basedOn": {h["anchor"]["understanding"]}','## 현재 사용자 구상']),h['anchor'])
        self.check('file export: identical idea printed once (the current-plan line points to the request-time copy)',text.count(c['note']),1)
        self.check('file export: anchor stamp = idea at export',h['anchor']['stamp']['note'],c['note'])
        # Unsent request in the other area, then the user's own map view with the target out of sight.
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{other}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(UNSENT);base.saved(self.page)
        before_map=self.make_offscreen(area,other);s0=self.state();kept=self.keep(s0);ntasks=len(s0['tasks'])
        path,f=self.result_file('result',s0,A,h['returnId'],c,area,h['anchor']['understanding'])
        self.posts.clear();self.import_file(path)
        s=self.state();R=s['tasks'][-1]['id']
        self.check('receive: one new return task',len(s['tasks']),ntasks+1);self.check('receive: raw file kept exactly',s['tasks'][-1]['resultFile']['rawText'],path.read_text(encoding='utf-8'))
        self.check('receive: description revision 1 for the target area only',{k:v['revision'] for k,v in s['space']['understanding'].items()},{area:1})
        self.check('receive: user values, earlier tasks, other area, layout, unsent draft kind/body/target unchanged',self.keep(s,ntasks),kept)
        self.check('receive: no POST (no AI call)',self.posts,[])
        line=self.page.locator('#outcome-received-area');expect(line).to_contain_text(c['area']);expect(line).to_contain_text('앱 미검증')
        # Receiving never moves the map: same viewport and the target still out of sight.
        self.page.locator('#nav-space').click();after=self.snap('after receipt, before locate',area)
        for k in ('styleTransform','scaleLabel','selected'):self.check(f'[수신 카메라 불변] {k}',after[k],before_map[k])
        self.check('[수신 카메라 불변] target still outside the visible map',after['offscreen'],True)
        expect(self.page.locator('#panel-note')).to_have_value(BUFFER)
        # --- path 1: the work view's explicit location action ---
        self.page.locator('#nav-work').click();self.page.locator('#result-show-area').click()
        loc=self.snap('located from work view',area);self.located_ok('work CTA',loc,area,after)
        self.page.locator('#locate-return').click();back=self.snap('back from work-CTA locate',area)
        for k in ('styleTransform','computedTransform','scaleLabel','selected'):self.check(f'[원래 배율·좌표 복귀] work CTA: {k}',back[k],after[k])
        # --- path 2: from the whole space (the after-receipt start view), with a wheel scroll, read, evidence, report, return ---
        self.page.mouse.move(self.WIDTH//2,self.HEIGHT-30);self.page.mouse.wheel(0,60);self.page.wait_for_timeout(150)
        self.page.locator(f'#received-area-{area}').focus();start=self.snap('start view (after receipt)',area);s_start=self.state()
        self.page.locator(f'#received-area-{area}').click();loc=self.snap('located from map',area);self.located_ok('map list',loc,area,start)
        expect(self.page.locator('#located-note')).to_be_in_viewport();expect(self.page.locator('#locate-return')).to_be_in_viewport()
        self.shot(f'{cid}-01-located')
        panel=self.page.locator(f'#panel-understanding-{area}')
        # Both roles and their actual short text are read on this screen (not only present in the DOM).
        for sel,label in [('#panel-idea .source-meta','user idea role label'),('#panel-idea .area-idea-text','user idea text'),
                          (f'#panel-understanding-{area} > .source-meta','description role label'),(f'#panel-understanding-{area} .understanding-summary','description summary text')]:
            self.readable(sel,f'located panel: {label}')
        expect(self.page.locator('#panel-idea')).to_contain_text(c['note'][:20]);expect(panel).to_contain_text('전달 기록에서 정리한 설명 · 앱 미검증')
        expect(panel.locator('.understanding-summary')).to_contain_text(c['summary'][:30]);expect(panel).to_contain_text('구상 변경 제안 · 미채택')
        expect(panel).to_contain_text('사용자 구상은 그대로예요')
        self.check_true('read: summary text painted in the panel',self.seen(f'#panel-understanding-{area}',c['summary'][:20],'summary seen')['shown'])
        # Evidence: read only. Nothing is picked or continued; no POST.
        ev=self.page.locator(f'#panel-understanding-{area}-evidence');ev.locator('> summary').click();expect(ev).to_have_attribute('open','')
        expect(ev).to_contain_text(c['report'][:20]);self.check('evidence read: project unchanged',self.state(),s_start);self.check('evidence read: no POST',self.posts,[])
        self.shot(f'{cid}-02-evidence');ev.locator('> summary').click()
        # Explicit report read from the panel's request list, then back to the located view.
        self.page.locator(f'#panel-task-{A}').click();expect(self.page.locator('#task-view')).to_be_visible()
        self.page.locator(f'#task-report-pick-{R}').click();expect(self.page.locator('#task-pointed')).to_contain_text('현재 영역 설명에 반영')
        self.check('report read: current work and draft target unchanged',(self.state()['currentTaskId'],self.state()['space']['draftTarget']),(s_start['currentTaskId'],s_start['space']['draftTarget']))
        self.page.locator('#task-return-origin').click();expect(self.page.locator('#located-note')).to_be_visible()
        # Back to the start view: viewport, scale, selection, open disclosures, scroll, focus.
        self.page.locator('#locate-return').click();end=self.snap('back to start view',area)
        for k in ('styleTransform','computedTransform','scaleLabel','selected','openDetails','focusId'):self.check(f'[원래 배율·좌표 복귀] {k}',end[k],start[k])
        self.check_true('[원래 배율·좌표 복귀] page scroll (wheel round trip)',abs(end['windowY']-start['windowY'])<=2,[end['windowY'],start['windowY']])
        self.check('[원래 배율·좌표 복귀] card rect on screen',end['card'],start['card'])
        expect(self.page.locator('#located-note')).to_have_count(0);expect(self.page.locator('#panel-note')).to_have_value(BUFFER)
        # --- path 3: locate -> the panel's '영역 열기' -> read a task in that area -> back -> to the view before locating ---
        self.page.locator(f'#received-area-{area}').focus();start2=self.snap('start view 2',area)
        self.page.locator(f'#received-area-{area}').click();self.page.locator('#panel-open').click();expect(self.page.locator('#space-title')).to_have_text(c['area'])
        expect(self.page.locator('#locate-return')).to_be_visible();self.readable('#locate-return','area screen: way back before locating')
        self.page.locator(f'#task-open-{A}').click();expect(self.page.locator('#task-view')).to_be_visible();self.page.locator('#task-return-origin').click()
        expect(self.page.locator('#space-title')).to_have_text(c['area']);expect(self.page.locator('#locate-return')).to_be_visible()
        if cid=='product13':
            # Variant: the crumb back to the whole space keeps the way back (same located area), then return.
            self.page.locator('#space-crumb-root').click();expect(self.page.locator('#located-note')).to_be_visible()
        self.page.locator('#locate-return').click();end2=self.snap('back to start view 2 (via area screen)',area)
        for k in ('styleTransform','computedTransform','scaleLabel','selected','openDetails','focusId'):self.check(f'[원래 배율·좌표 복귀] via area screen: {k}',end2[k],start2[k])
        self.check_true('[원래 배율·좌표 복귀] via area screen: page scroll',abs(end2['windowY']-start2['windowY'])<=2,[end2['windowY'],start2['windowY']])
        # Plain navigation away (nav-work) and back (nav-space) is a new start: the way back is dropped.
        self.page.locator(f'#received-area-{area}').click();expect(self.page.locator('#located-note')).to_be_visible()
        self.page.locator('#nav-work').click();self.page.locator('#nav-space').click();expect(self.page.locator('#located-note')).to_have_count(0)
        self.check('[원래 배율·좌표 복귀] stored layout untouched by camera moves',self.state()['space']['layout'],kept['layout'])
        # Next handoff from the received report: the actual copied text and its record.
        # The full text shown before copying is what the copy carries (after copying the preview shows the next revision's text).
        self.page.locator('#nav-work').click();prev=self.page.locator('#handoff-preview');prev.locator('> summary').click();expect(self.page.locator('#handoff-text')).to_be_visible()
        shown=self.page.locator('#handoff-text').input_value();self.shot(f'{cid}-03-handoff-preview');prev.locator('> summary').click();expect(self.page.locator('#handoff-text')).to_be_hidden()
        self.page.locator('#copy-work').click();expect(self.page.locator('#notice')).to_contain_text('클립보드에 복사')
        nxt=self.clipboard();self.check('preview shown before copying = the copied text',shown,nxt);self.record('raw','next handoff text (clipboard)',nxt);hn=self.task(self.state()['currentTaskId'])['handoffs'][-1];self.check_record('next handoff',nxt,hn)
        i,j=nxt.find('## 현재 사용자 구상'),nxt.find('## 영역 현재 설명 — 전달 기록을 정리한 참고 설명 · 앱 미검증')
        self.check_true('next handoff: user plan first, then the attributed description',0<i<j,[i,j])
        self.check_true('next handoff: description text and its source',c['summary'] in nxt and c['origin'] in nxt)
        self.check_true('next handoff: proposal marked unadopted and not an instruction',('미채택 제안 · 사용자가 채택하지 않음 · 실행·반영하지 말 것' in nxt) and c['proposal'] in nxt and c['proposal'] not in nxt[:j])
        s=self.state();self.check('end: unsent draft body/kind/target',(s['draft'],s['draftKind'],s['space']['draftTarget']),(UNSENT,'request',{'area':other}))
        self.check('end: user idea/name/purpose unchanged',(s['space']['areas'],s['space']['brief']),(kept['areas'],kept['brief']))
        return area,other,A,R

    def located_ok(self,label,loc,area,before):
        self.check(f'[명시 위치 보기 대상 보임] {label}: target selected, panel open',loc['selected'],area);self.check(f'[명시 위치 보기 대상 보임] {label}: located mark',loc['located'],True)
        self.check(f'[명시 위치 보기 대상 보임] {label}: target inside the visible map',loc['offscreen'],False)
        self.check_true(f'[명시 위치 보기 대상 보임] {label}: card inside the map box',inside(loc['card'],loc['map'],0.5),[loc['card'],loc['map']])
        self.check_true(f'[명시 위치 보기 대상 보임] {label}: card not covered by the panel',not overlaps(loc['card'],loc['panel']),[loc['card'],loc['panel']])
        self.check_true(f'[명시 위치 보기 대상 보임] {label}: card in the window',loc['card']['y']>=0 and loc['card']['bottom']<=loc['vh'],loc['card'])
        scaled='축소했어요' in (self.page.locator('#located-note').inner_text() if self.page.locator('#located-note').count() else '')
        self.record('actual',f'{label}: scale before/after, said zoomed out',[before['scaleLabel'],loc['scaleLabel'],scaled])
        self.check(f'[명시 위치 보기 대상 보임] {label}: scale unchanged unless the card cannot fit (and then it says so)',loc['scaleLabel']!=before['scaleLabel'],scaled)
        note=self.page.evaluate('()=>{const e=document.getElementById("located-note");if(!e)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom}}')
        self.check_true(f'[명시 위치 보기 대상 보임] {label}: card not covered by the return line',not overlaps(loc['card'],note),[loc['card'],note])
        self.check(f'{label}: no horizontal page scroll',loc['docWidth'],self.WIDTH)

    def test_01_powertoys_full_flow(self):self.flow('powertoys')
    def test_02_product13_full_flow(self):self.flow('product13')

    # ---------- counterexamples: duplicate, revised, stale draft, user correction, late input, wrong basis, wrong prose, detail IDs ----------
    def test_03_counterexamples_and_correction_draft(self):
        c=CASES['powertoys'];area,other=self.start(c);A=self.request_in(area,c['request'])
        text,h=self.file_export(A,'download');self.check_record('download file export',text,h)
        s=self.state();p1,_=self.result_file('r1',s,A,h['returnId'],c,area,0);self.import_file(p1)
        n=len(self.state()['tasks']);self.import_file(p1,'새 기록은 추가하지 않았습니다');self.check('exact duplicate: no new record',len(self.state()['tasks']),n)
        # Correction draft started on r1, then r2 (same returnId, revised interpretation) arrives.
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click()
        ed=self.page.locator(f'#area-understanding-{area}-edit');ed.locator('> summary').click()
        field=self.page.locator(f'#area-understanding-{area}-text');DRAFT='[합성 · 사용자 정정 초안] r1을 읽고 고치던 글';field.fill(DRAFT)
        p2,_=self.result_file('r2',self.state(),A,h['returnId'],c,area,0,summary='[합성 · 같은 반환의 수정 해석] 검색어 제출 시 필터 결과의 첫 항목을 고른다.')
        self.import_file(p2);self.check('revised same returnId: applied as r2',self.state()['space']['understanding'][area]['revision'],2)
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click()
        expect(self.page.locator(f'#area-understanding-{area}-stale')).to_be_visible();expect(field).to_have_value(DRAFT)
        before=self.state();self.page.locator(f'#area-understanding-{area}-save').click();expect(self.page.locator('#notice')).to_contain_text('저장하지 않았어요')
        self.check('stale draft: save refused (no new revision)',self.state()['space']['understanding'],before['space']['understanding']);expect(field).to_have_value(DRAFT)
        self.shot('03-stale-correction-draft')
        self.page.locator(f'#area-understanding-{area}-cancel').click();ed=self.page.locator(f'#area-understanding-{area}-edit')
        if not ed.evaluate('(e)=>e.open'):ed.locator('> summary').click()
        expect(field).to_have_value('[합성 · 같은 반환의 수정 해석] 검색어 제출 시 필터 결과의 첫 항목을 고른다.')
        field.fill('[합성 · 사용자 정정] r2를 읽고 고친 설명');self.page.locator(f'#area-understanding-{area}-save').click();base.saved(self.page)
        st=self.state()['space']['understanding'][area];self.check('correction: user entry r3 correcting r2',(st['revision'],st['entries'][-1]['by'],st['entries'][-1]['corrects']),(3,'user',2))
        self.check('correction: the user idea itself unchanged',self.state()['space']['areas'][0]['note'],c['note'])
        # Late interpretation for the same export after the correction: held, report kept.
        p3,_=self.result_file('r3-late',self.state(),A,h['returnId'],c,area,0,summary='[합성 · 늦은 해석] 정정을 덮으려는 옛 기준 설명')
        self.import_file(p3);st=self.state()['space']['understanding'][area];self.check('late input after correction: held as superseded',(st['revision'],st['entries'][-1]['held']),(3,'superseded'))
        # A new export with a wrong basis in the file: held; the report stays readable.
        t2,h2=self.file_export(self.state()['currentTaskId'])
        p4,_=self.result_file('r4-basis',self.state(),self.state()['currentTaskId'],h2['returnId'],c,area,99);self.import_file(p4)
        st=self.state()['space']['understanding'][area];self.check('wrong basis: held as file-basis',st['entries'][-1]['held'],'file-basis')
        # Synthetic wrong prose with a correct target/basis: structurally valid, shown with its role, correctable. Not detection.
        t3,h3=self.file_export(self.state()['currentTaskId'])
        p5,_=self.result_file('r5-synthetic-conflict',self.state(),self.state()['currentTaskId'],h3['returnId'],c,area,h3['anchor']['understanding'],summary=c['conflict'],proposal=None,changes=[])
        self.import_file(p5);self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click()
        box=self.page.locator(f'#area-understanding-{area}');expect(box).to_contain_text(c['conflict'][:20]);expect(box).to_contain_text('앱 미검증')
        expect(self.page.locator(f'#area-understanding-{area}-edit')).to_be_visible()
        self.check('synthetic wrong prose: user idea unchanged',self.state()['space']['areas'][0]['note'],c['note'])
        hist=self.page.locator(f'#area-understanding-{area}-history');hist.locator('> summary').click()
        expect(hist).to_contain_text('그 뒤 설명이나 사용자 정정이 있어');expect(hist).to_contain_text('파일의 설명 기준이 실제 인계 기록과 달라요');expect(hist).to_contain_text('사용자 정정 기록')
        self.shot('04-synthetic-conflict-history')
        # Disclosure IDs are per area: opening A's evidence never opens B's.
        B=self.request_in(other,'[합성] 비교 영역 요청');tb,hb=self.file_export(B)
        pb,_=self.result_file('b1',self.state(),B,hb['returnId'],{**c,'summary':'[합성] 비교 영역 설명','proposal':None,'changes':[]},other,0);self.import_file(pb)
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{area}').click()
        self.page.locator(f'#panel-understanding-{area}-evidence > summary').click();expect(self.page.locator(f'#panel-understanding-{area}-evidence')).to_have_attribute('open','')
        self.page.locator(f'#node-info-{other}').click();expect(self.page.locator(f'#panel-understanding-{other}-evidence')).to_be_visible()
        self.check('details IDs per area: B evidence starts closed',self.page.locator(f'#panel-understanding-{other}-evidence').evaluate('(e)=>e.open'),False)

    # ---------- long content: short by default, everything one disclosure away, stored text unchanged ----------
    def test_04_long_description_reading_load(self):
        c=dict(CASES['product13']);area,other=self.start(c);A=self.request_in(area,c['request']);text,h=self.file_export(A)
        lines=lambda tag,n:(f'[합성 장문 {tag}] '+'영역 지도와 선택상세의 현재 이해를 길게 적은 문장입니다. '*80)[:n-len(f' ZZ-{tag}-END')]+f' ZZ-{tag}-END'
        summary,changes,proposal=lines('SUMMARY',2000),[lines(f'CHANGE{i}',300) for i in (1,2,3)],lines('PROPOSAL',1000)
        path,f=self.result_file('long',self.state(),A,h['returnId'],c,area,0,summary=summary,changes=changes,proposal=proposal);self.import_file(path)
        self.check('long: stored raw file unchanged',self.state()['tasks'][-1]['resultFile']['rawText'],path.read_text(encoding='utf-8'))
        self.page.locator('#nav-work').click();self.page.locator('#result-show-area').click()
        sel=f'#panel-understanding-{area}';hp=self.height(sel,'panel description block (default)');self.shot('05-long-panel')
        for m in ('ZZ-SUMMARY-END','ZZ-CHANGE1-END','ZZ-CHANGE3-END','ZZ-PROPOSAL-END'):self.check(f'long panel default: {m} not painted',self.seen(sel,m,f'panel {m}')['shown'],False)
        self.check_true('long panel default: block is short (<= 400px, <= 400 chars)',hp['h']<=400 and hp['chars']<=400,hp)
        self.page.locator(f'#panel-understanding-{area}-full > summary').click()
        for m in ('ZZ-SUMMARY-END','ZZ-CHANGE3-END','ZZ-PROPOSAL-END'):self.check(f'long panel full: {m} present',self.page.locator(f'#panel-understanding-{area}-full').inner_text().count(m),1)
        self.page.locator(f'#panel-open').click();sel=f'#area-understanding-{area}';ha=self.height(sel,'area screen description block (default)')
        self.check_true('long area screen default: block is short (<= 420px, <= 700 chars)',ha['h']<=420 and ha['chars']<=700,ha)
        # Area screen (existing PC12 head shows the idea text under the title, without a role label): the idea text, the
        # description role label and the start of the description summary are each readable on the first screen.
        for sel,label in [('.space-head .space-brief, #area-idea .area-idea-text','user idea text (area head)'),(f'#area-understanding-{area} > .source-meta','description role label'),
                          (f'#area-understanding-{area} .understanding-summary','description summary text')]:
            self.readable(sel,f'long area screen: {label}')
        self.shot('06-long-area-screen')


Area17.test_05_next_request_carries_valid_description=lambda self:self.next_request('powertoys')
def next_request(self,cid):
    c=CASES[cid];area,other=self.start(c);A=self.request_in(area,c['request']);text,h=self.file_export(A)
    path,f=self.result_file('next',self.state(),A,h['returnId'],c,area,h['anchor']['understanding']);self.import_file(path)
    # The user writes the next request in the same area from the located panel (idea and conditions unchanged), sends it, copies.
    self.page.locator('#result-show-area').click();self.page.locator('#panel-new-request').click()
    N=self.send_next(area,'[합성] 같은 영역의 다음 요청 · 구상과 조건은 그대로')
    self.page.locator('#nav-work').click();self.page.locator('#copy-work').click();expect(self.page.locator('#notice')).to_contain_text('클립보드에 복사')
    t=self.clipboard();self.record('raw','next request handoff (clipboard)',t);self.check_record('next request handoff',t,self.task(N)['handoffs'][-1])
    j=t.find('## 영역 현재 설명 — 전달 기록을 정리한 참고 설명 · 앱 미검증')
    self.check_true('next request handoff: valid description carried, attributed, after the user plan',j>0 and c['summary'] in t and c['origin'] in t and 0<t.find('## 현재 사용자 구상')<j,j)
    self.check_true('next request handoff: proposal only as unadopted reference',c['proposal'] not in t[:j] and '미채택 제안 · 사용자가 채택하지 않음' in t)
    # An explicit change of the user's idea makes it stale: the next copy leaves its text out and says so.
    self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{area}').click();self.page.locator('#panel-edit > summary').click()
    self.page.locator('#panel-note').fill('[합성] 사용자가 명시적으로 바꾼 구상');self.page.locator('#panel-save').click();base.saved(self.page)
    self.page.locator('#nav-work').click();self.page.locator('#copy-work').click();expect(self.page.locator('#notice')).to_contain_text('클립보드에 복사')
    t2=self.clipboard();self.record('raw','handoff after explicit idea change (clipboard)',t2)
    self.check_true('after explicit idea change: description text excluded and the exclusion stated',c['summary'] not in t2 and '현재 설명으로 쓰지 않습니다' in t2)
Area17.next_request=next_request
def send_next(self,area,body):
    """Send the composer's request and prove it really became a new request task in the area (not ignored or refused)."""
    before=self.state();self.page.locator('#draft').fill(body);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
    s=self.state();N=s['currentTaskId'];t=self.task(N,s);src=next(x for x in s['sources'] if x['id']==t['sourceIds'][0])
    self.check('next request: one new task',len(s['tasks']),len(before['tasks'])+1);self.check_true('next request: a new current task',N!=before['currentTaskId'] and N==s['tasks'][-1]['id'],[before['currentTaskId'],N])
    self.check('next request: source kind and exact body',(src['kind'],src['text']),('request',body));self.check('next request: written in the same area',t.get('areaId'),area)
    return N
Area17.send_next=send_next
def locate_new_request(self,cid):
    """Whole path: receive -> explicit locate -> the panel's '이 영역에 새 요청' -> send -> copy -> explicit way back to the view before locating."""
    c=CASES[cid];area,other=self.start(c);A=self.request_in(area,c['request']);text,h=self.file_export(A)
    path,f=self.result_file('locate-next',self.state(),A,h['returnId'],c,area,h['anchor']['understanding']);self.import_file(path)
    self.make_offscreen(area,other);self.page.locator(f'#received-area-{area}').focus();start=self.snap('locate-new-request: start view (before locating)',area)
    self.page.locator(f'#received-area-{area}').click();self.located_ok('locate-new-request',self.snap('locate-new-request: located',area),area,start)
    self.page.locator('#panel-new-request').click();N=self.send_next(area,'[합성] 위치를 찾은 영역의 다음 요청 · 구상과 조건은 그대로')
    self.page.locator('#copy-work').click();expect(self.page.locator('#notice')).to_contain_text('클립보드에 복사')
    t=self.clipboard();self.check_record('locate-new-request handoff',t,self.task(N)['handoffs'][-1])
    self.check_true('locate-new-request handoff: valid description carried',c['summary'] in t and '## 영역 현재 설명 — 전달 기록을 정리한 참고 설명 · 앱 미검증' in t)
    back=self.page.locator('#work-locate-return');self.check('locate-new-request: explicit way back offered in the work view',back.count(),1)
    self.readable('#work-locate-return','work view: way back before locating');self.shot(f'{cid}-07-locate-new-request-work')
    back.click();end=self.snap('locate-new-request: back to start view',area)
    for k in ('styleTransform','computedTransform','scaleLabel','selected','openDetails','focusId'):self.check(f'[원래 배율·좌표 복귀] after new request: {k}',end[k],start[k])
    # Sending the request adds records above the map (real content change), so the existing return keeps the reading place
    # (PC12 fix2 anchor) instead of the raw scroll value: same window scroll, or the same on-screen card position.
    self.check_true('[원래 배율·좌표 복귀] after new request: reading place (scroll, or on-screen card y when content above grew)',
        abs(end['windowY']-start['windowY'])<=2 or abs(end['card']['y']-start['card']['y'])<=2,
        {'windowY':[end['windowY'],start['windowY']],'cardY':[end['card']['y'],start['card']['y']],'mapY':[end['map']['y'],start['map']['y']]})
    expect(self.page.locator('#panel-note')).to_have_value(BUFFER);expect(self.page.locator('#located-note')).to_have_count(0)
    # Another area is a new start: writing in it drops the way back.
    self.page.locator(f'#received-area-{area}').click();self.page.locator(f'#node-info-{other}').evaluate('(e)=>e.click()');self.page.locator('#panel-new-request').click()
    self.check('another area: no way back to the earlier locate',self.page.locator('#work-locate-return').count(),0)
Area17.locate_new_request=locate_new_request
Area17.test_06_locate_new_request_copy_and_return=lambda self:self.locate_new_request('product13')


class Area17Wide(Area17):WIDTH,HEIGHT=1440,900


if __name__=='__main__':unittest.main(verbosity=2)
