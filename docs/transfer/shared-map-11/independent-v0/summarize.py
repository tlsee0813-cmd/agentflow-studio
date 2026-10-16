# Derived raw-pair summary only, no new browser run or merged PASS count.
from pathlib import Path
import json,difflib,hashlib
r=Path(__file__).resolve().parent;j=json.loads((r/'fix1-main-run02/result.json').read_text());o={x['id']:x['data'] for x in j['observations']};s={}
for w in [1280,1440]:
 for case in ['flow091','powertoys']:
  tag=f'pc-{w}/{case}';pair=o[tag+'/draft-map-return-raw-pair'];s[tag]={'wheelRawBefore':o[tag+'/native-map-before-wheel'],'wheelRawAfter':o[tag+'/native-map-after-wheel'],'draftEntryPre':pair['before'],'draftReturnPost':pair['after'],'rawDeltas':pair['deltas'],'sourceFocus':pair['after']['activeElement'],'emptyDraftCaseSwitchLimit':'top/main inert while modal open, no bypass; case change while inline evidence open separately executed'}
(r/'derived-summary.json').write_text(json.dumps({'method':'Read-only from fix1-main-run02 raw JSON. All pre/post remain in result; no additional executed test count.','PC':s},ensure_ascii=False,indent=2));old=(r/'v0/engine.js').read_text();new=(r/'fix1/engine.js').read_text();(r/'engine-v0-to-fix1.diff').write_text(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='pinned-v0-engine',tofile='pinned-fix1-overlay-engine')))
