"""MAP34 read-only boundary measurement of the same scenes on any checkout (e.g. 575bb745 and the candidate).

Not a pass/fail check. The scene projects come from this checkout's map-signals34-fixtures.mjs (public domain APIs, built
dist required); the app under measurement is served from APP_DIR. Two later results arrive through the normal chooser.
Per card element it reports, in card layout px: the line box against the nearest clipping box and the card, and for
single-line text the glyph ink (canvas actualBoundingBox on the element's own font) against the same clip.
Run from app/: python continuity/tests/map-signals34_measure.py OUT.json [APP_DIR]  (MAP34_SHOTS=DIR also saves the 1280 P card)
"""
import json, os, re, subprocess, sys
from pathlib import Path
from playwright.sync_api import sync_playwright, expect
sys.path.insert(0,str(Path(__file__).resolve().parent))
import browser as base

HERE=Path(__file__).resolve().parents[2]
OUT=Path(sys.argv[1]);TARGET=Path(sys.argv[2]).resolve() if len(sys.argv)>2 else HERE
SEED="import {map34Fixture} from './continuity/tests/map-signals34-fixtures.mjs';console.log(JSON.stringify(map34Fixture(JSON.parse(process.argv[1]))));"
SCENES=[{'current':'P','stale':True,'note':True},{'current':'P','stale':True,'note':False},{'current':'P','stale':False,'note':False},{'current':'B','stale':True,'note':False}]
MEASURE=r'''ids=>{const s=+((document.querySelector('#space-plane').style.transform.match(/scale\(([^)]+)\)/)||[0,1])[1]),ctx=document.createElement('canvas').getContext('2d');
 const out={};for(const [key,id] of Object.entries(ids)){const n=document.querySelector(`.area-node[data-area-id="${id}"]`);if(!n)continue;const c=n.getBoundingClientRect(),y=v=>+((v-c.top)/s).toFixed(1);
  const clipOf=e=>{for(let p=e.parentElement;p&&p!==n.parentElement;p=p.parentElement)if(/hidden|clip/.test(getComputedStyle(p).overflowY)){const q=p.getBoundingClientRect();return [q.top,q.bottom]}return [c.top,c.bottom]};
  const ink=e=>{const t=[...e.childNodes].find(x=>x.nodeType===3&&x.data.trim());if(!t)return null;const r=document.createRange();r.selectNodeContents(t);const rs=[...r.getClientRects()].filter(q=>q.height>0);if(rs.length!==1)return null;
   const cs=getComputedStyle(e);ctx.font=`${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;const m=ctx.measureText(t.data),base=rs[0].top+m.fontBoundingBoxAscent*s;
   return {top:base-m.actualBoundingBoxAscent*s,bottom:base+m.actualBoundingBoxDescent*s}};
  const rows=[];for(const e of n.querySelectorAll('.area-card-name,.area-card-path,.area-card-note,.tag,.node-enter>.hint,.node-info,.branch-toggle,.area-update-label,.branch-signals>span')){
   const r=e.getBoundingClientRect(),[ct,cb]=clipOf(e),k=ink(e),lim=Math.min(cb,c.bottom);
   const lineOver=Math.max(0,r.bottom-lim)/s,inkOver=k?Math.max(0,k.bottom-lim)/s:null;
   rows.push({el:e.className||e.tagName,text:e.textContent.replace(/\s+/g,' ').trim().slice(0,40),top:y(r.top),bottom:y(r.bottom),clipBottom:y(lim),
    lineboxHiddenPx:+lineOver.toFixed(1),lineboxFullyHidden:r.top>=lim-.5,inkHiddenPx:inkOver===null?null:+inkOver.toFixed(1),inkTop:k?y(k.top):null,inkBottom:k?y(k.bottom):null,inkFullyHidden:k?k.top>=lim-.5:null,
    ellipsis:getComputedStyle(e).textOverflow==='ellipsis'&&e.scrollWidth>e.clientWidth+1})}
  const sig=n.querySelector('.branch-signals');out[key]={height:n.offsetHeight,signal:sig?sig.textContent.replace(/\s+/g,' ').trim():null,
   hidden:rows.filter(x=>x.lineboxHiddenPx>0||x.inkHiddenPx>0||x.ellipsis)}}
 return {scale:s,cards:out}}'''
with sync_playwright() as pw:
    env={k:os.environ[k] for k in ['PATH','HOME','TEMP','TMP','TMPDIR','SYSTEMROOT','WINDIR'] if k in os.environ};env.update(AI_MODE='mock',ALLOW_PAID_AI='false',DEEPSEEK_API_KEY='',PORT='0')
    proc=subprocess.Popen(['node',str(TARGET/'continuity/server/index.mjs'),'--mock'],env=env,stdout=subprocess.PIPE,text=True)
    url=re.search(r'http://127\.0\.0\.1:\d+',proc.stdout.readline()).group(0)
    kw={'executable_path':os.environ['BROWSER_EXECUTABLE']} if os.environ.get('BROWSER_EXECUTABLE') else {}
    b=pw.chromium.launch(**kw);result={'target':str(TARGET.name),'browser':b.version,'scenes':[]}
    try:
        tmp=OUT.parent/(OUT.stem+'-inputs');tmp.mkdir(parents=True,exist_ok=True)
        for scene in SCENES:
            s=json.loads(subprocess.check_output(['node','--input-type=module','-e',SEED,json.dumps(scene)],cwd=HERE,text=True,encoding='utf-8'))
            fp=tmp/'project.json';fp.write_text(json.dumps(s['p'],ensure_ascii=False),encoding='utf-8')
            for W,H in [(1280,720),(1440,900)]:
                ctx=b.new_context(viewport={'width':W,'height':H},device_scale_factor=2);page=ctx.new_page();page.goto(url);expect(page.locator('#mode')).to_contain_text('MOCK')
                base.reveal_management(page,'#import')
                with page.expect_file_chooser() as ch:page.locator('#import').click()
                page.once('dialog',lambda d:d.accept());ch.value.set_files(str(fp));expect(page.locator('#notice')).to_contain_text('사본으로 불러왔어요');base.saved(page)
                for k in [x for x in ['B','P'] if x!=scene['current']]+[scene['current']]:
                    page.locator('#nav-work').click()
                    for d in ['compose-panel','result-file-panel']:
                        if not page.locator('#'+d).evaluate('e=>e.open'):page.locator('#'+d+' > summary').click()
                    f=tmp/f'late-{k}.json';f.write_text(json.dumps(s['late'][k],ensure_ascii=False),encoding='utf-8')
                    page.locator('#result-file-input').set_input_files(str(f));page.locator('#accept-result-file').click();base.saved(page)
                page.locator('#nav-space').click();page.locator('#map-fit').click()
                for fold in [False,True]:
                    if fold:page.locator('#branch-toggle-'+s['ids']['P']).click();page.locator('#map-fit').click()
                    result['scenes'].append({**scene,'pc':[W,H],'folded':fold,**page.evaluate(MEASURE,s['ids'])})
                    if os.environ.get('MAP34_SHOTS') and W==1280:
                        page.mouse.move(1,1);name=f"{TARGET.parent.name}-{scene['current']}-{'stale' if scene['stale'] else 'nostale'}-{'note' if scene['note'] else 'nonote'}-{'fold' if fold else 'open'}.png"
                        page.locator(f".area-node[data-area-id=\"{s['ids']['P']}\"]").screenshot(path=str(Path(os.environ['MAP34_SHOTS'])/name))
                ctx.close()
    finally:b.close();proc.terminate()
OUT.write_text(json.dumps(result,ensure_ascii=False,indent=1),encoding='utf-8')
