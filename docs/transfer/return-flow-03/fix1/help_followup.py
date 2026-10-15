"""One desktop help-open geometry followup; no reselection after help toggle."""
from pathlib import Path
import json,functools,threading,hashlib,traceback,sys
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).parent;OUT=ROOT/'output';r={'scope':'Only desktop selected purpose → open help → read existing line/node geometry, no reselection','status':'FAIL','fatal':None,'pageerrors':[]};server=None
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,*args):pass
def lines(page):
 return page.evaluate('''()=>{let n=document.querySelector('.part[data-id="purpose"]').getBoundingClientRect();let targets=[...document.querySelectorAll('.area.is-related')].map(e=>{let r=e.querySelector('.area-head').getBoundingClientRect();return {id:e.dataset.id,x:r.left,y:(r.top+r.bottom)/2}});let paths=[...document.querySelectorAll('#edges path')].filter(p=>!p.getAttribute('stroke-dasharray')).map(p=>{let m=p.getScreenCTM(),a=p.getPointAtLength(0),b=p.getPointAtLength(p.getTotalLength());a=new DOMPoint(a.x,a.y).matrixTransform(m);b=new DOMPoint(b.x,b.y).matrixTransform(m);return {start:{x:a.x,y:a.y},end:{x:b.x,y:b.y}}});return {helpOpen:document.querySelector('.help').open,origin:{x:n.right,y:(n.top+n.bottom)/2},targets,paths}}''')
def click(page,selector):
 d=page.locator(selector).evaluate('''e=>{let r=e.getBoundingClientRect(),x=(r.left+r.right)/2,y=(r.top+r.bottom)/2,h=document.elementFromPoint(x,y);return {x,y,visible:r.width>0&&r.height>0&&r.left>=0&&r.top>=0&&r.right<=innerWidth&&r.bottom<=innerHeight,hit:!!h&&(h===e||e.contains(h))}}''');assert d['visible'] and d['hit'],d;page.mouse.click(d['x'],d['y']);page.wait_for_timeout(350)
try:
 server=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(ROOT/'site')));threading.Thread(target=server.serve_forever,daemon=True).start();r['url']=f'http://127.0.0.1:{server.server_port}/return-flow-study.html'
 with sync_playwright() as p:
  br=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True);page=br.new_page(viewport={'width':1440,'height':900});page.on('pageerror',lambda e:r['pageerrors'].append(str(e)));response=page.goto(r['url']);r['responseHash']=hashlib.sha256(response.body()).hexdigest();assert r['responseHash']=='af748df1dfacb7ed6b4ae3709d5ced26ef43f96bc45a9e6c2c05cdc02e9cc77e'
  click(page,'.part[data-id="purpose"]');r['before']=lines(page);click(page,'.help summary');r['after']=lines(page);assert not r['before']['helpOpen'] and r['after']['helpOpen'];assert len(r['after']['paths'])==4
  r['endpointErrors']=[]
  for path,target in zip(r['after']['paths'],r['after']['targets']):
   d={'startX':path['start']['x']-r['after']['origin']['x'],'startY':path['start']['y']-r['after']['origin']['y'],'endX':path['end']['x']-target['x'],'endY':path['end']['y']-target['y']};r['endpointErrors'].append(d);assert all(abs(v)<=1 for v in d.values()),d
  r['status']='PASS';br.close()
except BaseException as exc:r['fatal']={'message':str(exc),'traceback':traceback.format_exc()}
finally:
 if server:server.shutdown();server.server_close()
r['exit_code']=0 if r['status']=='PASS' and not r['fatal'] and not r['pageerrors'] else 1;(OUT/'help-followup.json').write_text(json.dumps(r,indent=2)+'\n');print(json.dumps(r));sys.exit(r['exit_code'])
