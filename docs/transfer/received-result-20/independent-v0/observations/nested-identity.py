from pathlib import Path
import os,json,sys,traceback
R=Path(__file__).parent;O=R/'nested-identity';O.mkdir(exist_ok=True);os.environ['IDEA015_EVIDENCE_DIR']=str(O)
from helpers import H,UI,base,expect
x=H();x.setUpClass();runs=[];m=json.loads((R/'fixtures/nested-meta.json').read_text())
try:
 for w,h in [(1280,720),(1440,900)]:
  x.setUp();run={'viewport':[w,h],'checks':[]};runs.append(run);u=UI(x,w,h,run);p=u.p
  try:
   u.load(R/'fixtures/nested-project.json');before=x.state();rc=u.receive(R/'fixtures/nested-result.json');after=x.state();T=rc['receipt']['reportTaskId'];report=next(t for t in after['tasks'] if t['id']==T);u.ck('four-distinct-exact-identities-nested-report',len({m['root'],m['R0'],T,m['H']})==4 and rc['receipt']['requestTaskId']==m['root'] and rc['receipt']['exportTaskId']==m['R0'] and rc['receipt']['handoffId']==m['H'] and report['parentTaskId']==m['R0'] and after['currentTaskId']==m['B'] and after['draft']==before['draft'],{'receipt':rc,'actualNewReport':report,'expected':m});u.open_receipt();u.disclose('task-report-export-work');table=p.locator('#task-report-export-work [data-export-field]').evaluate_all('(es)=>Object.fromEntries(es.map(e=>[e.dataset.exportField,e.querySelector(".source-raw").textContent]))');u.ck('nested-snapshot-from-exact-exported-report-not-root',table==m['work'] and p.locator('#task-report-export-work').get_attribute('data-export-task-id')==m['R0'] and p.locator('#task-pointed').get_attribute('data-report-task-id')==T and x.state()==after,{'table':table,'snapshot':u.snap()});u.disclose('task-report-path');u.ck('recorded-nested-path-not-flattened','이전 보고에 연결된 보고' in p.locator('#task-report-path > summary').inner_text(),{'path':p.locator('#task-report-path').inner_text()});u.reach('#task-return-origin').click();u.ck('nested-read-B-draft-caller-return',u.snap()['focus']=='received-result-open' and x.state()==after,u.snap())
  except Exception:run['fatal']=traceback.format_exc()
  finally:
   run['pageerrors']=list(x.errors)
   try:x.tearDown()
   except Exception:run['cleanupError']=traceback.format_exc()
finally:x.tearDownClass()
code=int(len(runs)!=2 or any(r.get('fatal') or r.get('cleanupError') or r['pageerrors'] or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'source':'0aafca2708863036055cbd3029521b4eb983d22e','expectedRuns':2,'executedRuns':len(runs),'runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'failed':[(r['viewport'],c['id']) for r in runs for c in r['checks'] if not c['pass']],'fatals':[r.get('fatal') for r in runs if r.get('fatal')]}));sys.exit(code)
