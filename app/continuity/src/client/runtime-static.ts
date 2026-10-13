import { type ContextRequest, type Envelope } from '../shared/types.js';
import { type StorageLike } from '../shared/storage.js';
import { validateRequest, validateAdvice } from '../shared/validation.js';
import { mockAdvice } from '../shared/mock.js';
import { type RuntimeConfig } from './runtime.js';

// Build-selected adapter. Prefix ALL store keys, including legacy backups/conflict checks.
const prefix='agentflow.studio.browser-demo:';
export const runtimeStorage=(storage:StorageLike):StorageLike=>({
  getItem:key=>storage.getItem(prefix+key),
  setItem:(key,value)=>storage.setItem(prefix+key,value)
});
export const runtimeFailure={notice:'브라우저 체험을 시작하지 못했습니다. 입력은 보존하며 다른 정리 방식으로 자동 전환하지 않습니다.',label:'브라우저 체험 확인 불가',description:'원문 보관·직접 편집·백업을 이용할 수 있습니다.'};
export async function loadConfig():Promise<RuntimeConfig> {
  return {mode:'mock',configured:true,paidEnabled:false,consentVisible:false,notice:null,
    label:'브라우저 MOCK · AI 아님',
    description:'설치 없는 규칙 기반 체험입니다. 일반적인 자연어 이해는 하지 않으므로 작업문을 직접 확인·수정하세요. 입력은 이 브라우저에만 저장되며 서버 개발 모드의 기록과 분리됩니다.'};
}
export async function requestAdvice(request:ContextRequest,signal:AbortSignal):Promise<Envelope> {
  signal.throwIfAborted();
  const checked=validateRequest(request);
  const advice=validateAdvice(mockAdvice(checked),checked.bases.map(b=>b.id));
  signal.throwIfAborted();
  return {mode:'mock',ticket:checked.ticket,advice};
}
