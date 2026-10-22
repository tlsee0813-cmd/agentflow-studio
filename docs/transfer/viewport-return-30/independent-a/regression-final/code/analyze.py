from pathlib import Path
import json,hashlib,subprocess
r=Path(__file__).parent;before=json.loads((r/'SOURCE_BINDING.before.json').read_text());after=[];result={}
for entry in before:
 name=entry['name'];d=r/name;changed=[]
 for row in entry['files']:
  b=(d/row['path']).read_bytes()
  if hashlib.sha256(b).hexdigest()!=row['sha256']:changed.append(row['path'])
 built=[{'path':str(p.relative_to(d)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((d/'app/continuity/dist/public').rglob('*')) if p.is_file()]
 after.append({'name':name,'changedSourceFiles':changed,'compiledFiles':built})
 raw=d/'execution/raw';obs=[json.loads(x) for x in (raw/'viewport30-observations.jsonl').read_text().splitlines()];scenes={}
 def mini(v):
  return {k:v.get(k) for k in ['y','viewport','layer','saving','layout','map','transform','computedTransform','listOpen','selected','collapsed','offscreen']}
 for o in obs:
  t=o['test'];s=scenes.setdefault(t,{'pc':o['pc']})
  if o['label']=='native wheel completed before entry observer':s['departure']=o['actual']
  if o['label']=='same native click task: first map geometry':s['first']=mini(o['actual'])
  if o['label']=='separate two native frames; never replace first failure':s['frames']=[mini(v) for v in o['actual']['frames']];s['framesCompleted']=o['actual']['ok']
 events=[json.loads(x) for x in (raw/'http-console.jsonl').read_text().splitlines()]
 result[name]={'process':json.loads((d/'execution/process.json').read_text()),'environment':json.loads((raw/'browser-environment.json').read_text()),'scenes':scenes,'httpResponses':sum(x['kind']=='HTTP' for x in events),'httpBodyDiskAllEqual':all(x.get('bodyEqualsDisk',False) and x['status']==200 for x in events if x['kind']=='HTTP'),'pageerrors':[x for x in events if x['kind']=='pageerror'],'captureErrors':[x for x in events if x['kind']=='capture-error'],'serverExits':[x for x in events if x['kind']=='server-process']}
(r/'SOURCE_BINDING.after.json').write_text(json.dumps(after,indent=2));(r/'RESULT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
for name,v in result.items():
 print(name,'child',v['process']['actualChildExit'])
 for t,s in v['scenes'].items():print(t,s.get('departure'),[(x['layout']['top'],x['layout']['height'],x['map']['bottom']) for x in [s['first']]+s['frames']])
