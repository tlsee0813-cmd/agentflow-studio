from pathlib import Path
import os,sys,json,traceback,hashlib,ast,datetime
R=Path(__file__).parent;A=R.parent/'cycle17-final-candidate/app';O=R/'ui';O.mkdir(exist_ok=True);os.environ.update(IDEA015_EVIDENCE_DIR=str(O),BROWSER_EXECUTABLE='/usr/bin/chromium',BROWSER_TRANSPORT='direct-http');sys.path.insert(0,str(A/'continuity/tests'));import browser as base
from playwright.sync_api import expect
class H(base.Browser):
 def runTest(self):pass
m=ast.parse((R.parent/'home15-read-final/check.py').read_text());T=next(ast.literal_eval(n.value) for n in m.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='T' for t in n.targets))
x=H();x.setUpClass();result={'source':'98bc0097af132410f75734ac692f9b7d3b42edcb','start':datetime.datetime.now(datetime.timezone.utc).isoformat(),'runs':[]};fatal=None
try:
 for cid in ['powertoys','p13']:
  c=json.loads((R/f'fixtures/{cid}-meta.json').read_text());a,b,task=c['a'],c['b'],c['task']
  for w,h in [(1280,720),(1440,900)]:
   x.setUp();p=x.page;p.set_viewport_size({'width':w,'height':h});x.ctx.grant_permissions(['clipboard-read','clipboard-write'],origin=x.url);run={'sample':cid,'viewport':[w,h],'url':x.url,'checks':[]};result['runs'].append(run)
   def ck(id,ok,raw):run['checks'].append({'id':id,'pass':bool(ok),'raw':raw})
   def state():return x.state()
   def saved():base.saved(p);return p.evaluate('localStorage.getItem("agentflow.idea015.workspace")')
   def snap():return p.evaluate('''()=>{const rect=e=>e&&e.getBoundingClientRect().toJSON();return {windowY:scrollY,focus:document.activeElement.id,matrix:document.querySelector('#space-plane')&&getComputedStyle(document.querySelector('#space-plane')).transform,map:rect(document.getElementById('space-map')),panel:rect(document.getElementById('area-panel')),cards:[...document.querySelectorAll('.area-node')].map(e=>({id:e.dataset.areaId,rect:rect(e),selected:e.classList.contains('selected'),x:e.style.left,y:e.style.top})),open:[...document.querySelectorAll('#space-view details[open]')].map(e=>e.id),scrolls:[...document.querySelectorAll('#space-view .source-raw')].map(e=>({id:e.parentElement.id,top:e.scrollTop,max:e.scrollHeight-e.clientHeight})),activeRect:rect(document.activeElement)}}''')
   def approach(loc):
    for _ in range(40):
     r=loc.bounding_box()
     if r and 90<=r['y'] and r['y']+r['height']<=h-30:return
     p.mouse.move(w-10,h/2);p.mouse.wheel(0,120 if r and r['y']>h-100 else -120);p.wait_for_timeout(40)
    raise AssertionError('native wheel cannot approach '+str(loc))
   def open_d(id):
    loc=p.locator('#'+id)
    if not loc.evaluate('(e)=>e.open'):approach(loc.locator(':scope > summary'));loc.locator(':scope > summary').click()
   def compose():
    p.locator('#nav-work').click()
    if not p.locator('#compose-panel').evaluate('(e)=>e.open'):p.locator('#compose-summary').click()
   def export():
    p.locator('#nav-work').click();open_d('file-return-options');p.locator('#copy-file-work').click();expect(p.locator('#notice')).to_contain_text('클립보드');base.saved(p);text=p.evaluate('navigator.clipboard.readText()');ss=state();t=next(t for t in ss['tasks'] if t['id']==ss['currentTaskId']);return text,t['handoffs'][-1],ss
   def file_for(record,summary,report,proposal=None):return {'schemaVersion':'agentflow.return.2','projectId':state()['id'],'taskId':task,'returnId':record['returnId'],'report':report,'evidence':None,'understanding':{'version':'understanding.1','areaId':a,'basedOn':record['anchor']['understanding'],'summary':summary,'changes':['[합성 상세 변화] '+('변경 조건 설명. '*14),'기존 사용자 구상은 유지한다.'],'proposal':proposal,'origin':c['origin']+' · '+c['link']}}
   def receive(f,label):
    compose();open_d('result-file-panel');path=O/f'{cid}-{w}-{label}.json';path.write_text(json.dumps(f,ensure_ascii=False));p.locator('#result-file-input').set_input_files(str(path));p.locator('#accept-result-file').click();base.saved(p)
   def panel(id):return f'panel-understanding-{id}'
   def locate():
    p.locator('#nav-space').click();button=p.locator(f'#received-area-{a}');approach(button);before=snap();button.click();after=snap();card=p.locator(f'.area-node[data-area-id="{a}"]');geometry=card.evaluate('''e=>{let r=e.getBoundingClientRect(),m=e.closest('#space-map').getBoundingClientRect(),panel=document.getElementById('area-panel').getBoundingClientRect();let hits=[[.1,.1],[.5,.5],[.9,.9]].map(([x,y])=>{let h=document.elementFromPoint(r.x+r.width*x,r.y+r.height*y);return !!h&&(h===e||e.contains(h))});let clip={l:0,t:0,r:innerWidth,b:innerHeight};for(let q=e;q;q=q.parentElement){let s=getComputedStyle(q),b=q.getBoundingClientRect(),sx=q.offsetWidth?b.width/q.offsetWidth:1,sy=q.offsetHeight?b.height/q.offsetHeight:1;if(/hidden|clip|scroll|auto/.test(s.overflowX)){clip.l=Math.max(clip.l,b.left+q.clientLeft*sx);clip.r=Math.min(clip.r,b.left+(q.clientLeft+q.clientWidth)*sx)}if(/hidden|clip|scroll|auto/.test(s.overflowY)){clip.t=Math.max(clip.t,b.top+q.clientTop*sy);clip.b=Math.min(clip.b,b.top+(q.clientTop+q.clientHeight)*sy)}}return {rect:r.toJSON(),map:m.toJSON(),panel:panel.toJSON(),clip,hits,full:r.left>=clip.l&&r.right<=clip.r&&r.top>=clip.t&&r.bottom<=clip.b,overlap:r.left<panel.right&&r.right>panel.left&&r.top<panel.bottom&&r.bottom>panel.top}}''');ck('1-explicit-locate-card-unclipped-uncovered',geometry['full'] and all(geometry['hits']) and not geometry['overlap'],{'before':before,'after':after,'geometry':geometry});return before
   try:
    p.once('dialog',lambda d:d.accept());p.locator('#import-file').set_input_files(str(R/f'fixtures/{cid}.json'));expect(p.locator('#space-map')).to_be_visible();text,record,ss=export();run['firstClipboard']={'text':text,'record':record};ck('5-actual-clipboard-current-and-Background-basis',c['note'] in text and '[합성 요청당시 구상]' in text and '[합성 현재 목적]' in text and record['anchor']['stamp']['note']==c['note'],run['firstClipboard'])
    p.locator('#nav-space').click();p.locator(f'#node-info-{b}').click();open_d('panel-edit');buffer='[독립 미저장 B 구상] 입력 버퍼 유지';p.locator('#panel-note').fill(buffer);box=p.locator('#space-map').bounding_box();xx=box['x']+100;yy=min(h-70,box['y']+box['height']-25);p.mouse.move(xx,yy);p.mouse.down();p.mouse.move(xx-900,yy,steps=10);p.mouse.up();pre=snap();kept=state();longsummary=c['summary']+' [합성 긴 설명] '+('원문 근거를 확인하며 사용자 구상은 유지한다. '*22)+' SUMMARY-END';longreport=c['report']+'\n[합성 긴 원문]\n'+('독립 검사 길이 조건이며 실제 발언이 아니다.\n'*35)+' REPORT-END';proposal=c['proposal']+' [합성 긴 제안] '+('미채택 제안은 사용자 명령이 아니다. '*10)+' PROPOSAL-END';f1=file_for(record,longsummary,longreport,proposal);receive(f1,'r1');p.locator('#nav-space').click();post=snap();now=state();ck('1-receipt-no-automatic-camera-or-user-loss',pre['matrix']==post['matrix'] and [z['id'] for z in pre['cards'] if z['selected']]==[z['id'] for z in post['cards'] if z['selected']] and now['draft']==kept['draft'] and now['draftKind']==kept['draftKind'] and now['space']['draftTarget']==kept['space']['draftTarget'] and now['space']['areas']==kept['space']['areas'] and now['space']['layout']==kept['space']['layout'] and now['tasks'][:len(kept['tasks'])]==kept['tasks'],{'before':pre,'after':post,'kept':kept,'now':now})
    origin=locate();pid=panel(a);role=p.locator('#'+pid).inner_text();ck('2-base-roles-compatible-description-not-pending',all(t in role for t in ['전달 기록','앱 미검증','미채택']) and longsummary[:20] in role and next(z['note'] for z in state()['space']['areas'] if z['id']==a)==c['note'],{'text':role,'snapshot':snap()});
    # Read long full text by real wheel; all clipping ancestors + representative hit observer.
    open_d(pid+'-full');target='SUMMARY-END';trail=[]
    for _ in range(50):
     seen=p.evaluate(T,[pid,target]);trail.append({'seen':seen,'raw':snap()})
     if seen.get('full') and all(seen.get('hits',[])):break
     e=p.locator('#'+pid+'-full .source-raw').first;r=e.bounding_box();p.mouse.move(r['x']+r['width']/2,max(100,min(h-80,r['y']+40)));p.mouse.wheel(0,100);p.wait_for_timeout(40)
    ck('3-long-summary-tail-native-wheel',seen.get('full') and all(seen.get('hits',[])),trail);full=p.locator('#'+pid+'-full');approach(full.locator(':scope > summary'));full.locator(':scope > summary').click();ck('3-full-close-real-hidden',not full.locator('.source-raw').first.evaluate('(e)=>e.checkVisibility()'),snap());open_d(pid+'-evidence');open_d(pid+'-edit');draft='[독립 r1 정정 초안] 새 r2와 혼동하지 않는다.';p.locator('#'+pid+'-text').fill(draft)
    # Return before locating restores other-area original selection and exact same-content viewport.
    approach(p.locator('#locate-return'));p.locator('#locate-return').click();back=snap();ck('1-locate-return-original-view-and-buffer',back['matrix']==origin['matrix'] and back['cards']==origin['cards'] and abs(back['windowY']-origin['windowY'])<=2 and back['focus']==f'received-area-{a}' and p.locator('#panel-note').input_value()==buffer,{'origin':origin,'back':back});ck('3-B-no-A-disclosure-leak',p.locator('#'+panel(b)+'-evidence').count()==0,back)
    locate();ck('4-A-draft-after-B-and-return',p.locator('#'+pid+'-text').input_value()==draft,snap());f2=file_for(record,c['wrong'],c['report'],None);receive(f2,'r2-wrong');locate();before=saved();p.locator('#'+pid+'-save').click();base.saved(p);ck('4-r1-draft-r2-reject-and-preserve',saved()==before and p.locator('#'+pid+'-text').input_value()==draft,{'notice':p.locator('#notice').inner_text(),'text':p.locator('#'+pid+'-text').input_value(),'snapshot':snap()});p.locator('#'+pid+'-cancel').click();open_d(pid+'-edit');corrected=c['summary']+' [사용자 설명 정정] 사용자 구상은 바꾸지 않는다.';p.locator('#'+pid+'-text').fill(corrected);p.locator('#'+pid+'-save').click();base.saved(p);correctState=state();ck('4-valid-wrong-attribution-correctable-note-unchanged',next(z['note'] for z in correctState['space']['areas'] if z['id']==a)==c['note'] and correctState['space']['understanding'][a]['entries'][-1]['by']=='user',{'state':correctState});
    # User prepares existing A continuation explicitly (not the chosen reading report), exports actual clipboard.
    p.locator('#nav-space').click();p.locator('#area-panel-close').click();p.locator('#nav-work').click();# current report R2 can export its context; no currentTask force change
    text2,rec2,s2=export();run['secondClipboard']={'text':text2,'record':rec2};ck('5-valid-corrected-context-attributed-user-priority',corrected in text2 and c['note'] in text2 and '앱 미검증' in text2 and '참고' in text2,run['secondClipboard']);p.screenshot(path=str(O/f'{cid}-{w}-clipboard-view.png'))
    receive(f1,'old-exact');restored=state();ck('4-old-exact-no-resurrection',restored['space']['understanding'][a]==correctState['space']['understanding'][a],{'corrected':correctState['space']['understanding'][a],'afterOld':restored['space']['understanding'][a]})
   finally:x.tearDown()
except Exception:fatal=traceback.format_exc()
finally:x.tearDownClass()
result.update(fatal=fatal,end=datetime.datetime.now(datetime.timezone.utc).isoformat());result['exit']=int(bool(fatal or any(not z['pass'] for r in result['runs'] for z in r['checks'])));(O/'result.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));print(json.dumps({'exit':result['exit'],'runs':len(result['runs']),'failed':[(r['sample'],r['viewport'],z['id']) for r in result['runs'] for z in r['checks'] if not z['pass']],'fatal':fatal},ensure_ascii=False));sys.exit(result['exit'])
