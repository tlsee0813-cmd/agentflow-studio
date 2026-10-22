from fixture import *
u=None;fatal=None;cleanup=[];rows=[];code=1
try:
 u=Observation();u.prepare(1280,720)
 u.map();u.visibleInfo('보관 안내');u.button(REQUEST+' ↘')
 q=u.p.locator('textarea[aria-label="영역 설명 정정"]')
 edit=q.locator('xpath=ancestor::details[1]');eid=edit.get_attribute('id')
 def shot(label):
  e=u.p.locator('#'+eid);t=e.locator('textarea');su=e.locator(':scope > summary');v={'label':label,'open':e.evaluate('e=>e.open'),'summary':su.inner_text(),'summaryGeometry':su.evaluate(GEO),'textareaVisible':t.is_visible(),'textareaGeometry':t.evaluate(GEO),'textareaValue':t.input_value(),'warning':[{'text':x.inner_text(),'visible':x.is_visible()} for x in e.locator('[role=status]').all()],'snapshot':u.snap(),'project':u.state()};rows.append(v);u.log(label,v);return v
 u.detail('task-understanding-more');before=shot('before open');u.click(u.p.locator('#'+eid+' > summary'),'작업 읽기 설명 편집 열기');opened=shot('opened')
 u.click(u.p.locator('#'+eid.replace('-edit','-cancel')),'설명 편집 취소');cancelled=shot('after cancel immediate normal render');u.screenshot('cancel-actual-screen')
 # A visible editor after cancel is the product counterexample; further normal click/save diagnoses missing token.
 if cancelled['open']:
  u.click(u.p.locator('#'+eid.replace('-edit','-save')),'취소 후 남은 실제 열린 편집기의 저장');shot('save on residual editor')
  u.click(u.p.locator('#'+eid+' > summary'),'남은 편집 접기');u.click(u.p.locator('#'+eid+' > summary'),'명시적으로 편집 다시 열기')
 else:u.click(u.p.locator('#'+eid+' > summary'),'명시적으로 편집 다시 열기')
 reopened=shot('explicit reopen');u.screenshot('explicit-reopen')
 assert before['project']==cancelled['project']==reopened['project'],'cancel/reopen changed persisted project'
 code=int(cancelled['open'] or cancelled['textareaVisible'])
except Exception:
 fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 code=1 if fatal or cleanup or (u and u.errors) else code
 (R/'result.json').write_text(json.dumps({'sourceCommit':'5dcf269bd7f25dec3f6432fb3386adb23c89d526','expectedScenario':1,'executed':bool(rows),'complete':len(rows)>=4 and not fatal,'productExpectedCloseFailure':bool(len(rows)>2 and rows[2]['open']),'rows':rows,'fatal':fatal,'cleanup':cleanup,'pageerrors':u.errors if u else [],'plannedChildExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
