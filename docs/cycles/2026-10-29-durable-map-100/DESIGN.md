# 100 로컬 지도 정리 작업의 보관과 복구

기준:98/99 공유본033ef84.99에서 선택한 기존 PC 로컬 Node 소유 경로를 구현한다. 공개73·미수용74·UI75/693d0c7·97·98을 보존하며 전체 첫 지도 의미/시간 수용과 구별한다.

사용자는 정리를 요청하고 다른 프로젝트를 편집하거나 창을 다시 열 수 있다. 같은 작업의 상태와 완료 결과를 회수하며, 돌아와 반영할 때 생성 요청을 다시 보내지 않는다. PC의 실행기가 종료됐다면 완료를 꾸미지 않고 중단됐음을 알린다.

## 계약

- Node 전용 작업 서비스가 로컬 디스크에 접수·결과·terminal 상태를 내구 기록한다. 기존 Worker 모듈에 Node 의존성을 넣지 않는다. 기능은 실제 준비된 로컬 서버만 광고하고, Worker/정적/구형 서버는97 경로를 유지한다. 저장 불가를 메모리 성공으로 속이지 않는다.
- 브라우저가 전송 전에 안정operation ID·회수 권한·원 entry/project/lifecycle·기준seq·prompt/model·입력결속을 저장한다. 접수 응답 상실·이중클릭·두탭·재조회가 같은 작업의 중복 provider 호출로 이어지지 않는다. 새 작업으로의 자동 fallback/재시도는 없다.
- 서버가 내구 접수를 마친 후에만 접수됐다고 응답한다. HTTP 연결 종료와 실행 취소를 분리한다. 내구 취소가 늦은 ready를 이기며, 원격 계산/과금 중단 보장은 하지 않는다. 검증된 원 wire와 정확 요청·해시·안정 reading meta를 내구 ready에 보관하고 같은 operation으로 조회한다. 키는 기록/클라이언트/로그에 넣지 않는다.
- MapInput의 Map·기록 좌표·parts/claims/priors·fullRequests·after를 빠뜨리지 않는 검증된 보관/복구 계약이 필요하다. 임의JSON 복사나 현재 바뀐 프로젝트로 재생성해 원 요청을 대체하지 않는다. 잘못된 귀속·스냅샷·결속은 네트워크/반영 전에 거절한다.
- 현재 브라우저 프로젝트 저장이 권위다. 복구 결과는 원 entry/lifecycle에서 명시 반영하며 기존applyReading·원자료·지도·seq 충돌을 유지한다. 프로젝트 저장 성공 후 서버ack가 사라지면 안정reading ID+hash+귀속으로 이미 반영됨을 대조한다. 두 저장소가 분산 원자 transaction이라고 주장하지 않는다.
- Node 재시작 시 내구 ready는 회수한다. 비terminal 실행은 interrupted로 정리하며 원격 실행 여부가 불명한 호출을 자동 재제출하지 않는다. 손상/부분쓰기·동시서버가 기존작업을 덮거나 중복 실행하지 않도록 저장/소유를 검증한다.
- 저장 경로, 원자 쓰기/복구, 작업·바이트·동시성/보관 상한, 조회권한을 구현 전에 이 문서에 구체화한다. 미확인ready를 조용히 evict하지 않는다. 용량/권한 실패를 사용자에게 명확히 보이며 공개파일·백업에는 회수 권한/서버원자료를 섞지 않는다.

## 화면과 검증

기존 정리 버튼/홈 상태에 접수·진행·결과보기·중단·취소 상태를 연결한다. 다른 프로젝트의 초안/역선택/스크롤·원문과자료 읽기 복귀를 유지한다. 새로고침이 재생성이 되지 않고, AI키가현재없어도 이미 보관한결과는원래권한으로회수할수있어야한다. 구현상명칭 대신 사용자가무엇을계속/중단할수있는지 보인다.

새 실제모델은 호출하지 않는다. 기존90초·모델·토큰/의미기준을 유지하고 주입공급자로 요청수·접수영수증상실·ready복구·취소vs완료·프로세스재시작·commit/ack 장애·seq/lifecycle 충돌·잘못된권한을 검증한다. 정상UI 두PC에서 reload/결과반영/다른프로젝트맥락을 확인하고, 총괄은 기존 실제89 수용응답과 원자료를 동일응답재생으로 직접 확인한다. 이는 새생성의미수용이 아니다. 독립코드/반례 및 정확CI를 회수한다.

현재 문서는 구현 전 총괄 계약이다. 구현 결과·실제검증과 한계를 별도 기록한다. 타이머확대·provider/CLI변경·자동모델재시도·환경재설치·계정전환·공개배포는 이 범위에 없다.

## 구현 전 고정 선택 (100 작성자, 코드 작성 전)

