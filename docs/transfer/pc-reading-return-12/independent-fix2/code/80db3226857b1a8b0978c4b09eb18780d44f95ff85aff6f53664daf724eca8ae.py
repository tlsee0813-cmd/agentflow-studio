from pathlib import Path
import subprocess,json,datetime,sys,os
r=Path(__file__).parent;o=Path(os.environ.get('OUT_DIR',str(r/'evidence')));o.mkdir(parents=True,exist_ok=True);cmd=[sys.executable,str(r/'check.py')];start=datetime.datetime.now(datetime.timezone.utc).isoformat()
with (o/'child.stdout.log').open('w') as a,(o/'child.stderr.log').open('w') as b:p=subprocess.run(cmd,stdout=a,stderr=b)
x={'argv':cmd,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actual_child_returncode':p.returncode,'stdout':str(o/'child.stdout.log'),'stderr':str(o/'child.stderr.log'),'collector_exit_planned':p.returncode};(o/'process.json').write_text(json.dumps(x,indent=2));print(json.dumps(x));sys.exit(p.returncode)
