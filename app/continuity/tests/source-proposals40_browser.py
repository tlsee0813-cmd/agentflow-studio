"""SOURCE40 '기록 제안 검토': home entry -> explicit review example -> proposal -> source excerpt -> proposal -> exclude/undo
-> split -> close -> the real project's map and draft as they were. Plus file import (accepted, refused, re-imported),
HTML-as-text, long unbroken excerpts and small windows. Real Chromium -> real local HTTP -> MOCK; the review is tab memory only.
Wiring, geometry and storage-boundary checks; not evidence that people understand the review.
"""
import copy, hashlib, json, re, subprocess, unittest
from playwright.sync_api import expect
import browser as base

MAP_KEY='agentflow.workspace.map'
subprocess.run(['node',str(base.ROOT/'tests/home15-fixtures.mjs'),str(base.OUT)],check=True)
STORES='()=>({local:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])),session:Object.fromEntries(Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)]))})'
EXAMPLE="async()=>(await import('./shared/source-proposals-example.js')).PROPOSAL_EXAMPLE"
# Every ancestor of the source text keeps the page's own scale (nothing inherits the map zoom).
SCALE="(e)=>{const out=[];for(let p=e;p;p=p.parentElement){const s=getComputedStyle(p);if(s.transform!=='none'||(s.zoom&&s.zoom!=='1'))out.push(p.id||p.className)}return {size:getComputedStyle(e).fontSize,scaled:out,overflowX:e.scrollWidth-e.clientWidth}}"
IN_VIEW="(e)=>{const r=e.getBoundingClientRect(),h=document.elementFromPoint(r.left+Math.min(r.width/2,20),r.top+r.height/2);return r.top>=0&&r.bottom<=innerHeight+.5&&r.left>=0&&r.right<=innerWidth+.5&&!!h&&e.contains(h)}"
sha=lambda text:hashlib.sha256(text.encode('utf-8')).hexdigest()

