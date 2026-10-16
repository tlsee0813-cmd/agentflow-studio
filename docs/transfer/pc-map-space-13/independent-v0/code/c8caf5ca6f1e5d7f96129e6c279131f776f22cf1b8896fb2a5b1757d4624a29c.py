from pathlib import Path
import json,hashlib,sys
R=Path(__file__).parent;P=R.parent/'product13-run/first-screens/evidence/result.json';r=json.loads(P.read_text());out=[]
for s in r['scenes']:
 tools=[]
 for id,t in s['tools'].items():
  if id=='map-scale':continue
  tools.append({'id':id,'rect':t['rect'],'sampleHit':t['sampleHit'],'viewport_bottom_clip_px':max(0,t['rect']['y']+t['rect']['h']-s['viewport']['height'])})
 out.append({'id':s['id'],'map_40pct':s['criteria']['map_height_40pct'],'tools':tools,'core_map_tool_sample_access':'PASS' if all(x['sampleHit'] for x in tools) else 'FAIL'})
code=int(any(x['core_map_tool_sample_access']=='FAIL' for x in out));(R/'first-screen-tool-audit.json').write_text(json.dumps({'type':'independent postprocessing of actually executed original geometry; no browser rerun/no frozen verdict rewrite','raw_sha256':hashlib.sha256(P.read_bytes()).hexdigest(),'rows':out,'exit':code,'partial_rect_is_not_human_ink_failure':True},indent=2));print('tool-access raw audit exit',code);sys.exit(code)
