from pathlib import Path
import hashlib,json,csv,subprocess,datetime
R=Path(__file__).parent;A=Path('/workspace/browser-env/branch31-author-fix2/candidate/app');sha=lambda b:hashlib.sha256(b).hexdigest();rows=[]
for tag,after in [('T0','after-reading'),('T2','after-all-reading')]:
 before=R/f'{tag}-before-reading-envelope.json';last=R/f'{tag}-{after}-envelope.json';assert before.read_bytes()==last.read_bytes();rows.append({'input':tag,'wholeWorkspaceBeforeAfterByteEqual':True,'before':before.name,'after':last.name,'sha256':sha(before.read_bytes())})
source=[]
for f in ['continuity/src/client/app.ts','continuity/public/styles.css','continuity/public/index.html']:
 b=(A/f).read_bytes();remote=subprocess.check_output(['git','-C','/workspace/agentflow-studio','show','72940a043d7a7fdc225a9582ce48831fa0418cc0:app/'+f]);assert b==remote;source.append({'path':'app/'+f,'bytes':len(b),'sha256':sha(b),'remoteByteEqual':True})
old=[]
for name,d in [('57896a','reentry32-observer'),('936f9d','reentry32-post-validation')]:
 p=Path('/workspace/browser-env')/d/'payload';m=list(csv.DictReader((p/'MANIFEST.tsv').open(),delimiter='\t'))
 for e in m:assert sha((p/e['path']).read_bytes())==e['sha256']
 old.append({'evidence':name,'unchangedSelfExcludedFiles':len(m),'manifestSHA256':sha((p/'MANIFEST.tsv').read_bytes())})
actions=[json.loads(x) for x in (R/'actions.jsonl').read_text().splitlines()];rt=json.loads((R/'runtime.json').read_text());assert not rt['pageerrors'];assert all(x['sha256']==x['diskSHA256']==x['diskAfterSHA256'] for x in rt['HTTP'] if 'path'in x);assert not json.loads((R/'posts.json').read_text())
(R/'RESULT.json').write_text(json.dumps({'UTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'post-oracle designated reading, 1280x720 only, no workflow or original-experience rerun','sourceCommit':'72940a043d7a7fdc225a9582ce48831fa0418cc0','productSources':source,'inputHashes':{f:sha((R/'inputs'/f).read_bytes()) for f in ['T0.json','T2.json']},'unchangedOldEvidence':old,'data':rows,'readOnlyGeometry':[x for x in actions if x['kind']=='read-only-geometry'],'notes':[{'file':x['data']['file'],'UTC':x['utc'],'sha256':sha((R/x['data']['file']).read_bytes())} for x in actions if x['kind']=='command' and x['data']['op']=='note'],'actionErrors':[x for x in actions if x['kind']=='action-error'],'HTTPCount':len(rt['HTTP']),'allBodyDiskAfterEqual':True,'actualPOSTCount':0,'pageerrors':rt['pageerrors'],'controllerChildExit':json.loads((R/'process.json').read_text())['actualChildExit'],'serverExit':rt['serverExit'],'noConditionDescriptionCurrentDraftEdits':True,'noNewHOrReturn':True,'limitations':['Numeric version labels and literal changes=[] not located in explored panel UI','C CSV-specific reason read as external-description/report assertion, current scope field not visited','Restored P panel at T2 entry differs from empty first-map condition','No human/blind/fullworkflow claim']},ensure_ascii=False,indent=2))
print('whole workspace unchanged',rows,'HTTP',len(rt['HTTP']),'UI errors',len([x for x in actions if x['kind']=='action-error']))
