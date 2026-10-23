from pathlib import Path
import json,hashlib,gzip,shutil,subprocess
R=Path(__file__).parent;O=R/'payload';O.mkdir(exist_ok=True);A=R/'candidate/app';sha=lambda b:hashlib.sha256(b).hexdigest();C='65cd96d9da53753e70dba350bdf62c5d68474809';H='a17cbcf9804154b878ccf20dfa4d5155777ce7ca'
def copy(f,n=None):
 f=Path(f);d=O/(n or f.name);d.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(f,d)
def gz(name,b):
 d=O/(name+'.gz');d.parent.mkdir(parents=True,exist_ok=True);z=gzip.compress(b,mtime=0);assert gzip.decompress(z)==b;d.write_bytes(z);index.append({'path':str(d.relative_to(O)),'originalBytes':len(b),'originalSHA256':sha(b),'gzipSHA256':sha(z),'decompressEqual':True})
index=[]
for n in ['build.py','build.process.json','author-collect.py','author-exits.json','judge.py','SUMMARY.json','projection.mjs','projection-first-property-error.mjs','projection.json','package.py']:
 copy(R/n)
for f in R.glob('*.log'):copy(f,'build-logs/'+f.name)
for name in ['run.py','collect.py','server.py','process.json','stdout.log','stderr.log']:copy(R/'ui'/name,'ui/'+name)
# raw state/geometry + native actions, no duplicate hundreds of screenshot files
u=R/'ui';raw={f.name:json.loads(f.read_text()) for f in u.glob('*.json') if f.name!='process.json'};gz('ui/raw-data.json',json.dumps(raw,ensure_ascii=False).encode());copy(u/'db5-FACTS.json','inputs/db5-FACTS.json');copy(u/'inputs/db5-update.json','inputs/db5-update.json')
for f in u.glob('*.png'):copy(f,'screens/'+f.name)
inputindex=[]
for f in sorted((u/'inputs').glob('*.json')):
 b=f.read_bytes();inputindex.append({'path':f.name,'bytes':len(b),'sha256':sha(b)})
 # canonical T2/db5 referenced, generated boundaries/late files small and reusable
 if f.name not in ['T2.json','db5.json','db5-update.json']:copy(f,'inputs/'+f.name)
(O/'INPUT_BINDING.json').write_text(json.dumps({'T2Source':'24baf91fa2d519fd8cd33bb5ece28ec5b32323df generated-v0/observer-input/T2.json','db5Source':'db5be306ee1e57b05f3de8378d398e210ee0aea2 docs/transfer/map-signals-34/input-v0/generated/mixed-long-title.json','actualFiles':inputindex},indent=2))
for folder in (R/'author').iterdir():
 for f in folder.rglob('*'):
  if not f.is_file() or f.suffix=='.png':continue
  n='author/'+str(f.relative_to(R/'author'))
  if f.suffix in ['.jsonl','.json'] and f.stat().st_size>15000:gz(n,f.read_bytes())
  elif f.suffix in ['.log','.json','.jsonl','.txt']:copy(f,n)
for f in (R/'reports-only').iterdir():
 if f.is_file():copy(f,'reports-only/'+f.name)
for f in (R/'reports-only/sample').iterdir():copy(f,'reports-only/sample/'+f.name)
for f in (R/'reports-only/evidence').iterdir():
 if f.is_file() and f.suffix!='.png':gz('reports-only/raw/'+f.name,f.read_bytes())
# Preview artifacts exactly as served, all 17 files
D=A/'continuity/static-dist';P=A/'continuity/static-preview-dist';names=lambda d:sorted(str(f.relative_to(d)) for f in d.rglob('*') if f.is_file());assert names(D)==names(P) and len(names(P))==17;assert [n for n in names(P) if (D/n).read_bytes()!=(P/n).read_bytes()]==['client/static-target.js'];assert "connect-src 'none'" in (P/'index.html').read_text()
shutil.copytree(P,O/'artifact',dirs_exist_ok=True);(O/'ARTIFACT_MANIFEST.tsv').write_text('path\tbytes\tsha256\n'+''.join(f'artifact/{n}\t{(P/n).stat().st_size}\t{sha((P/n).read_bytes())}\n' for n in names(P)))
paths=subprocess.check_output(['git','-C','/workspace/agentflow-studio','ls-tree','-r','--name-only',C,'--','app/continuity/src','app/continuity/public','app/continuity/scripts','app/continuity/tests/map-priority36_browser.py','app/continuity/tests/branch-records31_browser.py','app/continuity/tests/hierarchy18_browser.py','app/continuity/tests/static_browser.py']).decode().splitlines();bound=[]
for path in paths:
 f=A/path.removeprefix('app/');b=f.read_bytes();assert subprocess.check_output(['git','-C','/workspace/agentflow-studio','show',C+':'+path])==b;bound.append({'path':path,'bytes':len(b),'sourceAndDiskAfterSHA256':sha(b)})
assert subprocess.check_output(['git','-C','/workspace/agentflow-studio','rev-parse',C+':app'])==subprocess.check_output(['git','-C','/workspace/agentflow-studio','rev-parse',H+':app'])
(O/'SOURCE_BINDING.json').write_text(json.dumps({'executedSource':C,'parents':subprocess.check_output(['git','-C','/workspace/agentflow-studio','show','-s','--format=%P',C]).decode().strip().split(),'appSubtree':'66d79f03d9884fa5d06252c7d9ad7fdc9322e231','equivalentHeadNotExecuted':H,'wholeDiff65ToA17':subprocess.check_output(['git','-C','/workspace/agentflow-studio','diff','--name-status',C,H]).decode(),'sourceFiles':bound,'artifact17':True,'demoDifferenceOnly':'client/static-target.js','CSPConnectNone':True,'Node':'22.16.0','TS':'5.8.3','Playwright':'1.57.0','Chromium':json.loads((u/'result.json').read_text())['browser'],'noFontInstall':True,'UIHTTPbodyDiskBeforeAfterIn':'ui/raw-data.json.gz result.json','reportsOnlyBinding':{'actualREPORT36_APP':str(A),'originalFrozenLiteralSourceLabel':'c0a7c91; not changed in frozen checker','checkerSHA256':sha((R/'reports-only/check.py').read_bytes()),'actualSource':C}},indent=2))
(O/'RAW_INDEX.json').write_text(json.dumps(index,indent=2));(O/'EXIT_RECEIPTS.json').write_text(json.dumps({'buildTypeAllChildren':0,'UIChild':0,'UIOuterCollector':0,'UIOuterExec':0,'reportsOnlyCollectionChild':0,'reportsOnlyCollectionOuter':0,'reportsOnlyGateChild':0,'reportsOnlyGateOuter':0,'postJudgeToolExit':0,'projectionFirstPropertyReadErrorExit':1,'projectionCorrectEntryPathExit':0,'staticHTTPServerExit':-15,'newCIQueried':False,'note':'reports-only frozen gate collector meaning text is old original-failure label; actual fix gate exit0. That label is not a new failure.'},indent=2))
print('payload files',sum(f.is_file() for f in O.rglob('*')),'bytes',sum(f.stat().st_size for f in O.rglob('*') if f.is_file()))
