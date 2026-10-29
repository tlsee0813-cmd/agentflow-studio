import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
// Reuses AF91/92's raw buffers, fatal streaming UTF8 and final/event byte equality.
// Single path only: cutoff fixes the decision; a missing close cannot keep it pending.
export async function captureCli({exe,args,cwd,wrapper,selectionMs=89000,cleanupMs=250,onAccepted=()=>{},spawnImpl=spawn}) {
 const began=performance.now(),events=[],stdout=[],stderr=[],decoder=new TextDecoder('utf-8',{fatal:true});
 const limits={stdout:524288,stderr:131072};let outBytes=0,errBytes=0,pending='',reason=null,closed=false,terminal=false,completion={},timer,cleanupTimer;
 let resolveDone;const done=new Promise(r=>resolveDone=r);
 const env={...process.env};delete env.DEEPSEEK_API_KEY;delete env.STUDIO_ACCESS_CODE;
 const child=spawnImpl(exe,args,{cwd,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
 const finish=()=>{if(terminal)return;terminal=true;clearTimeout(timer);clearTimeout(cleanupTimer);resolveDone();};
 const stop=why=>{if(terminal)return;reason??=why;if(!cleanupTimer)cleanupTimer=setTimeout(()=>{if(!closed){child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();child.unref();}finish();},cleanupMs);try{child.kill();}catch{};};
 const line=value=>{if(!value.trim())return;let e;try{e=JSON.parse(value);if(!e||typeof e.type!=='string')throw Error();}catch{stop('MALFORMED_EVENT');return;}
  events.push(e);if(e.type==='thread.started')onAccepted(e.thread_id);
  const type=e.item?.type;if(type&&!['agent_message','reasoning'].includes(type))stop('TOOL_USE');
 };
 timer=setTimeout(()=>stop('SELECTION_DEADLINE'),selectionMs);
 child.stdout.on('data',bytes=>{if(terminal||reason)return;outBytes+=bytes.length;if(outBytes>limits.stdout){stop('STDOUT_BOUND');return;}stdout.push(bytes);
  try{pending+=decoder.decode(bytes,{stream:true});}catch{stop('INVALID_UTF8');return;}
  const lines=pending.split('\n');pending=lines.pop();for(const value of lines){if(reason)break;line(value);}
 });
 child.stderr.on('data',bytes=>{if(terminal||reason)return;errBytes+=bytes.length;if(errBytes>limits.stderr){stop('STDERR_BOUND');return;}stderr.push(bytes);});
 child.stdin.on('error',()=>stop('STDIN_ERROR'));
 child.once('error',e=>{completion={spawnError:e.code??e.name};stop('SPAWN_ERROR');});
 child.once('close',(code,signal)=>{closed=true;completion={...completion,code,signal};if(!reason){try{pending+=decoder.decode();if(pending)line(pending);}catch{reason='INVALID_UTF8';}}finish();});
 child.stdin.end(wrapper);await done;
 return {events,stdout:Buffer.concat(stdout),stderr:Buffer.concat(stderr),completion,reason,cleanupCompleted:closed,elapsedMs:performance.now()-began,stdoutBytesObserved:outBytes,stderrBytesObserved:errBytes};
}
export async function readFinalBounded(file,max=131072){
 let h;try{h=await fs.open(file,'r');const size=(await h.stat()).size;if(size>max)throw Error('FINAL_BOUND');const b=Buffer.alloc(max+1);let used=0;for(;;){const {bytesRead}=await h.read(b,used,b.length-used,null);used+=bytesRead;if(used>max)throw Error('FINAL_BOUND');if(!bytesRead)break;}
 const raw=b.subarray(0,used),text=new TextDecoder('utf-8',{fatal:true}).decode(raw);return {raw,text};}finally{await h?.close();}
}