class Source40(unittest.TestCase):
    WIDTH,HEIGHT=1280,720
    start_at_home=True
    setUpClass=classmethod(base.Browser.setUpClass.__func__);tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    tearDown=base.Browser.tearDown;state=base.Browser.state
    def setUp(self):base.Browser.setUp(self);self.page.set_viewport_size({'width':self.WIDTH,'height':self.HEIGHT})
    def stores(self):return self.page.evaluate(STORES)
    def shot(self,name):self.page.screenshot(path=str(base.OUT/f'source40-{self.WIDTH}-{name}.png'))
    def plane(self):return self.page.locator('#space-plane').evaluate('(e)=>e.style.transform')
    def install(self):
        raw=(base.OUT/'home15-six.json').read_text(encoding='utf-8')
        self.page.evaluate('(raw)=>{localStorage.clear();sessionStorage.clear();localStorage.setItem("agentflow.idea015.workspace",raw)}',raw)
        self.page.reload();expect(self.page.locator('#projects-view')).to_be_visible()
    def card(self,name):return self.page.locator('#project-list .project-card').filter(has_text=name)
    def example(self):return self.page.evaluate(EXAMPLE)
    def open_review(self):
        p=self.page;p.locator('#proposal-review-open').click()
        expect(p.locator('#source-review')).to_be_visible();expect(p.locator('#sr-close')).to_be_visible()
    def upload(self,value,name='proposals.json'):
        data=value if isinstance(value,bytes) else json.dumps(value,ensure_ascii=False).encode('utf-8')
        self.page.set_input_files('#sr-file',files=[{'name':name,'mimeType':'application/json','buffer':data}])
    def items(self):return self.page.locator('#sr-side .sr-item').evaluate_all('(l)=>l.map(e=>e.dataset.item)')
    def excluded(self):return self.page.locator('.sr-excluded-item').count()
    def in_view(self,selector):return self.page.locator(selector).evaluate(IN_VIEW)
    def no_apply(self):
        texts=self.page.locator('#source-review button').evaluate_all('(l)=>l.map(b=>b.textContent)')
        self.assertFalse([t for t in texts if any(w in t for w in ['적용','수신','반영','연결하기'])],'no apply/receive action')
        self.assertNotIn('검증 완료',self.page.locator('#source-review').inner_text(),'never says the source was verified')

    def test_01_home_example_proposal_source_exclude_split_close_and_back_to_the_map_and_draft(self):
        p=self.page;self.install()
        self.card('동네 미용실 예약').locator('.project-open').click();expect(p.locator('#space-map')).to_be_visible()
        p.locator('#map-zoom-in').click();p.locator('#map-zoom-in').click();camera=self.plane()
        p.locator('#nav-projects').click();expect(p.locator('#projects-view')).to_be_visible();base.saved(p)
        before=self.stores();self.assertIn(MAP_KEY,before['session'])
        entry=p.locator('#proposal-entry');expect(entry).to_be_visible()
        self.assertLessEqual(entry.evaluate('(e)=>e.getBoundingClientRect().height'),110,'the home keeps a small entry, not a report')
        self.assertEqual(p.locator('#projects-view .sr-item,#projects-view .sr-quote').count(),0)
        p.evaluate('window.scrollTo(0,document.documentElement.scrollHeight)');home_y=p.evaluate('scrollY')
        self.open_review();expect(p.locator('#sr-title')).to_be_focused()
        expect(p.locator('.sr-empty')).to_be_visible();self.assertEqual(self.items(),[],'the example opens only on its own button')
        expect(p.locator('#sr-subtitle')).to_contain_text('새로고침하면 사라져요')

        p.locator('#sr-example').click()
        expect(p.locator('#sr-notice')).to_contain_text('발췌 문자열 해시를 다시 계산해');self.assertEqual(self.items(),['C1','C2','C3'])
        expect(p.locator('#sr-main-title')).to_be_focused();expect(p.locator('#sr-main-title')).to_contain_text('C1 · 사용자가 명시한 제품 방향')
        expect(p.locator('#sr-side .sr-item .tag.amber')).to_have_count(3);expect(p.locator('.sr-reader-tags')).to_contain_text('연결 대기')
        expect(p.locator('.sr-reader-tags')).to_contain_text('기존 작업·부분과 같다고 보지 않음')
        expect(p.locator('.sr-role.role-execution_observation')).to_have_text('실행 관측0');expect(p.locator('.sr-source .sr-warn')).to_contain_text('실제 실행 관측 발췌가 없어요')
        expect(p.locator('.sr-source .sr-facts')).to_contain_text('확인하지 않았어요');self.no_apply()
        reading=p.locator('.sr-reading').first.inner_text();self.assertIn('합성인 것은 아니다',reading)
        self.shot('1-proposal')

        sample=self.example();e01=next(e for e in sample['excerpts'] if e['ref']=='E01')
        p.locator('#sr-read-E01').click();expect(p.locator('#sr-main-title')).to_have_text('E01 원문 · 행 503');expect(p.locator('#sr-main-title')).to_be_focused()
        self.assertEqual(p.locator('#sr-quote').text_content(),e01['quote'],'exact excerpt text')
        geo=p.locator('#sr-quote').evaluate(SCALE);self.assertEqual(geo['size'],'16px');self.assertEqual(geo['scaled'],[]);self.assertLessEqual(geo['overflowX'],0)
        expect(p.locator('.sr-hashes')).to_contain_text(e01['quoteSha256']);expect(p.locator('.sr-hashes')).to_contain_text(e01['lineSha256'])
        expect(p.locator('.sr-hashes')).to_contain_text('원본을 읽지 않아 확인하지 않았어요');expect(p.locator('.sr-reader-tags')).to_contain_text('사용자 지시')
        self.no_apply();self.shot('2-source')
        p.locator('#sr-back').click();expect(p.locator('#sr-read-E01')).to_be_focused();expect(p.locator('#sr-main-title')).to_contain_text('C1')

        p.locator('#sr-exclude').click();self.assertEqual(self.items(),['C2','C3']);self.assertEqual(self.excluded(),1)
        expect(p.locator('#sr-main-title')).to_contain_text('C1');expect(p.locator('.sr-reader-tags')).to_contain_text('제외됨')
        p.locator('#sr-notice .sr-undo').click();self.assertEqual(self.items(),['C1','C2','C3']);self.assertEqual(self.excluded(),0)
        p.locator('.sr-item[data-item="C2"]').click();p.locator('#sr-exclude').click();self.assertEqual(self.excluded(),1)
        p.locator('.sr-excluded-item .sr-restore').click();self.assertEqual(self.items(),['C1','C2','C3']);self.assertEqual(self.excluded(),0)

        p.locator('.sr-item[data-item="C3"]').click();expect(p.locator('#sr-main-title')).to_be_focused()
        p.locator('#sr-recheck').click();expect(p.locator('.sr-item[data-item="C3"]')).to_contain_text('다시 검토')
        p.locator('#sr-split-open').click();expect(p.locator('#sr-split-go')).to_be_disabled()
        p.locator('#sr-split input[value="E07"]').check();p.locator('#sr-split-go').click()
        self.assertEqual(self.items(),['C1','C2','C3:E06+E08','C3:E07']);expect(p.locator('#sr-main-title')).to_contain_text('C3 · 묶음 2/2')
        expect(p.locator('.sr-item[data-item="C3:E07"]')).not_to_contain_text('다시 검토')
        expect(p.locator('.sr-part-note')).to_contain_text('이 묶음(E07)만의 사실로 옮기지 않아요')
        self.assertEqual(p.locator('.sr-reader > .sr-reading').count(),0,'a part shows no interpretation of its own')
        expect(p.locator('.sr-parent')).not_to_have_attribute('open','');expect(p.locator('.sr-missing')).to_contain_text('E07에서 잘린 명시적 수정 명령·경로 상세')
        expect(p.locator('.sr-excerpt[data-ref="E07"]')).to_contain_text('발췌 잘림');expect(p.locator('.sr-excerpt[data-ref="E07"]')).to_contain_text('배정 예고')
        self.no_apply();self.shot('3-split')
        p.locator('#sr-read-E07').click();expect(p.locator('.sr-source-reader .sr-warn')).to_contain_text('잘린 내용을 추측해 채우지 않았어요')
        expect(p.locator('.sr-uses')).to_contain_text('C3 · 묶음 2/2');p.locator('#sr-back-bottom').click();expect(p.locator('#sr-read-E07')).to_be_focused()

        p.keyboard.press('Escape');expect(p.locator('#source-review')).to_be_hidden()
        expect(p.locator('#proposal-review-open')).to_be_focused();self.assertEqual(p.evaluate('scrollY'),home_y,'the home stays where it was')
        expect(p.locator('html')).not_to_have_class(re.compile('source-review-open')) # the dialog's close event is queued
        self.assertEqual(self.stores(),before,'local and session storage byte-identical after the whole review')
        self.open_review();self.assertEqual(self.items(),['C1','C2','C3:E06+E08','C3:E07'],'closing keeps the tab-memory review')
        p.locator('#sr-close').click();expect(p.locator('#proposal-review-open')).to_be_focused();self.assertEqual(self.stores(),before)

        self.card('동네 미용실 예약').locator('.project-open').click();expect(p.locator('#space-map')).to_be_visible()
        self.assertEqual(self.plane(),camera,'the real project reopens at its own map view')
        p.locator('#nav-projects').click();expect(p.locator('#projects-view')).to_be_visible()
        self.card('포트폴리오 사이트').locator('.project-open').click();expect(p.locator('#draft')).to_have_value('아직 보내지 않은 첫 요청 초안')
        orig=next(e for e in json.loads(before['local']['agentflow.idea015.workspace'])['entries'] if e['project']['name']=='포트폴리오 사이트')['project']
        s=self.state();self.assertEqual([s['draft'],s['revision'],len(s['tasks'])],[orig['draft'],orig['revision'],len(orig['tasks'])])

    def test_02_import_accept_refuse_and_reimport_without_duplicates(self):
        p=self.page;self.install();before=self.stores();self.open_review();sample=self.example()
        shuffled=copy.deepcopy(sample);shuffled['proposals'].reverse();shuffled['excerpts'].reverse()
        for q in shuffled['proposals']:q['refs'].reverse()
        self.upload(sample);expect(p.locator('#sr-notice')).to_contain_text('가져온 파일을 열었어요');self.assertEqual(self.items(),['C1','C2','C3'])
        p.locator('.sr-item[data-item="C2"]').click();p.locator('#sr-exclude').click()
        p.locator('.sr-item[data-item="C3"]').click();p.locator('#sr-split-open').click();p.locator('#sr-split input[value="E06"]').check();p.locator('#sr-split-go').click()
        kept=self.items();self.assertEqual(kept,['C1','C3:E07+E08','C3:E06'])
        self.upload(shuffled,'same-reordered.json');expect(p.locator('#sr-notice')).to_contain_text('새로 만들지 않고')
        self.assertEqual(self.items(),kept);self.assertEqual(self.excluded(),1);expect(p.locator('#sr-sample')).to_have_count(0)
        p.locator('#sr-example').click();expect(p.locator('#sr-notice')).to_contain_text('새로 만들지 않고');self.assertEqual(self.items(),kept)

        def refused(value,text,name='bad.json'):
            self.upload(value,name);expect(p.locator('#sr-error')).to_contain_text(text);expect(p.locator('#sr-error')).to_contain_text('지금 검토는 바뀌지 않았어요')
            expect(p.locator('#sr-error')).to_be_focused();self.assertEqual(self.items(),kept);self.assertEqual(self.excluded(),1)
        bad=copy.deepcopy(sample);bad['proposals'][0]['refs']=['E01','E99'];refused(bad,'E99')
        bad=copy.deepcopy(sample);bad['proposals'][2]['refs']=['E06','E07','E06'];refused(bad,'중복')
        bad=copy.deepcopy(sample);bad['excerpts'][1]['ref']='E01';refused(bad,'두 번')
        refused(b'{"x":"'+b'a'*(70*1024)+b'"}','KiB를 넘어요','big.json')
        refused(b'\xef\xbb\xbf'+json.dumps(sample).encode(),'BOM')
        refused({'schemaVersion':'idea015.project.7','entries':[]},'schemaVersion')
        bad=copy.deepcopy(sample);bad['proposals'].append({**bad['proposals'][0],'id':'C4'});refused(bad,'3개까지')
        tampered=copy.deepcopy(sample);tampered['excerpts'][2]['quote']=tampered['excerpts'][2]['quote'].replace('시켜','시킴')
        refused(tampered,'E03의 문자열이 기록된 quoteSha256과 맞지 않아요')
        self.assertEqual(self.stores(),before,'refusals wrote nothing')

        changed=copy.deepcopy(sample);changed['proposals'][2]['observed']+=' (다른 해석)'
        self.upload(changed,'changed.json');expect(p.locator('#sr-notice')).to_contain_text('이전 제외·분리 표시를 이어받지 않았어요')
        expect(p.locator('#sr-error')).to_be_hidden();self.assertEqual(self.items(),['C1','C2','C3']);self.assertEqual(self.excluded(),0)
        expect(p.locator('#sr-sample option')).to_have_count(2)
        raw=copy.deepcopy(sample);raw['source']['rawSha256']='0'*64
        self.upload(raw,'raw.json');expect(p.locator('#sr-sample option')).to_have_count(3)
        expect(p.locator('.sr-source .sr-facts')).to_contain_text('SHA-256 000000000000…');expect(p.locator('.sr-source .sr-facts')).to_contain_text('확인하지 않았어요')
        self.no_apply()
        fourth=copy.deepcopy(sample);fourth['source']['rawSha256']='1'*64
        self.upload(fourth,'fourth.json');expect(p.locator('#sr-error')).to_contain_text('3개까지');expect(p.locator('#sr-sample option')).to_have_count(3)
        p.locator('#sr-sample').select_option('0');self.assertEqual(self.items(),kept,'the first review still has its marks')
        p.locator('#sr-close').click();self.assertEqual(self.stores(),before)

    def test_03_html_as_text_long_unbroken_source_small_window_and_keyboard_return(self):
        p=self.page;self.install();before=self.stores();sample=self.example()
        long='<b>굵게</b><script>document.title="X"</script>'+'W'*6000+'끝'
        v=copy.deepcopy(sample);v['proposals'][0]['label']='<img src=x onerror="document.title=\'XSS\'"> 표시';v['excerpts'][0]['quote']=long;v['excerpts'][0]['quoteSha256']=sha(long)
        for w,h in [(self.WIDTH,self.HEIGHT),(900,560),(760,520)]:
            p.set_viewport_size({'width':w,'height':h})
            if not p.locator('#source-review').is_visible():
                p.locator('#proposal-review-open').focus();p.keyboard.press('Enter');expect(p.locator('#source-review')).to_be_visible()
                if not self.items():self.upload(v,'html.json');expect(p.locator('#sr-notice')).to_be_visible()
            with self.subTest(size=f'{w}x{h}'):
                expect(p.locator('.sr-item[data-item="C1"] .sr-item-label')).to_have_text('<img src=x onerror="document.title=\'XSS\'"> 표시')
                self.assertEqual(p.locator('#source-review img,#source-review script,#source-review b').count(),0,'file text is never markup')
                self.assertTrue(self.in_view('#sr-close'),'close stays in view');self.assertLessEqual(p.evaluate('document.documentElement.scrollWidth'),w)
                p.locator('.sr-item[data-item="C1"]').click();p.locator('#sr-read-E01').click()
                self.assertEqual(p.locator('#sr-quote').text_content(),long);geo=p.locator('#sr-quote').evaluate(SCALE)
                self.assertEqual(geo['size'],'16px');self.assertLessEqual(geo['overflowX'],0,'long unbroken text wraps')
                p.locator('#sr-back-bottom').scroll_into_view_if_needed();self.assertTrue(self.in_view('#sr-back-bottom'),'the end of the text and its controls are reachable')
                end=p.locator('#sr-quote').evaluate('(e)=>{const r=document.createRange();r.setStart(e.firstChild,e.firstChild.length-1);r.setEnd(e.firstChild,e.firstChild.length);const b=r.getBoundingClientRect();return b.bottom<=innerHeight&&b.top>=0}')
                self.assertTrue(end,'the last character can be scrolled into view')
                p.locator('#sr-back-bottom').click();expect(p.locator('#sr-read-E01')).to_be_focused()
                p.locator('#sr-exclude').scroll_into_view_if_needed();self.assertTrue(self.in_view('#sr-exclude'),'actions reachable')
                if w==900:self.shot('4-small')
                self.assertNotEqual(p.evaluate('document.title'),'XSS');self.assertNotEqual(p.evaluate('document.title'),'X')
            p.keyboard.press('Escape');expect(p.locator('#source-review')).to_be_hidden();expect(p.locator('#proposal-review-open')).to_be_focused()
        self.assertEqual(self.stores(),before)
        p.reload();expect(p.locator('#projects-view')).to_be_visible();self.open_review();self.assertEqual(self.items(),[],'a reload clears the tab-memory review')
        p.locator('#sr-close').click();self.assertEqual(self.stores(),before)

class Source40Wide(Source40):
    WIDTH,HEIGHT=1440,900

if __name__=='__main__':unittest.main(verbosity=2)
