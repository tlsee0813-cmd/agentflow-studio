import difflib,hashlib,json,subprocess
from pathlib import Path
root=Path(__file__).resolve().parents[1];out=root/'evidence';author=root.parent/'product20-author'
checks=out/'afc-patch-check-base';checks.mkdir(exist_ok=True)
patch=[]
for path,original in [
 ('app/continuity/tests/received20_browser.py',(out/'v1-3DDE-before-no-export/frozen-test-sources/app/continuity/tests/received20_browser.py').read_bytes()),
 ('app/continuity/tests/understanding17_browser.py',(out/'originals/understanding17_browser.py').read_bytes())
]:
    current=(root/path).read_bytes();dest=checks/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(original)
    patch.append(''.join(difflib.unified_diff(original.decode().splitlines(True),current.decode().splitlines(True),fromfile='a/'+path,tofile='b/'+path)))
path=out/'received20-afc-followup.patch';path.write_text(''.join(patch),encoding='utf-8',newline='')
subprocess.run(['git','apply','--check',str(path)],cwd=checks,check=True)
guard=[]
for name in ['spatial102_browser.py','report16_browser.py']:
    path='app/continuity/tests/'+name;actual=(author/path).read_bytes();baseline=subprocess.check_output(['git','-C',str(author),'show','HEAD:'+path])
    assert actual==baseline,(name,'existing protected regression changed')
    guard.append({'file':path,'sha256':hashlib.sha256(actual).hexdigest().upper(),'exactHEADBytes':True})
(out/'AFC_FOLLOWUP_PROOF.json').write_text(json.dumps({
 'priorCandidate':'afc3fbe0dd444d92560aacdd4292f20627826d79',
 'originalFailure':'https://github.com/tlsee0813-cmd/agentflow-studio/blob/2309aec1b2caafb67e7842a6ca925342dd5064fa/docs/transfer/received-result-20/independent-v0/failure-first/NOTE.md',
 'priorSnapshot':'evidence/v1-3DDE-before-no-export','changedFiles':['app/continuity/tests/received20_browser.py','app/continuity/tests/understanding17_browser.py'],
 'protectedOriginalRegressions':guard,'patchApplyCheck':0,
 'changes':['Initial reader action geometry is recorded without scrolling; ordinary native reach then retains full clipping/hit assertions. This does not establish every action is initially visible.','After changed-C return, current/focus checks happen first; normal compose/result-file summary opening prepares the next receipt read. Same-B caller/open/position assertions are unchanged.','No-file report has no export block/H/four-value/raw-file fallback, even if that pasted report itself later exported H1/H2. Actual neutral missing-context line is read under its existing recorded path.','AREA17 duplicate wording matches the new concise message while exact raw report identity, prior record count, entire saved state and T/A/H/duplicate metadata are checked.'],
 'independentStaticReview':'Astra directly verified final hashes F489370D…C853E and7F5B7AC…9265B2; no actionable issue in this narrow change. No browser/AST execution by that reviewer claimed.',
 'limits':'Initial action can fall below the first fold for these long/busy inputs, an observed product reading-space limitation. Original6-failure run remains a failure; future11-method success not claimed. Server/browser not run locally.'
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'incrementalPatchCheck':0,'protectedRegressionsExact':guard,'browser':'NOT RUN','server':'NOT STARTED'}))
