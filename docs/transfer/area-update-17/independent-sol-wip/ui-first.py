from pathlib import Path
import os,sys,json,traceback
R=Path(__file__).parent;A=R.parent/'cycle17-sol-wip/app';O=R/'ui';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();r={'source':'6ea2915e6483076710840883de8891a197464386','stage':'WIP preliminary only, not final approval','rows':[]};fatal=None
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});ids=json.loads((R/'ids.json').read_text());a,b=ids['a'],ids['b'];p.once('dialog',lambda d:d.accept());p.locator('#import-file').set_input_files(str(R/'fixture.json'));expect(p.locator('#space-map')).to_be_visible()
  def rec(name,ok,raw):r['rows'].append({'id':f'{w}-{name}','pass':bool(ok),'raw':raw})
  def shotstate():return p.evaluate('''()=>{const rect=e=>e&&e.getBoundingClientRect().toJSON();return {y:scrollY,focus:document.activeElement.id,matrix:getComputedStyle(document.getElementById('space-plane')).transform,cards:[...document.querySelectorAll('.area-node')].map(e=>({id:e.dataset.areaId,rect:rect(e),selected:e.classList.contains('selected')})),panel:rect(document.getElementById('area-panel')),open:[...document.querySelectorAll('#area-panel details[open]')].map(e=>e.id)}}''')
  def panel(area):return f'#panel-understanding-{area}'
  try:
   p.locator(f'#node-info-{a}').click();p.locator(panel(a)+'-evidence > summary').click();opened=shotstate();p.locator('#area-panel-close').click();p.locator(f'#node-info-{b}').click();ev=p.locator(panel(b)+'-evidence');rec('A-evidence-to-B-no-open-leak',not ev.evaluate('(e)=>e.open'),{'A':opened,'B':shotstate(),'BVisibleText':p.locator('#area-panel').inner_text()});p.locator('#area-panel-close').click();p.locator(f'#node-info-{a}').click();p.locator(panel(a)+'-edit > summary').click();draft='[독립 합성 r1 정정 초안] r2 설명을 덮어쓰면 안 된다.';p.locator(panel(a)+'-text').fill(draft)
   # User map movement before receipt; no programmatic map scroll/transform.
   p.locator('#area-panel-close').click();box=p.locator('#space-map').bounding_box();xx=box['x']+box['width']/2;yy=min(h-70,box['y']+box['height']-20)
   p.mouse.move(xx,yy);p.mouse.down();p.mouse.move(xx-900,yy,steps=10);p.mouse.up();mapBefore=shotstate();p.locator('#nav-work').click();details=p.locator('#result-file-panel');
   if not details.evaluate('(e)=>e.open'):p.locator('#result-file-panel > summary').click()
   p.locator('#result-file-input').set_input_files(str(R/'r2.json'));p.locator('#accept-result-file').click();expect(p.locator('#result-file-message')).to_contain_text('앱 미검증');base.saved(p);p.locator('#nav-space').click();beforeCTA=shotstate();cta=p.locator(f'#received-area-{a}');cta.click();afterCTA=shotstate();rec('change-location-opens-understanding',p.locator(panel(a)).is_visible(),{'preMap':mapBefore,'beforeCTA':beforeCTA,'afterCTA':afterCTA,'panelText':p.locator('#area-panel').inner_text(),'note':'card screen rect is recorded separately; opening a panel is not proof card itself is in view'})
   field=p.locator(panel(a)+'-text');value=field.input_value();beforeProject=x.state();p.locator(panel(a)+'-save').click();base.saved(p);afterProject=x.state();rec('stale-r1-draft-save-rejected-and-text-preserved',beforeProject==afterProject and field.input_value()==draft and value==draft,{'fieldBefore':value,'fieldAfter':field.input_value(),'notice':p.locator('#notice').inner_text(),'before':beforeProject,'after':afterProject,'state':shotstate()});p.screenshot(path=str(O/f'{w}-stale-draft.png'));p.locator('#area-panel-close').click();afterClose=shotstate();rec('map-view-retained-after-explicit-CTA-close',mapBefore['matrix']==afterClose['matrix'] and [(z['id'],z['rect']) for z in mapBefore['cards']]==[(z['id'],z['rect']) for z in afterClose['cards']],{'originalMap':mapBefore,'afterClose':afterClose})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(not z['pass'] for z in r['rows'])));r.update(fatal=fatal,exit=code);(O/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[z['id'] for z in r['rows'] if not z['pass']],'fatal':fatal},ensure_ascii=False));sys.exit(code)
