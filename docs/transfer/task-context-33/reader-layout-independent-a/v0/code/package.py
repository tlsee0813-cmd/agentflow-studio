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
for n in ['REPORT.md','SUMMARY.json','SOURCE.before.json','SOURCE.after.json','SOURCE_BINDING.json','FINAL_HEAD_BINDING.json','OLD_T2_COMPARISON.json','OUTER_EXIT_RECEIPT.json']:
 shutil.copy2(r/n,p/n)
for n in ['build.py','runner.py','collector.py','report16-runner.py','report16-collector.py','judge-collector.py','analyze.py','package.py']:
 t=p/'code'/n;t.parent.mkdir(exist_ok=True);shutil.copy2(r/n,t)
for folder,names in {'ui':['controller.py','launcher.py'],'controlled':['controller.py','frozen-controller.py','frozen-judge.py','launcher.py','commands.jsonl'],'overlap':['controller.py','launcher.py','judge.py','collector.py']}.items():
 for n in names:
  t=p/'code'/folder/n;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(r/folder/n,t)
for n in ['pc12_browser.py','report16_browser.py']:
 t=p/'code/exact-tests'/n;t.parent.mkdir(exist_ok=True);shutil.copy2(r/'candidate/app/continuity/tests'/n,t)
for f in sorted(r.glob('*.log')):store(f,f.name)
store(r/'build-process.json','build-process.json')
for sub in ['ui','controlled','overlap','candidate/execution','report16/final']:
 for f in sorted((r/sub).rglob('*')):
  if not f.is_file() or f.suffix in ['.png','.py'] or f.name.endswith('-visible.json') or f.name=='commands.jsonl':continue
  store(f,str(f.relative_to(r)))
# Source command history / visible DOM lives exactly once in actions; standalone dumps indexed only.
views=[]
for sub in ['ui','controlled','overlap']:
 for f in sorted((r/sub).glob('*-visible.json')):views.append({'localOriginal':str(f.relative_to(r)),'bytes':f.stat().st_size,'sha256':sha(f.read_bytes()),'rawContent':'same label in actions.jsonl; read-only DOM collected before screenshot'})
selections=[('report16/final/raw/F10-1280-first-screen-original-assertion.png','screens/01-REPORT16-1280-first-screen.png'),('report16/final/raw/F10-1440-first-screen-original-assertion.png','screens/02-REPORT16-1440-first-screen.png'),('ui/*-1280-final-reader-first.png','screens/03-T2-1280-import-notice-first-fold-limit.png'),('ui/*-1440-final-reader-first.png','screens/04-T2-1440-first-reader.png'),('ui/*-1280-key-Space-open-details.png','screens/05-1280-native-key-details-open.png'),('ui/*-1440-final-file-selection-first.png','screens/06-1440-selected-not-imported.png'),('controlled/021-roundtrip-release.png','screens/07-guard-no-reveal-after-roundtrip.png'),('overlap/*-overlap-after-B-release.png','screens/08-overlap-B-selected-review.png')]
selected={}
for pat,dest in selections:
 fs=list(r.glob(pat));assert len(fs)==1,(pat,fs);f=fs[0];t=p/dest;t.parent.mkdir(exist_ok=True);shutil.copy2(f,t);selected[str(f.relative_to(r))]=dest
images=[]
for sub in ['ui','controlled','overlap','candidate/execution','report16/final']:
 for f in sorted((r/sub).rglob('*.png')):logical=str(f.relative_to(r));images.append({'localOriginal':logical,'bytes':f.stat().st_size,'sha256':sha(f.read_bytes()),'publishedRepresentative':selected.get(logical)})
(p/'PNG_INDEX.json').write_text(json.dumps(images,indent=2));(p/'VISIBLE_INDEX.json').write_text(json.dumps(views,indent=2));(p/'RAW_INDEX.json').write_text(json.dumps(index,indent=2));(p/'COMPRESSION_INDEX.json').write_text(json.dumps(comp,indent=2))
with (p/'MANIFEST.tsv').open('w') as out:
 out.write('path\tbytes\tsha256\n')
 for f in sorted(p.rglob('*')):
  if f.is_file() and f.name!='MANIFEST.tsv':b=f.read_bytes();out.write(f'{f.relative_to(p)}\t{len(b)}\t{sha(b)}\n')
print(json.dumps({'files':sum(f.is_file() for f in p.rglob('*')),'bytes':sum(f.stat().st_size for f in p.rglob('*') if f.is_file()),'manifestSHA256':sha((p/'MANIFEST.tsv').read_bytes()),'PNG':len(selected)},indent=2))
