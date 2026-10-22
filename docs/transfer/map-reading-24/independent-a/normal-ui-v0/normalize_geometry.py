"""One-study offline client-clip normalization; reads saved DOM geometry, never browser/app.
The as-run helper used transform:none => scale1, overlooking an inherited plane scale.
Normalize those client offsets using saved ancestor matrices; keep raw and derived separate.
Range bounds are font layout bounds, not ink/readability or a UI defect verdict.
"""
from pathlib import Path
import json,re
R=Path(__file__).parent
p=json.loads((R/'result.json').read_text());out=[]
def scale(t):
 m=re.fullmatch(r'matrix\(([^)]+)\)',t)
 if not m:return (1.,1.)
 a=[float(x) for x in m[1].split(',')];assert abs(a[1])<1e-8 and abs(a[2])<1e-8,'study only axis-aligned maps';return abs(a[0]),abs(a[3])
def normalized(g,w,h):
 outer={'left':0,'top':0,'right':w,'bottom':h};text=dict(outer);rows=[]
 for i,a in enumerate(g['ancestors']):
  sx=sy=1.
  if a['transform']=='none':
   for above in g['ancestors'][i+1:]:x,y=scale(above['transform']);sx*=x;sy*=y
  b=a['rect'];c={k:b['left' if k in ['left','right'] else 'top']+(a['client'][k]-b['left' if k in ['left','right'] else 'top'])*(sx if k in ['left','right'] else sy) for k in ['left','right','top','bottom']};rows.append({'id':a['id'],'tag':a['tag'],'clientNormalized':c,'inheritedScaleApplied':[sx,sy]})
  for clip in ([text] if i==0 else [text,outer]):
   if a['overflow'][0] in ['auto','scroll','hidden','clip']:clip['left']=max(clip['left'],c['left']);clip['right']=min(clip['right'],c['right'])
   if a['overflow'][1] in ['auto','scroll','hidden','clip']:clip['top']=max(clip['top'],c['top']);clip['bottom']=min(clip['bottom'],c['bottom'])
 def inside(r,c):return r['left']>=c['left']-.5 and r['right']<=c['right']+.5 and r['top']>=c['top']-.5 and r['bottom']<=c['bottom']+.5
 return {'outerClientClip':outer,'ownAndAncestorTextClip':text,'controlBoxInsideAncestors':inside(g['rect'],outer),'rawCenterHit':g['hit'],'rangeBoundsInsideTextClip':all(inside(r,text) for r in g['rangeRects']),'ancestorClientDerivation':rows}
for row in p['rows']:
 w,h=row['viewport'];scenes={}
 for label in ['initial','selected','panned','fitted','offscreenLocate','offscreenReturned','expandedLocate','foldedLocate','final']:
  s=row[label];scene={'matrix':s['snapshot']['plane'][0]['transform'],'cards':[],'controls':normalized(s['controls'],w,h),'fit':normalized(s['fit'],w,h)};worldScale=scale(scene['matrix'])[0]
  for card in s['cards']:
   scene['cards'].append({'areaId':card['areaId'],'card':normalized(card['card'],w,h),'info':normalized(card['info'],w,h),'labels':{k:{'text':v['text'],'font':v['font'],'effectiveFontPxApprox':float(v['font']['fontSize'].replace('px',''))*worldScale,'geometry':normalized(v,w,h)} for k,v in card['labels'].items()}})
  scenes[label]=scene
 out.append({'viewport':[w,h],'scope':'offline derivation from raw axis-aligned DOM geometry, not a new browser observation','scenes':scenes})
(R/'normalized-client-clips.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
