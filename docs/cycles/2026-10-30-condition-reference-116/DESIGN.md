# 116 원문 조건 참조 계약 — 총괄 선택

115는 완결 응답을 받았지만 사용자 기재 파일 판본을 원문 조건으로 복사해 반려됐다. [115 결과](../2026-10-30-typed-return-115/RESULT.md)를 유지하고, 정상 후속 읽기의 조건 참조 계약만 바꾼다. 114 코드 d6c93dffa710e7947e73c319cbee079d5c540adf / 수용 e42ba06043f7bb16ec9a1c664bee7334a1d4bf3d가 구현 기준이다.

## 선택한 결과

사용자가 적은 소스 판본·출처는 기존 자료 화면에서 ‘사용자 기재’로 보인다. 모델이 이를 원문 인용처럼 다시 써 넣게 하지 않는다. 실제 원문에 있는 판본·검사 조건은 이미 쓰는 구간 참조로 받고, 서버가 그 원문을 기존 저장형식으로 해석한다.

- 새 **studio.map.7은 후속 읽기만** 다룬다. 입력의 parts/requests/priors가 모두 빈 FIRST에는 사용하지 않는다. FIRST6와 기존map1–6의 지침·해석은 유지한다.
- 응답의 roleAboutAt, claim.aboutAt, candidate.statement.aboutAt, match.aboutAt는 알려진 원문 구간 또는 null이다. 이전 about/roleAbout과 섞거나 두 형식을 함께 쓰면 전체 거절한다. 기존 입력의 현재 주장·이전 결과에 있는 about 문자열은 바꾸지 않는다.
- claim/candidate/match 조건은 해당 at와 같은 원자료여야 한다. role 조건은 실제 basis의 자료여야 하며 null role은 null 조건만 허용한다. 여러 자료의 기재 판본을 하나로 합치지 않는다.
- 구간을 정확히 해석한 뒤 바깥 공백만 제거하고 기존80자/200자 한도를 지킨다. 잘라 저장하거나 초과 조건을 자동으로 null로 고치지 않는다. 짧게 참조할 수 없는 조건은 모델이 처음부터 null을 선택하되 중요한 판본·검사 조건을 본문 설명과 정확한 근거에 남겨야 한다. 이 조건을 빠뜨리면 의미 수용하지 않는다.
- 조건 구간도 근거이므로 material로 분류한 범위와 겹치면 거절한다. metadata/basis/note/이전 주장/보내지 않은 파일은 조건 원문이 될 수 없다. 경로와 제한된 오류 종류를 남기되 원문을 오류에 노출하지 않는다.

## 정상 제품 경로와 호환

기존 status의 map.prompt=m6는 유지하고 선택적인 laterPrompt=m7만 더한다. 새 클라이언트는 실제 후속 ask일 때만 m7을 사용하고 그 지침 ID로 시도·요청을 묶는다. 일반 provider의 후속 경로와 로컬 CLI 모두 같은 계약을 사용한다.

CLI 기존 first/map6-later 정책은 그대로다. 명시적인 새 map7-later 정책은 FIRST6와 non-FIRST7만 허용하며, FIRST7와 later6를 거절한다. 바이너리·권한·모델·299/300초·소유권·취소·대기열은 바꾸지 않는다. 기존 ready6 결과는 저장된 당시 input/schema/prompt로 회수한다. 현재 상태를 보고 새 계약으로 바꾸거나 다시 생성하지 않는다.

새 응답은 기존 MapReply about 문자열/null, project14, map-reading.5, map-input.1, map-job.1로 정규화한다. 새 저장소나 project15는 만들지 않는다. 이전 reader가 정규화된 project14를 읽는 것과 진행 중인 raw7 job을 처리하는 것은 다르다. 새7 작업이 남아 있는 상태의 구버전 클라이언트 실행은 지원한다고 주장하지 않으며, 내려가기 전에 작업을 마감·내보내고 원job 증거를 보존한다.

## 작성·수용 경계

[구체적 파일·규칙·검증 명세](IMPLEMENTATION_SPEC.json)를 따른다. 최저 production 범위는 shared map-reading/map-job, map-prompt/studio, client map-run/studio-api, 기존CLI executor의 계약 선택 연결이다. 기존 source UI·project validation·stored request shape는 유지한다. 불가피하게 범위를 늘려야 하면 변경 전 총괄에 근거를 보고한다.

작성자는 Claude 한 명이다. root는 독립 검증·선택·수용·기록을 맡는다. 새 합성 fixture로 네 조건 슬롯과 wrong-record/길이/material/null-role/metadata 오인을 확인하고, 정상1280×720 경로에서 지연 모의결과→다른 초안→명시 반영→조건·자료 왕복→백업을 확인한다. pre116 producer의 lawful ready6와 기존지침 해시도 보존 검증한다. 기존115 실패wire를 고치거나 재검증·재생성하지 않는다.

95의canonical FIRST6,96의무최종출력실패,98의candidate shape수리를 필요한 부분만 회수했다. 새 output-schema 실험이나 provider 비교로 되돌아가지 않는다. 이 계약을 수용한 뒤 실제 원기록의 후속 읽기 한 건으로 돌아간다. 116 자체의 실제 제품 생성은0이며, 이후 실제 호출은 총괄이 별도 사전 선택한다. 공개73·미수용74·UI범위75/693·키·stash를 보존하고 병합·배포하지 않는다.
