# 재현 (새 작업 디렉터리)

기존 증거를 덮지 않는 별도 디렉터리에 이 payload를 복사한다. 기존 Python/Playwright/system Chromium 및 고정 Git blob을 가진 /workspace/agentflow-studio를 사용한다. 설치/인증 변경 없음.

```sh
/workspace/browser-env/venv/bin/python assemble_runtime.py --dest fix1
/workspace/browser-env/venv/bin/python prepare_inputs.py
cp snapshots/p2-bc80e3f83e92b81347d0a56717c370e39ad47a466f18da643446c08fb8030894.py p2_check.py
cp snapshots/full-8b43aa6e91f33678af9159d22ac5deab2205afabab5c45a3cd0c592139f4a089.py full_check.py
/workspace/browser-env/venv/bin/python run_p2.py repeat-p2 "$PWD/fix1" "$PWD/fix1-runtime-manifest.json"
/workspace/browser-env/venv/bin/python launch_full.py repeat-main "$PWD/fix1" "$PWD/fix1-runtime-manifest.json"
```

snapshot을 실행용 파일명으로 복사하는 단계는 로컬 재현 편의이며 payload에는 동일 검사코드를 중복 보관하지 않았다. 출력 repeat-*는 새 이름이어야 한다. assemble_runtime.py는 이미 존재하는 목적지를 덮지 않는다.

FINAL_RESULT.json/final_gate.py는 전달된 고정 실행(v0-p2-run02 / fix1-p2-run01 / fix1-main-run02)의 원시 결과를 읽는 후처리다. repeat-*를 자동으로 평가했다고 하지 않는다. 최초 v0 회귀의 당시 checker SHA와 source runtime hash는 해당 actual-exit/result에 있다. 시험 JSON은 고정 두 사례의 정적 파생파일이며 숨은 앱 상태 주입/세 번째 실사용 사례가 아니다.
