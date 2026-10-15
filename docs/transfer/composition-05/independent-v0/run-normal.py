from pathlib import Path
import sys,subprocess,json,shutil
root=Path(__file__).parent;out=sys.argv[1];folder=root/out;folder.mkdir(exist_ok=True);shutil.copyfile(root/'verify.py',folder/'verify-snapshot.py')
command=[sys.executable,str(root/'verify.py'),'--out',out]
with (folder/'process.log').open('wb') as f:p=subprocess.run(command,stdout=f,stderr=subprocess.STDOUT)
d=json.loads((folder/'result.json').read_text());(folder/'process-exit.json').write_text(json.dumps({'command':command,'actual_child_exit':p.returncode,'JSON_exit':d['exit_code'],'matches':p.returncode==d['exit_code'],'syntheticProbe':False},indent=2)+'\n');print(out,p.returncode)