아래는 위 계약을 구현하기 위해 코드보다 먼저 고정한 선택이다. 구현 결과와 실제 검증은 별도 `RESULT.md`에 기록한다.

**저장 위치·형식.** `STUDIO_JOBS_DIR`가 있으면 그 디렉터리, 없으면 `app/.studio-data/map-jobs-<port>/`(gitignore, 정적·배포 수집 대상 아님). 브라우저 저장이 origin(포트)별이므로 작업 저장소도 포트별이다. port 0(무작위)이며 경로 지정이 없으면 내구 작업을 광고하지 않는다. `STUDIO_JOBS=off`면 끈다. 작업 하나가 `ops/<MJ_uuid>.json` 한 파일이다: `{format:'agentflow.map-job.1', body, sha256(body JSON)}`. POSIX에서 디렉터리 0700·파일 0600.

**원자 기록·복구.** 같은 디렉터리의 임시 파일에 쓰고 fsync → rename(교체) → (POSIX) 디렉터리 fsync. rename 전 장애의 임시 파일은 접수된 적 없는 것으로 시작 시 지운다(접수 영수증은 rename 후에만 나가므로 provider 호출도 없다). JSON/형식/해시가 맞지 않는 작업 파일은 **손상**으로 남겨 두고 고치지도 지우지도 않는다. 손상 ID의 조회·취소·확인은 `OPERATION_DAMAGED`, 같은 ID 접수는 거절하며 새 작업으로 취급하지 않는다.

**단일 서버 소유.** 저장소를 처음 열 때 `store.json`(무작위 저장소 ID)을 완성된 임시 파일의 hard link로 한 번만 만든다(반쯤 쓴 파일이 보이지 않고 생성자는 하나만 이긴다). 소유 이름은 경로가 아니라 이 저장소 ID에서 만든다: Windows는 named pipe `\\.\pipe\agentflow-map-jobs-<storeId>`, Linux는 같은 이름의 abstract socket이다. 둘 다 OS가 보유하고 프로세스가 죽으면 OS가 풀며, 이미 있으면 `EADDRINUSE`로 거절된다(경로 파일이 남지 않으므로 stale 판정이 없다). 따라서 같은 디렉터리를 symlink·junction·bind mount·다른 드라이브 문자/대소문자로 가리키거나, 서로 다른 포트의 두 서버에 같은 `STUDIO_JOBS_DIR`을 줘도 같은 이름에서 만나 한 소유자만 연다. 기본 경로는 포트별이라 서로 다른 포트는 원래 다른 저장소다. 한계: Linux abstract socket은 network namespace 단위라 서로 다른 컨테이너가 같은 볼륨을 공유하면 막지 못한다(지원 범위 밖). 그 밖의 OS는 `owner.lock`(wx 생성, pid 생존 확인)만 쓰며 약한 보장으로 기록한다. 소유를 못 잡은 두 번째 서버는 `jobs:{durable:false, problem:'STORE_BUSY'}`를 광고하고 작업 경로를 503 `JOB_STORE_UNAVAILABLE`로 거절한다. 그 서버의 화면은 새 정리를 시작하지 않고 이유를 보인다(메모리 대체 없음). 소유자는 시작 시 쓰기 가능함을 확인하고 비terminal 기록을 모두 `interrupted`로 확정한 뒤에만 접수를 연다.

**상태와 전이(단일 writer, 작업별 직렬화).** `accepted → running → ready | failed | cancelled | interrupted`. `ready`는 브라우저 확인(`applied`|`discarded`) 전 삭제·evict하지 않는다. `failed/cancelled/interrupted`는 입력 원자료를 즉시 지우고 상태만 남기며, 브라우저가 본 뒤 `seen`으로 닫는다. 확인된 기록은 **tombstone**(ID·권한 해시·결속 해시·최종 상태·시각)으로 줄여 보관하며 자동 삭제하지 않는다. tombstone ID로 다시 접수하면 같은 결속이면 그 최종 상태를 돌려주고, 다르면 `OPERATION_CONFLICT`. 어느 경우도 provider를 다시 부르지 않는다. 접수 전 취소(영수증 상실 중 취소)도 같은 권한 해시로 `cancelled` tombstone을 먼저 써서 늦게 도착한 접수를 막는다.

**상한.** 동시 실행은 기존 `STUDIO_MAX_CONCURRENT`(기본3)·분당·프로세스 호출 한도를 그대로 쓰는 limiter를 **접수 시 실행 소유로 획득**하고 terminal에서 반납한다. 조회·취소·확인·재접수(같은 ID)는 limiter를 쓰지 않는다. entry당 비terminal 작업 1개(`ENTRY_BUSY`). 확인 안 된 ready 50개, 원자료를 가진 기록 합계 32 MiB, 작업 파일 1개 512 KiB(입력 ≤ 448 KiB, 응답 wire는 기존 128 KiB 한도), 전체 기록 수(tombstone 포함) 10000. 넘으면 새 접수만 `JOB_STORE_FULL`로 명시 거절하고 기존 기록은 건드리지 않는다. 접수 HTTP 본문은 이 경로만 512 KiB(기존 경로 한도 불변). 90초·model·token·prompt 설정은 바꾸지 않는다.

