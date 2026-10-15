import sys,subprocess,json,shutil,datetime
from pathlib import Path
r=Path(__file__).resolve().parent;out=r/sys.argv[1];out.mkdir(exist_ok=False)
for f in ['check.py','geometry.py','collect.py']:shutil.copyfile(r/f,out/f)
cmd=[sys.executable,str(r/'check.py'),'--out',str(out)]
with (out/'process.log').open('w') as log:p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT)
j=json.loads((out/'result.json').read_text());code=p.returncode if p.returncode==j['exitCode'] else 2
(out/'child-exit.json').write_text(json.dumps({'command':cmd,'actualChildExit':p.returncode,'jsonExit':j['exitCode'],'agreement':p.returncode==j['exitCode'],'collectorIntendedExit':code},indent=2));print(json.dumps({'childExit':p.returncode,'complete':j['complete'],'fatal':j['fatal'],'failedChecks':[x['id'] for x in j['checks'] if x['status']=='FAIL']}));sys.exit(code)
