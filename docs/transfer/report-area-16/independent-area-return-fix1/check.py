from pathlib import Path
import os,sys,json,traceback,hashlib,datetime,ast
R=Path(__file__).parent;A=R.parent/'cycle16-fix1/app';O=R/'raw';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();r={'start':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'a0f0ae786c580a8919cede07db48d4397b58b114','viewport':[1280,720],'checks':[],'method':'isolated context; existing synthetic project imported through normal file UI; long note edited via UI, native wheel, normal click/fill. No API/state/DOM scrolling injection.'};fatal=None
# Read-only glyph Range and every clipping ancestor/hit definition reused.
m=ast.parse((R.parent/'home15-read-final/check.py').read_text());T=next(ast.literal_eval(n.value) for n in m.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='T' for t in n.targets))
try:
 x.setUp();p=x.page;p.set_viewport_size({'width':1280,'height':720});r['actualURL']=x.url;area,other,Aid,R1,R2,B,RB=json.loads((R.parent/'cycle16-fix1-evidence/independent/ids-1280.json').read_text());fixture=R.parent/'cycle16-fix1-evidence/independent/fixture-1280.json';p.once('dialog',lambda d:d.accept());p.locator('#import-file').set_input_files(str(fixture));expect(p.locator('#space-map')).to_be_visible();p.locator(f'#node-enter-{area}').click();p.locator('#area-edit > summary').click();long='[독립 합성 긴 현재 구상] '+('후보를 좁히고 사용자가 명시적으로 고른 뒤 확정한다. '*24)+'구상 끝 AREA-RETURN-TAIL';p.locator('#area-edit-note').fill(long);p.locator('#area-edit-save').click();base.saved(p);p.locator('#area-edit > summary').click();p.locator('#area-idea-full > summary').click()
 def approach(loc):
  for _ in range(35):
   b=loc.bounding_box()
   if b and b['y']>=90 and b['y']+b['height']<670:return
   p.mouse.move(1260,500);p.mouse.wheel(0,100 if b and b['y']>600 else -100);p.wait_for_timeout(60)
  raise AssertionError('native wheel could not expose control')
 def snap():return p.evaluate('''id=>{const rect=e=>e&&e.getBoundingClientRect().toJSON(),b=document.getElementById(id),rr=b.getBoundingClientRect(),hit=document.elementFromPoint(rr.x+rr.width/2,rr.y+rr.height/2);return {windowY:scrollY,docHeight:document.documentElement.scrollHeight,focus:document.activeElement.id,caller:rect(b),callerHit:!!hit&&(hit===b||b.contains(hit)),callerInViewport:rr.top>=0&&rr.bottom<=innerHeight,ideaOpen:document.getElementById('area-idea-full')?.open,idea:rect(document.getElementById('area-idea-full')),areaTitle:document.getElementById('space-title').textContent,matrix:document.querySelector('#space-plane')&&getComputedStyle(document.querySelector('#space-plane')).transform}}''',f'task-open-{Aid}')
 def ck(name,ok,raw):r['checks'].append({'id':name,'pass':bool(ok),'raw':raw})
 caller=p.locator(f'#task-open-{Aid}');approach(caller);before=snap();r['before']=before;assert before['windowY']>0;caller.click();expect(p.locator('#task-view')).to_be_visible();p.locator(f'#task-report-pick-{R2}').click();full=p.locator('#task-pointed details[id^="task-report-src-"]');approach(full.locator('summary'));full.locator('summary').click();raw=full.locator('.source-raw');trail=[];seen=None
 for _ in range(30):
  seen=p.evaluate(T,['task-pointed','ZZ-END-R2']);trail.append({'glyph':seen,'scroll':raw.evaluate('(e)=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight})'),'windowY':p.evaluate('scrollY')})
  if seen.get('full') and all(seen.get('hits',[])):break
  box=raw.bounding_box()
  if box['y']>620:p.mouse.move(1260,500)
  else:p.mouse.move(box['x']+box['width']/2,max(100,min(620,box['y']+50)))
  p.mouse.wheel(0,100);p.wait_for_timeout(60)
 ck('report-full-tail-native-visible',seen.get('full') and all(seen.get('hits',[])),trail);approach(full.locator('summary'));full.locator('summary').click();ck('report-full-close-removes-rendered-body',not raw.evaluate('(e)=>e.checkVisibility()'),{'visible':raw.evaluate('(e)=>e.checkVisibility()')})
 approach(p.locator('#task-next-action'));p.locator('#task-next-action').click();draft='[독립 합성 AREA-RETURN] 현재 구상을 유지하고 Enter 처리만 검토해 주세요. 게시·전송은 하지 않습니다.';p.locator('#draft').fill(draft);base.saved(p);saved=x.state();p.locator('#work-return-origin').click();after=snap();r['after']=after;returned=x.state();ck('return-expanded-focus-hit',after['ideaOpen'] and after['focus']==f'task-open-{Aid}' and after['callerHit'] and after['callerInViewport'],after);ck('return-caller-viewport-delta',abs(after['caller']['y']-before['caller']['y'])<=2,{'before':before,'after':after,'callerDelta':after['caller']['y']-before['caller']['y'],'windowDelta':after['windowY']-before['windowY']});ck('saved-draft-manual-current-not-rolled-back',saved==returned and returned['draft']==draft,{'saved':saved,'returned':returned});ck('long-current-note-kept',next(a['note'] for a in returned['space']['areas'] if a['id']==area)==long,{'note':long});p.screenshot(path=str(O/'1280-area-return.png'));r['initialImportedFixtureSHA256']=hashlib.sha256(fixture.read_bytes()).hexdigest()
except Exception:fatal=traceback.format_exc();r['fatal']=fatal
finally:
 try:x.tearDown()
 finally:x.tearDownClass()
r['end']=datetime.datetime.now(datetime.timezone.utc).isoformat();r['exit']=int(bool(fatal or any(not z['pass'] for z in r['checks'])));(O/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({'exit':r['exit'],'checks':len(r['checks']),'failed':[z['id'] for z in r['checks'] if not z['pass']],'fatal':fatal}));sys.exit(r['exit'])
