from pathlib import Path
import os,sys,json,traceback
R=Path(__file__).parent;A=R.parent/'cycle16-fix1/app';O=R/'late';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();rows=[];fatal=None
try:
 x.setUp();p=x.page;p.set_viewport_size({'width':1280,'height':720});state=json.loads((R/'independent/fixture-1280.json').read_text());area,other,Aid,R1,R2,B,RB=json.loads((R/'independent/ids-1280.json').read_text());env={'version':'agentflow.workspace.1','migratedFromLegacy':True,'entries':[{'entryId':'E_cycle16-late-mock','state':'active','lifecycle':1,'seq':1,'createdAt':'2026-10-16T00:00:00Z','trashedAt':None,'origin':'import','project':state}]};p.evaluate('(s)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",s)}',json.dumps(env));p.reload();p.locator('.project-open').click();park=[];p.route('**/api/continuity',lambda route:park.append((route,route.fetch())));p.locator(f'#node-enter-{other}').click();p.locator('#area-new-request').click();p.locator('#draft').fill('[독립 합성] 늦은 MOCK응답으로만 다시 그리기');p.locator('#send').click()
 for _ in range(30):
  if park:break
  p.wait_for_timeout(50)
 assert len(park)==1
 p.locator('#nav-space').click();p.locator(f'#node-enter-{area}').click();p.locator(f'#task-open-{Aid}').click();p.locator(f'#task-report-pick-{R2}').click();p.locator('#task-view-request > summary').click();p.locator('#task-report-path > summary').click();p.locator('#task-pointed details[id^="task-report-src-"] > summary').click()
 def snap():return p.evaluate('''()=>({details:[...document.querySelectorAll('#task-view details[id]')].map(e=>({id:e.id,open:e.open})),selected:[...document.querySelectorAll('.report-pick[aria-pressed=true]')].map(e=>e.id),focus:document.activeElement.id})''')
 before=snap();route,response=park.pop();route.fulfill(response=response)
 for _ in range(100):
  if x.state()['pending'] is None:break
  p.wait_for_timeout(50)
 after=snap();rows.append({'id':'delayed-real-local-MOCK-response-render','pass':before['details']==after['details'] and before['selected']==after['selected'] and x.state()['pending'] is None,'before':before,'after':after,'scope':'real localhost MOCK response fetched then deliberately held and released by test route; no external/paid AI; timing injection separated from ordinary UI'})
except Exception:fatal=traceback.format_exc()
finally:
 try:x.tearDown()
 finally:x.tearDownClass()
code=int(bool(fatal or any(not r['pass'] for r in rows)));(O/'result.json').write_text(json.dumps({'rows':rows,'fatal':fatal,'exit':code},indent=2));print(json.dumps({'exit':code,'fatal':fatal}));sys.exit(code)
