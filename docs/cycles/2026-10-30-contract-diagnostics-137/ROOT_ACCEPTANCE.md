# 137 거절 위치 진단 — Root 수용

실제136을 성공으로 바꾸는 수정이 아니라, 이후 map.7 응답을 거절할 때 위치·고정 규칙을 기존 영수증으로 남기는 좁은 수정이다. 136의 원응답 내용은 없고 정확한 원인은 여전히 모른다.

대상 d79673e83b230ff685024fb33234b1ee6f0227f1, 제품2a57f730e19dd8f279b9be204911d7c5ef09b7e5/app78f6842b3ba302df8444a58a904f92025ad9e3af. 기준bf11f29.

- Root 잠금TS5.8.3/Node24.19 check·build 성공, 관련72/72·fail0/skip0. 일반map호출과fakeCLI→failedjob영수증의path/rule/target 전달, 원문값 비노출, 추가retry0, 예상밖exception genericfallback을 모델없이 확인했다.
- 기준을 별도컴파일해 같은49사례를 양쪽validator에 전달했다. 수용2/거절47의결과와성공값·원입력은동일. 이corpus는map6/7이며map1–5는기존관련회귀검사로확인했다. 전체형태나모든의미에대한증명은아니다.
- Root가처음발견한Windows비교스크립트URL경로오류와복합검사의catch-all오분류는수리됐다. 예상밖오류는합성getter TypeError주입으로검사한것이며실제136에서그오류가일어났다고추정하지않는다.
- 독립최종41e0ec432ddda1dfeda39b650fb3258bcbb3c702d509a68b738fd07f174550b5: 열린P1/P2없음. 검토자는실행0,Root실행과구별한다.
- CI40999222137은 정확HEAD d79673e를checkout한양OS모두SUCCESS. Linux app279/continuity654,Windows app279/continuity651+기존skip3,fail0. 양쪽브라우저18검사·studio smoke·빌드/배포dryrun·static검사완료. 모델없는CI이며실제생성품질증거가아니다.

조건·거절순서·성공정규화·map1–6·prompt/model/예산·실행정책·apply/UI/저장정책을변경하지않는다. 새진단은고정category만;기존일부구조화오류의값echo는미변경한계이며전체진단이값을포함하지않는다고주장하지않는다. 새AI0·136재시도/수선0. 공개73/127·미수용74·UI75/693·stash/키보존.

다음은138 제한공개전달을선택한다. 수용135코드73f6f253/app3960c16d를기존지도용공개127에전달하는범위이며,131예산/133시간판본지침/135철회대상읽기수용근거를재사용한다. 새137CLI진단은이배포의제품기준에넣지않는다. 현재배포/설정·모듈/asset차분/정책보호·기존저장자료보존을다시확인한뒤같은Worker한번업로드,첫지도/jobs보류유지. 전체목표미완료.

[Root 증거](evidence/root.json) · [독립 검토](INDEPENDENT_REVIEW.json) · [CI](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/40999222137).
