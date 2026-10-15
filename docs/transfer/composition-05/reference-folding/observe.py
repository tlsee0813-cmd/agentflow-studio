from playwright.sync_api import sync_playwright
import json,hashlib
from pathlib import Path
from datetime import datetime,timezone
r={'url':'https://www.yfiles.com/demos/application-features/folding/','timeUTC':datetime.now(timezone.utc).isoformat(),'viewport':[1280,720],'errors':[],'responses':[]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True);r['chromium']=b.version;page=b.new_page(viewport={'width':1280,'height':720});page.on('requestfailed',lambda q:r['errors'].append({'url':q.url,'failure':q.failure}));page.on('response',lambda q:r['responses'].append({'url':q.url,'status':q.status}) if q.request.is_navigation_request() else None)
 try:
  res=page.goto(r['url'],timeout=30000,wait_until='domcontentloaded');r['httpStatus']=res.status;r['firstHTMLSHA256']=hashlib.sha256(res.body()).hexdigest();r['title']=page.title();r['bodyText']=page.locator('body').inner_text(timeout=5000)[:6000]
 except Exception as e:r['navigationError']=str(e);r['finalURL']=page.url
 b.close()
Path('/workspace/browser-env/reference-folding/access.json').write_text(json.dumps(r,ensure_ascii=False,indent=2)+'\n');print(json.dumps(r,ensure_ascii=False,indent=2))
