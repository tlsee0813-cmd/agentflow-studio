# B · 세션 인계, 요청과 실제 상태의 불일치

## 문제를 네 가지로 분해

‘AI가 잊었다’는 말만으로 해결책을 고르면 기억 저장소부터 늘리게 된다. 이번에는 **자료가 없었는지, 있었지만 발견/로드하지 않았는지, 읽었지만 따르지 않았는지, 보고와 구현이 달랐는지**를 분리했다. 기존 조사 요약도 이 구분을 제안했으며, 아래 새로운 원문을 대조했다. [P09]

CLAUDE.md는 강제 설정이 아니라 문맥이다. Codex AGENTS.md도 run별로 발견되는 계층적 지침이지, 모든 도구의 전체 대화를 자동 전달하는 장치가 아니다. 긴 공통 문서를 하나 추가했다고 의도 전달·준수·구현이 동시에 해결되지는 않는다. [B01][B03]

## 실제 보고 패턴과 반례

서로 다른 작성자가 기록된 규칙의 재열람 실패(X04), 압축 후 보존된 내용의 가시성 부족(X05), 인계/복원 접점의 비용(X03)을 다룬다. 이는 ‘맥락 접점에서 추가 판단 비용이 생긴다’는 가설을 지지하지만, 동일 버그나 사용자 모집단의 빈도로 합치지 않는다. X06은 필요한 절차 파일이 설치되지 않은 문제다. 질문을 더 하거나 문맥을 늘리는 것으로는 설치/발견 오류가 해결되지 않는다. [X03][X04][X05][X06]

반대로 Claude에는 현재 체크포인트·재개·대화 요약/복원 기능이 공식 제공된다. 2025년 일본어 제작기의 비공식 rewind 구현을 그대로 다시 만들 근거는 약해졌다. 다만 공식 복원도 Bash/외부 변경 등 범위 제한이 있으므로, 앱에서 ‘모두 복구’한다고 넓혀 말하면 안 된다. [B02][X03]

**설계 판단:** 별도 앱을 계속 왕복하지 않게 하는 H3는 충분히 강한 대안이다. 그러나 인계 문서는 ‘중요한 내용을 압축해 주는 상품’만으로는 차별성이 약하다. 기존 문맥을 보존하면서 **다음 수행 범위와 반환 보고의 대상 버전을 명확히 하는 최소 봉투**여야 한다.

## OpenSpec에서 가져올 것과 버릴 것

실제 `specs-apply.ts`의 읽은 부분은 중복, 여러 operation에 걸친 충돌, 연산 구역 밖 요구 누락 경고, 읽기 실패와 신규 파일의 구분을 한다. near-miss 테스트는 제목의 대소문자/띄어쓰기 차이가 같은 요구를 두 벌로 만드는 경우를 다룬다. 이런 검증은 ‘AI가 적당히 처리했을 것’에 의존하지 않는 좋은 재사용 원리다. [K06][K08]

하지만 기존 요구와 delta를 이름으로 연결하는 병합에는 유지 비용이 있다. OpenSpec 기여자의 2026-10-02 열린 토론은 이 방식을 계속 유지할지, 안정 ID로 바꿀지, agent merge와 CLI checks를 분리할지 검토한다. 승인된 교체 방향은 아니다. 이것을 OpenSpec 전체 실패로 일반화하지도, 해결 완료로 표현하지도 않는다. [X07]

**우리 최소 범위:** 안정 ID, 변경 대상, 기준 revision, 명시적 추가/수정/삭제 의도, 영향받지 않는 필드 보존을 이용한다. 긴 Markdown parser와 archive CLI를 현재 브라우저 원본 데이터에 이식하지 않는다. 고객의 지시에서 언급되지 않은 기존 금지는 유지한다. ‘빠짐’이 ‘삭제 승인’으로 바뀌면 안 된다. 초기 인계 작성/명시적 직접 수정에 또 승인 단계를 붙이는 것과, 충돌하거나 범위를 넓히는 AI 제안을 검토하는 것은 다르다.

## 분야 밖 원리 1: 장부 대사

Xero 공식 색인은 실제 은행 내역과 장부 항목의 대조를 설명하고, 이체 기록과 실제 은행 송금을 구분한다. 또 자동 대사에서는 모든 항목을 매번 사람이 확인하는 방식만 쓰지 않는다. 여기서 필요한 것은 금융 기능이 아니라 **기록과 외부 관측을 섞지 않고, 불일치만 판단 대상으로 올리는 구조**다. 색인 본문 읽기이며 계정의 대사 화면을 직접 사용한 것은 아니다. [B04][B05][B06]

**Studio 상호작용 제안:** ‘D1을 60일로’ 요청이 오면 명시적인 기준 수정은 진행할 수 있다. 화면에는 ‘계획에는 60일로 반영’, 외부 관측이 없으면 ‘코드 반영은 아직 확인 자료 없음’으로 별도 표시한다. 나중에 보고가 오면 무엇이 어느 버전·범위에 대응하는지 연결한다. 기존 값과 실제 파일이 다르면 그 항목만 검토할 수 있다. 이것은 새 조합 가설이지 Xero가 소프트웨어 요구 충족을 판정한다는 뜻이 아니다.

