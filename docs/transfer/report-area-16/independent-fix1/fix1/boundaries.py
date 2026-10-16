from pathlib import Path
import os,sys,json,traceback,datetime,hashlib,copy
R=Path(__file__).parent;A=Path(os.environ.get('CANDIDATE_APP',str(R.parent/'cycle16-fix1/app')));O=Path(os.environ.get('BOUNDARY_OUTPUT',str(R/'boundaries')));O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
rows=[];fatal=None
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass()
try:
 for width,height in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':width,'height':height});state=json.loads((R/'independent'/f'fixture-{width}.json').read_text());area,other,Aid,R1,R2,B,RB=json.loads((R/'independent'/f'ids-{width}.json').read_text());env={'version':'agentflow.workspace.1','migratedFromLegacy':True,'entries':[{'entryId':'E_cycle16-independent','state':'active','lifecycle':1,'seq':1,'createdAt':'2026-10-16T00:00:00Z','trashedAt':None,'origin':'import','project':state}]}
  def rec(id,passed,raw):rows.append({'id':f'{width}-{id}','pass':bool(passed),'raw':raw})
  def saved():base.saved(p);return p.evaluate('localStorage.getItem("agentflow.idea015.workspace")')
  def install():p.evaluate('(s)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",s)}',json.dumps(env,ensure_ascii=False));p.reload();p.locator('.project-open').click()
  def read(t=Aid,a=area):p.locator('#nav-space').click();p.locator(f'#node-enter-{a}').click();p.locator(f'#task-open-{t}').click()
  def snap():return p.evaluate('''()=>{const rect=e=>e&&e.getBoundingClientRect().toJSON();return {y:scrollY,focus:document.activeElement.id,matrix:document.querySelector('#space-plane')&&getComputedStyle(document.querySelector('#space-plane')).transform,cards:[...document.querySelectorAll('.area-node')].map(e=>({area:e.dataset.areaId,rect:rect(e),selected:e.classList.contains('selected')})),open:[...document.querySelectorAll('#space-view details[open]')].map(e=>e.id),title:document.querySelector('#space-title').textContent,focusRect:rect(document.activeElement)}}''')
  def map_read():
   p.locator('#nav-space').click();p.locator(f'#node-info-{area}').click();p.locator('#map-zoom-in').click();box=p.locator('#space-map').bounding_box();px=box['x']+box['width']/2;py=min(height-50,box['y']+box['height']-25);p.mouse.move(px,py);p.mouse.down();p.mouse.move(px-45,py-20,steps=5);p.mouse.up();button=p.locator(f'#panel-task-{Aid}');button.click(trial=True);before=snap();p.locator(f'#panel-task-{Aid}').click();return before
  def back(before,label):
   p.locator('#work-return-origin').click();after=snap();rec(label,after['matrix']==before['matrix'] and after['cards']==before['cards'] and abs(after['y']-before['y'])<=2 and after['focus']==f'panel-task-{Aid}',{'before':before,'after':after})
  try:
   install();initial=x.state();before=map_read();p.locator(f'#task-report-pick-{R1}').click();p.locator('#task-next-action').click();n=x.state();rec('empty-new-request-target-only',n['currentTaskId']==initial['currentTaskId'] and len(n['tasks'])==len(initial['tasks']) and n['draft']=='' and n['draftKind']=='request' and n['space']['draftTarget']=={'area':area},{'before':initial,'after':n});p.locator('#draft').fill(f'[독립 합성 {width}] 현재 구상을 유지하고 Enter 처리만 제안해 주세요.');base.saved(p);edited=x.state();back(before,'map-return-new-draft');rec('new-draft-saved-not-rolled-back',x.state()==edited,{'saved':edited,'returned':x.state()})
   # UI sets each supported target, then read opens it without retargeting.
   for val,dt,label in [(other,{'area':other},'other'),('@none',{'area':None},'none'),('@follow',None,'follow')]:
    p.locator('#nav-work').click()
    if not p.locator('#compose-panel').evaluate('(e)=>e.open'):p.locator('#compose-summary').click()
    p.locator('#compose-area').select_option(val);p.locator('#draft').fill(f'[독립 {width} {label}] 보내지 않은 요청');base.saved(p);savedState=x.state();read();beforeLabel=p.locator('#task-next-target').inner_text();p.locator(f'#task-report-pick-{R2}').click();p.locator('#task-next-action').click();after=x.state();rec('draft-request-'+label,after==savedState and after['space']['draftTarget']==dt,{'labelBeforeClick':beforeLabel,'before':savedState,'after':after})
   # report/evidence selected return target is UI choice, never read from hidden state.
   for kind,text in [('report',f'[독립 {width}] 미전송 보고 E'),('evidence',f'[독립 {width}] 미전송 관찰 V')]:
    p.locator('#draft').fill('');p.locator('#home-paste-result').click();options=p.locator('#source-kind').locator('xpath=ancestor::details[1]');
    if options.count() and not options.evaluate('(e)=>e.open'):options.locator('summary').click()
    p.locator('#source-kind').select_option(kind);p.locator('#draft').fill(text);p.locator('#return-task').select_option(Aid);base.saved(p);ss=x.state();read();p.locator(f'#task-report-pick-{R2}').click();label=p.locator('#task-next-target').inner_text();p.locator('#task-next-action').click();rec('unsent-'+kind+'-return-choice',x.state()==ss and p.locator('#return-task').input_value()==Aid,{'before':ss,'after':x.state(),'label':label,'returnSelect':p.locator('#return-task').input_value()})
   # Explicit continue follows RB→A, never selected R2. Four distinct manuals saved through real editor.
   install();read();p.locator(f'#task-report-pick-{R2}').click();p.locator('#task-view-continue').click();rec('RB-to-A-not-picked-R2',x.state()['currentTaskId']==Aid,{'current':x.state()['currentTaskId'],'A':Aid,'pickedR2':R2});edit=p.locator('#edit-work');
   if not edit.evaluate('(e)=>e.open'):p.locator('#edit-work > summary').click()
   for key in ['understanding','scope','next','checks']:p.locator('#work-'+key).fill(f'[독립 {width} {key}] 보존값')
   base.saved(p);manualSaved=x.state();p.locator('#work-return-origin').click();rec('manual4-after-area-return',x.state()==manualSaved,{'before':manualSaved,'after':x.state(),'view':snap()})
   # current direct report R1 from normal UI task selection; no hidden current injection.
   p.locator('#nav-work').click();p.locator('#home-paste-result').click();p.locator('#draft').fill(f'[합성 {width}] A의 직접 보고. 시험용 MOCK');p.locator('#return-task').select_option(Aid);p.locator('#send').click();expect(p.locator('#working')).to_have_text('');direct=x.state()['currentTaskId'];read();p.locator('#task-view-continue').click();rec('A-reading-direct-report-current-kept',x.state()['currentTaskId']==direct,{'expectedCurrent':direct,'actualCurrent':x.state()['currentTaskId']})
   # Other tab archive → stale save attempt. Preserve exact external envelope.
   install();read();tab=x.ctx.new_page();tab.goto(x.url);tab.locator('.project-open').click();tab.locator(f'#node-enter-{area}').click();tab.locator('#area-archive').click();base.saved(tab);tab.wait_for_timeout(250);external=saved();tab.close();p.locator('#task-next-action').click();p.locator('#draft').fill('[독립 stale] 외부 변경을 덮지 않아야 하는 입력');base.saved(p);p.wait_for_timeout(100);error=p.locator('#storage-error').inner_text();rec('external-archive-stale-draft-conflict',saved()==external and '덮어쓰지' in error,{'externalSHA':hashlib.sha256(external.encode()).hexdigest(),'afterSHA':hashlib.sha256(saved().encode()).hexdigest(),'error':error,'visibleInput':p.locator('#draft').input_value()})
   # New isolated context for manual conflict, stale input from prior test deliberately discarded only by reinstall fixture.
   p.on('dialog',lambda d:d.accept());install();read();tab=x.ctx.new_page();tab.goto(x.url);tab.locator('.project-open').click();tab.locator(f'#node-enter-{area}').click();tab.locator('#area-archive').click();base.saved(tab);tab.wait_for_timeout(250);external=saved();tab.close();p.locator('#task-view-continue').click();
   if not p.locator('#edit-work').evaluate('(e)=>e.open'):p.locator('#edit-work > summary').click()
   p.locator('#work-next').fill('[독립 stale] 수동 수정 메모리만 유지');base.saved(p);p.wait_for_timeout(100);error=p.locator('#storage-error').inner_text();rec('external-archive-stale-manual-conflict',saved()==external and '덮어쓰지' in error,{'externalSHA':hashlib.sha256(external.encode()).hexdigest(),'afterSHA':hashlib.sha256(saved().encode()).hexdigest(),'error':error,'visibleManual':p.locator('#work-next').input_value()})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(z.get('pass') is False for z in rows)));(O/'result.json').write_text(json.dumps({'rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failures':[z['id'] for z in rows if z.get('pass') is False],'fatal':fatal}));sys.exit(code)
