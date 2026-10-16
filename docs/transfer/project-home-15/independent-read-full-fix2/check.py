from pathlib import Path
import os,sys,json,subprocess,re,hashlib,datetime,traceback
from importlib.metadata import version
from playwright.sync_api import sync_playwright,expect
R=Path(__file__).parent;A=R.parent/'home15-read-fix2-candidate/app';O=R/'raw';O.mkdir(exist_ok=True)
sha=lambda b:hashlib.sha256(b).hexdigest()
now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat()
r={'start':now(),'scenes':[],'failures':[],'pageerrors':[],'console':[],'http':[],'fixture':'author home15-read.json in isolated context; external mutation test writes only isolated storage in second tab'};server=None;fatal=None
G='''()=>{const b=document.querySelector('#project-read-body'),d=document.querySelector('#project-read');return {y:scrollY,docMax:document.documentElement.scrollHeight-innerHeight,bodyTop:b.scrollTop,bodyMax:b.scrollHeight-b.clientHeight,bodyWidth:b.clientWidth,scrollWidth:b.scrollWidth,open:d.open,active:document.activeElement.id,route:document.documentElement.dataset.route,docWidth:document.documentElement.scrollWidth}}'''
T='''([id,text])=>{const e=document.getElementById(id),w=document.createTreeWalker(e,NodeFilter.SHOW_TEXT);let n;while(n=w.nextNode()){let i=n.textContent.indexOf(text);if(i<0)continue;let r=document.createRange();r.setStart(n,i);r.setEnd(n,i+text.length);let rr=[...r.getClientRects()].map(x=>({x:x.x,y:x.y,w:x.width,h:x.height}));let clip={l:0,t:0,r:innerWidth,b:innerHeight},anc=[];for(let p=e;p;p=p.parentElement){let s=getComputedStyle(p),b=p.getBoundingClientRect(),sx=p.offsetWidth?b.width/p.offsetWidth:1,sy=p.offsetHeight?b.height/p.offsetHeight:1;if(/hidden|clip|scroll|auto/.test(s.overflowX)){clip.l=Math.max(clip.l,b.left+p.clientLeft*sx);clip.r=Math.min(clip.r,b.left+(p.clientLeft+p.clientWidth)*sx)}if(/hidden|clip|scroll|auto/.test(s.overflowY)){clip.t=Math.max(clip.t,b.top+p.clientTop*sy);clip.b=Math.min(clip.b,b.top+(p.clientTop+p.clientHeight)*sy)}anc.push({tag:p.tagName,id:p.id,overflowX:s.overflowX,overflowY:s.overflowY})}return {text,rects:rr,clip,full:rr.every(x=>x.x>=clip.l&&x.y>=clip.t&&x.x+x.w<=clip.r+.1&&x.y+x.h<=clip.b+.1),hits:rr.map(x=>{let h=document.elementFromPoint(x.x+x.w/2,x.y+x.h/2);return !!h&&(h===e||e.contains(h))}),ancestors:anc}}return {text,missing:true}}'''
def ck(label,ok,raw):
 r['scenes'].append({'id':label,'pass':bool(ok),'raw':raw})
 if not ok:r['failures'].append(label)
