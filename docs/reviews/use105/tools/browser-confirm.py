import argparse,json,pathlib,sys,time
from http.server import HTTPServer,BaseHTTPRequestHandler
from playwright.sync_api import sync_playwright
p=argparse.ArgumentParser();p.add_argument('role');p.add_argument('port',type=int);a=p.parse_args()
root=pathlib.Path('/workspace/work/use105'); out=root/'evidence'/a.role;out.mkdir(parents=True,exist_ok=True)
pw=sync_playwright().start()
def launch():
 return pw.chromium.launch_persistent_context(str(root/'profiles'/a.role),executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'],viewport={'width':1280,'height':900},accept_downloads=True)
context=launch();page=context.pages[0];seq=0;dialogs=[];current_data={}
def on_dialog(dialog):
 dialogs.append({'type':dialog.type,'message':dialog.message,'response':'accept' if current_data.get('accept_dialog') else 'dismiss'})
 if current_data.get('accept_dialog'):dialog.accept()
 else:dialog.dismiss()
page.on('dialog',on_dialog)
page.goto('http://127.0.0.1:8765/agentflow-studio/')
class Handler(BaseHTTPRequestHandler):
 def log_message(self,*x):pass
 def do_POST(self):
  global page,context,seq,dialogs,current_data
  data=json.loads(self.rfile.read(int(self.headers['Content-Length'])));seq+=1;error=None;dialogs=[];current_data=data
  try:
   op=data['op']
   loc=None
   if 'role' in data:loc=page.get_by_role(data['role'],name=data.get('name'),exact=data.get('exact',True))
   elif 'label' in data:loc=page.get_by_label(data['label'],exact=data.get('exact',True))
   elif 'placeholder' in data:loc=page.get_by_placeholder(data['placeholder'],exact=data.get('exact',True))
   elif 'text' in data:loc=page.get_by_text(data['text'],exact=data.get('exact',True))
   if loc is not None and 'nth' in data:loc=loc.nth(data['nth'])
   if op=='click':loc.click(timeout=4000)
   elif op=='fill':loc.fill(data['value'],timeout=4000)
   elif op=='press':
    if loc is not None:loc.press(data['key'])
    else:page.keyboard.press(data['key'])
   elif op=='select':loc.select_option(label=data['value'])
   elif op=='scroll':page.mouse.wheel(data.get('x',0),data.get('y',600))
   elif op=='reload':page.reload()
   elif op=='restart':
    context.close();context=launch();page=context.pages[0];page.goto('http://127.0.0.1:8765/agentflow-studio/')
   elif op=='resize':page.set_viewport_size({'width':data['width'],'height':data.get('height',900)})
   elif op!='snapshot':raise ValueError('Unsupported op')
   page.wait_for_timeout(180)
  except Exception as e:error=str(e)
  snap=page.locator('body').aria_snapshot();path=out/f'{seq:02d}.jpg';page.screenshot(path=str(path),type='jpeg',quality=65,full_page=False)
  record={'seq':seq,'action':data,'error':error,'url':page.url,'viewport':page.viewport_size,'screenshot':str(path),'snapshot':snap,'dialogs':dialogs}
  (out/f'{seq:02d}.json').write_text(json.dumps(record,ensure_ascii=False,indent=2))
  with (out/'actions.jsonl').open('a') as f:f.write(json.dumps(record,ensure_ascii=False)+'\n')
  b=json.dumps(record,ensure_ascii=False).encode();self.send_response(200);self.send_header('Content-Type','application/json');self.end_headers();self.wfile.write(b)
HTTPServer(('127.0.0.1',a.port),Handler).serve_forever()
