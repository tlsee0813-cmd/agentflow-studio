"""Code Review로 보존한 응답만 정리·압축한다. 원격 CI 읽기나 제품 실행 없음."""
from pathlib import Path
import base64, gzip, hashlib, json, re

HERE=Path(__file__).resolve().parent
HEAD='aa0938ecbe96ec5fdb15eb4783e865bf7ab70c7b'
RUN=39849822053
PREFIX='docs/transfer/work-reference-29/ci-aa0938/'
def info(b):return {'bytes':len(b),'sha256':hashlib.sha256(b).hexdigest(),'gitBlob':hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()}
files=sorted(HERE.glob('[0-9][0-9][0-9]-*.json'))
jobs=[];states=[];annotations=[];read_errors=[]
for file in files:
    w=json.loads(file.read_bytes().decode('utf-8'));s=w['response'].get('structuredContent') or {}
    if w['response'].get('isError'):read_errors.append({'source':file.name,'requestedAt':w['requestedAt'],'returnedAt':w['returnedAt'],'args':w['args'],'content':w['response'].get('content'),'ciFailure':False})
    if s.get('headRevision'):assert s['headRevision']==HEAD
    if s.get('jobs'):states.append({'source':file.name,'requestedAt':w['requestedAt'],'returnedAt':w['returnedAt'],'jobs':s['jobs']})
    if s.get('annotations'):annotations.append({'source':file.name,'checks':s.get('checks'),'annotations':s['annotations'],'hasMore':s.get('hasMore')})
    if not isinstance(s.get('log'),str):continue
    j=s.get('job') or {};assert j.get('head_sha',HEAD)==HEAD
    lines=[re.sub(r'\x1b\[[0-9;]*m','',x).rstrip('\r') for x in s['log'].splitlines()]
    suites=[];active=None
    for i,line in enumerate(lines):
        command=re.search(r'\bpython ([\w/.-]+\.py)\b',line)
        if command:active=command.group(1)
        ran=re.search(r'Ran (\d+) tests? in ([0-9.]+)s',line)
        if ran:
            end=next((v for v in lines[i+1:i+6] if re.search(r'Z (OK|FAILED \(.*\))$',v)),None)
            suites.append({'script':active,'tests':int(ran.group(1)),'seconds':float(ran.group(2)),'ranLine':line,'outcomeLine':end});active=None
    failure=next((i for i,x in enumerate(lines) if re.search(r'Z (FAIL:|ERROR:)',x)),None)
    jobs.append({'source':file.name,'requestedAt':w['requestedAt'],'returnedAt':w['returnedAt'],'job':j,'logTruncated':s.get('logTruncated'),'characters':len(s['log']),
      'firstReturnedLine':lines[0] if lines else None,'lastReturnedLine':lines[-1] if lines else None,
      'unitSummaryLines':[x for x in lines if re.search(r'Z # (tests|pass|fail|cancelled|skipped) \d+$',x)],
      'browserSuites':suites,'visibleBrowserSuiteCount':len(suites),'visibleBrowserTests':sum(v['tests'] for v in suites),
      'visiblePassingBrowserTests':sum(v['tests'] for v in suites if v['outcomeLine'] and v['outcomeLine'].endswith(' OK')),
      'new29IndividualLines':[x for x in lines if 'WorkDescription29' in x and re.search(r'\.\.\. (ok|FAIL|ERROR)$',x)],
      'new29Suite':next((v for v in suites if v['script']=='continuity/tests/work-description29_browser.py'),None),
      'area17IndividualLines':[x for x in lines if re.search(r'\(__main__\.Area17(Wide)?\.',x) and re.search(r'\.\.\. (ok|FAIL|ERROR)$',x)],
      'area17Suite':next((v for v in suites if v['script']=='continuity/tests/understanding17_browser.py'),None),
      'processExitLines':[x for x in lines if 'Process completed with exit code' in x],
      'firstFailureTrace':lines[failure:failure+44] if failure is not None else [],
      'actualNodeVersionLines':[x for x in lines if re.search(r'Z v\d+\.\d+\.\d+$',x)],
      'browserInstallLines':[x for x in lines if re.search(r'Successfully installed .*playwright-|Chromium .* downloaded',x)]})
