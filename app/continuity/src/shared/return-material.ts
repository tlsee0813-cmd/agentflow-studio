/* The UI62 development material as a small readable example: its three editorial parts as a map (areas only: no records,
 * tasks, returns or anchors) and its ten sources as reading material, read in the material's own three stages. The stages
 * add sources to read; they are not the times anything happened or arrived. */
import type { Project } from './types.js';
import { createProject, rename, setBrief, addArea } from './domain.js';
import { parseProject } from './validation.js';
import type { DigestKind } from './digest-api.js';
import { UI62_MATERIAL } from './return-material-data.js';

export const UI62_KEY = 'ex-ui62';
type RecordType = (typeof UI62_MATERIAL.records)[number]['type'];
const KIND: Record<RecordType, DigestKind> = {
  coordinator_direction: 'direction', authored_commit_description: 'authored', code_excerpt: 'code',
  retrospective_review_record: 'review', retrospective_verification_record: 'review', retrospective_acceptance_record: 'review'
};
const TYPE_LABEL: Record<RecordType, string> = {
  coordinator_direction: '방향 정정 기록', authored_commit_description: 'commit 본문 · 작성자 설명', code_excerpt: '코드 발췌',
  retrospective_review_record: '최종 결과 문서의 회고 · 독립 검토', retrospective_verification_record: '최종 결과 문서의 회고 · 검토와 검사',
  retrospective_acceptance_record: '최종 결과 문서의 회고 · 수용과 검사'
};

/** The material's parts as top-level areas, in the material's order; the notes are its editorial descriptions. */
export function buildUi62Project(): Project {
  let p = setBrief(rename(createProject(), 'AgentFlow UI62 개발 자료'),
    'AgentFlow Studio의 지도 읽기면·변경 비교·이름과 밀도를 다룬 UI62 개발 구간. 공개 commit과 결과 문서에서 사후 편집한 자료 10개로 읽는다.');
  for (const part of UI62_MATERIAL.parts) {
    const files = part.sourcePaths.map(x => x.split('/').at(-1)).join(', ');
    p = addArea(p, part.name, `${part.editorialDescription} 관련 파일: ${files}.`);
  }
  return parseProject(JSON.stringify({ ...p, notice: null }));
}
/** Stable keys of the parts (material order is the area order). */
export function ui62Keys(p: Project): Map<string, string> {
  const keys = new Map<string, string>();
  UI62_MATERIAL.parts.forEach((part, i) => { const area = p.space.areas[i]; if (area) keys.set(part.key, area.id); });
  return keys;
}

export interface MaterialSource { id: string; kind: DigestKind; title: string; text: string; note: string; basis: string; url: string; partKeys: string[] }
export const UI62_STAGES = UI62_MATERIAL.checkpoints.map(c => ({ id: c.id, label: c.label, basis: c.readingBasisSHA, sourceIds: [...c.sourceIds] as string[] }));
export function ui62Sources(stageId: string): MaterialSource[] {
  const stage = UI62_MATERIAL.checkpoints.find(c => c.id === stageId); if (!stage) throw new Error('STAGE_MISSING');
  const ids = new Set<string>(stage.sourceIds);
  return UI62_MATERIAL.records.filter(r => ids.has(r.id)).map(r => ({
    id: r.id, kind: KIND[r.type], title: r.title, text: r.text.publicExcerpt, note: r.text.editorialDescription,
    basis: `${TYPE_LABEL[r.type]} · ${r.sourceSHA.slice(0, 7)} · 공개 자료를 사후 편집`, url: r.sourceURL, partKeys: [...r.relatedPartKeys]
  }));
}
