import subprocess,sys,json,datetime
from pathlib import Path
r=Path(__file__).resolve().parent
with (r/'wrapper.log').open('w') as log:p=subprocess.run([sys.executable,str(r/'wrapper.py')],stdout=log,stderr=subprocess.STDOUT)
c=json.loads((r/'child-exit.json').read_text());code=p.returncode if p.returncode==c['actualChildExit'] else 2
(r/'actual-exit.json').write_text(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':c['actualChildExit'],'actualWrapperExit':p.returncode,'agreement':p.returncode==c['actualChildExit'],'launcherExit':code},indent=2));print((r/'actual-exit.json').read_text());sys.exit(code)
