from pathlib import Path
import json,sys,traceback,hashlib
from support import UI,GEO,R,A,UTC
from playwright.sync_api import expect
PURPOSE='[합성24] 도서 예약과 안내를 정리한다. 중복 예약을 막고 결과를 알린다.'
REQUEST='[합성24] 예약 가능 여부의 현재 조건을 설명하고 중복 접수를 확인할 작은 작업문을 정리해 주세요.'
NOTES={'예약':'도서 예약을 받고 중복 예약을 막는다.','알림':'예약 결과를 이용자에게 알린다.','기록':'예약 요청과 결과를 나중에 확인한다.','예약 가능 여부':'같은 도서에 이미 예약이 있는지 확인한다.'}
class Observation(UI):
 def measure(self,label):
  p=self.p
  def one(sel):
   q=p.locator(sel)
   return q.evaluate(GEO) if q.count() else None
  cards=[]
  for q in p.locator('.area-node').all():
   aid=q.get_attribute('data-area-id');labels={}
   for cls in ['.area-card-name','.area-card-note','.area-card-path']:
    node=q.locator(cls)
    if node.count():
     g=node.evaluate(GEO);g['font']=node.evaluate('e=>({fontSize:getComputedStyle(e).fontSize,lineHeight:getComputedStyle(e).lineHeight,whiteSpace:getComputedStyle(e).whiteSpace,textOverflow:getComputedStyle(e).textOverflow})');g['rangeInsideOwnAndAncestorClip']=all(r['left']>=g['textClip']['left']-.5 and r['right']<=g['textClip']['right']+.5 and r['top']>=g['textClip']['top']-.5 and r['bottom']<=g['textClip']['bottom']+.5 for r in g['rangeRects']);labels[cls]=g
   cards.append({'areaId':aid,'card':q.evaluate(GEO),'labels':labels,'info':one('#node-info-'+aid)})
  raw={'snapshot':self.snap(),'map':one('#space-map'),'controls':one('.map-controls'),'zoomIn':one('#map-zoom-in'),'fit':one('#map-fit'),'offscreen':one('#map-offscreen'),'panel':one('#area-panel'),'panelTitle':one('#area-panel-title'),'panelBody':p.locator('#area-panel-body').evaluate('e=>({id:e.dataset.areaId,rect:e.getBoundingClientRect().toJSON(),scroll:e.scrollTop,extent:e.scrollHeight-e.clientHeight,open:[...e.querySelectorAll("details[open][id]")].map(x=>x.id),text:e.textContent})') if p.locator('#area-panel-body').count() else None,'cards':cards,'branches':p.locator('.branch-toggle').evaluate_all('es=>es.map(e=>({id:e.id,expanded:e.getAttribute("aria-expanded"),rect:e.getBoundingClientRect().toJSON()}))'),'paths':p.locator('#space-map svg path,#space-map svg line').evaluate_all('es=>es.map(e=>({tag:e.tagName,class:e.getAttribute("class"),d:e.getAttribute("d"),x1:e.getAttribute("x1"),y1:e.getAttribute("y1"),x2:e.getAttribute("x2"),y2:e.getAttribute("y2"),rect:e.getBoundingClientRect().toJSON()}))')}
  self.log('MEASURE '+label,raw);return raw
 def can(self,q):
  if not q.count():return False
  g=q.evaluate(GEO);return g['visible'] and g['full'] and g['hit']
 def closePanel(self):
  q=self.p.locator('#area-panel-close')
  if self.can(q):self.click(q,'기존 패널 닫기')
 def chooseInfo(self,name,why):
  aid=self.ids[name];q=self.p.locator('#node-info-'+aid);attempt={'target':name,'reason':why,'initial':q.evaluate(GEO) if q.count() else None,'recoveryActions':[]}
  if not self.can(q):
   chip=self.p.locator('#map-offscreen')
   if self.can(chip):self.click(chip,'화면 밖 표시의 모두 보기');attempt['recoveryActions'].append('visible offscreen 모두 보기')
   else:self.closePanel();self.button('전체 맞춤');attempt['recoveryActions'].append('visible close then explicit 전체 맞춤')
  if self.can(q):self.click(q,name+' 정보');attempt['route']='visible card info'
  else:
   self.detail('area-list');self.click(self.p.locator('#list-info-'+aid),name+' 기존 영역 목록 정보');attempt['recoveryActions'].append('native reach existing plain area list');attempt['route']='visible list info'
  self.log('visible path decision',attempt)
 def readTaskRound(self,label):
  q=self.p.get_by_role('button',name=REQUEST+' ↘',exact=True);self.reach(q);before=self.measure(label+' task departure after native reach');self.click(q,'선택 부분의 정확 작업 읽기');read=self.p.locator('#space-view').inner_text();self.log('actual task read',{'text':read,'AX':self.p.locator('#space-view').aria_snapshot()});assert REQUEST in read
  back=self.p.locator('#task-return-origin');assert back.count();self.click(back,'명시 출발 지도 보기로');after=self.measure(label+' immediate task return, no repair');self.comparisons.append(self.compare(label+' task return',before,after));return after
 def compare(self,label,b,a):
  def plane(v):return v['snapshot']['plane']
  c={'label':label,'beforeRawLabel':'MEASURE '+label.replace(' task return',' task departure after native reach'),'before':b['snapshot'],'after':a['snapshot'],'transformSame':plane(b)==plane(a),'selectedSame':b['snapshot']['selected']==a['snapshot']['selected'],'branchesSame':[(x['id'],x['expanded']) for x in b['branches']]==[(x['id'],x['expanded']) for x in a['branches']],'panelBodyBefore':b['panelBody'],'panelBodyAfter':a['panelBody'],'windowYDelta':a['snapshot']['y']-b['snapshot']['y']}
  # Store exact raw values; equality is observation, not a new all-geometry usability gate.
  self.log('comparison '+label,c);return c
 def pan(self):
  point=self.p.locator('#space-map').evaluate('m=>{const r=m.getBoundingClientRect();for(let y=r.top+90;y<Math.min(r.bottom-20,innerHeight);y+=35)for(let x=r.right-25;x>r.left+30;x-=35){const h=document.elementFromPoint(x,y);if(h&&m.contains(h)&&!h.closest(".area-node,.map-controls,button,input,textarea,select,a"))return {x,y,map:r.toJSON(),hit:h.outerHTML.slice(0,220)}}return null}');assert point,'no visible empty map background for native pan'
  dx=-min(440,(point['map']['width']-40)*.6);self.p.mouse.move(point['x'],point['y']);self.p.mouse.down();self.p.mouse.move(point['x']+dx,point['y'],steps=12);self.p.mouse.up();self.log('native pointer pan once',{'start':point,'delta':[dx,0],'after':self.snap()})
 def locateRound(self,label,readTask=False):
  if not self.p.locator('#area-panel[data-panel-mode="relations"]').count():self.click(self.p.locator('#map-relations-open'),'연결 실제 끝점 목록 열기')
  endpoint=self.p.locator('#relation-from-'+self.rel);self.reach(endpoint);before=self.measure(label+' explicit locate departure');self.click(endpoint,'관계 실제 출발 예약 가능 여부 명시 위치 찾기');located=self.measure(label+' located target');q=self.p.locator('#node-info-'+self.ids['예약 가능 여부']);self.log('located target access result',{'label':label,'control':q.evaluate(GEO),'targetName':'예약 가능 여부'})
  if readTask:self.readTaskRound(label+' nested')
  back=self.p.locator('#locate-return');assert back.count();self.click(back,'위치 찾기 전 보기로');after=self.measure(label+' immediate locate return, no repair');self.comparisons.append(self.compare(label+' locate return',before,after));return located,after
 def prepare(self,w,h):
  self.new(w,h);self.click(self.p.locator('#nav-projects'),'내 프로젝트');self.button('＋ 새 프로젝트');self.fill(self.p.get_by_role('textbox',name='무엇을 만드나요? 프로젝트 목적 · 작업 요청과 따로 보관해요',exact=True),PURPOSE);self.button('영역 나누러 가기')
  for n in ['예약','알림','기록']:
   self.fill(self.p.get_by_role('textbox',name='영역 이름',exact=True),n);self.fill(self.p.get_by_role('textbox',name='영역 설명',exact=True),NOTES[n]);self.button('＋ 영역 추가');self.state()
  self.ids={a['name']:a['id'] for a in self.state()['space']['areas']};self.chooseInfo('예약','정상 UI로 실제 자식 만들기');self.text('더보기 · 하위 부분과 소속');self.fill(self.p.get_by_role('textbox',name='새 하위 부분 이름',exact=True),'예약 가능 여부');self.fill(self.p.get_by_role('textbox',name='하위 부분의 구상',exact=True),NOTES['예약 가능 여부']);self.button('하위 부분 추가');s=self.state();self.ids={a['name']:a['id'] for a in s['space']['areas']};self.closePanel();self.text('관계 적기')
  for name,value in [('어느 영역에서','예약 가능 여부'),('어느 영역으로','알림'),('관계 유형','이어서 사용')]:q=self.p.get_by_role('combobox',name=name,exact=True);self.reach(q);q.select_option(label=value)
  self.fill(self.p.get_by_role('textbox',name='관계 설명',exact=True),'예약 가능 여부 확인 결과를 예약 결과 알림에서 사용한다.');self.button('관계 추가');self.rel=self.state()['space']['relations'][0]['id'];self.chooseInfo('예약 가능 여부','작업 읽기 표본을 정상 UI로 준비');self.button('이 영역에 새 요청');self.task,self.initialPost=self.send(REQUEST);self.map();self.closePanel();self.button('전체 맞춤');self.baseline=self.state();(R/f'{w}-baseline-project.json').write_text(json.dumps(self.baseline,ensure_ascii=False,indent=2));self.comparisons=[]
 def run24(self,w,h):
  self.prepare(w,h);self.log('normal UI fixture completed',{'areas':self.ids,'task':self.task,'relation':self.rel,'method':'new project UI only; one explicit MOCK request; no storage/project JSON injection'});initial=self.measure('initial whole overview');self.screenshot('01-whole')
  # Rightmost actually reachable card is chosen from visible DOM geometry, not a hidden button.
  choices=[]
  for n,aid in self.ids.items():
   q=self.p.locator('#node-info-'+aid)
   if self.can(q):choices.append((q.bounding_box()['x'],n))
  assert choices;right=max(choices)[1];before=self.measure('before right part select');self.chooseInfo(right,'초기 화면에서 실제 접근되는 가장 오른쪽 부분 읽기');selected=self.measure('right selected sibling panel, no fit');self.log('selection camera observation',{'name':right,'before':before['snapshot']['plane'],'after':selected['snapshot']['plane'],'automaticCameraTransformChanged':before['snapshot']['plane']!=selected['snapshot']['plane']});self.screenshot('02-right-panel')
  self.chooseInfo('예약 가능 여부','다른 부분의 작업 읽기로 진행');self.readTaskRound('first navigation')
  panBefore=self.measure('before one pan and native zoom');self.pan();self.click(self.p.locator('#map-zoom-in'),'기존 + 한 번');panned=self.measure('one pan plus one native zoom');self.screenshot('03-panned')
  chip=self.p.locator('#map-offscreen');self.log('offscreen recovery visible control',chip.evaluate(GEO) if chip.count() else None)
  if self.can(chip):self.click(chip,'화면 밖 영역 표시 · 모두 보기')
  else:self.button('전체 맞춤')
  fitted=self.measure('explicit fit recovery, not original-view restore');self.screenshot('04-fitted')
  located,returned=self.locateRound('expanded relation endpoint')
  # Fold with visible controls, then use the same actual endpoint and read/return flow.
  toggle=self.p.locator('#branch-toggle-'+self.ids['예약'])
  if not self.can(toggle):self.closePanel();self.button('전체 맞춤')
  self.click(toggle,'예약 부모의 하위 접기');folded=self.measure('parent folded');assert toggle.get_attribute('aria-expanded')=='false';self.click(self.p.locator('#map-relations-open'),'접힌 관계의 실제 끝점 보기');self.screenshot('05-folded-relations');located2,returned2=self.locateRound('folded relation endpoint',True)
  assert self.p.locator('#branch-toggle-'+self.ids['예약']).get_attribute('aria-expanded')=='false'
  if not self.can(toggle):self.closePanel();self.button('전체 맞춤')
  self.click(toggle,'예약 부모의 하위 다시 펼치기');final=self.measure('final expanded map');after=self.state();(R/f'{w}-final-project.json').write_text(json.dumps(after,ensure_ascii=False,indent=2));base={k:v for k,v in self.baseline.items() if k!='notice'};end={k:v for k,v in after.items() if k!='notice'};assert base==end,'unexpected stored project mutation during read-only navigation';self.rows.append({'viewport':[w,h],'complete':True,'rightInitiallyChosen':right,'projectUnchangedExceptNotice':True,'oneNativePanAndZoom':True,'comparisons':self.comparisons,'initial':initial,'selected':selected,'panned':panned,'fitted':fitted,'expandedLocate':located,'foldedLocate':located2,'final':final})
u=None;code=1
try:
 u=Observation()
 for w,h in [(1280,720),(1440,900)]:
  try:u.run24(w,h)
  except Exception:
   trace=traceback.format_exc();u.failures.append({'viewport':[w,h],'traceback':trace});print(trace,file=sys.stderr);u.screenshot('first-failure');u.log('failure AX',u.p.locator('body').aria_snapshot());break
finally:
 if u:
  cleanup=u.close();code=int(bool(u.failures or u.errors or cleanup or len(u.rows)!=2));(R/'result.json').write_text(json.dumps({'sourceCommit':'689c47888fb7ab5040d184c2d36f2adff8f2a575','expectedViewports':2,'completedViewports':len(u.rows),'failures':u.failures,'rows':u.rows,'pageerrors':u.errors,'cleanupErrors':cleanup,'plannedExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
