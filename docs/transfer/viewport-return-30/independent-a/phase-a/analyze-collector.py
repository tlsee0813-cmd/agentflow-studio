from pathlib import Path
import subprocess,json,datetime,hashlib,sys
r=Path(__file__).parent;cmd=['/workspace/browser-env/venv/bin/python',str(r/'analyze.py')];s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,capture_output=True)
(r/'analysis.stdout.log').write_bytes(p.stdout);(r/'analysis.stderr.log').write_bytes(p.stderr);(r/'analysis-process.json').write_text(json.dumps({'scope':'offline raw analysis, not another UI execution','command':cmd,'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()},indent=2));sys.exit(p.returncode)
