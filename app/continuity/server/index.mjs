import { readConfig } from '../../server/config.mjs';
import { createContinuityApp } from './app.mjs';
const args=process.argv.slice(2);
if(args.some(a=>a!=='--mock'))throw new Error('Only --mock is supported. No key or endpoint arguments.');
const config=readConfig({...process.env,...(args.includes('--mock')?{AI_MODE:'mock'}:{})});
createContinuityApp({config}).listen(config.port,config.host,function(){
  console.log(`IDEA015 ${config.mode === 'mock'?'MOCK (rules only, no AI calls)':'DeepSeek (explicit paid opt-in required)'}: http://127.0.0.1:${this.address().port}`);
});
