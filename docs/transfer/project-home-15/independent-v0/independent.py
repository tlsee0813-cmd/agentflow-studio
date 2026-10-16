from pathlib import Path
import os,sys,json,subprocess,hashlib,datetime,traceback,re
from importlib.metadata import version
from playwright.sync_api import sync_playwright,expect
R=Path(__file__).parent; A=R.parent/'home15-candidate/app'; O=R/'independent';O.mkdir(exist_ok=True)
def sha(b):return hashlib.sha256(b).hexdigest()
def now():return datetime.datetime.now(datetime.timezone.utc).isoformat()
r={'start':now(),'fixture_installation':'isolated localStorage workspace installation, not a user UI action','scenes':[],'pageerrors':[],'console':[],'http':[]};fatal=None;p=None
SNAP='''()=>{const rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};return {y:scrollY,max:Math.max(0,document.documentElement.scrollHeight-innerHeight),active:document.activeElement.outerHTML,selection:[...document.querySelectorAll('[aria-selected=true],.selected')].map(e=>({id:e.id,text:e.textContent})),matrix:document.querySelector('#space-plane')?getComputedStyle(document.querySelector('#space-plane')).transform:null,cards:[...document.querySelectorAll('#space-plane .area-node')].map(e=>({id:e.id,rect:rect(e)})),projects:[...document.querySelectorAll('#project-list .project-card')].map(e=>({id:e.dataset.entryId,rect:rect(e),name:e.querySelector('.project-open').textContent,purpose:e.querySelector('.project-card-purpose').textContent}))}}'''
try:
 env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false')
 p=subprocess.Popen(['node','continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);url=re.search(r'http://127\.0\.0\.1:\d+',p.stdout.readline()).group(0);r['url']=url
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path='/usr/bin/chromium');r['environment']={'browser':b.version,'playwright':version('playwright'),'node':subprocess.check_output(['node','--version'],text=True).strip()}
  for width,height in [(1280,720),(1440,900)]:
   ctx=b.new_context(viewport={'width':width,'height':height});pg=ctx.new_page();pg.on('pageerror',lambda e:r['pageerrors'].append(str(e)));pg.on('console',lambda m:r['console'].append({'type':m.type,'text':m.text}));pg.set_default_timeout(5000)
   resp=pg.goto(url);body=resp.body();r['http'].append({'viewport':[width,height],'status':resp.status,'url':resp.url,'bytes':len(body),'sha256':sha(body)})
   def install(name,raw=None):
    raw=raw or (R/'commands/browser-outputs'/f'home15-{name}.json').read_text();pg.evaluate('(raw)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",raw)}',raw);pg.reload();expect(pg.locator('#projects-view')).to_be_visible();return raw
   def saved():return pg.evaluate('localStorage.getItem("agentflow.idea015.workspace")')
   def snap():return pg.evaluate(SNAP)
   def back():pg.locator('#nav-projects').click();expect(pg.locator('#projects-view')).to_be_visible()
   for name,count in [('zero',0),('one',1),('six',6)]:
    raw=install(name);s=snap();assert len(s['projects'])==count;r['scenes'].append({'id':f'{width}-{name}','raw':s,'envelope_unchanged':saved()==raw});assert saved()==raw
    if name=='six':pg.screenshot(path=str(O/f'{width}-six.png'))
   raw=install('ab');names=pg.locator('#project-list .project-open').all_text_contents();rounds=[]
   for idx in [0,1,0]:
    btn=pg.locator('#project-list .project-open').nth(idx);btn.focus();pg.keyboard.press('Space');expect(pg.locator('#space-view')).to_be_visible();rounds.append({'name':names[idx],'space':pg.locator('#space-brief').inner_text(),'snapshot':snap(),'unchanged':saved()==raw});assert saved()==raw;back();assert pg.locator('#project-list .project-open').nth(idx).evaluate('(e)=>e===document.activeElement')
   more=pg.locator('.project-more-button').first;more.focus();pg.keyboard.press('Space');expect(pg.locator('.project-more-menu').first).to_be_visible();pg.keyboard.press('Escape');expect(pg.locator('.project-more-menu').first).to_be_hidden();assert more.evaluate('(e)=>e===document.activeElement')
   pg.locator('.project-open').first.click();pg.locator('#map-zoom-in').click();pg.wait_for_timeout(100);node=pg.locator('[id^="node-info-"]').first
   if node.count():node.click()
   pre=snap();back();pg.locator('.project-open').nth(1).click();back();pg.locator('.project-open').first.click();post=snap();assert pre['matrix']==post['matrix'];assert pre['cards']==post['cards'];assert saved()==raw
   r['scenes'].append({'id':f'{width}-AB-Space-menu-map','rounds':rounds,'pre':pre,'post':post,'envelope_unchanged':True,'keyboard':'name Space; summary Space then Escape','selection_comparison':pre['selection']==post['selection']})
   # 20 synthetic copies retain validated project schema; distinct entry IDs/names/purposes.
   env20=json.loads(raw);template=env20['entries'][0];entries=[]
   import copy
   for i in range(20):
    e=copy.deepcopy(template);e['entryId']=f'E_home15-independent-{i}';e['project']['name']='공통 긴 이름 접두사 '*3+f'끝 구분 {i:02}';e['project']['space']['brief']['text']='공통 긴 목적 접두사 '*8+f'목적 끝 구분 {i:02}';entries.append(e)
   env20['entries']=entries;raw20=json.dumps(env20,ensure_ascii=False);install('twenty',raw20)
   pg.mouse.move(width-100,height-150)
   for _ in range(20):
    pg.mouse.wheel(0,500);pg.wait_for_timeout(40)
    if pg.locator('.project-open').last.bounding_box()['y']<height-140:break
   lower=pg.locator('.project-open').last;before=snap();lower.click();expect(pg.locator('#space-view')).to_be_visible();back();after=snap();assert abs(before['y']-after['y'])<=1;assert lower.evaluate('(e)=>e===document.activeElement');assert saved()==raw20
   text=lower.evaluate('''e=>{const r=document.createRange();r.selectNodeContents(e);return {full:e.textContent,box:e.getBoundingClientRect().toJSON(),ranges:[...r.getClientRects()].map(x=>x.toJSON()),overflow:getComputedStyle(e).overflow,lineClamp:getComputedStyle(e).webkitLineClamp,title:e.title,accessibleLabel:e.getAttribute('aria-label')}}''')
   r['scenes'].append({'id':f'{width}-20-bottom-return','before':before,'after':after,'text':text,'method':'native wheel then normal click','long_prefix_limit':'full DOM names differ; two-line visual clamp may hide distinguishing suffix; not human distinguishability PASS','envelope_unchanged':True});pg.screenshot(path=str(O/f'{width}-bottom-return.png'));ctx.close()
  b.close()
except Exception:
 fatal=traceback.format_exc();r['fatal']=fatal
finally:
 if p:
  p.terminate();p.wait(timeout=10);r['server_exit']=p.returncode;(O/'server.stderr.log').write_text(p.stderr.read())
 r['end']=now();r['exit']=1 if fatal or r['pageerrors'] else 0;(O/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({'exit':r['exit'],'scenes':len(r['scenes']),'fatal':fatal},ensure_ascii=False));sys.exit(r['exit'])
