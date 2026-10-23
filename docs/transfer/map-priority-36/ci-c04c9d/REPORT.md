# 36 원 CI 실패 보존 — c04c9d

PR20 head `c04c9d004bc5b2bf6aeaabfcd326f612c325813a`, run `39883583618`의 원실행이다. 새 통합 head의 성공과 합산하지 않는다.

- 최종 jobs 원응답에서 Ubuntu·Windows 모두 completed/failure다.
- Ubuntu 실제 로그는 끝 120,000자이며 `logTruncated=true`다. continuity 단위 279/279와 MAP36 새 단위 4개 통과가 보인다. 기본 static build 다음 `build-static.mjs --preview`가 기존 인자 거절문으로 exit1했다. Node22.16.0이 실제 오류 구간에 명시돼 있다.
- MAP36 브라우저12개와 static35 브라우저3개를 포함한 브라우저군은 이 Ubuntu 실행에서 미실행이다. 앞부분의 루트 단위·타입 세부와 checkout 실제 SHA는 이 tail에서 회수하지 못했다.
- Windows 실패 상태는 회수했지만 로그 요청 때 PR head가 바뀌어 HTTP409가 났다. 원인은 미확인으로 남기며 다른 API로 우회하지 않았다.

총괄의 별도 소스 대조에 따르면 워크플로는 PR head를 명시 checkout한다. 수용35가 포함된 base의 preview 단계와 35 전 head의 build script가 어긋난 통합 전제 문제다. 이 설명과 실제 checkout 로그 회수 여부는 구분한다. 제품 동작 실패나 MAP36 화면 실패로 바꾸어 세지 않는다.

Code Review 도구만 사용했다. 원응답5개와 관측 시각을 무손실 압축해 제공하며 원래 로컬 파일도 유지한다. 재실행·취소·제품 변경은 없다.
