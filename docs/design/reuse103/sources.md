# 읽은 자료와 적용 경계

확인일·우리 조건 재검토일: **2026-10-15 KST**. 최신 API 조회는 당시 상태이며 판 고정 소스와 다르다. 원문 날짜가 없는 README에 확인일을 발행일처럼 붙이지 않는다. 이번 신규 제품/OSS 조사는 **Papa Parse, csv-parse, MADR 세 개**다. 소스 경계까지 읽은 파서는 두 개다. 기존 참고 연구는 새 제품 후보로 늘리지 않았다.

## 먼저 읽은 기존 기록

- [REUSE096](https://github.com/tlsee0813-cmd/agentflow-studio/blob/df5e1f666e3bfe9e4e275de711994eba252cfacb/docs/research/reuse096-practical-guide.md): 원문 작성 2026-10-15 KST. 선택적 지침, 후보 최대 2개, 현재 요청/금지 우선, 후보·결정·사용·검사 분리, 과거 원문 보존을 이어받음. 여기에 인용된 개발자 경험 3건을 재조사하거나 수요 입증으로 쓰지 않음.
- [SPATIAL101/102 README](https://github.com/tlsee0813-cmd/agentflow-studio/blob/df5e1f666e3bfe9e4e275de711994eba252cfacb/docs/design/spatial101/README.md): 원문 작성 2026-10-15 KST. 4·9·10절의 영역 정보 안 접힌 참고 후보, 문서 대장 우선, 보기/요청/실행 분리, 판/적합성 날짜 분리를 이번 사례로 구체화. 이 파일은 기본 브랜치에 없어서 사용자 지정 커밋으로 읽음.
- 제품 기준: `2a40ac3d7079b3984856b87abd4e085b43d35aa7`. 공개체험은 사용자 설명상 정적 MOCK. 웹 조사 도구로 공개 URL 열기는 실패했으므로 공개 화면을 직접 관찰했다고 쓰지 않음. 기준 제품 코드를 수정하거나 현재 실행 품질을 검증하지 않음.

## 1. Papa Parse — 브라우저 입력을 포함한 작은 파싱 경계

- [최신 GitHub release 조회](https://api.github.com/repos/mholt/PapaParse/releases/latest): `5.7.0`, 원문 게시 **2026-08-24 23:29 KST**. 태그 commit `555c1c1b6175e7a043adf8694983776a1e6fdeeb`.
- 읽은 소스는 release와 별개인 기본 브랜치 commit **`e78dddce4764a3465e86f3a2fddd0a1bcfc854be`**, 원문 commit **2026-10-09 16:57 KST**. README 개별 발행일은 확인하지 않음. 실제 도입 시 이 SHA와 배포 패키지의 대응을 다시 확정해야 함.
- [README L4–18](https://github.com/mholt/PapaParse/blob/e78dddce4764a3465e86f3a2fddd0a1bcfc854be/README.md#L4): 로컬 파일·worker 지원 설명. [papaparse.js L164–171, L672–727](https://github.com/mholt/PapaParse/blob/e78dddce4764a3465e86f3a2fddd0a1bcfc854be/papaparse.js#L672): File 입력을 FileStreamer로 보내 Blob을 읽고 FileReader.readAsText에 encoding을 넘김. 파일 2MB·2,000행 제한은 앱의 책임.
- [L1684–1734](https://github.com/mholt/PapaParse/blob/e78dddce4764a3465e86f3a2fddd0a1bcfc854be/papaparse.js#L1684): 중복 헤더를 suffix로 바꾸고 renamedHeaders에 남김. 이 동작은 ‘중복 헤더 거부’와 다르다. 원래 헤더 또는 rename 정보로 별도 거부가 필요하다. 담당자가 이 구간을 직접 다시 읽어 Luna 분석과 대조함.
- [L1224–1255](https://github.com/mholt/PapaParse/blob/e78dddce4764a3465e86f3a2fddd0a1bcfc854be/papaparse.js#L1224): header 모드의 TooManyFields/TooFewFields는 결과 오류에 기록됨. 앱은 오류를 반영 금지로 연결해야 한다.
- [L712–727](https://github.com/mholt/PapaParse/blob/e78dddce4764a3465e86f3a2fddd0a1bcfc854be/papaparse.js#L712): 조각별 문자 읽기. Shift-JIS 다중바이트 문자가 조각 경계에 걸리는 경우를 후속 시험 항목으로 선정. **코드에서 도출한 위험 가설이며 재현한 결함이 아님.**
- [LICENSE](https://github.com/mholt/PapaParse/blob/e78dddce4764a3465e86f3a2fddd0a1bcfc854be/LICENSE): 고정 SHA 루트 MIT 문구 읽음. 실제 코드 복사 없음. 향후 배포 시 저작권·허가문 유지와 선택한 배포물/번들 고지 확인 필요. 모든 의존성·법적 결합 조건을 검토했다는 의미가 아님.
- 가치 판단: 작은 브라우저 File 입력의 경로가 직접적이므로 첫 시험 후보로 선택. 성능 우위나 안전성 보증이 아니다.

## 2. csv-parse — 구문·열 처리와 파일/업무 정책의 분리

- [GitHub releases](https://api.github.com/repos/adaltas/node-csv/releases?per_page=10)는 빈 목록, latest는 404. 확인한 최신 stable Git tag는 `v5.4.1`(tagger **2020-04-22 04:28 KST**, commit `7023ede3e333d18c9caa0545a05d7bba10bd7fa3`). 이 옛 모노레포 태그를 현재 csv-parse 배포 버전으로 보지 않음.
- 읽은 기본 브랜치 SHA **`f12e6862a41f4324a06a26c87a3e28031d4faa7f`**, 원문 commit **2026-10-14 05:33 KST**. [package.json](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/packages/csv-parse/package.json#L1)은 `7.0.3`. **소스 manifest 버전이며 npm 최신 배포 버전은 미확인.** README 개별 발행일 미확인.
- [README L20–38](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/packages/csv-parse/README.md#L20), [manifest L34–72](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/packages/csv-parse/package.json#L34): Web 배포와 browser/esm 경로 존재. Node 전용이라고 제외하면 안 됨. [lib/index.js L80–102](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/packages/csv-parse/lib/index.js#L80)는 string/Buffer 입력 경계. File 읽기·미리보기·제한은 별도.
- [api/index.js L591–612](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/packages/csv-parse/lib/api/index.js#L591): 중복 열을 그룹으로 묶는 옵션이 있고 기본 객체 매핑은 같은 이름을 다시 정의할 수 있음. ‘필수 헤더 검증’이나 ‘중복 헤더 거부’ 기능으로 오인하지 않음. 담당자가 이 구간을 직접 다시 읽음.
- [L535–581](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/packages/csv-parse/lib/api/index.js#L535), [normalize_options.js L585–620](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/packages/csv-parse/lib/api/normalize_options.js#L585): 열 수 불일치 오류와 기본 false인 완화 옵션. 오류 무시 옵션을 켜면 업무 거부 조건과 어긋날 수 있음.
- [normalize_options.js L12–32](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/packages/csv-parse/lib/api/normalize_options.js#L12), [api/index.js L712–720](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/packages/csv-parse/lib/api/index.js#L712): encoding 처리 존재. 특정 브라우저/Buffer 구현의 Shift-JIS 지원이나 자동 문자셋 판정을 입증하지 않음.
- [루트 LICENSE](https://github.com/adaltas/node-csv/blob/f12e6862a41f4324a06a26c87a3e28031d4faa7f/LICENSE) MIT와 패키지 manifest의 MIT 선언만 확인. npm tarball·생성 번들·모든 monorepo 패키지 라이선스는 미확인. 코드 복사/설치 없음.
- 가치 판단: 브라우저 후보로 유효하나 v1에서는 File 경로 연결을 더 비교할 비용 때문에 보류. v2에서는 다시 검토할 수 있지만 ‘스트림’이라는 이름만으로 대용량 우위를 판정하지 않음.

두 후보에 공통: 개인정보 무전송은 라이브러리 이름이 아니라 실제 앱·CDN·분석 코드까지 포함한 네트워크 검사로 확인해야 한다. 예약 중복과 CSV 행 유사성은 별개다.

## 3. MADR — 도구보다 작은 결정 기록 메커니즘

- [최신 release](https://github.com/adr/madr/releases/tag/4.0.0) `4.0.0`, 원문 게시 **2024-09-17 20:00 KST**. 읽은 고정 commit `2475fe1973f66a12aaf58a91d8fa7b42c0f5ea3d`(같은 날 19:59 KST).
- [template/adr-template.md](https://github.com/adr/madr/blob/2475fe1973f66a12aaf58a91d8fa7b42c0f5ea3d/template/adr-template.md): 문제·선택지·결정 이유·결과·확인·재방문 정보를 연결함. 기본 브랜치도 잠깐 읽었지만 근거는 이 판에 고정함.
- [LICENSE](https://github.com/adr/madr/blob/2475fe1973f66a12aaf58a91d8fa7b42c0f5ea3d/LICENSE)는 `MIT OR CC0-1.0`. 이번에는 템플릿 문구를 복제하지 않고 기록 항목의 관계만 참고. 템플릿 전문·프레임워크·협업자 역할 목록을 사용자 기본 입력으로 강요하지 않음.
- 적용: 코드 라이브러리 외에 ‘결정과 근거를 함께 남기기’라는 메커니즘도 재사용 대상. 예약/CSV 분야에만 갇힌 카탈로그를 만들 이유가 없음.

## 기존 연구의 좁은 사용

- [GitAgent v1](https://arxiv.org/html/2312.17294v1), 원문 **2023-12-28**(날짜만 표기), 이번 확인 2026-10-15 KST. §2.2 Search/Store, §2.3, §3.1을 확인. 과거 기능 설명·환경·경험 재사용이라는 아이디어만 참고. 30질의 실험을 제품 수요나 일반 추천 품질로 일반화하지 않음. 버전 없는 URL이 개정 OpenAgent로 바뀌었다는 사용자 제공 사례 때문에 v1/절을 고정. 이번에 버전 없는 URL의 변경 이력까지 재조사하지 않음. arXiv 배포 라이선스는 앱 코드 재사용 허가로 해석하지 않음.
- datasketch `3da96a591c954952c9dd367567db720cfdc151e0`: 사용자 제공 기존 조사 요약만 사용. 유사후보 검색 ≠ 기능 동등/중복 판정. 이 사이클의 원자료·라이선스 재확인 없음, 도입 권고 없음.
- datacontract-cli `462cc3759bd6cb7469e8b30b7c852572608366a4`: 사용자 제공 기존 조사 요약만 사용. 요구 검사와 실제 실행 검사를 구별하고 생략을 합격으로 보지 않음. 이 사이클의 원자료·라이선스 재확인 없음, 도입 권고 없음.
- firm 원파일·비밀은 접근하거나 전달하지 않음. 사용자가 이번 메시지에 제공한 공개 요약만 사용.

자료읽기 보조: 실제 생성된 GPT-6 Luna Max `/root/source_read`. 담당자는 핵심 중복헤더 소스 두 구간을 대조했다. 읽기/설계 추론과 실행 관찰은 구분한다. 라이브러리 설치·성능/보안/통합 시험·사람 사용성 검사는 수행하지 않았다.
