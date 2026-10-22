# 정정한 설명과 다음 작업문 — 후속 후보 조사
2026-10-23 KST. 21 CI 반례와22 재진입 관측을 진행하는 동안의 사전 조사다. 구현·수용 결론은 아니며 현재 배정은 ACTIVE를 따른다.

## 판단의 출발
기존17에는 현재 설명을 사용자가 고치는 기능이 있다. 이를 새 보고 정정 기능으로 다시 만들기 전에, 정정한 설명이 새 요청과 다음 인계에 어떻게 전달되는지 대조한다. 구상·외부 원문·현재 참고 설명·AI 작업문·과거 H 사본의 권위를 구분한다.

Sol의 정확 f7b25 정적 대조에서 correctUnderstanding은 by:user·새 revision·corrects를 남기고 원보고를 보존한다. 새 요청과 기존 작업의 handoffText는 유효한 현재 설명을 사용자 정정·앱 미검증 참고로 싣는다. 반면 buildRequest의 ContextRequest에는 space.understanding이 없고 currentWork는 basis/intent 변경으로만 낡음을 판단한다. [작은 순수 domain 사례](https://github.com/tlsee0813-cmd/agentflow-studio/tree/28705351c3ac46a966cfbe347e4017c6c71ffd70/docs/transfer/description-correction-23/domain-probe)에서 정정 전후 입력이 ticket 외에는 같고, 기존 인계의 7일 합성 지시와30일 정정 설명이 함께 남는 경계를 재현했다. 실제 AI 오판을 관측한 것은 아니다.

## Pro 제안과 총괄 선택
[인계 권위 전용 Web Pro](https://chatgpt.com/c/6ad9e4e7-e8b4-83e8-b1f4-aebabc8d27b4)는 보고별 정정 annotation과 향후 인계에서 해당 원문을 정정문·ID로 대체하는 안을 제안했다. 총괄은 이를 바로 채택하지 않는다. 현재 설명 한 부분의 정정과 보고 전체 제외는 다른 행동이다. 일부 문장 오류 때문에 유용한 검사·근거까지 빠질 수 있으며, 현재 원문은 이미 외부 주장으로 구분된다. 원문 보존 자체를 결함으로 세지 않는다.

먼저 확인할 공백은 사용자가 명시한 설명 정정이 AI의 다음 작업문 입력에 포함되는지, 기존 AI 문구와 상충한다면 사용자에게 어디서 드러나는지다. 원문을 삭제하거나 구상/확정 기준을 자동 변경하지 않는 범위에서 판단한다. 과거 H는 당시 네 작업값·배경·anchor의 사본이지 전체 전달문을 모두 저장한 것이 아니다.

## 공식 원문 대조
총괄이2026-10-23 KST 직접 읽은 문서:
- [Crossref 정정 등록](https://www.crossref.org/documentation/register-maintain-records/maintaining-your-metadata/registering-updates/): 중요한 정정을 별도 기록으로 연결하고 원문을 조용히 덮어쓸 때 이력이 불명확해지는 문제를 설명한다. 학술 출판의 정정/철회 판정을 제품에 복제하지 않는다.
- [DataCite 관계](https://support.datacite.org/docs/connecting-to-works): 원본과 후속 기록의 방향 있는 관계를 구분한다. 현재 설명의 정정 대상을 정확히 남기는 참고이며 범용 메타데이터 체계를 도입하지 않는다.
- [npm deprecation](https://docs.npmjs.com/deprecating-and-undeprecating-packages-or-package-versions/): 사용을 권하지 않는 판본도 삭제하지 않고 경고와 함께 유지할 수 있다. 이것이 보고 전체를 인계 입력에서 제외해야 한다는 근거는 아니다.

공식 문서와 코드 조사이며 세 서비스의 실제 조작이나 사람 대상 사용성 연구가 아니다. Dify는 PC 공간·맥락 유지 비교 기준이고 이번 권위 판단의 근거로 대체하지 않는다.
