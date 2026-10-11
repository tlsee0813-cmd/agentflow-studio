# QUALITY024-T1 — 기술 실행 결과, 품질 평가 진행 중

2026-10-12 Cloud 최종 보고와 기술 결과 JSON을 읽은 요약이다. **실제28회 전송·앱 수용을 완료했지만 내용 품질은 아직 평가하지 않았다.** 공유 제품은 `c2d03e816a8a6cb4731f8142b19e091b70a96408`의 IDEA022 + UI001 rev1을 유지한다. IDEA023 prompt를 사용한 실험 결과이며 제품 후보 승격이 아니다.

## 검사와 실제 호출의 구분

| 범위 | 확인 결과 |
|---|---|
| 정적 패키지 확인 | source188 = IDEA023182불변 + 실험6모듈. 제품 변경 없음 |
| Windows 독립 lab 검사 | Node24.19.0에서16/16 통과. 명시적 mock connector·가짜 키·localhost 경로, 외부 fetch 차단 |
| Cloud 무상 lab/접착 검사 |16 + 연결9 통과. mock·모의 시계 검증이며 실제 모델 호출과 별도 |
| Cloud 실제 실행 |7동결 입력 × OFF/ON-high ×2반복 =28회, 조건별14회. 실패·미실행·재시도·fallback0 |

실제28회 모두 provider/app HTTP200·deepseek-flash·finish_reason stop·usage 존재였다. 공통8192토큰·60000ms, 전체 직렬·최소 실제 송신 간격 **10171ms**, 약378초였다. 실험 요청32768바이트·응답131072바이트 경계를 유지했다.

쌍별 request-app/input hash와 messages 일치, 기록된 최종 body와 실제 송신 body hash 일치, 전후 상태 보존28/28을 기술 기록에서 확인했다. 요청·응답·handoff·전후 상태 원문 누락0, 보호 오류0으로 보고됐다. 승인된 코드·동결 입력·접착 해시는 실행 후에도 일치했고 기존 IDEA023 **773파일 불변**이다. 종료 후 `ALLOW_PAID_AI=false`로 복원했다. 실제 청구 내역은 검증하지 않았다.

## 현재 판단과 공유 범위

무상 합성 검사·전송 성공·계약 수용은 의미 품질 합격이 아니다. 새로운 Pro·Claude 세션에서 조건·모드·usage·지연·추론·대응표를 제외한 blind 자료로 독립 평가 중이다. 아직 모드 승자·개선 효과·고객 효용을 판정하지 않는다. 이전2048토큰/15초 결과와 새8192/60초 결과 차이를 thinking 효과로 해석하지 않는다.

결과 ZIP SHA256: `a5ec169b18361224e4ac6fba19e3e7ff5ac4d4c7acc66b6c964da23266e015d8`. 해당 ZIP은 원격 Cloud 산출물의 보고된 지문이며 전체 ZIP을 로컬에서 회수·검증했다고 주장하지 않는다.

별도 로컬 blind-only ZIP SHA256: `3437a3d7dd888c054f89ba5e26790b2914e264b888e4bbe96426bbcc3f918e6b`.

공유 저장소에는 이 사실 요약·지문만 기록한다. 운영자 JSON·대응표·원문 응답·추론·ZIP·개인 자료를 게시하지 않는다. 연구 당시의 [계획](research/quality024/EXPERIMENT_PLAN.md)과 [재판정/평가 보완](research/quality024/RECLASSIFICATION.md)은 보존한다. 제품 소스·CI·main·PR 설정은 변경하지 않는다.
