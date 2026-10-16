from pathlib import Path
import os,sys,json,hashlib,subprocess,re,datetime,traceback
from importlib.metadata import version
from playwright.sync_api import sync_playwright
ROOT=Path('/workspace/browser-env/product12-boundaries');APP=Path(os.environ.get('APP_DIR',str(ROOT.parent/'product12-candidate-v0/app')));OUT=Path(os.environ.get('OUT_DIR',str(ROOT/'evidence')));OUT.mkdir(exist_ok=True,parents=True)
ids=json.loads((ROOT/'ids.json').read_text());A,R,area=[ids[k] for k in ['A','R','area']]
def sha(b):return hashlib.sha256(b).hexdigest()
def source():return {str(p.relative_to(APP)):sha(p.read_bytes()) for folder in ['continuity/src','continuity/public','continuity/server','server'] for p in (APP/folder).rglob('*') if p.is_file()}
def runtime():return {str(p.relative_to(APP/'continuity/dist/public')):sha(p.read_bytes()) for p in (APP/'continuity/dist/public').rglob('*') if p.is_file()}
result={'runtime_before':runtime(),'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'app_dir':str(APP),'code_sha256':sha(Path(__file__).read_bytes()),'source_before':source(),'planned':[f'{w}-{kind}' for w in [1280,1440] for kind in ['manual-tail','read-return','edit-return']],'scenes':[],'http':[],'pageerrors':[],'console':[],'fatal':None,'cleanup':[]}
env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env['PATH']='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'];env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false')
p=None
GEOM='''(id)=>{const e=document.getElementById(id);if(!e)return null;let r=e.getBoundingClientRect(),c={left:0,top:0,right:innerWidth,bottom:innerHeight},anc=[];for(let a=e;a;a=a.parentElement){let s=getComputedStyle(a),b=a.getBoundingClientRect(),sx=a.offsetWidth?b.width/a.offsetWidth:1,sy=a.offsetHeight?b.height/a.offsetHeight:1;let x=/(hidden|clip|scroll|auto)/.test(s.overflowX),y=/(hidden|clip|scroll|auto)/.test(s.overflowY);if(x){c.left=Math.max(c.left,b.left+a.clientLeft*sx);c.right=Math.min(c.right,b.left+(a.clientLeft+a.clientWidth)*sx)}if(y){c.top=Math.max(c.top,b.top+a.clientTop*sy);c.bottom=Math.min(c.bottom,b.top+(a.clientTop+a.clientHeight)*sy)}if(x||y)anc.push({id:a.id,x,y,rect:{x:b.x,y:b.y,w:b.width,h:b.height},sx,sy})}let l=Math.max(c.left,r.left),t=Math.max(c.top,r.top),rr=Math.min(c.right,r.right),bb=Math.min(c.bottom,r.bottom),hit=null;if(rr>l&&bb>t){let h=document.elementFromPoint((l+rr)/2,(t+bb)/2);hit=!!h&&(h===e||e.contains(h))}return {rect:{x:r.x,y:r.y,w:r.width,h:r.height},clip:c,intersection:{left:l,top:t,right:rr,bottom:bb},hit,ancestors:anc,transform:getComputedStyle(e).transform,display:getComputedStyle(e).display}}'''
def geom(pg,id):return pg.evaluate(GEOM,id)
def state(pg):return pg.evaluate('''()=>{let env=JSON.parse(localStorage.getItem('agentflow.idea015.workspace'));let id=document.documentElement.dataset.entryId;let p=env?.entries.find(e=>e.entryId===id)?.project;return p?{current:p.currentTaskId,kind:p.draftKind,draft:p.draft,target:p.space.draftTarget,manual:p.tasks.map(t=>({id:t.id,manual:t.manual}))}:null}''')
LAYOUT="()=>{const raw=e=>{let r=e.getBoundingClientRect(),s=getComputedStyle(e);return {tag:e.tagName,id:e.id,cls:e.className,text:e.innerText,rect:{x:r.x,y:r.y,w:r.width,h:r.height},documentY:r.y+scrollY,display:s.display,marginTop:s.marginTop,marginBottom:s.marginBottom,paddingTop:s.paddingTop,paddingBottom:s.paddingBottom,gap:s.gap,open:e.tagName==='DETAILS'?e.open:null}};return {documentHeight:document.documentElement.scrollHeight,bodyHeight:document.body.scrollHeight,viewport:[innerWidth,innerHeight],items:[...document.querySelectorAll('#space-view > *,#space-view > .space-head > *,#area-tasks > *,#notice,[role=status],.notice')].map(raw)}}"
def snap(pg):return {'layout':pg.evaluate(LAYOUT),'window':pg.evaluate('({x:scrollX,y:scrollY,maxY:document.documentElement.scrollHeight-innerHeight})'),'focus':pg.evaluate('document.activeElement?.id'),'caller':geom(pg,'task-open-'+A),'details':pg.locator('#area-idea-full').evaluate('(e)=>e.open') if pg.locator('#area-idea-full').count() else None,'map':geom(pg,'space-map'),'plane':geom(pg,'space-plane'),'map_measurement_boundary':'area view: map/card DOM absent, null is not transform or rect preservation proof','cards':pg.locator('.area-node').evaluate_all('(es)=>es.map(e=>{let r=e.getBoundingClientRect();return {id:e.dataset.areaId,rect:{x:r.x,y:r.y,w:r.width,h:r.height},transform:getComputedStyle(e).transform}})'),'state':state(pg)}
def wheel_to(pg,id):
 moves=[]
 for i in range(60):
  g=geom(pg,id)
  if g and g['hit'] and g['rect']['y']>=0 and g['rect']['y']+g['rect']['h']<pg.viewport_size['height']:return moves
  before=pg.evaluate('scrollY');pg.mouse.move(pg.viewport_size['width']-40,pg.viewport_size['height']//2);pg.mouse.wheel(0,450 if not g or g['rect']['y']>0 else -450);pg.wait_for_timeout(60);moves.append({'before':before,'after':pg.evaluate('scrollY')})
 raise RuntimeError('native wheel cannot reach '+id)
def fresh(browser,url,width):
 ctx=browser.new_context(viewport={'width':width,'height':720 if width==1280 else 900});pg=ctx.new_page();pg.set_default_timeout(5000);pg.on('pageerror',lambda e:result['pageerrors'].append(str(e)));pg.on('console',lambda m:result['console'].append({'type':m.type,'text':m.text}));pg.on('response',lambda r:result['http'].append({'url':r.url,'status':r.status,'bytes':len(r.body()),'sha256':sha(r.body())}) if r.url.startswith(url) and r.request.resource_type in ['document','script','stylesheet'] else None);pg.on('dialog',lambda d:d.accept());pg.goto(url);pg.locator('#import-file').set_input_files(str(ROOT/'fixture.json'));pg.locator('#node-enter-'+area).click();return ctx,pg
try:
 p=subprocess.Popen(['node','continuity/server/index.mjs','--mock'],cwd=APP,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);line=p.stdout.readline();url=re.search(r'http://127\.0\.0\.1:\d+',line).group();result['url']=url;result['server_start']=line.strip()
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True);result['versions']={'playwright':version('playwright'),'browser':browser.version,'node':subprocess.check_output(['node','--version'],env=env,text=True).strip()}
  for width in [1280,1440]:
   ctx,pg=fresh(browser,url,width);wheel_to(pg,'task-open-'+A);before=state(pg);pg.locator('#task-open-'+A).click();opened=[]
   for id in ['task-view-full-understanding','task-view-full-scope','task-view-request','task-view-work','task-view-results','task-view-background','task-view-bases']:
    loc=pg.locator('#'+id)
    if loc.count() and loc.evaluate('(e)=>e.tagName==="DETAILS"&&!e.open'):
     wheel_to(pg,id);loc.locator('summary').click();opened.append(id)
   tails={}
   for key in ['understanding','scope']:
    id='task-view-full-'+key;loc=pg.locator('#'+id+' .source-raw')
    if loc.count():
     tails[key]={'full_body':geom(pg,id),'text':loc.inner_text()}
    else:tails[key]={'full_disclosure_present':False}
   text=pg.locator('#space-view').inner_text();observed={'understanding_tail':'이해끝조건_U_END_보존' in text,'scope_tail':'범위끝조건_S_END_게시선택' in text};result['scenes'].append({'id':f'{width}-manual-tail','opened':opened,'tails':tails,'observed':observed,'read_only_unchanged':before==state(pg),'before':before,'after':state(pg),'status':'PASS' if all(observed.values()) and before==state(pg) else 'FAIL'});pg.screenshot(path=str(OUT/f'{width}-manual-tail.png'));ctx.close()
   for edit in [False,True]:
    ctx,pg=fresh(browser,url,width);pg.locator('#area-idea-full > summary').click();moves=wheel_to(pg,'task-open-'+A);pre=snap(pg);pg.locator('#task-open-'+A).click()
    if edit:
     pg.locator('#task-view-continue').click();wheel_to(pg,'edit-work');summary=pg.locator('#edit-work > summary');
     if not pg.locator('#edit-work').evaluate('(e)=>e.open'):summary.click()
     wheel_to(pg,'work-understanding');pg.locator('#work-understanding').fill('R의 직접 수정: 게시 여부는 담당자가 선택합니다.');wheel_to(pg,'work-return-origin');pg.locator('#work-return-origin').click()
    else:pg.locator('#task-return-origin').click()
    post=snap(pg);delta={'windowY':post['window']['y']-pre['window']['y'],'callerY':post['caller']['rect']['y']-pre['caller']['rect']['y']};ok=post['details']==pre['details'] and abs(delta['windowY'])<=1 and abs(delta['callerY'])<=1 and post['caller']['hit'] and post['focus']=='task-open-'+A
    result['scenes'].append({'id':f'{width}-'+('edit-return' if edit else 'read-return'),'wheel':moves,'pre':pre,'post':post,'delta':delta,'status':'PASS' if ok else 'FAIL'});pg.screenshot(path=str(OUT/(f'{width}-'+('edit' if edit else 'read')+'-return.png')));ctx.close()
  browser.close()