assert len(jobs)==2
assert all(j['job']['status']=='completed' and j['job']['conclusion']=='success' for j in jobs)
for j in jobs:
    assert j['visibleBrowserSuiteCount']==24 and j['visibleBrowserTests']==238 and j['visiblePassingBrowserTests']==238
    assert j['new29Suite']['tests']==8 and len(j['new29IndividualLines'])==8 and all(x.endswith(' ok') for x in j['new29IndividualLines'])
    assert j['area17Suite']['tests']==12 and len(j['area17IndividualLines'])==12 and all(x.endswith(' ok') for x in j['area17IndividualLines'])
    assert any(x.endswith('# tests 275') for x in j['unitSummaryLines']) and any(x.endswith('# pass 275') for x in j['unitSummaryLines']) and any(x.endswith('# fail 0') for x in j['unitSummaryLines'])
    assert j['browserSuites'][-2]['script']=='continuity/tests/blank21_browser.py' and j['browserSuites'][-1]['script']=='continuity/tests/static_browser.py'
    assert not j['firstFailureTrace']
summary={'pullRequest':'https://github.com/tlsee0813-cmd/agentflow-studio/pull/15','headRevision':HEAD,'runId':RUN,
 'overall':'양 OS completed/success','finalStatusSource':'010-jobs-status.json',
 'tool':'mcp__code_review__pull_requests_checks만 사용','account':'명시 계정이 없었고 반환 계정도 없었다. 모든 요청에 같은 선택 생략과 정확 head를 유지했다.',
 'stateQueries':states,'jobs':jobs,'annotations':annotations,'readErrors':read_errors,
 'coveredBehavior':['실제 편집 B와 compose/지도 A의 귀속 구분','첫 U 입력 뒤 DOM·초점·선택·읽기 보존과 stale 상태/인계 제외','같은 pin의 늦은 정확 H 보고 수신 뒤 body 위치·같은 원문 Range 보존','명시 재열기 때 초기화·새 판본 선택','작업/프로젝트 전환과 held-only 승격 방지','기존 AREA17 파일 인계·정확 부분·요청·복귀 양PC'],
 'scopeRisks':['고정 1280×720/1440×900의 합성 회귀 경로이며 임의 배치·모든 목적 길이·모든 화면 조합을 보장하지 않는다.','단일 body 보존은 설명·구상·텍스트 source-raw 범위다. JSON 원문 textarea의 모든 내부 스크롤 보존을 검증하지 않는다.','표시와 연결·보존·명시 조작을 검증하며 사용자 의도와 외부 보고 사이의 의미 충돌 자동 해결이나 실제 AI 품질을 판정하지 않는다.'],
 'limitations':['각 logTruncated 및 첫/끝 반환 줄을 확인해야 한다. 잘린 앞부분의 단위·실행 버전·개별 결과를 직접 읽었다고 주장하지 않는다.',
 '설치된 Playwright/Chromium 로그와 실제 browser.version() 환경 artifact는 구별한다. artifact를 다운로드하지 않았다.',
 '작성자29는 합성 domain fixture→정상 UI 복구 회귀이며, 별도 Cloud 정상 UI 관측·실제 AI 의미 품질 수용과 구별한다.',
 '원709e의 AREA17 실패와 Cloud 최초 prep/중첩 스크롤/재열기 실패는 별도 고정돼 있다. 이번 결과로 과거 실패를 덮지 않는다.',
 '소스 수정·로컬 서버/브라우저·수동 재실행·원격 쓰기·GitHub Actions API/CLI fallback은 하지 않았다.']}
