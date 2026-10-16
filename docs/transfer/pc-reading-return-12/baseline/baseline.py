from pathlib import Path
import subprocess,os,json,hashlib,datetime
root=Path(__file__).parent; app=root/'source/app'; out=root/'evidence'
env=os.environ.copy();env['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'];env.update(AI_MODE='mock',ALLOW_PAID_AI='false')
files={str(p.relative_to(app)):hashlib.sha256(p.read_bytes()).hexdigest() for p in app.rglob('*') if p.is_file()}
commands=[['npm','run','check'],['npm','run','build'],['node','continuity/scripts/check.mjs'],['node','continuity/scripts/build.mjs'],['node','--test',*map(str,sorted(Path('continuity/tests').glob('*.test.mjs')))]]
# glob is explicitly relative to app, not launch directory
commands[-1]=['node','--test',*[str(p.relative_to(app)) for p in sorted((app/'continuity/tests').glob('*.test.mjs'))]]
r={'source_commit':'618d9bd2b99ad433df35107d8902b15f45e30000','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'commands':[],'source_before':files}
for i,cmd in enumerate(commands):
 p=subprocess.run(cmd,cwd=app,env=env,capture_output=True,text=True);(out/f'{i+1}.log').write_text(p.stdout+p.stderr);r['commands'].append({'argv':cmd,'exit':p.returncode});print(i+1,p.returncode,flush=True)
r['source_unchanged']=all((app/p).exists() and hashlib.sha256((app/p).read_bytes()).hexdigest()==h for p,h in files.items());(out/'baseline.json').write_text(json.dumps(r,indent=2));raise SystemExit(any(x['exit'] for x in r['commands']) or not r['source_unchanged'])
