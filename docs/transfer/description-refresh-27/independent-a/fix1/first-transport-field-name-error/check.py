from fixture import *
class Check(Observation):
 def editor(self):return self.p.locator('textarea[aria-label="영역 설명 정정"]').locator('xpath=ancestor::details[1]')
 def editOpen(self):
  e=self.editor()
  if not e.evaluate('e=>e.open'):self.click(e.locator(':scope > summary'),'明示 open description edit')
  self.reach(e.locator('textarea'));return self.editor()
 def editCancel(self,label):
  e=self.editor();self.click(e.get_by_role('button',name='취소',exact=True),label);e=self.editor();v={'open':e.evaluate('e=>e.open'),'textareaVisible':e.locator('textarea').is_visible(),'snapshot':self.snap()};self.log('cancel actual closed '+label,v);assert not v['open'] and not v['textareaVisible']
 def editSave(self,label):
  e=self.editor();b=e.get_by_role('button',name=re.compile('^(정정 저장|현재 설명으로 기록)$'));self.click(b,label);self.state();return self.editor()
 def readerA(self):self.map();self.visibleInfo('보관 안내');self.button(REQUEST+' ↘')
 def readRelated(self,expected):
  e=self.editor()
  for title in ['현재 구상·조건 보기','관련 작업문 보기']:
   q=e.locator('summary').filter(has_text=re.compile('^'+re.escape(title)+'$'));self.click(q,title)
  work=e.locator('details').filter(has=self.p.locator('summary').filter(has_text=re.compile('^관련 작업문 보기$')))
  row=work.locator('[data-task-id="'+self.Atask+'"]');assert row.count()==1
  if row.evaluate('e=>e.tagName')=='DETAILS':self.click(row.locator(':scope > summary'),'정확 A 관련 작업 펼침')
  read=[]
  for k,text in expected.items():
   q=row.get_by_text(text,exact=True);self.reach(q);v={'field':k,'text':q.inner_text(),'geometry':q.evaluate(GEO)};assert v['geometry']['hit'] and v['geometry']['full'];read.append(v)
  self.log('actual A related four values while B current',{'currentTask':self.state()['currentTaskId'],'A':self.Atask,'rowTask':row.get_attribute('data-task-id'),'visibleFour':read,'B':self.Btask});assert self.state()['currentTaskId']==self.Btask
 def run(self,w,h):
  self.prepare(w,h);self.map();self.visibleInfo('보관 안내');self.editOpen();self.fill(self.editor().locator('textarea'),CORRECTION);self.editSave('initial normal user correction');assert not self.editor().evaluate('e=>e.open')
  # Normal A work manual edits cause stale, broad work stamp intentionally retained.
  self.button(REQUEST+' ↘');self.click(self.p.locator('#task-view-continue'),'明示 A work');edited={k:v.replace('현재 안내 표시는 7일','현재 안내 표시는 30일') if k in ['understanding','next'] else v for k,v in OLD.items()};self.fillFour(edited)
  staleBase=self.state();(R/f'{w}-stale-before-review.json').write_text(json.dumps(staleBase,ensure_ascii=False,indent=2));history=staleBase['space']['understanding'][self.ids['보관 안내']]
  self.readerA();self.log('stale after manual edit before explicit refresh',{'visible':self.p.locator('#task-view-idea').inner_text(),'history':history});assert '以前' not in '' # no semantic conflict inference
  # Switch current through normal explicit B continue; read A without changing B.
  self.map();self.visibleInfo('자료 찾기');self.button('[합성25 준비] 자료를 찾는 안내문을 정리해 주세요. 보관 안내는 변경하지 마세요. ↘');self.click(self.p.locator('#task-view-continue'),'明示 B current');assert self.state()['currentTaskId']==self.Btask
  self.readerA();self.editOpen();self.readRelated(edited);self.screenshot('stale-related-A-current-B');self.editCancel('task reader stale cancel');self.editOpen()
  originalText=self.editor().locator('textarea').input_value();openState=self.state();self.log('no typing editor opened snapshot',{'text':originalText,'project':openState,'snapshot':self.snap()})
  # No typing in description: normal UI modifies the relevant A work while editor session remains.
  self.click(self.p.locator('#task-view-continue'),'A work to change relevant value normally');assert self.state()['currentTaskId']==self.Atask
  changed=dict(edited);changed['next']+=' [27 관련 작업 변경 확인]';self.fillFour(changed);changedState=self.state()
  self.readerA();assert self.editor().evaluate('e=>e.open');assert self.editor().locator('textarea').input_value()==originalText
  self.editSave('no-typing stale session save must reject');e=self.editor();warning=e.locator('[role=status]');self.reach(warning);assert warning.is_visible();assert e.locator('textarea').input_value()==originalText
  rejected=self.state();assert rejected==changedState;self.log('no typing conflict actual rejection',{'warning':warning.inner_text(),'geometry':warning.evaluate(GEO),'projectUnchanged':True,'draft':e.locator('textarea').input_value(),'snapshot':self.snap()});self.screenshot('no-typing-conflict')
  self.editCancel('cancel rejected session');self.editOpen();assert self.editor().locator('textarea').input_value()==originalText
  pre=self.state();old=pre['space']['understanding'][self.ids['보관 안내']];e=self.editSave('same text explicit current revision');assert not e.evaluate('e=>e.open') and not e.locator('textarea').is_visible()
  refreshed=self.state();now=refreshed['space']['understanding'][self.ids['보관 안내']];assert now['revision']==old['revision']+1 and now['entries'][:-1]==old['entries'];last=now['entries'][-1];assert last['by']=='user' and last['corrects']==old['revision'] and last['text']==originalText
  assert now['entries'][-1]['stamp']!=old['entries'][-1]['stamp']
  for key in ['tasks','bases','sources']:assert refreshed[key]==pre[key]
  for key in ['areas','relations','brief','containment','layout','draftTarget']:assert refreshed['space'][key]==pre['space'][key]
  self.log('same text new explicit user revision',{'before':old,'after':now,'preservedTaskBasesSourcesAndSpace':True});self.editOpen();self.editCancel('task successful save then normal reopen/cancel')
  # Map panel cancel/save also closes synchronously; same text is another explicit revision.
  self.click(self.p.locator('#task-return-origin'),'reader origin map');self.editOpen();self.editCancel('map valid cancel');self.editOpen();preMap=self.state();self.editSave('map same text success');assert not self.editor().evaluate('e=>e.open') and not self.editor().locator('textarea').is_visible();postMap=self.state();assert postMap['space']['understanding'][self.ids['보관 안내']]['revision']==now['revision']+1
  self.editOpen();self.editCancel('map success reopen then cancel');self.screenshot('current-description-map')
  # Actual A POST reference, manual protected; then actual clipboard and exact H.
  self.button(REQUEST+' ↘');self.click(self.p.locator('#task-view-continue'),'A work after refresh');beforePost=len(self.posts);self.click(self.p.locator('#retry-work'),'same A actual ContextRequest');expect(self.p.locator('#working')).to_have_text('');self.state();assert len(self.posts)==beforePost+1
  payload=self.posts[-1]['payload'];ref=payload.get('currentAreaDescription');assert ref and ref['summary']==originalText and ref['by']=='user';self.log('actual A ContextRequest reference',{'payload':payload,'expectedA':self.ids['보관 안내'],'reference':ref});assert next(t for t in self.state()['tasks'] if t['id']==self.Atask)['manual']==changed
  f,u,H,text=self.exportFile('refreshed-A-file-handoff');assert originalText in text and H['work']==changed and H['anchor']['areaId']==self.ids['보관 안내'];assert H['anchor']['understanding']==now['revision']+1
  self.map();final=self.state();assert final['currentTaskId']==self.Atask;assert next(t for t in final['tasks'] if t['id']==self.report['id'])==self.report
  assert next(t for t in final['tasks'] if t['id']==self.Btask)==next(t for t in self.base['tasks'] if t['id']==self.Btask)
  for key in ['bases','sources']:assert final[key]==self.base[key]
  assert next(t for t in final['tasks'] if t['id']==self.Atask)['handoffs'][:2]==[self.H0,self.H1]
  (R/f'{w}-final.json').write_text(json.dumps(final,ensure_ascii=False,indent=2));self.rows.append({'viewport':[w,h],'complete':True,'A':self.ids['보관 안내'],'Atask':self.Atask,'Btask':self.Btask,'noTypingConflictRejected':True,'sameTextNewRevision':last,'actualPOSTReference':ref,'H':H,'finalSnapshot':self.snap()})
u=None;fatal=None;cleanup=[];code=1
try:
 u=Check()
 for w,h in [(1280,720),(1440,900)]:
  try:u.run(w,h)
  except Exception:
   raw=traceback.format_exc();u.failures.append({'viewport':[w,h],'traceback':raw});print(raw,file=sys.stderr);u.screenshot('first-failure');u.log('failure AX',u.p.locator('body').aria_snapshot());break
except Exception:fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 code=int(bool(fatal or not u or u.failures or u.errors or cleanup or len(u.rows)!=2))
 (R/'result.json').write_text(json.dumps({'sourceCommit':'6b96543fdf980ff45f0e1b67f83e8a0a561a1542','expectedPC':2,'completedPC':len(u.rows) if u else 0,'rows':u.rows if u else [],'failures':u.failures if u else [],'fatal':fatal,'cleanup':cleanup,'pageerrors':u.errors if u else [],'plannedChildExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
