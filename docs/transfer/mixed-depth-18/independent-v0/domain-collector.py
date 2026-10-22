from pathlib import Path
import subprocess,os,datetime,json,sys
r=Path(__file__).parent;e=os.environ.copy();e['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+e['PATH'];rows=[]
for n in ['state.mjs','test-answer-probe.mjs','test-answer-transition.mjs']:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['node',str(r/n)],env=e,capture_output=True);(r/(n+'.stdout.log')).write_bytes(p.stdout);(r/(n+'.stderr.log')).write_bytes(p.stderr);rows.append({'command':['node',str(r/n)],'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode});print(n,p.returncode)
code=int(any(x['actualChildExit'] for x in rows));(r/'domain-process.json').write_text(json.dumps({'rows':rows,'collectorExit':code},indent=2));sys.exit(code)
