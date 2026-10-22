// Later Cloud round trip: read the observer's ACTUAL UI export; never guess current task/H.
import {readFile,writeFile,stat} from 'node:fs/promises';
import {loadAPI,returnFromH} from './api.mjs';
const args=process.argv.slice(2),value=name=>{const i=args.indexOf(name);return i<0?null:args[i+1]};
const handoff=value('--handoff'),report=value('--report-file'),out=value('--out');
if(!handoff||!report||!out)throw Error('USE --handoff actual-export.md --report-file labelled-synthetic-report.txt --out new-return.json [--summary-file ...] [--project backup.json] [--module-root ...]');
try{await stat(out);throw Error('OUTPUT_EXISTS_REFUSE_OVERWRITE');}catch(e){if(e.code!=='ENOENT')throw e;}
const api=await loadAPI(),summary=value('--summary-file');
const file=returnFromH(await readFile(handoff,'utf8'),{report:await readFile(report,'utf8'),summary:summary?await readFile(summary,'utf8'):null,changes:[]});
const raw=JSON.stringify(file,null,2);api.validation.parseResultFile(raw);
if(value('--project'))api.domain.inspectResultFile(api.validation.parseProject(await readFile(value('--project'),'utf8')),raw);
await writeFile(out,raw,'utf8');console.log(JSON.stringify({status:'synthetic return prepared from actual handoff template',taskId:file.taskId,H:file.returnId,descriptionIncluded:file.understanding!==null,bytes:Buffer.byteLength(raw)}));
