from pathlib import Path
import hashlib,json,subprocess,datetime
R=Path(__file__).parent;repo='/workspace/agentflow-studio';all=[]
for variant,commit,root in [('baseline','6b96543fdf980ff45f0e1b67f83e8a0a561a1542','/workspace/browser-env/cycle27-fix1-candidate'),('candidate','77c47af95a24f02f290560a86de62e95a63452d8','/workspace/browser-env/cycle28-candidate')]:
 a=Path(root);items=[]
 for f in sorted(a.rglob('*')):
  if not f.is_file() or '/dist/' in str(f):continue
  rel=str(f.relative_to(a));b=f.read_bytes();orig=subprocess.check_output(['git','-C',repo,'show',commit+':'+rel]);assert b==orig;items.append({'path':rel,'bytes':len(b),'pinnedInputSHA256':hashlib.sha256(orig).hexdigest(),'diskAfterSHA256':hashlib.sha256(b).hexdigest()})
 assets=[]
 for f in sorted((a/'app/continuity/dist/public').rglob('*')):
  if f.is_file():b=f.read_bytes();assets.append({'path':str(f.relative_to(a/'app/continuity/dist/public')),'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest()})
 all.append({'variant':variant,'commit':commit,'tree':subprocess.check_output(['git','-C',repo,'rev-parse',commit+'^{tree}']).decode().strip(),'source':items,'compiled':assets})
changes=subprocess.check_output(['git','-C',repo,'diff','--name-only',all[0]['commit'],all[1]['commit']]).decode().splitlines();assert changes==['app/continuity/public/styles.css','app/continuity/src/client/app.ts'];assert next(x['diskAfterSHA256'] for x in all[1]['source'] if x['path']=='app/continuity/src/client/app.ts')=='e1f9ffbb26afbbe7ad7df77b1c295d86a8c89b79a5dd044b78fa4f38b153a5a4';assert next(x['diskAfterSHA256'] for x in all[1]['source'] if x['path']=='app/continuity/public/styles.css')=='783860e056a7c6a07295cfd062473fb13732e71e2b5f9fffe3689e2a142e1b6f'
http=[]
for n in ['baseline','candidate','baseline-6','candidate-6','baseline-8','candidate-8','prepare-expanded','first-backup-ledger-name-error']:
 p=json.loads((R/n/'runtime.json').read_text());r=[]
 for x in p['HTTP']:
  if 'path' in x:assert x['httpSHA256']==x['diskSHA256']==x['diskAfterSHA256']
 http.append({'run':n,'actualURL':p['HTTP'][0]['url'],'responses':len(p['HTTP']),'allBodyDiskBeforeAfterEqual':True,'browserVersion':p['browserVersion'],'playwright':p['playwright'],'console':p['console'],'pageerrors':p['pageerrors'],'cleanup':p['cleanupErrors'],'serverExit':p['actualServerExit']})
versions={}
for label,cmd in [('node',['/workspace/browser-env/tools/node_modules/.bin/node','--version']),('typescript',['/workspace/browser-env/tools/node_modules/.bin/tsc','--version'])]:
 p=subprocess.run(cmd,capture_output=True);versions[label]={'command':cmd,'actualReturncode':p.returncode,'stdout':p.stdout.decode(),'stderr':p.stderr.decode()}
(R/'SOURCE_BINDING.json').write_text(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'sourceChecks':all,'changedFilesOnly':changes,'httpRuns':http,'dynamicTools':versions,'sourceInputMethod':'git archive exact commits; source never edited, final bytes compared to pinned input. Compiled serving bytes measured at HTTP response and again after execution.'},indent=2))
