from pathlib import Path
import os,sys,json,ast,traceback
R=Path(__file__).parent;A=R.parent/'cycle18-fix4-candidate/app';O=R/'long-ui';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
source=ast.parse((R/'ui.py').read_text());SNAP=next(ast.literal_eval(n.body[0].value.args[0]) for n in ast.walk(source) if isinstance(n,ast.FunctionDef) and n.name=='snap');GEO=next(ast.literal_eval(n.body[0].value.args[0]) for n in ast.walk(source) if isinstance(n,ast.FunctionDef) and n.name=='geom')
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();rows=[];fatal=None;m=json.loads((R/'fixtures/powertoys-meta.json').read_text());a,b=m['target'],m['other']
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept())
  def snap():return p.evaluate(SNAP)
  def rec(id,ok,raw):rows.append({'id':f'{w}-{id}','pass':bool(ok),'raw':raw})
  def controls(label):
   g={sel:p.locator(sel).evaluate(GEO) for sel in ['#area-panel-close','#panel-open','#panel-new-request']};s=snap();rec(label,all(v['full'] and all(v['hits']) for v in g.values()) and s['docWidth']<=w and s['head']['bottom']<=s['body']['y']+1 and s['body']['bottom']<=s['actions']['y']+1,{'geometry':g,'snapshot':s})
  def approach(loc):
   body=p.locator('#area-panel-body')
   for _ in range(90):
    q=loc.bounding_box();v=body.bounding_box()
    if q and q['y']>=v['y']+2 and q['y']+q['height']<=v['y']+v['height']-2:return
    p.mouse.move(v['x']+v['width']/2,v['y']+v['height']/2);p.mouse.wheel(0,90 if q and q['y']>v['y']+v['height']/2 else -90);p.wait_for_timeout(30)
   raise AssertionError('native long body cannot approach '+str(loc))
  try:
   p.locator('#import-file').set_input_files(str(R/'fixtures/long.json'));expect(p.locator('#space-map')).to_be_visible();p.locator('#map-fit').click();p.locator(f'#node-info-{a}').click();controls('long-title-path-note-fixed-actions');title=p.locator('.panel-top').evaluate(GEO);rec('title-and-path-no-horizontal-clipping',title['full'] and all(title['hits']),{'title':title,'headText':p.locator('.panel-top').inner_text(),'nameLength':len(next(z['name'] for z in x.state()['space']['areas'] if z['id']==a)),'noteLength':len(next(z['note'] for z in x.state()['space']['areas'] if z['id']==a))})
   idea=p.locator('#panel-idea-full');approach(idea.locator(':scope > summary'));idea.locator(':scope > summary').click();body=p.locator('#area-panel-body');before=snap();box=body.bounding_box();p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);p.mouse.wheel(0,320);p.wait_for_timeout(100);reading=snap();rec('real-body-wheel-not-map-or-page',reading['bodyTop']>before['bodyTop'] and reading['matrix']==before['matrix'] and reading['windowY']==before['windowY'],{'before':before,'after':reading});controls('actions-remain-visible-after-body-wheel');p.locator('#area-panel-close').click();closed=snap();rec('close-clears-selection-focus-card-not-camera',closed['focus']==f'node-info-{a}' and closed['matrix']==reading['matrix'] and not any(z['selected'] for z in closed['cards']),closed);p.locator(f'#node-info-{b}').click();p.locator('#area-panel-close').click();p.locator(f'#node-info-{a}').click();back=snap();rec('A-B-A-internal-read-and-open-kept',abs(back['bodyTop']-reading['bodyTop'])<=2 and 'panel-idea-full' in back['open'],{'before':reading,'after':back});
   edit=p.locator('#panel-edit');approach(edit.locator(':scope > summary'));edit.locator(':scope > summary').click();field=p.locator('#panel-note');approach(field);field.fill('[독립 미저장] 긴 패널 입력 보존');field.press('Escape');rec('editable-Escape-does-not-close',body.is_visible() and field.input_value()=='[독립 미저장] 긴 패널 입력 보존',{'snapshot':snap(),'text':field.input_value()})
   ime={'scope':'Chromium CDP composition input probe, not an OS Korean IME/user study'}
   try:
    field.press('End');cdp=x.ctx.new_cdp_session(p);cdp.send('Input.imeSetComposition',{'text':'한','selectionStart':1,'selectionEnd':1});p.keyboard.press('Escape');ime.update(supported=True,panelPresent=body.is_visible(),value=field.input_value());cdp.send('Input.imeSetComposition',{'text':'','selectionStart':0,'selectionEnd':0});rec('composition-probe-keeps-panel',body.is_visible(),ime)
   except Exception as e:rows.append({'id':f'{w}-composition-probe','status':'NOT_RUN','error':str(e),'scope':ime['scope']})
   value=field.input_value();p.locator('#area-panel-close').click();p.locator(f'#node-info-{a}').click();rec('unsaved-buffer-after-close-reopen',p.locator('#panel-note').input_value()==value,{'before':value,'after':p.locator('#panel-note').input_value()});p.locator('#panel-skip-actions').focus();p.keyboard.press('Enter');rec('skip-actions-actual-keyboard-target',p.evaluate('document.activeElement.id')=='panel-open',snap());body.focus();p.keyboard.press('Escape');rec('body-Escape-closes-focus-card',p.locator('#area-panel').count()==0 and p.evaluate('document.activeElement.id')==f'node-info-{a}',snap())
   if w==1280:
    p.locator(f'#node-info-{a}').click();p.screenshot(path=str(O/'1280-long-panel-fixed-actions.png'));p.locator('#import-file').set_input_files(str(R/'fixtures/overlap.json'));expect(p.locator('#space-map')).to_be_visible();p.locator('#map-fit').click();group=p.locator(f'.containment-group[data-parent-id="{m["parent"]}"]');raw=group.evaluate('(e)=>({omitted:e.dataset.frameOmitted,frames:[...e.querySelectorAll(".containment-frame")].map(x=>x.getBoundingClientRect().toJSON()),links:e.querySelectorAll(".containment-links").length,text:e.textContent})');other=p.locator(f'.area-node[data-area-id="{b}"]').evaluate(GEO);rec('non-descendant-in-bounding-box-no-false-frame',raw['omitted']=='true' and not raw['frames'] and raw['links']>0 and all(other['hits']),{'group':raw,'nonDescendant':other,'state':snap()});p.screenshot(path=str(O/'1280-non-descendant-frame-fallback.png'))
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(z.get('pass') is False for z in rows)));(O/'result.json').write_text(json.dumps({'source':'73fd6ff82ca035dd9b2e74385ce9194db0b57791','rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[z['id'] for z in rows if z.get('pass') is False],'fatal':fatal}));sys.exit(code)
