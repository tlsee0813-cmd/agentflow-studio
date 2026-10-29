// Fixed delivery preference only. No semantic comparison, repair, or second selection.
export function preferredValid({providers,preferredId,validate,selectionDeadlineMs=89000,signal}) {
 if(providers.length!==2||new Set(providers.map(p=>p.id)).size!==2)throw Error('TWO_DISTINCT_PATHS_REQUIRED');
 const primary=providers.findIndex(p=>p.id===preferredId);if(primary<0)throw Error('PREFERRED_PATH_REQUIRED');
 const backup=1-primary,began=performance.now(),controllers=providers.map(()=>new AbortController());
 const observations=providers.map(p=>({id:p.id,invocations:0,state:'not_started'}));
 const values=new Map();let terminal=false,timer,resolveResult;
 const result=new Promise(r=>{resolveResult=r;});const elapsed=()=>performance.now()-began;
 const finish=(value,winner=-1)=>{
  if(terminal)return;terminal=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);
  for(let i=0;i<controllers.length;i++)if(i!==winner)controllers[i].abort(value.error??'OTHER_PATH_SELECTED');
  resolveResult({...value,decisionMs:elapsed()});
 };
 const select=(i,reason)=>finish({winner:providers[i].id,value:values.get(i),reason},i);
 const atDeadline=()=>values.has(backup)?select(backup,'PREFERRED_SELECTION_DEADLINE'):finish({error:'AI_TIMEOUT'});
 const cancel=()=>finish({error:'CANCELLED'});
 if(signal?.aborted){cancel();return {result,settled:Promise.resolve(),observations,elapsed};}
 signal?.addEventListener('abort',cancel,{once:true});timer=setTimeout(atDeadline,selectionDeadlineMs);
 const tasks=providers.map((p,i)=>Promise.resolve().then(async()=>{
  if(terminal)return;observations[i].invocations++;observations[i].state='running';
  try{
   const value=await p.run(controllers[i].signal);
   if(terminal){observations[i].state='late_ignored';return;}
   if(elapsed()>=selectionDeadlineMs){observations[i].state='late_ignored';atDeadline();return;}
   validate(value.wire,p.id);
   if(elapsed()>=selectionDeadlineMs){observations[i].state='late_ignored';atDeadline();return;}
   values.set(i,value);observations[i].state='valid';observations[i].completedMs=elapsed();
   if(i===primary)select(i,'PREFERRED_VALID');
   else if(observations[primary].state==='failed')select(i,'PREFERRED_TERMINAL_FAILURE');
  }catch(e){
   observations[i].state=controllers[i].signal.aborted?'cancelled':'failed';observations[i].error=e?.code??e?.message??e?.name??'ERROR';observations[i].completedMs=elapsed();
   if(terminal)return;
   if(elapsed()>=selectionDeadlineMs){atDeadline();return;}
   if(i===primary&&values.has(backup))select(backup,'PREFERRED_TERMINAL_FAILURE');
  }
 }));
 const settled=Promise.allSettled(tasks).then(()=>{if(!terminal)finish({error:'ALL_PATHS_FAILED'});});
 return {result,settled,observations,elapsed};
}
