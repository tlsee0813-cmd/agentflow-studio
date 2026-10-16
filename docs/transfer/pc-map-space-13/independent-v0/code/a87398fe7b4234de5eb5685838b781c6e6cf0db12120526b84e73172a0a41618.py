from pathlib import Path
import os,sys,subprocess,json,datetime,hashlib
R=Path(__file__).parent;A=R.parent/'product13-candidate/app';O=R/'commands';O.mkdir(exist_ok=True);env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http',AI_MODE='mock',ALLOW_PAID_AI='false',PYTHONUTF8='1');rows=[]
cmds=[['npm','run','check'],['npm','run','build'],['node','continuity/scripts/check.mjs'],['node','continuity/scripts/build.mjs'],['/workspace/browser-env/venv/bin/python','continuity/tests/pc13_browser.py'],['/workspace/browser-env/venv/bin/python','continuity/tests/pc12_browser.py']]
for i,c in enumerate(cmds):
 e=env.copy();e['IDEA015_EVIDENCE_DIR']=str(O/f'{i+1}-outputs');start=datetime.datetime.now(datetime.timezone.utc).isoformat();log=O/f'{i+1}.log'
 with log.open('wb') as f:p=subprocess.run(c,cwd=A,env=e,stdout=f,stderr=subprocess.STDOUT)
 rows.append({'argv':c,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actual_child_returncode':p.returncode,'log':log.name,'sha256':hashlib.sha256(log.read_bytes()).hexdigest()});(O/'processes.json').write_text(json.dumps(rows,indent=2));print(i+1,p.returncode,flush=True)
 if i==3:(R/'build-ready').write_text('ready')
sys.exit(int(any(x['actual_child_returncode'] for x in rows)))
