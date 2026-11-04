/* What a part's lines are about, read in the order a person asks about a part: what runs now, what changed, what is wrong or
 * unknown, what was withdrawn or decided, what it must keep, what is planned, how it is built. A map-reading.7 claim says its
 * topic, its evidence grade and its time itself; an earlier claim has only its kind (who said it, how) and its words, so the
 * topic is derived from those here, once, in one place. Nothing here changes a claim: it only chooses where it is read and what
 * is written beside it. */
import type { Channel, ClaimKind, ClaimTopic, EvidenceGrade, PartState, PartType, ReadingClaim, RelationMode } from './types.js';

/** The headings the pane reads the topics under, in the order it reads them. */
export const TOPIC_ORDER: readonly ClaimTopic[] = ['status', 'change', 'defect', 'unknown', 'withdrawn', 'decision', 'rule', 'plan', 'how'];
export const TOPIC_LABEL: Record<ClaimTopic, string> = { status: '지금', change: '바뀐 것', defect: '문제', unknown: '모름', withdrawn: '철회된 것', decision: '정한 것', rule: '지켜야 할 것', plan: '예정', how: '구조·동작' };
/** What each heading holds, for the title of the heading. */
export const TOPIC_HINT: Record<ClaimTopic, string> = {
  status: '기록이 말한 이 부분의 최신 상태', change: '기록이 만들었다·바꿨다고 말한 것', defect: '결함·오류·어긋남', unknown: '기록이 확인하지 못했다고 남긴 것',
  withdrawn: '전에 정했다가 거둔 것 (전 → 지금)', decision: '정해진 것', rule: '지켜야 할 요구·금지', plan: '하기로 한 것 · 아직 아님', how: '어떻게 돌아가는지 적힌 설명'
};
export const EVIDENCE_LABEL: Record<EvidenceGrade, string> = { file: '파일', run: '실행', report: '보고', guess: '추정', unknown: '모름' };
/** What each grade means (the title of the chip). */
export const EVIDENCE_HINT: Record<EvidenceGrade, string> = { file: '작성자가 파일을 직접 읽었다고 표시', run: '작성자가 직접 실행한 결과', report: '다른 세션·문서·사람의 말을 옮김', guess: '작성자의 판단', unknown: '작성자가 모른다고 남김' };
export const STATE_WORD: Record<PartState, string> = { running: '돌고 있음', working: '작업 중', unbuilt: '미구현', stopped: '멈춤', retired: '폐기', unknown: '모름' };
export const MODE_LABEL: Record<RelationMode, string> = { design: '설계', observed: '관찰' };
/** map-reading.8: the type word a card shows (small, over the name) and what a line is said to carry. */
export const TYPE_LABEL: Record<PartType, string> = { collector: '수집기', compute: '계산', ai: 'AI 판단', loop: '루프·엔진', timer: '타이머·일정', actor: '집행·외부 호출', store: '보관소', person: '사람', session: '세션', external: '외부 시스템' };
/** A card's family (map design v3 3.1), from the type word alone, never from a name or an inside: a participant (a person, a
 * session, an external system); a process (a collector, a computation, an actor, a loop or engine, and an AI judgement: it takes
 * inputs and hands over a verdict); a store (a ledger); a trigger or gate (a timer or schedule). A part with no type word is
 * neutral (card-family familyOf). An inside (steps, a composition) is a capability joined to the family (card-family innerOf),
 * never a family of its own. */
export type PartFamily = 'participant' | 'process' | 'store' | 'trigger';
export const FAMILY_OF: Record<PartType, PartFamily> = { collector: 'process', compute: 'process', ai: 'process', actor: 'process', loop: 'process', timer: 'trigger', store: 'store', person: 'participant', session: 'participant', external: 'participant' };
export const CHANNEL_LABEL: Record<Channel, string> = { data: '데이터', control: '제어', uses: '참조' };

