// The author-written wire of the .43 v4 test (fictional project 책갈피 정리기, chunk1.txt and chunk2.txt): parts on their C-PART rows,
// steps on their C-STEP rows, claims on their C-RULE / C-CHANGE / C-WITHDRAW rows, lines on their C-LINK rows. No model quality is claimed.
import { readFileSync } from 'node:fs';
export const chunk = n => readFileSync(new URL(`./chunk${n}.txt`, import.meta.url), 'utf8');
export function ofChunks({ D, M, studioView }, texts = [chunk(1), chunk(2)]) {
  let project = D.createProject();
  for (const t of texts) project = D.pasteRecord(project, t, null).project;
  const input = M.buildMapAsk(project, studioView(project), [], undefined, M.MAP6_SCHEMA), spans = input.ask.records.flatMap(r => r.spans);
  const at = head => { const hit = spans.filter(s => s.t.startsWith(head)); if (hit.length !== 1) throw new Error(`span ${head}: ${hit.length}`); return hit[0].s; };
  return { project, input, ask: input.ask, at };
}
const TYPE = { 사용자: '사람', 'tidy 명령': '계산', '정리 엔진': '루프·엔진', '북마크 저장소': '행 파일·저장소', '내보내기 어댑터': '집행·외부 호출', '동기화 데몬': '루프·엔진', '웹 화면': '화면', '배포 작업': '빌드·배포 자동화', '사용자 코드': '외부 시스템' };
export function wire43(f) {
  const part = (ref, name, extra = {}) => ({ ref, name, parent: null, role: `${name}의 책임`, roleAbout: null, roleReplaces: null, basis: [f.at(`| ${name} | ${TYPE[name]} |`)], claims: [], ...extra });
  const claim = (key, head, extra = {}) => ({ key, kind: 'describes', text: `원문 행을 옮긴다(${key}).`, at: f.at(head), about: null, replaces: null, ...extra });
  const step = (name, does, uses, head) => ({ name, does, uses, at: f.at(head) });
  const line = (from, to, head, extra = {}) => ({ from, to, kind: 'flow', note: '', at: f.at(head), channel: 'data', mode: 'design', ...extra });
  const parts = [
    part('new:user', '사용자'),
    part('new:cli', 'tidy 명령', { claims: [claim('s1', '| tidy 명령 | 비밀', { kind: 'want', topic: 'rule', scope: 'part' }), claim('s2', '| 2026-10-20 |', { kind: 'reported', topic: 'change' })] }),
    part('new:engine', '정리 엔진', { state: 'running', stateAt: f.at('| 정리 엔진 | 루프'),
      steps: [step('읽기', '목록을 읽는다', ['load_list()'], '| 읽기 |'), step('정규화', 'URL을 고친다', ['normalize_url()'], '| 정규화 |'), step('중복 표시', '같은 URL을 묶는다', ['mark_dupes()'], '| 중복 표시 |'),
        step('경고', '중복이 많으면 경고한다', ['warn()'], '| 경고 |'), step('내보내기', '결과를 넘긴다', ['export(fmt)'], '| 내보내기 |')],
      conditions: [{ when: 'dupes > max_dupes', then: '경고', else: '다음', at: f.at('| 정리 엔진 | dupes') }],
      fileRoles: [{ path: 'S/engine.js', role: '정규화와 중복 표시', at: f.at('| S/engine.js |') }],
      claims: [claim('s3', '| 정리 엔진 | URL 정규화', { kind: 'want', topic: 'rule', scope: 'part', enforcedBy: [{ kind: 'person', text: '소유자 2026-09-01', at: f.at('| 정리 엔진 | URL 정규화') }] }),
        claim('s4', '| 2026-10-01 / 2026-10-03 |', { kind: 'reported', topic: 'change' }), claim('s5', '| 정리 엔진 | 중복을 지운다', { kind: 'reported', topic: 'withdrawn' })] }),
    part('new:store', '북마크 저장소', { type: 'store', typeAt: f.at('| 북마크 저장소 | 행 파일'), outputs: ['bookmarks.jsonl 행'], files: ['D/bookmarks.jsonl'], fileRoles: [{ path: 'D/ (실행 시)', role: '실행 때 생기는 행 파일', at: f.at('| D/ (실행 시) |') }],
      claims: [claim('s6', '| 북마크 저장소 | 백업', { kind: 'want', topic: 'rule', scope: 'part' })] }),
    part('new:export', '내보내기 어댑터'),
    part('new:sync', '동기화 데몬', { steps: [step('서버와 맞춤', '바뀐 행을 보낸다', ['sync_once()'], '| 서버와 맞춤 |')],
      conditions: [{ when: 'SYNC_ON || --sync', then: '동기화', else: '쉼', at: f.at('| 동기화 데몬 | SYNC_ON') }] }),
    part('new:web', '웹 화면'), part('new:deploy', '배포 작업'), part('new:usercode', '사용자 코드')];
  const relations = [line('new:user', 'new:cli', '| 사용자 | tidy 명령', { channel: 'control', payload: '명령 인자', cadence: '호출마다' }), line('new:cli', 'new:engine', '| tidy 명령 | 정리 엔진', { payload: 'D01 북마크 목록', cadence: '한 번' }),
    line('new:engine', 'new:export', '| 정리 엔진 | 내보내기 어댑터', { payload: 'D03 정리 결과', cadence: '끝에 한 번' }), line('new:sync', 'new:store', '| 동기화 데몬 | 북마크 저장소', { payload: 'D02 bookmarks.jsonl 행', cadence: '주기: 300 s' })];
  return { summary: '', parts, relations, candidates: [], gaps: [], matches: [], material: [] };
}
