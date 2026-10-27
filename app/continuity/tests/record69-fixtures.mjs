// Offline EXPERIENCE69 browser fixture: a saved-project backup with two parts both named '보정' under different parents, fixed
// ids and one relation. No records, tasks or returns. Prerequisite: node app/continuity/scripts/build.mjs
// Usage: node app/continuity/tests/record69-fixtures.mjs --out <absolute-new-directory>
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import * as D from '../dist/public/shared/domain.js';
import { parseProject } from '../dist/public/shared/validation.js';
import { serializeBackup } from '../dist/public/shared/storage.js';

const args = process.argv.slice(2);
assert.ok(args.length === 2 && args[0] === '--out' && isAbsolute(args[1]), 'Usage: record69-fixtures.mjs --out <absolute-new-directory>');
let p = D.setBrief(D.rename(D.createProject(), '측정 장치 보정 (합성)'), '[합성 표본] PC 설정 앱과 측정 장치 펌웨어가 같은 이름의 보정 부분을 가진 예');
p = D.addArea(p, 'PC 앱', '사용자 PC에서 쓰는 설정 앱'); p = D.addArea(p, '장치 펌웨어', '측정 장치에 들어가는 펌웨어');
const [pc, dev] = p.space.areas.map(a => a.id);
p = D.addChildArea(p, pc, '보정', '측정값 입력 화면'); p = D.addChildArea(p, dev, '보정', '영점 오프셋 계산');
const [pcCal, devCal] = p.space.areas.slice(2).map(a => a.id);
p = D.addRelation(p, pcCal, devCal, 'needs', '입력한 보정값을 장치로 보냄');
let raw = JSON.stringify(p);
const ids = [[p.id, 'P_record69_same_name'], [pc, 'A_r69_pc'], [dev, 'A_r69_dev'], [pcCal, 'A_r69_pccal'], [devCal, 'A_r69_devcal'], [p.space.relations[0].id, 'L_r69_0']];
for (const [from, to] of ids) raw = raw.split(from).join(to);
const project = parseProject(raw);
const out = resolve(args[1]); await mkdir(out, { recursive: true });
await writeFile(join(out, 'record69-same-name.json'), serializeBackup(project, null));
