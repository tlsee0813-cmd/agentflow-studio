# 재현

기존 환경에 exact acf의 app/ 및 experiments/idea016/cases.mjs만 cycle19-fix1-candidate/로 git archive한다. npm run check/build 및 node continuity/scripts/check.mjs/build.mjs. 원본 소스를 고치지 않고 source before/after hash를 확인한다. 이 payload 코드/fixture는 /workspace/browser-env/cycle19-fix1-independent/에 배치한다. GEO AST helper는 measurement-reuse/cycle18-fix4-ui.py를 기존 cycle18-fix4-independent/ui.py에 둔다(실행하지 않고 literal만 읽는다). layout-phase가 AST로만 읽는 w19-failure-diagnostic.py 역시 실행목록이 아니다.

launch.py → author-collector.py는13개 명령을 별도 actual subprocess returncode로 기록한다. independent-launch.py → independent-collector.py는 기존 established6프로그램을 실행했다(실제첫종료1). purpose-event-ready-collector.py는 동일source에서 purpose만 별도 재실행(0)했고 status-scroll-diagnostic-collector.py도 별도2PC(0)이다. 원본 first code/results는 보존한다. CODE_REUSE/CODE_DIFFS에서 경로/SHA 변경과 native event readiness 추가를 확인한다. 시작/끝/실제child 및외부collector는 process JSON, TOOL_COMPLETIONS는 실행도구의 완료 영수증이며 전체 tool 원문이 아니다.

old-product-v2-control은 별도 cycle19-old-product-v2-check/app에81d를 추출한 뒤 workspace19_browser.py 한 파일만 acf exact검사기로 overlay한 진단이다. build2명령 후 W196개 실행, 실제예상실패2/exit1. 고정원본81d 경로는 변경하지 않았다. 통과제품 관문과 합성negative control을 합산하지 않는다.
