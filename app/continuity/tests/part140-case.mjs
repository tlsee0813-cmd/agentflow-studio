// AF140 test fixture (model-free, author-written; replies labelled '[스텁]'): an engine map in the shape of the 139 engine. The engine
// part gathers 13 current claims over four readings (a reading takes at most 4 claims of a part), the last read being its
// limitations; an eval group holds Parser, Compiler and VM (VM with 2 claims) with relation notes. Not a model's reading.
import assert from 'node:assert/strict';
export const FEATURES = ['변수·연산자·제어 흐름·함수·클로저', '객체·프로토타입·접근자', 'JSON·배열·타입 배열', '화살표 함수·나머지 및 펼침 문법', '기본 매개변수와 구조 분해',
  '클래스·상속·정적 메서드', 'for-of 이터레이터와 제너레이터', 'Promise와 async/await', '캡처 그룹과 전후방 탐색을 포함한 정규식', '스택 추적을 포함한 예외 처리',
  '메모리 사용 상한과 실행 시간 제한 설정', 'Python 자료형으로의 결과 변환'];
// 12 features + the limitation = 13 current claims over four readings (more than the 12 the shared reading used to cut to).
export const LIMITS = '제한: 선택적 전방 탐색 캡처의 일부 정규식 경계 사례와 Error 하위 클래스의 일부 동작은 아직 지원하지 않으며, 이 제한은 문서에 그대로 남아 있다.';
// Four records read in turn (a reading takes at most 4 claims of a part): the engine's claims gather over the readings, as a real
// map's do; the last one adds the limitation.
const DOC = ['micro-javascript는 Python으로 JavaScript 실행 환경을 제공하는 엔진이다.', 'eval은 소스를 받아 Parser, Compiler, VM 순서로 넘긴다.',
  'Parser는 소스를 구문 트리로 만든다.', 'Compiler는 구문 트리를 바이트코드로 바꾼다.', 'VM을 생성할 때 컨텍스트의 메모리 제한값과 시간 제한값을 전달한다.',
  'VM은 컨텍스트의 전역 상태를 복사하지 않고 공유하며, 주석은 중첩 eval이 전역 상태를 수정할 수 있도록 하기 위한 것이라고 설명한다.', 'VM은 실행 결과를 평가 진입점에 돌려준다.',
  ...FEATURES.slice(0, 4).map(f => `지원: ${f}을(를) 지원 대상으로 설명한다.`)].join('\n');
