// PREVIEW35: `build-static.mjs --preview` copies this as client/static-target.js. Fixed preview-only prefix: it never
// reads, falls back to or copies the browser-demo keys. Moving data between them is an explicit backup file import.
export const STATIC_TARGET = { prefix: 'agentflow.studio.preview:',
    label: '미리보기 · 브라우저 MOCK · AI 아님',
    description: '최신 흐름을 미리 보는 규칙 기반 체험입니다. 실제 AI나 서버 실행이 아니므로 작업문을 직접 확인·수정하세요. 입력은 이 브라우저의 미리보기 전용 저장 공간에만 남고 기존 데모·서버 개발 모드의 기록과 섞이지 않습니다. 자료를 옮기려면 백업 파일을 직접 불러오세요.' };
