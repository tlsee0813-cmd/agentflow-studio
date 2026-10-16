# Local static MOCK only — no public deployment
Exact build source:9613208f40f1f7f8506504ac6025f06e421edd4d app/continuity/scripts/build-static.mjs. Build command is recorded as regressioncommand9. It compiles the existing isolated runtime-static adapter, removes server consent UI, inserts CSP connect-src 'none', copies only client/shared/css/html. No provider/server/config/key files included; no endpoint or private configuration required. shared/mock.js is deterministic local MOCK.

From this evidence prefix:
`python -m http.server 8123 --bind 127.0.0.1 --directory preview/runtime`
Open local server root in PC browser; choose '백업 파일 불러오기' and select `preview/safe-import.json`. It is synthetic introduction/notification data with A/R and B/RB, three areas and unsent report; not user data or real execution evidence. It creates an isolated browser-local project; no send is necessary. The fixture is intentionally labelled through this document, not a product feature. Static localStorage namespace is distinct from server product storage.

Every runtime file and fixture hash/size is in root MANIFEST.tsv. This preview was checked via actual Chromium→loopbackHTTP and normal import/read/return (preview/evidence/result.json). The process used an ephemeral port;8123 is a suggested local startup port, not an already-running/published service. Stop withCtrl+C. Opening file:// is not the tested method.
