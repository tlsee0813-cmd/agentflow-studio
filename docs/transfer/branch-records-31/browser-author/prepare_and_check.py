"""Author-only static and pure-data checks. Never imports the browser test module."""
import ast, hashlib, json, pathlib, subprocess, sys, difflib
ROOT=pathlib.Path(__file__).resolve().parents[1]
E=ROOT/'evidence'
PRODUCT=ROOT.parent/'product31-author'
BASE='aa0938ecbe96ec5fdb15eb4783e865bf7ab70c7b'
SCRIPT=ROOT/'app/continuity/tests/branch-records31_browser.py'
WORKFLOW=ROOT/'.github/workflows/verify.yml'
def sha(b):return hashlib.sha256(b).hexdigest()
def meta(path):
 b=path.read_bytes();return {'path':str(path.relative_to(ROOT)),'bytes':len(b),'sha256':sha(b),'gitBlob':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()}
before=subprocess.check_output(['git','-C',str(PRODUCT),'show',BASE+':.github/workflows/verify.yml'])
(E/'verify-before.yml').write_bytes(before)
step=('      - name: BRANCH31 exact subtree reader and native caller return on two PCs (synthetic recovery, mock AI)\r\n'
      '        env:\r\n          IDEA015_EVIDENCE_DIR: test-results/branch-records31\r\n        shell: bash\r\n        run: |\r\n'
      '          set -o pipefail\r\n          python continuity/tests/branch-records31_browser.py 2>&1 | tee test-results/branch-records31-browser.log\r\n').encode()
marker=b'      - name: AREA18 mixed depth'
assert before.count(marker)==1
after=before.replace(marker,step+marker,1)
WORKFLOW.parent.mkdir(parents=True,exist_ok=True);WORKFLOW.write_bytes(after)
assert after.replace(step,b'',1)==before and b'timeout-minutes: 25' in after
tree=ast.parse(SCRIPT.read_text(encoding='utf-8'))
classes=[n for n in tree.body if isinstance(n,ast.ClassDef)]
methods=[n.name for n in classes[0].body if isinstance(n,ast.FunctionDef) and n.name.startswith('test_')]
assert len(classes)==2 and len(methods)==4 and classes[0].bases[0].attr=='TestCase'
assert 'wait_for_timeout' not in SCRIPT.read_text(encoding='utf-8')
strings=[n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str) and '=>' in n.value and not n.value.lstrip().startswith('import ')]
for i,js in enumerate(strings):
 r=subprocess.run(['node','--check','--input-type=module'],input=('('+js+')').encode(),capture_output=True)
 assert r.returncode==0,(i,r.stderr.decode())
