"""External run collector for PC12 fix1 evidence.
Runs each command as its own child process (no shell loop), and records per child: name, argv, cwd, start/end (UTC ISO),
duration, the child's real returncode, log path and the log's bytes/SHA-256. One JSON line per child is appended to
the collector file immediately after that child ends, so an interrupted run keeps what finished.
Usage: python3 collect.py PLAN.json COLLECTOR.jsonl LOGDIR
PLAN.json: [{"name": "...", "cmd": ["argv", ...], "cwd": "...", "env": {"K": "V"}}]
"""
import datetime, hashlib, json, os, subprocess, sys
from pathlib import Path

plan = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
out = Path(sys.argv[2]); logdir = Path(sys.argv[3]); logdir.mkdir(parents=True, exist_ok=True)
now = lambda: datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='milliseconds')
worst = 0
for step in plan:
    log = logdir / f"{step['name']}.log"
    env = {**os.environ, **step.get('env', {})}
    start = now(); t0 = datetime.datetime.now()
    with open(log, 'wb') as fh:
        rc = subprocess.run(step['cmd'], cwd=step.get('cwd'), env=env, stdout=fh, stderr=subprocess.STDOUT).returncode
    end = now(); data = log.read_bytes()
    rec = {'name': step['name'], 'cmd': step['cmd'], 'cwd': step.get('cwd'), 'env': step.get('env', {}), 'start': start, 'end': end,
           'seconds': round((datetime.datetime.now() - t0).total_seconds(), 2), 'returncode': rc,
           'log': str(log), 'logBytes': len(data), 'logSha256': hashlib.sha256(data).hexdigest()}
    with open(out, 'a', encoding='utf-8') as fh: fh.write(json.dumps(rec, ensure_ascii=False) + '\n')
    print(f"{step['name']}: returncode={rc} ({rec['seconds']}s)", flush=True)
    worst = worst or rc
sys.exit(1 if worst else 0)
