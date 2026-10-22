from pathlib import Path
import json,hashlib,csv,gzip,shutil
R=Path(__file__).parent;P=R/'payload';P.mkdir(exist_ok=True);sha=lambda b:hashlib.sha256(b).hexdigest();raw=[];png=[]
def put(rel,b,z=False):
 q=P/rel;q.parent.mkdir(parents=True,exist_ok=True)
 if z:
  c=gzip.compress(b,mtime=0);assert gzip.decompress(c)==b;q=Path(str(q)+'.gz');q.write_bytes(c);raw.append({'original':rel,'bytes':len(b),'sha256':sha(b),'gzip':str(q.relative_to(P)),'gzipSHA256':sha(c),'roundTripEqual':True})
 else:q.write_bytes(b)
for n in ['build.py','runner.py','collector.py','analyze.py','package.py','SOURCE.before.json','SOURCE.after.json','SUMMARY.json','build-process.json','REPORT.md']:
 f=R/n;b=f.read_bytes();put(n,b,f.suffix=='.json' and len(b)>20000)
put('exact-test/pc12_browser.py',(R/'candidate/app/continuity/tests/pc12_browser.py').read_bytes())
for name in ['candidate','base']:
 for sub in ['build-logs','execution']:
  for f in sorted((R/name/sub).rglob('*')):
   if not f.is_file():continue
   rel=name+'/'+str(f.relative_to(R/name));b=f.read_bytes()
   if f.suffix=='.png':
    pub=f.name.startswith('notice-');png.append({'path':rel,'bytes':len(b),'sha256':sha(b),'publishedRepresentative':pub})
    if not pub:continue
   put(rel,b,f.suffix=='.jsonl' or f.suffix=='.json' and len(b)>20000)
put('PNG_INDEX.json',json.dumps(png,indent=2).encode());put('RAW_INDEX.json',json.dumps(raw,indent=2).encode());put('OUTER_EXIT_RECEIPT.json',json.dumps({'scope':'tool completion metadata transcribed, not full tool transcript','build':{'session':15409,'outerExit':0},'candidate':{'session':3763,'outerExit':0},'base':{'session':24231,'outerExit':1},'child':'execution/process.json subprocess.run actualChildExit propagated','server':'raw/http-console.jsonl server-process actualReturnCode'},indent=2).encode())
with (P/'MANIFEST.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['path','bytes','sha256'])
 for q in sorted(P.rglob('*')):
  if q.is_file() and q.name!='MANIFEST.tsv':b=q.read_bytes();w.writerow([str(q.relative_to(P)),len(b),sha(b)])
print('files',len([q for q in P.rglob('*') if q.is_file()]))
