// 검사 전용 임시 입력(실제 사례 아님)을 실제 두 fixture에서 기계적으로 만든다.
// 사용: node make-temp-inputs.mjs <appRoot>  → <appRoot>/tests/fixtures-tmp/*.json
import fs from 'node:fs';
import path from 'node:path';
const root = process.argv[2];
const rd = f => JSON.parse(fs.readFileSync(path.join(root, 'fixtures', f), 'utf8'));
const out = path.join(root, 'tests', 'fixtures-tmp'); fs.mkdirSync(out, { recursive: true });
const wr = (f, o) => fs.writeFileSync(path.join(out, f), JSON.stringify(o, null, 1) + '\n');

// 1) ID 재명명: PowerToys 내용을 FLOW091과 같은 ID 이름으로 바꾼다(엔진의 ID 하드코딩·사례간 누수 확인용)
{
  const pt = rd('powertoys.json');
  const M = { ED: 'G3', SR: 'C32', RC: 'C31', HK: 'G5', X1: 'R3', RVS: 'F1', RVR: 'F2', PS: 'F3', PRC: 'F4', PH: 'F5', RPS: 'F6', PRS: 'F7' };
  const m = x => (x in M ? M[x] : (() => { throw new Error('unmapped ' + x); })());
  const fx = JSON.parse(JSON.stringify(pt));
  fx.caseId = 'tmp-renamed-ids'; fx.title = '임시 검사 입력 · ID 재명명 (내용은 PowerToys 입력과 같음)';
  for (const n of fx.nodes) { n.id = m(n.id); n.parent = n.parent === null ? null : m(n.parent); n.evidence = n.evidence.map(m); if (n.change) n.change.evidence = n.change.evidence.map(m); }
  for (const r of fx.relations) { r.id = m(r.id); r.from = m(r.from); r.to = m(r.to); r.evidence = r.evidence.map(m); }
  for (const e of fx.evidence) e.id = m(e.id);
  fx.initialView.expanded = fx.initialView.expanded.map(m);
  fx.initialView.layout.place = Object.fromEntries(Object.entries(fx.initialView.layout.place).map(([k, v]) => [m(k), v]));
  wr('renamed.json', { ...fx, _idMap: M });
}
// 2) changes 비움: FLOW091에서 change 필드를 모두 제거
{
  const fx = rd('flow091.json'); fx.caseId = 'tmp-no-changes'; fx.title = '임시 검사 입력 · 변경 필드 제거 (내용은 FLOW091 입력에서 change만 뺌)';
  for (const n of fx.nodes) delete n.change;
  wr('nochange.json', fx);
}
// 3) 입력 오류 4종
{
  const base = () => { const fx = rd('powertoys.json'); fx.title = '임시 검사 입력 · 오류'; return fx; };
  let fx = base(); fx.caseId = 'tmp-err-dup'; fx.nodes.push({ ...fx.nodes[1] }); wr('err-dup.json', fx);
  fx = base(); fx.caseId = 'tmp-err-endpoint'; fx.relations[0].to = 'NOPE'; wr('err-endpoint.json', fx);
  fx = base(); fx.caseId = 'tmp-err-cycle'; fx.nodes[0].parent = fx.nodes[1].id; wr('err-cycle.json', fx);
  fx = base(); fx.caseId = 'tmp-err-depth'; fx.nodes.push({ id: 'DEEP', parent: fx.nodes[1].id, name: '세 번째 층', role: '깊이 검사용', short: '', evidence: [] }); wr('err-depth.json', fx);
}
console.log('ok', fs.readdirSync(out).join(','));
