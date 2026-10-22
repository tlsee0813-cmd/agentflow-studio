// Local evidence formatting only; CI reads used Code Review pull_requests_checks exclusively.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const here=new URL('.',import.meta.url),read=f=>readFileSync(new URL(f,here)),json=f=>JSON.parse(read(f)),head='6b96543fdf980ff45f0e1b67f83e8a0a561a1542';
const final=json('004-final-status.json');assert.equal(final.response.structuredContent.headRevision,head);
for(const j of final.response.structuredContent.jobs){assert.equal(j.head_sha,head);assert.equal(j.status,'completed');assert.equal(j.conclusion,'success');}
assert.equal(json('003-windows-log-attempt1.json').response.isError,true);
function collect(file,os){
  const r=json(file),s=r.response.structuredContent;assert.equal(s.headRevision,head);assert.equal(s.job.head_sha,head);assert.equal(s.job.conclusion,'success');
  const log=s.log;writeFileSync(new URL(`${os}-returned.log`,here),log);
  const lines=log.split('\n').map(x=>x.replace(/\x1b\[[0-9;]*m/g,'').replace(/\r$/,''));
  assert.ok(lines.some(x=>/# tests 275$/.test(x)));assert.ok(lines.some(x=>/# pass 275$/.test(x)));assert.ok(lines.some(x=>/# fail 0$/.test(x)));
  const suites=[];let active=null;for(let i=0;i<lines.length;i++){
    const cmd=lines[i].match(/\bpython ([\w/]+\.py)\b/);if(cmd)active=cmd[1];
    const ran=lines[i].match(/Ran (\d+) tests? in ([0-9.]+)s/);if(ran&&active){const ok=lines.slice(i+1,i+5).find(x=>/Z OK$/.test(x));assert.ok(ok,active);suites.push({script:active,tests:Number(ran[1]),seconds:Number(ran[2]),ranLine:lines[i],okLine:ok});active=null;}
  }
  const correction=lines.filter(x=>/test_03_counterexamples_and_correction_draft .*\.\.\. ok$/.test(x));assert.equal(correction.length,2);
  assert.equal(suites.find(x=>x.script==='continuity/tests/understanding17_browser.py').tests,12);
  assert.equal(suites.at(-2).script,'continuity/tests/blank21_browser.py');assert.equal(suites.at(-2).tests,2);assert.equal(suites.at(-1).script,'continuity/tests/static_browser.py');assert.equal(suites.at(-1).tests,1);
  return {os,job:s.job,request:r.request,requestedAt:r.start.current_time,returnedAt:r.end.current_time,logTruncated:s.logTruncated,returnedLogCharacters:log.length,firstReturnedLine:lines[0],lastReturnedLine:lines.at(-2),
    continuityUnit:{tests:275,pass:275,fail:0,raw:lines.filter(x=>/# (tests|pass|fail|skipped|cancelled) /.test(x))},refresh27:{individualLinesVisible:lines.filter(x=>/REFRESH27/.test(x)).length,expectedCases:8,limit:'개별 8개 이름은 반환 tail 앞에서 잘렸다. 정확 후보의 검사 파일·기존 wildcard와 전체275 성공에 따른 포함 판단이며, 이 응답에서 8개 개별 로그를 읽었다는 뜻은 아니다.'},
    versions:{nodeExecution:'잘린 앞부분에 있어 직접 확인하지 못함',playwrightInstall:lines.find(x=>/Successfully installed .*playwright-1\.57\.0/.test(x)),chromiumDownload:lines.find(x=>/Chromium 143\.0\.7499\.4 .*downloaded/.test(x)),browserRuntime:'browser.version() artifact를 회수하지 않았다. 설치 기록과 실제 runtime JSON은 구분한다.'},
    browserSuiteCount:suites.length,browserTestCount:suites.reduce((n,x)=>n+x.tests,0),suites,modifiedUnderstanding17TestBothPC:correction};
}
const jobs=[collect('002-ubuntu-log-response.json','ubuntu'),collect('005-windows-final-log-response.json','windows')];
const annotations=['007-ubuntu-annotations.json','008-windows-annotations.json'].map(file=>{const r=json(file),s=r.response.structuredContent;assert.equal(s.headRevision,head);assert.equal(s.annotations.length,1);assert.equal(s.annotations[0].annotation_level,'warning');assert.match(s.annotations[0].message,/actions\/upload-artifact@ea165/);assert.match(s.annotations[0].message,/Node.js 20 is deprecated/);return {source:file,requestedAt:r.start,returnedAt:r.end,check:s.checks[0],annotation:s.annotations[0]};});
assert.deepEqual(jobs[0].suites.map(x=>[x.script,x.tests]),jobs[1].suites.map(x=>[x.script,x.tests]));
assert.equal(jobs[0].browserSuiteCount,23);assert.equal(jobs[0].browserTestCount,230);
const summary={pullRequest:'https://github.com/tlsee0813-cmd/agentflow-studio/pull/14',headRevision:head,runId:39835847977,status:'양 OS completed/success',account:'명시 계정을 제공하지 않았고 응답도 계정을 반환하지 않았다. 모든 후속 요청은 같은 계정 선택 생략과 반환 head를 유지했다.',tool:'mcp__code_review__pull_requests_checks만 사용',finalStateQuery:{start:final.start,end:final.end},jobs,annotations,
  transientReadFailure:{file:'003-windows-log-attempt1.json',requestAt:json('003-windows-log-attempt1.json').start,reason:'GitHub provider request failed (HTTP502)',followup:'3분 이상 backoff 후 같은 도구에서 최종 성공 상태와 Windows 로그 회수. 제품 실패나 rerun으로 세지 않는다. root가 앞서 본 두502는 이 agent가 회수한 원응답과 별개다.'},
  limitations:['양 OS 최종 로그는 각120000자 tail이며 앞부분이 잘렸다. 개별 REFRESH27 여덟 줄, 초기 check/build/approot unit 세부, 실제 Node 실행 버전은 직접 회수하지 못했다.','Node20 action 폐기 경고의 Node24는 upload-artifact action 실행 관련이며 제품 검사 Node 버전의 증거가 아니다.','새27 정상 UI 흐름은 별도 Cloud 검증이다. 이 CI 보고는 기존 browser군과 수정 understanding17 검사 결과를 확인한다. 실제 AI 의미 품질 수용이 아니다.','GitHub Actions API/CLI fallback, artifact 다운로드, server/browser, 제품 수정, remote write, rerun/merge는 하지 않았다.']};
writeFileSync(new URL('CI_FINAL.json',here),JSON.stringify(summary,null,2)+'\n');
const rows=jobs[0].suites.map((s,i)=>`| ${s.script} | ${s.tests} 통과 | ${jobs[1].suites[i].tests} 통과 |`).join('\n');
writeFileSync(new URL('REPORT.md',here),`# PR14 정확 후보 CI 독립 확인\n\nHead \`${head}\`, run39835847977. Ubuntu job120023840316·Windows job120023840962 모두 최종 completed/success다. Code Review pull_requests_checks만 사용했고 계정 선택·반환 head를 유지했다.\n\n양 OS 원 로그 tail에서 continuity275/275·fail0, 브라우저23묶음 각230개, BLANK21 뒤 static까지 Ran/OK를 확인했다. 수정한 understanding17_browser.py의 test_03_counterexamples_and_correction_draft는 두 PC 클래스에서 모두 ok이며, 해당 suite 전체12개도 통과했다.\n\n| 회수된 브라우저 묶음 | Ubuntu | Windows |\n| --- | --- | --- |\n${rows}\n\n## 직접 확인한 범위와 한계\n\n로그는 각120000자 tail로 잘렸다. REFRESH27 신규8개의 개별 이름·초기 check/build/approot unit 세부·실제 Node 실행 버전은 직접 보이지 않는다. 신규8개 포함은 정확 후보의 검사 파일·기존 wildcard 명령·275개 전체 성공에 따른 판단이며 개별8개 raw를 회수했다고 하지 않는다. 로컬 새8+기존91=99/99의 Node24 보조 검사와 이번 CI는 구분한다.\n\n설치 로그의 Playwright1.57.0/Chromium143.0.7499.4 build1200은 보인다. 실제 browser.version JSON이나 설치 앞부분의 Node 실행 버전은 회수하지 않았다. upload-artifact의 Node20/24 경고로 제품 Node 버전을 추론하지 않는다.\n\nWindows 첫 조회는 HTTP502로 끝났고 003 원응답에 시각과 함께 보존했다. 3분 이상 간격 뒤 최종 양OS 성공과 Windows 로그가 회수됐다. 앞서 root가 받은 두502는 이 묶음의 원응답과 구분한다. 우회 API·artifact 다운로드·수동 rerun은 없었다.\n\n002/005 원응답에 정확 job/head·조회 전후 UTC 시각·반환 로그가 들어 있다. 로컬 returned.log는 같은 문자열을 추출한 사본이고 최소 업로드에서는 중복을 제외한다. 새27 정상 UI는 별도 Cloud 범위이며 실제 AI 의미 품질을 주장하지 않는다.\n`);
writeFileSync(new URL('REPORT.md',here),read('REPORT.md').toString()+'\n## Annotation 원문 확인\n\n007/008 checkRunId 응답에서 양 OS 각각 warning 1개를 직접 확인했다. 모두 actions/upload-artifact@ea165…의 Node20 폐기·Node24 강제 실행 안내다. 다른 제품 오류 annotation은 이 응답에 없고 hasMore=false다. 이 warning은 제품의 Node 실행 버전 확인이나 검사 실패가 아니다.\n');
const chosen=['001-status.json','002-ubuntu-log-response.json','003-windows-log-attempt1.json','004-final-status.json','005-windows-final-log-response.json','006-check-discovery.json','007-ubuntu-annotations.json','008-windows-annotations.json','CI_FINAL.json','REPORT.md','summarize.mjs'];
const sha=b=>createHash('sha256').update(b).digest('hex'),blob=b=>createHash('sha1').update(Buffer.from(`blob ${b.length}\0`)).update(b).digest('hex');
const manifest={prefix:'docs/transfer/description-refresh-27/ci-6b965',head,runId:39835847977,files:chosen.map(path=>{const b=read(path);return {path,size:b.length,sha256:sha(b),gitBlob:blob(b)};}),rawLogDuplicationExcluded:['ubuntu-returned.log','windows-returned.log']};
writeFileSync(new URL('MANIFEST.json',here),JSON.stringify(manifest,null,2)+'\n');
const tree=[],expected=[];for(const name of [...chosen,'MANIFEST.json']){const b=read(name),content=b.toString('utf8');assert.equal(Buffer.from(content,'utf8').equals(b),true);const path=manifest.prefix+'/'+name;tree.push({path,mode:'100644',type:'blob',content});expected.push({path,size:b.length,sha256:sha(b),gitBlob:blob(b),utf8RoundtripExact:true});}
const payload=JSON.stringify({tree_elements:tree},null,2)+'\n';JSON.parse(payload).tree_elements.forEach((x,i)=>assert.equal(blob(Buffer.from(x.content)),expected[i].gitBlob));
for(const f of ['upload-tree-ci27-final.json','expected-blobs-ci27-final.json'])assert.equal(existsSync(new URL(f,here)),false,'refuse overwrite');
writeFileSync(new URL('upload-tree-ci27-final.json',here),payload);writeFileSync(new URL('expected-blobs-ci27-final.json',here),JSON.stringify({prefix:manifest.prefix,head,runId:39835847977,count:expected.length,payloadBytes:Buffer.byteLength(payload),payloadSHA256:sha(Buffer.from(payload)),files:expected},null,2)+'\n');
console.log(JSON.stringify({head,status:summary.status,continuityEachOS:275,browserSuitesEachOS:23,browserTestsEachOS:230,uploadFiles:expected.length,payloadBytes:Buffer.byteLength(payload),payloadSHA256:sha(Buffer.from(payload))},null,2));
