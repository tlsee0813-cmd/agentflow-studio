from pathlib import Path
import os,subprocess,json,datetime,hashlib,sys
R=Path(__file__).parent;e=os.environ.copy();e['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+e['PATH'];rows=[]
for script,out in [('repro.py','independent'),('boundaries.py','boundaries'),('visual-fallback.py','visual')]:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['/workspace/browser-env/venv/bin/python',str(R/script)],env=e,capture_output=True);(R/(script+'.stdout.log')).write_bytes(p.stdout);(R/(script+'.stderr.log')).write_bytes(p.stderr);result=json.loads((R/out/'result.json').read_text());rows.append({'script':script,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actual_child_returncode':p.returncode,'json_exit':result['exit'],'matches':p.returncode==result['exit'],'stdoutSHA':hashlib.sha256(p.stdout).hexdigest()});(R/'collector.json').write_text(json.dumps(rows,indent=2));print(script,p.returncode,flush=True)
# visual includes separately classified pre-existing live-refresh counterexample; keep nonzero raw, no masking.
sys.exit(int(any(x['actual_child_returncode'] for x in rows)))
