"""Independent SOURCE40 counterexamples. Native HTTP, normal recovery and file choosers; storage reads only.
Uses the repository's lifecycle harness, but all journeys/assertions below are independently written.
"""
import sys,os,json,copy,hashlib,subprocess,unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
APP=HERE.parent/'product-handoff-20261024/app'
sys.path.insert(0,str(APP/'continuity/tests'))
import browser as base
from playwright.sync_api import expect
subprocess.run(['node',str(APP/'continuity/tests/home15-fixtures.mjs'),str(base.OUT)],check=True)
STORES='()=>({local:Object.fromEntries(Object.keys(localStorage).sort().map(k=>[k,localStorage.getItem(k)])),session:Object.fromEntries(Object.keys(sessionStorage).sort().map(k=>[k,sessionStorage.getItem(k)]))})'
def sha(s):return hashlib.sha256(s.encode('utf-8')).hexdigest()
GEOMETRY=[]
COPY=[]
class Independent(unittest.TestCase):
 start_at_home=True
 setUpClass=classmethod(base.Browser.setUpClass.__func__)
 tearDownClass=classmethod(base.Browser.tearDownClass.__func__)
 setUp=base.Browser.setUp
 tearDown=base.Browser.tearDown
 state=base.Browser.state
 import_file=base.Browser.import_file
 def upload(self,value):
  self.page.set_input_files('#sr-file',{'name':'independent.json','mimeType':'application/json','buffer':json.dumps(value,ensure_ascii=False).encode()})
 def items(self):return self.page.locator('#sr-side .sr-item').evaluate_all('xs=>xs.map(x=>x.dataset.item)')
 def stores(self):base.saved(self.page);return self.page.evaluate(STORES)
 def open_review(self):
  self.page.locator('#proposal-review-open').focus();self.page.keyboard.press('Enter');expect(self.page.locator('#source-review')).to_be_visible()
 def test_five_counterexamples_both_pcs(self):
  p=self.page
  sample=p.evaluate("async()=>(await import('./shared/source-proposals-example.js')).PROPOSAL_EXAMPLE")
  self.open_review();p.locator('#sr-example').click();expect(p.locator('#sr-notice')).to_contain_text('검토 예제를 열었어요')
  COPY.append({'exampleNotice':p.locator('#sr-notice').inner_text()})
  p.locator('#sr-read-E01').click();expect(p.locator('#sr-back')).to_have_text('← C1 제안으로 돌아가기')
  COPY.append({'sourceReturn':p.locator('#sr-back').inner_text()})
  p.locator('#sr-close').click();p.reload();expect(p.locator('#projects-view')).to_be_visible()
  source=json.loads((base.OUT/'home15-six.json').read_text('utf-8'))['entries'][0]['project']
  recovery=base.OUT/'normal-recovery.json';recovery.write_text(json.dumps(source,ensure_ascii=False),encoding='utf-8')
  p.locator('#new-project').click();self.import_file(recovery)
  expect(p.locator('#space-map')).to_be_visible()
  p.locator('#map-zoom-in').click();p.locator('#map-zoom-in').click()
  camera=p.locator('#space-plane').get_attribute('style')
  p.locator('#nav-projects').click();expect(p.locator('#projects-view')).to_be_visible()
  before=self.stores()
  for width,height in [(1280,720),(1440,900)]:
   with self.subTest(viewport=f'{width}x{height}'):
    p.set_viewport_size({'width':width,'height':height});self.open_review()
    # 1: same input despite array/key order; C3 partitions no causal or success promotion.
    self.upload(sample);expect(p.locator('#sr-notice')).to_contain_text('가져온 파일을 열었어요')
    self.assertEqual(self.items(),['C1','C2','C3'])
    p.locator('.sr-item[data-item="C2"]').click();p.locator('#sr-exclude').click()
    p.locator('.sr-item[data-item="C3"]').click();p.locator('#sr-recheck').click();p.locator('#sr-split-open').click()
    p.locator('#sr-split input[value="E07"]').check();p.locator('#sr-split-go').click()
    expect(p.locator('#sr-notice')).to_contain_text('C3에서 E07을(를) 별도 묶음으로 나눴어요')
    COPY.append({'width':width,'splitNotice':p.locator('#sr-notice').inner_text()})
    expect(p.locator('.sr-part-note')).to_contain_text('이 묶음(E07)만의 사실로 옮기지 않아요')
    self.assertEqual(p.locator('.sr-reader>.sr-reading').count(),0)
    expect(p.locator('.sr-parent')).not_to_have_attribute('open','')
    expect(p.locator('.sr-missing')).to_contain_text('경로 상세')
    expect(p.locator('.sr-reader-tags')).to_contain_text('기존 작업·부분과 같다고 보지 않음')
    self.assertEqual(p.locator('.sr-item[data-item="C3:E07"] .purple').count(),0)
    p.locator('#sr-read-E07').click();expect(p.locator('.sr-source-reader .sr-warn')).to_contain_text('잘린 내용을 추측해 채우지 않았어요')
    expect(p.locator('.sr-reader-tags')).to_contain_text('배정 예고')
    p.locator('#sr-back-bottom').click();expect(p.locator('#sr-read-E07')).to_be_focused()
    kept=self.items();shuffled=copy.deepcopy(sample)
    shuffled['excerpts'].reverse();shuffled['proposals'].reverse()
    for q in shuffled['proposals']:q['refs'].reverse();q['missing'].reverse()
    shuffled={k:shuffled[k] for k in reversed(shuffled)}
    self.upload(shuffled);expect(p.locator('#sr-notice')).to_contain_text('새로 만들지 않고')
    self.assertEqual(self.items(),kept);self.assertEqual(p.locator('.sr-excluded-item').count(),1)
    # 2: quote changed + valid hash, same source/id must be a separate clean review.
    changed=copy.deepcopy(sample);changed['excerpts'][6]['quote']+=' 별도의 진술';changed['excerpts'][6]['quoteSha256']=sha(changed['excerpts'][6]['quote'])
    self.upload(changed);expect(p.locator('#sr-notice')).to_contain_text('이전 제외·분리 표시를 이어받지 않았어요')
    self.assertEqual(self.items(),['C1','C2','C3']);expect(p.locator('#sr-sample option')).to_have_count(2)
    self.assertEqual(p.locator('.sr-excluded-item').count(),0)
    # 3: old quote hash fails atomically; fabricated raw/line hashes are shown unverified.
    tampered=copy.deepcopy(changed);tampered['excerpts'][0]['quote']+='!'
    self.upload(tampered);expect(p.locator('#sr-error')).to_contain_text('quoteSha256과 맞지 않아요');expect(p.locator('#sr-error')).to_be_focused()
    self.assertEqual(self.items(),['C1','C2','C3']);expect(p.locator('#sr-sample option')).to_have_count(2)
    for bad in [dict(sample,proposals=[*sample['proposals'],dict(sample['proposals'][0],id='C4')]),dict(sample,source=[sample['source'],sample['source']])]:
     self.upload(bad);expect(p.locator('#sr-error')).to_be_visible();self.assertEqual(self.items(),['C1','C2','C3'])
    # 4: long unbroken HTML-shaped text cannot execute; its last character must be visible at page 100%.
    long='<img src=x onerror="window.__s40xss=1">'+('A'*7600)+'끝'
    html=copy.deepcopy(sample);html['source']['rawSha256']='0'*64;html['excerpts'][0].update(quote=long,quoteSha256=sha(long),lineSha256='f'*64)
    html['proposals'][0]['label']='<svg onload="window.__s40xss=2"> Pro / Opus'
    self.upload(html);expect(p.locator('#sr-sample option')).to_have_count(3)
    expect(p.locator('.sr-source .sr-facts')).to_contain_text('원본을 읽지 않아 확인하지 않았어요')
    p.locator('#sr-read-E01').click();self.assertEqual(p.locator('#sr-quote').text_content(),long)
    self.assertEqual(p.locator('#source-review img,#source-review script,#source-review svg').count(),0)
    self.assertIsNone(p.evaluate('window.__s40xss??null'))
    expect(p.locator('.sr-hashes')).to_contain_text('f'*64+' · 원본을 읽지 않아 확인하지 않았어요')
    p.locator('#sr-back-bottom').scroll_into_view_if_needed()
    geo=p.locator('#sr-quote').evaluate('e=>{const s=getComputedStyle(e),r=document.createRange();r.setStart(e.firstChild,e.firstChild.length-1);r.setEnd(e.firstChild,e.firstChild.length);const b=r.getBoundingClientRect();let scaled=[];for(let a=e;a;a=a.parentElement){const c=getComputedStyle(a);if(c.transform!=="none"||c.zoom!=="1")scaled.push(a.id)}return {font:s.fontSize,overflow:e.scrollWidth-e.clientWidth,last:{top:b.top,bottom:b.bottom},scaled,dpr:devicePixelRatio,viewportScale:visualViewport.scale,close:(()=>{const c=document.querySelector("#sr-close").getBoundingClientRect();return {top:c.top,bottom:c.bottom,right:c.right}})()}}')
    self.assertEqual(geo['font'],'16px');self.assertEqual(geo['scaled'],[]);self.assertEqual(geo['viewportScale'],1)
    self.assertLessEqual(geo['overflow'],0);self.assertGreaterEqual(geo['last']['top'],0);self.assertLessEqual(geo['last']['bottom'],height)
    self.assertLessEqual(geo['close']['bottom'],height);self.assertLessEqual(p.evaluate('document.documentElement.scrollWidth'),width)
    GEOMETRY.append({'width':width,'height':height,'geometry':geo,'rawSourceUnverified':True,'nativeStorageUnchanged':self.stores()==before})
    if width==1280:p.screenshot(path=str(HERE/'independent-1280-source-end.png'))
    p.locator('#sr-back-bottom').click();expect(p.locator('#sr-read-E01')).to_be_focused()
    # 5: keyboard focus trap and close/reopen; original workspace bytes, draft and map memo stay exact.
    p.locator('#sr-close').focus();p.keyboard.press('Tab')
    self.assertTrue(p.evaluate('document.querySelector("#source-review").contains(document.activeElement)'))
    p.keyboard.press('Escape');expect(p.locator('#source-review')).to_be_hidden();expect(p.locator('#proposal-review-open')).to_be_focused()
    self.assertEqual(self.stores(),before)
    self.open_review();self.assertEqual(self.items(),['C1','C2','C3'])
    p.locator('#sr-sample').select_option('0');self.assertEqual(self.items(),kept)
    p.locator('.sr-excluded-item .sr-restore').click();self.assertEqual(p.locator('.sr-excluded-item').count(),0)
    p.locator('.sr-item[data-item="C3:E07"]').click()
    if width==1440:p.screenshot(path=str(HERE/'independent-1440-proposal.png'))
    p.locator('#sr-unsplit').click();self.assertEqual(self.items(),['C1','C2','C3'])
    p.locator('#sr-close').click();self.assertEqual(self.stores(),before)
    # Reload removes reviews; project keys and map memo remain as they were.
    p.reload();expect(p.locator('#projects-view')).to_be_visible();self.open_review();expect(p.locator('.sr-empty')).to_be_visible()
    p.locator('#sr-close').click();self.assertEqual(self.stores(),before)
  p.locator('#project-list .project-open').click();expect(p.locator('#space-map')).to_be_visible()
  self.assertEqual(p.locator('#space-plane').get_attribute('style'),camera)
  self.assertEqual(self.state()['draft'],source['draft']);self.assertEqual(self.state()['currentTaskId'],source['currentTaskId'])
  self.assertEqual(self.state()['tasks'][0]['manual']['next'],source['tasks'][0]['manual']['next'])
  (HERE/'geometry.json').write_text(json.dumps(GEOMETRY,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
  (HERE/'copy-verified.json').write_text(json.dumps(COPY,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

if __name__=='__main__':unittest.main(verbosity=2)
