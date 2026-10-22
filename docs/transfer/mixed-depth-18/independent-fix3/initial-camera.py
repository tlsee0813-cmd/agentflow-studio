from pathlib import Path
import os,sys,json,ast,traceback,hashlib,datetime
R=Path(__file__).parent;A=R.parent/'cycle18-fix3-candidate/app';O=R/'initial-camera';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
source=ast.parse((R/'ui.py').read_text());SNAP=next(ast.literal_eval(n.body[0].value.args[0]) for n in ast.walk(source) if isinstance(n,ast.FunctionDef) and n.name=='snap')
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();rows=[];fatal=None
try:
 for w,h,neww,newh in [(1280,720,1440,900),(1440,900,1280,720)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept())
  try:
   p.locator('#import-file').set_input_files(str(R/'fixtures/powertoys.json'));expect(p.locator('#space-map')).to_be_visible();base.saved(p);old=p;p=x.ctx.new_page();p.set_viewport_size({'width':w,'height':h});html=A/'continuity/dist/public/index.html';beforeBytes=html.read_bytes();response=p.goto(x.url);actual=response.body();assert actual==beforeBytes==html.read_bytes();binding={'url':response.url,'status':response.status,'bytes':len(actual),'bodySHA256':hashlib.sha256(actual).hexdigest(),'diskBeforeSHA256':hashlib.sha256(beforeBytes).hexdigest(),'diskAfterSHA256':hashlib.sha256(html.read_bytes()).hexdigest()};p.locator('.project-open').first.click();expect(p.locator('#space-map')).to_be_visible();old.close();x.page=p;p.on('pageerror',lambda e:x.errors.append(str(e)));p.on('dialog',lambda d:d.accept());before=p.evaluate(SNAP);p.set_viewport_size({'width':neww,'height':newh});p.wait_for_timeout(100);resized=p.evaluate(SNAP);p.locator('#nav-projects').click();listFocus=p.evaluate('document.activeElement.id');listName=p.evaluate('document.activeElement.textContent');focusedClass=p.evaluate('document.activeElement.className');p.locator('#project-list .project-open').first.click();expect(p.locator('#space-map')).to_be_visible();after=p.evaluate(SNAP);rows.append({'viewportBefore':[w,h],'viewportAfter':[neww,newh],'id':'first-camera-survives-native-resize-and-project-list','pass':before['matrix']==resized['matrix']==after['matrix'] and [(z['id'],z['x'],z['y']) for z in before['cards']]==[(z['id'],z['x'],z['y']) for z in after['cards']] and 'project-open' in focusedClass and after['focus']=='space-title','before':before,'resized':resized,'listFocus':{'id':listFocus,'name':listName,'class':focusedClass},'after':after,'actualFirstFreshPageHTTP':binding,'scope':'No map zoom/pan/fit/selection before these snapshots; project card is intended whole-space entry; list focus means original project button, not arbitrary DOM id equality.'})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(not r['pass'] for r in rows)));(O/'result.json').write_text(json.dumps({'source':'9fb311b93910000f7a1e9ac096a2303d3dc1c445','expected':2,'executed':len(rows),'complete':len(rows)==2,'rows':rows,'fatal':fatal,'exit':code,'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'fatal':fatal}));sys.exit(code)
