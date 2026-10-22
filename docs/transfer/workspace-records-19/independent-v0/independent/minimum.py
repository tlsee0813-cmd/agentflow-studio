from pathlib import Path
import os,sys,json,ast,traceback,hashlib
R=Path(__file__).parent;A=R.parent/'cycle19-final-candidate/app';O=R/'minimum';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
c=ast.parse((R/'core.py').read_text());SNAP=next(ast.literal_eval(n.value) for n in c.body if isinstance(n,ast.Assign) and any(isinstance(z,ast.Name) and z.id=='SNAP' for z in n.targets));t=ast.parse((R.parent/'cycle18-fix4-independent/ui.py').read_text());GEO=next(ast.literal_eval(n.body[0].value.args[0]) for n in ast.walk(t) if isinstance(n,ast.FunctionDef) and n.name=='geom')
class H(base.Browser):
 def runTest(self):pass
x=H();runs=[];x.setUpClass()
try:
 for cid in ['powertoys','product13']:
  x.setUp();p=x.page;p.set_viewport_size({'width':390,'height':844});p.on('dialog',lambda d:d.accept());run={'sample':cid,'viewport':[390,844],'checks':[]};runs.append(run)
  def snap():return p.evaluate(SNAP)
  def geom(sel):return p.locator(sel).evaluate(GEO)
  def ck(id,ok,raw):run['checks'].append({'id':id,'pass':bool(ok),'raw':raw})
  try:
   p.locator('#import-file').set_input_files(str(R/'fixtures'/f'{cid}-many.json'));expect(p.locator('#space-map')).to_be_visible();base.saved(p);state=x.state();s=snap();ck('mobile-import-access-and-no-horizontal-document-overflow',s['docWidth']<=390 and p.locator('#notice').is_visible(),{'snapshot':s,'importNotice':p.locator('#notice').inner_text()});p.locator('#check-summary').click();body=p.locator('#area-panel-body');body.focus();p.keyboard.press('End');p.wait_for_timeout(200);before=snap();ck('mobile-records-native-key-scroll',before['bodyTop']>0 and before['bodyMax']>0,before)
   for key in ['composing','consumed']:
    if key=='composing':body.dispatch_event('keydown',{'key':'Escape','isComposing':True,'bubbles':True,'cancelable':True})
    else:body.evaluate("e=>{e.addEventListener('keydown',x=>x.preventDefault(),{once:true});e.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}))}")
    ck('synthetic-'+key+'-Escape-retains-records',p.locator('#area-panel').get_attribute('data-panel-mode')=='records' and p.evaluate('document.activeElement.id')=='area-panel-body',snap())
   caller=p.locator('#check-list button[id^="check-open-"]').last
   for _ in range(30):
    q=caller.bounding_box();b=body.bounding_box()
    if q['y']>=b['y'] and q['y']+q['height']<=b['y']+b['height']:break
    p.mouse.move(b['x']+10,b['y']+b['height']/2);p.mouse.wheel(0,70 if q['y']>b['y'] else -70);p.wait_for_timeout(60)
   id=caller.get_attribute('id');g=geom('#'+id);ck('mobile-exact-report-call-visible-hit',g['full'] and all(g['hits']),g);caller.click();expect(p.locator('#task-view')).to_be_visible();p.locator('#task-return-origin').click();after=snap();ck('mobile-report-return-exact-caller-no-write',after['focus']==id and x.state()==state,{'snapshot':after,'caller':geom('#'+id)});body.focus();p.keyboard.press('Escape');ck('mobile-normal-Escape-close-focus',p.locator('#area-panel').count()==0 and p.evaluate('document.activeElement.id')=='check-summary',snap())
   # Actual format error through the existing import file control, not a storage fault or source mutation.
   invalid=O/'invalid-recovery.json';invalid.write_text('not a recovery JSON');p.locator('#import-file').set_input_files(str(invalid));p.wait_for_timeout(180);notice=p.locator('#notice');ck('actual-invalid-import-visible-no-project-loss',notice.is_visible() and x.state()==state,{'notice':notice.inner_text(),'geometry':geom('#notice'),'stateUnchanged':x.state()==state})
  except Exception:run['fatal']=traceback.format_exc()
  finally:
   run['pageerrors']=list(x.errors);run['externalRequests']=list(x.external)
   try:x.tearDown()
   except Exception:run['cleanupError']=traceback.format_exc()
finally:x.tearDownClass()
code=int(len(runs)!=2 or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'source':'9fb83ef50252d56c6411c81a0dca56d99becd651','expectedRuns':2,'executedRuns':len(runs),'runs':runs,'exit':code,'notRun':['actual OS IME','full mobile experience','real AI/provider']},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[(r['sample'],c['id']) for r in runs for c in r['checks'] if not c['pass']],'fatals':[r.get('fatal') for r in runs if r.get('fatal')]}));sys.exit(code)
