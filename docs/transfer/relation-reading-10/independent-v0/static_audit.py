from pathlib import Path
import subprocess,re,json,hashlib,difflib
root=Path(__file__).resolve().parent
old=subprocess.check_output(['git','-C','/workspace/agentflow-studio','show','08a04afb7515efc5f4007b5d9bf5bb787c908c20:docs/transfer/mixed-reading-09/author-fix1/mixed-reading-study.html']).decode();new=(root/'site/relation-reading-study.html').read_text()
assert hashlib.sha256(old.encode()).hexdigest()=='90141c4c5cfc509cafef3c038a9c1c14f0062f7e009e4359f5f97bd5541e3173'
expected={'F1':('L52','#L52'),'F2':('L10','#L10'),'F3':('L11','#L11'),'F4':('L12','#L12'),'F5':('L13','#L13'),'F6':('L14 · L55','#L14'),'F7':('L15','#L15'),'F8':('L16','#L16'),'F9':('L17','#L17'),'F10':('L18–22','#L18-L22'),'F11':('L33–41','#L33-L41')}
facts={k:{'line':l,'anchor':a} for k,l,a in re.findall(r"(F\d+):\{l:'([^']+)',a:'([^']+)'",new)}
checks={k:{'expected':{'line':v[0],'anchor':v[1]},'actual':facts.get(k),'match':facts.get(k)=={'line':v[0],'anchor':v[1]}} for k,v in expected.items()}
def fn(s,n):
 start=s.index('function '+n+'(');m=re.search(r'\nfunction \w+\(',s[start+1:]);return s[start:start+1+m.start()] if m else s[start:]
functions={}
for n in ['buildMap','syncSize','applyLayout','applyScale','zoom','applyDepth','wrect','bundles','drawEdges','enterFocus','returnAll','defaults']:
 a=fn(old,n);b=fn(new,n);functions[n]={'oldSHA256':hashlib.sha256(a.encode()).hexdigest(),'newSHA256':hashlib.sha256(b.encode()).hexdigest(),'identical':a==b}
blocks={}
for name,end in [('FACTS','/* 보기용'),('N','const ORDER'),('RELS','const STEPS')]:
 extract=lambda s:s[s.index('const '+name+'='):s.index(end,s.index('const '+name+'='))]
 a=extract(old);b=extract(new);blocks[name]={'oldSHA256':hashlib.sha256(a.encode()).hexdigest(),'newSHA256':hashlib.sha256(b.encode()).hexdigest(),'identical':a==b}
result={'method':'Read-only source comparison against pinned cycle09 (not UI execution). Explicit F line+anchor literals, not a regex-shape-only acceptance. No application JS executed.','fixedFactExpectations':checks,'sourceFunctionComparison':functions,'dataBlocks':blocks,'pass':all(x['match'] for x in checks.values()) and all(x['identical'] for x in functions.values()) and all(x['identical'] for x in blocks.values())}
(root/'static-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));(root/'source09-to10.diff').write_text(''.join(difflib.unified_diff(old.splitlines(True),new.splitlines(True),fromfile='pinned-cycle09',tofile='pinned-cycle10')));print(json.dumps({'pass':result['pass'],'differentFunctions':[n for n,v in functions.items() if not v['identical']]}));assert result['pass']
