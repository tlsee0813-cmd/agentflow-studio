from pathlib import Path
import json,hashlib,subprocess,datetime
R=Path(__file__).parent;A=R.parent/'cycle20-fix1-candidate';S='df726e5898f24e23d69e47651d3bf6cbea302412';repo='/workspace/agentflow-studio';sha=lambda b:hashlib.sha256(b).hexdigest();old=json.loads((R.parent/'cycle20-fix1-independent/SOURCE_BEFORE.json').read_text());rows=[]
for f in old['files']:
 b=(A/f['path']).read_bytes();h=sha(b);assert h==f['sha256'];rows.append({'path':f['path'],'beforeSHA256':f['sha256'],'afterSHA256':h,'bytes':len(b)})
for name in ['INPUT.md','RESEARCH.md']:
 b=subprocess.check_output(['git','-C',repo,'show',f'9df67057595ff85322c238de55ffe2f5d820d950:docs/cycles/2026-10-23-blank-project-21/{name}']);(R/name).write_bytes(b)
(R/'SOURCE_BINDING.json').write_text(json.dumps({'source':S,'sourceTree':subprocess.check_output(['git','-C',repo,'rev-parse',S+'^{tree}']).decode().strip(),'contract':'9df67057595ff85322c238de55ffe2f5d820d950','existingPreparedSourceBefore':'cycle20-fix1-independent/SOURCE_BEFORE.json (same immutable prepared source used, no rebuild in cycle21)','sourceFiles':rows,'HTTP':'runtime.json actual response.body bytes/SHA + loaded disk SHA, no stub/fetch replacement','observedUTC':datetime.datetime.now(datetime.timezone.utc).isoformat()},indent=2))
rs=[json.loads(x) for x in (R/'actions.jsonl').read_text().splitlines()];steps=[]
def step(width,goal,seq,classification,expect,actual,note=''):
 steps.append({'width':width,'goal':goal,'actionSeq':seq,'classification':classification,'expected':expect,'actual':actual,'notes':note})
