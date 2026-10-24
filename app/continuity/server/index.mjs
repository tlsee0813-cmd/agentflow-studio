import { readConfig } from '../../server/config.mjs';
import { createContinuityApp } from './app.mjs';
import { createStudioHandler } from './studio.mjs';
const args=process.argv.slice(2);
if(args.some(a=>a!=='--mock'))throw new Error('Only --mock is supported. No key or endpoint arguments.');
const env={...process.env,...(args.includes('--mock')?{AI_MODE:'mock'}:{})},config=readConfig(env),studio=createStudioHandler({env});
createContinuityApp({config,studio}).listen(config.port,config.host,function(){
  console.log(`AgentFlow Studio: http://127.0.0.1:${this.address().port}  ·  AI ${env.AI_MODE!=='mock'&&env.DEEPSEEK_API_KEY?'DeepSeek (server key)':'off (no DEEPSEEK_API_KEY or --mock)'}`);
});
