"""PC13: native Chromium -> real localhost HTTP -> explicit MOCK; no paid AI.
The whole space reads purpose -> map first at PC 1280x720 and 1440x900: one-line purpose, the area map with the selection
panel beside it (unchanged), and two one-line disclosures in the map toolbar: '＋ 영역 추가' and '이어 볼 기록 N개 · <kind> n'.
Product12 reading/editing/return contracts are re-checked from the new layout.

Data: a short synthetic project (purpose, three areas with short ideas, one open MOCK question, one returned report) installed
through the product UI ('fixture' steps). Long text is a separate boundary. The 'notice' scene uses the product's own backup
export + import. Operations under test are real click/key/wheel/pointer; nothing assigns app state. A raw JSONL of every
condition (expected vs value) and page snapshot is written before each assertion. Wiring and geometry, not usability.
Run from app/: python continuity/tests/pc13_browser.py
"""
import json, unittest
from pathlib import Path
from playwright.sync_api import expect
import browser as base

CHOICE='빈자리가 나면 대기자에게 자동으로 예약을 이어 주세요'
WORK_KEYS=['understanding','scope','next','checks']
OBS=base.OUT/'pc13-observations.jsonl';OBS.write_text('',encoding='utf-8')
GEOM_JS='''()=>{const box=e=>{if(!e)return null;const r=e.getBoundingClientRect();return {top:r.top,bottom:r.bottom,left:r.left,right:r.right,h:r.height,w:r.width}};
  const hit=e=>{if(!e)return null;const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;if(y<0||y>innerHeight||x<0||x>innerWidth)return false;const h=document.elementFromPoint(x,y);return !!h&&(h===e||e.contains(h))};
  const map=document.getElementById('space-map'),m=box(map),first=document.querySelector('.area-node'),fid=first&&first.dataset.areaId;
  const p=document.getElementById('space-plane'),a=document.activeElement;
  return {vh:innerHeight,vw:innerWidth,windowY:scrollY,docHeight:document.documentElement.scrollHeight,docWidth:document.documentElement.scrollWidth,
    map:m,mapVisible:m?Math.max(0,Math.min(m.bottom,innerHeight)-Math.max(m.top,0)):0,panel:box(document.getElementById('area-panel')),
    notice:box(document.getElementById('notice')),noticeShown:!document.getElementById('notice').hidden,storageError:!document.getElementById('storage-error').hidden,
    purpose:box(document.getElementById('space-brief')),purposeText:(document.getElementById('space-brief')||{}).textContent||null,
    toolbar:box(document.querySelector('.map-toolbar')),records:(document.getElementById('check-summary')||{}).textContent||null,
    firstCard:fid,firstTitleHit:hit(document.getElementById('node-enter-'+fid)),firstInfoHit:hit(document.getElementById('node-info-'+fid)),fitHit:hit(document.getElementById('map-fit')),
    styleTransform:p?p.style.transform:null,computedTransform:p?getComputedStyle(p).transform:null,
    selected:(document.querySelector('.area-node.selected')||{dataset:{}}).dataset.areaId||null,focusId:a&&a.id,
    openDetails:[...document.querySelectorAll('#space-view details[id]')].filter(d=>d.open).map(d=>d.id)}}'''


