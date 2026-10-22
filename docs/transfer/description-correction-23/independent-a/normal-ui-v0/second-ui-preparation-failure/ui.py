from pathlib import Path
import os,subprocess,re,json,hashlib,datetime,traceback,sys
from importlib.metadata import version
from playwright.sync_api import sync_playwright,expect
R=Path(__file__).parent;A=R.parent/'cycle23-candidate/app';N='/workspace/browser-env/tools/node_modules/.bin/node';UTC=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda b:hashlib.sha256(b).hexdigest()
GEO=r'''e=>{const r=e.getBoundingClientRect(),anc=[];let clip={left:0,top:0,right:innerWidth,bottom:innerHeight};for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),sx=s.transform==='none'?1:b.width/(a.offsetWidth||1),sy=s.transform==='none'?1:b.height/(a.offsetHeight||1),c={left:b.left+a.clientLeft*sx,top:b.top+a.clientTop*sy,right:b.left+(a.clientLeft+a.clientWidth)*sx,bottom:b.top+(a.clientTop+a.clientHeight)*sy},x=/(auto|scroll|hidden|clip)/.test(s.overflowX),y=/(auto|scroll|hidden|clip)/.test(s.overflowY);if(x){clip.left=Math.max(clip.left,c.left);clip.right=Math.min(clip.right,c.right)}if(y){clip.top=Math.max(clip.top,c.top);clip.bottom=Math.min(clip.bottom,c.bottom)}anc.push({id:a.id,tag:a.tagName,rect:b.toJSON(),client:c,overflow:[s.overflowX,s.overflowY],transform:s.transform,clipPath:s.clipPath,display:s.display,visibility:s.visibility,scroll:[a.scrollLeft,a.scrollTop]})}const x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y),range=document.createRange();range.selectNodeContents(e);return{rect:r.toJSON(),clip,ancestors:anc,hit:!!h&&(h===e||e.contains(h)),hitNode:h?.outerHTML.slice(0,250),full:r.width>0&&r.height>0&&r.left>=clip.left-.5&&r.right<=clip.right+.5&&r.top>=clip.top-.5&&r.bottom<=clip.bottom+.5,visible:e.checkVisibility({visibilityProperty:true}),text:e.textContent,rangeRects:[...range.getClientRects()].map(r=>r.toJSON()),scrollY,focus:document.activeElement.id}}'''
PURPOSE='[합성23] 자료 보관 안내를 정리하는 작은 서비스. 보관 정책과 동작은 바꾸지 않는다.'
AREAS=[('보관 안내','현재 자료 보관 안내문을 설명한다. 실제 보관 정책은 변경하지 않는다.'),('자료 찾기','저장된 자료를 찾는 안내를 설명한다.')]
REQUEST='자료 보관 안내문을 읽기 쉽게 정리해 주세요. 보관 동작과 배포는 범위 밖입니다.'
FOLLOW='이 부분 안내문의 표현을 더 읽기 쉽게 정리해 주세요. 보관 동작과 배포는 바꾸지 마세요.'
EXTERNAL='[명시 합성 외부 설명] 현재 자료 보관 안내의 표시는 7일이다.'
CORRECTION='[합성 사용자 설명 정정] 실제 표시는 30일이며 이전 설명의 7일은 오류다. 새 보관 정책을 지시하는 것이 아니다.'
ORIGIN='독립 관측자가 실제 내보낸 템플릿에 작성한 합성 설명. AI 실행·사실 검증 없음.'
MANUAL={'understanding':'[23-M-U] 자료 보관 안내문 정리 대상이다.','scope':'[23-M-S] 안내 표현만 다루고 보관 동작을 유지한다.','next':'[23-M-N] 안내 표현의 변경 후보를 정리한다. 배포하지 않는다.','checks':'[23-M-C] 안내문 외 동작 변경이 없는지 확인한다.'}
class UI:
 def __init__(self):
  self.posts=[];self.resources=[];self.errors=[];self.console=[];self.failures=[];self.rows=[];self.ctx=None;self.w=0
  env=os.environ.copy();env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false');self.server=subprocess.Popen([N,'continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);line=self.server.stdout.readline();self.url=re.search(r'http://127\.0\.0\.1:\d+',line).group();self.serverStart=line;self.pw=sync_playwright().start();self.browser=self.pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True);self.version=self.browser.version
 def log(self,label,raw):
  with (R/'ui.jsonl').open('a') as f:f.write(json.dumps({'UTC':UTC(),'viewport':self.w,'label':label,'raw':raw},ensure_ascii=False)+'\n')
 def snap(self):return self.p.evaluate('()=>({y:scrollY,extent:document.documentElement.scrollHeight-innerHeight,focus:document.activeElement.outerHTML.slice(0,600),open:[...document.querySelectorAll("details[open][id]")].map(e=>e.id),selected:[...document.querySelectorAll(".node-info[aria-pressed=true]")].map(e=>e.id),plane:[...document.querySelectorAll("#space-plane")].map(e=>({transform:getComputedStyle(e).transform,rect:e.getBoundingClientRect().toJSON()})),cards:[...document.querySelectorAll(".area-node")].map(e=>({id:e.dataset.areaId,rect:e.getBoundingClientRect().toJSON()}))})')
 def state(self):
  self.p.wait_for_function('!document.documentElement.dataset.saving');return self.p.evaluate('()=>{const e=JSON.parse(localStorage.getItem("agentflow.idea015.workspace"));return e.entries.find(e=>e.entryId===document.documentElement.dataset.entryId).project}')
 def response(self,r):
  try:
   rel=r.url[len(self.url):].split('?')[0].lstrip('/') or 'index.html';f=A/'continuity/dist/public'/rel
   if f.is_file():b=r.body();self.resources.append({'url':r.url,'status':r.status,'bytes':len(b),'httpSHA256':sha(b),'diskSHA256':sha(f.read_bytes()),'path':rel})
  except Exception as e:self.resources.append({'url':r.url,'captureError':str(e)})
 def new(self,w,h):
  if self.ctx:self.ctx.close()
  self.w=w;self.ctx=self.browser.new_context(viewport={'width':w,'height':h},permissions=['clipboard-read','clipboard-write']);self.ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(self.url) else r.abort());self.p=self.ctx.new_page();self.p.on('pageerror',lambda e:self.errors.append(str(e)));self.p.on('console',lambda m:self.console.append({'type':m.type,'text':m.text}));self.p.on('response',self.response);self.p.on('request',self.post);self.p.goto(self.url)
 def post(self,r):
  if r.method=='POST' and r.url.endswith('/api/continuity'):
   v={'UTC':UTC(),'viewport':self.w,'url':r.url,'payload':r.post_data_json};self.posts.append(v);self.log('actual HTTP POST',v)
 def wheel(self,dy,panel=None):
  pos=panel.bounding_box() if panel else None;x=pos['x']+8 if pos else self.w-12;y=pos['y']+pos['height']/2 if pos else self.p.viewport_size['height']//2
  self.p.evaluate('''()=>{const p={promise:null,result:null,cancel:null};let resolve,timer,active=false;const events=[];p.promise=new Promise(r=>resolve=r);const done=(ok,reason)=>{if(p.result)return;clearTimeout(timer);document.removeEventListener('wheel',wheel,true);document.removeEventListener('scrollend',end,true);p.result={ok,reason,events,y:scrollY};resolve(p.result)};const wheel=e=>{if(e.isTrusted){active=true;events.push({type:'wheel',delta:e.deltaY,target:e.target.id})}},end=e=>{if(active){events.push({type:'scrollend',target:e.target.id??'document'});done(true,'native-scrollend')}};p.cancel=()=>done(false,'cleanup');document.addEventListener('wheel',wheel,true);document.addEventListener('scrollend',end,true);timer=setTimeout(()=>done(false,'native-scroll-deadline'),4000);window.__ind23Wheel=p}''')
  try:self.p.mouse.move(x,y);self.p.mouse.wheel(0,dy);v=self.p.evaluate('async()=>await window.__ind23Wheel.promise');self.log('native wheel',v);assert v['ok'],v
  finally:self.p.evaluate('()=>{window.__ind23Wheel.cancel();delete window.__ind23Wheel}')
 def reach(self,q):
  for _ in range(40):
   g=q.evaluate(GEO)
   if g['visible'] and g['full'] and g['hit']:return g
   r=g['rect'];c=g['clip'];dy=r['top']-c['top']-5 if r['top']<c['top'] else r['bottom']-c['bottom']+5;panel=q.locator('xpath=ancestor::*[@id="area-panel-body"]');self.wheel(max(-400,min(400,dy)),panel if panel.count() else None)
  raise AssertionError('normal native reach failed '+str(g))
 def click(self,q,label):
  before=self.reach(q);q.click();self.log('normal click '+label,{'before':before,'after':self.snap()})
 def button(self,name):self.click(self.p.get_by_role('button',name=name,exact=True),name)
 def text(self,name):self.click(self.p.get_by_text(name,exact=True),name)
 def fill(self,q,value):self.reach(q);q.fill(value);self.log('normal input',{'id':q.get_attribute('id'),'value':value})
 def detail(self,id):
  q=self.p.locator('#'+id)
  if not q.evaluate('e=>e.open'):self.click(q.locator(':scope > summary'),'open '+id)
 def map(self):self.click(self.p.locator('#nav-space'),'전체 공간');self.state()
 def info(self,name):
  q=self.p.locator('#area-panel-close')
  if q.count() and q.is_visible():self.click(q,'close previous info')
  self.button('전체 맞춤');self.button(name+' 정보 (들어가지 않음)')
 def send(self,body):
  self.fill(self.p.get_by_role('textbox',name='요청 또는 돌아온 결과 원문',exact=True),body);before=len(self.posts);self.click(self.p.locator('#send'),'실제 작업문 준비');expect(self.p.locator('#working')).to_have_text('');s=self.state();assert len(self.posts)==before+1;return s['currentTaskId'],self.posts[-1]
 def export(self,label):
  self.detail('file-return-options');self.click(self.p.locator('#copy-file-work'),'파일 결과용 실제 복사');expect(self.p.locator('#file-handoff-preview')).to_have_count(1);s=self.state();text=self.p.evaluate('navigator.clipboard.readText()');(R/f'{self.w}-{label}.md').write_text(text);t=next(t for t in s['tasks'] if t['id']==s['currentTaskId']);H=t['handoffs'][-1];blocks=[json.loads(x) for x in re.findall(r'```json\n(.*?)\n```',text,re.S)];f=next(x for x in blocks if x.get('schemaVersion')=='agentflow.return.2');u=next(x for x in blocks if x.get('version')=='understanding.1');assert [f['taskId'],f['returnId'],f['projectId']]==[t['id'],H['returnId'],s['id']];self.log('actual clipboard export '+label,{'H':H,'template':f,'understandingTemplate':u,'snapshot':self.snap()});return f,u,H,text
 def manual(self):
  self.detail('edit-work')
  for k,v in MANUAL.items():self.fill(self.p.locator('#work-'+k),v)
  self.state()
 def screenshot(self,label):self.p.screenshot(path=str(R/f'{self.w}-{label}.png'));self.log('PNG '+label,self.snap())
 def run(self,w,h):
  self.new(w,h);self.click(self.p.locator('#nav-projects'),'내 프로젝트');self.button('＋ 새 프로젝트');self.fill(self.p.get_by_role('textbox',name='무엇을 만드나요? 프로젝트 목적 · 작업 요청과 따로 보관해요',exact=True),PURPOSE);self.button('영역 나누러 가기')
  for name,note in AREAS:
   self.fill(self.p.get_by_role('textbox',name='영역 이름',exact=True),name);self.fill(self.p.get_by_role('textbox',name='영역 설명',exact=True),note);self.button('＋ 영역 추가');self.state()
  self.text('관계 적기')
  for name,value in [('어느 영역에서','보관 안내'),('어느 영역으로','자료 찾기'),('관계 유형','이어서 사용')]:q=self.p.get_by_role('combobox',name=name,exact=True);self.reach(q);q.select_option(label=value)
  self.fill(self.p.get_by_role('textbox',name='관계 설명',exact=True),'보관 안내의 결과를 자료 찾기 안내에서 참고한다.');self.button('관계 추가');s=self.state();aid=next(a['id'] for a in s['space']['areas'] if a['name']=='보관 안내');bid=next(a['id'] for a in s['space']['areas'] if a['name']=='자료 찾기');protected={'areas':s['space']['areas'],'bases':s['bases'],'brief':s['space']['brief'],'relations':s['space']['relations']}
  self.info('보관 안내');self.button('이 영역에 새 요청');task,initialPost=self.send(REQUEST);assert initialPost['payload'].get('currentAreaDescription') is None;self.manual();f,u,H,text=self.export('first-H-before-correction');assert H['work']==MANUAL
  raw={**f,'report':'[명시 합성23 보고] 현재 안내문 표시를 7일이라고 읽은 보고. 실제 구현·실행·외부 검사 없음.','evidence':None,'understanding':{**u,'summary':EXTERNAL,'changes':['[합성] 안내 표시는 7일이라는 외부 설명'],'proposal':None,'origin':ORIGIN}};path=R/f'{w}-synthetic-return2.json';path.write_text(json.dumps(raw,ensure_ascii=False,indent=2));self.button('결과 JSON 가져오기')
  with self.p.expect_file_chooser() as chooser:self.button('결과 파일 선택')
  chooser.value.set_files(str(path));self.button('이 결과 가져오기');expect(self.p.locator('#received-result-open')).to_be_visible();p=self.state();report=next(t for t in p['tasks'] if t.get('resultFile') and t['resultFile']['returnId']==f['returnId']);self.log('received actual target/report/H',{'area':aid,'requestTask':task,'reportTask':report['id'],'H':H,'raw':raw})
  # A normal B request proves null isolation and permits explicit navigation back to the original A request.
  self.map();self.info('자료 찾기');self.button('이 영역에 새 요청');B,bpost=self.send('자료를 찾는 안내문을 읽기 쉽게 정리해 주세요. 보관 안내문은 바꾸지 마세요.');assert bpost['payload'].get('currentAreaDescription') is None
  self.map();self.info('보관 안내');self.button(REQUEST+' ↘');self.click(self.p.locator('#task-view-continue'),'읽은 A 원요청 이어가기');p=self.state();assert p['currentTaskId']==task;assert next(t for t in p['tasks'] if t['id']==task)['manual']==MANUAL
  # Retry from UI while external description is valid.
  i=len(self.posts);self.click(self.p.locator('#retry-work'),'외부 설명 상태에서 같은 입력 재정리');expect(self.p.locator('#working')).to_have_text('');p=self.state();assert len(self.posts)==i+1;ext=self.posts[-1]['payload']['currentAreaDescription'];assert ext=={'taskId':task,'areaId':aid,'revision':1,'by':'external','corrects':None,'source':{'taskId':report['id'],'returnId':f['returnId'],'origin':ORIGIN},'text':EXTERNAL};self.log('external POST independently expected match',ext)
  self.map();self.info('보관 안내');self.text('설명 오류 고치기');self.fill(self.p.get_by_role('textbox',name='영역 설명 정정',exact=True),CORRECTION);self.button('정정 저장');p=self.state();self.screenshot('corrected-area-description')
  assert {'areas':p['space']['areas'],'bases':p['bases'],'brief':p['space']['brief'],'relations':p['space']['relations']}==protected
  self.click(self.p.locator('#nav-work'),'현재 작업');assert self.state()['currentTaskId']==task;i=len(self.posts);self.click(self.p.locator('#retry-work'),'사용자 정정 후 같은 입력 재정리');expect(self.p.locator('#working')).to_have_text('');p=self.state();assert len(self.posts)==i+1;user=self.posts[-1]['payload']['currentAreaDescription'];assert user=={'taskId':task,'areaId':aid,'revision':2,'by':'user','corrects':1,'source':None,'text':CORRECTION};ta=next(t for t in p['tasks'] if t['id']==task);assert ta['manual']==MANUAL;assert ta['handoffs'][0]==H;assert next(t for t in p['tasks'] if t['id']==report['id'])['resultFile']==report['resultFile'];self.log('corrected same-task POST + protected values',{'reference':user,'manual':ta['manual'],'oldH':ta['handoffs'][0],'areasBriefBasesRelationsUnchanged':True,'rawReportUnchanged':True})
  self.map();self.info('보관 안내');self.button('이 영역에 새 요청');C,cpost=self.send(FOLLOW);assert '30' not in FOLLOW and '7일' not in FOLLOW;ref=cpost['payload']['currentAreaDescription'];assert ref=={**user,'taskId':C};assert cpost['payload']['ticket']['taskId']==C;f2,u2,H2,text2=self.export('followup-H-user-reference');assert f2['taskId']==C and H2['anchor']['areaId']==aid and CORRECTION in text2;assert '미검증' in text2
  self.screenshot('followup-export-current-reference');self.map();p=self.state();snap=self.snap();assert 'node-info-'+aid in snap['selected'];assert p['currentTaskId']==C;assert {'areas':p['space']['areas'],'bases':p['bases'],'brief':p['space']['brief'],'relations':p['space']['relations']}==protected;assert next(t for t in p['tasks'] if t['id']==task)['manual']==MANUAL;(R/f'{w}-final-project.json').write_text(json.dumps(p,ensure_ascii=False,indent=2));self.log('final map + actual new current kept',{'snapshot':snap,'C':C,'area':aid,'A':task,'report':report['id'],'B':B,'finalH':H2});self.rows.append({'viewport':[w,h],'complete':True,'Aarea':aid,'Barea':bid,'Atask':task,'reportT':report['id'],'Btask':B,'newC':C,'firstH':H['returnId'],'finalH':H2['returnId'],'externalReference':ext,'correctedReference':user,'newRequestReference':ref,'BReference':bpost['payload'].get('currentAreaDescription'),'sameTaskManualPreserved':True,'oldHAndReportPreserved':True,'planAndRelationsUnchanged':True,'finalTargetSelected':True})
 def close(self):
  errors=[]
  try:
   if self.ctx:self.ctx.close()
   self.browser.close();self.pw.stop()
  except Exception:errors.append(traceback.format_exc())
  self.server.terminate()
  try:out,err=self.server.communicate(timeout=10)
  except Exception:errors.append(traceback.format_exc());self.server.kill();out,err=self.server.communicate()
  (R/'server.stdout.log').write_text(self.serverStart+out);(R/'server.stderr.log').write_text(err)
  for r in self.resources:
   if 'path' in r:r['diskAfterSHA256']=sha((A/'continuity/dist/public'/r['path']).read_bytes())
  runtime={'UTC':UTC(),'browserVersion':self.version,'playwright':version('playwright'),'HTTP':self.resources,'console':self.console,'pageerrors':self.errors,'cleanupErrors':errors,'serverTermination':'terminate requested after test; actual exit distinct from child','actualServerExit':self.server.returncode};(R/'runtime.json').write_text(json.dumps(runtime,ensure_ascii=False,indent=2));(R/'posts.json').write_text(json.dumps(self.posts,ensure_ascii=False,indent=2));return errors
u=None;code=1
try:
 u=UI()
 for w,h in [(1280,720),(1440,900)]:
  try:u.run(w,h)
  except Exception:
   raw=traceback.format_exc();u.failures.append({'viewport':[w,h],'traceback':raw});print(raw,file=sys.stderr);u.screenshot('first-failure');u.log('failure original AX',u.p.locator('body').aria_snapshot());break
finally:
 if u:
  cleanup=u.close();code=int(bool(u.failures or u.errors or cleanup or len(u.rows)!=2));(R/'result.json').write_text(json.dumps({'sourceCommit':'689c47888fb7ab5040d184c2d36f2adff8f2a575','expectedViewports':2,'completedViewports':len(u.rows),'rows':u.rows,'failures':u.failures,'pageErrors':u.errors,'cleanupErrors':cleanup,'plannedChildExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
