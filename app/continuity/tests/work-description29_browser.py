"""WORK29: 실제 편집 대상의 읽기 참고, PC 두 크기의 native 행동 검사.

합성 프로젝트는 공개 domain API로 만들고 정상 복구 파일 가져오기로만 연다.
localStorage/제품 DOM/응답 주입은 없다. 읽기 측정용 evaluate는 상태와 기하만 읽는다.
received20의 native wheel/clip/hit 도우미만 재사용하며 과거 test class를 상속하지 않는다.
로컬에서는 AST만 확인한다. 실제 MOCK 서버/Chromium 실행은 Cloud/CI 담당이다.
"""
import json, subprocess, unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base
import received20_browser as native

APP=Path(__file__).resolve().parents[2]
OBS=base.OUT/'work-description29-observations.jsonl'
OBS.write_text('',encoding='utf-8')
REF='#edit-work .work-reference'
BODY=REF+' .work-reference-body'
SUMMARY=BODY+' .work-reference-summary'
KEYS=('understanding','scope','next','checks')

# 모든 문장은 합성 경계 자료다. 실제 사용자 발언/공개 원문/AI 품질 판정이 아니다.
# 다른 작업 B0의 정확한 H를 반환하므로 B를 현재로 유지하는 기존 정책을 존중한다.
SEED=r'''
import * as D from './continuity/dist/public/shared/domain.js';
import {mockAdvice} from './continuity/dist/public/shared/mock.js';
let p=D.rename(D.setBrief(D.createProject(),'[합성29] 읽기 참고와 직접 작업문을 구분한다.'),'합성29 편집 대상');
for(const name of ['A 지도·입력 대상','B 실제 편집 대상','C 보류만 있는 대상'])p=D.addArea(p,name,'[합성 구상] '+name+'의 원문을 유지한다.');
const [a,b,c]=p.space.areas.map(x=>x.id);
function task(area,marker){p=D.submit(D.editDraft(p,'[합성29 요청] '+marker),undefined,area);const id=p.currentTaskId,s=D.begin(p,id);p=D.receive(s.project,s.request,{mode:'mock',ticket:s.request.ticket,advice:mockAdvice(s.request)});
 for(const [key,label]of Object.entries({understanding:'U',scope:'S',next:'N',checks:'C'}))p=D.editTask(p,id,key,label+'_'+marker+': 직접 쓴 값 · 배포하지 않는다.');return id;}
const A=task(a,'A'),C=task(c,'C'),B0=task(b,'B0'),B=task(b,'B');
const textA='[합성29 A 설명] A_ONLY_REFERENCE_29: 지도 선택과 입력 대상의 설명이다.';
const textB='[합성29 사용자 정정] B_SELECTED_29: 실제 편집 B의 설명이다.\n'+Array.from({length:24},(_,i)=>'참고 '+String(i+1).padStart(2,'0')+': 현재 표시와 작업문을 구분한다. 새 정책이나 실행 권한을 만들지 않는다.').join('\n')+'\nB_SELECTED_END_29';
const textNew='[합성29 새 외부 판본] B_NEW_REVISION_29: 명시 재열기 전에는 읽던 본문을 대체하지 않는다.';
const textHeld='[합성29 보류] HELD_ONLY_29: 현재 설명으로 쓰면 안 된다.';
function exported(id,H){const anchor=D.exportAnchor(p,D.taskOf(p,id));p=D.markHandoff(p,id,D.handoffText(p,id,H),'clipboard',p.revision,H,anchor);return anchor;}
function returned(id,H,anchor,text,held=false){return {schemaVersion:'agentflow.return.2',projectId:p.id,taskId:id,returnId:H,report:'[합성29 외부 보고] '+H,evidence:null,
 understanding:{version:'understanding.1',areaId:anchor.areaId,basedOn:held?99:anchor.understanding,summary:text,changes:[],proposal:null,origin:'합성29 검사 작성자가 구성한 자료 · 사실 검증 아님'}};}
for(const [id,H,text,held]of [[A,'H29_A',textA,false],[C,'H29_C',textHeld,true],[B0,'H29_B1','[합성29 외부 설명] B_ORIGINAL_29',false]]){
 const anchor=exported(id,H);p=D.importResultFile(p,JSON.stringify(returned(id,H,anchor,text,held)));}
p=D.correctUnderstanding(p,b,textB);
const anchor=exported(B0,'H29_B_NEXT'),late=returned(B0,'H29_B_NEXT',anchor,textNew);
p=D.editDraft(D.setDraftTarget(p,a),'[합성29 미전송 A 입력] 실제 편집 B와 구분한다.');
console.log(JSON.stringify({p,a,b,c,A,B0,B,C,textA,textB,textNew,textHeld,revision:D.areaDescription(p,b).current.entry.revision,late,
 metadata:{source:'공개 domain API로 만든 합성 복구 입력',limits:'실제 사용자 발언·의미 충돌 해결·AI 품질 검증 아님; UI 준비를 정상 파일 가져오기로 단축한다.'}}));
'''

