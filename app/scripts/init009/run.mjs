import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fixedPlan } from './contract.mjs';
const COMMANDS=['--plan','--prepare-firsts','--prepare-followups','--review-only','--review-followups',
  '--firsts','--followups','--collect','--questions','--answer-draft','--items-draft','--record-items',
  '--mock','--mock-firsts','--mock-followups','--mock-collect','--mock-questions','--mock-answer-draft','--mock-items-draft','--mock-record-items'];
export function parseCommand(args){
  if(args.length===0)return '--plan';
  if(args.length!==1||!COMMANDS.includes(args[0]))throw new Error('ARGUMENTS');
  return args[0]==='--mock'?'--mock-firsts':args[0];
}
export async function runCommand(command,{env=process.env}={}){
  if(!COMMANDS.includes(command))throw new Error('ARGUMENTS');
  // This path deliberately works without dist, npm packages, environment or credential inspection.
  if(command==='--plan')return fixedPlan();
  return (await import('./cli.mjs')).operate(command==='--mock'?'--mock-firsts':command,env);
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{const value=await runCommand(parseCommand(process.argv.slice(2)));console.log(JSON.stringify(value,null,2));
    if(value?.halt||value?.readiness==='blocked')process.exitCode=1;}
  catch(e){
    let code='BUILD_OR_PREPARATION_REQUIRED';
    try{code=(await import('./policy.mjs')).errorCode(e);}catch{if(e?.message==='ARGUMENTS')code='ARGUMENTS';}
    console.error(JSON.stringify({error:code,automaticRetry:false,paidExecutionNotAssumed:true}));process.exitCode=1;
  }
}
