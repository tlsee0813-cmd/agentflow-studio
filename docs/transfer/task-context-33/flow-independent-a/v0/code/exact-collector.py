from pathlib import Path
import os,subprocess,datetime,hashlib,json,sys
r=Path(__file__).parent;out=r/'exact-tests';out.mkdir(exist_ok=True);env=os.environ.copy();env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],BROWSER_EXECUTABLE='/usr/bin/chromium',IDEA015_EVIDENCE_DIR=str(out/'raw'));env.pop('BROWSER_TRANSPORT',None)
methods=[c+'.'+m for c in ['Pc12','Pc12Wide'] for m in ['test_02_continue_keeps_R_then_switches_from_RB_to_A','test_11_target_jumps_and_selected_file_review']]
cmd=['/workspace/browser-env/venv/bin/python',str(r/'exact-runner.py')]+methods;s=datetime.datetime.now(datetime.timezone.utc).isoformat();p=subprocess.run(cmd,cwd=r/'candidate/app',env=env,capture_output=True)
(out/'stdout.log').write_bytes(p.stdout);(out/'stderr.log').write_bytes(p.stderr);(out/'process.json').write_text(json.dumps({'command':cmd,'startUTC':s,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':p.returncode,'stdoutSHA256':hashlib.sha256(p.stdout).hexdigest(),'stderrSHA256':hashlib.sha256(p.stderr).hexdigest(),'exactScriptUnchanged':True},indent=2));print(p.stderr.decode()[-8000:]);sys.exit(p.returncode)
