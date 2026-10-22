# Description refresh27 — task-reader editor close fix1

This is a UI-only delta from preserved v0 `5dcf269bd7f25dec3f6432fb3386adb23c89d526`. `candidate-fix1-source/app.ts` is frozen at SHA256 `55be6a0a47f4a116a3a19593320e09d3820bb5c46b07250dfda25efd78ccb691`, Git blob `2fdc74d9451c550367f12fd79344e2ed510ba9fb`,264518 bytes. Domain remains v0 SHA256 `98291a502fb90225b58286130336e8060130c56a45eda6e0ce7963bb594760bf`.

Cancel and successful save call the same ending function. It closes the editor and synchronously marks only its current task/read-return disclosure memo closed, then clears the editor token and draft. A pending native toggle can no longer cause `keepReadOpen` to restore that ended editor as open without a token. Other disclosure state, context guard and description-recording rules are unchanged.

`fix1-continuity-check.*`, `fix1-continuity-build.*` and `fix1-diff-check.*` each record exit0 under Node24.19.0 author auxiliary. The unchanged domain's99/99 pure tests were not repeated for this UI-only change. `candidate-fix1-only.patch` preserves the v0 delta; `candidate-fix1.patch` preserves the full baseline delta. Independent source review and actual Cloud task-reader cancel/save-close interaction are separate acceptance steps.

No local server/browser, dependency install, schema change or remote write was performed.
