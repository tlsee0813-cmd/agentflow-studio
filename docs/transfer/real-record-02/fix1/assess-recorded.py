"""Offline review of recorded evidence only; no browser/network/application calls."""
from pathlib import Path
import json,sys,hashlib
ROOT=Path(__file__).parent
raw=json.loads((ROOT/'output/result.json').read_text())
review=[]
for stage in raw['stages']:
 if not stage['id'].endswith('/switch-same-peek'):continue
 d=stage['detail'];a=d['before'];b=d['afterSwitch']
 entry={'id':stage['id'],'raw_checker_status':stage['status'],'assessment':'NOT_RUN','reason':'Same fact/source/selection/origin mapping and close-focus are observed. Actual visible preview text/range and pvScroll clientHeight/scrollHeight were not recorded, so internal reading continuity is not demonstrated. Nonzero previewTop alone is insufficient.',
 'before':{'scrollTop':a['previewTop'],'max':a['previewMax'],'distanceFromBottom':a['previewMax']-a['previewTop'],'originQuote':a['quote'],'originQuoteVisible':a['originQuoteVisible'],'pvBodyHeight':a['panel']['pvBody']['rect']['height'],'pvScrollClientHeight':None,'pvScrollContentHeight':None,'actualVisibleTextRange':None},
 'after':{'scrollTop':b['previewTop'],'max':b['previewMax'],'distanceFromBottom':b['previewMax']-b['previewTop'],'originQuote':b['quote'],'originQuoteVisible':b['originQuoteVisible'],'pvBodyHeight':b['panel']['pvBody']['rect']['height'],'pvScrollClientHeight':None,'pvScrollContentHeight':None,'actualVisibleTextRange':None},
 'scrollTopDelta':b['previewTop']-a['previewTop'],'maxDelta':b['previewMax']-a['previewMax'],'atTopAfter':b['previewTop']==0,'atMaxAfter':abs(b['previewTop']-b['previewMax'])<=1,
 'offsetMatchesExtentChange':b['previewTop']-a['previewTop']==b['previewMax']-a['previewMax'],
 'interpretation':'Not a literal reset to zero and not an observed top/bottom clamp. Offset delta matches extent delta exactly or within one CSS pixel (see each raw value); bottom-relative offset is stable within one pixel, consistent with browser anchoring after origin text reflow. It does not prove the same evidence passage remained visible.',
 'otherObservedChecks':{'headingSame':a['heading']==b['heading'],'sourceIDsSame':a['sources']==b['sources'],'selectionSame':a['selected']==b['selected'],'newExpandedMapping':b['expanded'],'focusAfterClose':d['closedCurrentExpression']['focus']},
 'evidenceSource':'output/result.json (corrected second browser run); first failure values remain in harness-first/result.json/process.log, with only fields originally captured'}
 review.append(entry)
assert len(review)==6
status=[]
for s in raw['stages']:
 status.append({'id':s['id'],'status':'NOT_RUN' if s['id'].endswith('/switch-same-peek') else s['status'],'reason':'Internal reading continuity unverified; partial switch checks passed' if s['id'].endswith('/switch-same-peek') else 'See raw recorded result'})
local=[s for s in status if not s['id'].startswith('external/')]
assessment={'method':'Offline assessment of existing observations only; no browser rerun','raw_result_sha256':hashlib.sha256((ROOT/'output/result.json').read_bytes()).hexdigest(),'switch_review':review,'stages':status,'expected_local':60,'executed_local_browser':raw['executed_local'],'verified_local_complete':all(s['status']=='PASS' for s in local),'counts':{x:sum(s['status']==x for s in status) for x in ['PASS','FAIL','NOT_RUN']},'fatal':None,'exit_code':1 if any(s['status']!='PASS' for s in local) else raw['exit_code'],'raw_browser_process_exit':json.loads((ROOT/'output/process-exit.json').read_text())['actual_process_exit'],'note':'Raw browser checker result 60 PASS/exit0 is preserved but overstates the six internal reading-continuity claims; this assessment does not overwrite it.'}
(ROOT/'assessment.json').write_text(json.dumps(assessment,ensure_ascii=False,indent=2)+'\n');print(json.dumps({k:assessment[k] for k in ['counts','verified_local_complete','raw_browser_process_exit','exit_code']}));sys.exit(assessment['exit_code'])