try:
 env={k:os.environ[k] for k in ['PATH','HOME','TMPDIR'] if k in os.environ};env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false');server=subprocess.Popen(['node','continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);url=re.search(r'http://127\.0\.0\.1:\d+',server.stdout.readline()).group();r['actualURL']=url
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium');r['environment']={'node':subprocess.check_output(['node','--version'],text=True).strip(),'playwright':version('playwright'),'browser':browser.version}
  for width,height in [(1280,720),(1440,900)]:
   ctx=browser.new_context(viewport={'width':width,'height':height});pg=ctx.new_page();pg.set_default_timeout(5000);pg.on('pageerror',lambda e:r['pageerrors'].append(str(e)));pg.on('console',lambda m:r['console'].append({'type':m.type,'text':m.text}))
   resp=pg.goto(url);r['http'].append({'viewport':[width,height],'status':resp.status,'url':resp.url,'bytes':len(resp.body()),'sha256':sha(resp.body())})
   fixture=(R/'commands/browser-outputs/home15-read.json').read_text();pg.evaluate('(x)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",x)}',fixture);pg.reload();expect(pg.locator('#projects-view')).to_be_visible()
   def stored():return pg.evaluate('localStorage.getItem("agentflow.idea015.workspace")')
   def geom():return pg.evaluate(G)
   def card(s):return pg.locator('#project-list .project-card').filter(has=pg.locator('.project-card-name',has_text=s))
   def approach(c):
    pg.mouse.move(width-50,height-180)
    for _ in range(15):
     b=c.locator('.project-more-button').bounding_box()
     if 90<b['y']<height-100:return
     pg.mouse.wheel(0,150 if b['y']>=height-100 else -150);pg.wait_for_timeout(60)
   def opened(s):
    c=card(s);approach(c);y=pg.evaluate('scrollY');c.locator('.project-more-button').click();c.locator('.project-read-open').click();expect(pg.locator('#project-read')).to_be_visible();return c,y
   def closed(c,y,key='Escape'):
    if key=='click':pg.locator('#project-read-close').click()
    else:pg.keyboard.press(key)
    pg.wait_for_timeout(120);g=geom();ck(f'{width}-close-{key}',not g['open'] and g['y']==y and c.locator('.project-more-button').evaluate('(e)=>e===document.activeElement'),g)
   c,y=opened('강남 지점');start=geom();name=pg.evaluate(T,['project-read-name','· 강남 지점']);ck(f'{width}-A-name',name.get('full') and all(name.get('hits',[])),{'start':start,'text':name});pg.keyboard.press('End');pg.wait_for_timeout(250);tail=pg.evaluate(T,['project-read-purpose','강남 지점은 현장 결제만 받는다.']);ck(f'{width}-A-tail',tail.get('full') and all(tail.get('hits',[])),{'geom':geom(),'text':tail});pg.screenshot(path=str(O/f'{width}-read-tail.png'))
   bb=pg.locator('#project-read-body').bounding_box();pg.mouse.move(bb['x']+bb['width']/2,bb['y']+bb['height']/2)
   for _ in range(8):pg.mouse.wheel(0,600);pg.wait_for_timeout(40)
   ck(f'{width}-wheel-end-background',geom()['y']==y,{'beforeY':y,'after':geom()});closed(c,y,'click')
   c2,y2=opened('마포 지점');g=geom();ck(f'{width}-next-card-reset',g['bodyTop']==0 and '강남' not in pg.locator('#project-read').inner_text(),{'geom':g,'text':pg.locator('#project-read').inner_text()});name=pg.evaluate(T,['project-read-name','· 마포 지점']);ck(f'{width}-B-name',name.get('full') and all(name.get('hits',[])),name);closed(c2,y2)
   # Added counterexample: actual Tab changes focus to close before navigation keys.
   for key in ['PageDown','End','Space']:
    ca,yy=opened('강남 지점');pg.keyboard.press('Tab');before=geom();assert before['active']=='project-read-close';pg.keyboard.press(key);pg.wait_for_timeout(250);after=geom();ck(f'{width}-close-focus-{key}',after['y']==yy,{'before':before,'after':after,'key':key});
    if after['open']:closed(ca,yy)
    else:ck(f'{width}-Space-focus-return',ca.locator('.project-more-button').evaluate('(e)=>e===document.activeElement'),geom())
   ca,yy=opened('강남 지점');pg.locator('#project-read-name').click(click_count=3);selected=pg.evaluate('getSelection().toString()');trail=[]
   for key in ['PageDown','End','Home','ArrowDown']:
    before=geom();pg.keyboard.press(key);pg.wait_for_timeout(180);after=geom();trail.append({'key':key,'before':before,'after':after});ck(f'{width}-selected-text-{key}',after['y']==yy,trail[-1])
   closed(ca,yy);ck(f'{width}-selection-made',bool(selected),{'selection':selected})
   ca,yy=opened('표시 시험');g=geom();literal=pg.locator('#project-read-name').inner_text();ck(f'{width}-safe-text',pg.locator('#project-read img,#project-read b,#project-read script').count()==0 and '<script>x</script>' in literal and g['scrollWidth']<=g['bodyWidth'] and g['docWidth']<=width,{'name':literal,'geom':g});closed(ca,yy,'click');ck(f'{width}-reads-no-write',stored()==fixture,{'beforeSHA':sha(fixture.encode()),'afterSHA':sha(stored().encode())})
   # External changes are explicit fixture mutations from a real second tab, not user data.
   for mode in ['change','trash','remove']:
    pg.evaluate('(x)=>localStorage.setItem("agentflow.idea015.workspace",x)',fixture);pg.reload();ca,yy=opened('강남 지점');other=ctx.new_page();other.goto(url);raw=json.loads(fixture);entry=next(e for e in raw['entries'] if '강남 지점' in e['project']['name'])
    if mode=='change':entry['project']['space']['brief']['text']='외부 변경만 보존하는 독립 시험'
    elif mode=='trash':entry.update(state='trashed',lifecycle=entry['lifecycle']+1,trashedAt=now())
    else:raw['entries'].remove(entry)
    value=json.dumps(raw,ensure_ascii=False);other.evaluate('(x)=>localStorage.setItem("agentflow.idea015.workspace",x)',value);other.close();pg.locator('#project-read-close').click();ck(f'{width}-external-{mode}-no-write',stored()==value,{'afterExternalSHA':sha(value.encode()),'afterCloseSHA':sha(stored().encode()),'geom':geom()})
   ctx.close()
  browser.close()
except Exception:fatal=traceback.format_exc();r['fatal']=fatal
finally:
 if server:server.terminate();server.wait(timeout=10);(O/'server.stderr.log').write_text(server.stderr.read());r['server_exit']=server.returncode
 r['end']=now();r['exit']=int(bool(fatal or r['failures'] or r['pageerrors']));(O/'result.json').write_text(json.dumps(r,ensure_ascii=False,indent=2));print(json.dumps({'exit':r['exit'],'scenes':len(r['scenes']),'failures':r['failures'],'fatal':fatal},ensure_ascii=False));sys.exit(r['exit'])
