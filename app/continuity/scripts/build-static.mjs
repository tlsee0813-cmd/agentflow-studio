// Explicit separate build target. Does not change the normal server dist.
import { compile, compilerSource } from './compiler.mjs';
import { mkdtemp, rm, mkdir, cp, copyFile, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const output=new URL('../static-dist/',import.meta.url);
if(process.argv.length!==2)throw new Error('No arguments; output is continuity/static-dist.');
const version=compile(['--version'],{cwd,encoding:'utf8'});
if(version.status!==0||version.stdout.trim()!=='Version 5.8.3')throw new Error('TypeScript 5.8.3 required.');
const stage=await mkdtemp(join(tmpdir(),'agentflow-static-'));
try {
  const built=compile(['-p','tsconfig.json','--outDir',stage],{cwd,stdio:'inherit'});
  if(built.status!==0)throw new Error('Static compilation failed.');
  await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
  await cp(join(stage,'shared'),new URL('shared/',output),{recursive:true});
  await mkdir(new URL('client/',output));
  for(const file of ['app.js','presentation.js'])await copyFile(join(stage,'client',file),new URL(`client/${file}`,output));
  await copyFile(join(stage,'client/runtime-static.js'),new URL('client/runtime.js',output));
  let html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const consent=/<label id="consent-area"[\s\S]*?<\/label>/g;
  if([...html.matchAll(consent)].length!==1)throw new Error('Expected exactly one server consent area.');
  html=html.replace(consent,'');
  html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">\n  <meta name="referrer" content="no-referrer">');
  if(!html.includes('connect-src'))throw new Error('Static CSP missing.');
  await writeFile(new URL('index.html',output),html);
  await copyFile(new URL('../public/styles.css',import.meta.url),new URL('styles.css',output));
  await writeFile(new URL('.nojekyll',output),'');
  console.log('Explicit browser MOCK build: continuity/static-dist; no server adapter or provider files.');
  console.log(compilerSource);
} finally {await rm(stage,{recursive:true,force:true});}
