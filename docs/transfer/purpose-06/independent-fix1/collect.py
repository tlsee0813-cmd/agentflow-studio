import subprocess,sys,json,datetime,shutil
from pathlib import Path
root=Path(__file__).resolve().parent
name=sys.argv[1]; out=root/name;out.mkdir(exist_ok=True);shutil.copyfile(root/'verify.py',out/'verify.py')
cmd=[str(Path(sys.executable)),str(out/'verify.py'),'--out',str(out)]
# execute code snapshot with immutable source site resolved at parent
shutil.copyfile(root/'verify.py',out/'verify.py')
cmd=[sys.executable,str(root/'verify.py'),'--out',str(out)]+sys.argv[2:]
with (out/'process.log').open('w') as log:p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT)
r=json.loads((out/'result.json').read_text());code=p.returncode
agreement=code==r['exitCode']; wrapper=code if agreement else 2
(out/'actual-exit.json').write_text(json.dumps({'command':cmd,'actualChildExit':code,'jsonExit':r['exitCode'],'agreement':agreement,'wrapperExit':wrapper,'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2))
print(json.dumps({'run':name,'childExit':code,'wrapperExit':wrapper,'complete':r['complete'],'fatal':r['fatal']['message'] if r['fatal'] else None,'failed':[c['id'] for c in r['checks'] if c['status']=='FAIL']}));sys.exit(wrapper)
