import { compile, compilerSource } from './compiler.mjs';
import { spawnSync } from 'node:child_process';
import { mkdir, copyFile, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const result=compile(['--version'],{cwd,encoding:'utf8',shell:process.platform==='win32'});
if(result.status!==0||result.stdout.trim()!=='Version 5.8.3')throw new Error('TypeScript 5.8.3 required. Install using app/package-lock.json.');
await rm(new URL('../dist',import.meta.url),{recursive:true,force:true});
const built=compile(['-p','tsconfig.json'],{cwd,stdio:'inherit',shell:process.platform==='win32'});
if(built.status!==0)process.exit(built.status??1);
await mkdir(new URL('../dist/public',import.meta.url),{recursive:true});
for(const f of ['index.html','styles.css'])await copyFile(new URL(`../public/${f}`,import.meta.url),new URL(`../dist/public/${f}`,import.meta.url));
console.log('IDEA015 built separately; existing app/dist and historic gates unchanged.');

console.log(compilerSource);
