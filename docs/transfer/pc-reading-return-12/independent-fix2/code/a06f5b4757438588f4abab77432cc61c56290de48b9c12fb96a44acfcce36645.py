from pathlib import Path
import subprocess,os,sys,json,datetime,hashlib
R=Path(__file__).parent;A=R.parent/'product12-candidate-fix2/app';O=R/'regressions';O.mkdir(exist_ok=True);env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http',AI_MODE='mock',ALLOW_PAID_AI='false',PYTHONUTF8='1',PYTHONIOENCODING='utf-8')
cmds=[['npm','run','check'],['npm','run','build'],['node','continuity/scripts/check.mjs'],['node','continuity/scripts/build.mjs'],['node','--test',*[str(p.relative_to(A)) for p in sorted((A/'continuity/tests').glob('*.test.mjs'))]],*[['/workspace/browser-env/venv/bin/python',f'continuity/tests/{name}_browser.py'] for name in ['pc12','spatial102','flow090']],['node','continuity/scripts/build-static.mjs']];result=[]
for i,cmd in enumerate(cmds):
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();e=env.copy();e['IDEA015_EVIDENCE_DIR']=str(O/f'{i+1}-outputs');log=O/f'{i+1}.log'
 with log.open('wb') as f:p=subprocess.run(cmd,cwd=A,env=e,stdout=f,stderr=subprocess.STDOUT)
 result.append({'argv':cmd,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actual_child_returncode':p.returncode,'log':log.name,'log_sha256':hashlib.sha256(log.read_bytes()).hexdigest()});(O/'processes.json').write_text(json.dumps(result,indent=2));print(i+1,p.returncode,flush=True)
exitcode=int(any(x['actual_child_returncode'] for x in result));(O/'collector-planned-exit.json').write_text(json.dumps({'exit':exitcode}));sys.exit(exitcode)
