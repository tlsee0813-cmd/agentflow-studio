"""허가된 Node24 순수 fixture 생성. 테스트 모듈 import/서버/브라우저 호출 없음."""
from pathlib import Path
import ast, hashlib, json, subprocess

HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
SCRIPT=ROOT/'app/continuity/tests/work-description29_browser.py'
APP=ROOT.parent/'product29-author/app'
NODE=Path('C:/Users/이준혁/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe')
tree=ast.parse(SCRIPT.read_bytes().decode('utf-8'))
seeds=[ast.literal_eval(n.value) for n in tree.body if isinstance(n,ast.Assign) and any(isinstance(t,ast.Name) and t.id=='SEED' for t in n.targets)]
assert len(seeds)==1
seed=seeds[0]
version=subprocess.run([str(NODE),'--version'],capture_output=True,check=False)
(HERE/'fixture-node-version.stdout.txt').write_bytes(version.stdout)
(HERE/'fixture-node-version.stderr.txt').write_bytes(version.stderr)
(HERE/'fixture-node-version.exit.txt').write_text(str(version.returncode),encoding='utf-8')
def run(label,code,stdin=None):
    command=[str(NODE),'--input-type=module','--eval',code]
    result=subprocess.run(command,cwd=APP,input=stdin,capture_output=True,check=False)
    (HERE/f'{label}.stdout.txt').write_bytes(result.stdout)
    (HERE/f'{label}.stderr.txt').write_bytes(result.stderr)
    (HERE/f'{label}.exit.txt').write_text(str(result.returncode),encoding='utf-8')
    (HERE/f'{label}.command.json').write_text(json.dumps({'command':command,'cwd':str(APP),'stdin':'fixture-generate.stdout.txt 원문' if stdin is not None else None},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    return result
generated=run('fixture-generate',seed)
if generated.returncode:raise SystemExit(generated.returncode)
check=r'''
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as D from './continuity/dist/public/shared/domain.js';
import {parseProject} from './continuity/dist/public/shared/validation.js';
const s=JSON.parse(fs.readFileSync(0,'utf8')),p=parseProject(JSON.stringify(s.p));
assert.equal(p.currentTaskId,s.B);assert.equal(D.areaOf(p,D.taskOf(p,s.B)),s.b);
assert.deepEqual(p.space.draftTarget,{area:s.a});
const b=D.areaDescription(p,s.b),c=D.areaDescription(p,s.c);
assert.equal(s.revision,2);assert.equal(b.current.entry.revision,2);assert.equal(b.current.valid,true);assert.equal(b.current.entry.by,'user');assert.equal(b.current.summary,s.textB);
assert.equal(c.current,null);assert.equal(c.held.length,1);assert.equal(c.held[0].summary,s.textHeld);
assert.equal(s.late.taskId,s.B0);assert.notEqual(s.B0,s.B);assert.equal(s.late.understanding.areaId,s.b);assert.equal(s.late.understanding.basedOn,2);
const inspected=D.inspectResultFile(p,JSON.stringify(s.late));
assert.equal(inspected.task.id,s.B0);assert.equal(inspected.record.returnId,s.late.returnId);assert.equal(inspected.record.anchor.understanding,2);assert.equal(inspected.record.anchor.areaId,s.b);
const n=D.importResultFile(p,JSON.stringify(s.late)),next=D.areaDescription(n,s.b);
assert.equal(n.currentTaskId,s.B);assert.equal(next.current.entry.revision,3);assert.equal(next.current.valid,true);assert.equal(next.current.summary,s.textNew);
assert.deepEqual(n.tasks.slice(0,p.tasks.length),p.tasks);
console.log(JSON.stringify({kind:'순수 준비 전제 검사',currentB:p.currentTaskId,actualArea:s.b,composeArea:s.a,revision:2,valid:b.current.valid,by:b.current.entry.by,
 heldOnlyC:{area:s.c,current:null,held:c.held.length},late:{taskId:s.late.taskId,returnId:s.late.returnId,basedOn:s.late.understanding.basedOn,anchorArea:inspected.record.anchor.areaId},
 afterLate:{currentB:n.currentTaskId,revision:next.current.entry.revision,valid:next.current.valid},oldTasksExact:true,serverStarted:false,browserRun:false},null,2));
'''
checked=run('fixture-check',check,generated.stdout)
receipt={'testSha256':hashlib.sha256(SCRIPT.read_bytes()).hexdigest(),'seedUtf8Sha256':hashlib.sha256(seed.encode('utf-8')).hexdigest(),
 'node':version.stdout.decode('utf-8').strip(),'generateExit':generated.returncode,'checkExit':checked.returncode,
 'scope':'Node24 보조 순수 domain fixture 생성·정확한 반환 연결 검사. 지원 Node22/정상 UI/브라우저 통과가 아님.',
 'moduleImported':False,'serverStarted':False,'browserRun':False,'productWritten':False}
(HERE/'FIXTURE_RECEIPT.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt,ensure_ascii=False,indent=2))
raise SystemExit(checked.returncode)
