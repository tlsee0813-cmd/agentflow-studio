from pathlib import Path
import os,sys,json,ast,traceback,hashlib
R=Path(__file__).parent;A=R.parent/'cycle20-candidate/app';O=R/'core';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
j=ast.parse((R.parent/'cycle19-fix1-independent/core.py').read_text());MAP=next(ast.literal_eval(n.value) for n in j.body if isinstance(n,ast.Assign) and any(isinstance(z,ast.Name) and z.id=='SNAP' for z in n.targets));j=ast.parse((R.parent/'cycle18-fix4-independent/ui.py').read_text());GEO=next(ast.literal_eval(n.body[0].value.args[0]) for n in ast.walk(j) if isinstance(n,ast.FunctionDef) and n.name=='geom')
SNAP=r'''()=>{const r=e=>e?.getBoundingClientRect().toJSON()??null,visible=e=>!!e&&e.checkVisibility({visibilityProperty:true});return {viewport:[innerWidth,innerHeight],windowY:scrollY,windowMax:document.documentElement.scrollHeight-innerHeight,docWidth:document.documentElement.scrollWidth,route:document.body.dataset.route,work:visible(document.getElementById('work-view')),task:visible(document.getElementById('task-view')),focus:document.activeElement.id,active:document.activeElement.outerHTML.slice(0,600),caller:r(document.getElementById('received-result-open')),contextTitle:r(document.getElementById('context-title')),receipt:document.getElementById('received-result-receipt')?{...document.getElementById('received-result-receipt').dataset}:null,receiptStatus:document.getElementById('received-result-status')?.textContent,pointed:document.getElementById('task-pointed')?{...document.getElementById('task-pointed').dataset}:null,open:[...document.querySelectorAll('main details[id][open]')].map(e=>e.id),returnControls:[...document.querySelectorAll('.origin-return')].filter(visible).map(e=>({id:e.id,text:e.textContent,rect:r(e)})),saving:document.documentElement.dataset.saving??null,saved:document.getElementById('saved').textContent,storageError:document.getElementById('storage-error').hidden?null:document.getElementById('storage-error').textContent}}'''
TEXT=r'''([sel,needle])=>{const e=document.querySelector(sel);if(!e)return {found:false};let n;const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);while(n=w.nextNode()){const i=n.data.indexOf(needle);if(i<0)continue;const g=document.createRange();g.setStart(n,i);g.setEnd(n,i+needle.length);const q=g.getBoundingClientRect(),h=document.elementFromPoint(q.x+q.width/2,q.y+q.height/2);return {found:true,rect:q.toJSON(),hit:!!h&&(h===e||e.contains(h)),visible:n.parentElement.checkVisibility({visibilityProperty:true}),text:needle}}return {found:false}}'''
class H(base.Browser):
 def runTest(self):pass
