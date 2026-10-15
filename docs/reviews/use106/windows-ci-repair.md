# USE106 Windows CI 마무리 수리

원본 소스 `a84f83a77a9115d45a2a38a77c5d10f018d05901`의 [CI 38702330366](https://github.com/tlsee0813-cmd/agentflow-studio/actions/runs/38702330366)에서 Ubuntu는 전체 성공, Windows는 새 USE106 검사 test 07만 실패했다. Windows의 뒤이은 static 검사는 건너뛰었다. 이 상태로 게시하지 않았다.

[실패 로그](logs/windows-ci-failure.log)의 위치는 `use106_browser.py:173`, `navigator.clipboard.readText()`와 textarea 전문 비교다. Windows 반환값은 `\r\n`, textarea는 `\n`이다. 나머지 새 검사 10개는 성공했다. CLI 로그 다운로드가 환경 접근 제한으로 실패하여 GitHub 커넥터의 동일 job `116313265536` 로그를 읽었다.

수정 파일은 `app/continuity/tests/use106_browser.py` 한 곳이다. 네이티브 클립보드에서 읽은 값의 **CRLF 쌍만 LF로 변환**한 뒤 원래 기대 전문과 여전히 전체 동등 비교한다. `strip`, 공백 제거, 부분 문자열 비교, skip, mock clipboard, assertion 삭제를 사용하지 않는다. 줄 수·본문 문자·원문·ID·권한이 달라지면 계속 실패한다. Markdown 다운로드 전문 동등 검사도 그대로다. 제품 코드·정적 자산·스키마·provider에는 변경이 없다.

이 수정은 플랫폼의 줄끝 표현 차이와 콘텐츠 변경을 구분한다. Windows 성공 여부는 새 커밋의 정확한 CI로 판단하며, Linux 재실행만으로 Windows 성공을 주장하지 않는다. [로컬 USE106 재검사](logs/windows-repair-local.log)는 11/11 성공했다.

수정 후 정적 build의 15개 파일 해시가 수용된 `a84f83a7`의 실행 산출물과 모두 같은지도 확인한다. 공개는 새 SHA의 두 OS 전체 필수 단계 성공과 원격 gh-pages 기준 일치 이후에만 진행한다. README/PROJECT_STATUS나 기존 검사는 수정하지 않았다.
