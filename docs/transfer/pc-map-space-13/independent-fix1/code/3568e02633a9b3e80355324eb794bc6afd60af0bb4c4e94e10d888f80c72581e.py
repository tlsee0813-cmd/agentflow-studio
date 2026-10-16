from pathlib import Path
import os,sys,json,hashlib,subprocess,datetime,re,traceback,ast
from importlib.metadata import version
from playwright.sync_api import sync_playwright
R=Path(__file__).parent;A=Path(os.environ.get('APP_DIR','/workspace/browser-env/product13-fix1-candidate/app'));O=Path(os.environ.get('CONTROL_OUT',str(R/'fix1')));O.mkdir(exist_ok=True,parents=True)
base=Path('/workspace/browser-env/product13-final/returns/ui.py').read_text();tree=ast.parse(base); # reuse only the DOM geometry literal from its original dependency
old=ast.parse(Path('/workspace/browser-env/product12-boundaries/check.py').read_text());GEOM=next(ast.literal_eval(n.value) for n in old.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='GEOM' for t in n.targets))
def sha(b):return hashlib.sha256(b).hexdigest()
def files():return {str(p.relative_to(A/'continuity/dist/public')):sha(p.read_bytes()) for p in (A/'continuity/dist/public').rglob('*') if p.is_file()}
r={'start':datetime.datetime.now(datetime.timezone.utc).isoformat(),'code_sha256':sha(Path(__file__).read_bytes()),'app_dir':str(A),'runtime_before':files(),'scenes':[],'planned':[f'{w}-{s}' for w in [1280,1440] for s in ['notice','no-notice','notice-records-panel','long-notice-records-panel']]+['boundary760','boundary761'],'http':[],'http_errors':[],'console':[],'pageerrors':[],'fatal':None,'cleanup':[]}
def geom(pg,id):return pg.evaluate(GEOM,id)
def snap(pg):
 return pg.evaluate("""()=>{let p=document.getElementById('space-plane'),m=document.getElementById('space-map'),t=new DOMMatrixReadOnly(getComputedStyle(p).transform);return {matrix:{s:t.a,x:t.e,y:t.f},transform:getComputedStyle(p).transform,window:{x:scrollX,y:scrollY},map:{clientWidth:m.clientWidth,clientHeight:m.clientHeight},cards:[...m.querySelectorAll('.area-node')].map(e=>({id:e.dataset.areaId,x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight})),selected:document.querySelector('.area-node.selected')?.dataset.areaId}}""")
def box(pg,id):
 g=geom(pg,id);b=g['rect'];c=g['clip'];g['fullBoxInsideClip']=b['w']>0 and b['h']>0 and b['x']>=c['left']-.01 and b['y']>=c['top']-.01 and b['x']+b['w']<=c['right']+.01 and b['y']+b['h']<=c['bottom']+.01;return g
def native(pg,id):
 g=box(pg,id)
 if not g['hit'] or not g['fullBoxInsideClip']:return {'executed':False,'reason':'normal control not fully visible/hit; no auto-scroll recovery','geometry':g}
 b=g['rect'];before=pg.evaluate('({x:scrollX,y:scrollY})');pg.mouse.click(b['x']+b['w']/2,b['y']+b['h']/2);pg.wait_for_timeout(25);return {'executed':True,'geometry':g,'scroll_before':before,'scroll_after':pg.evaluate('({x:scrollX,y:scrollY})')}
def fit_expected(s):
 c=s['cards'];x=min(b['x'] for b in c);y=min(b['y'] for b in c);w=max(b['x']+b['w'] for b in c)-x;h=max(b['y']+b['h'] for b in c)-y;v=max(.0005,min(1.2,(s['map']['clientWidth']-48)/w,(s['map']['clientHeight']-48)/h));return {'s':v,'x':(s['map']['clientWidth']-w*v)/2-x*v,'y':(s['map']['clientHeight']-h*v)/2-y*v}
def overlaps(pg):
 return pg.evaluate("""()=>{let c=document.querySelector('.map-controls').getBoundingClientRect(),items=[document.getElementById('map-offscreen'),document.getElementById('area-panel'),...document.querySelectorAll('.area-card-name')].filter(Boolean);return items.map(e=>{let b=e.getBoundingClientRect(),l=Math.max(b.left,c.left),t=Math.max(b.top,c.top),r=Math.min(b.right,c.right),bt=Math.min(b.bottom,c.bottom),s=getComputedStyle(e);return {id:e.id,cls:e.className,text:e.innerText,rect:{x:b.x,y:b.y,w:b.width,h:b.height},controlOverlap:{w:Math.max(0,r-l),h:Math.max(0,bt-t)},display:s.display,hidden:e.hidden}})}""")
def init(browser,url,w,fixture):
 ctx=browser.new_context(viewport={'width':w,'height':720 if w in [1280,760,761] else 900});pg=ctx.new_page();pg.set_default_timeout(5000);pg.on('dialog',lambda d:d.accept());pg.on('pageerror',lambda e:r['pageerrors'].append(str(e)));pg.on('console',lambda x:r['console'].append({'type':x.type,'text':x.text,'location':x.location}))
 def resp(x):
  if x.status>=400:r['http_errors'].append({'url':x.url,'status':x.status})
  if x.request.resource_type in ['document','script','stylesheet']:
   b=x.body();path=x.url[len(url):].split('?')[0];path='index.html' if path=='/' else path.lstrip('/');r['http'].append({'url':x.url,'path':path,'status':x.status,'bytes':len(b),'sha256':sha(b)})
 pg.on('response',resp);pg.goto(url);pg.locator('#import-file').set_input_files(str(R/(fixture+'.json')));pg.locator('#space-map').wait_for();pg.evaluate('document.fonts.ready');return ctx,pg
