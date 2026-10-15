import subprocess,sys,json
from pathlib import Path
r=Path(__file__).resolve().parent
with (r/'process.log').open('w') as log:p=subprocess.run([sys.executable,str(r/'check.py')],stdout=log,stderr=subprocess.STDOUT)
result=json.loads((r/'result.json').read_text());code=p.returncode if p.returncode==result['exitCode'] else 2
(r/'child-exit.json').write_text(json.dumps({'actualChildExit':p.returncode,'jsonExit':result['exitCode'],'agreement':p.returncode==result['exitCode'],'wrapperIntendedExit':code},indent=2));sys.exit(code)
