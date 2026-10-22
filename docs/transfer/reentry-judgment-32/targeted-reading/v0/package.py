from pathlib import Path
import json,hashlib,gzip,csv
R=Path(__file__).parent;P=R/'payload';P.mkdir(exist_ok=True);sha=lambda b:hashlib.sha256(b).hexdigest();raw=[]
def put(n,b,z=False):
 q=P/n;q.parent.mkdir(parents=True,exist_ok=True)
 if z:
  c=gzip.compress(b,mtime=0);assert gzip.decompress(c)==b;q=Path(str(q)+'.gz');q.write_bytes(c);raw.append({'original':n,'bytes':len(b),'sha256':sha(b),'gzip':str(q.relative_to(P)),'gzipSHA256':sha(c),'roundTripEqual':True})
 else:q.write_bytes(b)
a=[json.loads(x) for x in (R/'actions.jsonl').read_text().splitlines()];screens={x['seq']:x['data']['visible'] for x in a if x['kind']=='screen'};views=[]
for f in sorted(R.glob('*-visible.json')):
 seq=int(f.name.split('-')[0]);assert json.dumps(screens[seq],ensure_ascii=False,indent=2).encode()==f.read_bytes();views.append({'alias':f.name,'sha256':sha(f.read_bytes()),'canonical':'actions.jsonl.gz screen seq'+str(seq),'exactReconstruct':'json.dumps(visible,ensure_ascii=False,indent=2) UTF8','byteVerified':True})
put('VIEW_INDEX.json',json.dumps(views,indent=2).encode());snaps=[]
for f in sorted(R.glob('*-envelope.json')):
 b=f.read_bytes();s=sha(b);path='saved-snapshots/'+s+'.json'
 if not (P/(path+'.gz')).exists():put(path,b,True)
 snaps.append({'alias':f.name,'sha256':s,'bytes':len(b),'payload':path+'.gz'})
put('SNAPSHOT_INDEX.json',json.dumps(snaps,indent=2).encode())
patterns=['*T0-preview-owner.png','*T0-description-evidence-read.png','*T2-current-summary-top.png','*T2-history-first-version.png','*T2-previous20-evidence-read.png','*T2-export-owner.png','*T2-export-held-summary.png','*T2-export-held-source-read.png'];chosen={next(R.glob(p)).name for p in patterns};png=[]
for f in sorted(R.glob('*.png')):
 b=f.read_bytes();pub=f.name in chosen;png.append({'file':f.name,'bytes':len(b),'sha256':sha(b),'publishedRepresentative':pub})
 if pub:put('screens/'+f.name,b)
put('PNG_INDEX.json',json.dumps(png,indent=2).encode())
for f in sorted(R.iterdir()):
 if not f.is_file() or f.suffix=='.png' or f.name.endswith(('-visible.json','-envelope.json')) or f.name in ['publish.py','publish-receipt.json'] or f.suffix=='.index':continue
 b=f.read_bytes();put(f.name,b,f.suffix=='.jsonl' or len(b)>20000 and f.suffix in ['.json','.log'])
put('INPUT_REFERENCE.json',json.dumps({'commit':'24baf91fa2d519fd8cd33bb5ece28ec5b32323df','prefix':'docs/transfer/reentry-judgment-32/input-v0/generated-v0/observer-input','T0SHA256':sha((R/'inputs/T0.json').read_bytes()),'T2SHA256':sha((R/'inputs/T2.json').read_bytes()),'duplicateInputsNotUploaded':True},indent=2).encode());put('OUTER_EXIT_RECEIPT.json',json.dumps({'scope':'tool completion metadata transcribed, not full transcript','main':{'session':21815,'actualOuterExit':0,'actualChild':'process.json 0','actualServer':'runtime.json -15'},'readOnlyPostAudit':{'chunk':'370bd8','actualExit':0},'nonProductActionError':'actions.jsonl strict-mode summary selector, preserved'},indent=2).encode());put('RAW_INDEX.json',json.dumps(raw,indent=2).encode())
with (P/'MANIFEST.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['path','bytes','sha256'])
 for q in sorted(P.rglob('*')):
  if q.is_file() and q.name!='MANIFEST.tsv':b=q.read_bytes();w.writerow([str(q.relative_to(P)),len(b),sha(b)])
print('files',len([q for q in P.rglob('*') if q.is_file()]),'PNG',len(chosen))
