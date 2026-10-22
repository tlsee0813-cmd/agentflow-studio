from pathlib import Path
import subprocess,os,json,datetime,hashlib,sys
R=Path(__file__).parent;e={k:os.environ[k] for k in ['PATH','HOME','TMPDIR','SOURCE_APP','OUTPUT_DIR'] if k in os.environ};e['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+e['PATH'];rows=[]
for case in ['1','2','3','4']:
 c=['node',str(R/'check.mjs'),case];start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(c,env=e,capture_output=True);(R/f'case-{case}.stdout.log').write_bytes(p.stdout);(R/f'case-{case}.stderr.log').write_bytes(p.stderr);rows.append({'case':case,'command':c,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest()});print(p.stdout.decode().strip(),flush=True)
exitcode=2 if any(x['actualChildExit']==2 for x in rows) else int(any(x['actualChildExit'] for x in rows));(R/'process.json').write_text(json.dumps({'rows':rows,'actualCollectorExitToPropagate':exitcode},indent=2));sys.exit(exitcode)
