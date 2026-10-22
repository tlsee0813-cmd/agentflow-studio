"""BLANK21: one narrow native regression at each PC size, not a discovery/usability study.

Normal new project and real UI input only; no recovery fixture, storage writes or domain setup.
Explicit MOCK, synthetic isolated library-booking example. The result file is synthetic, derived
from this UI's actual file-mode clipboard template; it is not external execution evidence.
Existing RECEIVED20 supplies native reach/scrollend, full clip/hit, same-work receipt mechanics.
Its independent-current/duplicate/archive/memory matrix remains a separate existing suite.
Author PC: AST/JS syntax only. Cloud/CI runs this script from app/ against the candidate build.
"""
import json,re,unittest
from playwright.sync_api import expect
import browser as base
import received20_browser as reused

OBS=base.OUT/'blank21-observations.jsonl';OBS.write_text('',encoding='utf-8')
PURPOSE='[합성21] 도서 예약 서비스. 중복 예약을 막고 예약한 책을 확인한다.'
NOTE='[합성21] 예약 확정 문구만 바꾸며 예약 성립 조건은 유지한다.'
REQUEST='예약 확정 문구를 신청 완료에서 예약 완료로 바꿔줘. 예약 방식은 그대로 유지해줘.\n'+('\n'.join(f'[합성 장문 원문 {i:03}] 참고 항목이며 추가 기능이나 실행 승인이 아니다.' for i in range(80)))+'\nW21-REQUEST-END'
DRAFT='[합성21 미전송] 다음 문구를 더 검토하려는 초안. 지금은 보내지 않는다.'
FNV='''t=>{let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)}return {chars:t.length,digest:(h>>>0).toString(16).padStart(8,'0')}}'''

