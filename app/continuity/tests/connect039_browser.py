"""CONNECT039 native files/storage/downloads + explicitly named fault injections.
Synthetic inputs; real localhost/mock AI only. No CLI or customer-benefit evidence.
Run after continuity build: python continuity/tests/connect039_browser.py
"""
from pathlib import Path
import json, subprocess, unittest
from playwright.sync_api import expect
import browser as base
OUT=base.OUT
class ResultFiles(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        base.Browser.setUpClass.__func__(cls)
        cls.materials=OUT/'synthetic';cls.materials.mkdir(exist_ok=True)
        subprocess.run(['node',str(base.ROOT/'tests/connect039-fixtures.mjs'),str(cls.materials)],check=True)
        cls.refs=json.loads((cls.materials/'refs.json').read_text())
    tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
    setUp=base.Browser.setUp;tearDown=base.Browser.tearDown;state=base.Browser.state;compose=base.Browser.compose;send=base.Browser.send;basis=base.Browser.basis;context=base.Browser.context
    def recovery(self,name='before.json'):
        # The same name/project/revision may already be on screen. Wait for this
        # recovery's read/confirmation and render, not a label left by the last one.
        previous=self.page.query_selector('#current-work')
        with self.page.expect_event('dialog') as confirmation:
            self.page.locator('#import-file').set_input_files(str(self.materials/name))
        confirmation.value.accept()
        if previous:self.page.wait_for_function('(node)=>!node.isConnected',arg=previous)
        expect(self.page.locator('#sidebar-project')).to_contain_text('CONNECT039')
    def select(self,name='A-H1.result.json'):
        self.compose();self.page.locator('#result-file-panel').evaluate('(e)=>e.open=true')
        self.page.locator('#result-file-input').set_input_files(str(self.materials/name))
    def make(self,name,**changes):
        f=json.loads((self.materials/'A-H1.result.json').read_text());f.update(changes)
        (self.materials/name).write_text(json.dumps(f,ensure_ascii=False,indent=2),encoding='utf-8');return f
    def download(self,button,name):
        with self.page.expect_download() as d:self.page.locator(button).click()
        path=OUT/name;d.value.save_as(path);return path
    def shot(self,name):
        (OUT/'screens').mkdir(exist_ok=True);self.page.mouse.move(1,1)
        self.page.screenshot(path=str(OUT/'screens'/name),full_page=True)
    def test_01_native_exact_export_preview_import_roundtrip_and_next_B(self):
        calls=[];self.page.on('request',lambda r:calls.append(r.post_data_json) if r.method=='POST' and r.url.endswith('/api/continuity') else None)
        self.recovery();before=self.state();self.assertEqual(before['currentTaskId'],self.refs['B'])
        expect(self.page.locator('#copy-work')).to_be_visible()
        self.assertFalse(self.page.locator('#file-return-options').evaluate('(e)=>e.open'))
        self.page.locator('#file-return-options').evaluate('(e)=>e.open=true')
        handoff=self.download('#download-file-work','native-file-handoff.md').read_text(encoding='utf-8')
        exported=self.state();h=exported['tasks'][-1]['handoffs'][-1]
        self.assertIn(h['returnId'],handoff);self.assertIn('agentflow.return.1',handoff)
        ordinary=self.download('#download-work','native-default-handoff.md').read_text(encoding='utf-8');self.assertNotIn('agentflow.return.1',ordinary)
        before=self.state();self.select();expect(self.page.locator('#accept-result-file')).to_be_visible()
        expect(self.page.locator('#result-file-preview')).to_have_attribute('data-return-id',self.refs['H1'])
        expect(self.page.locator('#result-file-preview')).to_contain_text('이전 내보내기')
        self.page.locator('#file-return-bases').evaluate('(e)=>e.open=true')
        expect(self.page.locator('#file-return-bases')).to_contain_text('보존할 새 값')
        self.page.locator('#file-return-work').evaluate('(e)=>e.open=true')
        expect(self.page.locator('#file-return-work')).to_contain_text('A 직접 쓴 범위')
        self.assertEqual(self.state(),before);self.shot('01-exact-A-H1-preview.png')
        self.page.set_viewport_size({'width':390,'height':844});self.shot('02-mobile-preview.png')
        self.assertLessEqual(self.page.evaluate('document.documentElement.scrollWidth'),390)
        self.page.set_viewport_size({'width':1440,'height':1050})
        self.page.locator('#accept-result-file').click();expect(self.page.locator('#result-file-message')).to_contain_text('앱 미검증')
        after=self.state();self.assertEqual(after['tasks'][-1]['parentTaskId'],self.refs['A']);self.assertEqual(len(after['sources']),len(before['sources'])+2)
        for k in ['draft','answerDraft','basisDraft','basisEdits','bases']:self.assertEqual(after[k],before[k])
        self.assertEqual(after['tasks'][:-1],before['tasks']);self.assertEqual(after['sources'][:-2],before['sources']);self.assertEqual(calls,[])
        original=(self.materials/'A-H1.result.json').read_text();self.assertEqual(after['tasks'][-1]['resultFile']['rawText'],original)
        self.page.locator('#current-result-raw').evaluate('(e)=>{for(let x=e;x;x=x.parentElement)if(x.tagName==="DETAILS")x.open=true}')
        self.assertEqual(self.download('#current-result-raw button','native-raw-return.json').read_text(),original)
        backup=self.download('#backup','native-recovery.json');self.assertEqual(json.loads(backup.read_text()),after)
        self.shot('03-result-retained.png');self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');self.assertEqual(self.state(),after);self.assertEqual(calls,[])
        self.page.once('dialog',lambda d:d.accept());self.page.locator('#import-file').set_input_files(str(backup));expect(self.page.locator('#current-result-raw')).to_have_count(1)
        self.assertEqual(self.state()['tasks'],after['tasks'])
        self.select();self.page.locator('#accept-result-file').click();self.assertEqual(self.state()['tasks'],after['tasks'])
        self.make('partial.json',report='합성 A 부분 추가: 실기기 미확인',evidence=None);self.select('partial.json');self.page.locator('#accept-result-file').click();self.assertEqual(len(self.state()['tasks']),len(after['tasks'])+1)
        self.make('B.result.json',taskId=self.refs['B'],returnId=self.refs['HB'],report='합성 B 전용 보고',evidence=None)
        self.select('B.result.json');self.page.locator('#accept-result-file').click();self.assertEqual(len(calls),0)
        self.send('B 검색 입력의 다음 문구 변경');self.assertEqual(len(calls),1)
        text=self.download('#download-work','native-B-next-handoff.md').read_text()
        for value in [json.dumps(calls[-1],ensure_ascii=False),text]:
            self.assertIn('합성 B 전용 보고',value);self.assertNotIn('합성 A 보고',value);self.assertNotIn('합성 A 부분 추가',value);self.assertNotIn('rawText',value)
        self.download('#backup','native-final-recovery.json')
        (OUT/'native-next-request.json').write_text(json.dumps(calls[-1],ensure_ascii=False,indent=2),encoding='utf-8')
    def test_02_native_invalid_atomic_and_v1_v2_originals(self):
        self.recovery();before=self.state()
        for name,changes in [('wrong.json',{'returnId':'H_missing'}),('over.json',{'report':'x'*11001}),('extra.json',{'extra':True})]:
            self.make(name,**changes);self.select(name);expect(self.page.locator('#cancel-result-file')).to_be_visible();expect(self.page.locator('#accept-result-file')).to_have_count(0);self.assertEqual(self.state(),before)
        (self.materials/'utf8.json').write_bytes(b'\xff');self.select('utf8.json');expect(self.page.locator('#result-file-message')).to_contain_text('기존 붙여넣기');self.assertEqual(self.state(),before)
        self.select('wrong.json');self.shot('04-unmatched-fallback.png')
        for name,key in [('v1.json','agentflow.idea015.project.v1.legacy-original'),('v2.json','agentflow.idea015.project.v2.legacy-original')]:
            # Selected files retain their own originals; do not allocate a browser backup slot.
            self.recovery(name);raw=(self.materials/name).read_text();self.assertIsNone(self.page.evaluate('(k)=>localStorage.getItem(k)',key))
            p=self.state();self.assertEqual(p['schemaVersion'],'idea015.project.3');self.assertTrue(all(h['returnId'] is None for t in p['tasks'] for h in t['handoffs']))
            self.compose();self.page.locator('#draft').fill('복구 후 계속 작성');expect(self.page.locator('#storage-error')).to_be_hidden()
            self.page.reload();expect(self.page.locator('#mode')).to_contain_text('MOCK');self.assertIsNone(self.page.evaluate('(k)=>localStorage.getItem(k)',key))
            self.assertEqual(self.state()['draft'],'복구 후 계속 작성');self.assertEqual(self.state()['sources'],p['sources']);self.assertEqual(self.state()['tasks'],p['tasks'])
            self.assertEqual((self.materials/name).read_text(),raw)
    def test_03_injected_read_generations_and_clipboard_import_boundary(self):
        self.recovery();before=self.state()
        self.page.evaluate('''()=>{const original=File.prototype.arrayBuffer;window.releaseReads=[];File.prototype.arrayBuffer=function(){return new Promise(resolve=>window.releaseReads.push(()=>original.call(this).then(resolve)))}}''')
        self.select();self.make('second.json',report='두 번째 파일');self.select('second.json')
        self.page.evaluate('window.releaseReads[1]()');expect(self.page.locator('#result-file-preview')).to_contain_text('두 번째 파일')
        self.page.evaluate('window.releaseReads[0]()');expect(self.page.locator('#result-file-preview')).to_contain_text('두 번째 파일');self.assertEqual(self.state(),before)
        self.select();self.recovery();self.page.evaluate('window.releaseReads[2]()');expect(self.page.locator('#accept-result-file')).to_have_count(0)
        # Same project/revision imported during clipboard await must still invalidate the export.
        self.page.evaluate('Object.defineProperty(navigator,"clipboard",{value:{writeText:()=>new Promise(r=>window.finishCopy=r)},configurable:true})')
        self.page.locator('#file-return-options').evaluate('(e)=>e.open=true');self.page.locator('#copy-file-work').click();self.recovery();current=self.state()
        self.page.evaluate('window.finishCopy()');expect(self.page.locator('#notice')).to_contain_text('기록으로 표시하지 않았습니다');self.assertEqual(self.state(),current)
        # Recovery read must not overwrite a draft edited during that read.
        self.page.evaluate('''()=>{const original=File.prototype.text;File.prototype.text=function(){return new Promise(resolve=>window.finishRecovery=()=>original.call(this).then(resolve))}}''')
        self.page.locator('#import-file').set_input_files(str(self.materials/'before.json'));self.compose();self.page.locator('#draft').fill('읽는 중 새 초안')
        self.page.evaluate('window.finishRecovery()');expect(self.page.locator('#notice')).to_contain_text('교체하지 않았습니다');self.assertEqual(self.state()['draft'],'읽는 중 새 초안')
    def test_04_injected_quota_and_native_other_tab_conflict(self):
        self.recovery();before=self.state();self.select()
        self.page.evaluate('()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(){throw new DOMException("Quota","QuotaExceededError")}}')
        self.page.locator('#accept-result-file').click();expect(self.page.locator('#result-file-message')).to_contain_text('이 탭에만');expect(self.page.locator('#storage-error')).to_be_visible();self.assertEqual(self.state(),before)
        backup=self.download('#backup','quota-memory-recovery.json');self.assertEqual(json.loads(backup.read_text())['tasks'][-1]['resultFile']['rawText'],(self.materials/'A-H1.result.json').read_text())
        self.shot('05-storage-failure.png');self.page.evaluate('()=>{Storage.prototype.setItem=window.realSet}')
        self.recovery();other=self.ctx.new_page();other.goto(self.url);expect(other.locator('#mode')).to_contain_text('MOCK')
        # FLOW083: each recovery is its own copy; the second tab opens the same project this tab has open.
        base.open_listed(other,self.page.evaluate('document.documentElement.dataset.projectKey'))
        self.compose(other);other.locator('#draft').fill('다른 탭에서 보존할 입력');persisted=self.state(other)
        self.select();self.page.locator('#accept-result-file').click();expect(self.page.locator('#result-file-message')).to_contain_text('이 탭에만');self.assertEqual(self.state(),persisted);other.close()
    def test_05_injected_backup_failure_and_late_AI(self):
        self.recovery()
        # Protect the old value actually in the browser, not a duplicate of the selected file.
        raw=(self.materials/'v2.json').read_text();self.page.evaluate('(raw)=>localStorage.setItem("agentflow.idea015.project.v1",raw)',raw);before=json.loads(raw)
        self.page.evaluate('''()=>{window.realSet=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k.endsWith('legacy-original'))throw new Error('backup denied');return window.realSet.call(this,k,v)}}''')
        # FLOW083: a recovery is now a separate copy, so it never overwrites (or needs to back up) the browser's value.
        self.recovery('v2.json');self.assertEqual(self.page.evaluate('(k)=>localStorage.getItem(k)',base.KEY),raw)
        # Opening that older value still must not convert it without first keeping its original bytes.
        self.page.locator('#nav-projects').click();base.open_listed(self.page,base.KEY)
        expect(self.page.locator('#notice')).to_contain_text('원본을 따로 보관하지 못해');self.assertEqual(self.state(),before)
        self.compose();self.page.locator('#draft').fill('이관 실패 중 초안');self.assertEqual(self.state(),before)
        expect(self.page.locator('#storage-error')).to_contain_text('원본을 브라우저에 따로 보관하지 못해')
        self.page.evaluate('()=>{Storage.prototype.setItem=window.realSet}');self.recovery()
        parked=[]
        def delayed(route):parked.append((route,route.fetch()))
        self.page.route('**/api/continuity',delayed);self.page.locator('#retry-work').click();self.page.wait_for_function('document.querySelector("#working").textContent.length>0')
        self.page.wait_for_timeout(100);self.assertEqual(len(parked),1)
        self.select();self.page.locator('#accept-result-file').click();accepted=self.state();self.assertIsNone(accepted['pending'])
        route,response=parked.pop();route.fulfill(response=response);expect(self.page.locator('#working')).to_have_text('');self.assertEqual(self.state(),accepted)
        self.assertIsNone(self.state()['tasks'][-1]['advice'])
if __name__=='__main__':unittest.main(verbosity=2)
