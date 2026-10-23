from pathlib import Path
import subprocess,os,hashlib,json,datetime,sys
r=Path(__file__).parent;app=Path(os.environ['BASELINE_APP']);out=r/'generated';env=os.environ.copy();env['PATH']=os.environ['TOOLCHAIN_BIN']+':'+env['PATH'];rows=[]
commands=[('typecheck',['tsc','--noEmit','-p','continuity/tsconfig.json'],app),('generate',['node',str(r/'generate.mjs'),'--module-root',str(app/'continuity/dist/public/shared'),'--outdir',str(out)],r)]
for label,cmd,cwd in commands:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,cwd=cwd,env=env,capture_output=True)
 for stream,b in [('stdout',p.stdout),('stderr',p.stderr)]:(r/(label+'.'+stream+'.log')).write_bytes(b)
 rows.append({'label':label,'command':[s.replace(str(app),'<baseline-app>').replace(str(r),'<scratch>') for s in cmd],'cwd':'<baseline-app>' if cwd==app else '<scratch>','startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()})
 if p.returncode:break
(r/'process.json').write_text(json.dumps(rows,indent=2));print(p.stdout.decode());print(p.stderr.decode());sys.exit(int(any(x['actualChildExit'] for x in rows)))
