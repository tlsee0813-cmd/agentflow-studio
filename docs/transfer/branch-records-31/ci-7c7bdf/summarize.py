"""보존한 Code Review 응답만 정리한다. 원격 조회나 제품 실행은 하지 않는다."""
from pathlib import Path
import base64, gzip, hashlib, json, re

HERE=Path(__file__).resolve().parent
HEAD='7c7bdfa8d244d83c2c776b91b6a3a669127ba2e9'
RUN=39859870103
PREFIX='docs/transfer/branch-records-31/ci-7c7bdf/'
def info(b):
    return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gitBlob':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()}

records=[]; originals=sorted((HERE/'raw').glob('*.json'))
for path in originals:
    data=json.loads(path.read_bytes().decode('utf-8'))
    for item in data if isinstance(data,list) else [data]:
        response=item.get('response',item.get('result',{}));s=response.get('structuredContent') or {}
        if s.get('headRevision'):assert s['headRevision']==HEAD
        records.append({'source':path.name,'requestedAt':item.get('requestedAt',item.get('time')),'returnedAt':item.get('returnedAt',item.get('time')),'args':item['args'],'response':response})

jobs=[]
for item in records:
    s=item['response'].get('structuredContent') or {}
    if not isinstance(s.get('log'),str):continue
    j=s.get('job') or {};assert j.get('head_sha',HEAD)==HEAD
    lines=[re.sub(r'\x1b\[[0-9;]*m','',x).rstrip('\r') for x in s['log'].splitlines()]
    suites=[];active=None
    for i,line in enumerate(lines):
        command=re.search(r'\bpython ([\w/.-]+\.py)\b',line)
        if command:active=command.group(1)
        ran=re.search(r'Ran (\d+) tests? in ([0-9.]+)s',line)
        if ran:
            end=next((v for v in lines[i+1:i+7] if re.search(r'Z (OK|FAILED \(.*\))$',v)),None)
            suites.append({'script':active,'tests':int(ran.group(1)),'seconds':float(ran.group(2)),'ranLine':line,'outcomeLine':end});active=None
    failures=[i for i,x in enumerate(lines) if re.search(r'Z (FAIL:|ERROR:)',x)]
    jobs.append({'source':item['source'],'requestedAt':item['requestedAt'],'returnedAt':item['returnedAt'],'job':j,
      'logTruncated':s.get('logTruncated'),'characters':len(s['log']),'firstReturnedLine':lines[0] if lines else None,'lastReturnedLine':lines[-1] if lines else None,
      'unitSummaryLines':[x for x in lines if re.search(r'Z # (tests|pass|fail|cancelled|skipped) \d+$',x)],
      'browserSuites':suites,'visibleBrowserSuiteCount':len(suites),'visibleBrowserTests':sum(v['tests'] for v in suites),
      'branch31IndividualLines':[x for x in lines if re.search(r'\(__main__\.BranchRecords31(Wide)?\.',x) and re.search(r'\.\.\. (ok|FAIL|ERROR)$',x)],
      'viewport30IndividualLines':[x for x in lines if re.search(r'\(__main__\.Viewport30(Wide)?\.',x) and re.search(r'\.\.\. (ok|FAIL|ERROR)$',x)],
      'area17IndividualLines':[x for x in lines if re.search(r'\(__main__\.Area17(Wide)?\.',x) and re.search(r'\.\.\. (ok|FAIL|ERROR)$',x)],
      'failureTraces':[lines[i:i+50] for i in failures],
      'processExitLines':[x for x in lines if 'Process completed with exit code' in x],
      'actualNodeVersionLines':[x for x in lines if re.search(r'Z v\d+\.\d+\.\d+$',x)],
      'browserInstallLines':[x for x in lines if re.search(r'Successfully installed .*playwright-|Chromium .* downloaded',x)]})

summary={'headRevision':HEAD,'runId':RUN,'pullRequest':'https://github.com/tlsee0813-cmd/agentflow-studio/pull/16',
 'tool':'mcp__code_review__pull_requests_checks only','account':'모든 요청에서 account 미지정 유지; 반환 계정 없음',
 'states':[{'source':i['source'],'requestedAt':i['requestedAt'],'returnedAt':i['returnedAt'],'checks':s.get('checks'),'jobs':s.get('jobs')} for i in records if (s:=i['response'].get('structuredContent') or {}).get('checks') or s.get('jobs')],
 'annotations':[{'source':i['source'],'annotations':s['annotations'],'hasMore':s.get('hasMore')} for i in records if (s:=i['response'].get('structuredContent') or {}).get('annotations')],
 'readErrors':[{'source':i['source'],'returnedAt':i['returnedAt'],'content':i['response'].get('content'),'ciFailure':False} for i in records if i['response'].get('isError')],
 'jobs':jobs,
 'limitations':['최종 상태 메타데이터와 실제 보이는 로그 구간을 구분한다. 잘린 구간을 직접 확인했다고 주장하지 않는다.',
 '31은 합성 domain fixture, 30은 정상 UI로 만든 합성 백업을 정상 복구로 여는 회귀이며 독립 정상 UI 관측과 다르다.',
 '작성자 검사는 Tab 접근 자체·진입 직후 첫 소유자 글줄·같은 세션의 신호 소멸을 모두 입증하지 않는다.',
 '설치 로그, workflow 설정, 실제 실행 버전과 미회수 artifact를 구분한다. Actions API/CLI 우회와 artifact 회수는 하지 않았다.']}
(HERE/'CI_FINAL.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
packed=[]
for path in originals:
    raw=path.read_bytes();data=base64.b64encode(gzip.compress(raw,mtime=0)).decode('ascii');assert gzip.decompress(base64.b64decode(data))==raw
    packed.append({'name':path.name,'format':'gzip+base64','original':info(raw),'data':data})
(HERE/'RAW_TOOL_RESPONSES.json').write_text(json.dumps({'description':'Code Review 원응답 JSON의 무손실 압축','responses':packed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
names=['REPORT.md','CI_FINAL.json','RAW_TOOL_RESPONSES.json','summarize.py']
manifest={'prefix':PREFIX,'headRevision':HEAD,'runId':RUN,'files':[{'path':n,**info((HERE/n).read_bytes())} for n in names],
 'rawOriginals':[{'path':p.name,**info(p.read_bytes())} for p in originals]}
(HERE/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');names.append('MANIFEST.json')
tree=[];expected=[]
for name in names:
    raw=(HERE/name).read_bytes();content=raw.decode('utf-8');assert content.encode('utf-8')==raw
    tree.append({'path':PREFIX+name,'mode':'100644','type':'blob','content':content});expected.append({'path':PREFIX+name,'utf8RoundTrip':True,**info(raw)})
payload=json.dumps({'tree_elements':tree},ensure_ascii=False,indent=2)+'\n'
(HERE/'upload-tree-ci-7c7bdf.json').write_text(payload,encoding='utf-8')
actual_payload=(HERE/'upload-tree-ci-7c7bdf.json').read_bytes()
(HERE/'expected-blobs-ci-7c7bdf.json').write_text(json.dumps({'headRevision':HEAD,'count':len(tree),'payload':info(actual_payload),'files':expected},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'jobs':[{'job':j['job'],'suites':j['visibleBrowserSuiteCount'],'tests':j['visibleBrowserTests'],'branch31':len(j['branch31IndividualLines']),'viewport30':len(j['viewport30IndividualLines']),'area17':len(j['area17IndividualLines']),'failures':len(j['failureTraces'])} for j in jobs],'payload':info(actual_payload)},ensure_ascii=False,indent=2))
