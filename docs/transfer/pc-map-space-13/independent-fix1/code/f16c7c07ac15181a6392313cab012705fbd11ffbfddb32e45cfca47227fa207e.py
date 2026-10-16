from pathlib import Path
import subprocess,os,sys,json,datetime,hashlib
R=Path(__file__).parent;O=Path(os.environ['CONTROL_OUT']);O.mkdir(parents=True,exist_ok=True);cmd=[sys.executable,str(R/'check.py')];start=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (O/'stdout.log').open('w') as a,(O/'stderr.log').open('w') as b:p=subprocess.run(cmd,stdout=a,stderr=b)
(O/'process.json').write_text(json.dumps({'command':cmd,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualchildreturncode':p.returncode,'log_sha256':{n:hashlib.sha256((O/n).read_bytes()).hexdigest() for n in ['stdout.log','stderr.log']}},indent=2));print('actualchild',p.returncode);sys.exit(p.returncode)