class Pc13(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state

    def setUp(self):
        base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})

    # ---------- raw records ----------
    def record(self,kind,name,value,expected=None):
        rec={'test':self.id().split('.',1)[-1],'width':self.WIDTH,'height':self.HEIGHT,'kind':kind,'name':name,'value':value}
        if kind=='condition':rec['expected']=expected
        with open(OBS,'a',encoding='utf-8') as fh:fh.write(json.dumps(rec,ensure_ascii=False)+'\n')
    def geom(self,name):v=self.page.evaluate(GEOM_JS);self.record('actual',name,v);return v
    def check(self,name,value,expected,delta=None):
        self.record('condition',name,value,expected if delta is None else {'value':expected,'delta':delta})
        if delta is None:self.assertEqual(value,expected,name)
        else:self.assertAlmostEqual(value,expected,delta=delta,msg=name)
    def check_true(self,name,value,detail=None):self.record('condition',name,detail if detail is not None else value,True);self.assertTrue(value,name)
    def shot(self,name):self.page.screenshot(path=str(base.OUT/f'pc13-{self.WIDTH}-{name}.png'))
    def task(self,tid,s=None):return next(t for t in (s or self.state())['tasks'] if t['id']==tid)

    # ---------- fixture through the product UI ----------
    def start(self,brief,areas):
        self.page.locator('#brief-input').fill(brief);self.page.locator('#brief-start').click()
        for name,note in areas:
            self.page.locator('#area-name').fill(name);self.page.locator('#area-note').fill(note);self.page.locator('#area-add').click()
            expect(self.page.locator('.area-node',has_text=name)).to_be_visible()
        return {a['name']:a['id'] for a in self.state()['space']['areas']}
    def request_in(self,area,text):
        self.page.locator('#nav-space').click();self.page.locator(f'#node-enter-{area}').click();self.page.locator('#area-new-request').click()
        self.page.locator('#draft').fill(text);self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        return self.state()['currentTaskId']
    def export_current(self):
        self.page.locator('#nav-work').click()
        with self.page.expect_download():self.page.locator('#download-work').click()
        base.saved(self.page)
    def paste_report(self,text,target=None):
        self.page.locator('#nav-work').click();self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill(text)
        if target:self.page.locator('#return-task').select_option(target)
        self.page.locator('#send').click();expect(self.page.locator('#working')).to_have_text('')
        return self.state()['tasks'][-1]['id']
    def short_project(self):
        ids=self.start('동네 공방 원데이 클래스 예약 사이트',[('예약','날짜·시간 고르기'),('알림','예약 확인 문자'),('결제','현장 결제 우선')])
        Q=self.request_in(ids['알림'],CHOICE);A=self.request_in(ids['예약'],'A: 예약 접수 화면');R=self.paste_report('R 보고: 접수 화면을 만들었다고 주장')
        self.record('step','fixture via UI: purpose, 3 short areas, open MOCK question Q, request A, report R (current R)',None)
        return ids,Q,A,R
    def fresh_tab(self):
        """A returning visit: a new tab of the same browser profile opens the project from the list (no per-tab view memory)."""
        base.saved(self.page);old=self.page;self.page=self.ctx.new_page();self.page.on('pageerror',lambda e:self.errors.append(str(e)))
        self.page.set_default_timeout(6000);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT});self.page.goto(self.url);expect(self.page.locator('#mode')).to_contain_text('MOCK');old.close()
        self.page.locator('.project-open').first.click();expect(self.page.locator('#space-map')).to_be_visible();self.page.wait_for_timeout(100)

    # ---------- the first screen ----------
    def assert_first_screen(self,g,label):
        self.check(f'{label}: page not scrolled',g['windowY'],0)
        self.check_true(f'{label}: visible map height >= 40% of viewport height',g['mapVisible']>=0.4*g['vh'],{'mapVisible':g['mapVisible'],'vh':g['vh'],'ratio':round(g['mapVisible']/g['vh'],3)})
        self.check(f'{label}: first card title reachable',g['firstTitleHit'],True);self.check(f'{label}: first card info reachable',g['firstInfoHit'],True)
        self.check(f'{label}: no horizontal overflow',g['docWidth']<=g['vw'],True)

    def test_01_default_and_selected_first_screen(self):
        ids,Q,A,R=self.short_project();self.fresh_tab()
        g=self.geom('default');self.assert_first_screen(g,'default')
        self.check('default: purpose one line text',g['purposeText'],'동네 공방 원데이 클래스 예약 사이트')
        self.check_true('default: purpose is one line',g['purpose']['h']<=30,g['purpose'])
        self.check('default: records summary',g['records'],'이어 볼 기록 2개 · 답 기다림 1 · 후속 작업문 없는 보고 1')
        # 'area-list' is the narrow-screen list (display:none on PC); its default open state is not a visible disclosure here.
        self.check('default: nothing opened, nothing selected',[[d for d in g['openDetails'] if d!='area-list'],g['selected'],g['panel']],[[],None,None])
        self.check('default: map zoom/fit reachable',g['fitHit'],True)
        for name in ['예약','알림','결제']:expect(self.page.locator(f'#node-enter-{ids[name]}')).to_be_in_viewport()
        expect(self.page.locator('#space-view')).not_to_contain_text('확인할 일')
        self.shot('01-default')
        t0=g['styleTransform'];self.page.locator(f'#node-info-{ids["예약"]}').click();expect(self.page.locator('#area-panel')).to_be_visible()
        s=self.geom('selected')
        self.check_true('selected: visible map height >= 40% of viewport height',s['mapVisible']>=0.4*s['vh'],{'mapVisible':s['mapVisible'],'vh':s['vh']})
        # The panel takes width from the map and nothing re-fits (contract), so a card at the right edge can end up outside the
        # map. Recorded as a loss; the existing off-screen chip must then say so (no silent loss).
        # The detail takes width from the map and nothing re-fits (contract), so a card at the right edge can end up outside the
        # map. A fit that reserves that width was tried and reverted (it shrank the first screen to 61%/77%; see REPORT).
        # Recorded as a loss; the existing off-screen chip must then say so (no silent loss).
        self.record('actual','selected: first card title reachable (not required)',s['firstTitleHit'])
        if not s['firstTitleHit']:
            chip=self.page.locator('#map-offscreen');expect(chip).to_be_visible();self.record('actual','selected: off-screen chip',chip.inner_text())
        self.check('selected: no auto-fit when the detail opens',s['styleTransform'],t0)
        self.check_true('selected: panel beside the map',s['panel']['left']>=s['map']['right'],{'panel':s['panel'],'map':s['map']})
        self.check('selected: panel top aligned with the map',s['panel']['top'],s['map']['top'],delta=2)
        idea=self.page.locator('#panel-idea');tasks=self.page.locator('#panel-tasks')
        self.check_true('selected: idea above the requests',idea.bounding_box()['y']<tasks.bounding_box()['y'])
        expect(self.page.locator(f'#panel-task-{A}')).to_be_in_viewport();self.shot('02-selected')
        self.page.locator('#area-panel-close').click();expect(self.page.locator('#area-panel')).to_have_count(0)
        self.check('closed: no auto-fit when the detail closes',self.geom('closed')['styleTransform'],t0)
        self.check('reading the layout changed no saved data',self.task(R)['manual'],{k:None for k in WORK_KEYS})

    def test_02_one_normal_notice_stays_visible(self):
        ids,Q,A,R=self.short_project()
        with self.page.expect_download() as d:self.page.locator('#backup').click()
        # A returning visit imports the backup from the project list of a new tab (no per-tab view memory).
        path=base.OUT/f'pc13-{self.WIDTH}-backup.json';d.value.save_as(path);self.fresh_tab();self.page.locator('#nav-projects').click()
        self.page.once('dialog',lambda dl:dl.accept());self.page.locator('#import-file').set_input_files(str(path))
        expect(self.page.locator('#notice')).to_contain_text('사본으로 불러왔어요');self.record('step','product backup export + import: one normal notice',None)
        if not self.page.locator('#space-map').is_visible():self.page.locator('#nav-space').click()
        self.page.mouse.move(self.WIDTH-30,self.HEIGHT//2);self.page.mouse.wheel(0,-3000);self.page.wait_for_timeout(150)  # real wheel back to the top
        g=self.geom('notice');self.check('notice: shown',g['noticeShown'],True)
        self.check_true('notice: inside the first screen',g['notice']['bottom']<=g['vh'],g['notice'])
        self.assert_first_screen(g,'notice');self.shot('03-notice')

    def test_03_area_add_is_an_explicit_disclosure_and_keeps_its_draft(self):
        ids,Q,A,R=self.short_project();self.fresh_tab()
        panel=self.page.locator('#area-add-panel');expect(panel).not_to_have_attribute('open','');expect(self.page.locator('#area-name')).to_be_hidden()
        panel.locator('summary').click();expect(self.page.locator('#area-name')).to_be_visible()
        self.page.locator('#area-name').fill('후기');self.page.locator('#area-note').fill('다녀간 손님 후기')
        panel.locator('summary').focus();self.page.keyboard.press('Enter');expect(panel).not_to_have_attribute('open','')
        self.page.keyboard.press('Enter');expect(panel).to_have_attribute('open','');expect(self.page.locator('#area-name')).to_have_value('후기')
        self.page.locator('#nav-work').click();self.page.locator('#nav-space').click()
        expect(panel).to_have_attribute('open','');expect(self.page.locator('#area-note')).to_have_value('다녀간 손님 후기')
        self.page.locator('#area-add').click();expect(self.page.locator('.area-node',has_text='후기')).to_be_visible()
        self.check('area added',[a['name'] for a in self.state()['space']['areas']],['예약','알림','결제','후기'])
        expect(self.page.locator('#area-name')).to_have_value('')

    def test_04_records_counts_zero_each_both_and_opening(self):
        ids=self.start('동네 공방 원데이 클래스 예약 사이트',[('예약','날짜·시간 고르기'),('알림','예약 확인 문자')])
        summary=self.page.locator('#check-summary');records=self.page.locator('#check-list')
        Q=self.request_in(ids['알림'],CHOICE);self.page.locator('#nav-space').click()
        self.check('decision only',summary.inner_text(),'이어 볼 기록 1개 · 답 기다림 1')
        self.page.locator('#nav-work').click();self.page.locator('.option-button').first.click();expect(self.page.locator('#working')).to_have_text('')
        self.page.locator('#nav-space').click();self.check('zero',summary.inner_text(),'이어 볼 기록 0개')
        records.locator('summary').click();txt=records.inner_text();self.record('actual','zero: opened text',txt)
        for word in ['확인할 일','미결','완료했','끝났']:self.check(f'zero: no "{word}"',word in txt,False)
        A=self.request_in(ids['예약'],'A: 예약 접수 화면');R=self.paste_report('R 보고: 접수 화면을 만들었다고 주장');self.page.locator('#nav-space').click()
        self.check('report only',summary.inner_text(),'이어 볼 기록 1개 · 후속 작업문 없는 보고 1')
        Q2=self.request_in(ids['알림'],CHOICE+' (두 번째)');self.page.locator('#nav-space').click()
        self.check('both',summary.inner_text(),'이어 볼 기록 2개 · 답 기다림 1 · 후속 작업문 없는 보고 1')
        if not records.evaluate('(e)=>e.open'):records.locator('summary').click()  # leaving the space view does not keep it open
        rows=records.locator('.check-item');expect(rows).to_have_count(2);expect(records).to_contain_text('제품 선택 항목 있음');expect(records).to_contain_text('구현 보고 도착 · 앱 미검증')
        for word in ['확인할 일','미결']:self.check(f'both: no "{word}"',word in records.inner_text(),False)
        current=self.state()['currentTaskId'];before=self.geom('records depart')
        self.page.locator(f'#check-open-{R}').click();expect(self.page.locator('#task-pointed')).to_contain_text('R 보고')
        self.check('opening a record does not continue it',self.state()['currentTaskId'],current)
        self.page.locator('#task-return-origin').click();after=self.geom('records back')
        self.check('records back: open disclosures',after['openDetails'],before['openDetails']);self.check('records back: focus on the row button',after['focusId'],f'check-open-{R}')
        self.page.locator(f'#node-enter-{ids["예약"]}').click();expect(self.page.locator('#area-checks')).to_contain_text('이어 볼 기록 · 이 영역 1개 · 다른 영역 1개')
        self.page.locator('#area-checks-open').click();expect(records).to_have_attribute('open','')

    # ---------- product12 contracts from the new layout ----------
    def depart(self,area,task,open_records):
        self.page.locator('#nav-space').click();self.page.locator(f'#node-info-{area}').click();expect(self.page.locator('#area-panel')).to_be_visible()
        if open_records:
            rec=self.page.locator('#check-list')
            if not rec.evaluate('(e)=>e.open'):rec.locator('summary').click()
            expect(rec).to_have_attribute('open','')
        self.page.locator('#map-zoom-in').click();self.page.locator('#map-zoom-in').click()
        box=self.page.locator('#space-map').bounding_box();x,y=box['x']+box['width']*0.5,box['y']+box['height']-30
        self.check('pan starts on the empty map',self.page.evaluate('([x,y])=>{const e=document.elementFromPoint(x,y);return e&&(e.id||e.className)}',[x,y]) in ['space-map','space-plane','relation-layer'],True)
        self.page.mouse.move(x,y);self.page.mouse.down();self.page.mouse.move(x-60,y-30,steps=6);self.page.mouse.up()
        pick=self.page.locator(f'#panel-task-{task}');self.page.mouse.move(self.WIDTH-30,self.HEIGHT//2);self.page.mouse.wheel(0,80);self.page.wait_for_timeout(120)
        expect(pick).to_be_in_viewport()
        g=self.geom('depart');g['anchorY']=pick.bounding_box()['y'];g['cardRect']=self.page.locator(f'.area-node[data-area-id="{area}"]').bounding_box()
        self.record('actual','depart anchor and card',{'anchorY':g['anchorY'],'cardRect':g['cardRect']})
        pick.click();expect(self.page.locator('#task-view')).to_be_visible();return g
    def assert_back(self,b,area,task,label):
        expect(self.page.locator('#space-title')).to_have_text('전체 공간');a=self.geom(f'{label}: back')
        raw=self.page.evaluate("""(id)=>{const e=document.getElementById(id);const r=e.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2,h=document.elementFromPoint(x,y);
          return {y:r.top,hit:!!h&&(h===e||e.contains(h)),focused:document.activeElement===e}}""",f'panel-task-{task}')
        card=self.page.locator(f'.area-node[data-area-id="{area}"]').bounding_box();self.record('actual',f'{label}: anchor and card',{'anchor':raw,'cardRect':card})
        self.check(f'{label}: style transform',a['styleTransform'],b['styleTransform']);self.check(f'{label}: computed matrix',a['computedTransform'],b['computedTransform'])
        self.check(f'{label}: card x/y/w',{k:round(card[k],1) for k in ('x','y','width')},{k:round(b['cardRect'][k],1) for k in ('x','y','width')})
        self.check(f'{label}: selection',a['selected'],area);self.check(f'{label}: open disclosures',a['openDetails'],b['openDetails'])
        self.check(f'{label}: focus on the calling control',raw['focused'],True);self.check(f'{label}: calling control clickable',raw['hit'],True)
        self.check(f'{label}: calling control viewport y',raw['y'],b['anchorY'],delta=1)
        if a['docHeight']==b['docHeight']:self.check(f'{label}: same content keeps windowY',a['windowY'],b['windowY'],delta=1)
        else:self.record('actual',f'{label}: content height changed',{'before':[b['docHeight'],b['windowY']],'after':[a['docHeight'],a['windowY']]})
    def edit_work(self,values):
        d=self.page.locator('#edit-work')
        if d.get_attribute('open') is None:d.locator('summary').first.click()
        for k in WORK_KEYS:self.page.locator(f'#work-{k}').fill(values[k])
        base.saved(self.page)
    def unsent_report(self,text,target):
        self.page.locator('#nav-work').click();self.page.locator('#home-paste-result').click();self.page.locator('#draft').fill(text)
        self.page.locator('#return-task').select_option(target);base.saved(self.page)
    def check_unsent(self,label,text,target):
        s=self.state();self.check(f'{label}: unsent report kind/text',[s['draftKind'],s['draft']],['report',text])
        self.page.locator('#nav-work').click()
        if not self.page.locator('#compose-panel').evaluate('(e)=>e.open'):self.page.locator('#compose-summary').click()
        self.check(f'{label}: explicit return target kept',self.page.locator('#return-task').input_value(),target)

    def test_05_R_edit_and_RB_to_A_from_the_new_layout(self):
        ids=self.start('동네 공방 원데이 클래스 예약 사이트',[('예약','날짜·시간 고르기'),('알림','예약 확인 문자'),('결제','현장 결제 우선')])
        Q=self.request_in(ids['알림'],CHOICE);self.export_current();A=self.request_in(ids['예약'],'A: 예약 접수 화면');self.export_current()
        R=self.paste_report('R 보고: 접수 화면을 만들었다고 주장',A);self.check('fixture: current R',self.state()['currentTaskId'],R)
        self.unsent_report('아직 보내지 않은 보고 1',Q);s0=self.state()
        # (1) default disclosures closed: read A, continue (R stays), edit R, return.
        b=self.depart(ids['예약'],A,False);self.page.locator('#task-view-continue').click();expect(self.page.locator('#current-work')).to_be_visible()
        vR={k:f'R {k} · {self.WIDTH}' for k in WORK_KEYS};self.edit_work(vR);self.page.locator('#work-return-origin').click();self.assert_back(b,ids['예약'],A,'R-edit')
        s1=self.state();self.check('R-edit: current kept',s1['currentTaskId'],R);self.check('R-edit: R manual',self.task(R,s1)['manual'],vR)
        self.check('R-edit: A untouched',self.task(A,s1)['manual'],self.task(A,s0)['manual']);self.shot('04-back-R')
        self.check_unsent('R-edit','아직 보내지 않은 보고 1',Q)
        # Fixture: the user clears that draft, then B in 결제 (exported) and its report RB; a new unsent report for A.
        self.page.locator('#draft').fill('');base.saved(self.page)
        B=self.request_in(ids['결제'],'B: 현장 결제 안내');self.export_current();RB=self.paste_report('RB 보고: 결제 안내 반영했다고 주장',B)
        self.check('fixture: current RB',self.state()['currentTaskId'],RB);self.unsent_report('아직 보내지 않은 보고 2',A);s2=self.state()
        # (2) the records disclosure opened at departure: read A, continue (switches to A, not R), edit A, return.
        b=self.depart(ids['예약'],A,True);self.page.locator('#task-view-continue').click();expect(self.page.locator('#current-work')).to_be_visible()
        vA={k:f'A {k} · {self.WIDTH}' for k in WORK_KEYS};self.edit_work(vA);self.page.locator('#work-return-origin').click();self.assert_back(b,ids['예약'],A,'RB-A-edit')
        s3=self.state();self.check('RB-A-edit: current A',s3['currentTaskId'],A);self.check('RB-A-edit: A manual',self.task(A,s3)['manual'],vA)
        self.check('RB-A-edit: R kept',self.task(R,s3)['manual'],vR);self.check('RB-A-edit: RB untouched',self.task(RB,s3),self.task(RB,s2));self.check('RB-A-edit: B untouched',self.task(B,s3),self.task(B,s2))
        self.shot('05-back-A-records-open');self.check_unsent('RB-A-edit','아직 보내지 않은 보고 2',A)


class Pc13Wide(Pc13):
    WIDTH,HEIGHT=1440,900


class Pc13Boundaries(unittest.TestCase):
    """Long text, CSS width 1024 (not browser zoom) and the 390 minimum, at 1280x720 unless set."""
    WIDTH,HEIGHT=1280,720
    setUpClass=classmethod(base.Browser.setUpClass.__func__)
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state
    setUp=Pc13.setUp;record=Pc13.record;geom=Pc13.geom;check=Pc13.check;check_true=Pc13.check_true;shot=Pc13.shot;start=Pc13.start
    request_in=Pc13.request_in;paste_report=Pc13.paste_report;short_project=Pc13.short_project;fresh_tab=Pc13.fresh_tab;assert_first_screen=Pc13.assert_first_screen;task=Pc13.task

    def test_06_long_purpose_idea_and_title(self):
        purpose='긴 목적: 동네 공방의 원데이 클래스 예약과 알림, 현장 결제를 한곳에서 다룬다. '*12+'목적 끝 ZZ-PURPOSE'
        idea=('긴 구상: 날짜와 시간, 인원, 취소 규칙 메모 · '*80)[:1990]
        ids=self.start(purpose,[('예약',idea),('알림','예약 확인 문자'),('결제','')])
        self.request_in(ids['예약'],'A: '+'예약 접수 화면의 입력 항목과 안내 문구를 길게 설명하는 요청 제목 '*4);self.fresh_tab()
        g=self.geom('long');self.assert_first_screen(g,'long')
        self.check_true('long: purpose stays one line',g['purpose']['h']<=30,g['purpose'])
        brief=self.page.locator('#brief-edit');brief.locator('summary').click();expect(self.page.locator('#brief-edit-text')).to_have_value(purpose)
        self.page.locator(f'#node-info-{ids["예약"]}').click();full=self.page.locator('#panel-idea-full');full.locator('summary').click()
        expect(full.locator('.source-raw')).to_have_text(idea.strip());self.shot('06-long')

    def test_07_css_width_1024_and_narrow_390(self):
        ids,Q,A,R=self.short_project()
        self.page.set_viewport_size({'width':1024,'height':720});self.fresh_tab();self.page.set_viewport_size({'width':1024,'height':720})
        g=self.geom('css-1024 (viewport width, not browser zoom)');self.check('css-1024: no horizontal overflow',g['docWidth']<=g['vw'],True)
        self.page.locator(f'#node-info-{ids["예약"]}').click();s=self.geom('css-1024 selected');self.check('css-1024 selected: no horizontal overflow',s['docWidth']<=s['vw'],True)
        self.record('step','real browser 125% zoom: not executed (headless Chromium here has no browser-zoom control); CSS width 1024 is a different observation',None)
        self.page.set_viewport_size({'width':390,'height':844});self.page.locator('#nav-space').click()
        self.page.locator(f'#list-info-{ids["알림"]}').click();expect(self.page.locator('#area-panel')).to_be_visible()
        self.page.locator('#area-panel-close').click();expect(self.page.locator('#area-panel')).to_have_count(0)
        self.page.locator('#check-list > summary').click();expect(self.page.locator('#check-list')).to_have_attribute('open','')
        n=self.geom('390');self.check('390: no horizontal overflow',n['docWidth']<=n['vw'],True)


if __name__=='__main__':
    unittest.main(verbosity=2)