except Exception:
 result['fatal']=traceback.format_exc()
finally:
 if p:
  try:p.terminate();result['server_exit']=p.wait(timeout=10);result['server_stderr']=p.stderr.read()
  except Exception:result['cleanup'].append(traceback.format_exc())
 result['runtime_after']=runtime();result['runtime_unchanged']=result['runtime_before']==result['runtime_after'];
 for h in result['http']:
  path=h['url'].split(result['url'],1)[1].split('?')[0];path='index.html' if path=='/' else path.lstrip('/');h['disk_relative']=path;h['disk_before_sha256']=result['runtime_before'].get(path);h['disk_after_sha256']=result['runtime_after'].get(path);h['http_disk_match']=h['sha256']==h['disk_before_sha256']==h['disk_after_sha256'] and h['status']==200
 result['http_disk_all_match']=all(h['http_disk_match'] for h in result['http']);result['source_after']=source();result['source_unchanged']=result['source_before']==result['source_after'];result['completed']=[s['id'] for s in result['scenes']];result['complete']=result['completed']==result['planned'];result['child_exit']=int(bool(result['fatal'] or result['cleanup'] or result['pageerrors'] or not result['complete'] or not result['source_unchanged'] or not result['runtime_unchanged'] or not result['http_disk_all_match'] or any(s['status']=='FAIL' for s in result['scenes'])));(OUT/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'completed':result['completed'],'fatal':result['fatal'],'exit':result['child_exit']},ensure_ascii=False));
sys.exit(result['child_exit'])
