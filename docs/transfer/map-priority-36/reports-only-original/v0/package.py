from pathlib import Path
import json,subprocess,hashlib,shutil,gzip
R=Path(__file__).parent;O=R/'payload';O.mkdir(exist_ok=True);sha=lambda b:hashlib.sha256(b).hexdigest();A=R/'candidate/app';C='c0a7c91c54d62166140081b149d94bc6efa9f1f9'
for n in ['generate.mjs','check.py','collect.py','collector.json','stdout.log','stderr.log','project-check.mjs','gate.py','gate-collect.py','gate.stdout.log','gate.stderr.log','gate.exit.json','package.py']:shutil.copy2(R/n,O/n)
shutil.copytree(R/'sample',O/'sample',dirs_exist_ok=True)
for name in ['first-error','second-error']:shutil.copytree(R/name,O/name,dirs_exist_ok=True)
for f in (R/'evidence').iterdir():
 if f.is_file():shutil.copy2(f,O/f.name)
bind=[]
for path in ['continuity/src/client/app.ts','continuity/src/shared/attention.ts','continuity/public/index.html','continuity/public/styles.css']:
 b=(A/path).read_bytes();assert subprocess.check_output(['git','-C','/workspace/agentflow-studio','show',C+':app/'+path])==b;bind.append({'path':path,'bytes':len(b),'sourceAndDiskAfterSHA256':sha(b)})
r=json.loads((O/'raw.json').read_text());assert r['collectionExit']==0
for x in r['HTTP']:assert x['status']==200 and x['bodySHA']==x['diskBeforeSHA']==x['diskAfterSHA']
(O/'SOURCE_BINDING.json').write_text(json.dumps({'source':C,'tree':subprocess.check_output(['git','-C','/workspace/agentflow-studio','rev-parse',C+'^{tree}']).decode().strip(),'method':'exact git archive; existing TS5.8.3 PATH compiler root/continuity build; source unchanged after execution','files':bind,'runtime':{'Node':subprocess.check_output(['/workspace/browser-env/tools/node_modules/.bin/node','--version']).decode().strip(),'Playwright':'1.57.0','Chromium':r['browser']},'actualToolExitReceipts':{'continuityBuild':0,'rootBuildAfterFirstPrepareFailure':0,'generator':0,'projectionReloadCheck':0,'UICollector':0,'UIOuter':0,'intentionalGateChild':1,'intentionalGateOuter':1,'server':r['serverExit']}},indent=2))
# All old states/raw remain recoverable, gzip avoids duplicate geometric bulk.
index=[]
for f in sorted(O.rglob('*.json')):
 if f.name in ['collector.json','gate.exit.json','SOURCE_BINDING.json','FACTS.json'] or 'sample' in f.parts:continue
 b=f.read_bytes();z=gzip.compress(b,mtime=0);assert gzip.decompress(z)==b;n=str(f.relative_to(O));(O/(n+'.gz')).write_bytes(z);f.unlink();index.append({'path':n+'.gz','originalBytes':len(b),'originalSHA256':sha(b),'gzipSHA256':sha(z),'decompressEqual':True})
(O/'RAW_INDEX.json').write_text(json.dumps(index,indent=2));print('files before report',sum(f.is_file() for f in O.rglob('*')))
