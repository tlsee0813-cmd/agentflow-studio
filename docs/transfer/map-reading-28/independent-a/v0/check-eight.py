from fixture import *
from support import sha
import os
ROOT=Path(__file__).parent;VARIANT=os.environ['VARIANT'];COUNT=int(os.environ.get('CASE_COUNT','4'));BACKUP=Path(os.environ.get('BACKUP_PATH',str(ROOT/'normal-ui-four-card-backup.json')));PFILE=ROOT/'actual-P-return2.json'
PN='자료 보관 안내를 함께 준비하는 전체 운영 흐름'
QN='자료 보관 안내의 공통 절차에서 질문을 확인하는 부분'
SN='자료 보관 안내의 공통 절차에서 표시를 정리하는 부분'
HN='자료 보관 안내의 공통 절차에서 요청을 접수하는 부분'
NAMES=[PN,QN,SN,HN]
MEASURE=r'''e=>{const r=e.getBoundingClientRect();let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};const ancestors=[];for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),sx=a.offsetWidth?b.width/a.offsetWidth:1,sy=a.offsetHeight?b.height/a.offsetHeight:1,c={left:b.left+a.clientLeft*sx,top:b.top+a.clientTop*sy,right:b.left+(a.clientLeft+a.clientWidth)*sx,bottom:b.top+(a.clientTop+a.clientHeight)*sy};if(/auto|scroll|hidden|clip/.test(s.overflowX)){clip.left=Math.max(clip.left,c.left);clip.right=Math.min(clip.right,c.right)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){clip.top=Math.max(clip.top,c.top);clip.bottom=Math.min(clip.bottom,c.bottom)}ancestors.push({tag:a.tagName,id:a.id,class:a.className?.baseVal??a.className,rect:b.toJSON(),clientClip:c,overflow:[s.overflowX,s.overflowY],transform:s.transform,display:s.display,visibility:s.visibility,scroll:[a.scrollLeft,a.scrollTop],clipPath:s.clipPath})}const range=document.createRange();range.selectNodeContents(e);const rects=[...range.getClientRects()].map(b=>b.toJSON()),observed=[];for(const b of rects){const c={left:Math.max(b.left,clip.left),top:Math.max(b.top,clip.top),right:Math.min(b.right,clip.right),bottom:Math.min(b.bottom,clip.bottom)};const positive=c.right>c.left&&c.bottom>c.top;const x=(c.left+c.right)/2,y=(c.top+c.bottom)/2,h=positive?document.elementFromPoint(x,y):null;observed.push({rect:b,visibleClip:c,positive,full:positive&&b.left>=clip.left-.5&&b.top>=clip.top-.5&&b.right<=clip.right+.5&&b.bottom<=clip.bottom+.5,point:{x,y},hit:!!h&&(h===e||e.contains(h)),hitNode:h?.outerHTML.slice(0,220)})}const s=getComputedStyle(e),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);let characters=[];if(e.matches('.area-card-name,.area-card-path,.area-card-parent-name,.branch-signals,.area-update-label,.tag')){const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let t;while(t=walker.nextNode()){for(let i=0;i<t.length;i++){const rr=document.createRange();rr.setStart(t,i);rr.setEnd(t,i+1);const b=rr.getBoundingClientRect();characters.push({char:t.textContent[i],rect:b.toJSON(),insideClip:b.width>0&&b.height>0&&b.left>=clip.left-.5&&b.right<=clip.right+.5&&b.top>=clip.top-.5&&b.bottom<=clip.bottom+.5})}}}return{id:e.id,class:e.className,text:e.textContent,rect:r.toJSON(),clip,ancestors,rangeRects:observed,characters,checkVisibility:e.checkVisibility({visibilityProperty:true}),centerHit:!!h&&(h===e||e.contains(h)),centerHitNode:h?.outerHTML.slice(0,220),font:s.fontSize,lineHeight:s.lineHeight,display:s.display,lineClamp:s.webkitLineClamp,scrollY,active:document.activeElement.id}}'''
class AB(Observation):
 def openInfo(self,name):self.map();self.visibleInfo(name)
 def start(self,name,request):self.openInfo(name);self.button('이 영역에 새 요청');return self.send(request)[0]
 def exportActual(self,label):return self.exportFile(label)
 def receive(self,path):
  self.button('결과 JSON 가져오기')
  with self.p.expect_file_chooser() as c:self.button('결과 파일 선택')
  c.value.set_files(str(path));self.button('이 결과 가져오기');expect(self.p.locator('#received-result-open')).to_be_visible();self.state()
 def returnFile(self,f,u,name,label):
  raw={**f,'report':'[명시 합성28 보고] '+name+'의 준비 자료를 읽었다. 실제 실행이나 외부 AI 검증은 아니다.','evidence':None,'understanding':{**u,'summary':'[합성28 설명] '+name+'의 안내를 정리한다. 실제 보관 동작과 배포는 바꾸지 않는다.','changes':['안내를 읽는 범위를 정리했다.'],'proposal':None,'origin':'관측자가 실제 UI H/template에 작성한 명시 합성. 외부 AI/구현/검사 없음.'}};p=ROOT/(label+'-actual-template-return2.json');p.write_text(json.dumps(raw,ensure_ascii=False,indent=2));return p
 def changeNote(self,name):
  self.openInfo(name);self.detail('panel-edit');q=self.p.locator('#panel-note');old=q.input_value();self.fill(q,old+' [정상 UI 변경28] 표현 검토 범위만 덧붙인다.');self.click(self.p.locator('#panel-save'),'해당 자식 구상 정상 UI 변경');self.state()
 def prepare(self):
  self.new(1280,720);self.click(self.p.locator('#nav-projects'),'내 프로젝트');self.button('＋ 새 프로젝트');self.fill(self.p.get_by_role('textbox',name='무엇을 만드나요? 프로젝트 목적 · 작업 요청과 따로 보관해요',exact=True),'[합성28] 자료 보관 안내를 함께 정리한다. 실제 동작과 배포는 바꾸지 않는다.');self.button('영역 나누러 가기')
  self.fill(self.p.get_by_role('textbox',name='영역 이름',exact=True),PN);self.fill(self.p.get_by_role('textbox',name='영역 설명',exact=True),'안내를 준비하는 전체 흐름과 실제 소속을 읽는다.');self.button('＋ 영역 추가');self.ids={a['name']:a['id'] for a in self.state()['space']['areas']}
  for name in NAMES[1:]:
   self.visibleInfo(PN);self.detail('panel-more');self.fill(self.p.get_by_role('textbox',name='새 하위 부분 이름',exact=True),name);self.fill(self.p.get_by_role('textbox',name='하위 부분의 구상',exact=True),name+'의 안내만 정리한다.');self.click(self.p.locator('#child-add'),'실제 하위 부분 추가');self.state();self.ids={a['name']:a['id'] for a in self.state()['space']['areas']}
  self.tasks={};self.tasks['Q']=self.start(QN,'[합성28 Q] 안내 오류 원인은 아직 모르겠어요. 실제 원인을 정하지 말고 확인할 질문을 남겨 주세요.');self.log('Q actual unresolved recorded question',{'task':next(t for t in self.state()['tasks'] if t['id']==self.tasks['Q']),'project':self.state()})
  self.tasks['S']=self.start(SN,'[합성28 S] 안내 표시 문구만 정리해 주세요.');f,u,_,_=self.exportActual('S-real-H');self.receive(self.returnFile(f,u,SN,'S'));self.changeNote(SN)
  self.tasks['H']=self.start(HN,'[합성28 H] 요청 접수 안내만 정리해 주세요.');f,u,_,_=self.exportActual('H-real-H');hp=self.returnFile(f,u,HN,'H');self.changeNote(HN);self.click(self.p.locator('#nav-work'),'H 작업 입력으로 이동');self.receive(hp)
  self.tasks['P']=self.start(PN,'[합성28 P] 전체 안내를 정리하되 자식의 실제 역할을 구분해 주세요.');f,u,H,_=self.exportActual('P-real-H');raw=self.returnFile(f,u,PN,'P');PFILE.write_bytes(raw.read_bytes());self.PH=H
  self.detail('project-management')
  with self.p.expect_download() as d:self.click(self.p.locator('#backup'),'동일 입력용 기존 UI 백업 내보내기')
  d.value.save_as(str(BACKUP));self.log('actual UI backup exported',{'path':str(BACKUP),'sha256':sha(BACKUP.read_bytes()),'project':self.state()});(ROOT/'setup-ids.json').write_text(json.dumps({'ids':self.ids,'tasks':self.tasks,'P_H':H},ensure_ascii=False,indent=2))
 def restore(self,w,h):
  self.new(w,h);self.click(self.p.locator('#nav-projects'),'내 프로젝트')
  with self.p.expect_file_chooser() as f:self.click(self.p.locator('#list-import'),'기존 백업 파일 UI 복구')
  self.p.once('dialog',lambda d:(self.log('native backup confirmation',{'message':d.message}),d.accept()));f.value.set_files(str(BACKUP));expect(self.p.locator('#notice')).to_contain_text('사본으로 불러왔어요');expect(self.p.locator('#nav-space')).to_be_visible();self.state();self.ids={name:next(a['id'] for a in self.state()['space']['areas'] if a['name']==name) for name in NAMES}
  self.click(self.p.locator('#nav-work'),'복구 후 기존 P 현재 작업으로 이동');self.receive(PFILE);self.log('restored backup then identical P actual return',{'backupSHA256':sha(BACKUP.read_bytes()),'returnSHA256':sha(PFILE.read_bytes()),'state':self.state()});self.map()
  close=self.p.locator('#area-panel-close')
  if close.count() and close.is_visible():self.click(close,'비교 시작 패널 닫기')
  self.button('전체 맞춤')
 def measure(self,label,png=False):
  cards=[]
  for c in self.p.locator('.area-node').all():
   d={'id':c.get_attribute('data-area-id'),'card':c.evaluate(MEASURE),'items':[]}
   for e in c.locator('.area-card-name,.area-card-path,.area-card-parent,.area-card-parent-name,.area-card-go,.area-update-label,.tag,.branch-signals,.branch-toggle,.node-info,.node-enter').all():d['items'].append(e.evaluate(MEASURE))
   cards.append(d)
  v={'variant':VARIANT,'viewport':self.p.viewport_size,'label':label,'snapshot':self.snap(),'cards':cards,'controls':[x.evaluate(MEASURE) for x in self.p.locator('#map-zoom-in,#map-zoom-out,#map-fit').all()],'frames':[x.evaluate(MEASURE) for x in self.p.locator('.containment-frame,.containment-title').all()],'documentOverflow':self.p.evaluate('({horizontal:document.documentElement.scrollWidth-innerWidth,vertical:document.documentElement.scrollHeight-innerHeight})')};self.measures.append(v);self.log('MEASUREMENT '+label,v)
  if png:self.screenshot(label)
  return v
 def observe(self,w,h):
  self.restore(w,h);before=self.state();self.measure(f'{COUNT}-expanded-fit',True)
  # Real same parent toggles, no layout/zoom rescue.
  toggle=self.p.locator('#branch-toggle-'+self.ids[PN]);self.click(toggle,'부모 P 실제 접기');self.measure(f'{COUNT}-parent-folded');self.click(self.p.locator('#branch-toggle-'+self.ids[PN]),'부모 P 실제 펼치기');self.measure(f'{COUNT}-parent-reexpanded')
  # One representative normal read/return. Existing visible controls only.
  self.visibleInfo(PN);panelBefore=self.snap();self.log('P full membership panel',{'text':self.p.locator('#area-panel').inner_text(),'snapshot':panelBefore});taskText='[합성28 P] 전체 안내를 정리하되 자식의 실제 역할을 구분해 주세요. ↘';self.button(taskText);reader={'snapshot':self.snap(),'text':self.p.locator('#task-view-idea').inner_text(),'state':self.state()};self.click(self.p.locator('#task-return-origin'),'관련 작업 읽기 출발 지도로 복귀');after=self.state();self.log('representative info-task-map raw pair',{'pre':panelBefore,'reader':reader,'post':self.snap(),'projectBefore':before,'projectAfter':after});assert before==after,'read/return changed saved project'
  # Other branch has a distinct parent object with the same parent name.
  if COUNT==8:
   state=self.state();parents=state['space']['containment']['parents'];areas=state['space']['areas'];otherP=next(a for a in areas if a['name']==PN and a['id'] in parents);deep=next(a for a in areas if a['name']==QN and parents.get(a['id'])==otherP['id']);self.ids['same-parent-other-branch-child']=deep['id'];self.visibleInfo('same-parent-other-branch-child')
   path=self.p.locator('#panel-path');self.reach(path);self.log('same-name parent actual panel path',{'area':deep,'actualParent':otherP,'path':path.inner_text(),'geometry':path.evaluate(MEASURE),'snapshot':self.snap()});self.detail('panel-name-full-'+deep['id']);full=self.p.locator('#panel-name-full-'+deep['id']).get_by_text(QN,exact=True);self.reach(full);self.log('existing full name disclosure read',{'text':full.inner_text(),'geometry':full.evaluate(MEASURE),'snapshot':self.snap()})
   if VARIANT=='candidate' and w==1440:self.screenshot('8-same-parent-existing-full-name')
  self.completed.append({'variant':VARIANT,'viewport':[w,h],'complete':True,'stateUnchanged':True})
u=None;fatal=None;cleanup=[];code=1
try:
 u=AB();u.measures=[];u.completed=[]
 if VARIANT=='baseline' and not BACKUP.exists():u.prepare()
 for w,h in [(1280,720),(1440,900)]:
  try:u.observe(w,h)
  except Exception:
   raw=traceback.format_exc();u.failures.append({'viewport':[w,h],'traceback':raw});print(raw,file=sys.stderr);u.screenshot('first-error');u.log('failure AX',u.p.locator('body').aria_snapshot());break
except Exception:fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 code=int(bool(fatal or not u or u.failures or u.errors or cleanup or len(u.completed)!=2))
 (R/'result.json').write_text(json.dumps({'variant':VARIANT,'expectedPC':2,'completed':u.completed if u else [],'measurements':u.measures if u else [],'harnessFailures':u.failures if u else [],'fatal':fatal,'pageerrors':u.errors if u else [],'cleanup':cleanup,'plannedExit':code,'visualAcceptance':'separate offline raw/PNG comparison; runner completion is not candidate acceptance'},ensure_ascii=False,indent=2))
sys.exit(code)
