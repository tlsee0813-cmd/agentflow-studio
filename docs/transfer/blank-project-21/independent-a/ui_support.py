from pathlib import Path
import os,subprocess,re,json,hashlib
from playwright.sync_api import sync_playwright
R=Path(__file__).parent
GEO=r'''e=>{const q=e.getBoundingClientRect(),box=r=>({x:r.x,y:r.y,width:r.width,height:r.height,top:r.top,right:r.right,bottom:r.bottom,left:r.left});let c={left:0,top:0,right:innerWidth,bottom:innerHeight},clips=[];for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect(),kx=b.width/(p.offsetWidth||b.width||1),ky=b.height/(p.offsetHeight||b.height||1),r={left:b.left+p.clientLeft*kx,top:b.top+p.clientTop*ky,right:b.left+(p.clientLeft+p.clientWidth)*kx,bottom:b.top+(p.clientTop+p.clientHeight)*ky},x=/(auto|scroll|hidden|clip)/.test(s.overflowX),y=/(auto|scroll|hidden|clip)/.test(s.overflowY);if(x||y){if(x){c.left=Math.max(c.left,r.left);c.right=Math.min(c.right,r.right)}if(y){c.top=Math.max(c.top,r.top);c.bottom=Math.min(c.bottom,r.bottom)}clips.push({tag:p.tagName,id:p.id,overflowX:s.overflowX,overflowY:s.overflowY,rect:box(b),scaleX:kx,scaleY:ky,clip:r,self:p===e})}}const pts=[[.5,.5],[.15,.5],[.85,.5]].map(([x,y])=>{const px=q.x+q.width*x,py=q.y+q.height*y,h=document.elementFromPoint(px,py);return{x:px,y:py,inClip:px>=c.left&&px<=c.right&&py>=c.top&&py<=c.bottom,hit:!!h&&(h===e||e.contains(h)),hitNode:h?.outerHTML.slice(0,180)}});let texts=[];const w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);while(w.nextNode()){if(!w.currentNode.textContent.trim())continue;const r=document.createRange();r.selectNodeContents(w.currentNode);texts.push({text:w.currentNode.textContent,rects:[...r.getClientRects()].map(box)})}return{rect:box(q),viewport:[innerWidth,innerHeight],clip:c,ancestors:clips,points:pts,visible:e.checkVisibility({visibilityProperty:true}),full:q.width>0&&q.height>0&&q.left>=c.left-.5&&q.right<=c.right+.5&&q.top>=c.top-.5&&q.bottom<=c.bottom+.5,texts,scrollY,focus:document.activeElement.id,open:e.closest('details')?.open}}'''
SNAP=r'''()=>({viewport:[innerWidth,innerHeight],scrollY,maxY:document.documentElement.scrollHeight-innerHeight,focus:document.activeElement.outerHTML.slice(0,500),open:[...document.querySelectorAll('details[id][open]')].map(e=>e.id),buttons:[...document.querySelectorAll('button,summary')].filter(e=>e.checkVisibility({visibilityProperty:true})).map(e=>({id:e.id,text:e.textContent.trim(),rect:e.getBoundingClientRect().toJSON()}))})'''
class Browser:
 def __init__(self,A,O):
  self.A=Path(A);self.O=Path(O);self.O.mkdir(exist_ok=True);self.logs=[];self.resources=[];self.errors=[];self.console=[];env=os.environ.copy();env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false');self.server=subprocess.Popen(['/workspace/browser-env/tools/node_modules/.bin/node','continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);self.url=re.search(r'http://127\.0\.0\.1:\d+',self.server.stdout.readline()).group();self.pw=sync_playwright().start();self.browser=self.pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox']);self.version=self.browser.version;self.ctx=None
 def new(self,w,h):
  if self.ctx:self.ctx.close()
  self.ctx=self.browser.new_context(viewport={'width':w,'height':h},permissions=['clipboard-read','clipboard-write']);self.ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(self.url) else r.abort());self.p=self.ctx.new_page();self.p.on('dialog',lambda d:d.accept());self.p.on('pageerror',lambda e:self.errors.append(str(e)));self.p.on('console',lambda m:self.console.append({'type':m.type,'text':m.text}));self.p.on('response',self.response);self.p.goto(self.url)
 def response(self,r):
  try:
   rel=r.url[len(self.url):].split('?')[0].lstrip('/') or 'index.html';f=self.A/'continuity/dist/public'/rel
   if f.is_file():
    b=r.body();self.resources.append({'url':r.url,'status':r.status,'bytes':len(b),'httpSHA256':hashlib.sha256(b).hexdigest(),'diskSHA256':hashlib.sha256(f.read_bytes()).hexdigest(),'relativePath':rel})
  except Exception as e:self.resources.append({'url':r.url,'captureError':str(e)})
 def target(self,c):
  if 'role'in c:return self.p.get_by_role(c['role'],name=c.get('name'),exact=True)
  return self.p.get_by_text(c['text'],exact=True)
 def snap(self):return self.p.evaluate(SNAP)
 def state(self):return self.p.evaluate('Object.fromEntries(Object.keys(localStorage).map(k=>[k,localStorage.getItem(k)]))')
 def project(self):
  entries=json.loads(self.state()['agentflow.idea015.workspace'])['entries'];return entries[0]['project']
 def saved(self):self.p.wait_for_function("document.documentElement.dataset.saving!=='pending'")
 def prepare(self,w,h):
  self.new(w,h)
  for c in json.loads((R/'KNOWN_UI_PATH.json').read_text())['commands']:
   c=dict(c)
   if c.get('name')=='프로젝트 이름' and c['action']=='fill':c['value']=f'도서 대출 예약 서비스 · {w} 알려진 경로 재현'
   pre=self.snap()
   try:
    if c['action']=='key':self.p.keyboard.press(c['key'])
    elif c['action']=='click':self.target(c).click(timeout=5000)
    elif c['action']=='fill':self.target(c).fill(c['value'])
    elif c['action']=='select':self.target(c).select_option(label=c['value'])
    elif c['action']=='wheel':self.p.mouse.move(c.get('x',w-10),c.get('y',h//2));self.p.mouse.wheel(0,c['dy']);self.p.wait_for_timeout(80)
    else:raise ValueError(c)
    self.logs.append({'command':c,'before':pre,'after':self.snap()})
   except Exception:self.logs.append({'command':c,'before':pre,'failed':True});raise
  self.p.get_by_role('button',name='작업문 복사',exact=True).wait_for();self.saved()
 def reach(self,q):
  for _ in range(80):
   g=q.evaluate(GEO)
   if q.evaluate(OUTER_ACCESS) and any(p['hit'] and p['inClip'] for p in g['points']):return q
   r=g['rect'];c={'top':0,'bottom':self.p.viewport_size['height'],'left':0,'right':self.p.viewport_size['width']}
   for a in g['ancestors']:
    if a['self']:continue
    if a['overflowY'] in ['auto','scroll','hidden','clip']:c['top']=max(c['top'],a['clip']['top']);c['bottom']=min(c['bottom'],a['clip']['bottom'])
   dy=r['top']-c['top']-6 if r['top']<c['top'] else r['bottom']-c['bottom']+6;self.p.mouse.move(self.p.viewport_size['width']-10,self.p.viewport_size['height']//2);self.p.mouse.wheel(0,max(-500,min(500,dy)));self.p.wait_for_timeout(60)
  raise AssertionError('native reach failed '+str(g))
 def close(self):
  try:
   if self.ctx:self.ctx.close()
   self.browser.close();self.pw.stop();self.server.terminate();self.server.wait(timeout=10)
  finally:
   for r in self.resources:
    if r.get('relativePath'):r['diskAfterSHA256']=hashlib.sha256((self.A/'continuity/dist/public'/r['relativePath']).read_bytes()).hexdigest()
   (self.O/'runtime.json').write_text(json.dumps({'browserVersion':self.version,'resources':self.resources,'console':self.console,'pageerrors':self.errors,'serverExitAfterTerminate':self.server.returncode},ensure_ascii=False,indent=2));(self.O/'actions.json').write_text(json.dumps(self.logs,ensure_ascii=False,indent=2))

OUTER_ACCESS=r'''e=>{const q=e.getBoundingClientRect();let c={left:0,top:0,right:innerWidth,bottom:innerHeight};for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),b=p.getBoundingClientRect(),kx=b.width/(p.offsetWidth||b.width||1),ky=b.height/(p.offsetHeight||b.height||1);if(/(auto|scroll|hidden|clip)/.test(s.overflowX)){c.left=Math.max(c.left,b.left+p.clientLeft*kx);c.right=Math.min(c.right,b.left+(p.clientLeft+p.clientWidth)*kx)}if(/(auto|scroll|hidden|clip)/.test(s.overflowY)){c.top=Math.max(c.top,b.top+p.clientTop*ky);c.bottom=Math.min(c.bottom,b.top+(p.clientTop+p.clientHeight)*ky)}}return q.width>0&&q.height>0&&q.left>=c.left-.5&&q.right<=c.right+.5&&q.top>=c.top-.5&&q.bottom<=c.bottom+.5}'''
