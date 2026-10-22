from pathlib import Path
import sys,os,json,traceback
from ui_support import Browser,GEO
R=Path(__file__).parent;kind=sys.argv[1];A=R.parent/('cycle20-fix1-candidate' if kind=='before' else 'cycle21-a-candidate')/'app';O=R/kind;O.mkdir(exist_ok=True);b=Browser(A,O);runs=[]
try:
 for w,h in [(1280,720),(1440,900)]:
  r={'viewport':[w,h],'checks':[]};runs.append(r)
  try:
   b.prepare(w,h);p=b.p;copy=p.get_by_role('button',name='작업문 복사',exact=True);summary=p.get_by_text('결과를 파일로 받기 · 선택',exact=True);r['initial']={'copy':copy.evaluate(GEO),'summary':summary.evaluate(GEO),'AX':p.locator('body').aria_snapshot(),'snapshot':b.snap(),'project':b.project()};g=r['initial'];passed=all(g[k]['full'] and g[k]['visible'] and any(z['hit'] and z['inClip'] for z in g[k]['points']) for k in ['copy','summary']);r['checks'].append({'id':'initial-main-copy-and-closed-file-choice-visible-clip-hit','pass':passed});p.screenshot(path=str(O/f'{w}-first-prepared.png'))
  except Exception:r['fatal']=traceback.format_exc()
finally:b.close()
code=int(len(runs)!=2 or b.errors or any(r.get('fatal') or any(not c['pass'] for c in r['checks']) for r in runs));(O/'result.json').write_text(json.dumps({'source':'df726e5898f24e23d69e47651d3bf6cbea302412' if kind=='before' else '922848c0957992f84b8a0e2696a86b98d5f51c0d','expectedRuns':2,'executedRuns':len(runs),'runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'kind':kind,'exit':code,'fatal':[r.get('fatal') for r in runs if r.get('fatal')]}));sys.exit(code)
