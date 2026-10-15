# 다음 실제 기록 후보 — VS Code 다운로드 남은 시간
2026-10-16 원문 감사 시점. Pro 후보 탐색 뒤 Astra가 직접 원문을 대조하고 총괄이 적용 범위를 한정했다. 현재 진행은 [ACTIVE](../ACTIVE.md), 이번 시안의 결론은 [RESULT](RESULT.md).

판단: **사람의 공개 요구·리뷰 지시 → Copilot 후속 수정이라는 외부 AI 작업 기록 후보로 사용 가능하다.** 합성 입력이나 작성자의 회고만 있는 자료와 다르다. 다만 두 독립 기능의 사업 요구 변경이라기보다, 하나의 업데이트 표시 기능을 사용하는 두 화면 코드의 공통화 지시다. 전체 AI 대화·다른 AI 세션으로의 인계·실행 성공·제품 반영 증거는 아니다.

## 읽은 원문 4종

1. [이슈 #277330 API](https://api.github.com/repos/microsoft/vscode/issues/277330): 목적과 이슈 생성 시각.
2. [PR #288298 API](https://api.github.com/repos/microsoft/vscode/pulls/288298): 생성·작성 계정 종류·조회 시 배정 계정·종료/병합 상태. PR 본문은 이후 편집된 현재 설명이므로 1월 16일 당시 구현 설명으로 소급하지 않는다.
3. [PR 리뷰 댓글 API](https://api.github.com/repos/microsoft/vscode/pulls/288298/comments?per_page=100): 반환된 35개 중 지정된 요청·응답과 후속 범위 한정만 검토. 개인 계정명은 복사하지 않고 이슈 작성자를 사람 A, 리뷰 작성자를 사람 B로 표기한다.
4. [고정 커밋 API](https://api.github.com/repos/microsoft/vscode/commits/8a830696ec002193e88fde8229b2dce8fd923c77): 메타데이터와 부모 대비 실제 patch. 커밋은 고정되지만 이슈·PR·댓글은 편집 가능한 공개 기록이다.

## 확인한 시점과 연결 (모두 UTC)

| 사건 | 직접 확인 내용 |
|---|---|
| 2025-11-14 04:15:26 | [이슈](https://github.com/microsoft/vscode/issues/277330)의 사람 A는 설정 아이콘에서 보이는 다운로드 중 표시를, 진행량과 대역폭으로 합리적으로 추정할 수 있을 때 남은 시간까지 보여 달라고 요청했다. 무조건 정확한 시간을 보장하라는 요청은 아니다. API 계정 종류는 User다. |
| 2026-01-16 10:32:50 | [PR](https://github.com/microsoft/vscode/pull/288298) 생성. 작성 계정은 Copilot, type=Bot. 조회 시 assignees에도 Copilot Bot과 User 계정이 있다. **생성 순간 배정됐는지·누가 언제 배정했는지는 해당 응답으로 확인하지 못했다.** |
| 2026-01-16 14:18:06 | [사람 B의 리뷰 2698689300](https://github.com/microsoft/vscode/pull/288298#discussion_r2698689300): @copilot을 직접 지목해 update.ts와 menubar.ts의 중복을 한곳으로 모으자고 요청했다. 클래스로 바꾸는 방안은 가능성을 제시한 것이며 필수 구현 조건으로 단정할 수 없다. User 계정이며 사람 A와 다른 계정이다. |
| 2026-01-16 14:31:48 | [고정 커밋 8a83069](https://github.com/microsoft/vscode/commit/8a830696ec002193e88fde8229b2dce8fd923c77)의 author/committer 날짜가 모두 이 시각이고 두 GitHub 계정 매핑 모두 Copilot Bot이다. 이는 커밋 메타데이터 시각이지 AI의 실제 작업 시작·소요 시간 측정이 아니다. |
| 2026-01-16 14:32:10 | [응답 2698738638](https://github.com/microsoft/vscode/pull/288298#discussion_r2698738638)은 Copilot Bot이며 in_reply_to_id=2698689300. 본문에서 8a83069를 지목하고 양쪽이 상태 객체를 공통 계산 함수에 넘긴다고 보고한다. 응답의 commit_id 자체는 c7e0a659…이며 리뷰 앵커다. 따라서 수정 커밋의 연결 근거는 **응답 본문 + 고정 patch**, 직접 답변 관계는 **in_reply_to_id**다. |
| 2026-02-01 10:57:58 | 조회한 PR은 state=closed, merged=false, merged_at=null이다. 종료 사유는 이 자료로 확인하지 않았다. 미병합 종료를 기능 거부·실패·제품 반영으로 바꾸지 않는다. |

## 두 영역 실제 변경과 공통화 범위

고정 커밋은 부모 `c7e0a659e0f974cb0105180bf4a66032e1b75525` 대비 다음을 실제 변경한다.

- [네이티브 메뉴바 코드](https://github.com/microsoft/vscode/blob/8a830696ec002193e88fde8229b2dce8fd923c77/src/vs/platform/menubar/electron-main/menubar.ts#L650): 개별 진행 필드 검사·경과 시간 계산·세 인자 호출을 줄이고 `computeDownloadTimeRemaining(state)`를 사용한다.
- [워크벤치 업데이트 메뉴 코드](https://github.com/microsoft/vscode/blob/8a830696ec002193e88fde8229b2dce8fd923c77/src/vs/workbench/contrib/update/browser/update.ts#L409): 상태 객체를 받도록 바꾸고 같은 함수를 호출한다. patch에 GlobalActivity 메뉴 등록이 보인다. 톱니 메뉴라는 사용자 화면 해석은 PR 설명과 코드의 대응이며 실제 화면을 조작한 관측은 아니다.
- [공통 계산 코드](https://github.com/microsoft/vscode/blob/8a830696ec002193e88fde8229b2dce8fd923c77/src/vs/platform/update/common/update.ts#L124): Downloading 상태를 받아 누락 필드를 검사하고 시작 시각에서 경과 시간을 계산한다. **계산 helper는 부모에도 있었으며 이번 커밋이 처음 만든 것은 아니다.** 두 UI의 지역화된 표시문구·분기까지 완전히 하나로 만든 변경도 아니다.

커밋에는 Windows 다운로드 지연 처리와 테스트 정리도 함께 있다. 전부 지정 리뷰 한 건의 결과라고 묶지 않는다. 같은 댓글 목록에 이후 추가 공통화·시간 형식 변경과 다음 되돌림 요청도 존재한다.

- 2026-01-21 16:31:44 UTC: [리뷰 2713374092](https://github.com/microsoft/vscode/pull/288298#discussion_r2713374092)는 워크벤치 `update.ts`의 변경을 되돌리고 나머지는 유지하라고 @copilot에 요청한다.
- 2026-01-21 17:26:19 UTC: [리뷰 2713602954](https://github.com/microsoft/vscode/pull/288298#discussion_r2713602954)는 네이티브 `menubar.ts`의 변경을 되돌리고 나머지는 유지하라고 @copilot에 요청한다.

이는 **되돌림 요청**의 증거이며 실제 되돌림 완료는 이번 자료 대조에서 확인하지 않았다. 입력은 **1월 16일의 좁은 요청–수정–응답 구간**으로 동결하되 위 후속 요청과 미병합 종료를 선정 경계에 남긴다. 1월 16일 수정과 Bot의 완료 주장을 최종 수용·제품 반영으로 확대하거나 현재 PR 본문·최종 HEAD를 이 구간의 결과에 섞지 않는다.

## 입력으로 쓸 수 있는 것과 남는 한계

사용자 목적(추정 가능한 남은 시간 표시), 사람 B의 실제 후속 지시, 두 소비부와 공유 계산의 변경, Bot의 완료 주장 및 실제 patch를 서로 대조할 수 있다. 별도 사람 승인·리뷰 해결 판정·CI 성공·실제 다운로드 화면·정확한 예측 품질·다른 AI의 인수 수락은 확인하지 않았다. GitHub의 User/Bot 분류와 공개 발화를 바탕으로 역할을 구별했으며 신원 인증을 한 것은 아니다.

이 후보는 공개 개발 작업의 짧은 실제 상호작용이다. 기능 구현 목록이나 확정 제품 모듈 트리로 전환하지 않는다. 새 코드 실행·브라우저 조작·원격 변경·다른 후보 탐색 없이 원문 대조만 했다.


