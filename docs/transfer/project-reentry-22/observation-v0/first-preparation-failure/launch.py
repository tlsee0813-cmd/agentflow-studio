from pathlib import Path
import subprocess,datetime,json,sys
R=Path(__file__).parent;s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['/workspace/browser-env/venv/bin/python','-u',str(R/'session.py')]);(R/'process.json').write_text(json.dumps({'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'collectorPlannedExit':p.returncode}));sys.exit(p.returncode)
