/** Input and formatted-text limits shared by MCP admission, the PC mailbox and browser save/load. */
export const CONNECTOR_INPUT_LIMITS = Object.freeze({ title: 120, request: 20000, answer: 40000, files: 60, path: 1024, branch: 200 });
const L = CONNECTOR_INPUT_LIMITS;
// Full changed-file list (including separators), optional local header fields, and room for tool/time/RQ labels and punctuation.
export const CONNECTOR_TEXT_LIMIT = L.request + L.answer + L.files * (L.path + 2) + L.title + L.path + L.branch + 2048;
// JSON can escape each UTF-16 unit as six ASCII bytes. Reserve field names, array punctuation and client/project metadata too.
export const CONNECTOR_BODY_BYTES = CONNECTOR_TEXT_LIMIT * 6 + 4096;