seed=next(ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SEED' for t in n.targets))
r=subprocess.run(['node','--input-type=module','-e',seed],cwd=PRODUCT/'app',capture_output=True)
(E/'fixture.stdout.json').write_bytes(r.stdout);(E/'fixture.stderr.txt').write_bytes(r.stderr)
assert r.returncode==0,r.stderr.decode()
s=json.loads(r.stdout);p=s['p'];assert p['currentTaskId']==s['tasks']['B']
assert p['space']['draftTarget']=={'area':s['ids']['L']}
for k,want in [('L',(1,0,True)),('H',(0,1,None)),('S',(0,0,False))]:
 v=next(x for x in s['signals']['P'] if x['areaId']==s['ids'][k]);d=v['description']
 actual=(len(v['questions']),len(d['held']),d['current']['valid'] if d['current'] else None)
 assert actual==want,(k,actual,want)
assert s['ids']['B'] not in [x['areaId'] for x in s['signals']['P']]
assert p['space']['containment']['parents'][s['ids']['L']]==s['ids']['M']
# Parse recovery + actual late return with the exact domain, proving current B and exact H/owner without running UI.
probe="""import fs from 'node:fs';import * as D from './continuity/dist/public/shared/domain.js';import {parseProject} from './continuity/dist/public/shared/validation.js';
const s=JSON.parse(fs.readFileSync(process.argv[1],'utf8')),p=parseProject(JSON.stringify(s.p)),ids=new Set(p.tasks.map(t=>t.id)),raw=JSON.stringify(s.late),n=D.importResultFile(p,raw),added=n.tasks.filter(t=>!ids.has(t.id));
if(added.length!==1||n.currentTaskId!==s.tasks.B||D.areaOf(n,added[0])!==s.ids.B||added[0].resultFile.rawText!==raw||!D.areaDescription(n,s.ids.B).current.valid)throw Error('late source contract');
console.log(JSON.stringify({parse:true,currentB:true,exactH:added[0].resultFile.returnId,exactOwner:true,newReports:added.length}));"""
r=subprocess.run(['node','--input-type=module','-e',probe,str(E/'fixture.stdout.json')],cwd=PRODUCT/'app',capture_output=True)
(E/'fixture-probe.stdout.json').write_bytes(r.stdout);(E/'fixture-probe.stderr.txt').write_bytes(r.stderr)
assert r.returncode==0,r.stderr.decode()
files=[SCRIPT,WORKFLOW]
for path in files:
 dest=E/'frozen-source'/path.relative_to(ROOT);dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(path.read_bytes())
patch=''.join(difflib.unified_diff([],SCRIPT.read_text(encoding='utf-8').splitlines(True),fromfile='/dev/null',tofile='b/app/continuity/tests/branch-records31_browser.py'))
patch+=''.join(difflib.unified_diff(before.decode().splitlines(True),after.decode().splitlines(True),fromfile='a/.github/workflows/verify.yml',tofile='b/.github/workflows/verify.yml'))
(E/'candidate-tests.patch').write_text(patch,encoding='utf-8')
source=[]
for path,expected in [('app/continuity/src/client/app.ts','0d516dbda6bdc7569acad78bc4a55e47035cb4b8b99a2ffbdae3a1b54f28955d'),('app/continuity/public/styles.css','6d8ddbb78d0f51b061ccaeaf8a939a4d07c558fc7ae7334a07fd106cf5b540f7')]:
 b=(PRODUCT/path).read_bytes();assert sha(b)==expected;source.append({'path':path,'sha256':sha(b),'bytes':len(b)})
result={'role':'검사 작성자; 독립 수용 판정 아님','baseline':BASE,'candidateProduct':'a4b7265a63691c584cd76b5fe17b985f12879b47','contract':'a177461049bf6a40a016cf3d915f54be46833a6d',
 'files':[meta(p) for p in files],'sourceReadBindings':source,'ast':0,'embeddedJsSyntax':len(strings),'pureFixtureAndLateReturn':0,'methods':methods,'plannedPcCases':8,
 'workflow':'기존 바이트 그대로 + 7줄 단계 1개. timeout 25분 유지.','python':sys.version,'node':subprocess.check_output(['node','--version'],text=True).strip(),
 'notRun':['브라우저/서버/실제 파일 가져오기','지원 Node22 실행','제품 타입/단위/빌드 재실행','실제 신호 소멸 후 같은 호출자 fallback'],
 'limits':['합성 자료이며 사람 사용성/실제 AI/전체 개발 미결 판정이 아니다','신호 진입 전에 명시적 접기·맞춤으로 자료를 준비한다; 신호·복귀 직후에는 보정하지 않는다','제목 fallback은 sr-only의 실제 초점을 검사하고 가시 텍스트라고 부르지 않는다','서로 다른 프로젝트 전환은 신호 소멸 재현으로 세지 않는다'],
 'independentReview':{'reviewer':'resume_code_audit_sol','result':'D4E0의 프로젝트 재진입 뒤 nav-space/info가 caller 누출을 먼저 지울 수 있음을 지적. 해당 보정 제거와 즉시 owner/mode 확인 후 닫기인 9CA4 delta를 직접 대조하여 static clean. 실제 UI 미실행.','sourceSha256':'9ca4cce0f1c6c7c8a0c723c576277c216a59c3c77b3396c083fd47c36452f9ab'},'productWritten':False,'remoteWritten':False}
(E/'RECEIPT.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(result,ensure_ascii=False,indent=2))
