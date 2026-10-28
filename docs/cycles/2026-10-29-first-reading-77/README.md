# AF-EXPERIENCE77 · 첫 읽기 계약 실험 (독립 모듈)

**이 실험은 최종 지도 전달의 해결을 증명하지 않는다.** 노드·소속·관계·현재 지도 적용 책임을 뺀 작은 첫 읽기가 기존 69 `studio.digest.2` 읽기에 비해 전달(완료·시간)과 의미(정확 근거에 붙은 요구·설명·보고·예문·선택·불확실성)에서 어떤 계약 차이를 보이는지만 잰다. 첫 읽기가 성공해도 지도 실패가 해결된 것이 아니다. 제품 runtime·app·shared·UI·server·설정은 바꾸지 않았고, 이 모듈은 지도를 만들거나 바꾸거나 승격하지 않는다.

## 무엇인가

- `reading77.mjs`: 기존 `span.2` decode와 600 UTF-16 연속 범위 해석(`resolveEvidenceRange`)을 그대로 import해 쓰는 독립 계약.
- wire: `{"items":[{"kind","text","refs":[...]}]}`. `kind`는 `requirement`(원문의 요구, 계획) / `description`(원문의 설명·정의) / `report`(작성자 보고, 앱 실행 확인 아님) / `example`(내부 예문·표본) / `choice`(원문이 명시적으로 남긴 선택) / `uncertain`(모델의 해석 불확실성, 사용자 미결정 아님).
- 안전 상한만: items 16, text 240자, refs 1~3. 채우기나 항목 수를 합격 기준으로 쓰지 않는다.
- 엄격 검증: 정확한 키, 알려진 kind, 각 ref가 보낸 기록의 정확한 연속 구간(600 이내). 잘린 JSON·무효 항목·구조 필드(parent, relations, key 등)가 하나라도 있으면 **전체 거절**하고 고치거나 버리지 않는다. 항목이 없으면 `empty: true`의 명시 결과다(성공 아님).
- 각 인용이 정확해도 항목의 의미가 맞다는 보증은 아니다.

## root가 import하는 예

```js
import * as M from './app/continuity/dist/public/shared/map-reading.js';
import { makeAsk77, bindingOf77, providerBody77, PROVIDER77, decodeReading77 } from './docs/cycles/2026-10-29-first-reading-77/reading77.mjs';

const source = M.buildMapAsk(project, view, [], undefined, M.MAP6_SCHEMA).ask; // 또는 c539 지도 요청에 쓴 map.6 ask 그대로
const ask = makeAsk77(source);            // project·records만 복사, source 불변
const binding = bindingOf77(ask);         // index·기록별 digest·ask digest (모델이 만들지 않음)
const body = providerBody77(ask, 'deepseek-flash'); // enabled·low·8192·json_object; endpoint·키·PROVIDER77.timeoutMs(60s)는 호출자 몫
// ... 호출자가 provider를 한 번 호출하고 finish_reason을 따로 확인한 뒤:
const reading = decodeReading77(choice.message.content, ask); // Reading77Error(path, rule)로 전체 거절, 아니면 { empty, items[{kind,text,refs[{ref,record,from,to,quote}]}] }
```

`refs`의 `from`·`to`는 **보낸 발췌** 안의 UTF-16 위치다. 기록 전체 좌표는 호출자가 원래 `MapInput.records`의 `from`을 더해 구한다(발췌가 기록 처음부터면 같다).

## 실행

```sh
node continuity/scripts/build.mjs          # app/에서; 잠긴 TypeScript 5.8.3 필요
node --test docs/cycles/2026-10-29-first-reading-77/reading77.test.mjs   # 저장소 루트에서
```

합성 반례 6개: 같은 문장 두 위치 중 둘째의 정확 위치, 문서 끝 부정과 예문·요구의 분리, 잘못된 ref·600 초과·역순·불완전 JSON·유효+무효 혼합·구조 필드 추가의 전체 거절, 빈 결과, 입력 불변, provider 설정. **테스트 응답의 kind는 테스트가 쓴 정답이며 모델 추론 검증이 아니다.**

## 한계

- 실제 API는 호출하지 않았다. 같은 3원본 각 1회 실행과 의미·시간 판정은 root 몫이며, 그 전에는 운영을 바꾸지 않는다.
- 이 작성 환경에는 TypeScript 6.0.2만 있어, 잠긴 5.8.3 대신 TS6으로 `dist`를 만들어 실행했다(기존 `app.ts`의 TS6 전용 진단 1건 무시). 고정 5.8.3 빌드에서의 실행은 root가 확인한다.
- 30초 안에 첫 결과를 쓸 수 있는지는 검증할 가설이지 이 모듈의 보장이 아니다.
