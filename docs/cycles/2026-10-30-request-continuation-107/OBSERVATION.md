# 107 실제 변경안 → 선택 요청 관측

106 구현을 [6657689](../2026-10-29-plan-uncertainty-106/ROOT_ACCEPTANCE.md) 범위로 수용한 뒤 별도 실제 관측을 선택한다. 코드ac77a37/appb4df87a, 공개checkpointf5ad930은73 app를 그대로 둔다.

## 같은 입력, 바뀐 계약

104에서 수용한 Zephyr 지도와105의 같은 Display 대상·같은 제안·같은 기록 두 개를 재사용한다. 새 지도 생성은0회다. 전체 지도 백업 SHA256 dcda9cc2acbd387fdfc7f1751f7ba4e59a2bbf6b496c5c04bbba24477552bb49, 제안 SHA256 aef03867fec2b6b3882cf616e9ba5156c4e77664de58143efed2b8197379f4ca. 첫 요청의 system/user가 동결값과 같아야 실제 호출한다.

105가 core PASS/question appropriateness FAIL이었던 사실은 유지한다. 106의 plan.3 지침 SHA256 aacb45c30be76c620da3503ed806c809a520c772c36412982d7dff8b69443a7a, scope 지침3df02d5eaf174bb5a2f5599b6164deea477cc4bb965e93ad6714e1c5f591087e을 적용한 새 표본이다. 실패 응답 재시도나 문구 수선이 아니다.

## 호출과 종료선

정상 localhost 제품 UI에서 기존 DeepSeek 설정 그대로 plan1회/60초. root·기존 Sol의 의미 수용 뒤에만 scope1회/30초. 전체cap2·concurrency1. map/digest/ask/retry/fallback0. 기존 키는 비공개 파일에서 읽고 값이나 인증 헤더를 증거에 남기지 않는다. 원문·응답 원본은 수정 없이 로컬 보존하고 공유 근거는 최소 판단과 해시로 제한한다.

두 화면 라벨에 따른 display/controller/ssd16xx/target 대응, 빈·미상 라벨 추정금지, PCB로 결정금지, Low Power 절전불가 제한, 센서·회로·전원/실빌드·플래싱 제외를 지켜야 한다. 내부parts등록을 사람 결정으로 떠넘기거나 답한 표시에 새선택·명령예시를 추가하면 반려한다. 실제 사용경험에 영향을 주는 미상은 남길 수 있지만 모든 원문 공백을 사용자 결정으로 만들지 않는다.

plan과scope가 통과하면 정상UI로 고정 요청문을 만들고, 그 정확 범위의 로컬 PC 시제품·실행 증거를 돌려받는 다음 작업을 선택한다. 실패하면 전달/의미/질문 적절성을 나누어 다음 선택을 하며 자동재호출하지 않는다. 한 표본 통과를 일반 생성 품질이나 제품 전체·배포 완성으로 올리지 않는다.
