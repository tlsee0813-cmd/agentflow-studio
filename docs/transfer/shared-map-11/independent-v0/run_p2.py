import subprocess,sys,json,hashlib,datetime
from pathlib import Path
root=Path(__file__).resolve().parent;name=sys.argv[1];site=Path(sys.argv[2]) if len(sys.argv)>2 else root/'v0';manifest=Path(sys.argv[3]) if len(sys.argv)>3 else root/'v0-runtime-manifest.json';out=root/name;out.mkdir(exist_ok=False);code=(root/'p2_check.py').read_bytes();sha=hashlib.sha256(code).hexdigest();sn=root/'snapshots';sn.mkdir(exist_ok=True);snapshot=sn/f'p2-{sha}.py'
if not snapshot.exists():snapshot.write_bytes(code)
cmd=[sys.executable,str(snapshot),'--site',str(site),'--manifest',str(manifest),'--out',str(out),'--label',name]
with (out/'process.log').open('w') as log:p=subprocess.run(cmd,stdout=log,stderr=subprocess.STDOUT)
j=json.loads((out/'result.json').read_text());exit=p.returncode if p.returncode==j['exitCode'] else 2;(out/'actual-exit.json').write_text(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'command':cmd,'codeSHA256':sha,'actualChildExit':p.returncode,'jsonExit':j['exitCode'],'agreement':p.returncode==j['exitCode'],'collectorIntendedExit':exit},indent=2));print(json.dumps({'childExit':p.returncode,'complete':j['complete'],'fatal':j['fatal'],'failed':[c['id'] for c in j['checks'] if c['status']=='FAIL']}));sys.exit(exit)
