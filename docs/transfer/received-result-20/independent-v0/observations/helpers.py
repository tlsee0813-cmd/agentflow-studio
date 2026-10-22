from pathlib import Path
import os,sys,ast,json,time
R=Path(__file__).parent;A=R.parent/'cycle20-candidate/app';os.environ.update(BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
c=ast.parse((R/'core.py').read_text());constants={n.targets[0].id:ast.literal_eval(n.value) for n in c.body if isinstance(n,ast.Assign) and isinstance(n.targets[0],ast.Name) and n.targets[0].id in ['SNAP','TEXT']};SNAP=constants['SNAP'];TEXT=constants['TEXT'];c=ast.parse((R.parent/'cycle19-fix1-independent/core.py').read_text());MAP=next(ast.literal_eval(n.value) for n in c.body if isinstance(n,ast.Assign) and any(isinstance(z,ast.Name) and z.id=='SNAP' for z in n.targets));c=ast.parse((R.parent/'cycle18-fix4-independent/ui.py').read_text());GEO=next(ast.literal_eval(n.body[0].value.args[0]) for n in ast.walk(c) if isinstance(n,ast.FunctionDef) and n.name=='geom')
class H(base.Browser):
 def runTest(self):pass
class UI:
 def __init__(self,x,w,h,run):self.x=x;self.p=x.page;self.w=w;self.h=h;self.run=run;self.p.set_viewport_size({'width':w,'height':h});self.p.on('dialog',lambda d:d.accept())
 def snap(self):return self.p.evaluate(SNAP)
 def geom(self,sel):return self.p.locator(sel).evaluate(GEO)
 def ck(self,id,ok,raw):self.run['checks'].append({'id':id,'pass':bool(ok),'raw':raw})
 def reach(self,sel):
  q=self.p.locator(sel)
  for _ in range(90):
   b=q.bounding_box()
   if not b:raise AssertionError('not laid out '+sel)
   ancestor=q.evaluate('e=>!!e.closest("#area-panel-body")');pb=self.p.locator('#area-panel-body').bounding_box() if ancestor else None;top=max(8,pb['y']+2) if pb else 8;bottom=min(self.h-12,pb['y']+pb['height']-2) if pb else self.h-12
   if b['y']>=top and b['y']+b['height']<=bottom and any(self.geom(sel)['hits']):return q
   delta=b['y']-top if b['y']<top else b['y']+b['height']-bottom
   self.p.mouse.move(pb['x']+8 if pb else self.w-8,(pb['y']+pb['height']/2) if pb else self.h/2);self.p.mouse.wheel(0,max(-350,min(350,delta)));self.p.wait_for_timeout(40)
  raise AssertionError('native wheel failed '+sel)
 def disclose(self,id,opened=True):
  if self.p.locator('#'+id).evaluate('e=>e.open')!=opened:self.reach('#'+id+' > summary').click()
 def load(self,file):self.p.locator('#import-file').set_input_files(str(file));expect(self.p.locator('#space-map')).to_be_visible();base.saved(self.p)
 def work(self):
  if not self.p.locator('#work-view').is_visible():self.p.locator('#nav-work').click()
  self.disclose('compose-panel');self.disclose('result-file-panel')
 def receive(self,file,wait=True):
  self.work();self.reach('#select-result-file')
  with self.p.expect_file_chooser() as f:self.p.locator('#select-result-file').click()
  f.value.set_files(str(file));self.reach('#accept-result-file').click();expect(self.p.locator('#received-result-open')).to_have_count(1)
  if wait:base.saved(self.p)
  return self.snap()
 def open_receipt(self):self.reach('#received-result-open').click();expect(self.p.locator('#task-pointed')).to_be_visible();return self.snap()
 def stored(self):return self.p.evaluate(base.STATE_JS,['',base.WORKSPACE,base.KEY])
 def backup(self,out):
  base.reveal_management(self.p,'#backup')
  with self.p.expect_download() as d:self.p.locator('#backup').click()
  d.value.save_as(out);return json.loads(Path(out).read_text())
