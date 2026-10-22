import ast,hashlib,json,subprocess
from pathlib import Path

evidence=Path(__file__).resolve().parent
root=evidence.parent/'product19-author'
def git(*args):return subprocess.check_output(['git','-C',str(root),*args])
def sha(data):return hashlib.sha256(data).hexdigest().upper()
def tree(data):return ast.parse(data.decode('utf-8'))
def reveal(node):
    return isinstance(node,ast.Expr) and isinstance(node.value,ast.Call) and ((isinstance(node.value.func,ast.Name) and node.value.func.id=='reveal_management') or (isinstance(node.value.func,ast.Attribute) and node.value.func.attr=='reveal_management'))
class StripMenuSetup(ast.NodeTransformer):
    def visit_Expr(self,node):return None if reveal(node) else self.generic_visit(node)
    def visit_If(self,node):
        # Only the newly inserted conditional backup precondition; all previous branches remain.
        if not node.orelse and len(node.body)==1 and reveal(node.body[0]):return None
        return self.generic_visit(node)
    def visit_FunctionDef(self,node):
        if node.name in ['reveal_management','open_records']:return None
        return self.generic_visit(node)
menu_names=['browser.py','ai055_browser.py','connect039_browser.py','flow049_browser.py','flow083_browser.py','flow090_browser.py','pc12_browser.py','select035_browser.py']
preserved=[]
for name in menu_names:
    path='app/continuity/tests/'+name
    old=tree(git('show','HEAD:'+path));now=StripMenuSetup().visit(tree((root/path).read_bytes()))
    assert ast.dump(old)==ast.dump(now),name+' changed beyond menu setup'
    preserved.append({'file':path,'originalASTAfterRemovingOnlyNamedMenuSetup':'EXACT'})
workflow='.github/workflows/verify.yml';old=git('show','HEAD:'+workflow);now=(root/workflow).read_bytes()
begin=now.index(b'      - name: WORKSPACE19 ');end=now.index(b'      # Sentinels',begin)
inserted=now[begin:end]
assert now[:begin]+now[end:]==old,'existing workflow bytes changed'
assert len(inserted.splitlines())==7
assert inserted.count(b'python continuity/tests/workspace19_browser.py')==1
changed=git('diff','--name-only').decode().splitlines()+git('ls-files','--others','--exclude-standard').decode().splitlines()
files=[]
for path in changed:
    if path.startswith('app/continuity/tests/') or path==workflow:
        data=(root/path).read_bytes();files.append({'path':path,'bytes':len(data),'sha256':sha(data)})
source=[]
for path in ['app/continuity/src/client/app.ts','app/continuity/public/styles.css','app/continuity/public/index.html']:
    data=(root/path).read_bytes();source.append({'path':path,'sha256':sha(data)})
checks=[]
for path in sorted(evidence.glob('*.exit.json')):
    item=json.loads(path.read_text(encoding='utf-8'));checks.append({'label':path.name.removesuffix('.exit.json'),'rawReceipt':item})
receipt={
 'head':git('rev-parse','HEAD').decode().strip(),'role':'test author; product source belongs to separate UI author',
 'contract':'https://github.com/tlsee0813-cmd/agentflow-studio/blob/3668f23a25bf055eb98f8512727ce7acb0945669/docs/cycles/2026-10-22-workspace-records-19/INPUT.md',
 'testFiles':files,'matchingFrozenProductSource':source,'menuOnlyOriginalAST':preserved,
 'workflow':{'originalBytesPreserved':True,'addedLines':7,'originalCRLF':old.count(b'\r\n'),'newStepSha256':sha(inserted)},
 'structuralAdaptations':[
  {'files':['pc13_browser.py','spatial102_browser.py'],'change':'Old check-list details became the same exact record identities in the existing bounded side reader. Open via native check-summary; assertions keep counts/types/exact report/task/current state/caller focus.'},
  {'files':['pc13_browser.py'],'change':'Mutually exclusive area/records modes replace impossible simultaneous panes. Second RB-to-A departure names exact R and reads its root A, keeping original A/R/RB manual and unsent-target assertions. Native measured body wheel retains full clipping and elementFromPoint hit tests; returns do not repair scroll.'},
  {'files':['pc13_browser.py'],'change':'Map tools are checked in selected-area, selected-records, area-after-records-close and closed modes; real zoom/fit and all prior geometry/card conditions remain.'}
 ],
 'newFlows':[
  '1280x720 and 1440x900: normal import/receipt notices observed separately; identical absent-notice name condition for records1-to6 height; actual map zoom/fit/card hit; native wheel/key body; exact reading caller; no saved writes; unsaved A vs B records; same-entry Home reading memo.',
  'Both PCs: first records caller -> exact owner -> relations -> actual stored endpoint -> actual new request/clipboard handoff -> explicit first records return. Verify raw clipboard/digest/UTF16/id/body/anchor, source prefix, areas, positions, camera/selection/folds/caller clip/anchor/current task. Re-enter the exact R1 owner to establish a live excursion, verify its records return control remains through explicit fit, then unrelated B info must end that origin and B task reading/return must restore its own actual caller, never R1.',
  'Both PCs: complete long name and saved purpose read with native End; exact source text, unsaved editor draft, readonly close focus/state; deep report row legitimately consumed by next request returns to heading with visible reason, no fake/other report focus.'
 ],
 'fixtureBoundaries':'AREA18 bounded source-linked analyst reconstructions reused, not original users hierarchy plans. New tasks/reports/long strings are explicitly synthetic and claim no real external execution. Existing domain/import/export routes generate data; actual UI imports recovery/return files.',
 'runtime':'Node v24.19.0 supplementary; TS5.8.3 locked existing dependencies. Browser runner is native HTTP Chromium + explicit MOCK only when separately run in Cloud/CI.',
 'checks':checks,'notRun':['browser tests','local server','paid provider','unit suite (shared domain unchanged)'],
 'failureHistory':'workspace19-workflow-diffcheck exit1 was all-CRLF insertion trailing CR whitespace; raw logs retained. Final workflow preserves all original bytes, inserts seven LF lines, and diffcheck exit0. Initial receipt collector workspace19-test-freeze exit1 was a KeyError for another author receipt format; collector repaired and final exit0. No product/browser failure or pass is inferred from these tooling checks.',
 'gitWrites':'No commit, push or index writes. Parent publishes frozen source + tests.',
}
(evidence/'TEST_FINAL.json').write_text(json.dumps(receipt,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
(evidence/'tests-tracked.patch').write_bytes(git('diff','--',workflow,'app/continuity/tests'))
snapshot=evidence/'frozen-test-sources';snapshot.mkdir(exist_ok=True)
for item in files:
    destination=snapshot/item['path'];destination.parent.mkdir(parents=True,exist_ok=True);destination.write_bytes((root/item['path']).read_bytes())
print(json.dumps({'receipt':str(evidence/'TEST_FINAL.json'),'testFiles':len(files),'menuASTExact':len(preserved),'workflowExistingBytesExact':True,'browser':'NOT RUN','server':'NOT STARTED'},ensure_ascii=False))
