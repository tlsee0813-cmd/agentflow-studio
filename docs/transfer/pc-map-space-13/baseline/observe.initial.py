from pathlib import Path
import subprocess,os,json,re,sys,hashlib,datetime,traceback
from importlib.metadata import version
from playwright.sync_api import sync_playwright
R=Path(__file__).parent;APP=R.parent/'product12-candidate-fix2/app';O=R/'evidence';O.mkdir(exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def runtime():return {str(p.relative_to(APP/'continuity/dist/public')):sha(p.read_bytes()) for p in (APP/'continuity/dist/public').rglob('*') if p.is_file()}
MEASURE="""e=>{let b=e.getBoundingClientRect(),s=getComputedStyle(e),c={left:0,top:0,right:innerWidth,bottom:innerHeight},anc=[];for(let a=e;a;a=a.parentElement){let z=getComputedStyle(a),r=a.getBoundingClientRect(),sx=a.offsetWidth?r.width/a.offsetWidth:1,sy=a.offsetHeight?r.height/a.offsetHeight:1,x=/(hidden|clip|auto|scroll)/.test(z.overflowX),y=/(hidden|clip|auto|scroll)/.test(z.overflowY);if(x){c.left=Math.max(c.left,r.left+a.clientLeft*sx);c.right=Math.min(c.right,r.left+(a.clientLeft+a.clientWidth)*sx)}if(y){c.top=Math.max(c.top,r.top+a.clientTop*sy);c.bottom=Math.min(c.bottom,r.top+(a.clientTop+a.clientHeight)*sy)}if(x||y)anc.push({id:a.id,tag:a.tagName,overflowX:z.overflowX,overflowY:z.overflowY,rect:{x:r.x,y:r.y,w:r.width,h:r.height},scale:[sx,sy]})}let l=Math.max(c.left,b.left),t=Math.max(c.top,b.top),r=Math.min(c.right,b.right),bb=Math.min(c.bottom,b.bottom),hit=false;if(r>l&&bb>t){let h=document.elementFromPoint((l+r)/2,(t+bb)/2);hit=!!h&&(e===h||e.contains(h))}let range=document.createRange();range.selectNodeContents(e);let textRange=[...range.getClientRects()].map(q=>({x:q.x,y:q.y,w:q.width,h:q.height}));return {tag:e.tagName,id:e.id,text:e.innerText,rect:{x:b.x,y:b.y,w:b.width,h:b.height},clip:c,ancestors:anc,visibleHeight:Math.max(0,bb-t),visibleWidth:Math.max(0,r-l),sampleHit:hit,display:s.display,visibility:s.visibility,fontSize:s.fontSize,computedTransform:s.transform,textRanges:textRange}}"""
r={'start':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baseline_commit':'9613208f40f1f7f8506504ac6025f06e421edd4d','contract':'dbd034e05e9679f588a7170eed230299ea216dd8','script_sha256':sha(Path(__file__).read_bytes()),'runtime_before':runtime(),'planned':['1280-import-notice','1280-no-notice','1440-import-notice','1440-no-notice'],'scenes':[],'responses':[],'pageerrors':[],'console':[],'http_errors':[],'fatal':None,'cleanup':[],'candidate_tests':'PENDING_FIXED_SHA'}
def m(pg,selector):return pg.locator(selector).evaluate(MEASURE) if pg.locator(selector).count() else None
def state(pg):return pg.evaluate("""()=>{let w=JSON.parse(localStorage.getItem('agentflow.idea015.workspace'));return w?.entries.find(e=>e.entryId===document.documentElement.dataset.entryId)?.project} """)
def wait_saved(pg):
 for _ in range(300):
  if not pg.evaluate('!!document.documentElement.dataset.saving'):return
  pg.wait_for_timeout(10)
 raise RuntimeError('save not complete')
def capture(pg,width,notice):
 wait_saved(pg);pg.evaluate('document.fonts.ready');before=state(pg);ids=json.loads((R/'fixture-check.json').read_text())['both']['ids'];mp=m(pg,'#space-map');scene={'id':f'{width}-'+('import-notice' if notice else 'no-notice'),'viewport':pg.evaluate('({width:innerWidth,height:innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio})'),'scroll':pg.evaluate('({x:scrollX,y:scrollY,maxX:document.documentElement.scrollWidth-innerWidth,maxY:document.documentElement.scrollHeight-innerHeight})'),'map':mp,'notice':m(pg,'#notice'),'project_header':m(pg,'#project-header'),'purpose':m(pg,'#space-brief'),'title':m(pg,'#space-title'),'check_list':m(pg,'#check-list'),'add_form':m(pg,'#area-add-form'),'cards':[],'tools':{k:m(pg,'#'+k) for k in ['map-zoom-in','map-zoom-out','map-fit','map-scale']}}
 for area in ids['areas']:
  card=f'.area-node[data-area-id="{area}"]';scene['cards'].append({'area':area,'box':m(pg,card),'title':m(pg,card+' .area-card-name'),'enter':m(pg,'#node-enter-'+area),'info':m(pg,'#node-info-'+area)})
 scene['map_visible_ratio']=mp['visibleHeight']/scene['viewport']['height'];scene['criteria']={'map_height_40pct':scene['map_visible_ratio']>=.4,'first_card_title_has_visible_range':any(x['y']+x['h']>scene['cards'][0]['title']['clip']['top'] and x['y']<scene['cards'][0]['title']['clip']['bottom'] for x in scene['cards'][0]['title']['textRanges']),'first_card_title_sample_hit':scene['cards'][0]['title']['sampleHit'],'first_card_enter_hit':scene['cards'][0]['enter']['sampleHit'],'first_card_info_hit':scene['cards'][0]['info']['sampleHit'],'no_first_screen_scroll':scene['scroll']['x']==0 and scene['scroll']['y']==0,'expected_notice':(scene['notice']['display']!='none' and bool(scene['notice']['text']))==notice};scene['read_only_state_unchanged']=before==state(pg);scene['status']='PASS' if all(scene['criteria'].values()) and scene['read_only_state_unchanged'] else 'FAIL';r['scenes'].append(scene)
 if (width==1280 and notice) or (width==1440 and not notice):pg.screenshot(path=str(O/(scene['id']+'.png')))
p=None
try:
 env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],AI_MODE='mock',ALLOW_PAID_AI='false',PORT='0');p=subprocess.Popen(['node','continuity/server/index.mjs','--mock'],cwd=APP,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);line=p.stdout.readline();url=re.search(r'http://127\.0\.0\.1:\d+',line).group();r['url']=url;r['server_start']=line.strip()
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True);r['versions']={'node':subprocess.check_output(['node','--version'],env=env,text=True).strip(),'playwright':version('playwright'),'browser':b.version}
  for width,height in [(1280,720),(1440,900)]:
   ctx=b.new_context(viewport={'width':width,'height':height});pg=ctx.new_page();pg.on('dialog',lambda d:d.accept());pg.on('pageerror',lambda e:r['pageerrors'].append(str(e)));pg.on('console',lambda x:r['console'].append({'type':x.type,'text':x.text,'location':x.location}))
   def response(x):
    if x.status>=400:r['http_errors'].append({'url':x.url,'status':x.status})
    if x.request.resource_type in ['document','script','stylesheet']:
     body=x.body();path=x.url[len(url):].split('?')[0];path='index.html' if path=='/' else path.lstrip('/');r['responses'].append({'url':x.url,'status':x.status,'bytes':len(body),'sha256':sha(body),'disk_path':path})
   pg.on('response',response);pg.goto(url);pg.locator('#import-file').set_input_files(str(R/'both.json'));pg.locator('#space-map').wait_for();capture(pg,width,True)
   # Actual new page load/list-open clears normal one-time notice through supported navigation, no DOM hiding.
   pg.reload();pg.locator('.project-open').first.click();pg.locator('#space-map').wait_for();capture(pg,width,False)
   if width==1440:
    zoom=lambda:pg.evaluate('({innerWidth,innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio,visualScale:visualViewport.scale})');z0=zoom();pg.keyboard.press('Control+Equal');pg.keyboard.press('Control+Equal');pg.wait_for_timeout(150);z1=zoom();pg.keyboard.press('Control+Digit0');r['native125_zoom_capability']={'method':'actual Control+Equal twice, no CDP/CSS/device emulation','before':z0,'after':z1,'result':'NOT_RUN' if z0==z1 else 'OBSERVED_CHANGE_NOT_ASSUMED_125','reason':'headless native browser shortcut produced no observable zoom' if z0==z1 else 'change requires exact zoom validation; no125PASS assigned'}
   ctx.close()
  b.close()
