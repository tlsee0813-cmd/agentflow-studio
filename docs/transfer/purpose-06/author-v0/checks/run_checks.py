#!/usr/bin/env python3
"""author_check.py를 실제 자식 프로세스로 실행하고 출력·종료코드를 기록한다.
사용: python3 run_checks.py <html> <run_dir>
run_dir/run.log, run_dir/exit.json 기록. 이 수집기 자체의 exit는 자식 exit를 그대로 돌려준다(합격 신호로 쓰지 않음)."""
import sys, os, subprocess, json, datetime
html, run = os.path.abspath(sys.argv[1]), os.path.abspath(sys.argv[2])
os.makedirs(run, exist_ok=True)
here = os.path.dirname(os.path.abspath(__file__))
cmd = [sys.executable, '-I', os.path.join(here, 'author_check.py'), html, run]
t0 = datetime.datetime.now(datetime.timezone.utc).isoformat()
with open(os.path.join(run, 'run.log'), 'w') as log:
    p = subprocess.run(cmd, stdout=log, stderr=subprocess.STDOUT)
rec = {'cmd': cmd, 'started': t0, 'finished': datetime.datetime.now(datetime.timezone.utc).isoformat(),
       'child_pid_exit_code': p.returncode}
json.dump(rec, open(os.path.join(run, 'exit.json'), 'w'), indent=1)
print(json.dumps(rec))
sys.exit(p.returncode)
