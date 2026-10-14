"""DESIGN089: browser behavior checks, not independent usability evaluation.
Requires an already available Playwright Python + Chromium. No app dependencies.
Uses the exact HTML bytes in about:blank via set_content. Does not test file:// loading.
Run: python verify.py [--browser /usr/bin/chromium] [--out /path/to/evidence]
"""
from pathlib import Path
import argparse, hashlib, json, platform, re, time, traceback
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright, expect

ap=argparse.ArgumentParser();ap.add_argument('--browser',default='/usr/bin/chromium');ap.add_argument('--out',default='check-output');args=ap.parse_args()
root=Path(__file__).resolve().parent; out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
html=(root/'index.html').read_text();cases=[];errors=[];requests=[]

def stable(page):
    page.wait_for_timeout(90)
def click(page,selector):
    page.locator(selector).click();stable(page)
def snap(page):
    return page.evaluate('design089Snapshot()')
def fresh(browser,width=1280):
    page=browser.new_page(viewport={'width':width,'height':900 if width>500 else 812})
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append(r.url))
    page.set_content(html);stable(page);return page

def same_domain(before,after):
    for key in ['taskIds','sessionIds','oldApi','requirement','areaCount','executionCount']:
        assert before[key]==after[key],(key,before[key],after[key])

def case(name,fn):
    start=time.monotonic()
    try:
        detail=fn();cases.append({'name':name,'result':'PASS','seconds':round(time.monotonic()-start,2),'evidence':detail})
    except Exception as e:
        cases.append({'name':name,'result':'FAIL','seconds':round(time.monotonic()-start,2),'error':str(e),'trace':traceback.format_exc()})

