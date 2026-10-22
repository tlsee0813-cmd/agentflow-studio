from pathlib import Path
import os,json,sys,traceback,hashlib
R0=Path(__file__).parent
os.environ.setdefault('EVIDENCE_DIR',str(R0));os.environ.setdefault('APP_DIR','/workspace/browser-env/cycle27-fix1-candidate/app');os.environ.setdefault('VARIANT','baseline');os.environ.setdefault('CASE_COUNT','6')
# Reuse the frozen UI and preparation helpers, without executing the old A/B main.
exec(compile((R0/'check-expanded.py').read_text().split('u=None;fatal=None;cleanup=[];code=1')[0],str(R0/'check-expanded.py'),'exec'))
SNAP=r'''()=>{const val=k=>{const e=document.querySelector(k);if(!e)return null;const r=e.getBoundingClientRect(),s=getComputedStyle(e);return {id:e.id,rect:r.toJSON(),pageTop:r.top+scrollY,inlineHeight:e.style.height,cssHeight:s.height,minHeight:s.minHeight,overflow:[s.overflowX,s.overflowY],display:s.display,hidden:e.hidden,open:e.open,scroll:[e.scrollLeft,e.scrollTop],client:[e.clientWidth,e.clientHeight],size:[e.scrollWidth,e.scrollHeight],transform:s.transform}};let ws=null,memo=null;try{ws=JSON.parse(localStorage.getItem('agentflow.idea015.workspace'));memo=JSON.parse(sessionStorage.getItem('agentflow.workspace.map'))}catch{}const entry=ws?.entries.find(e=>e.entryId===document.documentElement.dataset.entryId),p=entry?.project;return {time:performance.now(),date:new Date().toISOString(),windowY:scrollY,viewport:{width:innerWidth,height:innerHeight,visual:{width:visualViewport.width,height:visualViewport.height,top:visualViewport.offsetTop}},document:{height:document.documentElement.scrollHeight,width:document.documentElement.scrollWidth,maxScroll:document.documentElement.scrollHeight-innerHeight},layer:document.body.dataset.layer,entryId:document.documentElement.dataset.entryId,projectId:p?.id,currentTask:p?.currentTaskId,projectMapMemo:memo,saving:document.documentElement.dataset.saving??null,notice:{...val('#notice'),text:document.querySelector('#notice')?.textContent},layout:val('.map-layout'),map:val('#space-map'),plane:val('#space-plane'),areaList:val('#area-list'),areaAdd:val('#area-add-panel'),management:val('#project-management'),work:val('#work-view'),navSpace:val('#nav-space'),selected:[...document.querySelectorAll('.node-info[aria-pressed=true]')].map(e=>e.id),focus:document.activeElement?.outerHTML.slice(0,250)}}'''
STATE=r'''()=>{const w=JSON.parse(localStorage.getItem('agentflow.idea015.workspace'));return w.entries.find(e=>e.entryId===document.documentElement.dataset.entryId).project}'''
# Instrumentation only in explicitly separate trace runs. No app function/state calls.
TRACE=r'''()=>{const rows=[];window.__phase30Trace=rows;const snap=()=>{const r=e=>{if(!e)return null;const b=e.getBoundingClientRect();return {id:e.id,rect:b.toJSON(),height:e.style.height,open:e.open,hidden:e.hidden}};return {time:performance.now(),y:scrollY,saving:document.documentElement.dataset.saving??null,layer:document.body.dataset.layer,layout:r(document.querySelector('.map-layout')),map:r(document.querySelector('#space-map')),areaList:r(document.querySelector('#area-list')),notice:r(document.querySelector('#notice'))}};const push=(kind,e,extra)=>rows.push({kind,target:e?.target?.id,trusted:e?.isTrusted,...snap(),...extra});for(const k of ['pointerdown','click','scrollend','toggle','resize'])document.addEventListener(k,e=>push('document-capture-'+k,e),true);window.addEventListener('resize',e=>push('window-resize',e));let lastLayout=null,lastHeight=null,lastSaving=document.documentElement.dataset.saving??null;new MutationObserver(ms=>{const el=document.querySelector('.map-layout'),height=el?.style.height??null,saving=document.documentElement.dataset.saving??null;if(el!==lastLayout||height!==lastHeight||saving!==lastSaving){push('DOM-mutation',null,{changes:ms.map(m=>({target:m.target.id??m.target.tagName,attribute:m.attributeName,oldValue:m.oldValue})).slice(0,20),priorSaving:lastSaving,priorHeight:lastHeight});lastLayout=el;lastHeight=height;lastSaving=saving}}).observe(document,{subtree:true,attributes:true,attributeOldValue:true,childList:true});rows.push({kind:'trace-installed',...snap()})}'''
class Phase(AB):
 def project(self):return self.p.evaluate(STATE) # read only, no saved() wait
 def snapshot(self,label):
  v=self.p.evaluate(SNAP);self.log(label,v);return v
 def briefState(self,p):return {'id':p['id'],'revision':p['revision'],'currentTaskId':p['currentTaskId'],'draft':p['draft'],'projectSHA256':sha(json.dumps(p,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()),'areas':[{k:a[k] for k in ['id','name','archived']} for a in p['space']['areas']],'layout':p['space']['layout'],'containment':p['space']['containment'],'taskIDs':[t['id'] for t in p['tasks']]}
 def restoreOnly(self,w,h,count):
  self.new(w,h);self.p.locator('#nav-projects').click()
  backup=ROOT/('normal-ui-6-card-backup.json' if count==6 else 'normal-ui-four-card-backup.json')
  with self.p.expect_file_chooser() as f:self.p.locator('#list-import').click()
  self.p.once('dialog',lambda d:d.accept());f.value.set_files(str(backup));expect(self.p.locator('#notice')).to_contain_text('사본으로 불러왔어요')
  imported=self.snapshot('import initial first camera (before work, no explicit fit)')
  self.state() # preparation ONLY; no waits after tested nav-space entry
  self.snapshot('import after saved preparation')
  self.p.locator('#nav-work').click();self.receive(ROOT/'actual-P-return2.json')
  self.state();self.p.wait_for_function('()=>!document.documentElement.dataset.saving')
  self.log('preparation completed (old restore map/close/fit omitted)',{'count':count,'backupSHA256':sha(backup.read_bytes()),'project':self.briefState(self.project()),'importCamera':imported['projectMapMemo']})
  return imported
 def workPosition(self,depth):
  # Work can be entered from an optional remembered-list setup; no extra space fit.
  if self.p.evaluate("document.body.dataset.layer")!='work':self.p.locator('#nav-work').click()
  self.state() # preparation complete before initial/deep comparison
  y=self.p.evaluate('scrollY')
  if y>0:self.wheel(-y)
  if depth=='deep':self.wheel(1200)
  v=self.snapshot('prepared work '+depth);assert v['saving'] is None
  assert v['windowY']>500 if depth=='deep' else v['windowY']==0
  return v
 def infoGeometry(self):
  out=[]
  for e in self.p.locator('.node-info').all():
   g=e.evaluate(GEO);out.append({'id':e.get_attribute('id'),'name':e.get_attribute('aria-label'),'rect':g['rect'],'clip':g['clip'],'full':g['full'],'hit':g['hit'],'visible':g['visible'],'hitNode':g['hitNode']})
  return out
 def trial(self,w,h,depth,count=6,branch='observe',trace=False,remember=None):
  name=f'{count}-{w}-{depth}-{branch}'+('-trace' if trace else '')+('-remember-'+str(remember) if remember is not None else '')
  self.label=name;self.log('TRIAL BEGIN',{'id':name});imported=self.restoreOnly(w,h,count)
  if remember is not None:
   # The area list is display:none on PC. Make its actual existing UI visible by a real narrow viewport during setup only.
   self.p.locator('#nav-space').click();self.snapshot('PC before explicit remembered-list preparation')
   self.p.set_viewport_size({'width':700,'height':h});q=self.p.locator('#area-list');self.reach(q.locator(':scope > summary'))
   if q.evaluate('e=>e.open'):q.locator(':scope > summary').click()
   q.locator(':scope > summary').click();self.p.wait_for_function('(want)=>document.querySelector("#area-list")?.open===want',arg=remember)
   self.snapshot('normal UI explicit remembered-list open at narrow viewport')
   self.p.set_viewport_size({'width':w,'height':h});self.p.wait_for_function('(width)=>innerWidth===width',arg=w)
   self.snapshot('restored PC width after list setup (no fit)');self.p.locator('#nav-work').click();self.state()
  pre=self.workPosition(depth);before=self.project();memoBefore=pre['projectMapMemo']
  if trace:self.p.evaluate(TRACE)
  # Critical entry: direct actual nav click, no UI.map(), saved(), reach, fit, close, or info recovery.
  self.p.locator('#nav-space').click()
  first=self.snapshot('FIRST direct nav-space completion '+name)
  observed={ 'id':name,'viewport':[w,h],'count':count,'depth':depth,'branch':branch,'traceInstrumentation':trace,'rememberListSetup':remember,'importInitial':imported,'preWork':pre,'firstEntry':first}
  if first['map'] is None:raise AssertionError('space map not rendered')
  firstBad=first['map']['rect']['bottom']>h+.5
  # Record delayed browser frames as observations, never as an entry success prerequisite.
  later=self.p.evaluate('''()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve({time:performance.now(),y:scrollY,layout:document.querySelector('.map-layout')?.style.height,mapRect:document.querySelector('#space-map')?.getBoundingClientRect().toJSON(),areaListOpen:document.querySelector('#area-list')?.open,saving:document.documentElement.dataset.saving??null}))))''')
  self.log('after first observation, two native frames (not repair)',later);observed['laterFrames']=later
  observed['infoButtonsOriginal']=self.infoGeometry();observed['originalMapBottomOutsideViewport']=firstBad;observed['mapMemoAfter']=self.p.evaluate(SNAP)['projectMapMemo'];observed['projectBefore']=self.briefState(before);observed['projectAfterEntry']=self.briefState(self.project());observed['projectDataUnchanged']=before==self.project();observed['cameraUnchangedOnEntry']=memoBefore==observed['mapMemoAfter']
  if firstBad or (w==1280 and count==4):self.p.screenshot(path=str(R/(name+'-original.png')))
  if branch=='fit-only':
   q=self.p.locator('#map-fit');g=q.evaluate(GEO);assert g['full'] and g['hit'];q.click();observed['afterFitOnly']=self.snapshot('after explicit fit only, no resize');observed['infoButtonsAfterFit']=self.infoGeometry();observed['projectAfterRecovery']=self.briefState(self.project())
  elif branch=='real-resize':
   # Separate fresh reproduction; no fit before the real viewport resize.
   self.p.set_viewport_size({'width':w-1,'height':h});self.p.wait_for_function('(width)=>innerWidth===width',arg=w-1);observed['afterResize']=self.snapshot('after real viewport width minus1 resize');self.p.screenshot(path=str(R/(name+'-after-resize.png')));observed['infoButtonsAfterResize']=self.infoGeometry();observed['projectAfterRecovery']=self.briefState(self.project())
  # Actual pointer on a currently genuinely visible representative info control only, after original observations.
  if branch!='observe' or not firstBad:
   available=[x for x in self.infoGeometry() if x['full'] and x['hit'] and x['visible']]
   if available:
    id=available[0]['id'];self.p.locator('#'+id).click();observed['actualInfoClick']={'id':id,'panelVisible':self.p.locator('#area-panel').is_visible(),'after':self.snapshot('post original/recovery actual info click'),'projectDataUnchanged':before==self.project()}
   else:observed['actualInfoClick']={'executed':False,'reason':'no full clip+hit info button; no forced action or visibleInfo fit rescue'}
  if trace:observed['trace']=self.p.evaluate('()=>window.__phase30Trace??[]');self.log('TRACE completed '+name,observed['trace'])
  observed['projectDataUnchangedAtEnd']=before==self.project();self.results.append(observed);self.log('TRIAL RESULT '+name,observed);return observed
u=None;fatal=None;cleanup=[];code=1
try:
 u=Phase();u.results=[]
 # Continuation only: original four main comparisons and fit-only branch remain frozen in the first execution.
 u.trial(1280,720,'deep',branch='real-resize')
 u.trial(1280,720,'deep',count=4)
 u.trial(1280,720,'deep',count=4,remember=True)
 u.trial(1280,720,'deep',remember=True)
 u.trial(1280,720,'deep',trace=True)
 u.trial(1280,720,'deep',branch='uninstrumented-recheck')
except Exception:fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 results=u.results if u else [];bad=[x['id'] for x in results if x['originalMapBottomOutsideViewport']];code=int(bool(fatal or not u or u.errors or cleanup or len(results)!=6 or bad or any(not x['projectDataUnchangedAtEnd'] for x in results)))
 (R/'result.json').write_text(json.dumps({'sourceCommit':'6b96543fdf980ff45f0e1b67f83e8a0a561a1542','scope':'PhaseA hypothesis observation only; no candidate or product changes','expectedTrials':6,'completedTrials':len(results),'originalGeometryFailures':bad,'fatal':fatal,'pageerrors':u.errors if u else [],'cleanup':cleanup,'plannedChildExit':code,'trials':[{'id':x['id'],'viewport':x['viewport'],'count':x['count'],'depth':x['depth'],'firstY':x['firstEntry']['windowY'],'firstMap':x['firstEntry']['map']['rect'],'firstInline':x['firstEntry']['layout']['inlineHeight'],'bad':x['originalMapBottomOutsideViewport'],'laterFrames':x['laterFrames'],'dataUnchanged':x['projectDataUnchangedAtEnd'],'cameraUnchangedOnEntry':x['cameraUnchangedOnEntry'],'rawReference':'ui.jsonl TRIAL RESULT '+x['id']} for x in results]},ensure_ascii=False,indent=2))
sys.exit(code)
