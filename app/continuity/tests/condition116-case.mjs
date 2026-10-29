// AF116 test fixture (model-free, author-written, distinct from 113/114/115). A photo sorter: a map with one part read from a
// pasted requirement, a frozen request, and after it an ordinary pasted report whose own words name its branch, run environment
// and check conditions (one condition spans a CRLF line end; exact 80/81/200/201 unit condition lines; an embedded example block),
// a provided code file whose declared version is absent from its body, and a provided check log whose body names its environment.
// replyFor7 writes a lawful studio.map.7 reply for the very ask it is given; tests mutate a copy for each refusal. Not a model reply
// and not evidence of generation quality. Modules are passed in so another build can write the same project.
export const REQUIREMENT = '요구: 사진 정리기는 가져온 사진마다 작은 썸네일을 만든다.\n썸네일은 WebP 형식으로 저장하기를 원한다.';
/** A condition line of exactly n UTF-16 units (no sentence end inside, so it is one piece). */
export const fit = (head, n) => (head + ' ' + '='.repeat(n)).slice(0, n);
export const C80 = fit('모바일 조건: Pixel 8 · Android 15 · 업로드 앱 3.1', 80), C81 = fit('모바일 조건: Pixel 9 · Android 15 · 업로드 앱 3.2', 81);
export const C200 = fit('배포 조건: staging-eu 클러스터 · 이미지 태그 thumbs-2410 · 플래그 webp_on', 200), C201 = fit('배포 조건: staging-us 클러스터 · 이미지 태그 thumbs-2411 · 플래그 webp_on', 201);
export const LONG_ENV = fit('장기 실행 환경: 사진 40만 장 라이브러리 · NAS SMB 마운트 · 동시 작업 8개 · 메모리 제한 2GiB · 야간 배치 창', 150);
export const COND_CRLF = '조건: release/2.4 브랜치\r\n실행: Node 22.16 · Ubuntu 24.04';
export const COND_CHECK = '검사 조건: CI job thumbs-e2e (Linux 러너), 표본 사진 120장';
export const REPORT = ['작업 보고: 사진 정리기 썸네일', COND_CRLF, '', '썸네일 생성기를 WebP 출력으로 바꿨다고 보고합니다.', '',
  COND_CHECK, '썸네일 검사 120개 중 118개 통과, 2개 보류라고 보고합니다.', '',
  LONG_ENV, '장시간 검사 72시간 동안 메모리 증가가 없었다고 보고합니다.', '',
  C80, C81, C200, C201, '같은 출력이 모바일 업로드에도 적용되는지는 아직 확인하지 않았다고 적었습니다.', '',
  '예시 출력(검사용 표본):', '조건: sample/demo 브랜치', '썸네일 3장 생성 완료'].join('\n');
/** A provided code file (CRLF kept); its declared version 'v2.4.0-rc1' appears nowhere in its body. */
export const CODE = '// thumbs/webp.ts\r\nexport function toWebp(image, quality = 80) {\r\n  return encode(image, { format: \'webp\', quality });\r\n}\r\n';
export const CODE_META = { kind: 'code', name: 'webp.ts', version: 'v2.4.0-rc1', origin: 'https://example.com/photo-sorter/src/thumbs/webp.ts' };
export const CHECK = 'thumbs.e2e 결과\n환경: Ubuntu 24.04 / Node 22.16 / 표본 120장\n✓ WebP 썸네일은 원본 비율을 유지한다\n118 passed, 2 skipped\n';
export const CHECK_META = { kind: 'test', name: 'thumbs-e2e.log', version: 'run 5521', origin: null };
const ITEMS = [['WebP 썸네일', '가져온 사진의 썸네일을 WebP로 저장한다.'], ['썸네일 검사', '썸네일 생성이 검사로 확인된다.']];

