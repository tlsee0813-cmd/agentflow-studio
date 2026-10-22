"""AREA18: same product renderer, native Chromium/HTTP and explicit MOCK, two PC sizes.
Source fixtures are bounded analyst reconstructions, not original users' hierarchies. The extra question, long text,
overlapping coordinates and relation combinations are labelled synthetic boundaries. Recovery/file inputs use the real
product controls; no localStorage injection, alternate HTML or paid AI. Every condition is recorded before assertion.
Run from app/: python continuity/tests/hierarchy18_browser.py. Local execution requires explicit server permission.
"""
import json, subprocess, unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base

def clipboard_lf(raw):
    """Existing Windows clipboard representation rule (USE106): replace CRLF pairs only."""
    return raw.replace('\r\n','\n')

APP=Path(__file__).resolve().parents[2]
OBS=base.OUT/'hierarchy18-observations.jsonl'
OBS.write_text('',encoding='utf-8')
SEED=r"""
import {hierarchyCases,hierarchySample} from './continuity/tests/hierarchy18-fixtures.mjs';
import * as D from './continuity/dist/public/shared/domain.js';
import {mockAdvice} from './continuity/dist/public/shared/mock.js';
const c=hierarchyCases.find(c=>c.id===process.argv[1]),s=hierarchySample(c),mode=process.argv[2];let p=s.p;
const begun=D.begin(p),advice=mockAdvice(begun.request);advice.question={kind:'fact',text:'[합성 경계] 이 사례 원자료에는 없는 기록된 질문',why:'하위 질문의 실제 소유자를 찾는 배선 검사이며 실제 사용자 미결 아님',options:[]};
p=D.receive(begun.project,begun.request,{mode:'mock',ticket:begun.request.ticket,advice});
if(mode==='overlap'){
 const points={editor:[0,0],search:[0,600],input:[800,600],record:[800,0],hook:[400,300]};
 for(const [key,[x,y]] of Object.entries(points))p=D.moveArea(p,s.ids[key],{x,y});
}
if(mode==='relations'){
 for(const [from,to,kind,note] of [['editor','hook','flow','[합성] 직접'],['input','hook','flow','[합성] 숨은1'],['search','hook','flow','[합성] 숨은2'],['hook','input','flow','[합성] 반대'],['input','hook','needs','[합성] 다른종류'],['search','input','related','[합성] 내부']])p=D.addRelation(p,s.ids[from],s.ids[to],kind,note);
}
if(mode==='long'){
 const a=p.space.areas.find(a=>a.id===s.area);p=D.editArea(p,a.id,'긴제목'.repeat(20),'https://example.invalid/'+ 'x'.repeat(1976));
 for(let i=0;i<5;i++)p=D.submit(D.editDraft(p,`[합성 긴 요청 ${i}] `+'근거읽기 '.repeat(140)),undefined,s.area);
}
console.log(JSON.stringify({...s,p,c,mode,synthetic:'질문/긴문자/좌표 겹침/추가 관계는 원자료 밖의 합성 경계'}));
"""
GEOM=r'''()=>{const b=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
 const body=document.getElementById('area-panel-body'),map=document.getElementById('space-map'),panel=document.getElementById('area-panel');
 return {map:b(map),panel:b(panel),head:b(document.querySelector('.panel-top')),actions:b(document.getElementById('panel-actions')),body:b(body),
 scroll:body&&body.scrollTop,scrollHeight:body&&body.scrollHeight,windowY:scrollY,width:innerWidth,height:innerHeight,docWidth:document.documentElement.scrollWidth,
 transform:document.getElementById('space-plane').style.transform,scale:document.getElementById('map-scale').textContent,
 visible:[...document.querySelectorAll('.area-node')].map(e=>e.dataset.areaId),selected:(document.querySelector('.area-node.selected')||{dataset:{}}).dataset.areaId||null,
 collapsed:[...document.querySelectorAll('.branch-toggle[aria-expanded="false"]')].map(e=>e.id.replace('branch-toggle-','')),
 open:[...document.querySelectorAll('#area-panel-body details[open]')].map(e=>e.id),focus:document.activeElement.id}}'''
HIT=r'''(sel)=>{const e=document.querySelector(sel);if(!e||!e.getClientRects().length)return {found:!!e,hit:false};const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,h=document.elementFromPoint(x,y);return {found:true,hit:!!h&&e.contains(h),x,y,inside:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}}'''

