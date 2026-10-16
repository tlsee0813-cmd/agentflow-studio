from pathlib import Path
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
import threading,functools,json,hashlib,traceback,sys,datetime
from playwright.sync_api import sync_playwright
R=Path(__file__).parent;D=R.parent/'product12-candidate-fix2/app/continuity/static-dist';log=(R/'preview-server.log').open('w');r={'start':datetime.datetime.now(datetime.timezone.utc).isoformat(),'responses':[],'pageerrors':[],'api_calls':[],'fatal':None}
class Handler(SimpleHTTPRequestHandler):
 def log_message(self,fmt,*args):log.write((fmt%args)+'\n');log.flush()
s=ThreadingHTTPServer(('127.0.0.1',0),functools.partial(Handler,directory=str(D)));t=threading.Thread(target=s.serve_forever,daemon=True);t.start();url=f'http://127.0.0.1:{s.server_port}';r['url']=url;code=1
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True);page=b.new_page(viewport={'width':1280,'height':720});page.on('dialog',lambda d:d.accept());page.on('pageerror',lambda e:r['pageerrors'].append(str(e)));page.on('request',lambda q:r['api_calls'].append(q.url) if '/api/' in q.url else None)
  def response(x):
   if x.request.resource_type in ['document','script','stylesheet']:
    body=x.body();n=x.url[len(url):].split('?')[0];n='index.html' if n=='/' else n.lstrip('/');r['responses'].append({'url':x.url,'status':x.status,'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest(),'disk_match':body==(D/n).read_bytes()})
  page.on('response',response);page.goto(url);r['mode']=page.locator('#mode').inner_text();page.locator('#import-file').set_input_files(str(R/'independent/direct.json'));ids=json.loads((R/'independent/direct-ids.json').read_text());page.locator('#node-enter-'+ids['area']).click();page.locator('#task-open-'+ids['A']).click();r['context']=page.locator('#task-view-context').inner_text();page.locator('#task-return-origin').click();r['return_focus']=page.evaluate('document.activeElement.id');r['csp']=(D/'index.html').read_text().split('Content-Security-Policy',1)[1].split('>')[0];r['browser']=b.version;code=int(bool(r['pageerrors'] or r['api_calls'] or not all(x['status']==200 and x['disk_match'] for x in r['responses']) or r['return_focus']!='task-open-'+ids['A']));b.close()
except Exception:r['fatal']=traceback.format_exc()
finally:s.shutdown();s.server_close();log.close();r['exit']=code;(R/'preview-result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({'exit':code,'fatal':r['fatal']}))
sys.exit(code)
