from pathlib import Path
import json,hashlib,gzip,csv,shutil
R=Path(__file__).parent;P=R/'payload';P.mkdir(exist_ok=True);sha=lambda b:hashlib.sha256(b).hexdigest();raw=[]
def put(rel,b,compress=False):
 q=P/rel;q.parent.mkdir(parents=True,exist_ok=True)
 if compress:
  z=gzip.compress(b,mtime=0);assert gzip.decompress(z)==b;q=Path(str(q)+'.gz');q.write_bytes(z);raw.append({'original':rel,'bytes':len(b),'sha256':sha(b),'gzip':str(q.relative_to(P)),'gzipSHA256':sha(z),'roundTripEqual':True})
 else:q.write_bytes(b)
actions=[json.loads(x) for x in (R/'actions.jsonl').read_text().splitlines()];screens={x['seq']:x['data'] for x in actions if x['kind']=='screen'};views=[]
for f in sorted(R.glob('*-visible.json')):
 seq=int(f.name.split('-')[0]);b=f.read_bytes();assert json.dumps(screens[seq]['visible'],ensure_ascii=False,indent=2).encode()==b;views.append({'file':f.name,'bytes':len(b),'sha256':sha(b),'canonical':'actions.jsonl.gz screen seq '+str(seq),'exactReconstruct':'json.dumps(visible,ensure_ascii=False,indent=2) UTF8','byteVerified':True})
put('VIEW_INDEX.json',json.dumps(views,indent=2).encode())
ss=[]
for f in sorted(R.glob('*-envelope.json')):
 b=f.read_bytes();s=sha(b);rel='saved-snapshots/'+s+'.json';q=P/(rel+'.gz')
 if not q.exists():put(rel,b,True)
 ss.append({'alias':f.name,'sha256':s,'bytes':len(b),'payload':rel+'.gz'})
put('SNAPSHOT_INDEX.json',json.dumps(ss,indent=2).encode())
patterns=['*1280-T0-reentry-map.png','*1280-T2-card-reentry.png','*1280-T2-first-detail.png','*1280-error-owner-locate.png','*1280-actual-file-H-copy.png','*1280-result-file-review.png','*1280-return-receipt-top.png','*1280-final-map-return.png','*1440-T2-reentry.png','*1440-T2-first-detail.png','*1440-final-map-return.png'];chosen={next(R.glob(p)).name for p in patterns};png=[]
for f in sorted(R.glob('*.png')):
 b=f.read_bytes();pub=f.name in chosen;png.append({'file':f.name,'bytes':len(b),'sha256':sha(b),'publishedRepresentative':pub})
 if pub:put('screens/'+f.name,b)
put('PNG_INDEX.json',json.dumps(png,indent=2).encode())
exclude={'package.py','publish.py','publish-receipt.json'}
for f in sorted(R.iterdir()):
 if not f.is_file() or f.suffix=='.png' or f.name.endswith(('-visible.json','-envelope.json')) or f.name in exclude or f.suffix=='.index':continue
 b=f.read_bytes();put(f.name,b,f.suffix=='.jsonl' or f.name.endswith('.log') and len(b)>20000 or f.suffix=='.json' and len(b)>20000)
put('code/package.py',(R/'package.py').read_bytes())
for f in sorted((R/'inputs').glob('*observer-return2.json')):put('synthetic-returns/'+f.name,f.read_bytes())
for name in ['first-stdin-setup','first-preservation-error']:
 for f in sorted((R/name).rglob('*')):
  if f.is_file():put(name+'/'+str(f.relative_to(R/name)),f.read_bytes())
put('OUTER_EXIT_RECEIPT.json',json.dumps({'scope':'tool completion metadata transcribed, not full tool transcript','initialNonTTY':{'chunk':'9cd2e2','outerExit':0,'UI':'NOT_RUN stdinEOF'},'main':{'session':5485,'outerExit':0,'childActual':'process.json 0','serverActual':'runtime.json -15'},'firstPostdecisionAnalysis':{'chunk':'53e415','exit':1,'reason':'KeyError resultFile.taskId'},'correctedPostdecisionAnalysis':{'chunk':'ac5025','exit':0},'stdoutError':'actions.jsonl seq100, screenshot/DOM snapshot saved before print exception; no product repair'},indent=2).encode())
with (P/'MANIFEST.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['path','bytes','sha256'])
 for q in sorted(P.rglob('*')):
  if q.is_file() and q.name!='MANIFEST.tsv':b=q.read_bytes();w.writerow([str(q.relative_to(P)),len(b),sha(b)])
put('RAW_INDEX.json',json.dumps(raw,indent=2).encode())
# RAW_INDEX must be included too; manifest is the final exact self-excluded set.
with (P/'MANIFEST.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['path','bytes','sha256'])
 for q in sorted(P.rglob('*')):
  if q.is_file() and q.name!='MANIFEST.tsv':b=q.read_bytes();w.writerow([str(q.relative_to(P)),len(b),sha(b)])
print('files',len([x for x in P.rglob('*') if x.is_file()]),'bytes',sum(x.stat().st_size for x in P.rglob('*') if x.is_file()),'PNG',len(chosen))
