# reel board 리본 라벨 → 빌드 대상 안내 (PC 시제품)

reel board 화면 리본 케이블에 적힌 라벨을 입력하면, 고정 문서 판본의 Display 표에 적힌
화면 모델·컨트롤러·드라이버·보드 지정을 함께 보여 주는 로컬 브라우저 화면입니다.
요청 참조: `RQ_0797ee20-a84e-4aa7-ace6-b4f053ca87f7`.

| 리본 라벨 | 화면 모델 | 컨트롤러 | 드라이버 | 보드 지정 |
|---|---|---|---|---|
| `HINK-E0213` | Good Display GDEH0213B1 | SSD1673 | ssd16xx | `reel_board` |
| `HINK-E0213A22` | Good Display GDEH0213B72 | SSD1675A | ssd16xx | `reel_board@2` |

기준 자료: [Zephyr `boards/phytec/reel_board/doc/index.rst` L9-L112 @ 3568e1b6](https://github.com/zephyrproject-rtos/zephyr/blob/3568e1b6d5cdd51a6b964a2a1d6d29200fea2056/boards/phytec/reel_board/doc/index.rst#L9-L112).
현재 유통 보드나 실제 기기에서 확인한 값이 아닙니다.

## 동작

- 앞뒤 공백(`String.prototype.trim`)만 무시하고 라벨 **전체**를 대소문자까지 그대로 비교합니다.
- 접두어·부분 일치, 대소문자·하이픈·유사 문자 변형, PCB 버전, 보드 지정·모델명 입력은
  보정하거나 추정하지 않고 **확인 필요**로 표시하며 대상 값을 비웁니다.
- 입력이 바뀔 때마다 즉시 다시 그리므로 이전 대상이 새 입력의 결과처럼 남지 않습니다.
  결과 위에 비교한 입력을 글자 그대로 함께 보여 줍니다.
- Low Power 모드로 소비 전력을 줄일 수 없다는 문서 제한은 상태와 관계없이 항상 보입니다.
- 빌드·플래싱, 하드웨어 접근, 네트워크 요청을 하지 않습니다(CSP `connect-src 'none'`).

키보드: 화면을 열면 입력칸에 초점이 있습니다. 입력하면 즉시 갱신되고, `Enter`는 페이지를
이동하지 않으며, `Esc`로 입력을 지웁니다. `Tab`으로 지우기 버튼과 문서 링크로 이동합니다.

## 열기

의존성이 없습니다. `index.html`을 브라우저로 직접 열어도 되고, 기존 Python으로 로컬에서만
제공할 수도 있습니다.

```bash
python3 -m http.server 8000 --bind 127.0.0.1 --directory examples/reel-label-guide
```

그다음 브라우저에서 `http://127.0.0.1:8000/`을 엽니다.

## 검사

Node 기본 test runner만 사용합니다(Node 18 이상).

```bash
node --test examples/reel-label-guide/test/label-lookup.test.js examples/reel-label-guide/test/app.test.js
```

- `label-lookup.test.js`: 표 값, 두 라벨 정확 대응, 짧은 라벨의 접두어 오매칭 없음, 빈·공백·접두어·
  대소문자·하이픈·유사 문자·PCB 버전·임의 라벨의 확인 필요, 제한 문구·출처, HTML 삽입/네트워크 API 미사용.
- `app.test.js`: 최소 가짜 DOM에서 `app.js`를 실행해 입력 순서별 갱신, 정상→미상 전환 시 값 비움,
  `Esc`·지우기·`Enter`, HTML 입력의 글자 그대로 표시를 확인합니다. 실제 렌더링·레이아웃은 다루지 않습니다.

## 파일

- `label-lookup.js` — 표 데이터와 정확 조회(`describe`, `findEntry`). 브라우저와 Node 공용.
- `app.js` — 화면 연결. 값은 `textContent`로만 넣습니다.
- `index.html`, `styles.css` — 1280×720 PC 화면 기준 레이아웃(좁은 화면에서는 한 열).
