# 138 수용한 요청·철회 읽기 개선 공개 전달

수용135 제품73f6f253e8ce9921504011b7281584955d41716d/app3960c16dbaf229f6100291f0252b34c50301cf33를 기존 지도용 공개127에 전달한다. 공개73 전체교체가 아니라 https://agentflow-studio-existing-map-124.tlsee0813.workers.dev 의 기존범위 갱신이다. 137 진단은 아직PC후보로유지하며 이배포제품기준에포함하지않는다.

## 이유와 포함 범위

- 135: 철회가가리키는정확한이전보고·고정요청항목/판본,나중수동대응을분리해읽는UI. Root실제121·합성경계·정확CI수용근거재사용.
- 133/134: 과거결함/수리계획을현재부재·완성으로단정하지않는scope지침. 실제134고정요청한정의미수용근거재사용.
- 131: scope에plan과같은8192출력예산/plan timeout을적용한수용수리. 모델·단일시도·검사조건불변. 무제한비용/성공보장은아니다.
- 128 PC launcher는Node전용으로기존limitedWorker패키지에들어가지않는다. map/jobs보류정책은그대로다.

공개127기준6badd901과135후보의제품delta를확인했다: request-results.ts와styles.css, server/studio.mjs와plan-prompt.mjs, PC전용scripts2개. 이때shared/map-reading변경은없다.137후보전체를그대로배포하지않는다.

## 전달 관문

1. 현재원격settings/bindings/subdomain/deployment/BUILD, 기존공개73settings/BUILD와공개브라우저workspace/plans를회수한다. 예상과다르면멈추고변경이유부터대조하며원격을덮지않는다.현재배포version을rollback참조로보존한다.
2. 정확135수용제품의isolatedcheckout을잠금빌드하여 named existing-map dryrun한다. 공개127의54assets/27modules와전체file단위대조: 예상asset변경BUILD/request-results/styles, 예상servermodule변경studio/plan-prompt. 이밖차이가있으면배포전원인을확인한다. 노출권한·접근코드/키·binding·storagePrefix/schema·모델·map/jobs보류를유지한다.
3. 기존127업로드guard를현재target/manifest에만갱신하고독립검토한다. 실제metadata/module/asset전체를검사하고같은Worker정확경로로PUT1회. 실패/불명확시원receipt와원격상태부터회수하고재전송하지않는다. 새설치·계정·추가공개권한없음.
4. 배포뒤전체publicasset/다운로드module bytes/hash와BUILD·version/설정/binding/subdomain exact, map/jobs403 MAP_WITHHELD 및plan접근보호를확인한다. 실제키생성호출0. 공개73불변을확인한다.
5. 기존공개자료에서정상넓은읽기/원RQ복귀·reload·workspace/plans보존을직접확인한다. 공개자료에철회반환이없으면그사실을명시하고실제135검증을공개자료의새성공으로바꾸지않는다. 새자료주입·과거응답재생·새AI생성없이전달한다.

완료증거는영수증·변경manifest·공개bytes·설정/보호경계·저장보존·화면이다. 새지도일반성/136반환실패/기록연결기/전체경험완성은이배포로해결됐다고하지않는다. UI75/693·미수용74·키·stash보존.

선행137 좁은진단수용 ae3fc28c8ea940a79386ace4e219eedb4b534fda,정확CI40999222137양OS통과. 이문서branch의최신제품137을기본배포하지않으며정확135SHA전용checkout·manifest로분리한다.
