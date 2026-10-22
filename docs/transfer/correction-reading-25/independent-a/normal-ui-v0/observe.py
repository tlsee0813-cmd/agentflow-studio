from pathlib import Path
import json,re,traceback,sys,hashlib
from support import UI,GEO,R,A,UTC
from playwright.sync_api import expect
PURPOSE='[합성25] 자료 보관 안내를 정리한다. 안내 표시와 실제 보관 동작을 구분하고 배포하지 않는다.'
REQUEST='[합성25] 보관 안내 문구를 읽기 쉽게 정리해 주세요. 실제 보관 동작은 7일 유지하고 배포하지 마세요.'
NOTES={'보관 안내':'현재 자료 보관 안내의 표시를 설명한다. 실제 보관 동작과 배포는 변경하지 않는다.','자료 찾기':'저장된 자료를 찾는 안내를 유지한다. 이번 보관 안내 표현 수정과 무관하다.'}
EXTERNAL='[명시 합성25 외부 설명] 현재 안내 표시는 7일이다. 실제 보관 동작 변경을 확인한 설명은 아니다.'
CORRECTION='[합성25 사용자 설명 정정] 실제 안내의 표시는 30일이다. 이전 설명의 7일은 오류다. 실제 보관 동작은 7일 유지하며 보관 정책 변경 요청이 아니다.'
ORIGIN='관측자가 실제 UI 내보내기 템플릿에 작성한 합성 설명. 실제 AI·구현·검사 없음.'
OLD={'understanding':'[U25 고유] 현재 안내 표시는 7일이다. 실제 보관 동작은 별도 조건이다.','scope':'[S25 고유] 실제 보관 동작은 7일 유지, 배포하지 않음. 자료 찾기 부분은 변경하지 않음.','next':'[N25 고유] 현재 안내 표시는 7일이라는 안내문을 정리한다. 실제 보관 동작을 바꾸지 않는다.','checks':'[C25 고유] 실제 보관 동작은 7일 유지, 배포하지 않음. 보관 동작·B구상 변경이 없는지 확인한다.'}
class Observation(UI):
 def visibleInfo(self,name):
  aid=self.ids[name];q=self.p.locator('#node-info-'+aid)
  def can(e):
   if not e.count():return False
   g=e.evaluate(GEO);return g['visible'] and g['full'] and g['hit']
  if not can(q):
   chip=self.p.locator('#map-offscreen')
   if can(chip):self.click(chip,'보이는 화면 밖 표시의 모두 보기')
   else:
    close=self.p.locator('#area-panel-close')
    if can(close):self.click(close,'패널 닫기')
    self.button('전체 맞춤')
  if can(q):self.click(q,name+' 실제 정보 버튼')
  else:self.detail('area-list');self.click(self.p.locator('#list-info-'+aid),name+' 기존 영역 목록 정보')
 def phase(self,name,note=''):self.log('PHASE '+name,{'observer':'기존 UI를 아는 관측자; UI 판독과 저장값 검증 분리','note':note,'snapshot':self.snap()})
 def fillFour(self,vals):
  self.detail('edit-work')
  for k,v in vals.items():self.fill(self.p.locator('#work-'+k),v)
  self.state()
 def readFields(self,label):
  self.detail('edit-work');out={}
  for k in OLD:
   q=self.p.locator('#work-'+k);self.reach(q);v=q.evaluate('e=>({value:e.value,rect:e.getBoundingClientRect().toJSON(),scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,clientWidth:e.clientWidth,font:getComputedStyle(e).fontSize})');v['geometry']=q.evaluate(GEO);out[k]=v;self.log('visible field read '+label+' '+k,v)
  return out
 def workLabels(self,label):
  out={'stage':self.p.locator('#stage-label').inner_text(),'copyLabel':self.p.locator('#copy-work').inner_text(),'title':self.p.locator('#context-title').inner_text(),'sub':self.p.locator('#context-sub').inner_text(),'snapshot':self.snap()};self.log('work labels '+label,out);return out
 def exportFile(self,label):
  self.detail('file-return-options');oldPreview=self.p.locator('#file-handoff-preview textarea');oldText=oldPreview.input_value() if oldPreview.count() else None;self.click(self.p.locator('#copy-file-work'),'실제 파일 결과용 작업문 복사 '+label);expect(self.p.locator('#file-handoff-preview')).to_have_count(1);
  if oldText is not None:expect(self.p.locator('#file-handoff-preview textarea')).not_to_have_value(oldText)
  p=self.state();text=self.p.evaluate('navigator.clipboard.readText()');(R/f'{self.w}-{label}.md').write_text(text);t=next(t for t in p['tasks'] if t['id']==p['currentTaskId']);H=t['handoffs'][-1];blocks=[json.loads(s) for s in re.findall(r'```json\n(.*?)\n```',text,re.S)];f=next(x for x in blocks if x.get('schemaVersion')=='agentflow.return.2');u=next(x for x in blocks if x.get('version')=='understanding.1');digest=self.p.evaluate('t=>{let h=0x811c9dc5;for(let i=0;i<t.length;i++){h^=t.charCodeAt(i);h=Math.imul(h,0x01000193)}return {chars:t.length,digest:(h>>>0).toString(16).padStart(8,"0")}}',text);self.log('clipboard completion digest check '+label,{'actual':digest,'record':{'chars':H['chars'],'digest':H['digest']},'H':H,'previousPreviewValueChanged':oldText is None or self.p.locator('#file-handoff-preview textarea').input_value()!=oldText});assert digest=={'chars':H['chars'],'digest':H['digest']};assert [f['projectId'],f['taskId'],f['returnId']]==[p['id'],t['id'],H['returnId']];self.log('actual clipboard file export '+label,{'H':H,'template':f,'understandingTemplate':u,'clipboardUTF16Digest':digest});return f,u,H,text
 def prepare(self,w,h):
  self.new(w,h);self.click(self.p.locator('#nav-projects'),'내 프로젝트');self.button('＋ 새 프로젝트');self.fill(self.p.get_by_role('textbox',name='무엇을 만드나요? 프로젝트 목적 · 작업 요청과 따로 보관해요',exact=True),PURPOSE);self.button('영역 나누러 가기')
  for name,note in NOTES.items():self.fill(self.p.get_by_role('textbox',name='영역 이름',exact=True),name);self.fill(self.p.get_by_role('textbox',name='영역 설명',exact=True),note);self.button('＋ 영역 추가');self.state()
  self.ids={a['name']:a['id'] for a in self.state()['space']['areas']};self.visibleInfo('보관 안내');self.button('이 영역에 새 요청');self.Atask,_=self.send(REQUEST);self.fillFour(OLD);f,u,self.H0,_=self.exportFile('H0-sent-before-external');assert self.H0['work']==OLD
  raw={**f,'report':'[명시 합성25 보고] 현재 안내 표시는 7일이라고 읽은 외부 보고. 실제 보관 정책 변경·구현·실행을 검증한 기록이 아니다.','evidence':None,'understanding':{**u,'summary':EXTERNAL,'changes':['[합성25] 안내 표시를 7일로 읽었다.'],'proposal':None,'origin':ORIGIN}};path=R/f'{w}-synthetic-return2.json';path.write_text(json.dumps(raw,ensure_ascii=False,indent=2));self.button('결과 JSON 가져오기')
  with self.p.expect_file_chooser() as chooser:self.button('결과 파일 선택')
  chooser.value.set_files(str(path));self.button('이 결과 가져오기');expect(self.p.locator('#received-result-open')).to_be_visible();p=self.state();self.report=next(t for t in p['tasks'] if t.get('resultFile') and t['resultFile']['returnId']==f['returnId']);self.rawFile=raw
  # Explicit fixture navigation to edit the original request, not its received report T.
  self.map();self.visibleInfo('자료 찾기');self.button('이 영역에 새 요청');self.Btask,_=self.send('[합성25 준비] 자료를 찾는 안내문을 정리해 주세요. 보관 안내는 변경하지 마세요.');self.map();self.visibleInfo('보관 안내');self.button(REQUEST+' ↘');self.click(self.p.locator('#task-view-continue'),'읽은 원래 A 요청으로 명시 이어가기');assert self.state()['currentTaskId']==self.Atask
  # Export again only to isolate correction's digest/label change from prior report/B preparation.
  _,_,self.H1,_=self.exportFile('H1-baseline-external-description');assert self.H1['work']==OLD;self.base=self.state();(R/f'{w}-before-correction-project.json').write_text(json.dumps(self.base,ensure_ascii=False,indent=2));self.log('fixture complete before observed task',{'Atask':self.Atask,'Aarea':self.ids['보관 안내'],'Btask':self.Btask,'reportTask':self.report['id'],'reportH0':self.H0['returnId'],'latestPreCorrectionH1':self.H1['returnId'],'manual':OLD,'setup':'normal UI only; B request is preparation so explicit continue chooses original A, not current report T'})
 def run25(self,w,h):
  self.prepare(w,h);self.phase('1 current description correction and historical H reading','같은 A work에서 시작. 설명 정정과 당시H 읽기를 위해 다른 화면으로 이동.');beforeLabels=self.workLabels('before description correction');self.map();self.visibleInfo('보관 안내');self.text('설명 오류 고치기');self.fill(self.p.get_by_role('textbox',name='영역 설명 정정',exact=True),CORRECTION);self.button('정정 저장');corrected=self.state();assert next(t for t in corrected['tasks'] if t['id']==self.Atask)['manual']==OLD
  edit=self.p.get_by_role('textbox',name='영역 설명 정정',exact=True).locator('xpath=ancestor::details[1]')
  if edit.evaluate('e=>e.open'):self.text('설명 오류 고치기')
  body=self.p.locator('#area-panel-body')
  for _ in range(10):
   top=body.evaluate('e=>e.scrollTop')
   if top<=0:break
   self.wheel(-min(400,top),body)
  self.text('설명 전체 보기');d=self.p.locator('#area-panel').get_by_text(CORRECTION,exact=True);self.reach(d);self.log('visible current description user reading',{'text':d.inner_text(),'geometry':d.evaluate(GEO),'currentAreaUserIdea':self.p.locator('#panel-idea').inner_text(),'readingMeaning':'표시30/실제동작7; 사용자 정정도 앱 미검증 참고이며 새 정책이 아님'});self.screenshot('01-current-description-thirty')
  self.button(REQUEST+' ↘');picker=self.p.get_by_role('button',name=re.compile(r'^\[명시 합성25 보고\]'));self.click(picker,'실제 보고 원문 명시 선택');self.text('이 결과를 요청할 때 내보낸 작업문');hist=self.p.locator('#task-report-export-work');self.log('historical H section DOM scope',{'heading':hist.locator(':scope > summary').inner_text(),'content':hist.inner_text(),'meaning':'정확한 원보고H0 당시 4값. current values are not substituted.'})
  # Read each old manual value through a real visible row, not from hidden saved payload.
  seenH=[]
  for k,text in OLD.items():
   q=hist.get_by_text(text,exact=True);self.reach(q);seenH.append({'field':k,'text':q.inner_text(),'geometry':q.evaluate(GEO)});self.log('visible exact historical H field '+k,seenH[-1])
  self.click(self.p.locator('#task-return-origin'),'읽기 출발 지도 패널로 복귀');self.click(self.p.locator('#nav-work'),'원래 A 현재 작업 직접편집으로 돌아가기');assert self.state()['currentTaskId']==self.Atask
  self.phase('2 unchanged seven-valued fields and changed-label counterexample','정정 설명30과 H0 네값7은 다른 화면에서 확인했고, 편집할 때 이를 기억해야 함.');afterLabels=self.workLabels('after description correction, before any manual edit');fields=self.readFields('after correction still seven');assert {k:v['value'] for k,v in fields.items()}==OLD
  self.log('editor inline reference observation',{'visibleEditorText':self.p.locator('#edit-work').inner_text(),'currentDescriptionTextInEditorDOM':CORRECTION in self.p.locator('#edit-work').inner_text(),'meaning':'four editable values and labels can be read here; corrected description was read on the area/reader screen, not alongside these fields'})
  self.detail('handoff-preview');preview=self.p.locator('#handoff-text');self.reach(preview);previewText=preview.input_value();(R/f'{w}-preview-after-description-before-manual.md').write_text(previewText);assert CORRECTION in previewText and all(v in previewText for v in OLD.values());self.log('preview before manual edit verification only',{'controlGeometry':preview.evaluate(GEO),'nativeDimensions':preview.evaluate('e=>({top:e.scrollTop,client:e.clientHeight,total:e.scrollHeight})'),'valueSHA256':hashlib.sha256(previewText.encode()).hexdigest(),'UIReadingLimit':'input_value complete text is validation only; do not claim all textarea text was visually read','savedExportsUnchanged':next(t for t in self.state()['tasks'] if t['id']==self.Atask)['handoffs']==next(t for t in self.base['tasks'] if t['id']==self.Atask)['handoffs']})
  self.click(self.p.locator('#handoff-preview > summary'),'전체 미리보기 접기');self.reach(self.p.locator('#copy-work'));self.screenshot('02-modified-copy-label-before-manual-edit')
  self.phase('3 minimal direct edit and actual file copy','기억한 현재 표시30만 이해/다음행동에 반영. UI 입력값을 읽어 치환하고 범위/확인은 건드리지 않음.');edited={k:v['value'] for k,v in fields.items()}
  for k in ['understanding','next']:
   q=self.p.locator('#work-'+k);self.reach(q);old=q.input_value();assert '현재 안내 표시는 7일' in old;new=old.replace('현재 안내 표시는 7일','현재 안내 표시는 30일');self.fill(q,new);edited[k]=new
  self.state();self.log('minimal edit scope from UI',{'editedFields':['understanding','next'],'before':{k:v['value'] for k,v in fields.items()},'after':edited,'preservedFields':['scope','checks'],'notPolicyChange':True});newFields=self.readFields('manual edit complete');assert {k:v['value'] for k,v in newFields.items()}==edited
  self.reach(self.p.locator('#work-understanding'));self.screenshot('03-minimal-direct-edit')
  f2,u2,H2,clip=self.exportFile('H2-final-only-display-edited');p=self.state();ta=next(t for t in p['tasks'] if t['id']==self.Atask);assert p['currentTaskId']==self.Atask and ta['manual']==edited and H2['work']==edited;assert ta['handoffs'][:2]==[self.H0,self.H1];assert next(t for t in p['tasks'] if t['id']==self.report['id'])==self.report
  for key in ['bases','sources']:assert p[key]==self.base[key]
  for key in ['areas','brief','relations','containment','layout']:assert p['space'][key]==self.base['space'][key]
  assert '현재 안내 표시는 30일' in H2['work']['understanding'] and '현재 안내 표시는 30일' in H2['work']['next'];assert H2['work']['scope']==OLD['scope'] and H2['work']['checks']==OLD['checks'];self.log('post-manual reference exclusion observed, not a requirement to retain valid reference',{'currentReferenceTextRetained':CORRECTION in clip,'referenceHeader':clip[clip.find('## 영역 현재 설명'):clip.find('## 이어가는 목적')],'meaning':'manual edit may invalidate the old reference; required display30/actual-policy7 live in explicit manual fields'});assert H2['anchor']['areaId']==self.ids['보관 안내'] and H2['anchor']['understanding']==2
  self.map();final=self.state();assert final['currentTaskId']==self.Atask;assert next(t for t in final['tasks'] if t['id']==self.Atask)['manual']==edited;(R/f'{w}-final-project.json').write_text(json.dumps(final,ensure_ascii=False,indent=2));self.log('final map after exact file copy',{'snapshot':self.snap(),'task':self.Atask,'H2':H2['returnId'],'manual':edited})
  self.rows.append({'viewport':[w,h],'complete':True,'Aarea':self.ids['보관 안내'],'Barea':self.ids['자료 찾기'],'Atask':self.Atask,'reportTask':self.report['id'],'H0':self.H0['returnId'],'H1':self.H1['returnId'],'H2':H2['returnId'],'beforeCorrectionLabels':beforeLabels,'afterCorrectionBeforeEditLabels':afterLabels,'manualBefore':OLD,'manualAfter':edited,'historicalH0ManualUnchanged':True,'historicalH1ManualUnchanged':True,'reportAndBasesAndBUnchanged':True,'currentDescriptionNotInlineInEditor':True,'workToDescriptionAndBackTrips':1,'nestedMapToHistoricalTaskReaderAndBackTrips':1,'memoryRequirement':'표시30은 영역/reader에서 읽고 직접편집 네입력 화면으로 기억해 옮겼다. 범위/확인의 실제동작7·배포금지는 해당 입력에서 다시 읽어 보존했다.','previewValidationNotAllVisuallyRead':True,'finalTarget':'same original A request; no new task or retry during observed phase','descriptionReferenceAfterManualEditIncluded':CORRECTION in clip,'descriptionReferenceExclusionIsNotAutomaticPolicyChange':True})
u=None;code=1
try:
 u=Observation()
 for w,h in [(1280,720),(1440,900)]:
  try:u.run25(w,h)
  except Exception:
   raw=traceback.format_exc();u.failures.append({'viewport':[w,h],'traceback':raw});print(raw,file=sys.stderr);u.screenshot('first-failure');u.log('failure AX',u.p.locator('body').aria_snapshot());break
finally:
 if u:
  cleanup=u.close();code=int(bool(u.failures or u.errors or cleanup or len(u.rows)!=2));(R/'result.json').write_text(json.dumps({'sourceCommit':'689c47888fb7ab5040d184c2d36f2adff8f2a575','expectedPC':2,'completedPC':len(u.rows),'failures':u.failures,'rows':u.rows,'pageerrors':u.errors,'cleanupErrors':cleanup,'plannedExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
