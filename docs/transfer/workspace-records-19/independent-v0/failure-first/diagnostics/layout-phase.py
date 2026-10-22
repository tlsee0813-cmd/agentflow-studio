from pathlib import Path
import os,sys,json,ast,traceback
R=Path(__file__).parent;A=R.parent.parent/'cycle19-final-candidate/app';O=R/'layout-phase';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
j=ast.parse((R/'w19-failure-diagnostic.py').read_text());JS=next(ast.literal_eval(n.value) for n in j.body if isinstance(n,ast.Assign) and any(isinstance(z,ast.Name) and z.id=='JS' for z in n.targets))
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();runs=[]
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept());run={'viewport':[w,h],'observations':[]};runs.append(run)
  def measure(label):run['observations'].append({'label':label,'raw':p.evaluate(JS)})
  try:
   p.locator('#import-file').set_input_files(str(R.parent/'fixtures/powertoys-many.json'));expect(p.locator('#space-map')).to_be_visible();base.saved(p);measure('import-notice-visible-before-name-input')
   p.locator('#project-name').fill(x.state()['name']+' · 레이아웃 관측');base.saved(p);expect(p.locator('#notice')).to_be_hidden();measure('notice-cleared-by-normal-name-input')
   for delay in [100,400,1000]:p.wait_for_timeout(delay);measure('no-user-next-action-after-name-input-'+str(delay))
   p.screenshot(path=str(O/(str(w)+'-notice-cleared-stale-height.png')))
   p.locator('#check-summary').click();measure('normal-records-open-after-stale-height')
   # Toggle sampling is a timing diagnosis only. It does not make any assertion pass or change an app control/state.
   brief=p.locator('#brief-edit');brief.locator('> summary').click();measure('normal-purpose-edit-open-return-from-click')
   for delay in [0,100,400]:p.wait_for_timeout(delay);measure('purpose-edit-open-event-sampling-'+str(delay))
   brief.locator('> summary').click();measure('normal-purpose-edit-close-return-from-click')
   for delay in [0,100,400]:p.wait_for_timeout(delay);measure('purpose-edit-close-event-sampling-'+str(delay))
  except Exception:run['fatal']=traceback.format_exc()
  finally:
   run['pageerrors']=list(x.errors)
   try:x.tearDown()
   except Exception:run['cleanupError']=traceback.format_exc()
finally:x.tearDownClass()
code=int(len(runs)!=2 or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] for r in runs));(O/'result.json').write_text(json.dumps({'source':'9fb83ef50252d56c6411c81a0dca56d99becd651','diagnosticOnly':True,'timeSamplesAreNotPassCriteria':True,'runs':runs,'exit':code},ensure_ascii=False,indent=2));sys.exit(code)
