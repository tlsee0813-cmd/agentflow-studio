from pathlib import Path
import os,sys,json,subprocess,datetime,hashlib,re,traceback,ast,time
from importlib.metadata import version
from playwright.sync_api import sync_playwright
R=Path(__file__).parent;APP=Path('/workspace/browser-env/product13-candidate/app');O=Path(os.environ.get('UI_OUT',str(R/'run01')));O.mkdir(parents=True,exist_ok=True)
# Reuse DOM geometry and native-wheel helpers only, without executing prior checker module.
tree=ast.parse(Path('/workspace/browser-env/product12-boundaries/check.py').read_text());GEOM=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='GEOM' for t in n.targets))
for node in tree.body:
 if isinstance(node,ast.FunctionDef) and node.name in ['geom','wheel_to']:exec(compile(ast.Module(body=[node],type_ignores=[]),'reused-native-geometry','exec'))
def sha(b):return hashlib.sha256(b).hexdigest()
def utc():return datetime.datetime.now(datetime.timezone.utc).isoformat()
def files(folder):return {str(p.relative_to(folder)):sha(p.read_bytes()) for p in folder.rglob('*') if p.is_file()}
KEYS=['understanding','scope','next','checks'];EXPECTED={kind:{k:f'{kind} / {k}: 소개글 한 편의 작은 확인 작업. 게시 선택은 담당자에게 남긴다. {i}' for i,k in enumerate(KEYS)} for kind in ['DIRECT_REPORT','OTHER_REPORT']}
result={'source_commit':'9aeb4599aa0060e2d43143c4f1150884d7bcc7b3','code_sha256':sha(Path(__file__).read_bytes()),'start':utc(),'planned':[f'{w}-{k}-{mode}' for w in [1280,1440] for k in ['READ','DIRECT_REPORT','OTHER_REPORT'] for mode in ['closed','records-open']]+['1280-boundary-group','390-minimal'],'scenes':[],'http_errors':[],'http':[],'pageerrors':[],'console':[],'fatal':None,'cleanup':[],'source_before':files(APP/'continuity/src'),'runtime_before':files(APP/'continuity/dist/public')}
def saved(pg):
 for _ in range(300):
  if not pg.evaluate('!!document.documentElement.dataset.saving'):return
  pg.wait_for_timeout(10)
 raise RuntimeError('save did not finish')
def state(pg):
 saved(pg)
 return pg.evaluate("""()=>{let w=JSON.parse(localStorage.getItem('agentflow.idea015.workspace'));return w?.entries.find(e=>e.entryId===document.documentElement.dataset.entryId)?.project} """)
def clip(pg,id):return geom(pg,id)
def click(pg,id):
 movement=wheel_to(pg,id);g=geom(pg,id)
 if not g['hit']:raise AssertionError('no hit '+id)
 pg.locator('#'+id).click();return {'id':id,'native_wheel':movement,'geometry_before':g}
