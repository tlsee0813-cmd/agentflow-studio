"""RECEIVED20: native HTTP Chromium + explicit MOCK, two PCs, bounded source reconstructions and synthetic boundaries.
Receipt identity comes from actual returned records, never current/latest/array position. Faults are explicitly labelled.
No browser/server execution is authorised on the author's PC; Cloud/CI run this frozen source separately.
"""
import json,subprocess,unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base

APP=Path(__file__).resolve().parents[2]
OBS=base.OUT/'received20-observations.jsonl';OBS.write_text('',encoding='utf-8')
SEED="import {received20Fixture} from './continuity/tests/received20-fixtures.mjs';console.log(JSON.stringify(received20Fixture(process.argv[1],JSON.parse(process.argv[2]))));"
SNAP=r'''()=>({y:scrollY,vw:innerWidth,vh:innerHeight,docWidth:document.documentElement.scrollWidth,layer:document.body.dataset.layer,
 focus:document.activeElement.id,open:[...document.querySelectorAll('details[id][open]')].map(x=>x.id),
 map:(()=>{try{return JSON.parse(sessionStorage.getItem('agentflow.workspace.map'))}catch{return null}})()})'''
PROBE=r'''arg=>{const [sel,marker]=Array.isArray(arg)?arg:[arg,null],e=document.querySelector(sel);if(!e||!e.getClientRects().length)return null;let r=e.getBoundingClientRect();
 if(marker){const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n,found=false;while(n=w.nextNode()){const i=n.data.indexOf(marker);if(i<0)continue;const g=document.createRange();g.setStart(n,i);g.setEnd(n,i+marker.length);r=g.getBoundingClientRect();found=true;break}if(!found)return null}let host=e;
 while(host&&!(host.scrollHeight>host.clientHeight+1&&/auto|scroll/.test(getComputedStyle(host).overflowY)))host=host.parentElement;
 let b=host?.getBoundingClientRect();if(b&&(b.bottom<=0||b.top>=innerHeight)){host=null;b=null}
 const top=Math.max(0,b?.top??0),bottom=Math.min(innerHeight,b?.bottom??innerHeight),left=Math.max(0,b?.left??0),right=Math.min(innerWidth,b?.right??innerWidth),x=r.left+r.width/2,y=r.top+r.height/2,h=document.elementFromPoint(x,y);
 return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,clipTop:top,clipBottom:bottom,inside:r.top>=top&&r.bottom<=bottom&&r.left>=left&&r.right<=right,
 hit:!!h&&(h===e||e.contains(h)),wheelX:host?b.left+4:innerWidth-20,wheelY:(top+bottom)/2,host:host?.id??'window'}}'''
TEXT=r'''([sel,marker])=>{const root=document.querySelector(sel);if(!root)return null;const w=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);let n;
 while(n=w.nextNode()){const i=n.data.indexOf(marker);if(i<0)continue;const g=document.createRange();g.setStart(n,i);g.setEnd(n,i+marker.length);const r=g.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
 return {shown:n.parentElement.checkVisibility({visibilityProperty:true})&&r.height>0,inside:r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth,hit:!!h&&root.contains(h),rect:r.toJSON()}}return null}'''

