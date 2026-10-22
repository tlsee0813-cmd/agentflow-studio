from pathlib import Path
import subprocess,json,sys,datetime
R=Path(__file__).parent;s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['/workspace/browser-env/venv/bin/python','-u',str(R/'observe.py')]);(R/'process.json').write_text(json.dumps({'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'collectorPlannedExit':p.returncode,'command':['/workspace/browser-env/venv/bin/python','-u',str(R/'observe.py')]}));sys.exit(p.returncode)
