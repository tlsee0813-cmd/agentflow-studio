from pathlib import Path
import os,sys,shutil,json,hashlib,subprocess,datetime
R=Path(__file__).parent;repo='/workspace/agentflow-studio';A=Path('/workspace/browser-env/branch31-author-fix2/candidate/app');module=A/'continuity/dist/public/shared';N='/workspace/browser-env/tools/node_modules/.bin/node';head='72940a043d7a7fdc225a9582ce48831fa0418cc0';sha=lambda b:hashlib.sha256(b).hexdigest();utc=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();g=lambda *x:subprocess.check_output(['git','-C',repo,*x])
def index(d):return {str(p.relative_to(d)):{'bytes':p.stat().st_size,'sha256':sha(p.read_bytes())} for p in sorted(d.rglob('*')) if p.is_file()}
original=R/'input-original';copy=R/'validation-copy';assert not copy.exists();shutil.copytree(original,copy);(R/'results').mkdir(exist_ok=True)
originalBefore=index(original);copyBefore=index(copy);binding=json.loads((R/'integration-binding/SOURCE_MATCH.json').read_text());source=[]
for row in binding['sourceMatches']:
 data=(A/Path(row['path']).relative_to('app')).read_bytes();remote=g('show',head+':'+row['path']);assert data==remote and sha(data)==row['sha256'];source.append({**row,'executedSourceCommit':head,'actualSourceByteEqual':True,'gitBlob729':g('rev-parse',head+':'+row['path']).decode().strip()})
compiled=[]
for row in binding['compiledBinding']:
 data=(module/row['file']).read_bytes();assert len(data)==row['bytes'] and sha(data)==row['sha256'];compiled.append({**row,'actualCompiledEqual':True})
appTree=g('rev-parse',head+':app').decode().strip();assert appTree=='00267e7cc9b913305dccc063c6439cb1ffd302f3'
(R/'EXECUTION_BINDING.before.json').write_text(json.dumps({'UTC':utc(),'source':head,'appSubtree':appTree,'rootReportedMerge':'75ed2ed7 (not fetched/CI queried here)','bindingCommit':'27dee9b05ef4a034b2df1f98b3484d2a21acca09','inputCommit':'24baf91fa2d519fd8cd33bb5ece28ec5b32323df','NodeVersion':subprocess.check_output([N,'--version']).decode().strip(),'moduleRoot':str(module),'source8':source,'compiled8':compiled,'originalInputFilesBefore':originalBefore,'validationCopyBefore':copyBefore},indent=2))
rows=[]
for label,cmd in [('verify-domain',[N,str(copy/'verify.mjs'),'--module-root',str(module),'--receipt',str(R/'results/domain-receipt.json')]),('verify-signals',[N,str(copy/'verify-signals.mjs'),'--module-root',str(module)])]:
 start=utc();p=subprocess.run(cmd,cwd=copy,capture_output=True)
 (R/'results'/ (label+'.stdout.log')).write_bytes(p.stdout);(R/'results'/(label+'.stderr.log')).write_bytes(p.stderr);rows.append({'label':label,'command':cmd,'cwd':str(copy),'startUTC':start,'endUTC':utc(),'actualChildReturnCode':p.returncode,'stdoutSHA256':sha(p.stdout),'stderrSHA256':sha(p.stderr)});print(label,p.returncode,flush=True)
originalAfter=index(original);assert originalAfter==originalBefore
copyAfter=index(copy);delta=[k for k in set(copyBefore)|set(copyAfter) if copyBefore.get(k)!=copyAfter.get(k)]
shutil.copyfile(copy/'generated-v0/sealed-answer/QUESTION_SIGNAL_PROOF.json',R/'results/QUESTION_SIGNAL_PROOF.Node22.json')
for row in compiled:assert sha((module/row['file']).read_bytes())==row['sha256']
(R/'EXECUTION_BINDING.after.json').write_text(json.dumps({'UTC':utc(),'originalInputUnchanged':True,'validationCopyChanged':delta,'compiledModulesBeforeAfterEqual':True,'receiptOutsideInput':str(R/'results/domain-receipt.json')},indent=2));(R/'process.json').write_text(json.dumps({'commands':rows,'actualCollectorExitDecision':int(any(x['actualChildReturnCode'] for x in rows))},indent=2));sys.exit(int(any(x['actualChildReturnCode'] for x in rows)))
