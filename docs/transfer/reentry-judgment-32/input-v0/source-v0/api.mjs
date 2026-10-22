import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export async function loadAPI(args=process.argv.slice(2)){
  const i=args.indexOf('--module-root');
  const root=i<0?fileURLToPath(new URL('../product30-author/app/continuity/dist/public/shared/',import.meta.url)):resolve(args[i+1]);
  const modules={};for(const name of ['domain','validation','attention','hierarchy','mock'])modules[name]=await import(pathToFileURL(resolve(root,name+'.js')));
  const binding=[];for(const name of ['domain','validation','attention','hierarchy','mock','types','plan-facts','outcome']){
    const b=await readFile(resolve(root,name+'.js'));binding.push({file:name+'.js',bytes:b.length,sha256:sha(b)});
  }
  return {...modules,binding};
}
export function returnFromH(text,{report,summary=null,changes=[]}){
  const blocks=[...text.matchAll(/```json\n([\s\S]*?)\n```/g)].map(m=>JSON.parse(m[1]));
  const template=blocks.find(x=>x.schemaVersion==='agentflow.return.2'),u=blocks.find(x=>x.version==='understanding.1');
  if(!template||!u)throw Error('ACTUAL_RETURN2_AND_UNDERSTANDING_TEMPLATE_REQUIRED');
  return {...template,report,evidence:null,understanding:summary===null?null:{...u,summary,changes,proposal:null,origin:'합성32 입력 준비자 · 실제 구현/AI 실행 증거 아님'}};
}
