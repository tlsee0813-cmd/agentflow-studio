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
from playwright.sync_api import Locator
oldclick=Locator.click
noticeCount=0
def click(self,*args,**kwargs):
 global noticeCount
 result=oldclick(self,*args,**kwargs)
 if self._impl_obj._selector=='#task-view-continue':
  noticeCount+=1;page=self.page
  v=page.locator('#notice').evaluate("""e=>{const r=e.getBoundingClientRect(),s=getComputedStyle(e),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {text:e.textContent,hidden:e.hidden,visible:e.checkVisibility({visibilityProperty:true}),rect:r.toJSON(),inViewport:r.width>0&&r.height>0&&r.top>=0&&r.bottom<=innerHeight,centerHit:!!h&&e.contains(h),display:s.display,focus:document.activeElement.id,windowY:scrollY,viewport:[innerWidth,innerHeight]}}""")
  emit({'kind':'notice-after-native-continue-click','sequence':noticeCount,'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actual':v})
  page.screenshot(path=str(out/f'notice-{noticeCount}-{page.viewport_size["width"]}.png'))
 return result
Locator.click=click
sys.path.insert(0,str(root/'continuity/tests'))
import browser as base
oldtd=base.Browser.tearDownClass.__func__
def td(cls):
 try:oldtd(cls)
 finally:emit({'kind':'server-process','class':cls.__name__,'actualReturnCode':cls.proc.poll() if hasattr(cls,'proc') else None})
base.Browser.tearDownClass=classmethod(td)
sys.argv=[str(root/'continuity/tests/pc12_browser.py')]+sys.argv[1:]
runpy.run_path(sys.argv[0],run_name='__main__')
