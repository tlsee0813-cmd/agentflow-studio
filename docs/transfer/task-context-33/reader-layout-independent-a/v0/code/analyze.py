from pathlib import Path
import json,hashlib,datetime
r=Path(__file__).parent;u=r/'ui';T='T_5ff4c54d-e118-4174-90ba-1f222d8b03a4';sha=lambda b:hashlib.sha256(b).hexdigest()
def state(n):return json.loads((u/n).read_text())['entries'][0]['project']
def task(p):return next(t for t in p['tasks'] if t['id']==T)
summary={'source':'843ca3993615824452bfc80a6c0c4c65d35df376','tree':json.load(open(r/'SOURCE.before.json'))['tree'],'sourceOverlay':False,'UI':{},'firstFoldLimit':{}}
for w in ['1280','1440']:
 b=state(w+'-before-reading-envelope.json');read=state(w+'-reader-before-continue-envelope.json');keys=state(w+'-after-details-keys-envelope.json');n=state(w+'-after-N-envelope.json');h=state(w+'-after-H-envelope.json');sel=state(w+'-after-file-select-envelope.json');bt=task(b);nt=task(n);ht=task(h)
 checks={'readOnlyStateUnchanged':b==read==keys,'NOnlyEditedTaskChange':nt=={**bt,'manual':{**bt['manual'],'next':nt['manual']['next']}},'otherTasksUnchanged':all(next(t for t in n['tasks'] if t['id']==old['id'])==old for old in b['tasks'] if old['id']!=T),'areasRelationsBasesUnchanged':n['space']==b['space'] and n['bases']==b['bases'],'draftPreserved':all(n[k]==b[k] for k in ['draft','draftKind','answerDraft']),'regionOnlyNoH':state(w+'-before-file-region-envelope.json')==state(w+'-after-file-region-envelope.json')==n,'onlyActualCopyAddsH':len(ht['handoffs'])==len(bt['handoffs'])+1 and ht['handoffs'][:-1]==bt['handoffs'],'HExactManualFour':ht['handoffs'][-1]['work']==nt['manual'],'selectionNotImport':sel==h,'noNewReportInShortSegment':len(sel['tasks'])==len(b['tasks']),'currentOnlyExplicitContinued':sel['currentTaskId']==T,'sourcesPreserved':sel['sources']==b['sources']}
 assert all(checks.values()),checks
 g=json.load(open(u/(w+'-final-reader-first-geometry.json')));by={v['selector']:v.get('geometry') for v in g};summary['firstFoldLimit'][w]={'firstWindowY':by['#task-next-action']['xy'][1],'primaryDraftAction':by['#task-next-action'],'draftTarget':by['#task-next-target'],'newContinue':by['#task-view-continue'],'continueTarget':by['#task-continue-label']}
 summary['UI'][w]={'checks':checks,'manualBefore':bt['manual'],'manualAfter':nt['manual'],'actualH':ht['handoffs'][-1]['returnId'],'firstContext':'learned observer; 1280 then 1440','fileSelectionWithoutAcceptance':True}
# Exact tests remain independent execution units.
summary['exactPC12']=json.load(open(r/'candidate/execution/process.json'));assert summary['exactPC12']['actualChildExit']==0
summary['exactREPORT16']=json.load(open(r/'report16/final/process.json'));assert summary['exactREPORT16']['actualChildExit']==0
summary['controlled']=json.load(open(r/'controlled/judgment.json'));assert summary['controlled']['noAutomaticRevealAfterViewExcursionExpected']
for name in ['ui','controlled']:
 run=json.load(open(r/name/'runtime.json'));assert not run['pageerrors'];assert all(x.get('sha256')==x.get('diskSHA256')==x.get('diskAfterSHA256') and x.get('status')==200 for x in run['HTTP'] if 'path' in x);assert not [x for x in run['HTTP'] if 'captureError' in x]
 summary[name+'Runtime']={k:run[k] for k in ['source','Node','PW','browser','pageerrors','serverExit','paidAI']};summary[name+'Runtime']['HTTPCount']=len(run['HTTP']);summary[name+'Runtime']['HTTPDiskBeforeAfterEqual']=True
summary['actionErrors']=[x for x in map(json.loads,(u/'actions.jsonl').read_text().splitlines()) if x['kind']=='action-error'];assert not summary['actionErrors']
base=json.load(open(r/'SOURCE.before.json'));rows=[]
for row in base['files']:
 b=(r/'candidate'/row['path']).read_bytes();assert len(b)==row['bytes'] and sha(b)==row['sha256'];rows.append({**row,'afterSHA256':sha(b),'afterBytes':len(b)})
(r/'SOURCE.after.json').write_text(json.dumps({'afterUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'allSourceBytesUnchanged':True,'source':base['source'],'files':rows},indent=2));(r/'SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print('Exact REPORT16 2 and PC12 6 pass, frozen guard pass, two short UI segments pass; T2 first-fold limit retained separately.')
