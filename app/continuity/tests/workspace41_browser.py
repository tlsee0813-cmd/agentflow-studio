"""WORK41 map selection and focused continue: home -> example map -> select a part (side panel, no data change) -> continue its
work (text and copy/save together) -> map -> another part -> back to the same work and edit place. Long same-prefix names, a long
report, an unsent request for another part and a 125% page zoom. Real Chromium -> real local HTTP -> explicit MOCK.
Geometry, wiring and storage-boundary checks; not evidence that people find it easier.
"""
import json, subprocess, unittest
from playwright.sync_api import expect
import browser as base

WORKSPACE='agentflow.idea015.workspace';MAP_KEY='agentflow.workspace.map'
subprocess.run(['node',str(base.ROOT/'tests/workspace41-fixtures.mjs'),str(base.OUT)],check=True)
IDS=json.loads((base.OUT/'workspace41-ids.json').read_text(encoding='utf-8'))
FX=json.loads((base.OUT/'workspace41.json').read_text(encoding='utf-8'))['entries'][0]['project']
PREFIX='예약 화면에서 손님이 이미 잡은 예약을 바꾸거나 없애는 흐름의'
CHANGE,CANCEL=f'{PREFIX} 예약 변경',f'{PREFIX} 예약 취소'
MANUAL='[합성41] 변경 가능 시간만 보여 주고, 취소 흐름은 건드리지 않는다.'
DRAFT='[합성41 미전송] 알림 문자에 변경된 시간을 함께 적어 주세요.'
# Every card: screen sizes of its name / idea / reading reason (CSS px x map scale), whether its texts stay inside the card and
# its selection box, whether the whole name is shown, and the visible map box.
READ=r'''()=>{const m=document.getElementById('space-map'),mr=m.getBoundingClientRect(),plane=document.getElementById('space-plane');
 const s=+(plane.style.transform.match(/scale\(([\d.]+)\)/)||[0,1])[1];const R=e=>e.getBoundingClientRect();
 const cards=[...document.querySelectorAll('.area-node')].map(n=>{const c=R(n),pick=n.querySelector('.node-select'),p=R(pick),name=n.querySelector('.area-card-name'),note=n.querySelector('.area-card-note'),sig=n.querySelector('.branch-signals');
  const px=e=>e&&getComputedStyle(e).display!=='none'?parseFloat(getComputedStyle(e).fontSize)*s:null;
  const inside=(e,b)=>{if(!e||getComputedStyle(e).display==='none')return true;const r=R(e);return r.left>=b.left-.5&&r.right<=b.right+.5&&r.top>=b.top-.5&&r.bottom<=b.bottom+.5};
  return {id:n.dataset.areaId,name:name.textContent,box:c.toJSON(),namePx:px(name),notePx:px(note),reasonPx:px(sig),
   nameWhole:inside(name,p)&&name.scrollHeight<=name.clientHeight+1,textsInCard:[name,note,n.querySelector('.area-card-path'),sig,n.querySelector('.node-enter')].every(e=>inside(e,c)),
   nameBox:R(name).toJSON(),selected:n.classList.contains('selected'),visible:c.left>=mr.left-.5&&c.right<=mr.right+.5&&c.top>=mr.top-.5&&c.bottom<=mr.bottom+.5}});
 const lines=[...document.querySelectorAll('.relation-line')].map(l=>{const ctm=l.getScreenCTM(),pt=(x,y)=>({x:ctm.a*x+ctm.e,y:ctm.d*y+ctm.f});return [pt(+l.getAttribute('x1'),+l.getAttribute('y1')),pt(+l.getAttribute('x2'),+l.getAttribute('y2'))]});
 return {map:{top:mr.top,h:mr.height,w:mr.width,left:mr.left,right:mr.right,bottom:mr.bottom},scale:s,transform:plane.style.transform,cards,lines,read:!document.getElementById('map-read').hidden}}'''

