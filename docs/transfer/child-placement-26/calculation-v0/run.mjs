import {spawnSync} from 'node:child_process';
import {writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
const [label,command,...args]=process.argv.slice(2),folder=fileURLToPath(new URL('.',import.meta.url));
mkdirSync(folder,{recursive:true});
const start=new Date().toISOString(),r=spawnSync(command,args,{encoding:'utf8',cwd:process.cwd(),maxBuffer:20_000_000});
writeFileSync(`${folder}/${label}.stdout.log`,r.stdout??'');writeFileSync(`${folder}/${label}.stderr.log`,(r.stderr??'')+(r.error?String(r.error):''));
writeFileSync(`${folder}/${label}.exit.json`,JSON.stringify({command,args,cwd:process.cwd(),node:process.version,start,end:new Date().toISOString(),status:r.status,signal:r.signal,error:r.error?String(r.error):null},null,2));
process.stdout.write(r.stdout??'');process.stderr.write(r.stderr??'');if(r.error)console.error(r.error);process.exit(r.status??1);
