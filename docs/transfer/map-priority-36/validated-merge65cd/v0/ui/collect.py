from pathlib import Path
import subprocess,datetime,json,sys
r=Path(__file__).parent;cmd=['/workspace/browser-env/venv/bin/python',str(r/'run.py')];start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,capture_output=True);(r/'stdout.log').write_bytes(p.stdout);(r/'stderr.log').write_bytes(p.stderr);(r/'process.json').write_text(json.dumps({'command':cmd,'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'outerExit':p.returncode},indent=2));sys.exit(p.returncode)
