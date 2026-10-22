# 명시 재열기 후 읽기 위치 초기화 누락

검사 도우미의 추가 이동보다는 제품의 실제 body 초기화 누락으로 판단한다. 검사 SHA `9713415a8acb0b6b700ab460119d6b8dbd666bad0dc6c4106a99d3164be4f4bf`는 변경하지 않았다. 로컬 UI·서버를 실행하지 않았고 제품 수정은 별도 담당이다.

고정 근거는 [e5d5bb1d3c1444ac98133d48a1600908e9705f20의 test-fix2](https://github.com/tlsee0813-cmd/agentflow-studio/tree/e5d5bb1d3c1444ac98133d48a1600908e9705f20/docs/transfer/work-reference-29/independent-a/test-fix2)의 REPORT.md·SOURCE_BINDING.json·stderr.log·raw/work-description29-observations.jsonl.gz다. 후보 `2c75d0c6e0b763225e3e90e68a756602f99c66dd`에서 8개 중 6개 통과, test03 양 PC 실패·child/collector exit1이며 새 보고 수신 전 실패했다.

원 JSONL 1기준 행으로 1280은 168(body 0→150) → 172(원문 읽기) → 173·174(닫기/재열기 summary clip/hit=true) → 175~179(같은 project/task/area/r2/text) → 180(`[150,0]`, 기대 `[0,0]`)이다. 1440은 460 → 464 → 465·466 → 467~471 → 472로 같다. 두 클릭 전 reach는 가시성 확인만 했고, 그 사이 추가 wheel/scroll 완료 행은 없다. 검사 215~217행은 두 native click 다음 owner/reference 읽기와 단언뿐이다. 도우미가 재열기 뒤 body를 이동시켰다는 근거가 없다.

[원 제품 app.ts 953–957](https://github.com/tlsee0813-cmd/agentflow-studio/blob/2c75d0c6e0b763225e3e90e68a756602f99c66dd/app/continuity/src/client/app.ts#L953)은 닫을 때 pin만 null로 만들고, 재열기에서는 새 pin.reading.y=0/restore=false를 설정한 뒤 기존 body에 fill을 호출한다. fill 920–921행은 children만 교체하고 scrollTop을 쓰지 않는다. 별도 복원 914–918행은 restore=true일 때만 실제 body.scrollTop을 쓴다. 따라서 같은 body의 150이 남은 관측과 코드가 일치한다. 닫힌 순간과 native toggle 직후를 각각 계측한 것은 아니므로 브라우저 내부의 세부 시점까지 확정하지 않는다.

raw gzip SHA256은 `5a6d13e2ba79084756b21eb7683872d67b2f2b3441803ef8ebcec71df6738a68`, 해제 JSONL은 635770바이트·SHA256 `4ee144f88222064d1e1a09f99d55b954cd57d4859c15c0f7f7305b6c59297cdd`다. 회수·해제 후 이 값들을 직접 대조했다. 전체 원문을 다시 업로드할 필요는 없다.
