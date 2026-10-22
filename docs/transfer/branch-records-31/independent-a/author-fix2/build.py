from pathlib import Path
import subprocess,os,datetime,json,hashlib,sys
r=Path(__file__).parent;env=os.environ.copy();env['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'];rows=[]
for name in ['candidate','base']:
 out=r/name/'build-logs';out.mkdir(exist_ok=True)
 for label,cmd in [('typecheck',['tsc','--noEmit','-p','continuity/tsconfig.json']),('build-root',['node','scripts/build.mjs']),('build-continuity',['node','continuity/scripts/build.mjs'])]:
  s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,cwd=r/name/'app',env=env,capture_output=True)
  for stream,b in [('stdout',p.stdout),('stderr',p.stderr)]:(out/(label+'.'+stream+'.log')).write_bytes(b)
  rows.append({'source':name,'label':label,'command':cmd,'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'exit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()})
  print(name,label,p.returncode,flush=True)
(r/'build-process.json').write_text(json.dumps(rows,indent=2));sys.exit(int(any(x['exit'] for x in rows)))
