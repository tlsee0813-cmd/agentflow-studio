from pathlib import Path
import os,sys,json,traceback,importlib.util,hashlib
R=Path(__file__).parent;A=R.parent/'cycle16-v0/app';O=R/'visual';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
# Exact Range/all-ancestor-axis clipping/representative hit observer reused from HOME15, not an app helper.
import ast
mod=ast.parse((R.parent/'home15-read-final/check.py').read_text());T=next(ast.literal_eval(n.value) for n in mod.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='T' for t in n.targets))
rows=[];fatal=None
class Harness(base.Browser):
 def runTest(self):pass
x=Harness();x.setUpClass()
try:
 for width,height in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':width,'height':height});state=json.loads((R/'independent'/f'fixture-{width}.json').read_text());area,other,Aid,R1,R2,B,RB=json.loads((R/'independent'/f'ids-{width}.json').read_text());env={'version':'agentflow.workspace.1','migratedFromLegacy':True,'entries':[{'entryId':'E_cycle16-independent','state':'active','lifecycle':1,'seq':1,'createdAt':'2026-10-16T00:00:00Z','trashedAt':None,'origin':'import','project':state}]}
  def rec(id,passed,raw):rows.append({'id':f'{width}-{id}','pass':bool(passed),'raw':raw})
  def snapshot():return p.evaluate('''()=>{const rect=e=>e&&e.getBoundingClientRect().toJSON();return {y:scrollY,focus:document.activeElement.id,matrix:document.querySelector('#space-plane')&&getComputedStyle(document.querySelector('#space-plane')).transform,cards:[...document.querySelectorAll('.area-node')].map(e=>({area:e.dataset.areaId,rect:rect(e),selected:e.classList.contains('selected')})),open:[...document.querySelectorAll('#space-view details[open]')].map(e=>e.id),title:document.querySelector('#space-title').textContent}}''')
  def install(env):
   p.evaluate('(s)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",s)}',json.dumps(env,ensure_ascii=False));p.reload();p.locator('.project-open').click()
  def read():p.locator(f'#node-enter-{area}').click();p.locator(f'#task-open-{Aid}').click()
  def approach(locator):
   for _ in range(30):
    b=locator.bounding_box()
    if b and b['y']>=80 and b['y']+b['height']<height-25:return
    p.mouse.move(width-10,height/2);p.mouse.wheel(0,180 if b and b['y']>=height-25 else -180);p.wait_for_timeout(40)
  try:
   install(env);read();before=x.state();p.locator(f'#task-report-pick-{R1}').click()
   # Mark only short real sentences with temporary identifiers? IDs are read-only selectors via text walker T on existing IDs.
   idea=p.evaluate(T,['task-view-idea','검색어를 제출해도 키를 바로 확정하지 않는다.']);lead=p.evaluate(T,['task-pointed','f10 입력 직후 Enter를 누르면 F10이 선택된다.']);rec('F10-simultaneous',idea.get('full') and lead.get('full') and all(idea.get('hits',[])) and all(lead.get('hits',[])),{'idea':idea,'report':lead,'snapshot':snapshot()});p.screenshot(path=str(O/f'{width}-F10.png'))
   expected=next(t for t in state['tasks'] if t['id']==R1)['sourceIds'];actual=p.locator('#task-pointed .report-source').evaluate_all('(es)=>es.map(e=>e.dataset.sourceId)');rec('all-sourceIds',actual==expected,{'expected':expected,'actual':actual})
   # Keyboard-only traversal between actual report buttons, record focus viewport at each selection.
   first=p.locator(f'#task-report-pick-{R1}');approach(first);first.click();p.keyboard.press('Tab');focus=p.evaluate('document.activeElement.id');p.keyboard.press('Enter');rec('keyboard-second-report',focus==f'task-report-pick-{R2}',{'focusBeforeEnter':focus,'after':snapshot(),'secondButton':p.locator(f'#task-report-pick-{R2}').bounding_box()})
   p.locator(f'#task-report-pick-{R2}').click();full=p.locator('#task-pointed details[id^="task-report-src-"]');approach(full.locator('summary'));full.locator('summary').click();raw=full.locator('.source-raw');approach(raw);b=raw.bounding_box();p.mouse.move(b['x']+b['width']/2,min(height-40,max(100,b['y']+40)));scroll=[]
   for _ in range(20):
    p.mouse.wheel(0,180);p.wait_for_timeout(30);scroll.append(raw.evaluate('(e)=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight})'))
   tail=p.evaluate(T,['task-pointed','ZZ-END-R2']);rec('long-report-native-wheel-tail',tail.get('full') and all(tail.get('hits',[])),{'tail':tail,'scroll':scroll});approach(full.locator('summary'));full.locator('summary').click();closed=raw.evaluate('(e)=>({visible:e.checkVisibility(),rects:[...e.getClientRects()].map(r=>r.toJSON())})');rec('full-close-removal',not closed['visible'],closed);rec('reading-no-project-write',x.state()==before,{'before':before,'after':x.state()})
   # Real second tab legally archives origin area while first tab remains in reading.
   install(env);read();originBefore=snapshot();tab=x.ctx.new_page();tab.goto(x.url);tab.locator('.project-open').click();tab.locator(f'#node-enter-{area}').click();archive=tab.locator('#area-archive');archive.click();base.saved(tab);tab.close();p.wait_for_timeout(200);back=p.locator('#task-return-origin');available=back.count();rawBefore=snapshot()
   if available:
    back.click();after=snapshot();rec('other-tab-area-archive-fallback',after['title']=='전체 공간' and not any(c['selected'] for c in after['cards']),{'before':originBefore,'afterStorageBeforeReturn':rawBefore,'after':after,'notice':p.locator('#notice').text_content() if p.locator('#notice').count() else None})
   else:rows.append({'id':f'{width}-other-tab-area-archive-fallback','status':'NOT_RUN','reason':'origin return control absent after legitimate other-tab archive','raw':rawBefore})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(z.get('pass') is False for z in rows)));(O/'result.json').write_text(json.dumps({'rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failures':[z['id'] for z in rows if z.get('pass') is False],'fatal':fatal}));sys.exit(code)
