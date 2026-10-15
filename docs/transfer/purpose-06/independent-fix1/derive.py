# Read-only analysis of already recorded geometry; does not open a browser.
import json
from pathlib import Path
root=Path(__file__).resolve().parent
r=json.loads((root/'run02/result.json').read_text());derived=[]
for o in r['observations']:
 for s,g in o['data'].items() if isinstance(o['data'],dict) else []:
  if not isinstance(g,dict) or 'rangeRects' not in g:continue
  a=g['clip'];selfclip=g.get('selfContentClip');c=dict(a)
  if selfclip:
   for k in ['left','top']:c[k]=max(c[k],selfclip[k])
   for k in ['right','bottom']:c[k]=min(c[k],selfclip[k])
  outside=[i for i,b in enumerate(g['rangeRects']) if b['left']<c['left']-.1 or b['right']>c['right']+.1 or b['top']<c['top']-.1 or b['bottom']>c['bottom']+.1]
  derived.append({'observation':o['id'],'selector':s,'ancestorClip':a,'selfContentClip':selfclip,'combinedTextClip':c,'recordedRangeCount':len(g['rangeRects']),'rangeIndicesOutsideCombinedClip':outside,'rangeClassification':'PARTIAL_LAYOUT' if outside else ('FULL_RECORDED_RANGES' if g['rangeRects'] else 'NO_RANGE_TEXT'),'actualBoxFullWithinAncestors':g['full'],'actualSampleHit':g['hit']})
checks=[]
for w in [1440,390]:
 before=next(o['data']['snapshot'] for o in r['observations'] if o['id']==f'{w}/peek-before');after=next(o['data']['snapshot'] for o in r['observations'] if o['id']==f'{w}/peek-escape')
 checks.append({'id':f'{w}/Escape-reader-position','before':before['scrolls']['reader'],'after':after['scrolls']['reader'],'status':'PASS' if abs(before['scrolls']['reader']['top']-after['scrolls']['reader']['top'])<=1 else 'FAIL'})
(root/'derived-observations.json').write_text(json.dumps({'method':'Read-only derivation from run02/result.json. No browser reexecution. Intersection of every ancestor clip with target self-content clip; separate box and representative hit. Recorded Range rectangles are layout ranges (up to 16), not ink or human understanding. Textarea value is independently recorded; Range has no native textarea text.','derivedGeometry':derived,'supplementaryChecks':checks},ensure_ascii=False,indent=2))
assert all(x['status']=='PASS' for x in checks)
