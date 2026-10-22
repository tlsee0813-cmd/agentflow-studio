from pathlib import Path
import json,sys
r=Path(__file__).parent;v=json.loads((r/'result.json').read_text());known=[]
for line in (r/'ui.jsonl').read_text().splitlines():
 x=json.loads(line)
 if x['label']=='KNOWN reopen reset defect separate from fix3 CSS acceptance':
  k=x['raw'];known.append({'viewport':x['viewport'],'bodyBeforeClose':k['before']['body']['scrollTop'],'bodyImmediatelyAfterReopen':k['after']['body']['scrollTop'],'summaryImmediatelyAfterReopen':k['after']['selectedSummaryScroll']['top'],'expectedBodyAfterExplicitReopen':0,'knownProductDefect':k['knownProductDefect'],'raw':'ui.jsonl KNOWN reopen reset defect separate from fix3 CSS acceptance'})
a=json.loads((r.parent/'cycle29-fix3-area17/result.json').read_text());code=int(bool(v['plannedChildExit'] or a['plannedExit'] or len(known)!=2 or any(x['knownProductDefect'] for x in known)))
(r/'FINAL_RESULT.json').write_text(json.dumps({'scope':'offline evaluation only; no extra browser actions','sourceCommit':'24fb19e61b8d8ce425931a4543a5eaef5d790312','AREA17':{'executed':2,'failures':len(a['failures']),'errors':len(a['errors']),'actualUIChildExit':0},'readerCore':{'expectedPC':2,'completePC':v['completedPC'],'failedChecks':v['failedChecks'],'actualUIChildExit':v['plannedChildExit']},'knownExplicitReopenFailures':known,'aggregateDecisionExit':code,'newAuthorEight':'NOT_RUN as instructed','cycle30':'NOT_RUN'},ensure_ascii=False,indent=2));print(json.dumps({'aggregateDecisionExit':code,'knownFailures':len([x for x in known if x['knownProductDefect']])}));sys.exit(code)
