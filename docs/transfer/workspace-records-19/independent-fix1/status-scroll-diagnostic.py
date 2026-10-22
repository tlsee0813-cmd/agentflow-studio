from pathlib import Path
import os,sys,json,ast,traceback
R=Path(__file__).parent;A=R.parent/'cycle19-fix1-candidate/app';O=R/'status-scroll-diagnostic';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
c=ast.parse((R/'core.py').read_text());SNAP=next(ast.literal_eval(n.value) for n in c.body if isinstance(n,ast.Assign) and any(isinstance(z,ast.Name) and z.id=='SNAP' for z in n.targets))
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();runs=[]
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept());run={'viewport':[w,h],'events':[],'checks':[]};runs.append(run)
  def snap():return p.evaluate(SNAP)
  def mark(label):z=snap();run.setdefault('observations',[]).append({'label':label,'snapshot':z});return z
  def ck(id,ok,raw):run['checks'].append({'id':id,'pass':bool(ok),'raw':raw})
  try:
   p.locator('#import-file').set_input_files(str(R/'fixtures/powertoys-many.json'));expect(p.locator('#space-map')).to_be_visible();base.saved(p);p.locator('#check-summary').click();body=p.locator('#area-panel-body');body.focus();p.keyboard.press('End');p.wait_for_timeout(100);p.locator('#project-name').click();p.keyboard.press('End');baseline=mark('notice-visible-records-at-end-name-focused');old=x.state()
   p.expose_binding('recordStatusInput',lambda source,value:run['events'].append(value));p.evaluate('''()=>{const read='''+SNAP+''';for(const capture of [true,false])document.addEventListener('input',e=>{if(e.target.id==='project-name')window.recordStatusInput({phase:capture?'capture-before-input-handler':'bubble-after-input-handler',timeStamp:e.timeStamp,performanceNow:performance.now(),isTrusted:e.isTrusted,noticeHidden:document.getElementById('notice').hidden,snapshot:read()});},capture);}''')
   p.mouse.move(w-3,h-40);p.mouse.wheel(0,300);p.wait_for_timeout(220);before=mark('after-real-page-wheel-before-name-input');run['pageAxisExecution']='EXECUTED_NONZERO' if before['windowY']>0 else 'NOT_MOVED (extent/hit in raw)';p.keyboard.insert_text(' · native scroll 관측');base.saved(p);expect(p.locator('#notice')).to_be_hidden();after=mark('after-real-name-input-and-save');new=x.state();ck('protected-content-camera-selection-after-status-size',old['space']==new['space'] and old['tasks']==new['tasks'] and old['sources']==new['sources'] and old['currentTaskId']==new['currentTaskId'] and old['draft']==new['draft'] and after['matrix']==before['matrix'] and [c['id'] for c in after['cards'] if c['selected']]==[c['id'] for c in before['cards'] if c['selected']],{'beforeState':old,'afterState':new,'before':before,'after':after});ck('native-record-scroll-clamps-to-real-new-extent',abs(after['bodyTop']-min(before['bodyTop'],after['bodyMax']))<=1,{'beforeTop':before['bodyTop'],'beforeMax':before['bodyMax'],'afterTop':after['bodyTop'],'afterMax':after['bodyMax'],'mapBefore':before['map'],'mapAfter':after['map'],'pageYBefore':before['windowY'],'pageYAfter':after['windowY']})
  except Exception:run['fatal']=traceback.format_exc()
  finally:
   run['pageerrors']=list(x.errors)
   try:x.tearDown()
   except Exception:run['cleanupError']=traceback.format_exc()
finally:x.tearDownClass()
code=int(len(runs)!=2 or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'source':'acfafd2dd6426e3fa6fa5443bd2e67d8461608c9','scope':'native page wheel while name remains focused then real text input; observe before-handler/bubble and natural body extent clamp; not an origin-return assertion','runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'fatals':[r.get('fatal') for r in runs if r.get('fatal')],'failed':[(r['viewport'],c['id']) for r in runs for c in r['checks'] if not c['pass']]}));sys.exit(code)
