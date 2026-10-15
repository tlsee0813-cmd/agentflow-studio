import subprocess,sys,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parent;name=sys.argv[1];checker=Path(sys.argv[2]) if len(sys.argv)>2 else root/'check.py';out=root/name;out.mkdir(exist_ok=False);snap=root/'snapshots';snap.mkdir(exist_ok=True);b=checker.read_bytes();sha=hashlib.sha256(b).hexdigest();code=snap/f'check-{sha}.py'
if not code.exists():code.write_bytes(b)
cmd=[sys.executable,str(code),'--source',str(root/'site/relation-reading-study.html'),'--out',str(out)]
with (out/'process.log').open('w') as log:p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT)
r=json.loads((out/'result.json').read_text());exit=p.returncode if r['exitCode']==p.returncode else 2
(out/'child-exit.json').write_text(json.dumps({'command':cmd,'codeSHA256':sha,'actualChildExit':p.returncode,'jsonExit':r['exitCode'],'agreement':r['exitCode']==p.returncode,'collectorIntendedExit':exit},indent=2));print(json.dumps({'childExit':p.returncode,'complete':r['complete'],'fatal':r['fatal'],'failed':[c['id'] for c in r['checks'] if c['status']=='FAIL']}));sys.exit(exit)
