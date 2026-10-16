from pathlib import Path
import os,sys,json,traceback,hashlib
R=Path(__file__).parent;A=Path(os.environ.get('CANDIDATE_APP',str(R.parent/'cycle16-v0/app')));O=Path(os.environ.get('OUTPUT_DIR',str(R/'independent')));O.mkdir(exist_ok=True);os.environ['IDEA015_EVIDENCE_DIR']=str(O/'fixture');os.environ['BROWSER_EXECUTABLE']='/usr/bin/chromium';os.environ['BROWSER_TRANSPORT']='direct-http';sys.path.insert(0,str(A/'continuity/tests'))
import report16_browser as f
from playwright.sync_api import expect
rows=[];fatal=None
class Fixture(f.Report16):
 def runTest(self):pass
# Only author fixture construction is reused; no author assertions are independent results.
x=Fixture();x.setUpClass()
try:
 for width,height in [(1280,720),(1440,900)]:
  x.WIDTH=width;x.HEIGHT=height;x.setUp();p=x.page
  try:
   area,other,Aid,R1,R2,B,RB=x.build();state=x.state();(O/f'fixture-{width}.json').write_text(json.dumps(state,ensure_ascii=False));(O/f'ids-{width}.json').write_text(json.dumps([area,other,Aid,R1,R2,B,RB]));x.posts.clear()
   p.locator('#nav-space').click();p.locator(f'#node-enter-{area}').click();p.locator(f'#task-open-{Aid}').click();expect(p.locator('#task-view')).to_be_visible()
   def record(name,expected):
    raw=p.evaluate('''()=>({open:[...document.querySelectorAll('#task-view details[id]')].map(e=>({id:e.id,open:e.open})),selected:[...document.querySelectorAll('.report-pick[aria-pressed=true]')].map(e=>e.id),y:scrollY,focus:document.activeElement.id})''');actual=p.locator('#task-report-path').evaluate('(e)=>e.open');rows.append({'id':f'{width}-{name}','expected_path_open':expected,'actual_path_open':actual,'pass':actual==expected,'raw':raw})
   p.locator(f'#task-report-pick-{R1}').click();p.locator('#task-report-path > summary').click();record('R1-expanded',True)
   p.locator(f'#task-report-pick-{R1}').click();record('same-R1-preserves',True)
   p.locator('#task-view-request > summary').click();common=p.locator('#task-view-request').evaluate('(e)=>e.open')
   p.locator(f'#task-report-pick-{R2}').click();record('different-R2-resets',False);rows.append({'id':f'{width}-common-request-preserves','pass':p.locator('#task-view-request').evaluate('(e)=>e.open')==common})
   p.screenshot(path=str(O/f'{width}-different-report.png'))
   # The second-tab storage event uses an exact unchanged valid envelope; no hidden app-state modification.
   if not p.locator('#task-report-path').evaluate('(e)=>e.open'):p.locator('#task-report-path > summary').click()
   before=p.evaluate('localStorage.getItem("agentflow.idea015.workspace")');tab=x.ctx.new_page();tab.goto(x.url);tab.evaluate('(s)=>localStorage.setItem("agentflow.idea015.workspace",s+" ")',before);tab.close();p.wait_for_timeout(200);record('same-report-storage-refresh-preserves',True)
   after=x.state();rows.append({'id':f'{width}-read-project-unchanged','pass':after==state,'beforeSHA':hashlib.sha256(json.dumps(state,sort_keys=True).encode()).hexdigest(),'afterSHA':hashlib.sha256(json.dumps(after,sort_keys=True).encode()).hexdigest()})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
exitcode=int(bool(fatal or any(not z['pass'] for z in rows)));(O/'result.json').write_text(json.dumps({'rows':rows,'fatal':fatal,'exit':exitcode,'fixture_reuse':'author UI fixture builder only; independent expectations and actions above'},ensure_ascii=False,indent=2));print(json.dumps({'exit':exitcode,'failures':[z['id'] for z in rows if not z['pass']],'fatal':fatal}));sys.exit(exitcode)
