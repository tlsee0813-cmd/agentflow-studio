from pathlib import Path
import os,sys,json,ast,traceback,hashlib
R=Path(__file__).parent;A=R.parent/'cycle19-fix1-candidate/app';O=R/'purpose-event-ready';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
c=ast.parse((R/'core.py').read_text());SNAP=next(ast.literal_eval(n.value) for n in c.body if isinstance(n,ast.Assign) and any(isinstance(z,ast.Name) and z.id=='SNAP' for z in n.targets));t=ast.parse((R.parent/'cycle18-fix4-independent/ui.py').read_text());GEO=next(ast.literal_eval(n.body[0].value.args[0]) for n in ast.walk(t) if isinstance(n,ast.FunctionDef) and n.name=='geom')
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();runs=[];m=json.loads((R/'fixtures/powertoys-meta.json').read_text());a=m['target'];ra=m['reportA'];rb=m['reportB']
try:
 for w,h in [(1280,720),(1440,900)]:
  for scenario in ['purpose-menu']:
   x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept());run={'viewport':[w,h],'scenario':scenario,'checks':[]};runs.append(run)
   def snap():return p.evaluate(SNAP)
   def ck(id,ok,raw):run['checks'].append({'id':id,'pass':bool(ok),'raw':raw})
   def geom(sel):return p.locator(sel).evaluate(GEO)
   def approach(loc):
    for _ in range(100):
     q=loc.bounding_box();v=p.locator('#area-panel-body').bounding_box()
     if q and q['y']>=v['y']+2 and q['y']+q['height']<=v['y']+v['height']-2:return
     p.mouse.move(v['x']+v['width']/2,v['y']+v['height']/2);p.mouse.wheel(0,90 if q and q['y']>v['y']+v['height']/2 else -90);p.wait_for_timeout(20)
    raise AssertionError('native body wheel cannot expose '+str(loc))
   def load(name):p.locator('#import-file').set_input_files(str(R/'fixtures'/name));expect(p.locator('#space-map')).to_be_visible();base.saved(p)
   def ownerA():
    p.locator('#check-summary').click();q=p.locator('#check-area-'+ra['report']);approach(q);q.click();expect(p.locator('#area-panel-body')).to_have_attribute('data-area-id',a)
   try:
    if scenario=='fallback':
     load('powertoys-many.json');before=x.state();ownerA();p.locator('#panel-new-request').click();text='[독립 합성19 fallback] 이 보고에서 실제 새 요청';p.locator('#draft').fill(text);p.locator('#send').click();expect(p.locator('#working')).to_have_text('');new=x.state();tid=new['currentTaskId'];p.locator('#work-locate-return').click();s=snap();notice=geom('#records-return-notice');ck('gone-row-honest-fixedhead-fallback',s['mode']=='records' and s['focus']=='records-heading' and p.locator('#check-open-'+ra['report']).count()==0 and p.locator('#check-area-'+ra['report']).count()==0 and notice['full'] and all(notice['hits']),{'snapshot':s,'noticeGeometry':notice,'noticeText':p.locator('#records-return-notice').inner_text()});ck('original-report-source-and-new-work-preserved',next(t for t in new['tasks'] if t['id']==ra['report'])==next(t for t in before['tasks'] if t['id']==ra['report']) and len(new['tasks'])==len(before['tasks'])+1 and x.state()['currentTaskId']==tid,{'before':before,'after':new,'returnState':x.state()});p.locator('#branch-toggle-'+m['parent']).click();g=geom('#records-return-notice');ck('fallback-notice-survives-followup-render',not p.locator('#records-return-notice').is_hidden() and g['full'] and all(g['hits']) and p.locator('#check-open-'+ra['report']).count()==0,{'snapshot':snap(),'geometry':g});
     if w==1280:p.screenshot(path=str(O/'1280-gone-record-fixedhead.png'))
    elif scenario=='new-search':
     load('powertoys-many.json');p.locator('#node-info-'+a).click();ed=p.locator('#panel-edit');approach(ed.locator('> summary'));ed.locator('> summary').click();field=p.locator('#panel-note');approach(field);draft='[A 미저장19] B 기록과 섞이지 않는다';field.fill(draft);saved=x.state()
     for reset in ['normal-other-info','sidenav','explicit-records']:
      ownerA()
      if reset=='normal-other-info':
       p.locator('#map-fit').click();p.locator('#node-info-'+rb['area']).click();q=p.locator('#panel-task-'+rb['request']);approach(q);q.click();expect(p.locator('#task-view')).to_be_visible();p.locator('#task-report-pick-'+rb['report']).click();p.locator('#task-return-origin').click();s=snap();ok=s['mode']=='area' and s['bodyId']==rb['area'] and s['focus']=='panel-task-'+rb['request']
      else:
       if reset=='sidenav':p.locator('#nav-work').click();p.locator('#nav-space').click()
       p.locator('#check-summary').click();q=p.locator('#check-open-'+rb['report']);approach(q);q.click();expect(p.locator('#task-view')).to_be_visible();picked=p.locator('#task-report-pick-'+rb['report']).get_attribute('aria-pressed');p.locator('#task-return-origin').click();s=snap();ok=s['mode']=='records' and s['focus']=='check-open-'+rb['report'] and picked=='true'
      ck('new-search-not-bound-to-old-R1-'+reset,ok and x.state()==saved,{'snapshot':s,'B':rb,'oldA':ra})
     p.locator('#map-fit').click();p.locator('#node-info-'+a).click();approach(p.locator('#panel-note'));ck('A-edit-buffer-after-B-new-search',p.locator('#panel-note').input_value()==draft,{'recordAnchorBefore':recordAnchor,'recordAnchorAfter':p.locator('#'+recordAnchor['id']).bounding_box(),'snapshot':snap()})
    else:
     load('long.json');p.locator('#node-info-'+a).click();ed=p.locator('#panel-edit');approach(ed.locator('> summary'));ed.locator('> summary').click();field=p.locator('#panel-note');approach(field);draft='[미저장 구상19] 목적 읽기 때문에 지우지 않는다';field.fill(draft);state=x.state();p.locator('#check-summary').click();recbody=p.locator('#area-panel-body');q=recbody.bounding_box();p.mouse.move(q['x']+q['width']/2,q['y']+q['height']/2);p.mouse.wheel(0,280);p.wait_for_timeout(350);before=snap();recordAnchor=p.locator('#check-list').evaluate('e=>{const b=e.closest(".panel-body").getBoundingClientRect();return [...e.querySelectorAll("button")].filter(n=>{const r=n.getBoundingClientRect();return r.top>=b.top&&r.bottom<=b.bottom}).map(n=>({id:n.id,rect:n.getBoundingClientRect().toJSON()}))[0]}');ck('records-native-nonzero-before-purpose',before['mode']=='records' and before['bodyTop']>0,{'snapshot':before,'anchor':recordAnchor});p.locator('#brief-read').click();expect(p.locator('#project-read')).to_be_visible();body=p.locator('#project-read-body');body.focus();p.keyboard.press('End');p.wait_for_timeout(400);wheelSteps=[]
     for _ in range(15):
      scroll=body.evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight})');wheelSteps.append(scroll)
      if scroll['max']-scroll['top']<1:break
      box=body.bounding_box();p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);p.mouse.wheel(0,900);p.wait_for_timeout(180)
     run['purposeNativeEndWheelSteps']=wheelSteps;text=p.locator('#project-read-purpose').inner_text();tail=p.locator('#project-read-purpose').evaluate('e=>{const n=e.firstChild,r=document.createRange();r.setStart(n,Math.max(0,n.length-20));r.setEnd(n,n.length);const q=r.getBoundingClientRect(),b=document.getElementById("project-read-body").getBoundingClientRect(),h=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return {rect:q.toJSON(),body:b.toJSON(),inside:q.top>=b.top&&q.bottom<=b.bottom,hit:!!h&&(h===e||e.contains(h)),scroll:document.getElementById("project-read-body").scrollTop,max:document.getElementById("project-read-body").scrollHeight-document.getElementById("project-read-body").clientHeight}}');ck('bounded-full-purpose-real-tail-access',text==state['space']['brief']['text'] and text.endswith('목적의 마지막 조건-끝19') and tail['inside'] and tail['hit'],{'text':text,'tail':tail});p.locator('#project-read-close').click();after=snap();ck('purpose-close-caller-camera-scroll-draft-saved-unchanged',after['focus']=='brief-read' and after['matrix']==before['matrix'] and after['windowY']==before['windowY'] and after['mode']==before['mode'] and abs(after['bodyTop']-before['bodyTop'])<1 and after['cards']==before['cards'] and x.state()==state,{'before':before,'after':after,'recordAnchorBefore':recordAnchor,'recordAnchorAfter':p.locator('#'+recordAnchor['id']).bounding_box()});p.locator('#brief-read').click();p.keyboard.press('Escape');ck('purpose-Escape-close-same-caller',p.locator('#project-read').is_hidden() and p.evaluate('document.activeElement.id')=='brief-read',snap());
     edit=p.locator('#brief-edit');edit.locator('> summary').click();inline=snap();ck('inline-purpose-edit-distinct-from-reading',p.locator('#brief-edit-text').input_value()==state['space']['brief']['text'],{'readingMap':before['map'],'inlineEditMap':inline['map'],'actualHeightDelta':inline['map']['height']-before['map']['height']});edit.locator('> summary').click();menu=p.locator('#project-management');menu.locator('> summary').click() if not menu.evaluate('(e)=>e.open') else None;access={k:geom(k) for k in ['#backup','#import']};
     with p.expect_download() as dl:p.locator('#backup').click()
     path=O/(str(w)+'-menu-backup.json');dl.value.save_as(path);ck('project-menu-existing-backup-import-access',all(g['full'] and all(g['hits']) for g in access.values()) and path.stat().st_size>0,{'controls':access,'backupSHA256':hashlib.sha256(path.read_bytes()).hexdigest()});
     menu.locator('> summary').click() if not menu.evaluate('(e)=>e.open') else None
     with p.expect_file_chooser() as fc:p.locator('#import').click()
     ck('project-menu-import-opens-real-filechooser',fc.value is not None,{'chooserObserved':True});p.locator('#map-area-open').click();approach(p.locator('#panel-note'));ck('A-unsaved-after-records-purpose',p.locator('#panel-note').input_value()==draft,{'value':p.locator('#panel-note').input_value()});p.locator('#nav-projects').click();card=p.locator('#project-list .project-card').filter(has=p.locator('.project-card-name',has_text=state['name'])).first;card.locator('.project-more-button').click();card.locator('.project-read-open').click();expect(p.locator('#project-read')).to_be_visible();ck('home-full-title-purpose-reuses-dialog',p.locator('#project-read-name').inner_text()==state['name'] and p.locator('#project-read-purpose').inner_text()==state['space']['brief']['text'],{'title':p.locator('#project-read-name').inner_text(),'purpose':p.locator('#project-read-purpose').inner_text()});homeCloseEvents=[];p.expose_binding('observeHomeCloseReady',lambda source,value:homeCloseEvents.append(value));p.locator('#project-read').evaluate("e=>e.addEventListener('close',event=>window.observeHomeCloseReady({isTrusted:event.isTrusted,timeStamp:event.timeStamp,performanceNow:performance.now(),focus:document.activeElement.outerHTML,windowY:scrollY}),{once:true})");p.locator('#project-read-close').click()
     import time
     deadline=time.monotonic()+5
     while not homeCloseEvents:
      if time.monotonic()>deadline:raise AssertionError('native Home close event after app handler not observed')
      p.wait_for_timeout(10)
     run['homeCloseReadinessEvent']=homeCloseEvents[0];ck('home-dialog-close-original-more-focus','project-more-button' in p.evaluate('document.activeElement.className'),{'focus':p.evaluate('document.activeElement.outerHTML'),'windowY':p.evaluate('scrollY')})
   except Exception:run['fatal']=traceback.format_exc()
   finally:
    run['pageerrors']=list(x.errors)
    try:x.tearDown()
    except Exception:run['cleanupError']=traceback.format_exc()
    (O/'result.json').write_text(json.dumps({'runs':runs},ensure_ascii=False,indent=2))
finally:x.tearDownClass()
code=int(len(runs)!=2 or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'source':'acfafd2dd6426e3fa6fa5443bd2e67d8461608c9','expectedRuns':2,'executedRuns':len(runs),'runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[(r['viewport'],r['scenario'],c['id']) for r in runs for c in r['checks'] if not c['pass']],'fatals':[(r['viewport'],r['scenario'],r.get('fatal')) for r in runs if r.get('fatal')]}));sys.exit(code)
