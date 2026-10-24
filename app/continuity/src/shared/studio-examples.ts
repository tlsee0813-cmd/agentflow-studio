/* Example projects for the entry screen. They are built with the normal domain path (submit → markHandoff with a return id
 * and anchor → importResultFile with agentflow.return.2), so every return, anchor and description is the real receipt model.
 * The record texts are written examples of what a Codex/Claude session could send; nothing was executed. Never saved. */
import type { Project, RelationKind } from './types.js';
import { createProject, rename, setBrief, addArea, addChildArea, addRelation, editDraft, submit, markHandoff, handoffText, exportAnchor, taskOf, importResultFile } from './domain.js';
import { parseProject } from './validation.js';

interface PartSpec { key: string; name: string; note: string; parent?: string }
interface RecordSpec {
  part: string; minutesAgo: number; request: string;
  reply?: { minutesAgo: number; report: string; evidence?: string; summary?: string; changes?: string[]; proposal?: string; origin: string };
}
interface ExampleSpec { id: string; name: string; brief: string; parts: PartSpec[]; relations: [string, string, RelationKind, string][]; records: RecordSpec[] }

const iso = (now: number, minutesAgo: number) => new Date(now - minutesAgo * 60000).toISOString();

export function buildExample(spec: ExampleSpec, now = Date.now()): Project {
  let p = setBrief(rename(createProject(), spec.name), spec.brief);
  const ids: Record<string, string> = {};
  for (const part of spec.parts) {
    p = part.parent ? addChildArea(p, ids[part.parent]!, part.name, part.note) : addArea(p, part.name, part.note);
    ids[part.key] = p.space.areas.at(-1)!.id;
  }
  for (const [from, to, kind, note] of spec.relations) p = addRelation(p, ids[from]!, ids[to]!, kind, note);
  for (const r of spec.records) {
    p = submit(editDraft(p, r.request), undefined, ids[r.part]!);
    p.sources.at(-1)!.at = iso(now, r.minutesAgo);
    if (!r.reply) continue;
    const task = p.currentTaskId!, returnId = `H_${crypto.randomUUID()}`, anchor = exportAnchor(p, taskOf(p, task));
    p = markHandoff(p, task, handoffText(p, task, returnId), 'clipboard', p.revision, returnId, anchor);
    taskOf(p, task).handoffs.at(-1)!.at = iso(now, r.minutesAgo - 1);
    const before = p.sources.length, x = r.reply;
    const understanding = x.summary && anchor ? { version: 'understanding.1', areaId: anchor.areaId, basedOn: anchor.understanding,
      summary: x.summary, changes: x.changes ?? [], proposal: x.proposal ?? null, origin: x.origin } : null;
    p = importResultFile(p, JSON.stringify({ schemaVersion: 'agentflow.return.2', projectId: p.id, taskId: task, returnId,
      report: x.report, evidence: x.evidence ?? null, understanding }));
    for (const s of p.sources.slice(before)) s.at = iso(now, x.minutesAgo);
    const st = anchor ? p.space.understanding[anchor.areaId] : undefined;
    if (understanding && st) st.entries.at(-1)!.at = iso(now, x.minutesAgo);
  }
  return parseProject(JSON.stringify({ ...p, notice: null }));
}

