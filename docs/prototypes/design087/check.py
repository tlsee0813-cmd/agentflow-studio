"""DESIGN087 click check: core paths in each variant, console errors, narrow width. Not a usability test."""
import json,sys,pathlib
from playwright.sync_api import sync_playwright,expect
HERE=pathlib.Path(__file__).resolve().parent;URL=(HERE/'index.html').as_uri()
OUT=pathlib.Path(sys.argv[1]) if len(sys.argv)>1 else None
log=[];errors=[]
def ok(name):log.append(f'PASS {name}');print('PASS',name)
def open_area(page,v,area):
    sel={'A':f'.node[data-area="{area}"]','B':f'.card[data-area="{area}"]','C':f'.pill[data-area="{area}"]'}[v]
    page.locator(sel).click();expect(page.locator('#detail-title')).to_contain_text({'booking':'예약','cancel':'취소'}[area])
with sync_playwright() as p:
    b=p.chromium.launch(executable_path='/opt/pw-browsers/chromium')
    for width in (1280,375):
        ctx=b.new_context(viewport={'width':width,'height':900});page=ctx.new_page();page.set_default_timeout(4000)
        page.on('console',lambda m:errors.append(f'{width} console.{m.type}: {m.text}') if m.type in('error','warning') else None)
        page.on('pageerror',lambda e:errors.append(f'{width} pageerror: {e}'))
        for v in 'ABC':
            page.goto('about:blank');page.goto(URL+f'#v={v}');expect(page.locator('h1')).to_contain_text('가상 비교자료')  # fresh state per variant
            # Booking: stale API instruction -> confirm change -> draft for that task only
            open_area(page,v,'booking');page.locator('#tab-work').click()
            stale=page.locator('.warnbox',has_text='옛 결정 기준으로 보낸 지시예요');expect(stale).to_have_count(1)
            expect(page.locator('[data-act="draft"]')).to_be_disabled()
            page.locator('[data-act="to-change"]').click();expect(page.locator('#tab-change')).to_have_attribute('aria-selected','true')
            page.locator('[data-act="confirm"]').click();page.locator('[data-act="draft-from-change"]').click()
            expect(page.locator('#tab-work')).to_have_attribute('aria-selected','true')
            draft=page.locator('pre.draft');expect(draft).to_contain_text('전송하지 않음');expect(draft).to_contain_text('API 담당 · Codex 세션 1')
            assert '화면 담당' not in draft.inner_text(),'draft is for the API task only'
            ok(f'{width} {v} booking: stale API instruction -> change confirmed -> draft for that task only')
            # Selection kept across variants
            nxt={'A':'B','B':'C','C':'A'}[v];page.locator(f'#variants [data-v="{nxt}"]').click()
            expect(page.locator('#detail-title')).to_contain_text('예약');expect(page.locator('#tab-work')).to_have_attribute('aria-selected','true')
            page.go_back();expect(page.locator(f'#variants [data-v="{v}"]')).to_have_attribute('aria-pressed','true')
            ok(f'{width} {v} selection kept when switching to {nxt}; Back returns to {v}')
            # Cancel: latest request stays current; the late older report is a related result with a comparison
            page.locator('#back').click();expect(page.locator('#detail-title')).to_have_count(0)
            open_area(page,v,'cancel');page.locator('#tab-need').click()
            expect(page.locator('.item',has_text='취소 버튼 문구만')).to_contain_text('현재 요청')
            page.locator('#tab-result').click();late=page.locator('.item',has_text='전체 문구와 배치를 고쳤다는 보고')
            expect(late).to_contain_text('이전 요청에 대한 보고 · 최신 요청보다 늦게 도착');expect(late).to_contain_text('직접 확인 안 함')
            late.locator('[data-act="compare"]').click();expect(page.locator('table.cmp')).to_contain_text('버튼 문구만')
            ok(f'{width} {v} cancel: latest request kept, late report compared as related result')
            # Keyboard tabs (APG) and browser Back to overview
            page.locator('#tab-result').focus();page.keyboard.press('ArrowRight');expect(page.locator('#tab-change')).to_be_focused()
            page.keyboard.press('Home');expect(page.locator('#tab-need')).to_be_focused()
            page.keyboard.press('Escape');expect(page.locator('#detail-title')).to_have_count(0)
            ok(f'{width} {v} keyboard: arrows/Home move tabs, Escape returns to overview')
            page.goto(URL+f'#v={v}&l=1');page.locator('.list [data-area="booking"]').click();expect(page.locator('#detail-title')).to_contain_text('예약')
            ok(f'{width} {v} list alternative opens the same detail')
            sw=page.evaluate('()=>document.documentElement.scrollWidth-innerWidth')
            assert sw<=0,f'horizontal page scroll {sw}px';ok(f'{width} {v} no horizontal page scroll')
            if OUT:
                page.goto(URL+f'#v={v}&a=booking&t=work');page.screenshot(path=str(OUT/f'{v}-{width}.png'),full_page=True)
        # No ID-like strings on normal screens
        for v in 'ABC':
            page.goto(URL+f'#v={v}&a=booking&t=work');txt=page.locator('body').inner_text()
            import re;assert not re.search(r'\b(t\d|r\d|d\d|res\d|s\d)\b',txt),'internal ids shown'
        ok(f'{width} no internal ids in visible text')
        ctx.close()
    # P1: first screen of A fits common desktop viewports; relation info comes from the same FLOWS in A/B/C
    for vw,vh in ((1280,720),(1265,712)):
        ctx=b.new_context(viewport={'width':vw,'height':vh});page=ctx.new_page();page.set_default_timeout(4000)
        page.on('pageerror',lambda e:errors.append(f'{vw} pageerror: {e}'))
        page.goto(URL+'#v=A');rects=[page.locator(f'.node[data-area="{a}"]').bounding_box() for a in ('member','booking','cancel','notify')]
        assert all(r['y']+r['height']<=vh and r['x']+r['width']<=vw for r in rects),f'a node is cut off at {vw}x{vh}: {rects}'
        for i in range(4):
            for j in range(i+1,4):
                p,q=rects[i],rects[j];assert p['x']+p['width']<=q['x'] or q['x']+q['width']<=p['x'] or p['y']+p['height']<=q['y'] or q['y']+q['height']<=p['y'],'nodes overlap'
        ok(f'{vw}x{vh} A first screen shows all four areas, not overlapping')
        if OUT:page.screenshot(path=str(OUT/f'A-overview-{vw}x{vh}.png'))
        page.locator('.node[data-area="booking"]').click();page.mouse.wheel(0,1500);page.wait_for_timeout(100)
        r=page.locator('.node[data-area="booking"]').bounding_box();assert 0<=r['y'] and r['y']+r['height']<=vh,'map scrolled away while reading detail'
        ok(f'{vw}x{vh} A map stays in view while the detail scrolls')
        if OUT:page.screenshot(path=str(OUT/f'A-selected-scrolled-{vw}x{vh}.png'))
        page.goto('about:blank');page.goto(URL+'#v=C');flows=page.locator('.ov .flows')
        for label in ('회원 → 예약 · 로그인 (이제 선택)','예약 → 취소 · 예약 후 취소','예약 → 알림 · 예약 알림','취소 → 알림 · 취소 알림'):expect(flows).to_contain_text(label)
        assert '→' not in page.locator('.ov').inner_text().split('회원 → 예약')[0],'no unlabeled arrows before the flow list'
        ok(f'{vw}x{vh} C overview lists the four links with labels; login path marked optional')
        page.goto(URL+'#v=B');expect(page.locator('.card[data-area="booking"] .cn')).to_have_text('연결: ← 회원 (선택) · → 취소 · → 알림')
        ok(f'{vw}x{vh} B cards show each area\'s links')
        for v in 'ABC':
            page.goto('about:blank');page.goto(URL+f'#v={v}&a=booking&t=need');expect(page.locator('#panel')).to_contain_text('다른 영역과의 연결')
            expect(page.locator('#panel')).to_contain_text('회원 · 로그인 (이제 선택)');page.locator('.flow-link[data-area="cancel"]').click();expect(page.locator('#detail-title')).to_contain_text('취소')
        ok(f'{vw}x{vh} detail lists the same links in A/B/C and opens the linked area')
        ctx.close()
    b.close()
print('ERRORS',errors);sys.exit(1 if errors else 0)
