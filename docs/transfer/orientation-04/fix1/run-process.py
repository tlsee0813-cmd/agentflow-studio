from pathlib import Path
import subprocess,json
r=Path(__file__).parent
for folder,flags in [('output',[]),('probe',['--probe'])]:
 out=r/folder;out.mkdir(exist_ok=True)
 with (out/'process.log').open('wb') as f:p=subprocess.run(['/workspace/browser-env/venv/bin/python',str(r/'verify.py'),*flags],stdout=f,stderr=subprocess.STDOUT)
 data=json.loads((out/'result.json').read_text());(out/'process-exit.json').write_text(json.dumps({'command':['verify.py',*flags],'actual_process_exit':p.returncode,'json_exit_code':data['exit_code'],'matches':p.returncode==data['exit_code'],'syntheticProbe':bool(flags)},indent=2)+'\n');print(folder,p.returncode,flush=True)
