from pathlib import Path
import os,sys,json,ast,traceback
R=Path(__file__).parent;A=R.parent/'cycle18-fix3-candidate/app';O=R/'view-protection';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
source=ast.parse((R/'ui.py').read_text());SNAP=next(ast.literal_eval(n.body[0].value.args[0]) for n in ast.walk(source) if isinstance(n,ast.FunctionDef) and n.name=='snap')
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();rows=[];fatal=None;m=json.loads((R/'fixtures/powertoys-meta.json').read_text())
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept())
  try:
   p.locator('#import-file').set_input_files(str(R/'fixtures/powertoys.json'));expect(p.locator('#space-map')).to_be_visible();before=p.evaluate(SNAP);p.locator('#node-info-'+m['parent']).click();opened=p.evaluate(SNAP);p.locator('#area-panel-close').click();closed=p.evaluate(SNAP);rows.append({'viewport':[w,h],'id':'initial-fit-does-not-overwrite-selection-open-close','pass':before['matrix']==opened['matrix']==closed['matrix'],'before':before,'opened':opened,'closed':closed})
   p.locator('#map-zoom-in').click();p.locator('#map-zoom-in').click();zoom=p.evaluate(SNAP);box=p.locator('#space-map').bounding_box();pts=[[box['x']+box['width']*fx,box['y']+box['height']*fy] for fy in [.9,.75,.5] for fx in [.1,.3,.5,.7,.9]];hits=p.evaluate('(ps)=>ps.map(([x,y])=>{let e=document.elementFromPoint(x,y);return {x,y,id:e?.id,empty:!!e&&["space-map","space-plane","relation-layer"].includes(e.id)}})',pts);point=next(q for q in hits if q['empty']);p.mouse.move(point['x'],point['y']);p.mouse.down();p.mouse.move(point['x']-70,point['y']+25,steps=6);p.mouse.up();pan=p.evaluate(SNAP);rows.append({'viewport':[w,h],'id':'native-nondefault-zoom-and-pan','pass':zoom['matrix']!=closed['matrix'] and pan['matrix']!=zoom['matrix'],'before':closed,'zoom':zoom,'pan':pan,'hitCandidates':hits})
   panel=p.locator('#area-add-panel');panel.locator('> summary').click() if not panel.evaluate('(e)=>e.open') else None;p.locator('#area-name').fill('독립 초기fit 보호 영역 '+str(w));p.locator('#area-note').fill('격리 합성 새 영역의 보기만 확인');stateBefore=x.state();beforeAdd=p.evaluate(SNAP);p.locator('#area-add').click();newState=x.state();newid=newState['space']['areas'][-1]['id'];added=p.evaluate(SNAP);p.locator('#area-panel-close').click();afterClose=p.evaluate(SNAP);p.set_viewport_size({'width':w+20,'height':h+20});p.wait_for_timeout(80);resized=p.evaluate(SNAP);rows.append({'viewport':[w,h],'id':'new-area-view-not-overwritten-by-initial-fit','pass':len(newState['space']['areas'])==len(stateBefore['space']['areas'])+1 and any(z['id']==newid and z['selected'] for z in added['cards']) and added['matrix']==afterClose['matrix']==resized['matrix'],'beforeAdd':beforeAdd,'afterAdd':added,'afterClose':afterClose,'afterNativeResize':resized,'newAreaId':newid,'nativeCreationActuallyChangedCamera':beforeAdd['matrix']!=added['matrix'],'scope':'Normal add UI; actual camera delta recorded, no invented requirement of nonzero auto-centering when new area is already in view; explicit locate/return is independently exercised in core4.'})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(not r['pass'] for r in rows)));(O/'result.json').write_text(json.dumps({'rows':rows,'expected':6,'executed':len(rows),'complete':len(rows)==6,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'fatal':fatal}));sys.exit(code)
