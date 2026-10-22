"""After frozen UI decisions only: equality checks on saved snapshots; no oracle/input JSON parse."""
from pathlib import Path
import json,re,hashlib,datetime
R=Path(__file__).parent;rows=[]
def load(name):return json.loads((R/name).read_text())
def proj(env,pid):return next(e['project'] for e in env['entries'] if e['project']['id']==pid) if False else env['entries'][-1]['project']
# Identify imported T2 using observed DOM entry IDs; no fixture answer selection.
entry={1280:'E_34adf2fb-1849-423e-babe-c8dd66af7f62',1440:'E_b2041525-2883-47b1-8daf-994a0b836fce'}
for w in [1280,1440]:
 def P(label):return next(e['project'] for e in load(f'{w}-{label}-envelope.json')['entries'] if e['entryId']==entry[w])
 before=P('T2-before-reading');decision=P('decision-before');edited=P('after-selected-edit');export=P('after-H');final=P('final');text=(R/f'{w}-actual-H-work.md').read_text();file=load(f'inputs/{w}-observer-return2.json');tid=file['taskId'];area='A_0330ba8f-3bf0-408f-90dc-2a52688e8323';bt=next(t for t in before['tasks'] if t['id']==tid);et=next(t for t in edited['tasks'] if t['id']==tid);xt=next(t for t in export['tasks'] if t['id']==tid);ft=next(t for t in final['tasks'] if t['id']==tid)
 checks={
 'readingBeforeExplicitDecisionProjectUnchanged':before==decision,
 'initialCurrentWasOtherTask':before['currentTaskId']!=tid,
 'explicitContinueCurrentExactSelectedTask':edited['currentTaskId']==tid,
 'manualOnlyNextChanged':bt['manual']['next']!=et['manual']['next'] and all(bt['manual'][k]==et['manual'][k] for k in ['understanding','scope','checks']),
 'oldDraftWholeObjectPreserved':before['draft']==edited['draft']==export['draft']==final['draft'],
 'oldTasksExceptSelectedWholeObjectsPreserved':all(next(t for t in final['tasks'] if t['id']==b['id'])==b for b in before['tasks'] if b['id']!=tid),
 'selectedOldHandoffsPreserved':xt['handoffs'][:len(bt['handoffs'])]==bt['handoffs'],
 'selectedNewManualPreservedThroughReceiveReturn':ft['manual']==et['manual'],
 'originalSourcesAllPreserved':all(next(s for s in final['sources'] if s['id']==b['id'])==b for b in before['sources']),
 'allAreaSpaceDataPreserved':before['space']==final['space'],
 'basisPreserved':before['bases']==final['bases'],
 'purposePreserved':before.get('brief')==final.get('brief'),
 'oneNewTaskOnly':len(final['tasks'])==len(before['tasks'])+1,
 'returnHasNoUnneededUnderstanding':file['understanding'] is None,
 'clipboardActualTemplateExact':any(json.loads(b)=={**file,'report':'실제 결과와 못 한 일로 이 안내를 바꾸세요.'} for b in re.findall(r'```json\n(.*?)\n```',text,re.S) if json.loads(b).get('schemaVersion')=='agentflow.return.2'),
 }
 received=next(t for t in final['tasks'] if t.get('resultFile') and t['resultFile']['returnId']==file['returnId']);h=next(h for h in xt['handoffs'] if h['returnId']==file['returnId']);checks.update({'newReportPointsToSelectedActualH':json.loads(received['resultFile']['rawText'])['taskId']==tid,'newReportSourceParentExactSelected':received.get('parentTaskId')==tid if 'parentTaskId' in received else received.get('parentId')==tid,'currentRemainsReceivedTaskAfterMapReturn':final['currentTaskId']==received['id'],'newHFourValuesExactManual':h['work']==et['manual']})
 # Report schema field discovery only after selection; do not infer unsupported alias.
 row={'pc':w,'selectedObservedArea':area,'selectedTask':tid,'previousCurrent':before['currentTaskId'],'actualH':file['returnId'],'receivedTask':received['id'],'finalCurrent':final['currentTaskId'],'draftBefore':before['draft'],'draftFinal':final['draft'],'checks':checks,'receivedTaskKeys':list(received),'newHKeys':list(h),'snapshotSHA256':{n:hashlib.sha256((R/f'{w}-{n}-envelope.json').read_bytes()).hexdigest() for n in ['T2-before-reading','decision-before','after-selected-edit','after-H','final']}}
 rows.append(row)
(R/'PRESERVATION.json').write_text(json.dumps({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scope':'post-decision saved snapshot equality, no source/oracle selection','rows':rows},ensure_ascii=False,indent=2))
for x in rows:print(x['pc'],x['checks'],x['receivedTaskKeys'])
