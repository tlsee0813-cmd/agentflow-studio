from pathlib import Path
import json,subprocess,os,re,sys,datetime,hashlib,traceback
from playwright.sync_api import sync_playwright,expect
R=Path(__file__).parent;A=Path(os.environ.get('REPORT36_APP',str(R/'candidate/app')));O=R/'evidence';O.mkdir(exist_ok=True);sys.path.insert(0,str(A/'continuity/tests'));import browser as base
F=json.loads((R/'sample/FACTS.json').read_text());sha=lambda b:hashlib.sha256(b).hexdigest();result={'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'c0a7c91c54d62166140081b149d94bc6efa9f1f9','viewport':[1280,720],'actions':[],'HTTP':[],'pageerrors':[]}
GEO=r'''e=>{const r=e.getBoundingClientRect();let c={left:0,top:0,right:innerWidth,bottom:innerHeight},anc=[];for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),q=a.getBoundingClientRect(),sx=a.offsetWidth?q.width/a.offsetWidth:1,sy=a.offsetHeight?q.height/a.offsetHeight:1,v={left:q.left+a.clientLeft*sx,top:q.top+a.clientTop*sy,right:q.left+(a.clientLeft+a.clientWidth)*sx,bottom:q.top+(a.clientTop+a.clientHeight)*sy};if(/auto|scroll|hidden|clip/.test(s.overflowX)){c.left=Math.max(c.left,v.left);c.right=Math.min(c.right,v.right)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){c.top=Math.max(c.top,v.top);c.bottom=Math.min(c.bottom,v.bottom)}anc.push({id:a.id,rect:q.toJSON(),client:v,overflow:[s.overflowX,s.overflowY],scroll:[a.scrollLeft,a.scrollTop]})}const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);let range=document.createRange();range.selectNodeContents(e);return{text:e.textContent,rect:r.toJSON(),clip:c,full:r.width>0&&r.height>0&&r.left>=c.left-.5&&r.right<=c.right+.5&&r.top>=c.top-.5&&r.bottom<=c.bottom+.5,centerHit:!!h&&e.contains(h),range:[...range.getClientRects()].map(r=>r.toJSON()),ancestors:anc,focus:document.activeElement.id,xy:[scrollX,scrollY]}}'''
env=os.environ.copy();env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false');server=None
try:
 server=subprocess.Popen(['/workspace/browser-env/tools/node_modules/.bin/node','continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);line=server.stdout.readline();url=re.search(r'http://127\.0\.0\.1:\d+',line).group()
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium');result['browser']=b.version;ctx=b.new_context(viewport={'width':1280,'height':720});p=ctx.new_page();p.on('pageerror',lambda e:result['pageerrors'].append(str(e)))
  def response(r):
   f=A/'continuity/dist/public'/((r.url.split(url,1)[-1].split('?')[0].lstrip('/')) or 'index.html')
   if f.is_file():body=r.body();result['HTTP'].append({'path':str(f.relative_to(A)),'status':r.status,'bytes':len(body),'bodySHA':sha(body),'diskBeforeSHA':sha(f.read_bytes())})
  p.on('response',response);p.goto(url);expect(p.locator('#mode')).to_contain_text('MOCK')
  def click(s):
   q=p.locator(s);result['actions'].append({'click':s,'before':q.evaluate(GEO)});q.click();result['actions'][-1]['afterPageFocus']=p.evaluate('()=>({xy:[scrollX,scrollY],focus:document.activeElement.id})')
  def state(name):
   v=p.evaluate('localStorage.getItem("agentflow.idea015.workspace")');(O/(name+'.json')).write_text(v);return json.loads(v)['entries'][0]['project']
  def shot(name):p.screenshot(path=str(O/(name+'.png')))
  def cards():return {k:{'card':p.locator('.area-node[data-area-id="'+v+'"]').evaluate(GEO) if p.locator('.area-node[data-area-id="'+v+'"]').count() else None,'recordButtonCount':p.locator('#branch-records-'+v).count()} for k,v in F['ids'].items()}
  click('#nav-projects')
  with p.expect_file_chooser() as fc:click('#list-import')
  p.once('dialog',lambda d:d.accept());fc.value.set_files(str(R/'sample/project.json'));expect(p.locator('#notice')).to_contain_text('사본으로 불러왔어요');base.saved(p)
  before=state('before-receive')
  for k in ['L','O']:
   click('#nav-work')
   for d in ['compose-panel','result-file-panel']:
    if not p.locator('#'+d).evaluate('e=>e.open'):click('#'+d+' > summary')
   with p.expect_file_chooser() as fc:click('#select-result-file')
   fc.value.set_files(str(R/f'sample/return-{k}.json'));expect(p.locator('#accept-result-file')).to_be_visible();click('#accept-result-file');base.saved(p)
  after=state('after-receive');result['reportTasks']={k:next(t['id'] for t in after['tasks'] if t.get('resultFile',{} ) and t['resultFile']['returnId']=='H_SYN36_REPORT_ONLY_'+k) for k in ['L','O']}
  click('#nav-space');click('#map-fit');result['cardsExpanded']=cards();result['cameraBefore']=p.locator('#space-plane').evaluate('e=>getComputedStyle(e).transform')
  click('#node-info-'+F['ids']['L']);summary='#subtree-records-'+F['ids']['L']+' > summary'
  if not p.locator(summary).evaluate('e=>e.parentElement.open'):click(summary)
  row='#subtree-task-'+result['reportTasks']['L'];q=p.locator(row);q.press('Tab');result['leafPanel']={'text':p.locator('#area-panel-body').inner_text(),'rows':p.locator('.subtree-record').evaluate_all('(es)=>es.map(e=>({owner:e.dataset.ownerArea,text:e.textContent,buttons:[...e.querySelectorAll("button")].map(b=>b.id)}))'),'exactReport':q.evaluate(GEO)};shot('01-leaf-report-present-no-card-entry')
  click(row);result['exactReportReader']={'pointedId':p.locator('#task-pointed').get_attribute('data-report-task-id'),'text':p.locator('#task-pointed').inner_text()};assert '[명시 합성36 L 보고원문 고유표지]' in result['exactReportReader']['text'];click('#task-return-origin');click('#area-panel-close')
  click('#branch-toggle-'+F['ids']['P']);result['cardsCollapsed']=cards();click('#node-info-'+F['ids']['P']);summary='#subtree-records-'+F['ids']['P']+' > summary'
  if not p.locator(summary).evaluate('e=>e.parentElement.open'):click(summary)
  result['parentPanel']={'text':p.locator('#area-panel-body').inner_text(),'rows':p.locator('.subtree-record').evaluate_all('(es)=>es.map(e=>({owner:e.dataset.ownerArea,text:e.textContent,buttons:[...e.querySelectorAll("button")].map(b=>b.id)}))'),'exactReport':p.locator(row).evaluate(GEO)};shot('02-collapsed-parent-report-present-no-card-entry')
  click('#area-panel-close');result['cameraAfter']=p.locator('#space-plane').evaluate('e=>getComputedStyle(e).transform');last=state('after-read');assert after==last;assert before['currentTaskId']==after['currentTaskId']==F['current'];assert after['tasks'][:len(before['tasks'])]==before['tasks'];assert len(after['tasks'])==len(before['tasks'])+2;assert result['cameraBefore']==result['cameraAfter'];assert {x['owner'] for x in result['leafPanel']['rows']}=={F['ids']['L']};assert {x['owner'] for x in result['parentPanel']['rows']}=={F['ids']['L']};assert result['exactReportReader']['pointedId']==result['reportTasks']['L'];assert not result['pageerrors']
  result['collectionExit']=0;ctx.close();b.close()
except Exception:
 result['collectionExit']=1;result['traceback']=traceback.format_exc();traceback.print_exc()
finally:
 if server:
  server.terminate();out,err=server.communicate();(O/'server.stderr.log').write_text(err);result['serverExit']=server.returncode
 for h in result['HTTP']:h['diskAfterSHA']=sha((A/h['path']).read_bytes())
 (O/'raw.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(result['collectionExit'])
