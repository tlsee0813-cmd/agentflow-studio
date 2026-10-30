# 저장소 정리 결과와 복구 — 2026-10-30

사용자가 별도 Claude에서 전체 설계를 검토하기 전, 현재 소스와 완료 산출물을 찾기 쉽게 정리했다. **원격 브랜치110→28, 열린 PR34→3**. 완료된82개 head는 원래 커밋을 가리키는164개 태그를 원격에서 먼저 확인한 뒤 정리했고,31개PR은 원본문과 평가를 보존하고 보관 사유를 붙여 merge 없이 닫았다. 제품 코드·실험 결과를 삭제하거나 성공으로 바꾸지 않았다. [110개 전체 명세](evidence/branch-inventory.json) · [정리 검증](evidence/cleanup-verification.json) · [PR 종료 영수증](evidence/closed-prs.json).

## 현재 사용할 기준과 보존 의존성

| 남긴 기준 | 역할 |
| --- | --- |
| main | 기본 GitHub 진입 README. 초기 코드 기준 유지 |
| checkpoint/2026-10-15 | 공개73 코드와 최신 상태 문서. 현재 문서 기준 |
| work/experience142-reading-delivery | 최신 전체 개발 코드와 검토 문서 |
| release/experience142-reading | source76e3dc8a로 고정한 기존 지도 공개142 조합 |
| gh-pages | 별도 정적 공개 사이트. 게시 branch 보존 |
| work/experience75-context-reading / work/experience74-grounded-map | 사용자 지정 UI75 수리693d0c7와 PR45의 head/base.74 미수용은 유지 |
| work/experience137-contract-diagnostics / work/experience136-actual-return | PR76 진단 구현과 그 기준.136 반려는 유지 |
| work/experience140-part-reading / work/experience139-normal-micro | PR77 읽기 구현과 그 기준.142 공개조합과 구별 |

