# IDEA016 rev1 저장소 공개 범위

이 폴더는 IDEA016 rev1의 실험 도구9파일을 보존한다. IDEA017에서는 tool.test.mjs의 관련 검사를 원문대로 갱신했고 실행 도구·사례는 그대로다. README와 CLOUD_HANDOFF의 `source/`는 GitHub checkout의 저장소 루트에 해당한다. 빌드는 루트에서 `cd app` 후 두 앱 build를 실행하고, `cd ..` 후 `node --test experiments/idea016/tool.test.mjs` 또는 실험 CLI를 실행한다. 무상 검사에는 원문 안내대로 호출 키를 빈 값으로 지정하고 `ALLOW_PAID_AI=false`를 사용한다. 호출 설정·질문별 합성 답변·상한은 원문 문서를 따른다.

기준169파일은 저장소의 `app/`와 기존 공유 자료로 보존되며 이번 실험 게시에서 수정하지 않았다. 전체 baseline 지문·작성자 검증·rev1 focused 기록·rev0 mock-smoke 증거는 별도의 검증 ZIP에 있다. 문서의 `evidence/` 경로와 압축 최상위 인계 자료는 GitHub에 게시하지 않았으므로 이 checkout에서 해당 과거 증거 파일을 찾을 수 없다. 설치 패키지·빌드 산출물은 checkout 후 생성해야 한다.

실제 호출 기록·원문 응답·키·환경 파일·ZIP은 게시 범위에 포함하지 않는다. 도구는 headless 앱 domain/localhost HTTP 경로를 사용하며 새 브라우저 UI 검사가 아니다. 가짜 키 회귀는 실제 API 키나 실제 제공업체 품질 결과가 아니다. rev1 baseline14회와 IDEA017 재평가15회의 결과는 [IDEA016 결과](../../docs/research/idea016-results.md), [IDEA017 결과](../../docs/research/idea017-results.md)에 구분한다. IDEA017의 최상위 인계·manifest·검증 증거·전체 run은 별도 검증 ZIP에 있으며 이 저장소에는 변경된 앱4파일·검사3파일과 짧은 결과 요약을 게시한다. 실행 완료를 내용 품질이나 고객 효용 합격으로 해석하지 않는다.
