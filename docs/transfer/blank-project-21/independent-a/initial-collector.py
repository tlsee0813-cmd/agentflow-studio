from pathlib import Path
import subprocess,json,datetime,sys
R=Path(__file__).parent;rows=[]
for kind in ['before','after']:
 s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['/workspace/browser-env/venv/bin/python',str(R/'initial.py'),kind],capture_output=True);(R/(kind+'.stdout.log')).write_bytes(p.stdout);(R/(kind+'.stderr.log')).write_bytes(p.stderr);rows.append({'kind':kind,'command':['initial.py',kind],'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode});(R/'initial-process.json').write_text(json.dumps(rows,indent=2));print(kind,p.returncode,flush=True)
sys.exit(int(rows[0]['actualChildExit']!=1 or rows[1]['actualChildExit']!=0))
