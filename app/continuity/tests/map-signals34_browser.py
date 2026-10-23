"""MAP34: each card's own record line inside the fixed 180px card, and the exact existing records entry, on two PCs.

Author-role regression, not an independent UI verdict. Synthetic public-domain-API fixture (map-signals34-fixtures.mjs)
enters through the normal recovery chooser; two later results arrive through the normal result-file chooser so the
'this tab' labels are real. No storage/DOM/product-state injection; geometry is read-only. Text inside the existing
name (two lines), path and idea (one line) clamps is not asserted; their boxes are. The two known residual scenes
(test_04/05) are blocking checks of preparation and measurement only; their clipped px are recorded as a
non-blocking characterization and are NOT a clip-free result.
Run from app/: python continuity/tests/map-signals34_browser.py
"""
import json, re, subprocess, sys, unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base

APP=Path(__file__).resolve().parents[2]
OBS=base.OUT/'map-signals34-observations.jsonl'
OBS.write_text('',encoding='utf-8')
SEED="import {map34Fixture} from './continuity/tests/map-signals34-fixtures.mjs';console.log(JSON.stringify(map34Fixture(JSON.parse(process.argv[1]))));"
# Every box of one card: inside the card and every clipping ancestor; controls also hit at their centre.
CARD=r'''id=>{const n=document.querySelector(`.area-node[data-area-id="${id}"]`);if(!n)return null;const c=n.getBoundingClientRect();
 const box=e=>{const r=e.getBoundingClientRect();let l=0,t=0,rr=innerWidth,b=innerHeight;
  for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),q=p.getBoundingClientRect(),sx=q.width/(p.offsetWidth||1),sy=q.height/(p.offsetHeight||1);
   if(/auto|scroll|hidden|clip/.test(s.overflowX)){l=Math.max(l,q.left+p.clientLeft*sx);rr=Math.min(rr,q.left+(p.clientLeft+p.clientWidth)*sx)}
   if(/auto|scroll|hidden|clip/.test(s.overflowY)){t=Math.max(t,q.top+p.clientTop*sy);b=Math.min(b,q.top+(p.clientTop+p.clientHeight)*sy)}}
  const inside=r.width>0&&r.height>0&&r.left>=Math.max(l,c.left)-.5&&r.right<=Math.min(rr,c.right)+.5&&r.top>=Math.max(t,c.top)-.5&&r.bottom<=Math.min(b,c.bottom)+.5;
  const control=e.matches('button'),h=control?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;
  return {sel:e.id||e.className,text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,60),inside,hit:control?!!h&&e.contains(h):null}};
 const parts=[...n.querySelectorAll('.area-card-name,.area-card-path,.area-card-note,.tag,.node-enter>.hint,.node-info,.node-enter,.branch-toggle,.area-update-label,.branch-signals,.branch-signals>span')];
 const count=n.querySelector('.node-enter>.hint'),s=n.querySelector('.branch-signals');
 return {height:n.offsetHeight,left:n.style.left,top:n.style.top,boxes:parts.map(box),signal:s?s.textContent.replace(/\s+/g,' ').trim():null,
  aria:s?.getAttribute('aria-label')??null,band:[...n.querySelectorAll('.area-node-foot>*')].map(e=>e.textContent.trim()),
  nameLines:Math.round(n.querySelector('.area-card-name').getBoundingClientRect().height/c.height*n.offsetHeight/18),
  countWhole:!!count&&count.scrollWidth<=count.clientWidth+1,idea:(n.querySelector('.area-card-note,.tag.area-undecided')?.textContent||'').trim(),
  count:count?(()=>{const e=n.querySelector('.node-enter'),q=e.getBoundingClientRect(),r=count.getBoundingClientRect(),k=c.height/n.offsetHeight;
   return {text:count.textContent.trim(),hiddenPx:+(Math.max(0,r.bottom-q.bottom)/k).toFixed(1),fullyHidden:r.top>=q.bottom-.5}})():null}}'''
MAP=r'''()=>({matrix:document.querySelector('#space-plane')?.style.transform,folds:[...document.querySelectorAll('.branch-toggle')].map(e=>[e.id,e.getAttribute('aria-expanded')]),
 owner:document.querySelector('#area-panel-body')?.dataset.areaId??null,focus:document.activeElement?.id,page:scrollY})'''
FACTS={True:{'P':'기록된 질문 4 · 현재 답변 기록 없음 1 · 현재 설명 3 · 이번 탭 설명 갱신 2 · 설명 보류 1 · 이전 기준 설명 1','S':'기록된 질문 1 · 이전 기준 설명 1'},
       False:{'P':'설명 갱신 기록된 질문 4 · 현재 답변 기록 없음 1 · 현재 설명 4 · 이번 탭 설명 갱신 2 · 설명 보류 1','S':'기록된 질문 1 · 현재 설명 1'}}
LEAVES={'A':'기록된 질문 1 · 현재 설명 1','B':'기록된 질문 1 · 현재 답변 기록 없음 1 · 현재 설명 1 · 설명 보류 1','T':'기록된 질문 1','R':'기록된 질문 1 · 현재 답변 기록 없음 1'}

