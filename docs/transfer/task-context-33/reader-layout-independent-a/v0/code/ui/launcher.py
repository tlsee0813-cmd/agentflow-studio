from pathlib import Path
import subprocess,sys,threading,json,datetime,hashlib
R=Path(__file__).parent;start=datetime.datetime.now(datetime.timezone.utc).isoformat();cmd=['/workspace/browser-env/venv/bin/python',str(R/'controller.py')];p=subprocess.Popen(cmd,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,bufsize=1)
def output():
 with (R/'controller.stdout-stderr.log').open('w') as f:
  for line in p.stdout:f.write(line);f.flush();print(line,end='',flush=True)
t=threading.Thread(target=output);t.start()
for line in sys.stdin:
 p.stdin.write(line);p.stdin.flush()
 try:
  if json.loads(line).get('op')=='finish':break
 except Exception:pass
p.stdin.close();rc=p.wait();t.join();(R/'process.json').write_text(json.dumps({'command':cmd,'startUTC':start,'endUTC':datetime.datetime.now(datetime.timezone.utc).isoformat(),'actualChildExit':rc,'combinedLogSHA256':hashlib.sha256((R/'controller.stdout-stderr.log').read_bytes()).hexdigest()},indent=2));sys.exit(rc)
