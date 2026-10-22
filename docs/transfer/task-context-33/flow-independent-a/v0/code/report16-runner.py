"""Read-only HTTP/console/server-exit collection; exact test loaded unchanged."""
from pathlib import Path
import sys,os,json,hashlib,runpy,datetime,urllib.parse
from playwright.sync_api import Page
root=Path.cwd();out=Path(os.environ['IDEA015_EVIDENCE_DIR']);out.mkdir(parents=True,exist_ok=True)
def emit(v):
 with (out/'http-console.jsonl').open('a') as f:f.write(json.dumps(v,ensure_ascii=False)+'\n')
oldgoto=Page.goto
def goto(self,*a,**kw):
 if not getattr(self,'_binding_hook',False):
  self._binding_hook=True
  def response(resp):
   url=resp.url;path=urllib.parse.urlparse(url).path
   if path not in ['/','/index.html','/styles.css','/client/app.js']:return
   try:
    body=resp.body();disk=root/'continuity/dist/public'/('index.html' if path=='/' else path.lstrip('/'))
    data=disk.read_bytes();emit({'kind':'HTTP','utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'url':url,'status':resp.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'disk':str(disk.relative_to(root)),'diskSHA256':hashlib.sha256(data).hexdigest(),'bodyEqualsDisk':body==data})
   except Exception as e:emit({'kind':'capture-error','url':url,'error':repr(e)})
  self.on('response',response);self.on('console',lambda m:emit({'kind':'console','type':m.type,'text':m.text}));self.on('pageerror',lambda e:emit({'kind':'pageerror','error':str(e)}))
 return oldgoto(self,*a,**kw)
Page.goto=goto
import unittest
oldassert=unittest.TestCase.assertTrue
def guarded(self,expr,msg=None):
 if msg=='F10: action fully inside the first screen':
  data=self.page.evaluate("""()=>{const sels=['#task-next-action','#task-next-target','#task-continue-context','.task-view-head','#task-view-idea','#task-pointed','#task-view','#notice','#feedback'];const geo=e=>{if(!e)return null;const r=e.getBoundingClientRect();let c={l:0,t:0,r:innerWidth,b:innerHeight};const ancestors=[];for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),sx=a.offsetWidth?b.width/a.offsetWidth:1,sy=a.offsetHeight?b.height/a.offsetHeight:1,v={l:b.left+a.clientLeft*sx,t:b.top+a.clientTop*sy,r:b.left+(a.clientLeft+a.clientWidth)*sx,b:b.top+(a.clientTop+a.clientHeight)*sy};if(/auto|scroll|hidden|clip/.test(s.overflowX)){c.l=Math.max(c.l,v.l);c.r=Math.min(c.r,v.r)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){c.t=Math.max(c.t,v.t);c.b=Math.min(c.b,v.b)}ancestors.push({id:a.id,rect:b.toJSON(),client:v,overflow:[s.overflowX,s.overflowY],scroll:[a.scrollLeft,a.scrollTop]})}const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {rect:r.toJSON(),clip:c,hit:!!hit&&e.contains(hit),visible:e.checkVisibility(),text:e.textContent,ancestors}};return {xy:[scrollX,scrollY],viewport:[innerWidth,innerHeight],height:document.documentElement.scrollHeight,focus:document.activeElement.id,targets:Object.fromEntries(sels.map(s=>[s,geo(document.querySelector(s))]))}}""")
  emit({'kind':'before-original-F10-action-assertion','assertionValue':bool(expr),'actual':data});self.page.screenshot(path=str(out/'F10-action-original-assertion.png'))
 return oldassert(self,expr,msg)
unittest.TestCase.assertTrue=guarded
sys.path.insert(0,str(root/'continuity/tests'))
import browser as base
oldtd=base.Browser.tearDownClass.__func__
def td(cls):
 try:oldtd(cls)
 finally:emit({'kind':'server-process','class':cls.__name__,'actualReturnCode':cls.proc.poll() if hasattr(cls,'proc') else None})
base.Browser.tearDownClass=classmethod(td)
sys.argv=[str(root/'continuity/tests/report16_browser.py')]+sys.argv[1:]
runpy.run_path(sys.argv[0],run_name='__main__')
