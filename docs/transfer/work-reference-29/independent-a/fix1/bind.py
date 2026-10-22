from pathlib import Path
import json,subprocess,hashlib,datetime
R=Path(__file__).parent;A=Path('/workspace/browser-env/cycle29-candidate');base='2a7d078124e96243e949244bec945cc8da2c47ec';final='709e402b2e44a4864139eda03201e186f5761c6f';repo='/workspace/agentflow-studio';rows=[]
for f in sorted(A.rglob('*')):
 if not f.is_file() or '/dist/' in str(f) or '__pycache__' in str(f):continue
 rel=str(f.relative_to(A));head=final if rel=='app/continuity/tests/work-description29_browser.py' else base;b=f.read_bytes();remote=subprocess.check_output(['git','-C',repo,'show',head+':'+rel]);assert remote==b;rows.append({'path':rel,'inputHead':head,'bytes':len(b),'inputSHA256':hashlib.sha256(remote).hexdigest(),'diskAfterSHA256':hashlib.sha256(b).hexdigest()})
blobs={}
for rel,expected in [('app/continuity/src/client/app.ts','34f3610faae32b01d22f8a3fc52467b4e0b5d0d9c30059c6b4d201e22edc9477'),('app/continuity/public/styles.css','fb9192e07adb180e55530b3f489125861c542a61a53d7058fd24022b4715115f')]:
 b=subprocess.check_output(['git','-C',repo,'show',base+':'+rel]);new=subprocess.check_output(['git','-C',repo,'show',final+':'+rel]);assert new==b and hashlib.sha256(b).hexdigest()==expected;blobs[rel]={'SHA256':expected,'blob':subprocess.check_output(['git','-C',repo,'rev-parse',final+':'+rel]).decode().strip(),'same2a7And709':True}
http=[]
for name in ['cycle29-ui','cycle29-nested-scroll','cycle29-project-boundary']:
 r=Path('/workspace/browser-env')/name;p=json.loads((r/'runtime.json').read_text())
 for x in p['HTTP']:
  if 'path' in x:assert x['httpSHA256']==x['diskSHA256']==x['diskAfterSHA256']
 http.append({'run':name,'firstURL':p['HTTP'][0]['url'],'responseCount':len(p['HTTP']),'allHTTPDiskDuringAndAfterEqual':True,'browser':p['browserVersion'],'playwright':p['playwright'],'pageerrors':p['pageerrors'],'cleanup':p['cleanupErrors'],'console':p['console'],'serverActualExit':p['actualServerExit']})
(R/'SOURCE_BINDING.json').write_text(json.dumps({'runtimeProductBase':base,'testsOnlyFinalHead':final,'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'productBlobs':blobs,'pinnedSource':rows,'actualHTTPRuns':http,'testsOnlyDiff':subprocess.check_output(['git','-C',repo,'diff','--name-only',base,final]).decode().splitlines(),'actualNode':subprocess.check_output(['/workspace/browser-env/tools/node_modules/.bin/node','--version']).decode().strip(),'actualTS':subprocess.check_output(['/workspace/browser-env/tools/node_modules/.bin/tsc','--version']).decode().strip(),'newInstalls':False},indent=2))
