from pathlib import Path
import json,hashlib
r=Path(__file__).parent;binding=json.loads((r/'SOURCE.before.json').read_text());after=[];summary=[]
for e in binding:
 name=e['name'];d=r/name;changed=[]
 for x in e['files']:
  if hashlib.sha256((d/x['path']).read_bytes()).hexdigest()!=x['sha256']:changed.append(x['path'])
 assert not changed
 after.append({'name':name,'commit':e['commit'],'changedSourceFiles':changed,'appSHA256':hashlib.sha256((d/'app/continuity/src/client/app.ts').read_bytes()).hexdigest(),'testSHA256':hashlib.sha256((d/'app/continuity/tests/branch-records31_browser.py').read_bytes()).hexdigest(),'compiledFiles':[{'path':str(p.relative_to(d)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((d/'app/continuity/dist/public').rglob('*')) if p.is_file()]})
 raw=d/'execution/raw';obs=[json.loads(x) for x in (raw/'branch-records31-observations.jsonl').read_text().splitlines()];events=[json.loads(x) for x in (raw/'http-console.jsonl').read_text().splitlines()];new=[]
 for o in obs:
  if 'test_05_' in o['test'] and o['label'] in ['native page wheel 비영점 준비','signal event and following frames; first failure not replaced']:
   v=o['actual']
   def mini(s):
    if not s:return None
    return {k:s.get(k) for k in ['page','x','viewport','layout','map','owner','subtreeOpen','firstOwner','firstLine']}
   new.append({'test':o['test'],'pc':o['pc'],'label':o['label'],'actual':{'ok':v.get('ok'),'before':mini(v.get('before')),'first':mini(v.get('first')),'frames':[mini(z) for z in v.get('frames',[])]} if 'frames' in v else mini(v)})
 summary.append({'name':name,'process':json.loads((d/'execution/process.json').read_text()),'environment':json.loads((raw/'browser-environment.json').read_text()),'HTTPResponses':sum(x['kind']=='HTTP' for x in events),'allHTTPDiskEqual':all(x['bodyEqualsDisk'] and x['status']==200 for x in events if x['kind']=='HTTP'),'pageerrors':[x for x in events if x['kind']=='pageerror'],'captureErrors':[x for x in events if x['kind']=='capture-error'],'serverExits':[x for x in events if x['kind']=='server-process'],'newScenes':new})
(r/'SOURCE.after.json').write_text(json.dumps(after,indent=2));(r/'SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
for x in summary:
 print(x['name'],x['process']['actualChildExit'])
 for s in x['newScenes']:
  v=s['actual'];print(s['pc'],s['label'],v.get('page') if 'page' in v else [v['before']['page'],v['first']['page'],[y['page'] for y in v['frames']]])
