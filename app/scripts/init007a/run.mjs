import { createInterface } from 'node:readline';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';
const usage=`INIT-007A mock-only, two-turn synthetic customer evaluator
Build first: npm run build
Run: AI_MODE=mock ALLOW_PAID_AI=false node scripts/init007a/run.mjs --mock --out NEW_DIRECTORY [--persona p01]
No live mode, credentials, preflight, billing ledger or automatic replay.
After the actual first question: copy answer-template.json to a separate answer.json,
read question.json + fixed persona facts, fill it in, then enter: answer PATH
Commands: next | preview REQUIREMENT_ID apply|keep | cancel | confirm
          decide REQUIREMENT_ID proposed|confirmed|deferred|rejected | done | stop
'next' sends the second request once; 'done' advances only after a completed/absent question.
'answer' may be corrected before 'next' without repeating either generation.
EOF/stop preserves the uncalled phase; 007A does not resume across process restarts.`;
const safeCodes=new Set(['UNKNOWN_PERSONA','MOCK_ONLY','ARGUMENTS','GENERATION_NOT_READY','GENERATION_ALREADY_ATTEMPTED',
  'ANSWER_NOT_EXPECTED','ANSWER_FILE_CONTEXT','ANSWER_FILE_SHAPE','INVALID_ANSWER','ANSWER_FILE_READ','ANSWER_FILE_JSON','ANSWER_FILE_SIZE',
  'OUTPUT_DIRECTORY_UNAVAILABLE','RESOLUTION_NOT_READY','NO_PREVIEW','INVALID_RESOLUTION','STALE_RESOLUTION',
  'ITEM_NOT_READY','INVALID_DECISION','UNRESOLVED_ACCEPTANCE','UNRESOLVED_PREVIEW','COMMAND','NOT_FINISHED']);
function safeCode(error) {return safeCodes.has(error?.message)?error.message:'LOCAL_OPERATION_FAILED';}
async function main() {
  const argv=process.argv.slice(2);
  if(argv.length===1&&argv[0]==='--help') {console.log(usage);return;}
  let out=null,personaId=null,mock=false;
  for(let i=0;i<argv.length;i++) {
    if(argv[i]==='--mock'&&!mock) mock=true;
    else if(argv[i]==='--out'&&!out&&argv[i+1]&&!argv[i+1].startsWith('--')) out=argv[++i];
    else if(argv[i]==='--persona'&&!personaId&&argv[i+1]&&!argv[i+1].startsWith('--')) personaId=argv[++i];
    else throw new Error('ARGUMENTS');
  }
  if(!mock||!out) throw new Error('MOCK_ONLY');
  const {personas,personaById}=await import('./personas.mjs');
  if(personaId) personaById(personaId);
  const {createSession,generate,previewResolution,cancelResolution,confirmResolution,reviewItem}=await import('./evaluator.mjs');
  const {createEvidenceStore,submitAnswerFile}=await import('./evidence.mjs');
  const {openMockHttp}=await import('./http.mjs');
  const save=await createEvidenceStore(out),transport=await openMockHttp();
  const rl=createInterface({input:process.stdin,crlfDelay:Infinity});
  const lines=rl[Symbol.asyncIterator]();
  const sessions=[];let stop=false;
  try {
    for(const persona of personas.filter(p=>!personaId||p.id===personaId)) {
      const session=createSession(persona.id);sessions.push(session);
      await generate(session,transport,save);
      if(session.phase==='failed') break;
      console.log(`${persona.id}: ${session.phase}; ${resolve(out,persona.id,'review.md')}`);
      console.log('실제 질문·고정 사실을 읽고 answer PATH를 입력하세요. 내용 품질은 인간 검토 대기입니다.');
      while(true) {
        const input=await lines.next();
        if(input.done||input.value.trim()==='stop') {stop=true;break;}
        const command=input.value.trim(),parts=command.split(/\s+/);
        try {
          if(command.startsWith('answer ')) await submitAnswerFile(session,command.slice(7).trim());
          else if(command==='next') {
            if(session.preview) throw new Error('UNRESOLVED_PREVIEW');
            await generate(session,transport,save);
          }
          else if(parts[0]==='preview'&&parts.length===3) previewResolution(session,parts[1],parts[2]);
          else if(command==='cancel') cancelResolution(session);
          else if(command==='confirm') confirmResolution(session);
          else if(parts[0]==='decide'&&parts.length===3) reviewItem(session,parts[1],parts[2]);
          else if(command==='done') {
            if(!['completed','question_absent'].includes(session.phase)) throw new Error('NOT_FINISHED');
            break;
          } else throw new Error('COMMAND');
        } catch(error) {
          // No error text, rejected provider content, file contents or path echo.
          console.log(`입력/단계 오류: ${safeCode(error)}. 이미 시도한 생성은 다시 보내지 않습니다.`);
          if(session.phase==='in_flight') throw new Error('LOCAL_OPERATION_FAILED');
        }
        await save(session);console.log(`${persona.id}: ${session.phase}`);
        if(session.phase==='failed') {stop=true;break;}
      }
      if(stop) break;
    }
    await writeFile(resolve(out,'http-observations.json'),JSON.stringify({mode:'mock',limits:transport.config,
      requests:transport.observations,paidCalls:0},null,2)+'\n',{mode:0o600});
    console.log(JSON.stringify({mode:'mock',sessions:sessions.map(s=>({persona:s.persona.id,phase:s.phase,
      generations:s.generations.length,quality:'human_review_pending'})),paidCalls:0}));
  } finally {rl.close();await transport.close();}
}
try {await main();} catch(error) {console.error(safeCode(error));process.exitCode=1;}