def summary(pg,id):
 # Click summary itself; container can be taller than viewport after expansion.
 loc=pg.locator('#'+id+' > summary');box=loc.bounding_box()
 for _ in range(40):
  box=loc.bounding_box()
  if box and box['y']>=70 and box['y']+box['height']<pg.viewport_size['height']:break
  pg.mouse.move(pg.viewport_size['width']-25,pg.viewport_size['height']//2);pg.mouse.wheel(0,350 if box['y']>70 else -350);pg.wait_for_timeout(50)
 loc.click()
def snap(pg,caller):
 return {'native_scroll':pg.evaluate('''()=>[document.scrollingElement,...document.querySelectorAll('main,#space-map,#space-view')].map(e=>({tag:e.tagName,id:e.id,x:e.scrollLeft,y:e.scrollTop,clientWidth:e.clientWidth,clientHeight:e.clientHeight,scrollWidth:e.scrollWidth,scrollHeight:e.scrollHeight,overflowX:getComputedStyle(e).overflowX,overflowY:getComputedStyle(e).overflowY}))'''),'state':state(pg),'caller':geom(pg,caller),'caller_id':caller,'focus':pg.evaluate('document.activeElement?.id'),'window':pg.evaluate('({x:scrollX,y:scrollY,maxY:document.documentElement.scrollHeight-innerHeight,maxX:document.documentElement.scrollWidth-innerWidth})'),'plane':geom(pg,'space-plane'),'map':geom(pg,'space-map'),'cards':pg.locator('.area-node').evaluate_all("""es=>es.map(e=>{let r=e.getBoundingClientRect();return {id:e.dataset.areaId,rect:{x:r.x,y:r.y,w:r.width,h:r.height},offset:{x:e.offsetLeft,y:e.offsetTop,w:e.offsetWidth,h:e.offsetHeight},text:e.innerText}})"""),'selected':pg.locator('.area-node.selected').get_attribute('data-area-id') if pg.locator('.area-node.selected').count() else None,'details':pg.locator('#space-view details[id]').evaluate_all('es=>es.map(e=>({id:e.id,open:e.open}))'),'unsaved_name':pg.locator('#panel-name').input_value() if pg.locator('#panel-name').count() else None,'unsaved_note':pg.locator('#panel-note').input_value() if pg.locator('#panel-note').count() else None,'return_select':pg.locator('#return-task').input_value() if pg.locator('#return-task').count() else None,'notice':pg.locator('#notice').inner_text(),'space_title':pg.locator('#space-title').inner_text()}
def state_sem(p):return {'current':p['currentTaskId'],'kind':p['draftKind'],'draft':p['draft'],'target':p['space']['draftTarget'],'manual':{t['id']:t['manual'] for t in p['tasks']}}
def compare(a,b,kind,ids,vals=None):
 checks={};aa,bb=state_sem(a['state']),state_sem(b['state']);expected=json.loads(json.dumps(aa));target=ids['R'] if kind=='DIRECT_REPORT' else ids['A']
 if kind!='READ':expected['current']=target;expected['manual'][target]=vals
 checks['state']=bb==expected;checks['caller_focus']=b['focus']==a['caller_id'];checks['caller_hit']=b['caller']['hit'] is True;checks['selection']=a['selected']==b['selected'];checks['matrix']=a['plane']['transform']==b['plane']['transform'];checks['unsaved_fields']=a['unsaved_name']==b['unsaved_name'] and a['unsaved_note']==b['unsaved_note'];checks['details']=a['details']==b['details'];checks['return_target']=a['return_select']==b['return_select']
 ap=a['caller']['rect']['y']+a['window']['y'];bp=b['caller']['rect']['y']+b['window']['y'];same=abs(ap-bp)<0.01 and a['window']['maxY']==b['window']['maxY'];dy=b['window']['y']-a['window']['y'];anchor=b['caller']['rect']['y']-a['caller']['rect']['y'];checks['reading_position']=abs(dy if same else anchor)<=2
 # Height can change when current-work tags change; intrinsic positions and restored transform are separate from content height.
 checks['intrinsic_card_positions']=[(x['id'],x['offset']['x'],x['offset']['y'],x['offset']['w']) for x in a['cards']]==[(x['id'],x['offset']['x'],x['offset']['y'],x['offset']['w']) for x in b['cards']]
 return {'checks':checks,'window_delta':dy,'caller_y_delta':anchor,'same_content_anchor':same,'card_rect_deltas':[{'id':x['id'],'delta':{k:y['rect'][k]-x['rect'][k] for k in ['x','y','w','h']}} for x,y in zip(a['cards'],b['cards'])]}
def init(browser,url,width,fixture):
 ctx=browser.new_context(viewport={'width':width,'height':844 if width==390 else 720 if width==1280 else 900});pg=ctx.new_page();pg.set_default_timeout(6000);pg.on('dialog',lambda d:d.accept());pg.on('pageerror',lambda e:result['pageerrors'].append(str(e)));pg.on('console',lambda m:result['console'].append({'type':m.type,'text':m.text,'location':m.location}))
 def response(r):
  if r.status>=400:result['http_errors'].append({'url':r.url,'status':r.status,'resource_type':r.request.resource_type})
  if r.url.startswith(url) and r.request.resource_type in ['document','script','stylesheet']:
   body=r.body();path=r.url[len(url):].split('?')[0];path='index.html' if path=='/' else path.lstrip('/');result['http'].append({'url':r.url,'status':r.status,'bytes':len(body),'sha256':sha(body),'disk_path':path})
 pg.on('response',response);pg.goto(url);pg.locator('#import-file').set_input_files(str(R/(fixture+'.json')));pg.locator('#node-info-'+json.loads((R/(fixture+'-ids.json')).read_text())['area']).wait_for();saved(pg);return ctx,pg

def core(browser,url,width,kind,mode):
 scene={'id':f'{width}-{kind}-{mode}','actions':[]};result['scenes'].append(scene);ids=json.loads((R/('other-ids.json' if kind=='OTHER_REPORT' else 'direct-ids.json')).read_text());ctx=None
 try:
  ctx,pg=init(browser,url,width,'other' if kind=='OTHER_REPORT' else 'direct');scene['fixture_setup']='Offline public domain APIs + validated backup, UI import. Operations below are native UI.'
  click(pg,'nav-work')
  if not pg.locator('#compose-panel').evaluate('(e)=>e.open'):summary(pg,'compose-panel')
  assert pg.locator('#return-task').count()==1,'explicit return selector required';click(pg,'return-task');pg.locator('#return-task').select_option(ids['B']);scene['explicit_return_B_selected']=pg.locator('#return-task').input_value();assert scene['explicit_return_B_selected']==ids['B']
  click(pg,'nav-space');summary(pg,'check-list') if mode=='records-open' else None;scene['records_departure_mode']=mode;click(pg,'node-info-'+ids['area']);summary(pg,'panel-edit');click(pg,'panel-name');pg.locator('#panel-name').fill('소개글 영역 — 저장하지 않은 이름');click(pg,'panel-note');pg.locator('#panel-note').fill('보내지 않은 영역 구상. 편집값은 이번 읽기에서 잃지 않는다.');click(pg,'map-zoom-in');click(pg,'map-zoom-in')
  # Real pointer pan on empty visible map background, checked through actual hit.
  candidates=pg.locator('#space-map').evaluate("""e=>{let r=e.getBoundingClientRect(),a=[];for(let fy of [.35,.55,.7,.85])for(let fx of [.15,.35,.55,.75,.9]){let x=r.x+r.width*fx,y=r.y+r.height*fy;if(y<70||y>innerHeight-70)continue;let h=document.elementFromPoint(x,y),id=h?.id||h?.getAttribute('class');if(['space-map','space-plane','relation-layer'].includes(id))a.push({x,y,id})}return a}""");scene['pan_candidates']=candidates
  if not candidates:raise AssertionError('no actual empty map hit')
  x,y=candidates[0]['x'],candidates[0]['y'];scene['pan_hit']=candidates[0]['id']
  pg.mouse.move(x,y);pg.mouse.down();pg.mouse.move(x-42,y-26,steps=6);pg.mouse.up();caller='panel-task-'+ids['A'];scene['departure_wheels']=wheel_to(pg,caller);pre=snap(pg,caller);scene['pre']=pre;assert pre['return_select']==ids['B'],'departure explicit B target not recorded'
  if width==1280 and kind=='READ':pg.screenshot(path=str(O/'01-PC-map.png'))
  pg.locator('#'+caller).click();scene['read_target_text']=pg.locator('#task-view-target').inner_text();scene['context']=pg.locator('#task-view-context').inner_text();scene['read_state']=state_sem(state(pg))
  assert scene['read_state']==state_sem(pre['state']),'reading changed state'
  for _ in range(2):
   summary(pg,'task-view-request');scene['actions'].append({'original_open':pg.locator('#task-view-request').evaluate('(e)=>e.open'),'raw':pg.locator('#task-view-request .source-raw').inner_text()});assert 'A_원문끝' in scene['actions'][-1]['raw'];summary(pg,'task-view-request');assert not pg.locator('#task-view-request .source-raw').is_visible()
  summary(pg,'task-view-results');scene['report_text']=pg.locator('#task-view-results').inner_text();assert 'R_보고끝' in scene['report_text'];summary(pg,'task-view-results')
  vals=EXPECTED.get(kind)
  if kind=='READ':click(pg,'task-return-origin')
  else:
   click(pg,'task-view-continue');target=ids['R'] if kind=='DIRECT_REPORT' else ids['A'];assert state(pg)['currentTaskId']==target
   summary(pg,'edit-work') if not pg.locator('#edit-work').evaluate('(e)=>e.open') else None
   for k in KEYS:click(pg,'work-'+k);pg.locator('#work-'+k).fill(vals[k])
   saved(pg);scene['edited_state']=state_sem(state(pg))
   if width==1440 and kind=='DIRECT_REPORT':pg.screenshot(path=str(O/'02-PC-edit.png'))
   click(pg,'work-return-origin')
  post=snap(pg,caller);scene['post']=post;scene['comparison']=compare(pre,post,kind,ids,vals);assert post['return_select']==ids['B'],'return changed explicit B target';assert all(scene['comparison']['checks'].values()),str(scene['comparison'])
  # Return focus actually reopens the same request; persisted edited target stays.
  pg.keyboard.press('Enter');assert pg.locator('#task-view').is_visible();scene['reentry_state']=state_sem(state(pg));assert scene['reentry_state']==state_sem(post['state']);click(pg,'task-return-origin');scene['second_return']=snap(pg,caller);scene['status']='PASS'
 except Exception:scene['status']='FAIL';scene['error']=traceback.format_exc();
 finally:
  if ctx:ctx.close()

def boundary(browser,url):
 s={'id':'1280-boundary-group','checks':{},'observations':{}};result['scenes'].append(s);ctx=None
 try:
  ids=json.loads((R/'boundary-ids.json').read_text());ctx,pg=init(browser,url,1280,'boundary');click(pg,'node-enter-'+ids['empty']);s['observations']['empty']=pg.locator('#space-view').inner_text();s['checks']['empty_idea_no_tasks']='아직 이 영역의 요청이 없어요.' in s['observations']['empty'] and '구상 미기재' in s['observations']['empty'];click(pg,'nav-space');click(pg,'node-enter-'+ids['area']);click(pg,'task-open-'+ids['A']);s['observations']['context']=pg.locator('#task-view-context').inner_text();s['checks']['empty_manual']=pg.locator('[data-field="understanding"] dd').inner_text()=='(직접 비워 둠)';s['checks']['null_stale']=pg.locator('[data-field="scope"]').get_attribute('data-origin')=='stale';s['observations']['stale_body_before']=clip(pg,'task-view-stale-scope');summary(pg,'task-view-stale-scope');s['observations']['stale_explicit']=pg.locator('#task-view-stale-scope').inner_text();summary(pg,'task-view-stale-scope');s['checks']['stale_closed']=not pg.locator('#task-view-stale-scope .source-raw').is_visible()
  summary(pg,'task-view-background');s['observations']['absent_snapshot']=pg.locator('#task-view-background').inner_text();s['checks']['no_copy']='사본' in s['observations']['absent_snapshot'] and ('없' in s['observations']['absent_snapshot']);summary(pg,'task-view-background');click(pg,'task-view-continue');summary(pg,'edit-work') if not pg.locator('#edit-work').evaluate('(e)=>e.open') else None;s['observations']['stale_excluded_work']={'scope_value':pg.locator('#work-scope').input_value(),'scope_marker':pg.locator('#manual-scope').inner_text(),'empty_understanding':pg.locator('#work-understanding').input_value(),'understanding_marker':pg.locator('#manual-understanding').inner_text()};s['checks']['stale_not_current_work']=s['observations']['stale_excluded_work']['scope_value']=='' and '제외' in s['observations']['stale_excluded_work']['scope_marker'];click(pg,'work-return-origin');click(pg,'nav-space');click(pg,'node-enter-'+ids['other']);click(pg,'task-open-'+ids['B']);summary(pg,'task-view-background');s['observations']['different_snapshot']=pg.locator('#task-view-background').inner_text();s['checks']['different_copy']='그 뒤 구상이 바뀜' in s['observations']['different_snapshot'] and '알림은 이번 소개글 확인과 다른 범위이다.' in s['observations']['different_snapshot'] and '요청 당시와 달라진 현재 알림 구상' not in s['observations']['different_snapshot'];summary(pg,'task-view-background')
  before=state_sem(state(pg));pg.reload();s['observations']['reload']={'title':pg.locator('#space-title').inner_text(),'state':state_sem(state(pg))};s['checks']['reload_persisted']=state_sem(state(pg))==before
  # Actual project switch via list and a new blank project; old project retained, no fabricated cross-project origin.
  click(pg,'nav-projects');s['observations']['project_list']=pg.locator('#projects-view').inner_text();click(pg,'new-project');pg.locator('#brief-input').fill('전환 후 별도 프로젝트: 원래 작업을 임의 선택하지 않는다.');click(pg,'brief-start');s['observations']['new_project']={'state':state_sem(state(pg)),'title':pg.locator('#space-title').inner_text()};s['checks']['actual_project_switch']=state(pg)['id']!=json.loads((R/'boundary.json').read_text())['id'];s['observations']['invalid_departure']='Archive/delete while reading: no in-view UI; static branch only, NOT_RUN; no hidden state mutation.';assert all(s['checks'].values()),str(s['checks']);s['status']='PASS'
 except Exception:s['status']='FAIL';s['error']=traceback.format_exc()
 finally:
  if ctx:ctx.close()

def mobile(browser,url):
 s={'id':'390-minimal','checks':{}};result['scenes'].append(s);ctx=None
 try:
  ids=json.loads((R/'direct-ids.json').read_text());ctx,pg=init(browser,url,390,'direct');click(pg,'list-enter-'+ids['area']);click(pg,'task-open-'+ids['A']);summary(pg,'task-view-request');s['original']=pg.locator('#task-view-request .source-raw').inner_text();pg.screenshot(path=str(O/'03-mobile-original.png'));summary(pg,'task-view-request');s['checks']['closed_body']=not pg.locator('#task-view-request .source-raw').is_visible();s['overflow']=pg.evaluate('({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth})');s['checks']['no_horizontal_overflow']=s['overflow']['scrollWidth']<=s['overflow']['clientWidth'];click(pg,'task-return-origin');s['focus']=pg.evaluate('document.activeElement?.id');s['checks']['caller_focus']=s['focus']=='task-open-'+ids['A'];assert all(s['checks'].values());s['status']='PASS'
 except Exception:s['status']='FAIL';s['error']=traceback.format_exc()
 finally:
  if ctx:ctx.close()
p=None
try:
 env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env.update(PATH='/workspace/browser-env/tools/node_modules/.bin:'+env['PATH'],PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false');p=subprocess.Popen(['node','continuity/server/index.mjs','--mock'],cwd=APP,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);line=p.stdout.readline();url=re.search(r'http://127\.0\.0\.1:\d+',line).group();result['url']=url
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True);result['versions']={'node':subprocess.check_output(['node','--version'],env=env,text=True).strip(),'playwright':version('playwright'),'browser':browser.version}
  for width in [1280,1440]:
   for kind in ['READ','DIRECT_REPORT','OTHER_REPORT']:
    for mode in ['closed','records-open']:core(browser,url,width,kind,mode)
  boundary(browser,url);mobile(browser,url);browser.close()
except Exception:result['fatal']=traceback.format_exc()
finally:
 if p:
  try:p.terminate();result['server_exit']=p.wait(timeout=10);result['server_stderr']=p.stderr.read()
  except Exception:result['cleanup'].append(traceback.format_exc())
 result['source_after']=files(APP/'continuity/src');result['runtime_after']=files(APP/'continuity/dist/public');result['hashes_unchanged']=result['source_before']==result['source_after'] and result['runtime_before']==result['runtime_after']
 for h in result['http']:h['disk_match']=h['status']==200 and h['sha256']==result['runtime_before'].get(h['disk_path'])==result['runtime_after'].get(h['disk_path'])
 result['major_http_errors']=[x for x in result['http_errors'] if not (x['url'].endswith('/favicon.ico') and x['status']==404)];result['major_console_errors']=[x for x in result['console'] if x['type']=='error' and not (x['location'].get('url','').endswith('/favicon.ico') and '404' in x['text'])];result['complete']=[s['id'] for s in result['scenes']]==result['planned'];result['end']=utc();result['exit']=int(bool(result['fatal'] or result['cleanup'] or result['pageerrors'] or result['major_http_errors'] or result['major_console_errors'] or not result['complete'] or not result['hashes_unchanged'] or not all(h['disk_match'] for h in result['http']) or any(s['status']=='FAIL' for s in result['scenes'])));(O/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'complete':result['complete'],'scenes':[(s['id'],s['status']) for s in result['scenes']],'fatal':result['fatal'],'exit':result['exit']}));
sys.exit(result['exit'])
