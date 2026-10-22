from pathlib import Path
import json,os,sys,subprocess,re,datetime,hashlib,traceback
from importlib.metadata import version
from playwright.sync_api import sync_playwright
R=Path(__file__).parent;A=Path('/workspace/browser-env/task33-reader-layout/candidate/app');utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();sha=lambda b:hashlib.sha256(b).hexdigest();seq=0;events=[];errors=[];responses=[];posts=[];ctx=None
VISIBLE=r'''()=>{const clipOf=e=>{let c={l:0,t:0,r:innerWidth,b:innerHeight};for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),r=a.getBoundingClientRect(),sx=a.offsetWidth?r.width/a.offsetWidth:1,sy=a.offsetHeight?r.height/a.offsetHeight:1,x={l:r.left+a.clientLeft*sx,t:r.top+a.clientTop*sy,r:r.left+(a.clientLeft+a.clientWidth)*sx,b:r.top+(a.clientTop+a.clientHeight)*sy};if(/auto|scroll|hidden|clip/.test(s.overflowX)){c.l=Math.max(c.l,x.l);c.r=Math.min(c.r,x.r)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){c.t=Math.max(c.t,x.t);c.b=Math.min(c.b,x.b)}}return c};const text=[];let n;const w=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);while(n=w.nextNode()){if(!n.textContent.trim()||n.parentElement.closest('script,style')||!n.parentElement.checkVisibility({visibilityProperty:true,contentVisibilityAuto:true})||[...function*(e){for(let a=e;a;a=a.parentElement)yield a}(n.parentElement)].some(a=>a.tagName==='DETAILS'&&!a.open&&!a.querySelector(':scope > summary')?.contains(n)))continue;const r=document.createRange();r.selectNodeContents(n);const c=clipOf(n.parentElement),rects=[...r.getClientRects()].filter(b=>b.width>0&&b.height>0&&b.right>c.l&&b.left<c.r&&b.bottom>c.t&&b.top<c.b);if(rects.length)text.push({text:n.textContent.trim(),parent:n.parentElement.id||n.parentElement.tagName,rects:rects.map(b=>b.toJSON())})}const controls=[...document.querySelectorAll('button,a,input,textarea,select,summary')].map(e=>{const r=e.getBoundingClientRect(),c=clipOf(e),x=Math.max(r.left,c.l),y=Math.max(r.top,c.t),rr=Math.min(r.right,c.r),bb=Math.min(r.bottom,c.b),h=rr>x&&bb>y?document.elementFromPoint((x+rr)/2,(y+bb)/2):null;return {id:e.id,tag:e.tagName,text:(e.getAttribute('aria-label')||e.textContent||e.getAttribute('placeholder')||'').trim().slice(0,220),rect:r.toJSON(),clip:c,full:r.width>0&&r.height>0&&r.left>=c.l-.5&&r.right<=c.r+.5&&r.top>=c.t-.5&&r.bottom<=c.b+.5,positive:r.width>0&&r.height>0&&rr>x&&bb>y,hit:!!h&&e.contains(h),expanded:e.getAttribute('aria-expanded'),open:e.tagName==='SUMMARY'?e.parentElement.open:undefined,value:e.matches('input,textarea')?e.value.slice(0,200):undefined}}).filter(e=>e.positive);return {entryId:document.documentElement.dataset.entryId,layer:document.body.dataset.layer,xy:[scrollX,scrollY],extent:[document.documentElement.scrollWidth-innerWidth,document.documentElement.scrollHeight-innerHeight],focus:document.activeElement.id,text,controls}}'''
def log(kind,data):
 with (R/'actions.jsonl').open('a') as f:f.write(json.dumps({'utc':utc(),'seq':seq,'kind':kind,'data':data},ensure_ascii=False)+'\n')
def response(r):
 try:
  path=r.url.split(url,1)[-1].split('?')[0].lstrip('/') or 'index.html';f=A/'continuity/dist/public'/path
  if f.is_file():b=r.body();responses.append({'utc':utc(),'url':r.url,'status':r.status,'bytes':len(b),'sha256':sha(b),'diskSHA256':sha(f.read_bytes()),'path':path})
 except Exception as e:responses.append({'captureError':str(e),'url':r.url})
def observe(label):
 v=p.evaluate(VISIBLE);path=R/f'{seq:03d}-{label}.png';p.screenshot(path=str(path));(R/f'{seq:03d}-{label}-visible.json').write_text(json.dumps(v,ensure_ascii=False,indent=2));log('screen',{'label':label,'PNG':path.name,'visible':v});return v