with sync_playwright() as pw:
    browser=pw.chromium.launch(executable_path=args.browser,headless=True,args=['--no-sandbox'])
    version=browser.version
    def navigation():
        page=fresh(browser,375);before=snap(page)
        page.locator('#map-scroll').evaluate('(e)=>{e.scrollLeft=332;e.scrollTop=40;}')
        page.locator('#node-booking').scroll_into_view_if_needed();page.evaluate('window.scrollTo(0,120)');stable(page)
        pos=page.locator('#map-scroll').evaluate('(e)=>({x:e.scrollLeft,y:e.scrollTop})')
        click(page,'#node-booking');assert snap(page)['route']=='booking'
        original=snap(page)['navigation']['mapView'];assert original['mapX']==pos['x'];assert original['mapY']==pos['y']
        click(page,'#booking-to-cancel');assert snap(page)['route']=='cancel'
        expected_area_y=page.evaluate('routeViews.get("booking").y');page.go_back();stable(page);assert snap(page)['route']=='booking';assert abs(page.evaluate('scrollY')-expected_area_y)<=2
        page.go_forward();stable(page);assert snap(page)['route']=='cancel'
        click(page,'#cancel-to-notify');assert snap(page)['route']=='notify'
        click(page,'#map-crumb');after=snap(page);same_domain(before,after);assert after['mapSelection']=='booking'
        actual=page.locator('#map-scroll').evaluate('(e)=>({x:e.scrollLeft,y:e.scrollTop})');assert actual==pos,(actual,pos)
        assert abs(page.evaluate('scrollY')-original['y'])<=2
        assert page.locator('#node-booking').get_attribute('aria-current')=='true'
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.screenshot(path=str(out/'mobile-map.png'),full_page=True)
        page.close();return {'mapBefore':pos,'mapAfter':actual,'windowYRestored':original['y'],'browserBackForward':True,'areaScrollYRestored':expected_area_y,'navigationDidNotMutateDomain':True}
    case('01 navigation / map scroll and selection / browser back-forward',navigation)
    def empty_area():
        page=fresh(browser);click(page,'#node-notify');before=snap(page)
        assert page.locator('#notify-question').is_hidden();assert page.locator('#view-notify [role="tab"]').count()==0
        click(page,'#clarify-notify');assert snap(page)['question']['state']=='unanswered';same_domain(before,snap(page))
        click(page,'#notify-unknown');assert snap(page)['question']['state']=='unknown';assert page.locator('#notify-question').is_hidden()
        click(page,'#clarify-notify');click(page,'#notify-defer');assert snap(page)['question']['state']=='deferred'
        click(page,'#map-crumb');click(page,'#node-notify');assert snap(page)['question']['state']=='deferred';same_domain(before,snap(page))
        click(page,'#clarify-notify');page.locator('#notify-input').fill('예약 확정만 먼저 알리고 싶어요.');click(page,'#notify-save');assert snap(page)['question']['state']=='proposed';same_domain(before,snap(page))
        page.screenshot(path=str(out/'notification.png'),full_page=True);page.close();return 'One optional question; unknown/deferred/proposed stay non-confirmed; no tasks/sessions created.'
    case('02 sparse area / optional question / unknown and defer',empty_area)
    def separate_targets():
        page=fresh(browser);click(page,'#node-booking');click(page,'#prepare-api');text='사용자 편집 초안: 예약 API만 비회원 허용. 취소와 알림은 제외.';page.locator('#draft-text').fill(text)
        before=snap(page);click(page,'#booking-to-cancel');click(page,'#compare-cancel');click(page,'#report-cancel summary')
        got=snap(page);assert got['route']=='cancel';assert got['draft']['target']=='TASK-API-01';assert got['selectedReport']['taskId']=='TASK-CANCEL-01';assert got['draft']['text']==text
        click(page,'#map-crumb');assert snap(page)['draft']['text']==text;click(page,'#draft-resume');assert page.locator('#draft-text').input_value()==text
        click(page,'#new-note');page.locator('#note-input').fill('별도 요청 메모');click(page,'#note-save');assert snap(page)['draft']==before['draft'];same_domain(before,snap(page))
        page.screenshot(path=str(out/'booking-draft.png'),full_page=True)
        page.close();return 'Draft TASK-API-01 and report TASK-CANCEL-01 remain independent of route; note does not replace draft.'
    case('03 draft / viewed area / report target separation',separate_targets)
    def selective_scope():
        page=fresh(browser,375);click(page,'#node-booking');expect(page.locator('#view-booking')).to_contain_text('미확인');expect(page.locator('#view-booking')).to_contain_text('미검증');click(page,'#prepare-api');original=snap(page);assert original['draft']['target']=='TASK-API-01'
        click(page,'#booking-to-cancel');click(page,'#compare-cancel');expect(page.locator('#cancel-comparison')).to_contain_text('버튼 문구만 변경');expect(page.locator('#cancel-comparison')).to_contain_text('자동 반영 없음');click(page,'#report-cancel summary');expect(page.locator('#report-cancel')).to_contain_text('TASK-CANCEL-01');expect(page.locator('#report-cancel')).to_contain_text('CHANGE-CANCEL-01')
        same_domain(original,snap(page));assert snap(page)['draft']==original['draft'];assert page.evaluate('document.documentElement.scrollWidth <= innerWidth');page.screenshot(path=str(out/'mobile-cancel.png'),full_page=True);page.close();return 'Stale report displayed against latest text-only request; no execution or completion state created.'
    case('04 affected task only / old report vs latest request',selective_scope)
    def shared_identity():
        page=fresh(browser);click(page,'#node-booking');click(page,'#prepare-api');before=snap(page);old=page.locator('#old-api').text_content()
        click(page,'#view-booking [data-action="shared"]');updated='비회원도 예약을 신청할 수 있다. 회원가입은 선택이며 연락처만 먼저 입력한다.';page.locator('#shared-input').fill(updated);click(page,'#shared-apply')
        got=snap(page);assert got['requirement']['id']=='REQ-01';assert got['requirement']['version']==3;assert len(got['requirement']['history'])==3
        assert page.locator('#view-booking [data-shared-text]').text_content()==updated
        click(page,'#view-booking .next-card [data-route="member"]');assert page.locator('#view-member [data-shared-text]').text_content()==updated
        assert page.locator('#old-api').text_content()==old;assert snap(page)['draft']==before['draft'];assert snap(page)['taskIds']==before['taskIds'];assert snap(page)['sessionIds']==before['sessionIds'];assert snap(page)['executionCount']==0
        click(page,'#draft-resume');assert page.locator('#draft-stale').is_visible();page.close();return 'One REQ-01 updated once; both views share it; old work/report and manually written draft remain at their bases.'
    case('05 single shared requirement / immutable old work / no over-splitting',shared_identity)
    def keyboard():
        page=fresh(browser,375);page.locator('#node-booking').focus();page.keyboard.press('Enter');stable(page);assert snap(page)['route']=='booking';expect(page.locator('#title-booking')).to_be_focused()
        page.locator('#about-open').focus();page.keyboard.press('Enter');expect(page.locator('#about-dialog')).to_be_visible();page.keyboard.press('Tab');assert page.evaluate('!!document.activeElement.closest("#about-dialog")');page.keyboard.press('Shift+Tab');page.keyboard.press('Escape');expect(page.locator('#about-dialog')).not_to_be_visible();expect(page.locator('#about-open')).to_be_focused()
        page.locator('#old-work summary').focus();page.keyboard.press('Enter');assert page.locator('#old-work').get_attribute('open') is not None
        click(page,'#map-crumb');page.locator('#map-scroll').focus();x=page.locator('#map-scroll').evaluate('(e)=>e.scrollLeft');page.keyboard.press('ArrowRight');page.wait_for_timeout(250);assert page.locator('#map-scroll').evaluate('(e)=>e.scrollLeft')>x
        page.close();return 'Enter navigation, native details, dialog focus containment and Escape restoration, arrow-key map scroll.'
    case('06 keyboard interaction at 375px',keyboard)
    def safety():
        page=fresh(browser);snap0=snap(page);click(page,'#node-booking');click(page,'#prepare-api');page.locator('#draft-text').fill('임시 초안');page.close()
        other=fresh(browser);assert snap(other)['draft'] is None;assert snap(other)['requirement']==snap0['requirement'];other.close()
        assert not re.search(r'\b(fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|sessionStorage|indexedDB)\b',html)
        assert not re.search(r'<(?:script|iframe)[^>]+src=',html,re.I)
        assert "connect-src 'none'" in html
        assert not requests,requests
        assert not errors,errors
        return {'newPageStateReset':True,'networkRequests':len(requests),'uncaughtErrors':len(errors),'runtimeDependencies':0,'storageAPIs':0}
    case('07 offline/static boundary and new-page reset',safety)
    # Final visual evidence at both sizes (not user testing).
    for width in (1440,375):
        page=fresh(browser,width);page.screenshot(path=str(out/f'final-map-{width}.png'),full_page=True)
        click(page,'#node-booking');page.screenshot(path=str(out/f'final-booking-{width}.png'),full_page=True);page.close()
    browser.close()
report={'artifactSha256':hashlib.sha256((root/'index.html').read_bytes()).hexdigest(),'executedAtUtc':datetime.now(timezone.utc).isoformat(),'environment':{'python':platform.python_version(),'os':platform.platform(),'chromium':version,'loadMode':'exact HTML via Playwright set_content in about:blank'},'limitations':['file:// and loopback HTTP navigation were blocked by environment administrator policy in preliminary attempts. No policy was changed.','Direct file opening, actual browser restart, Firefox/Safari, touch device hardware and screen-reader behavior were not tested.','New-page reset is tested, not a full OS/browser restart. No external AI, product integration, independent review or user usability study.'],'cases':cases,'uncaughtErrors':errors,'networkRequests':requests}
(out/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
for c in cases:print(c['result'],c['name'],c.get('error',''))
print('HTML SHA256',report['artifactSha256']);print('browser',version);print('report',out/'results.json')
raise SystemExit(1 if any(c['result']=='FAIL' for c in cases) else 0)
