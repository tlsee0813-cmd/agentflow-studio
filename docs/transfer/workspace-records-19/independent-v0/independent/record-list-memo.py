from pathlib import Path
import os,sys,json,ast,traceback
R=Path(__file__).parent;A=R.parent/'cycle19-final-candidate/app';O=R/'record-list-memo';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
c=ast.parse((R/'core.py').read_text());SNAP=next(ast.literal_eval(n.value) for n in c.body if isinstance(n,ast.Assign) and any(isinstance(z,ast.Name) and z.id=='SNAP' for z in n.targets))
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();runs=[]
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept());run={'viewport':[w,h],'checks':[]};runs.append(run)
  def snap():return p.evaluate(SNAP)
  def ck(id,ok,raw):run['checks'].append({'id':id,'pass':bool(ok),'raw':raw})
  try:
   p.locator('#import-file').set_input_files(str(R/'fixtures/powertoys-many.json'));expect(p.locator('#space-map')).to_be_visible();base.saved(p);state=x.state();m=json.loads((R/'fixtures/powertoys-meta.json').read_text());p.locator('#node-info-'+m['target']).click();p.locator('#check-summary').click();body=p.locator('#area-panel-body');b=body.bounding_box();p.mouse.move(b['x']+20,b['y']+b['height']/2);p.mouse.wheel(0,440);p.wait_for_timeout(250);before=snap();entry=p.evaluate('document.documentElement.dataset.entryId');anchor=p.locator('#check-list').evaluate('e=>{const b=e.closest(".panel-body").getBoundingClientRect();return [...e.querySelectorAll("button")].filter(n=>{const r=n.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom}).map(n=>({id:n.id,rect:n.getBoundingClientRect().toJSON(),relativeY:n.getBoundingClientRect().y-b.y}))[0]}');ck('records-real-wheel-nonzero-before-project-list',before['bodyTop']>0 and bool(anchor),{'before':before,'anchor':anchor});p.locator('#nav-projects').click();button=p.locator('.project-card[data-entry-id="'+entry+'"] .project-open');focusInList=p.evaluate('document.activeElement.outerHTML');button.click();expect(body).to_have_attribute('data-area-id','@records');after=snap();raw=p.locator('#'+anchor['id']).evaluate('e=>{const r=e.getBoundingClientRect(),b=e.closest(".panel-body").getBoundingClientRect();return {rect:r.toJSON(),relativeY:r.y-b.y}}');ck('same-project-record-mode-selection-camera-reading-no-write',after['mode']=='records' and after['matrix']==before['matrix'] and [v['id'] for v in after['cards'] if v['selected']]==[v['id'] for v in before['cards'] if v['selected']] and abs(raw['relativeY']-anchor['relativeY'])<=2 and x.state()==state,{'before':before,'after':after,'anchorBefore':anchor,'anchorAfter':raw,'focusInList':focusInList})
   if w==1440:p.screenshot(path=str(O/'1440-records-after-project-list.png'))
  except Exception:run['fatal']=traceback.format_exc()
  finally:
   run['pageerrors']=list(x.errors)
   try:x.tearDown()
   except Exception:run['cleanupError']=traceback.format_exc()
finally:x.tearDownClass()
code=int(len(runs)!=2 or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'source':'9fb83ef50252d56c6411c81a0dca56d99becd651','expectedRuns':2,'executedRuns':len(runs),'runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failures':[(r['viewport'],c['id']) for r in runs for c in r['checks'] if not c['pass']],'fatals':[r.get('fatal') for r in runs if r.get('fatal')]}));sys.exit(code)
