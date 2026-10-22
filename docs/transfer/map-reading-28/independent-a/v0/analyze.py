from pathlib import Path
import json,sys
R=Path(__file__).parent;out={'definition':'No human comprehension/ink OCR claim. Range bounds/ancestor client clip/representative hit, own title linebox included. Full=false on font Range boundary alone is PARTIAL_LAYOUT. Distinguishing token centers are a geometric supplement to original PNG review.','pairs':[],'requiredVisualFailures':[],'collectionRuns':[]}
def item(c,cls):return next((x for x in c['items'] if x['class']==cls),None)
def fraction(e):
 if not e:return None
 total=sum(x['rect']['width']*x['rect']['height'] for x in e['rangeRects']);seen=sum(max(0,x['visibleClip']['right']-x['visibleClip']['left'])*max(0,x['visibleClip']['bottom']-x['visibleClip']['top']) for x in e['rangeRects'] if x['positive']);return seen/total if total else 0
for n in [4,6,8]:
 A=json.loads((R/('baseline' if n==4 else f'baseline-{n}')/'result.json').read_text());B=json.loads((R/('candidate' if n==4 else f'candidate-{n}')/'result.json').read_text())
 for variant,p in [('baseline',A),('candidate',B)]:out['collectionRuns'].append({'cards':n,'variant':variant,'completePC':len(p['completed']),'fatal':p['fatal'],'errors':p['harnessFailures'],'collectionExit':p['plannedExit']})
 for w in [1280,1440]:
  aa=next(x for x in A['measurements'] if x['viewport']['width']==w and x['label'].endswith('expanded-fit'));bb=next(x for x in B['measurements'] if x['viewport']['width']==w and x['label'].endswith('expanded-fit'));pair={'cards':n,'viewport':aa['viewport'],'matrixBeforePanelA':aa['snapshot']['plane'],'matrixBeforePanelB':bb['snapshot']['plane'],'worldCameraEqual':aa['snapshot']['plane'][0]['transform']==bb['snapshot']['plane'][0]['transform'],'cardRectDeltas':[],'titleSamples':[],'rootSignals':{},'buttons':{}}
  for ca in aa['cards']:
   cb=next(x for x in bb['cards'] if x['id']==ca['id']);pair['cardRectDeltas'].append({'area':ca['id'],'delta':{k:cb['card']['rect'][k]-ca['card']['rect'][k] for k in ['x','y','width','height']}})
   ea,eb=item(ca,'area-card-name'),item(cb,'area-card-name');word=next((x for x in ['질문','표시','요청'] if x in ea['text']),None)
   if word:
    sample={'area':ca['id'],'text':ea['text'],'distinguishingWord':word}
    for variant,e in [('baseline',ea),('candidate',eb)]:
     k=e['text'].find(word);chars=e['characters'][k:k+len(word)];cl=e['clip'];v=[]
     for z in chars:
      b=z['rect'];x=b['x']+b['width']/2;y=b['y']+b['height']/2;v.append({'char':z['char'],'rawRange':b,'center':{'x':x,'y':y},'centerInsideAllClips':cl['left']<=x<=cl['right'] and cl['top']<=y<=cl['bottom']})
     sample[variant]={'cssFont':e['font'],'lineHeight':e['lineHeight'],'clip':cl,'rect':e['rect'],'samples':v,'allCentersInside':all(z['centerInsideAllClips'] for z in v)}
    pair['titleSamples'].append(sample)
    if sample['baseline']['allCentersInside'] and not sample['candidate']['allCentersInside']:out['requiredVisualFailures'].append({'type':'candidate-distinguishing-title-loss','cards':n,'width':w,'area':ca['id'],'word':word})
  for variant,mm in [('baseline',aa),('candidate',bb)]:
   root=next(c for c in mm['cards'] if item(c,'branch-signals') and '이전 기준 1' in item(c,'branch-signals')['text']);d={}
   for cls in ['area-update-label','tag purple','branch-signals']:
    e=item(root,cls);d[cls]={'text':e['text'],'rangeVisibleAreaFraction':fraction(e),'allRangeFullyClippedInside':all(x['full'] for x in e['rangeRects']),'rect':e['rect'],'clip':e['clip'],'centerHit':e['centerHit'],'range':e['rangeRects']}
   pair['rootSignals'][variant]=d
   if fraction(item(root,'tag purple'))==0:out['requiredVisualFailures'].append({'type':'current-work-badge-not-visible','variant':variant,'cards':n,'width':w})
   pair['buttons'][variant]=[{'area':c['id'],'info':item(c,'quiet node-info')['centerHit'] if item(c,'quiet node-info') else next(i for i in c['items'] if 'node-info' in i['class'])['centerHit'],'enterCenterHit':item(c,'node-enter')['centerHit'],'branch':item(c,'quiet branch-toggle')['centerHit'] if item(c,'quiet branch-toggle') else None} for c in mm['cards']]
  out['pairs'].append(pair)
out['visualAcceptance']='FAIL / candidate not justified for adoption; baseline also has current-work badge limitation';out['plannedExit']=int(bool(out['requiredVisualFailures']));(R/'comparison.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps({'pairs':len(out['pairs']),'collectionRuns':out['collectionRuns'],'visualFailureEntries':len(out['requiredVisualFailures']),'exit':out['plannedExit']},ensure_ascii=False,indent=2));sys.exit(out['plannedExit'])
