# 120 총괄 검증

검토 기준은 제품 be061284af3154b1a746acdbc249fd1cf72a24f4, 작성자 문서 ca9b56333273541e318cef1a91641f83f38cae38, app tree 7b36f3ebf07a0cea25b36677ef2aedf4c6f23703다. 119 반려 응답은 수리하거나 검증기에 다시 넣지 않았다.

## 확인한 변경

새 부분 ID의 기존 소문자 문법을 832바이트 안내로 명시했다. 이 안내는 불변 MAP7 기본 지침과 118 조건 길이 표 사이에 들어가며, recipe와 실제 prompt 해시에 포함된다. map7의 첫 부분 검사는 기존 form → 정확한 객체 모양 → 동일 ref 조건 순서를 지킨다. 같은 거절에만 parts[i].ref/reference/고정 분류를 반환한다. NEW 정규식, 수용 집합, 전체 응답 거절, old1–6의 일반 오류는 유지한다.

UI·저장 형식·CLI 구현은 바뀌지 않았다. 입력이나 결과 ID를 소문자로 바꾸거나 다른 참조를 수선하는 동작도 없다.

## Root 직접 실행

- Windows Node24.19.0 / 잠금 TypeScript5.8.3: build와 check exit0, 전용 검사5 통과·실패0·건너뜀0.
- 미리 동결한 기존 지침 문자열13개가 같다. 원 ask SHA579741…도 불변이며, 118 조건 표는7326바이트/SHA1a4185…로 정확히 같다.
- 같은 실제 자료의 새 prompt는32111바이트/SHA0e51e224…, stdin은66673바이트/SHA322d4aa…다. 이는 정적 계산이며 새 생성 호출은 아니다. 전체 해시는 [prompt 대조](evidence/prompt-proof.json)에 남겼다.
- Root118 정상 UI에서 만든 원래 ready7 파일(d11448…, recipe m7-82631aa43efc)을 그대로 복사해120 store에서 회수했다. input/result/binding/execution과 원파일·회수파일이 같았으며 run 접근은0회다. 새 fixture를 재작성하지 않았다. [회수 증거](evidence/old-ready7-recovery.json).

UI 코드가 바뀌지 않아 전체 모의 PC 흐름은 반복하지 않았다. 다음 실제 관찰의 ready → 명시 적용 → 근거/복귀 → 백업을118 모의 성공으로 대체하지 않는다.

## 독립 검토와 범위

Sol은 새 구현을 읽기 전에 합성 기대값을 동결하고 새 검증기에 한 번 대조했다. 79건(수용25/거절54)이 구판과 일치했고 ask·wire는 바뀌지 않았다. 수용 결과의 정규화 내용, 부모·관계·후보 참조, 선행 검사 순서와 고정 진단도 확인했다. 정적 delta에서 P1/P2는 발견되지 않았다. [독립 판정](evidence/independent-review.json).

검사 범위는 map7 33건, map6 31건, map1–5 각3건이다. 유한 사례와 정적 동일 조건 검토를 함께 근거로 삼으며 모든 wire를 전수검사했다고 주장하지 않는다. 작성자120-3의 제목은 map1–6이지만 실제 실행은map6이므로, 그 검사만으로 구형 전체 실행 검증을 주장하지 않는다.

작성자의 관련89검사와 TS6 bootstrap 결과는 작성자 증거다. Root의 잠금 Windows 실행과 구별한다. [Root 실행 요약](evidence/root-checks.json).

## 남은 실제 관문

새 모델의 지침 준수, 전체 의미 정확성, 반환 적용 경험과 공개 배포는 아직 입증하지 못했다.121은 동일 원자료로 준비만 했고 수용 전 새 호출은0회다. 공개73·미수용74·UI 범위75 및 기존 미커밋을 보존한다.

## 정확 HEAD CI

run40952043513은 작성자 문서 HEAD ca9b56333273541e318cef1a91641f83f38cae38을 checkout했다. Linux job123722382750은 continuity629 통과/0건너뜀, Windows job123722382300은626 통과/3건너뜀이다. 양쪽 원앱279, direct browser18, Studio smoke 및 빌드·경계·배포 없는 Worker/assets 준비도 성공했다. 실제 AI 생성 검사가 아니다. [Linux](evidence/ci-linux.json) · [Windows](evidence/ci-windows.json).