export const reply7 = o => ({ summary: '', parts: [], relations: [], candidates: [], gaps: [], matches: [], material: [], ...o });
export const part7 = (ref, o = {}) => ({ ref, name: null, parent: null, role: null, roleAboutAt: null, roleReplaces: null, basis: [], claims: [], ...o });
/** The piece of a record whose text starts with words (record found by its own text in the ask). */
export const piece = (ask, rec, words) => { const x = ask.records.find(r => r.id === rec)?.spans.find(s => s.t.trimStart().startsWith(words)); if (!x) throw new Error(`no piece ${rec}: ${words}`); return x.s; };
export const range = (ask, rec, a, b) => `${piece(ask, rec, a)}-${piece(ask, rec, b).split('.')[1]}`;

/** The map with its request, then the report and both provided sources: { project, bundle, rq }. */
export function conditionProject({ D, M, C, S, studioView, emptyBundle }) {
  let p = D.rename(D.createProject(), '사진 정리기 116');
  p = D.pasteRecord(p, REQUIREMENT, null).project;
  const a0 = M.buildMapAsk(p, studioView(p), [], undefined, M.MAP6_SCHEMA);
  const r0 = { summary: '사진 정리기의 썸네일 요구를 읽었어요.', relations: [], candidates: [], gaps: [], matches: [], material: [], parts: [{ ref: 'new:thumbs', name: '썸네일', parent: null, role: '가져온 사진마다 작은 썸네일을 만드는 부분이다.', roleAbout: null, roleReplaces: null, basis: [piece(a0.ask, 'N01', '요구:')],
    claims: [{ kind: 'want', text: '썸네일을 WebP 형식으로 저장하기를 원함', at: piece(a0.ask, 'N01', '썸네일은'), about: null, replaces: null, key: 's1' }] }] };
  p = M.applyReading(p, a0, M.validateMapReply(r0, a0.ask), { id: 'R_116-first', at: new Date().toISOString(), model: 'stub-116', prompt: 'm6-000000000116', hash: '6'.repeat(64) }).project;
  const area = p.space.areas[0].id;
  const evidence = [{ id: 'INTENT', kind: 'user', title: '원함', text: ITEMS.map(x => x[0]).join(' / '), basis: '사용자 초안' }];
  const analysis = { summary: '썸네일', items: ITEMS.map(([title, description], i) => ({ id: `change_${i + 1}`, title, description, partIds: [area], refs: ['INTENT'], dependsOn: [] })), impacts: [], preserve: [], unknowns: [] };
  const plan = C.createPlan(p.id, '기준', evidence[0].text, evidence, analysis), snap = C.requestSnapshot(plan);
  const bundle = { ...emptyBundle(''), plan, by: { kind: 'ai', model: 'stub-116', at: snap.createdAt, records: { total: 1, sent: 1 } }, snapshots: [snap],
    labels: { [snap.id]: Object.fromEntries(ITEMS.map(([t], i) => [`change_${i + 1}`, t])) }, origins: { [snap.id]: 'ai' } };
  p = D.pasteRecord(p, REPORT, null).project;
  p = D.provideRecord(p, CODE, CODE_META, null).project;
  p = D.provideRecord(p, CHECK, CHECK_META, null).project;
  return { project: JSON.parse(S.serializeProject(p)), bundle, rq: snap.scope };
}

/** The aliases of the report, the code and the check in an ask. */
export function aliases(ask, records) {
  const of = text => ask.records.find(r => records.get(r.id).text === text)?.id;
  const out = { report: of(REPORT), code: of(CODE), check: of(CHECK) };
  if (!out.report || !out.code || !out.check) throw new Error('aliases: the ask lacks the report or a provided source');
  return out;
}

