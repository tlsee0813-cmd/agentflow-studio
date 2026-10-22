from pathlib import Path
import gzip,hashlib,json,shutil,csv
r=Path(__file__).parent;p=r/'payload';p.mkdir(exist_ok=True);sha=lambda b:hashlib.sha256(b).hexdigest();index=[];comp=[];seen={}
def store(f,logical):
 b=f.read_bytes();h=sha(b)
 if h in seen:stored=seen[h]
 else:
  gz=len(b)>16000 or f.suffix=='.jsonl';stored='raw/'+logical+('.gz' if gz else '');target=p/stored;target.parent.mkdir(parents=True,exist_ok=True);data=gzip.compress(b,mtime=0) if gz else b;target.write_bytes(data);seen[h]=stored
  if gz:assert gzip.decompress(data)==b;comp.append({'stored':stored,'originalBytes':len(b),'originalSHA256':h,'gzipBytes':len(data),'gzipSHA256':sha(data),'roundtripByteEqual':True})
 index.append({'logical':logical,'originalBytes':len(b),'originalSHA256':h,'stored':stored,'gzip':stored.endswith('.gz')})
for name in ['REPORT.md','SUMMARY.json','SOURCE.before.json','SOURCE.after.json','SOURCE_BINDING.json','PREPARATION_NOTES.md','OUTER_EXIT_RECEIPT.json','FINAL_GATE.json']:
 shutil.copy2(r/name,p/name)
for name in ['build.py','exact-runner.py','exact-collector.py','report16-runner.py','report16-collector.py','analyze.py','final-gate.py','package.py']:
 target=p/'code'/name;target.parent.mkdir(exist_ok=True);shutil.copy2(r/name,target)
for name in ['ui','delay','baseline-ui']:
 for n in ['controller.py','launcher.py']:
  t=p/'code'/name/n;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(r/name/n,t)
for name in ['pc12_browser.py','report16_browser.py']:
 t=p/'code/exact-tests'/name;t.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(r/'candidate/app/continuity/tests'/name,t)
for f in sorted(r.glob('*.log')):store(f,f.name)
store(r/'build-process.json','build-process.json');store(r/'final-gate.process.json','final-gate.process.json')
for sub in ['ui','delay','baseline-ui','exact-tests','report16']:
 for f in sorted((r/sub).rglob('*')):
  if not f.is_file() or f.suffix=='.png' or f.name.endswith('-visible.json') or f.name in ['controller.py','launcher.py']:continue
  store(f,str(f.relative_to(r)))
# Full visible samples already exist inside actions; avoid duplicating each full DOM dump.
for sub in ['ui','delay','baseline-ui']:
 views=[]
 for f in sorted((r/sub).glob('*-visible.json')):views.append({'local':str(f.relative_to(r)),'bytes':f.stat().st_size,'sha256':sha(f.read_bytes()),'rawContent':'corresponding label in raw actions.jsonl (read-only pre-screenshot DOM; screenshot may follow async frame)'})
 (p/(sub+'-VISIBLE_INDEX.json')).write_text(json.dumps(views,indent=2))
selected={
 'ui/008-1280-reader-first.png':'screens/01-1280-reader-first.png',
 'ui/011-1280-explicit-continue-first.png':'screens/02-1280-continue-first.png',
 'ui/064-1440-reader-first.png':'screens/03-1440-reader-first.png',
 'ui/083-1440-file-selection-immediate.png':'screens/04-1440-selected-not-imported.png',
 'ui/094-1440-explicit-origin-return.png':'screens/05-1440-origin-map-current-report-retained.png',
 'baseline-ui/008-original-reader-first.png':'screens/06-original729-reader-first.png',
 'delay/roundtrip-release-before.png':'screens/07-delay-roundtrip-before-release.png',
 'delay/021-roundtrip-release.png':'screens/08-delay-roundtrip-after-release.png',
 'report16/candidate/raw/F10-action-original-assertion.png':'screens/09-REPORT16-candidate-action-clipped.png',
 'report16/original729/raw/F10-action-original-assertion.png':'screens/10-REPORT16-original729-action-visible.png'}
# Sequence numbers are recovered by unique labels, without re-taking screenshots.
for logical,dest in list(selected.items()):
 f=r/logical
 if not f.exists():
  parent=f.parent;label=f.name.split('-',1)[1];matches=list(parent.glob('*-'+label));assert len(matches)==1,(logical,matches);f=matches[0];del selected[logical];selected[str(f.relative_to(r))]=dest
 t=p/dest;t.parent.mkdir(exist_ok=True);shutil.copy2(f,t)
pngs=[]
for sub in ['ui','delay','baseline-ui','exact-tests','report16']:
 for f in sorted((r/sub).rglob('*.png')):
  logical=str(f.relative_to(r));pngs.append({'localOriginal':logical,'bytes':f.stat().st_size,'sha256':sha(f.read_bytes()),'publishedRepresentative':selected.get(logical),'notPublished':'local raw retained; representative subset' if logical not in selected else None})
(p/'PNG_INDEX.json').write_text(json.dumps(pngs,indent=2));(p/'RAW_INDEX.json').write_text(json.dumps(index,indent=2));(p/'COMPRESSION_INDEX.json').write_text(json.dumps(comp,indent=2))
with (p/'MANIFEST.tsv').open('w') as out:
 out.write('path\tbytes\tsha256\n')
 for f in sorted(p.rglob('*')):
  if f.is_file() and f.name!='MANIFEST.tsv':b=f.read_bytes();out.write(f'{f.relative_to(p)}\t{len(b)}\t{sha(b)}\n')
print(json.dumps({'files':sum(f.is_file() for f in p.rglob('*')),'bytes':sum(f.stat().st_size for f in p.rglob('*') if f.is_file()),'manifestSHA256':sha((p/'MANIFEST.tsv').read_bytes()),'representativePNG':len(selected),'dedupRawOriginals':len(index),'storedRawBlobs':len(seen)},indent=2))
