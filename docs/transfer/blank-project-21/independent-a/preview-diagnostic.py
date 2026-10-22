from pathlib import Path
import json,sys,traceback
from ui_support import Browser,GEO
R=Path(__file__).parent;kind=sys.argv[1];O=R/('preview-diag-'+kind);O.mkdir(exist_ok=True);A=R.parent/('cycle20-fix1-candidate' if kind=='before' else 'cycle21-a-candidate')/'app';b=Browser(A,O);runs=[]
def stable(p):
 # Observe native event completion; no sleep or geometry adjustment. Do not require any particular Y.
 return p.evaluate('''()=>new Promise(resolve=>{let last='',same=0,n=0;function f(){const s=JSON.stringify([scrollY,...[...document.querySelectorAll('textarea.export-preview')].map(e=>[e.scrollTop,e.getBoundingClientRect().y])]);same=s===last?same+1:0;last=s;if(same>=6||++n>=120)resolve({frames:n,stable:same>=6,value:s});else requestAnimationFrame(f)}requestAnimationFrame(f)})''')
try:
 for w,h in [(1280,720),(1440,900)]:
  r={'viewport':[w,h],'stages':[]};runs.append(r)
  try:
   b.prepare(w,h);p=b.p;s=p.get_by_text('결과를 파일로 받기 · 선택',exact=True);b.reach(s).click();b.reach(p.get_by_role('button',name='파일 결과용 작업문 복사',exact=True)).click();summary=p.get_by_text('이 탭에서 마지막으로 내보낸 파일용 전문',exact=True);summary.wait_for();b.saved();b.reach(summary).click();ta=p.locator('#file-handoff-preview textarea');b.reach(ta).click();before=b.project()
   def rec(name):r['stages'].append({'name':name,'snapshot':b.snap(),'summary':summary.evaluate(GEO),'textarea':ta.evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight,selectionEnd:e.selectionEnd,focus:document.activeElement===e,rect:e.getBoundingClientRect().toJSON(),visible:e.checkVisibility({visibilityProperty:true})})')})
   rec('opened')
   for _ in range(35):
    a=ta.evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight})')
    if a['top']>=a['max']-1:break
    z=ta.bounding_box();p.mouse.move(z['x']+z['width']*.7,z['y']+z['height']*.6);p.mouse.wheel(0,600);r['stages'].append({'name':'wheel-observe','settled':stable(p),'metrics':ta.evaluate('e=>({top:e.scrollTop,max:e.scrollHeight-e.clientHeight,pageY:scrollY})')})
   rec('wheel-tail-stable');p.keyboard.press('Control+End');r['controlEndSettled']=stable(p);rec('after-Control-End');p.keyboard.press('Shift+Tab');r['tabSettled']=stable(p);rec('before-Space-close');p.keyboard.press('Space');r['closeSettled']=stable(p);rec('after-Space-close');p.screenshot(path=str(O/f'{w}-after-key-close.png'));r['projectUnchanged']=b.project()==before;r['focusSummary']=summary.evaluate('e=>document.activeElement===e');r['closed']=summary.evaluate('e=>!e.parentElement.open');r['callerHit']=any(z['hit'] and z['inClip'] for z in r['stages'][-1]['summary']['points'])
  except Exception:r['fatal']=traceback.format_exc()
  finally:(O/'result.json').write_text(json.dumps({'runs':runs},ensure_ascii=False,indent=2))
finally:b.close()
# This is a raw comparison probe: hidden caller remains a failed observation, even if also present before.
code=int(b.errors or any(r.get('fatal') or not r.get('projectUnchanged') or not r.get('focusSummary') or not r.get('closed') or not r.get('callerHit') for r in runs));(O/'result.json').write_text(json.dumps({'kind':kind,'runs':runs,'exit':code},ensure_ascii=False,indent=2));print(json.dumps({'kind':kind,'exit':code,'raw':[(r['viewport'],r.get('callerHit'),r.get('fatal')) for r in runs]}));sys.exit(code)
