import { type ContextRequest, type Envelope, type GuideRequest, type GuideEnvelope } from '../shared/types.js';
import { type StorageLike } from '../shared/storage.js';

export interface RuntimeConfig {
  mode:'mock'|'deepseek'; configured:boolean; paidEnabled:boolean;
  label:string; description:string; consentVisible:boolean; notice:string|null;
}
// Default build: the existing server route, never a fallback to browser mock.
export const runtimeStorage=(storage:StorageLike):StorageLike=>storage;
export const runtimeFailure={notice:'서버 모드를 확인하지 못했습니다. 자동 AI 호출 없이 입력을 보존합니다.',label:'서버 연결 미확인',description:'서버 모드를 확인하지 못했습니다. 원문만 보관하거나 연결 설정을 확인한 뒤 새로고침하세요.'};
export async function loadConfig():Promise<RuntimeConfig> {
  const response=await fetch('/api/config');if(!response.ok)throw new Error();const value=await response.json();
  if(!['mock','deepseek'].includes(value.mode)||typeof value.configured!=='boolean'||typeof value.paidEnabled!=='boolean')throw new Error();
  return {...value,
    label:value.mode==='mock'?'MOCK · 체험 모드':value.configured&&value.paidEnabled?'DeepSeek · 요청 가능':'DeepSeek · 호출 꺼짐',
    description:value.mode==='mock'?'규칙 기반 모의 정리입니다. 실제 AI 해석이나 외부 전송 없이 화면 흐름을 시험합니다.':value.configured&&value.paidEnabled?'서버에 요청 설정이 있습니다. 실제 연결 성공은 아직 확인하지 않았으며, 아래 전송 동의 후 요청할 수 있습니다.':'서버에서 실제 AI 호출이 비활성화되어 있습니다. 원문 보관·직접 편집·파일 저장은 사용할 수 있습니다.',
    consentVisible:value.mode==='deepseek',
    notice:value.mode==='deepseek'&&(!value.configured||!value.paidEnabled)?'실제 AI 호출은 서버에서 잠겨 있습니다. 원문 보관·문맥 편집·저장·복구는 사용할 수 있습니다.':null};
}
export function requestAdvice(request:ContextRequest,signal:AbortSignal):Promise<Envelope> {return post('/api/continuity',request,signal) as Promise<Envelope>;}
/** GUIDE097: same server boundary and headers as the organise request. */
export function requestGuidance(request:GuideRequest,signal:AbortSignal):Promise<GuideEnvelope> {return post('/api/guidance',request,signal) as Promise<GuideEnvelope>;}
async function post(path:string,request:unknown,signal:AbortSignal):Promise<unknown> {
  const response=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json','X-AgentFlow-Request':'1'},body:JSON.stringify(request),signal});
  const raw=await response.text();let data;
  try {data=JSON.parse(raw);}catch {throw new Error('INVALID_RESPONSE');}
  if(!response.ok)throw new Error(typeof data?.error?.code==='string'?data.error.code:'REQUEST_FAILED');
  return data;
}
