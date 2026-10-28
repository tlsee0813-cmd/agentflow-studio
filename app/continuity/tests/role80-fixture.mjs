// AF80 standard synthetic backup (written replies, no AI call; the record is a synthetic text written for this, not real source).
// '평가 경로' has a description resting on four passages of indented code and no claims of its own; the fourth passage is the
// quote of no claim. '실행 한도' has a description read from a requirement and a narrower author report as its own claim.
// Prints { project, eval, limit } on stdout (the project is a plain backup).
import * as D from '../dist/public/shared/domain.js';
import * as M from '../dist/public/shared/map-reading.js';
import { studioView } from '../dist/public/shared/studio.js';
import { pathToFileURL } from 'node:url';

export const RECORD80 = `[합성 표준 표본 · 실제 소스나 보고가 아님]
평가 경로 발췌:

    def evaluate(self, code):
        tree = Parser(code).parse()

        unit = Compiler().compile(tree)

        value = Machine(limits=self.limits).run(unit)

        return self.to_host(value)

요구: 실행 시간이 한도를 넘으면 평가를 멈춘다.
작업 보고: 시간 한도 검사를 Machine.run 안에 넣었다고 보고합니다. 메모리 한도는 아직 바꾸지 않았습니다.`;

export function build80(at = '2026-10-29T00:00:00.000Z') {
  let p = D.rename(D.createProject(), '역할 근거 표본');
  p = D.pasteRecord(p, RECORD80, null).project;
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), spans = inp.ask.records[0].spans;
  const s = words => spans.find(x => x.t.trimStart().startsWith(words)).s;
  const reply = { summary: '[합성] 코드를 파싱·컴파일·실행해 호스트 값으로 돌려주는 평가 경로와 시간 한도 요구를 읽은 자리예요.', relations: [], candidates: [], gaps: [], matches: [], material: [],
    parts: [
      { ref: 'new:eval', name: '평가 경로', parent: null, role: '코드를 파싱·컴파일·실행한 뒤 결과를 호스트 값으로 돌려준다.', roleAbout: null, roleReplaces: null,
        basis: [s('def evaluate'), s('unit ='), s('value ='), s('return self.to_host')], claims: [] },
      { ref: 'new:limit', name: '실행 한도', parent: null, role: '실행 시간이 한도를 넘으면 평가를 멈추게 한다.', roleAbout: null, roleReplaces: null, basis: [s('요구:')],
        claims: [{ kind: 'reported', text: '시간 한도 검사를 Machine.run 안에 넣었다고 보고함(메모리 한도는 아직 바꾸지 않음)', at: s('작업 보고:'), about: null, replaces: null, key: 's1' }] }] };
  const out = M.applyReading(p, inp, M.validateMapReply(reply, inp.ask), { id: 'R_role80_fixture', at, model: 'written-fixture', prompt: 'm6-000000000000', hash: '8'.repeat(64) });
  return { project: out.project, eval: out.created[0], limit: out.created[1] };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.stdout.write(JSON.stringify(build80()));
