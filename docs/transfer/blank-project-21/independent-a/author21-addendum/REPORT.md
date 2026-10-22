# BLANK21 exact 작성자 검사 — 최초 준비 실패

정확 head `15b60a10b34bb06c7c173d0eca5653faef8e2bb6`. 원격 exact blank21_browser.py SHA256 `41c9f1b2eb71b55f1b468cfb3e0903c6f512394056cc2f1f1d5474f5815501e4`를 수정 없이 실행했다. cwd는 현재 제품 app이며 같은 byte의 received20/browser helper를 import했다. 신설 검사 파일만 증거 경로에 원격 그대로 추출했으며 제품 source에 추가/수정하지 않았다.

제품 app5370D0A6/CSS86DDA3/HTMLC3981C와 기존 helper는 `922848c0`/`15b60a10`/실행 disk가 byte 동일함을 대조했다. 새 head는 workflow와 blank21 검사만 다르다. 소스 전후 SHA 불변. 기존 실행 build/환경을 재사용했고 설치/재빌드/제품 수정 없음.

**원본 2메서드 모두 FAIL, 실제 child1 / 외부 collector1 / 외부 launcher1.** 양 PC 모두 `blank21_browser.py:71 prepare()`의 첫 `expect('#projects-view').to_be_visible()`에서 actual hidden. 이는 `#new-project` 클릭 이전이다. 실패 화면은 빈 작업 시작 화면이다. 새 context 초기 경로가 바로 목록이라는 검사 준비 전제와 실제 UI가 다르며, 제품의 파일 선택 위치나 수신 기능에서 실패한 것이 아니다.

| 장면 | 1280×720 | 1440×900 |
|---|---|---|
| 새 context 즉시 projects-view visible | FAIL (hidden) | FAIL (hidden) |
| 새 프로젝트 생성/첫 요청 | NOT_RUN | NOT_RUN |
| 처음 두 입구/no-repair | NOT_RUN | NOT_RUN |
| native toggle/ordinary H0/file H/template/전문 End | NOT_RUN | NOT_RUN |
| 실제 current T same-work receipt 왕복/draft/Y/open/focus/A preview0 | NOT_RUN | NOT_RUN |

독립 결과 `9f842d414255c00c5a0fb67ee771d2713845716b`는 그대로 보존하며 이 원본 실패를 독립 통과로 덮지 않는다. 원래 b0c2c933과 독립 A 재현은 실제 ‘내 프로젝트’로 이동한 뒤 정상 새 프로젝트를 눌렀다. 작성자에게 제안할 최소 보완은 **준비 단계에서 정상 UI로 프로젝트 목록에 들어가는 것**이며, 여기서는 승인 없이 코드/단언/초기 저장 상태를 바꾸거나 재실행하지 않았다. 실행 전 고쳤던 옛 작성자 초안에 대한 이야기는 이번 브라우저 실패가 아니다.

stdout/stderr 원문·실제 종료·정확 코드·source binding·원본 실패 PNG2·JSONL/snap을 포함한다. 기존 exact source script에는 별도 응답 body hash instrumentation이 없으므로 이 실행에서 새 HTTP body hash를 캡처했다고 주장하지 않는다. 같은 제품의 실제 HTTP/compiled binding은 기존 independent-a의 정확922 실행 근거로 연결하고, 이번 base helper의 real browser→real loopback HTTP/native storage 및 실제 환경은 raw/browser-environment.json으로 구분한다. console/pageerror 외부 오류는 teardown 원본에 기록됐다. paidAI0, 사용자 데이터/제품/검사 수정0.

이 addendum MANIFEST.tsv는 **이 하위 경로만**의 정확 payload 집합(자기 자신 제외)이다. independent-a의 기존 루트 manifest는 `9f842d41` 당시 최초293파일 스냅샷의 정의를 그대로 유지하며 덮어쓰지 않았다. 이후 합산/통합은 총괄 판단이다.