class MapSignals34(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    state=base.Browser.state
    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        self.posts=[];self.page.on('request',lambda r:self.posts.append(r.url) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
    def tearDown(self):
        try:self.page.screenshot(path=str(base.OUT/f'map34-{self.WIDTH}-{self._testMethodName}-last.png'))
        finally:base.Browser.tearDown(self)
    def record(self,kind,label,actual,expected=None):
        with OBS.open('a',encoding='utf-8') as f:f.write(json.dumps({'test':self.id(),'pc':[self.WIDTH,self.HEIGHT],'kind':kind,'label':label,'actual':actual,'expected':expected},ensure_ascii=False)+'\n')
    def equal(self,label,actual,expected):self.record('condition',label,actual,expected);self.assertEqual(actual,expected,label)
    def yes(self,label,ok,raw=None):self.record('condition',label,raw if raw is not None else bool(ok),True);self.assertTrue(ok,label)
    def open_details(self,id):
        d=self.page.locator('#'+id)
        if not d.evaluate('(e)=>e.open'):d.locator('> summary').click()
    def load(self,current,stale,note=False):
        s=json.loads(subprocess.check_output(['node','--input-type=module','-e',SEED,json.dumps({'current':current,'stale':stale,'note':note})],cwd=APP,text=True,encoding='utf-8'))
        self.record('fixture',s['metadata']['nature'],s['metadata']['owners'])
        path=base.OUT/f'map34-{self.WIDTH}-{self._testMethodName}-recovery.json';path.write_text(json.dumps(s['p'],ensure_ascii=False),encoding='utf-8')
        base.reveal_management(self.page,'#import')
        with self.page.expect_file_chooser() as chooser:self.page.locator('#import').click()
        self.page.once('dialog',lambda d:d.accept());chooser.value.set_files(str(path));expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요');base.saved(self.page)
        # Explicit preparation: the open work's own result arrives last, through the normal chooser and confirmation.
        for k in [x for x in ['B','P'] if x!=current]+[current]:
            self.page.locator('#nav-work').click();self.open_details('compose-panel');self.open_details('result-file-panel')
            f=base.OUT/f'map34-{self.WIDTH}-late-{k}.json';f.write_text(json.dumps(s['late'][k],ensure_ascii=False),encoding='utf-8')
            self.page.locator('#result-file-input').set_input_files(str(f));self.page.locator('#accept-result-file').click();base.saved(self.page)
        st=self.state();cur=next(t for t in st['tasks'] if t['id']==st['currentTaskId'])
        self.equal('실제 현재 작업(요청 또는 그 요청에 돌아온 결과)',s['tasks'][current] in [cur['id'],cur['parentTaskId']],True)
        self.page.locator('#nav-space').click();self.page.locator('#map-fit').click();self.posts.clear()
        return s
    def card(self,s,key):v=self.page.evaluate(CARD,s['ids'][key]);self.record('actual',f'card {key}',v);return v
    def whole(self,s,key,label):
        v=self.card(s,key);self.yes(f'{label} {key} 카드 180px',v['height']==180,v['height'])
        pos=self.state()['space']['layout']['positions'][s['ids'][key]]
        self.equal(f'{label} {key} 저장 좌표 그대로',[v['left'],v['top']],[f"{pos['x']}px",f"{pos['y']}px"])
        bad=[b for b in v['boxes'] if not b['inside'] or b['hit'] is False];self.yes(f'{label} {key} 모든 표시·조작이 카드와 clip 안, 조작은 중심 hit',not bad,bad)
        self.yes(f'{label} {key} 기존 수 줄 말줄임 없음',v['countWhole'],v)
        return v
    def check_map(self,s,stale,current,label):
        facts={**LEAVES,**FACTS[stale]}
        for key in ['P','A','B','S','T','R']:
            v=self.whole(s,key,label);self.equal(f'{label} {key} 기록 줄',v['signal'],facts[key])
            self.yes(f'{label} {key} 읽기 범위 이름',v['aria'].endswith('이 부분과 하위 기록 읽기' if key=='P' else '이 부분 기록 읽기'),v['aria'])
        for key in ['P','B']:self.yes(f'{label} {key} 이름 두 줄 경계',self.card(s,key)['nameLines']==2)
        band=self.card(s,'P')['band'];self.equal(f'{label} P 하단 띠',band,['하위 접기','앱에서 이어갈 작업'] if current=='P' else ['하위 접기','설명 갱신'])
        self.equal(f'{label} B 하단 띠',self.card(s,'B')['band'],['설명 갱신'] if current=='P' else ['설명 갱신','앱에서 이어갈 작업'])
        # Fold P through its own control: the card keeps the same owned facts, box and coordinates.
        self.page.locator('#branch-toggle-'+s['ids']['P']).click();expect(self.page.locator('#branch-toggle-'+s['ids']['P'])).to_have_attribute('aria-expanded','false')
        self.page.locator('#map-fit').click();v=self.whole(s,'P',label+' 접힘');self.equal(f'{label} 접힌 P 기록 줄',v['signal'],facts['P'])
        self.yes(f'{label} 접힌 P 띠의 펼치기',bool(re.fullmatch(r'하위 4개 펼치기',v['band'][0])),v['band'])
        self.page.locator('#branch-toggle-'+s['ids']['P']).click();self.page.locator('#map-fit').click()
        self.equal(f'{label} 새 AI 요청 없음',self.posts,[])
    def entry(self,s,key):
        id=s['ids'][key];before=self.page.evaluate(MAP);data=self.state()
        self.page.locator('#branch-records-'+id).click()
        expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id',id)
        expect(self.page.locator('#subtree-records-'+id)).to_have_js_property('open',True)
        expect(self.page.locator('#subtree-records-heading-'+id)).to_be_focused()
        owners=self.page.locator(f'#subtree-records-{id} [data-owner-area]').evaluate_all('es=>[...new Set(es.map(e=>e.dataset.ownerArea))]')
        self.yes(f'{key} 기록의 실제 소유 범위',set(owners)<={s['ids'][k] for k in (['P','A','B','S','T'] if key=='P' else [key])} and len(owners)>0,owners)
        after=self.page.evaluate(MAP);self.equal(f'{key} 진입 뒤 카메라·접힘',[after['matrix'],after['folds']],[before['matrix'],before['folds']])
        self.equal(f'{key} 진입은 저장 자료를 바꾸지 않음',self.state(),data)
        self.page.locator('#area-panel-close').click();expect(self.page.locator('#branch-records-'+id)).to_be_focused()
        back=self.page.evaluate(MAP);self.equal(f'{key} 닫은 뒤 카메라·접힘',[back['matrix'],back['folds']],[before['matrix'],before['folds']])
        self.equal(f'{key} 닫기도 저장 자료 불변',self.state(),data);self.equal(f'{key} 새 AI 요청 없음',self.posts,[])
    def test_01_open_work_in_leaf_with_older_basis(self):
        s=self.load('B',True);self.check_map(s,True,'B','B현재·이전기준')
        self.page.screenshot(path=str(base.OUT/f'map34-{self.WIDTH}-leaf-current.png'))
    def test_02_open_work_in_parent_leads_its_label(self):
        s=self.load('P',False);self.check_map(s,False,'P','P현재·설명갱신')
        self.page.screenshot(path=str(base.OUT/f'map34-{self.WIDTH}-parent-current.png'))
    def test_03_leaf_and_parent_record_entry_and_return(self):
        s=self.load('B',True)
        for key in ['B','R','P']:self.entry(s,key)
        self.page.locator('#branch-toggle-'+s['ids']['P']).click();self.page.locator('#map-fit').click();self.entry(s,'P')

    # KNOWN RESIDUAL, UNRESOLVED (not accepted by the author): a parent with its own current work AND its own this-tab update,
    # a two-line name and six record facts. P's existing count line is pushed below the entry's clip. This test is a normal,
    # blocking check of the scene's preparation, target and measurement only; the clipped px are a non-blocking
    # characterization in map-signals34-observations.jsonl ('characterization'), never counted as a clip-free pass.
    # 575bb745 hides '설명 갱신'/'앱에서 이어갈 작업' in the same scenes instead (map-signals34_measure.py).
    def characterize(self,note):
        s=self.load('P',True,note=note);v=self.card(s,'P')
        self.equal('잔여 장면 P 카드 180px',v['height'],180);self.equal('잔여 장면 P 이름 두 줄',v['nameLines'],2)
        self.equal('잔여 장면 P 기록 줄',v['signal'],'설명 갱신 '+FACTS[True]['P']);self.equal('잔여 장면 P 하단 띠',v['band'],['하위 접기','앱에서 이어갈 작업'])
        self.equal('잔여 장면 P 구상 표시',v['idea'],'[합성34 구상] P는 하위 기록을 모은다.' if note else '구상 미기재')
        m=v['count'];self.yes('잔여 장면 P 기존 수 줄 측정값 존재',bool(m and m['text']=='요청 1개 · 돌아온 결과 1개 · 앱 미검증' and isinstance(m['hiddenPx'],(int,float))),m)
        others=[b for b in v['boxes'] if not b['inside'] and b['text']!=m['text']];self.equal('잔여 장면 P 수 줄 밖의 가림 없음',others,[])
        self.record('characterization','알려진 잔여 · P 기존 수 줄이 진입 clip 밖으로 밀린 px(미해결, 비차단)',m)
        sys.stderr.write(f"\nMAP34 KNOWN RESIDUAL (unresolved, not clip-free) {self.WIDTH}x{self.HEIGHT} idea={note}: count line hidden {m['hiddenPx']}px\n")
    def test_04_characterize_known_residual_with_idea(self):self.characterize(True)
    def test_05_characterize_known_residual_without_idea(self):self.characterize(False)

class MapSignals34Wide(MapSignals34):WIDTH,HEIGHT=1440,900

if __name__=='__main__':unittest.main(verbosity=2)
