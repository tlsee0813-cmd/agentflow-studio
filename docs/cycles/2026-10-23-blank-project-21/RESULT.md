# 첫 파일 인계 입구21 — 한정 수용
2026-10-23 KST 종료 판단. 현재 배정은 [ACTIVE](../ACTIVE.md)를 따른다.

파일 결과를 받을 수 있다는 선택지가 긴 작업문 아래에 있어 첫 인계 때 보이지 않았다. 접힌 파일 선택 묶음을 주 전달 행동 바로 뒤로 옮겼다. app.ts의 append 대상 한 줄만 바뀌며 전달·수신 권한이나 자동 실행은 추가하지 않았다. [PR12](https://github.com/tlsee0813-cmd/agentflow-studio/pull/12), 최종 후보799077ea2f645f1753f29da7fe9d4b50a81971e6, 병합241cbd891672bf1ee81bcfd97d458217a20c9f54. 병합의 부모94db8147/799077 및 변경 세 파일 blob을 대조했다.

## 실제 개선과 대가
독립 정상 UI의 두 PC에서 파일 선택 위치가 y1782/1761에서 y262로 올라왔으며 주 전달행 y178 뒤에 놓인다. 접힌 묶음이 약85px를 차지해 ‘지금 이어갈 작업’의 시작은271→356으로 내려간다. 파일 입구 발견 가능성 개선만 수용하며 상세 읽기 부담 전체가 해결됐다고 하지 않는다.

[정상 UI 원본·대표 화면](https://github.com/tlsee0813-cmd/agentflow-studio/tree/9f842d414255c00c5a0fb67ee771d2713845716b/docs/transfer/blank-project-21)은 새 프로젝트→목적→두 부분/자식/관계→실제 파일 인계→명시 합성 반환→후속 작업→지도 흐름과 같은 초기 viewport 조건의 이전 실패/이후 성공을 담는다. native 펼침/키보드, 실제 clipboard와 H, 긴 전문의 wheel·tail·닫기, 현재/과거 네 값 보존을 구분해 확인했다. 기존7종도 각각 종료0이었다. 처음의 측정 오류와 움직이는 닫기 대상 준비 오류는 원본에 남겼다. 전체 core/storage를 새로 실행한 것으로 세지 않는다.

## 검사 실패를 통과로 덮지 않음
최초 검사 전제의 current A/T·홈 진입 오류를 수정한 뒤에도 f7b25 후보 CI39815440492 Ubuntu의 BLANK21은 실패했다. 같은 원검사는 계측 없는 Cloud Chromium154에서도 두 PC 실패했다. [실패 후 관측](https://github.com/tlsee0813-cmd/agentflow-studio/blob/21a621b7575ca39bdbf94c2f16f12be37ff82832/docs/transfer/blank-project-21/independent-a/ci-ubuntu-probe/postfailure-clipping/REPORT.md)은 summary가 viewport 위로 실제 이동한 것을 확인했다. 따라서 IntersectionObserver 오탐이나143만의 문제로 결론 내리지 않았다. 계측을 넣은 실행의 성공은 이 실패를 대체하지 않는다.

최종 검사3A3C61은 ControlEnd/ShiftTab에 실제 scrollend 및 별도 연속 geometry/focus 관측을 적용했다. 고정 sleep·강제 focus/scroll·제품 변경·원 단언 완화는 없다. 두 호출과 helper를 제거하면 원212163 검사와 일치한다. [원본·패치·정적 검사](https://github.com/tlsee0813-cmd/agentflow-studio/tree/bd7dca6e2e191177c903968f544b1e4eeecaf306/docs/transfer/blank-project-21), [독립 Cloud154 최종2/2](https://github.com/tlsee0813-cmd/agentflow-studio/blob/5afb4a33c27ea5ac65bfec5d48b5def06dd490ee/docs/transfer/blank-project-21/independent-a/testfix2/REPORT.md). 이 실행에서 textarea는 이미 tail이어서 ControlEnd가 전문 전체를 이동했다는 증거는 아니다. 긴 본문 wheel 관측은 앞선 정상 UI에 따로 있다. 정확한 내부 이동 원인은 미확정이다.

## 최종 CI와 통합
[CI39823679426](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/39823679426)은 정확799077의 Windows119981211554·Ubuntu119981211229 모두 success. 각 BLANK21 2개와 뒤 static1개가 실제 실행됐다. [원응답·판정·병합 근거](https://github.com/tlsee0813-cmd/agentflow-studio/tree/0d568e78061199956b4d73a5fd1f95d99947edc6/docs/transfer/blank-project-21/ci-799077)를 공유한다. 각 로그는 마지막120000자이며 전체 artifact를 내려받아 검증한 것은 아니다. 설치 로그의 PW1.57/Chromium143.0.7499.4 build1200과 실제 browser.version JSON 회수는 다르다. Cloud143 다운로드403은 재시도/우회하지 않았다. Node20 action 폐기 경고는 제품 검사 실패가 아니다.

제품 SHA256 5370D0A6ACD3A1B60E3F5C81E8E3A4BE647665D23C18667F810B6DF7634F9F58, 최종 검사3A3C61B22EDB3F337457ADE10E1DBB13522B85BCD5B40B2E38C6038225F44303. 자동 의미 정확성·최초 사용자 발견성·전체 UI 완성 수용은 아니다. main·공개 체험판은 바꾸지 않았다.