**권한과 조회.** 브라우저가 operation ID(`MJ_`+UUID)와 32바이트 무작위 회수 권한을 만든다. 권한은 헤더 `X-Studio-Operation`으로만 보내고 서버는 SHA-256만 저장한다. URL·로그·프로젝트·백업 파일에는 넣지 않는다(브라우저의 별도 키 `agentflow.studio.map-jobs.1`). 작업 목록 경로는 없다. 권한이 틀리면 없는 작업과 같은 404. 기존 Host/origin·`X-AgentFlow-Request`·접속 코드 경계가 모든 작업 경로에 그대로 적용된다. AI 키가 없어도 조회·확인은 된다(새 접수만 `AI_NOT_CONFIGURED`).

**프로토콜.** `POST /api/studio/jobs`(접수: id·binding·input·hash) → 내구 기록 후 202 receipt. 같은 ID+같은 권한+같은 제출 해시는 현재 상태만 반환, 다르면 409. `GET /api/studio/jobs/<id>`(상태, ready면 원 입력·wire·model·prompt·ask 해시·evidence·안정 reading ID/time), `POST …/<id>/cancel`(취소를 먼저 내구 기록 후 abort 시도, 원격 중단 미보장 표시), `POST …/<id>/ack`(`applied|discarded|seen`). 접수 연결 종료는 실행 signal과 분리한다. 서버가 binding의 prompt id·model을 현재 map 설정과 대조하고(`PROMPT_CHANGED`), input codec·askHash·inputHash를 다시 계산해 맞지 않으면 접수하지 않는다. 실행 결과는 기존 `validateMapReply`로 검증된 경우에만 ready를 기록한 뒤 노출한다. 저장 실패 시 결과를 노출하지 않고 `failed: JOB_STORE_FAILED`(메모리) — 재시작 후에는 interrupted로 보인다.

**입력 codec(`map-input.1`, 공유 모듈).** MapInput의 Map은 순서 보존 배열로 그대로 옮긴다(parts·records·claims·priors). 원본 Map을 줄이거나 재생성하지 않는다. 복원 시 ask는 기존 `validateMapAsk`, 각 ask 부분/기록/claim/prior가 참조하는 alias가 Map에 있고 값이 맞는지(기록 원좌표 from/to/total과 발송 텍스트 일치, prior target 일치, fullRequests의 requestContext가 ask.requests와 일치)를 검증한다. buildMapAsk가 claim 매핑을 먼저 만들고 ask.current를 뒤에 줄이므로 **참조되지 않은 여분 C alias는 정상**으로 보존한다. prior의 correction은 질문 시점 값을 보존해 대기 중 사람이 바꾼 경우 기존 apply 규칙(본문 보존·replacement 연결만 해제)이 그대로 동작한다. 현재 프로젝트로 buildMapAsk를 다시 하지 않는다.

**브라우저 예약·반영.** 전송 전 WebLock `agentflow.studio.map-jobs` 안에서 entry의 기존 비terminal 예약을 찾으면 그것을 재사용하고(두 탭·이중 클릭), 없을 때만 새 예약(ID·권한·binding·inputHash·askHash)을 쓴다. 쓰기 실패나 WebLock 없음이면 보내지 않는다. 같은 페이지 안에서는 같은 ID·같은 본문으로만 재접수한다. 새로고침 뒤 영수증 없는 예약의 서버 기록이 없으면 "접수되지 않음"으로 정리하고 다시 만들지 않는다. ready 회수 시 서버의 입력을 codec으로 복원해 inputHash를 예약과 대조하고 응답을 다시 검증한다. 반영 전 프로젝트에 같은 reading ID가 있으면: 같은 hash면 이미 반영된 것으로 ack만, 다르면 충돌로 멈춘다(MAP_CHANGED보다 먼저). 반영 저장 실패는 ready 유지·저장만 재시도. 같은 방문에서 도착한 결과만 97처럼 바로 반영하고, 새로고침·다른 탭·다른 방문에서는 원 entry에서 명시 반영을 기다린다. 두 저장소 사이를 분산 원자 transaction이라 부르지 않는다.

**광고.** 위 저장소를 실제로 연 Node 서버만 status에 `jobs:{version:'map-job.1', durable:true}`를 넣는다. Worker·정적·구형 서버는 `jobs`가 없으므로 97 경로 그대로다. 화면은 정리 중일 때 "창을 닫아도 이 PC의 Studio 실행기가 켜져 있으면 계속 정리해요. 실행기를 끄면 중단돼요."를 짧게 알린다.
