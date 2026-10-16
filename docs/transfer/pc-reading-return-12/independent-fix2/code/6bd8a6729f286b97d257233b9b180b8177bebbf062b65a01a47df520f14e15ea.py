import subprocess,os,sys,json,datetime
from pathlib import Path
r=Path(__file__).parent;o=Path(os.environ['OUT_DIR']);o.mkdir(exist_ok=True);cmd=[sys.executable,str(r/'check-v3.py')];start=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (o/'stdout.log').open('w') as a,(o/'stderr.log').open('w') as b:p=subprocess.run(cmd,stdout=a,stderr=b)
(o/'process.json').write_text(json.dumps({'argv':cmd,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actual_child_returncode':p.returncode,'collector_exit_planned':p.returncode},indent=2));print('child_actual',p.returncode);sys.exit(p.returncode)
