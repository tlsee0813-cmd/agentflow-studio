# 35 — 최신 PC 흐름의 독립 미리보기

2026-10-23 KST. 이 문서는 35 판정 시점의 기록이며 현재 배정은 [ACTIVE](../ACTIVE.md)를 따른다.

## 판단
**한정 수용·checkpoint 통합·별도 비공개 체험본 게시 완료.** 병합 `a6ea322a3147b0bee64e32752ec22bdcefcf6c82`는 정확 후보와 app subtree `775a33991c4b81104737ac1f0ec5b924c979a975`가 같고, 직전777c의 docs763개 blob을 모두 보존했다.

33까지 수용한 제품을 별도 정적 체험 공간에서 사용할 수 있게 하는 변경이다. 새 사례별 화면을 만들지 않으며, 지도 표현 후보34/36은 포함하지 않는다. 기본 공개 빌드와 미리보기는 같은 제품 코드를 쓰되 출력 경로·고정 저장 접두사·모드 표시만 분리한다.

[PR19](https://github.com/tlsee0813-cmd/agentflow-studio/pull/19), 정확 후보 `81f8a32dcd12a6004274d38bb6edf1ff9a5cdafb`. --preview 출력은 static-preview-dist, 기존 기본 출력은 static-dist다. 기존 agentflow.studio.browser-demo: 키는 유지하고 새 미리보기는 agentflow.studio.preview: 를 쓴다. localStorage와 sessionStorage의 프로젝트·백업·열린 위치·순번을 함께 분리한다. 자동 복사나 옛 키 fallback이 없으며 사용자가 선택한 백업만 명시 가져온다. 같은 origin에서는 quota와 WebLock 이름은 공유한다.

## 검증된 사용자 흐름
독립 Cloud가 고정 T2 백업을 실제 파일 선택으로 읽고 같은 제품에서 1280/1440 PC 흐름을 조작했다. 현재04와 별개 초안을 유지하며 부모 기록에서 이전02를 읽고, 명시 이어가기 뒤 N만 편집했다. U/S/C·다른 작업·영역·기준·과거H·원보고는 보존됐다. 전달 묶음으로 이동만 하면 H가 생기지 않고 실제 복사 때 정확 H 하나가 생겼다. clipboard·전달문·프로젝트 대상과 당시 네 작업값을 대조했다.

합성 return.2 파일을 선택해 검토하는 동안 저장은 그대로였고 명시 가져오기 뒤 보고 하나가 정확 H/parent/raw와 연결됐다. 1440 Space 조작으로 상세를 닫고 지도에 복귀했다. 독립 raw 대조는 최종 데이터·원자료 보존·정확 인계를 확인했으며 작은 UI 상태 검사와 실제 조작을 섞지 않았다.

1280은 가져오기 후 자동 지도 복귀→한 흐름 완료→프로젝트 목록/카드 재진입 순서이고, 1440은 가져오기→목록/카드→지도→한 흐름 순서다. 두 PC 모두 같은 카드 우선 순서를 했다고 하지 않는다. 가져오기 버튼은 두 PC에서 처음 가려져 있었고 실제 wheel 이동 뒤 hit/clip을 확인해 클릭했다. 첫 화면 노출 개선의 증거가 아니다.

지도 복귀는 camera·부모 기록 소유/선택·패널 scroll461·정확 호출 초점과 현재 보고/별개초안/데이터를 유지했다. 1280 pageY467.796875→378.609375는 import 안내 소멸에 따른 mapTop314.078125→224.890625 이동이다. 이 차이는33에도 있었고 이번 app/styles는 그대로다. 정확 화면 좌표 복귀로 확대하지 않는다. 1440 y378.609375 동일 조건은 카드 재진입에서 안내가 먼저 사라졌으므로 동일 시작 기하가 아니다.

총괄은 공유1280 reader와1440 return PNG를 직접 읽었다. 1280 긴 요청은 읽을 수 있으나 아래 행동 일부는 첫 화면 밖이고, 지도 글자 밀도·긴 이름/소속 구별은 여전히 다음 표시 개선의 과제다. 좁은 체험 배포 수용과 UI 전체 완성을 구분한다.

## 검증 층과 원자료
- [작성자 기록](https://github.com/tlsee0813-cmd/agentflow-studio/blob/81f8a32dcd12a6004274d38bb6edf1ff9a5cdafb/docs/cycles/2026-10-23-isolated-preview-35/AUTHOR.md): Node22.22·TS5.8.3·Chromium141, unit275·check/build·static3그룹. 루트I6R INVALID_EVAL_OPTIONS 실패는 시작1cf에도 같았고 원인 단정은 하지 않는다.
- [독립 Cloud REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/3a008c596cb6c109bd91b20657eb15bfcda66aa1/docs/transfer/isolated-preview-35/validated-v0/REPORT.md): Node22.16·TS5.8.3·Chromium154, build/실제UI/의미검사/정확static3그룹 각각 종료0. 처음 stdin EOF의 종료0은 실제 동작이 없어 성공검사로 세지 않았다.
- [원자료·공유 이미지·17개 실제 정적 파일](https://github.com/tlsee0813-cmd/agentflow-studio/tree/3a008c596cb6c109bd91b20657eb15bfcda66aa1/docs/transfer/isolated-preview-35/validated-v0):61파일·1,774,628B·PNG6. Sol은 plain16+gzip2와 raw record/clipboard/단계별 store를 좁게 대조했다. 총괄은 실제 정적17파일597,881B를 immutable delivery에서 회수해 모든 길이·SHA256을 대조했다.
- 새 static3그룹은 same-origin 세 저장영역 격리, 표적 write failure 보존, 기존 static 교환을 검사한다. 합성 sentinel·표적 setItem 실패·일부 details 속성 조작을 포함하므로 위 native 흐름/최초 발견성 검사와 다르다. 큰 실제 quota 소진은 결정적 재현으로 주장하지 않는다.
- 실제 UI HTTP32 응답 body와 실행 디스크 before/after가 일치했다. 제품 API POST·외부 AI 없음, pageerror0. root는 모든 원시 이벤트를 재실행한 것이 아니다.

- [정확 CI 원응답·요약](https://github.com/tlsee0813-cmd/agentflow-studio/tree/747ebf1b1b519ec7d832499c39fe3af0a12af020/docs/transfer/isolated-preview-35/ci-81f8a3): run39880425557 Ubuntu120176226148·Windows120176225980 모두 success. 각26browser그룹258개 OK, static3 모두 개별OK. Windows TAP275/pass275/fail0 요약이 보이고 Ubuntu 요약은120k tail 밖이다. type·일반build 개별exit·실제Node출력·rootI6R 개별원문은 미회수다. Code Review만 조회했고 재실행/로그 대체 경로를 사용하지 않았다. CI 원시직렬화·공개압축의 해시/무손실 해제를 확인했다.

## 배포 및 남은 한계
검증한 산출물을 공식 Sites helper로 포장했다. 소스 보관 commit `99d4502b979461cf6ff2b5f6739763c854e1db60`은 GitHub 제품 SHA와 다른 Sites 소스 식별자다. 프로젝트 `appgprj_6adaae8408a48191b9af587755a94261`는 owner-private다. 자산의 기준은 위 후보/증거 SHA와 BUILD_SOURCE.json이다. 기존 공개 gh-pages와 main은 유지한다.

[PC 체험본 열기](https://agentflow-studio-pc-preview-20261023.eagerllama11.chatgpt.site) — 소유자 ChatGPT 로그인 필요. 저장 버전 `appgprj_6adaae8408a48191b9af587755a94261~appgver_6a07baed607881918c6be2975bdca404`, 배포 `appgdep_6adab37fa4608191b8a0d139cd84340f`, 2026-10-23 01:08:29 UTC succeeded를 확인했다. 접근 범위를 변경하지 않았다.

총괄은 실제 HTTPS에서 정상 소유자 로그인→프로젝트 목록→저장하지 않는 예제 열기/닫기→빈 프로젝트 목록 복귀를 확인했다. 모드 표시가 유지되고 실제 제품 모듈이 표시됐다. 로그인 과정 Cloudflare의 NaN console error2는 있었으며 제품 origin의 error는 해당 좁은 관측에서 없었다. 로그인 이후 전체 수신·인계 흐름을 다시 실행한 것은 아니다. 호스팅 서버의 모든 응답 바이트/CSP 헤더를 재수집했다는 주장도 하지 않는다. 실제 호스팅 좁은 확인과 앞선 정확 산출물 Cloud 전체 흐름을 구분한다. 브라우저 탭을 체험용으로 남겼다.

브라우저 MOCK이며 실제 AI/자동 실행·계정 동기화가 아니다. 저장은 해당 브라우저에 남는다. 별도 origin으로 기존 공개 프로젝트가 자동 나타나지 않으며 명시 백업/가져오기를 사용한다. 같은 origin quota 전체·큰 백업·여러 탭 실시간 갱신·모든 첫 화면 행동 노출·일반 사용자 효용을 수용한 것이 아니다. 초기 저장 실패 뒤 일반 읽기전용 문구로 보일 수 있는 기존 메시지 한계는 남는다.
