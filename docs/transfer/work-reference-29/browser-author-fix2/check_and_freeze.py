"""fix2 검사 소스의 AST·변경 경계·원본 불변만 확인한다. UI 실행 없음."""
from pathlib import Path
import ast, difflib, hashlib, json

HERE=Path(__file__).resolve().parent;ROOT=HERE.parent
source=ROOT/'app/continuity/tests/work-description29_browser.py'
old=HERE/'before-56cb.py';original=ROOT.parent/'product29-tests/app/continuity/tests/work-description29_browser.py'
sha=lambda b:hashlib.sha256(b).hexdigest()
assert sha(old.read_bytes())=='56cb414de680dc262dbfd74145b078309ac85134e0c7117369f48bea7e2e4082'
assert old.read_bytes()==original.read_bytes()
before=ast.parse(old.read_bytes().decode('utf-8'));after=ast.parse(source.read_bytes().decode('utf-8'))
def seed(tree):return next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SEED' for t in n.targets))
assert seed(before)==seed(after),'실제 fixture는 변경하지 않음'
assert b'wait_for_timeout' not in source.read_bytes()
def method(tree,name):return ast.dump(next(n for c in tree.body if isinstance(c,ast.ClassDef) for n in c.body if isinstance(n,ast.FunctionDef) and n.name==name),include_attributes=False)
for name in ['test_01_actual_editor_B_not_compose_or_map_A','test_04_task_project_lifecycle_and_held_only']:
    assert method(before,name)==method(after,name),'다른 장면은 그대로 유지'
for c in after.body:
    if isinstance(c,ast.ClassDef) and c.name=='WorkDescription29':assert len([n for n in c.body if isinstance(n,ast.FunctionDef) and n.name.startswith('test_')])==4
patch=''.join(difflib.unified_diff(old.read_text(encoding='utf-8').splitlines(True),source.read_text(encoding='utf-8').splitlines(True),fromfile='a/app/continuity/tests/work-description29_browser.py',tofile='b/app/continuity/tests/work-description29_browser.py'))
(HERE/'fix2-test.patch').write_text(patch,encoding='utf-8')
(HERE/'candidate.py').write_bytes(source.read_bytes())
b=source.read_bytes();result={'bytes':len(b),'sha256':sha(b),'gitBlob':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest(),
 'ast':'통과','old56CBUnchanged':True,'fixtureUnchanged':True,'test01and04Unchanged':True,'cases':'4장면×양PC 유지',
 'scope':'단일 body 스크롤의 실제 owner·원문 Range/hit·같은 pin 수신 뒤 위치/anchor 보존·명시 재열기 초기화 검사',
 'notRun':['브라우저','서버','Node22 실행','fix2 fixture 재실행'],'workflowChanged':False,'productWritten':False,
 'oldMetricLimit':'기존56CB는 body만 관측해 source-raw 내부 scroll 소실을 놓칠 수 있었다. 기존 CI 성공 여부로 이 새 경계를 통과했다고 하지 않는다.',
 'independentReview':{'reviewer':'resume_product_judgment_astra','sourceSha256':'9713415a8acb0b6b700ab460119d6b8dbd666bad0dc6c4106a99d3164be4f4bf','result':'최종 파일의 실제 해시와 4485 보존본의 delta를 대조해 동일 Range 검사 보완을 수용. 추가 수정 사항 없음. 브라우저와 AREA17 판단은 별개.'},
 'draftLimit':'summary 내부 scroll>0을 요구하던 초기 fix2 초안은 실행하지 않고 draft-nested-scroll-unrun.py로 보존. 최종 단일 body 계약에 맞춰 대체했다.'}
(HERE/'RECEIPT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
