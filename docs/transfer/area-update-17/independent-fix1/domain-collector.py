from pathlib import Path
import os,subprocess,json,datetime,shutil,sys
r=Path(__file__).parent;first=r/'first-domain-observations';first.mkdir(exist_ok=True)
for n in ['new-request-domain.json','new-request-domain.stdout.log','new-request-domain.stderr.log','recovery-correction.json','recovery-correction.stdout.log','recovery-correction.stderr.log']:
 if (r/n).exists():shutil.copy2(r/n,first/n)
e=os.environ.copy();e['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+e['PATH'];rows=[]
for s in ['new-request-probe.mjs','recovery-correction-probe.mjs','state.mjs']:
 start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(['node',str(r/s)],env=e,capture_output=True);(r/(s+'.stdout.log')).write_bytes(p.stdout);(r/(s+'.stderr.log')).write_bytes(p.stderr);rows.append({'script':s,'actualChildExit':p.returncode,'start':start,'end':datetime.datetime.now(datetime.timezone.utc).isoformat()});print(s,p.returncode,flush=True)
code=2 if any(x['actualChildExit']==2 for x in rows) else int(any(x['actualChildExit'] for x in rows));(r/'domain-process.json').write_text(json.dumps({'rows':rows,'collectorExit':code},indent=2));sys.exit(code)
