from methods import *
u=None;fatal=None;cleanup=[];code=1
try:
 u=Check();u.checks=[];u.prepare(1440,900);old=u.state();entry=u.p.evaluate('document.documentElement.dataset.entryId');u.openRef();pin=u.refSnap();assert pin['selectedText']==EXTERNAL
 u.click(u.p.locator('#nav-projects'),'프로젝트 목록으로');u.button('＋ 새 프로젝트');u.fill(u.p.get_by_role('textbox',name='무엇을 만드나요? 프로젝트 목적 · 작업 요청과 따로 보관해요',exact=True),'[합성29 다른 프로젝트] 다른 부분의 안내만 읽는다.');u.button('영역 나누러 가기');u.fill(u.p.locator('#area-name'),'다른 프로젝트 부분');u.fill(u.p.locator('#area-note'),'이 프로젝트는 기존 보관 안내 A의 자료와 관계없다.');u.click(u.p.locator('#area-add'),'정상 영역 추가');u.ids={'다른 프로젝트 부분':u.state()['space']['areas'][-1]['id']};u.visibleInfo('다른 프로젝트 부분');u.button('이 영역에 새 요청');u.send('[합성29 다른 프로젝트] 여기의 안내만 정리해 주세요.');new=u.state();u.check(not u.ref().evaluate('e=>e.open'),'new project starts reference closed',u.refSnap());u.openRef();s=u.refSnap();u.check(s['reference']['dataset']['projectId']==new['id'] and s['selectedText'] is None and EXTERNAL not in s['body']['text'],'no old selected A body in another project',s)
 u.click(u.p.locator('#nav-projects'),'다시 프로젝트 목록');u.click(u.p.locator('.project-card[data-entry-id="'+entry+'"] .project-card-name'),'원래 프로젝트 카드로 실제 재진입');u.click(u.p.locator('#nav-work'),'원래 A 현재 작업');u.check(not u.ref().evaluate('e=>e.open'),'same project reentry reference closed after epoch switch',u.refSnap());u.openRef();back=u.refSnap();now=u.state();u.check(back['selectedText']==EXTERNAL and now['currentTaskId']==old['currentTaskId'],'explicit reopen selects original project description',back)
 u.check(all(now[k]==old[k] for k in old if k not in ['notice','pending']),'original project material preserved',{'changedKeys':[k for k in old if now[k]!=old[k]],'beforeSHA256':sha(json.dumps(old,ensure_ascii=False,sort_keys=True).encode()),'afterSHA256':sha(json.dumps(now,ensure_ascii=False,sort_keys=True).encode())});code=int(any(not x['pass'] for x in u.checks))
except Exception:fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 code=int(bool(code or fatal or cleanup or (u and u.errors)))
 (R/'result.json').write_text(json.dumps({'sourceCommit':'2a7d078124e96243e949244bec945cc8da2c47ec','scope':'project switching only / 1440x900 supplementary run, not core2PC rerun','checks':[{'label':x['label'],'pass':x['pass'],'raw':'ui.jsonl CHECK '+x['label']} for x in u.checks] if u else [],'fatal':fatal,'pageerrors':u.errors if u else [],'cleanup':cleanup,'plannedChildExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
