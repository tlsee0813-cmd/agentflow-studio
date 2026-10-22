from pathlib import Path
import gzip,hashlib,json,shutil
r=Path(__file__).parent;p=r/'payload';p.mkdir(exist_ok=True);sha=lambda b:hashlib.sha256(b).hexdigest();index=[];comp=[];seen={}
def store(f,logical):
 b=f.read_bytes();h=sha(b)
 if h in seen:stored=seen[h]
 else:
  gz=len(b)>16000 or f.suffix=='.jsonl';stored='raw/'+logical+('.gz' if gz else '');t=p/stored;t.parent.mkdir(parents=True,exist_ok=True);data=gzip.compress(b,mtime=0) if gz else b;t.write_bytes(data);seen[h]=stored
  if gz:assert gzip.decompress(data)==b;comp.append({'stored':stored,'originalBytes':len(b),'originalSHA256':h,'gzipBytes':len(data),'gzipSHA256':sha(data),'roundtripByteEqual':True})
 index.append({'logical':logical,'originalBytes':len(b),'originalSHA256':h,'stored':stored,'gzip':stored.endswith('.gz')})
for n in ['REPORT.md','SUMMARY.json','SOURCE.before.json','SOURCE.after.json','SOURCE_BINDING.json','OUTER_EXIT_RECEIPT.json']:
 shutil.copy2(r/n,p/n)
for n in ['build.py','runner.py','collector.py','judge-collector.py','analyze.py','package.py']:
 t=p/'code'/n;t.parent.mkdir(exist_ok=True);shutil.copy2(r/n,t)
for n in ['controller.py','frozen-controller.py','frozen-judge.py','launcher.py','commands.jsonl']:
 t=p/'code/controlled'/n;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(r/'controlled'/n,t)
t=p/'code/exact-pc12_browser.py';shutil.copy2(r/'candidate/app/continuity/tests/pc12_browser.py',t)
for f in sorted(r.glob('*.log')):store(f,f.name)
store(r/'build-process.json','build-process.json')
for f in sorted((r/'controlled').rglob('*')):
 if not f.is_file() or f.suffix in ['.png','.py'] or f.name.endswith('-visible.json') or f.name=='commands.jsonl':continue
 store(f,str(f.relative_to(r)))
for name in ['candidate','original673']:
 for f in sorted((r/name/'execution').rglob('*')):
  if f.is_file() and f.suffix!='.png':store(f,str(f.relative_to(r)))
selected={'controlled/roundtrip-release-before.png':'screens/01-history-work-before-release.png','controlled/021-roundtrip-release.png':'screens/02-history-work-after-release-no-move.png','controlled/009-sameview-release.png':'screens/03-same-work-positive-review-reveal.png'}
for logical,dest in selected.items():t=p/dest;t.parent.mkdir(exist_ok=True);shutil.copy2(r/logical,t)
images=[]
for sub in ['controlled','candidate/execution','original673/execution']:
 for f in sorted((r/sub).rglob('*.png')):logical=str(f.relative_to(r));images.append({'localOriginal':logical,'bytes':f.stat().st_size,'sha256':sha(f.read_bytes()),'publishedRepresentative':selected.get(logical)})
views=[]
for f in sorted((r/'controlled').glob('*-visible.json')):views.append({'localOriginal':str(f.relative_to(r)),'bytes':f.stat().st_size,'sha256':sha(f.read_bytes()),'rawContent':'same label in controlled/actions.jsonl; no duplicate full DOM dump'})
(p/'PNG_INDEX.json').write_text(json.dumps(images,indent=2));(p/'VISIBLE_INDEX.json').write_text(json.dumps(views,indent=2));(p/'RAW_INDEX.json').write_text(json.dumps(index,indent=2));(p/'COMPRESSION_INDEX.json').write_text(json.dumps(comp,indent=2))
with (p/'MANIFEST.tsv').open('w') as out:
 out.write('path\tbytes\tsha256\n')
 for f in sorted(p.rglob('*')):
  if f.is_file() and f.name!='MANIFEST.tsv':b=f.read_bytes();out.write(f'{f.relative_to(p)}\t{len(b)}\t{sha(b)}\n')
print(json.dumps({'files':sum(f.is_file() for f in p.rglob('*')),'bytes':sum(f.stat().st_size for f in p.rglob('*') if f.is_file()),'manifestSHA256':sha((p/'MANIFEST.tsv').read_bytes())},indent=2))
