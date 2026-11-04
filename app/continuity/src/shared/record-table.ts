/* Recipe .43 (docs/design/RECORD_ASKS_V4_KO.md 4.1–4.2): the one reading of a record's tables. Every pass that reads a record's table
 * rows goes through here: one cell splitter (splitCells: 「&#124;」 and 「\|」 stay inside their cell, each cell keeps where it stands, a v3
 * 「||」 that split a cell is joined again), one table reader keyed by the fixed table ID of the 기록 요청 v4 (「C-PART 부분」, 「P4-02 상태
 * 전이」) with the anchored v3 title map as its fallback (「2. 부분」 → C-PART), and one entry for the passes (rowsOf). A table or column
 * the reader does not know is kept with a diagnostic, never dropped silently. The table definitions here are the very header rows the
 * request text writes (report-ask.ts builds the request and the continuation request from them). Nothing here calls a model. */

/** A cell of a table line: its text for comparison (「&#124;」 and 「\|」 read as 「|」, trimmed), the cell as written, and where the
 * written cell (its own white space left out) stands: [from, to) of the text the line was given with. */
export interface TableCell { text: string; raw: string; from: number; to: number }
const unescape = (s: string): string => s.replace(/&#124;/g, '|').replace(/\\\|/g, '|');
/** The cells of a markdown table line (its outer pipes left off), split on 「|」 where it is not escaped as 「\|」; 「&#124;」 never
 * splits. from: where the line stands in its text (the cells' places are that text's). Backticks protect nothing. */
export function splitCells(line: string, from = 0): TableCell[] {
  let start = 0, end = line.length;
  while (start < end && /\s/.test(line[start]!)) start++;
  while (end > start && /\s/.test(line[end - 1]!)) end--;
  if (line[start] === '|') start++;
  if (end > start && line[end - 1] === '|' && line[end - 2] !== '\\') end--;
  const out: TableCell[] = [];
  let cell = start;
  for (let i = start; i <= end; i++) {
    if (i < end && (line[i] !== '|' || line[i - 1] === '\\')) continue;
    const raw = line.slice(cell, i), lead = raw.length - raw.trimStart().length, written = raw.trim();
    out.push({ text: unescape(written), raw: written, from: from + cell + lead, to: from + cell + lead + written.length });
    cell = i + 1;
  }
  return out;
}
/** The cells' texts of a table line (the old tableCells). */
export const cellTexts = (line: string): string[] => splitCells(line).map(c => c.text);
/** A table row's cells against its header's width: a row with more cells than the header joins an empty cell with its two neighbours
 * again (a v3 「a || b」 split into 「a」, 「」, 「b」), leftmost first, until it fits; over when it still does not (the row is no data then).
 * A single 「|」 is never joined back (what it meant is not known). */
export function rowCells(line: string, from: number, width: number): { cells: TableCell[]; rejoined: number; over: boolean } {
  const cells = splitCells(line, from);
  let rejoined = 0;
  while (width > 0 && cells.length > width) {
    const i = cells.findIndex((c, k) => k > 0 && k < cells.length - 1 && c.text === '');
    if (i < 0) break;
    const a = cells[i - 1]!, b = cells[i + 1]!, raw = line.slice(a.from - from, b.to - from);
    cells.splice(i - 1, 3, { text: unescape(raw.trim()), raw, from: a.from, to: b.to });
    rejoined++;
  }
  return { cells, rejoined, over: width > 0 && cells.length > width };
}
const isRule = (cells: readonly TableCell[]): boolean => cells.every(c => !c.text || /^:?-{2,}:?$/.test(c.text));

/* ---------- The tables of the 기록 요청 v4 (3.5), header rows verbatim. ---------- */
export interface TableDef { id: string; title: string; columns: readonly string[]; chunk: 0 | 1 | 2; profile: boolean;
  /** Profile tables: the rows one chunk carries and the request's sentence after 「—」. */
  rows?: number; note?: string;
  /** Recipe .45 (RECORD_ASKS_V5_KO.md 1.1, 8.1): a v5 table's queue (0 = every page's end, 1 = Q1 first structure, 2 = Q2 detail,
   * 3 = Q3 supplementary) and its row-ID prefix (B, LN, B03:S… as 'S', B03:L… as 'L'; null for C-HEAD, C-SUMMARY, C-DROP and C-END); a v4
   * table has neither. */
  queue?: 0 | 1 | 2 | 3; rowId?: string | null; dialect?: 'v4' | 'v5' }
const common = (id: string, title: string, chunk: 0 | 1 | 2, columns: string[]): TableDef => ({ id, title, columns: Object.freeze(columns), chunk, profile: false, dialect: 'v4' });
/** Recipe .45: the v4 common tables, frozen as .44 read them (v4 and v3 records still read exactly as in .44). */
export const V4_TABLES: readonly TableDef[] = Object.freeze([
  common('C-BASIS', '기준', 1, ['날짜·시각', '브랜치·커밋 sha·판본', '읽은 범위']),
  common('C-SUMMARY', '요약', 1, []),
  common('C-PART', '부분', 1, ['이름', '유형', '하는 일 한 줄', '담당 파일·폴더', '구현 상태', '행 ID', '근거']),
  common('C-GROUP', '묶음', 1, ['부모 이름', '자식 이름들', '묶음 뜻', '근거']),
  common('C-LINK', '연결', 1, ['보내는 부분', '받는 부분', '넘기는 것', '박자', '조건·선택', '경계', '설계/관찰', '근거']),
  common('C-CHANGE', '최근 변화', 1, ['날짜', '관련 주체·역할', '원한 것', '바뀐 부분', '실제로 바뀐 것', '계약 변화', '실린 판본', '근거']),
  common('C-WITHDRAW', '철회·변경', 1, ['부분', '옛 결정', '지금', '방식', '계약 변화', '근거']),
  common('C-RULE', '지켜야 할 것과 하지 않기로 한 것', 1, ['부분', '규칙 한 줄', '정한 이·언제', '지키는 장치', '장치 위치', '근거']),
  common('C-STATUS', '상태 주장', 1, ['대상', '상태 차원', '값', '적용 범위·조건', '기준', '근거']),
  common('C-ISSUE', '오류·미해결·할 일', 1, ['부분', '무엇이', '언제부터', '근거']),
  common('C-GATE', '다음 관문', 1, ['부분', '무엇이 확인되면', '무엇을 한다', '막고 있는 것', '언제쯤', '근거']),
  common('C-UNKNOWN', '모르는 것', 1, ['부분', '무엇을', '어떻게 확인할 수 있나']),
  common('C-DOUBT', '가장 자신 없는 것', 1, ['부분', '내용', '근거']),
  common('C-DATA', '산출물', 2, ['이름', '종류', '필드·모양', '만드는 부분', '읽는 부분', '있는 곳·쓰기 방식', '행 ID', '근거']),
  common('C-DESIGN', '부분별 설계', 2, ['부분', '받는 산출물', '안의 단계', '내는 산출물', '설정', '근거']),
  common('C-STEP', '안의 단계', 2, ['단계 이름', '하는 일 한 줄', '쓰는 파일·함수', '소속 반복 ID', '조건·분기', '행 ID', '근거']),
  common('C-LOOP', '반복', 2, ['소유 부분', '부모 반복 ID', '몸통 단계 ID', '반복 단위', '횟수·계속 조건', '종료·탈출 조건', '행 ID', '근거']),
  common('C-COND', '조건·거부·분기', 2, ['부분', '조건', '참이면', '거짓이면', '갈리는 때', '근거']),
  common('C-VARIANT', '변형', 2, ['공통 계약·접점 ID', '구현 부분', '선택 주체·시점', '선택 조건', '함께 사용 가능 여부', '행 ID', '근거']),
  common('C-ENTRY', '진입·소비', 2, ['진입점', '소유 부분', '소비자·호출 주체', '호출 방식', '계약 ID', '행 ID', '근거']),
  common('C-CONTRACT', '외부 계약', 2, ['제공 부분', '외부 소비자', '접점·방향', '자료·응답·종료·오류 명세', '적용 판본', '행 ID', '근거']),
  common('C-FILES', '파일 지도', 2, ['경로', '속한 부분', '역할 한 줄', '근거']),
  common('C-DONE', '완료표', 0, ['표 ID', '작성 상태', '수록 범위', '남은 범위'])]);
const profile = (id: string, title: string, rows: number, columns: string[], note: string): TableDef => ({ id, title, columns: Object.freeze([...columns, '행 ID', '근거']), chunk: 2, profile: true, rows, note });
export const PROFILE_TABLES: readonly TableDef[] = Object.freeze([
  profile('P1-01', '입력 해석·분배', 6, ['진입점 ID', '입력·플래그', '해석·검증', '선택 조건', '처리 대상'], '실제 파싱·라우팅 결정. 도움말을 통째로 옮기지 말고 진입·분기·출력·호환을 바꾸는 플래그부터, 나머지는 위치와 미수록 개수. 이름이 비슷하다고 호출 관계를 만들지 마.'),
  profile('P1-02', '처리 사슬', 6, ['사슬 ID', '순서', '단계·부분', '받는 것', '다음으로 넘김·중단 조건'], '미들웨어·훅의 순서와 단락 조건. 등록 순서와 실행 순서가 같다고 가정하지 마.'),
  profile('P1-03', '종료·실패 처리', 5, ['발생 조건', '처리 위치', '후속 동작', '외부 계약 ID', '남는 효과'], '정상 종료·오류·취소의 차이. 예외가 있다고 자동 재시도·롤백을 붙이지 마.'),
  profile('P2-01', '공개 계약 상세', 6, ['공통 계약 ID', '필드·연산', '타입·필수성', '제약', '호환성 조건'], '외부 소비자에게 약속한 항목만. 긴 필드 목록은 공통 필드 + 변형별 차이로 쓰되 필수성·기본값이 달라지는 필드는 빼지 마. 내부 구조체를 공개 계약으로 올리지 마.'),
  profile('P2-02', '확장 접점', 5, ['접점 ID', '소유 부분', '구현해야 할 계약', '등록·연결 방식', '호출·해제 시점'], '플러그인·어댑터·콜백의 실제 접점. 함수를 인자로 받는다는 이유만으로 확장점이라 부르지 마.'),
  profile('P2-03', '호환·전환', 4, ['계약·변형 ID', '이전→이후', '깨지는 조건', '전환 수단', '적용 판본'], '적용 판본은 변경 기록·문서·커밋에서 확인한 것만(기억으로 채우지 마). 사용 중단 권고를 제거됨이나 즉시 사용 불가로 바꾸지 마.'),
  profile('P3-01', '변환', 6, ['변환 ID', '수행 부분·단계', '입력 자료', '변환', '출력 자료', '조건'], '자료가 바뀌는 경계. 단순 전달을 계산·정규화로 해석하지 마.'),
  profile('P3-02', '산출물 수명', 5, ['산출물 ID', '만드는 곳', '읽는 곳', '저장 위치·형식', '생성·갱신·삭제 조건'], '언제 효과가 확정되나(반환·완료 표시·파일 생성과 영속·외부 반영이 다르면 둘 다). 이름만 보고 영속·공유 저장이라고 단정하지 마.'),
  profile('P3-03', '형태·단위', 5, ['자료·단계 ID', 'dtype·형식', '모양·차원 순서', '단위', '제약'], '모양은 기호식 그대로(기호 뜻은 처음 한 번). 모르는 차원·단위·배치 크기를 관례로 채우지 마.'),
  profile('P4-01', '상태 보유', 6, ['상태 ID', '소유 부분', '상태·변수', '초기값', '변경 주체', '수명·보존'], '상태의 소유자와 수명. 화면에 보이는 값을 모두 영속 상태로 보지 마.'),
  profile('P4-02', '상태 전이', 8, ['상태 ID', '이전', '사건', '조건', '이후', '부수 효과'], '실제 전이 단위로, 부수 효과가 언제 확정되고 어디까지 한 번에 바뀌나. 같은 전이식을 쓰는 대상만 묶고, 조건이나 부수 효과가 다른 전이를 「유사 N개」로 줄이지 마. 코드에 없는 중간·완료 상태를 보태지 마.'),
  profile('P4-03', '신호 전달', 5, ['신호 ID', '발생 주체', '수신 주체', '전달 방식', '순서·중복·유실 보장', '해제'], '이벤트·구독·인터럽트의 전달 계약. 이벤트가 있다고 동기·순서 보장·정확히 한 번을 가정하지 마.'),
  profile('P5-01', '작업과 선행 조건', 6, ['작업 ID', '수행 부분', '촉발', '선행 조건', '시작·완료 판정'], '의존·승인·시간 촉발을 가르고, 완료 표시와 효과 확정이 다르면 둘 다. 그림의 좌우 순서를 실행 순서로 읽지 마.'),
  profile('P5-02', '실행 정책', 5, ['작업·반복 ID', '실행 단위', '동시성·배타', '시간·예산 제한', '취소'], '근거 있는 범위에서만. async라는 이유로 병렬 실행을 단정하지 마.'),
  profile('P5-03', '실패·복구', 5, ['작업·단계 ID', '실패 조건', '재시도 조건·한도', '복구 위치', '중복·부분 성공 처리'], '재시도·재개·보상·재실행을 가르고, 무엇이 어디까지 원자적으로 바뀌나. 같은 정책을 쓰는 작업은 정책 한 행과 대상 ID 목록으로, 예외는 따로. 재시도가 있다고 멱등성·중복 방지를 붙이지 마.'),
  profile('P6-01', '설정 정의', 6, ['설정 ID·키', '적용 대상', '타입·허용 범위', '기본값·식', '읽는 시점'], '선언된 기본값과 계산식을 가른다. 예제 설정을 제품 기본값으로 보지 마.'),
  profile('P6-02', '설정 적용', 8, ['적용 범위·프리셋', '설정 ID', '설정 출처', '지정값', '우선 관계', '병합 방식'], '프리셋은 공통 기본값 + 프리셋별로 바뀐 칸만. 「행이 없으면 기본값」은 그 해석 규칙을 확인했을 때만. 우선순위가 일부만 확인되면 「A > B, C와의 관계 모름」. 환경변수가 늘 우선하거나 객체가 깊게 병합된다고 가정하지 마.'),
  profile('P6-03', '빌드·배치 연결', 6, ['단위 ID', '소스·패키지', '산출물', '플랫폼·환경', '연결·포함 조건', '변경·이행 절차'], '빌드 선택·번들 포함·배포 배선. 의존성 선언만으로 최종 번들 포함이나 실제 배포를 주장하지 마.'),
  profile('P6-04', '자원·신뢰 경계', 6, ['자원·경계 ID', '접근 주체', '대상', '허용 동작·조건', '지키는 장치·위치', '획득·해제 또는 이행'], '권한 검사·자원 소유·해제를 구체적으로. 폴더·프로세스·컨테이너 경계를 곧바로 보안 보장으로 보지 마.')]);
/** The v4 tables by ID (v4 and v3 records; the v4.1 request and its continuation). */
export const TABLE_DEFS: ReadonlyMap<string, TableDef> = new Map([...V4_TABLES, ...PROFILE_TABLES].map(t => [t.id, t]));
export const V4_TABLE_DEFS = TABLE_DEFS;

/* ---------- Recipe .45: the tables of the 기록 요청 v5 (RECORD_ASKS_V5_KO.md 1.1, 10, 12, 13; 12 and 13 over the earlier sections), header
 * rows verbatim. Every table but C-HEAD (keyed by its 항목) and C-END (by its 표 ID) has a row ID in its first column; a 「부분」 column holds
 * B IDs; the last column 근거 cites F and E IDs of the page's ledgers (C-SRC, C-EVID) explicitly (no 「=」). C-LINK keeps a 주장 성격 column
 * (정의된 관계 / 실행 보고 / 실행 관측 / 추정, 12.2); C-STATE holds the few state rows that decide the first structure (13.6); C-CHECK six rows
 * CK1–CK6 (5.2, 13.5). The supplementary tables keep their v4 definitions (queue 3). ---------- */
const v5 = (id: string, title: string, queue: 0 | 1 | 2, rowId: string | null, columns: string[]): TableDef => ({ id, title, columns: Object.freeze(columns), chunk: 0, profile: false, queue, rowId, dialect: 'v5' });
export const COMMON_TABLES: readonly TableDef[] = Object.freeze([
  v5('C-HEAD', '기록 머리', 1, null, ['항목', '값', '근거']),
  v5('C-SUMMARY', '요약', 1, null, []),
  v5('C-PART', '부분', 1, 'B', ['행 ID', '이름', '표현군·역할', '하는 일 한 줄', '담당 F', '구현 상태', '근거']),
  v5('C-GROUP', '묶음', 1, 'GR', ['행 ID', '부모', '자식들', '묶음 뜻', '근거']),
  v5('C-LINK', '연결', 1, 'LN', ['행 ID', '보내는 부분', '받는 부분', '넘기는 것', '박자', '조건·선택', '경계', '주장 성격', '근거']),
  v5('C-LOOP', '반복', 1, 'L', ['행 ID', '소유 부분', '부모 반복', '반복 단위', '횟수·계속 조건', '종료·탈출 조건', '몸통 설명', '근거']),
  v5('C-STATE', '상태(첫 구조)', 1, 'SM', ['행 ID', '소유 부분', '상태', '전이 사건', '다음 상태', '근거']),
  v5('C-WITHDRAW', '철회·변경', 1, 'WD', ['행 ID', '부분', '옛 결정', '지금', '방식', '계약 변화', '근거']),
  v5('C-STATUS', '상태 주장', 1, 'ST', ['행 ID', '대상', '상태 차원', '값', '적용 범위·조건', '기준', '근거']),
  v5('C-CHECK', '점검', 1, 'CK', ['행 ID', '점검', '결과', '찾은 것', '찾은 방법', '근거']),
  v5('C-STEP', '안의 단계', 2, 'S', ['행 ID', '단계 이름', '하는 일 한 줄', '쓰는 함수', '소속 반복', '조건·분기', '근거']),
  v5('C-DATA', '산출물', 2, 'D', ['행 ID', '이름', '종류', '필드·모양', '만드는 부분', '읽는 부분', '있는 곳·쓰기 방식', '근거']),
  v5('C-COND', '조건·거부·분기', 2, 'CD', ['행 ID', '부분', '조건', '참이면', '거짓이면', '갈리는 때', '근거']),
  v5('C-CHANGE', '변화 이력', 2, 'CH', ['행 ID', '날짜', '관련 주체·역할', '원한 것', '바뀐 부분', '실제로 바뀐 것', '찾은 길', '계약 변화', '실린 판본', '근거']),
  v5('C-RULE', '지켜야 할 것과 하지 않기로 한 것', 2, 'RU', ['행 ID', '부분', '규칙 한 줄', '정한 이·언제', '지키는 장치', '장치 위치', '근거']),
  v5('C-ENTRY', '진입·소비', 2, 'N', ['행 ID', '진입점', '소유 부분', '소비자·호출 주체', '호출 방식', '계약 ID', '근거']),
  v5('C-VARIANT', '변형', 2, 'X', ['행 ID', '공통 계약·접점 ID', '구현 부분', '선택 주체·시점', '선택 조건', '함께 사용 가능 여부', '근거']),
  v5('C-CONTRACT', '외부 계약', 2, 'K', ['행 ID', '제공 부분', '외부 소비자', '접점·방향', '자료·응답·종료·오류 명세', '적용 판본', '근거']),
  v5('C-ISSUE', '오류·미해결·할 일', 2, 'IS', ['행 ID', '부분', '무엇이', '언제부터', '근거']),
  v5('C-GATE', '다음 관문', 2, 'GT', ['행 ID', '부분', '무엇이 확인되면', '무엇을 한다', '막고 있는 것', '언제쯤', '근거']),
  v5('C-UNKNOWN', '모르는 것', 2, 'UN', ['행 ID', '부분', '무엇을', '어떻게 확인할 수 있나']),
  v5('C-DOUBT', '가장 자신 없는 것', 2, 'DB', ['행 ID', '부분', '내용', '근거']),
  v5('C-SRC', '파일 장부', 0, 'F', ['F ID', '경로', '속한 부분', '읽음', '역할']),
  v5('C-EVID', '근거 장부', 0, 'E', ['E ID', '등급', '출처', '자리', '짧은 인용']),
  v5('C-DROP', '삭제', 0, null, ['행 ID', '이유', '근거']),
  v5('C-END', '쪽 끝', 0, null, ['표 ID', '상태', '쓴 행', '예약', '남은 것'])]);
/** The v5 tables by ID (the supplementary tables queue 3, their v4 definitions). */
export const V5_TABLE_DEFS: ReadonlyMap<string, TableDef> = new Map([...COMMON_TABLES, ...PROFILE_TABLES.map(t => ({ ...t, queue: 3 as const, rowId: 'P', dialect: 'v5' as const }))].map(t => [t.id, t]));
/** The v5 queues in order (1.1): Q1 then Q2 (recommended order, 12.1), the page-end tables apart. */
export const Q1_TABLES = COMMON_TABLES.filter(t => t.queue === 1).map(t => t.id), Q2_TABLES = COMMON_TABLES.filter(t => t.queue === 2).map(t => t.id);
export const PAGE_END_TABLES = COMMON_TABLES.filter(t => t.queue === 0).map(t => t.id);
/** The header row of a table as the request writes it (「| 이름 | 유형 | … | 근거 |」). */
export const headerLine = (t: TableDef): string => `| ${t.columns.join(' | ')} |`;
/** v1 design records only: the 「부분 유형」 table (read as C-PART's 유형). */
export const PARTTYPE_TABLE = 'C-PARTTYPE';

/* ---------- Lines the reader knows. ---------- */
/** A v4 title line: 「C-PART 부分」, 「## P4-02 상태 전이」 (any C- or P<digit>-<two digits> ID; an unknown one is kept with a diagnostic). */
const TITLE_LINE = /^(?:#{1,4}\s*)?(C-[A-Z]{2,12}|P\d-\d{2})\s+(\S.*)$/;
/** A v3 numbered section heading (「2. 부분」), as every v3 reader has read it. */
const V3_HEADING = /^\d{1,2}\.\s*(.+)$/;
/** The chunk head of a v4 record: 「〔기록 AF4-7c19e2a0 · 덩이 1 · 기준 4e1d9b2〕 이름 기록 v4 (…)」. */
export const CHUNK_HEAD = /^〔\s*기록\s+(\S+?)\s*·\s*덩이\s+(\d{1,2})\s*·\s*기준\s+([^〕\s]+)\s*〕\s*(.*)$/;
/** Recipe .45 (RECORD_ASKS_V5_KO.md 1.2, 8.1): the page head of a v5 record: 「〔기록 AF5-3b7e0c19 · 쪽 1 · 기준 9f2c1ab · 앞 쪽 —〕 이름 기록 v5 (…)」. */
export const PAGE_HEAD = /^〔\s*기록\s+(\S+?)\s*·\s*쪽\s+(\d{1,2})\s*·\s*기준\s+([^〕\s]+)\s*·\s*앞\s*쪽\s+(\d{1,2}|—|-)\s*〕\s*(.*)$/;
/** A page's own closing lines under C-END (1.2): 「완료 단계: 진행 중 / 첫 구조 완료 / 상세 완료」 and 「다음: C-LOOP(B07부터)」. */
const LEVEL_LINE = /^완료\s*단계\s*[:：]\s*(.*)$/, NEXT_LINE = /^다음\s*[:：]\s*(.*)$/;
export const LEVEL_WORDS: Readonly<Record<string, 0 | 1 | 2>> = Object.freeze({ '진행 중': 0, '첫 구조 완료': 1, '상세 완료': 2 });
const NONE_LINE = /^없음\s*[:：]\s*(.*)$/, FOCUS_LINE = /^이번\s*기록의\s*초점\s*[:：]\s*(.*)$/, PROMISE_LINE = /경로\s*약속\s*[:：]/, LATER_LINE = /덩이\s*2는\s*「?이어서」?에/;
/** The v3 title map (4.2): a numbered heading's title → the table ID, each anchored, first match wins. */
export const V3_TITLES: readonly [RegExp, string][] = Object.freeze([
  [/^기준/, 'C-BASIS'], [/^(?:한\s*줄\s*)?요약/, 'C-SUMMARY'], [/^부분(?:\s*\(표\))?$/, 'C-PART'], [/^부분\s*유형(?:\s*\(표\))?$/, PARTTYPE_TABLE],
  [/^부분별\s*설계/, 'C-DESIGN'], [/^묶음/, 'C-GROUP'], [/^연결/, 'C-LINK'], [/실제\s*(?:로\s*)?(?:바뀐|변화)/, 'C-CHANGE'], [/^철회/, 'C-WITHDRAW'],
  [/^지켜야\s*할/, 'C-RULE'], [/^오류\s*·\s*미해결/, 'C-ISSUE'], [/^다음\s*관문/, 'C-GATE'], [/^모르는\s*것/, 'C-UNKNOWN'], [/^가장\s*자신\s*없는/, 'C-DOUBT'],
  [/^산출물/, 'C-DATA'], [/^안의\s*단계/, 'C-STEP'], [/^조건\s*·\s*거부/, 'C-COND'], [/^파일\s*지도/, 'C-FILES']] as [RegExp, string][]);
export const v3TableId = (title: string): string | null => V3_TITLES.find(([re]) => re.test(title.trim()))?.[1] ?? null;
/** A column name compared loosely: NFC, emphasis and spacing left out, the middle-dot variants one. */
export const columnKey = (s: string): string => s.normalize('NFC').replace(/[*`]/g, '').replace(/[・･•∙]/g, '·').replace(/\s*·\s*/g, '·').replace(/\s*\/\s*/g, '/').replace(/\s+/g, ' ').trim();
/** The v3 column names read as a v4 column (4.2 「v3 열 대응」), by the loose name. */
const V3_COLUMNS: ReadonlyMap<string, string> = new Map([['상태 단어', 'legacyState'], ['상태의 기준 시각', 'legacyStateAt'], ['언제·얼마나 자주', '박자'],
  ['누가 정했나·언제', '정한 이·언제'], ['바뀐 부분 이름', '바뀐 부분'], ['부분 이름', '부분'], ['순번', '순서'], ['쓰는 파일·함수·모델', '쓰는 파일·함수'],
  ['꼬리표', '근거'], ['확인 방법', '근거'], ['근거·날짜', '근거'], ['언제부터·근거', '언제부터'], ['한 줄', '하는 일 한 줄'], ['필드', '필드·모양'], ['있는 곳', '있는 곳·쓰기 방식'],
  ['오늘 날짜·시각', '날짜·시각'], ['브랜치·커밋 sha', '브랜치·커밋 sha·판본'], ['파일을 읽을 수 있는지', '읽은 범위'], ['이 대화의 앞부분이 요약됐는지', '읽은 범위']].map(([k, v]) => [columnKey(k!), v!]));

/* ---------- Reading one record. ---------- */
export type RecordVersion = 'v5' | 'v4' | 'v3-status' | 'v1-design';
export interface ChunkHead { recordId: string; chunk: number; basis: string; title: string; from: number; to: number }
/** Recipe .45: a v5 page head (prev null for 「앞 쪽 —」), where it stands and where its page runs to (the next head or the text's end). */
export interface PageHead { recordId: string; n: number; prev: number | null; basis: string; title: string; from: number; to: number; end: number }
export interface RecordRow { from: number; to: number; cells: TableCell[];
  /** The row's cells by column: the v4 column name (a v3 column by its v4 name, 4.2), or the header as written for a column the table
   * does not define; the cell's text. */
  byColumn: Readonly<Record<string, string>>;
  /** The cells of the columns the table does not define, by their header as written. */
  extra: Readonly<Record<string, string>> }
export interface RecordTable { id: string; title: string;
  /** v4: a 「C-… 제목」 title line; v3: a numbered heading the v3 title map names. */
  dialect: 'v5' | 'v4' | 'v3'; known: boolean; header: string[];
  /** v5: the index of the page head it stands under (RecordTables.pages), -1 before any. */
  page: number;
  /** For each header cell, the column it is (the v4 name), or null for one the table does not define. */
  columns: (string | null)[];
  /** The columns of the definition the header leaves out (v4 only). */
  missing: string[]; extra: string[]; rows: RecordRow[];
  /** 「없음: 확인한 범위 [근거]」 written in place of the header (the table was looked for and is empty). */
  none: { text: string; from: number; to: number } | null;
  /** Where the title line stands, and the text the table runs to (its last line's end). */
  from: number; to: number;
  /** The text under a table that is no table (C-SUMMARY's sentences): each nonblank line and where it stands. */
  body: { text: string; from: number; to: number }[] }
export interface RecordDiagnostic { rule: 'contract'; category: 'row-cells' | 'unknown-table' | 'unknown-column' | 'missing-column' | 'chunk-head' | 'page-head'; table: string | null; column: string | null; from: number; to: number }
export interface RecordFocus { profiles: string[]; reason: string | null; tables: string[]; none: boolean; text: string; from: number; to: number }
export interface PathPromise { basis: string | null; aliases: Map<string, string>; text: string; from: number; to: number }
export interface RecordTables { version: RecordVersion | null; chunk: ChunkHead | null; tables: RecordTable[];
  /** The tables by ID (a table written twice keeps both, in order). */
  byId: ReadonlyMap<string, RecordTable[]>;
  focus: RecordFocus | null; promise: PathPromise | null;
  /** 「덩이 2는 「이어서」에」: the session stopped after chunk 1 and waits for 「이어서」. */
  awaitsNext: boolean; diagnostics: RecordDiagnostic[];
  /** Recipe .45 (v5): every page head the text holds, in order (a pasted answer may hold several pages), the first of them, and each
   * page's 「완료 단계:」 and 「다음:」 lines (the author's declaration; the app computes the level itself). */
  pages: PageHead[]; page: PageHead | null;
  declared: { page: number; level: 0 | 1 | 2 | null; text: string; from: number; to: number }[];
  nexts: { page: number; text: string; from: number; to: number }[] }

/** Which record a text is (4.1): v4 when its first line says 「기록 v4」 or a chunk head stands in it; a v3 status report by 「현황 보고서
 * (v3 표 형식」; a v1 design record by 「설계 기록」 on its first line; null otherwise. Never by its 「경로 약속:」 line (every v4 chunk has one). */
// Recipe .45: v5 when the first line says 「기록 v5」 or a page head stands in the text.
export function recordVersion(text: string): RecordVersion | null {
  const first = text.trimStart().split(/\r?\n/, 1)[0] ?? '';
  if (/기록\s*v5/.test(first) || text.split(/\r?\n/).some(l => PAGE_HEAD.test(l.trim()))) return 'v5';
  if (/기록\s*v4/.test(first) || text.split(/\r?\n/).some(l => CHUNK_HEAD.test(l.trim()))) return 'v4';
  if (/현황\s*보고서\s*\(\s*v3\s*표\s*형식/.test(first) || /현황\s*보고서\s*\(\s*v3/.test(text.slice(0, 400))) return 'v3-status';
  if (/설계\s*기록/.test(first)) return 'v1-design';
  return null;
}
/** The chunk head a text's first nonblank line is, or null. */
export function chunkHead(text: string): ChunkHead | null {
  let offset = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (line) { const m = CHUNK_HEAD.exec(line); if (!m) return null; const from = offset + raw.indexOf(line); return { recordId: m[1]!, chunk: Number(m[2]), basis: m[3]!, title: m[4]!.trim(), from, to: from + line.length }; }
    offset += raw.length + 1;
  }
  return null;
}
/** The page heads a text holds (v5), in order, each with where its page runs to. */
export function pageHeads(text: string): PageHead[] {
  const out: PageHead[] = []; let offset = 0;
  for (const raw of text.split('\n')) {
    const line = raw.trim(), m = line ? PAGE_HEAD.exec(line) : null;
    if (m) {
      const from = offset + raw.indexOf(line), prev = /^\d/.test(m[4]!) ? Number(m[4]) : null;
      if (out.length) out.at(-1)!.end = from;
      out.push({ recordId: m[1]!, n: Number(m[2]), prev, basis: m[3]!, title: m[5]!.trim(), from, to: from + line.length, end: text.length });
    }
    offset += raw.length + 1;
  }
  return out;
}
/** A pasted answer split at its chunk heads (4.1) — recipe .45: and at its v5 page heads (one record per page): one text per chunk, each
 * from its head line; what stands before the first head goes with the first chunk. A text with no chunk or page head is one text. */
export function splitRecordChunks(text: string): string[] {
  const lines = text.split('\n'), heads = lines.flatMap((l, i) => CHUNK_HEAD.test(l.trim()) || PAGE_HEAD.test(l.trim()) ? [i] : []);
  if (heads.length < 2) return [text];
  return heads.map((h, k) => lines.slice(k === 0 ? 0 : h, heads[k + 1] ?? lines.length).join('\n').replace(/\s+$/, ''));
}
/** The focus line (K4): 「이번 기록의 초점: P2, P1 / 선택 이유 / P2-01·P2-02」, or 「초점: 없음 / 이유」. */
export function readFocus(line: string, from: number): RecordFocus | null {
  const m = FOCUS_LINE.exec(line.trim()); if (!m) return null;
  const body = m[1]!.trim(), spaced = body.split(/\s+\/\s+/), pieces = spaced.length >= 2 ? spaced : body.split(/\s*\/\s*/), head = pieces[0] ?? '';
  const none = /^(?:초점\s*[:：]\s*)?없음/.test(head), profiles = none ? [] : [...new Set(head.match(/P[1-6](?![-\d])/g) ?? [])];
  const tables = [...new Set((pieces.slice(2).join(' / ').match(/P[1-6]-0[1-9]/g) ?? []))];
  const at = from + line.indexOf(line.trim());
  return { profiles, reason: (pieces[1] ?? '').trim() || null, tables, none, text: line.trim(), from: at, to: at + line.trim().length };
}
/** The 경로 약속 line (K20): 「경로 약속: @4e1d9b2 · S = src · T = tests」: the first 「@sha」 entry as the basis, each alias with its path. */
export function readPromise(line: string, from: number): PathPromise | null {
  const at = line.search(PROMISE_LINE); if (at < 0) return null;
  const rest = line.slice(at).replace(/^경로\s*약속\s*[:：]/, ''), aliases = new Map<string, string>();
  let basis: string | null = null;
  for (const entry of rest.split(/\s+·\s+/)) {
    const e = entry.trim(), sha = /^@\s*([0-9A-Za-z._/-]{4,64})$/.exec(e);
    if (sha) { if (basis === null) basis = sha[1]!; continue; }
    const m = /^([A-Za-z][A-Za-z0-9]{0,3})\s*=\s*(\S.*)$/.exec(e); if (m && !aliases.has(m[1]!)) aliases.set(m[1]!, m[2]!.trim());
  }
  const t = line.trim(), start = from + line.indexOf(t);
  return { basis, aliases, text: t, from: start, to: start + t.length };
}

/** The columns of a table definition matched against a header row: each header cell's v4 column (exact, or a v3 name by V3_COLUMNS), the
 * definition's columns left out, and the header cells it does not define. */
function matchColumns(def: TableDef | null, header: readonly string[], dialect: 'v5' | 'v4' | 'v3'): { columns: (string | null)[]; missing: string[]; extra: string[] } {
  const wanted = new Map((def?.columns ?? []).map(c => [columnKey(c), c]));
  const columns = header.map(h => { const k = columnKey(h); return wanted.get(k) ?? (dialect === 'v3' ? V3_COLUMNS.get(k) ?? null : null); });
  const missing = def && dialect !== 'v3' ? def.columns.filter(c => !columns.includes(c)) : [];
  const extra = header.filter((h, i) => columns[i] === null && !!h.trim());
  return { columns, missing, extra };
}
const cache = new Map<string, RecordTables>();
/** A record's tables by their IDs (4.2): v4 title lines and v3 numbered headings open a table, the next table line is its header (or
 * 「없음:」 in its place), a nonblank line that is no table line after the header closes it (as every v3 reader read them). The focus line,
 * the 경로 약속 line, the chunk head and 「덩이 2는 「이어서」에」 are read wherever they stand. A table whose ID the reader does not know
 * (a v4 C-FOO or P7-01; a v3 heading the title map does not name) is kept as written with unknown-table; a v4 header's unknown column with
 * unknown-column and a left-out one with missing-column; a row past its header's width that 「||」 joining cannot fit with row-cells (it is
 * no data row then). */
export function readRecordTables(text: string): RecordTables {
  const hit = cache.get(text); if (hit) return hit;
  const tables: RecordTable[] = [], diagnostics: RecordDiagnostic[] = [];
  let open: RecordTable | null = null, closed = false, focus: RecordFocus | null = null, promise: PathPromise | null = null, awaitsNext = false, offset = 0;
  const version = recordVersion(text), chunk = chunkHead(text), pages = version === 'v5' ? pageHeads(text) : [];
  // Recipe .45: a v5 record reads its tables by the v5 definitions; every other record by the v4 ones (as .44 read them).
  const defs = version === 'v5' ? V5_TABLE_DEFS : TABLE_DEFS, titled: 'v5' | 'v4' = version === 'v5' ? 'v5' : 'v4';
  const declared: RecordTables['declared'] = [], nexts: RecordTables['nexts'] = [];
  let page = -1;
  for (const raw of text.split('\n')) {
    const start = offset; offset += raw.length + 1;
    const line = raw.trim();
    if (!line.startsWith('|')) {
      if (!line) continue;
      const lineFrom = start + raw.indexOf(line);
      if (version === 'v5' && PAGE_HEAD.test(line)) { page = pages.findIndex(p => p.from === lineFrom); open = null; closed = false; continue; }
      if (version === 'v5') {
        const lv = LEVEL_LINE.exec(line), nx = lv ? null : NEXT_LINE.exec(line);
        if (lv) { declared.push({ page, level: fixedWord(lv[1]!, LEVEL_WORDS)?.value ?? null, text: line, from: lineFrom, to: lineFrom + line.length }); closed = true; continue; }
        if (nx) { nexts.push({ page, text: nx[1]!.trim(), from: lineFrom, to: lineFrom + line.length }); closed = true; continue; }
      }
      focus ??= readFocus(raw, start); if (!promise && PROMISE_LINE.test(line)) promise = readPromise(raw, start);
      if (LATER_LINE.test(line)) awaitsNext = true;
      // A v4 record titles its tables by ID; a numbered line in it is no v3 heading.
      const title = CHUNK_HEAD.test(line) ? null : TITLE_LINE.exec(line), heading = title || version === 'v4' || version === 'v5' ? null : V3_HEADING.exec(line);
      if (title || heading) {
        const id = title ? title[1]! : v3TableId(heading![1]!);
        const known = !!id && (defs.has(id) || id === PARTTYPE_TABLE);
        open = { id: id ?? `?${tables.length + 1}`, title: (title ? title[2]! : heading![1]!).trim(), dialect: title ? titled : 'v3', known, header: [], columns: [], missing: [], extra: [], rows: [], none: null, from: lineFrom, to: lineFrom + line.length, body: [], page };
        tables.push(open); closed = false; continue;
      }
      if (!open || closed) continue;
      if (!open.header.length) {
        const none = NONE_LINE.exec(line);
        if (none && !open.none) { open.none = { text: none[1]!.trim(), from: lineFrom, to: lineFrom + line.length }; open.to = lineFrom + line.length; closed = true; continue; }
        // A table that is no table (C-SUMMARY, a v3 「1. 한 줄 요약」) keeps its lines as its body.
        open.body.push({ text: line, from: lineFrom, to: lineFrom + line.length }); open.to = lineFrom + line.length; continue;
      }
      closed = true; continue;
    }
    if (!open || closed) continue;
    const lineFrom = start + raw.indexOf(line);
    if (!open.header.length) {
      const cells = splitCells(raw, start);
      open.header = cells.map(c => c.text);
      const def = defs.get(open.id) ?? null, m = matchColumns(def, open.header, open.dialect);
      open.columns = m.columns; open.missing = m.missing; open.extra = m.extra; open.to = lineFrom + line.length;
      if (open.dialect !== 'v3') {
        if (!open.known) diagnostics.push({ rule: 'contract', category: 'unknown-table', table: open.id, column: null, from: open.from, to: open.to });
        else {
          for (const c of m.extra) diagnostics.push({ rule: 'contract', category: 'unknown-column', table: open.id, column: c.slice(0, 40), from: lineFrom, to: lineFrom + line.length });
          for (const c of m.missing) diagnostics.push({ rule: 'contract', category: 'missing-column', table: open.id, column: c, from: lineFrom, to: lineFrom + line.length });
        }
      }
      continue;
    }
    const got = rowCells(raw, start, open.header.length);
    if (isRule(got.cells)) continue;
    open.to = lineFrom + line.length;
    if (got.over) { diagnostics.push({ rule: 'contract', category: 'row-cells', table: open.id, column: null, from: lineFrom, to: lineFrom + line.length }); continue; }
    const byColumn: Record<string, string> = {}, extra: Record<string, string> = {};
    open.header.forEach((h, i) => { const c = got.cells[i]?.text ?? '', k = open!.columns[i]; if (k) { if (!(k in byColumn)) byColumn[k] = c; } else if (h.trim()) extra[h] = c; });
    open.rows.push({ from: lineFrom, to: lineFrom + line.length, cells: got.cells, byColumn, extra });
  }
  // A v3 heading the title map does not name, holding table rows: kept, said once.
  for (const t of tables) if (!t.known && t.dialect === 'v3' && t.rows.length) diagnostics.push({ rule: 'contract', category: 'unknown-table', table: null, column: null, from: t.from, to: t.to });
  if (version === 'v4' && !chunk) diagnostics.push({ rule: 'contract', category: 'chunk-head', table: null, column: null, from: 0, to: Math.max(1, Math.min(text.length, (text.split('\n')[0] ?? '').length)) });
  if (version === 'v5' && !pages.length) diagnostics.push({ rule: 'contract', category: 'page-head', table: null, column: null, from: 0, to: Math.max(1, Math.min(text.length, (text.split('\n')[0] ?? '').length)) });
  const byId = new Map<string, RecordTable[]>();
  for (const t of tables) byId.set(t.id, [...byId.get(t.id) ?? [], t]);
  const out: RecordTables = { version, chunk, tables, byId, focus, promise, awaitsNext, diagnostics, pages, page: pages[0] ?? null, declared, nexts };
  if (cache.size > 256) cache.delete(cache.keys().next().value!);
  cache.set(text, out);
  return out;
}

/* ---------- The one entry for the program's passes (4.2 rowsOf). ---------- */
/** A data row as the passes read it: its record, table and place; its cells and header as the v3 passes read them (the v4 columns a
 * v3 pass names under their v3 names: C-STEP's 부분 이름 from its 행 ID B03:S02, C-RULE without who decided and what keeps it, C-PART
 * without its 행 ID, C-DATA's 있는 곳 without its 쓰기 방식), and its cells by column. */
/* Recipe .45: a v5 row (dialect 'v5') is one of its record's folded current rows (foldPages); its byColumn is the v4 view of it (the
 * v4 column names, a 「부분」 cell's B IDs read as the parts' names, a 담당 F's F IDs as their paths, C-LINK's 설계/관찰 from its 주장 성격 and
 * cites, C-LOOP's 몸통 단계 ID from the C-STEP rows that name the loop, C-SRC as C-FILES), so every v4 pass reads it as it reads a v4 row;
 * its own cells stay on row (row.byColumn) and fold. */
export interface TableRow { record: string; id: string; dialect: 'v5' | 'v4' | 'v3'; from: number; to: number; cells: string[]; header: string[];
  byColumn: Readonly<Record<string, string>>; row: RecordRow; table: RecordTable; fold?: FoldRow; folded?: FoldedRecord }
type Texts = Iterable<[string, { text: string }]>;
const rowsCache = new WeakMap<object, Map<string, TableRow[]>>();
/** A record group's own references (4.4 ID 약속): a part's 행 ID (B03) → its name, by recordId (a chunk head's), else by record. */
export interface RecordRefs { parts: Map<string, string>; group: string }
const groupOf = (record: string, t: RecordTables): string => t.page ? `v5:${t.page.recordId}@${t.page.basis}` : t.chunk ? `id:${t.chunk.recordId}` : `record:${record}`;
export function recordRefs(texts: Texts): Map<string, RecordRefs> {
  const byGroup = new Map<string, Map<string, string>>(), out = new Map<string, RecordRefs>();
  const list = [...texts], all = list.map(([record, { text }]) => [record, readRecordTables(text)] as const);
  for (const f of foldPages(list.map(([record, { text }]) => ({ record, text })), 'newest-first')) {
    const parts = new Map<string, string>(); byGroup.set(`v5:${f.key}`, parts);
    for (const r of f.rows.get('C-PART') ?? []) { const name = (r.row.byColumn['이름'] ?? '').trim(); if (name) parts.set(r.id, name); }
  }
  for (const [record, t] of all) {
    const g = groupOf(record, t), parts = byGroup.get(g) ?? new Map<string, string>(); byGroup.set(g, parts);
    for (const table of t.byId.get('C-PART') ?? []) if (table.dialect === 'v4') for (const r of table.rows) {
      const id = (r.byColumn['행 ID'] ?? '').trim(), name = (r.byColumn['이름'] ?? '').trim();
      if (/^B\d{1,3}$/.test(id) && name && !parts.has(id)) parts.set(id, name);
    }
  }
  for (const [record, t] of all) { const g = groupOf(record, t); out.set(record, { parts: byGroup.get(g)!, group: g }); }
  return out;
}
/** A v4 step's 행 ID: its part (B03) and step (S02, a branch S04a: group S04, branch a). */
export const STEP_REF = /^(B\d{1,3}):S(\d{1,3})([a-z])?$/;
const stripMode = (where: string): string => where.replace(/\s*[(（](?:덧붙임|통째\s*교체|원자\s*교체)[^)）]*[)）]\s*$/, '').trim();
/** The v3 view of a v4 row (see TableRow). */
function v3View(id: string, row: RecordRow, header: readonly string[], refs: RecordRefs | undefined): { cells: string[]; header: string[] } {
  const c = row.byColumn, raw = row.cells.map(x => x.text);
  if (id === 'C-STEP') {
    const ref = STEP_REF.exec((c['행 ID'] ?? '').trim()), part = ref ? refs?.parts.get(ref[1]!) ?? '' : '';
    return { header: ['부분 이름', '순번', '단계 이름', '하는 일 한 줄', '쓰는 파일·함수·모델', '조건·분기', '꼬리표'],
      cells: [part, ref ? `${Number(ref[2])}${ref[3] ?? ''}` : '', c['단계 이름'] ?? '', c['하는 일 한 줄'] ?? '', c['쓰는 파일·함수'] ?? '', c['조건·분기'] ?? '', c['근거'] ?? ''] };
  }
  if (id === 'C-RULE') return { header: ['부분', '규칙 한 줄', '근거'], cells: [c['부분'] ?? '', c['규칙 한 줄'] ?? '', c['근거'] ?? ''] };
  const keep = header.map((h, i) => i).filter(i => !(id === 'C-PART' && columnKey(header[i]!) === '행 ID'));
  return { header: keep.map(i => header[i]!), cells: keep.map(i => id === 'C-DATA' && columnKey(header[i]!) === '있는 곳·쓰기 방식' ? stripMode(raw[i] ?? '') : raw[i] ?? '') };
}
/** The data rows of every table of the given IDs in the records, in record order (4.2 rowsOf; the v3 passes' rowsUnder). */
export function rowsOf(texts: Texts & object, ids: readonly string[]): TableRow[] {
  const key = ids.join('|'); let memo = rowsCache.get(texts);
  const hit = memo?.get(key); if (hit) return hit;
  const want = new Set(ids), refs = ids.includes('C-STEP') ? recordRefs(texts) : undefined, out: TableRow[] = [];
  for (const [record, { text }] of texts) for (const table of readRecordTables(text).tables) {
    // Recipe .45: a v5 table is read through its folded record (below), never row by row here.
    if (!want.has(table.id) || table.dialect === 'v5') continue;
    for (const row of table.rows) {
      const view = table.dialect === 'v4' ? v3View(table.id, row, table.header, refs?.get(record)) : { cells: row.cells.map(x => x.text), header: table.header };
      out.push({ record, id: table.id, dialect: table.dialect, from: row.from, to: row.to, cells: view.cells, header: view.header, byColumn: row.byColumn, row, table });
    }
  }
  // Recipe .45: every v5 record's current rows of those tables (C-FILES is C-SRC), each in its v4 view.
  const v5refs = refs ?? recordRefs(texts);
  for (const f of foldPages([...texts].map(([record, { text }]) => ({ record, text })), 'newest-first')) for (const id of ids) {
    const source = id === 'C-FILES' ? 'C-SRC' : id;
    for (const r of f.rows.get(source) ?? []) {
      const view = v5View(f, r), header = [...(TABLE_DEFS.get(id)?.columns ?? Object.keys(view))];
      const row: RecordRow = { from: r.row.from, to: r.row.to, byColumn: view, extra: {}, cells: header.map(h => ({ text: view[h] ?? '', raw: view[h] ?? '', from: r.row.from, to: r.row.to })) };
      const v3 = v3View(id, row, header, v5refs.get(r.record));
      out.push({ record: r.record, id, dialect: 'v5', from: r.row.from, to: r.row.to, cells: v3.cells, header: v3.header, byColumn: view, row, table: r.source, fold: r, folded: f });
    }
  }
  if (!memo) { memo = new Map(); rowsCache.set(texts, memo); }
  memo.set(key, out); return out;
}
/** The v4 type word of a v5 role whose type is clear (ROLE_TYPES), for the v4 passes; '' for any other role. */
const V4_WORD_OF: Readonly<Record<string, string>> = { person: '사람', external: '외부 시스템', session: '세션', store: '행 파일·저장소', ai: 'AI 판단', timer: '타이머·일정', compute: '계산',
  collector: '수집기', actor: '집행·외부 호출', screen: '화면', automation: '빌드·배포 자동화' };
export const roleType = (cell: string): string | null => { const f = readFamily(cell); return f.ok && f.role ? fixedWord(f.role, ROLE_TYPES)?.value ?? null : null; };
/** A v5 row read as a v4 row (see TableRow): B IDs in a cell as their parts' names (「B07: 통로」 as 「푸시 발송기: 통로」), F IDs as paths. */
export function v5View(f: FoldedRecord, r: FoldRow): Record<string, string> {
  const c = r.row.byColumn, nameOf = (id: string) => (f.byId.get(id)?.table === 'C-PART' ? (f.byId.get(id)!.row.byColumn['이름'] ?? '').trim() : '') || id;
  const names = (cell: string | undefined) => (cell ?? '').replace(/(?<![A-Za-z0-9])B\d{1,3}(?!\d)(?!:[SL]\d)/g, id => nameOf(id));
  const paths = (cell: string | undefined) => (cell ?? '').replace(/(?<![A-Za-z0-9])F\d{1,3}(?!\d)/g, id => f.ledger.files.get(id)?.path || id);
  const base: Record<string, string> = { ...c };
  switch (r.table) {
    case 'C-PART': { const t = roleType(c['표현군·역할'] ?? ''); return { 이름: c['이름'] ?? '', 유형: t ? V4_WORD_OF[t] ?? '' : '', '하는 일 한 줄': c['하는 일 한 줄'] ?? '', '담당 파일·폴더': paths(c['담당 F']).replace(/\s*\+\s*/g, '·'), '구현 상태': c['구현 상태'] ?? '', '행 ID': r.id, 근거: c['근거'] ?? '', '표현군·역할': c['표현군·역할'] ?? '' }; }
    case 'C-GROUP': {
      const list = fixedWord(c['묶음 뜻'] ?? '', GROUP_WORDS)?.value === 'members';
      const kids = list ? (c['자식들'] ?? '').split(/\s*·\s*(?=B\d{1,3}\s*:)|\s+·\s+/).map(x => x.replace(/^B\d{1,3}\s*:\s*/, '').trim()).filter(Boolean).join('·') : names(c['자식들']);
      return { '부모 이름': names(c['부모']), '자식 이름들': kids, '묶음 뜻': c['묶음 뜻'] ?? '', 근거: c['근거'] ?? '', '행 ID': r.id };
    }
    case 'C-LINK': {
      const nature = fixedWord(c['주장 성격'] ?? '', NATURE_WORDS)?.value ?? null;
      // 12.2: observed only when the line claims a run seen and cites a run-grade E; defined relations are designs.
      const mode = nature === 'defined' ? '설계' : nature === 'run-observed' && r.cites.some(x => x.grade === 'run') ? '관찰' : '';
      return { ...base, '보내는 부분': names(c['보내는 부분']), '받는 부분': names(c['받는 부분']), '설계/관찰': mode };
    }
    case 'C-LOOP': {
      const body = (f.rows.get('C-STEP') ?? []).filter(s => loopRefs(s.row.byColumn['소속 반복']).includes(r.id)).map(s => s.id);
      return { ...base, '소유 부분': names(c['소유 부분']), '부모 반복 ID': c['부모 반복'] ?? '', '몸통 단계 ID': body.join(' ') };
    }
    case 'C-STEP': return { ...base, '쓰는 파일·함수': paths(c['쓰는 함수']), '소속 반복 ID': c['소속 반복'] ?? '' };
    case 'C-DATA': {
      const shared = /^\s*공유\s*[:：]\s*(.+)$/.exec(c['만드는 부분'] ?? '') ?? /^\s*공유\s*[:：]\s*(.+)$/.exec(c['읽는 부분'] ?? '');
      return shared ? { ...base, '만드는 부분': '', '읽는 부분': '', '공유 부분': names(shared[1]) } : { ...base, '만드는 부분': names(c['만드는 부분']), '읽는 부분': names(c['읽는 부분']) };
    }
    case 'C-STATUS': return { ...base, 대상: names(c['대상']) };
    case 'C-CHANGE': {
      const actor = said5(c['관련 주체·역할']) ?? (f.head.get('기본 행위자')?.row.byColumn['값'] ?? '');
      return { ...base, '바뀐 부분': names(c['바뀐 부분']), '관련 주체·역할': actor };
    }
    case 'C-ENTRY': return { ...base, '소유 부분': names(c['소유 부분']), '소비자·호출 주체': names(c['소비자·호출 주체']) };
    case 'C-VARIANT': return { ...base, '구현 부분': names(c['구현 부분']) };
    case 'C-CONTRACT': return { ...base, '제공 부분': names(c['제공 부분']), '외부 소비자': names(c['외부 소비자']) };
    case 'C-SRC': {
      const role = said5(c['역할']) ?? '', unread = fixedWord(c['읽음'] ?? '', READ_WORDS)?.value === 'unread', run = /\(\s*실행\s*시\s*\)/.test(role);
      return { 경로: `${c['경로'] ?? ''}${run ? ' (실행 시)' : ''}`, '속한 부분': names(c['속한 부분']), '역할 한 줄': `${role.replace(/\s*\(\s*실행\s*시\s*\)/, '')}${unread ? ' (이번에 안 읽음)' : ''}`.trim(), 근거: '' };
    }
    default: {
      if ('부분' in c) base['부분'] = names(c['부분']);
      if (/^P\d-\d{2}$/.test(r.table)) for (const [k, v] of Object.entries(c)) if (k !== '행 ID' && k !== '근거') base[k] = names(v);
      return base;
    }
  }
}
/** The same for plain texts (the record's own text, with no alias): each by its index. */
export const rowsOfTexts = (texts: Iterable<string>, ids: readonly string[]): TableRow[] => rowsOf([...texts].map((text, i) => [`#${i}`, { text }] as [string, { text: string }]), ids);

/* ---------- The fixed values of the v4 columns (2.3, 3.1), for the parser and the paste check. ---------- */
export const IMPLEMENTATION_WORDS: Readonly<Record<string, 'built' | 'partial' | 'unbuilt' | 'removed' | 'unknown' | null>> = Object.freeze({ 구현됨: 'built', '일부 구현': 'partial', 미구현: 'unbuilt', 제거됨: 'removed', 모름: 'unknown', '해당 없음': null });
// v4.1: 봇 (a dependency or review bot) is an outside system that acts on the repository.
export const TYPE_WORDS: Readonly<Record<string, string | null>> = Object.freeze({ 사람: 'person', 봇: 'external', 세션: 'session', '루프·엔진': 'loop', '행 파일·저장소': 'store', 'AI 판단': 'ai', '타이머·일정': 'timer',
  계산: 'compute', 수집기: 'collector', '집행·외부 호출': 'actor', 화면: 'screen', '빌드·배포 자동화': 'automation', '외부 시스템': 'external', 모름: null });
export const GROUP_WORDS: Readonly<Record<string, 'place' | 'composition' | 'participants' | 'boundary' | 'members' | null>> = Object.freeze({ '실행 위치': 'place', 구성: 'composition', 참여자: 'participants', 외부: 'boundary', 목록: 'members', 모름: null });
export const CADENCE_WORDS: Readonly<Record<string, 'once' | 'call' | 'each' | 'periodic' | 'event' | 'end'>> = Object.freeze({ '한 번': 'once', 호출마다: 'call', 항목마다: 'each', 주기: 'periodic', '사건 때': 'event',
  // Recipe .46: a person hands it over at a time no code fixes (a file a person passes on): an event, said in the record's own words.
  '사람이 할 때': 'event', '끝에 한 번': 'end' });
export const CROSS_WORDS: Readonly<Record<string, 'same' | 'child' | 'process' | 'network' | 'person' | null>> = Object.freeze({ '같은 프로세스': 'same', '자식 프로세스': 'child', '프로세스 사이': 'process', 네트워크: 'network', 사람: 'person', 모름: null });
export const STATUS_DIMENSIONS: Readonly<Record<string, 'release' | 'deploy' | 'activation' | 'maintenance' | 'operation'>> = Object.freeze({ 릴리스: 'release', 배포: 'deploy', '활성 방식': 'activation', '유지 방침': 'maintenance', '운영 상태': 'operation' });
export const STATUS_VALUES: Readonly<Record<'release' | 'deploy' | 'activation' | 'maintenance' | 'operation', Readonly<Record<string, string>>>> = Object.freeze({
  // v4.1: 릴리스 없음 (never released, by a record saying so).
  release: { 릴리스됨: 'released', 미릴리스: 'unreleased', 회수됨: 'recalled', '릴리스 없음': 'never', 모름: 'unknown' },
  deploy: { 배포됨: 'deployed', 미배포: 'undeployed', 철회됨: 'withdrawn', 모름: 'unknown' },
  activation: { '항상 적용': 'always', 조건부: 'conditional', 비활성: 'inactive', 모름: 'unknown' },
  maintenance: { '기능 개발': 'active', 수정만: 'fixes', '사용 중단 권고': 'deprecated', '유지 종료': 'ended', 모름: 'unknown' },
  operation: { '실행 중': 'running', '유휴·대기': 'idle', 정지: 'stopped', 실패: 'failed', 모름: 'unknown' } });
export const DEVICE_WORDS: Readonly<Record<string, 'code' | 'gate' | 'person' | 'none' | 'unknown'>> = Object.freeze({ 코드: 'code', 검사: 'gate', 사람: 'person', 없음: 'none', 모름: 'unknown' });
export const ENTRY_WORDS: Readonly<Record<string, 'command' | 'call' | 'request' | 'message' | 'schedule' | 'resident' | 'script'>> = Object.freeze({ 명령: 'command', '함수·클래스 호출': 'call', 'HTTP·WS 요청': 'request',
  '메시지·사건': 'message', 일정: 'schedule', 상주: 'resident', '손으로 돌리는 스크립트': 'script' });
export const TOGETHER_WORDS: Readonly<Record<string, 'exclusive' | 'combined' | 'unknown'>> = Object.freeze({ 배타: 'exclusive', '병용 가능': 'combined', 모름: 'unknown' });
export const SELECT_WORDS: Readonly<Record<string, 'given' | 'first-available' | 'fallback'>> = Object.freeze({ 지정: 'given', '우선순위로 첫 가능 항목': 'first-available', '실패하면 다음': 'fallback' });
export const DONE_WORDS: Readonly<Record<string, 'done' | 'partial' | 'na' | 'unchecked' | 'deferred'>> = Object.freeze({ '작성 완료': 'done', '일부 작성': 'partial', '해당 없음': 'na', '확인 못함': 'unchecked', '분량상 이월': 'deferred' });
export const DATA_WORDS: Readonly<Record<string, 'contract' | 'internal' | 'store' | 'message'>> = Object.freeze({ '외부 계약': 'contract', '내부 자료': 'internal', 저장: 'store', '메시지·신호': 'message' });
export const WRITE_WORDS: Readonly<Record<string, 'append' | 'replace' | 'atomic'>> = Object.freeze({ 덧붙임: 'append', '통째 교체': 'replace', '원자 교체': 'atomic' });
export const WITHDRAW_WORDS: Readonly<Record<string, 'revert' | 'remove' | 'deprecate' | 'move' | 'default' | 'rejected' | 'reintroduce'>> = Object.freeze({ 되돌림: 'revert', 제거: 'remove', '폐기 예정': 'deprecate', 옮김: 'move', '기본값 바꿈': 'default', '채택 안 함': 'rejected', '다시 도입': 'reintroduce' });
export const PHASE_WORDS: Readonly<Record<string, 'run' | 'config' | 'build'>> = Object.freeze({ '실행 시': 'run', '설정 읽을 때': 'config', '빌드·컴파일 시': 'build' });
export const ROLE_WORDS: Readonly<Record<string, 'request' | 'propose' | 'author' | 'review' | 'merge'>> = Object.freeze({ 요청: 'request', 제안: 'propose', 작성: 'author', '검토·승인': 'review', 병합: 'merge' });
/** A cell's fixed word (loosely compared: spacing and middle-dot variants), from the start of the cell; the word, its value and what
 * follows it (a parenthesised range, 「(후속: …)」), or null for a cell outside the list. */
export function fixedWord<V>(cell: string, words: Readonly<Record<string, V>>): { word: string; value: V; rest: string } | null {
  const c = columnKey(cell);
  const best = Object.keys(words).map(w => [w, columnKey(w)] as const).filter(([, k]) => c === k || c.startsWith(`${k}(`) || c.startsWith(`${k} `) || c.startsWith(`${k}:`)).sort((a, b) => b[1].length - a[1].length)[0];
  return best ? { word: best[0], value: words[best[0]]!, rest: c.slice(best[1].length).trim() } : null;
}

/* ==================== Recipe .45: the 기록 요청 v5 (RECORD_ASKS_V5_KO.md; sections 12 and 13 over the earlier ones) ====================
 * The words of the v5 columns, the ledgers a row's 근거 cites (F files, E pieces of evidence; explicit IDs only, no 「=」), and the fold of
 * a record's pages into its current rows: pages keyed by (record ID, page number), the same text again changes nothing, another text for
 * the same key is a conflict (the first stays, the person is asked), rows replaced (교체·정정) or deleted (C-DROP) by ID, an ID written again
 * without 교체 kept as written with duplicate-id (the first stands), reservations, out-of-order tables recorded with their rows kept (12.1),
 * a missing page stopping the fold there, a changed basis sha another record. The app computes the record's level and its remaining
 * obligations itself (12.1); the author's 완료 단계 is compared, never believed. Nothing here calls a model. */

/* ---------- The fixed words of the v5 columns (8.1, 12, 13). ---------- */
export type PartFamily = 'participant' | 'process' | 'store' | 'trigger' | 'gate';
/** C-PART 표현군 (3.1): five families and 미정 (null). */
export const FAMILY_WORDS: Readonly<Record<string, PartFamily | null>> = Object.freeze({ 참여: 'participant', 처리: 'process', 저장: 'store', 촉발: 'trigger', 관문: 'gate', 미정: null });
/** 미정's reasons (3.2). */
export const UNDECIDED_WORDS: Readonly<Record<string, 'thin' | 'mixed' | 'scope'>> = Object.freeze({ '책임 설명 부족': 'thin', '서로 다른 역할 혼재': 'mixed', '대상 범위 불명확': 'scope' });
/** The role words whose part type (the card glyph's word) is clear; any other role gives no type (8.4, 12.3). */
export const ROLE_TYPES: Readonly<Record<string, string>> = Object.freeze({ 사람: 'person', 소유자: 'person', 메인테이너: 'person', 기여자: 'person', 방문자: 'person', 사용자: 'person',
  운영자: 'person', 관리자: 'person', 봇: 'external', '외부 시스템': 'external', '사용자 코드': 'external', 'AI 세션': 'session', 세션: 'session', 계산: 'compute', 변환: 'compute',
  수집: 'collector', 수집기: 'collector', 'AI 판단': 'ai', 화면: 'screen', '외부 호출': 'actor', '행 파일': 'store', 'DB 테이블': 'store', '메모리 등록부': 'store', 캐시: 'store',
  체크포인트: 'store', 타이머: 'timer', 일정: 'timer', '빌드·배포 자동화': 'automation' });
/** A v4 C-PART 유형 word read as a family and role (3.3 as 12.3 narrows it): only the unambiguous words; 루프·엔진, 봇, 외부 시스템 and
 * 집행·외부 호출 keep their word, marked 대응 불명확 (null here); 모름 and an empty cell give nothing (absent). */
export const V4_TYPE_FAMILY: Readonly<Record<string, { family: PartFamily; role: string } | null>> = Object.freeze({ 사람: { family: 'participant', role: '사람' },
  세션: { family: 'participant', role: 'AI 세션' }, 계산: { family: 'process', role: '계산' }, 수집기: { family: 'process', role: '수집' }, 'AI 판단': { family: 'process', role: 'AI 판단' },
  화면: { family: 'process', role: '화면' }, '행 파일·저장소': { family: 'store', role: '행 파일' }, '타이머·일정': { family: 'trigger', role: '타이머' },
  '빌드·배포 자동화': { family: 'trigger', role: '빌드·배포 자동화' }, '루프·엔진': null, 봇: null, '외부 시스템': null, '집행·외부 호출': null });
/** C-END 상태 (1.2) and a supplementary page's group state (1.4). */
export type EndState = 'done' | 'cont' | 'pending' | 'na' | 'unchecked';
export const END_WORDS: Readonly<Record<string, EndState>> = Object.freeze({ 끝남: 'done', 이어짐: 'cont', 아직: 'pending', '해당 없음': 'na', '확인 못함': 'unchecked' });
export const SUPPLEMENT_WORDS: Readonly<Record<string, 'written' | 'na' | 'unsurveyed' | 'followup'>> = Object.freeze({ 썼음: 'written', '해당 없음': 'na', 미조사: 'unsurveyed', '후속 필요': 'followup' });
/** C-CHECK 결과 (5.2). */
export const CHECK_WORDS: Readonly<Record<string, 'yes' | 'no' | 'unchecked'>> = Object.freeze({ 있음: 'yes', 없음: 'no', '확인 못함': 'unchecked' });
/** C-EVID 등급 (2.3) and C-SRC 읽음 (2.2). */
export const GRADE_WORDS: Readonly<Record<string, 'file' | 'run' | 'report'>> = Object.freeze({ 파일: 'file', 실행: 'run', 보고: 'report' });
export const READ_WORDS: Readonly<Record<string, 'read' | 'partial' | 'unread'>> = Object.freeze({ 읽음: 'read', 일부: 'partial', '안 읽음': 'unread' });
/** C-CHANGE 찾은 길 (5.1). */
export const FOUND_WORDS: Readonly<Record<string, 'search' | 'recent' | 'changelog'>> = Object.freeze({ 검색: 'search', 최근: 'recent', '변경 기록': 'changelog' });
/** C-LINK 주장 성격 (12.2): what the line claims, apart from the grade of its evidence. */
export type ClaimNature = 'defined' | 'run-report' | 'run-observed' | 'guess';
export const NATURE_WORDS: Readonly<Record<string, ClaimNature>> = Object.freeze({ '정의된 관계': 'defined', '실행 보고': 'run-report', '실행 관측': 'run-observed', 추정: 'guess' });
/** v5 only (a v4 record reads these cells as .44 did): 문서로만 폐기 (5.1) and a variant chosen per data (13.4). */
export const WITHDRAW_WORDS_V5: Readonly<Record<string, string>> = Object.freeze({ ...WITHDRAW_WORDS, '문서로만 폐기': 'doc-only' });
export const TOGETHER_WORDS_V5: Readonly<Record<string, string>> = Object.freeze({ ...TOGETHER_WORDS, 자료마다: 'per-data' });
/** C-STATUS 적용 범위 for a part only partly off (13.2): 「기능 일부(이름)」 / 「기본 꺼짐(켜는 설정)」. */
export const SCOPE_WORDS: Readonly<Record<string, 'feature' | 'default-off'>> = Object.freeze({ '기능 일부': 'feature', '기본 꺼짐': 'default-off' });
/** C-CHECK's six rows (5.2, 12.6, 13.5). */
export const CHECK_ROWS: Readonly<Record<string, string>> = Object.freeze({ CK1: '시간·배경 실행', CK2: '정지·취소 경로', CK3: '사람 관문', CK4: '사람 역할 분리', CK5: '이력 검색', CK6: '폴더 하나 = 부분 하나' });
/** C-HEAD's items (2.1, 12.6). */
export const HEAD_ITEMS = Object.freeze(['기준 커밋', '작성 시각', '읽은 범위', '못 읽은 범위', '클론', '실린 판본', '기본 행위자', '첫 구조 줄'] as const);

/** A C-PART 표현군·역할 cell: 「처리 · 실행 조정」, 「미정 · 서로 다른 역할 혼재(처리·저장)」. ok: the family is one of the fixed words. */
export interface FamilyCell { word: string | null; family: PartFamily | null; role: string | null; reason: 'thin' | 'mixed' | 'scope' | null; ok: boolean }
export function readFamily(cell: string): FamilyCell {
  const t = cell.replace(/\[[^\]]*\]/g, ' ').replace(/\s+/g, ' ').trim();
  const m = /^(참여|처리|저장|촉발|관문|미정)(?:\s*[·:：\-—]\s*(.*))?$/.exec(t);
  if (!m) return { word: null, family: null, role: null, reason: null, ok: false };
  const rest = (m[2] ?? '').trim() || null, undecided = m[1] === '미정';
  return { word: m[1]!, family: FAMILY_WORDS[m[1]!] ?? null, role: undecided ? null : rest, reason: undecided && rest ? fixedWord(rest, UNDECIDED_WORDS)?.value ?? null : null, ok: true };
}

/* ---------- The ledgers and a row's cites (2.2–2.5 as 12.2 amends them). ---------- */
export type CiteGrade = 'file' | 'run' | 'report' | 'guess' | 'unknown';
/** One cite of a row's 근거 cell, resolved against the ledgers: the grade is the ledger's (never merged across cites, 2.5). */
export interface Cite { ref: string; grade: CiteGrade; source: string | null; place: string | null; quote: string | null }
export interface LedgerFile { id: string; path: string; part: string | null; read: 'read' | 'partial' | 'unread' | null; role: string | null; record: string; from: number; to: number }
export interface LedgerEvidence { id: string; grade: 'file' | 'run' | 'report' | null; source: string | null; place: string | null; quote: string | null; record: string; from: number; to: number;
  /** A replaced E (12.5): the entry it replaced and the rows that cited it. */
  previous: { grade: string | null; source: string | null; quote: string | null; citedBy: string[] } | null }
export interface Ledger { files: ReadonlyMap<string, LedgerFile>; evidence: ReadonlyMap<string, LedgerEvidence> }
export interface CiteProblem { kind: 'cite-missing' | 'cite-equals' | 'cite-unread' | 'cite-word'; ref: string }
/** A run's source is the read command this conversation ran (2.3, 2.5 rule 2). Review N1: a read command's word first (git, rg, grep, ls,
 * cat, sed, wc, find, head, tail, a PowerShell Get-* or Select-String, node -e, python -c), after any 「VAR=value」 settings, or a command
 * written in backticks; 「commit 3f2a1b」, 「changelog 2026-10」 or 「issue 12」 are no command (a report). */
const READ_COMMAND = /^(?:[A-Z_][A-Z0-9_]*=\S*\s+)*(?:(?:git|rg|grep|ls|cat|sed|wc|find|head|tail)(?:\s|$)|Get-[A-Za-z]+\b|Select-String\b|node\s+-e\b|python3?\s+-c\b)/;
export const commandLike = (s: string): boolean => { const t = s.trim(); return READ_COMMAND.test(t) || /^`[^`\n]+`/.test(t); };
const said5 = (s: string | undefined): string | null => { const t = (s ?? '').trim(); return !t || /^[—–-]+$/.test(t) ? null : t; };
/** The cites of a 근거 cell (2.4 as 12.2): explicit F and E IDs joined by 「+」, 추정 or 추정(F03), 모름, and v4's bracket tags. 「=」 is no
 * cite (cite-equals); an ID the ledgers do not hold is none (cite-missing); a file the ledger marks 안 읽음 is cited with grade unknown
 * (cite-unread); any other word is none (cite-word). Each cite keeps its own grade. */
export function readCites(cell: string, ledger: Ledger): { cites: Cite[]; problems: CiteProblem[] } {
  const cites: Cite[] = [], problems: CiteProblem[] = [];
  const tagGrade: Readonly<Record<string, CiteGrade>> = { 파일: 'file', 보고: 'report', 실행: 'run', 추정: 'guess', 모름: 'unknown' };
  for (const m of cell.matchAll(/\[(파일|보고|실행|추정|모름)(?:\s*[:：]\s*([^\]]*))?\]/g)) cites.push({ ref: `[${m[1]}]`, grade: tagGrade[m[1]!]!, source: said5(m[2]), place: null, quote: null });
  if (/\[=\]/.test(cell)) problems.push({ kind: 'cite-equals', ref: '=' });
  for (const raw of cell.replace(/\[[^\]]*\]/g, ' ').split('+')) {
    const t = raw.trim();
    if (!t || /^[—–-]+$/.test(t)) continue;
    if (t === '=') { problems.push({ kind: 'cite-equals', ref: '=' }); continue; }
    if (/^F\d{1,3}$/.test(t)) {
      const f = ledger.files.get(t);
      if (!f) problems.push({ kind: 'cite-missing', ref: t });
      else if (f.read === 'unread') { cites.push({ ref: t, grade: 'unknown', source: f.path, place: null, quote: null }); problems.push({ kind: 'cite-unread', ref: t }); }
      else cites.push({ ref: t, grade: 'file', source: f.path, place: null, quote: null });
      continue;
    }
    if (/^E\d{1,3}$/.test(t)) {
      const e = ledger.evidence.get(t);
      if (!e || !e.grade) problems.push({ kind: 'cite-missing', ref: t }); else cites.push({ ref: t, grade: e.grade, source: e.source, place: e.place, quote: e.quote });
      continue;
    }
    const guess = /^추정\s*(?:[(（]\s*([^)）]*?)\s*[)）])?$/.exec(t);
    if (guess) { cites.push({ ref: '추정', grade: 'guess', source: said5(guess[1]), place: null, quote: null }); continue; }
    if (t === '모름') { cites.push({ ref: '모름', grade: 'unknown', source: null, place: null, quote: null }); continue; }
    problems.push({ kind: 'cite-word', ref: t.slice(0, 20) });
  }
  return { cites, problems };
}

/* ---------- IDs, ranges and reservations (4.1, 4.2, 1.2). ---------- */
const ID_PATTERN: Readonly<Record<string, RegExp>> = { B: /^B\d{1,3}$/, S: /^B\d{1,3}:S\d{1,3}[a-z]?$/, L: /^B\d{1,3}:L\d{1,3}$/, P: /^P\d-\d{2}\.\d{1,3}$/, CK: /^CK\d{1,2}$/ };
/** The row IDs a v5 table takes (C-PART B03, C-STEP B03:S02 or B03:S04a, C-LOOP B03:L01, C-LINK LN04, C-CHECK CK1, a supplementary P4-02.3). */
export const rowIdPattern = (def: TableDef): RegExp => ID_PATTERN[def.rowId ?? ''] ?? new RegExp(`^${def.rowId ?? '\\0'}\\d{1,3}$`);
/** Recipe .46: any row ID a v5 table takes besides its own form (sessions wrote G01 for C-GROUP, C01 for C-COND): one to three capitals and
 * one to three digits (a branch letter after), or the B03:S01 and B03:L01 forms. The ledgers (C-SRC F01, C-EVID E01) keep their own form:
 * their IDs are what every 근거 cites. */
const ANY_ROW_ID = /^(?:[A-Z]{1,3}\d{1,3}[a-z]?|B\d{1,3}:[SL]\d{1,3}[a-z]?)$/;
const LEDGERS: readonly string[] = ['C-SRC', 'C-EVID'];
/** Whether a written ID is a row ID of the table: its own form, or (recipe .46) any ID of ANY_ROW_ID outside the ledgers. */
export const rowIdTaken = (def: TableDef, id: string): boolean => rowIdPattern(def).test(id) || (!LEDGERS.includes(def.id) && ANY_ROW_ID.test(id));
/** Recipe .46: the row-ID form a v5 table's rows take, as the requests write it (「GR01」, 「B03:L01」, 「CK1」, 「P4-02.1」); null for C-HEAD,
 * C-SUMMARY, C-DROP and C-END. */
export function rowIdForm(def: TableDef): string | null {
  const p = def.rowId; if (!p) return null;
  return p === 'S' ? 'B03:S01' : p === 'L' ? 'B03:L01' : p === 'CK' ? 'CK1' : p === 'P' ? `${def.id}.1` : `${p}01`;
}
/** Recipe .46: a row's key in its folded record: a row ID is unique within its table, the same ID in two tables two rows. */
export const rowKey = (table: string, id: string): string => `${table} ${id}`;
/** The IDs a C-END 쓴 행 cell names, ranges spelled out: 「LN01–LN09」, 「B03:S01–S06」, 「LN01–LN05, LN07」. */
export function expandIds(cell: string): string[] {
  const t = cell.replace(/\s*[–—~]\s*/g, '–').replace(/(\d[a-z]?)\s*-\s*(?=[A-Z]|\d)/g, '$1–'), out: string[] = [];
  for (const piece of t.split(/[\s,，·]+/).filter(Boolean)) {
    const [a, b] = piece.split('–');
    if (b !== undefined) {
      const ma = /^(.*?)(\d{1,3})([a-z]?)$/.exec(a ?? ''), mb = /^(.*?)(\d{1,3})$/.exec(b);
      if (ma && mb && !ma[3] && (!mb[1] || ma[1] === mb[1] || ma[1]!.endsWith(mb[1]!)) && Number(mb[2]) >= Number(ma[2]) && Number(mb[2]) - Number(ma[2]) <= 200) {
        for (let n = Number(ma[2]); n <= Number(mb[2]); n++) out.push(`${ma[1]}${String(n).padStart(ma[2]!.length, '0')}`);
        continue;
      }
      out.push(...[a, b].filter((x): x is string => !!x && /\d/.test(x)));
      continue;
    }
    if (/^[A-Z][A-Z0-9:.\-]*\d[a-z]?$/.test(piece)) out.push(piece);
  }
  return [...new Set(out)];
}
/** A C-END 예약 cell: 「D01 급수 일정 · D02 푸시 요청」 → each ID with the name written after it. */
export function readReserved(cell: string): { id: string; name: string }[] {
  if (!said5(cell)) return [];
  return [...cell.matchAll(/((?:B\d{1,3}:[SL]\d{1,3}[a-z]?)|(?:[A-Z]{1,2}\d{1,3}))(?![\d:])\s*([^·,，]*)/g)].map(m => ({ id: m[1]!, name: m[2]!.trim() }));
}
/** The part IDs (B05), loop IDs (B05:L01) and other row IDs (D02, X01, N01, K01, B05:S02) a cell names. */
export const partRefs = (cell: string | undefined): string[] => [...new Set([...(cell ?? '').matchAll(/(?<![A-Za-z0-9])B\d{1,3}(?![\d:])/g)].map(m => m[0]))];
export const loopRefs = (cell: string | undefined): string[] => [...new Set([...(cell ?? '').matchAll(/(?<![A-Za-z0-9])B\d{1,3}:L\d{1,3}(?!\d)/g)].map(m => m[0]))];
// A step a branch names (→ B05:S01) may stand on a later page and is no reference checked here.
const rowRefs = (cell: string): string[] => [...new Set([...cell.matchAll(/(?<![A-Za-z0-9:])((?:B\d{1,3}:L\d{1,3})|(?:[BDXNK]\d{2,3}))(?![0-9A-Za-z:])/g)].map(m => m[1]!))];
/** A page's hash (4.4): its text with each line's trailing white space and the text's outer white space left out (FNV-1a, two seeds). */
export function pageHash(text: string): string {
  const t = text.split('\n').map(l => l.trimEnd()).join('\n').trim();
  const fnv = (seed: number) => { let h = seed >>> 0; for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16).padStart(8, '0'); };
  return fnv(2166136261) + fnv(0x811c9dc5 ^ 0x5bd1e995);
}

/* ---------- The fold (4.3–4.6 as 12.1 and 12.5 amend them). ---------- */
export type FoldCategory = 'page-conflict' | 'page-gap' | 'page-prev' | 'duplicate-id' | 'replace-unknown' | 'id-reused' | 'row-id' | 'out-of-order' | 'reserve-unused'
  | 'dangling-ref' | 'ref-deleted' | 'end-mismatch' | 'level-mismatch' | 'cite-missing' | 'cite-equals' | 'cite-unread' | 'cite-word' | 'grade-source' | 'part-added' | 'drop-unknown' | 'row-cells'
  // Recipe .46 (the fold's own, never stored: map-reading.19 keeps its categories): a later text for a page replaced the earlier one (said once
  // per page), a row ID outside its table's own form (said once per table and prefix, never an obligation), a C-DROP ID two tables hold.
  | 'page-replaced' | 'row-id-prefix' | 'drop-ambiguous';
export interface FoldDiagnostic { category: FoldCategory; table: string | null; ref: string | null; record: string; page: number | null; from: number; to: number }
/** A current row: its table, ID, the page and record it stands on, the row as read, whether it was written as 교체·정정 or 추가, its cites. */
export interface FoldRow { table: string; id: string; record: string; page: number; row: RecordRow; source: RecordTable; mark: 'replace' | 'add' | null; cites: Cite[] }
export interface PageEnd { page: number; table: string; state: string | null; written: string[]; reserved: { id: string; name: string }[]; remaining: string | null; record: string; from: number; to: number }
export interface FoldPage { record: string; n: number; prev: number | null; basis: string; title: string; hash: string; conflict: boolean; repeated: number; from: number; to: number }
export type ObligationKind = 'fix' | 'reservation' | 'table-skipped' | 'table-open' | 'table-next' | 'loop-body' | 'entry-unlinked' | 'folder-part' | 'page-gap' | 'page-conflict';
/** A remaining obligation (12.1): what the next page should do; a candidate (a missing link, a folder part) is never a confirmed error. */
export interface Obligation { kind: ObligationKind; table: string | null; ref: string | null; text: string; candidate: boolean }
export interface TableState { state: 'none' | 'open' | 'closed'; end: string | null; remaining: string | null; page: number | null }
export interface FoldedRecord { recordId: string; basis: string; title: string; key: string;
  /** The pages folded (1…k with no gap), those held after a gap, and other texts sent for a page already folded. Recipe .46: a later text
   * for a page replaces the earlier one (latest wins, in paste order); the earlier texts are kept in replaced, and conflicts stays empty. */
  pages: FoldPage[]; held: FoldPage[]; conflicts: FoldPage[]; replaced: FoldPage[];
  /** The current rows by table (first appearance order) and by ID; C-HEAD by its 항목. Recipe .46: a row ID is unique within its table;
   * byId holds one row per ID (the row of the table whose own form the ID is, else the first), rowKey(table, id) every row. */
  rows: Map<string, FoldRow[]>; byId: Map<string, FoldRow>; byKey: Map<string, FoldRow>; head: Map<string, FoldRow>; ledger: Ledger;
  /** Every row a row key (rowKey) has stood on, replaced ones first (a basis quoting a row 교체 later replaced, or a page a later text
   * replaced, still names that row). */
  history: Map<string, FoldRow[]>;
  /** Recipe .46: the IDs C-DROP took away, by table. */
  dropped: Map<string, Set<string>>;
  summary: { text: string; record: string; from: number; to: number; cites: Cite[] }[];
  ends: PageEnd[]; declared: { page: number; level: 0 | 1 | 2 | null }[]; nexts: { page: number; text: string }[];
  reservations: { id: string; name: string; page: number }[]; deleted: Set<string>; extras: FoldRow[];
  states: Map<string, TableState>; diagnostics: FoldDiagnostic[]; level: 0 | 1 | 2; obligations: Obligation[] }
const ORDER5 = [...Q1_TABLES, ...Q2_TABLES];
/** 12.4 (b): the detail tables whose first-structure rows (a mode switch, a variant that splits the map) go on the first-structure pages. */
const EARLY_Q2: readonly string[] = ['C-COND', 'C-VARIANT'];
const CLOSING: readonly string[] = ['done', 'na', 'unchecked'];
const foldCache = new Map<string, FoldedRecord[]>();
/** Every v5 record among the texts, folded (one per record ID and basis sha, in the order their first page arrives). Recipe .46: order says
 * which input was pasted later (a later text for a page replaces the earlier one): 'paste' (the default) when the inputs come oldest first
 * (the pasted records as pasted, a session's answers in turn), 'newest-first' for a map ask's records (unreadRecords lists them newest first). */
export function foldPages(inputs: Iterable<{ record: string; text: string }>, order: 'paste' | 'newest-first' = 'paste'): FoldedRecord[] {
  const list = [...inputs].filter(x => recordVersion(x.text) === 'v5');
  const key = `${order}\u0002${list.map(x => `${x.record}\u0000${pageHash(x.text)}\u0000${x.text.length}`).join('\u0001')}`, hit = foldCache.get(key); if (hit) return hit;
  const groups = new Map<string, Src[]>();
  list.forEach(({ record, text }, i) => {
    const t = readRecordTables(text), at = order === 'paste' ? i : list.length - 1 - i;
    t.pages.forEach((p, index) => {
      const k = `${p.recordId}@${p.basis}`;
      groups.set(k, [...groups.get(k) ?? [], { record, n: p.n, prev: p.prev, basis: p.basis, title: p.title, hash: pageHash(text.slice(p.from, p.end)), conflict: false, repeated: 0, from: p.from, to: p.end, t, index, headTo: p.to, seq: at * 1000 + index }]);
    });
  });
  const out = [...groups.entries()].map(([k, srcs]) => foldGroup(k, srcs));
  if (foldCache.size > 64) foldCache.delete(foldCache.keys().next().value!);
  foldCache.set(key, out);
  return out;
}
/** The fold of plain texts (each by its index), and the record the last v5 text belongs to. */
export const foldTexts = (texts: readonly string[]): FoldedRecord[] => foldPages(texts.map((text, i) => ({ record: `#${i}`, text })));
export function latestFold(texts: readonly string[]): FoldedRecord | null {
  const folds = foldTexts(texts), last = [...texts].reverse().map(t => readRecordTables(t)).find(t => t.version === 'v5' && t.pages.length);
  if (!last) return folds.at(-1) ?? null;
  const p = last.pages.at(-1)!;
  return folds.find(f => f.key === `${p.recordId}@${p.basis}`) ?? null;
}
type Src = FoldPage & { t: RecordTables; index: number; headTo: number; seq: number };
/** A row's place, for the diagnostics a later drop or replacement settles. */
const spanOf = (record: string, from: number) => `${record}\u0000${from}`;
/** The row diagnostics a C-DROP or 교체 of the row's key settles (recipe .46): never asked again once the row is gone or replaced. */
const SETTLED_BY_DROP: readonly FoldCategory[] = ['duplicate-id', 'row-id', 'id-reused', 'replace-unknown'];
/** The v5 rows a page holds with an ID their table takes (rowIdTaken): the fold's rows before it puts them. */
function pageRows(s: Src, tables: readonly RecordTable[]): FoldRow[] {
  const out: FoldRow[] = [];
  for (const table of tables) {
    if (['C-END', 'C-SUMMARY', 'C-HEAD', 'C-DROP'].includes(table.id)) continue;
    const def = V5_TABLE_DEFS.get(table.id)!, idCol = table.id === 'C-SRC' ? 'F ID' : table.id === 'C-EVID' ? 'E ID' : '행 ID';
    for (const r of table.rows) {
      const cell = (r.byColumn[idCol] ?? r.cells[0]?.text ?? '').trim(), mk = /^(교체|정정|추가)\s*[:：]?\s*(\S+)$/.exec(cell), id = (mk ? mk[2]! : cell).trim();
      if (rowIdTaken(def, id)) out.push({ table: table.id, id, record: s.record, page: s.n, row: r, source: table, mark: mk ? (mk[1] === '추가' ? 'add' : 'replace') : null, cites: [] });
    }
  }
  return out;
}
function foldGroup(key: string, srcs: Src[]): FoldedRecord {
  const diagnostics: FoldDiagnostic[] = [];
  const d = (category: FoldCategory, record: string, page: number | null, table: string | null, ref: string | null, from: number, to: number) => { if (diagnostics.length < 1024) diagnostics.push({ category, table, ref, record, page, from, to }); };
  // Recipe .46: a page's texts in paste order, one per distinct text: the same text again changes nothing (idempotent, even after another
  // text); a different later text replaces the page (latest wins), the earlier kept in replaced and history, page-replaced said once.
  const versions = new Map<number, Src[]>(), conflicts: FoldPage[] = [], replaced: FoldPage[] = [];
  for (const s of [...srcs].sort((a, b) => a.seq - b.seq)) {
    const vs = versions.get(s.n) ?? [], same = vs.find(v => v.hash === s.hash);
    if (same) { same.repeated++; continue; }
    vs.push(s); versions.set(s.n, vs);
  }
  const byN = new Map<number, Src>(), earlier: Src[] = [];
  for (const [n, vs] of versions) {
    const s = vs.at(-1)!; byN.set(n, s);
    if (vs.length > 1) { earlier.push(...vs.slice(0, -1)); replaced.push(...vs.slice(0, -1).map(page)); d('page-replaced', s.record, n, null, `쪽 ${n}`, s.from, s.headTo); }
  }
  const earlierRows = earlier.flatMap(s => pageRows(s, s.t.tables.filter(x => x.page === s.index && x.dialect === 'v5' && x.known)));
  const earlierIds = new Set(earlierRows.flatMap(r => [r.id, rowKey(r.table, r.id)]));
  const folded: Src[] = [], held: Src[] = [];
  let expect = 1;
  for (const n of [...byN.keys()].sort((a, b) => a - b)) { const s = byN.get(n)!; if (n === expect && !held.length) { folded.push(s); expect++; } else held.push(s); }
  if (held.length) d('page-gap', held[0]!.record, held[0]!.n, null, `쪽 ${expect}`, held[0]!.from, held[0]!.headTo);
  const rows = new Map<string, FoldRow[]>(), byKey = new Map<string, FoldRow>(), head = new Map<string, FoldRow>(), deleted = new Set<string>(), extras: FoldRow[] = [], history = new Map<string, FoldRow[]>();
  const deletedKeys = new Set<string>(), dropped = new Map<string, Set<string>>(), settledSpans = new Set<string>(), prefixSaid = new Set<string>();
  const summary: FoldedRecord['summary'] = [], ends: PageEnd[] = [], declared: FoldedRecord['declared'] = [], nexts: FoldedRecord['nexts'] = [];
  const states = new Map<string, TableState>(), replacedE = new Map<string, FoldRow>();
  const listOf = (table: string) => { let l = rows.get(table); if (!l) { l = []; rows.set(table, l); } return l; };
  // The rows that stood under a key before (an extra written twice, one 교체 replaced): what a drop or replacement of the key settles.
  const settle = (k: string) => { for (const x of extras) if (rowKey(x.table, x.id) === k) settledSpans.add(spanOf(x.record, x.row.from)); };
  const put = (r: FoldRow) => {
    const k = rowKey(r.table, r.id), had = byKey.get(k);
    if (deletedKeys.has(k)) { d('id-reused', r.record, r.page, r.table, r.id, r.row.from, r.row.to); extras.push(r); return; }
    if (r.mark === 'replace') {
      if (!had) d('replace-unknown', r.record, r.page, r.table, r.id, r.row.from, r.row.to);
      else { const l = listOf(had.table); l.splice(l.indexOf(had), 1, r); if (r.table === 'C-EVID' && !replacedE.has(r.id)) replacedE.set(r.id, had); settle(k); }
      if (!had) listOf(r.table).push(r);
      byKey.set(k, r); history.set(k, [...history.get(k) ?? [], r]); return;
    }
    // Recipe .46: the very same row again (a page re-sent whole, a row repeated on a later page) changes nothing and asks nothing.
    const same = !!had && had.row.cells.length === r.row.cells.length && had.row.cells.every((c, i) => c.text === r.row.cells[i]!.text);
    if (had) { if (!same) d('duplicate-id', r.record, r.page, r.table, r.id, r.row.from, r.row.to); extras.push(r); return; }
    if (r.mark === 'add') d('part-added', r.record, r.page, r.table, r.id, r.row.from, r.row.to);
    byKey.set(k, r); listOf(r.table).push(r); history.set(k, [r]);
  };
  /** Recipe .46: C-DROP takes away any row by its written ID: 「ST01」, 「C-STATE ST01」, a range 「G01–G16」. A bare ID two tables hold is
   * the one of the table its 이유 names, else the one written outside its table's own form (the misnamed row), else said (drop-ambiguous). A
   * row whose ID no table takes (an extra) is taken away by its cell as written. */
  const drop = (r: RecordRow, s: Src) => {
    const cell = (r.byColumn['행 ID'] ?? '').trim(), q = /^(C-[A-Z]{2,12}|P\d-\d{2})\s*[:：·]?\s*(\S.*)$/.exec(cell), only = q?.[1] ?? null, rest = (q ? q[2]! : cell).trim();
    const named = [...new Set((r.byColumn['이유'] ?? '').match(/C-[A-Z]{2,12}/g) ?? [])];
    const list = /[–—~,，]|\s-\s|\d-[A-Z]/.test(rest) ? expandIds(rest) : [rest];
    for (const id of list.length ? list : [rest]) {
      let cands = [...rows.entries()].flatMap(([t, l]) => only && t !== only ? [] : l.filter(x => x.id === id));
      // A drop meant for a row an earlier text of its page held (the corrected page left it out) never takes another table's row of that
      // ID: one its 이유 names, or one written outside its table's form, that is gone now.
      const ownForm = (x: { table: string; id: string }) => rowIdPattern(V5_TABLE_DEFS.get(x.table)!).test(x.id);
      const gone = earlierRows.filter(x => x.id === id && !cands.some(c => c.table === x.table) && (named.includes(x.table) || !ownForm(x)));
      if (gone.length && !cands.some(c => named.includes(c.table) || !ownForm(c))) continue;
      if (cands.length > 1) {
        const byReason = cands.filter(x => named.includes(x.table)), off = cands.filter(x => !rowIdPattern(V5_TABLE_DEFS.get(x.table)!).test(x.id));
        cands = byReason.length === 1 ? byReason : off.length === 1 ? off : cands;
        if (cands.length > 1) { d('drop-ambiguous', s.record, s.n, 'C-DROP', id.slice(0, 20), r.from, r.to); continue; }
      }
      const had = cands[0];
      if (!had) {
        const stray = extras.filter(x => x.id === id && (!only || x.table === only));
        // The same drop sent again (a later page repeating it) changes nothing and says nothing.
        if (!stray.length && (only ? dropped.get(only)?.has(id) : deleted.has(id))) continue;
        // A row only an earlier text of a page held (the later text left it out) is gone already.
        if (!stray.length && earlierIds.has(only ? rowKey(only, id) : id)) continue;
        if (!stray.length) { d('drop-unknown', s.record, s.n, 'C-DROP', id.slice(0, 20) || null, r.from, r.to); continue; }
        for (const x of stray) settledSpans.add(spanOf(x.record, x.row.from));
        continue;
      }
      const k = rowKey(had.table, had.id), l = listOf(had.table); l.splice(l.indexOf(had), 1); byKey.delete(k); deletedKeys.add(k); deleted.add(had.id);
      dropped.set(had.table, (dropped.get(had.table) ?? new Set()).add(had.id)); settle(k);
    }
  };
  for (const s of folded) {
    if (s.prev !== (s.n === 1 ? null : s.n - 1)) d('page-prev', s.record, s.n, null, `앞 쪽 ${s.prev ?? '—'}`, s.from, s.headTo);
    const tables = s.t.tables.filter(x => x.page === s.index && x.dialect === 'v5' && x.known);
    for (const x of s.t.diagnostics) if (x.category === 'row-cells' && x.from >= s.from && x.from < s.to) d('row-cells', s.record, s.n, x.table, null, x.from, x.to);
    const pageEnds = tables.filter(x => x.id === 'C-END').flatMap(x => x.rows.map((r): PageEnd => {
      const c = r.byColumn, id = (c['표 ID'] ?? '').trim(), word = fixedWord(c['상태'] ?? '', END_WORDS)?.value ?? fixedWord(c['상태'] ?? '', SUPPLEMENT_WORDS)?.value ?? null;
      const remaining = said5(c['남은 것']);
      return { page: s.n, table: id, state: word === 'na' && !remaining && /^C-/.test(id) ? 'unchecked' : word, written: expandIds(said5(c['쓴 행']) ?? ''), reserved: readReserved(c['예약'] ?? ''), remaining, record: s.record, from: r.from, to: r.to };
    }));
    ends.push(...pageEnds);
    const endOf = (id: string) => pageEnds.filter(e => e.table === id).at(-1)?.state ?? null;
    const writtenHere = new Set<string>();
    const settled = ORDER5.every(id => states.get(id)?.state === 'closed'), q1Settled = Q1_TABLES.every(id => states.get(id)?.state === 'closed'), passed = new Set<string>();
    for (const table of tables) {
      const def = V5_TABLE_DEFS.get(table.id)!, written = table.header.length > 0 || !!table.none || table.body.length > 0;
      // 12.1: the order inside Q1 and Q2 is recommended; a table written before an earlier one is settled is said, its rows kept.
      if (def.queue === 3 && !settled) d('out-of-order', s.record, s.n, table.id, table.id, table.from, table.to);
      // 12.4 (b) (review N6): C-COND and C-VARIANT rows that change the first structure belong with it; written early they are in order.
      else if (EARLY_Q2.includes(table.id)) { /* in order */ }
      else if (def.queue === 1 || def.queue === 2) {
        // Said once per page for each table passed over (the first table written past it).
        const at = ORDER5.indexOf(table.id), open = ORDER5.slice(0, at).find(u => !passed.has(u) && !writtenHere.has(u) && states.get(u)?.state !== 'closed' && !CLOSING.includes(endOf(u) ?? ''));
        if (open) { d('out-of-order', s.record, s.n, table.id, open, table.from, table.to); for (const u of ORDER5.slice(0, at)) if (!writtenHere.has(u) && states.get(u)?.state !== 'closed') passed.add(u); }
      }
      if (written && def.queue !== 0) writtenHere.add(table.id);
      if (table.id === 'C-END') continue;
      if (table.id === 'C-SUMMARY') { for (const b of table.body) summary.push({ text: b.text, record: s.record, from: b.from, to: b.to, cites: [] }); continue; }
      if (table.id === 'C-HEAD') {
        for (const r of table.rows) {
          const cell = (r.byColumn['항목'] ?? '').trim(), mk = /^교체\s*[:：]?\s*(.+)$/.exec(cell), item = (mk ? mk[1]! : cell).trim(); if (!item) continue;
          const row: FoldRow = { table: 'C-HEAD', id: item, record: s.record, page: s.n, row: r, source: table, mark: mk ? 'replace' : null, cites: [] };
          if (head.has(item) && !mk) { d('duplicate-id', s.record, s.n, 'C-HEAD', item.slice(0, 20), r.from, r.to); extras.push(row); } else head.set(item, row);
        }
        continue;
      }
      if (table.id === 'C-DROP') { for (const r of table.rows) drop(r, s); continue; }
      const idCol = table.id === 'C-SRC' ? 'F ID' : table.id === 'C-EVID' ? 'E ID' : '행 ID', pattern = rowIdPattern(def);
      for (const r of table.rows) {
        const cell = (r.byColumn[idCol] ?? r.cells[0]?.text ?? '').trim(), mk = /^(교체|정정|추가)\s*[:：]?\s*(\S+)$/.exec(cell), id = (mk ? mk[2]! : cell).trim();
        const row: FoldRow = { table: table.id, id, record: s.record, page: s.n, row: r, source: table, mark: mk ? (mk[1] === '추가' ? 'add' : 'replace') : null, cites: [] };
        if (!rowIdTaken(def, id)) { d('row-id', s.record, s.n, table.id, cell.slice(0, 20) || null, r.from, r.to); extras.push(row); continue; }
        // Recipe .46: an ID outside the table's own form is taken as written, said once per table and prefix (never an obligation).
        const prefix = /^[A-Z]+/.exec(id)?.[0] ?? id;
        if (!pattern.test(id) && !prefixSaid.has(`${table.id} ${prefix}`)) { prefixSaid.add(`${table.id} ${prefix}`); d('row-id-prefix', s.record, s.n, table.id, id.slice(0, 20), r.from, r.to); }
        put(row);
      }
    }
    // A table's state after the page: closed once written (unless the page's C-END keeps it 이어짐 or 아직) or closed by its C-END word.
    // Review N6: a C-COND or C-VARIANT table written on a page before the first structure was settled holds its first-structure rows only:
    // it stays open for the detail unless the page's C-END closes it (끝남, 해당 없음, 확인 못함).
    for (const id of ORDER5) {
      const e = endOf(id), remaining = pageEnds.filter(x => x.table === id).at(-1)?.remaining ?? null, early = EARLY_Q2.includes(id) && !q1Settled && !e;
      if (writtenHere.has(id) || e) states.set(id, { state: e === 'cont' || e === 'pending' || early ? 'open' : writtenHere.has(id) || CLOSING.includes(e ?? '') ? 'closed' : 'open', end: e, remaining: remaining ?? (early ? '첫 구조 행만' : null), page: s.n });
    }
    for (const x of s.t.declared) if (x.page === s.index) declared.push({ page: s.n, level: x.level });
    for (const x of s.t.nexts) if (x.page === s.index) nexts.push({ page: s.n, text: x.text });
  }
  // Recipe .46: one row per ID for the passes that look an ID up (a B ID, CK6, a step's B03:S02): the row of the table whose own form the ID
  // is, else the first; every current row stays in rows and byKey.
  const byId = new Map<string, FoldRow>(), all = [...rows.values()].flat(), ids = new Set(all.map(r => r.id));
  const own = (r: FoldRow) => rowIdPattern(V5_TABLE_DEFS.get(r.table)!).test(r.id);
  for (const r of all) { const had = byId.get(r.id); if (!had || (!own(had) && own(r))) byId.set(r.id, r); }
  // The ledgers (2.2, 2.3): a run whose source is no command reads as a report (grade-source, 2.5 rule 2).
  const files = new Map<string, LedgerFile>(), evidence = new Map<string, LedgerEvidence>();
  for (const r of rows.get('C-SRC') ?? []) { const c = r.row.byColumn; files.set(r.id, { id: r.id, path: (c['경로'] ?? '').trim(), part: said5(c['속한 부분']), read: fixedWord(c['읽음'] ?? '', READ_WORDS)?.value ?? null, role: said5(c['역할']), record: r.record, from: r.row.from, to: r.row.to }); }
  const evidenceOf = (r: FoldRow): Omit<LedgerEvidence, 'previous'> => {
    const c = r.row.byColumn, source = said5(c['출처']); let grade = fixedWord(c['등급'] ?? '', GRADE_WORDS)?.value ?? null;
    if (grade === 'run' && !(source && commandLike(source))) { d('grade-source', r.record, r.page, 'C-EVID', r.id, r.row.from, r.row.to); grade = 'report'; }
    return { id: r.id, grade, source, place: said5(c['자리']), quote: said5(c['짧은 인용']), record: r.record, from: r.row.from, to: r.row.to };
  };
  for (const r of rows.get('C-EVID') ?? []) evidence.set(r.id, { ...evidenceOf(r), previous: null });
  const ledger: Ledger = { files, evidence };
  // Cites: every current row's 근거 (the ledgers' own rows cite nothing), each C-SUMMARY sentence's 「(F02)」.
  const cited = new Map<string, string[]>();
  const citeRow = (r: FoldRow) => {
    const got = readCites(r.row.byColumn['근거'] ?? '', ledger); r.cites = got.cites;
    for (const p of got.problems) d(p.kind, r.record, r.page, r.table, `${r.id}·${p.ref}`.slice(0, 40), r.row.from, r.row.to);
    for (const c of got.cites) if (/^E\d/.test(c.ref)) cited.set(c.ref, [...cited.get(c.ref) ?? [], r.id]);
  };
  for (const [table, list] of rows) if (table !== 'C-SRC' && table !== 'C-EVID') list.forEach(citeRow);
  for (const r of head.values()) citeRow(r);
  for (const x of summary) { const m = /[(（]\s*((?:[FE]\d{1,3}|추정|모름)(?:\s*\+\s*(?:[FE]\d{1,3}|추정|모름))*)\s*[)）]\s*[.。]?\s*$/.exec(x.text); if (m) x.cites = readCites(m[1]!, ledger).cites; }
  for (const [id, was] of replacedE) { const e = evidence.get(id); if (e) { const old = evidenceOf(was); e.previous = { grade: old.grade, source: old.source, quote: old.quote, citedBy: cited.get(id) ?? [] }; } }
  // Reservations (4.2): one no row of its page cites is dropped (reserve-unused); one a row now holds is resolved.
  const reservations: FoldedRecord['reservations'] = [], anyReserved = new Set<string>();
  const token = (id: string) => new RegExp(`(?<![A-Za-z0-9:])${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![0-9A-Za-z])`);
  for (const e of ends) for (const r of e.reserved) {
    const re = token(r.id), page = [...all, ...extras].filter(x => x.page === e.page && x.record === e.record && x.id !== r.id);
    if (!page.some(x => x.row.cells.some(c => re.test(c.text)))) { d('reserve-unused', e.record, e.page, 'C-END', r.id, e.from, e.to); continue; }
    anyReserved.add(r.id);
    if (!ids.has(r.id) && !reservations.some(x => x.id === r.id)) reservations.push({ id: r.id, name: r.name, page: e.page });
  }
  for (const x of reservations.splice(0)) if (!ids.has(x.id)) reservations.push(x);
  // References (4.2, 4.3): an ID a row names that no row holds, no reservation names and no drop took away (by the ID as written).
  for (const r of all) {
    if (r.table === 'C-SRC' || r.table === 'C-EVID') continue;
    const idCol = '행 ID';
    for (const [col, v] of Object.entries(r.row.byColumn)) {
      if (col === idCol || col === '근거') continue;
      for (const ref of rowRefs(v)) {
        if (ref === r.id || ids.has(ref)) continue;
        if (deleted.has(ref)) d('ref-deleted', r.record, r.page, r.table, `${r.id}→${ref}`, r.row.from, r.row.to);
        else if (!anyReserved.has(ref)) d('dangling-ref', r.record, r.page, r.table, `${r.id}→${ref}`, r.row.from, r.row.to);
      }
    }
  }
  // 4.6: a page's C-END 쓴 행 against the rows the page really holds (the rows win). Review N2: the page's own original rows (every row an
  // ID stood on, history), so a later page's 교체 or C-DROP never makes an earlier page's C-END wrong.
  const written = [...[...history.values()].flat(), ...extras];
  for (const e of ends) {
    if (!e.written.length || !/^(?:C-[A-Z]{2,12}|P\d-\d{2})$/.test(e.table)) continue;
    const there = new Set(written.filter(x => x.page === e.page && x.record === e.record && x.table === e.table).map(x => x.id));
    if (e.written.some(x => !there.has(x)) || [...there].some(x => !e.written.includes(x))) d('end-mismatch', e.record, e.page, e.table, null, e.from, e.to);
  }
  // Recipe .46: a replaced page's rows go first in their keys' history (a basis quoting the earlier text still names the row).
  for (const s of earlier) for (const r of pageRows(s, s.t.tables.filter(x => x.page === s.index && x.dialect === 'v5' && x.known))) {
    const k = rowKey(r.table, r.id), h = history.get(k); if (h) h.unshift(r);
  }
  // Recipe .46: a row diagnostic its row's later drop or replacement settled is no longer said (nor asked).
  const kept = diagnostics.filter(x => !(SETTLED_BY_DROP.includes(x.category) && settledSpans.has(spanOf(x.record, x.from)))).slice(0, 256);
  diagnostics.splice(0, diagnostics.length, ...kept);
  const record: FoldedRecord = { recordId: srcs[0]!.t.pages[srcs[0]!.index]!.recordId, basis: srcs[0]!.basis, title: srcs[0]!.title, key,
    pages: folded.map(page), held: held.map(page), conflicts, replaced, rows, byId, byKey, history, dropped, head, ledger, summary, ends, declared, nexts, reservations, deleted, extras, states, diagnostics, level: 0, obligations: [] };
  const lv = recordLevel(record); record.level = lv.level; record.obligations = lv.obligations;
  const said = declared.at(-1)?.level;
  if (said !== undefined && said !== null && said !== lv.level && folded.length) { const s = folded.at(-1)!; d('level-mismatch', s.record, s.n, 'C-END', `${said}≠${lv.level}`, s.from, s.headTo); }
  return record;
}
function page(s: FoldPage): FoldPage { return { record: s.record, n: s.n, prev: s.prev, basis: s.basis, title: s.title, hash: s.hash, conflict: s.conflict, repeated: s.repeated, from: s.from, to: s.to }; }
/** Review N3: a fix on a supplementary table's row (P4-02): the supplementary request asks it; it never holds the detail level back. */
export const supplementFix = (o: Obligation): boolean => o.kind === 'fix' && /^P\d-\d{2}$/.test(o.table ?? '');
const FIX_TEXT: Readonly<Partial<Record<FoldCategory, string>>> = { 'duplicate-id': '표시 없이 겹친 ID: 교체할지 새 ID로 쓸지', 'row-id': '행 ID가 없거나 형식 밖', 'cite-missing': '장부에 없는 F·E 인용',
  'cite-equals': '「=」 인용(ID를 명시)', 'row-cells': '칸 수가 머리 줄과 다른 행' };
/** The record's level and remaining obligations (4.5 as 12.1 amends it), computed by the app: level 1 when every Q1 table is settled
 * (끝남, 해당 없음, 확인 못함, or written and not left 이어짐·아직), every C-PART row has a fixed family word and no Q1 row is mis-celled or
 * mis-numbered; level 2 when every Q2 table is settled too and no obligation that is no candidate is left (fixes, reservations, core loops
 * left unexpanded). A missing link is a candidate, never an error. */
export function recordLevel(f: Pick<FoldedRecord, 'rows' | 'byId' | 'states' | 'diagnostics' | 'reservations' | 'held' | 'conflicts'>): { level: 0 | 1 | 2; obligations: Obligation[] } {
  const out: Obligation[] = [];
  for (const r of f.rows.get('C-PART') ?? []) { const fam = readFamily(r.row.byColumn['표현군·역할'] ?? ''); if (!fam.ok) out.push({ kind: 'fix', table: 'C-PART', ref: r.id, text: said5(r.row.byColumn['표현군·역할']) ? '표현군·역할이 고정 낱말 밖' : '표현군·역할 없음', candidate: false }); }
  for (const x of f.diagnostics) { const text = FIX_TEXT[x.category]; if (text) out.push({ kind: 'fix', table: x.table, ref: x.ref, text, candidate: false }); }
  const checks = f.rows.get('C-CHECK') ?? [];
  if (checks.length || f.states.get('C-CHECK')?.state === 'closed') for (const ck of Object.keys(CHECK_ROWS)) if (!f.byId.has(ck)) out.push({ kind: 'fix', table: 'C-CHECK', ref: ck, text: `${ck} ${CHECK_ROWS[ck]} 행 없음`, candidate: false });
  const last = Math.max(-1, ...ORDER5.map((id, i) => f.states.get(id) && f.states.get(id)!.state !== 'none' ? i : -1));
  ORDER5.forEach((id, i) => {
    const st = f.states.get(id); if (st?.state === 'closed') return;
    if (st?.state === 'open') out.push({ kind: 'table-open', table: id, ref: null, text: st.remaining ?? (st.end === 'pending' ? '아직' : '이어짐'), candidate: false });
    else out.push({ kind: i < last ? 'table-skipped' : 'table-next', table: id, ref: null, text: i < last ? 'C-END에도 쪽에도 없음' : '표 전체', candidate: false });
  });
  for (const r of f.reservations) out.push({ kind: 'reservation', table: null, ref: r.id, text: r.name, candidate: false });
  const steps = f.rows.get('C-STEP') ?? [], links = f.rows.get('C-LINK') ?? [], linkCount = (b: string) => links.filter(l => [...partRefs(l.row.byColumn['보내는 부분']), ...partRefs(l.row.byColumn['받는 부분'])].includes(b)).length;
  for (const l of f.rows.get('C-LOOP') ?? []) {
    if (steps.some(s => loopRefs(s.row.byColumn['소속 반복']).includes(l.id))) continue;
    const owner = l.id.split(':')[0]!;
    if (!loopRefs(l.row.byColumn['부모 반복']).length || linkCount(owner) >= 3) out.push({ kind: 'loop-body', table: 'C-LOOP', ref: l.id, text: '단계 미전개(C-STEP 소속 반복)', candidate: false });
  }
  for (const e of f.rows.get('C-ENTRY') ?? []) {
    const owner = partRefs(e.row.byColumn['소유 부분'])[0];
    if (owner && !links.some(l => partRefs(l.row.byColumn['받는 부분']).includes(owner))) out.push({ kind: 'entry-unlinked', table: 'C-ENTRY', ref: e.id, text: `${owner}로 들어오는 C-LINK 없음`, candidate: true });
  }
  // 13.5 (CK6): a part whose 담당 F is one folder, with three C-LINK rows or more and no C-STEP row, unless C-CHECK CK6 names it.
  const ck6 = f.byId.get('CK6')?.row.byColumn['찾은 것'] ?? '';
  for (const p of f.rows.get('C-PART') ?? []) {
    const own = (p.row.byColumn['담당 F'] ?? '').match(/F\d{1,3}/g) ?? [];
    const folder = own.length === 1 && /\/\s*$/.test(f.byId.get(own[0]!)?.row.byColumn['경로'] ?? '');
    if (folder && linkCount(p.id) >= 3 && !steps.some(s => s.id.startsWith(`${p.id}:`)) && !partRefs(ck6).includes(p.id)) out.push({ kind: 'folder-part', table: 'C-PART', ref: p.id, text: '폴더 하나인 부분의 안을 읽었나(CK6)', candidate: true });
  }
  if (f.held.length) out.push({ kind: 'page-gap', table: null, ref: null, text: `쪽 ${Math.min(...f.held.map(h => h.n)) - 1}까지만 접음`, candidate: false });
  for (const c of f.conflicts) out.push({ kind: 'page-conflict', table: null, ref: `쪽 ${c.n}`, text: '같은 쪽에 다른 글: 재전송인지 정정인지', candidate: false });
  const settled = (ids: readonly string[]) => ids.every(id => f.states.get(id)?.state === 'closed');
  // Level 1 waits on the Q1 fixes 4.5 names: a family word, a row's cells or ID, a C-CHECK row (a cite fix waits for level 2).
  const q1Fix = out.some(o => o.kind === 'fix' && !!o.table && Q1_TABLES.includes(o.table) && (o.text.startsWith('표현군') || /칸 수|행 ID|행 없음/.test(o.text)));
  // Review N3: a supplementary table's fix (a P row's ID or cells) is the supplementary request's to ask (4.5: Q1 and Q2 decide the detail).
  const level1 = settled(Q1_TABLES) && !q1Fix, level2 = level1 && settled(Q2_TABLES) && !out.some(o => !o.candidate && !supplementFix(o));
  return { level: level2 ? 2 : level1 ? 1 : 0, obligations: out.slice(0, 200) };
}

/* ---------- The key set a segment carries (12.4 (d)): only the B, F and E IDs its own text cites, as a closed set. ---------- */
/** A segment's keys: each B it cites with its name and one-line responsibility, each F with its path (and 읽음), each E with its grade and
 * source, as the folded record has them; an ID the record does not hold is left out (the segment's own text says it as written). */
export interface KeySet { record: string; parts: { id: string; name: string; does: string | null }[]; files: { id: string; path: string; read: string | null }[];
  evidence: { id: string; grade: string | null; source: string | null }[] }
const cut5 = (s: string, n: number) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length <= n ? t : `${t.slice(0, n - 1)}…`; };
/** The keys of the text cited within record (a whole page, or a piece of it a segment carries); null for a record of no v5 fold or a
 * text citing none of its IDs. */
export function segmentKeys(inputs: Iterable<{ record: string; text: string }>, record: string, cited: string): KeySet | null {
  const f = foldPages(inputs, 'newest-first').find(x => x.pages.some(p => p.record === record) || x.held.some(p => p.record === record)); if (!f) return null;
  const ids = [...new Set(cited.match(/(?<![A-Za-z0-9])[BFE]\d{1,3}(?![\d])/g) ?? [])];
  const parts = ids.filter(id => id.startsWith('B') && f.byId.get(id)?.table === 'C-PART').map(id => { const c = f.byId.get(id)!.row.byColumn;
    return { id, name: cut5(c['이름'] ?? '', 60), does: said5(c['하는 일 한 줄']) ? cut5(c['하는 일 한 줄']!, 80) : null }; });
  const files = ids.filter(id => id.startsWith('F') && f.ledger.files.has(id)).map(id => { const x = f.ledger.files.get(id)!; return { id, path: cut5(x.path, 120), read: x.read }; });
  const evidence = ids.filter(id => id.startsWith('E') && f.ledger.evidence.has(id)).map(id => { const x = f.ledger.evidence.get(id)!; return { id, grade: x.grade, source: x.source ? cut5(x.source, 80) : null }; });
  return parts.length || files.length || evidence.length ? { record, parts, files, evidence } : null;
}
