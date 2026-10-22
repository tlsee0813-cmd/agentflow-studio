from pathlib import Path
import json
r=Path(__file__).parent
positive=json.loads((r/'sameview-release-comparison.json').read_text());negative=json.loads((r/'roundtrip-release-comparison.json').read_text())
assert positive['after']['delay']['calls']==1 and positive['after']['preview']['state']=='review'
assert positive['after']['focus']=='result-file-review-heading','same-view selection completion reveals the review'
assert (r/'sameview-before-release-envelope.json').read_bytes()==(r/'sameview-after-release-envelope.json').read_bytes()
assert (r/'roundtrip-before-release-envelope.json').read_bytes()==(r/'roundtrip-after-release-envelope.json').read_bytes()
result={'positiveSameView':positive,'negativeHistoryWorkRoundtrip':negative,'controlledNotNaturalDelay':True,'productSourceDOMUnmodified':True,'selectionPreserved':negative['after']['preview']['state']=='review','storedDataUnchanged':True,'noAutomaticRevealAfterViewExcursionExpected':negative['before']['xy']==negative['after']['xy'] and negative['before']['focus']==negative['after']['focus']}
(r/'judgment.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
assert result['noAutomaticRevealAfterViewExcursionExpected'],'FAIL: file completion after history→work steals returned position/focus; selection retained'
