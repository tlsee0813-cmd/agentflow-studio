"""Local synthetic prototype checks; no product/CSV integration or human usability test."""
import json
import functools
import http.server
import threading
import os
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

root = Path(__file__).resolve().parents[1]
out = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path('/workspace/work/reuse103/check-output')
out.mkdir(parents=True, exist_ok=True)
checks=[]
def check(name, value):
    if not value:
        raise AssertionError(name)
    checks.append(name)

server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(http.server.SimpleHTTPRequestHandler,directory=str(root)))
threading.Thread(target=server.serve_forever,daemon=True).start()
base=f'http://127.0.0.1:{server.server_port}'

with sync_playwright() as p:
    browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
    version=browser.version
    for width,height in [(1280,900),(390,844)]:
        context=browser.new_context(viewport={'width':width,'height':height})
        page=context.new_page()
        errors=[]
        requests=[]
        page.on('pageerror',lambda e:errors.append(str(e)))
        page.on('request',lambda r:requests.append(r.url))
        page.goto(base+'/prototype/index.html')
        check(f'{width}: mock notice',page.get_by_text('REUSE103 · 검토용 시안 / 가상 데이터').is_visible())
        original=page.locator('.footer-state').inner_text()
        page.locator('#openArea').click()
        check(f'{width}: collapsed by default',page.locator('#inlineNote').is_hidden() and not page.locator('#drawer').evaluate('(el)=>el.open'))
        for variant in ['A','B']:
            page.locator('#variant'+variant).click()
            page.locator('#openNote').click()
            host=page.locator('#inlineNote' if variant=='A' else '#drawerNote')
            for stage in [0,1,2]:
                host.locator(f'[data-stage="{stage}"]').click()
                check(f'{width}/{variant}: stage {stage} selected',host.locator(f'[data-stage="{stage}"]').get_attribute('aria-pressed')=='true')
            check(f'{width}/{variant}: D1 and D2 retained',all(x in host.inner_text() for x in ['D1','D2','실제 관찰 결과가 아닌 설계 예시','통합시험: 미실행']))
            host.get_by_text('외부 작업문에 넣을 참고 내용 보기',exact=True).click()
            check(f'{width}/{variant}: transfer boundary',host.locator('.transfer').is_visible() and '권한을 부여하지 않음' in host.locator('.transfer').inner_text())
            check(f'{width}/{variant}: unique IDs',page.evaluate('new Set([...document.querySelectorAll("[id]")].map(x=>x.id)).size===document.querySelectorAll("[id]").length'))
            check(f'{width}/{variant}: v2 unresolved criteria',all(x in host.inner_text() for x in ['행 수 한도','시간/메모리 기준','예약 업무키 미정']))
            check(f'{width}/{variant}: fixed evidence in transfer',all(x in host.locator('.transfer').inner_text() for x in ['D1 당시 조건','D2','e78dddce4764a3465e86f3a2fddd0a1bcfc854be','f12e6862a41f4324a06a26c87a3e28031d4faa7f']))
            check(f'{width}/{variant}: local execution boundary',host.get_by_text('예시 보기 · 저장·검색·설치·외부 실행 없음',exact=True).is_visible())
            check(f'{width}/{variant}: task and target unchanged',page.locator('.footer-state').inner_text()==original)
            host.locator('h2').scroll_into_view_if_needed()
            page.screenshot(path=str(out/f'{variant.lower()}-{width}.png'),full_page=variant=='A')
            check(f'{width}/{variant}: no document overflow',page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
            if variant=='B':
                for _ in range(15):
                    page.keyboard.press('Tab')
                check(f'{width}/B: focus remains in modal',page.locator('#drawer').evaluate('(el)=>el.contains(document.activeElement)'))
                check(f'{width}/B: dialog no overflow',page.locator('#drawer').evaluate('(el)=>el.scrollWidth<=el.clientWidth'))
            page.keyboard.press('Escape')
            check(f'{width}/{variant}: Escape returns focus',page.locator('#openNote').evaluate('(el)=>el===document.activeElement'))
        page.locator('#variantA').click()
        page.locator('#openNote').click()
        inline=page.locator('#inlineNote')
        inline.locator('[data-stage="1"]').click()
        inline.get_by_text('외부 작업문에 넣을 참고 내용 보기',exact=True).click()
        check(f'{width}: D1 transfer identity','R-01 / D1 · 조건 v1' in inline.locator('.transfer').inner_text())
        page.keyboard.press('Escape')
        page.locator('#scenario').select_option('copy')
        check(f'{width}: skip path',page.locator('#skip').is_visible() and page.locator('#openNote').is_hidden())
        check(f'{width}: skip keeps target',page.locator('.footer-state').inner_text()==original)
        page.locator('#spaceLink').click()
        check(f'{width}: space return',page.locator('#space').is_visible())
        check(f'{width}: no runtime errors',not errors)
        check(f'{width}: no external HTTP requests',not [x for x in requests if x.startswith(('http:','https:')) and not x.startswith(base+'/')])
        check(f'{width}: no storage',page.evaluate('localStorage.length===0 && sessionStorage.length===0'))
        page.goto(base+'/prototype/index.html?variant=B')
        check(f'{width}: B direct URL',page.locator('#variantB').get_attribute('aria-pressed')=='true')
        context.close()
    browser.close()
server.shutdown()
result={'date':'2026-10-15 KST','browser':version,'assertions':len(checks),'passed':checks,'scope':'synthetic prototype only; no CSV integration or human usability'}
(out/'results.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
