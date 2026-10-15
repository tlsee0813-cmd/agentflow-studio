# Static source check, separate from browser navigation/reading.
from pathlib import Path
import re,json,hashlib
root=Path(__file__).resolve().parent;s=(root/'site/relation-reading-study.html').read_text();base=re.search(r"const SRC='([^']+)'",s)[1]
expectedBase='https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md'
expected={'F1':('L52','#L52'),'F2':('L10','#L10'),'F3':('L11','#L11'),'F4':('L12','#L12'),'F5':('L13','#L13'),'F6':('L14 · L55','#L14'),'F7':('L15','#L15'),'F8':('L16','#L16'),'F9':('L17','#L17'),'F10':('L18–22','#L18-L22'),'F11':('L33–41','#L33-L41')};actual={k:(l,a) for k,l,a in re.findall(r"(F\d+):\{l:'([^']+)',a:'([^']+)'",s)}
rows=[]
for k,(line,anchor) in expected.items():
 l,a=actual[k];rows.append({'id':k,'expectedLine':line,'actualLine':l,'expectedHref':expectedBase+anchor,'actualConstructedHref':base+a,'pass':line==l and expectedBase+anchor==base+a})
result={'method':'Static all-F literal line+exact constructed href comparison; not merely #L-number pattern; not external navigation or source reading in browser. Actual UI link checks separately present in browser xref and F1 peek records.','sourceSHA256':hashlib.sha256(s.encode()).hexdigest(),'rows':rows,'pass':all(x['pass'] for x in rows)};(root/'fact-href-audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2));assert result['pass'];print('Static all 11 F line/href literals matched')
