from pathlib import Path
import json,hashlib,gzip,csv
r=Path(__file__).parent;p=r/'payload';p.mkdir(exist_ok=True);idx=[];summ=[]
for name,root in [('frozen',r),('cross-flows',r/'cross-flows')]:
 result=json.loads((root/'result.json').read_text());runtime=json.loads((root/'runtime.json').read_text());assert result.get('childExitDecision')==0
 assert all(z.get('httpSHA256')==z.get('diskSHA256')==z.get('diskAfterSHA256') for z in runtime['HTTP'])
 summ.append({'execution':name,'source':'6f264cbef15485a120614a8004f48ef05a59065d','actualChildExit':json.loads((root/'process.json').read_text())['actualChildExit'],'complete':result.get('completed'),'failures':result.get('failedChecks'),'pageerrors':runtime['pageerrors'],'HTTPCount':len(runtime['HTTP']),'allHTTPDiskBeforeAfterEqual':True,'browser':runtime['browserVersion'],'serverExit':runtime['actualServerExit']})
(r/'FINAL_SUMMARY.json').write_text(json.dumps(summ,ensure_ascii=False,indent=2));(r/'OUTER_EXIT_RECEIPT.json').write_text(json.dumps({'scope':'tool completion metadata transcribed; not full transcript','build':{'session':80713,'outerExit':0},'frozenChecker':{'session':40782,'outerExit':0},'crossFlows':{'session':85605,'outerExit':0}},indent=2))
for f in sorted(r.rglob('*')):
 if not f.is_file() or any(x in f.relative_to(r).parts for x in ['candidate','payload','__pycache__']) or f.name in ['publish.py','publish-receipt.json'] or f.suffix=='.index':continue
 rel=str(f.relative_to(r));b=f.read_bytes();q=p/rel;q.parent.mkdir(parents=True,exist_ok=True)
 if f.suffix=='.jsonl' or (f.suffix=='.json' and len(b)>20000):
  z=gzip.compress(b,mtime=0);assert gzip.decompress(z)==b;q=Path(str(q)+'.gz');q.write_bytes(z);idx.append({'original':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gzip':str(q.relative_to(p)),'gzipSHA256':hashlib.sha256(z).hexdigest(),'roundTripEqual':True})
 else:q.write_bytes(b)
(p/'RAW_INDEX.json').write_text(json.dumps(idx,indent=2))
with (p/'MANIFEST.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['path','bytes','sha256'])
 for q in sorted(p.rglob('*')):
  if q.is_file() and q.name!='MANIFEST.tsv':b=q.read_bytes();w.writerow([str(q.relative_to(p)),len(b),hashlib.sha256(b).hexdigest()])
print(len([q for q in p.rglob('*') if q.is_file()]))
