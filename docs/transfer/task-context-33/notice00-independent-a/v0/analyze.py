from pathlib import Path
import json,hashlib
R=Path(__file__).parent;before=json.loads((R/'SOURCE.before.json').read_text());after=[];summary=[]
for row in before:
 name=row['name'];d=R/name;changed=[x['path'] for x in row['files'] if hashlib.sha256((d/x['path']).read_bytes()).hexdigest()!=x['sha256']];assert not changed
 after.append({'name':name,'source':row['head'],'changed':changed,'appSHA256':hashlib.sha256((d/'app/continuity/src/client/app.ts').read_bytes()).hexdigest(),'testSHA256':hashlib.sha256((d/'app/continuity/tests/pc12_browser.py').read_bytes()).hexdigest(),'compiled':[{'path':str(p.relative_to(d)),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()} for p in sorted((d/'app/continuity/dist/public').rglob('*')) if p.is_file()]})
 raw=d/'execution/raw';events=[json.loads(x) for x in (raw/'http-console.jsonl').read_text().splitlines()];http=[x for x in events if x['kind']=='HTTP'];assert all(x['bodyEqualsDisk'] and x['status']==200 for x in http)
 summary.append({'source':name,'commit':row['head'],'process':json.loads((d/'execution/process.json').read_text()),'environment':json.loads((raw/'browser-environment.json').read_text()),'notices':[x for x in events if x['kind']=='notice-after-native-continue-click'],'HTTPCount':len(http),'allActualBodyDiskEqual':True,'pageerrors':[x for x in events if x['kind']=='pageerror'],'captureErrors':[x for x in events if x['kind']=='capture-error'],'serverExits':[x for x in events if x['kind']=='server-process']})
(R/'SOURCE.after.json').write_text(json.dumps(after,indent=2));(R/'SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
for x in summary:print(x['source'],x['process']['actualChildExit'],len(x['notices']),x['pageerrors'],x['captureErrors'])
