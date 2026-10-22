from pathlib import Path
import csv,json,gzip,hashlib,shutil
r=Path(__file__).parent;p=r/'payload';p.mkdir(exist_ok=True);idx=[]
for n in ['build.py','runner.py','collector.py','analyze.py','package.py','SOURCE.before.json','SOURCE.after.json','SUMMARY.json','build-process.json','REPORT.md']:
 f=r/n;q=p/n;b=f.read_bytes()
 if f.suffix=='.json' and len(b)>20000:z=gzip.compress(b,mtime=0);assert gzip.decompress(z)==b;(p/(n+'.gz')).write_bytes(z);idx.append({'original':n,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gzip':n+'.gz','gzipSHA256':hashlib.sha256(z).hexdigest(),'roundTripEqual':True})
 else:shutil.copyfile(f,q)
shutil.copyfile(r/'candidate/app/continuity/tests/branch-records31_browser.py',p/'branch-records31_browser.py')
for name in ['candidate','base']:
 for sub in ['build-logs','execution']:
  for f in sorted((r/name/sub).rglob('*')):
   if not f.is_file():continue
   rel=name+'/'+str(f.relative_to(r/name));q=p/rel;q.parent.mkdir(parents=True,exist_ok=True);b=f.read_bytes()
   if f.suffix=='.jsonl' or (f.suffix=='.json' and len(b)>20000):
    z=gzip.compress(b,mtime=0);assert gzip.decompress(z)==b;dest=Path(str(q)+'.gz');dest.write_bytes(z);idx.append({'original':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gzip':str(dest.relative_to(p)),'gzipSHA256':hashlib.sha256(z).hexdigest(),'roundTripEqual':True})
   else:q.write_bytes(b)
(p/'RAW_INDEX.json').write_text(json.dumps(idx,indent=2));(p/'OUTER_EXIT_RECEIPT.json').write_text(json.dumps({'scope':'tool completion metadata transcribed, not full transcript','build':{'session':98147,'actualOuterExit':0},'candidate10':{'session':59128,'actualOuterExit':0},'base2':{'session':31834,'actualOuterExit':1},'child':'process.json subprocess.run actualChildExit; collector propagates it','server':'http-console.jsonl server-process actualReturnCode'},indent=2))
with (p/'MANIFEST.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['path','bytes','sha256'])
 for q in sorted(p.rglob('*')):
  if q.is_file() and q.name!='MANIFEST.tsv':b=q.read_bytes();w.writerow([str(q.relative_to(p)),len(b),hashlib.sha256(b).hexdigest()])
print('files',len([q for q in p.rglob('*') if q.is_file()]))
