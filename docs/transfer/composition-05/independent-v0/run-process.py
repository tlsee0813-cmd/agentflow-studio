from pathlib import Path
import subprocess,json,shutil,sys
root=Path(__file__).parent
for out,flags in [('run-01',[]),('probe',['--probe'])]:
 folder=root/out;folder.mkdir(exist_ok=True);shutil.copyfile(root/'verify.py',folder/'verify-snapshot.py')
 command=[sys.executable,str(root/'verify.py'),'--out',out,*flags]
 with (folder/'process.log').open('wb') as f:p=subprocess.run(command,stdout=f,stderr=subprocess.STDOUT)
 d=json.loads((folder/'result.json').read_text());(folder/'process-exit.json').write_text(json.dumps({'command':command,'actual_child_exit':p.returncode,'JSON_exit':d['exit_code'],'matches':p.returncode==d['exit_code'],'syntheticProbe':bool(flags)},indent=2)+'\n');print(out,p.returncode,flush=True)
