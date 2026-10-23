from pathlib import Path
import subprocess,json,datetime,sys
r=Path(__file__).parent;now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();start=now();cmd=['/workspace/browser-env/venv/bin/python',str(r/'check.py')];p=subprocess.run(cmd,capture_output=True);(r/'stdout.log').write_bytes(p.stdout);(r/'stderr.log').write_bytes(p.stderr);(r/'collector.json').write_text(json.dumps({'command':cmd,'startUTC':start,'endUTC':now(),'actualChildExit':p.returncode,'outerExit':p.returncode},indent=2));sys.exit(p.returncode)
