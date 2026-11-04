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
  rows?: number; note?: string }
const common = (id: string, title: string, chunk: 0 | 1 | 2, columns: string[]): TableDef => ({ id, title, columns: Object.freeze(columns), chunk, profile: false });
export const COMMON_TABLES: readonly TableDef[] = Object.freeze([
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
export const TABLE_DEFS: ReadonlyMap<string, TableDef> = new Map([...COMMON_TABLES, ...PROFILE_TABLES].map(t => [t.id, t]));
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
export type RecordVersion = 'v4' | 'v3-status' | 'v1-design';
export interface ChunkHead { recordId: string; chunk: number; basis: string; title: string; from: number; to: number }
export interface RecordRow { from: number; to: number; cells: TableCell[];
  /** The row's cells by column: the v4 column name (a v3 column by its v4 name, 4.2), or the header as written for a column the table
   * does not define; the cell's text. */
  byColumn: Readonly<Record<string, string>>;
  /** The cells of the columns the table does not define, by their header as written. */
  extra: Readonly<Record<string, string>> }
export interface RecordTable { id: string; title: string;
  /** v4: a 「C-… 제목」 title line; v3: a numbered heading the v3 title map names. */
  dialect: 'v4' | 'v3'; known: boolean; header: string[];
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
export interface RecordDiagnostic { rule: 'contract'; category: 'row-cells' | 'unknown-table' | 'unknown-column' | 'missing-column' | 'chunk-head'; table: string | null; column: string | null; from: number; to: number }
export interface RecordFocus { profiles: string[]; reason: string | null; tables: string[]; none: boolean; text: string; from: number; to: number }
export interface PathPromise { basis: string | null; aliases: Map<string, string>; text: string; from: number; to: number }
export interface RecordTables { version: RecordVersion | null; chunk: ChunkHead | null; tables: RecordTable[];
  /** The tables by ID (a table written twice keeps both, in order). */
  byId: ReadonlyMap<string, RecordTable[]>;
  focus: RecordFocus | null; promise: PathPromise | null;
  /** 「덩이 2는 「이어서」에」: the session stopped after chunk 1 and waits for 「이어서」. */
  awaitsNext: boolean; diagnostics: RecordDiagnostic[] }

/** Which record a text is (4.1): v4 when its first line says 「기록 v4」 or a chunk head stands in it; a v3 status report by 「현황 보고서
 * (v3 표 형식」; a v1 design record by 「설계 기록」 on its first line; null otherwise. Never by its 「경로 약속:」 line (every v4 chunk has one). */
export function recordVersion(text: string): RecordVersion | null {
  const first = text.trimStart().split(/\r?\n/, 1)[0] ?? '';
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
/** A pasted answer split at its chunk heads (4.1): one text per chunk, each from its head line; what stands before the first head goes
 * with the first chunk. A text with no chunk head is one text. */
export function splitRecordChunks(text: string): string[] {
  const lines = text.split('\n'), heads = lines.flatMap((l, i) => CHUNK_HEAD.test(l.trim()) ? [i] : []);
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
function matchColumns(def: TableDef | null, header: readonly string[], dialect: 'v4' | 'v3'): { columns: (string | null)[]; missing: string[]; extra: string[] } {
  const wanted = new Map((def?.columns ?? []).map(c => [columnKey(c), c]));
  const columns = header.map(h => { const k = columnKey(h); return wanted.get(k) ?? (dialect === 'v3' ? V3_COLUMNS.get(k) ?? null : null); });
  const missing = def && dialect === 'v4' ? def.columns.filter(c => !columns.includes(c)) : [];
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
  const version = recordVersion(text), chunk = chunkHead(text);
  for (const raw of text.split('\n')) {
    const start = offset; offset += raw.length + 1;
    const line = raw.trim();
    if (!line.startsWith('|')) {
      if (!line) continue;
      const lineFrom = start + raw.indexOf(line);
      focus ??= readFocus(raw, start); if (!promise && PROMISE_LINE.test(line)) promise = readPromise(raw, start);
      if (LATER_LINE.test(line)) awaitsNext = true;
      // A v4 record titles its tables by ID; a numbered line in it is no v3 heading.
      const title = CHUNK_HEAD.test(line) ? null : TITLE_LINE.exec(line), heading = title || version === 'v4' ? null : V3_HEADING.exec(line);
      if (title || heading) {
        const id = title ? title[1]! : v3TableId(heading![1]!);
        const known = !!id && (TABLE_DEFS.has(id) || id === PARTTYPE_TABLE);
        open = { id: id ?? `?${tables.length + 1}`, title: (title ? title[2]! : heading![1]!).trim(), dialect: title ? 'v4' : 'v3', known, header: [], columns: [], missing: [], extra: [], rows: [], none: null, from: lineFrom, to: lineFrom + line.length, body: [] };
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
      const def = TABLE_DEFS.get(open.id) ?? null, m = matchColumns(def, open.header, open.dialect);
      open.columns = m.columns; open.missing = m.missing; open.extra = m.extra; open.to = lineFrom + line.length;
      if (open.dialect === 'v4') {
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
  const byId = new Map<string, RecordTable[]>();
  for (const t of tables) byId.set(t.id, [...byId.get(t.id) ?? [], t]);
  const out: RecordTables = { version, chunk, tables, byId, focus, promise, awaitsNext, diagnostics };
  if (cache.size > 256) cache.delete(cache.keys().next().value!);
  cache.set(text, out);
  return out;
}

/* ---------- The one entry for the program's passes (4.2 rowsOf). ---------- */
/** A data row as the passes read it: its record, table and place; its cells and header as the v3 passes read them (the v4 columns a
 * v3 pass names under their v3 names: C-STEP's 부분 이름 from its 행 ID B03:S02, C-RULE without who decided and what keeps it, C-PART
 * without its 행 ID, C-DATA's 있는 곳 without its 쓰기 방식), and its cells by column. */
export interface TableRow { record: string; id: string; dialect: 'v4' | 'v3'; from: number; to: number; cells: string[]; header: string[];
  byColumn: Readonly<Record<string, string>>; row: RecordRow; table: RecordTable }
type Texts = Iterable<[string, { text: string }]>;
const rowsCache = new WeakMap<object, Map<string, TableRow[]>>();
/** A record group's own references (4.4 ID 약속): a part's 행 ID (B03) → its name, by recordId (a chunk head's), else by record. */
export interface RecordRefs { parts: Map<string, string>; group: string }
const groupOf = (record: string, t: RecordTables): string => t.chunk ? `id:${t.chunk.recordId}` : `record:${record}`;
export function recordRefs(texts: Texts): Map<string, RecordRefs> {
  const byGroup = new Map<string, Map<string, string>>(), out = new Map<string, RecordRefs>();
  const all = [...texts].map(([record, { text }]) => [record, readRecordTables(text)] as const);
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
    if (!want.has(table.id)) continue;
    for (const row of table.rows) {
      const view = table.dialect === 'v4' ? v3View(table.id, row, table.header, refs?.get(record)) : { cells: row.cells.map(x => x.text), header: table.header };
      out.push({ record, id: table.id, dialect: table.dialect, from: row.from, to: row.to, cells: view.cells, header: view.header, byColumn: row.byColumn, row, table });
    }
  }
  if (!memo) { memo = new Map(); rowsCache.set(texts, memo); }
  memo.set(key, out); return out;
}
/** The same for plain texts (the record's own text, with no alias): each by its index. */
export const rowsOfTexts = (texts: Iterable<string>, ids: readonly string[]): TableRow[] => rowsOf([...texts].map((text, i) => [`#${i}`, { text }] as [string, { text: string }]), ids);

/* ---------- The fixed values of the v4 columns (2.3, 3.1), for the parser and the paste check. ---------- */
export const IMPLEMENTATION_WORDS: Readonly<Record<string, 'built' | 'partial' | 'unbuilt' | 'removed' | 'unknown' | null>> = Object.freeze({ 구현됨: 'built', '일부 구현': 'partial', 미구현: 'unbuilt', 제거됨: 'removed', 모름: 'unknown', '해당 없음': null });
export const TYPE_WORDS: Readonly<Record<string, string | null>> = Object.freeze({ 사람: 'person', 세션: 'session', '루프·엔진': 'loop', '행 파일·저장소': 'store', 'AI 판단': 'ai', '타이머·일정': 'timer',
  계산: 'compute', 수집기: 'collector', '집행·외부 호출': 'actor', 화면: 'screen', '빌드·배포 자동화': 'automation', '외부 시스템': 'external', 모름: null });
export const GROUP_WORDS: Readonly<Record<string, 'place' | 'composition' | 'participants' | 'boundary' | 'members' | null>> = Object.freeze({ '실행 위치': 'place', 구성: 'composition', 참여자: 'participants', 외부: 'boundary', 목록: 'members', 모름: null });
export const CADENCE_WORDS: Readonly<Record<string, 'once' | 'call' | 'each' | 'periodic' | 'event' | 'end'>> = Object.freeze({ '한 번': 'once', 호출마다: 'call', 항목마다: 'each', 주기: 'periodic', '사건 때': 'event', '끝에 한 번': 'end' });
export const CROSS_WORDS: Readonly<Record<string, 'same' | 'child' | 'process' | 'network' | 'person' | null>> = Object.freeze({ '같은 프로세스': 'same', '자식 프로세스': 'child', '프로세스 사이': 'process', 네트워크: 'network', 사람: 'person', 모름: null });
export const STATUS_DIMENSIONS: Readonly<Record<string, 'release' | 'deploy' | 'activation' | 'maintenance' | 'operation'>> = Object.freeze({ 릴리스: 'release', 배포: 'deploy', '활성 방식': 'activation', '유지 방침': 'maintenance', '운영 상태': 'operation' });
export const STATUS_VALUES: Readonly<Record<'release' | 'deploy' | 'activation' | 'maintenance' | 'operation', Readonly<Record<string, string>>>> = Object.freeze({
  release: { 릴리스됨: 'released', 미릴리스: 'unreleased', 회수됨: 'recalled', 모름: 'unknown' },
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