try:
 env=os.environ.copy();env.update(PORT='0',AI_MODE='mock',ALLOW_PAID_AI='false',AI_REQUESTS_PER_MINUTE='60',AI_PROCESS_CALL_CAP='100');server=subprocess.Popen(['/workspace/browser-env/tools/node_modules/.bin/node','continuity/server/index.mjs','--mock'],cwd=A,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);line=server.stdout.readline();url=re.search(r'http://127\.0\.0\.1:\d+',line).group();pw=sync_playwright().start();browser=pw.chromium.launch(executable_path='/usr/bin/chromium',headless=True);print(json.dumps({'ready':True,'url':url,'browser':browser.version,'PW':version('playwright')}) ,flush=True)
 for raw in sys.stdin:
  seq+=1
  try:
   cmd=json.loads(raw);op=cmd['op'];log('command',cmd)
   if op=='new':
    if ctx:ctx.close()
    ctx=browser.new_context(viewport={'width':cmd['width'],'height':cmd['height']},permissions=['clipboard-read','clipboard-write'],accept_downloads=True);ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(url) else r.abort());p=ctx.new_page();p.on('response',response);p.on('pageerror',lambda e:errors.append(str(e)));p.on('console',lambda m:log('console',{'type':m.type,'text':m.text}));p.on('request',lambda r:posts.append({'utc':utc(),'url':r.url,'payload':r.post_data_json}) if r.method=='POST' and r.url.endswith('/api/continuity') else None);p.goto(url)
   elif op=='import':
    q=p.locator(cmd['selector']);
    with p.expect_file_chooser() as f:q.click()
    p.once('dialog',lambda d:d.accept());f.value.set_files(str(R/'inputs'/cmd['file']))
   elif op=='click':p.locator(cmd['selector']).click()
   elif op=='role':p.get_by_role(cmd['role'],name=cmd['name'],exact=True).click()
   elif op=='fill':p.locator(cmd['selector']).fill(cmd['value'])
   elif op=='select':p.locator(cmd['selector']).select_option(label=cmd['label'])
   elif op=='key':p.keyboard.press(cmd['key'])
   elif op=='wheel':
    p.mouse.move(cmd['x'],cmd['y']);p.evaluate('''()=>{let done;const v={promise:new Promise(r=>done=r),events:[]};const f=e=>{v.events.push({target:e.target.id??e.target.nodeName,trusted:e.isTrusted,y:scrollY});document.removeEventListener('scrollend',f,true);clearTimeout(t);done({ok:true,events:v.events})};document.addEventListener('scrollend',f,true);const t=setTimeout(()=>{document.removeEventListener('scrollend',f,true);done({ok:false,events:v.events})},4000);window.__observerWheel=v}''');p.mouse.wheel(0,cmd['dy']);log('native-wheel-result',p.evaluate('async()=>await window.__observerWheel.promise'))
   elif op=='note':
    target=R/cmd['file'];assert not target.exists(),'judgment immutable';target.write_text('UTC '+utc()+'\n'+cmd['text']+'\n',encoding='utf-8')
   elif op=='opaque':
    # Preserve exact saved envelope without printing/parsing it for the observer.
    b=p.evaluate('localStorage.getItem("agentflow.idea015.workspace")');(R/cmd['file']).write_text(b or 'null');print(json.dumps({'opaqueSaved':cmd['file'],'sha256':sha((b or 'null').encode())}),flush=True)
   elif op=='clipboard':
    b=p.evaluate('navigator.clipboard.readText()');(R/cmd['file']).write_text(b);print(json.dumps({'clipboardFile':cmd['file'],'text':b},ensure_ascii=False),flush=True)
   elif op=='probe':
    data=[]
    for selector in cmd['selectors']:
     q=p.locator(selector)
     if not q.count():data.append({'selector':selector,'count':0});continue
     data.append({'selector':selector,'count':q.count(),'geometry':q.first.evaluate('''e=>{const r=e.getBoundingClientRect();let c={left:0,top:0,right:innerWidth,bottom:innerHeight};const ancestors=[];for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),b=a.getBoundingClientRect(),sx=a.offsetWidth?b.width/a.offsetWidth:1,sy=a.offsetHeight?b.height/a.offsetHeight:1,v={left:b.left+a.clientLeft*sx,top:b.top+a.clientTop*sy,right:b.left+(a.clientLeft+a.clientWidth)*sx,bottom:b.top+(a.clientTop+a.clientHeight)*sy};if(a!==e){if(/auto|scroll|hidden|clip/.test(s.overflowX)){c.left=Math.max(c.left,v.left);c.right=Math.min(c.right,v.right)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){c.top=Math.max(c.top,v.top);c.bottom=Math.min(c.bottom,v.bottom)}}ancestors.push({id:a.id,tag:a.tagName,rect:b.toJSON(),client:v,overflow:[s.overflowX,s.overflowY],scroll:[a.scrollLeft,a.scrollTop],extent:[a.scrollWidth-a.clientWidth,a.scrollHeight-a.clientHeight]})}const h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {rect:r.toJSON(),clip:c,full:r.width>0&&r.height>0&&r.left>=c.left-.5&&r.right<=c.right+.5&&r.top>=c.top-.5&&r.bottom<=c.bottom+.5,hit:!!h&&e.contains(h),visible:e.checkVisibility({visibilityProperty:true}),text:e.textContent,focus:document.activeElement.id,focused:e===document.activeElement,xy:[scrollX,scrollY],ancestors}}''')})
    (R/cmd['file']).write_text(json.dumps(data,ensure_ascii=False,indent=2));log('read-only-probe',data);print(json.dumps({'probeFile':cmd['file']}),flush=True)
   elif op=='arm-overlap':
    p.evaluate("""()=>{const original=File.prototype.arrayBuffer;window.__overlap={slots:{},ready:{}};for(const name of ['overlap-A-valid.json','overlap-B-valid.json']){let ready;window.__overlap.ready[name]=new Promise(r=>ready=r);window.__overlap.slots[name]={ready,started:false,released:false}}File.prototype.arrayBuffer=async function(){const bytes=await original.call(this),slot=window.__overlap.slots[this.name];if(slot){slot.started=true;slot.raw=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);slot.bytes=bytes.byteLength;await new Promise(resolve=>{slot.release=()=>{slot.released=true;resolve()};slot.ready()})}return bytes}}""")
   elif op=='wait-overlap':
    p.evaluate("""async name=>{let timer;try{await Promise.race([window.__overlap.ready[name],new Promise((_,reject)=>timer=setTimeout(()=>reject(Error('buffer gate not ready')),5000))])}finally{clearTimeout(timer)}}""",cmd['name'])
   elif op=='overlap-snapshot' or op=='release-overlap':
    if op=='release-overlap':
     p.evaluate('(name)=>window.__overlap.slots[name].release()',cmd['name'])
     if cmd['name']=='overlap-B-valid.json':p.locator('#result-file-preview[data-selection-state="review"]').wait_for(state='visible')
     p.evaluate('()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))')
    v=p.evaluate("""()=>{const e=document.querySelector('#result-file-preview'),h=document.querySelector('#result-file-review-heading'),a=document.activeElement;return {layer:document.body.dataset.layer,entry:document.documentElement.dataset.entryId,xy:[scrollX,scrollY],focus:{id:a.id,tag:a.tagName,text:a.textContent},current:JSON.parse(localStorage.getItem('agentflow.idea015.workspace'))?.entries.find(x=>x.entryId===document.documentElement.dataset.entryId)?.project.currentTaskId,message:document.querySelector('#result-file-message')?.textContent,preview:e?{dataset:{...e.dataset},text:e.textContent,raw:e.querySelector('#result-file-raw textarea')?.value}:null,heading:h?{rect:h.getBoundingClientRect().toJSON(),text:h.textContent}:null,slots:Object.fromEntries(Object.entries(window.__overlap.slots).map(([name,s])=>[name,{started:s.started,released:s.released,bytes:s.bytes,raw:s.raw}]))}}""")
    (R/(cmd['label']+'.json')).write_text(json.dumps(v,ensure_ascii=False,indent=2));log('overlap-snapshot',v)
   elif op=='observe':pass
   elif op=='geometry':
    v=p.evaluate('''()=>({entryId:document.documentElement.dataset.entryId,xy:[scrollX,scrollY],map:document.querySelector('#space-map')?.getBoundingClientRect().toJSON(),matrix:document.querySelector('#space-plane')?getComputedStyle(document.querySelector('#space-plane')).transform:null,selected:[...document.querySelectorAll('.node-info[aria-pressed=true]')].map(e=>e.id),panelOwner:document.querySelector('#area-panel-body')?.dataset.areaId,panelScroll:document.querySelector('#area-panel-body')?.scrollTop,focus:document.activeElement.id})''');log('read-only-geometry',v);print(json.dumps(v),flush=True)
   elif op=='finish':break
   else:raise ValueError(op)
   if op not in ['note','opaque','clipboard']:
    v=observe(cmd.get('label',op));print(json.dumps({'screenSaved':cmd.get('label',op),'entryId':v['entryId'],'layer':v['layer'],'xy':v['xy']},ensure_ascii=False),flush=True)
   else:print(json.dumps({'ok':True,'op':op}),flush=True)
  except Exception:
   err=traceback.format_exc();log('action-error',err);print(err,flush=True)
finally:
 try:
  if ctx:ctx.close()
  browser.close();pw.stop();server.terminate();out,err=server.communicate(timeout=10);(R/'server.stdout.log').write_text(line+out);(R/'server.stderr.log').write_text(err)
  for z in responses:
   if 'path' in z:z['diskAfterSHA256']=sha((A/'continuity/dist/public'/z['path']).read_bytes())
  (R/'runtime.json').write_text(json.dumps({'utc':utc(),'source':'843ca3993615824452bfc80a6c0c4c65d35df376','url':url,'Node':subprocess.check_output(['/workspace/browser-env/tools/node_modules/.bin/node','--version']).decode().strip(),'PW':version('playwright'),'browser':browser.version,'HTTP':responses,'pageerrors':errors,'serverExit':server.returncode,'paidAI':0},ensure_ascii=False,indent=2));(R/'posts.json').write_text(json.dumps(posts,ensure_ascii=False,indent=2))
 except Exception:(R/'cleanup-error.log').write_text(traceback.format_exc())
