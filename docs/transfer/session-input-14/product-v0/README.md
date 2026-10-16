# 입력14 두 번째 표본 — 같은 화면에 입력만 교체
2026-10-16 15:02 KST 관측 기록. 현재 상태는 checkpoint의 ACTIVE.md가 기준이다.

## 결과
기존 C11 화면 코드 변경 없이 실제 제품13 배정·반환·고정 코드 대응 입력을 적용했다. 5노드·1관계·7근거. 기능 구분과 parent는 총괄/보조 AI의 해석 제안이며 자동 추출이나 제품 소속 모델이 아니다. [대응 판단](MAPPING.md), [입력](session14-product-map.json). 첫 QA 8사건 표본과 연속 기록으로 합치지 않는다.

기존 validate 함수를 변경 없이 실행해 errors=[]·종료0. 총괄의 실제 브라우저에서는 입력 로드, 지도 부분 선택, 근거 열기·닫기, 묶음 접기, 접힌 상태의 네 변경 위치 표시, 관계 참고 열기, ‘지도에서 영역 추가 선택’에 따른 펼침·대상 전환을 확인했다.1440×900 대표 화면도 직접 보았다. 이 좁은 조작 확인을 전체 회귀나 독립 검사로 확대하지 않는다. 저장된 이미지 파일은 이 묶음에 없으며 아래 고정 런타임과 입력으로 재현할 수 있다.

작성자 주장·고정 코드 차이·독립 관측을 구별하고 v0의 선택 카드/안내 시 도구 접근 실패를 남겼다. 누락 정보를 미결 숙제로 만들지 않았다. 기존 v1은 사건 순서와 판정 변경을 전용 필드로 담지 않아 evidence/limits 설명이 길어진다. 실제 화면에서도 연구용 설명·배지가 상당한 비중을 차지한다. 구조 재사용 결과이며 제품 기본 읽기 표현의 채택 결과는 아니다.

## 재현
기존 정적 서버에서 아래 세 파일을 같은 폴더에 두고 입력 파일 경로를 `?fixtures=경로/session14-product-map.json`으로 넘긴다. 기존 두 사례와 그 목록을 수정하지 않는다. 새 라이브러리·엔진·서버 구현은 없다.
- [index.html 고정판](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0/app/index.html)
- [style.css 고정판](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0/app/style.css)
- [engine.js fix1 고정판](https://github.com/tlsee0813-cmd/agentflow-studio/blob/c4354dccc6f693bf33d5157e7e8da566d152d9a1/docs/transfer/shared-map-11/author-fix1/app/engine.js)
- [기존 schema v1](https://github.com/tlsee0813-cmd/agentflow-studio/blob/6643323316daefbe10625484bb1727a2c6a54716/docs/transfer/shared-map-11/author-v0/app/schema.md)

총괄은 기존8765 서버의 shared-map11-preview에서 `?fixtures=../session14-input-preview/session14-product-map.json`으로 실행했다. 새 서버를 만들지 않았다. 이번 입력 외 index/engine/style 바이트 변경 없음. 런타임·기존 증거를 이 폴더에 중복 저장하지 않는다.

## 다음 최소 실험
제품13 fix1을 수령하면 이 v0 입력을 보존하고 같은 부분 이름·ID를 유지한 별도 판본으로 바뀐 코드·작성자 주장·독립 관측만 대응한다. 바뀌지 않은 기능과 관계로 변화가 번지지 않아야 한다. 동일성 판단과 수동 대응이 필요했던 곳을 기록한다. 자동 갱신·사용자 수정 병합·임의 프로젝트 일반화는 아직 미검증이다.
