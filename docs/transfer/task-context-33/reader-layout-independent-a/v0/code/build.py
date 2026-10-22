from pathlib import Path
import subprocess,os,datetime,json,hashlib,sys
r=Path(__file__).parent;a=r/'candidate/app';env=os.environ.copy();env['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'];rows=[]
for label,cmd in [('typecheck',['tsc','--noEmit','-p','continuity/tsconfig.json']),('build-root',['node','scripts/build.mjs']),('build-continuity',['node','continuity/scripts/build.mjs'])]:
 s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,cwd=a,env=env,capture_output=True)
 for stream,b in [('stdout',p.stdout),('stderr',p.stderr)]:(r/(label+'.'+stream+'.log')).write_bytes(b)
 rows.append({'label':label,'command':cmd,'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()})
(r/'build-process.json').write_text(json.dumps(rows,indent=2));sys.exit(int(any(x['exit'] for x in rows)))
