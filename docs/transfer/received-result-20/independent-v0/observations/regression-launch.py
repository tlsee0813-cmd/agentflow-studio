from pathlib import Path
import subprocess,json,datetime,sys
r=Path(__file__).parent;now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();start=now();p=subprocess.run(['/workspace/browser-env/venv/bin/python',str(r/'regression-collector.py')],capture_output=True);(r/'regression.stdout.log').write_bytes(p.stdout);(r/'regression.stderr.log').write_bytes(p.stderr);(r/'regression-external-process.json').write_text(json.dumps({'startUTC':start,'endUTC':now(),'actualCollectorExit':p.returncode,'launcherPlannedExit':p.returncode},indent=2));sys.exit(p.returncode)
