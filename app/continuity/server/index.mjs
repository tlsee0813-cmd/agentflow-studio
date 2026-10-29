import { fileURLToPath } from 'node:url';
import { readConfig } from '../../server/config.mjs';
import { createContinuityApp } from './app.mjs';
import { createStudioHandler } from './studio.mjs';
import { openMapJobs } from './map-jobs.mjs';
const args=process.argv.slice(2);
if(args.some(a=>a!=='--mock'))throw new Error('Only --mock is supported. No key or endpoint arguments.');
const env={...process.env,...(args.includes('--mock')?{AI_MODE:'mock'}:{})},config=readConfig(env);
// AF100: map readings kept as durable jobs on this PC (STUDIO_JOBS_DIR, else app/.studio-data/map-jobs-<port>; STUDIO_JOBS=off
// turns them off). Browser storage is per address, so the store is per port; a random port (0) gets none unless a folder is named.
const dir=env.STUDIO_JOBS==='off'?null:env.STUDIO_JOBS_DIR||(config.port?fileURLToPath(new URL(`../../.studio-data/map-jobs-${config.port}`,import.meta.url)):null);
const jobs=dir?await openMapJobs({dir,log:m=>console.log(m)}):null;
const studio=createStudioHandler({env,jobs});
createContinuityApp({config,studio}).listen(config.port,config.host,function(){
  const j=jobs?.describe();
  console.log(`AgentFlow Studio: http://127.0.0.1:${this.address().port}  ·  AI ${env.AI_MODE!=='mock'&&env.DEEPSEEK_API_KEY?'DeepSeek (server key)':'off (no DEEPSEEK_API_KEY or --mock)'}  ·  map jobs ${!j?'off':j.durable?'kept on this PC':`not available (${j.problem})`}`);
});
