# INIT-008 — review_ready / 수용·통합·실AI 개선 확인 전

현재 작은 작업: 실제 고객 대화 자료에서 드러난 출처 거절 가능성과 보류 요약 혼동의 최소 개선.
기준: INIT008 Input source77, 원본 source fingerprint72e4e3bc12960c59fc11732424220ec80f026a1edd43aacedac56c6baaf14732.
작업 공간은 이 입력의 source/를 잇는 단일 로컬 공간이다. 이 세션이 직접 순차 구현/자기 검토했다.
가상 위임·병렬 작업·독립 리뷰 완료·원격 반영을 주장하지 않는다. 최종 정확한 산출물 정체성은
ZIP root SOURCE_MANIFEST.sha256/RUNTIME_MANIFEST.json/verification/result.json에 있다.

| 요구 ID | 확인 상태와 완료 조건 | 구현/검사 | 현재 판정 |
|---|---|---|---|
| I8-R1 | 사용자 배정. 현재 요청의 근거 ID 안내, 잘못된 참조는 엄격 거절, 변경된 참조 계약 명시 | prompt.mjs, I8.1–6/13 | 구현·무상검사 완료. 실제 거절률 감소/원인 규명 미검증 |
| I8-R2 | 사용자 배정. 보류/TBD·출처/잠금을 유지하고 현재 요약과 항목의 상태 일치 | presentation.ts/app.ts, I8.7–12/U1 | 구현·무상검사 완료. 원문은 접힌 과거 해석으로 보존 |
| I8-R3 | 관찰 기반 작은 제안. 알려진 핵심 초안 우선, 옵션 효과 정직성, 사용자 수≠기기 수 | prompt.mjs/I8.2, ACTUAL_QUALITY | 문구 반영. LLM의 준수·고객 부담 감소 미검증 |
| I8-R4 | 사용자 배정. 입력/미저장 수정/오래된 응답/confirm·lock·defer/출처/완료 조건 보호 | 신규19+관련73,DOM3+7 | 선별검증 통과. 직접 브라우저·클린 설치는 별도 |

수정한 제품 기존 파일은 server/prompt.mjs와 src/client/app.ts 두 개, 신규 제품 파일은
src/shared/presentation.ts 하나다. 도메인 전이·validator·계약 타입·provider adapter·설정·
패키지/lockfile·기존 fixture·실AI 실행 스크립트는 변경하지 않았다. 신규 검사/fixture/문서와
명시적 test-only browser scenario 외 확장은 없다. 세부 경로·최소 diff는 root patch/에 있다.

CHECKPOINT를 선별검증 전에 별도 ZIP으로 보존했다. FINAL은 그것을 통과시켰다는 독립 수용
선언이 아니라 source+회귀검사+작성자 결과를 묶은 제출본이다. 다음 단계는 독립 검토와
총괄이 배정하는 좁은 Cloud 무상/후속 실AI 검증이며, 기존 generation0 p03 기록은 별개다.
ACTUAL_QUALITY.md / CONTRACT_CHANGE.md / VALIDATION.md / CLOUD_NEXT.md를 함께 전달한다.
