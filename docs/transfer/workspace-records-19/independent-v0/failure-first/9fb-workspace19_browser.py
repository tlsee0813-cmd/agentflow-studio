"""WORKSPACE19: existing renderer/runner, native Chromium HTTP + explicit MOCK, two PC sizes.
AREA18 source reconstructions are reused; extra requests/reports/long text are labelled synthetic. Fixtures enter through
the real recovery/result-file controls. No localStorage injection, alternate renderer or paid AI. Local execution is barred;
Cloud/CI run this after candidate freeze. Every expectation and actual geometry is recorded before assertion.
"""
import json,subprocess,unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base

APP=Path(__file__).resolve().parents[2]
OBS=base.OUT/'workspace19-observations.jsonl';OBS.write_text('',encoding='utf-8')
SEED="import {workspace19Fixture} from './continuity/tests/workspace19-fixtures.mjs'; console.log(JSON.stringify(workspace19Fixture(process.argv[1],process.argv[2]==='long')));"
GEOM=r'''()=>{const rect=e=>{if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
 const body=document.getElementById('area-panel-body'),map=document.getElementById('space-map'),panel=document.getElementById('area-panel');
 return {map:rect(map),panel:rect(panel),body:rect(body),head:rect(panel&&panel.querySelector('.panel-top')),actions:rect(document.getElementById('panel-actions')),
  notice:rect(document.getElementById('notice')),noticeText:document.getElementById('notice').hidden?null:document.getElementById('notice').textContent,
  error:rect(document.getElementById('storage-error')),scroll:body&&body.scrollTop,max:body&&Math.max(0,body.scrollHeight-body.clientHeight),mode:panel&&panel.dataset.panelMode,
  windowY:scrollY,vw:innerWidth,vh:innerHeight,docWidth:document.documentElement.scrollWidth,transform:document.getElementById('space-plane').style.transform,
  selected:(document.querySelector('.area-node.selected')||{dataset:{}}).dataset.areaId||null,folds:[...document.querySelectorAll('.branch-toggle[aria-expanded="false"]')].map(e=>e.id),
  focus:document.activeElement.id,open:[...document.querySelectorAll('#area-panel-body details[open]')].map(e=>e.id)}}'''
HIT=r'''(sel)=>{const e=document.querySelector(sel);if(!e||!e.getClientRects().length)return null;const r=e.getBoundingClientRect(),body=e.closest('#area-panel-body'),b=body&&body.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,hit=document.elementFromPoint(x,y);
 return {top:r.top,bottom:r.bottom,bodyTop:b&&b.top,bodyBottom:b&&b.bottom,inside:r.top>=Math.max(0,b?b.top:0)&&r.bottom<=Math.min(innerHeight,b?b.bottom:innerHeight)&&r.left>=Math.max(0,b?b.left:0)&&r.right<=Math.min(innerWidth,b?b.right:innerWidth),
  hit:!!hit&&(hit===e||e.contains(hit)),id:e.id}}'''
PURPOSE_END=r'''()=>{const e=document.getElementById('project-read-purpose'),b=document.getElementById('project-read-body'),n=e.firstChild,marker='W19-PURPOSE-END',i=n.data.indexOf(marker),range=document.createRange();range.setStart(n,i);range.setEnd(n,i+marker.length);const r=range.getBoundingClientRect(),box=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return {inside:r.top>=box.top&&r.bottom<=box.bottom&&r.top>=0&&r.bottom<=innerHeight,hit:!!hit&&e.contains(hit),scroll:b.scrollTop}}'''

