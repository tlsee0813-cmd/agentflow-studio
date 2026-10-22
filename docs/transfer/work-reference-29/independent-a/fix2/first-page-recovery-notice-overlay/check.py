from fixture import *
from support import sha
LONG=CORRECTION+'\n\n'+'\n\n'.join(f'검토 맥락 {i}: 안내 화면의 표시는 30일로 읽는다. 실제 보관 동작은 7일 유지이며 배포나 정책 변경을 요청하지 않는다. 이 설명은 합성 자료의 표현을 정정한 사용자 참고이고 실행 결과나 검증된 사실이 아니다.' for i in range(1,5))+'\n\n[중간29] 안내 표시30과 실제 보관7은 다른 역할이다. 직접 입력한 범위와 완료 조건을 그대로 읽고, 필요한 안내 표시만 고친다.\n\n'+'\n\n'.join(f'대조 메모 {i}: 자료 찾기 B의 구상과 보고 원문은 이 설명으로 바뀌지 않는다. 이전 인계의 네 값은 당시 사본으로 보존하며, 설명의 현재성은 작업문을 실제 고친 뒤 다시 확인한다. 앱의 의미 검증이나 자동 정책 변경으로 해석하지 않는다.' for i in range(5,9))
assert len(LONG)<2000
NEW='[새 설명29 · 별도 A 작업의 실제 H 기반 합성] 안내 표시는30일, 실제 보관7/배포금지다. 이것은 새 외부 정리 참고이며 기존 직접값을 고치는 지시가 아니다.'
# Read-only targeted text Range, own/ancestor clipping and actual representative hit.
SAMPLE=r'''(e,token)=>{const text=e.firstChild;if(!text||text.nodeType!==3)throw Error('expected plain description text node');const start=text.textContent.indexOf(token);if(start<0)throw Error('missing token');const range=document.createRange();range.setStart(text,start);range.setEnd(text,Math.min(text.length,start+token.length));let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};const ancestors=[];for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),sx=a.offsetWidth?b.width/a.offsetWidth:1,sy=a.offsetHeight?b.height/a.offsetHeight:1,c={left:b.left+a.clientLeft*sx,top:b.top+a.clientTop*sy,right:b.left+(a.clientLeft+a.clientWidth)*sx,bottom:b.top+(a.clientTop+a.clientHeight)*sy};if(/auto|scroll|hidden|clip/.test(s.overflowX)){clip.left=Math.max(clip.left,c.left);clip.right=Math.min(clip.right,c.right)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){clip.top=Math.max(clip.top,c.top);clip.bottom=Math.min(clip.bottom,c.bottom)}ancestors.push({id:a.id,class:a.className,rect:b.toJSON(),client:c,overflow:[s.overflowX,s.overflowY],transform:s.transform,display:s.display,visibility:s.visibility})}const rects=[...range.getClientRects()].map(r=>{const c={left:Math.max(clip.left,r.left),top:Math.max(clip.top,r.top),right:Math.min(clip.right,r.right),bottom:Math.min(clip.bottom,r.bottom)},positive=c.right>c.left&&c.bottom>c.top,x=(c.left+c.right)/2,y=(c.top+c.bottom)/2,h=positive?document.elementFromPoint(x,y):null;return{raw:r.toJSON(),clip:c,positive,hit:!!h&&(h===e||e.contains(h)),hitNode:h?.outerHTML.slice(0,180)}});return{token,rects,allAncestorsClip:clip,ancestors,elementRect:e.getBoundingClientRect().toJSON(),textOffset:start,textLength:text.length,visibleSample:rects.some(r=>r.positive&&r.hit)}}'''
class Check(Observation):
 def check(self,ok,label,raw):
  self.checks.append({'label':label,'pass':bool(ok),'raw':raw});self.log('CHECK '+label,{'pass':bool(ok),'raw':raw})
 def ref(self):return self.p.locator('#edit-work .work-reference')
 def body(self):return self.ref().locator('.work-reference-body')
 def summary(self):return self.body().locator('.work-reference-summary')
 def openRef(self):
  self.detail('edit-work');q=self.ref()
  if not q.evaluate('e=>e.open'):self.click(q.locator(':scope > summary'),'실제 편집 작업의 참고 열기')
  return self.ref()
 def closeRef(self):
  if self.ref().evaluate('e=>e.open'):self.click(self.ref().locator(':scope > summary'),'참고 명시 닫기')
 def refSnap(self):
  return {'reference':self.ref().evaluate('e=>({open:e.open,dataset:{...e.dataset},rect:e.getBoundingClientRect().toJSON(),caption:e.querySelector("[data-reference-status]").textContent,newer:{hidden:e.querySelector("[data-reference-new]").hidden,text:e.querySelector("[data-reference-new]").textContent}})'),'body':self.body().evaluate('e=>({dataset:{...e.dataset},scrollTop:e.scrollTop,max:e.scrollHeight-e.clientHeight,client:e.clientHeight,total:e.scrollHeight,text:e.textContent,rect:e.getBoundingClientRect().toJSON(),open:[...e.querySelectorAll("details[open]")].map(x=>x.id)})'),'selectedText':self.summary().inner_text() if self.summary().count() else None,'selectedSummaryScroll':self.summary().evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight,client:e.clientHeight,total:e.scrollHeight,overflow:getComputedStyle(e).overflow,rect:e.getBoundingClientRect().toJSON()})') if self.summary().count() else None,'inputs':{k:self.p.locator('#work-'+k).evaluate('e=>({value:e.value,start:e.selectionStart,end:e.selectionEnd,rect:e.getBoundingClientRect().toJSON(),focused:e===document.activeElement})') for k in OLD},'snapshot':self.snap()}
 def receive(self,path):
  self.button('결과 JSON 가져오기')
  with self.p.expect_file_chooser() as f:self.button('결과 파일 선택')
  f.value.set_files(str(path));self.button('이 결과 가져오기');expect(self.p.locator('#received-result-open')).to_be_visible();self.state()
 def readA(self):self.map();self.visibleInfo('보관 안내');self.button(REQUEST+' ↘')
 def rangeSample(self,token='[중간29] 안내 표시30과 실제 보관7은 다른 역할이다.'):
  return self.summary().evaluate(SAMPLE,token)
 def bodyWheel(self,dy):
  g=self.body().evaluate(GEO);b=g['rect'];c=g['clip'];left=max(b['left'],c['left']);right=min(b['right'],c['right']);top=max(b['top'],c['top']);bottom=min(b['bottom'],c['bottom']);assert right>left and bottom>top
  x=left+1;y=(top+bottom)/2;hit=self.p.evaluate('p=>({tag:document.elementFromPoint(p.x,p.y)?.tagName,id:document.elementFromPoint(p.x,p.y)?.id})',{'x':x,'y':y});self.log('actual body wheel pointer',{'x':x,'y':y,'dy':dy,'hit':hit,'before':self.body().evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight})')})
  self.p.evaluate("""()=>{window.__work29Wheel=new Promise(resolve=>{let active=false,timer;const events=[];const done=ok=>{clearTimeout(timer);document.removeEventListener('wheel',wheel,true);document.removeEventListener('scrollend',end,true);resolve({ok,events})},wheel=e=>{if(e.isTrusted){active=true;events.push({type:'wheel',target:e.target.id,class:e.target.className,delta:e.deltaY})}},end=e=>{if(active&&e.target.matches?.('.work-reference-body')){events.push({type:'scrollend',target:e.target.id,top:e.target.scrollTop});done(true)}};document.addEventListener('wheel',wheel,true);document.addEventListener('scrollend',end,true);timer=setTimeout(()=>done(false),4000)})}""")
  try:self.p.mouse.move(x,y);self.p.mouse.wheel(0,dy);v=self.p.evaluate('async()=>await window.__work29Wheel');self.log('actual body native scroll completion',v);assert v['ok']
  finally:self.p.evaluate('()=>delete window.__work29Wheel')
 def reach(self,q):
  within=q.locator('xpath=ancestor::*[contains(concat(" ",normalize-space(@class)," ")," work-reference-body ")]')
  if not within.count():return super().reach(q)
  super().reach(self.body())
  for _ in range(30):
   g=q.evaluate(GEO)
   if g['visible'] and g['full'] and g['hit']:return g
   b=g['rect'];c=g['clip'];dy=b['top']-c['top']-5 if b['top']<c['top'] else b['bottom']-c['bottom']+5;self.bodyWheel(max(-350,min(350,dy)))
  raise AssertionError('native body reach failed '+str(g))
 def openOriginal(self):
  hist=self.body().locator('details[id$="-history"]');self.click(hist.locator(':scope > summary'),'이전 설명 기록 정상 펼침');ev=hist.locator('details[id$="-old-1"]');self.click(ev.locator(':scope > summary'),'이전 실제 보고 근거 펼침');raw=ev.locator('details[id$="-file"]');self.click(raw.locator(':scope > summary'),'실제 수신 JSON 원문 펼침');field=raw.locator('textarea.export-preview');self.reach(field);value=field.input_value();self.check(json.loads(value)==self.rawFile,'opened original JSON exact, inner textarea scroll out of scope',{'rawSHA256':sha(value.encode()),'detailsId':raw.get_attribute('id'),'rawTextarea':field.evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight,rect:e.getBoundingClientRect().toJSON()})')})
 def markerReading(self):
  self.reach(self.body());sample=self.rangeSample()
  for _ in range(12):
   if sample['visibleSample']:break
   rr=sample['rects'][0]['raw'];clip=sample['allAncestorsClip'];dy=(rr['top']+rr['bottom'])/2-(clip['top']+clip['bottom'])/2;self.bodyWheel(max(-350,min(350,dy)));sample=self.rangeSample()
  self.check(sample['visibleSample'],'actual pinned paragraph visible before new receipt',sample)
  return sample
 def naturalMiddle(self):
  body=self.body();self.reach(body);m=body.evaluate('e=>e.scrollHeight-e.clientHeight');target=m/2
  if m<=0:self.log('reference no natural scroll',{'max':m});return
  for _ in range(12):
   top=body.evaluate('e=>e.scrollTop')
   if abs(target-top)<4:break
   self.bodyWheel(max(-350,min(350,target-top)))
  self.log('actual internal wheel middle',self.refSnap());assert body.evaluate('e=>e.scrollTop')>0;assert self.summary().evaluate('e=>e.scrollHeight-e.clientHeight')<=1
 def sameViewportN(self):
  self.reach(self.p.locator('#work-next'))
  # Native reference wheel only, locate a literal sentence in the selected summary.
  sample=self.rangeSample();body=self.body()
  for _ in range(15):
   if sample['visibleSample']:break
   rect=sample['rects'][0]['raw'];clip=sample['allAncestorsClip'];dy=(rect['top']+rect['bottom'])/2-(clip['top']+clip['bottom'])/2;old=body.evaluate('e=>e.scrollTop');self.bodyWheel(max(-350,min(350,dy)));sample=self.rangeSample()
   if body.evaluate('e=>e.scrollTop')==old:break
  ng=self.p.locator('#work-next').evaluate(GEO);ok=ng['full'] and ng['hit'] and sample['visibleSample'];self.check(ok,'actual selected-description sentence and N same viewport',{'N':ng,'descriptionSentence':sample,'layout':self.p.locator('.work-edit-layout').evaluate('e=>({display:getComputedStyle(e).display,columns:getComputedStyle(e).gridTemplateColumns,rect:e.getBoundingClientRect().toJSON(),container:e.parentElement.getBoundingClientRect().toJSON()})')});self.screenshot('selected-description-and-N')
 def run(self,w,h):
  self.prepare(w,h);base=self.state();(R/f'{w}-initial.json').write_text(json.dumps(base,ensure_ascii=False,indent=2))
  self.map();self.visibleInfo('보관 안내');self.text('설명 오류 고치기');self.fill(self.p.get_by_role('textbox',name='영역 설명 정정',exact=True),LONG);self.button('정정 저장');assert self.state()['space']['understanding'][self.ids['보관 안내']]['revision']==2
  # Current B, A reader and then A compose target must not choose A as B's reference owner.
  self.map();self.visibleInfo('자료 찾기');self.button('[합성25 준비] 자료를 찾는 안내문을 정리해 주세요. 보관 안내는 변경하지 마세요. ↘');self.click(self.p.locator('#task-view-continue'),'명시 B 이어가기');assert self.state()['currentTaskId']==self.Btask
  self.readA();self.click(self.p.locator('#nav-work'),'A 읽기 후 B 편집으로');self.openRef();snap=self.refSnap();self.check(snap['reference']['dataset']['areaId']==self.ids['자료 찾기'] and snap['selectedText'] is None,'B edit while A reader visited is B only',snap)
  self.map();self.visibleInfo('보관 안내');self.button('이 영역에 새 요청');assert self.state()['currentTaskId']==self.Btask;self.openRef();snap=self.refSnap();self.check(snap['reference']['dataset']['areaId']==self.ids['자료 찾기'] and snap['selectedText'] is None,'B edit with A compose target is B only',{'reference':snap,'draftTarget':self.state()['space']['draftTarget']})
  self.readA();self.click(self.p.locator('#task-view-continue'),'A 작업으로 명시 이어가기');assert self.state()['currentTaskId']==self.Atask;self.check(not self.ref().evaluate('e=>e.open'),'task switch closes prior B reference',self.refSnap());self.openRef();self.check(self.summary().inner_text()==LONG,'explicit A selects exact user revision2',self.refSnap());self.naturalMiddle()
  # Read-only JS handles, not DOM flags. All cursor movement/selection uses native keyboard.
  handles={k:self.p.locator('#work-'+k).element_handle() for k in OLD};bodyHandle=self.body().element_handle();summaryHandle=self.summary().element_handle();q=self.p.locator('#work-understanding');self.click(q,'U 입력 선택');q.press('Control+Home');i=q.input_value().index('7일')
  for _ in range(i):q.press('ArrowRight')
  q.press('Shift+ArrowRight');pre=self.refSnap();assert pre['inputs']['understanding']['start']==i and pre['inputs']['understanding']['end']==i+1
  q.press('3');post=self.refSnap();identity={k:self.p.locator('#work-'+k).evaluate('(e,old)=>e===old',v) for k,v in handles.items()};bodySame=self.body().evaluate('(e,old)=>e===old',bodyHandle);summarySame=self.summary().evaluate('(e,old)=>e===old',summaryHandle)
  ok=all(identity.values()) and bodySame and summarySame and post['inputs']['understanding']['focused'] and post['inputs']['understanding']['start']==i+1 and post['inputs']['understanding']['end']==i+1 and all(post['inputs'][k]['value']==pre['inputs'][k]['value'] for k in ['scope','next','checks']) and post['selectedText']==pre['selectedText'] and post['body']['scrollTop']==pre['body']['scrollTop'] and post['reference']['open'] and post['body']['dataset']['selectedRevision']=='2' and '이전 기준' in post['reference']['caption']
  self.check(ok,'first native U key preserves DOM focus selection selected text revision scroll and N/S/C',{'pre':pre,'post':post,'sameInputDOM':identity,'sameBodyDOM':bodySame,'sameSummaryDOM':summarySame});q.press('0');self.state()
  n=self.p.locator('#work-next');self.reach(n);self.fill(n,n.input_value().replace('현재 안내 표시는 7일','현재 안내 표시는 30일'));manual={k:(self.p.locator('#work-'+k).input_value()) for k in OLD};self.check(manual['scope']==OLD['scope'] and manual['checks']==OLD['checks'] and '현재 안내 표시는 30일' in manual['understanding'] and '현재 안내 표시는 30일' in manual['next'],'manual display30 only actual policy7 unchanged',manual);self.sameViewportN()
  preExport=self.state();f,u,H,text=self.exportFile('A-stale-reference-excluded');section=text[text.find('## 영역 현재 설명'):text.find('## 이어가는 목적') if '## 이어가는 목적' in text else text.find('## 이어가는 목적')];self.check(H['work']==manual and H['anchor']['areaId']==self.ids['보관 안내'] and LONG not in text and '영역 현재 설명 — 이번 작업문에 넣지 않음' in text,'actual H manual exact and stale current-description section excluded',{'H':H,'clipboardSHA256':sha(text.encode()),'text':text});after=self.state();assert next(t for t in after['tasks'] if t['id']==self.report['id'])==self.report;assert next(t for t in after['tasks'] if t['id']==self.Btask)==next(t for t in base['tasks'] if t['id']==self.Btask)
  for key in ['bases','sources']:assert after[key]==base[key]
  for key in ['areas','relations','brief','containment','layout']:assert after['space'][key]==base['space'][key]
  # A separate real task exports a fresh H after manual edits, then return to current A1 before import.
  self.map();self.visibleInfo('보관 안내');self.button('이 영역에 새 요청');a2,_=self.send('[합성29 별도 A 작업] 안내 표현의 관찰 자료만 정리해 주세요. 정책/배포는 바꾸지 마세요.');f2,u2,H2,_=self.exportFile('separate-A2-fresh-H')
  newRaw={**f2,'report':'[명시 합성29 별도 A 작업 보고] 실제 실행이나 검증 기록이 아니다.','evidence':None,'understanding':{**u2,'summary':NEW,'changes':['기존 직접 작업문과 구별되는 새 외부 설명 기록이다.'],'proposal':None,'origin':'관측자가 별도 작업의 실제 H/template에 작성한 합성29. AI 실행 없음.'}};path=R/f'{w}-separate-A2-return2.json';path.write_text(json.dumps(newRaw,ensure_ascii=False,indent=2))
  self.readA();self.click(self.p.locator('#task-view-continue'),'A1 current 유지 준비');assert self.state()['currentTaskId']==self.Atask;self.openRef();assert self.summary().inner_text()==LONG;self.openOriginal();self.naturalMiddle();beforeLine=self.markerReading();oldPin=self.refSnap();oldLocal=beforeLine['rects'][0]['raw']['top']-oldPin['body']['rect']['top'];self.receive(path);assert self.state()['currentTaskId']==self.Atask;newPin=self.refSnap();afterLine=self.rangeSample();newLocal=afterLine['rects'][0]['raw']['top']-newPin['body']['rect']['top'];self.check(oldPin['body']['scrollTop']>0 and abs(newPin['body']['scrollTop']-oldPin['body']['scrollTop'])<=1 and abs(newLocal-oldLocal)<=1 and newPin['body']['open']==oldPin['body']['open'] and newPin['selectedSummaryScroll']['max']<=1 and newPin['selectedSummaryScroll']['top']==0 and newPin['selectedText']==LONG and newPin['body']['dataset']['selectedRevision']=='2' and not newPin['reference']['newer']['hidden'],'new separate-task description arrival keeps old selected body and announces new',{'old':oldPin,'afterReceive':newPin,'A2':a2,'actualH':H2,'beforeLine':beforeLine,'afterLine':afterLine,'lineRelativeTopBefore':oldLocal,'lineRelativeTopAfter':newLocal});self.reach(self.body());self.check(self.rangeSample()['visibleSample'],'same paragraph visible after page-only recovery',self.rangeSample());self.screenshot('after-new-receipt-same-pin-body-position');self.closeRef();self.openRef();reopened=self.refSnap();self.check(reopened['selectedText']==NEW and reopened['body']['dataset']['selectedRevision']=='3','explicit reopen selects latest revision3',reopened);self.reach(self.ref().locator(':scope > summary'));self.screenshot('new-description-explicit-reopen')
  # One exact reader origin return (not sidebar navigation restoration).
  self.readA();originPre=self.snap();self.click(self.p.locator('#task-return-origin'),'명시 출발 지도 복귀');self.log('origin return after reference workflow',{'beforeReturnReader':originPre,'afterReturnImmediate':self.snap(),'current':self.state()['currentTaskId']});self.check(self.state()['currentTaskId']==self.Atask,'origin return keeps current A1',self.snap())
  # None / held-only / archived owner through normal UI.
  self.detail('area-add-panel');self.fill(self.p.locator('#area-name'),'합성29 보류 부분');self.fill(self.p.locator('#area-note'),'보류된 설명은 현재 설명이 아니다.');self.click(self.p.locator('#area-add'),'보류 경계용 실제 영역');self.ids['합성29 보류 부분']=self.state()['space']['areas'][-1]['id'];self.visibleInfo('합성29 보류 부분');self.button('이 영역에 새 요청');ht,_=self.send('[합성29 보류] 자료를 읽는 요청만 정리해 주세요.');hf,hu,hh,_=self.exportFile('held-original-H');self.map();self.visibleInfo('합성29 보류 부분');self.detail('panel-edit');self.fill(self.p.locator('#panel-note'),'정상 UI로 구상을 바꿨다. 옛 인계의 설명은 보류되어야 한다.');self.click(self.p.locator('#panel-save'),'held actual note change');self.click(self.p.locator('#nav-work'),'held 요청 current work')
  hp=R/f'{w}-held-return2.json';hp.write_text(json.dumps({**hf,'report':'[명시 합성29 보류 보고] 실행 아님','evidence':None,'understanding':{**hu,'summary':'[보류29] 현재 본문으로 승격하면 안 되는 옛 기준의 합성 설명','changes':[],'proposal':None,'origin':'실제 옛 H 기반 합성29'}},ensure_ascii=False,indent=2));self.receive(hp);self.openRef();none=self.refSnap();self.check(none['selectedText'] is None and '적용된 설명은 없었어요' in none['reference']['caption'] and '반영하지 않은' in none['reference']['caption'],'held-only no selected current body',none)
  self.map();self.visibleInfo('합성29 보류 부분');self.button('영역 열기 ↗');self.click(self.p.locator('#area-archive'),'정상 UI 영역 보관');self.click(self.p.locator('#nav-work'),'보관 소유 current work');self.openRef();arch=self.refSnap();self.check('보관된 부분' in arch['body']['text'] and arch['selectedText'] is None,'archived owner labelled, no substitute A',arch)
  final=self.state();(R/f'{w}-final.json').write_text(json.dumps(final,ensure_ascii=False,indent=2));self.rows.append({'viewport':[w,h],'complete':True,'A':self.Atask,'A2':a2,'B':self.Btask,'manual':manual,'cumulativeChecksSoFar':len(self.checks),'finalCurrent':final['currentTaskId']})
u=None;fatal=None;cleanup=[];code=1
try:
 u=Check();u.checks=[]
 for w,h in [(1280,720),(1440,900)]:
  try:u.run(w,h)
  except Exception:
   raw=traceback.format_exc();u.failures.append({'viewport':[w,h],'traceback':raw});print(raw,file=sys.stderr);u.screenshot('first-error');u.log('failure AX',u.p.locator('body').aria_snapshot());break
except Exception:fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 failed=[x['label'] for x in u.checks if not x['pass']] if u else []
 code=int(bool(fatal or not u or u.failures or u.errors or cleanup or failed or len(u.rows)!=2))
 # Detailed geometry stays once in JSONL, not duplicated into result.
 (R/'result.json').write_text(json.dumps({'sourceCommit':'f10eb68962ea1e6d35a491891b8c0c3b934eac77','expectedPC':2,'completedPC':len(u.rows) if u else 0,'rows':u.rows if u else [],'checks':[{'label':x['label'],'pass':x['pass'],'rawReference':'ui.jsonl CHECK '+x['label']} for x in u.checks] if u else [],'failedChecks':failed,'harnessErrors':u.failures if u else [],'fatal':fatal,'pageerrors':u.errors if u else [],'cleanup':cleanup,'plannedChildExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
