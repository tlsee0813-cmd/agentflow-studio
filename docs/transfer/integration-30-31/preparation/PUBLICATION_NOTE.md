# 공개 사본과 통합 준비의 경계

CHECK_RESULTS.json의 실행기·작업 경로만 <runtime>/<workspace>로 치환했다. 원본 로컬 실행 결과의 명령 인수·시각·종료값과 제품 바이트는 바꾸지 않았다.

제품 6파일의 합집합은 정확했다. 첫 검증용 commit dd52aa3은 31의 루트 tree를 바탕으로 만들어 30의 부모가 가진 과거 문서를 누락했다. 총괄이 PR diff에서 발견했으며 checkpoint에 병합하지 않았다. 최신 checkpoint tree 위에 같은 6파일을 적용하고 checkpoint 부모 이력을 포함해 문서를 보존하는 교정본을 별도로 만든다. 최초 검증용 CI를 최종 수용으로 사용하지 않는다.
