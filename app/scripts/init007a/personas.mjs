import { readFile } from 'node:fs/promises';
import { createProject, editBrief } from '../../dist/public/shared/project.js';
export const personas = Object.freeze(JSON.parse(await readFile(new URL('../../fixtures/init007a/personas.json', import.meta.url), 'utf8')));
export function personaById(id) {
  const persona = personas.find(p => p.id === id);
  if (!persona) throw new Error('UNKNOWN_PERSONA');
  return structuredClone(persona);
}
/** Synthetic seed data, NOT an earlier provider conversation or a user approval. */
export function initialState(persona) {
  const state = editBrief(createProject(), persona.brief);
  for (const seed of persona.lockedRequirements) {
    const sourceId = `S-fixture-${persona.id}-${seed.topic}`;
    state.sources.push({id:sourceId,kind:'customer-confirmation',text:seed.evidence,atVersion:state.version});
    state.requirements.push({id:`${state.id}:REQ-${seed.topic}`,scope:'user-project',topic:seed.topic,kind:'constraint',
      text:seed.text,acceptance:seed.acceptance,priority:'must',status:'confirmed',origin:'customer',
      sourceIds:[sourceId],version:state.version,locked:true,needsReview:false});
  }
  return state;
}