class Work41(unittest.TestCase):
    WIDTH,HEIGHT,ZOOM=1280,720,1
    start_at_home=True
    setUpClass=classmethod(base.Browser.setUpClass.__func__);tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state
    def setUp(self):
        base.Browser.setUp(self)
        if self.ZOOM!=1:
            self.ctx.close();self.ctx=self.browser.new_context(viewport={'width':self.WIDTH,'height':self.HEIGHT},device_scale_factor=self.ZOOM)
            self.ctx.route('**/*',lambda r:r.continue_() if r.request.url.startswith(self.url) else (self.external.append(r.request.url),r.abort()))
            self.page=self.ctx.new_page();self.page.on('pageerror',lambda e:self.errors.append(str(e)));self.page.set_default_timeout(6000);self.page.goto(self.url)
            expect(self.page.locator('#mode')).to_contain_text('MOCK')
        self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
    def tag(self):return f'{self.WIDTH}x{self.HEIGHT}@{int(self.ZOOM*100)}'
    def shot(self,name):self.page.screenshot(path=str(base.OUT/f'work41-{self.tag()}-{name}.png'))
    def record(self,label,value):
        with open(base.OUT/'work41-observations.jsonl','a',encoding='utf-8') as fh:fh.write(json.dumps({'case':self.tag(),'label':label,'value':value},ensure_ascii=False)+'\n')
    def keys(self):return sorted(self.page.evaluate('Object.keys(localStorage)'))
    def raw(self):return self.page.evaluate('(k)=>localStorage.getItem(k)',WORKSPACE)
    def read(self,label):r=self.page.evaluate(READ);self.record(label,r);return r
    def fits(self):self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),self.WIDTH,'no horizontal overflow')
    def readable(self,r,where):
        for c in r['cards']:
            if not c['visible']:continue
            self.assertGreaterEqual(c['namePx'],14-0.05,f'{where}: name on screen >= 14px · {c["name"][:20]}')
            if c['notePx'] is not None:self.assertGreaterEqual(c['notePx'],12-0.05,f'{where}: idea on screen >= 12px · {c["name"][:20]}')
            if c['reasonPx'] is not None:self.assertGreaterEqual(c['reasonPx'],12-0.05,f'{where}: reading reason >= 12px')
    def no_collisions(self,r,where):
        for c in r['cards']:
            self.assertTrue(c['textsInCard'],f'{where}: texts stay inside their card · {c["name"][:20]}')
            self.assertTrue(c['nameWhole'],f'{where}: the whole name is shown · {c["name"][:20]}')
            for o in r['cards']:
                if o is c:continue
                b,n=o['box'],c['nameBox'];self.assertFalse(n['left']<b['right'] and b['left']<n['right'] and n['top']<b['bottom'] and b['top']<n['bottom'],f'{where}: name not over another card')
            for line in r['lines']:
                for pt in line:
                    n=c['nameBox'];self.assertFalse(n['left']<=pt['x']<=n['right'] and n['top']<=pt['y']<=n['bottom'],f'{where}: a line end is not under a name')
    def select(self,name):
        card=self.page.locator('.area-node').filter(has=self.page.locator('.area-card-name',has_text=name)).first
        card.locator('.node-select').click();expect(self.page.locator('#area-panel-title')).to_have_text(name);return card

    def test_01_example_map_select_continue_and_back(self):
        p=self.page;expect(p.locator('#projects-view')).to_be_visible();self.shot('1-home')
        p.locator('#example-list .example-open').click();expect(p.locator('#space-map')).to_be_visible()
        expect(p.locator('#example-banner')).to_contain_text('저장되지 않고');expect(p.locator('#saved')).to_have_text('예제 · 저장하지 않음')
        r=self.read('example map');self.shot('2-map');self.fits()
        if self.ZOOM==1:
            self.assertLessEqual(r['map']['top'],210,'map starts high on the first screen');self.assertGreaterEqual(r['map']['h'],460,'map is tall')
        self.readable(r,'example first view');self.no_collisions(r,'example first view')
        before=r['transform']
        card=self.select('시간 고르기');self.shot('3-selected')
        self.assertEqual(self.keys(),[],'selecting writes nothing')
        r2=self.read('selected');sel=next(c for c in r2['cards'] if c['selected'])
        self.assertTrue(sel['visible'],'the selected card stays in the visible map beside the panel')
        self.assertEqual(r2['scale'],r['scale'],'selecting never zooms or fits')
        pr=p.locator('#area-panel').bounding_box();self.assertLessEqual(sel['box']['right'],pr['x'],'the panel does not cover the selected card')
        expect(card.locator('.node-select')).to_have_attribute('aria-pressed','true')
        # The work already continued in this part comes first, with its edit target and the explicit continue as the pinned action.
        first=p.locator('#area-panel-body > section').first;expect(first).to_have_attribute('id','panel-work')
        expect(p.locator('#panel-continue-target')).to_contain_text('고치는 대상 · 작업 02');expect(p.locator('#panel-continue')).to_be_in_viewport()
        expect(p.locator('#panel-actions #panel-continue')).to_have_count(1)
        # Tab moves focus, never the selection.
        p.locator(f'#node-info-{sel["id"]}').focus();p.keyboard.press('Tab');p.keyboard.press('Tab');p.keyboard.press('Tab')
        expect(p.locator('#area-panel-title')).to_have_text('시간 고르기');self.assertEqual(p.locator('.area-node.selected').count(),1)
        p.locator('#panel-continue').click()
        expect(p.locator('#current-work')).to_be_visible();self.shot('4-work')
        for sel_ in ['#work-place','#work-next','#copy-work','#download-work']:
            b=p.locator(sel_).bounding_box();self.record('work first screen '+sel_,b)
            self.assertLess(b['y'],self.HEIGHT,f'{sel_} starts on the first screen')
        expect(p.locator('#outcome-context')).not_to_have_attribute('open','');expect(p.locator('#work-source')).to_contain_text('외부 원문')
        expect(p.locator('#current-source > summary')).to_contain_text('미검증');expect(p.locator('#work-place')).to_contain_text('예제 · 저장 안 됨')
        expect(p.locator('#compose-panel')).not_to_have_attribute('open','')
        # Edit the example's text, leave for the map and another part, come back to the same field and caret.
        field=p.locator('#work-next');field.fill('예제에서 고친 작업문입니다.');field.evaluate('(e)=>{e.focus();e.setSelectionRange(4,4)}');y=p.evaluate('scrollY')
        p.locator('#place-space').click();expect(p.locator('#space-map')).to_be_visible()
        self.select('알림');expect(p.locator('#panel-work')).to_have_count(0);self.shot('5-other-part')
        p.locator('#nav-work').click();expect(p.locator('#work-next')).to_be_focused()
        self.assertEqual(field.input_value(),'예제에서 고친 작업문입니다.');self.assertEqual(field.evaluate('(e)=>[e.selectionStart,e.selectionEnd]'),[4,4])
        self.assertEqual(p.evaluate('scrollY'),y,'the same reading place')
        self.assertEqual(self.keys(),[],'nothing from the example is written')
        p.locator('#example-close').click();expect(p.locator('#projects-view')).to_be_visible();self.assertEqual(self.keys(),[])

    def test_02_real_project_long_names_report_and_other_part_draft(self):
        p=self.page;raw=json.dumps({'version':'agentflow.workspace.1','migratedFromLegacy':True,'entries':[]})
        raw=(base.OUT/'workspace41.json').read_text(encoding='utf-8')
        p.evaluate('(raw)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",raw)}',raw);p.reload()
        expect(p.locator('#projects-view')).to_be_visible();p.locator('#project-list .project-open').first.click();expect(p.locator('#space-map')).to_be_visible()
        r=self.read('long names first view');self.shot('6-long-names');self.fits()
        self.readable(r,'long names');self.no_collisions(r,'long names')
        names=[c['name'] for c in r['cards']];self.assertIn(CHANGE,names);self.assertIn(CANCEL,names)
        self.select(CHANGE);r2=self.read('long name selected');self.no_collisions(r2,'long name selected')
        self.assertTrue(next(c for c in r2['cards'] if c['selected'])['visible'])
        expect(p.locator('#panel-continue-gist')).to_contain_text(MANUAL[:20]);expect(p.locator('#panel-continue-target')).to_contain_text('작업 01의 작업문은 그대로')
        self.assertEqual(self.raw(),raw,'selecting and reading change no saved bytes')
        camera=p.locator('#space-plane').evaluate('(e)=>e.style.transform')
        p.locator('#panel-continue').click();expect(p.locator('#current-work')).to_be_visible()
        expect(p.locator('#work-next')).to_have_value(MANUAL)
        expect(p.locator('#compose-draft-status')).to_contain_text('알림');self.shot('7-work-with-other-draft')
        s=self.state();self.assertEqual([s['draft'],s['draftKind'],s['space']['draftTarget'],s['currentTaskId']],[DRAFT,'request',{'area':IDS['notify']},IDS['ret']])
        # A long report opens in place; its end keeps the owning part, the unverified label and the way back to the map.
        expect(p.locator('#work-source')).to_contain_text('외부 원문');p.locator('#current-source > summary').click()
        end=p.locator('.work-source-end');end.scroll_into_view_if_needed();self.shot('8-long-report-end')
        expect(end).to_contain_text(CHANGE);expect(end).to_contain_text('앱 미검증');expect(p.locator('#work-source-return')).to_be_visible()
        p.locator('#work-source-return').click();expect(p.locator('#space-map')).to_be_visible()
        self.assertEqual(p.locator('#space-plane').evaluate('(e)=>e.style.transform'),camera,'the map comes back at the same view')
        expect(p.locator('#area-panel-title')).to_have_text(CHANGE)
        # Read another part, then go back to the original work: same target, text and edit place.
        p.locator('#panel-continue').click();field=p.locator('#work-next');field.evaluate('(e)=>{e.focus();e.setSelectionRange(6,9)}')
        p.locator('#place-space').click();self.select('알림');p.locator('#panel-records').scroll_into_view_if_needed()
        p.locator('#nav-work').click();expect(field).to_be_focused();self.assertEqual(field.evaluate('(e)=>[e.selectionStart,e.selectionEnd]'),[6,9])
        s2=self.state();self.assertEqual([s2['draft'],s2['space']['draftTarget'],s2['currentTaskId'],s2['tasks']],[DRAFT,{'area':IDS['notify']},IDS['ret'],s['tasks']])
        self.assertEqual(self.raw(),raw,'the round trip changed no saved bytes')

class Work41Wide(Work41):WIDTH,HEIGHT=1440,900
class Work41Zoom125(Work41):WIDTH,HEIGHT,ZOOM=1024,576,1.25

if __name__=='__main__':unittest.main(verbosity=2)