class Workspace19(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__);tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state
    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        self.ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=self.url);self.wheels=0
    def record(self,kind,name,value,expected=None):
        row={'test':self.id(),'pc':[self.WIDTH,self.HEIGHT],'kind':kind,'name':name,'value':value}
        if kind=='condition':row['expected']=expected
        with OBS.open('a',encoding='utf-8') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
    def equal(self,name,value,expected):self.record('condition',name,value,expected);self.assertEqual(value,expected,name)
    def yes(self,name,value,actual=None):self.record('condition',name,actual if actual is not None else bool(value),True);self.assertTrue(value,name)
    def snap(self,name):g=self.page.evaluate(GEOM);self.record('actual',name,g);return g
    def shot(self,name):self.page.mouse.move(1,1);self.page.screenshot(path=str(base.OUT/f'workspace19-{self.WIDTH}-{name}.png'))
    def disclosure(self,id,opened=True):
        box=self.page.locator('#'+id)
        if box.evaluate('(e)=>e.open')!=opened:box.locator('> summary').click()
    def management(self):
        menu=self.page.locator('#project-management')
        if menu.count() and menu.is_visible():self.disclosure('project-management')
    def load(self,cid='powertoys',long=False):
        s=json.loads(subprocess.check_output(['node','--input-type=module','-e',SEED,cid,'long' if long else 'normal'],cwd=APP,text=True,encoding='utf-8'))
        self.record('source','reused source metadata',s['metadata']);self.record('synthetic','extra fixture boundaries',s['synthetic'])
        path=base.OUT/f'workspace19-{self.WIDTH}-{cid}-recovery.json';path.write_text(json.dumps(s['p'],ensure_ascii=False),encoding='utf-8')
        self.management();expect(self.page.locator('#import')).to_be_visible()
        with self.page.expect_file_chooser() as chooser:self.page.locator('#import').click()
        self.page.once('dialog',lambda d:d.accept());chooser.value.set_files(str(path))
        expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요');self.page.locator('#nav-space').click();self.page.locator('#map-fit').click();base.saved(self.page)
        return s
    def arrive(self,file,index):
        path=base.OUT/f'workspace19-{self.WIDTH}-late-{index}.json';path.write_text(json.dumps(file,ensure_ascii=False),encoding='utf-8')
        self.page.locator('#nav-work').click();self.disclosure('compose-panel');self.disclosure('result-file-panel')
        self.page.locator('#result-file-input').set_input_files(str(path));self.page.locator('#accept-result-file').click();expect(self.page.locator('#result-file-message')).to_contain_text('앱 미검증');base.saved(self.page)
        self.page.locator('#nav-space').click()
    def records(self):
        self.page.locator('#check-summary').click();expect(self.page.locator('#area-panel')).to_have_attribute('data-panel-mode','records');expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id','@records')
    def wheel(self,delta):
        body=self.page.locator('#area-panel-body');r=body.bounding_box();x,y=r['x']+4,r['y']+r['height']/2
        self.yes('native wheel targets body padding',self.page.evaluate('([x,y])=>document.elementFromPoint(x,y)===document.getElementById("area-panel-body")',[x,y]))
        self.page.mouse.move(x,y);self.page.mouse.wheel(0,delta);self.page.wait_for_timeout(100);self.wheels+=1
    def reach(self,sel):
        for _ in range(45):
            h=self.page.evaluate(HIT,sel)
            if h and h['inside']:break
            if not h or h['bodyTop'] is None:break
            top,bottom=max(0,h['bodyTop']),min(self.HEIGHT,h['bodyBottom']);pad=min(4,max(0,(bottom-top-(h['bottom']-h['top']))/2))
            needed=h['top']-(top+pad) if h['top']<top+pad else h['bottom']-(bottom-pad)
            self.wheel(max(-200,min(200,needed)))
        self.visible(sel)
    def visible(self,sel):
        # Observation only: particularly after an explicit return, do not repair a broken caller by scrolling it into view.
        h=self.page.evaluate(HIT,sel);self.yes('control really visible and clickable '+sel,bool(h and h['inside'] and h['hit']),h);expect(self.page.locator(sel)).to_be_in_viewport()
    def record_reach(self,sel):
        more=self.page.locator('#check-more')
        if more.count() and not more.evaluate('(e)=>e.open'):self.reach('#check-more > summary');more.locator('> summary').click()
        self.reach(sel)
    def reading(self,sel):
        value=self.page.locator(sel).evaluate('(e)=>{const b=document.getElementById("area-panel-body");return {top:e.getBoundingClientRect().top-b.getBoundingClientRect().top,scroll:b.scrollTop,max:Math.max(0,b.scrollHeight-b.clientHeight)}}');self.record('actual','reading '+sel,value);return value
    def reading_back(self,name,before,after):
        wanted=max(0,min(after['max'],after['scroll']+after['top']-before['top']));self.yes(name,abs(after['scroll']-wanted)<=2,{'before':before,'after':after,'wanted':wanted})
    def map_ok(self,label):
        g=self.snap(label);m=g['map'];visible=max(0,min(m['bottom'],g['vh'])-max(m['y'],0))
        self.yes(label+': map actually visible at least40% of viewport',visible/g['vh']>=.4,{'visible':visible,'ratio':visible/g['vh']})
        self.record('goal',label+': default mapTop<=230 improvement target',m['y'],230)
        self.equal(label+': no horizontal page overflow',g['docWidth'],g['vw'])
        for sel in ['#map-zoom-in','#map-zoom-out','#map-fit']:
            h=self.page.evaluate(HIT,sel);self.yes(label+': map tool fully visible and hit '+sel,bool(h and h['inside'] and h['hit']),h)
        return g
    def export(self,task):
        self.disclosure('file-return-options');self.page.locator('#copy-file-work').click();expect(self.page.locator('#notice')).to_contain_text('클립보드에 복사')
        raw=self.page.evaluate('()=>navigator.clipboard.readText()');self.record('raw','actual OS clipboard',raw);text=raw.replace('\r\n','\n')
        p=self.state();t=next(t for t in p['tasks'] if t['id']==task);h=t['handoffs'][-1]
        got=self.page.evaluate("t=>{let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)}return {chars:t.length,digest:(h>>>0).toString(16).padStart(8,'0')}}",text)
        self.equal('copied UTF16 length/digest equals actual export record',got,{'chars':h['chars'],'digest':h['digest']});self.yes('actual return id is copied',h['returnId'] in text);return text,h
    def request(self,area,body):
        self.page.locator('#panel-new-request').click();self.equal('new request explicitly targets exact area',self.state()['space']['draftTarget'],{'area':area})
        self.page.locator('#draft').fill(body);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        p=self.state();task=next(t for t in p['tasks'] if t['id']==p['currentTaskId']);self.equal('actual new task owner',task['areaId'],area)
        source=next(x for x in p['sources'] if x['id']==task['sourceIds'][0]);self.equal('actual new request source',[source['kind'],source['text']],['request',body]);text,h=self.export(task['id'])
        self.yes('actual handoff carries new request body',body in text);self.equal('actual handoff anchor exact area',h['anchor']['areaId'],area);return task

    def test_01_default_record_growth_and_unsaved_owner_isolation(self):
        s=self.load();self.map_ok('normal import notice is visible separately');expect(self.page.locator('#notice')).to_be_visible()
        # Explicit synthetic setup edit clears the import notice. One/many comparisons require the same absent-notice state.
        self.record('fixture','native name edit establishes no-notice comparison baseline',s['name']+' · 비교')
        self.page.locator('#project-name').fill(s['name']+' · 비교');base.saved(self.page);expect(self.page.locator('#notice')).to_be_hidden()
        closed=self.map_ok('one record closed');self.records();one=self.map_ok('one record open');self.equal('one record does not take map height',[one['map'][k] for k in ['y','h','bottom']],[closed['map'][k] for k in ['y','h','bottom']])
        self.equal('one actual report row',self.page.locator('#area-panel-body .check-item').count(),1);self.page.locator('#records-close').click()
        for i,file in enumerate(s['late']):self.arrive(file,i)
        self.snap('actual normal late-receipt notice before independent no-notice comparison')
        # A background receipt legitimately raises a notice. Explicit synthetic setup edits restore the identical name
        # after two native input events, so the measured count comparison has the same name and absent-notice condition.
        name=self.page.locator('#project-name');same_name=name.input_value();self.record('fixture','clear receipt notice by native name-space/backspace; final name unchanged',same_name)
        name.fill(same_name+' ');name.press('Backspace');base.saved(self.page);self.equal('comparison name unchanged',name.input_value(),same_name)
        expect(self.page.locator('#notice')).to_be_hidden();many_closed=self.map_ok('six records closed');self.records();many=self.map_ok('six records open')
        self.equal('six records do not take map height',[many['map'][k] for k in ['y','h','bottom']],[many_closed['map'][k] for k in ['y','h','bottom']]);self.equal('record count1 to6 leaves map height unchanged',[many['map']['y'],many['map']['h']],[one['map']['y'],one['map']['h']])
        expect(self.page.locator('#check-summary')).to_contain_text('6');self.yes('record reader leaves a usable map width',many['map']['w']/many_closed['map']['w']>=.65,{'closedWidth':many_closed['map']['w'],'readerWidth':many['map']['w']})
        self.equal('all six report rows retained',self.page.locator('#area-panel-body .check-item').count(),6)
        camera=many['transform'];self.page.locator('#map-zoom-in').click();self.yes('visible zoom button actually changes camera',self.snap('native zoom')['transform']!=camera);self.page.locator('#map-fit').click()
        first=self.page.locator('.area-node').first.get_attribute('data-area-id');h=self.page.evaluate(HIT,'#node-info-'+first);self.yes('fit leaves actual first card information reachable',bool(h and h['inside'] and h['hit']),h)
        before=self.state();start=self.snap('before native records reading');last=self.page.locator('#area-panel-body .check-item button[id^="check-open-"]').last.get_attribute('id')
        self.record_reach('#'+last);self.yes('end record reached by actual native wheel',self.wheels>0);body=self.page.locator('#area-panel-body');body.focus();body.press('Home');body.press('End');self.reach('#'+last)
        after=self.snap('after wheel and keyboard records reading');self.equal('reader input never moves map camera',after['transform'],start['transform']);self.equal('reader input never scrolls background page',after['windowY'],start['windowY'])
        body.focus();body.dispatch_event('keydown',{'key':'Escape','isComposing':True,'bubbles':True,'cancelable':True});expect(body).to_be_focused();expect(self.page.locator('#area-panel')).to_have_attribute('data-panel-mode','records')
        body.evaluate("e=>{e.addEventListener('keydown',x=>x.preventDefault(),{once:true});e.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))}");expect(body).to_be_focused();expect(self.page.locator('#area-panel')).to_have_attribute('data-panel-mode','records')
        self.page.locator('#'+last).click();expect(self.page.locator('#task-pointed')).to_be_visible();self.page.locator('#task-return-origin').click();self.equal('exact report caller regains focus',self.page.evaluate('()=>document.activeElement.id'),last);self.visible('#'+last)
        self.equal('reading records never writes saved project',self.state(),before)
        body.focus();body.press('Escape');expect(self.page.locator('#area-panel')).to_have_count(0);expect(self.page.locator('#check-summary')).to_be_focused();self.equal('records close never restores an old camera',self.snap('record closed')['transform'],start['transform'])
        self.page.locator('#map-fit').click();self.page.locator(f'#node-info-{s["other"]}').click();self.disclosure('panel-edit');self.page.locator('#panel-note').fill('[합성 미저장] A의 편집은 B 기록의 행동이 아니다')
        area_before=self.state()['space']['areas'];self.records();self.equal('record mode exposes no stale A new-request footer',self.page.locator('#panel-new-request').count(),0)
        caller='#check-open-'+s['report'];self.record_reach(caller);self.page.locator(caller).click();expect(self.page.locator('#task-pointed')).to_contain_text('W19-REPORT-END');self.page.locator('#task-return-origin').click()
        self.equal('reading B report keeps actual areas unchanged',self.state()['space']['areas'],area_before);self.page.locator('#map-area-open').click();expect(self.page.locator('#panel-note')).to_have_value('[합성 미저장] A의 편집은 B 기록의 행동이 아니다')
        self.records();self.record_reach('#'+last);anchor=self.reading('#'+last);memo=self.snap('records before Home');entry=self.page.evaluate('()=>document.documentElement.dataset.entryId')
        self.page.locator('#nav-projects').click();card=self.page.locator(f'.project-card[data-entry-id="{entry}"]');expect(card.locator('.project-open')).to_be_focused();card.locator('.project-open').click()
        expect(body).to_have_attribute('data-area-id','@records');self.visible('#'+last);self.reading_back('Home same-entry retains record reading anchor',anchor,self.reading('#'+last));self.equal('Home returns this project camera',self.snap('records after Home')['transform'],memo['transform']);self.shot('records-growth')

    def test_02_first_records_origin_survives_area_relations_endpoint_request(self):
        s=self.load()
        for i,file in enumerate(s['late']):self.arrive(file,i)
        self.page.locator('#map-zoom-in').click();self.records();caller='#check-area-'+s['report'];self.record_reach(caller);origin=self.snap('first records origin');anchor=self.reading(caller);before=self.state()
        self.page.locator(caller).click();self.equal('record locates its exact owning area',self.snap('record owner')['selected'],s['area'])
        self.page.locator('#map-relations-open').click();expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id','@relations')
        relation=before['space']['relations'][0];endpoint=relation['to'];end='#relation-to-'+relation['id'];self.reach(end);self.page.locator(end).click();self.equal('actual stored endpoint is selected',self.snap('endpoint')['selected'],endpoint)
        task=self.request(endpoint,'[합성19] 이 실제 연결 끝점의 문구만 검토한다. 다른 부분의 조건을 자동 상속하지 않는다.')
        after=self.state();self.equal('all previous source originals preserved',after['sources'][:len(before['sources'])],before['sources']);self.equal('area user ideas preserved',after['space']['areas'],before['space']['areas']);self.equal('world positions preserved',after['space']['layout'],before['space']['layout'])
        self.page.locator('#work-locate-return').click();expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id','@records');back=self.snap('first records restored')
        for k in ['transform','selected','folds']:self.equal('first records origin restored '+k,back[k],origin[k])
        self.equal('first actual record caller focus restored',back['focus'],caller[1:]);self.visible(caller);self.reading_back('first records anchor survives intermediate modes',anchor,self.reading(caller));self.equal('return never rolls back new current task',self.state()['currentTaskId'],task['id']);self.shot('records-endpoint-return')
        # Re-enter the actual R1 owner so its excursion is live. A previously completed return cannot expose an origin leak.
        self.page.locator(caller).click();self.equal('reopened R1 excursion selects its exact owner',self.snap('live R1 before unrelated B info')['selected'],s['area'])
        expect(self.page.locator('#locate-return')).to_be_visible();expect(self.page.locator('#locate-return')).to_contain_text('기록')
        # An explicit unrelated information action must end that live R1 origin before B's own task is read.
        self.page.locator('#map-fit').click();expect(self.page.locator('#locate-return')).to_contain_text('기록')
        self.page.locator(f'#node-info-{s["other"]}').click();expect(self.page.locator('#area-panel')).to_have_attribute('data-panel-mode','area')
        expect(self.page.locator('#locate-return')).to_have_count(0)
        other_task=next(t for t in before['tasks'] if t.get('areaId')==s['other'] and t['resultFile'] is None);other_caller='#panel-task-'+other_task['id'];self.reach(other_caller);self.page.locator(other_caller).click();self.page.locator('#task-return-origin').click()
        expect(self.page.locator('#area-panel')).to_have_attribute('data-panel-mode','area');self.equal('unrelated B reading returns to B, never old records',self.snap('B independent origin')['selected'],s['other']);expect(self.page.locator(other_caller)).to_be_focused();self.visible(other_caller)

    def test_03_long_originals_and_vanished_report_caller(self):
        s=self.load('product13',True);before=self.state();name=self.page.locator('#project-name');self.equal('complete long project name accessible',name.input_value(),s['name']);name.focus();name.press('End')
        tail=name.evaluate('(e)=>({x:e.scrollLeft,end:e.selectionEnd,length:e.value.length})');self.yes('native End exposes the long name tail',tail['x']>0 and tail['end']==tail['length'],tail)
        self.disclosure('brief-edit');purpose=self.page.locator('#brief-edit-text');expect(purpose).to_have_value(s['purpose'])
        draft=s['purpose']+'\n[합성 미저장 목적] 저장 전 내용을 보존한다';purpose.fill(draft);self.disclosure('brief-edit',False)
        reading_start=self.snap('before readonly purpose dialog');self.page.locator('#brief-read').click();expect(self.page.locator('#project-read')).to_be_visible();self.equal('readonly purpose is exact saved original, not unsaved edit',self.page.locator('#project-read-purpose').text_content(),s['purpose'])
        purpose_body=self.page.locator('#project-read-body');purpose_body.focus();purpose_body.press('End');self.page.wait_for_timeout(150);end=self.page.evaluate(PURPOSE_END);self.yes('native End actually exposes full purpose end',end['inside'] and end['hit'] and end['scroll']>0,end)
        self.page.locator('#project-read-close').click();expect(self.page.locator('#brief-read')).to_be_focused();reading_back=self.snap('after readonly purpose dialog')
        for k in ['windowY','transform','selected','mode','scroll']:self.equal('purpose dialog preserves '+k,reading_back[k],reading_start[k])
        self.equal('readonly purpose dialog writes no project',self.state(),before)
        for i,file in enumerate(s['late']):self.arrive(file,i)
        self.records();caller='#check-area-'+s['report'];self.record_reach(caller);self.yes('vanishing caller starts at a real scrolled records position',self.reading(caller)['scroll']>0);self.page.locator(caller).click();task=self.request(s['area'],'[합성19] 원래 보고를 잇는 같은 부분의 다음 요청. 보고 행은 새 요청 뒤 목록에서 사라질 수 있다.')
        self.page.locator('#work-locate-return').click();expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id','@records')
        self.equal('legitimately consumed report row is never resurrected',self.page.locator('#check-open-'+s['report']).count(),0);self.equal('vanished report is not replaced by another row',self.page.locator(caller).count(),0)
        expect(self.page.locator('#records-heading')).to_be_focused();self.visible('#records-return-notice');self.yes('fallback explains why caller is gone',bool(self.page.locator('#records-return-notice').inner_text().strip()))
        self.equal('fallback keeps new current request',self.state()['currentTaskId'],task['id']);self.equal('reading and next request preserve saved purpose',self.state()['space']['brief'],before['space']['brief']);self.equal('long source ideas unchanged',self.state()['space']['areas'],before['space']['areas'])
        self.disclosure('brief-edit');expect(purpose).to_have_value(draft);self.disclosure('brief-edit',False);self.map_ok('long purpose after explicit return');self.shot('long-originals-fallback')

class Workspace19Wide(Workspace19):WIDTH,HEIGHT=1440,900
if __name__=='__main__':unittest.main(verbosity=2)
