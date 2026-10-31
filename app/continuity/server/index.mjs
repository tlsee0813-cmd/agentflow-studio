import { fileURLToPath } from 'node:url';
import { readConfig } from '../../server/config.mjs';
import { createContinuityApp } from './app.mjs';
import { createStudioHandler, studioConfigProblems } from './studio.mjs';
import { openMapJobs } from './map-jobs.mjs';
import { openSessions } from './sessions.mjs';

// A start that cannot go ahead says why in one line and exits non-zero; it never prints a stack, a setting's value or the key.
function stop(reason) { console.error(`AgentFlow Studio did not start: ${reason}`); process.exit(1); }

const args=process.argv.slice(2);
if(args.some(a=>a!=='--mock'))stop('only --mock is supported (no key or endpoint arguments).');
const env={...process.env,...(args.includes('--mock')?{AI_MODE:'mock'}:{})};
let config;
try{config=readConfig(env);}catch(e){stop(`${e?.code??'INVALID_SERVER_CONFIG'} (check PORT, AI_MODE, AI_* limits and DEEPSEEK_BASE_URL).`);}
// Settings that were given but set aside fall back to their defaults; say which, so a typo does not pass silently.
for(const key of studioConfigProblems(env))console.warn(`AgentFlow Studio: ${key} is not a usable value and was ignored (the default applies).`);
// AF100: map readings kept as durable jobs on this PC (STUDIO_JOBS_DIR, else app/continuity/.studio-data/map-jobs-<port>; STUDIO_JOBS=off
// turns them off). Browser storage is per address, so the store is per port; a random port (0) gets none unless a folder is named.
const dir=env.STUDIO_JOBS==='off'?null:env.STUDIO_JOBS_DIR||(config.port?fileURLToPath(new URL(`../.studio-data/map-jobs-${config.port}`,import.meta.url)):null);
const jobs=dir?await openMapJobs({dir,log:m=>console.log(m)}):null;
// Local session records (Claude Code / Codex on this PC), read only on request; STUDIO_SESSIONS=off turns them off.
const sessions=openSessions({env});
const studio=createStudioHandler({env,jobs,sessions});
const server=createContinuityApp({config,studio});
server.once('error',async e=>{
  await jobs?.close();
  stop(e?.code==='EADDRINUSE'?`port ${config.port} is already in use (set PORT to another port).`:`the server could not listen (${e?.code??'error'}).`);
});
server.listen(config.port,config.host,function(){
  const j=jobs?.describe();
  console.log(`AgentFlow Studio: http://127.0.0.1:${this.address().port}  ·  AI ${env.AI_MODE!=='mock'&&env.DEEPSEEK_API_KEY?'DeepSeek (server key)':'off (no DEEPSEEK_API_KEY or --mock)'}  ·  map jobs ${!j?'off':j.durable?'kept on this PC':`not available (${j.problem})`}  ·  sessions ${sessions?'readable from this PC':'off'}`);
});
// Ctrl+C or a service stop: no new connections, then the job store is closed in order before the process lets go of it. A call
// still running is called off; the next start records it as interrupted, as after any restart.
let stopping=false;
for(const signal of ['SIGINT','SIGTERM'])process.once(signal,async()=>{
  if(stopping)return;stopping=true;
  server.close();server.closeAllConnections?.();
  await jobs?.close();
  process.exit(0);
});
