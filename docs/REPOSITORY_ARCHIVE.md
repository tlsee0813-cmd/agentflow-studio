# 저장소 보관·정리 기록 — 2026-10-15

사용자가 “main말고 정리할건 정리”를 승인한 범위에서 기존 작업 브랜치를 태그로 보관하고 정리했다. 새 기능·제품 소스 변경·실제 AI 호출·배포·main 병합은 수행하지 않았다. 현재 사이클은 정지 상태이며 **사용자 개편안 대기**다. 다음 조사·구현·실험·배포는 시작하지 않는다. 기존 예약 PAUSED 상태도 이 작업에서 변경하지 않았다.

## 남긴 원격 브랜치 3개

| 브랜치 | 기준 전체 SHA | 역할 |
|---|---|---|
| `main` | `896dcf3848fec70357d0f9bd4fd6c09cab70db37` | 과거 초기 기준 그대로 유지. 최신 제품으로 통합하지 않음 |
| `gh-pages` | `63f5540d062861439f0932cd7311c6c5510e227c` | 기존 공개 MOCK 배포 그대로 유지 |
| `checkpoint/2026-10-15` | 정리 전 `6d685963801383c77345615a3b82ddb0ddc29ed5`에서 이 문서를 포함한 문서만 갱신 | USE106 제품 파일 그대로, 현재 인계·보관 기록 |