class Area18(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown
    state=base.Browser.state

    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        self.ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=self.url)
    def record(self,kind,name,value,expected=None):
        rec={'test':self.id(),'pc':[self.WIDTH,self.HEIGHT],'kind':kind,'name':name,'value':value}
        if kind=='condition':rec['expected']=expected
        with OBS.open('a',encoding='utf-8') as f:f.write(json.dumps(rec,ensure_ascii=False)+'\n')
    def equal(self,name,value,expected):self.record('condition',name,value,expected);self.assertEqual(value,expected,name)
    def yes(self,name,value):self.record('condition',name,bool(value),True);self.assertTrue(value,name)
    def snap(self,name):
        value=self.page.evaluate(GEOM);self.record('actual',name,value);return value
    def reading(self,id):
        value=self.page.locator('#'+id).evaluate('(e)=>{const b=document.getElementById("area-panel-body");return {top:e.getBoundingClientRect().top-b.getBoundingClientRect().top,scroll:b.scrollTop,max:Math.max(0,b.scrollHeight-b.clientHeight)}}')
        self.record('actual','panel reading anchor '+id,value);return value
    def reading_restored(self,name,before,after):
        expected=max(0,min(after['max'],after['scroll']+after['top']-before['top']))
        self.record('actual',name+' expected clamped scroll',{'before':before,'after':after,'expected':expected})
        self.yes(name,abs(after['scroll']-expected)<=2)
    def shot(self,name):
        self.page.mouse.move(1,1);self.page.screenshot(path=str(base.OUT/f'area18-{self.WIDTH}x{self.HEIGHT}-{name}.png'))
    def disclosure(self,id,opened=True):
        loc=self.page.locator('#'+id)
        if loc.evaluate('(e)=>e.open')!=opened:loc.locator('> summary').click()
    def select(self,id):
        self.page.locator('#map-fit').click();self.page.locator(f'#node-info-{id}').click()
        expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id',id)
    def open_relations(self):
        self.page.locator('#map-relations-open').click();expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id','@relations')
    def file_export(self,tid):
        # Stay in the located work view: nav-work is a new navigation and would discard its explicit return.
        self.equal('file export uses the actual open request',self.state()['currentTaskId'],tid)
        count=len(next(t for t in self.state()['tasks'] if t['id']==tid)['handoffs'])
        self.disclosure('file-return-options');self.page.locator('#copy-file-work').click()
        expect(self.page.locator('#notice')).to_contain_text('클립보드에 복사');raw=self.page.evaluate('()=>navigator.clipboard.readText()')
        self.record('raw','actual clipboard OS text before CRLF-pair comparison normalization',raw);text=clipboard_lf(raw);base.saved(self.page)
        handoffs=next(t for t in self.state()['tasks'] if t['id']==tid)['handoffs'];record=handoffs[-1]
        self.equal('explicit file-return export adds one stored handoff',len(handoffs),count+1)
        self.yes('file-return handoff has an actual return ID and anchor',bool(record['returnId']) and record['anchor'] is not None)
        actual=self.page.evaluate("t=>{let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)}return {chars:t.length,digest:(h>>>0).toString(16).padStart(8,'0')}}",text)
        self.equal('clipboard CRLF-pair comparison text matches stored handoff chars/digest',actual,{'chars':record['chars'],'digest':record['digest']})
        self.yes('actual copied text contains this file-return ID',record['returnId'] in text)
        return text,record
    def load(self,cid='powertoys',mode='normal'):
        s=json.loads(subprocess.check_output(['node','--input-type=module','-e',SEED,cid,mode],cwd=APP,text=True,encoding='utf-8'))
        self.record('source','fixture provenance and synthetic boundary',{'metadata':s['metadata'],'synthetic':s['synthetic'],'mode':mode})
        path=base.OUT/f'area18-{self.WIDTH}-{cid}-{mode}-recovery.json';path.write_text(json.dumps(s['p'],ensure_ascii=False),encoding='utf-8')
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(path))
        expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요')
        self.page.locator('#nav-space').click();self.page.locator('#map-fit').click();return s
    def receive(self,s):
        path=base.OUT/f'area18-{self.WIDTH}-{s["c"]["id"]}-return.json';path.write_text(json.dumps(s['file'],ensure_ascii=False),encoding='utf-8')
        self.page.locator('#nav-work').click();self.disclosure('compose-panel');self.disclosure('result-file-panel');self.page.locator('#result-file-input').set_input_files(str(path));self.page.locator('#accept-result-file').click()
        expect(self.page.locator('#result-file-message')).to_contain_text('앱 미검증');base.saved(self.page)
    def geometry_ok(self,name):
        g=self.snap(name)
        for k in ['map','panel','head','actions','body']:self.yes(f'{name}: {k} exists',g[k] is not None)
        self.yes(f'{name}: workspace uses remaining viewport',abs(g['map']['bottom']-(self.HEIGHT-16))<=3)
        self.yes(f'{name}: map and panel same height',abs(g['map']['h']-g['panel']['h'])<=2)
        self.yes(f'{name}: map at least two thirds of workspace',g['map']['w']/(g['map']['w']+g['panel']['w'])>=0.65)
        self.yes(f'{name}: real body row between header and actions',g['body']['y']>=g['head']['bottom']-1 and g['body']['bottom']<=g['actions']['y']+1)
        self.equal(f'{name}: no horizontal page overflow',g['docWidth'],self.WIDTH)
        for sel in ['#area-panel-close','#panel-open','#panel-new-request']:
            hit=self.page.evaluate(HIT,sel);self.record('actual',f'{name}: action hit-test {sel}',hit);self.yes(f'{name}: action visible and unobscured {sel}',hit['hit'] and hit['inside'])
        return g
    def flow(self,cid):
        s=self.load(cid);ids=s['ids'];branch=ids[s['c']['parent']];area=s['area'];positions=self.state()['space']['layout']
        before=self.snap('expanded')
        self.page.locator(f'#branch-toggle-{branch}').click();closed=self.snap('one branch collapsed')
        self.yes('leaf hidden by its collapsed ancestor',area not in closed['visible'])
        self.yes('coarse sibling / external hook remains visible',ids[s['c']['other']] in closed['visible'])
        self.equal('collapse does not zoom',closed['scale'],before['scale'])
        self.page.locator('#map-zoom-in').click();zoomed=self.snap('zoom while branch collapsed')
        self.equal('zoom does not expand the branch',zoomed['collapsed'],closed['collapsed'])
        self.receive(s);self.page.locator('#nav-space').click()
        received=self.snap('received while collapsed');self.equal('receiving preserves collapsed branch',received['collapsed'],closed['collapsed'])
        self.equal('receiving preserves camera',received['transform'],zoomed['transform'])
        self.yes('receiving does not silently reveal leaf',area not in received['visible'])
        expect(self.page.locator(f'.area-node[data-area-id="{branch}"] .branch-signals')).to_contain_text('이번 탭 설명 갱신 1')
        # The actual source relation is retained: select its real endpoint from a projected bundle.
        self.open_relations();r=self.state()['space']['relations'][0];real_to=r['to']
        rel_start=self.snap('before real endpoint locate');rel_anchor=self.reading(f'relation-to-{r["id"]}')
        self.page.locator(f'#relation-to-{r["id"]}').click();endpoint=self.snap('actual relation endpoint located')
        self.equal('relation action selects the actual stored endpoint',endpoint['selected'],real_to)
        self.yes('actual endpoint is rendered after only needed ancestors open',real_to in endpoint['visible'])
        self.equal('relation endpoint action does not force zoom',endpoint['scale'],rel_start['scale'])
        expect(self.page.locator('#locate-return')).to_be_visible()
        # A real endpoint also completes request/handoff/return from the relation reader. Product13 takes the area route.
        endpoint_count=len(self.state()['tasks'])
        if cid=='product13':self.page.locator('#panel-open').click();self.page.locator('#area-new-request').click()
        else:self.page.locator('#panel-new-request').click()
        endpoint_body='[합성 연결 끝점 요청] 이 도착 부분의 명시 범위만 확인한다.'
        self.page.locator('#draft').fill(endpoint_body);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        endpoint_state=self.state();endpoint_task=next(t for t in endpoint_state['tasks'] if t['id']==endpoint_state['currentTaskId'])
        self.equal('relation route creates one real task',len(endpoint_state['tasks']),endpoint_count+1);self.equal('relation route task belongs to actual endpoint',endpoint_task['areaId'],real_to)
        endpoint_text,endpoint_export=self.file_export(endpoint_task['id']);self.record('comparison','relation endpoint handoff (clipboard; CRLF pairs normalized)',endpoint_text)
        self.yes('relation route copied actual new request',endpoint_body in endpoint_text)
        self.equal('relation route export anchor uses actual endpoint',endpoint_export['anchor']['areaId'],real_to)
        self.page.locator('#work-locate-return').click();expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id','@relations')
        rel_back=self.snap('back from real endpoint')
        for k in ['transform','collapsed','selected']:self.equal(f'endpoint explicit return restores {k}',rel_back[k],rel_start[k])
        self.reading_restored('relation reader anchor restored',rel_anchor,self.reading(f'relation-to-{r["id"]}'))
        # The synthetic question is distinct from the source-backed description; both retain the true leaf owner.
        self.select(branch);self.disclosure(f'subtree-records-{branch}')
        records=self.page.locator(f'#subtree-records-{branch}')
        expect(records).to_contain_text('기록된 질문');expect(records).to_contain_text('답변 기록 없음');expect(records).to_contain_text('현재 설명 있음')
        self.equal('one recorded question at its actual owner',records.locator('.subtree-record',has_text='기록된 질문').count(),1)
        self.equal('question owner is the real leaf',records.locator('.subtree-record',has_text='기록된 질문').get_attribute('data-owner-area'),area)
        caller=f'subtree-description-{area}';self.page.locator('#'+caller).focus();start=self.snap('before descendant-description locate');start_anchor=self.reading(caller)
        self.page.locator('#'+caller).click();self.geometry_ok('leaf selected');self.shot(cid+'-leaf')
        self.equal('description action selects exact leaf',self.snap('description leaf')['selected'],area)
        expect(self.page.locator(f'#panel-understanding-{area} .understanding-summary')).to_contain_text(s['c']['summary'][:30])
        self.yes('panel path is root to actual leaf',all(n[1] in self.page.locator('#panel-path').inner_text() for n in s['c']['nodes'] if n[0] in [s['c']['target'],s['c']['leafParent']]))
        # Create a real new request, then copy its real handoff, before returning to the pre-locate state.
        count=len(self.state()['tasks']);body='[합성 후속 요청] 이 실제 하위 부분의 버튼 문구만 확인한다.'
        self.page.locator('#panel-new-request').click();self.equal('new request draft targets actual leaf',self.state()['space']['draftTarget'],{'area':area})
        self.page.locator('#draft').fill(body);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        after=self.state();tid=after['currentTaskId'];task=next(t for t in after['tasks'] if t['id']==tid)
        self.equal('new request really creates one task',len(after['tasks']),count+1);self.yes('new task has new identity',tid not in [t['id'] for t in s['p']['tasks']])
        self.equal('new task is owned by actual leaf',task['areaId'],area)
        source=next(x for x in after['sources'] if x['id']==task['sourceIds'][0]);self.equal('new task source kind/body',[source['kind'],source['text']],['request',body])
        text,leaf_export=self.file_export(tid)
        self.record('comparison','descendant handoff (clipboard; CRLF pairs normalized)',text);self.yes('handoff includes current child description',s['c']['summary'] in text)
        self.yes('handoff limits parent context authority','포함 맥락 참고' in text and '자식의 명시 범위·조건을 조상 참고로 확대·축소·대체하지 않습니다' in text)
        self.equal('stored handoff anchor still points to exact leaf',leaf_export['anchor']['areaId'],area)
        self.page.locator('#work-locate-return').click();back=self.snap('explicit return after new task and handoff')
        for k in ['transform','collapsed','selected','open','focus']:self.equal(f'full flow restores {k}',back[k],start[k])
        self.reading_restored('full flow restores panel reading anchor after real new content',start_anchor,self.reading(caller))
        expect(self.page.locator(f'#subtree-records-{branch}')).to_contain_text('기록된 질문')
        self.equal('recorded question remains one owned record after handoff',self.page.locator(f'#subtree-records-{branch} .subtree-record',has_text='기록된 질문').count(),1)
        self.equal('fold/read/receive/handoff never rewrites stored world positions',self.state()['space']['layout'],positions)
        self.shot(cid+'-returned')

    def test_01_powertoys_complete(self):self.flow('powertoys')
    def test_02_product13_complete(self):self.flow('product13')

    def test_03_false_frame_is_omitted_without_moving_cards(self):
        s=self.load(mode='overlap');before=self.state()['space']['layout'];parent=s['ids']['editor']
        marker=self.page.locator(f'.containment-group[data-parent-id="{parent}"]')
        expect(marker).to_have_attribute('data-frame-omitted','true');self.equal('misleading enclosing frame is absent',marker.locator('.containment-frame').count(),0)
        self.equal('fallback retains explicit inclusion links',marker.locator('.containment-links line').count(),2)
        hook=s['ids']['hook'];expect(self.page.locator(f'.area-node[data-area-id="{hook}"] .area-card-path')).to_have_text('독립 영역')
        for a in self.state()['space']['areas']:
            hit=self.page.evaluate(HIT,f'#node-info-{a["id"]}');self.yes('frame does not intercept card action '+a['name'],hit['hit'])
        self.equal('false-frame fallback does not repair user positions',self.state()['space']['layout'],before);self.shot('false-frame-fallback')

    def test_04_relation_bundle_counts_direction_kind_and_internal_list(self):
        s=self.load(mode='relations');self.receive(s);self.page.locator('#nav-space').click();a,b=s['ids']['editor'],s['ids']['hook'];self.page.locator(f'#branch-toggle-{a}').click();self.open_relations()
        group=self.page.locator(f'.relation-bundle[data-from="{a}"][data-to="{b}"][data-kind="flow"]')
        self.equal('direct plus two hidden relations in same direction/kind',group.locator('.relation-endpoints').count(),3)
        expect(group).to_contain_text('직접 연결 1 · 접힌 안쪽 연결 2')
        self.equal('opposite direction is separate',self.page.locator(f'.relation-bundle[data-from="{b}"][data-to="{a}"][data-kind="flow"] .relation-endpoints').count(),2)
        self.equal('different kind is separate',self.page.locator(f'.relation-bundle[data-from="{a}"][data-to="{b}"][data-kind="needs"] .relation-endpoints').count(),1)
        internal=self.page.locator(f'.relation-bundle[data-from="{a}"][data-to="{a}"]');self.equal('internal original retained in list',internal.locator('.relation-endpoints').count(),1)
        self.equal('no fake internal self-loop on canvas',self.page.locator(f'.relation-line[data-from="{a}"][data-to="{a}"]').count(),0)
        self.equal('every stored original relation has a recoverable endpoint row',self.page.locator('.relation-endpoints').count(),len(self.state()['space']['relations']))
        owners=self.page.locator('.relation-owner').evaluate_all('(es)=>es.map(e=>e.dataset.ownerArea)');self.equal('actual relation owners have no duplicate signal sections',len(owners),len(set(owners)))
        leaf=self.page.locator(f'#relation-owner-{s["area"]}');expect(leaf).to_contain_text('기록된 질문 1');expect(leaf).to_contain_text('현재 설명 있음')
        self.yes('relation list remains inside fixed workspace',self.snap('relation reader')['panel']['bottom']<=self.HEIGHT)
        self.page.locator('#area-panel-close').focus();self.page.keyboard.press('Escape');expect(self.page.locator('#area-panel')).to_have_count(0)
        self.equal('relation header Escape returns focus to its caller',self.page.evaluate('()=>document.activeElement.id'),'map-relations-open')

    def test_05_long_panel_scroll_reading_and_ime_escape(self):
        s=self.load(mode='long');a,b=s['area'],s['ids']['hook'];self.select(a);g=self.geometry_ok('long panel initial')
        self.disclosure('panel-idea-full');self.disclosure(f'panel-tasks-more-{a}');body=self.page.locator('#area-panel-body')
        self.yes('long reading really needs internal scroll',body.evaluate('(e)=>e.scrollHeight>e.clientHeight+100'))
        body.hover();self.page.mouse.wheel(0,560);self.page.wait_for_timeout(80);read=self.snap('after native wheel inside panel')
        self.yes('native wheel scrolls panel body',read['scroll']>50);self.equal('panel wheel does not pan map',read['transform'],g['transform']);self.equal('panel wheel does not scroll page',read['windowY'],g['windowY'])
        self.geometry_ok('long panel after scroll');self.shot('long-body-fixed-actions')
        self.select(b);self.select(a);again=self.snap('A to B to A reading')
        self.yes('A to B to A restores reading position',abs(again['scroll']-read['scroll'])<=2)
        self.yes('A to B to A restores explicit full-text disclosure','panel-idea-full' in again['open'])
        # Real list -> same saved entry: a hidden old panel must not overwrite the recalled reading memo.
        list_anchor=self.reading('panel-idea-full');entry=self.page.evaluate('()=>document.documentElement.dataset.entryId');self.page.locator('#nav-projects').click();expect(self.page.locator('#projects-view')).to_be_visible()
        self.page.locator(f'.project-card[data-entry-id="{entry}"] .project-open').click();expect(body).to_have_attribute('data-area-id',a)
        reopened=self.snap('project list to same area reading')
        new_max=body.evaluate('(e)=>Math.max(0,e.scrollHeight-e.clientHeight)');expected_scroll=min(again['scroll'],new_max)
        self.record('actual','project list reading clamped by new viewport',{'before':again['scroll'],'newMax':new_max,'expected':expected_scroll,'actual':reopened['scroll']})
        self.yes('project list roundtrip restores nonzero reading position within the new scroll limit',reopened['scroll']>50 and abs(reopened['scroll']-expected_scroll)<=2)
        self.reading_restored('project list retains the reading item with normal end clamp',list_anchor,self.reading('panel-idea-full'))
        self.yes('project list roundtrip preserves explicit full text','panel-idea-full' in reopened['open'])
        self.equal('project list roundtrip preserves selected owner',reopened['selected'],a)
        # A separate real, nonzero middle position must survive; an end clamp cannot conceal a reset to zero.
        body.focus();body.press('Home');body.press('PageDown');middle=self.reading('panel-idea-full')
        self.yes('setup has an actual middle reading position',middle['scroll']>50 and middle['scroll']<middle['max']-50)
        self.page.locator('#nav-projects').click();expect(self.page.locator('#projects-view')).to_be_visible();self.page.locator(f'.project-card[data-entry-id="{entry}"] .project-open').click();expect(body).to_have_attribute('data-area-id',a)
        middle_back=self.reading('panel-idea-full');self.reading_restored('project list restores the nonzero middle reading anchor',middle,middle_back)
        self.yes('middle reading stays nonzero',middle_back['scroll']>50);expect(self.page.locator('#panel-idea-full')).to_have_attribute('open','')
        self.disclosure('panel-edit');self.page.locator('#panel-note').fill('[합성 미저장] 지우지 않을 입력')
        self.page.locator('#panel-note').press('Escape');expect(body).to_be_visible();expect(self.page.locator('#panel-note')).to_have_value('[합성 미저장] 지우지 않을 입력')
        # Context stays open when returning to the map; protected panel Escape must not bubble into its global closer.
        self.page.locator('#nav-context').click();self.page.locator('#nav-space').click();self.select(a);self.disclosure('panel-edit')
        expect(self.page.locator('#context-panel')).to_be_visible();name=self.page.locator('#panel-name');name.fill('[합성 미저장] 이름 입력 보호')
        name.press('Escape');expect(name).to_be_focused();expect(self.page.locator('#context-panel')).to_be_visible();expect(body).to_be_visible()
        self.disclosure('connection-details');name.focus()
        # Explicitly synthetic keyboard probes; the wheel and regular Escape below are native Playwright inputs.
        name.dispatch_event('keydown',{'key':'Escape','isComposing':True,'bubbles':True,'cancelable':True});expect(name).to_be_focused();expect(self.page.locator('#context-panel')).to_be_visible();expect(self.page.locator('#connection-details')).to_have_attribute('open','');expect(body).to_be_visible()
        body.focus();body.evaluate("e=>{e.addEventListener('keydown',x=>x.preventDefault(),{once:true});e.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))}");expect(body).to_be_focused();expect(self.page.locator('#context-panel')).to_be_visible();expect(self.page.locator('#connection-details')).to_have_attribute('open','')
        expect(name).to_have_value('[합성 미저장] 이름 입력 보호');expect(self.page.locator('#panel-note')).to_have_value('[합성 미저장] 지우지 않을 입력')
        camera=self.snap('before panel close')['transform'];body.focus();self.page.keyboard.press('Escape');expect(self.page.locator('#area-panel')).to_have_count(0)
        expect(self.page.locator('#context-panel')).to_be_visible();expect(self.page.locator('#connection-details')).to_have_attribute('open','')
        self.equal('close focuses its card information action',self.page.evaluate('()=>document.activeElement.id'),f'node-info-{a}')
        self.equal('close is not camera restoration',self.snap('closed')['transform'],camera)
        self.page.keyboard.press('Escape');expect(self.page.locator('#connection-details')).not_to_have_attribute('open','');expect(self.page.locator('#context-panel')).to_be_visible()
        self.page.keyboard.press('Escape');expect(self.page.locator('#context-panel')).to_be_hidden()
        self.page.locator(f'#node-info-{a}').click();expect(self.page.locator('#panel-note')).to_have_value('[합성 미저장] 지우지 않을 입력')
        self.page.locator('#panel-skip-actions').focus();self.page.keyboard.press('Enter');self.equal('skip goes to pinned action',self.page.evaluate('()=>document.activeElement.id'),'panel-open')
        self.page.keyboard.press('Shift+Tab');self.yes('reverse Tab remains available',bool(self.page.evaluate('()=>document.activeElement.id')))

    def test_06_manual_child_parent_roundtrip_and_unsent_request_protection(self):
        s=self.load();self.receive(s);self.page.locator('#nav-space').click();a=s['area'];self.select(a);self.disclosure('panel-more')
        self.page.locator('#child-name').fill('[합성] 수동 하위 부분');self.page.locator('#child-note').fill('단계가 아닌 구성 부분');self.page.locator('#child-add').click()
        child=self.state()['space']['areas'][-1]['id'];self.equal('manual child records explicit parent',self.state()['space']['containment']['parents'][child],a)
        self.equal('manual add selects actual new child',self.snap('new child')['selected'],child)
        other=s['ids']['hook'];self.select(other);self.disclosure('panel-more');self.page.locator('#child-name').fill('[합성] 다른 부모의 하위 부분');self.page.locator('#child-add').click();self.page.locator('#map-fit').click();self.page.locator(f'#branch-toggle-{other}').click()
        self.select(a);self.disclosure('panel-more');select=self.page.locator('#area-parent');options=select.locator('option').evaluate_all('(es)=>es.map(e=>e.value)')
        self.yes('self and descendants cannot be chosen as parent',a not in options and child not in options)
        revision=self.state()['space']['containment']['revisions'][a];old=s['ids']['search'];other=s['ids']['hook']
        positions=self.state()['space']['layout'];select.select_option(other);self.page.locator('#area-parent-save').click()
        expect(self.page.locator(f'#branch-toggle-{other}')).to_have_attribute('aria-expanded','true');self.yes('membership change to collapsed parent keeps selected card visible',a in self.snap('membership changed')['visible'])
        self.equal('membership change does not rewrite positions',self.state()['space']['layout'],positions)
        self.disclosure('panel-more');self.page.locator('#area-parent').select_option(old);self.page.locator('#area-parent-save').click()
        self.equal('A to B to A keeps revision history',self.state()['space']['containment']['revisions'][a],revision+2)
        self.equal('identity survives explicit membership changes',next(x for x in self.state()['space']['areas'] if x['id']==a)['id'],a)
        expect(self.page.locator(f'#panel-understanding-{a}')).to_contain_text('현재 설명으로 쓰지 않아요')
        self.page.locator('#map-fit').click();self.page.locator(f'#branch-toggle-{old}').click();expect(self.page.locator(f'.area-node[data-area-id="{old}"] .branch-signals')).to_contain_text('이전 기준 1')
        self.page.locator(f'#branch-toggle-{old}').click();self.select(a)
        self.page.locator('#panel-open').click();self.page.locator('#area-archive').click();expect(self.page.locator('#notice')).to_contain_text('하위 부분이 남아')
        self.page.locator('#nav-space').click();self.select(other);self.page.locator('#panel-new-request').click();self.page.locator('#draft').fill('[합성 미전송] 다른 영역 입력')
        self.page.locator('#nav-space').click();self.select(a);self.page.locator('#panel-new-request').click()
        self.equal('existing unsent request kind/body/target survives another area CTA',[self.state()['draftKind'],self.state()['draft'],self.state()['space']['draftTarget']],['request','[합성 미전송] 다른 영역 입력',{'area':other}])

class Area18Wide(Area18):WIDTH,HEIGHT=1440,900

if __name__=='__main__':unittest.main()
