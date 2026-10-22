from pathlib import Path
import subprocess,json,datetime,sys
R=Path(__file__).parent;s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['/workspace/browser-env/venv/bin/python',str(R/'flow-v3.py')],capture_output=True);(R/'flow-v3.stdout.log').write_bytes(p.stdout);(R/'flow-v3.stderr.log').write_bytes(p.stderr);(R/'flow-v3-process.json').write_text(json.dumps({'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'collectorPlannedExit':p.returncode},indent=2));print(p.stdout.decode());sys.exit(p.returncode)
