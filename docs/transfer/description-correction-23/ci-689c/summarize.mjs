// Local evidence formatting only. CI was read exclusively with Code Review pull_requests_checks.
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
const here=new URL('.',import.meta.url),read=f=>JSON.parse(readFileSync(new URL(f,here),'utf8'));
const final=read('008-final-run-jobs.json').structuredContent;
assert.equal(final.headRevision,'689c47888fb7ab5040d184c2d36f2adff8f2a575');
assert.equal(final.jobs.length,2);for(const j of final.jobs){assert.equal(j.status,'completed');assert.equal(j.conclusion,'success');assert.equal(j.head_sha,final.headRevision);}
function evidence(file,os){
  const r=read(file),s=r.structuredContent,log=s.log;assert.equal(s.job.conclusion,'success');
  writeFileSync(new URL(`${os}-returned.log`,here),log);
  const lines=log.split('\n').map(x=>x.replace(/\x1b\[[0-9;]*m/g,'').replace(/\r$/,''));
  const suites=[];let active=null;
  for(let i=0;i<lines.length;i++){
    const cmd=lines[i].match(/\bpython ([\w/]+\.py)\b/);if(cmd)active=cmd[1];
    const ran=lines[i].match(/Ran (\d+) tests? in ([0-9.]+)s/);
    if(ran&&active){const ok=lines.slice(i+1,i+5).find(x=>/Z OK$/.test(x));assert.ok(ok,active);suites.push({script:active,tests:Number(ran[1]),seconds:Number(ran[2]),ranLine:lines[i],okLine:ok});active=null;}
  }
  assert.equal(suites.at(-2).script,'continuity/tests/blank21_browser.py');assert.equal(suites.at(-2).tests,2);
  assert.equal(suites.at(-1).script,'continuity/tests/static_browser.py');assert.equal(suites.at(-1).tests,1);
  assert.ok(lines.some(x=>/# tests 267$/.test(x)));assert.ok(lines.some(x=>/# pass 267$/.test(x)));assert.ok(lines.some(x=>/# fail 0$/.test(x)));
  const versions={playwrightInstalled:lines.find(x=>/Successfully installed .*playwright-1\.57\.0/.test(x)),chromiumDownloaded:lines.find(x=>/Chromium 143\.0\.7499\.4 .*downloaded/.test(x)),nodeRuntime:'NOT_VISIBLE_IN_TRUNCATED_LOG',browserRuntime:'Browser.version() not read; installer download version only'};
  return {os,job:s.job,logTruncated:s.logTruncated,returnedCharacters:log.length,firstReturnedLine:lines[0],versions,suites,continuityUnit:{tests:267,pass:267,fail:0},description23:'All 267 continuity unit tests passed. Exact candidate adds description23.test.mjs (six cases) under the existing tests/*.test.mjs command. Individual DESC23 lines lie before the returned log tail: inclusion is supported by unchanged wildcard command + exact file, not separately visible subtest lines.'};
}
const jobs=[evidence('010-ubuntu-final-response.json','ubuntu'),evidence('009-windows-final-response.json','windows')];
assert.deepEqual(jobs[0].suites.map(x=>[x.script,x.tests]),jobs[1].suites.map(x=>[x.script,x.tests]));
const summary={pullRequest:'https://github.com/tlsee0813-cmd/agentflow-studio/pull/13',headRevision:final.headRevision,runId:39824210631,account:'Discovery supplied no explicit account and returned none; follow-ups retained the same omitted-account selection.',readToolOnly:'Code Review pull_requests_checks',status:'both OS completed/success',jobs,
  transientToolFailure:{file:'007-windows-live-response.json',message:'GitHub provider request failed (HTTP 502)',resolution:'Later same-head job log read succeeded. No rerun or product change.'},
  limitations:['Both final job logs are returned as truncated 120000-character tails. Earlier setup/check/build/approot unit lines and individual DESC23 names are not recoverable from these tool responses. Final successful job conclusion covers the complete workflow, but those omitted lines are not represented as independently read raw logs.','Node version is not visible in returned tails. Do not infer runtime version from upload-artifact action warning about Node24.','No alternate CI API/CLI, server/browser, remote write, cancel, rerun or merge was used. Existing author evidence untouched.']};
writeFileSync(new URL('FINAL.json',here),JSON.stringify(summary,null,2)+'\n');
const rows=jobs[0].suites.map((s,i)=>`| ${s.script} | ${s.tests} pass | ${jobs[1].suites[i].tests} pass |`).join('\n');
writeFileSync(new URL('REPORT.md',here),`# PR13 정확 후보 CI 결과\n\nHead \`${summary.headRevision}\`, run \`39824210631\`. Ubuntu job119983063953 및 Windows job119983064365 모두 최종 completed/success. Code Review pull_requests_checks만 사용했고 원격 변경·수동 재실행은 하지 않았다.\n\nContinuity unit은 양 OS 모두267/267 pass, fail0. 정확 후보에 추가한 description23 여섯 검사는 기존 wildcard unit 실행 대상이지만 반환 로그가 각120000자 tail로 잘려 개별 DESC23 줄은 직접 회수하지 못했다. 여섯 검사의 포함은 정확 파일과 기존 실행 명령 및 전체 성공에 근거하며 개별 원로그를 읽은 것으로 보고하지 않는다. 초기 check/build/approot unit 세부 줄과 실제 Node 버전 역시 잘림 범위 밖이다.\n\n| 실제 회수한 suite | Ubuntu | Windows |\n| --- | --- | --- |\n${rows}\n\nBLANK21 이후 static까지 양 OS 원로그의 Ran/OK를 대조했다. 설치 로그에서는 Playwright1.57.0, Chromium143.0.7499.4(build1200) 다운로드를 확인했다. Browser.version()은 읽지 않았다. Windows 첫 로그 조회의 HTTP502는 도구 응답으로 보존했으며 이후 정상 회수됐다. 제품/검사 실패로 세지 않는다.\n\n001~010 원응답 JSON, OS별 returned.log, FINAL.json을 함께 보존한다. 실제 로그가 보인 최종 성공과 누락된 세부 증거를 구분하며, 이 CI가 실제 AI 의미 품질을 검증했다는 주장은 하지 않는다.\n`);
const files=readdirSync(here).filter(x=>x!=='SHA256.json').map(f=>{const b=readFileSync(new URL(f,here));return {file:f,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex').toUpperCase()};});
writeFileSync(new URL('SHA256.json',here),JSON.stringify(files,null,2)+'\n');
console.log(JSON.stringify({head:summary.headRevision,status:summary.status,continuityUnit:jobs.map(x=>({os:x.os,...x.continuityUnit})),browserSuites:jobs[0].suites.length,browserTestsEachOS:jobs[0].suites.reduce((s,x)=>s+x.tests,0),finalFiles:files.map(x=>x.file)},null,2));
