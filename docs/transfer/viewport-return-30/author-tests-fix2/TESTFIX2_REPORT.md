# 30 workflow 줄바꿈 보존 testfix2

검사43798과 제품/fixture는 그대로입니다. 기준 workflow는236 CRLF+14 LF-only의 혼합 원문이며 새 단계 근처는CRLF입니다. 전체 LF 정규화를 취소하고 기존 바이트를 그대로 복원한 뒤 새7줄만CRLF로 추가했습니다. 추가구간을 제거하면 baseline과 byte동일이며 ignore-space-at-eol numstat7+/0-입니다. 앞선 c90 원문/증거는 보존했습니다.

일반 core.autocrlf=false diff --check는 새 CRLF를 trailing whitespace로 판정해2입니다. 이 rawstdout/stderr/exit를 보존하고, CR을 실제 줄끝으로 다루는 command-local core.whitespace=cr-at-eol의 diff --check0을 별도로 기록합니다. 저장소 설정은 변경하지 않았습니다. 이는 실제공백을지우거나 모든줄을normalize해서검사를통과시킨것과구분됩니다. 브라우저/서버/설치/원격쓰기없고 검사/제품 재실행도 하지 않았습니다.