checkpoint의 최종 SHA는 이 문서가 포함된 커밋이다. 정리 전 checkpoint 대비 변경 경로는 `README.md`, `docs/START_HERE.md`, `docs/PROJECT_STATUS.md`, `docs/REPOSITORY_ARCHIVE.md`뿐이다. 제품 파일은 공개 소스 [USE106 `618d9bd2b99ad433df35107d8902b15f45e30000`](https://github.com/tlsee0813-cmd/agentflow-studio/commit/618d9bd2b99ad433df35107d8902b15f45e30000)와 동일하다.

## 보관한 원래 브랜치 22개

아래 태그는 원래 브랜치 HEAD 전체 SHA를 직접 가리키는 보관 태그다. 같은 이름의 태그를 덮어쓰지 않았다. 22개 원격 태그의 SHA를 모두 재조회·검증한 다음에만 원래 브랜치를 삭제했다.

| 원래 브랜치 | 보관 태그 전체 ref | 원본 전체 SHA |
|---|---|---|
| `ai060/semantic-evidence` | `refs/tags/archive/2026-10-15/ai060/semantic-evidence` | `e24b8b03b4596d172726ceb99ec92f1de0c97d8d` |
| `design087/dashboard-variants` | `refs/tags/archive/2026-10-15/design087/dashboard-variants` | `91996535b84649939182cd2b527093f12a5d846f` |
| `design089/area-workspace` | `refs/tags/archive/2026-10-15/design089/area-workspace` | `6eec17130f53c9d59a5a0ae1f8f6a151436206c7` |
| `docs/reuse103-cycle` | `refs/tags/archive/2026-10-15/docs/reuse103-cycle` | `cfde7f8c69234e0798c4a6e82dc8e8306575fa1f` |
| `docs/use105-persona-review` | `refs/tags/archive/2026-10-15/docs/use105-persona-review` | `0ddd582b61537ebbb24c8555973e95be7543ba78` |
| `evidence/guide097-ai-fbdcbf1` | `refs/tags/archive/2026-10-15/evidence/guide097-ai-fbdcbf1` | `f03e0594e07a2ec090653f44a14b4390c2c78aa8` |
| `evidence/guide098-ai-ec9011d3` | `refs/tags/archive/2026-10-15/evidence/guide098-ai-ec9011d3` | `356ad1b7104b3433f7d94562f89aade6c784c920` |
| `evidence/guide099-ai-2a40ac3d` | `refs/tags/archive/2026-10-15/evidence/guide099-ai-2a40ac3d` | `341137535c59dc6b0ad91d52945d7ae830046e77` |
| `evidence/guide107-ai-3fd4b305` | `refs/tags/archive/2026-10-15/evidence/guide107-ai-3fd4b305` | `b8940d415c5d3afe20aaf4302286ea59f24496e5` |
| `feat/area-guidance097` | `refs/tags/archive/2026-10-15/feat/area-guidance097` | `2931b50938af037a43e20ed7aba69b96ab79843d` |
| `fix/guide107-complete-slice` | `refs/tags/archive/2026-10-15/fix/guide107-complete-slice` | `3fd4b3055328862c8b8471b356ee5f3772a8deee` |
| `fix/use106-entry-review` | `refs/tags/archive/2026-10-15/fix/use106-entry-review` | `618d9bd2b99ad433df35107d8902b15f45e30000` |
| `fix058/intent-edit-separation` | `refs/tags/archive/2026-10-15/fix058/intent-edit-separation` | `2750b58fdee710ff33a7e65f24c182c63f708577` |
| `fix066/intent-action-consistency` | `refs/tags/archive/2026-10-15/fix066/intent-action-consistency` | `68ab815fc1495eb088eed61b21ac02c60da06cbd` |
| `fix079/intent-correction-feedback` | `refs/tags/archive/2026-10-15/fix079/intent-correction-feedback` | `f0fa5326c0f1c96fbc4360f7968b6be636836056` |
| `fix088/intent-report-focus` | `refs/tags/archive/2026-10-15/fix088/intent-report-focus` | `130786dd5a14fd8a011de7cafb2f4d382b0555a8` |
| `flow049/outcome-home` | `refs/tags/archive/2026-10-15/flow049/outcome-home` | `f0fa5326c0f1c96fbc4360f7968b6be636836056` |
| `flow083/preview-artifact-fix084` | `refs/tags/archive/2026-10-15/flow083/preview-artifact-fix084` | `085164e32c7db3d3568728509d06080ea9af699c` |
| `flow083/project-entry` | `refs/tags/archive/2026-10-15/flow083/project-entry` | `5f3dd88f44aff49266cb951b6f51e8a518d8ea82` |
| `flow090/spatial-workspace` | `refs/tags/archive/2026-10-15/flow090/spatial-workspace` | `0e884307204050a0801e5d207e23242dd5d0eb75` |
| `init-003/fix-review-regressions` | `refs/tags/archive/2026-10-15/init-003/fix-review-regressions` | `61c3b2f063a0f25edf53dbd709a85a27e41d8815` |
| `test073/import-dialog-race` | `refs/tags/archive/2026-10-15/test073/import-dialog-race` | `6fb1d140e6fc94ee77aa2873595a97a64e29ba91` |

## PR과 보관 순서

1. 원격 브랜치 25개와 예상 HEAD, 기존 Draft PR 상태를 재조회했다.
2. 보관 태그 22개를 atomic push로 생성하고, 22개 모두 원본 SHA와 일치하는 것을 원격 재조회로 확인했다.
3. [PR #1](https://github.com/tlsee0813-cmd/agentflow-studio/pull/1)과 [PR #2](https://github.com/tlsee0813-cmd/agentflow-studio/pull/2)는 **closed·unmerged**로 닫았다. 기존 제목·본문·댓글을 보존했고 병합하지 않았다. 두 PR은 과거 Draft 기록이다.
4. 삭제 직전 대상 HEAD와 보관 태그를 다시 검증하고, 브랜치별 원본 SHA를 지정한 `--force-with-lease`와 `--atomic` push로 지정한 22개만 삭제했다. 예상 밖 새 브랜치는 삭제 대상에 포함하지 않는다.
5. checkpoint에는 위 문서 4개만 기록했다. main과 gh-pages에는 push하지 않았다.

## 복원 방법

태그는 유지한 채 원래 브랜치를 다시 만들 수 있다. 아래는 USE106 복원 예시이며, 다른 항목은 위 표의 원래 브랜치·태그·전체 SHA를 대입한다. 이 예시는 기록용이며 정리 작업에서 실행하지 않았다.

```sh
git fetch origin refs/tags/archive/2026-10-15/fix/use106-entry-review:refs/tags/archive/2026-10-15/fix/use106-entry-review
git rev-parse refs/tags/archive/2026-10-15/fix/use106-entry-review
# 위 출력이 아래 원본 SHA와 같은지 확인한 뒤 실행한다.
git push --atomic --force-with-lease=refs/heads/fix/use106-entry-review: origin 618d9bd2b99ad433df35107d8902b15f45e30000:refs/heads/fix/use106-entry-review
```

빈 expected SHA lease는 원격에 해당 브랜치가 없을 때만 생성하도록 한다. 같은 이름의 브랜치가 이미 있으면 덮어쓰지 않고 중단·확인한다. 로컬 브랜치가 필요하면 검증한 태그에서 `git switch -c <원래브랜치명> <보관태그>`로 만들 수 있다. main·gh-pages·기존 태그를 이동하거나 강제로 덮어쓰지 않는다.

## 제품과 GUIDE107의 현재 위치

- 현재 공개 제품 소스는 **USE106 `618d9bd2b99ad433df35107d8902b15f45e30000`**이며 실제 AI 없는 정적 browser MOCK이다. 공개 배포는 gh-pages `63f5540d062861439f0932cd7311c6c5510e227c` 그대로다.
- 공개 [BUILD.txt](https://github.com/tlsee0813-cmd/agentflow-studio/blob/63f5540d062861439f0932cd7311c6c5510e227c/BUILD.txt)의 SHA256은 `a49029bad1a3cc2ab12eca70663218063194b58cc55115824508e206d7f32f4b`이며 변경하지 않았다.
- GUIDE107 후보 **`3fd4b3055328862c8b8471b356ee5f3772a8deee`**는 실제 AI 의미 품질 **HOLD**다. 증거 **`b8940d415c5d3afe20aaf4302286ea59f24496e5`**의 [FINAL-REPORT](https://github.com/tlsee0813-cmd/agentflow-studio/blob/b8940d415c5d3afe20aaf4302286ea59f24496e5/docs/evidence/guide107-ai-3fd4b305/FINAL-REPORT.txt)와 함께 보관만 한다. USE106·checkpoint 제품·공개 제품·main에 통합하지 않았다.
- main은 과거 초기 기준 그대로다. 정리가 제품 수용·AI 품질 합격·새 배포를 뜻하지 않는다. **사용자 개편안 대기** 상태를 유지한다.

원격 브랜치 25→3, 보관 태그 22개와 원본 전체 SHA 일치, PR #1·#2 closed/unmerged를 확인했다. 문서 변경만으로 제품·공개 BUILD를 유지하므로 전체 테스트와 빌드는 재실행하지 않았다. 현재 제품·증거·한계는 [PROJECT_STATUS](PROJECT_STATUS.md)를 따른다.