const MORE = [FEATURES.slice(4, 8), FEATURES.slice(8, 12)].map(fs => fs.map(f => `지원: ${f}을(를) 지원 대상으로 설명한다.`).join('\n'));
const piece = (inp, words) => { const x = inp.ask.records.flatMap(r => r.spans).find(s => s.t.trimStart().startsWith(words)); assert.ok(x, words); return x.s; };
export function build({ D, M, S, studioView }) {
  let k = 0, n = 0;
  const c = (text, at) => ({ kind: 'describes', text: `[스텁] ${text}`, at, about: null, replaces: null, key: `s${++k}` });
  const feature = (inp, f) => c(`${f}을(를) 지원 대상으로 설명한다`, piece(inp, `지원: ${f}`));
  const apply = (p, inp, reply) => M.applyReading(p, inp, M.validateMapReply({ candidates: [], gaps: [], matches: [], material: [], relations: [], ...reply }, inp.ask),
    { id: `R_part140_${++n}`, at: new Date(Date.now() + n).toISOString(), model: 'stub', prompt: 'm6-000000000140', hash: String(n).repeat(64).slice(0, 64) });

  let p = D.pasteRecord(D.rename(D.createProject(), 'micro-javascript · 140'), DOC, null).project;
  let inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
  const part = (ref, name, parent, role, basis, claims = []) => ({ ref, name, parent, role: `[스텁] ${role}`, roleAbout: null, roleReplaces: null, basis: [basis], claims });
  const first = apply(p, inp, { summary: '[스텁] 엔진과 eval 단계를 읽은 자리예요.',
    parts: [part('new:engine', 'micro-javascript', null, 'Python으로 JavaScript 실행 환경을 제공하는 엔진이다.', piece(inp, 'micro-javascript는'), FEATURES.slice(0, 4).map(f => feature(inp, f))),
      part('new:eval', 'eval', 'new:engine', '소스를 받아 세 단계로 넘기는 평가 진입점이다.', piece(inp, 'eval은')),
      part('new:parser', 'Parser', 'new:eval', '소스를 구문 트리로 만든다.', piece(inp, 'Parser는')),
      part('new:compiler', 'Compiler', 'new:eval', '구문 트리를 바이트코드로 바꾼다.', piece(inp, 'Compiler는')),
      part('new:vm', 'VM', 'new:eval', '컴파일 결과를 실행해 평가 결과를 돌려주는 가상 머신 단계다.', piece(inp, 'VM은 실행'), [
        c('VM을 생성할 때 컨텍스트의 메모리 제한값과 시간 제한값을 전달한다', piece(inp, 'VM을 생성할')),
        c('컨텍스트의 전역 상태를 복사하지 않고 공유하며, 주석은 중첩 eval이 전역 상태를 수정할 수 있도록 하기 위한 것이라고 설명한다', piece(inp, 'VM은 컨텍스트'))])],
    relations: [
      { from: 'new:parser', to: 'new:compiler', kind: 'flow', note: '[스텁] 구문 트리를 넘긴다.', at: piece(inp, 'eval은') },
      { from: 'new:compiler', to: 'new:vm', kind: 'flow', note: '[스텁] 바이트코드를 넘긴다.', at: piece(inp, 'eval은') },
      { from: 'new:vm', to: 'new:eval', kind: 'flow', note: '[스텁] 실행 결과를 평가 진입점에 돌려주어 Python 자료형으로 변환하게 한다.', at: piece(inp, 'VM은 실행') }] });
  p = first.project; const [engine, evalId, , , vm] = first.created;
  const more = (text, claims) => { p = D.pasteRecord(p, text, null).project; inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
    const ref = inp.ask.parts.find(x => x.name === 'micro-javascript').id;
    p = apply(p, inp, { summary: '[스텁] 엔진 설명을 더 읽은 자리예요.', parts: [{ ref, name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: claims(inp) }] }).project; };
  more(MORE[0], inp => FEATURES.slice(4, 8).map(f => feature(inp, f)));
  more(MORE[1], inp => FEATURES.slice(8, 12).map(f => feature(inp, f)));
  more(LIMITS, inp => [c(LIMITS.slice(4), piece(inp, '제한:'))]);
  return { project: JSON.parse(S.serializeProject(p)), engine, evalId, vm };
}

/** AF140 follow-up fixture: one part whose history holds two readings with the same time and the very same claim (same record,
 * quote, place and index), as a stored replay of a reading keeps them (a re-comparison or a copy); only their reading ids differ. */
export function twins({ D, M, S, studioView }) {
  let p = D.pasteRecord(D.rename(D.createProject(), '같은 시각 두 읽기 · 140'), '요구: 설정 화면은 저장 전에 입력을 검사한다.\n검사에 실패하면 저장하지 않는다.', null).project;
  const inp = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA), at = w => inp.ask.records.flatMap(r => r.spans).find(s => s.t.trimStart().startsWith(w)).s;
  const reply = { summary: '[스텁] 설정 화면', candidates: [], gaps: [], matches: [], material: [], relations: [], parts: [{ ref: 'new:settings', name: '설정 화면', parent: null, role: '[스텁] 저장 전에 입력을 검사하는 화면이다.', roleAbout: null, roleReplaces: null,
    basis: [at('요구:')], claims: [{ kind: 'want', text: '[스텁] 검사에 실패하면 저장하지 않기를 원함', at: at('검사에 실패하면'), about: null, replaces: null, key: 's1' }] }] };
  const when = '2026-10-30T01:00:00.000Z';
  const { project, created } = M.applyReading(p, inp, M.validateMapReply(reply, inp.ask), { id: 'R_twin_a', at: when, model: 'stub', prompt: 'm6-000000000140', hash: 'b'.repeat(64) });
  const first = project.readings.find(r => r.id === 'R_twin_a');
  const both = { ...project, readings: [...project.readings, { ...structuredClone(first), id: 'R_twin_b', hash: 'c'.repeat(64) }] };
  return { project: JSON.parse(S.serializeProject(both)), part: created[0] };
}
