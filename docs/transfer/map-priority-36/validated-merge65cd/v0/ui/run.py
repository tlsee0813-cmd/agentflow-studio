from pathlib import Path
import os,sys,json,subprocess,re,hashlib,datetime,traceback
from playwright.sync_api import sync_playwright,expect
R=Path(__file__).parent;A=R.parent/'candidate/app';ART=A/'continuity/static-preview-dist';sha=lambda b:hashlib.sha256(b).hexdigest();sys.path.insert(0,str(A/'continuity/tests'));import browser as base
out={'source':'65cd96d9da53753e70dba350bdf62c5d68474809','events':[],'HTTP':[],'pageerrors':[],'scenes':[]};ctx=None
GEO=r'''e=>{const r=e.getBoundingClientRect();let c={l:0,t:0,r:innerWidth,b:innerHeight};for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),q=a.getBoundingClientRect(),sx=a.offsetWidth?q.width/a.offsetWidth:1,sy=a.offsetHeight?q.height/a.offsetHeight:1;if(/auto|scroll|hidden|clip/.test(s.overflowX)){c.l=Math.max(c.l,q.left+a.clientLeft*sx);c.r=Math.min(c.r,q.left+(a.clientLeft+a.clientWidth)*sx)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){c.t=Math.max(c.t,q.top+a.clientTop*sy);c.b=Math.min(c.b,q.top+(a.clientTop+a.clientHeight)*sy)}}const hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {rect:r.toJSON(),clip:c,full:r.width>0&&r.height>0&&r.x>=c.l-.5&&r.y>=c.t-.5&&r.right<=c.r+.5&&r.bottom<=c.b+.5,hit:!!hit&&e.contains(hit),text:e.textContent,focus:document.activeElement.id,xy:[scrollX,scrollY]}}'''
CARDS=r'''()=>{const clip=e=>{let c={l:0,t:0,r:innerWidth,b:innerHeight};for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),q=a.getBoundingClientRect(),sx=a.offsetWidth?q.width/a.offsetWidth:1,sy=a.offsetHeight?q.height/a.offsetHeight:1;if(/auto|scroll|hidden|clip/.test(s.overflowX)){c.l=Math.max(c.l,q.left+a.clientLeft*sx);c.r=Math.min(c.r,q.left+(a.clientLeft+a.clientWidth)*sx)}if(/auto|scroll|hidden|clip/.test(s.overflowY)){c.t=Math.max(c.t,q.top+a.clientTop*sy);c.b=Math.min(c.b,q.top+(a.clientTop+a.clientHeight)*sy)}}return c};return {map:document.querySelector('#space-map').getBoundingClientRect().toJSON(),matrix:getComputedStyle(document.querySelector('#space-plane')).transform,viewport:[innerWidth,innerHeight],xy:[scrollX,scrollY],font:getComputedStyle(document.body).fontFamily,cards:[...document.querySelectorAll('.area-node')].map(n=>({id:n.dataset.areaId,rect:n.getBoundingClientRect().toJSON(),height:n.offsetHeight,left:n.style.left,top:n.style.top,controls:[...n.querySelectorAll('button,.tag')].map(e=>{const r=e.getBoundingClientRect(),c=clip(e),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id:e.id,text:e.textContent,rect:r.toJSON(),clip:c,full:r.width>0&&r.height>0&&r.x>=c.l-.5&&r.y>=c.t-.5&&r.right<=c.r+.5&&r.bottom<=c.b+.5,hit:e.tagName==='BUTTON'?!!h&&e.contains(h):null}}),texts:[...n.querySelectorAll('.area-card-name,.area-card-path,.area-card-note,.branch-signals')].map(e=>{const c=clip(e),walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),cs=getComputedStyle(e),rect=e.getBoundingClientRect();let t,chars=[];while(t=walker.nextNode())for(let i=0;i<t.length;i++){let rg=document.createRange();rg.setStart(t,i);rg.setEnd(t,i+1);for(const b of rg.getClientRects()){const h=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);chars.push({char:t.data[i],rect:b.toJSON(),full:b.x>=c.l-.5&&b.y>=c.t-.5&&b.right<=c.r+.5&&b.bottom<=c.b+.5,hit:!!h&&e.contains(h)})}}return {class:e.className,text:e.textContent,rect:rect.toJSON(),clip:c,font:cs.font,fontSize:cs.fontSize,lineHeight:cs.lineHeight,rangeVisibleText:chars.filter(x=>x.full&&x.hit).map(x=>x.char).join(''),chars}})}))}}'''
MAP=r'''()=>({camera:getComputedStyle(document.querySelector('#space-plane')).transform,folds:[...document.querySelectorAll('.branch-toggle')].map(e=>[e.id,e.getAttribute('aria-expanded')]),selected:document.querySelector('.area-node.selected')?.dataset.areaId??null,owner:document.querySelector('#area-panel-body')?.dataset.areaId??null,panelScroll:document.querySelector('#area-panel-body')?.scrollTop??null,page:[scrollX,scrollY],focus:document.activeElement.id,plane:document.querySelector('#space-plane').getBoundingClientRect().toJSON()})'''
def emit(kind,data):out['events'].append({'utc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'scene':label,'kind':kind,'data':data})
def click(s):
 q=p.locator(s);emit('click-before',{'selector':s,'geometry':q.evaluate(GEO)});q.click();emit('click-after',p.evaluate('()=>({page:[scrollX,scrollY],focus:document.activeElement.id})'))
def wheel(d):
 box=p.locator('#area-panel-body').bounding_box();p.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);p.evaluate('''()=>{window.__measureScroll=new Promise(resolve=>{const done=e=>{clearTimeout(t);document.removeEventListener('scrollend',done,true);resolve({event:true,target:e.target.id})};document.addEventListener('scrollend',done,true);const t=setTimeout(()=>{document.removeEventListener('scrollend',done,true);resolve({event:false})},1000)})}''');p.mouse.wheel(0,d);emit('native-panel-wheel',{'dy':d,'completion':p.evaluate('async()=>await window.__measureScroll'),'map':p.evaluate(MAP)})
def state(name):
 base.saved(p);v=p.evaluate('localStorage.getItem("agentflow.studio.preview:agentflow.idea015.workspace")');(R/(label+'-'+name+'.json')).write_text(v);return json.loads(v)['entries'][0]['project']
def import_project(file):
 click('#nav-projects')
 with p.expect_file_chooser() as f:click('#list-import')
 p.once('dialog',lambda d:d.accept());f.value.set_files(str(file));expect(p.locator('#notice')).to_contain_text('사본으로 불러왔어요');base.saved(p)
def receive(file):
 click('#nav-work')
 for d in ['compose-panel','result-file-panel']:
  if not p.locator('#'+d).evaluate('e=>e.open'):click('#'+d+' > summary')
 with p.expect_file_chooser() as f:click('#select-result-file')
 f.value.set_files(str(file));expect(p.locator('#accept-result-file')).to_be_visible();click('#accept-result-file');base.saved(p)
def measure(stage,shot=False):
 v=p.evaluate(CARDS);out['scenes'].append({'label':label,'stage':stage,'actual':v});
 for n in v['cards']:
  assert n['height']==180
  for q in n['controls']:assert q['full'] and q['hit'] is not False,(label,stage,n['id'],q)
 if shot:p.screenshot(path=str(R/(label+'-'+stage+'.png')))
 return v
try:
 server=subprocess.Popen(['/workspace/browser-env/venv/bin/python',str(R/'server.py'),str(ART)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);url=server.stdout.readline().strip()
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium');out['browser']=browser.version
  for width,height in [(1280,720),(1440,900)]:
   for kind in ['T2','db5','boundary-no-note','boundary-note']:
    label=f'{width}-{kind}';ctx=browser.new_context(viewport={'width':width,'height':height});p=ctx.new_page();p.on('pageerror',lambda e:out['pageerrors'].append(str(e)))
    def response(r):
     f=ART/(r.url.split(url,1)[-1].split('?')[0].lstrip('/') or 'index.html')
     if f.is_file():b=r.body();out['HTTP'].append({'path':str(f.relative_to(ART)),'status':r.status,'bytes':len(b),'bodySHA':sha(b),'diskBeforeSHA':sha(f.read_bytes())})
    p.on('response',response);p.goto(url);expect(p.locator('#mode')).to_contain_text('미리보기')
    if kind.startswith('boundary'):
     note=kind=='boundary-note';seed="import {map34Fixture} from './continuity/tests/map-signals34-fixtures.mjs';console.log(JSON.stringify(map34Fixture({current:'P',stale:true,note:"+str(note).lower()+"})));";f=json.loads(subprocess.check_output(['/workspace/browser-env/tools/node_modules/.bin/node','--input-type=module','-e',seed],cwd=A,text=True));file=R/'inputs'/(label+'.json');file.write_text(json.dumps(f['p'],ensure_ascii=False));import_project(file)
     for k in ['B','P']:
      file=R/'inputs'/(label+'-return-'+k+'.json');file.write_text(json.dumps(f['late'][k],ensure_ascii=False));receive(file)
     click('#nav-space');click('#map-fit');measure('expanded',shot=(label=='1440-boundary-note' or label=='1280-boundary-no-note'));signal=p.locator('#branch-records-'+f['ids']['P']).inner_text()
     for text in ['답변 기록 없는 현재 질문','설명 보류','이전 기준 설명','이번 탭 설명 갱신']:assert text in signal
     click('#branch-toggle-'+f['ids']['P']);measure('folded');state('final')
    else:
     import_project(R/'inputs'/(kind+'.json'))
     if kind=='db5':receive(R/'inputs/db5-update.json');click('#nav-space')
     click('#map-fit');measure('first-map',shot=(kind=='db5' or label=='1280-T2'))
     if kind=='db5':
      facts=json.loads((R/'db5-FACTS.json').read_text());P=facts['ids']['P'];B=facts['ids']['B'];click('#branch-toggle-'+P);before=state('before-records');beforeMap=p.evaluate(MAP);click('#branch-records-'+P);expect(p.locator('#area-panel-body')).to_have_attribute('data-area-id',P)
      rows=p.locator('.subtree-record').evaluate_all('(es)=>es.map(e=>({owner:e.dataset.ownerArea,ids:[...e.querySelectorAll("button")].map(b=>b.id),text:e.textContent}))');descs=p.locator('.subtree-description').evaluate_all('(es)=>es.map(e=>({owner:e.dataset.ownerArea,ids:[...e.querySelectorAll("button")].map(b=>b.id),text:e.textContent}))');emit('full-owned-record-sets',{'rows':rows,'descriptions':descs,'heading':p.locator('#subtree-records-heading-'+P).inner_text()});assert all(x['owner']!=B for x in rows+descs)
      windows=[]
      for i in range(18):
       data=p.locator('#area-panel-body').evaluate('''e=>({scroll:e.scrollTop,max:e.scrollHeight-e.clientHeight,visible:[...e.querySelectorAll('.subtree-record,.subtree-description,p.hint')].filter(n=>{const r=n.getBoundingClientRect(),b=e.getBoundingClientRect();return r.bottom>b.top&&r.top<b.bottom}).map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON()}))})''');windows.append(data)
       if data['scroll']>=data['max']-1:break
       wheel(180)
      emit('native-read-windows',windows);assert any('요청 1개' in x['text'] for w in windows for x in w['visible']);assert any('돌아온 결과' in x['text'] for w in windows for x in w['visible'])
      target=next(t['id'] for t in reversed(before['tasks']) if t.get('resultFile') and t['resultFile']['returnId']=='H_SYN34_P_CURRENT');row='#subtree-task-'+target
      for i in range(18):
       g=p.locator(row).evaluate(GEO)
       if g['full'] and g['hit']:break
       wheel(-180)
      assert p.locator(row).evaluate(GEO)['full'];preReader=p.evaluate(MAP);emit('before-read-report',{'map':preReader,'row':p.locator(row).evaluate(GEO)});
      if width==1280:p.screenshot(path=str(R/(label+'-records.png')))
      click(row);expect(p.locator('#task-pointed')).to_have_attribute('data-report-task-id',target);emit('exact-report-reader',{'id':target,'text':p.locator('#task-pointed').inner_text()});assert state('during-reader')==before;click('#task-return-origin');emit('after-reader-return',p.evaluate(MAP));assert p.evaluate(MAP)['panelScroll']==preReader['panelScroll'];click('#area-panel-close');afterMap=p.evaluate(MAP);assert afterMap['camera']==beforeMap['camera'] and afterMap['folds']==beforeMap['folds'] and afterMap['selected']==beforeMap['selected'] and afterMap['page']==beforeMap['page'];assert afterMap['focus']=='branch-records-'+P;assert state('after-records')==before;emit('close-origin-return',{'before':beforeMap,'after':afterMap})
      click('#branch-records-'+B);expect(p.locator('#area-panel-body')).to_have_attribute('data-area-id',B);assert all(x==B for x in p.locator('.subtree-record').evaluate_all('(es)=>es.map(e=>e.dataset.ownerArea)'));click('#area-panel-close');assert state('after-other-owner')==before
    ctx.close();ctx=None;print(label+' complete',flush=True)
  browser.close()
 assert not out['pageerrors'];out['childExit']=0
except Exception:
 out['childExit']=1;out['traceback']=traceback.format_exc();traceback.print_exc()
 try:p.screenshot(path=str(R/'FIRST_FAILURE.png'))
 except:pass
finally:
 if 'server' in globals():server.terminate();stdout,stderr=server.communicate();out['serverExit']=server.returncode;(R/'server.stderr.log').write_text(stderr)
 for h in out['HTTP']:h['diskAfterSHA']=sha((ART/h['path']).read_bytes())
 (R/'result.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
sys.exit(out['childExit'])