export const EXAMPLES: ExampleSpec[] = [{
  id: 'salon', name: '동네 미용실 예약',
  brief: '동네 미용실 손님이 휴대폰으로 시술과 시간을 골라 예약하고, 원장님은 예약과 영업시간을 관리하는 사이트.',
  parts: [
    { key: 'book', name: '예약하기', note: '손님이 시술·날짜·시간을 골라 예약을 확정한다.' },
    { key: 'slots', name: '시간 고르기', note: '영업시간 안의 빈 시간만 고를 수 있게 보여 준다.', parent: 'book' },
    { key: 'menu', name: '시술 선택', note: '커트·펌·염색 중 고르고 걸리는 시간을 계산한다.', parent: 'book' },
    { key: 'confirm', name: '예약 확인', note: '고른 내용을 다시 보여 주고 확정 버튼을 둔다.', parent: 'book' },
    { key: 'notify', name: '문자 알림', note: '예약 확정·변경을 손님에게 문자로 알린다.' },
    { key: 'customer', name: '손님 정보', note: '이름과 전화번호만 받는다. 회원가입은 두지 않는다.' },
    { key: 'admin', name: '관리자 화면', note: '원장님이 예약과 영업시간을 관리한다.' },
    { key: 'list', name: '예약 목록', note: '오늘·이번 주 예약을 시간순으로 본다.', parent: 'admin' },
    { key: 'hours', name: '영업시간 설정', note: '요일별 영업시간과 휴무일을 정한다.', parent: 'admin' }
  ],
  relations: [
    ['book', 'notify', 'flow', '예약이 확정되면 문자를 보낸다.'],
    ['customer', 'confirm', 'needs', '확정할 때 이름·전화번호가 필요하다.'],
    ['hours', 'slots', 'needs', '빈 시간 계산에 영업시간·휴무일이 필요하다.'],
    ['confirm', 'list', 'shares', '같은 예약 데이터를 쓴다.']
  ],
  records: [
    { part: 'slots', minutesAgo: 5800, request: '예약 화면에서 영업시간 안의 빈 시간만 고를 수 있게 해줘. 이미 예약된 시간은 흐리게 보여줘.',
      reply: { minutesAgo: 5700, origin: 'Claude Code 세션 기록에서 정리',
        report: 'TimeSlotPicker에 영업시간(10:00–20:00) 필터를 넣었어요. 30분 단위로 나누고, 이미 예약된 칸은 disabled로 흐리게 표시합니다.\nslots.test.ts에 테스트 3개를 추가했어요.\n휴무일은 아직 처리하지 않았습니다.',
        summary: '영업시간(10:00–20:00) 안에서 30분 단위 빈 시간만 보여 준다. 이미 예약된 시간은 흐리게 표시되고 고를 수 없다. 휴무일은 아직 반영되지 않는다.',
        changes: ['영업시간 밖 시간은 목록에 나오지 않는다.', '예약된 시간은 흐리게 표시되고 고를 수 없다.'] } },
    { part: 'menu', minutesAgo: 4300, request: '시술을 고르면 걸리는 시간만큼 연속으로 비어 있는 시간만 보이게 해줘. 커트 30분, 펌 2시간, 염색 1시간 30분.',
      reply: { minutesAgo: 4240, origin: 'Codex 작업 기록에서 정리',
        report: 'services.ts에 시술별 소요 시간을 두고, 연속 빈 칸을 계산하는 findStartTimes()를 추가했어요. 펌을 고르면 2시간 연속으로 빈 시작 시각만 남습니다.\n가격 표시는 하지 않았어요.',
        evidence: '$ npm test -- slots\n✓ 커트 30분: 시작 가능 14개\n✓ 펌 2시간: 시작 가능 6개\n✓ 영업 종료 1시간 전에는 펌 시작 불가\n3 passed',
        summary: '커트 30분·펌 2시간·염색 1시간 30분 중 하나를 고르면, 그만큼 연속으로 빈 시간이 있는 시작 시각만 보인다. 가격은 아직 보이지 않는다.',
        changes: ['시술별 소요 시간에 맞춰 시작 가능한 시각만 남는다.'] } },
    { part: 'hours', minutesAgo: 2900, request: '원장님이 요일별 영업시간과 휴무일을 직접 정할 수 있는 설정 화면을 만들어줘.',
      reply: { minutesAgo: 2720, origin: 'Claude Code 세션 기록에서 정리',
        report: '/admin/hours 화면을 추가했어요. 요일별 시작·종료 시간 입력과 휴무일 달력이 있습니다.\n저장은 아직 브라우저 localStorage에만 해요. 서버 DB는 정해지지 않았습니다.\n손님 쪽 시간 고르기 화면은 아직 이 설정을 읽지 않습니다.',
        summary: '요일별 영업시간과 휴무일을 관리자 화면에서 정한다. 지금은 이 브라우저에만 저장되고, 손님의 시간 고르기 화면은 아직 이 설정을 쓰지 않는다.',
        changes: ['요일별 영업시간·휴무일 설정 화면이 생겼다.', '저장 위치(서버 DB)는 아직 정하지 않았다.'],
        proposal: '시간 고르기와 연결하기 전에 예약·영업시간을 어디에 저장할지(서버 DB) 먼저 정하자.' } },
    { part: 'confirm', minutesAgo: 1560, request: '예약 확인 화면에서 시술·날짜·시간·끝나는 시각을 보여주고, 확정 버튼을 눌러야 예약되게 해줘.',
      reply: { minutesAgo: 1500, origin: 'Claude Code 세션 기록에서 정리',
        report: 'ConfirmStep 컴포넌트를 추가했어요. 확정 전에는 예약이 저장되지 않고, 확정하면 예약 목록 데이터에 들어갑니다.\n이름·전화번호 입력은 손님 정보 부분이 정해지면 붙일 예정이에요.',
        summary: '고른 시술·날짜·시간과 끝나는 시각을 보여 주고, 확정 버튼을 눌러야 예약이 저장된다. 이름·전화번호 입력은 아직 없다.',
        changes: ['확정 버튼을 눌러야 예약이 저장된다.'] } },
    { part: 'list', minutesAgo: 300, request: '관리자 화면에 오늘 예약을 시간순으로 보여줘.',
      reply: { minutesAgo: 250, origin: 'Codex 작업 기록에서 정리',
        report: 'AdminBookings 목록을 추가했어요. 오늘 예약만 시간순으로 보여 줍니다. 손님 이름 칸은 비어 있어요.\n취소 처리와 이번 주 보기는 아직 없습니다.',
        summary: '오늘 예약을 시간순으로 보여 준다. 손님 이름은 아직 비어 있고, 이번 주 보기와 취소 처리는 없다.',
        changes: ['오늘 예약 목록이 시간순으로 보인다.'] } },
    { part: 'notify', minutesAgo: 50, request: '예약이 확정되면 손님에게 문자를 보내고 싶어. 문자 서비스는 아직 안 골랐어. 어떤 선택지가 있는지 먼저 비교해줘.' },
    { part: 'slots', minutesAgo: 35, request: "휴무일에는 시간 목록 대신 '휴무일이에요'를 보여줘.",
      reply: { minutesAgo: 20, origin: 'Claude Code 세션 기록에서 정리',
        report: "휴무일에 '휴무일이에요' 안내를 띄우도록 했어요.\n다만 영업시간 설정을 아직 읽지 못해서 휴무일은 코드에 월요일로 임시 고정했습니다. 설정 화면과 연결하려면 저장 위치가 먼저 정해져야 해요.",
        summary: "영업시간 안의 30분 단위 빈 시간만 보이고 예약된 시간은 흐리게 표시된다. 휴무일에는 '휴무일이에요' 안내가 나오지만, 휴무일은 지금 월요일로 임시 고정이다. 관리자 영업시간 설정과는 아직 연결되지 않았다.",
        changes: ["휴무일에 '휴무일이에요' 안내가 나온다 (월요일 임시 고정).", '관리자 영업시간 설정과는 아직 연결되지 않았다.'] } }
  ]
}, {
  id: 'ledger', name: '개인 가계부 앱',
  brief: '혼자 쓰는 가계부. 지출을 빠르게 적고, 한 달에 어디에 썼는지 한눈에 본다.',
  parts: [
    { key: 'entry', name: '지출 입력', note: '금액·분류·메모를 몇 번의 탭으로 적는다.' },
    { key: 'report', name: '월간 리포트', note: '분류별 합계와 지난달 대비 변화를 본다.' },
    { key: 'data', name: '데이터 보관', note: '기기 안에 저장하고 필요하면 파일로 옮긴다.' },
    { key: 'local', name: '기기 저장', note: 'IndexedDB에 저장한다.', parent: 'data' },
    { key: 'export', name: '파일 내보내기', note: 'CSV로 내보내고 다시 불러온다.', parent: 'data' }
  ],
  relations: [['entry', 'local', 'flow', '입력한 지출을 저장한다.'], ['local', 'report', 'flow', '저장된 지출로 합계를 낸다.']],
  records: [
    { part: 'entry', minutesAgo: 3000, request: '지출 입력 화면을 만들어줘. 금액 키패드와 자주 쓰는 분류 6개 버튼.',
      reply: { minutesAgo: 2950, origin: 'Claude Code 세션 기록에서 정리',
        report: 'EntryScreen을 추가했어요. 숫자 키패드와 분류 버튼 6개(식비·교통·카페·생활·문화·기타). 메모는 선택 입력입니다.',
        summary: '숫자 키패드로 금액을 넣고 분류 버튼 6개 중 하나를 고르면 지출이 기록된다. 메모는 선택이다.', changes: ['지출 입력 화면이 생겼다.'] } },
    { part: 'local', minutesAgo: 1400, request: '입력한 지출을 IndexedDB에 저장해서 앱을 껐다 켜도 남게 해줘.',
      reply: { minutesAgo: 1380, origin: 'Codex 작업 기록에서 정리',
        report: 'db.ts에 expenses 저장소를 만들고 입력 시 저장하도록 했어요. 새로고침 후에도 목록이 유지됩니다.',
        summary: '지출은 IndexedDB의 expenses 저장소에 남아 앱을 다시 열어도 유지된다.', changes: ['지출이 기기에 저장된다.'] } },
    { part: 'report', minutesAgo: 90, request: '이번 달 분류별 합계를 막대 그래프로 보여줘.' }
  ]
}];

/** Stable address keys of an example's parts: the spec keys, independent of shown names and of the random ids a fresh
 * build gets. buildExample creates the areas in spec order and nothing else adds any, so the n-th area is the n-th spec part. */
export function exampleKeys(exampleId: string, p: Project): Map<string, string> {
  const spec = EXAMPLES.find(e => e.id === exampleId), keys = new Map<string, string>();
  if (!spec) return keys;
  spec.parts.forEach((part, i) => { const area = p.space.areas[i]; if (area) keys.set(part.key, area.id); });
  return keys;
}
