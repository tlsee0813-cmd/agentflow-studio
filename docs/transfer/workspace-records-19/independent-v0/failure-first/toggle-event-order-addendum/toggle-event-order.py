from pathlib import Path
import os,sys,json,ast,traceback,time
R=Path(__file__).parent;A=R.parent.parent/'cycle19-final-candidate/app';O=R/'toggle-event-order';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
j=ast.parse((R/'w19-failure-diagnostic.py').read_text());JS=next(ast.literal_eval(n.value) for n in j.body if isinstance(n,ast.Assign) and any(isinstance(z,ast.Name) and z.id=='JS' for z in n.targets))
class H(base.Browser):
 def runTest(self):pass
x=H();runs=[];x.setUpClass()
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept());run={'viewport':[w,h],'events':[],'clicks':[]};runs.append(run)
  try:
   p.locator('#import-file').set_input_files(str(R.parent/'fixtures/long.json'));expect(p.locator('#space-map')).to_be_visible();base.saved(p);p.locator('#check-summary').click()
   p.expose_binding('recordObservedToggle',lambda source,value:run['events'].append(value))
   p.evaluate('''()=>{const measure='''+JS+''';const target=document.getElementById('brief-edit');const record=(phase,event)=>window.recordObservedToggle({phase,eventTimeStamp:event.timeStamp,performanceNow:performance.now(),isTrusted:event.isTrusted,open:target.open,raw:measure()});document.addEventListener('toggle',e=>{if(e.target===target)record('document-capture-after-app-capture-registration',e);},true);target.addEventListener('toggle',e=>record('on-target-toggle-after-document-capture',e));}''')
   summary=p.locator('#brief-edit > summary')
   for action in ['open','close']:
    before=p.evaluate('()=>({performanceNow:performance.now(),open:document.getElementById("brief-edit").open})');rawBefore=p.evaluate(JS);count=len(run['events']);summary.click();after=p.evaluate('()=>({performanceNow:performance.now(),open:document.getElementById("brief-edit").open})');rawAfter=p.evaluate(JS)
    # Await the observed native event; no fixed height/CSS oracle and no delay used to turn a failed expectation into success.
    deadline=time.monotonic()+4
    while len(run['events'])<count+2:
     if time.monotonic()>deadline:raise AssertionError('native capture/target toggle events not observed')
     p.wait_for_timeout(10)
    run['clicks'].append({'action':action,'beforeClick':before,'rawBefore':rawBefore,'afterNormalClickReturn':after,'rawAfterClickReturn':rawAfter,'targetEvents':run['events'][count:],'afterObservedTargetEvent':p.evaluate(JS)})
   run['finalOpen']=p.locator('#brief-edit').evaluate('e=>e.open');assert run['finalOpen'] is False
  except Exception:run['fatal']=traceback.format_exc()
  finally:
   run['pageerrors']=list(x.errors)
   try:x.tearDown()
   except Exception:run['cleanupError']=traceback.format_exc()
finally:x.tearDownClass()
code=int(len(runs)!=2 or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] for r in runs));(O/'result.json').write_text(json.dumps({'source':'9fb83ef50252d56c6411c81a0dca56d99becd651','method':'normal summary click; passive DOM geometry listeners only; app handlers/state/style untouched; document observer registered after app capture listener and target observer runs after capture phase','runs':runs,'exit':code},ensure_ascii=False,indent=2));sys.exit(code)
