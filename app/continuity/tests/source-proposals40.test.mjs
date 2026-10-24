// SOURCE40: pure checks of the proposal file, the identity rules and the tab-memory review state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import * as P from '../dist/public/shared/source-proposals.js';
import { PROPOSAL_EXAMPLE } from '../dist/public/shared/source-proposals-example.js';

const digest=async text=>createHash('sha256').update(text,'utf8').digest('hex');
const bytes=value=>new TextEncoder().encode(typeof value==='string'?value:JSON.stringify(value));
const clone=()=>structuredClone(PROPOSAL_EXAMPLE);
const code=(fn,expected)=>assert.throws(fn,e=>e instanceof P.ProposalFileError&&e.code===expected,expected);
const cycle39=new URL('../../../docs/cycles/2026-10-24-organizer-observation-39/',import.meta.url);

test('S40 the example is exactly the 8 actual excerpts and the 3 reviewed candidates of cycle 39, with their hashes',async()=>{
  const manifest=JSON.parse(readFileSync(new URL('source-manifest.json',cycle39),'utf8')),cands=JSON.parse(readFileSync(new URL('candidates3.json',cycle39),'utf8'));
  const s=P.parseProposalFile(bytes(PROPOSAL_EXAMPLE));
  assert.equal(s.source.rawSha256,manifest.rawSha256);assert.equal(s.source.totalLines,manifest.totalLines);
  assert.deepEqual(s.excerpts.map(e=>[e.ref,e.line,e.kind,e.lineSha256,e.quoteSha256,e.quote]),manifest.events.map(e=>[e.ref,e.line,e.kind,e.lineSha256,e.quoteSha256,e.quote]));
  for(const c of cands.candidates){const p=s.proposals.find(x=>x.id===c.id);
    for(const k of ['label','refs','observed','fidelity','scope','identity','roleChange'])assert.deepEqual(p[k],c[k],`${c.id}.${k} kept as reviewed`);}
  await P.verifyExcerptHashes(s,digest);
  assert.ok(bytes(PROPOSAL_EXAMPLE).byteLength<16*1024,'only the needed excerpts');
  assert.doesNotMatch(JSON.stringify(PROPOSAL_EXAMPLE),/sk-[A-Za-z0-9]{8,}|DEEPSEEK_API_KEY|[A-Z]:\\\\|\/home\/|\/Users\//,'no key or personal path');
});
test('S40 roles: no excerpt of the sample is an execution observation; E07 stays truncated and E07/E08 are not results',()=>{
  const s=P.parseProposalValue(clone()),c=P.roleCounts(s);
  assert.deepEqual(c,{user_instruction:2,coordinator_interpretation:2,assignment_notice:4,execution_observation:0});
  const e07=P.excerptOf(s,'E07'),e08=P.excerptOf(s,'E08');
  assert.equal(e07.truncated,true);assert.notEqual(e07.role,'execution_observation');assert.notEqual(e08.role,'execution_observation');
  assert.ok(s.proposals.find(p=>p.id==='C3').missing.some(m=>m.includes('E07')),'C3 keeps the E07 gap');
});
test('S40 structure: size, BOM, UTF-8, schema, keys, counts, duplicate refs and missing source refs are refused',()=>{
  code(()=>P.parseProposalFile(new Uint8Array(P.PROPOSAL_FILE_BYTES+1)),'TOO_LARGE');
  code(()=>P.checkProposalSize(P.PROPOSAL_FILE_BYTES+1),'TOO_LARGE');
  code(()=>P.parseProposalFile(new Uint8Array([0xef,0xbb,0xbf,...bytes(PROPOSAL_EXAMPLE)])),'BOM');
  code(()=>P.parseProposalFile(new Uint8Array([0x7b,0xff,0x7d])),'NOT_UTF8');
  code(()=>P.parseProposalFile(bytes('{"schemaVersion":')),'NOT_JSON');
  code(()=>P.parseProposalValue({...clone(),schemaVersion:'agentflow.return.2'}),'SCHEMA');
  code(()=>P.parseProposalValue({...clone(),projectId:'P_x'}),'KEYS');
  const linked=clone();linked.proposals[0].taskId='T_1';code(()=>P.parseProposalValue(linked),'KEYS'); // no link to project tasks
  const status=clone();status.proposals[0].status='applied';code(()=>P.parseProposalValue(status),'KEYS');
  const four=clone();four.proposals.push({...four.proposals[0],id:'C4'});code(()=>P.parseProposalValue(four),'TOO_MANY');
  const dupRef=clone();dupRef.proposals[2].refs=['E06','E07','E06'];code(()=>P.parseProposalValue(dupRef),'DUPLICATE_PROPOSAL_REF');
  const dupEx=clone();dupEx.excerpts[1]={...dupEx.excerpts[1],ref:'E01'};code(()=>P.parseProposalValue(dupEx),'DUPLICATE_REF');
  const dupId=clone();dupId.proposals[1].id='C1';code(()=>P.parseProposalValue(dupId),'DUPLICATE_PROPOSAL');
  const missing=clone();missing.proposals[0].refs=['E01','E09'];code(()=>P.parseProposalValue(missing),'MISSING_REF');
  const role=clone();role.excerpts[6].role='success';code(()=>P.parseProposalValue(role),'FIELD');
  const hash=clone();hash.source.rawSha256='XYZ';code(()=>P.parseProposalValue(hash),'HASH_FORMAT');
  const line=clone();line.excerpts[0].line=60000;code(()=>P.parseProposalValue(line),'FIELD');
  const ctl=clone();ctl.proposals[0].label='a\u0007b';code(()=>P.parseProposalValue(ctl),'FIELD');
  const long=clone();long.excerpts[0].quote='가'.repeat(P.QUOTE_LIMIT+1);code(()=>P.parseProposalValue(long),'TOO_LARGE');
});
test('S40 hashes: a one-character change with the old quote hash is refused; an arbitrary raw hash is only a recorded value',async()=>{
  const tampered=clone();tampered.excerpts[2].quote=tampered.excerpts[2].quote.replace('시켜','시킴');
  const s=P.parseProposalValue(tampered);
  await assert.rejects(P.verifyExcerptHashes(s,digest),e=>e.code==='HASH_MISMATCH'&&e.message.includes('E03'));
  const raw=clone();raw.source.rawSha256='0'.repeat(64);
  await P.verifyExcerptHashes(P.parseProposalValue(raw),digest); // excerpts are checked; the raw source is never read
  assert.notEqual(P.sampleKey(P.parseProposalValue(raw)),P.sampleKey(P.parseProposalValue(clone())),'a different recorded raw hash is a different input');
});
test('S40 identity: order-only changes are the same input; any changed quote, ref or interpretation is a different one',()=>{
  const base=P.parseProposalValue(clone());
  const shuffled=clone();shuffled.proposals.reverse();shuffled.excerpts.reverse();shuffled.proposals.forEach(p=>{p.refs.reverse();p.missing.reverse();});
  assert.equal(P.sampleKey(P.parseProposalValue(shuffled)),P.sampleKey(base));
  const variants={quote:s=>{s.excerpts[0].quote+='.';},refs:s=>{s.proposals[0].refs=['E01','E02'];},observed:s=>{s.proposals[0].observed+=' 추가';},
    label:s=>{s.proposals[2].label='다른 이름';},role:s=>{s.excerpts[7].role='execution_observation';},missing:s=>{s.proposals[2].missing.pop();}};
  for(const [name,change] of Object.entries(variants)){const v=clone();change(v);
    assert.notEqual(P.sampleKey(P.parseProposalValue(v)),P.sampleKey(base),name);}
  const v=clone();v.proposals[0].observed+=' 추가';const changed=P.parseProposalValue(v);
  assert.deepEqual(P.changedSameIds(changed,base),['C1']);assert.equal(P.sameSourceRange(changed,base),true,'same source/range, still a different input');
  assert.deepEqual(P.changedSameIds(P.parseProposalValue(shuffled),base),[]);
});
test('S40 import: the same input reuses its review (with its marks); a changed input with the same ids never inherits them',()=>{
  const base=P.parseProposalValue(clone());
  let r=P.addReview([],base,'example');assert.equal(r.outcome,'new');
  let review=P.setExcluded(r.reviews[0],'C2',true);review=P.splitGroup(review,'C3',0,['E07']);
  let reviews=[review];
  const shuffled=clone();shuffled.proposals.reverse();shuffled.proposals[0].refs.reverse();
  r=P.addReview(reviews,P.parseProposalValue(shuffled),'file');
  assert.equal(r.outcome,'reused');assert.equal(r.reviews.length,1);assert.equal(r.reviews[0],review,'existing review object reused');
  const changed=clone();changed.excerpts[6].quote=changed.excerpts[6].quote+' (추가)';
  // Not hash-checked here: identity alone. (The page refuses a quote whose hash no longer matches before this step.)
  r=P.addReview(reviews,P.parseProposalValue(changed),'file');
  assert.equal(r.outcome,'new');assert.equal(r.reviews.length,2);assert.deepEqual(r.changedIds,['C3']);
  const fresh=r.reviews[1];assert.deepEqual(fresh.excluded,[]);assert.deepEqual(fresh.groups.C3,[['E06','E07','E08']]);
  reviews=r.reviews;const third=clone();third.source.rawSha256='1'.repeat(64);reviews=P.addReview(reviews,P.parseProposalValue(third),'file').reviews;
  const fourth=clone();fourth.source.rawSha256='2'.repeat(64);
  const full=P.addReview(reviews,P.parseProposalValue(fourth),'file');
  assert.equal(full.outcome,'full');assert.equal(full.reviews,reviews,'nothing replaced');
});
test('S40 review: exclusion is reversible; split only partitions refs, parts never inherit the whole interpretation as their state',()=>{
  const review0=P.newReview(P.parseProposalValue(clone()),'example');
  assert.deepEqual(P.reviewItems(review0).map(i=>i.key),['C1','C2','C3']);
  let r=P.setExcluded(review0,'C1',true);assert.equal(P.reviewItems(r)[0].excluded,true);
  r=P.setExcluded(r,'C1',false);assert.deepEqual(r.excluded,[]);
  r=P.toggleRecheck(r,'C3');r=P.setExcluded(r,'C3',true);
  r=P.splitGroup(r,'C3',0,['E07']);
  const parts=P.reviewItems(r).filter(i=>i.proposal.id==='C3');
  assert.deepEqual(parts.map(i=>[i.key,i.refs,i.part]),[['C3:E06+E08',['E06','E08'],{index:1,count:2}],['C3:E07',['E07'],{index:2,count:2}]]);
  assert.ok(parts.every(i=>!i.excluded&&!i.recheck),'marks of the whole are not copied to the parts');
  r=P.splitGroup(r,'C3',0,['E08']);
  assert.deepEqual(r.groups.C3,[['E06'],['E08'],['E07']]);
  assert.throws(()=>P.splitGroup(r,'C3',0,['E06']),/2개 이상/,'a single excerpt cannot be split again');
  assert.throws(()=>P.splitGroup(review0,'C3',0,['E06','E07','E08']),/1개 이상은 남겨/);
  assert.throws(()=>P.splitGroup(review0,'C3',0,['E01']),/옮길 발췌/);
  assert.throws(()=>P.splitGroup(review0,'C3',0,[]),/옮길 발췌/);
  assert.ok(P.reviewItems(r).length<=review0.sample.excerpts.length,'at most one item per excerpt: no copies');
  r=P.setExcluded(r,'C3:E07',true);
  r=P.undoSplit(r,'C3');assert.deepEqual(r.groups.C3,[['E06','E07','E08']]);assert.deepEqual(r.excluded,[]);
  assert.equal(P.setExcluded(review0,'C9',true),review0,'unknown item is ignored');
  // The proposal (its interpretation and missing links) is the same object for every part: never rewritten per part.
  const split=P.splitGroup(review0,'C3',0,['E07']);
  assert.ok(P.reviewItems(split).filter(i=>i.proposal.id==='C3').every(i=>i.proposal===review0.sample.proposals[2]));
});
test('S40 text stays text: HTML in a label or quote is accepted as characters, not markup',async()=>{
  const v=clone();v.proposals[0].label='<img src=x onerror=alert(1)>';v.excerpts[0].quote='<b>굵게</b>'+'가'.repeat(3000);
  v.excerpts[0].quoteSha256=await digest(v.excerpts[0].quote);
  const s=P.parseProposalValue(v);await P.verifyExcerptHashes(s,digest);assert.equal(s.proposals[0].label,'<img src=x onerror=alert(1)>');
});
