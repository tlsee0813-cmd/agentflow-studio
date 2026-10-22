from pathlib import Path
import json
r=Path(__file__).parent
runs={'exactPC12_02_11':json.loads((r/'exact-tests/process.json').read_text())['actualChildExit'],'controlledDelaySemanticGate':json.loads((r/'delay/judge.process.json').read_text())['actualChildExit'],'REPORT16Candidate':json.loads((r/'report16/candidate/process.json').read_text())['actualChildExit'],'REPORT16Original729':json.loads((r/'report16/original729/process.json').read_text())['actualChildExit']}
(r/'FINAL_GATE.json').write_text(json.dumps({'runs':runs,'normalUI':'two learned screen-first rounds completed; two preparation errors retained','overall':'FAIL: controlled-delay automatic reveal after view roundtrip; REPORT16 first-screen action regression','notCombinedAssertionCount':True},indent=2))
assert runs['exactPC12_02_11']==0
assert runs['controlledDelaySemanticGate']==0 and runs['REPORT16Candidate']==0,'Product boundaries failed; preserve independent failures'