/** A lawful studio.map.7 reply for this ask: every condition is an anchor of its owning record, or null. */
export function replyFor7(ask, records) {
  const { report: R, code: K, check: T } = aliases(ask, records), q = ask.requests[0], t = item => [{ requestId: q.id, itemId: item }];
  const mm = (at, kind, item, aboutAt, o = {}) => ({ at, text: '범위', kind, stance: 'unclear', aboutAt, targets: t(item), why: '스텁', replaces: null, ...o });
  return reply7({
    summary: 'WebP 썸네일 보고와 검사 조건을 읽었어요.',
    parts: [
      part7('new:webp', { name: 'WebP 인코더', parent: 'P01', role: 'WebP 형식으로 썸네일을 인코딩하는 부분이다.', roleAboutAt: range(ask, R, '조건: release', '실행:'), basis: [piece(ask, R, '썸네일 생성기를')] }),
      part7('P01', { claims: [
        { kind: 'reported', text: '썸네일 생성기를 WebP 출력으로 바꿨다고 보고함', at: piece(ask, R, '썸네일 생성기를'), aboutAt: range(ask, R, '조건: release', '실행:'), replaces: null, key: 's1' },
        { kind: 'checked', text: '썸네일 검사 120개 중 118개 통과·2개 보류를 보고함', at: piece(ask, R, '썸네일 검사 120개'), aboutAt: piece(ask, R, '검사 조건:'), replaces: null, key: 's2' },
        // The condition is longer than 80: no condition anchor, the distinction kept in its words and in its exact evidence.
        { kind: 'checked', text: '40만 장 NAS 라이브러리·동시 작업 8개·메모리 2GiB 장기 실행 환경에서 72시간 메모리 증가 없음을 보고함', at: range(ask, R, '장기 실행 환경:', '장시간 검사'), aboutAt: null, replaces: null, key: 's3' },
        // The provided code names no version in its body: its declared version stays a declaration, never a condition.
        { kind: 'describes', text: 'toWebp는 품질 기본값 80으로 WebP 인코딩을 한다', at: piece(ask, K, 'export function toWebp'), aboutAt: null, replaces: null, key: 's4' }] })],
    candidates: [{ text: '모바일 업로드 출력에도 같은 결과가 성립하는지 아직 정해지지 않았어요.', target: 'holds', parts: ['P01'], at: null,
      statement: { key: 's5', kind: 'reported', text: '모바일 업로드에도 같은 출력이 적용됨', at: piece(ask, R, '같은 출력이 모바일'), aboutAt: piece(ask, R, '모바일 조건: Pixel 8') } }],
    matches: [
      mm(piece(ask, R, '썸네일 생성기를'), 'reported', 'change_1', piece(ask, R, '배포 조건: staging-eu'), { stance: 'made', text: 'WebP 출력으로 바꿨다고 보고함' }),
      mm(piece(ask, K, 'export function toWebp'), 'code', 'change_1', null, { text: 'WebP 인코딩 코드' }),
      mm(piece(ask, T, '✓ WebP'), 'test', 'change_2', piece(ask, T, '환경:'), { text: '원본 비율 유지 검사 기록' }),
      mm(piece(ask, R, '썸네일 검사 120개'), 'checked', 'change_2', piece(ask, R, '검사 조건:'), { text: '검사 120개 중 118개 통과 보고' })],
    material: [{ at: range(ask, R, '예시 출력', '썸네일 3장'), what: '검사용 예시 출력' }]
  });
}

/** A map.6 reply as a pre116 reader answers the same later reading: plain about strings (a match about is a passage of its record). */
export function replyFor6(ask, records) {
  const { report: R, code: K, check: T } = aliases(ask, records), q = ask.requests[0], t = item => [{ requestId: q.id, itemId: item }];
  return { summary: 'WebP 썸네일 보고를 읽었어요.', relations: [], candidates: [], gaps: [], material: [],
    parts: [{ ref: 'P01', name: null, parent: null, role: null, roleAbout: null, roleReplaces: null, basis: [], claims: [
      { kind: 'reported', text: '썸네일 생성기를 WebP 출력으로 바꿨다고 보고함', at: piece(ask, R, '썸네일 생성기를'), about: 'release/2.4 브랜치', replaces: null, key: 's1' },
      { kind: 'describes', text: 'toWebp는 품질 기본값 80으로 WebP 인코딩을 한다', at: piece(ask, K, 'export function toWebp'), about: null, replaces: null, key: 's2' }] }],
    matches: [
      { at: piece(ask, R, '썸네일 생성기를'), text: 'WebP 출력으로 바꿨다고 보고함', kind: 'reported', stance: 'made', about: 'release/2.4 브랜치', targets: t('change_1'), why: '스텁', replaces: null },
      { at: piece(ask, T, '✓ WebP'), text: '원본 비율 유지 검사 기록', kind: 'test', stance: 'unclear', about: null, targets: t('change_2'), why: '스텁', replaces: null }] };
}
