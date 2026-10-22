from pathlib import Path
import os,sys,subprocess,json,datetime,hashlib,threading,concurrent.futures
R=Path(__file__).parent;A=R.parent/'cycle20-candidate/app';O=R/'regression-commands';O.mkdir(exist_ok=True);env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],AI_MODE='mock',ALLOW_PAID_AI='false',BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');rows=[];lock=threading.Lock();now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
def run(name,cmd):
 out=O/name;out.mkdir(exist_ok=True);start=now();p=subprocess.run(cmd,cwd=A,env={**env,'IDEA015_EVIDENCE_DIR':str(out/'raw')},capture_output=True);(out/'stdout.log').write_bytes(p.stdout);(out/'stderr.log').write_bytes(p.stderr);rec={'name':name,'command':cmd,'startUTC':start,'endUTC':now(),'actualChildExit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()}
 with lock:rows.append(rec);(O/'process.json').write_text(json.dumps(rows,indent=2));print(name,p.returncode,flush=True)
 return p.returncode
names=['workspace19','pc12','pc13','home15','report16','understanding17','hierarchy18']
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 list(pool.map(lambda name:run(name,['/workspace/browser-env/venv/bin/python','continuity/tests/'+name+'_browser.py']),names))
code=int(any(x['actualChildExit'] for x in rows));(O/'collector.json').write_text(json.dumps({'source':'0aafca2708863036055cbd3029521b4eb983d22e','expected':7,'executed':len(rows),'complete':len(rows)==7,'collectorPlannedExit':code,'boundary':'actual collector exit recorded by external launcher'},indent=2));sys.exit(code)