열린 PR은 [45 UI75](https://github.com/tlsee0813-cmd/agentflow-studio/pull/45), [76 거절 진단137](https://github.com/tlsee0813-cmd/agentflow-studio/pull/76), [77 읽기140](https://github.com/tlsee0813-cmd/agentflow-studio/pull/77) 세 개다. 열린 상태는 전체 미수용을 뜻하지 않으며, 한정 수용도 checkpoint 병합을 뜻하지 않는다. PR44는 닫았지만 그 branch가 PR45의 base라서 남겼다.

## 별도 계보라서 남긴17개

아래는 최신 기준에 원래 tip 전체가 포함되지 않은 독자 결과다. 예전 merged PR도 squash 등으로 원 커밋이 현 기준의 조상이 아닐 수 있다. 이번에는 출처를 더 보수적으로 남겼다. 새 개발 대기열이나 지금 실행 중이라는 뜻이 아니다.

| 브랜치 | 원 tip | 기존 PR |
| --- | --- | --- |
| [delivery/ui02-fix3-evidence](https://github.com/tlsee0813-cmd/agentflow-studio/tree/delivery/ui02-fix3-evidence) | `fd79e7e74b0956bcb8eb9878cfdaa62254688c49` | 별도 산출물 |
| [design/study51-atlas](https://github.com/tlsee0813-cmd/agentflow-studio/tree/design/study51-atlas) | `8c63010287014e6fb0bf9161c2faba671bf9d31b` | 별도 산출물 |
| [design/study51-sections](https://github.com/tlsee0813-cmd/agentflow-studio/tree/design/study51-sections) | `08726b96b366c6327b3e198f1d48f526e4617843` | 별도 산출물 |
| [product/area-understanding-17](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/area-understanding-17) | `f7f8176f1b78834a62dad623efead6c2c820344d` | [#8](https://github.com/tlsee0813-cmd/agentflow-studio/pull/8) |
| [product/blank-project-21](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/blank-project-21) | `799077ea2f645f1753f29da7fe9d4b50a81971e6` | [#12](https://github.com/tlsee0813-cmd/agentflow-studio/pull/12) |
| [product/correction-context-23](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/correction-context-23) | `689c47888fb7ab5040d184c2d36f2adff8f2a575` | [#13](https://github.com/tlsee0813-cmd/agentflow-studio/pull/13) |
| [product/map-signals-34](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/map-signals-34) | `e059ec6d90e195263121c21817a39ea9ad0534a7` | 별도 산출물 |
| [product/mixed-depth-18](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/mixed-depth-18) | `73fd6ff82ca035dd9b2e74385ce9194db0b57791` | [#9](https://github.com/tlsee0813-cmd/agentflow-studio/pull/9) |
| [product/pc-map-space-13](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/pc-map-space-13) | `606120500eeea50a20f00fb4678bced7a7d93d98` | [#4](https://github.com/tlsee0813-cmd/agentflow-studio/pull/4) |
| [product/pc-reading-return-12](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/pc-reading-return-12) | `9613208f40f1f7f8506504ac6025f06e421edd4d` | [#3](https://github.com/tlsee0813-cmd/agentflow-studio/pull/3) |
| [product/project-home-15](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/project-home-15) | `1e51f0f9b56ed51e9ec4c529ca518aa256ad1ecf` | [#5](https://github.com/tlsee0813-cmd/agentflow-studio/pull/5) |
| [product/project-home-read-full-15](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/project-home-read-full-15) | `a5a48a715c41d1f8ea928af48a33d264c295a128` | [#6](https://github.com/tlsee0813-cmd/agentflow-studio/pull/6) |
| [product/received-result-20](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/received-result-20) | `69b478ba6dc84f803290eb857e5c8b3d7a659ea4` | [#11](https://github.com/tlsee0813-cmd/agentflow-studio/pull/11) |
| [product/report-area-16](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/report-area-16) | `a0f0ae786c580a8919cede07db48d4397b58b114` | [#7](https://github.com/tlsee0813-cmd/agentflow-studio/pull/7) |
| [product/workspace-records-19](https://github.com/tlsee0813-cmd/agentflow-studio/tree/product/workspace-records-19) | `acfafd2dd6426e3fa6fa5443bd2e67d8461608c9` | [#10](https://github.com/tlsee0813-cmd/agentflow-studio/pull/10) |
| [research/map-reading-28](https://github.com/tlsee0813-cmd/agentflow-studio/tree/research/map-reading-28) | `77c47af95a24f02f290560a86de62e95a63452d8` | 별도 산출물 |
| [work/visual59-presentation-data](https://github.com/tlsee0813-cmd/agentflow-studio/tree/work/visual59-presentation-data) | `c61fc59396a8c6d61b1adbdc2683fdff0111a68e` | 별도 산출물 |

## 보관한82개

모든 브랜치의 원 tip과 이유는 위 JSON에 있다. 각 원본에 두 태그를 뒀다.

- `archive/2026-10-30/<원래 브랜치명>`: 명시적 보관/복구 기준.
- `<원래 브랜치명>`: 과거 GitHub blob/tree 링크가 동일한 원문을 읽도록 둔 호환 태그. 이제 branch가 아니라 tag다.

정리 전 전체원격SHA와 열린PR head/base를 재대조하고, 태그명/prefix 충돌 없음·태그 정확SHA를 확인했다. 삭제는82개 head만 한 번의 atomic push에 exact-SHA lease를 걸어 수행했다. 남긴28개 head와 기존태그22개를 덮어쓰지 않았다. 대상 tip의 workflow8종은 pull_request/workflow_dispatch뿐이며 태그 push로 제품 검사·배포를 요청하지 않았다. GitHub 외부의 별도 자동화 전반을 감사한 것은 아니다.

삭제 후 기존 branch명으로135 수용문서,77 미채택 결과,29 후보 코드를 GitHub에서 다시 읽어 blob SHA가 원본과 같음을 확인했다. [대표 링크 검증](evidence/compatibility-links.json). 나머지는164개 원격 태그가 각각 원 tip과 같음을 전수 확인했다. 모든 역사 문서 링크를 HTTP로 전수 조회한 것은 아니다.

## 특정 보관본을 복구하려면

예를 들어135를 별도 읽기 작업대로 회수할 수 있다. 아래는 복구 안내이며 이번 정리에서 실행한 명령이 아니다. 현재 사용자 작업 폴더를 reset/clean하지 않는다.

```sh
git fetch origin refs/tags/archive/2026-10-30/work/experience135-withdrawal-target-reading:refs/tags/archive/2026-10-30/work/experience135-withdrawal-target-reading
git worktree add --detach ../agentflow-135-review refs/tags/archive/2026-10-30/work/experience135-withdrawal-target-reading
```

원래 이름의 원격 branch가 꼭 필요하면 branch 부재와 태그의원SHA를 확인한 후 `git push origin refs/tags/archive/2026-10-30/work/experience135-withdrawal-target-reading:refs/heads/work/experience135-withdrawal-target-reading`로 복원할 수 있다. 같은 이름의 tag가 있으므로 스크립트에서는 refs/heads와 refs/tags를 명시한다. 닫은 PR 재개가 필요하면 먼저 해당 head/base를 복원하고 기존 PR을 재사용한다.

이 정리는 완료 연구나 실패 원본을 버린 것이 아니며, 전체 제품의 새 수용·병합·배포도 아니다. 오래된 로컬 checkout/사용자의 미커밋 파일은 정리 대상으로 삼지 않았다.
