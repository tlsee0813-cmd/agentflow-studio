from pathlib import Path
import os,json,sys,traceback,hashlib
R=Path(__file__).parent;P=R.parent/'cycle20-independent';O=R/os.environ.get('CYCLE20_OUTPUT','focused');O.mkdir(exist_ok=True);os.environ['IDEA015_EVIDENCE_DIR']=str(O)
from helpers import H,UI,A
x=H();x.setUpClass();runs=[];isold=os.environ.get('CYCLE20_OLD')=='1'
try:
 for w,h in [(1280,720),(1440,900)]:
  for sample in (['powertoys'] if isold else ['powertoys','product13']):
   for scenario in (['no-file'] if isold else ['no-file','exact-file']):
    if scenario=='no-file' and sample!='powertoys':continue
    x.setUp();r={'viewport':[w,h],'sample':sample,'scenario':scenario,'checks':[],'console':[]};runs.append(r);u=UI(x,w,h,r);p=u.p;p.on('console',lambda z:r['console'].append({'type':z.type,'text':z.text}));m=json.loads((P/f'fixtures/{sample}-meta.json').read_text())
    try:
     response=p.reload();b=response.body();disk=A/'continuity/dist/public/index.html';r['HTTP']={'url':response.url,'status':response.status,'bytes':len(b),'bodySHA256':hashlib.sha256(b).hexdigest(),'diskSHA256':hashlib.sha256(disk.read_bytes()).hexdigest()};assert response.status==200 and b==disk.read_bytes()
     if scenario=='no-file':
      u.load(P/'fixtures/powertoys-legacy.json');before=x.state();p.locator('#map-fit').click();p.locator('#node-info-'+m['target']).click();u.reach('#panel-task-'+m['A']).click();u.reach('#task-report-pick-'+m['legacyReport']).click();u.disclose('task-report-path');text=p.locator('#task-report-path').inner_text();r['raw']={'exportBlockCount':p.locator('#task-report-export-work').count(),'pathText':text,'missingCount':p.locator('#task-report-context-missing').count(),'snapshot':u.snap(),'wholeSavedState':x.state()};u.ck('no-file-no-export-work-heading-or-inferred-H',r['raw']['exportBlockCount']==0 and '이 보고와 정확히 연결된 당시 자료 사본은 없어요. 현재 내용으로 대신하지 않아요.' in text and x.state()==before,r['raw']);u.ck('legacy-exact-T-not-export-H',p.locator('#task-pointed').get_attribute('data-report-task-id')==m['legacyReport'],u.snap())
      if not isold and w==1440:p.screenshot(path=str(O/'1440-legacy-neutral-missing-context.png'))
     else:
      u.load(P/f'fixtures/{sample}-draft.json');u.receive(P/f'fixtures/{sample}-plain.json');before=x.state();u.open_receipt();u.disclose('task-report-export-work');table=p.locator('#task-report-export-work [data-export-field]').evaluate_all('(es)=>Object.fromEntries(es.map(e=>[e.dataset.exportField,e.querySelector(".source-raw").textContent]))');u.ck('exact-file-H1-four-values-no-current-substitution',table==m['values']['H1'] and p.locator('#task-report-export-work').get_attribute('data-handoff-id')==m['H1']['returnId'] and x.state()==before,{'table':table,'expected':m['values']['H1'],'current':m['values']['CURRENT-A'],'snapshot':u.snap(),'blockText':p.locator('#task-report-export-work').inner_text()})
      if sample=='powertoys':
       u.reach('#task-report-export-work > summary').click();p.mouse.move(w-8,h/2);p.mouse.wheel(0,-400);p.screenshot(path=str(O/f'{w}-exact-report-reader.png'))
    except Exception:r['fatal']=traceback.format_exc()
    finally:
     r['pageerrors']=list(x.errors)
     try:x.tearDown()
     except Exception:r['cleanupError']=traceback.format_exc()
     (O/'result.json').write_text(json.dumps({'runs':runs},ensure_ascii=False,indent=2))
finally:x.tearDownClass()
expected=2 if isold else 6;code=int(len(runs)!=expected or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'sourceApp':str(A),'expectedRuns':expected,'executedRuns':len(runs),'runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'runs':len(runs),'fatal':[r.get('fatal') for r in runs if r.get('fatal')]}));sys.exit(code)
