# Boundary83 long-context stress fixture

`long-context.json` is an authored UI stress case, not a new model response or an actual OSS architecture. It derives from the unchanged public `../context75/micro-javascript-backup.json` (SHA256 `aaffb3764afc68f054d05ff54f4e2b5bf72b5b0abfc259d0bfc1deda666f8065`) through normal domain operations. Five synthetic ancestor names each contain sixteen W characters; a synthetic external target and one needs relation are added. Existing source excerpts and model readings belong to the original saved response, not the added synthetic parts.

Normal backup import → JSContext.eval 평가 API → enter its scope (`A_e0b75f15-9f2e-4af6-9d95-a6562db23680`). The synthetic external target is `A_4e6562bf-b303-4bb2-9991-868d36fa6111`.

Root CUA observation on the 2ad9b64 Windows/TypeScript5.8.3 build, 1280×720 at 100%: the long caption is 300px wide, y292, actual height80px; the target starts at y360, overlapping by12px. The layout reserved68px (four lines plus4px), while word wrapping produced five lines. An eighteen-W variant independently fit with a4px gap; it does not disprove this boundary case. bdff690 does not change the caption layout code. No fixture content was truncated to pass a test.

Fixture SHA256: `9921363b8475ab7a25bd6c11de7880865ab5e30a2ef46cf2f992efee43efdfdd`.
