from ab_methods import *
u=None;fatal=None;cleanup=[];code=1
try:
 u=AB();u.new(1280,720);u.click(u.p.locator('#nav-projects'),'내 프로젝트')
 with u.p.expect_file_chooser() as f:u.click(u.p.locator('#list-import'),'실제 4카드 백업 복구')
 u.p.once('dialog',lambda d:(u.log('normal UI confirm',{'message':d.message}),d.accept()));f.value.set_files(str(BACKUP));expect(u.p.locator('#notice')).to_contain_text('사본으로 불러왔어요');u.state();u.map();u.ids={name:next(a['id'] for a in u.state()['space']['areas'] if a['name']==name) for name in NAMES}
 def addRoot(name):
  u.detail('area-add-panel');u.fill(u.p.locator('#area-name'),name);u.fill(u.p.locator('#area-note'),'[합성28 추가] 다른 가지의 실제 소속을 읽는다.');u.click(u.p.locator('#area-add'),'normal root add');u.state();return u.state()['space']['areas'][-1]['id']
 def infoID(id,label):
  u.ids['explicit-existing-id']=id;u.visibleInfo('explicit-existing-id')
 def addChild(parent,name):
  infoID(parent,'parent');u.detail('panel-more');u.fill(u.p.locator('#child-name'),name);u.fill(u.p.locator('#child-note'),'[합성28 추가] 같은 이름의 직접 부모지만 실제 다른 가지에 속한다.');u.click(u.p.locator('#child-add'),'normal child add');u.state();return u.state()['space']['areas'][-1]['id']
 def backup(n):
  u.detail('project-management')
  with u.p.expect_download() as d:u.click(u.p.locator('#backup'),'정상 UI '+str(n)+'카드 백업')
  out=ROOT/f'normal-ui-{n}-card-backup.json';d.value.save_as(str(out));u.log('normal UI expanded backup',{'count':n,'backup':str(out),'sha256':sha(out.read_bytes()),'project':u.state()})
 b=addRoot('다른 자료 안내의 독립 흐름');p2=addChild(b,PN);backup(6)
 q2=addChild(p2,QN);addRoot('자료 보관 안내의 공통 절차에서 별도 검토를 맡는 부분');backup(8)
 (R/'profile-ids.json').write_text(json.dumps({'original':u.ids,'otherRoot':b,'sameParentNameOtherBranch':p2,'sameChildNameOtherBranch':q2},ensure_ascii=False,indent=2));code=0
except Exception:fatal=traceback.format_exc();print(fatal,file=sys.stderr)
finally:
 if u:cleanup=u.close()
 code=int(bool(code or fatal or cleanup or (u and u.errors)))
 (R/'result.json').write_text(json.dumps({'scope':'normal UI backup profiles6/8 only; not comparison result','fatal':fatal,'cleanup':cleanup,'plannedExit':code},ensure_ascii=False,indent=2))
sys.exit(code)
