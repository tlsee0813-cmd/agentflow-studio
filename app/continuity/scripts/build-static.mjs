// Explicit separate build target. Does not change the normal server dist.
// PREVIEW35: `--preview` selects only the fixed preview target (storage prefix and short label) and its own
// output folder. The same UI/shared/browser-MOCK modules are compiled; nothing else differs.
import { compile, compilerSource } from './compiler.mjs';
import { mkdtemp, rm, mkdir, cp, copyFile, readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
const cwd=fileURLToPath(new URL('..',import.meta.url));
const targets={
  demo:{dir:'static-dist',module:'static-target.js'},
  preview:{dir:'static-preview-dist',module:'static-target-preview.js'}
};
const args=process.argv.slice(2);
if(!(args.length===0||(args.length===1&&args[0]==='--preview')))throw new Error('Usage: no arguments (continuity/static-dist) or --preview (continuity/static-preview-dist).');
const target=targets[args.length?'preview':'demo'];
const output=new URL(`../${target.dir}/`,import.meta.url);
const version=compile(['--version'],{cwd,encoding:'utf8'});
if(version.status!==0||version.stdout.trim()!=='Version 5.8.3')throw new Error('TypeScript 5.8.3 required.');
const stage=await mkdtemp(join(tmpdir(),'agentflow-static-'));
try {
  const built=compile(['-p','tsconfig.json','--outDir',stage],{cwd,stdio:'inherit'});
  if(built.status!==0)throw new Error('Static compilation failed.');
  await rm(output,{recursive:true,force:true});await mkdir(output,{recursive:true});
  await cp(join(stage,'shared'),new URL('shared/',output),{recursive:true});
  await mkdir(new URL('client/',output));
  for(const file of ['app.js','presentation.js','source-review.js'])await copyFile(join(stage,'client',file),new URL(`client/${file}`,output));
  await copyFile(join(stage,'client/runtime-static.js'),new URL('client/runtime.js',output));
  await copyFile(join(stage,'client',target.module),new URL('client/static-target.js',output));
  let html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const consent=/<label id="consent-area"[\s\S]*?<\/label>/g;
  if([...html.matchAll(consent)].length!==1)throw new Error('Expected exactly one server consent area.');
  html=html.replace(consent,'');
  html=html.replace('<meta charset="utf-8">','<meta charset="utf-8">\n  <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; img-src \'self\' data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">\n  <meta name="referrer" content="no-referrer">');
  if(!html.includes('connect-src'))throw new Error('Static CSP missing.');
  await writeFile(new URL('index.html',output),html);
  await copyFile(new URL('../public/styles.css',import.meta.url),new URL('styles.css',output));
  await writeFile(new URL('.nojekyll',output),'');
  console.log(`Explicit browser MOCK build: continuity/${target.dir}; no server adapter or provider files.`);
  console.log(compilerSource);
  // Reproducibility record: SHA-256 of every output file (no paths outside the output folder).
  const files=async(dir,base='')=>(await Promise.all((await readdir(dir,{withFileTypes:true})).map(f=>f.isDirectory()?files(join(dir,f.name),`${base}${f.name}/`):[`${base}${f.name}`]))).flat();
  const root=fileURLToPath(output);
  for(const f of (await files(root)).sort())console.log(`sha256 ${createHash('sha256').update(await readFile(join(root,f))).digest('hex')}  ${f}`);
} finally {await rm(stage,{recursive:true,force:true});}
