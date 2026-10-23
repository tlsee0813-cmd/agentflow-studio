// Build-selected static target, copied as client/static-target.js. This file is the existing browser demo.
// The prefix is applied to ALL store keys (local, per-tab session, legacy backups, conflict checks); never changed per build.
export interface StaticTarget { prefix:string; label:string; description:string }
export const STATIC_TARGET:StaticTarget={prefix:'agentflow.studio.browser-demo:',
  label:'브라우저 MOCK · AI 아님',
  description:'설치 없는 규칙 기반 체험입니다. 일반적인 자연어 이해는 하지 않으므로 작업문을 직접 확인·수정하세요. 입력은 이 브라우저에만 저장되며 서버 개발 모드의 기록과 분리됩니다.'};
