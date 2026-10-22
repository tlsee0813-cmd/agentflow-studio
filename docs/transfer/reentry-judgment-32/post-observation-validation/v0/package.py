from pathlib import Path
import csv,json,hashlib,shutil
R=Path(__file__).parent;P=R/'payload';P.mkdir(exist_ok=True);sha=lambda b:hashlib.sha256(b).hexdigest()
for n in ['run-validation.py','compare.py','package.py','EXECUTION_BINDING.before.json','EXECUTION_BINDING.after.json','process.json','POST_COMPARISON.json','REPORT.md']:
 shutil.copyfile(R/n,P/n)
shutil.copytree(R/'results',P/'results',dirs_exist_ok=True)
for n in ['api.mjs','verify.mjs','verify-signals.mjs']:
 q=P/'exact-helpers'/n;q.parent.mkdir(exist_ok=True);shutil.copyfile(R/'input-original'/n,q)
(P/'INPUT_REFERENCE.json').write_text(json.dumps({'inputCommit':'24baf91fa2d519fd8cd33bb5ece28ec5b32323df','inputPrefix':'docs/transfer/reentry-judgment-32/input-v0','bindingCommit':'27dee9b05ef4a034b2df1f98b3484d2a21acca09','bindingPrefix':'docs/transfer/reentry-judgment-32/integration-binding-v0','originalFullGeneratedInputNotDuplicated':True,'toolAndInputHashes':'EXECUTION_BINDING.before.json originalInputFilesBefore','firstObservationCommitImmutable':'57896a27266c20b21ac1c3b2a94ba27ca7294eec'},indent=2))
(P/'OUTER_EXIT_RECEIPT.json').write_text(json.dumps({'scope':'tool completion metadata transcribed, not full tool transcript','validationCollector':{'chunk':'42acdc','actualOuterExit':0,'bothActualChildExit':'process.json commands[].actualChildReturnCode'},'postComparison':{'chunk':'8f50b0','actualExit':0},'browserOrServer':'NOT_RUN in this post-validation assignment'},indent=2))
with (P/'MANIFEST.tsv').open('w') as f:
 w=csv.writer(f,delimiter='\t',lineterminator='\n');w.writerow(['path','bytes','sha256'])
 for q in sorted(P.rglob('*')):
  if q.is_file() and q.name!='MANIFEST.tsv':b=q.read_bytes();w.writerow([str(q.relative_to(P)),len(b),sha(b)])
print(len([p for p in P.rglob('*') if p.is_file()]))
