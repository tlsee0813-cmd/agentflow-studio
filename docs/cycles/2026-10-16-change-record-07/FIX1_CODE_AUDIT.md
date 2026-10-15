# cycle07 fix1 좁은 코드·실행기록 감사

읽은 원본: [fix1 고정 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/0dfadba788e0f2f035bbe51b899b9c02e4260e45/docs/transfer/change-record-07/author-fix1), 비교 기준: [v0 원본](https://github.com/tlsee0813-cmd/agentflow-studio/tree/9ec6a58398c95a4ad5617f50eb16d2aa98052a4a/docs/transfer/change-record-07/author-v0). 원본 실행·브라우저 조작·원격 쓰기 없이 실제 파일 차이와 전달된 결과를 대조했다. 새 차단급 결함은 발견하지 않았다.

- **HTML 변경 범위 일치.** 실제 차이는 `change-record-study.html:500,506,508`의 준비 기본문 3줄뿐이다. 공통 계산의 조정을 미리 결정하던 요청과 메뉴의 1/16 변경만 되돌리던 요청을 근거 확인 후 선택지 제안으로 바꾸고, 미확인 항목에 요청 범위를 추가했다. CSS·배치·상태·이벤트·대상 ID·나머지 준비 기본문은 동일하다. 실제 원본은 42,420 bytes, SHA256 `d10e7dcac86bf4d569164ad9276a7686a92aec43ad4ec8bd68924e88ecf897cb`다.
- **검사 변경도 제한적이다.** 제공된 `author_check.diff-from-v0.patch`의 실제 변경 내용은 두 검사 파일의 차이와 일치한다. 문구 기대값 변경, 메뉴 PNG 이름 변경, 1440 공통 계산 준비문 값 관측·PNG 추가뿐이다. 추가한 관측은 단언이 아니다. 수집기 `run_checks.py`와 상위 실행기 `run_all.sh`는 v0와 바이트가 같다. P3의 새 요청 문구는 값 관측으로 남았지만 별도 문구 단언은 추가되지 않았다.
- **단일 실행 귀속 정합.** `run/results.json`은 두 폭(1440×900, 390×844) 완주, 75 PASS/0 FAIL, 관측 13개다. `run.log`의 판정 수와 맞는다. 최초 HTTP 응답 두 개 모두 200·42,420 bytes·위 SHA이며 파일 실행 전후 SHA도 같다. `run/exit.json`의 실제 child 종료는 0, `collector_exit.txt`는 0이다. fatal은 null, 두 폭 오류 목록은 비었다. 상위 launcher의 별도 실제 종료 기록까지 추가된 것은 아니다. 이는 작성자 실행 기록 감사이며 독립 브라우저 검증이 아니다.
- **본문 넘침은 별도 보고로만 보존해야 한다.** README 47–49행은 실행 밖에서 textarea의 `scrollHeight/clientHeight`를 측정했다고 보고한다(1440 메뉴 106/96·공통 96/96, 390 메뉴 160/96·공통 106/96). 이 수치의 원시 측정 코드·JSON·로그는 전달물에 없다. 검사에 기록된 것은 바깥 `prepScroll`의 max=0과 textarea 값이며, 내부 textarea 넘침이나 끝문장의 실제 열독 가능성을 측정한 결과가 아니다. 따라서 75 PASS에 본문 전체 가시성·마지막 조건 접근 성공을 포함하면 안 된다. 독립 Cloud에서 편집 전 `#pf-ask` 내부를 실제 스크롤해 마지막 조건에 도달하는지만 작은 장면으로 확인할 수 있다.

README의 v0 최초 실패 정정도 기존 감사와 일치한다: 측정 오류 5건과 비초기 지도 장면 준비 오류 1건이다. 이번 문구 정정이 v0의 기존 동작·검사 범위 한계를 해소했다는 주장은 없다. 사람 이해, 터치, 스크린리더 및 새 문장의 전체 열독 성공은 이번 감사에서 확인하지 않았다.

