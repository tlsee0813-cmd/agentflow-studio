from pathlib import Path
import gzip,json,csv,hashlib,shutil
r=Path(__file__).parent;p=r/'payload';p.mkdir(exist_ok=True);idx=[]
for f in sorted(r.iterdir()):
 if not f.is_file() or f.name in ['publish.py','publish-receipt.json'] or f.suffix=='.index':continue
 b=f.read_bytes();dst=f.name
 if f.suffix=='.jsonl' or (f.suffix=='.json' and len(b)>20000):
  z=gzip.compress(b,mtime=0);assert gzip.decompress(z)==b;(p/(dst+'.gz')).write_bytes(z);idx.append({'original':dst,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gzip':dst+'.gz','gzipSHA256':hashlib.sha256(z).hexdigest(),'roundTripEqual':True})
 else:shutil.copyfile(f,p/dst)
shutil.copytree(r/'first-loader-error',p/'first-loader-error',dirs_exist_ok=True)
(p/'RAW_INDEX.json').write_text(json.dumps(idx,indent=2))
(p/'OUTER_EXIT_RECEIPT.json').write_text(json.dumps({'scope':'tool completion metadata transcribed, not full transcript','build':{'session':31699,'actualOuterExit':0},'firstLoader':{'chunk':'87fbf6','actualOuterExit':1},'latestUI':{'session':8361,'actualOuterExit':0},'child':'process.json actualChildExit subprocess.run.returncode','server':'runtime.json actualServerExit'},indent=2))
with (p/'MANIFEST.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['path','bytes','sha256'])
 for q in sorted(p.rglob('*')):
  if q.is_file() and q.name!='MANIFEST.tsv':b=q.read_bytes();w.writerow([str(q.relative_to(p)),len(b),hashlib.sha256(b).hexdigest()])
print('files',len([q for q in p.rglob('*') if q.is_file()]))