p=None
try:
 env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],AI_MODE='mock',ALLOW_PAID_AI='false',PORT='0');p=subprocess.Popen(['node','continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);url=re.search(r'http://127\.0\.0\.1:\d+',p.stdout.readline()).group();r['url']=url
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True);r['versions']={'browser':b.version,'playwright':version('playwright'),'node':subprocess.check_output(['node','--version'],env=env,text=True).strip()}
  for w in [1280,1440]:
   for scene in ['notice','no-notice','notice-records-panel','long-notice-records-panel']:
    ctx,pg=init(b,url,w,'long' if scene.startswith('long') else 'both');s={'id':f'{w}-{scene}','checks':{}};r['scenes'].append(s)
    try:
     if scene=='no-notice':pg.reload();pg.locator('#nav-projects').click();pg.locator('.project-open').first.click();pg.locator('#nav-space').click()
     if 'records-panel' in scene:
      s['records_click']=native(pg,'check-summary');assert s['records_click']['executed'];areas=json.loads((R/('long.json' if scene.startswith('long') else 'both.json')).read_text())['space']['areas'];s['selection_click']=native(pg,'node-info-'+areas[1]['id']);assert s['selection_click']['executed'];s['strict_selected_info']=box(pg,'node-info-'+areas[1]['id']);s['selected_card_strict']='PASS' if s['strict_selected_info']['hit'] else 'FAIL (known separate limit, not rescued by later explicit fit)'
     s['pre']=snap(pg);s['controls']={id:box(pg,id) for id in ['map-zoom-out','map-zoom-in','map-fit']};s['overlap_pre']=overlaps(pg);s['checks']['scroll_zero_before']=s['pre']['window']=={'x':0,'y':0};s['checks']['full_boxes_hits']=all(g['fullBoxInsideClip'] and g['hit'] for g in s['controls'].values());s['out_click']=native(pg,'map-zoom-out');s['after_out']=snap(pg);s['plus_click']=native(pg,'map-zoom-in');s['after_plus']=snap(pg);s['checks']['actual_minus_plus']=s['out_click']['executed'] and s['plus_click']['executed'] and s['after_out']['matrix']['s']<s['pre']['matrix']['s'] and abs(s['after_plus']['matrix']['s']-s['pre']['matrix']['s'])<.001
     # Make fit effect observable. This intentional zoomout is separate from preservation; not auto-fit recovery.
     s['fit_setup_out']=native(pg,'map-zoom-out');s['before_fit']=snap(pg);s['expected_fit_from_DOM']=fit_expected(s['before_fit']);s['fit_click']=native(pg,'map-fit');s['after_fit']=snap(pg);s['checks']['actual_fit_matrix']=s['fit_click']['executed'] and all(abs(s['after_fit']['matrix'][k]-s['expected_fit_from_DOM'][k])<.002 for k in ['s','x','y']);s['checks']['fit_changes_view']=s['before_fit']['matrix']!=s['after_fit']['matrix'];s['checks']['intrinsic_cards_unchanged']=s['pre']['cards']==s['after_fit']['cards'];s['checks']['scroll_zero_after']=s['after_fit']['window']=={'x':0,'y':0};s['overlap_after_fit']=overlaps(pg)
     if w==1280 and scene=='notice-records-panel':pg.screenshot(path=str(O/'1280-combined-after-real-fit.png'))
     if 'records-panel' in scene:
      s['close']=native(pg,'area-panel-close');s['after_close']=snap(pg);s['checks']['close_without_further_fit']=s['close']['executed'] and s['after_close']['matrix']==s['after_fit']['matrix'];s['checks']['selection_cleared']=s['after_close'].get('selected') is None
     s['status']='PASS' if all(s['checks'].values()) else 'FAIL'
    except Exception:s['status']='FAIL';s['error']=traceback.format_exc()
    ctx.close()
  for w in [760,761]:
   ctx,pg=init(b,url,w,'both');r['scenes'].append({'id':f'boundary{w}','status':'OBSERVED','css':pg.locator('.map-controls').evaluate('(e)=>({top:getComputedStyle(e).top,bottom:getComputedStyle(e).bottom})'),'controls':{id:box(pg,id) for id in ['map-zoom-out','map-zoom-in','map-fit']},'scroll':pg.evaluate('({x:scrollX,y:scrollY})'),'scope':'CSS760/761 boundary only, not full mobile or125zoom acceptance'});ctx.close()
  b.close()
except Exception:r['fatal']=traceback.format_exc()
finally:
 if p:
  try:p.terminate();r['server_shutdown']=p.wait(timeout=10);r['server_stderr']=p.stderr.read()
  except Exception:r['cleanup'].append(traceback.format_exc())
 r['runtime_after']=files();r['runtime_unchanged']=r['runtime_before']==r['runtime_after']
 for x in r['http']:x['disk_match']=x['status']==200 and x['sha256']==r['runtime_before'].get(x['path'])==r['runtime_after'].get(x['path'])
 r['complete']=[s['id'] for s in r['scenes']]==r['planned'];r['major_console']=[x for x in r['console'] if x['type']=='error' and not(x['location'].get('url','').endswith('/favicon.ico') and '404' in x['text'])];r['major_http']=[x for x in r['http_errors'] if not(x['url'].endswith('/favicon.ico') and x['status']==404)];r['exit']=int(bool(r['fatal'] or r['cleanup'] or r['pageerrors'] or r['major_console'] or r['major_http'] or not r['complete'] or not r['runtime_unchanged'] or not all(x['disk_match'] for x in r['http']) or any(s['status']=='FAIL' for s in r['scenes'])));(O/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({'complete':r['complete'],'exit':r['exit'],'fatal':r['fatal']}))
sys.exit(r['exit'])
