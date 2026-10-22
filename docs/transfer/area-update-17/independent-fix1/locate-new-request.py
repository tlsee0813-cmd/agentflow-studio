from pathlib import Path
import os,sys,json,traceback,ast
R=Path(__file__).parent;A=R.parent/'cycle17-fix1-candidate/app';O=R/'locate-new-request';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
m=ast.parse((R.parent/'home15-read-final/check.py').read_text());T=next(ast.literal_eval(n.value) for n in m.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='T' for t in n.targets));x=H();x.setUpClass();rows=[];fatal=None
# Original valid public-API fixture, imported through product file UI; no runtime state injection.
valid=json.loads((R/'new-request-domain.json').read_text())['before'];(O/'valid-existing-description.json').write_text(json.dumps(valid,ensure_ascii=False));c=json.loads((R/'fixtures/powertoys-meta.json').read_text());a,b,task=c['a'],c['b'],c['task']
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});x.ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=x.url)
  def rec(id,ok,raw):rows.append({'id':f'{w}-{id}','pass':bool(ok),'raw':raw})
  def snap():return p.evaluate('''()=>({y:scrollY,focus:document.activeElement.id,matrix:document.querySelector('#space-plane')&&getComputedStyle(document.querySelector('#space-plane')).transform,cards:[...document.querySelectorAll('.area-node')].map(e=>({id:e.dataset.areaId,rect:e.getBoundingClientRect().toJSON(),selected:e.classList.contains('selected')})),locateReturn:!!document.getElementById('locate-return'),title:document.querySelector('#space-title')?.textContent})''')
  def open_d(id):
   if not p.locator('#'+id).evaluate('(e)=>e.open'):p.locator('#'+id+' > summary').click()
  def compose():p.locator('#nav-work').click();open_d('compose-panel')
  try:
   p.once('dialog',lambda d:d.accept());p.locator('#import-file').set_input_files(str(O/'valid-existing-description.json'));expect(p.locator('#space-map')).to_be_visible();compose();p.locator('#draft').fill('');base.saved(p);p.locator('#nav-space').click();p.locator(f'#node-info-{b}').click();box=p.locator('#space-map').bounding_box();xx=box['x']+100;yy=min(h-60,box['y']+box['height']-20);p.mouse.move(xx,yy);p.mouse.down();p.mouse.move(xx-900,yy,steps=10);p.mouse.up();rt=next(t for t in valid['tasks'] if t.get('resultFile'));f=json.loads(rt['resultFile']['rawText']);f['understanding']['summary']='[독립 현재 설명] 새 요청 전체경로를 확인한다.';fp=O/f'{w}-receipt.json';fp.write_text(json.dumps(f,ensure_ascii=False));compose();open_d('result-file-panel');p.locator('#result-file-input').set_input_files(str(fp));p.locator('#accept-result-file').click();base.saved(p);p.locator('#nav-space').click();origin=snap();savedOrigin=x.state();p.locator(f'#received-area-{a}').click();located=snap();p.locator('#panel-new-request').click();prepared=snap();beforeNew=x.state();body='[독립 실제 새 요청] 현재 구상은 그대로 두고 다음 작은 작업만 정리해 주세요.';p.locator('#draft').fill(body);p.locator('#send').click();expect(p.locator('#working')).to_have_text('');afterNew=x.state();new=next(t for t in afterNew['tasks'] if t['id']==afterNew['currentTaskId']);sources=[z for z in afterNew['sources'] if z['id'] in new['sourceIds']];rec('actual-new-request-submitted',len(afterNew['tasks'])==len(beforeNew['tasks'])+1 and afterNew['currentTaskId']!=beforeNew['currentTaskId'] and sources[0]['kind']=='request' and sources[0]['text']==body,{'before':beforeNew,'after':afterNew,'newTask':new,'sources':sources});open_d('file-return-options');p.locator('#copy-file-work').click();expect(p.locator('#notice')).to_contain_text('클립보드');text=p.evaluate('navigator.clipboard.readText()');afterCopy=snap();controls=p.locator('.origin-return').evaluate_all('(es)=>es.map(e=>({id:e.id,text:e.textContent}))');rec('new-request-clipboard-carries-current-description','[독립 현재 설명] 새 요청 전체경로를 확인한다.' in text,{'text':text,'record':x.state()['tasks'][-1]['handoffs'][-1]});explicit=p.locator('#work-return-origin').count()+p.locator('#locate-return').count();
   if p.locator('#work-return-origin').count():p.locator('#work-return-origin').click()
   elif p.locator('#locate-return').count():p.locator('#locate-return').click()
   else:p.locator('#nav-space').click()
   if p.locator('#locate-return').count():p.locator('#locate-return').click()
   returned=snap();rec('locate-panel-new-request-submit-copy-prelocate-return',explicit>0 and returned['matrix']==origin['matrix'] and returned['cards']==origin['cards'] and abs(returned['y']-origin['y'])<=2,{'origin':origin,'originStoredProject':savedOrigin,'located':located,'prepared':prepared,'afterCopy':afterCopy,'explicitReturnControls':controls,'explicitCount':explicit,'fallbackIfNoExplicit':'normal nav-space is observed, not treated as equivalent explicit restoration','returned':returned,'afterStoredProject':x.state()});p.screenshot(path=str(O/f'{w}-new-request-no-origin.png'))
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(not z['pass'] for z in rows)));(O/'result.json').write_text(json.dumps({'source':'d56eee9ac8233263d46a4e4c45755a80b471cc84','rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[z['id'] for z in rows if not z['pass']],'fatal':fatal}));sys.exit(code)
