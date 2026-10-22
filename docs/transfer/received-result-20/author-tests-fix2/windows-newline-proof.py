"""Static file-boundary reproduction, not File.text/browser execution.

Explicit newline= simulates Python Windows text writing on any OS. Actual
fixture bytes are decoded exactly as UTF8; no product or downloaded bytes are
normalized. The textarea API expectation follows the WHATWG LF representation.
"""
import ast,difflib,hashlib,json,subprocess,sys,tempfile
from pathlib import Path

root=Path(__file__).resolve().parents[1];out=root/'evidence'
path='app/continuity/tests/received20_browser.py'
original=(out/'v2-F489-before-windows-newlines/frozen-test-sources'/path).read_bytes()
current=(root/path).read_bytes()
assert hashlib.sha256(original).hexdigest().upper()=='F489370D8A945908EB0F0506570831C515EDB353BC55DA9396D2CA51527C853E'
old=ast.parse(original.decode());new=ast.parse(current.decode())
functions=lambda tree:{n.name:n for n in ast.walk(tree) if isinstance(n,ast.FunctionDef)}
oldf,newf=functions(old),functions(new)
assert oldf.keys()==newf.keys()
for name in oldf:
    if name not in ('select','read_original'):assert ast.dump(oldf[name])==ast.dump(newf[name]),name
assert ast.unparse(newf['select'].body[-1])=="return path.read_bytes().decode('utf-8')"
assert len(oldf['select'].body)==len(newf['select'].body)
assert [ast.dump(x) for x in oldf['select'].body[:-1]]==[ast.dump(x) for x in newf['select'].body[:-1]]
changed=[(a,b) for a,b in zip(oldf['read_original'].body,newf['read_original'].body) if ast.dump(a)!=ast.dump(b)]
assert len(changed)==1
assert "raw.replace('\\r\\n', '\\n').replace('\\r', '\\n')" in ast.unparse(changed[0][1])
assert 'input_value()' in ast.unparse(changed[0][1])
# Thus full saved raw/actual downloaded UTF8 byte checks and all other test bodies stay exact.
assert (root/'app/continuity/tests/understanding17_browser.py').read_bytes()==(out/'v2-F489-before-windows-newlines/frozen-test-sources/app/continuity/tests/understanding17_browser.py').read_bytes()

mode=sys.argv[1];observations=[]
with tempfile.TemporaryDirectory(prefix='received20-newlines-') as folder:
    before_write=json.dumps({'report':'원문\n두 번째 줄','returnId':'H-fixed'},ensure_ascii=False,indent=2)
    for name,newline in [('WindowsCRLF','\r\n'),('LF','\n')]:
        file=Path(folder)/(name+'.json')
        with file.open('w',encoding='utf-8',newline=newline) as handle:handle.write(before_write)
        actual_bytes=file.read_bytes();actual_text=actual_bytes.decode('utf-8')
        expected=before_write if mode=='old' else file.read_bytes().decode('utf-8')
        records=[{'id':'exact-T','resultFile':{'rawText':actual_text}}]
        lookup=next((t['id'] for t in records if t['resultFile']['rawText']==expected),None)
        api_value=actual_text.replace('\r\n','\n').replace('\r','\n')
        item={'case':name,'preWriteText':before_write,'actualUTF8Bytes':list(actual_bytes),'actualDecodedText':actual_text,
              'oldPreWriteExpectedMatches':actual_text==before_write,'newByteDecodedExpectedMatches':actual_text==file.read_bytes().decode('utf-8'),
              'selectedExpectedMatches':actual_text==expected,'exactReportLookup':lookup,'downloadBytesMatch':actual_bytes==expected.encode('utf-8'),
              'textareaAPIValue':api_value,'textareaExpectedMatches':api_value==expected.replace('\r\n','\n').replace('\r','\n')}
        observations.append(item);print(json.dumps(item,ensure_ascii=False),flush=True)
        assert actual_text==expected,'old pre-write LF expectation differs from actual Windows CRLF file'
        assert lookup=='exact-T' and actual_bytes==expected.encode('utf-8')
        assert api_value==expected.replace('\r\n','\n').replace('\r','\n')
    # Representation pairs remain distinguishable as stored/raw bytes even though textarea API displays LF.
    for raw in ['{\r\n}', '{\n}', '{\r}']:
        api=raw.replace('\r\n','\n').replace('\r','\n')
        assert api=='{\n}' and raw.encode('utf-8').decode('utf-8')==raw
    assert b'{\r\n}'!=b'{\n}'!=b'{\r}'

