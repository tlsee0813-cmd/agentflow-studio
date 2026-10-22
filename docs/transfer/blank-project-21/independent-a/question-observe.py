from pathlib import Path
import sys,json,traceback
from ui_support import Browser,GEO
R=Path(__file__).parent;O=R/'question';O.mkdir(exist_ok=True);rows=[]
for name,A in [('before',R.parent/'cycle20-fix1-candidate/app'),('after',R.parent/'cycle21-a-candidate/app')]:
 b=Browser(A,O/name);r={'kind':name};rows.append(r)
 try:
  b.new(1280,720);p=b.p
  # Normal blank project, no fixtures or stored project injection.
  for k in ['Tab','Tab','Tab','Enter']:p.keyboard.press(k)
  p.get_by_role('button',name='＋ 새 프로젝트',exact=True).click();p.get_by_role('textbox',name='요청 또는 돌아온 결과 원문',exact=True).fill('결제가 실패하는 오류가 있는데 원인은 아직 모르겠어요.');p.get_by_role('button',name='작업문 준비하기 ↗',exact=True).click();p.get_by_text('모르는 사실 확인',exact=True).wait_for();b.saved();r.update(AX=p.locator('body').aria_snapshot(),screen=b.snap(),project=b.project(),question=p.locator('#question-box').evaluate(GEO),copies=p.locator('#copy-work,#copy-file-work,#download-file-work').evaluate_all('(es)=>es.map(e=>({id:e.id,disabled:e.disabled,text:e.textContent,rect:e.getBoundingClientRect().toJSON()}))'));p.screenshot(path=str(O/f'{name}-1280-question-first.png'));s=p.get_by_text('결과를 파일로 받기 · 선택',exact=True);b.reach(s).click();r['afterDisclosure']={'snapshot':b.snap(),'sameProject':b.project()==r['project'],'copies':p.locator('#copy-work,#copy-file-work,#download-file-work').evaluate_all('(es)=>es.map(e=>({id:e.id,disabled:e.disabled,text:e.textContent,rect:e.getBoundingClientRect().toJSON()}))')};r['openPNG']=f'{name}-1280-question-file-open.png';p.screenshot(path=str(O/r['openPNG']));q=p.get_by_role('button',name='아직 모르겠어요',exact=True);r['unknownButtonCount']=q.count()
 except Exception:r['fatal']=traceback.format_exc()
 finally:b.close();(O/'result.json').write_text(json.dumps({'rows':rows},ensure_ascii=False,indent=2))
print(json.dumps({'fatal':[r.get('fatal') for r in rows if r.get('fatal')]}));sys.exit(int(any(r.get('fatal') for r in rows)))
