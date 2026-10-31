import { compile, compilerSource } from './compiler.mjs';
import { spawnSync } from 'node:child_process';
import { readdir,readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const type=compile(['--noEmit','-p','tsconfig.json'],{cwd,stdio:'inherit',shell:process.platform==='win32'});if(type.status!==0)process.exit(type.status??1);
async function walk(dir){const out=[];for(const f of await readdir(dir,{withFileTypes:true})){const p=`${dir}/${f.name}`;out.push(...f.isDirectory()?await walk(p):[p]);}return out;}
for(const f of [...await walk(`${cwd}/server`),...await walk(`${cwd}/connector`),...await walk(`${cwd}/scripts`),...await walk(`${cwd}/tests`)].filter(p=>p.endsWith('.mjs'))){if(spawnSync(process.execPath,['--check',f],{stdio:'inherit'}).status!==0)process.exit(1);}
for(const f of [...await walk(`${cwd}/src`),...await walk(`${cwd}/public`)])if(/DEEPSEEK_API_KEY|api\.deepseek\.com|process\.env/.test(await readFile(f,'utf8')))throw new Error(`Client boundary violation: ${f}`);
console.log('IDEA015 type, syntax and client/server boundary checks passed.');

console.log(compilerSource);
