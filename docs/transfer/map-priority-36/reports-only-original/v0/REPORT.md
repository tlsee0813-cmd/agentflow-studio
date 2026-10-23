# 36 원후보: 보고만 있을 때 기록 입구 누락 재현

제품 `c0a7c91c54d62166140081b149d94bc6efa9f1f9`, 1280×720, Node22.16.0 / TS5.8.3 / Playwright1.57.0 / Chromium154.0.8037.57에서 재현했다. 제품·검사 단언·폰트·사용자 저장값을 바꾸지 않았다. 다른 PC/전체36/광범위 회귀는 미실행이다.

## 관측/예상

작은 정상 API 표본 P > L 및 L—O(관계만)를 만들었다. 세 요청 모두 기존 MOCK 응답의 question=null을 확인했고 설명은 없었다. L/O의 실제 domain handoffText/exportAnchor/markHandoff template를 파일로 보존했다. project는 공개 API로만 생성·parseProject 재로딩됐으며 필드 직접 변형은 없다. 정상 backup chooser로 가져온 뒤 L/O의 understanding:null return.2 두 파일을 실제 선택·미리보기·명시 가져오기했다. 후속 요청을 작성하지 않았으므로 두 보고 모두 ‘후속 작업문 없는 보고’로 남는다. return.1 별도 순열은 미실행이다.

예상: 경고 네 이유는 없어도 기존 reader에 실제 소유 보고가 있으므로 말단 L과 접힌 부모 P의 generic 기록 읽기 입구가 존재해야 한다. 관측: 두 버튼 모두 count0. 별도 경고가 없는 것은 정상이며 이를 문제로 세지 않는다.

반면 말단의 ‘정보’→기존 기록 details에는 정확 L 보고 행이 있고 실제 버튼 fullclip/center-hit=true다. 그 행으로 보고 reader를 열어 고유 report 원문까지 읽었다. 정확 pointed report는 `T_1d2b4436-68ff-43c1-b58a-aced9f7989f7`, parent `T_729160c8-583d-4310-bc83-fd2897630e72`, H `H_SYN36_REPORT_ONLY_L`이다.

부모 P를 정상 접은 뒤 정보 패널의 소유 행 집합도 정확 L 하나다. O 보고 `T_1b5a348c-bd52-40ea-8274-dfd90f4feb47` / H `H_SYN36_REPORT_ONLY_O`는 제외됐다. 부모 패널 캡처에서 행은 하단과 일부 겹치므로 버튼 전체 노출 성공이라 하지 않는다(center-hit=true, fullclip=false). 실제 owner 글줄·보고 ID/텍스트와 API 소유 집합이 일치한다. leaf/parent 모두 새 카드 입구가 없다는 반례는 이 부분 노출과 별개다.

공개 projection 재검산: P reports1(L), L reports1, O reports1. 세 범위 질문0/현재·보류 설명0이고 readingReasons는 모두 records=false다. 관계는 범위를 넓히지 않는다. ‘기록 있음’에서 reports를 누락한 정적 원인과 실제 표시가 일치한다.

## 보존과 종료

현재 요청 P `T_5600f927-d961-488b-ba78-3508d7d13609`와 직접입력 manual4를 비롯해 원래 세 task 전체가 두 수신 뒤에도 동일했다. 보고는 새 task2개로만 추가됐다. 읽기 전후 project 전체 동일, 카메라 동일. raw snapshot에 reportId/parent/current/manual4/원보고/source/H를 보존했다.

수집 child0·outer0, pageerror0. 예상 가시성 단언은 별도 gate actual child1·outer1로 보존했다. 이를 전부 통과로 합치지 않는다. 정적 server -15는 수집 후 의도적 종료다. HTTP 실제 body↔실행 disk 전후 hash와 git source↔disk 종료후 일치를 확인했다.

준비 오류도 별도 보존했다. 첫 실행은 continuity만 빌드해 상위 diagnostics 모듈이 없어 child/outer1; 정상 root build 후 해결했다. 다음 수집은 부모 접힘으로 DOM에서 제거된 자식에 bbox를 요구해 timeout child/outer1; 숨은 자식은 card:null로 관측하도록 준비코드만 교정했다. 제품/입구 기대는 불변이다. 최종 수집 성공과 원후보 제품 실패를 분리한다. 그림은 최종 실제1280 PNG2장이다.

## 수정본 재사용

`sample/project.json`, `sample/return-L.json`, `sample/return-O.json`, `sample/FACTS.json`을 그대로 재사용할 수 있다. generator는 공개 API recipe이며 원 sample을 다시 생성하면 UID가 달라지므로 고정 비교는 sample 파일을 사용한다. `check.py`는 REPORT36_APP으로 대상 실행폴더 선택 가능, 의미 기대는 `gate.py`에 고정했다. 현재 source 라벨은 원후보이므로 후속 실행 binding은 별도로 연결해야 한다.

MANIFEST는 자신 제외 정확 파일집합. 원시 JSON은 무손실 gzip·원hash·해제동일성으로 보존했다. main/checkpoint/product/배포 변경 없음. 최종 수용은 총괄 판단이다.
