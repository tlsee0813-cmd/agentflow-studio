# cycle07 — VS Code 세 부분과 관계의 patch 감사

2026-10-16 · Sol. [이전 원문 감사](../2026-10-16-purpose-06/NEXT_RECORD_CANDIDATE.md)를 재사용하고, [고정 커밋8a830696](https://github.com/microsoft/vscode/commit/8a830696ec002193e88fde8229b2dce8fd923c77)의 **부모 `c7e0a659e0f974cb0105180bf4a66032e1b75525` 대비 patch**만 추가로 읽었다. 전체 파일/다른 커밋·실행·CI·새 후보로 확대하지 않았다. 원격 변경은 없다. 아래 줄은 patch hunk에서 계산한 고정본의 줄이며, ‘부모 줄’은 삭제된 이전 코드다.

**핵심:** 세 부분은 두 표시 소비부와 기존 계산 helper라는 **이번 변경의 읽기 단위**다. 확정 제품 계층이나 세 독립 사업 기능이 아니다. 두 메뉴는 부모에서도 이미 같은 이름의 계산 helper를 호출했다. 이번에는 소비부의 누락 필드 검사·경과 시간 계산을 helper 안으로 옮기고 입력을 세 숫자에서 Downloading 상태로 바꿨다.

| 읽기 단위 | 변경 전후의 직접 근거 | 말할 수 있는 관계 |
|---|---|---|
| **네이티브 메뉴의 다운로드 표시** | [menubar.ts 650–656행](https://github.com/microsoft/vscode/blob/8a830696ec002193e88fde8229b2dce8fd923c77/src/vs/platform/menubar/electron-main/menubar.ts#L650-L656): `this.updateService.state`를 읽고 Downloading을 확인한다. 부모653–655의 진행 필드 검사·`Date.now()-startTime`·세 인자 호출이 새654의 `computeDownloadTimeRemaining(state)`로 바뀐다. | 이 소비부가 다운로드 상태를 남은 시간 계산에 넘기고, 반환값이 정의돼 있고 양수이면 표시 문구를 고른다. |
| **워크벤치 업데이트 메뉴** | [update.ts 279–282행](https://github.com/microsoft/vscode/blob/8a830696ec002193e88fde8229b2dce8fd923c77/src/vs/workbench/contrib/update/browser/update.ts#L279-L282), [409–416행](https://github.com/microsoft/vscode/blob/8a830696ec002193e88fde8229b2dce8fd923c77/src/vs/workbench/contrib/update/browser/update.ts#L409-L416): Downloading 분기에서 상태 전체를 메서드로 전달한다. 메서드도 `state: Downloading`을 받아 같은 helper를 호출하고 결과로 title을 골라 `MenuId.GlobalActivity`에 등록한다. 공통 파일 import는 같은 patch15행에 있다. | 이 소비부 역시 다운로드 상태를 공통 계산에 넘기며, 표시/메뉴 등록은 소비부에 남는다. 네이티브 메뉴를 통해 전달받는다는 근거는 없다. |
| **공통 남은 시간 계산** | [공통 update.ts 118–132행](https://github.com/microsoft/vscode/blob/8a830696ec002193e88fde8229b2dce8fd923c77/src/vs/platform/update/common/update.ts#L118-L132): 부모125의 세 숫자 인자가 새123의 `Downloading`으로 바뀐다.124–129에서 진행량/전체량/시작 시각을 꺼내 누락이면 undefined, 아니면 경과 시간을 계산한다. | 상태를 읽는 계산 helper다. 다운로드를 시작/수행하거나 두 UI를 실행시키는 관리 모듈이라는 근거는 없다. |

네이티브의 import 선언 자체는 변경 hunk에 없으므로 이번 읽기만으로 그 선언 줄까지 새로 확인한 것은 아니다. 위 대응은 patch의 두 호출부·함수 서명과 기존 감사에 부합한다. 두 호출이 **동일한 객체 인스턴스**를 공유한다는 뜻도 아니다.

## 지도에 안전한 짧은 문구

- 네이티브 메뉴 → 공통 계산: **“다운로드 상태로 남은 시간 계산을 요청”**
- 워크벤치 업데이트 메뉴 → 공통 계산: **“다운로드 상태로 같은 계산을 사용”**
- 변경 설명: **“진행 정보 확인과 경과 시간 계산을 기존 공통 함수로 모음”**

이는 정적 호출·입력 관계이며 실행 타임라인 화살표가 아니다. 표시 문구의 지역화·양수 분기는 두 소비부에 남는다. 워크벤치 메서드의 명시적 `downloadingMenuItemDisposable.clear()`도 부모410에서 삭제됐으므로 ‘오직 인자 이름만 변경·런타임 동작 완전 동일’이라고 단정하지 않는다. 이번 patch 범위로 실제 자원 정리 영향까지 판정하지 않았다.

## 피해야 할 과장 — 세 가지

1. **“디렉터리대로 세 제품 모듈이 포함 계층을 이룬다.”** 경로와 코드 소비 관계는 확인되지만 제품의 포함/소유 계층은 아니다. ‘공통’이 두 화면을 자식으로 포함한다는 선을 만들지 않는다.
2. **“네이티브→공통→워크벤치 순으로 실행되며 같은 상태 객체를 공유한다.”** 확인한 것은 두 별도 소비부의 호출과 상태 형식이다. UI 사이 호출·전체 실행 순서·동일 객체/시점 공유는 미확인이다.
3. **“이번에 계산을 처음 공통화해 두 화면 동작과 테스트/CI 성공까지 확인했다.”** helper와 두 호출은 부모에도 있었다. 이번은 책임/입력 경계의 변경이며 표시 로직 완전 통합도 아니다. Windows 다운로드 지연·테스트 변경은 이 세 부분 사건의 인과나 성공 근거로 묶지 않는다. 실제 화면·예측 정확도·CI·최종 수용/제품 반영은 이번에 확인하지 않았다.

