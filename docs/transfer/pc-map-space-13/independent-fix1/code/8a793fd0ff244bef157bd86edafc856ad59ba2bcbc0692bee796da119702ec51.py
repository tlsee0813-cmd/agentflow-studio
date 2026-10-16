from pathlib import Path
import subprocess,json,datetime,hashlib,sys
R=Path(__file__).parent;O=R/'evidence';O.mkdir(exist_ok=True);cmd=[sys.executable,str(R/'observe.py')];start=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (O/'stdout.log').open('w') as a,(O/'stderr.log').open('w') as b:p=subprocess.run(cmd,stdout=a,stderr=b)
(O/'process.json').write_text(json.dumps({'command':cmd,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actual_child_returncode':p.returncode,'stdout_sha256':hashlib.sha256((O/'stdout.log').read_bytes()).hexdigest(),'stderr_sha256':hashlib.sha256((O/'stderr.log').read_bytes()).hexdigest()},indent=2));print('actualchild',p.returncode);sys.exit(p.returncode)
