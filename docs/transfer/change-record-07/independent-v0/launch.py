import sys,subprocess,json,datetime
from pathlib import Path
r=Path(__file__).resolve().parent;name=sys.argv[1]
p=subprocess.run([sys.executable,str(r/'collect.py'),name],capture_output=True,text=True);out=r/name
(out/'collector.log').write_text(p.stdout+p.stderr);child=json.loads((out/'child-exit.json').read_text());code=p.returncode if p.returncode==child['actualChildExit'] else 2
(out/'actual-exit.json').write_text(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':child['actualChildExit'],'actualCollectorExit':p.returncode,'agreement':p.returncode==child['actualChildExit'],'launcherExit':code},indent=2));print(p.stdout);print('ACTUAL_COLLECTOR_EXIT',p.returncode);sys.exit(code)
