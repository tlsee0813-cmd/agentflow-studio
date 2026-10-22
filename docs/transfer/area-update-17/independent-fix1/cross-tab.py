from pathlib import Path
import os,sys,json,traceback,ast
R=Path(__file__).parent;A=R.parent/'cycle17-fix1-candidate/app';O=R/'cross-tab';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
m=ast.parse((R.parent/'home15-read-final/check.py').read_text());T=next(ast.literal_eval(n.value) for n in m.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='T' for t in n.targets));x=H();x.setUpClass();rows=[];fatal=None
# Original valid public-API fixture, imported through product file UI; no runtime state injection.
valid=json.loads((R/'new-request-domain.json').read_text())['before'];(O/'valid-existing-description.json').write_text(json.dumps(valid,ensure_ascii=False));c=json.loads((R/'fixtures/powertoys-meta.json').read_text());a,b,task=c['a'],c['b'],c['task']
try:
 for w,h in [(1280,720)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});x.ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=x.url)
  def rec(id,ok,raw):rows.append({'id':f'{w}-{id}','pass':bool(ok),'raw':raw})
  def snap():return p.evaluate('''()=>({y:scrollY,focus:document.activeElement.id,matrix:document.querySelector('#space-plane')&&getComputedStyle(document.querySelector('#space-plane')).transform,cards:[...document.querySelectorAll('.area-node')].map(e=>({id:e.dataset.areaId,rect:e.getBoundingClientRect().toJSON(),selected:e.classList.contains('selected')})),locateReturn:!!document.getElementById('locate-return'),title:document.querySelector('#space-title')?.textContent})''')
  def open_d(id):
   if not p.locator('#'+id).evaluate('(e)=>e.open'):p.locator('#'+id+' > summary').click()
  def compose():p.locator('#nav-work').click();open_d('compose-panel')
  try:
   p.once('dialog',lambda d:d.accept());p.locator('#import-file').set_input_files(str(O/'valid-existing-description.json'));expect(p.locator('#space-map')).to_be_visible();tab=x.ctx.new_page();tab.goto(x.url);tab.locator('.project-open').click();tab.locator(f'#node-info-{b}').click();tab.locator('#panel-edit > summary').click();tab.locator('#panel-note').fill('[다른 탭 실제 UI] 외부 변경 보존');tab.locator('#panel-save').click();base.saved(tab);tab.wait_for_timeout(150);external=p.evaluate('localStorage.getItem("agentflow.idea015.workspace")');tab.close();compose();p.locator('#draft').fill('[stale 탭] 저장 충돌로 메모리에만 유지');base.saved(p);p.wait_for_timeout(100);after=p.evaluate('localStorage.getItem("agentflow.idea015.workspace")');rec('cross-tab-stale-save-rejected',external==after and '덮어쓰지' in p.locator('#storage-error').inner_text(),{'external':external,'after':after,'error':p.locator('#storage-error').inner_text(),'input':p.locator('#draft').input_value()})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(not z['pass'] for z in rows)));(O/'result.json').write_text(json.dumps({'source':'d56eee9ac8233263d46a4e4c45755a80b471cc84','rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[z['id'] for z in rows if not z['pass']],'fatal':fatal}));sys.exit(code)