step(1280,'홈에서 정상 새 프로젝트',[1,2,3,4,5,6],'화면 탐색 후 선택','프로젝트 0개 홈→새 프로젝트','Tab으로 내 프로젝트 선택 후 ＋ 새 프로젝트. 초기 임시 작업 화면은 홈 이동으로 벗어남','동일 이름 내 프로젝트 버튼 2개 중 키보드 초점으로 탐색. 소스/selector 도움 아님')
step(1280,'목적 한 번 입력',[7,8,9],'화면 탐색 후 선택','정확 목적 저장 후 영역 나누기','목적 입력 1회. 전체 공간의 프로젝트 목적에서 재확인')
step(1280,'두 독립 부분',[10,11,12,13,14,15],'화면 탐색 후 선택','예약/알림 모두 독립','첫 추가 후 계속 열린 전역 폼으로 알림 추가','두 번째 추가는 같은 실행에서 학습한 경로. 메뉴 숨김 결함으로 판단하지 않음')
step(1280,'예약의 정확한 하위 추가',[16,17,18,19,20,21,22],'화면 탐색 후 선택','예약→예약 가능 여부 포함','예약 정보→더보기 · 하위 부분과 소속→실제 패널 wheel→추가','panel wheel에서 documentY0 유지, 추가 버튼 y734.17→314.17. 初행 사람 아님')
step(1280,'작성자 오타 정상 UI 정정',[23,24,25],'화면 탐색 후 선택','구상 첫 단어를 같은으로','입력한 同じ 오타를 이름·구상 고치기에서 직접 수정','제품 데이터 변조/오류 아님, 원본 입력 이력 보존')
step(1280,'자식에서 알림의 명시 관계',[26,27,28,29,30,31,32,33],'화면 탐색 후 선택','child→알림 · 이어서 사용','관계 적기 폼에서 실제 양끝/유형/설명 지정','관계 폼은 아래쪽. wheel과 보통 locator click의 자동 보조 스크롤은 actions pre/postY로 구분')
step(1280,'정확한 자식 요청',[34,35,36,37,38,39,40],'기존 지식으로 선택','예약 가능 여부에만 요청 생성','전체 맞춤→자식 정보→이 영역에 새 요청. 선택 combobox에서 자식 확인 후 전송','목적 재입력/복사 없음. 목적은 앞 지도에서, 현재 부분은 panel 경로/요청 combobox에서 확인')
step(1280,'실제 파일 결과용 인계',[41,42,43,44,45,46,47],'화면 탐색 후 선택','일반 복사가 아닌 실제 H/anchor 기록','초기 주 버튼은 일반 작업문 복사. 2회 wheel 후 결과를 파일로 받기 선택→파일 결과용 복사','이전 검증에서 H 구별을 아는 작업자. 초기 y1782.02의 선택 항목을 AX에서도 찾아 목적을 이해한 것이며 블라인드 발견성 아님')
step(1280,'템플릿 기반 합성 파일',[],'경로 도움 후 수행','실제 export project/task/H/area/basedOn 그대로','UI 클립보드의 두 JSON 예시를 해석해 return.2 생성','명시 허용된 외부 합성 파일 생성. 앱 소스/프로젝트 주입 아님. 실제 AI/실행 없음. UI 발견성 평가에서 제외')
step(1280,'확인 후 정상 수신',[48,49,50,51,52,53],'화면 탐색 후 선택','미리보기→이 결과 가져오기→이 결과 검토','seq51은 수신 확정 전 검토 버튼을 먼저 찾은 작업자 오류(timeout). 화면 확인 후 정상 가져오기','타임아웃은 원형 보존. 최종 완주로 최초 오류를 삭제하지 않음')
step(1280,'현재 구상/설명/보고/당시 사본 구분',[54,55,56],'화면 탐색 후 선택','사용자 note 유지, 합성 current 설명 반영, 실제 T/H 사본','화면 좌우 구상/외부 설명/선택 보고 표시; 당시 작업문을 실제 펼친 뒤 네 값 텍스트 대조','PNG는 구상/설명/보고. 당시 네 값 전부가 동시에 viewport에 보인다고 주장하지 않음')
step(1280,'같은 자식 후속 요청과 실제 인계',[57,58,59,60,61,62,63,64],'기존 지식으로 선택','새 C child 대상/H새로 생성/설명 귀속 보존','빈 요청을 직접 작성·전송하고 파일용 클립보드 복사','작업 수 3/currentC/anchor child/동일 목적/외부 설명 실제 clipboard 대조')
step(1280,'지도 복귀',[65,66,67],'기존 지식으로 선택','새 작업을 취소하지 않고 지도 표시','전체 공간 breadcrumb 정상 이동, currentC/목적/포함/관계 보존','정확한 origin 카메라 복원 단언 아님. 선택/좌표 실제값은 raw')
step(1440,'전체 흐름 학습 후 재현',list(range(68,128)),'기존 지식으로 선택','별도 빈 프로젝트에 같은 UI 흐름 재현','정상 새 프로젝트·목적 1회·두 root+child+관계·실제 두 인계·합성 수신·후속 C·지도','1280에서 배운 재현. 별도 JSON/storage 주입 없음. 초기 발견성과 합산하지 않음')
step(1440,'복귀 뒤 명시 맞춤',[128,129,130],'기존 지식으로 선택','원래 복귀 상태와 새 fit 분리','복귀 직후 자식 화면 밖 관측 보존. 추가 전체 맞춤 후 3이름 표시','1440-map-after-explicit-fit.png는 추가 조작 후 화면. 자동 복원/처음부터 전체 노출 증거 아님')
(R/'STEPS.json').write_text(json.dumps({'observer':'existing implementation/verification knowledge; not first-time human/blind observation','sourceSelectorConsultation':'None during action choice. All UI targets were roles/names/text from current AX; no selector commands used. Offline post-observation stored-state/schema reading distinguished.','steps':steps},ensure_ascii=False,indent=2))
(R/'ACTUAL_EXIT.json').write_text(json.dumps({'actualExternalCollectorExit':0,'actualChildExit':json.loads((R/'process.json').read_text())['actualChildExit'],'externalToolSession':97634,'verificationCommand':['/workspace/browser-env/venv/bin/python',str(R/'verify-observations.py')],'verificationActualExit':0,'syntheticTemplateGenerationActualExit':{'1280':0,'1440':0},'closeoutActualExitRecordedByTool':0,'boundary':'selected command completion record, not full tool transcript; actionErrors separately retained'},indent=2))
print('source unchanged; classifications and exact completion boundaries saved')