class Received20(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__);tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state
    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT});self.posts=[]
        self.page.on('request',lambda r:self.posts.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
    def record(self,kind,label,actual,expected=None):
        with OBS.open('a',encoding='utf-8') as f:f.write(json.dumps({'test':self.id(),'pc':[self.WIDTH,self.HEIGHT],'kind':kind,'label':label,'actual':actual,'expected':expected},ensure_ascii=False)+'\n')
    def equal(self,label,actual,expected):self.record('condition',label,actual,expected);self.assertEqual(actual,expected,label)
    def yes(self,label,ok,raw=None):self.record('condition',label,raw if raw is not None else bool(ok),True);self.assertTrue(ok,label)
    def snap(self,label):v=self.page.evaluate(SNAP);self.record('actual',label,v);return v
    def shot(self,label):self.page.mouse.move(1,1);self.page.screenshot(path=str(base.OUT/f'received20-{self.WIDTH}-{label}.png'))
    def details(self,id,opened=True):
        d=self.page.locator('#'+id)
        if d.evaluate('(e)=>e.open')!=opened:self.reach('#'+id+' > summary');d.locator('> summary').click()
    def visible(self,sel,marker=None):
        v=self.page.evaluate(PROBE,[sel,marker] if marker else sel);self.yes('actual full clipping and hit '+sel,bool(v and v['inside'] and v['hit']),v)
        if not marker:expect(self.page.locator(sel)).to_be_in_viewport()
    def wheel(self,sel,delta,marker=None):
        # Observe the actual native wheel and scrollend; no fixed sleeps, DOM scrolling or product resize hooks.
        p=self.page.evaluate(PROBE,[sel,marker] if marker else sel)
        self.page.evaluate(r'''([x,y])=>{const hit=document.elementFromPoint(x,y);let host=hit;
          while(host&&!(host.scrollHeight>host.clientHeight+1&&/auto|scroll/.test(getComputedStyle(host).overflowY)))host=host.parentElement;
          const target=host??document,events=[],p={promise:null,cancel:null,result:null};let resolve,timer,activated=false;
          p.promise=new Promise(r=>resolve=r);const finish=(ok,reason)=>{if(p.result)return;clearTimeout(timer);document.removeEventListener('wheel',wheel,true);target.removeEventListener('scrollend',end);
            p.result={ok,reason,events,y:host?host.scrollTop:scrollY,host:host?.id??'window'};resolve(p.result)};
          const wheel=e=>{if(e.isTrusted){activated=true;events.push({kind:'wheel',delta:e.deltaY,time:performance.now()})}};
          const end=e=>{if(activated&&e.target===target){events.push({kind:'scrollend',time:performance.now()});finish(true,'native-scrollend')}};
          p.cancel=()=>finish(false,'cleanup');window.__received20Wheel=p;document.addEventListener('wheel',wheel,true);target.addEventListener('scrollend',end);timer=setTimeout(()=>finish(false,'native-scroll-timeout'),4000)}''',[p['wheelX'],p['wheelY']])
        try:
            self.page.mouse.move(p['wheelX'],p['wheelY']);self.page.mouse.wheel(0,delta)
            result=self.page.evaluate('async()=>await window.__received20Wheel.promise');self.yes('native scroll event completion',result['ok'],result)
        finally:
            raw=self.page.evaluate('()=>{const p=window.__received20Wheel;if(!p)return null;p.cancel();delete window.__received20Wheel;return p.result}');self.record('actual','native scroll cleanup',raw)
    def reach(self,sel,marker=None):
        for _ in range(50):
            p=self.page.evaluate(PROBE,[sel,marker] if marker else sel)
            if not p or p['inside'] and p['hit']:break
            pad=4
            if p['inside']:
                delta=(p['top']+p['bottom']-p['clipTop']-p['clipBottom'])/2
                if abs(delta)<1:break
            else:delta=p['top']-(p['clipTop']+pad) if p['top']<p['clipTop']+pad else p['bottom']-(p['clipBottom']-pad)
            self.wheel(sel,max(-220,min(220,delta)),marker)
        self.visible(sel,marker)
    def load(self,cid='powertoys',draft=True,archived=False):
        s=json.loads(subprocess.check_output(['node','--input-type=module','-e',SEED,cid,json.dumps({'draft':draft,'archived':archived})],cwd=APP,text=True,encoding='utf-8'))
        self.record('source','bounded reconstruction metadata',s['metadata']);self.record('synthetic','new wiring boundaries',s['synthetic'])
        path=base.OUT/f'received20-{self.WIDTH}-{cid}-recovery.json';path.write_text(json.dumps(s['p'],ensure_ascii=False),encoding='utf-8')
        base.reveal_management(self.page,'#import')
        with self.page.expect_file_chooser() as chooser:self.page.locator('#import').click()
        self.page.once('dialog',lambda d:d.accept());chooser.value.set_files(str(path));expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요')
        self.page.locator('#nav-work').click();base.saved(self.page);self.equal('loaded actual current B',self.state()['currentTaskId'],s['B']);return s
    def select(self,s,file=None,raw=None,valid=True):
        self.details('compose-panel');self.details('result-file-panel')
        raw=raw if raw is not None else json.dumps(file if file is not None else s['file'],ensure_ascii=False,indent=2)
        path=base.OUT/f'received20-{self.WIDTH}-selected.json';path.write_text(raw,encoding='utf-8');self.page.locator('#result-file-input').set_input_files(str(path))
        if valid:
            expect(self.page.locator('#result-file-preview')).to_have_attribute('data-target-task-id',(file or s['file'])['taskId']);expect(self.page.locator('#accept-result-file')).to_be_visible()
        else:
            expect(self.page.locator('#result-file-preview')).to_contain_text('정확히 일치하는 내보내기');expect(self.page.locator('#accept-result-file')).to_have_count(0)
        return raw
    def accept(self):self.reach('#accept-result-file');self.page.locator('#accept-result-file').click()
    def receipt(self,s,report,duplicate=False,state='saved'):
        r=self.page.locator('#received-result-receipt')
        for name,value in [('report-task-id',report),('request-task-id',s['A']),('export-task-id',s['exported']),('handoff-id',s['H1']),('duplicate',str(duplicate).lower()),('save-state',state)]:expect(r).to_have_attribute('data-'+name,value)
        self.reach('#received-result-open');expect(r).to_contain_text('같은 보고' if duplicate else '앱 미검증');self.record('actual','exact receipt attributes',r.evaluate('(e)=>({...e.dataset,text:e.innerText})'))
    def added(self,before,after,raw):
        matches=[t for t in after['tasks'] if t['id'] not in {x['id'] for x in before['tasks']}]
        self.equal('exactly one added report',len(matches),1);t=matches[0];self.equal('exact raw result retained',t['resultFile']['rawText'],raw);return t
    def preserved(self,before,after):
        for key in ['currentTaskId','draft','draftKind','answerDraft','basisDraft','basisEdits','bases']:self.equal('read/receipt preserves '+key,after[key],before[key])
        for key in ['areas','layout','draftTarget','containment']:self.equal('read/receipt preserves space '+key,after['space'][key],before['space'][key])
        self.equal('previous task bytes remain',after['tasks'][:len(before['tasks'])],before['tasks']);self.equal('previous sources remain',after['sources'][:len(before['sources'])],before['sources'])
    def open_received(self,s,report):
        self.page.locator('#received-result-open').click();expect(self.page.locator('#task-pointed')).to_have_attribute('data-report-task-id',report)
        expect(self.page.locator('#task-pointed')).to_contain_text(s['file']['report'][:50]);expect(self.page.locator('#task-view-idea')).to_contain_text('W20-CURRENT-IDEA')
        self.visible('#task-next-action');self.equal('opening never chooses A as current',self.state()['currentTaskId'],s['B'])
    def snapshot_work(self,s):
        d=self.page.locator('#task-report-export-work');expect(d).to_have_attribute('data-handoff-id',s['H1']);self.equal('historical full work starts folded',d.evaluate('(e)=>e.open'),False)
        self.details('task-report-export-work')
        for key,value in s['work1'].items():
            text=d.locator('[data-export-field="'+key+'"] .source-raw').text_content();self.equal('exact H1 snapshot '+key,text,value)
        self.yes('H2/current work never masquerades as H1',not any(x in d.inner_text() for x in ['W20-H2','W20-CURRENT','W20-ROOT-CURRENT']))
        self.details('task-report-export-work',False)
        self.details('task-view-work');current=self.page.locator('#task-view-work');expect(current.locator('> summary')).to_contain_text('현재')
        self.equal('separate current root work is not the export snapshot',current.locator('[data-field="next"] dd').text_content(),next(t for t in s['p']['tasks'] if t['id']==s['A'])['manual']['next']);self.details('task-view-work',False)
    def read_original(self,s,t,raw):
        self.equal('long report full text initially folded',self.page.locator('#task-report-src-'+t['sourceIds'][0]).evaluate('(e)=>e.open'),False)
        self.details('task-report-src-'+t['sourceIds'][0]);sel='#task-report-src-'+t['sourceIds'][0]+' .source-raw'
        self.equal('report original remains exact',self.page.locator(sel).text_content(),s['file']['report']);self.reach(sel,'W20-REPORT-'+s['c']['id']+'-END')
        self.details('task-report-src-'+t['sourceIds'][0],False);self.details('task-report-export-work');self.details('task-report-export-proof');self.details('task-report-result-raw')
        self.equal('received JSON source remains exact',self.page.locator('#task-report-result-raw textarea').input_value(),raw)
        self.reach('#task-report-result-raw button')
        with self.page.expect_download() as result:self.page.locator('#task-report-result-raw button').click()
        path=base.OUT/f'received20-{self.WIDTH}-{s["c"]["id"]}-original.json';result.value.save_as(path);self.yes('downloaded original is exact UTF8 bytes',path.read_bytes()==raw.encode('utf-8'),{'bytes':len(path.read_bytes()),'expectedUtf8Bytes':len(raw.encode('utf-8'))})
        self.details('task-report-export-work',False)

    def test_01_two_inputs_exact_receipt_and_B_draft_readonly(self):
        for cid in ['powertoys','product13']:
            with self.subTest(input=cid):
                s=self.load(cid);self.page.locator('#nav-space').click();self.page.locator('#map-fit').click();self.page.locator(f'#node-info-{s["other"]}').click()
                self.details('panel-edit');buffer='[합성20 미저장] B 구상 입력을 A 수신으로 바꾸지 않는다';self.page.locator('#panel-note').fill(buffer);self.page.locator('#map-zoom-in').click();map_before=self.snap('B map reading before receipt')
                self.page.locator('#nav-work').click();raw=self.select(s);before=self.state();self.accept();base.saved(self.page);after=self.state();t=self.added(before,after,raw);self.preserved(before,after)
                self.equal('returned file is attached to exact export task',t['parentTaskId'],s['exported']);expect(self.page.locator('#work-view')).to_be_visible();expect(self.page.locator('#task-view')).to_have_count(0)
                self.receipt(s,t['id']);departure=self.snap('immediately before explicit receipt open');self.open_received(s,t['id']);expect(self.page.locator('#task-next-action')).to_contain_text('작성 중인 요청 열기');self.snapshot_work(s)
                if cid=='product13':
                    self.equal('changed plan holds only the organised description',after['space']['understanding'][s['area']]['entries'][-1]['held'],'plan-changed');expect(self.page.locator('#task-pointed')).to_contain_text('현재 기준에 적용하지 않았어요')
                else:self.equal('plain return1 invents no area description',after['space']['understanding'],before['space']['understanding']);expect(self.page.locator('#task-report-understanding')).to_have_count(0)
                self.read_original(s,t,raw);self.equal('reader is entirely readonly',self.state(),after);self.reach('#task-return-origin');self.page.locator('#task-return-origin').click();expect(self.page.locator('#work-view')).to_be_visible()
                expect(self.page.locator('#received-result-open')).to_be_focused();self.visible('#received-result-open');back=self.snap('returned actual B caller')
                self.equal('same B work restores actual departure Y',back['y'],departure['y']);self.equal('same B work restores disclosures',back['open'],departure['open']);self.equal('read/return makes no new saved mutation',self.state(),after)
                self.equal('unsent B request still follows current B',self.page.locator('#compose-area').input_value(),'@follow');expect(self.page.locator('#compose-area option:checked')).to_contain_text(next(a['name'] for a in after['space']['areas'] if a['id']==s['other']))
                self.page.locator('#nav-space').click();self.equal('map camera retained',self.snap('map after receipt')['map']['view'],map_before['map']['view']);expect(self.page.locator('#panel-note')).to_have_value(buffer)
                self.equal('no read-only provider calls',self.posts,[]);self.shot(cid+'-exact')

    def test_02_same_handoff_different_reports_and_exact_duplicate(self):
        s=self.load();raw=self.select(s);before=self.state();self.accept();base.saved(self.page);one=self.state();first=self.added(before,one,raw);self.receipt(s,first['id'])
        second_raw=self.select(s,s['variant']);self.accept();base.saved(self.page);two=self.state();second=self.added(one,two,second_raw);self.yes('same H different report is distinct',second['id']!=first['id']);self.receipt(s,second['id'])
        # A whitespace-different resend is semantically identical, and must link to the original first report, not latest second.
        self.select(s,raw=json.dumps(s['file'],ensure_ascii=False,separators=(',',':')));self.accept();base.saved(self.page);self.equal('duplicate preserves timestamps/revision/all records',self.state(),two);self.receipt(s,first['id'],True)
        self.open_received(s,first['id']);self.snapshot_work(s);self.equal('duplicate reader still readonly',self.state(),two)
        self.page.locator('#task-return-origin').click();self.select(s,{**s['file'],'taskId':s['B']},valid=False);expect(self.page.locator('#accept-result-file')).to_have_count(0);self.equal('H cannot be reassigned to current B',self.state(),two)
        self.page.locator('#cancel-result-file').click();fresh='[합성20 새 입력] 오래된 receipt가 이 입력을 A 보고로 바꾸면 안 된다';self.page.locator('#draft').fill(fresh);base.saved(self.page);changed=self.state()
        if self.page.locator('#received-result-open').count():
            self.reach('#received-result-open');self.page.locator('#received-result-open').click();expect(self.page.locator('#task-pointed')).to_have_attribute('data-report-task-id',first['id']);self.equal('retained receipt never consumes newer input',self.state(),changed);self.page.locator('#task-return-origin').click()
        self.equal('new B input remains exact',self.state()['draft'],fresh);self.load('product13');expect(self.page.locator('#received-result-open')).to_have_count(0)

    def test_03_memory_only_archived_and_missing_snapshot(self):
        s=self.load('product13',archived=True);raw=self.select(s);before=self.state()
        holder=self.ctx.new_page();holder.goto(self.url);holder.evaluate("()=>new Promise(held=>navigator.locks.request('agentflow.idea015.workspace',()=>new Promise(resolve=>{window.__releaseReceived20=resolve;held()})))")
        self.record('fault','real Web Lock gate, followed by injected Storage.setItem quota failure',True)
        try:
            self.accept();expect(self.page.locator('html')).to_have_attribute('data-saving','1');expect(self.page.locator('#received-result-receipt')).to_have_attribute('data-save-state','pending');pending_id=self.page.locator('#received-result-receipt').get_attribute('data-report-task-id')
            self.select(s);self.accept();expect(self.page.locator('#received-result-receipt')).to_have_attribute('data-duplicate','true');expect(self.page.locator('#received-result-receipt')).to_have_attribute('data-save-state','pending')
            self.page.evaluate('()=>{window.__received20Set=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("synthetic quota","QuotaExceededError")}}');holder.evaluate('()=>window.__releaseReceived20()')
            expect(self.page.locator('#received-result-receipt')).to_have_attribute('data-save-state','memory');expect(self.page.locator('#storage-error')).to_be_visible();self.equal('failed save preserves actual stored bytes',self.state(),before)
            base.reveal_management(self.page,'#backup')
            with self.page.expect_download() as result:self.page.locator('#backup').click()
            path=base.OUT/f'received20-{self.WIDTH}-memory.json';result.value.save_as(path);memory=json.loads(path.read_text(encoding='utf-8'));t=self.added(before,memory,raw);self.preserved(before,memory)
            self.equal('pending duplicate preserves exact actual report ID',t['id'],pending_id);self.receipt(s,t['id'],duplicate=True,state='memory');self.visible('#received-result-status');expect(self.page.locator('#received-result-status')).not_to_contain_text('브라우저에 저장됨')
            self.page.locator('#received-result-open').click();expect(self.page.locator('#task-pointed')).to_have_attribute('data-report-task-id',t['id']);expect(self.page.locator('#task-next-action')).to_be_disabled();expect(self.page.locator('#task-view-find-area')).to_have_count(0);self.snapshot_work(s)
            self.equal('archived report keeps its description held',memory['space']['understanding'][s['area']]['entries'][-1]['held'],'area-archived');expect(self.page.locator('#task-pointed')).to_contain_text('현재 기준에 적용하지 않았어요')
            self.equal('reading does not unarchive owner',next(a for a in memory['space']['areas'] if a['id']==s['area'])['archived'],True);self.equal('stored original still unchanged',self.state(),before)
            # Legal pasted report in the SAME root reader: no guessed H or snapshot, even though that report later exported work.
            self.reach('#task-report-pick-'+s['pasted']);self.page.locator('#task-report-pick-'+s['pasted']).click();expect(self.page.locator('#task-pointed')).to_have_attribute('data-report-task-id',s['pasted'])
            self.details('task-report-export-work');expect(self.page.locator('#task-report-export-work')).to_contain_text('정확한 내보내기 작업문 사본이 없어요');self.reach('#task-report-export-work > p');self.yes('no guessed historical H snapshot',not self.page.locator('#task-report-export-work').get_attribute('data-handoff-id'))
            self.equal('legacy report reading preserves stored original',self.state(),before)
        finally:
            self.page.evaluate('()=>{if(window.__received20Set){Storage.prototype.setItem=window.__received20Set;delete window.__received20Set}}');holder.evaluate('()=>window.__releaseReceived20?.()');holder.close()

    def test_04_pending_save_navigation_and_records_origin_C(self):
        s=self.load(draft=False);self.page.locator('#nav-space').click();self.page.locator('#map-fit').click();base.open_records(self.page);r='#check-open-'+s['originR'];self.reach(r);records_before=self.snap('original recordsR before existing reader locate');saved_before=self.state()
        self.page.locator(r).click();self.reach('#task-view-find-area');self.page.locator('#task-view-find-area').click();self.reach('#locate-return');self.page.locator('#locate-return').click()
        expect(self.page.locator('#area-panel')).to_have_attribute('data-panel-mode','records');expect(self.page.locator(r)).to_be_focused();self.visible(r);self.equal('existing reader owner locate preserves records camera',self.snap('recordsR after existing reader locate')['map']['view'],records_before['map']['view']);self.equal('existing reader locate writes nothing',self.state(),saved_before)
        self.page.locator(r).click();self.reach('#task-view-continue');self.page.locator('#task-view-continue').click();self.equal('recordsR explicitly continues existing B',self.state()['currentTaskId'],s['B'])
        raw=self.select(s);holder=self.ctx.new_page();holder.goto(self.url)
        holder.evaluate("()=>new Promise(held=>navigator.locks.request('agentflow.idea015.workspace',()=>new Promise(resolve=>{window.__releaseReceived20=resolve;held()})))")
        self.record('fault','actual Web Lock held to separate commit from save completion',True)
        try:
            self.accept();expect(self.page.locator('html')).to_have_attribute('data-saving','1');self.page.locator('#nav-history').click();expect(self.page.locator('#history-view')).to_be_visible()
            holder.evaluate('()=>window.__releaseReceived20()');base.saved(self.page);expect(self.page.locator('#history-view')).to_be_visible();after=self.state();t=next(t for t in after['tasks'] if t['resultFile'] and t['resultFile']['rawText']==raw);self.equal('late save does not choose A',after['currentTaskId'],s['B'])
        finally:holder.evaluate('()=>window.__releaseReceived20?.()');holder.close()
        # Re-establish the real records parent, since explicit History navigation legitimately ended the earlier excursion.
        self.page.locator('#nav-space').click();base.open_records(self.page);self.reach(r);self.page.locator(r).click();self.reach('#task-view-continue');self.page.locator('#task-view-continue').click();self.receipt(s,t['id']);self.open_received(s,t['id'])
        self.reach('#task-view-find-area');self.page.locator('#task-view-find-area').click();self.equal('existing locate action selects exact A',self.page.locator('.area-node.selected').get_attribute('data-area-id'),s['area'])
        self.reach('#panel-new-request');self.page.locator('#panel-new-request').click();self.equal('explicit empty new request targets owner A',self.state()['space']['draftTarget'],{'area':s['area']})
        body='[합성20 실제 새C] 현재B 대신 자동선택이 아니라 사용자가 보낸 새요청';self.page.locator('#draft').fill(body);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('');base.saved(self.page);C=self.state()['currentTaskId'];self.yes('C is a real new task',C not in [s['A'],s['B'],t['id']])
        ctask=next(x for x in self.state()['tasks'] if x['id']==C);self.equal('actual C explicitly owns area A',ctask['areaId'],s['area']);self.equal('actual C original is the typed request',next(x for x in self.state()['sources'] if x['id']==ctask['sourceIds'][0])['text'],body)
        self.reach('#work-locate-return');self.page.locator('#work-locate-return').click();self.equal('work-origin return never rolls C back to B',self.state()['currentTaskId'],C);expect(self.page.locator('#work-view')).to_be_visible();expect(self.page.locator('#context-title')).to_be_focused();self.visible('#context-title')
        self.reach('#received-result-open');self.page.locator('#received-result-open').click();expect(self.page.locator('#task-pointed')).to_have_attribute('data-report-task-id',t['id']);self.page.locator('#task-return-origin').click();self.equal('reopening receipt keeps current C',self.state()['currentTaskId'],C);expect(self.page.locator('#received-result-open')).to_be_focused();self.visible('#received-result-open')
        self.reach('#work-return-origin');self.page.locator('#work-return-origin').click();expect(self.page.locator('#area-panel')).to_have_attribute('data-panel-mode','records');expect(self.page.locator(r)).to_be_focused();self.visible(r);self.equal('parent records return also preserves C',self.state()['currentTaskId'],C);self.shot('records-parent-C')

    def test_05_located_only_origin_is_not_duplicated_or_left_as_ghost(self):
        s=self.load('product13');raw=self.select(s);before=self.state();self.accept();base.saved(self.page);received=self.state();t=self.added(before,received,raw)
        self.page.locator('#nav-space').click();self.page.locator('#map-fit').click();base.open_records(self.page);caller='#check-area-'+t['id'];self.reach(caller);start=self.snap('located-only original S')
        self.page.locator(caller).click();self.reach('#panel-new-request');self.page.locator('#panel-new-request').click();expect(self.page.locator('#work-view')).to_be_visible()
        self.equal('area new-request opens existing B input without consuming it',[self.state()['currentTaskId'],self.state()['draft'],self.state()['space']['draftTarget']],[s['B'],received['draft'],received['space']['draftTarget']])
        expect(self.page.locator('#work-locate-return')).to_have_count(1);expect(self.page.locator('#work-return-origin')).to_have_count(0)
        self.receipt(s,t['id']);self.open_received(s,t['id']);self.reach('#task-return-origin');self.page.locator('#task-return-origin').click()
        expect(self.page.locator('#received-result-open')).to_be_focused();self.visible('#received-result-open');expect(self.page.locator('#work-locate-return')).to_have_count(1);expect(self.page.locator('#work-return-origin')).to_have_count(0)
        self.reach('#work-locate-return');self.page.locator('#work-locate-return').click();expect(self.page.locator('#area-panel')).to_have_attribute('data-panel-mode','records');expect(self.page.locator(caller)).to_be_focused();self.visible(caller)
        expect(self.page.locator('#locate-return')).to_have_count(0);expect(self.page.locator('#work-locate-return')).to_have_count(0);self.equal('one locate return restores S camera',self.snap('located-only returned S')['map']['view'],start['map']['view']);self.equal('located-only roundtrip writes no project',self.state(),received)

class Received20Wide(Received20):WIDTH,HEIGHT=1440,900

class Received20Narrow(unittest.TestCase):
    WIDTH,HEIGHT=390,844
    setUpClass=classmethod(base.Browser.setUpClass.__func__);tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=Received20.setUp;tearDown=base.Browser.tearDown;state=base.Browser.state
    record=Received20.record;equal=Received20.equal;yes=Received20.yes;snap=Received20.snap;shot=Received20.shot
    details=Received20.details;visible=Received20.visible;wheel=Received20.wheel;reach=Received20.reach
    load=Received20.load;select=Received20.select;accept=Received20.accept;receipt=Received20.receipt;added=Received20.added
    def test_390_receipt_reader_close_minimum(self):
        s=self.load();raw=self.select(s);before=self.state();self.accept();base.saved(self.page);after=self.state();t=self.added(before,after,raw);self.receipt(s,t['id']);self.page.locator('#received-result-open').click()
        expect(self.page.locator('#task-pointed')).to_have_attribute('data-report-task-id',t['id']);self.yes('390 reader has no horizontal page overflow',self.page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
        self.reach('#task-return-origin');self.page.locator('#task-return-origin').click();expect(self.page.locator('#received-result-open')).to_be_focused();self.equal('390 read/close preserves B and draft',[self.state()['currentTaskId'],self.state()['draft']],[s['B'],before['draft']]);self.shot('390-minimum')
if __name__=='__main__':unittest.main(verbosity=2)
