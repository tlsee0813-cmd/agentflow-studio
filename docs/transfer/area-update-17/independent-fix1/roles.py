from pathlib import Path
import os,sys,json,traceback,ast
R=Path(__file__).parent;A=R.parent/'cycle17-fix1-candidate/app';O=R/'roles';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
m=ast.parse((R.parent/'home15-read-final/check.py').read_text());T=next(ast.literal_eval(n.value) for n in m.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='T' for t in n.targets));x=H();x.setUpClass();rows=[];fatal=None
# Original valid public-API fixture, imported through product file UI; no runtime state injection.
valid=None
try:
 for cid,w,h in [('powertoys',1280,720),('powertoys',1440,900),('p13',1280,720),('p13',1440,900)]:
  c=json.loads((R/f'fixtures/{cid}-meta.json').read_text());a,b,task=c['a'],c['b'],c['task']
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});x.ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=x.url)
  def rec(id,ok,raw):rows.append({'id':f'{cid}-{w}-{id}','pass':bool(ok),'raw':raw})
  def snap():return p.evaluate('''()=>({y:scrollY,focus:document.activeElement.id,matrix:document.querySelector('#space-plane')&&getComputedStyle(document.querySelector('#space-plane')).transform,cards:[...document.querySelectorAll('.area-node')].map(e=>({id:e.dataset.areaId,rect:e.getBoundingClientRect().toJSON(),selected:e.classList.contains('selected')})),locateReturn:!!document.getElementById('locate-return'),title:document.querySelector('#space-title')?.textContent})''')
  def open_d(id):
   if not p.locator('#'+id).evaluate('(e)=>e.open'):p.locator('#'+id+' > summary').click()
  def compose():p.locator('#nav-work').click();open_d('compose-panel')
  try:
   p.once('dialog',lambda d:d.accept());p.locator('#import-file').set_input_files(str(R/f'role-fixtures/{cid}-{w}.json'));expect(p.locator('#space-map')).to_be_visible();p.locator(f'#node-info-{a}').click();pid=f'panel-understanding-{a}';idea=p.evaluate(T,['panel-idea',c['note'].split('.')[0]]);expl=p.evaluate(T,[pid,c['summary'].split('.')[0]]);rec('both-role-actual-base-text-visible',idea.get('full') and all(idea.get('hits',[])) and expl.get('full') and all(expl.get('hits',[])),{'idea':idea,'explanation':expl,'snapshot':snap()});p.screenshot(path=str(O/f'{cid}-{w}-basic-read.png'))
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(not z['pass'] for z in rows)));(O/'result.json').write_text(json.dumps({'source':'d56eee9ac8233263d46a4e4c45755a80b471cc84','rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[z['id'] for z in rows if not z['pass']],'fatal':fatal}));sys.exit(code)
