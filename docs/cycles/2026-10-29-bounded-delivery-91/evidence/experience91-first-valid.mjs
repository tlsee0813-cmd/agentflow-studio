// Bounded delivery selection only; contract validation is not semantic acceptance.
export function firstValid({providers,validate,deadlineMs=90000,signal}) {
 if(providers.length!==2||new Set(providers.map(p=>p.id)).size!==2)throw Error('TWO_DISTINCT_PATHS_REQUIRED');
 const began=performance.now(),controllers=providers.map(()=>new AbortController());
 const observations=providers.map(p=>({id:p.id,invocations:0,state:'not_started'}));
 let terminal=false,timer,resolveResult;
 const result=new Promise(r=>{resolveResult=r;});
 const elapsed=()=>performance.now()-began;
 const finish=(value,winner=-1)=>{
  if(terminal)return;terminal=true;clearTimeout(timer);signal?.removeEventListener('abort',cancel);
  for(let i=0;i<controllers.length;i++)if(i!==winner)controllers[i].abort(value.error??'OTHER_PATH_SELECTED');
  resolveResult({...value,decisionMs:elapsed()});
 };
 const cancel=()=>finish({error:'CANCELLED'});
 if(signal?.aborted){cancel();return {result,settled:Promise.resolve(),observations};}
 signal?.addEventListener('abort',cancel,{once:true});
 timer=setTimeout(()=>finish({error:'AI_TIMEOUT'}),deadlineMs);
 const tasks=providers.map((p,i)=>Promise.resolve().then(async()=>{
  if(terminal)return;
  observations[i].invocations++;observations[i].state='running';
  try{
   const value=await p.run(controllers[i].signal);
   if(terminal){observations[i].state='late_ignored';return;}
   if(elapsed()>=deadlineMs){observations[i].state='late_ignored';finish({error:'AI_TIMEOUT'});return;}
   validate(value.wire,p.id);
   if(elapsed()>=deadlineMs){observations[i].state='late_ignored';finish({error:'AI_TIMEOUT'});return;}
   observations[i].state='valid';observations[i].completedMs=elapsed();
   finish({winner:p.id,value},i);
  }catch(e){observations[i].state=controllers[i].signal.aborted?'cancelled':'failed';observations[i].error=e?.code??e?.message??e?.name??'ERROR';observations[i].completedMs=elapsed();if(elapsed()>=deadlineMs)finish({error:'AI_TIMEOUT'});}
 }));
 const settled=Promise.allSettled(tasks).then(()=>{if(!terminal)finish({error:'ALL_PATHS_FAILED'});});
 return {result,settled,observations};
}
