"""로컬에 보존한 Code Review 응답만 정리한다. 네트워크/CI 대체 조회 없음."""
from pathlib import Path
import base64, datetime, gzip, hashlib, json, re

HERE=Path(__file__).resolve().parent
HEAD='709e402b2e44a4864139eda03201e186f5761c6f'
PREFIX='docs/transfer/work-reference-29/ci-709e/'
def read(name):return json.loads((HERE/name).read_bytes().decode('utf-8'))
def info(raw):return {'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'gitBlob':hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()}
raw_files=[p for p in sorted(HERE.glob('[0-9][0-9][0-9]-*.json'))]
jobs=[];annotations=[]
for path in raw_files:
    wrapper=read(path.name);s=wrapper['response'].get('structuredContent') or {}
    if s.get('headRevision'):assert s['headRevision']==HEAD
    if s.get('annotations'):annotations.append({'source':path.name,'requestedAt':wrapper['requestedAt'],'returnedAt':wrapper['returnedAt'],'checks':s.get('checks'),'annotations':s['annotations'],'hasMore':s.get('hasMore')})
    log=s.get('log')
    if not isinstance(log,str):continue
    job=s.get('job') or {};assert job.get('head_sha',HEAD)==HEAD
    lines=[re.sub(r'\x1b\[[0-9;]*m','',x).rstrip('\r') for x in log.splitlines()]
    suites=[];active=None
    for i,line in enumerate(lines):
        command=re.search(r'\bpython ([\w/.-]+\.py)\b',line)
        if command:active=command.group(1)
        ran=re.search(r'Ran (\d+) tests? in ([0-9.]+)s',line)
        if ran:
            outcome=next((v for v in lines[i+1:i+6] if re.search(r'Z (OK|FAILED \(.*\))$',v)),None)
            suites.append({'script':active,'tests':int(ran.group(1)),'seconds':float(ran.group(2)),'ranLine':line,'outcomeLine':outcome});active=None
    first=next((i for i,x in enumerate(lines) if re.search(r'Z (FAIL:|ERROR:)|\.\.\. (FAIL|ERROR)$',x)),None)
    trace=next((i for i,x in enumerate(lines) if re.search(r'Z (FAIL:|ERROR:)',x)),None)
    jobs.append({'source':path.name,'requestedAt':wrapper['requestedAt'],'returnedAt':wrapper['returnedAt'],'job':job,
      'logTruncated':s.get('logTruncated'),'characters':len(log),'firstLine':lines[0] if lines else None,'lastLine':lines[-1] if lines else None,
      'unitSummaryLines':[x for x in lines if re.search(r'Z # (tests|pass|fail|cancelled|skipped) \d+$',x)],
      'browserSuites':suites,'visibleBrowserTests':sum(x['tests'] for x in suites),'visibleBrowserSuiteCount':len(suites),
      'work29IndividualLines':[x for x in lines if 'WorkDescription29' in x and re.search(r'\.\.\. (ok|FAIL|ERROR)$',x)],
      'work29Suite':next((x for x in suites if x['script']=='continuity/tests/work-description29_browser.py'),None),
      'work29Status':'NOT_RUN: 기존 AREA17 단계 exit1 뒤 신규29 명령/개별 결과 없음' if not any('python continuity/tests/work-description29_browser.py' in x for x in lines) else '로그 참조',
      'afterArea17NotRun':['WORK29','AREA18','WORKSPACE19','RECEIVED20','BLANK21','static'] if any(x['script']=='continuity/tests/understanding17_browser.py' and x['outcomeLine'] and 'FAILED' in x['outcomeLine'] for x in suites) else [],
      'failureExcerpt':lines[max(0,first-2):first+24] if first is not None else [],
      'firstFailureTrace':lines[trace:trace+42] if trace is not None else [],
      'processExitLines':[x for x in lines if re.search(r'Process completed with exit code|exit code [1-9]',x)],
      'actualNodeVersionLines':[x for x in lines if re.search(r'Z v\d+\.\d+\.\d+$',x)],
      'browserInstallLines':[x for x in lines if re.search(r'Successfully installed .*playwright-|Chromium .* downloaded',x)],
      'runtimeLimit':'browser.version() 환경 artifact는 이 도구로 회수하지 않았다. 설치 기록·action Node 경고·제품 실행 버전을 구분한다.'})
summary={'pullRequest':'https://github.com/tlsee0813-cmd/agentflow-studio/pull/15','headRevision':HEAD,'runId':39843851282,
 'finalStatusSource':'007-jobs-status.json','overall':'양 OS completed/failure: 기존 AREA17 test06 양PC first-line readable 실패',
 'tool':'mcp__code_review__pull_requests_checks만 사용','account':'처음 계정을 지정하지 않았고 응답도 계정을 반환하지 않았다. 모든 후속 읽기에 같은 선택 생략과 정확 head를 유지했다.',
 'rawSources':[p.name for p in raw_files],'jobs':jobs,'annotations':annotations,
 'limitations':['logTruncated가 true인 로그는 반환된 tail만 확인한 것이다. 보이지 않는 앞부분 단위/버전/개별 검사 통과를 직접 확인했다고 하지 않는다.',
 '작성자 신규29 회귀는 합성 domain fixture→정상 복구 파일을 사용하는 검사다. 별도 Cloud 정상 UI 관측이나 실제 AI 의미 품질 검증과 구분한다.',
 'GitHub Actions API/CLI/artifact 대체 조회, 로컬 서버/브라우저, source 수정, 원격 쓰기, rerun/merge는 하지 않았다.']}
(HERE/'CI_FINAL.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
packed=[]
for path in raw_files:
    raw=path.read_bytes();content=base64.b64encode(gzip.compress(raw,mtime=0)).decode('ascii');assert gzip.decompress(base64.b64decode(content))==raw
    packed.append({'name':path.name,'format':'gzip+base64','original':info(raw),'data':content})
(HERE/'RAW_TOOL_RESPONSES.json').write_text(json.dumps({'description':'시각·요청 인수·도구 응답을 보존한 JSON 원문의 무손실 압축. 원문 중복 업로드 제외.','responses':packed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
rows=[]
for j in jobs:
    rows.append(f"- {j['job'].get('name')}: {j['job'].get('status')}/{j['job'].get('conclusion')}. 반환 {j['characters']}자, 잘림 {j['logTruncated']}. 브라우저 Ran 구간 {j['visibleBrowserSuiteCount']}개·{j['visibleBrowserTests']}개 검사.")
report='# PR15 정확 후보 CI 확인\n\n'+f'Head `{HEAD}`, run39843851282. Code Review의 지정 도구로 읽은 원문과 시간·인수를 보존했다.\n\n'+'\n'.join(rows)+'''

양 OS 모두 기존 AREA17의 test_06_locate_new_request_copy_and_return가 두 PC 클래스에서 실패했다. understanding17_browser.py:362의 #work-locate-return 첫 글줄이 viewport 안에서 가리지 않고 읽히는지 확인하는 단언이 false였다. AREA17은 12개 중 2실패·exit1이며, 신규29 8개는 양 OS에서 NOT_RUN이다. AREA18·WORKSPACE19·RECEIVED20·BLANK21·static도 이후 명령이 실행되지 않았다. 별도 Cloud에서 실행한 신규29 결과와 혼합하지 않는다.

반환 tail에서 continuity 단위275/pass275/fail0을 직접 확인했다. AREA17 앞의 브라우저17묶음186개는 Ran/OK이며, AREA17을 포함한 실행 합계는18묶음198개·2실패다. 실패 traceback에는 rect/scroll/hit 측정값이 없어 route 소실, 가림 또는 준비 전제를 여기서 단정하지 않는다. 원 장면의 실제 기하를 별도 관측하는 것이 최소 다음 단계다. 기존 단언을 완화하거나 소스를 수정하지 않았다.

각 로그는120000자 tail로 잘렸다. 초기 실제 Node 실행 버전 줄은 보이지 않는다. Playwright1.57.0 설치와 Chromium143.0.7499.4 build1200 다운로드는 보이지만 browser.version() 환경 artifact는 회수하지 않았다. 양 OS annotation은 exit1 한 건과 upload-artifact의 Node20 폐기·Node24 강제 실행 warning 한 건씩이다. action 경고를 제품의 Node 버전 증거로 쓰지 않는다.

실제 줄·첫 실패 traceback·종료 코드는 CI_FINAL.json에 기록했다. 원문 응답은 RAW_TOOL_RESPONSES.json에서 무손실 gzip+base64로 복원할 수 있다. source-raw 내부 스크롤 소실과 신규29 prep 실패에 관한 Cloud 관측은 별개이며, 이 CI는 신규29 단계까지 도달하지 않았다.

로컬 서버·브라우저·제품 수정·원격 쓰기·수동 재실행은 하지 않았다.
'''
(HERE/'REPORT.md').write_text(report,encoding='utf-8')
names=['REPORT.md','CI_FINAL.json','RAW_TOOL_RESPONSES.json','summarize.py']
manifest={'prefix':PREFIX,'headRevision':HEAD,'files':[{'path':n,**info((HERE/n).read_bytes())} for n in names],'rawOriginals':[{'path':p.name,**info(p.read_bytes())} for p in raw_files]}
(HERE/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');names.append('MANIFEST.json')
tree=[];expected=[]
for name in names:
    raw=(HERE/name).read_bytes();content=raw.decode('utf-8');assert content.encode('utf-8')==raw
    tree.append({'path':PREFIX+name,'mode':'100644','type':'blob','content':content});expected.append({'path':PREFIX+name,'utf8RoundTrip':True,**info(raw)})
payload=json.dumps({'tree_elements':tree},ensure_ascii=False,indent=2)+'\n'
(HERE/'upload-tree-ci29.json').write_text(payload,encoding='utf-8')
(HERE/'expected-blobs-ci29.json').write_text(json.dumps({'headRevision':HEAD,'count':len(tree),'payload':info(payload.encode('utf-8')),'files':expected},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'headRevision':HEAD,'jobs':[{'job':j['job'],'work29Suite':j['work29Suite'],'firstFailure':j['failureExcerpt'][:4]} for j in jobs],'uploadFiles':len(tree),'payload':info(payload.encode('utf-8'))},ensure_ascii=False,indent=2))
