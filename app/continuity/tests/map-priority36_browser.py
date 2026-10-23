"""MAP36: the map card says which part this is and why its records may be worth reading; counts are read in the same
owner's existing detail. Two PCs, inside the fixed 180px card.

Author-role regression, not an independent UI verdict. Synthetic public-domain-API fixture (map-signals34-fixtures.mjs,
reused unchanged from cycle 34, including the scenes that failed there) enters through the normal recovery chooser; two
later results arrive through the normal result-file chooser so the this-tab updates are real. No storage/DOM/product-state
injection; geometry is read-only. Every box of every card must be inside the card and its clips: no scene is excluded.
Text inside the name (three lines), membership (one line) and idea (two lines) clamps is not asserted; their boxes are.
Run from app/: python continuity/tests/map-priority36_browser.py
"""
import json, re, subprocess, unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base

APP=Path(__file__).resolve().parents[2]
OBS=base.OUT/'map-priority36-observations.jsonl'
OBS.write_text('',encoding='utf-8')
ONLY="import {reportsOnlyFixture} from './continuity/tests/map-priority36-fixtures.mjs';console.log(JSON.stringify(reportsOnlyFixture()));"
SEED="import {map34Fixture} from './continuity/tests/map-signals34-fixtures.mjs';console.log(JSON.stringify(map34Fixture(JSON.parse(process.argv[1]))));"
CARD=r'''id=>{const n=document.querySelector(`.area-node[data-area-id="${id}"]`);if(!n)return null;const c=n.getBoundingClientRect();
 const box=e=>{const r=e.getBoundingClientRect();let l=0,t=0,rr=innerWidth,b=innerHeight;
  for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),q=p.getBoundingClientRect(),sx=q.width/(p.offsetWidth||1),sy=q.height/(p.offsetHeight||1);
   if(/auto|scroll|hidden|clip/.test(s.overflowX)){l=Math.max(l,q.left+p.clientLeft*sx);rr=Math.min(rr,q.left+(p.clientLeft+p.clientWidth)*sx)}
   if(/auto|scroll|hidden|clip/.test(s.overflowY)){t=Math.max(t,q.top+p.clientTop*sy);b=Math.min(b,q.top+(p.clientTop+p.clientHeight)*sy)}}
  const inside=r.width>0&&r.height>0&&r.left>=Math.max(l,c.left)-.5&&r.right<=Math.min(rr,c.right)+.5&&r.top>=Math.max(t,c.top)-.5&&r.bottom<=Math.min(b,c.bottom)+.5;
  const control=e.matches('button'),h=control?document.elementFromPoint(r.left+r.width/2,r.top+r.height/2):null;
  return {sel:e.id||e.className,text:(e.textContent||'').replace(/\s+/g,' ').trim().slice(0,60),inside,hit:control?!!h&&e.contains(h):null}};
 const parts=[...n.querySelectorAll('.area-card-name,.area-card-path,.area-card-note,.tag,.node-info,.node-enter,.branch-toggle,.branch-signals,.branch-signals>span')];
 const s=n.querySelector('.branch-signals'),k=c.height/n.offsetHeight,lines=e=>e?Math.round(e.getBoundingClientRect().height/k/parseFloat(getComputedStyle(e).lineHeight)):0;
 return {height:n.offsetHeight,left:n.style.left,top:n.style.top,boxes:parts.map(box),text:n.textContent.replace(/\s+/g,' '),
  signal:s?s.textContent.replace(/\s+/g,' ').trim():null,aria:s?.getAttribute('aria-label')??null,band:[...n.querySelectorAll('.area-node-foot>*')].map(e=>e.textContent.trim()),
  nameLines:lines(n.querySelector('.area-card-name')),noteLines:lines(n.querySelector('.area-card-note'))}}'''
MAP=r'''()=>({matrix:document.querySelector('#space-plane')?.style.transform,folds:[...document.querySelectorAll('.branch-toggle')].map(e=>[e.id,e.getAttribute('aria-expanded')]),
 selected:document.querySelector('.area-node.selected')?.dataset.areaId??null,owner:document.querySelector('#area-panel-body')?.dataset.areaId??null,focus:document.activeElement?.id})'''
REASONS={True:{'P':'하위 포함 · 답변 기록 없는 현재 질문 · 설명 보류 · 이전 기준 설명 · 이번 탭 설명 갱신','S':'이전 기준 설명'},
         False:{'P':'하위 포함 · 답변 기록 없는 현재 질문 · 설명 보류 · 이번 탭 설명 갱신','S':'기록 읽기'}}
