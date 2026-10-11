import { mkdirSync, openSync, writeFileSync, fsyncSync, closeSync, unlinkSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { PERSONA_IDS, SLOTS, LIMITS, PURPOSE, RUN_ID, fail, exact, equal, sha, isHash,
  noSymlinks, readBytes, readJson, rejectSecretContent, telemetry, errorCode } from './policy.mjs';
import { safeDiagnostic } from '../../dist/public/shared/diagnostics.js';
import { personaById } from '../init007a/personas.mjs';
const copy=v=>structuredClone(v);
export function syncDirectory(path) {
  // The assigned live runner is Linux. Windows file fsync is supported, but directory
  // durability is not claimed there; no Windows live runner is authorized by the CLI.
  if(process.platform==='win32')return;
  const fd=openSync(path,'r');try{fsyncSync(fd);}finally{closeSync(fd);}
}
function mkdirDurable(path) {
  if(existsSync(path))return;
  mkdirDurable(dirname(path));mkdirSync(path,{mode:0o700});syncDirectory(dirname(path));
}
export function writeOnce(path,value,beforeWrite=()=>{}) {
  noSymlinks(path);beforeWrite(path,value);
  const fd=openSync(path,'wx',0o600);
  try {writeFileSync(fd,JSON.stringify(value,null,2)+'\n');fsyncSync(fd);}finally{closeSync(fd);}
  syncDirectory(dirname(path));
}
function blankSlot(spec) {
  return {...spec,status:'pending',reservation:null,answerHash:null,requestIdHash:null,baseVersion:null,reservedAtMs:null,startedAtMs:null,
    endedAtMs:null,httpStatus:null,telemetry:null,diagnostic:null,failure:null,conservativeCostNanoUsd:null,actualChargeUsd:null};
}
function validateData(data,identity,previous=null) {
  exact(data,['schemaVersion','identity','limits','stages','halt','slots','sessions','events','decisionsHash'],'LEDGER_INVALID');
  if(data.schemaVersion!=='init007b.ledger.1'||!equal(data.identity,identity))fail('LEDGER_IDENTITY_MISMATCH');
  exact(identity,['purpose','runId','mode','sourceFingerprint','runtimeFingerprint','fixtureHash','projectSchemaVersion',
    'sessionSchemaVersion','node','reviewHash','legacyHash'],'LEDGER_IDENTITY_MISMATCH');
  for(const k of ['sourceFingerprint','runtimeFingerprint','fixtureHash','reviewHash','legacyHash'])if(!isHash(identity[k]))fail('LEDGER_IDENTITY_MISMATCH');
  if(!['mock','live'].includes(identity.mode))fail('LEDGER_IDENTITY_MISMATCH');
  if(identity.purpose!==PURPOSE||identity.runId!==RUN_ID||!equal(data.limits,LIMITS))fail('LEDGER_IDENTITY_MISMATCH');
  exact(data.stages,['firsts','followups'],'LEDGER_INVALID');
  if(!Object.values(data.stages).every(s=>['pending','running','done'].includes(s)))fail('LEDGER_INVALID');
  if(!Array.isArray(data.slots)||data.slots.length!==12||!Array.isArray(data.events)||data.events.length>256)fail('LEDGER_INVALID');
  const transitions={pending:['pending','reserved','skipped'],reserved:['reserved','dispatched','failed'],
    dispatched:['dispatched','succeeded','failed'],succeeded:['succeeded'],failed:['failed'],skipped:['skipped']};
  let total=0;
  data.slots.forEach((s,i)=>{
    exact(s,Object.keys(blankSlot(SLOTS[i])),'LEDGER_INVALID');
    if(s.id!==SLOTS[i].id||s.personaId!==SLOTS[i].personaId||s.turn!==SLOTS[i].turn||!transitions[s.status])fail('LEDGER_INVALID');
    const old=previous?.slots[i];
    if(old&&(!transitions[old.status].includes(s.status)||(old.reservation&&!equal(s.reservation,old.reservation))
      ||(old.startedAtMs!==null&&old.startedAtMs!==s.startedAtMs)||(old.answerHash!==null&&old.answerHash!==s.answerHash)))fail('LEDGER_INVALID');
    if(['reserved','dispatched','succeeded','failed'].includes(s.status)) {
      const r=s.reservation;
      exact(r,['bodySha256','requestSha256','requestBytes','inputReservationTokens','outputReservationTokens','reservedNanoUsd'],'LEDGER_INVALID');
      if(s.turn===2&&!isHash(s.answerHash))fail('LEDGER_INVALID');
      if(!r||!isHash(r.bodySha256)||!isHash(r.requestSha256)||!isHash(s.requestIdHash)||!Number.isSafeInteger(s.baseVersion)
        ||!Number.isSafeInteger(r.requestBytes)||r.requestBytes<1||r.requestBytes>32768||r.inputReservationTokens!==40000
        ||r.outputReservationTokens!==4096||!Number.isSafeInteger(r.reservedNanoUsd)||r.reservedNanoUsd<=0)fail('LEDGER_INVALID');
      total+=r.reservedNanoUsd;
    } else if(s.reservation!==null||s.startedAtMs!==null)fail('LEDGER_INVALID');
    if(['dispatched','succeeded'].includes(s.status)&&!Number.isSafeInteger(s.startedAtMs))fail('LEDGER_INVALID');
    if(!(s.answerHash===null||isHash(s.answerHash)))fail('LEDGER_INVALID');
    if(s.telemetry!==null&&!equal(telemetry(s.telemetry),s.telemetry))fail('LEDGER_INVALID');
    if(s.diagnostic!==null&&!equal(safeDiagnostic(s.diagnostic),s.diagnostic))fail('LEDGER_INVALID');
    if(s.failure!==null) {
      exact(s.failure,['scope','code'],'LEDGER_INVALID');
      if(!['skip','case','global'].includes(s.failure.scope)||errorCode(new Error(s.failure.code))!==s.failure.code)fail('LEDGER_INVALID');
    }
    for(const k of ['reservedAtMs','startedAtMs','endedAtMs','conservativeCostNanoUsd'])
      if(s[k]!==null&&(!Number.isSafeInteger(s[k])||s[k]<0))fail('LEDGER_INVALID');
    if(s.actualChargeUsd!==null)fail('LEDGER_INVALID');
  });
  if(total>LIMITS.budgetNanoUsd)fail('LEDGER_INVALID');
  if(data.halt!==null) {
    exact(data.halt,['code','atMs','automaticRetry'],'LEDGER_INVALID');
    if(errorCode(new Error(data.halt.code))!==data.halt.code||!Number.isSafeInteger(data.halt.atMs)||data.halt.automaticRetry!==false)fail('LEDGER_INVALID');
  }
  for(const e of data.events) {
    exact(e,['kind','code','digest','atMs'],'LEDGER_INVALID');
    if(!['input_rejected','answers_validated','synthetic_item_decisions','keyless_preflight_checked'].includes(e.kind)
      ||!(e.code===null||errorCode(new Error(e.code))===e.code)||!(e.digest===null||isHash(e.digest))||!Number.isSafeInteger(e.atMs))fail('LEDGER_INVALID');
  }
  if(!(data.decisionsHash===null||isHash(data.decisionsHash)))fail('LEDGER_INVALID');
  if(previous) {
    for(const phase of ['firsts','followups']) {
      if(previous.stages[phase]==='done'&&data.stages[phase]!=='done')fail('LEDGER_INVALID');
      if(previous.stages[phase]==='running'&&data.stages[phase]==='pending')fail('LEDGER_INVALID');
    }
    if(previous.halt&&!equal(previous.halt,data.halt))fail('LEDGER_INVALID');
  }
  if(!data.sessions||Object.keys(data.sessions).some(id=>!PERSONA_IDS.includes(id)))fail('LEDGER_INVALID');
  for(const [id,ref] of Object.entries(data.sessions)) {
    exact(ref,['file','sha256','stateHash','version','phase','questionHash'],'LEDGER_INVALID');
    if(!new RegExp(`^${id}-[0-9]{6}\\.json$`).test(ref.file)||!isHash(ref.sha256)||!isHash(ref.stateHash)
      ||!Number.isSafeInteger(ref.version)||ref.version<1||!(ref.questionHash===null||isHash(ref.questionHash)))fail('LEDGER_INVALID');
  }
}
export function readLedger(root,identity) {
  noSymlinks(root);
  if(!existsSync(join(root,'journal')))fail('LEDGER_MISSING');
  const names=readdirSync(join(root,'journal')).sort();
  if(!names.length)fail('LEDGER_MISSING');
  let previous=null,head=null;const checkedBlobs=new Map();
  for(let i=0;i<names.length;i++) {
    if(names[i]!==`${String(i+1).padStart(6,'0')}.json`)fail('LEDGER_INVALID');
    const row=readJson(join(root,'journal',names[i]));
    exact(row,['sequence','previousHash','data','hash'],'LEDGER_INVALID');
    if(row.sequence!==i+1||row.previousHash!==head||row.hash!==sha({sequence:row.sequence,previousHash:row.previousHash,data:row.data}))fail('LEDGER_INVALID');
    validateData(row.data,identity,previous);
    // Every referenced historical session revision remains evidence, not only the latest.
    for(const ref of Object.values(row.data.sessions)) {
      if(!checkedBlobs.has(ref.file))checkedBlobs.set(ref.file,sha(readBytes(join(root,'sessions',ref.file))));
      if(checkedBlobs.get(ref.file)!==ref.sha256)fail('STATE_HASH_MISMATCH');
    }
    previous=row.data;head=row.hash;
  }
  const sessions={};
  for(const [id,ref] of Object.entries(previous.sessions)) {
    const bytes=readBytes(join(root,'sessions',ref.file));if(sha(bytes)!==ref.sha256)fail('STATE_HASH_MISMATCH');
    const session=JSON.parse(bytes);
    if(session.schemaVersion!==identity.sessionSchemaVersion||session.state?.schemaVersion!==identity.projectSchemaVersion
      ||session.state?.version!==ref.version||sha(session.state)!==ref.stateHash||session.phase!==ref.phase
      ||!equal(session.persona,personaById(id))||sha(session.snapshots.first?.question??null)!==ref.questionHash
      ||session.state.id!==session.snapshots.initial.id)fail('STATE_HASH_MISMATCH');
    if(!Array.isArray(session.generations)||session.generations.length>2||new Set(session.generations.map(g=>g.turn)).size!==session.generations.length)fail('STATE_HASH_MISMATCH');
    sessions[id]=session;
  }
  return {data:previous,head,sequence:names.length,sessions};
}
/** Local fixed-directory exclusion, not a cross-workspace/distributed lock. A crash
 * leaves active.lock in place. There is deliberately no stale-lock takeover/reset. */
export function openLedger(root,identity,{initialize=false,beforeWrite=()=>{},secrets=[]}={}) {
  noSymlinks(root);
  const existed=existsSync(root);
  if(!existed&&!initialize)fail('LEDGER_MISSING');
  if(!existed)mkdirDurable(root);
  const lock=join(root,'active.lock');let held=false,poisoned=false;
  try {const fd=openSync(lock,'wx',0o600);held=true;
    try{writeFileSync(fd,JSON.stringify({schemaVersion:'init007b.lock.1',purpose:PURPOSE,runId:RUN_ID,pid:process.pid})+'\n');fsyncSync(fd);}finally{closeSync(fd);}
    syncDirectory(root);
  }catch(e){if(held)poisoned=true;fail('LEDGER_LOCKED');}
  let snapshot;
  const close=()=>{if(held&&!poisoned){unlinkSync(lock);syncDirectory(root);held=false;}};
  try {
    if(!existed) {
      for(const sub of ['journal','sessions'])mkdirSync(join(root,sub),{mode:0o700});syncDirectory(root);
      snapshot={sequence:0,head:null,sessions:{},data:{schemaVersion:'init007b.ledger.1',identity:copy(identity),limits:LIMITS,
        stages:{firsts:'pending',followups:'pending'},halt:null,slots:SLOTS.map(blankSlot),sessions:{},events:[],decisionsHash:null}};
    } else snapshot=readLedger(root,identity); // Never turn an empty/damaged existing root into a new run.
  }catch(e){close();throw e;}
  const api={
    get data(){return snapshot.data;},get sessions(){return snapshot.sessions;},get head(){return snapshot.head;},get poisoned(){return poisoned;},
    commit(data,changed={}) {
      if(poisoned)fail('OUTPUT_WRITE_FAILED');
      try {
        // Detect an altered/truncated on-disk journal or state before acknowledging another write/send.
        if(snapshot.sequence) {
          const disk=readLedger(root,identity);
          if(disk.head!==snapshot.head||disk.sequence!==snapshot.sequence)fail('LEDGER_INVALID');
        }
        const next=copy(data), sequence=snapshot.sequence+1, sessions=copy(snapshot.sessions);
        for(const [id,session] of Object.entries(changed)) {
          if(!PERSONA_IDS.includes(id)||!equal(session.persona,personaById(id)))fail('STATE_INVARIANT_FAILED');
          rejectSecretContent(session,secrets);
          const filename=`${id}-${String(sequence).padStart(6,'0')}.json`;
          writeOnce(join(root,'sessions',filename),session,beforeWrite);
          next.sessions[id]={file:filename,sha256:sha(readBytes(join(root,'sessions',filename))),stateHash:sha(session.state),
            version:session.state.version,phase:session.phase,questionHash:sha(session.snapshots.first?.question??null)};
          sessions[id]=copy(session);
        }
        validateData(next,identity,snapshot.sequence?snapshot.data:null);
        rejectSecretContent(next,secrets);
        const row={sequence,previousHash:snapshot.head,data:next};row.hash=sha(row);
        writeOnce(join(root,'journal',`${String(sequence).padStart(6,'0')}.json`),row,beforeWrite);
        snapshot={sequence,head:row.hash,data:next,sessions};
      }catch {poisoned=true;fail('OUTPUT_WRITE_FAILED');} // Keep lock after any uncertain durable write.
    },close,
  };
  if(!existed)api.commit(snapshot.data);
  return api;
}
export function newIdentity(code,{mode,reviewHash,legacyHash}) {
  if(!['live','mock'].includes(mode)||!isHash(reviewHash)||!isHash(legacyHash))fail('LEDGER_IDENTITY_MISMATCH');
  return {purpose:PURPOSE,runId:RUN_ID,mode,...code,reviewHash,legacyHash};
}
