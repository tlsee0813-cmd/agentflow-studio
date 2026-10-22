from pathlib import Path
import subprocess,os,json,datetime,hashlib,sys
R=Path(__file__).parent;A=R.parent/'cycle23-candidate/app';env=os.environ.copy();env['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'];rows=[]
for name,cmd in [('type-check',['node','continuity/scripts/check.mjs']),('build',['node','continuity/scripts/build.mjs']),('description23-unit',['node','--test','continuity/tests/description23.test.mjs'])]:
 s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,cwd=A,env=env,capture_output=True);(R/f'{name}.stdout.log').write_bytes(p.stdout);(R/f'{name}.stderr.log').write_bytes(p.stderr);rows.append({'name':name,'command':cmd,'cwd':str(A),'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()});print(name,p.returncode,flush=True)
(R/'commands.json').write_text(json.dumps(rows,indent=2));sys.exit(0 if all(x['actualChildExit']==0 for x in rows) else 1)
