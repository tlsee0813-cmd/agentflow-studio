from pathlib import Path
import os,sys,json,traceback
R=Path(__file__).parent;A=R.parent/'cycle18-fix4-candidate/app';O=R/'normal-escape';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();rows=[];fatal=None;a=json.loads((R/'fixtures/powertoys-meta.json').read_text())['target']
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept())
  try:
   p.locator('#import-file').set_input_files(str(R/'fixtures/powertoys.json'));expect(p.locator('#space-map')).to_be_visible();p.locator('#nav-context').click();p.locator('#nav-space').click();p.locator('#map-fit').click();p.locator('#node-info-'+a).click();p.locator('#area-panel-body').focus();p.keyboard.press('Escape');raw={'panelCount':p.locator('#area-panel').count(),'context':p.locator('#nav-context').get_attribute('aria-expanded'),'focus':p.evaluate('document.activeElement.id')};rows.append({'viewport':[w,h],'pass':raw['panelCount']==0 and raw['context']=='true' and raw['focus']=='node-info-'+a,'raw':raw});p.keyboard.press('Escape');raw={'context':p.locator('#nav-context').get_attribute('aria-expanded'),'focus':p.evaluate('document.activeElement.id')};rows.append({'viewport':[w,h],'pass':raw['context']=='false','raw':raw})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(not r['pass'] for r in rows)));(O/'result.json').write_text(json.dumps({'rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'fatal':fatal}));sys.exit(code)