(HERE/'CI_FINAL.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
packed=[]
for file in files:
    raw=file.read_bytes();data=base64.b64encode(gzip.compress(raw,mtime=0)).decode('ascii');assert gzip.decompress(base64.b64decode(data))==raw
    packed.append({'name':file.name,'format':'gzip+base64','original':info(raw),'data':data})
(HERE/'RAW_TOOL_RESPONSES.json').write_text(json.dumps({'description':'요청 시각·인수와 Code Review 원응답 JSON의 무손실 압축. 원본 중복 업로드 제외.','responses':packed},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report='# PR15 fix4 CI 독립 확인\n\n'+f'Head `{HEAD}`, run{RUN}. 원709e와 별개 run만 추적했으며 계정 선택과 반환 head를 유지했다.\n\n'
for j in jobs:
    report+=f"- {j['job'].get('name')}: {j['job'].get('status')}/{j['job'].get('conclusion')}. 로그 {j['characters']}자, 잘림 {j['logTruncated']}. 반환 구간의 브라우저 {j['visibleBrowserSuiteCount']}묶음·{j['visibleBrowserTests']}개 중 Ran/OK {j['visiblePassingBrowserTests']}개.\n"
report+='\n신규971의 개별 메서드와 AREA17 양 PC 줄·suite Ran/종료 결과는 CI_FINAL.json에 실제 보이는 원문으로 기록했다. 나머지 browser군과 단위 집계도 같은 방식으로 구분했다. 실패가 있으면 첫 traceback과 실제 종료 코드를 보존하며, 보이지 않는 뒤 단계는 실행 통과로 세지 않는다.\n\n이 결과는 같은 번들의 자동 회귀 범위다. 정상 UI를 별도로 준비한 Cloud 관측, 사용성·공간 가독성 또는 AI 의미 품질 판정을 대신하지 않는다. 잘린 실제 Node 실행 버전이나 미회수 환경 artifact를 workflow 설정값으로 대신하지 않았다. upload-artifact의 Node 경고도 제품 실행 버전과 구별한다.\n\nraw 도구응답은 RAW_TOOL_RESPONSES.json의 gzip+base64를 해제해 원문과 해시를 확인할 수 있다. 제품·검사 파일은 변경하지 않았다.\n'
report+='\n양 OS 모두 continuity275/pass275/fail0과 브라우저24묶음238개 Ran/OK를 직접 확인했다. 신규971은 각8개의 개별 ok이며, AREA17도 양PC 개별12개와 suite OK다. BLANK21 뒤 static까지 이어졌고 이번 run에서 첫 실패는 관측되지 않았다.\n\n검증 범위는 실제 편집 대상 귀속, 첫 U 입력의 DOM·초점·선택·읽기 보존, stale 안내와 인계 제외, 같은 pin의 늦은 보고 수신 후 위치·동일 Range 보존, 명시 재열기 초기화와 새 판본 선택이다. held-only와 작업·프로젝트 전환 경계도 포함한다. source-raw 텍스트의 단일 body 읽기를 다루며 JSON 원문 textarea의 모든 내부 위치까지 보장하지 않는다. 임의의 모든 긴 자료·배치·창 크기나 실제 AI 의미 품질의 수용으로 확대하지 않는다.\n\n두 원로그는 각120000자 tail이다. 초기 실제 Node 실행 버전 줄은 잘렸고, Playwright1.57.0 설치와 Chromium143.0.7499.4 build1200 다운로드만 직접 보인다. 각 check의 annotation은 upload-artifact의 Node20 폐기/Node24 강제 실행 warning 한 건이다. Ubuntu 진행 중 로그 요청 한 번은 HTTP502였고, 간격을 둔 최종 요청은 성공했다. 읽기 오류는 원응답으로 남기며 CI 실패나 수동 재실행으로 세지 않는다.\n'
(HERE/'REPORT.md').write_text(report,encoding='utf-8')
names=['REPORT.md','CI_FINAL.json','RAW_TOOL_RESPONSES.json','summarize.py']
manifest={'prefix':PREFIX,'headRevision':HEAD,'runId':RUN,'files':[{'path':name,**info((HERE/name).read_bytes())} for name in names],
 'rawOriginals':[{'path':file.name,**info(file.read_bytes())} for file in files]}
(HERE/'MANIFEST.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');names.append('MANIFEST.json')
tree=[];expected=[]
for name in names:
    raw=(HERE/name).read_bytes();content=raw.decode('utf-8');assert content.encode('utf-8')==raw
    tree.append({'path':PREFIX+name,'mode':'100644','type':'blob','content':content});expected.append({'path':PREFIX+name,'utf8RoundTrip':True,**info(raw)})
payload=json.dumps({'tree_elements':tree},ensure_ascii=False,indent=2)+'\n'
(HERE/'upload-tree-ci-aa0938.json').write_text(payload,encoding='utf-8')
(HERE/'expected-blobs-ci-aa0938.json').write_text(json.dumps({'headRevision':HEAD,'count':len(tree),'payload':info(payload.encode('utf-8')),'files':expected},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'headRevision':HEAD,'jobs':[{'job':j['job'],'new29':j['new29Suite'],'area17':j['area17Suite']} for j in jobs],'payload':info(payload.encode('utf-8'))},ensure_ascii=False,indent=2))
