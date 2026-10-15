#!/usr/bin/env python3
"""수집기: wording_check.py를 실제 자식 프로세스로 실행하고 출력·자식 종료코드를 기록한다.
사용: python3 run_checks.py <html> <run_dir>
run_dir/run.log, run_dir/exit.json(child_exit_code) 기록. 이 수집기는 자식 종료코드를 그대로 반환한다.
수집기 자신의 종료코드는 상위 run_all.sh가 collector_exit.txt에 별도로 남긴다."""
import sys, os, subprocess, json, datetime
html, run = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
os.makedirs(run, exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))
cmd = [sys.executable, '-I', os.path.join(here, 'wording_check.py'), html, run]
t0 = datetime.datetime.now(datetime.timezone.utc).isoformat()
rc = None
try:
    with open(os.path.join(run, 'run.log'), 'w') as log:
        p = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT, timeout=600)
    rc = p.returncode
except subprocess.TimeoutExpired:
    rc = 'timeout'
rec = {'cmd': cmd, 'started': t0, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'child_exit_code': rc}
json.dump(rec, open(os.path.join(run, 'exit.json'), 'w'), indent=1)
print(json.dumps(rec))
sys.exit(rc if isinstance(rc, int) else 2)
