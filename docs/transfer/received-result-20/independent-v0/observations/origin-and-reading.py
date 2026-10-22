from pathlib import Path
import os,json,traceback,sys
R=Path(__file__).parent;O=R/'origin-and-reading';O.mkdir(exist_ok=True);os.environ['IDEA015_EVIDENCE_DIR']=str(O)
from helpers import H,UI,base,expect,MAP,TEXT
x=H();x.setUpClass();runs=[];m=json.loads((R/'fixtures/powertoys-meta.json').read_text())
try:
 for w,h in [(1280,720),(1440,900)]:
  for scenario in ['records-reader-owner-back','located-only-work-slot']:
   x.setUp();run={'viewport':[w,h],'scenario':scenario,'checks':[]};runs.append(run);u=UI(x,w,h,run);p=u.p
   try:
    u.load(R/'fixtures/powertoys-nodraft.json');rc=u.receive(R/'fixtures/powertoys-plain.json');T=rc['receipt']['reportTaskId'];p.locator('#nav-space').click();p.locator('#map-fit').click();p.locator('#node-info-'+m['other']).click();p.locator('#map-zoom-out').click()
    if scenario=='records-reader-owner-back':
     p.locator('#check-summary').click();id='check-open-'+T;u.reach('#'+id);before=p.evaluate(MAP);state=x.state();a=p.locator('#'+id).evaluate('e=>({rect:e.getBoundingClientRect().toJSON(),relativeY:e.getBoundingClientRect().y-document.getElementById("area-panel-body").getBoundingClientRect().y})');p.locator('#'+id).click();expect(p.locator('#task-pointed')).to_have_attribute('data-report-task-id',T);u.reach('#task-view-find-area').click();located=p.evaluate(MAP);u.ck('report-explicit-owner-is-exact-A',next(c for c in located['cards'] if c['selected'])['id']==m['target'] and p.locator('#locate-return').count()==1,located);u.reach('#locate-return').click();after=p.evaluate(MAP);back=p.locator('#'+id).evaluate('e=>({rect:e.getBoundingClientRect().toJSON(),relativeY:e.getBoundingClientRect().y-document.getElementById("area-panel-body").getBoundingClientRect().y})');u.ck('original-records-caller-camera-reading-back-before-help',after['mode']=='records' and after['focus']==id and after['matrix']==before['matrix'] and after['folds']==before['folds'] and abs(back['relativeY']-a['relativeY'])<=2 and x.state()==state,{'before':before,'callerBefore':a,'after':after,'callerAfter':back})
    else:
     p.locator('#map-relations-open').click();rel=next(r for r in m['expectedRelations'] if r['from']==m['target']);id='relation-from-'+rel['id'];u.reach('#'+id);S=p.evaluate(MAP);p.locator('#'+id).click();expect(p.locator('#area-panel-body')).to_have_attribute('data-area-id',m['target']);u.reach('#panel-new-request').click();u.work();before=u.snap();beforeState=x.state();u.ck('actual-located-only-slot-current-B-not-fake-new-task',beforeState['currentTaskId']==m['B'] and beforeState['draft']=='' and p.locator('#work-locate-return').count()==1 and p.locator('#work-return-origin').count()==0,before);u.open_receipt();u.reach('#task-return-origin').click();restored=u.snap();u.ck('work-slot-restores-one-locate-no-self-return-ghost',restored['work'] and p.locator('#work-locate-return').count()==1 and p.locator('#work-return-origin').count()==0 and x.state()==beforeState,{'before':before,'after':restored});u.reach('#work-locate-return').click();back=p.evaluate(MAP);u.ck('one-locationback-restores-original-space-S',back['mode']==S['mode'] and back['matrix']==S['matrix'] and back['focus']==id and [c['id'] for c in back['cards'] if c['selected']]==[c['id'] for c in S['cards'] if c['selected']] and p.locator('#locate-return').count()==0 and x.state()==beforeState,{'S':S,'back':back});
     if w==1440:p.screenshot(path=str(O/'1440-one-locationback-space-S.png'))
   except Exception:run['fatal']=traceback.format_exc()
   finally:
    run['pageerrors']=list(x.errors)
    try:x.tearDown()
    except Exception:run['cleanupError']=traceback.format_exc()
    (O/'result.json').write_text(json.dumps({'runs':runs},ensure_ascii=False,indent=2))
 # One long report at each PC size plus mobile minimum. Opening the fold is real, tail reached by native wheel.
 for w,h in [(1280,720),(1440,900),(390,844)]:
  x.setUp();run={'viewport':[w,h],'scenario':'long-report-and-mobile-minimum','checks':[]};runs.append(run);u=UI(x,w,h,run);p=u.p
  try:
   u.load(R/'fixtures/powertoys-draft.json');f={**m['plain'],'report':'[합성20 긴 보고] '+('현재 구상과 당시 작업문은 서로 다르다. 실제 실행이나 수용을 주장하지 않는다.\n'*45)+'원문마지막조건-20-END','evidence':None};path=O/f'{w}-long-result.json';path.write_text(json.dumps(f,ensure_ascii=False));r=u.receive(path);state=x.state();u.open_receipt();sid=next(t for t in state['tasks'] if t['id']==r['receipt']['reportTaskId'])['sourceIds'][0];full='task-report-src-'+sid;u.ck('initial-reader-action-and-no-horizontal-overflow',u.geom('#task-next-action')['full'] and all(u.geom('#task-next-action')['hits']) and p.evaluate('document.documentElement.scrollWidth<=innerWidth'),{'snapshot':u.snap(),'action':u.geom('#task-next-action')});u.disclose(full);sel='#'+full+' .source-raw';trail=[]
   for _ in range(45):
    z=p.evaluate(TEXT,[sel,'원문마지막조건-20-END']);trail.append(z)
    if z.get('rect') and z['rect']['top']>=8 and z['rect']['bottom']<=h-8 and z.get('hit'):break
    p.mouse.move(w-8,h/2);p.mouse.wheel(0,350 if not z.get('rect') or z['rect']['bottom']>h-8 else -250);p.wait_for_timeout(55)
   u.ck('native-wheel-actual-long-source-tail',z.get('hit') and z['rect']['top']>=8 and z['rect']['bottom']<=h-8,{'tail':z,'wheelObservations':trail,'snapshot':u.snap()});u.disclose(full,False);hidden=p.locator(sel).evaluate('e=>({checkVisible:e.checkVisibility({visibilityProperty:true}),rects:e.getClientRects().length,rect:e.getBoundingClientRect().toJSON()})');u.ck('closed-source-fold-really-hidden',not hidden['checkVisible'] and hidden['rects']==0,hidden);u.reach('#task-return-origin').click();u.ck('reader-exits-DOM-and-B-draft-saved-preserved',p.locator('#task-pointed').count()==0 and x.state()==state and u.snap()['focus']=='received-result-open',u.snap())
  except Exception:run['fatal']=traceback.format_exc()
  finally:
   run['pageerrors']=list(x.errors)
   try:x.tearDown()
   except Exception:run['cleanupError']=traceback.format_exc()
finally:x.tearDownClass()
code=int(len(runs)!=7 or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'source':'0aafca2708863036055cbd3029521b4eb983d22e','expectedRuns':7,'executedRuns':len(runs),'runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[(r['viewport'],r['scenario'],c['id']) for r in runs for c in r['checks'] if not c['pass']],'fatals':[(r['viewport'],r['scenario'],r.get('fatal')) for r in runs if r.get('fatal')]}));sys.exit(code)
