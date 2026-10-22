from pathlib import Path
import os,sys,json,ast,traceback
R=Path(__file__).parent;A=R.parent/'cycle18-fix4-candidate/app';O=R/'extra-ui-key-observation';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
source=ast.parse((R/'ui.py').read_text());SNAP=next(ast.literal_eval(n.body[0].value.args[0]) for n in ast.walk(source) if isinstance(n,ast.FunctionDef) and n.name=='snap')
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();rows=[];fatal=None;m=json.loads((R/'fixtures/powertoys-meta.json').read_text());a=m['target']
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept()); keyEvents=[];p.on('console',lambda msg:keyEvents.append(json.loads(msg.text[10:])) if msg.text.startswith('KEY_PROBE:') else None)
  def snap():
   s=p.evaluate(SNAP);s['context']=p.locator('#nav-context').get_attribute('aria-expanded');s['anchor']=p.locator('#area-panel-body').evaluate('(b)=>[...b.querySelectorAll("[id]")].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().bottom>b.getBoundingClientRect().top&&e.getBoundingClientRect().top<b.getBoundingClientRect().bottom).map(e=>({id:e.id,rect:e.getBoundingClientRect().toJSON(),relativeTop:e.getBoundingClientRect().top-b.getBoundingClientRect().top})).slice(0,6)') if p.locator('#area-panel-body').count() else [];return s
  def rec(id,ok,raw):rows.append({'id':f'{w}-{id}','pass':bool(ok),'raw':raw})
  try:
   p.locator('#import-file').set_input_files(str(R/'fixtures/long.json'));expect(p.locator('#space-map')).to_be_visible();p.locator('#map-fit').click();p.locator(f'#node-info-{a}').click();p.locator('#panel-idea-full > summary').click();b=p.locator('#area-panel-body');q=b.bounding_box();p.mouse.move(q['x']+q['width']/2,q['y']+q['height']/2);p.mouse.wheel(0,280);p.wait_for_timeout(100);before=snap();p.locator('#nav-projects').click();p.locator('#project-list .project-open').first.click();reopened=snap();p.locator(f'#node-info-{a}').click();after=snap();rec('project-list-return-panel-reading',before['bodyTop']>0 and abs(before['bodyTop']-after['bodyTop'])<=2 and set(before['open'])==set(after['open']),{'before':before,'immediateProjectOpen':reopened,'afterExplicitSameAreaOpen':after,'selectionPolicy':'project card intentionally enters whole space; explicit same Area opened for reading comparison'});p.screenshot(path=str(O/f'{w}-list-return.png'))
   p.locator('#nav-context').click();p.locator('#nav-space').click();p.locator('#area-add-panel > summary').click() if not p.locator('#area-add-panel').evaluate('(e)=>e.open') else None
   p.evaluate('''()=>document.addEventListener('keydown',e=>{if(e.key==='Escape')console.debug('KEY_PROBE:'+JSON.stringify({target:e.target.id,isComposing:e.isComposing,defaultPrevented:e.defaultPrevented,key:e.key}))},true)''');field=p.locator('#area-name');field.fill('독립 미저장 이름');before=snap();field.press('Escape');after=snap();rec('input-Escape-context-and-focus',after['context']==before['context'] and after['focus']=='area-name' and field.input_value()=='독립 미저장 이름',{'before':before,'after':after,'value':field.input_value(),'eventObservations':list(keyEvents),'eventSource':'normal locator.press Escape on native input; no handler/event injection'})
   if p.locator('#nav-context').get_attribute('aria-expanded')!='true':p.locator('#nav-context').click();p.locator('#nav-space').click()
   field.focus();before=snap();cdp=x.ctx.new_cdp_session(p);cdp.send('Input.imeSetComposition',{'text':'한','selectionStart':1,'selectionEnd':1});p.keyboard.press('Escape');after=snap();rec('composition-Escape-context-and-focus',after['context']==before['context'] and after['focus']=='area-name',{'before':before,'after':after,'value':field.input_value(),'eventObservations':list(keyEvents),'scope':'Chromium protocol composition probe, not OS IME; no synthetic keyboard dispatch or app-state injection'});cdp.send('Input.imeSetComposition',{'text':'','selectionStart':0,'selectionEnd':0})
  finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
code=int(bool(fatal or any(not z['pass'] for z in rows)));(O/'result.json').write_text(json.dumps({'source':'73fd6ff82ca035dd9b2e74385ce9194db0b57791','rows':rows,'fatal':fatal,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[z['id'] for z in rows if not z['pass']],'fatal':fatal}));sys.exit(code)
