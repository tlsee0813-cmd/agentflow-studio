# 재현 구조
제품은 정확27 기존 Cloud 작업사본 /workspace/browser-env/cycle27-fix1-candidate/app. 기존 빌드/Node22/Chromium154를 그대로 사용했다. 제품소스는 이 전달물에 복제하지 않았다.

각 실행을 재현할 때 공유 support.py/fixture.py/check-expanded.py/collector.py와 백업 JSON 2개/actual-P-return2.json을 선택한 실행 디렉터리에 복사하고, 그 디렉터리의 probe.py를 둔 뒤 `/workspace/browser-env/venv/bin/python collector.py`를 실행한다. 압축된 공유 JSON은 RAW_INDEX 원해시로 검증하여 원래 파일명으로 해제해야 한다. 각 collector는 자기 디렉터리를 EVIDENCE_DIR로 사용한다. 기존 결과 디렉터리에 덮어쓰지 말고 새scratch 디렉터리를 사용한다. 공유코드는 hash별 한 벌만 저장했으며 실행별 probe는 서로 다른 원본이다.

original은 마지막 resize 준비에서 Python API positional argument 오류가 난 원본이며 5완료+부분resize다. continuation은 그 인자를 keyword arg로 고치고 숨은PC목록의 열림기억 대조를 실제700px viewport UI에서 준비한 뒤PC로 돌아오는 6개만 이어 수행했다. trace-four는 원인 분리용4카드 1개로 별도 실행했다. 3실행을 하나의무오류실행으로 합치지 않는다. 전체 28 AB.restore/main을 직접 실행하면 마지막 map/close/fit 보정이 포함되므로 이번진입 재현으로 사용할 수 없다.

trace에서는 읽기전용 사건/DOM observer가 있고 그외 실행에는 없다. DOM scroll/focus/style/storage 수리·forceclick·고정sleep 없음. 두 native frame 관측은 최초nav 클릭직후 원시를 보존한 다음의 후속관측이며 최초성공조건을 대체하지 않는다.
