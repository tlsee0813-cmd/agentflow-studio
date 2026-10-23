# 34 기준 UI 관측 — 후보 비교 전

정확 기준 `575bb7452044e0d987453a24e31680d2d8077b6c`(app subtree `adf88ae1d90bace46485175c531a46ab846a74d0`)에서 1280×720·1440×900 다섯 장면군을 관측했다. 기존 동등 subtree의 빌드를 재사용했으며 원격 source·실제 HTTP body·실행 disk 전후 SHA를 연결했다. 후보34는 실행하지 않았다.

입력은 고정 T2(584bca013cdfcb3383a028b54dc5158ca438f8690e4a7e4420fe9a11a8b68fc7)와 db5 mixed-long-title(4790bcd16f5700b0a584a4d98d7f3e88f93e430d69c5ba01176ec656374f80cb)이다. 원본을 중복 게시하지 않는다. db5 입력/생성 근거는 `docs/transfer/map-signals-34/input-v0/`. 작성자도 이 입력을 참고했고 실행자는 T2를 알고 있으므로 맹검·사람 연구가 아니다.

## 실제 관측

1. T2 첫 지도: 보정 맞춤 없이 이름/소속/카드·신호·글자 Range/조상 clip·표본 hit를 저장했다. 말단 별도 기록 신호는 없었다. 기존 정보 버튼에서 소유 설명/요청 목록을 내부 native wheel로 읽고 닫았다. 새 말단 입구 성공으로 세지 않는다.
2. T2 부모를 native 접은 뒤 기존 집계 신호로 기록을 열었다. 첫 소유자·질문 글줄은 PNG/텍스트/Range에 보존했다. 닫기는 원 부모 신호에 초점 복귀했다. 전체 글자 가독성/스크린리더 사용성을 증명하지 않는다.
3. 혼합 입력 첫 지도와 Q 이전기준·S 보류만 존재하는 읽기를 구별했다. 긴 공통 제목은 기존 clamp로 구별 단어가 잘린다. 원문 DOM 존재와 실제 노출을 분리했다. 숨은 자식 DOM은 bbox0이며 보이는 카드로 세지 않았다.
4. 혼합 부모 접기→정확 부모 기록→닫기를 수행했다. 관계 상대 B를 자식으로 세지 않았다. 읽기만 수행한 네 context의 저장 envelope는 각각 byte 동일했다. 닫은 뒤 pageY0/원 카메라와 호출 초점을 기록했다.
5. 실제 H_SYN34_P_CURRENT/template 기반 명시 합성 파일을 정상 선택·미리보기·가져오기했다. 두 PC 모두 새 report task+1, 정확 H/parent/raw, 이전 task/source prefix·manual·bases·현재 B·Q 대상 미전송 초안·영역/관계/구상 보존을 확인했다. 실제 AI·구현 완료가 아니다. 정상 전체공간 이동 후 ‘이번 탭 설명 갱신1’이 나타났다. 안내로 map top은 292.484375→336.484375(+44), 높이는 44 감소했으나 matrix·접힘은 유지됐다. 이 일반 이동을 명시 origin 복귀로 부풀리지 않는다.

## 실행/오류 경계

Node22.16.0 / Playwright1.57.0 / Chromium154.0.8037.57. controller child0, 외부 실행도0, 후행 보존 gate0. pageerror 없음, 실제 HTTP/disk hashes 일치. server -15는 기록 완료 후 의도적 종료다. 최초 환경 도구 오류는 프로세스 미착수로 별도 NOTE에 남겼다. 1280의 사용하지 않은 추측 probe selector 두 개 count0은 측정 준비 오류이며 통과로 세지 않았다. 파일 입력을 향한 wheel 초과 후 반대 wheel로 회복한 조작도 원로그에 남겼다. 패키징 첫 실행은 PNG 이름 오기로 exit1, 원 코드를 보존하고 실제 파일명만 고쳐 재실행했다. 제품/검사 의미단언 변경은 없다.

`controller.py`/`launcher.py`는 실제 실행 코드, `RAW_INDEX.json`은 무손실 gzip 원 bytes/SHA와 압축 SHA다. `RESULT.json`은 보존 gate 결과이며 시각적 부재를 성공으로 바꾸지 않는다. `MANIFEST.tsv`는 자신을 제외한 정확 payload 집합이다. 원시 PNG 전량 대신 대표8장만 게시한다. 전체 UI 원본은 Cloud scratch에 유지했다.

후보 A/B, 새 UI 채택, 32 전체완주, 모든 회귀·모바일·사람 이해성은 미실행이다. 이 기준의 말단 신호 부재/긴 이름 clamp를 후보 조건에 맞춰 수정하지 않았다.