workflow_path='.github/workflows/verify.yml'
workflow_original=(out/'v2-F489-before-windows-newlines/frozen-test-sources'/workflow_path).read_bytes()
workflow_current=(root/workflow_path).read_bytes()
assert hashlib.sha256(workflow_original).hexdigest().upper()=='D1F5A36DF849E4457B8DF2DFCB5CB0394566A924F5690FE18BF4593F0B564177'
assert workflow_current==workflow_original.replace(b'    timeout-minutes: 15',b'    timeout-minutes: 25',1)
patch=''.join(difflib.unified_diff(original.decode().splitlines(True),current.decode().splitlines(True),fromfile='a/'+path,tofile='b/'+path))
patch+=''.join(difflib.unified_diff(workflow_original.decode().splitlines(True),workflow_current.decode().splitlines(True),fromfile='a/'+workflow_path,tofile='b/'+workflow_path))
(out/'received20-windows-newlines.patch').write_text(patch,encoding='utf-8',newline='')
check=out/'windows-patch-check-base';dest=check/path;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(original)
workflow_dest=check/workflow_path;workflow_dest.parent.mkdir(parents=True,exist_ok=True);workflow_dest.write_bytes(workflow_original)
subprocess.run(['git','apply','--check',str(out/'received20-windows-newlines.patch')],cwd=check,check=True)
(out/'WINDOWS_NEWLINE_PROOF.json').write_text(json.dumps({
 'actualCI':'df726 Windows: 11 raw mismatch failures and 2 exact-raw lookup StopIteration errors; original evidence in sibling product20-author-evidence/ci-df726-windows-readonly/tool-response.json (truncated=true).',
 'priorFreeze':'evidence/v2-F489-before-windows-newlines','changedPublicationFiles':[path,workflow_path],'cases':observations,
 'representationRule':'Only textarea input_value expectation uses LF API representation. Stored resultFile.rawText, exact T lookup, downloaded UTF8 bytes remain exact actual selected-file text/bytes.',
 'textareaSpecification':'https://html.spec.whatwg.org/multipage/form-elements.html#concept-textarea-api-value',
 'independentReview':'Astra directly compared final Received20 2F9FBF172A2CBEB08804E7BB08A8E63921420673A2C7A1639EA5F5B44F5499E8 and workflow FEEB099E62666F8D795DE828AC3C638F961D8FF05E30EAE0466334937B4B2131 against preserved F489/D1F5. Exactly two browser-test lines and one job-budget line; static clean. Reviewer did not run browser/proof script.',
 'unchangedAREA17':'Compact json.dumps fixture has no literal line endings; string newlines are JSON escapes. Original 7F5 snapshot and file retained byte-for-byte.',
 'staticScope':'Python actual file IO + explicit Windows newline translation; does not execute File.text, browser, product, server or textarea. Textarea LF expectation is specification-based.',
 'workflowBudget':{'fromMinutes':15,'toMinutes':25,'otherBytesExactD1F5':True,'observedWindows':'df726 job began about15:28; RECEIVED20 beganabout15:41:18 and failedafter35.530s at15:41:54, leaving little budget of15min.','observedCloud':'Successful RECEIVED20 took314s,15:29:19 to15:34:33.','rationale':'Adding about5min of successful test progress to the old13min elapsed Windows stage exceeds15min. Only job budget is increased; tests, assertions and parallelization unchanged. Timings supplied/verified by root, not newly executed here.'},
 'patchApplyCheck':0,'sourceASTOnlySelectReturnAndTextareaExpectationChanged':True
},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'mode':mode,'staticFileBoundaryProof':'PASS','patchApplyCheck':0,'browser':'NOT RUN','server':'NOT STARTED'}))
