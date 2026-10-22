from pathlib import Path
import os,subprocess,re,json,hashlib,datetime,traceback,sys
from importlib.metadata import version
from playwright.sync_api import sync_playwright,expect
R=Path(__file__).parent;A=R.parent/'cycle23-candidate/app';N='/workspace/browser-env/tools/node_modules/.bin/node';UTC=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda b:hashlib.sha256(b).hexdigest()
GEO=r'''e=>{const r=e.getBoundingClientRect(),anc=[];let clip={left:0,top:0,right:innerWidth,bottom:innerHeight},accessClip={...clip};for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),sx=s.transform==='none'?1:b.width/(a.offsetWidth||1),sy=s.transform==='none'?1:b.height/(a.offsetHeight||1),c={left:b.left+a.clientLeft*sx,top:b.top+a.clientTop*sy,right:b.left+(a.clientLeft+a.clientWidth)*sx,bottom:b.top+(a.clientTop+a.clientHeight)*sy},x=/(auto|scroll|hidden|clip)/.test(s.overflowX),y=/(auto|scroll|hidden|clip)/.test(s.overflowY);if(x){clip.left=Math.max(clip.left,c.left);clip.right=Math.min(clip.right,c.right)}if(y){clip.top=Math.max(clip.top,c.top);clip.bottom=Math.min(clip.bottom,c.bottom)}if(a!==e){if(x){accessClip.left=Math.max(accessClip.left,c.left);accessClip.right=Math.min(accessClip.right,c.right)}if(y){accessClip.top=Math.max(accessClip.top,c.top);accessClip.bottom=Math.min(accessClip.bottom,c.bottom)}}anc.push({id:a.id,tag:a.tagName,rect:b.toJSON(),client:c,overflow:[s.overflowX,s.overflowY],transform:s.transform,clipPath:s.clipPath,display:s.display,visibility:s.visibility,scroll:[a.scrollLeft,a.scrollTop]})}const x=r.x+r.width/2,y=r.y+r.height/2,h=document.elementFromPoint(x,y),range=document.createRange();range.selectNodeContents(e);return{rect:r.toJSON(),clip:accessClip,textClip:clip,accessScope:"control border against ancestor client clips; own text clip separate",ancestors:anc,hit:!!h&&(h===e||e.contains(h)),hitNode:h?.outerHTML.slice(0,250),full:r.width>0&&r.height>0&&r.left>=accessClip.left-.5&&r.right<=accessClip.right+.5&&r.top>=accessClip.top-.5&&r.bottom<=accessClip.bottom+.5,visible:e.checkVisibility({visibilityProperty:true}),text:e.textContent,rangeRects:[...range.getClientRects()].map(r=>r.toJSON()),scrollY,focus:document.activeElement.id}}'''
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
  self.posts=[];self.apiResponses=[];self.resources=[];self.errors=[];self.console=[];self.failures=[];self.rows=[];self.ctx=None;self.w=0
  env=os.environ.copy();env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false',AI_REQUESTS_PER_MINUTE='60',AI_PROCESS_CALL_CAP='100');self.server=subprocess.Popen([N,'continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);line=self.server.stdout.readline();self.url=re.search(r'http://127\.0\.0\.1:\d+',line).group();self.serverStart=line;self.pw=sync_playwright().start();self.browser=self.pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True);self.version=self.browser.version
 def log(self,label,raw):
  with (R/'ui.jsonl').open('a') as f:f.write(json.dumps({'UTC':UTC(),'viewport':self.w,'label':label,'raw':raw},ensure_ascii=False)+'\n')
 def snap(self):return self.p.evaluate('()=>({y:scrollY,extent:document.documentElement.scrollHeight-innerHeight,focus:document.activeElement.outerHTML.slice(0,600),open:[...document.querySelectorAll("details[open][id]")].map(e=>e.id),selected:[...document.querySelectorAll(".node-info[aria-pressed=true]")].map(e=>e.id),plane:[...document.querySelectorAll("#space-plane")].map(e=>({transform:getComputedStyle(e).transform,rect:e.getBoundingClientRect().toJSON()})),cards:[...document.querySelectorAll(".area-node")].map(e=>({id:e.dataset.areaId,rect:e.getBoundingClientRect().toJSON()}))})')
 def state(self):
  self.p.wait_for_function('()=>!document.documentElement.dataset.saving');return self.p.evaluate('()=>{const e=JSON.parse(localStorage.getItem("agentflow.idea015.workspace"));return e.entries.find(e=>e.entryId===document.documentElement.dataset.entryId).project}')
 def response(self,r):
  try:
   if r.url.endswith('/api/continuity'):
    body=r.body();v={'UTC':UTC(),'viewport':self.w,'url':r.url,'status':r.status,'bytes':len(body),'bodySHA256':sha(body),'body':json.loads(body)};self.apiResponses.append(v);self.log('actual API HTTP response',v);return
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
  self.fill(self.p.get_by_role('textbox',name='요청 또는 돌아온 결과 원문',exact=True),body);before=len(self.posts);self.click(self.p.locator('#send'),'실제 작업문 준비');expect(self.p.locator('#working')).to_have_text('');s=self.state();assert len(self.posts)==before+1;assert self.apiResponses[-1]['status']==200;return s['currentTaskId'],self.posts[-1]
 def export(self,label):
  self.detail('file-return-options');self.click(self.p.locator('#copy-file-work'),'파일 결과용 실제 복사');expect(self.p.locator('#file-handoff-preview')).to_have_count(1);s=self.state();text=self.p.evaluate('navigator.clipboard.readText()');(R/f'{self.w}-{label}.md').write_text(text);t=next(t for t in s['tasks'] if t['id']==s['currentTaskId']);H=t['handoffs'][-1];blocks=[json.loads(x) for x in re.findall(r'```json\n(.*?)\n```',text,re.S)];f=next(x for x in blocks if x.get('schemaVersion')=='agentflow.return.2');u=next(x for x in blocks if x.get('version')=='understanding.1');assert [f['taskId'],f['returnId'],f['projectId']]==[t['id'],H['returnId'],s['id']];self.log('actual clipboard export '+label,{'H':H,'template':f,'understandingTemplate':u,'snapshot':self.snap()});return f,u,H,text
 def manual(self):
  self.detail('edit-work')
  for k,v in MANUAL.items():self.fill(self.p.locator('#work-'+k),v)
  self.state()
 def screenshot(self,label):self.p.screenshot(path=str(R/f'{self.w}-{label}.png'));self.log('PNG '+label,self.snap())
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
  runtime={'UTC':UTC(),'browserVersion':self.version,'playwright':version('playwright'),'HTTP':self.resources,'console':self.console,'pageerrors':self.errors,'cleanupErrors':errors,'serverTermination':'terminate requested after test; actual exit distinct from child','actualServerExit':self.server.returncode};(R/'runtime.json').write_text(json.dumps(runtime,ensure_ascii=False,indent=2));(R/'posts.json').write_text(json.dumps(self.posts,ensure_ascii=False,indent=2));(R/'api-responses.json').write_text(json.dumps(self.apiResponses,ensure_ascii=False,indent=2));return errors
