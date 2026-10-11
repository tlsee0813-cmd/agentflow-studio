# DeepSeek 공식 근거 — 확인일 2026-10-12

공개 문서 조사이며 계정 API 조회·키 열람·실제 호출은 없다. 아래 API 기능은 공개 지원 설명이다. 특정 계정에서의 실제 수용, 응답 backend 지문, reasoning 토큰 사용 여부는 Cloud 후속에서 확인한다. 모델 이름을 V3/R1/다른 모델로 추정해 바꾸지 않는다. 가격·한도 잔여·예산 계산은 하지 않았다.

## 확인한 부분과 적용

| ID | 공식 원문 URL | 확인한 부분 | 이 실험에 적용하는 해석/한계 |
|---|---|---|---|
| D1 | https://api-docs.deepseek.com/quick_start/pricing/ ; https://api-docs.deepseek.com/news/news260910/ | 최신 반환된 공식 색인은 `deepseek-flash`를 DeepSeek-V4.1-Flash로 안내하며 thinking/non-thinking, JSON Output, 1M context, 최대384K 출력을 표시한다. 2026-09-10 공지도 별칭을 확인한다. | Cloud의 반환명 `deepseek-flash`와 공개 설명이 일치한다. 그 문자열만으로 계정의 불변 checkpoint를 식별했다고 하지 않는다. 공급자 최대값은 앱의 128KB/4096 제한과 별개다. |
| D2 | https://api-docs.deepseek.com/api/create-chat-completion/ | 최신 공식 색인의 REST `/chat/completions`: thinking enabled/disabled, effort none/low/high/max, max_tokens 1–393216; 생략 시 비추론8K/추론64K/max effort128K. content와 reasoning_content가 분리되며 usage의 completion_tokens_details.reasoning_tokens 제공. | 고정 high와 명시 토큰값을 사용하고 기본값/호환별칭 매핑에 기대지 않는다. completion 예산을 최종 JSON 전용으로 생각하지 않는다. 실제 reasoning 토큰은 반환 usage에서 관찰하고 누락은 미확인. |
| D3 | https://api-docs.deepseek.com/guides/thinking_mode/ | thinking toggle/effort, SDK에서 thinking을 extra_body로 전달, reasoning_content와 최종 content 분리, tool 없는 후속에서는 reasoning 재전송 불필요. 최신 색인은 low/high/max 및 high 기본값을 안내한다. | app은 SDK가 아니라 raw REST를 쓰므로 wire 최상위 필드로 설정한다. reasoning 본문을 출력 계약·다음 INPUT으로 합치지 않는다. 이 모드를 켜면 우리 사례가 개선된다는 보증은 아니다. |
| D4 | https://api-docs.deepseek.com/guides/json_mode/ | response_format=json_object, prompt에 JSON 지시/예시, 충분한 max_tokens 필요. 빈 content가 생길 수 있다는 주의. | 기존 023 JSON 지시·8키 검증을 그대로 쓴다. JSON 모드 지원은 의미/앱 schema 준수나 완료 판정 보증이 아니다. 빈 답·length를 고쳐 성공 처리하지 않는다. |
| D5 | https://api-docs.deepseek.com/quick_start/rate_limit/ | 비스트리밍 keep-alive 빈 줄, 스트리밍 주석. 직접 읽은 문서는 추론 시작 대기가 10분에 도달하면 연결을 닫는다고 설명한다. | 이는 앱의 15초/제안60초 timeout이나 완료 SLA가 아니다. 이번에는 streaming/SDK/timeout 자동 연장을 도입하지 않는다. |
| D6 | https://api-docs.deepseek.com/zh-cn/api_samples/chat_curl/ | 공식 curl 예제의 REST body에 thinking enabled, reasoning_effort high, stream false가 최상위다. | 요청 형식만 참고했다. 직접 열람된 예제는 다른 모델명인 v4-pro를 썼으므로 그 모델명은 복사하지 않는다. 키/헤더/명령 실행도 하지 않았다. |

## 웹 반환 시점 차이 — 숨기지 않는 부분

같은 URL에서도 검색 색인은 대체로 약 2주 전 수집된 deepseek-flash/V4.1 안내를 반환했지만, 직접 open은 약 2개월 전의 v4-pro/v4-flash 예시·매핑을 반환하거나 timeout으로 실패했다. 특히 thinking의 top_p/호환 effort 매핑 설명에 차이가 있었다. 직접 열람된 구판 가이드는 thinking에서 top_p 무효라고 하지만 최신 API 색인은 thinking에서 0.95–1.0 범위라고 설명한다.

따라서 수집 시점이 다른 페이지를 한 최신 원문처럼 합치지 않았다. 이번 제안은 **공통으로 확인되는 enabled/high와 JSON/content 분리**를 사용하고, top_p·temperature·호환별칭을 새로 설정하지 않는다. 숫자 상한/별칭 최신 설명은 직접 live 계정 검증이 아니라 위 공식 색인의 확인값이다. 공식 API reference의 completion/usage 정의로 reasoning도 생성 예산에 포함해 다루는 설계를 택했으며, 이번 계정에서 토큰/시간 상호작용을 실측한 것은 아니다.

최신 모델 상세를 확인한 공식 색인의 실제 반환 URL:
`https://api-docs.deepseek.com/quick_start/pricing/?push_animated=1&theme=light&webview_progress_bar=1`
(직접 open 재시도는 cache miss였다.)

자료 원문을 그대로 코드로 실행하지 않았다. 공식 예제/문서는 API 형식 근거, 설정 선택과 기대 효과는 이 프로젝트의 제안, Cloud의 20회는 사용자 제공 관측으로 구분한다. 다른 제공업체/모델/새 라이브러리 조사는 필요하지 않아 추가하지 않았다.
