import json, os, sys, unittest
from pathlib import Path
HERE=Path(__file__).resolve().parent
TESTS=HERE.parent/'product36-independent-20261024/app/continuity/tests'
sys.path.insert(0,str(TESTS))
import importlib.util
spec=importlib.util.spec_from_file_location('map36',TESTS/'map-priority36_browser.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
METRICS=r'''id=>{const card=document.querySelector(`.area-node[data-area-id="${id}"]`),enter=card.querySelector('.node-enter'),note=card.querySelector('.area-card-note'),signal=card.querySelector('.branch-signals');
const rect=e=>{let r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,bottom:r.bottom}},cr=card.getBoundingClientRect(),scale=cr.height/card.offsetHeight;
const er=enter.getBoundingClientRect(),nr=note.getBoundingClientRect(),sr=signal.getBoundingClientRect();
return {scale,card:rect(card),body:rect(enter),note:rect(note),reason:rect(signal),reasonText:signal.textContent.replace(/\s+/g,' ').trim(),noteText:note.textContent,noteLayoutHeight:nr.height/scale,reasonLayoutHeight:sr.height/scale,bodyLayoutHeight:er.height/scale,noteClearance:(er.bottom-nr.bottom)/scale,reasonStyle:{wordBreak:getComputedStyle(signal).wordBreak,whiteSpace:getComputedStyle(signal).whiteSpace},font:getComputedStyle(signal).fontFamily};}'''

class Probe(m.MapPriority36):
    def test_independent_scene(self):
        s=self.load('P',True,note=True)
        before=self.state()
        metrics=self.page.evaluate(METRICS,s['ids']['P'])
        self.assertGreaterEqual(metrics['noteClearance'],-.5)
        self.assertEqual(metrics['reasonText'],m.REASONS[True]['P'])
        self.assertLessEqual(metrics['reasonLayoutHeight'],28.5)
        self.assertAlmostEqual(metrics['noteLayoutHeight'],30,places=3)
        self.page.screenshot(path=str(HERE/f'selected-{self.WIDTH}-default.png'))
        for _ in range(2 if self.WIDTH==1280 else 1):self.page.locator('#map-zoom-in').click()
        # Native empty-canvas drag brings the zoomed parent below the fixed map controls.
        canvas=self.page.locator('#space-map').bounding_box()
        px=canvas['x']+canvas['width']-25;py=canvas['y']+130
        self.page.mouse.move(px,py);self.page.mouse.down();self.page.mouse.move(px,py+120,steps=12);self.page.mouse.up()
        zoomed=self.page.evaluate(METRICS,s['ids']['P'])
        self.page.locator(f'.area-node[data-area-id="{s["ids"]["P"]}"]').screenshot(path=str(HERE/f'selected-{self.WIDTH}-parent-zoomed.png'))
        self.assertEqual(self.state(),before)
        (HERE/f'independent-{self.WIDTH}-geometry.json').write_text(json.dumps({'sha':'38beb55922e3e982f0f32fddacd5e18a5e157a15','pc':[self.WIDTH,self.HEIGHT],'default':metrics,'zoomed':zoomed},ensure_ascii=False,indent=2),encoding='utf-8')

class ProbeWide(Probe):WIDTH,HEIGHT=1440,900
if __name__=='__main__':
    result=unittest.TextTestRunner(verbosity=2).run(unittest.TestSuite([Probe('test_independent_scene'),ProbeWide('test_independent_scene')]))
    sys.exit(not result.wasSuccessful())
