from pathlib import Path
import json,hashlib,subprocess,shutil,gzip,datetime
R=Path(__file__).parent;O=R/'evidence';sha=lambda b:hashlib.sha256(b).hexdigest()
r=json.loads((O/'raw.json').read_text());summary=[]
for s in r['scenes']:
 hint=[x for x in s['detail']['rows'] if x['text'].startswith('요청 1개')][0];scale=s['authorMetric']['scale'];rect=hint['range'][0];summary.append({'scene':s['name'],'countText':hint['text'],'allAncestorClip':hint['clip'],'textRange':rect,'visibleRangeHeightScreenPx':max(0,min(rect['bottom'],hint['clip']['bottom'])-max(rect['top'],hint['clip']['top'])),'font':hint['font'],'authorInkMetric':s['authorMetric']['cards']['P']['hidden']})
(O/'SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
bind=[]
for label,commit,target in [('baseline','575bb7452044e0d987453a24e31680d2d8077b6c',Path('/workspace/browser-env/task33-reader-layout/candidate/app')),('candidate',r['sourceCandidate'],R/'candidate/app')]:
 for path in ['continuity/src/client/app.ts','continuity/public/styles.css','continuity/public/index.html']:
  b=subprocess.check_output(['git','-C','/workspace/agentflow-studio','show',commit+':app/'+path]);d=(target/path).read_bytes();assert b==d;bind.append({'label':label,'commit':commit,'path':path,'bytes':len(b),'remoteAndDiskAfterSHA':sha(b)})
 for h in r['HTTP']:
  if h['target']==label:assert h['diskSHA']==sha((target/'continuity/dist/public'/h['path']).read_bytes())
for p in ['continuity/tests/map-signals34-fixtures.mjs','continuity/tests/map-signals34_measure.py']:
 b=(R/'candidate/app'/p).read_bytes();bind.append({'candidateHelper':p,'bytes':len(b),'sha256':sha(b)})
(O/'SOURCE_BINDING.json').write_text(json.dumps(bind,indent=2))
for name in ['check.py','collect.py','collector.json','stdout.log','stderr.log','finalize.py']:shutil.copy2(R/name,O/name)
for name in ['first-error','second-error']:shutil.copytree(R/name,O/name,dirs_exist_ok=True)
for f in R.glob('*.json'):
 if f.name!='collector.json':shutil.copy2(f,O/f.name)
(O/'environment.txt').write_text(subprocess.check_output(['/workspace/browser-env/tools/node_modules/.bin/node','--version'],text=True)+subprocess.check_output(['/workspace/browser-env/venv/bin/python','-m','pip','show','playwright'],text=True)+subprocess.check_output(['fc-match','sans-serif'],text=True)+subprocess.check_output(['uname','-a'],text=True))
raw=(O/'raw.json').read_bytes();z=gzip.compress(raw,mtime=0);assert gzip.decompress(z)==raw;(O/'raw.json.gz').write_bytes(z);(O/'RAW_HASH.json').write_text(json.dumps({'uncompressedBytes':len(raw),'uncompressedSHA256':sha(raw),'gzipSHA256':sha(z),'roundtripEqual':True},indent=2));(O/'raw.json').unlink()
(O/'EXPECTED_FAILURE_GATE.py').write_text("import gzip,json,pathlib\np=pathlib.Path(__file__).parent\nr=json.loads(gzip.decompress((p/'raw.json.gz').read_bytes()))\ns=next(x for x in r['scenes'] if x['name']=='candidate-no-note')\nh=next(x for x in s['authorMetric']['cards']['P']['hidden'] if x['el']=='hint')\nassert not h['inkFullyHidden'], 'required existing count ink fully clipped: '+str(h)\n")
with (O/'gate.stdout.log').open('w') as out,(O/'gate.stderr.log').open('w') as err:g=subprocess.run(['/workspace/browser-env/venv/bin/python',str(O/'EXPECTED_FAILURE_GATE.py')],stdout=out,stderr=err)
(O/'gate.exit.json').write_text(json.dumps({'actualChildExit':g.returncode,'outerCollectorExit':g.returncode,'meaning':'intentional nonzero for reproduced visibility defect; UI collection itself0'},indent=2));assert g.returncode==1
print('binding verified; expected defect gate exit1')