class WorkDescription29(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    state=base.Browser.state
    details=native.Received20.details
    visible=native.Received20.visible
    wheel=native.Received20.wheel
    reach=native.Received20.reach

    def setUp(self):
        base.Browser.setUp(self)
        self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        self.posts=[]
        self.page.on('request',lambda r:self.posts.append(r.url) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
    def tearDown(self):
        try:
            self.record('actual','종료 또는 최초 실패 직후 화면',self.page.evaluate('''()=>({y:scrollY,focus:document.activeElement?.id,reference:document.querySelector('.work-reference-body')?.dataset??null})'''))
            self.shot('last-state')
        finally:base.Browser.tearDown(self)
    def record(self,kind,label,actual,expected=None):
        with OBS.open('a',encoding='utf-8') as f:
            f.write(json.dumps({'test':self.id(),'pc':[self.WIDTH,self.HEIGHT],'kind':kind,'label':label,'actual':actual,'expected':expected},ensure_ascii=False)+'\n')
    def equal(self,label,actual,expected):
        self.record('condition',label,actual,expected);self.assertEqual(actual,expected,label)
    def yes(self,label,ok,raw=None):
        self.record('condition',label,raw if raw is not None else bool(ok),True);self.assertTrue(ok,label)
    def click(self,selector):
        self.reach(selector);self.page.locator(selector).click()
    def shot(self,label):
        self.page.screenshot(path=str(base.OUT/f'work29-{self.WIDTH}-{self._testMethodName}-{label}.png'))
    def load(self):
        s=json.loads(subprocess.check_output(['node','--input-type=module','-e',SEED],cwd=APP,text=True,encoding='utf-8'))
        self.record('source','합성 입력의 출처와 한계',s['metadata'])
        path=base.OUT/f'work29-{self.WIDTH}-{self._testMethodName}-recovery.json'
        path.write_text(json.dumps(s['p'],ensure_ascii=False),encoding='utf-8')
        base.reveal_management(self.page,'#import')
        with self.page.expect_file_chooser() as chooser:self.page.locator('#import').click()
        self.page.once('dialog',lambda d:d.accept());chooser.value.set_files(str(path))
        expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요')
        self.click('#nav-work');base.saved(self.page)
        self.equal('실제 현재 작업 B',self.state()['currentTaskId'],s['B'])
        self.equal('합성 준비도 B 현재를 바꾸지 않음',s['p']['currentTaskId'],s['B'])
        return s
    def open_reference(self):
        self.details('edit-work')
        if not self.page.locator(REF).evaluate('(e)=>e.open'):self.click(REF+' > summary')
        expect(self.page.locator(BODY)).to_be_visible()
    def reference(self):
        return self.page.locator(BODY).evaluate('''e=>({project:e.dataset.projectId,task:e.dataset.taskId,area:e.dataset.areaId,revision:e.dataset.selectedRevision,state:e.dataset.referenceState,
 text:e.querySelector('.work-reference-summary')?.textContent??null,y:e.scrollTop,summaryY:e.querySelector('.work-reference-summary')?.scrollTop??null,open:e.closest('details').open})''')
    def owner(self,s,task,area,revision,text):
        r=self.reference()
        for key,value in [('project',s['p']['id']),('task',task),('area',area),('revision',str(revision)),('text',text)]:self.equal('참고의 정확한 '+key,r[key],value)
        return r
    def switch_task(self,area,task):
        self.click('#nav-space');self.click('#map-fit');self.click('#node-enter-'+area)
        self.click('#task-open-'+task);self.click('#task-view-continue')
        self.equal('명시적으로 이어가는 정확한 작업',self.state()['currentTaskId'],task)
    def pair_geometry(self,field):
        # CSS 좌표/열 비율을 복제하지 않는다. 실제 읽기 본문과 편집 위치의 동시 접근을 검사한다.
        self.reach(field)
        g=self.page.evaluate('''([body,field])=>{const b=document.querySelector(body),f=document.querySelector(field),l=f.closest('.work-edit-layout'),r=b.getBoundingClientRect(),s=f.getBoundingClientRect(),t=l.getBoundingClientRect();
          const low=Math.max(0,r.top,s.top),high=Math.min(innerHeight,r.bottom,s.bottom),summary=b.querySelector('.work-reference-summary'),walker=document.createTreeWalker(summary,NodeFilter.SHOW_TEXT);let n,line=null;
          while((n=walker.nextNode())&&!line){if(!n.data.trim()||!n.parentElement.checkVisibility({visibilityProperty:true}))continue;const range=document.createRange();range.selectNodeContents(n);
            for(const q of range.getClientRects()){if(!q.width||!q.height||q.top<low||q.bottom>high||q.left<Math.max(0,r.left)||q.right>Math.min(innerWidth,r.right))continue;
              const h=document.elementFromPoint(q.left+q.width/2,q.top+q.height/2);if(h&&summary.contains(h)){line={text:n.data.slice(0,80),rect:q.toJSON(),hit:true};break}}}
          return {body:r.toJSON(),field:s.toJSON(),layout:t.toJSON(),pageWidth:document.documentElement.scrollWidth,vw:innerWidth,vh:innerHeight,
           sideBySide:s.right<=r.left||r.right<=s.left,sharedVisibleHeight:high-low,readableLine:line}}''',[BODY,field])
        self.record('geometry','열린 참고 본문과 실제 수정 위치',g)
        self.yes('넓은 PC 편집 공간에서 참고의 실제 글줄과 입력이 겹치지 않고 나란히 읽힘',g['sideBySide'] and g['sharedVisibleHeight']>0 and bool(g['readableLine']),g)
        self.yes('PC 본문이 페이지 밖으로 가로 넘치지 않음',g['pageWidth']<=g['vw'],g)
        self.visible(field)
    def description_section(self,text):
        heading='## 영역 현재 설명 — '
        self.yes('전체 전달문에 설명 역할 구역이 있음',heading in text)
        return text.split(heading,1)[1].split('\n## ',1)[0]
    def summary_anchor(self,expected=None):
        self.reach(REF+' > summary')
        line=self.page.evaluate('''([body,sel,expected])=>{const b=document.querySelector(body),s=document.querySelector(sel),br=b.getBoundingClientRect(),w=document.createTreeWalker(s,NodeFilter.SHOW_TEXT);let n;
          while(n=w.nextNode()){if(!n.data.trim()||expected&&n.data!==expected.text)continue;const g=document.createRange();g.selectNodeContents(n);const rects=[...g.getClientRects()];
            for(let i=0;i<rects.length;i++){if(expected&&i!==expected.lineIndex)continue;const r=rects[i],inside=r.width>0&&r.height>0&&r.top>=Math.max(0,br.top)&&r.bottom<=Math.min(innerHeight,br.bottom)&&r.left>=Math.max(0,br.left)&&r.right<=Math.min(innerWidth,br.right),
              h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2),value={lineIndex:i,text:n.data,rect:r.toJSON(),inside,hit:!!h&&s.contains(h),cover:h&&(h.id||h.className)};
              if(expected||inside&&value.hit)return value}}return null}''',[BODY,SUMMARY,expected])
        self.yes('저장한 선택 설명의 정확한 글줄이 clip 안에서 읽힘' if expected else '선택 설명의 실제 원문 글줄이 clip 안에서 읽힘',bool(line and line['inside'] and line['hit']),line)
        return line
    def scroll_reference(self):
        self.reach(SUMMARY,'B_SELECTED_29')
        layout=self.page.locator(SUMMARY).evaluate('''e=>({top:e.scrollTop,height:e.scrollHeight,client:e.clientHeight,overflow:getComputedStyle(e).overflowY})''')
        self.record('actual','선택 설명 자체의 별도 스크롤 여부',layout)
        self.yes('설명 자체에 독립 스크롤을 만들지 않음',layout['height']<=layout['client']+1 and layout['overflow'] not in ['auto','scroll'] and layout['top']==0,layout)
        point=self.page.evaluate('''([body,sel])=>{const b=document.querySelector(body),s=document.querySelector(sel),r=b.getBoundingClientRect(),q=s.getBoundingClientRect(),
          l=Math.max(0,r.left,q.left)+4,h=Math.min(innerWidth,r.right,q.right)-4,t=Math.max(0,r.top,q.top)+4,z=Math.min(innerHeight,r.bottom,q.bottom)-4,
          x=(l+h)/2,y=(t+z)/2,hit=document.elementFromPoint(x,y);let owner=hit;
          while(owner&&!(owner.scrollHeight>owner.clientHeight+1&&/auto|scroll/.test(getComputedStyle(owner).overflowY)))owner=owner.parentElement;
          return {x,y,width:h-l,height:z-t,hit:!!hit&&s.contains(hit),owner:owner?.id??'window',expected:b.id,before:b.scrollTop,max:b.scrollHeight-b.clientHeight,
            delta:Math.min(150,b.scrollHeight-b.clientHeight-b.scrollTop)}}''',[BODY,SUMMARY])
        self.yes('실제 읽기 교집합과 양수 스크롤 여유가 있음',point['width']>0 and point['height']>0 and point['hit'] and point['owner']==point['expected'] and point['delta']>0,point)
        self.page.evaluate('''([body,point])=>{const b=document.querySelector(body),events=[],p={promise:null,cancel:null,result:null};let resolve,timer,raf=0,activated=false,generation=0;
          p.promise=new Promise(r=>resolve=r);const finish=(ok,reason)=>{if(p.result)return;clearTimeout(timer);cancelAnimationFrame(raf);document.removeEventListener('wheel',wheel,true);b.removeEventListener('scroll',scroll);
            p.result={ok,reason,point,events,after:b.scrollTop};resolve(p.result)};
          const wheel=e=>{if(e.isTrusted){activated=true;events.push({kind:'trusted-wheel',delta:e.deltaY})}};
          const scroll=()=>{if(!activated)return;events.push({kind:'actual-scroll',y:b.scrollTop});const current=++generation;let last=b.scrollTop,stable=0;
            const frame=()=>{if(current!==generation)return;const y=b.scrollTop;stable=y===last?stable+1:0;last=y;
              if(stable>=2){finish(y>point.before,'actual-scroll-and-stable-frames');return}raf=requestAnimationFrame(frame)};raf=requestAnimationFrame(frame)};
          p.cancel=()=>finish(false,'cleanup');window.__work29ReferenceWheel=p;document.addEventListener('wheel',wheel,true);b.addEventListener('scroll',scroll);timer=setTimeout(()=>finish(false,'movement-timeout'),4000)}''',[BODY,point])
        try:
            self.page.mouse.move(point['x'],point['y']);self.page.mouse.wheel(0,point['delta'])
            moved=self.page.evaluate('async()=>await window.__work29ReferenceWheel.promise')
            self.yes('읽기 body의 실제 scroll 이벤트와 위치 안정화',moved['ok'],moved)
        finally:
            raw=self.page.evaluate('()=>{const p=window.__work29ReferenceWheel;if(!p)return null;p.cancel();delete window.__work29ReferenceWheel;return p.result}')
            self.record('actual','읽기 wheel listener·timer 정리',raw)
        reading=self.reference()
        self.yes('실제 움직이는 읽기 소유자는 바깥 body',reading['y']>0 and reading['summaryY']==0,reading)
        return self.summary_anchor()

    def test_01_actual_editor_B_not_compose_or_map_A(self):
        s=self.load();self.click('#nav-space');self.click('#map-fit');self.click('#node-info-'+s['a'])
        self.equal('지도에서 선택한 것은 A',self.page.locator('.area-node.selected').get_attribute('data-area-id'),s['a'])
        self.click('#nav-work');self.details('compose-panel')
        self.equal('입력 대상은 A',self.page.locator('#compose-area').input_value(),s['a'])
        before=self.state();self.open_reference();r=self.owner(s,s['B'],s['b'],s['revision'],s['textB'])
        self.equal('열기 시 유효한 사용자 정정 설명',r['state'],'current')
        expect(self.page.locator(REF)).to_contain_text('사용자 정정')
        expect(self.page.locator(REF)).not_to_contain_text('A_ONLY_REFERENCE_29')
        self.equal('참고에 수정 가능한 데이터 입력란 없음',self.page.locator(REF+' input, '+REF+' textarea:not([readonly]), '+REF+' select, '+REF+' [contenteditable="true"]').count(),0)
        self.pair_geometry('#work-next');self.equal('열기와 읽기는 저장 데이터를 바꾸지 않음',self.state(),before)
        self.equal('읽기로 AI 요청하지 않음',self.posts,[])

    def test_02_first_key_keeps_body_nodes_focus_selection_and_excludes_stale_reference(self):
        s=self.load();self.open_reference();self.owner(s,s['B'],s['b'],s['revision'],s['textB'])
        self.scroll_reference()
        self.pair_geometry('#work-next')
        handles=[self.page.locator('#work-'+key).element_handle() for key in KEYS]
        body=self.page.locator(BODY).element_handle();selected=self.page.locator(SUMMARY).element_handle()
        self.click('#work-understanding');self.page.keyboard.press('Home');self.page.keyboard.press('ArrowRight');self.page.keyboard.press('Shift+ArrowRight')
        before=self.state();reading=self.reference()
        caret=self.page.locator('#work-understanding').evaluate('e=>({value:e.value,start:e.selectionStart,end:e.selectionEnd})')
        self.equal('실제 키로 한 글자 선택',caret['end']-caret['start'],1)
        self.page.keyboard.type('X')
        # 이 측정 앞에 click/reach/focus/재렌더 보정 호출을 넣지 않는다.
        after_key=self.page.evaluate('''([fields,body,summary])=>({same:fields.map(e=>e===document.getElementById(e.id)),bodySame:body===document.querySelector('.work-reference-body'),
          summarySame:summary===document.querySelector('.work-reference-summary'),focus:document.activeElement.id,start:fields[0].selectionStart,end:fields[0].selectionEnd,values:fields.map(e=>e.value),bodyY:body.scrollTop,summaryY:summary.scrollTop,
          selectedRevision:body.dataset.selectedRevision,state:body.dataset.referenceState,text:summary.textContent,open:body.closest('details').open})''',[handles,body,selected])
        self.record('actual','첫 키 직후 보정 전 DOM·초점·선택·본문',after_key)
        self.equal('manual4 DOM 동일',after_key['same'],[True]*4)
        self.yes('읽던 본문과 설명 DOM 동일',after_key['bodySame'] and after_key['summarySame'],after_key)
        self.equal('첫 키 뒤 실제 초점','work-understanding',after_key['focus'])
        self.equal('첫 키 뒤 실제 선택 범위',[after_key['start'],after_key['end']],[caret['start']+1]*2)
        expected=caret['value'][:caret['start']]+'X'+caret['value'][caret['end']:]
        old=next(t for t in before['tasks'] if t['id']==s['B'])['manual']
        self.equal('U만 실제 편집되고 S/N/C 그대로',after_key['values'],[expected,old['scope'],old['next'],old['checks']])
        self.equal('캡처 본문·판본·바깥과 내부 읽기 위치·펼침 보존',[after_key['text'],after_key['selectedRevision'],after_key['bodyY'],after_key['summaryY'],after_key['open']],[s['textB'],str(s['revision']),reading['y'],reading['summaryY'],True])
        self.equal('현재성만 stale로 변경',after_key['state'],'stale')
        self.reach(REF+' [data-reference-status]');expect(self.page.locator(REF+' [data-reference-status]')).to_contain_text('현재 인계 참고에는 포함되지 않아요')
        after=self.state();restored=json.loads(json.dumps(after));restored['revision']=before['revision'];restored['notice']=before['notice']
        next(t for t in restored['tasks'] if t['id']==s['B'])['manual']['understanding']=old['understanding']
        self.equal('의도한 U 수정 외 원보고·H·구상·basis·초안 보존',restored,before)
        self.details('handoff-preview');section=self.description_section(self.page.locator('#handoff-text').input_value())
        self.yes('stale 설명은 현재 설명 구역에서 제외됨','이번 작업문에 넣지 않음' in section and 'B_SELECTED_29' not in section,section)
        self.equal('전달문 읽기 자체는 추가 데이터 변경 없음',self.state(),after);self.equal('직접 입력·읽기에 AI 호출 없음',self.posts,[])

    def test_03_new_applied_revision_requires_explicit_reopen(self):
        s=self.load();self.open_reference();self.owner(s,s['B'],s['b'],s['revision'],s['textB'])
        self.scroll_reference()
        self.click(REF+' > summary');self.click(REF+' > summary')
        reopened=self.owner(s,s['B'],s['b'],s['revision'],s['textB'])
        self.equal('동일한 긴 r2도 명시 재열기는 처음부터 읽음',[reopened['y'],reopened['summaryY']],[0,0])
        anchor=self.scroll_reference()
        pinned=self.reference();self.yes('다시 읽은 r2의 실제 body 위치가 0보다 큼',pinned['y']>0 and pinned['summaryY']==0,pinned);before=self.state()
        self.details('compose-panel');self.details('result-file-panel')
        path=base.OUT/f'work29-{self.WIDTH}-new-revision.json';path.write_text(json.dumps(s['late'],ensure_ascii=False),encoding='utf-8')
        self.page.locator('#result-file-input').set_input_files(str(path))
        expect(self.page.locator('#result-file-preview')).to_have_attribute('data-target-task-id',s['B0'])
        self.click('#accept-result-file');base.saved(self.page)
        self.equal('다른 B0 반환이 실제 편집 B를 고르지 않음',self.state()['currentTaskId'],s['B'])
        after=self.state();self.equal('새 설명이 실제 적용됨',after['space']['understanding'][s['b']]['entries'][-1]['held'],None)
        retained=self.owner(s,s['B'],s['b'],s['revision'],s['textB'])
        self.equal('새 보고 수신 뒤 읽던 r2의 바깥·내부 스크롤 위치 보존',[retained['y'],retained['summaryY']],[pinned['y'],pinned['summaryY']])
        actual_anchor=self.summary_anchor(anchor)
        self.equal('같은 판본의 실제 원문 읽기 anchor 보존',[actual_anchor['lineIndex'],actual_anchor['text']],[anchor['lineIndex'],anchor['text']])
        expect(self.page.locator(REF+' [data-reference-new]')).to_be_visible();self.equal('읽던 것은 이전 판본',self.reference()['state'],'previous')
        self.equal('새 판본 수신은 기존 작업·네 값·H를 바꾸지 않음',after['tasks'][:len(before['tasks'])],before['tasks'])
        for key in ['draft','bases','currentTaskId']:self.equal('새 판본 수신 보호 '+key,after[key],before[key])
        self.click(REF+' > summary');self.click(REF+' > summary')
        selected_new=self.owner(s,s['B'],s['b'],s['revision']+1,s['textNew']);self.equal('명시 재열기 후 current',selected_new['state'],'current')
        self.equal('새 판본도 명시 선택 때 처음부터 읽음',[selected_new['y'],selected_new['summaryY']],[0,0])
        expect(self.page.locator(REF+' [data-reference-new]')).to_be_hidden()
        self.equal('명시 재열기도 저장 데이터 불변',self.state(),after);self.equal('새 판본 읽기에 AI 호출 없음',self.posts,[])

    def test_04_task_project_lifecycle_and_held_only(self):
        s=self.load();self.open_reference();old_entry=self.page.locator('html').get_attribute('data-entry-id')
        self.switch_task(s['a'],s['A']);self.details('edit-work')
        self.equal('다른 실제 작업에서 이전 참고 자동 열림 없음',self.page.locator(REF).evaluate('e=>e.open'),False)
        self.open_reference();self.owner(s,s['A'],s['a'],1,s['textA']);expect(self.page.locator(REF)).not_to_contain_text('B_SELECTED_29')
        self.switch_task(s['c'],s['C']);self.open_reference();r=self.reference()
        self.equal('held-only는 선택된 현재 판본이 없음',[r['state'],r['revision'],r['text']],['none','',None])
        held=self.page.locator(BODY+' > details',has_text='HELD_ONLY_29')
        self.equal('보류 자료는 별도 구역 한 곳에 남음',held.count(),1)
        self.equal('보류 자료는 자동으로 펼쳐지지 않음',held.evaluate('e=>e.open'),False)
        expect(self.page.locator(REF+' [data-reference-status]')).to_contain_text('적용된 설명은 없었어요')
        self.equal('작업 전환과 참고 읽기에 AI 호출 없음',self.posts,[])
        self.click('#nav-projects');expect(self.page.locator('#projects-view')).to_be_visible();self.click('#new-project')
        self.details('compose-panel');self.page.locator('#draft').fill('[합성29 새 프로젝트] 이전 부분의 설명을 가져오지 않는다.');self.click('#send')
        expect(self.page.locator('#working')).to_have_text('');base.saved(self.page)
        new=self.state();self.yes('정상 새 프로젝트 생성으로 ID가 다름',new['id']!=s['p']['id'],new['id']);self.open_reference()
        r=self.reference();self.equal('새 프로젝트의 실제 작업 귀속',[r['project'],r['task'],r['area'],r['state'],r['text']],[new['id'],new['currentTaskId'],'','unassigned',None])
        expect(self.page.locator(REF)).not_to_contain_text('B_SELECTED_29');expect(self.page.locator(REF)).not_to_contain_text('HELD_ONLY_29')
        self.click('#nav-projects');self.click(f'.project-card[data-entry-id="{old_entry}"] .project-open');self.click('#nav-work');self.details('edit-work')
        self.equal('프로젝트 왕복 뒤 참고 자동 누출 없음',self.page.locator(REF).evaluate('e=>e.open'),False)
        self.equal('프로젝트 왕복은 이전 실제 작업 C를 보존',self.state()['currentTaskId'],s['C'])

class WorkDescription29Wide(WorkDescription29):
    WIDTH,HEIGHT=1440,900

if __name__=='__main__':unittest.main(verbosity=2)
