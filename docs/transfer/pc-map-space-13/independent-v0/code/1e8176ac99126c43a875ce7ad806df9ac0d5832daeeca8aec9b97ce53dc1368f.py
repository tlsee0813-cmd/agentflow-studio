from pathlib import Path
import os,sys,json,traceback,subprocess,re
base=Path(__file__).with_name('ui.py').read_text();exec(compile(base[:base.index('p=None\ntry:')],str(Path(__file__).with_name('ui.py')),'exec'))
TEXT="""e=>{const rr=q=>({x:q.x,y:q.y,w:q.width,h:q.height});let clip={l:0,t:0,r:innerWidth,b:innerHeight};for(let a=e;a;a=a.parentElement){let s=getComputedStyle(a),r=a.getBoundingClientRect(),sx=a.offsetWidth?r.width/a.offsetWidth:1,sy=a.offsetHeight?r.height/a.offsetHeight:1;if(/hidden|auto|clip|scroll/.test(s.overflowX)){clip.l=Math.max(clip.l,r.left+a.clientLeft*sx);clip.r=Math.min(clip.r,r.left+(a.clientLeft+a.clientWidth)*sx)}if(/hidden|auto|clip|scroll/.test(s.overflowY)){clip.t=Math.max(clip.t,r.top+a.clientTop*sy);clip.b=Math.min(clip.b,r.top+(a.clientTop+a.clientHeight)*sy)}}let range=document.createRange();range.selectNodeContents(e);let rects=[...range.getClientRects()].map(rr);let b=e.getBoundingClientRect(),l=Math.max(b.left,clip.l),t=Math.max(b.top,clip.t),r=Math.min(b.right,clip.r),bb=Math.min(b.bottom,clip.b),hit=false;if(r>l&&bb>t){let h=document.elementFromPoint((l+r)/2,(t+bb)/2);hit=!!h&&(h===e||e.contains(h))}return {text:e.innerText,box:rr(b),ranges:rects,clip,allRangesInside:rects.length>0&&rects.every(r=>r.x>=clip.l-.01&&r.y>=clip.t-.01&&r.x+r.w<=clip.r+.01&&r.y+r.h<=clip.b+.01),sampleHit:hit}}"""
res={'scope':'two-width selected text normal access addendum, not selected-card strict acceptance','scenes':[],'fatal':None};p=None;code=1
try:
 env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false');p=subprocess.Popen(['node','continuity/server/index.mjs','--mock'],cwd=APP,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);url=re.search(r'http://127\.0\.0\.1:\d+',p.stdout.readline()).group()
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True)
  for w in [1280,1440]:
   ctx,pg=feature_init(b,url,w);d=json.loads((R/'both.json').read_text());area=d['space']['areas'][1]['id'];q=next(t['id'] for t in d['tasks'] if t.get('areaId')==area);click(pg,'node-info-'+area);rec={'width':w,'initial_texts':{s:pg.locator(s).evaluate(TEXT) for s in ['#area-panel .panel-top strong','#panel-idea .area-idea-text','#panel-tasks .panel-task']}};button='panel-task-'+q;rec['approach']=click(pg,button);rec['read_title']=pg.locator('#space-title').inner_text();click(pg,'task-return-origin');rec['focus_after']=pg.evaluate('document.activeElement.id');rec['request_after_return']=pg.locator('#'+button).evaluate(TEXT);rec['status']='PASS' if rec['focus_after']==button and rec['request_after_return']['sampleHit'] and '빈자리가 나면' in rec['read_title'] else 'FAIL';res['scenes'].append(rec);ctx.close()
  b.close()
 res['pageerrors']=result['pageerrors'];res['responses']=result['http'];res['http_errors']=result['http_errors'];code=int(any(s['status']=='FAIL' for s in res['scenes']) or bool(res['pageerrors']))
except Exception:res['fatal']=traceback.format_exc()
finally:
 if p:p.terminate();res['server_shutdown']=p.wait(timeout=10);res['server_stderr']=p.stderr.read()
 res['exit']=code;(O/'text-result.json').write_text(json.dumps(res,ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'fatal':res['fatal']}))
sys.exit(code)
