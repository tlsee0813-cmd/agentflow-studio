from methods import *
class Probe(Check):
 def nested(self):
  s=self.refSnap();s['selectedSummary']=self.summary().evaluate('e=>({scrollTop:e.scrollTop,scrollHeight:e.scrollHeight,clientHeight:e.clientHeight,rect:e.getBoundingClientRect().toJSON(),text:e.textContent})');s['sample']=self.rangeSample();return s
 def summaryWheel(self,dy):
  g=self.summary().evaluate(GEO);b=g['rect'];c=g['clip'];l=max(b['left'],c['left']);r=min(b['right'],c['right']);t=max(b['top'],c['top']);bottom=min(b['bottom'],c['bottom']);assert r>l and bottom>t
  x=(l+r)/2;y=(t+bottom)/2;self.log('native nested wheel actual visible intersection',{'x':x,'y':y,'dy':dy,'geometry':g,'hit':self.p.evaluate('p=>document.elementFromPoint(p.x,p.y)?.outerHTML.slice(0,250)',{'x':x,'y':y})})
  self.p.evaluate("""()=>{window.__read29=new Promise(resolve=>{let active=false;const events=[];let timer;const done=(ok)=>{clearTimeout(timer);document.removeEventListener('wheel',wheel,true);document.removeEventListener('scrollend',end,true);resolve({ok,events})},wheel=e=>{if(e.isTrusted){active=true;events.push({type:'wheel',target:e.target.className,delta:e.deltaY})}},end=e=>{if(active){events.push({type:'scrollend',target:e.target.className});done(true)}};document.addEventListener('wheel',wheel,true);document.addEventListener('scrollend',end,true);timer=setTimeout(()=>done(false),4000)})}""")
  try:self.p.mouse.move(x,y);self.p.mouse.wheel(0,dy);v=self.p.evaluate('async()=>await window.__read29');self.log('actual nested wheel events',v);assert v['ok']
  finally:self.p.evaluate('()=>delete window.__read29')
 def moveSummary(self):
  q=self.summary();self.reach(self.body());m=q.evaluate('e=>e.scrollHeight-e.clientHeight');assert m>0
  for _ in range(12):
   top=q.evaluate('e=>e.scrollTop');target=m/2
   if abs(target-top)<2:break
   self.summaryWheel(max(-350,min(350,target-top)))
  s=self.nested();assert s['selectedSummary']['scrollTop']>0;self.log('native selected-summary internal reading',s);return s
 def runProbe(self,w,h):
  self.prepare(w,h);self.map();self.visibleInfo('보관 안내');self.text('설명 오류 고치기');self.fill(self.p.get_by_role('textbox',name='영역 설명 정정',exact=True),LONG);self.button('정정 저장');self.readA();self.click(self.p.locator('#task-view-continue'),'A current');self.openRef();self.moveSummary()
  handles={k:self.p.locator('#work-'+k).element_handle() for k in OLD};bh=self.body().element_handle();sh=self.summary().element_handle();q=self.p.locator('#work-understanding');self.click(q,'U normal click');q.press('Control+Home');i=q.input_value().index('7일')
  for _ in range(i):q.press('ArrowRight')
  q.press('Shift+ArrowRight');pre=self.nested();q.press('3');post=self.nested();ident={k:self.p.locator('#work-'+k).evaluate('(e,o)=>e===o',old) for k,old in handles.items()};ok=all(ident.values()) and self.body().evaluate('(e,o)=>e===o',bh) and self.summary().evaluate('(e,o)=>e===o',sh) and pre['selectedSummary']['scrollTop']==post['selectedSummary']['scrollTop'] and pre['body']['scrollTop']==post['body']['scrollTop'] and post['inputs']['understanding']['focused'] and post['inputs']['understanding']['start']==i+1 and post['inputs']['understanding']['end']==i+1;self.check(ok,'first key BOTH actual scroll hosts and DOM preserved',{'pre':pre,'post':post,'sameDOM':ident});q.press('0');self.state()
  self.map();self.visibleInfo('보관 안내');self.button('이 영역에 새 요청');a2,_=self.send('[합성29 별도 작업] 안내 표현 관찰 자료만 정리해 주세요.');f,u,H,_=self.exportFile('A2-fresh-H');path=R/f'{w}-new-A2-return2.json';path.write_text(json.dumps({**f,'report':'[명시 합성29 새 보고] 실행 아님','evidence':None,'understanding':{**u,'summary':NEW,'changes':[],'proposal':None,'origin':'실제 별도 A2 H/template 기반 합성29'}},ensure_ascii=False,indent=2));self.readA();self.click(self.p.locator('#task-view-continue'),'A1 actual current');self.openRef();before=self.moveSummary();self.receive(path);after=self.nested();current=self.state()['currentTaskId'];ok=after['selectedText']==before['selectedText'] and before['selectedSummary']['scrollTop']==after['selectedSummary']['scrollTop'] and before['body']['scrollTop']==after['body']['scrollTop'] and current==self.Atask;self.check(ok,'new description arrival preserves BOTH nested reading positions',{'pre':before,'post':after,'current':current,'A1':self.Atask,'A2':a2,'H':H});self.screenshot('after-new-description-old-selected-reading');self.rows.append({'viewport':[w,h],'complete':True,'firstKey':self.checks[-2]['pass'],'arrivalBothScrolls':ok,'preInner':before['selectedSummary']['scrollTop'],'postInner':after['selectedSummary']['scrollTop'],'preOuter':before['body']['scrollTop'],'postOuter':after['body']['scrollTop']})
u=None;fatal=None;cleanup=[];code=1
try:
 u=Probe();u.checks=[]
 for w,h in [(1440,900),(1280,720)]:
  try:u.runProbe(w,h)
  except Exception:
   raw=traceback.format_exc();print(raw,file=sys.stderr);u.failures.append({'viewport':[w,h],'traceback':raw});u.screenshot('first-error');break
except Exception:fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 code=int(bool(fatal or not u or u.failures or u.errors or cleanup or any(not x['pass'] for x in u.checks) or len(u.rows)!=2))
 (R/'result.json').write_text(json.dumps({'scope':'nested reader scroll gap only, not full core rerun','sourceCommit':'2a7d078124e96243e949244bec945cc8da2c47ec','rows':u.rows if u else [],'checks':[{'label':x['label'],'pass':x['pass'],'raw':'ui.jsonl CHECK '+x['label']} for x in u.checks] if u else [],'fatal':fatal,'harnessErrors':u.failures if u else [],'pageerrors':u.errors if u else [],'cleanup':cleanup,'plannedChildExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
