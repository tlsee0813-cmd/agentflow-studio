from pathlib import Path
import os,sys,subprocess,json,re,hashlib,datetime,traceback
from playwright.sync_api import sync_playwright,expect
R=Path(__file__).parent; C=R/'candidate/app'; B=Path('/workspace/browser-env/task33-reader-layout/candidate/app'); O=R/'evidence';O.mkdir(exist_ok=True)
sys.path.insert(0,str(C/'continuity/tests'));import browser as base
sha=lambda b:hashlib.sha256(b).hexdigest()
measureSource=(C/'continuity/tests/map-signals34_measure.py').read_text();MEASURE=measureSource.split("MEASURE=r'''",1)[1].split("'''",1)[0]
DETAIL=r'''id=>{let n=document.querySelector(`.area-node[data-area-id="${id}"]`);const cv=document.createElement('canvas').getContext('2d');return {card:n.getBoundingClientRect().toJSON(),matrix:document.querySelector('#space-plane').style.transform,xy:[scrollX,scrollY],focus:document.activeElement.id,font: getComputedStyle(n).fontFamily,rows:[...n.querySelectorAll('.area-card-name,.node-enter>.hint,.tag,.area-update-label,.branch-signals')].map(e=>{const cs=getComputedStyle(e),r=e.getBoundingClientRect();let clip={left:0,top:0,right:innerWidth,bottom:innerHeight},anc=[];for(let a=e;a;a=a.parentElement){const s=getComputedStyle(a),q=a.getBoundingClientRect(),sx=a.offsetWidth?q.width/a.offsetWidth:1,sy=a.offsetHeight?q.height/a.offsetHeight:1,c={left:q.left+a.clientLeft*sx,top:q.top+a.clientTop*sy,right:q.left+(a.clientLeft+a.clientWidth)*sx,bottom:q.top+(a.clientTop+a.clientHeight)*sy};if(/hidden|clip|scroll|auto/.test(s.overflowX)){clip.left=Math.max(clip.left,c.left);clip.right=Math.min(clip.right,c.right)}if(/hidden|clip|scroll|auto/.test(s.overflowY)){clip.top=Math.max(clip.top,c.top);clip.bottom=Math.min(clip.bottom,c.bottom)}anc.push({tag:a.tagName,id:a.id,class:a.className,rect:q.toJSON(),client:c,overflow:[s.overflowX,s.overflowY]})}let range=document.createRange();range.selectNodeContents(e);return{text:e.textContent,rect:r.toJSON(),range:[...range.getClientRects()].map(x=>x.toJSON()),clip,font:cs.font,fontFamily:cs.fontFamily,lineHeight:cs.lineHeight,ancestors:anc,centerHit:e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})}}'''
result={'sourceCandidate':'e059ec6d90e195263121c21817a39ea9ad0534a7','baseline':'575bb7452044e0d987453a24e31680d2d8077b6c','scenes':[],'HTTP':[],'errors':[],'actions':[]}; env=os.environ.copy();env.update(AI_MODE='mock',ALLOW_PAID_AI='false',PORT='0');node='/workspace/browser-env/tools/node_modules/.bin/node'
try:
 with sync_playwright() as pw:
  browser=pw.chromium.launch(executable_path='/usr/bin/chromium');result['browser']=browser.version
  for label,target in [('baseline',B),('candidate',C)]:
   proc=subprocess.Popen([node,'continuity/server/index.mjs','--mock'],cwd=target,env=env,stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True);url=re.search(r'http://127\.0\.0\.1:\d+',proc.stdout.readline()).group()
   try:
    for note in [False,True]:
     name=label+('-note' if note else '-no-note');seed="import {map34Fixture} from './continuity/tests/map-signals34-fixtures.mjs';console.log(JSON.stringify(map34Fixture({current:'P',stale:true,note:"+str(note).lower()+"})));"
     fixture=json.loads(subprocess.check_output([node,'--input-type=module','-e',seed],cwd=C,text=True));tmp=R/(name+'.json');tmp.write_text(json.dumps(fixture['p'],ensure_ascii=False))
     ctx=browser.new_context(viewport={'width':1280,'height':720},device_scale_factor=2);page=ctx.new_page();page.on('pageerror',lambda e:result['errors'].append(str(e)))
     def response(r):
      path=r.url.split(url,1)[-1].split('?')[0].lstrip('/') or 'index.html';f=target/'continuity/dist/public'/path
      if f.is_file():
       body=r.body();result['HTTP'].append({'target':label,'path':path,'status':r.status,'bodyBytes':len(body),'bodySHA':sha(body),'diskSHA':sha(f.read_bytes())})
     page.on('response',response);page.goto(url);expect(page.locator('#mode')).to_contain_text('MOCK');base.reveal_management(page,'#import')
     with page.expect_file_chooser() as ch:page.locator('#import').click()
     page.once('dialog',lambda d:d.accept());ch.value.set_files(str(tmp));expect(page.locator('#notice')).to_contain_text('사본으로 불러왔어요');base.saved(page)
     for k in ['B','P']:
      page.locator('#nav-work').click()
      for d in ['compose-panel','result-file-panel']:
       if not page.locator('#'+d).evaluate('e=>e.open'):page.locator('#'+d+' > summary').click()
      f=R/(name+'-late-'+k+'.json');f.write_text(json.dumps(fixture['late'][k],ensure_ascii=False))
      with page.expect_file_chooser() as ch:page.locator('#select-result-file').click()
      ch.value.set_files(str(f));page.locator('#accept-result-file').click();base.saved(page)
     page.locator('#nav-space').click();page.locator('#map-fit').click()
     result['actions'].append({'scene':name,'sequence':'native backup chooser/import → work → compose/result summary if closed → native B file chooser/accept/save → P file chooser/accept/save → nav-space → explicit fit','fixtureSHA':sha(tmp.read_bytes()),'P':fixture['ids']['P']})
     detail=page.evaluate(DETAIL,fixture['ids']['P']);measured=page.evaluate(MEASURE,fixture['ids']);page.locator('.area-node[data-area-id="'+fixture['ids']['P']+'"]').screenshot(path=str(O/(name+'.png')))
     result['scenes'].append({'name':name,'detail':detail,'authorMetric':measured});ctx.close()
   finally:
    proc.terminate();proc.wait();result.setdefault('servers',[]).append({'target':label,'exit':proc.returncode})
  browser.close()
 assert not result['errors'];assert all(x['status']==200 and x['bodySHA']==x['diskSHA'] for x in result['HTTP'])
 result['executionExit']=0
except Exception:
 result['executionExit']=1;result['traceback']=traceback.format_exc();traceback.print_exc()
finally:(O/'raw.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
sys.exit(result['executionExit'])