const WITHDRAWN = /철회|폐기|채택하지 않|채택 안|취소했|거뒀|되돌렸|더는 .*않/;
const UNKNOWN = /\[모름\]|확인하지 못|확인되지 않|보지 못했|읽지 못했|모른다|알 수 없|확인 못/;
const DEFECT = /결함|오류|실패|깨짐|잘못|버그|어긋|INVALID|거짓 실패|반쪽|끊김|지연 몰림/;
const CHANGE = /정정|바뀌었|바꿨|변경됐|변경했|설치했|고쳤|삭제했|추가했|옮겼|제거했|교체했/;
const PLAN = /계획|예정|할 것이다|하기로 했|다음 .*묶음|이후에|나중에|앞으로|미구현/;
// A report that states a bound or a prohibition is a rule the part must keep, not its present state ("지출 상한은 … 이하").
const RULE = /상한|하한|이하여야|이하이다|이하다|금지|허가|해야 한다|해야 하며|않는다|않아야|지켜|원칙|조건이다/;
/** The topic of a claim: its own when it says one; else from its kind and its words. open: left to the person, read as unknown;
 * differs: the record and the person disagree, read as a problem; idea: a plan; want: a plan when it says so, else a rule; a
 * description is a withdrawal, a change or how it is built; a report or a check is an unknown, a withdrawal, a defect, a change, a rule
 * (a bound or a prohibition it states), a plan or the state. Words decide only where no topic was read. */
export function claimTopic(c: Pick<ReadingClaim, 'kind' | 'text'> & { topic?: ClaimTopic | null }): ClaimTopic {
  if (c.topic) return c.topic;
  const t = c.text, kind: ClaimKind = c.kind;
  if (kind === 'open') return 'unknown';
  if (kind === 'differs') return 'defect';
  if (kind === 'idea') return 'plan';
  if (kind === 'want') return PLAN.test(t) ? 'plan' : 'rule';
  if (kind === 'describes') return WITHDRAWN.test(t) ? 'withdrawn' : PLAN.test(t) ? 'plan' : CHANGE.test(t) ? 'change' : RULE.test(t) ? 'rule' : 'how';
  if (UNKNOWN.test(t)) return 'unknown';
  // A decision the record took back reads as a withdrawal even when it names an error ("측정 오류로 판명돼 … 채택하지 않았다").
  if (WITHDRAWN.test(t)) return 'withdrawn';
  if (DEFECT.test(t)) return 'defect';
  if (CHANGE.test(t) && !RULE.test(t)) return 'change';
  if (RULE.test(t)) return 'rule';
  if (PLAN.test(t) && !/보고됐|보고됨|했다고/.test(t)) return 'plan';
  return 'status';
}
/** The evidence grade of a claim: its own when it says one; else the author's tag inside the very passage it rests on ([파일],
 * [실행], [보고]/[대화], [추정], [모름]); null when the passage carries none. */
export function claimEvidence(c: Pick<ReadingClaim, 'quote'> & { evidence?: EvidenceGrade | null }): EvidenceGrade | null {
  if (c.evidence) return c.evidence;
  const q = c.quote;
  if (/\[파일/.test(q)) return 'file';
  if (/\[실행/.test(q)) return 'run';
  if (/\[보고|\[대화|\[붙임/.test(q)) return 'report';
  if (/\[추정/.test(q)) return 'guess';
  if (/\[모름/.test(q)) return 'unknown';
  return null;
}
const TIME = /^(?:\d{4}-)?\d{1,2}-\d{2}(?:\s+\d{1,2}:\d{2}(?::\d{2})?Z?)?$|^\d{1,2}:\d{2}Z$|^\d{4}-\d{2}-\d{2}/;
/** When a claim is about: its own time when it says one; else its 'about' when that reads as a date or a time (a version or a sha
 * is not a time); else null. */
export function claimWhen(c: Pick<ReadingClaim, 'about'> & { when?: string | null }): string | null {
  if (c.when) return c.when;
  const a = c.about?.trim(); return a && TIME.test(a) && a.length <= 24 ? a : null;
}
/** Claims grouped under their topics in reading order; each group keeps the claims' own order (newest reading first). */
export function claimsByTopic<T extends Pick<ReadingClaim, 'kind' | 'text'> & { topic?: ClaimTopic | null }>(claims: readonly T[]): { topic: ClaimTopic; list: T[] }[] {
  const groups = new Map<ClaimTopic, T[]>();
  for (const c of claims) { const t = claimTopic(c); const g = groups.get(t); if (g) g.push(c); else groups.set(t, [c]); }
  return TOPIC_ORDER.flatMap(topic => { const list = groups.get(topic); return list ? [{ topic, list }] : []; });
}