except Exception:r['fatal']=traceback.format_exc()
finally:
 if p:
  try:p.terminate();r['server_exit']=p.wait(timeout=10);r['server_stderr']=p.stderr.read()
  except Exception:r['cleanup'].append(traceback.format_exc())
 r['runtime_after']=runtime();r['runtime_unchanged']=r['runtime_before']==r['runtime_after']
 for x in r['responses']:x['disk_match']=x['status']==200 and x['sha256']==r['runtime_before'].get(x['disk_path'])==r['runtime_after'].get(x['disk_path'])
 r['complete']=[s['id'] for s in r['scenes']]==r['planned'];r['major_console']=[x for x in r['console'] if x['type']=='error' and not(x['location'].get('url','').endswith('/favicon.ico') and '404' in x['text'])];r['major_http']=[x for x in r['http_errors'] if not(x['url'].endswith('/favicon.ico') and x['status']==404)];r['end']=datetime.datetime.now(datetime.timezone.utc).isoformat();r['child_exit']=int(bool(r['fatal'] or r['cleanup'] or r['pageerrors'] or r['major_console'] or r['major_http'] or not r['complete'] or not r['runtime_unchanged'] or not all(x['disk_match'] for x in r['responses']) or any(s['status']=='FAIL' for s in r['scenes'])));(O/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({'complete':r['complete'],'fatal':r['fatal'],'scenes':[(s['id'],s['map_visible_ratio'],s['status']) for s in r['scenes']],'child_exit':r['child_exit']}))
sys.exit(r['child_exit'])
