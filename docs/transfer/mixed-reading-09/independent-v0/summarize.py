# Read-only derivation; no browser launch, no additional PASS count.
import json
from pathlib import Path
root=Path(__file__).resolve().parent;r=json.loads((root/'run02/result.json').read_text());obs=r['observations'];out={}
for w in [1280,390]:
 get=lambda suffix:next(o['data'] for o in obs if o['id']==f'{w}/'+suffix)
 a=get('C-map-entry-before');b=get('C-map-pre-post-deltas');moves=[o['data'] for o in obs if o['id']==f'{w}/wheel/#mapScroll' and o['data']['delta']==[70,90]];move=moves[-1]
 out[str(w)]={'entryScrolls':a['scrolls'],'entryTransform':a['transform'],'mapWheelBefore':move['before']['#mapScroll'],'mapWheelAfter':move['after']['#mapScroll'],'mapWheelActualDelta':{k:move['after']['#mapScroll'][k]-move['before']['#mapScroll'][k] for k in ['left','top']},'restoreCardDeltas':b['cards'],'restorePathWorldNumericDeltas':b['edges'],'maxAbsPathWorldDelta':max(e['maxAbsWorldDelta'] for e in b['edges']),'allowedPathWorldDelta':.5,'firstSelectionScreenEndpointPairs':{'before':get('first-selection-before')['edges'],'after':get('first-selection-after')['edges']},'postCloseEProof':'See each new-panel-after-E-xref-closed-* immediate DOM snapshot, then after-new-panel-*-E check (actual preparation reentry). E is not read through hidden app state.'}
(root/'derived-summary.json').write_text(json.dumps({'method':'Derived from run02 result only; raw pre/post retained. Not a new browser execution or extra assertions.','viewports':out},ensure_ascii=False,indent=2))