x=H();x.setUpClass();runs=[]
try:
 for cid in ['powertoys','product13']:
  m=json.loads((R/f'fixtures/{cid}-meta.json').read_text())
  for w,h in [(1280,720),(1440,900)]:
   for flow in ['draft-read','new-C']:
    x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});p.on('dialog',lambda d:d.accept());x.ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=x.url);run={'sample':cid,'viewport':[w,h],'flow':flow,'checks':[],'console':[]};runs.append(run);p.on('console',lambda msg:run['console'].append({'type':msg.type,'text':msg.text}));html=A/'continuity/dist/public/index.html';beforeHTTP=html.read_bytes();response=p.reload();b=response.body();run['firstExplicitHTTP']={'url':response.url,'status':response.status,'bytes':len(b),'httpSHA256':hashlib.sha256(b).hexdigest(),'diskBeforeSHA256':hashlib.sha256(beforeHTTP).hexdigest(),'diskAfterSHA256':hashlib.sha256(html.read_bytes()).hexdigest()};assert response.status==200 and b==beforeHTTP==html.read_bytes()
    def ck(id,ok,raw):run['checks'].append({'id':id,'pass':bool(ok),'raw':raw})
    def snap():return p.evaluate(SNAP)
    def geom(sel):return p.locator(sel).evaluate(GEO)
    def reach(sel):
     loc=p.locator(sel)
     for _ in range(80):
      q=loc.bounding_box()
      if q and q['y']>=8 and q['y']+q['height']<=h-12:
       g=geom(sel)
       if any(g['hits']):return loc
      if not q:raise AssertionError('not laid out: '+sel)
      delta=q['y']-20 if q['y']<8 else q['y']+q['height']-(h-25);p.mouse.move(w-8,h/2);p.mouse.wheel(0,max(-440,min(440,delta)));p.wait_for_timeout(50)
     raise AssertionError('native page wheel cannot expose '+sel)
    def disclose(id):
     q=p.locator('#'+id)
     if not q.evaluate('e=>e.open'):reach('#'+id+' > summary').click()
    def protect(old,new):
     return new['currentTaskId']==old['currentTaskId'] and all(new[k]==old[k] for k in ['draft','draftKind','bases']) and new['space']['draftTarget']==old['space']['draftTarget'] and all(new['space'][k]==old['space'][k] for k in ['areas','layout','relations','brief']) and all(next(t for t in new['tasks'] if t['id']==id)==next(t for t in old['tasks'] if t['id']==id) for id in [m['A'],m['B']])
    try:
     p.locator('#import-file').set_input_files(str(R/(f'fixtures/{cid}-'+('draft' if flow=='draft-read' else 'nodraft')+'.json')));expect(p.locator('#space-map')).to_be_visible();base.saved(p);p.locator('#map-fit').click();p.locator('#node-info-'+m['other']).click();edit=p.locator('#panel-edit');edit.locator('> summary').click() if not edit.evaluate('e=>e.open') else None
     body=p.locator('#area-panel-body');field=p.locator('#panel-note')
     for _ in range(30):
      q=field.bounding_box();bb=body.bounding_box()
      if q['y']>=bb['y'] and q['y']+q['height']<=bb['y']+bb['height']:break
      p.mouse.move(bb['x']+8,bb['y']+bb['height']/2);p.mouse.wheel(0,90 if q['y']>bb['y'] else -90);p.wait_for_timeout(30)
     buffer='[독립20 미저장 B 구상] '+cid;field.fill(buffer);p.locator('#map-zoom-out').click();mapBefore=p.evaluate(MAP);p.locator('#nav-work').click();disclose('compose-panel');disclose('result-file-panel');state0=x.state();count=len(state0['tasks']);beforeReceive=snap();reach('#select-result-file')
     with p.expect_file_chooser() as fc:p.locator('#select-result-file').click()
     fc.value.set_files(str(R/f'fixtures/{cid}-result.json'));reach('#accept-result-file').click();expect(p.locator('#received-result-open')).to_have_count(1);base.saved(p);received=x.state();added=[t for t in received['tasks'] if t['id'] not in {t['id'] for t in state0['tasks']}];assert len(added)==1;T=added[0]['id'];r=received['tasks'][-1];run['actualReportTaskId']=T
     ck('receive-exact-report-T-not-H-and-no-auto-reader',len(received['tasks'])==count+1 and T!=m['H1']['returnId'] and added[0]['parentTaskId']==m['A'] and snap()['work'] and not snap()['task'] and protect(state0,received),{'before':beforeReceive,'after':snap(),'actualNewTask':added[0],'beforeState':state0,'afterState':received});rc=snap()['receipt'];ck('receipt-exact-T-H-root-export-target',rc['reportTaskId']==T and rc['handoffId']==m['H1']['returnId'] and rc['requestTaskId']==m['A'] and rc['exportTaskId']==m['A'],rc)
     reach('#received-result-open');origin=snap();originGeom=geom('#received-result-open');ck('receipt-caller-actual-visible-hit',originGeom['full'] and all(originGeom['hits']),originGeom);p.locator('#received-result-open').click();expect(p.locator('#task-pointed')).to_have_attribute('data-report-task-id',T);ck('explicit-review-still-B-current-draft',x.state()==received,{'snapshot':snap(),'pointedText':p.locator('#task-pointed').inner_text()});samples={}
     for sel,needle in [('#task-view-idea .area-idea-text','[독립20 현재 사용자 구상]'),('#task-pointed .report-source[data-source-id="'+added[0]['sourceIds'][0]+'"] .report-lead',m['provenance']['report'][:12])]:
      z=p.evaluate(TEXT,[sel,needle]);g=geom(sel);z['ancestorGeometry']=g;q=z.get('rect',{});z['insideClip']=bool(q) and q['left']>=g['clip']['l']-.1 and q['right']<=g['clip']['r']+.1 and q['top']>=g['clip']['t']-.1 and q['bottom']<=g['clip']['b']+.1;samples[sel]=z
     ck('real-current-idea-and-report-text-visible-samples',all(z.get('visible') and z.get('hit') and z.get('insideClip') for z in samples.values()),samples)
     if cid=='powertoys' and flow=='draft-read':p.screenshot(path=str(O/f'{w}-received-report-and-current-idea.png'))
     disclose('task-report-export-work');historical=p.locator('#task-report-export-work [data-export-field]').evaluate_all('(es)=>Object.fromEntries(es.map(e=>[e.dataset.exportField,e.querySelector(".source-raw").textContent]))');ck('exact-H1-four-values-not-H2-or-current',historical==m['values']['H1'] and p.locator('#task-report-export-work').get_attribute('data-handoff-id')==m['H1']['returnId'],{'actual':historical,'H1':m['values']['H1'],'H2':m['values']['H2'],'currentA':m['values']['CURRENT-A']});disclose('task-view-work');current=p.locator('#task-view-work').inner_text();ck('current-work-labelled-separate',m['values']['CURRENT-A']['next'] in current and m['values']['CURRENT-A']['checks'] in current,{'currentText':current});reach('#task-return-origin').click();returned=snap();ck('same-B-work-origin-caller-before-help',returned['work'] and returned['focus']=='received-result-open' and abs(returned['caller']['y']-origin['caller']['y'])<=2 and x.state()==received,{'origin':origin,'returned':returned,'geometry':geom('#received-result-open')})
     # Reopen from the same real receipt. Draft-preserving action and actual new C are separate fixture contexts.
     reach('#received-result-open').click();expect(p.locator('#task-pointed')).to_have_attribute('data-report-task-id',T);label=p.locator('#task-next-action').inner_text();reach('#task-next-action').click()
     if flow=='draft-read':
      ck('next-action-opens-B-draft-never-clears-or-retargets', '작성 중인' in label and x.state()==received and p.locator('#draft').input_value()==m['draft'],{'label':label,'snapshot':snap(),'draftValue':p.locator('#draft').input_value()});reach('#work-return-origin').click();back=snap();ck('same-B-second-return-keeps-input-and-caller',back['focus']=='received-result-open' and x.state()==received,{'snapshot':back})
     else:
      ck('new-C-action-explicit-empty-target-A','새 요청' in label and x.state()['space']['draftTarget']=={'area':m['target']} and p.locator('#draft').input_value()=='',{'label':label,'state':x.state()});text='[독립20 실제 새 C · '+cid+'] 보고를 참고해 이 부분만 다음 확인한다. 수용·완료를 뜻하지 않는다.';reach('#draft').fill(text);reach('#send').click();expect(p.locator('#working')).to_have_text('');base.saved(p);new=x.state();C=new['currentTaskId'];ct=next(t for t in new['tasks'] if t['id']==C);src=next(s for s in new['sources'] if s['id']==ct['sourceIds'][0]);ck('real-C-count-id-kind-body-area',len(new['tasks'])==len(received['tasks'])+1 and C not in [m['A'],m['B'],T] and ct['areaId']==m['target'] and src['kind']=='request' and src['text']==text,{'task':ct,'source':src});disclose('file-return-options');reach('#copy-file-work').click();expect(p.locator('#notice')).to_contain_text('클립보드');clipboard=p.evaluate('navigator.clipboard.readText()');base.saved(p);new=x.state();export=next(t for t in new['tasks'] if t['id']==C)['handoffs'][-1];ck('actual-C-file-handoff',export['returnId'] in clipboard and text in clipboard and export['anchor']['areaId']==m['target'],{'clipboardRaw':clipboard,'record':export});reach('#work-return-origin').click();back=snap();ck('changed-C-return-stable-focus-no-rollback',back['work'] and back['focus']=='context-title' and x.state()==new and new['currentTaskId']==C and geom('#context-title')['full'],{'snapshot':back,'contextTitleGeometry':geom('#context-title'),'newTask':C})
     p.locator('#nav-space').click();mapAfter=p.evaluate(MAP);ck('map-view-camera-world-selection-retained',mapAfter['matrix']==mapBefore['matrix'] and [(c['id'],c['x'],c['y'],c['selected']) for c in mapAfter['cards']]==[(c['id'],c['x'],c['y'],c['selected']) for c in mapBefore['cards']] and mapAfter['folds']==mapBefore['folds'],{'before':mapBefore,'after':mapAfter});ck('B-unsaved-area-buffer-survives',p.locator('#panel-note').input_value()==buffer,{'value':p.locator('#panel-note').input_value(),'map':mapAfter})
    except Exception:run['fatal']=traceback.format_exc()
    finally:
     run['pageerrors']=list(x.errors);run['externalRequests']=list(x.external)
     try:x.tearDown()
     except Exception:run['cleanupError']=traceback.format_exc()
     (O/'result.json').write_text(json.dumps({'source':'0aafca2708863036055cbd3029521b4eb983d22e','runs':runs},ensure_ascii=False,indent=2))
finally:x.tearDownClass()
code=int(len(runs)!=8 or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'source':'0aafca2708863036055cbd3029521b4eb983d22e','expectedRuns':8,'executedRuns':len(runs),'complete':len(runs)==8,'runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failures':[(r['sample'],r['viewport'],r['flow'],c['id']) for r in runs for c in r['checks'] if not c['pass']],'fatals':[(r['sample'],r['viewport'],r['flow'],r.get('fatal')) for r in runs if r.get('fatal')]}));sys.exit(code)
