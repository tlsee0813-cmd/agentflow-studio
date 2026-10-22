"""소스 실행 없이 AST/바이트 범위만 검사한다. 서버·브라우저·fixture 생성은 실행하지 않는다."""
import ast, hashlib, json, subprocess, sys
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
HERE=Path(__file__).resolve().parent
script=ROOT/'app/continuity/tests/work-description29_browser.py'
workflow=ROOT/'.github/workflows/verify.yml'
before=(HERE/'verify-before.yml').read_bytes()
assert hashlib.sha1(b'blob '+str(len(before)).encode()+b'\0'+before).hexdigest()=='319c464422bef913ab4eb33fdd92951101ad1aa8'
data=script.read_bytes();tree=ast.parse(data.decode('utf-8'),filename=str(script))
classes=[n for n in tree.body if isinstance(n,ast.ClassDef)]
methods=[n.name for n in classes[0].body if isinstance(n,ast.FunctionDef) and n.name.startswith('test_')]
assert len(methods)==4 and len(classes)==2
assert classes[0].bases[0].attr=='TestCase'
assert classes[1].bases[0].id=='WorkDescription29'
assert b'wait_for_timeout' not in data
current=workflow.read_bytes()
added=('      - name: WORK29 actual editor description reference on two PCs (native HTTP, synthetic recovery fixture, mock AI)\r\n'
 '        env:\r\n          IDEA015_EVIDENCE_DIR: test-results/work-description29\r\n        shell: bash\r\n        run: |\r\n'
 '          set -o pipefail\r\n          python continuity/tests/work-description29_browser.py 2>&1 | tee test-results/work-description29-browser.log\r\n').encode()
assert current.count(added)==1 and current.replace(added,b'',1)==before
assert b'timeout-minutes: 25' in current
def info(path):
    raw=path.read_bytes()
    return {'path':str(path.relative_to(ROOT)),'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlob':hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()}
result={'kind':'AST 및 바이트 검사','python':sys.version,'methods':methods,'pcCases':8,
 'workflow':'기존 바이트를 유지하고 AREA17 뒤에 한 단계만 추가; timeout 25분 유지',
 'notRun':['fixture 생성','제품 단위·타입·빌드','브라우저·서버','지원 Node22 실제 실행'],
 'source':[info(script),info(workflow)],'productChanged':False}
print(json.dumps(result,ensure_ascii=False,indent=2))
