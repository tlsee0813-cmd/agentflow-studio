# cycle08 author-v0 원격 바이트 감사

대상: [고정 커밋 bbdf223의 author-v0](https://github.com/tlsee0813-cmd/agentflow-studio/tree/bbdf2234c6523de86b64510843282ac1003124bd/docs/transfer/overview-08/author-v0).

- 고정 Git tree는 잘리지 않은 **27파일 / 688,149B**다. 기존 추출 폴더와 파일 집합이 같으며 누락·추가 **0**.
- **27/27** 기존 파일 바이트로 계산한 Git blob SHA1·크기가 원격 tree와 일치한다. 각 파일 SHA256도 다시 계산했다.
- 원격 `manifest.json` 본문을 base64로 별도 읽어 로컬과 정확 바이트 일치를 확인했다. **3,769B**, SHA256 `ad750cb4409d1e0877c3dac636ead4085451b54b373ce2acb965d82fea1016a8`.
- 해당 원격 manifest의 payload **25/25 bytes·SHA256 일치**, 경로 중복 **0**. 미기재 파일은 manifest 두 개 자신뿐이다. `MANIFEST.sha256` 자체도 원격 tree와 같은 blob이며 기존 수령 시 검증한 25개 목록을 그대로 보존한다.
- 원격 HTML 본문도 별도 읽어 기존 원본과 정확 바이트 일치 확인. **41,912B**, SHA256 `624a6e70082e2cca377080b5f4a67e1f29b3f8ed4f7aac8eda1cb3b07c32154b`.

파일별 bytes·SHA256은 고정 원격 manifest에서 회수할 수 있다. 기존 수령 원본을 기준으로 사용했으며 payload 새 사본은 만들지 않았다. 원격 읽기와 로컬 감사 기록 저장만 했고 원본 코드 실행·원본 수정·삭제·원격 변경은 없다. 이 결과는 배포·동작·의미 판정이 아닌 고정 원본 전달의 무결성 확인이다.

## author-fix1 원격 tree 추가 대조

[고정 커밋 167f86b의 author-fix1](https://github.com/tlsee0813-cmd/agentflow-studio/tree/167f86b8ac783a15bc1b2991b73017ee2f1e0d6a/docs/transfer/overview-08/author-fix1)을 기존 fix1 수령 원본와 대조했다. 해당 tree `41b83c17b626df79679e052cb46a5a9f059af5a1`은 **14파일 / 308,659B**, truncation 없음이다. **14/14 파일 크기·로컬 바이트의 Git blob SHA1이 원격 tree와 일치**하며 파일 집합의 중복·누락·추가는 모두 **0**이다. root가 이미 수행한 HTML·manifest 본문 readback은 이번에 중복하지 않았다. 새 raw 사본·원본 실행·삭제·원격 변경은 없다.



# cycle08 independent-v0 원격 수령 감사

대상: [고정 커밋 09f612c의 독립 증거](https://github.com/tlsee0813-cmd/agentflow-studio/tree/09f612c5f49c639b2f49c3371e73fe6bf44361a3/docs/transfer/overview-08/independent-v0). 수령용 임시 공간에 증거 한 사본만 회수했다. source HTML 중복 사본은 만들지 않았다.

- 실제 원격 tree와 회수 원본은 **23파일 / 2,610,477B**로 일치한다. tree truncation 없음, 중복·누락·추가 **0**.
- `MANIFEST.json`: **3,662B**, SHA256 `795df11fb844c0b562dbcfed3d05c9ccfe72a1957afe0c53b5fdd531b5f07ec5`. raw 본문은 고정 GitHub API blob과도 일치했다.
- payload **22/22 파일 bytes·SHA256 일치**, 합계 **2,606,815B**. 전체 23파일의 로컬 바이트로 계산한 Git blob SHA1·크기도 원격 tree와 일치했다.
- 전체 manifest 경로의 traversal·절대 경로·외부 URL·중복·파일/디렉터리 충돌을 검증한 뒤, 경로를 구간별 인코딩한 고정 public GitHub raw URL만 사용했다. 리다이렉트는 허용하지 않았다.

PNG 네 장은 `default-preparation-390.png`, `initial-1280.png`, `initial-390.png`, `selected-detail-1440.png`다. PNG·REPORT 경로는 Astra에, 코드 snapshot·run01/02 원시 JSON·종료 기록·로그는 코드 감사 담당자에게 전달했다. 후자의 1,210,392B JSON도 raw로 회수해 manifest와 해시 일치를 확인했다.

파일별 bytes·SHA256은 위 고정 경로의 MANIFEST.json에서 회수할 수 있다. 원시 JSON 내용·시각은 재직렬화하지 않았다. 이 문서는 원본 무결성만 판정하며 보고된 6/6·73 PASS의 검사 의미·완주 여부는 별도 코드 감사 범위다. 원본 코드 실행·브라우저 실행·삭제·원본 수정·원격 쓰기는 없다.

