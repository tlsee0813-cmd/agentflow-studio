import subprocess,sys,os,json,datetime,hashlib
from pathlib import Path
r=Path(__file__).parent;o=Path(os.environ.get('UI_OUT',str(r/'run01')));o.mkdir(exist_ok=True,parents=True);cmd=[sys.executable,str(r/'ui.py')];start=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (o/'stdout.log').open('w') as a,(o/'stderr.log').open('w') as b:p=subprocess.run(cmd,stdout=a,stderr=b)
(o/'process.json').write_text(json.dumps({'command':cmd,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actual_child_returncode':p.returncode,'stdout_sha256':hashlib.sha256((o/'stdout.log').read_bytes()).hexdigest(),'stderr_sha256':hashlib.sha256((o/'stderr.log').read_bytes()).hexdigest()},indent=2));print('child_actual',p.returncode);sys.exit(p.returncode)
