from pathlib import Path
import subprocess,os,json,sys,datetime,hashlib
R=Path(__file__).parent;rows=[]
for name,app,old in [('original-no-file','cycle20-candidate',True),('focused','cycle20-fix1-candidate',False)]:
 env=os.environ.copy();env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],CYCLE20_APP=str(R.parent/app/'app'),CYCLE20_OUTPUT=name,CYCLE20_OLD='1' if old else '0');start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['/workspace/browser-env/venv/bin/python',str(R/'focused.py')],env=env,capture_output=True);(R/(name+'.stdout.log')).write_bytes(p.stdout);(R/(name+'.stderr.log')).write_bytes(p.stderr);rows.append({'name':name,'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()});(R/'focused-process.json').write_text(json.dumps(rows,indent=2));print(name,p.returncode,flush=True)
sys.exit(int(rows[0]['actualChildExit']!=1 or rows[1]['actualChildExit']!=0))
