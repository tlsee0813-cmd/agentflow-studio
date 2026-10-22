# PNG 목록 메타데이터 정정
원 `PNG_INVENTORY.json`의 독립 UI 이미지 `uploaded` 플래그는 초기 목록 작성값 false가 최종 복사 뒤 갱신되지 않았다. 원본 경로·bytes·SHA는 정확하며 이미지/검사 원시는 변경하지 않았다.
실제 업로드 집합은 원 MANIFEST.tsv가 기준이다. 이 `PNG_UPLOAD_STATUS.json`은 원본 SHA와 원 payload 실제 PNG SHA를 대조한 최종 전달 상태/상대경로다. 다른 경로의 같은 원본 이미지도 content hash로 대응한다. 원자료를 덮어쓰지 않고 메타데이터만 append한다.
