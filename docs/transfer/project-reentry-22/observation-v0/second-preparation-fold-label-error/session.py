from pathlib import Path
import json,sys,re,traceback,datetime
from ui_support import Browser,GEO,OUTER_ACCESS
R=Path(__file__).parent;A=R.parent/'cycle21-a-candidate/app';now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();b=Browser(A,R/'runtime');width=1280;height=720;ids={};exports={};title='';events=R/'events.jsonl';purpose='도서 대출 예약 서비스. 중복 예약은 막고 예약 결과를 알린다.'
def emit(x):
 with events.open('a') as f:f.write(json.dumps(x,ensure_ascii=False)+'\n')
 print(json.dumps(x,ensure_ascii=False),flush=True)
def snap():return {'screen':b.snap(),'AX':b.p.locator('body').aria_snapshot()}
def stable():return b.p.evaluate('()=>new Promise(resolve=>{let a="",same=0,n=0;function f(){let q=JSON.stringify([scrollY,...[...document.querySelectorAll("#area-panel-body,textarea.export-preview")].map(e=>e.scrollTop)]);same=q===a?same+1:0;a=q;if(same>=6||++n>=120)resolve({frames:n,stable:same>=6});else requestAnimationFrame(f)}requestAnimationFrame(f)})')
def reach(q):
 for _ in range(80):
  g=q.evaluate(GEO)
  if q.evaluate(OUTER_ACCESS) and any(z['hit'] and z['inClip'] for z in g['points']):return q
  r=g['rect'];c={'top':0,'bottom':height}
  for z in g['ancestors']:
   if z['self']:continue
   if z['overflowY'] in ['auto','scroll','hidden','clip']:c['top']=max(c['top'],z['clip']['top']);c['bottom']=min(c['bottom'],z['clip']['bottom'])
  d=r['top']-c['top']-6 if r['top']<c['top'] else r['bottom']-c['bottom']+6
  panel=q.evaluate('e=>e.closest("#area-panel-body")?.getBoundingClientRect().toJSON()??null');b.p.mouse.move(panel['x']+12 if panel else width-10,panel['y']+panel['height']/2 if panel else height//2);b.p.mouse.wheel(0,max(-450,min(450,d)));stable()
 raise AssertionError('native reach '+str(g))
def click(name,role='button'):
 q=b.p.get_by_role(role,name=name,exact=True);pre=b.snap();reach(q).click();emit({'event':'UI','method':'normal click with native wheel reach','name':name,'before':pre,'after':b.snap()})
def textclick(text):
 q=b.p.get_by_text(text,exact=True);reach(q).click();emit({'event':'UI','method':'text normal click/native reach','text':text,'after':b.snap()})
def fill(name,value):q=b.p.get_by_role('textbox',name=name,exact=True);reach(q).fill(value);emit({'event':'UI','method':'fill','name':name,'value':value,'after':b.snap()})
def mapview():
 q=b.p.get_by_role('button',name='전체 공간',exact=True)
 if not q.count():q=b.p.get_by_role('button',name=re.compile(r'^전체 공간 \d+$'))
 reach(q).click();b.saved();emit({'event':'map navigation','after':b.snap()})
def closepanel():
 q=b.p.get_by_role('complementary',name=re.compile(' 속성$')).get_by_role('button',name='닫기',exact=True)
 if q.count():reach(q).click()
def info(name):
 closepanel();click('전체 맞춤');click(name+' 정보 (들어가지 않음)')
def child(parent,name,note):
 info(parent);
 if not b.p.get_by_role('textbox',name='새 하위 부분 이름',exact=True).count():textclick('더보기 · 하위 부분과 소속')
 fill('새 하위 부분 이름',name);fill('하위 부분의 구상',note);click('하위 부분 추가');b.saved();ids[name]=next(a['id'] for a in b.project()['space']['areas'] if a['name']==name)
def request(name,body):
 mapview();info(name);click('이 영역에 새 요청');fill('요청 또는 돌아온 결과 원문',body);click('작업문 준비하기 ↗');b.p.locator('#working').wait_for(state='attached');b.p.wait_for_function('document.getElementById("working").textContent===""');b.saved();t=b.project()['currentTaskId'];emit({'event':'actual request','area':name,'taskId':t,'body':body,'snapshot':snap()});return t
def export(label):
 s=b.p.get_by_text('결과를 파일로 받기 · 선택',exact=True)
 if s.evaluate('e=>!e.parentElement.open'):textclick('결과를 파일로 받기 · 선택')
 click('파일 결과용 작업문 복사');b.p.get_by_text('이 탭에서 마지막으로 내보낸 파일용 전문',exact=True).wait_for();b.saved();text=b.p.evaluate('navigator.clipboard.readText()');(R/f'{width}-{label}-handoff.md').write_text(text);blocks=[json.loads(x) for x in re.findall(r'```json\n(.*?)\n```',text,re.S)];f=next(x for x in blocks if x.get('schemaVersion')=='agentflow.return.2');u=next(x for x in blocks if x.get('version')=='understanding.1');p=b.project();t=next(t for t in p['tasks'] if t['id']==f['taskId']);h=next(h for h in t['handoffs'] if h.get('returnId')==f['returnId']);exports[label]={'file':f,'understanding':u,'H':h,'taskId':t['id']};emit({'event':'actual file export','label':label,'template':f,'understanding':u,'H':h});return exports[label]
def receive(label,summary):
 e=exports[label];f={**e['file'],'report':f'[명시 합성 {label}] 실제 구현·외부 검사 없음. {summary}','evidence':None,'understanding':{**e['understanding'],'summary':summary,'changes':[f'명시 합성 설명 {label}'],'proposal':None,'origin':'독립 관측자의 템플릿 기반 합성 설명. AI 실행/사실 검증 없음.'}};path=R/f'{width}-{label}-return2.json';path.write_text(json.dumps(f,ensure_ascii=False,indent=2));click('결과 JSON 가져오기')
 with b.p.expect_file_chooser() as chooser:click('결과 파일 선택')
 chooser.value.set_files(str(path));click('이 결과 가져오기');b.p.get_by_role('button',name='이 결과 검토',exact=True).wait_for();b.saved();p=b.project();T=next(t for t in p['tasks'] if t.get('resultFile') and t['resultFile']['returnId']==f['returnId']);entries=p['space']['understanding'][f['understanding']['areaId']]['entries'];emit({'event':'received target values','label':label,'reportT':T['id'],'parent':T['parentTaskId'],'H':f['returnId'],'entries':entries,'note':next(a['note'] for a in p['space']['areas'] if a['id']==f['understanding']['areaId'])});return T

def setup(w,h):
 global width,height,ids,exports,title
 width=w;height=h;ids={};exports={};title=f'[합성22] 도서 예약 재진입 · {w}';b.new(w,h);b.p.get_by_role('navigation',name='프로젝트 화면',exact=True).get_by_role('button',name='내 프로젝트',exact=True).click();click('＋ 새 프로젝트');fill('프로젝트 이름',title);fill('무엇을 만드나요? 프로젝트 목적 · 작업 요청과 따로 보관해요',purpose);click('영역 나누러 가기')
 for n,note in [('예약','도서 예약을 받고 중복 예약을 막는다.'),('알림','예약 결과를 이용자에게 알린다.')]:fill('영역 이름',n);fill('영역 설명',note);click('＋ 영역 추가');b.saved();ids[n]=next(a['id'] for a in b.project()['space']['areas'] if a['name']==n)
 child('예약','예약 가능 여부','같은 도서의 기존 예약을 확인하여 중복 예약을 막는다.');child('예약','예약 오류 확인','예약 실패 원인은 아직 모른다. 실제 상황을 확인한다.');child('알림','예약 결과 알림','예약 결과를 이용자에게 알리는 문구를 준비한다.');closepanel();textclick('관계 적기')
 for name,value in [('어느 영역에서','예약 가능 여부'),('어느 영역으로','예약 결과 알림'),('관계 유형','이어서 사용')]:q=b.p.get_by_role('combobox',name=name,exact=True);reach(q).select_option(label=value)
 fill('관계 설명','예약 가능 여부 확인 결과를 예약 결과 알림에서 사용한다.');click('관계 추가')
 Q=request('예약 오류 확인','예약이 실패하는 오류가 있는데 원인은 아직 모르겠어요.');b.p.get_by_text('모르는 사실 확인',exact=True).wait_for();emit({'event':'Q prepared first','taskId':Q,'areaId':ids['예약 오류 확인'],'preparationMethod':'MOCK error/unknown keyword trigger learned from code; not a discovery success','question':next(t for t in b.project()['tasks'] if t['id']==Q)['advice']['question']});ids['Q']=Q
 request('예약 가능 여부','같은 도서의 기존 예약이 있으면 중복 접수를 막는 조건을 확인해 주세요.');export('A1');receive('A1','예약 가능 여부는 기존 예약을 확인해 중복 접수를 막는 부분이다. 동시 접수 기준은 아직 미확인이다.');click('이 결과 검토');areaText=b.p.locator('#task-view-idea').inner_text();emit({'event':'A1 actually read once','text':areaText,'geometry':b.p.locator('#task-view-idea').evaluate(GEO),'snapshot':b.snap()})
 request('예약 결과 알림','예약 결과를 안내하는 문구를 준비해 주세요. 알림 방식은 아직 정하지 마세요.');export('B1');mapview();closepanel();fold();click('전체 맞춤');(R/f'{width}-baseline-state.json').write_text(json.dumps(b.project(),ensure_ascii=False,indent=2));b.p.screenshot(path=str(R/f'{width}-baseline-folded.png'));emit({'event':'baseline-before-normal-changes','ids':ids,'snapshot':snap()})
def fold():
 for n in ['예약','알림']:
  q=b.p.get_by_role('button',name=n+' 안의 부분 · 접기',exact=True)
  if q.count():reach(q).click()
def unfold(n):
 q=b.p.get_by_role('button',name=n+' 안의 부분 · 펼치기',exact=True)
 if q.count():reach(q).click()
def changes():
 unfold('예약');request('예약 가능 여부','동시에 두 예약이 들어오면 중복 접수를 막도록 처리 기준을 더 구체화해 주세요.');export('A2');receive('A2','예약 가능 여부는 기존 예약과 동시 접수를 함께 확인한다. 같은 도서의 중복 접수는 막고 우선순위 기준은 아직 미확인이다.');mapview();unfold('알림');info('예약 결과 알림');textclick('이름·구상 고치기');fill('한 줄 구상','예약 결과와 대기 상태를 이용자에게 알리는 문구를 준비한다. 발송 방식은 미정이다.');click('반영');b.saved()
 # Receive B's old H against only B's changed current note. A and Q are untouched.
 click('현재 작업');receive('B1','예약 결과 알림은 예약 확정 문구만 전달하는 부분이다. 대기 상태는 다루지 않는다.');mapview();closepanel();fold();click('전체 맞춤');emit({'event':'changes-complete-before-home','snapshot':snap(),'targetValues':targetvalues()});b.p.screenshot(path=str(R/f'{width}-changed-before-home.png'))
def targetvalues():
 p=b.project();return {'projectId':p['id'],'revision':p['revision'],'currentTaskId':p['currentTaskId'],'draft':p['draft'],'draftKind':p['draftKind'],'draftTarget':p['space']['draftTarget'],'areas':p['space']['areas'],'containment':p['space']['containment'],'relations':p['space']['relations'],'understanding':p['space']['understanding'],'Q':next(t for t in p['tasks'] if t['id']==ids['Q'])}
code=0
try:
 for line in sys.stdin:
  try:c=json.loads(line)
  except:continue
  r={'UTC':now(),'command':c}
  try:
   a=c['action']
   if a=='prepare':setup(c['width'],c['height']);r['observation']=snap()
   elif a=='changes':changes();r['observation']=snap()
   elif a=='home':b.p.get_by_role('navigation',name='프로젝트 화면',exact=True).get_by_role('button',name='내 프로젝트',exact=True).click();r['observation']=snap()
   elif a=='observe':r['observation']=snap()
   elif a=='click':click(c['name'],c.get('role','button'));r['observation']=snap()
   elif a=='text':textclick(c['text']);r['observation']=snap()
   elif a=='fill':fill(c['name'],c['value']);r['observation']=snap()
   elif a=='wheel':b.p.mouse.move(c.get('x',width-10),c.get('y',height//2));b.p.mouse.wheel(0,c['dy']);stable();r['observation']=snap()
   elif a=='screenshot':b.p.screenshot(path=str(R/c['file']));r['screen']=b.snap()
   elif a=='values':r['targetValues']=targetvalues()
   elif a=='final':(R/f'{width}-final-state.json').write_text(json.dumps(b.project(),ensure_ascii=False,indent=2));r['targetValues']=targetvalues()
   elif a=='export':export(c['label']);r['observation']=snap()
   elif a=='key':b.p.keyboard.press(c['key']);stable();r['observation']=snap()
   elif a=='quit':emit(r);break
   else:raise ValueError(c)
  except Exception:r['actionError']=traceback.format_exc()
  emit(r)
finally:
 b.close();sys.exit(int(bool(b.errors)))