**성립하지 않는 조건:** 자료가 없는데 ‘불일치’로 표시하면 오경보다. 자연어 요구는 금액과 달리 같은 의미의 표현이 여럿이므로 정확 일치만으로 동기화 여부를 결정할 수 없다. 파일이 달라졌다는 관측도 수용 조건 충족이 아니다. 자동 대사처럼 확신도가 높다는 이유만으로 코드 완료·운영 권한을 자동 부여하지 않는다.

## 분야 밖 원리 2: 인계 시 수신자 요약

AHRQ I-PASS는 상황/행동/예외 계획과 수신자 요약을 포함한다. 소프트웨어에 옮길 원리는 ‘보낸 사람이 길게 적었다’보다 **받는 사람이 다음 행동과 실패 시 대응을 제대로 이해했는지 확인**하는 것이다. 임상 효과 수치나 의료 분야의 책임 체계를 그대로 옮기지 않는다. [B07]

**Studio 상호작용 제안:** 다른 세션에 넘기는 인계에 목표·기준 버전·수정 범위·하지 않을 일·반환할 증거를 넣는다. 받는 쪽은 첫 행동에서 ‘이 버전의 이 범위만 수행, 부족한 입력은 이것’으로 짧게 재진술하도록 권한다. 이를 매번 고객이 눌러야 하는 승인 버튼으로 구현하지 않는다. 같은 세션의 작은 수정은 새 인계 자체를 생략할 수 있다.

**성립하지 않는 조건:** 모델이 문구만 되풀이하면 실제 준수 증거가 아니다. 동일 모델의 자가 요약을 독립 검토라고 부르지 않는다. 단순 작업을 인계 문서와 readback으로 무겁게 만들면 원래 문제보다 비용이 커진다.

## 최소 인계 봉투 — 내용 제안, 실행 규격 확정 아님

현재 앱의 `handoffText`/`ExportRecord`를 먼저 활용한다. 이미 가진 필드를 또 별도 원본으로 만들지 않는다. 출력 후보는 아래 내용이고, JSON 마이그레이션이나 새 서명 시스템을 지금 제안하지 않는다. [P04][P05]

- **이번 행동:** 목표와 지금 수행할 일. ‘결정 변경’인지 ‘구현 확인’인지 구분한다.
- **기준과 경계:** 프로젝트/작업 ID, 인계 revision, 수정할 범위, 유지할 수동값·금지 조건.
- **반환할 것:** 실제 바뀐 파일/차이, 실제 실행한 검사와 대상 버전, 안 한 일·실패·남은 일. 보고는 미검증부터 시작한다.

제공자별 AGENTS.md/CLAUDE.md를 새로 덮어쓸 필요는 없다. 기존 지침 발견 규칙에 맞는 작은 파일 또는 붙여넣기 텍스트를 선택할 수 있다. 외부 저장소를 읽을 권한이 없으면 기준 코드 값을 지어내지 않고 ‘미확인’으로 남긴다. [B01][B03]

## H2 불일치 확인함을 지금 전체 제품으로 삼지 않는 이유

현재 앱은 외부 코드 관측을 갖고 있지 않다. 따라서 지금 전면 대시보드를 만들면 주로 ‘확인 자료 없음’을 반복하거나 보고를 사실로 오인할 위험이 있다. H2는 H1 안의 예외 영역으로 시작하는 것이 작다. CONNECT001에서 관측 범위가 정해진 뒤에만 관측 기반 표시를 추가한다. [P03][P05]

명시적 사용자 수정은 가능한 범위에서 진행하고, 그 반영 사실과 아직 모르는 외부 사실을 나누는 것이 핵심이다. ‘불확실하면 모두 멈추고 재승인’과 ‘자동으로 완료라 해석’ 사이에 이 경로가 있다.


---
출처 링크(열람 범위·한계는 `01_SOURCE_MAP.md` 참조)

[B01]: https://code.claude.com/docs/en/memory
[B02]: https://code.claude.com/docs/en/checkpointing
[B03]: https://learn.chatgpt.com/docs/agent-configuration/agents-md
[B04]: https://central.xero.com/0/article/Reconcile-your-bank-account
[B05]: https://central.xero.com/0/article/Transfer-money-between-your-bank-accounts-in-Xero
[B06]: https://central.xero.com/s/article/About-auto-bank-reconciliation-powered-by-JAX
[B07]: https://www.ahrq.gov/teamstepps-program/curriculum/communication/tools/ipass.html
[K06]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/src/core/specs-apply.ts
[K08]: https://github.com/Fission-AI/OpenSpec/blob/9111a7654d7800391459431fff4eaf66e33a3d2e/test/core/specs-apply.requirement-name-near-miss.test.ts
[P03]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/README.md
[P04]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/types.ts
[P05]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/app/continuity/src/shared/domain.ts
[P09]: https://github.com/tlsee0813-cmd/agentflow-studio/blob/6666c6bd35a1a01419d3a082b6dfc776ce3db717/docs/research/qualitative-findings.md
[X03]: https://zenn.dev/botachan/articles/ec492aef5658e6
[X04]: https://github.com/anthropics/claude-code/issues/33026
[X05]: https://github.com/anthropics/claude-code/issues/21788
[X06]: https://github.com/Fission-AI/OpenSpec/issues/1120
[X07]: https://github.com/Fission-AI/OpenSpec/issues/2033
