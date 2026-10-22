from pathlib import Path
import os,subprocess,json,datetime,sys
R=Path(__file__).parent;e=os.environ.copy();e.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+e['PATH'],SOURCE_APP='/workspace/browser-env/cycle17-fix1-candidate/app',OUTPUT_DIR=str(R/'frozen-results'));rows=[]
for n in '1234':
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['node','/workspace/browser-env/cycle17-counterexamples/check.mjs',n],env=e,capture_output=True);(R/f'frozen-{n}.stdout.log').write_bytes(p.stdout);(R/f'frozen-{n}.stderr.log').write_bytes(p.stderr);rows.append({'case':n,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'childExit':p.returncode});print(p.stdout.decode().strip(),flush=True)
code=2 if any(x['childExit']==2 for x in rows) else int(any(x['childExit'] for x in rows));(R/'frozen-process.json').write_text(json.dumps({'rows':rows,'collectorExit':code},indent=2));sys.exit(code)
