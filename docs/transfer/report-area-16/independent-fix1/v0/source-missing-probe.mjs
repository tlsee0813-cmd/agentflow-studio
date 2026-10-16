import {readFileSync,writeFileSync} from 'node:fs';
import {parseProject} from '../cycle16-v0/app/continuity/dist/public/shared/validation.js';
const p=JSON.parse(readFileSync(new URL('./independent/fixture-1280.json',import.meta.url)));p.tasks[0].sourceIds.push('S_missing_independent');let result;
try{parseProject(JSON.stringify(p));result={rejected:false}}catch(e){result={rejected:true,error:e.message}}
writeFileSync(new URL('./source-missing-probe.json',import.meta.url),JSON.stringify({scope:'offline invalid fixture rejection; not injected into browser/runtime',...result},null,2));if(!result.rejected)process.exitCode=1;
