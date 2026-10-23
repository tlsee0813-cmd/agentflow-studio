from pathlib import Path
import json,hashlib,gzip,shutil,subprocess
R=Path(__file__).parent;U=R/'ui';O=R/'evidence';O.mkdir(exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def save(n,v): (O/n).write_text(json.dumps(v,ensure_ascii=False,indent=2))
checks=[]
for tag in ['T2-1280','T2-1440','mixed-1280','mixed-1440']:
 a=(U/(tag+'-before-read-envelope.json')).read_bytes();b=(U/(tag+'-after-read-envelope.json')).read_bytes();assert a==b;checks.append({'scene':tag,'readEnvelopeByteEqual':True,'sha256':sha(a)})
for w in [1280,1440]:
 a=json.loads((U/f'mixed-{w}-before-read-envelope.json').read_text())['entries'][0]['project'];b=json.loads((U/f'mixed-{w}-after-real-update-envelope.json').read_text())['entries'][0]['project']
 for k in ['currentTaskId','draft','draftKind','answerDraft','basisDraft','basisEdits','bases']:assert a[k]==b[k],k
 for k in a['space']:
  if k!='understanding':assert a['space'][k]==b['space'][k],k
 assert b['tasks'][:len(a['tasks'])]==a['tasks'] and len(b['tasks'])==len(a['tasks'])+1
 assert b['sources'][:len(a['sources'])]==a['sources'] and len(b['sources'])==len(a['sources'])+1
 t=b['tasks'][-1];r=json.loads((U/'inputs/P-current-tab-update.json').read_text());assert t['parentTaskId']==r['taskId'] and t['resultFile']['returnId']==r['returnId'] and json.loads(t['resultFile']['rawText'])==r
 checks.append({'scene':f'mixed-{w}-real-receipt','newTaskCount':1,'currentAndDraftPreserved':True,'oldTasksSourcesAndBasesPreserved':True,'spaceOnlyUnderstandingChanged':True,'exactH':r['returnId'],'exactParent':t['parentTaskId'],'newTask':t['id']})
run=json.loads((U/'runtime.json').read_text());assert not run['pageerrors'];assert all(x['sha256']==x['diskSHA256']==x['diskAfterSHA256'] and x['status']==200 for x in run['HTTP']);assert json.loads((U/'process.json').read_text())['actualChildExit']==0
src=json.loads((R/'SOURCE.before.json').read_text())
for f in src['files']:
 b=subprocess.check_output(['git','-C','/workspace/agentflow-studio','show',src['source']+':app/'+f['path']]);assert len(b)==f['bytes'] and sha(b)==f['sha256']
save('SOURCE.after.json',src);save('RESULT.json',{'scope':'baseline only; no candidate comparison','checks':checks,'semanticGateExit':0,'controllerChildExit':0,'externalTerminalExit':0,'serverExit':run['serverExit'],'pageerrors':run['pageerrors'],'knownNegativeObservations':['leaf record signal absent','long title clamp','receipt notice shifts map top +44px; camera unchanged'],'notRun':['candidate34','all suites','32 whole workflow','human usability']})
for f in [R/'SOURCE.before.json',R/'ENVIRONMENT_ENTRY_NOTE.md',U/'controller.py',U/'launcher.py',U/'runtime.json',U/'process.json',U/'posts.json',U/'inputs/P-current-tab-update.json',Path(__file__)]:
 if f.exists():shutil.copy2(f,O/f.name)
idx=[]
for f in sorted(U.iterdir()):
 if f.is_file() and (f.suffix in ['.json','.jsonl','.log']) and f.name not in ['runtime.json','process.json','posts.json']:
  raw=f.read_bytes();dest='raw/'+f.name+'.gz';(O/'raw').mkdir(exist_ok=True);gz=gzip.compress(raw,mtime=0);(O/dest).write_bytes(gz);assert gzip.decompress(gz)==raw;idx.append({'path':dest,'uncompressedBytes':len(raw),'uncompressedSHA256':sha(raw),'gzipSHA256':sha(gz)})
save('RAW_INDEX.json',idx)
patterns=['T2-1280-S1-first-map-raw.png','T2-1440-S1-first-map-raw.png','T2-1440-parent-records-entry.png','mixed-1280-S4-long-mixed-first-map-raw.png','mixed-1440-S4-long-mixed-first-map-raw.png','mixed-1280-parent-exact-records.png','mixed-1280-S5-real-receipt-update-map-raw.png','mixed-1440-S5-real-receipt-update-map-raw.png']
(O/'screens').mkdir(exist_ok=True)
for name in patterns:
 matches=list(U.glob('*-'+name));assert len(matches)==1,(name,matches);shutil.copy2(matches[0],O/'screens'/name)
print(json.dumps({'gateExit':0,'payloadFilesBeforeReport':len(list(O.rglob('*'))),'rawFiles':len(idx)},indent=2))
