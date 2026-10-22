from pathlib import Path
import subprocess,json,hashlib,os
R=Path(__file__).parent;repo='/workspace/agentflow-studio';sha='e37e7ced35a9202513dace327ed6f48330cec6a7';A=R.parent/'cycle18-fix1-candidate';rows=[]
g=lambda *args:subprocess.check_output(['git','-C',repo,*args])
for name in g('ls-tree','-r','--name-only',sha,'--','app','experiments/idea016/cases.mjs').decode().splitlines():
 b=g('show',sha+':'+name);f=A/name;disk=f.read_bytes();rows.append({'path':name,'gitBytes':len(b),'gitSha256':hashlib.sha256(b).hexdigest(),'afterBytes':len(disk),'afterSha256':hashlib.sha256(disk).hexdigest(),'equal':disk==b})
assert all(x['equal'] for x in rows)
report={'sourceCommit':sha,'sourceURL':'https://github.com/tlsee0813-cmd/agentflow-studio/tree/'+sha,'sourceArchive':'git archive exact object; initial per-file before snapshot not separately collected; pinned git blob versus after bytes comparison below','files':rows,'contractCommit':'df7283fd3fe2fe88ab17e93c175a6e84c0d0f655','researchCommit':'7bea120983c3571b26164d6acd40f350611a7213','candidateVersusBa9Diff':g('diff','--stat','ba9bf6e477f6cf36d1a056b3db218c98bf8bf26e',sha).decode(),'paidCalls':0,'fixtureSetup':'Offline public domain APIs, normal UI import. Source-restated authored sample data reused with synthetic additions; independent assertions/normal browser actions separate. No user data.'}
(R/'SOURCE_BINDING.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(len(rows),'git-after files identical')
