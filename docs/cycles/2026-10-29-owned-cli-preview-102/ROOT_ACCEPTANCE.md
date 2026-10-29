# 102 총괄 판정 — 로컬 CLI 연결과 결과 보관·회수

**좁은 범위 수용.** 정확 Windows/Linux CI와 총괄 PC 관측을 완료했다. 범위는 비기본 로컬 preview 실행자이며 첫 지도 생성 품질·전체 제품 완성·공개 배포 수용과 구별한다.

## 판본과 변경

최종 코드·테스트 ffcef18769c6f04f75174116cf391272ff703211. 실제 실행자·클라이언트 runtime은 8ae7eb9116cc3bae9253e8d62a30db30bd307c22 이후 동일하다. a563855는 E21 동일볼륨 임시 폴더, ffcef18은 P4 정상 정리 관측과 작성자 판본 설명만 바꿨다. 공개73/미수용74/UI범위 수용75(693d0c7)를 유지한다. PR61은 draft·미병합이다.

102는 설치 CLI를 기존100 내구 Node 작업 소유자에 연결한다. 서버가 고정한 실행 정책만 사용하며, 지도 작업 하나를 접수하고 검증된 완결 결과를 원래 요청에 보관한다. 다른 프로젝트를 편집하거나 서버를 재시작해도 원 프로젝트에서 명시적으로 반영한다. 기본 DeepSeek/90초·Worker/static 경로는 그대로다.

## 총괄이 직접 확인한 PC 흐름

Windows 정상 CUA,1280×720에서 원본 실제 작업 자료와89의 저장된 응답을 사용했다. HTTP 응답을 위장하지 않고 무해 Node child→102 실행자→100 journal→정상 UI를 거쳤다. 새 모델 생성은0이다.

- 다른 프로젝트의4270자 초안, 역방향 선택4248–4270, 스크롤4078.3999, 포커스가 실패 두 번과 ready 도착 뒤에도 동일했다.
- ready 뒤 서버를 종료하고 executor off·키 off로 재시작했다. 새로고침 뒤 같은 결과를 회수하고 명시 반영해5부분·3관계·2자료를 확인했다. 새 child는 없었다.
- 명시적 철회 조건의 근거에서 실제 원문으로 이동하고 돌아왔다. 원문과 raw wire는 입력/89 저장 응답과 정확히 같았다.
- A 전체 백업·새로고침 백업·일반 가져오기로 만든 복사본 백업의 canonical SHA256은 모두 ad8be05a75b89db972911c4da52660bacc18348ded5e6ad06823ef4e2781abdf. B 전체는 원본 c4a637a2d050d5cd8c54e94e721e1df58d5e43fc658a03701ab11ecd8e851369 그대로다.
- 시험 서버/child를 종료했고 남은 fixture/preview 프로세스0을 확인했다. 브라우저 시험 탭을 닫고 viewport를 복원했다.

[키 없이 재시작한 뒤의 결과 회수](evidence/experience102-ui-keyoff-ready.png), [다른 자료의 초안 보존](evidence/experience102-ui-ready-draft.png), [원문 근거](evidence/experience102-ui-source-quote.png), [반영 후 지도](evidence/experience102-ui-applied-map.png). [구조화된 관측](evidence/root-ui.json).

## 검사와 실패 이력

독립 Sol High 검토의 초기5개 경계와 후속 owner handoff·call deadline 문제를 작성자에게 반환했다. 마지막 af84755 검토는 진행 중 파일 mutation 완료 전 소유권 양도 금지와 spawn 직전 closing 검사 수리를 수용했다. [독립 변경 검토](evidence/independent-delta-review.json)는 정적 검토이며 실행 증거와 구별한다.

총괄 Windows Node24.19/locked TS5.8.3에서 af84755 focused25개 중22pass·3POSIXskip,check/build 통과. 이어 실제 PC에서 상대 --state 경로가 child cwd 아래 중복되는 제품 결함을 찾아8ae7eb9로 수리했다. root E21(8ae 및a563)과 최종 P4(ffcef18)는 각각 통과했고8ae 재빌드 뒤 위 PC 흐름을 확인했다. [실행 기록](evidence/root-checks.json).

이전 실패를 최종 성공으로 바꾸지 않는다: 4eda Windows E16 무확장자 복사exe,969 Windows P1 fixture정리/E17 immediate-verdict순서,8ae Windows E21 cross-volumefixture,a563 Windows P4 ready와lease정리시점 혼동. P4는 정상 정리 후 재시작을 검사하도록 status와lease제거를 관측한다. 정리 전 crash에서 Windows가 미확정child를 이유로 새 작업을 차단하는 제품 동작은 유지한다. root PC의 첫 두 child실행은 실패이며 첫 stderr는 보존되지 않았다. 두 번째에서 exact ENOENT를 확인했다. 실패 뒤 새 모델 호출/자동재시도는 없었다.

작성자 Linux Node22.22의 run4(af84755)584/584,run5(8ae)585/585 및 focused/UI 주장은 [RESULT](RESULT.md)에 출처를 구분했다. 정확 CI는 아래 별도 기록으로 판단한다.

[정확 CI40874244675](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40874244675)는 ffcef18,Node22.16.0에서 두 OS 모두 성공했다. 각 app279/279; continuity는 Linux585/585,Windows582pass·3POSIXskip·0fail. type/boundary·Worker dry-run(24modules/52assets)·static·direct browser·Studio smoke가 모두 성공했다. [요약/원문 발췌](evidence/ci-summary.json). 이후 게시 커밋은 문서·증거만 바꾸며 이 실행 결과를 별도 판본에 새로 실행한 것처럼 주장하지 않는다.

## 한계와 다음 종료선

이번102는 저장된 응답 재생과 무해 child로 검증했다. 실제 CLI0.165의 생성 품질·성공 시간·과금 제한은 입증하지 않았다. 299/300초는 실험 선택/판정 정책이며 p95나 ready 디스크 저장·원격연산 종료 보장이 아니다. 토큰·금액 hard cap은 미확인이다. Windows의 종료 불명 lease는 새 ID도 막으며 운영자 확인이 필요하다. POSIX group을 벗어난 helper와 비Linux hash/exec사이 교체 한계도 유지한다. P1의 멈춘 heartbeat만으로 OS 프로세스 사망을 입증했다고 주장하지 않는다.

사용자가 전달한 별도 검토의 우선순위를 수용했다: 102 종료 후 이미101에서 정한 Zephyr1건을 정상 제품 경로로 관측하고, 전달 실패와 의미 오류를 구별한다. 새 기반 설계를 늘리지 않는다. 통과한 범위는 기록→지도→부분 이해→변경 구상→요청→결과 확인의 체험으로 연결하고, 공개 가능한 개선과 보류 사유를 분리한다. 추가 검토의 공개판 직접 조작은 사용자 제공 외부 관측이며 총괄의102 실행 증거로 혼합하지 않는다.

Q02/Q06·인수인계5/8·전체목표는 미완료다. 다음 실제 한 건은101 정책의 별도 총괄 결정과 frozen input/CLI/정책 확인 후 실행한다. 기존89/91/92/96 실패를 반복하거나 소급 수용하지 않는다.
