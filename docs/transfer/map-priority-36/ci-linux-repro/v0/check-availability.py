from pathlib import Path
import json,datetime,subprocess
from playwright.sync_api import sync_playwright
R=Path(__file__).parent
paths=[Path('/home/agent/.cache/ms-playwright'),Path('/root/.cache/ms-playwright'),Path('/ms-playwright'),Path('/opt/ms-playwright'),Path('/workspace/browser-env/cycle21-version-match/bundled-cache')]
rows=[]
for d in paths:
 try:rows.append({'path':str(d),'exists':d.exists(),'entries':[x.name for x in d.iterdir()] if d.is_dir() else []})
 except PermissionError:rows.append({'path':str(d),'status':'permission denied; no escalation or further inspection'})
with sync_playwright() as p:expected=p.chromium.executable_path
out={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'PW':'1.57.0','bundledExpectedPath':expected,'bundledExpectedExists':Path(expected).is_file(),'cacheDirectories':rows,'systemChromiumVersion':subprocess.check_output(['/usr/bin/chromium','--version'],stderr=subprocess.STDOUT,text=True).strip(),'Node':subprocess.check_output(['/workspace/browser-env/tools/node_modules/.bin/node','--version'],text=True).strip(),'143Executed':False,'154ReexecutedTests':False,'downloadRetried':False,'reason':'Previous exact official Playwright1.57 build1200 download denied HTTP403 Domain forbidden; retained original logs, no bypass/retry','fontInfo':subprocess.run(['fc-match','sans-serif'],capture_output=True,text=True).stdout.strip()}
(R/'availability.json').write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False,indent=2))
