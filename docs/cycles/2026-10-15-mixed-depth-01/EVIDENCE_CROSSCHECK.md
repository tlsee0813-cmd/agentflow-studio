# Dify·GitHub 고정 링크 근거 교차 확인

확인일: 2026-10-15. Dify의 지정 SHA `1f3fdbc0d32ff7a52f94a2a34e00183e698f1c2f`에서 세 파일의 원문을 읽었다. 요청에 열거된 심볼과 클래스는 모두 존재한다. 다만 이 결과는 소스의 좁은 정적 확인이며 실제 화면·동작·사용성 검사 완료를 뜻하지 않는다.

`BaseNode`에는 `w-60`, 제목의 `truncate`, `showSelectedBorder`가 있다. `w-60`은 비컨테이너 노드에만 적용된다. 선택 테두리는 `data.selected`뿐 아니라 문맥 메뉴 대상·묶음·진입 상태에서도 활성화되므로 ‘오직 선택한 노드 표시’라고 단순화하면 부정확하다. 제목에는 원문 `title` 속성도 있다. 카드 폭·텍스트 처리·상태 구분의 참고 근거는 되지만 AgentFlow의 계층 의미를 해결하는 근거는 아니다.

패널은 `node.data.selected`인 첫 노드를 찾아 `NodePanel`을 조건부 렌더링한다. `rightPanelRef`는 `useResizeObserver(setRightPanelWidth)`로 연결되고 실제 폭 변화를 저장소에 전달한다. 이 관측 코드만으로 사용자가 패널 경계를 드래그해 크기를 조절할 수 있다고 입증되지는 않는다.

`handlePaneContextMenu`는 기본 이벤트를 막고 클립보드 읽기를 비동기로 시작한 다음 `contextMenuTarget: { type: 'panel' }`을 설정한다. 클립보드 읽기 완료를 기다려 메뉴를 여는 구조는 아니다. 이 파일에는 메뉴 항목 렌더링 자체가 없으므로 문맥 메뉴의 전체 UX까지 확인한 것으로 확대하지 않는다.

GitHub 공식 문서 두 개는 브랜치 파일 URL이 새 커밋에 따라 달라질 수 있고, 커밋 ID를 넣은 permalink가 특정 파일 버전을 고정하며 행·범위를 지정할 수 있음을 설명한다. 고정 링크는 근거의 버전을 재현하게 하지만 누군가 링크를 열었거나 내용을 이해·수락했다는 증거는 아니다. 이번 결과는 시각 패턴 참고로 제한한다. Dify 라이선스·파일별 재사용 조건은 이번에 검토하지 않았으므로 코드 복사 가능 판정으로 사용하지 않는다.

## 출처와 확인 위치

| 원문 | 확인한 근거 |
|---|---|
| [Dify BaseNode](https://github.com/langgenius/dify/blob/1f3fdbc0d32ff7a52f94a2a34e00183e698f1c2f/web/app/components/workflow/nodes/_base/node.tsx#L128-L133) | `BaseNode` L51; 테두리 조건 L128~133·163~165; 비컨테이너 `w-60` L201; 제목 `title`·`truncate` L248~250. blob `64d9c214642b632b47f200009b468005f12e5720`. |
| [Dify Panel](https://github.com/langgenius/dify/blob/1f3fdbc0d32ff7a52f94a2a34e00183e698f1c2f/web/app/components/workflow/panel/index.tsx#L39-L79) | 폭 관측 hook L39~79; 첫 선택 노드 L83~96; 패널 ref·렌더링 L117~130. blob `468ebbdf07aec4d7b9d8b5c476810f831f9895fc`. |
| [Dify 패널 이벤트](https://github.com/langgenius/dify/blob/1f3fdbc0d32ff7a52f94a2a34e00183e698f1c2f/web/app/components/workflow/hooks/use-panel-interactions.ts#L17-L31) | `preventDefault`, 비동기 clipboard 읽기, panel 문맥 대상 설정. blob `a261bf8ba44b654e88ef3a6d4d11af1d31a3ead0`. |
| [GitHub: 파일의 고정 링크](https://docs.github.com/en/repositories/working-with-files/using-files/getting-permanent-links-to-files) | branch head는 변할 수 있음. `y` 또는 URL의 commit ID로 특정 파일 버전 고정. |
| [GitHub: 코드 조각의 고정 링크](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-a-permanent-link-to-a-code-snippet) | 특정 버전의 행·범위 permalink. 코드 조각 자동 렌더링은 원 저장소의 댓글에 한정되며 Markdown 파일에는 적용되지 않는다는 조건도 확인. |

범위: API·웹 읽기만 수행. Dify 코드 복제·실행, 공유 브라우저 조작, 원격 쓰기는 수행하지 않았다.
