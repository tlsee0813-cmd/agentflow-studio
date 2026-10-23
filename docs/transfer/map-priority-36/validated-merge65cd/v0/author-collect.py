from pathlib import Path
import subprocess,os,json,datetime,hashlib
r=Path(__file__).parent;rows=[];env=os.environ.copy();env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],BROWSER_EXECUTABLE='/usr/bin/chromium');
for name in ['map-priority36_browser','branch-records31_browser','hierarchy18_browser','static_browser']:
 out=r/'author'/name;out.mkdir(parents=True,exist_ok=True);env['IDEA015_EVIDENCE_DIR']=str(out/'raw');cmd=['/workspace/browser-env/venv/bin/python','continuity/tests/'+name+'.py'];start=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,cwd=r/'candidate/app',env=env,capture_output=True);(out/'stdout.log').write_bytes(p.stdout);(out/'stderr.log').write_bytes(p.stderr);row={'script':name,'command':cmd,'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'sourceSHA256':hashlib.sha256((r/'candidate/app'/cmd[1]).read_bytes()).hexdigest()};rows.append(row);(out/'process.json').write_text(json.dumps(row,indent=2));print(json.dumps(row),flush=True)
(r/'author-exits.json').write_text(json.dumps(rows,indent=2))
raise SystemExit(1 if any(x['actualChildExit'] for x in rows) else 0)