class Blank21(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__);tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    state=base.Browser.state
    equal=reused.Received20.equal;yes=reused.Received20.yes;snap=reused.Received20.snap
    visible=reused.Received20.visible;wheel=reused.Received20.wheel;reach=reused.Received20.reach
    details=reused.Received20.details;select=reused.Received20.select;accept=reused.Received20.accept
    receipt=reused.Received20.receipt;added=reused.Received20.added
    def setUp(self):
        base.Browser.setUp(self);self.assertFalse(base.DOM,'BLANK21 requires native HTTP/browser/storage')
        self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        self.ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=self.url)
        self.posts=[];self.page.on('request',lambda r:self.posts.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
    def record(self,kind,label,actual,expected=None):
        with OBS.open('a',encoding='utf-8') as file:file.write(json.dumps({'test':self.id(),'pc':[self.WIDTH,self.HEIGHT],'kind':kind,'label':label,'actual':actual,'expected':expected},ensure_ascii=False)+'\n')
    def shot(self,label):
        self.page.mouse.move(1,1);self.page.screenshot(path=str(base.OUT/f'blank21-{self.WIDTH}-{label}.png'))
    def tearDown(self):
        try:
            self.shot('final-scene-including-failure');self.record('actual','final page/focus/errors',{'view':self.snap('final view'),'pageErrors':self.errors,'external':self.external})
        finally:base.Browser.tearDown(self)
    def toggle(self,id,opened,key=None):
        """Native summary activation, then matching target toggle after the product capture listener.
        Observe readiness, not a CSS formula/sleep. Pending prior toggles cannot satisfy activation/state checks.
        """
        summary='#'+id+' > summary';self.reach(summary)
        armed=self.page.evaluate(r'''([id,expected])=>{const d=document.getElementById(id),s=d.querySelector(':scope > summary'),initial=d.open;
          const p={promise:null,cancel:null,result:null},events=[];let resolve,timer,activation=false;
          p.promise=new Promise(r=>resolve=r);const finish=(ok,reason)=>{if(p.result)return;clearTimeout(timer);s.removeEventListener('click',click,true);d.removeEventListener('toggle',toggle);
            p.result={ok,reason,initial,expected,current:d.open,same:document.getElementById(id)===d,events};resolve(p.result)};
          const click=e=>{events.push({kind:'click',trusted:e.isTrusted,open:d.open});if(e.isTrusted)activation=true};
          const toggle=e=>{const same=document.getElementById(id)===d;events.push({kind:'toggle',activation,oldState:e.oldState,newState:e.newState,open:d.open,same});
            if(activation&&e.target===d&&same&&d.open===expected&&e.newState===(expected?'open':'closed')&&e.oldState===(initial?'open':'closed'))finish(true,'native-toggle-after-activation')};
          p.cancel=()=>finish(false,'cleanup');window.__blank21Toggle=p;s.addEventListener('click',click,true);d.addEventListener('toggle',toggle);
          timer=setTimeout(()=>finish(false,'native-toggle-timeout'),5000);return {id,initial,expected}}''',[id,opened])
        self.record('actual','native toggle armed before input',armed);self.equal('toggle starts in opposite state',armed['initial'],not opened)
        try:
            if key:
                expect(self.page.locator(summary)).to_be_focused();self.page.keyboard.press(key)
            else:self.page.locator(summary).click()
            result=self.page.evaluate('async()=>await window.__blank21Toggle.promise');self.yes('native matching toggle completed',result['ok'],result)
        finally:
            raw=self.page.evaluate('()=>{const p=window.__blank21Toggle;if(!p)return null;p.cancel();delete window.__blank21Toggle;return p.result}');self.record('actual','toggle cleanup diagnostics',raw)
    def clipboard(self,record):
        raw=self.page.evaluate('()=>navigator.clipboard.readText()');self.record('raw','actual OS clipboard before CRLF-pair-only comparison',raw)
        text=raw.replace('\r\n','\n') # Existing USE106 representation rule; saved/file bytes are never normalized.
        self.equal('actual copied UTF16 chars/FNV match the recorded export',self.page.evaluate(FNV,text),{'chars':record['chars'],'digest':record['digest']})
        return text
    def prepare(self):
        self.page.locator('#nav-projects').click()
        expect(self.page.locator('#projects-view')).to_be_visible();self.page.locator('#new-project').click()
        self.page.locator('#brief-input').fill(PURPOSE);self.page.locator('#brief-start').click()
        self.page.locator('#area-name').fill('예약');self.page.locator('#area-note').fill(NOTE);self.page.locator('#area-add').click();base.saved(self.page)
        area=self.state()['space']['areas'][0]['id'];self.page.locator('#node-enter-'+area).click();self.page.locator('#area-start-request').click()
        self.equal('first input explicitly targets the created part',self.state()['space']['draftTarget'],{'area':area})
        self.page.locator('#draft').fill(REQUEST);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('');expect(self.page.locator('#copy-work')).to_be_visible();base.saved(self.page)
        p=self.state();self.equal('exactly one actual first request',len(p['tasks']),1);t=p['tasks'][0]
        self.equal('first request owns the chosen part',t['areaId'],area);self.equal('original typed request remains exact',p['sources'][0]['text'],REQUEST)
        self.equal('new project purpose entered once',p['space']['brief']['text'],PURPOSE);self.equal('first request has no prior export',t['handoffs'],[])
        return p,t,area
    def test_first_handoff_choice_and_long_read_return(self):
        p,A,area=self.prepare();task=A['id'];summary='#file-return-options > summary'
        # First prepared screen, before scrolling, keyboard focus or opening any disclosure.
        self.record('actual','first prepared controls before any access repair',{'view':self.snap('first prepared screen'),'copy':self.page.evaluate(reused.PROBE,'#copy-work'),'fileChoice':self.page.evaluate(reused.PROBE,summary)})
        self.visible('#copy-work');self.visible(summary);self.equal('optional file choice starts folded',self.page.locator('#file-return-options').evaluate('(e)=>e.open'),False)
        expect(self.page.locator('#copy-file-work')).to_be_hidden();self.shot('first-prepared')
        self.page.locator('#copy-work').focus();keys=[]
        for _ in range(5):
            self.page.keyboard.press('Tab');focus=self.page.evaluate('()=>({id:document.activeElement.id,summary:document.activeElement.matches("#file-return-options > summary"),text:document.activeElement.textContent})');keys.append(focus)
            if focus['summary']:break
        self.yes('file choice reachable from ordinary copy by nearby native tab navigation',bool(keys and keys[-1]['summary']),keys);self.visible(summary)
        self.toggle('file-return-options',True,'Enter');self.visible('#copy-file-work');self.equal('disclosing alone creates no export/H or other saved mutation',self.state(),p)
        self.reach(summary);self.page.locator(summary).focus();self.toggle('file-return-options',False,'Enter');self.equal('folding alone changes no saved data',self.state(),p)
        self.visible('#copy-work');self.page.locator('#copy-work').click();expect(self.page.locator('#notice')).to_contain_text('클립보드에 복사');normal=self.state();h=normal['tasks'][0]['handoffs'][-1];text=self.clipboard(h)
        self.equal('ordinary copy creates one export',len(normal['tasks'][0]['handoffs']),1);self.equal('ordinary copy does not create a return H',h['returnId'],None);self.equal('ordinary copy does not claim a file anchor',h['anchor'],None)
        self.yes('ordinary copy carries exact request and purpose',REQUEST in text and PURPOSE in text);self.yes('ordinary copy has no return JSON template','"schemaVersion": "agentflow.return.' not in text)
        self.toggle('file-return-options',True);self.visible('#copy-file-work');self.page.locator('#copy-file-work').click();expect(self.page.locator('#file-handoff-preview')).to_have_count(1);expect(self.page.locator('#notice')).to_contain_text('클립보드에 복사');exported=self.state();H=exported['tasks'][0]['handoffs'][-1];file_text=self.clipboard(H)
        self.equal('file copy adds exactly one export record',len(exported['tasks'][0]['handoffs']),2);self.yes('file copy produces an actual H and exact part anchor',bool(H['returnId']) and H['anchor']['areaId']==area,H)
        templates=[json.loads(x) for x in re.findall(r'```json\n(.*?)\n```',file_text,re.S)];returns=[x for x in templates if 'schemaVersion' in x]
        self.equal('one actual return template',len(returns),1);file=returns[0]
        self.equal('template identities come from this actual export',[file['projectId'],file['taskId'],file['returnId']],[exported['id'],task,H['returnId']]);self.equal('area-bound template version',file['schemaVersion'],'agentflow.return.2')
        u=next(x for x in templates if x.get('version')=='understanding.1');self.equal('description template exact export basis',[u['areaId'],u['basedOn']],[area,H['anchor']['understanding']])
        self.yes('file handoff preserves exact long source and original purpose',REQUEST in file_text and PURPOSE in file_text)
        # Long source reading is deliberate. Native End reaches the real textarea tail; folding must not export again.
        self.details('compose-panel');self.page.locator('#draft').fill(DRAFT);base.saved(self.page);before_read=self.state()
        self.equal('last file-mode full text starts folded',self.page.locator('#file-handoff-preview').evaluate('(e)=>e.open'),False)
        self.toggle('file-handoff-preview',True);field=self.page.locator('#file-handoff-preview textarea');self.equal('full file preview equals actual clipboard handoff',field.input_value(),file_text);self.equal('full preview contains exact original request',REQUEST in field.input_value(),True)
        expect(self.page.locator('#file-handoff-preview > summary')).to_be_focused();self.page.keyboard.press('Tab');expect(field).to_be_focused();self.visible('#file-handoff-preview textarea');self.page.keyboard.press('Control+End')
        end=field.evaluate('(e)=>({top:e.scrollTop,height:e.clientHeight,total:e.scrollHeight,selection:e.selectionStart,length:e.value.length,tail:e.value.slice(-80)})');self.yes('native End reaches long original preview tail',end['total']>end['height'] and end['top']>0 and end['top']+end['height']>=end['total']-2 and end['selection']==end['length'],end)
        self.page.keyboard.press('Shift+Tab');expect(self.page.locator('#file-handoff-preview > summary')).to_be_focused();self.toggle('file-handoff-preview',False,'Enter');expect(field).to_be_hidden();self.equal('read and fold do not change current/draft/exports',self.state(),before_read)
        # Existing RECEIVED20 mechanics are reused once, to protect this moved disclosure's same-work return state.
        file={**file,'report':'[합성21] 문구 변경을 설명하는 시험 보고. 실제 구현·실행·검증한 자료가 아니다.','understanding':None}
        s={'file':file,'A':task,'B':task,'exported':task,'H1':H['returnId']};raw=self.select(s);before_receive=self.state();self.accept();base.saved(self.page);after=self.state();T=self.added(before_receive,after,raw);self.receipt(s,T['id'])
        self.equal('report to current A follows existing current-T policy while preserving unsent draft',[after['currentTaskId'],after['draft']],[T['id'],DRAFT]);self.equal('receiving preserves exact existing source',after['sources'][0],p['sources'][0]);self.equal('receiving preserves original A file export history',after['tasks'][0]['handoffs'],exported['tasks'][0]['handoffs'])
        expect(self.page.locator('#file-handoff-preview')).to_have_count(0);departure=self.snap('actual T-work receipt caller after A long fold')
        self.page.locator('#received-result-open').click();expect(self.page.locator('#task-pointed')).to_have_attribute('data-report-task-id',T['id']);self.reach('#task-return-origin');self.page.locator('#task-return-origin').click()
        expect(self.page.locator('#received-result-open')).to_be_focused();self.visible('#received-result-open');back=self.snap('same-work caller restored without repair')
        self.equal('return restores actual T-work departure scroll',back['y'],departure['y']);self.equal('return restores actual T-work disclosures',back['open'],departure['open']);expect(self.page.locator('#file-handoff-preview')).to_have_count(0)
        self.equal('read/return leaves complete saved project unchanged including current T and draft',self.state(),after);self.equal('draft stays visible and exact',self.page.locator('#draft').input_value(),DRAFT);self.equal('only initial request used mocked generation',len(self.posts),1);self.shot('same-work-return')

class Blank21Wide(Blank21):WIDTH,HEIGHT=1440,900
if __name__=='__main__':unittest.main(verbosity=2)
