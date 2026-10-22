from pathlib import Path
import json,hashlib,gzip,csv,shutil
r=Path(__file__).parent;a=Path('/workspace/browser-env/integration30-31/candidate/app');p=r/'payload';p.mkdir(exist_ok=True);idx=[]
before=json.loads(Path('/workspace/browser-env/integration30-31/SOURCE.before.json').read_text());changed=[x['path'] for x in before['files'] if hashlib.sha256((a.parent/x['path']).read_bytes()).hexdigest()!=x['sha256']];assert not changed
src={'commit':before['commit'],'tree':before['tree'],'readOnlyExistingBuiltApp':str(a),'allExtractedSourceFilesBeforeAfterEqual':len(before['files']),'changed':changed,'appSHA256':hashlib.sha256((a/'continuity/src/client/app.ts').read_bytes()).hexdigest(),'cssSHA256':hashlib.sha256((a/'continuity/public/styles.css').read_bytes()).hexdigest(),'checkerSHA256':hashlib.sha256((r/'check.py').read_bytes()).hexdigest(),'collectorSHA256':hashlib.sha256((r/'collector.py').read_bytes()).hexdigest(),'fixtureSHA256':hashlib.sha256((r/'normal-ui-6-card-backup.json').read_bytes()).hexdigest(),'fullOriginalSourceIndex':'integration-30-31/independent-a/v0/SOURCE.before.json.gz'}
(r/'SOURCE_BINDING.json').write_text(json.dumps(src,indent=2));rows=[]
for l in (r/'ui.jsonl').read_text().splitlines():
 x=json.loads(l)
 if x['label']=='MINIMAL actual click full sequence':
  m=x['raw']['measurement'];rows.append({'pc':x['viewport'],'beforeXY':m['before']['xy'],'firstXY':m['first']['xy'],'frameXY':[f['xy'] for f in m['frames']],'finalXY':m['result']['after']['xy'],'beforeMax':m['before']['max'],'firstMax':m['first']['max'],'beforeDocument':m['before']['document'],'firstDocument':m['first']['document'],'documentScrollend':m['pageScrollend'],'observedScrollendTargets':[e['target'] for e in m['scrollendEvents']],'completion':m['result']['reason'],'firstOwnerGlyphs':[{k:z[k] for k in ['full','hit','positive']} for z in x['raw']['firstOwnerGlyph']['lines']]})
(r/'SUMMARY.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
(r/'OUTER_EXIT_RECEIPT.json').write_text(json.dumps({'scope':'tool completion metadata transcribed, not full transcript','firstMeasurement':{'session':64310,'outerExit':1},'finalFrozenMeasurement':{'session':60886,'outerExit':1},'child':'process.json subprocess.run returncode; collector sys.exit(childcode)','server':'runtime.json separate terminate exit -15'},indent=2))
for f in sorted(r.rglob('*')):
 if not f.is_file() or p in f.parents or '__pycache__' in f.parts or f.name in ['publish.py','publish-receipt.json'] or f.suffix=='.index':continue
 rel=str(f.relative_to(r));b=f.read_bytes();dest=p/rel;dest.parent.mkdir(parents=True,exist_ok=True)
 if f.suffix=='.jsonl' or (f.suffix=='.json' and len(b)>20000):
  z=gzip.compress(b,mtime=0);assert gzip.decompress(z)==b;dest=Path(str(dest)+'.gz');dest.write_bytes(z);idx.append({'original':rel,'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gzip':str(dest.relative_to(p)),'gzipSHA256':hashlib.sha256(z).hexdigest(),'roundTripEqual':True})
 else:dest.write_bytes(b)
(p/'RAW_INDEX.json').write_text(json.dumps(idx,indent=2))
with (p/'MANIFEST.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['path','bytes','sha256'])
 for q in sorted(p.rglob('*')):
  if q.is_file() and q.name!='MANIFEST.tsv':b=q.read_bytes();w.writerow([str(q.relative_to(p)),len(b),hashlib.sha256(b).hexdigest()])
print(src['checkerSHA256'],len([q for q in p.rglob('*') if q.is_file()]))
