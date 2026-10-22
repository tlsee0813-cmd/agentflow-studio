from pathlib import Path
import subprocess,datetime,json,hashlib,sys
r=Path(__file__).parent;d=r/'controlled';cmd=['/workspace/browser-env/venv/bin/python',str(d/'frozen-judge.py')];start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,capture_output=True)
(d/'judge.stdout.log').write_bytes(p.stdout);(d/'judge.stderr.log').write_bytes(p.stderr);(d/'judge.process.json').write_text(json.dumps({'command':cmd,'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()},indent=2));print(p.stderr.decode());sys.exit(p.returncode)