LEAVES={'A':'기록 읽기','B':'답변 기록 없는 현재 질문 · 설명 보류 · 이번 탭 설명 갱신','T':'기록 읽기','R':'답변 기록 없는 현재 질문'}
OWNED={'P':['P','A','B','S','T'],'B':['B'],'R':['R']}
# Exact records each reader must list: question requests (fixture task keys), latest reports (return ids), description owners.
RECORDS={'P':{'questions':['S','A','T','B'],'reports':['H34_S','H34_A','H34_B','H34_P'],'descriptions':['P','A','B','S']},
         'B':{'questions':['B'],'reports':['H34_B'],'descriptions':['B']},'R':{'questions':['R'],'reports':[],'descriptions':[]}}

class MapPriority36(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    state=base.Browser.state
    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
        self.posts=[];self.page.on('request',lambda r:self.posts.append(r.url) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
    def tearDown(self):
        try:self.page.screenshot(path=str(base.OUT/f'map36-{self.WIDTH}-{self._testMethodName}-last.png'))
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
        path=base.OUT/f'map36-{self.WIDTH}-{self._testMethodName}-recovery.json';path.write_text(json.dumps(s['p'],ensure_ascii=False),encoding='utf-8')
        base.reveal_management(self.page,'#import')
        with self.page.expect_file_chooser() as chooser:self.page.locator('#import').click()
        self.page.once('dialog',lambda d:d.accept());chooser.value.set_files(str(path));expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요');base.saved(self.page)
        # Explicit preparation: the open work's own result arrives last, through the normal chooser and confirmation.
        for k in [x for x in ['B','P'] if x!=current]+[current]:
            self.page.locator('#nav-work').click();self.open_details('compose-panel');self.open_details('result-file-panel')
            f=base.OUT/f'map36-{self.WIDTH}-late-{k}.json';f.write_text(json.dumps(s['late'][k],ensure_ascii=False),encoding='utf-8')
            self.page.locator('#result-file-input').set_input_files(str(f));self.page.locator('#accept-result-file').click();base.saved(self.page)
        st=self.state();cur=next(t for t in st['tasks'] if t['id']==st['currentTaskId'])
        self.equal('실제 현재 작업(요청 또는 그 요청에 돌아온 결과)',s['tasks'][current] in [cur['id'],cur['parentTaskId']],True)
        self.page.locator('#nav-space').click()
        for k in ['B','P']:expect(self.page.locator('#received-area-'+s['ids'][k])).to_have_count(1)
        self.page.locator('#map-fit').click();self.posts.clear()
        return s
    def card(self,s,key):v=self.page.evaluate(CARD,s['ids'][key]);self.record('actual',f'card {key}',v);return v
    def whole(self,s,key,label):
        v=self.card(s,key);self.equal(f'{label} {key} 카드 180px',v['height'],180)
        pos=self.state()['space']['layout']['positions'][s['ids'][key]]
        self.equal(f'{label} {key} 저장 좌표 그대로',[v['left'],v['top']],[f"{pos['x']}px",f"{pos['y']}px"])
        bad=[b for b in v['boxes'] if not b['inside'] or b['hit'] is False];self.equal(f'{label} {key} 모든 표시·조작이 카드와 clip 안, 조작은 중심 hit',bad,[])
        self.yes(f'{label} {key} 요청/결과 수는 카드에 두지 않음',not re.search(r'요청 \d+개|돌아온 결과 \d+개',v['text']),v['text'])
        return v
    def check_map(self,s,stale,current,label):
        reasons={**LEAVES,**REASONS[stale]}
        for key in ['P','A','B','S','T','R']:
            v=self.whole(s,key,label);self.equal(f'{label} {key} 읽을 이유',v['signal'],reasons[key])
            self.yes(f'{label} {key} 읽기 범위 이름',v['aria'].endswith('이 부분과 하위 기록 읽기' if key=='P' else '이 부분 기록 읽기'),v['aria'])
        for key in ['P','B']:self.equal(f'{label} {key} 이름 세 줄 경계',self.card(s,key)['nameLines'],3)
        self.equal(f'{label} P 하단 띠',self.card(s,'P')['band'],['하위 접기','앱에서 이어갈 작업'] if current=='P' else ['하위 접기'])
        self.equal(f'{label} B 하단 띠',self.card(s,'B')['band'],[] if current=='P' else ['앱에서 이어갈 작업'])
        self.page.locator('#branch-toggle-'+s['ids']['P']).click();expect(self.page.locator('#branch-toggle-'+s['ids']['P'])).to_have_attribute('aria-expanded','false')
        self.page.locator('#map-fit').click();v=self.whole(s,'P',label+' 접힘');self.equal(f'{label} 접힌 P 읽을 이유',v['signal'],reasons['P'])
        self.equal(f'{label} 접힌 P 펼치기',v['band'][0],'하위 4개 펼치기')
        self.page.locator('#branch-toggle-'+s['ids']['P']).click();self.page.locator('#map-fit').click()
        self.equal(f'{label} 새 AI 요청 없음',self.posts,[])
    def entry(self,s,key,counts=None):
        id=s['ids'][key];before=self.page.evaluate(MAP);data=self.state()
        self.page.locator('#branch-records-'+id).click()
        expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id',id)
        expect(self.page.locator('#subtree-records-'+id)).to_have_js_property('open',True)
        expect(self.page.locator('#subtree-records-heading-'+id)).to_be_focused()
        owners=self.page.locator(f'#subtree-records-{id} [data-owner-area]').evaluate_all('es=>[...new Set(es.map(e=>e.dataset.ownerArea))]')
        self.equal(f'{key} 상세의 정확한 소유 부분 집합',sorted(owners),sorted(s['ids'][k] for k in OWNED[key]))
        # The complete record set by id: each question's request and each latest unanswered report (by its exact return id),
        # and each owned description row. Nothing outside the owned set and nothing missing.
        rows=self.page.locator(f'#subtree-records-{id} .subtree-record [id^="subtree-task-"]').evaluate_all('es=>es.map(e=>e.id)')
        descs=self.page.locator(f'#subtree-records-{id} .subtree-description').evaluate_all('es=>es.map(e=>e.dataset.ownerArea)')
        ret={t['resultFile']['returnId']:t['id'] for t in self.state()['tasks'] if t.get('resultFile')}
        want=RECORDS[key];self.equal(f'{key} 상세의 정확한 기록 id 집합',sorted(rows),sorted(['subtree-task-'+s['tasks'][k] for k in want['questions']]+['subtree-task-'+ret[h] for h in want['reports']]))
        self.equal(f'{key} 상세의 정확한 설명 소유',sorted(descs),sorted(s['ids'][k] for k in want['descriptions']))
        if counts:
            # The counts the card no longer shows are in this same owner's detail.
            expect(self.page.locator('#subtree-records-heading-'+id)).to_have_text(counts['heading'])
            expect(self.page.locator('#area-panel-body')).to_contain_text(counts['summary'])
        after=self.page.evaluate(MAP);self.equal(f'{key} 진입 뒤 카메라·접힘',[after['matrix'],after['folds']],[before['matrix'],before['folds']])
        self.equal(f'{key} 진입은 저장 자료를 바꾸지 않음',self.state(),data)
        self.page.locator('#area-panel-close').click();expect(self.page.locator('#branch-records-'+id)).to_be_focused()
        back=self.page.evaluate(MAP);self.equal(f'{key} 닫은 뒤 카메라·접힘·선택',[back['matrix'],back['folds'],back['selected']],[before['matrix'],before['folds'],before['selected']])
        self.equal(f'{key} 닫기도 저장 자료 불변',self.state(),data);self.equal(f'{key} 새 AI 요청 없음',self.posts,[])
    def test_01_open_work_in_leaf(self):
        s=self.load('B',True);self.check_map(s,True,'B','B현재')
        self.page.screenshot(path=str(base.OUT/f'map36-{self.WIDTH}-leaf-current.png'))
    # Cycle 34's failing scenes: the parent's own current work and own this-tab update, two/three-line name, every reason.
    def test_02_parent_own_work_and_update_with_idea(self):
        s=self.load('P',True,note=True);self.check_map(s,True,'P','P현재·구상 있음')
        self.page.screenshot(path=str(base.OUT/f'map36-{self.WIDTH}-parent-current-idea.png'))
    def test_03_parent_own_work_and_update_without_idea(self):
        s=self.load('P',True);self.check_map(s,True,'P','P현재·구상 미기재')
        self.page.screenshot(path=str(base.OUT/f'map36-{self.WIDTH}-parent-current-no-idea.png'))
    def test_04_without_older_basis(self):
        s=self.load('P',False);self.check_map(s,False,'P','P현재·이전기준 없음')
    def test_05_exact_records_entry_and_return(self):
        s=self.load('B',True)
        self.entry(s,'B',{'heading':'이 부분과 하위 기록 · 질문 1 · 설명 1','summary':'요청 1개 · 돌아온 결과 2개 · 앱 미검증'});self.entry(s,'R')
        p={'heading':'이 부분과 하위 기록 · 질문 4 · 설명 4','summary':'요청 1개 · 돌아온 결과 1개 · 앱 미검증'}
        self.entry(s,'P',p);self.page.locator('#branch-toggle-'+s['ids']['P']).click();self.page.locator('#map-fit').click();self.entry(s,'P',p)
        # The existing '정보' reader of a leaf also carries the moved counts, and returns to its caller.
        self.page.locator('#branch-toggle-'+s['ids']['P']).click();self.page.locator('#map-fit').click()
        b=s['ids']['B'];data=self.state();self.page.locator('#node-info-'+b).click()
        expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id',b)
        expect(self.page.locator('#area-panel-body')).to_contain_text('요청 1개 · 돌아온 결과 2개 · 앱 미검증')
        expect(self.page.locator('#subtree-records-heading-'+b)).to_have_text('이 부분과 하위 기록 · 질문 1 · 설명 1')
        self.page.locator('#area-panel-close').click();expect(self.page.locator('#node-info-'+b)).to_be_focused()
        self.equal('정보 왕복 저장 자료 불변',self.state(),data);self.equal('정보 왕복 새 AI 요청 없음',self.posts,[])

    # fix1: a part that owns only a report (an ordinary request without a question; understanding:null) and its parent.
    def test_06_reports_only_leaf_and_parent_keep_the_records_entry(self):
        f=json.loads(subprocess.check_output(['node','--input-type=module','-e',ONLY],cwd=APP,text=True,encoding='utf-8'));self.record('fixture',f['metadata']['nature'],f['metadata']['owners'])
        path=base.OUT/f'map36-{self.WIDTH}-reports-only.json';path.write_text(json.dumps(f['p'],ensure_ascii=False),encoding='utf-8')
        base.reveal_management(self.page,'#import')
        with self.page.expect_file_chooser() as chooser:self.page.locator('#import').click()
        self.page.once('dialog',lambda d:d.accept());chooser.value.set_files(str(path));expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요');base.saved(self.page)
        self.page.locator('#nav-space').click();self.page.locator('#map-fit').click();self.posts.clear()
        g,l=f['ids']['G'],f['ids']['L'];s={'ids':f['ids']}
        for key,text,aria in [('L','기록 읽기','이 부분 기록 읽기'),('G','하위 포함 기록 읽기','이 부분과 하위 기록 읽기')]:
            v=self.whole(s,key,'보고만');self.equal(f'보고만 {key} 기록 입구',v['signal'],text);self.yes(f'보고만 {key} 읽기 범위',v['aria'].endswith(aria),v['aria'])
        for key,summary in [('L','요청 1개 · 돌아온 결과 1개 · 앱 미검증'),('G','아직 요청 없음')]:
            id=f['ids'][key];before=self.page.evaluate(MAP);data=self.state()
            self.page.locator('#branch-records-'+id).click()
            expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id',id);expect(self.page.locator('#subtree-records-heading-'+id)).to_be_focused()
            expect(self.page.locator('#subtree-records-heading-'+id)).to_have_text('이 부분과 하위 기록 · 질문 0 · 설명 0')
            rows=self.page.locator(f'#subtree-records-{id} .subtree-record [id^="subtree-task-"]').evaluate_all('es=>es.map(e=>e.id)')
            self.equal(f'보고만 {key} 상세의 정확한 기록 id 집합',rows,['subtree-task-'+f['report']])
            self.equal(f'보고만 {key} 상세의 정확한 소유',self.page.locator(f'#subtree-records-{id} [data-owner-area]').evaluate_all('es=>[...new Set(es.map(e=>e.dataset.ownerArea))]'),[l])
            expect(self.page.locator('#area-panel-body')).to_contain_text(summary)
            if key=='L':
                # The report row opens the exact report read-only and returns to the same row; nothing is written.
                row='#subtree-task-'+f['report'];self.page.locator(row).click()
                expect(self.page.locator('#task-pointed')).to_have_attribute('data-report-task-id',f['report'])
                self.equal('보고 원문 읽기 중 저장 자료 불변',self.state(),data)
                self.page.locator('#task-return-origin').click();expect(self.page.locator('#area-panel-body')).to_have_attribute('data-area-id',l);expect(self.page.locator(row)).to_be_focused()
            self.page.locator('#area-panel-close').click();expect(self.page.locator('#branch-records-'+id)).to_be_focused()
            back=self.page.evaluate(MAP);self.equal(f'보고만 {key} 닫은 뒤 카메라·접힘·선택',[back['matrix'],back['folds'],back['selected']],[before['matrix'],before['folds'],before['selected']])
            self.equal(f'보고만 {key} 저장 자료 불변',self.state(),data);self.equal(f'보고만 {key} 새 AI 요청 없음',self.posts,[])

class MapPriority36Wide(MapPriority36):WIDTH,HEIGHT=1440,900

if __name__=='__main__':unittest.main(verbosity=2)
