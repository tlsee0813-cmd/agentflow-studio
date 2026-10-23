from pathlib import Path
import json,hashlib,re,sys,subprocess
R=Path(__file__).parent;U=R/'ui';T='T_5ff4c54d-e118-4174-90ba-1f222d8b03a4';sha=lambda b:hashlib.sha256(b).hexdigest();summary={}
def state(w,name):return json.loads((U/f'{w}-{name}-envelope.json').read_text())['entries'][0]['project']
def task(p):return next(x for x in p['tasks'] if x['id']==T)
try:
 for w in ['1280','1440']:
  b=state(w,'before-reading');rd=state(w,'reader-before-continue');n=state(w,'after-N');reg=state(w,'after-region');h=state(w,'after-H');sel=state(w,'after-file-select');acc=state(w,'after-accept');back=state(w,'after-map-return');bt=task(b);nt=task(n);ht=task(h);file=json.loads((U/f'inputs/{w}-return2.json').read_text());report=acc['tasks'][-1]
  checks={'readingUnchanged':b==rd,'onlyNManualChange':nt=={**bt,'manual':{**bt['manual'],'next':nt['manual']['next']}},'otherTasksUnchanged':all(next(x for x in n['tasks'] if x['id']==old['id'])==old for old in b['tasks'] if old['id']!=T),'spaceBasesSourcesUnchangedBeforeH':n['space']==b['space'] and n['bases']==b['bases'] and n['sources']==b['sources'],'separateDraftPreserved':all(back[k]==b[k] for k in ['draft','draftKind','answerDraft']) and back['space']['draftTarget']==b['space']['draftTarget'],'regionDidNotCreateH':n==reg,'copyAddsExactlyOneH':len(ht['handoffs'])==len(bt['handoffs'])+1 and ht['handoffs'][:-1]==bt['handoffs'],'HManualExact':ht['handoffs'][-1]['work']==nt['manual'],'exactFileH':ht['handoffs'][-1]['returnId']==file['returnId'],'fileSelectionDoesNotApply':h==sel,'oneNewExactReport':len(acc['tasks'])==len(h['tasks'])+1 and report['parentTaskId']==T and json.loads(report['resultFile']['rawText'])==file,'oldTasksAndHRemainAfterReceive':acc['tasks'][:len(h['tasks'])]==h['tasks'],'returnDoesNotRollback':acc==back,'sourcesPrefixPreserved':acc['sources'][:len(b['sources'])]==b['sources'],'spacesBasesPreserved':acc['space']==b['space'] and acc['bases']==b['bases']}
  assert all(checks.values()),(w,checks)
  events=[json.loads(l) for l in (U/'actions.jsonl').read_text().splitlines()];screen=lambda label:next(e['data']['visible'] for e in events if e['kind']=='screen' and e['data']['label']==label)
  before=screen(w+'-native-record-read');after=screen(w+'-return-before-other-action');caller='#subtree-task-'+T
  def control(v,id):return next(x for x in v['controls'] if x['id']==id)
  cpre=control(before,caller[1:]);cpost=control(after,caller[1:]);assert cpost['full'] and cpost['hit'];assert before['xy']==after['xy'];
  geometry=[e['data'] for e in events if e['kind']=='read-only-geometry' and e['data']['entryId']==before['entryId']];assert geometry[0]['matrix']==geometry[1]['matrix']
  summary[w]={'checks':checks,'currentBefore':b['currentTaskId'],'currentExplicitContinue':n['currentTaskId'],'currentAfterReceiptAndReturn':back['currentTaskId'],'newReport':report['id'],'actualH':file['returnId'],'manualBefore':bt['manual'],'manualAfter':nt['manual'],'originCallerBefore':cpre,'originCallerAfter':cpost,'pageBefore':before['xy'],'pageAfter':after['xy'],'cameraBefore':geometry[0]['matrix'],'cameraAfter':geometry[1]['matrix']}
 run=json.loads((U/'runtime.json').read_text());assert not run['pageerrors'];assert all(x['status']==200 and x['sha256']==x['diskSHA256']==x['diskAfterSHA256'] for x in run['HTTP']);assert json.loads((U/'posts.json').read_text())==[];assert not [json.loads(l) for l in (U/'actions.jsonl').read_text().splitlines() if json.loads(l)['kind']=='action-error'];assert json.loads((U/'process.json').read_text())['actualChildExit']==0
 summary['gateExit']=0
except Exception:
 import traceback;summary['error']=traceback.format_exc();summary['gateExit']=1;print(summary['error'])
(R/'SUMMARY.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2));sys.exit(summary['gateExit'])
