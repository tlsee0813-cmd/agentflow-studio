from pathlib import Path
import os,sys,json,traceback,ast
R=Path(__file__).parent;A=R.parent/'cycle17-fix1-candidate/app';O=R/'capture';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
m=ast.parse((R.parent/'home15-read-final/check.py').read_text());T=next(ast.literal_eval(n.value) for n in m.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='T' for t in n.targets));x=H();x.setUpClass();rows=[];fatal=None
try:
 x.setUp();p=x.page;p.set_viewport_size({'width':1280,'height':720});c=json.loads((R/'fixtures/powertoys-meta.json').read_text());a,b=c['a'],c['b'];p.once('dialog',lambda d:d.accept());p.locator('#import-file').set_input_files(str(R/'supplement-fixture.json'));expect(p.locator('#space-map')).to_be_visible()
 def rec(id,ok,raw):rows.append({'id':id,'pass':bool(ok),'raw':raw})
 def approach(loc):
  for _ in range(45):
   q=loc.bounding_box()
   if q and 80<q['y'] and q['y']+q['height']<680:return
   p.mouse.move(1260,400);p.mouse.wheel(0,90 if q and q['y']>600 else -90);p.wait_for_timeout(40)
  raise AssertionError('native approach failed')
 def panel(area):return f'panel-understanding-{area}'
 def open_d(id):
  loc=p.locator('#'+id)
  if not loc.evaluate('(e)=>e.open'):approach(loc.locator(':scope > summary'));loc.locator(':scope > summary').click()
 p.locator(f'#node-info-{a}').click();pid=panel(a);closed=p.locator('#'+pid+' details').evaluate_all('(es)=>es.map(e=>({id:e.id,open:e.open}))');rec('long-data-base-collapsed',not any(z['open'] for z in closed),{'details':closed,'text':p.locator('#'+pid).inner_text()});p.screenshot(path=str(O/'1280-long-collapsed.png'))
except Exception:fatal=traceback.format_exc()
finally:
 try:x.tearDown()
 finally:x.tearDownClass()
code=int(bool(fatal or any(not z['pass'] for z in rows)));(O/'result.json').write_text(json.dumps({'source':'d56eee9ac8233263d46a4e4c45755a80b471cc84','rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[z['id'] for z in rows if not z['pass']],'fatal':fatal}));sys.exit(code)
