import ast,collections,difflib,hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1];evidence=root/'evidence'
paths=[root/'app/continuity/tests/received20_browser.py',root/'app/continuity/tests/home15_browser.py',root/'app/continuity/tests/understanding17_browser.py']
expressions=[]
for path in paths:
    tree=ast.parse(path.read_text(encoding='utf-8'),filename=str(path))
    assert not any(isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr=='wait_for_timeout' for n in ast.walk(tree)) if path.name=='received20_browser.py' else True
    for n in ast.walk(tree):
        if isinstance(n,ast.Call) and isinstance(n.func,ast.Attribute) and n.func.attr in ['evaluate','evaluate_all'] and n.args and isinstance(n.args[0],ast.Constant) and isinstance(n.args[0].value,str):expressions.append(n.args[0].value)
    for n in tree.body:
        if isinstance(n,ast.Assign) and isinstance(n.value,ast.Constant) and isinstance(n.value.value,str) and any(isinstance(t,ast.Name) and t.id in ['SNAP','PROBE','TEXT'] for t in n.targets):expressions.append(n.value.value)
subprocess.run(['node','-e','for(const s of '+json.dumps(expressions)+'){new Function("return ("+s+")");}console.log("PASS: '+str(len(expressions))+' embedded JS expressions parsed without execution");'],check=True)
old=(evidence/'originals/home15_browser.py').read_bytes();new=paths[1].read_bytes()
def calls(raw,attrs):return collections.Counter(ast.dump(n) for n in ast.walk(ast.parse(raw.decode())) if isinstance(n,ast.Call) and (isinstance(n.func,ast.Name) and n.func.id=='expect' and 'expect' in attrs or isinstance(n.func,ast.Attribute) and n.func.attr in attrs))
assert not(calls(old,['check','check_true','expect'])-calls(new,['check','check_true','expect']))
assert calls(old,['wait_for_timeout','sleep'])==calls(new,['wait_for_timeout','sleep'])
assert calls(old,['press'])==calls(new,['press'])
a17_old=(evidence/'originals/understanding17_browser.py').read_bytes();a17_new=paths[2].read_bytes()
assert hashlib.sha1(b'blob '+str(len(a17_old)).encode()+b'\0'+a17_old).hexdigest()=='21a91eba726137e782f589716a766f64b3cb0093'
assert calls(a17_old,['wait_for_timeout','sleep'])==calls(a17_new,['wait_for_timeout','sleep'])
assert calls(a17_old,['press'])==calls(a17_new,['press'])
class StripA17DuplicateMethod(ast.NodeTransformer):
    def visit_FunctionDef(self,node):return None if node.name=='test_03_counterexamples_and_correction_draft' else self.generic_visit(node)
assert ast.dump(StripA17DuplicateMethod().visit(ast.parse(a17_old.decode())))==ast.dump(StripA17DuplicateMethod().visit(ast.parse(a17_new.decode())))
workflow=(root/'.github/workflows/verify.yml').read_bytes();baseline=(evidence/'originals/verify.yml').read_bytes()
begin=workflow.index(b'      - name: RECEIVED20 ');end=workflow.index(b'      # Sentinels',begin)
assert workflow[:begin]+workflow[end:]==baseline
assert len(workflow[begin:end].splitlines())==7
assert workflow.count(b'python continuity/tests/received20_browser.py')==1
for p in [*paths,root/'app/continuity/tests/received20-fixtures.mjs']:
    for i,line in enumerate(p.read_text(encoding='utf-8').splitlines(),1):assert line==line.rstrip(),(str(p),i,'trailing whitespace')
patch=[]
for name in ['app/continuity/tests/home15_browser.py','.github/workflows/verify.yml','app/continuity/tests/received20_browser.py','app/continuity/tests/received20-fixtures.mjs','app/continuity/tests/understanding17_browser.py']:
    baseline_path=evidence/'originals'/Path(name).name
    original=baseline_path.read_bytes() if baseline_path.exists() else b''
    current=(root/name).read_bytes()
    patch.append(''.join(difflib.unified_diff(original.decode().splitlines(True),current.decode().splitlines(True),fromfile='a/'+name if original else '/dev/null',tofile='b/'+name)))
(evidence/'received20-tests.patch').write_text(''.join(patch),encoding='utf-8',newline='')
# --check reads the existing index; it does not stage or apply this overlay. Sparse author has no workflow worktree file.
subprocess.run(['git','-C',str(root.parent/'product20-author'),'apply','--cached','--check',str(evidence/'received20-tests.patch')],check=True)
print(json.dumps({'pythonAST':len(paths),'embeddedJS':len(expressions),'newReceivedFixedWaits':0,'homeOriginalExpectationsPreserved':True,'homeNewFixedWaits':0,'area17NewFixedWaits':0,'area17OtherMethodsExact':True,'workflowOnlyAddedLines':7,'gitCachedApplyCheck':0,'browser':'NOT RUN','server':'NOT STARTED','testModuleImport':False}))
