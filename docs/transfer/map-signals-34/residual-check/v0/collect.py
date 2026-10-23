import subprocess,datetime,json,pathlib,sys
r=pathlib.Path(__file__).parent;now=lambda:datetime.datetime.now(datetime.timezone.utc).isoformat();start=now();cmd=['/workspace/browser-env/venv/bin/python',str(r/'check.py')]
with (r/'stdout.log').open('w') as o,(r/'stderr.log').open('w') as e:p=subprocess.run(cmd,stdout=o,stderr=e)
(r/'collector.json').write_text(json.dumps({'command':cmd,'startUTC':start,'endUTC':now(),'actualChildExit':p.returncode,'outerExit':p.returncode},indent=2));sys.exit(p.returncode)
