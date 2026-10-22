# 20 v1 독립 정적 재검토
Astra High, 2026-10-22. 좁은 정적 수용.
app564B5DCB45896D1543708D90514EDCDE9699B33AA997394A55047746B4DA3E9B / CSS86DDA3C11A927D454A0086096B255271B70447BF6F9C354CA09060CD0373ED38 / HTMLC3981C397BA764554DA7416F488443EA248E6C51C6891313D01B51B568E525D0.

v0→v1은 capture351의 located→upstream 합성 제거와 restore389–390의 changed-current 한정 fallback이다. 원 P2: origin=null/located=S → capture(upstream=null,prior=S) → same B 복귀(origin=null,located=S)이므로 새 work-return-origin이 생기지 않고 기존 work-locate-return 한 번이 둘을 소비하여 S로 간다. changed C는(origin=S,located=null) 한 경로만 남기고 C/current/draft를 바꾸지 않으며 B 전용 scroll/focus를 건너뛴다. 실제 records origin은 upstream에 남고 기존 records locator 소비/missing-row 복원경로를 유지한다. WorkOrigin을 부모로 재귀 저장하지 않는 타입/clone 경계도 유지한다.

추가 actionable 없음. 제품 수정·브라우저 실행 없음. 실제 focus/hit/scroll·저장실패 동작은 Cloud/CI에서 별도로 검증해야 한다. 이전 정적수용은 전체브라우저수용이 아니다.
