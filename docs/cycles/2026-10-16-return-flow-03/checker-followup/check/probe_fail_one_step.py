"""의도적 실패 프로브 — flow_check.py가 단계 FAIL을 실제 nonzero 종료로 연결하는지 확인.

이 파일은 성공 증거가 아니라 '실패가 실패로 끝나는지'의 증거다. 결과는 항상 FAIL이어야 한다.
HTML·화면·입력은 바꾸지 않는다. flow_check.py도 수정하지 않고, 실행 중 Run.step만 감싸서
d1440의 첫 회 단계 4 하나에 의도적 실패 판정 1개를 더한다(나머지 단계는 실제 그대로 수행).

실행: python3 probe_fail_one_step.py <URL> <HTML 경로> <출력 폴더>   → 기대: exit 1
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import flow_check  # noqa: E402

_orig_step = flow_check.Run.step


def _probe_step(self, no, title, fn):
    if self.name == "d1440" and no == 4:
        def failing(rec):
            fn(rec)
            self.chk(rec, "PROBE: 의도적 실패(검사기 종료 코드 확인용)", False, "probe_fail_one_step.py")
        return _orig_step(self, no, title, failing)
    return _orig_step(self, no, title, fn)


flow_check.Run.step = _probe_step

if __name__ == "__main__":
    sys.exit(flow_check.main(sys.argv))
