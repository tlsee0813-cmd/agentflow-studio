from pathlib import Path
import json,hashlib,subprocess,shutil,gzip
R=Path(__file__).parent;U=R/'ui';O=R/'payload';O.mkdir(exist_ok=True);sha=lambda b:hashlib.sha256(b).hexdigest();A=R/'candidate/app';C='81f8a32dcd12a6004274d38bb6edf1ff9a5cdafb'
files=[]
for f in sorted(A.rglob('*')):
 if f.is_file() and any(str(f.relative_to(A)).startswith(x) for x in ['continuity/src/','continuity/scripts/','continuity/tests/static_browser.py']):
  path=str(f.relative_to(A));b=f.read_bytes();remote=subprocess.check_output(['git','-C','/workspace/agentflow-studio','show',C+':app/'+path]);assert b==remote;files.append({'path':path,'bytes':len(b),'sourceAndDiskSHA256':sha(b)})
(O/'SOURCE_BINDING.json').write_text(json.dumps({'commit':C,'tree':subprocess.check_output(['git','-C','/workspace/agentflow-studio','rev-parse',C+'^{tree}']).decode().strip(),'files':files,'method':'git archive exact commit; original source unchanged after build/UI; static served bytes verified in runtime.json'},indent=2))
shutil.copytree(A/'continuity/static-preview-dist',O/'artifact',dirs_exist_ok=True)
comparison=json.loads((R/'artifact-comparison.json').read_text());assert len(list((O/'artifact').rglob('*')))>17
for n,h in comparison['previewSHA256'].items():assert sha((O/'artifact'/n).read_bytes())==h
(O/'ARTIFACT_MANIFEST.tsv').write_text('path\tbytes\tsha256\n'+''.join(f"artifact/{n}\t{(O/'artifact'/n).stat().st_size}\t{h}\n" for n,h in comparison['previewSHA256'].items()))
for n in ['build.py','build.process.json','check.stdout.log','check.stderr.log','demo.stdout.log','demo.stderr.log','preview.stdout.log','preview.stderr.log','artifact-comparison.json','static-collect.py','static.process.json','static.stdout.log','static.stderr.log','analyze.py','SUMMARY.json','package.py']:
 shutil.copy2(R/n,O/n)
for n in ['controller.py','launcher.py','server.py','process.json','runtime.json','posts.json']:shutil.copy2(U/n,O/n)
for name in ['1280-actual-H-work.md','1440-actual-H-work.md']:
 shutil.copy2(U/name,O/name)
for n in ['1280-return2.json','1440-return2.json']:shutil.copy2(U/'inputs'/n,O/n)
inputs={'T2':{'source':'24baf91fa2d519fd8cd33bb5ece28ec5b32323df docs/transfer/reentry-judgment-32/input-v0/generated-v0/observer-input/T2.json','sha256':sha((U/'inputs/T2.json').read_bytes())}}
assert inputs['T2']['sha256']=='584bca013cdfcb3383a028b54dc5158ca438f8690e4a7e4420fe9a11a8b68fc7';(O/'INPUT_BINDING.json').write_text(json.dumps(inputs,indent=2))
raw={str(f.relative_to(U)):json.loads(f.read_text()) for f in U.glob('*.json') if not f.name.endswith('-visible.json') and f.name not in ['runtime.json','process.json','posts.json']}
for f in (R/'static-test').rglob('*.json'):
 raw['author-static/'+str(f.relative_to(R/'static-test'))]=json.loads(f.read_text())
raw['first-no-stdin']={f.name:json.loads(f.read_text()) for f in (R/'first-no-stdin').glob('*.json')}
index=[]
for name,b in [('raw-data.json',json.dumps(raw,ensure_ascii=False).encode()),('actions.jsonl',(U/'actions.jsonl').read_bytes()),('controller.stdout-stderr.log',(U/'controller.stdout-stderr.log').read_bytes()),('server.stdout.log',(U/'server.stdout.log').read_bytes()),('server.stderr.log',(U/'server.stderr.log').read_bytes())]:
 z=gzip.compress(b,mtime=0);assert gzip.decompress(z)==b;(O/(name+'.gz')).write_bytes(z);index.append({'path':name+'.gz','originalBytes':len(b),'originalSHA256':sha(b),'gzipSHA256':sha(z),'decompressEqual':True})
(O/'RAW_INDEX.json').write_text(json.dumps(index,indent=2))
(O/'screens').mkdir(exist_ok=True)
for i,label in enumerate(['1280-reader','1440-reader','1280-actual-file-copy','1440-preview-ready-not-imported','1280-return-before-other-action','1440-return-before-other-action']):
 f=list(U.glob('*-'+label+'.png'));assert len(f)==1;shutil.copy2(f[0],O/'screens'/f'{i+1:02d}-{label}.png')
(O/'OUTER_EXIT_RECEIPT.json').write_text(json.dumps({'UIControllerChild':0,'UIOuterExec':0,'semanticGateChild':0,'semanticGateOuterExec':0,'staticAuthorChild':0,'staticAuthorOuterCollector':0,'staticAuthorOuterExec':0,'UIStaticHTTPServerExit':-15,'meaning':'server terminated intentionally after UI collection; first no-stdin run closed without actions and is not completion evidence'},indent=2))
print('packaged',sum(f.is_file() for f in O.rglob('*')))
