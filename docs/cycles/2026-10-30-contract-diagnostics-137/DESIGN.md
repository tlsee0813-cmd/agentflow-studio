# 137 거절 위치 진단 — 범위와 종료선

136 실제RETURN은178.210초 뒤 완결JSON을 받았지만 일반 CONTRACT로 거절됐다. 최종 원문은 ephemeral/정상cleanup으로 남지 않아 어느 필드가 틀렸는지, validator 내부예외인지 확정할 수 없다. [136 결과](../2026-10-30-actual-return-136/RESULT.md). 같은 실패를 재생성하지 않고 다음 관측에서 동일한 진단 공백을 남기지 않는 작은 수리다.

## 변경

- studio.map.7 validateMapReply의 **기존 generic guard 실패 위치**에 path와 고정 분류를 부여한다. 기존 검사 순서·boolean 조건·성공 반환값·실패 경계를 그대로 보존한다. 새 prepass/두번째 validator/정규화/잘못된 값 수선 금지.
- 기존 MapReplyError→executor detail→job 영수증 경로를 재사용한다. map1–6의 오류·성공 동작과 전역 check/obj/str/arr는 바꾸지 않는다. map7에 한해 필요한 지역 helper/명시 path를 사용한다. mutable global 문맥 금지.
- 새 진단값은 정적 path(배열 index 포함), 고정 rule/category만 사용한다. 원문·모델 자유값·알 수 없는 key 이름·exception message/stack·인용문을 새 target에 넣지 않는다. 기존 구조화 오류는 보존한다.
- validateRequestMatch 복합실패는 우선 matches[i]/고정 match-contract처럼 확인 가능한 범위까지만 표시한다. 내부 실패 필드를 추측하지 않는다. 예상 밖 exception은 기존 generic CONTRACT fallback으로 남긴다.
- 원응답 보관소·로그/queue·lifecycle·prompt·model·시간·토큰·apply·schema·UI는 바꾸지 않는다. 실패안내가 reload 뒤 사라지는 기존 한계는 별도이며137에 섞지 않는다.

## 완료 관문

작성자는 작은 합성 fixture로 여러 generic 거절 종류/중첩 위치, 복합match, 민감값·extra키를 넣어도 새진단에 노출되지 않음, 기존 구조화 오류 보존, 정상 반환 deep equality, map1–6 unchanged를 확인한다. 동일 fixture를 base와 후보 validator에서 평가해 accept/reject 집합과 성공값이 같음을 비교한다. 특정136 원인이 해결됐다는 주장을 금지한다.

기존 executor 또는 job 검사 경로 하나에서 구조화 detail이 실제 실패영수증으로 전달되는 것까지 확인한다(모델 호출0). 원문저장·정리·소유권을 다시 설계하지 않는다. Root는 잠금TS/관련검사·독립검토·정확CI로 수용하고 새실제생성은 별도 선택한다. 이 수리만으로136 의미PASS나전체제품완성을 선언하지 않는다.

기준: 1658ed617916ef4857c6b6247abecd6e47bd0eb0, runtime135/app3960c16dbaf229f6100291f0252b34c50301cf33. 135 좁은 UI 수용,132·136 반려 유지. 공개127/73·미수용74·UI75/693·키·기존미커밋 보존. 공유 코드/결정은 GitHub, 원입력/백업은 로컬.
