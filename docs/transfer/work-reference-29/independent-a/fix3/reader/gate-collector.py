from pathlib import Path
import subprocess,datetime,json,sys,hashlib
r=Path(__file__).parent;cmd=['/workspace/browser-env/venv/bin/python',str(r/'gate.py')];s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,capture_output=True)
(r/'gate.stdout.log').write_bytes(p.stdout);(r/'gate.stderr.log').write_bytes(p.stderr);(r/'gate-process.json').write_text(json.dumps({'scope':'offline aggregate evaluation; not another UI run','command':cmd,'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()},indent=2));sys.exit(p.returncode)
