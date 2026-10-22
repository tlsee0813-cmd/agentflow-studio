from pathlib import Path
import os,sys,json,traceback,ast
R=Path(__file__).parent;A=R.parent/'cycle17-fix1-candidate/app';O=R/'supplement';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
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
 # Both current descriptions truly exist before testing disclosure isolation.
 for area in [a,b]:p.locator(f'#node-info-{area}').click();rec('current-description-exists-'+area,p.locator('#'+panel(area)).count()==1,{'text':p.locator('#'+panel(area)).inner_text()});p.locator('#area-panel-close').click()
 p.locator(f'#node-info-{a}').click();pid=panel(a)
 for suffix,marker in [('full','PROPOSAL-TAIL-INDEPENDENT'),('evidence','REPORT-TAIL-INDEPENDENT'),('history','HISTORY-TAIL-INDEPENDENT')]:
  id=pid+'-'+suffix;open_d(id);trail=[];target=p.locator('#'+id+' .source-raw').filter(has_text=marker).first
  for _ in range(60):
   g=p.evaluate(T,[id,marker]);scroll=target.evaluate('(e)=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight,rect:e.getBoundingClientRect().toJSON()})');trail.append({'glyph':g,'scroll':scroll,'windowY':p.evaluate('scrollY')})
   if g.get('full') and all(g.get('hits',[])):break
   q=target.bounding_box()
   if q['y']>620 or q['y']+q['height']<100:p.mouse.move(1260,400);p.mouse.wheel(0,90 if q['y']>620 else -90)
   else:p.mouse.move(q['x']+q['width']/2,max(100,min(620,q['y']+40)));p.mouse.wheel(0,90)
   p.wait_for_timeout(40)
  rec('native-tail-'+suffix,g.get('full') and all(g.get('hits',[])),trail);loc=p.locator('#'+id);approach(loc.locator(':scope > summary'));loc.locator(':scope > summary').click();rec('closed-body-hidden-'+suffix,not target.evaluate('(e)=>e.checkVisibility()'),{'visible':target.evaluate('(e)=>e.checkVisibility()'),'detailsRect':loc.bounding_box()})
 # Reopen A evidence/full, then normal close A and open B with its own current data.
 open_d(pid+'-full');open_d(pid+'-evidence');openA=p.locator('#'+pid+' details[open]').evaluate_all('(es)=>es.map(e=>e.id)');p.locator('#area-panel-close').click();p.locator(f'#node-info-{b}').click();bid=panel(b);rec('both-described-A-to-B-no-disclosure-leak',not p.locator('#'+bid+'-full').evaluate('(e)=>e.open') and not p.locator('#'+bid+'-evidence').evaluate('(e)=>e.open'),{'AOpen':openA,'BOpen':p.locator('#'+bid+' details[open]').evaluate_all('(es)=>es.map(e=>e.id)'),'BText':p.locator('#'+bid).inner_text()});p.screenshot(path=str(O/'1280-long-content-collapsed-B.png'))
except Exception:fatal=traceback.format_exc()
finally:
 try:x.tearDown()
 finally:x.tearDownClass()
code=int(bool(fatal or any(not z['pass'] for z in rows)));(O/'result.json').write_text(json.dumps({'source':'d56eee9ac8233263d46a4e4c45755a80b471cc84','rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[z['id'] for z in rows if not z['pass']],'fatal':fatal}));sys.exit(code)
