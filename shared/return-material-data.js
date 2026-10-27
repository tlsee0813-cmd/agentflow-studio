/* Exact copy of docs/cycles/2026-10-27-return-experience-63/MATERIAL.json (a test keeps them equal). Public commits and
 * documents edited after the fact: not a raw log, a conversation or a live receipt; checkpoints are reading stages, not times. */
export const UI62_MATERIAL = {
    "meta": {
        "title": "AgentFlow UI62 공개 개발 자료의 작은 읽기 묶음",
        "nature": "공개 Git commit과 tracked 결과 문서에서 사후 편집한 출처 자료. raw JSONL, 원래 대화, 실시간 수신 기록이 아니다.",
        "repository": "https://github.com/tlsee0813-cmd/agentflow-studio",
        "collectionBasisSHA": "a6d882e65062066e327f1e31975bd10283f1e5ce",
        "runtimeBasisSHA": "bcf88bbdcaa683b5d2e781a0ab97135ea6f00fb8",
        "scope": "지도 읽기면, 변경 비교, 이름과 밀도에 관계된 공개 자료 10개. 부분 배치는 이 자료집의 편집 분류이며 공식 제품 구조나 전체 파일 의존 그래프가 아니다.",
        "textConvention": "text.publicExcerpt는 지정한 공개 출처의 실제 발췌이며 text.editorialDescription은 이번 자료집의 편집 설명이다. 영어 commit 설명은 번역하지 않고 남긴다.",
        "checkpointConvention": "checkpoints는 이 사후 자료집을 나누어 읽는 단계다. 당시 알려져 있던 자료 목록, 사건 발생 시각, 도착 순서 또는 실시간 수신의 재현이 아니다. 각 sourceIds는 이 파일 records의 id를 가리킨다.",
        "retrospectiveBoundary": "a6d882e의 결과 문서는 최종 수용 뒤의 회고 기록이다. 이 문서에서 첫 후보나 중간 후보를 설명한 문장은 그 후보 당시의 발언 또는 당시 받은 보고 원문으로 취급하지 않는다.",
        "directionBoundary": "사용자 요청 원문을 이 묶음에서 확보하지 않았다. S01은 사용자 반려를 서술한 coordinator direction 기록이며 사용자 발언 인용이 아니다.",
        "contractBoundary": "자유로운 출처 자료 형식이다. project, return, anchor, task, receipt 스키마가 아니며 수신이나 적용 성공을 생성하지 않는다.",
        "executionBoundary": "이 자료집 작성에서는 기존 공개 문서와 Git을 읽었다. CI, Cloud, 브라우저를 재실행하거나 공개 배포를 다시 검사하지 않았다. 기존 실행에 관한 문서 진술과 코드 자체를 구별한다.",
        "excluded": [
            "전체 로그",
            "비공개 대화",
            "민감 자료",
            "임의 사건 또는 수신 시각",
            "정답 요약",
            "expectedUI",
            "입력 연결기와 출력 기능 확장"
        ]
    },
    "parts": [
        {
            "key": "reading_surface",
            "name": "지도 곁의 읽기면",
            "sourcePaths": [
                "app/continuity/src/client/app.ts",
                "app/continuity/src/client/plan-view.ts"
            ],
            "editorialDescription": "선택, 설명, 근거와 지도 영역을 함께 읽기 위한 자료 묶음. 두 파일은 다른 묶음에도 등장할 수 있다."
        },
        {
            "key": "comparison",
            "name": "현재와 변경 비교",
            "sourcePaths": [
                "app/continuity/src/client/plan-view.ts",
                "app/continuity/src/client/app.ts"
            ],
            "editorialDescription": "변경 대상, 현재 표시, 카메라 이동을 다룬 자료 묶음. 실제 코드 적용 여부를 뜻하지 않는다."
        },
        {
            "key": "names_density",
            "name": "이름 구별과 화면 밀도",
            "sourcePaths": [
                "app/continuity/src/client/map-layout.ts",
                "app/continuity/src/client/app.ts",
                "app/continuity/tests/studio_browser.py"
            ],
            "editorialDescription": "동명 부분, 첫 윤곽, 행 높이와 관계 표시를 다룬 자료 묶음. 전체 프로그램 분류가 아니다."
        }
    ],
    "records": [
        {
            "id": "S01",
            "type": "coordinator_direction",
            "title": "시각 품질 판단과 다음 검토 범위를 정정한 기록",
            "text": {
                "publicExcerpt": "사용자 반려에 따라 61의 좁은 결함 수용과 전체 시각 품질 완료를 구별한다. 현재 배포는 유지하지만 완성 판단은 철회했다.",
                "editorialDescription": "coordinator가 ACTIVE에 기록한 방향 정정이다. 사용자 반려 사실을 서술하지만 사용자 요청 원문은 이 묶음에 없다. 같은 문단은 서로 다른 프로그램 구조의 개요·국소 관계·내부 탐색·변경 비교를 검토하고 입력·출력 확장을 제외한다고 적고 있다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/blob/b6f2d2b2a668d28c7724cfb24e716e94d28e874b/docs/cycles/ACTIVE.md",
            "sourceSHA": "b6f2d2b2a668d28c7724cfb24e716e94d28e874b",
            "relatedPartKeys": [
                "reading_surface",
                "comparison",
                "names_density"
            ]
        },
        {
            "id": "S02",
            "type": "authored_commit_description",
            "title": "첫 구현 commit의 읽기면 설명",
            "text": {
                "publicExcerpt": "One reading pane on the right for a selected part, a change's short and long\nreading, its sources and the scope itself; the map's viewport ends where the\npane begins and only the smallest pan brings the target beside it.",
                "editorialDescription": "작성자가 commit 본문에서 설명한 구현이다. 이 설명만으로 독립 실행 통과나 전체 시각 품질 수용을 뜻하지 않는다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/commit/8c0e8cc780a4b13eadd12f987b190ff14f803545",
            "sourceSHA": "8c0e8cc780a4b13eadd12f987b190ff14f803545",
            "relatedPartKeys": [
                "reading_surface",
                "comparison"
            ]
        },
        {
            "id": "S03",
            "type": "code_excerpt",
            "title": "첫 구현의 지도 영역과 읽기면 폭",
            "text": {
                "publicExcerpt": "const vp = $('viewport'), world = $('world'), pane = paneWidth();\n  $('space').style.setProperty('--plan-w', `${pane}px`);\n  vp.style.right = pane + 'px';",
                "editorialDescription": "syncMapArea 안의 연속 코드다. 오른쪽 읽기면 폭이 지도 viewport에 연결되는 일부 구현만 보여준다. 이 세 줄로 초기 호출 시점이나 모든 장면의 가림 해소를 입증하지 않는다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/blob/8c0e8cc780a4b13eadd12f987b190ff14f803545/app/continuity/src/client/app.ts",
            "sourceSHA": "8c0e8cc780a4b13eadd12f987b190ff14f803545",
            "relatedPartKeys": [
                "reading_surface"
            ]
        },
        {
            "id": "S04",
            "type": "retrospective_review_record",
            "title": "최종 문서가 되짚은 첫 후보의 독립 검토",
            "text": {
                "publicExcerpt": "8종·파생3·변경안 왕복 상태는 통과. 동명 Types 선택 전 구별과 VS Code/sklearn 초기 경계 잘림으로 시각 수용 보류. 두 건은 fa75727에서 수정했다.",
                "editorialDescription": "최종 a6d882e 결과 문서의 Cloud request1 / 8c0e8cc 행이다. 당시 Cloud 보고 원문이나 당시 도착한 자료로 제시하지 않는다. 마지막 문장에는 후속 수정까지 포함되어 있다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/blob/a6d882e65062066e327f1e31975bd10283f1e5ce/docs/cycles/2026-10-26-visual-experience-59/RESULT.md#L46",
            "sourceSHA": "a6d882e65062066e327f1e31975bd10283f1e5ce",
            "relatedPartKeys": [
                "reading_surface",
                "names_density"
            ]
        },
        {
            "id": "S05",
            "type": "authored_commit_description",
            "title": "경계와 동명 부분의 보정 commit 설명",
            "text": {
                "publicExcerpt": "- Parts sharing a name under one parent read apart by the first clause of\n  their own note (e.g. 원명 extHostTypes.ts / 원명 extHostTypes) on the map,\n  in find results and under the pane's title; never merged or renamed.",
                "editorialDescription": "fa75727 commit 본문의 한 항목이다. 같은 commit은 첫 미분석 변경안의 지도 영역 동기화와 실제 화면 공간을 고려하는 첫 접힘도 설명한다. 동명 두 대상을 병합하거나 이름을 바꿨다는 기록으로 읽지 않는다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/commit/fa7572797cf33c8831e51cc3a1f31bf3fb48e767",
            "sourceSHA": "fa7572797cf33c8831e51cc3a1f31bf3fb48e767",
            "relatedPartKeys": [
                "reading_surface",
                "names_density"
            ]
        },
        {
            "id": "S06",
            "type": "authored_commit_description",
            "title": "비교 장면 이동과 현재 대상 표시의 commit 설명",
            "text": {
                "publicExcerpt": "- The current view of an open plan keeps a neutral mark on the target the pane\n  reads (no change colour or words), so pane and map stay matched.",
                "editorialDescription": "753639a commit 본문의 한 항목이다. 같은 commit은 작은 변경안의 대상들과 제목을 첫 읽기에 한 번만 최소 이동시키고 이후 항목 읽기·현재 전환에는 카메라를 유지한다고 설명한다. 조밀한 개요의 우회선을 약하게 표시하는 변경도 들어 있다. 독립 검증 결과와는 별개인 작성자 설명이다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/commit/753639a3b327785ca4fc0f9de4f3623dccd4829e",
            "sourceSHA": "753639a3b327785ca4fc0f9de4f3623dccd4829e",
            "relatedPartKeys": [
                "comparison",
                "names_density"
            ]
        },
        {
            "id": "S07",
            "type": "code_excerpt",
            "title": "현재 보기에서 읽는 대상에 붙이는 코드",
            "text": {
                "publicExcerpt": "if (s.mode !== 'preview') { if (reading) el(reading)?.classList.add('plan-reading-now'); return; }",
                "editorialDescription": "753639a plan-view의 실제 코드 한 줄이다. 현재 모드에서도 읽는 대상에 class를 붙이는 분기를 보여준다. 해당 class의 시각 효과, 카메라 유지, 코드 적용 성공 전체를 이 한 줄로 입증하지 않는다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/blob/753639a3b327785ca4fc0f9de4f3623dccd4829e/app/continuity/src/client/plan-view.ts",
            "sourceSHA": "753639a3b327785ca4fc0f9de4f3623dccd4829e",
            "relatedPartKeys": [
                "comparison"
            ]
        },
        {
            "id": "S08",
            "type": "retrospective_verification_record",
            "title": "최종 문서의 중간 후보 검증 기록",
            "text": {
                "publicExcerpt": "두 PC 크기에서 경계·동명 구별·작은 초안·비교 대상 전체/중립 표시·관계 원문·프로젝트 전환·Node-RED 회귀를 수용.\n\n직전753639a의 CI는 Windows 성공·Ubuntu 행 높이 검사 실패였다.",
                "editorialDescription": "같은 최종 a6d882e 문서의 서로 떨어진 두 구절을 빈 줄로 나누어 모았다. 첫 구절은 Cloud request2 / 753639a 행, 둘째는 행 높이 실패를 되짚은 문단이다. 한 검토의 수용과 다른 검사의 실패를 함께 보존한다. 중간 시점에 이 최종 문서가 존재했다는 뜻은 아니다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/blob/a6d882e65062066e327f1e31975bd10283f1e5ce/docs/cycles/2026-10-26-visual-experience-59/RESULT.md#L48",
            "sourceSHA": "a6d882e65062066e327f1e31975bd10283f1e5ce",
            "relatedPartKeys": [
                "reading_surface",
                "comparison",
                "names_density"
            ]
        },
        {
            "id": "S09",
            "type": "code_excerpt",
            "title": "최종 보정의 리스트 여백과 한 줄 판정",
            "text": {
                "publicExcerpt": "const ITEM_SIDES = 10 + 8 + 2;\n\nif (w + 0.25 <= room) return 1;",
                "editorialDescription": "bcf88bb map-layout의 서로 떨어진 두 코드 발췌다. 같은 commit diff에는 리스트 항목의 room을 자신의 padding·border로 계산하는 변경과 실제 렌더 줄 수·잘림을 확인하는 브라우저 검사 변경이 있다. 이 자료집에서 검사를 새로 실행하지 않았다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/blob/bcf88bbdcaa683b5d2e781a0ab97135ea6f00fb8/app/continuity/src/client/map-layout.ts",
            "sourceSHA": "bcf88bbdcaa683b5d2e781a0ab97135ea6f00fb8",
            "relatedPartKeys": [
                "names_density"
            ]
        },
        {
            "id": "S10",
            "type": "retrospective_acceptance_record",
            "title": "최종 검사와 채택 범위를 함께 남긴 결과 문서",
            "text": {
                "publicExcerpt": "최종 후보의 기본 Noto Sans에서 1280·1440 실제 화면으로 VS Code 한 줄 행·Types 별칭, Joplin 짧은 행, 변환기 비교/닫기 복귀를 수용했다. 별도 DejaVu 강제 글꼴은 CSP로 적용되지 않아 미실행이며 작성자/CI의 넓은 글꼴 검사와 구별한다.\n\n최종 bcf88bb에서는 실제 글자 폭·줄 수·잘림을 확인하는 검사로 보강했고 양OS CI가 성공했다. 실패한 후보를 배포하지 않았다.",
                "editorialDescription": "최종 a6d882e 문서의 Cloud request3 행과 검증 문단에서 떨어진 구절을 모았다. 같은 문서 22행은 전면 행렬, 모든 선의 상시 설명, 기존 점선의 불확실성 재해석을 미채택으로 기록한다. 이 수용은 실제 AI 일반 이해 품질·자동 갱신·설계 전체 완료를 뜻하지 않는다."
            },
            "sourceURL": "https://github.com/tlsee0813-cmd/agentflow-studio/blob/a6d882e65062066e327f1e31975bd10283f1e5ce/docs/cycles/2026-10-26-visual-experience-59/RESULT.md#L49",
            "sourceSHA": "a6d882e65062066e327f1e31975bd10283f1e5ce",
            "relatedPartKeys": [
                "reading_surface",
                "comparison",
                "names_density"
            ]
        }
    ],
    "checkpoints": [
        {
            "id": "reading_1",
            "label": "첫 구현을 읽는 단계",
            "sourceIds": [
                "S01",
                "S02",
                "S03",
                "S04"
            ],
            "readingBasisSHA": "8c0e8cc780a4b13eadd12f987b190ff14f803545",
            "editorialDescription": "방향 기록, 첫 구현 설명·코드, 최종 문서가 회고한 첫 검토를 함께 읽는다. S04는 사후 자료이며 당시 수신된 보고의 재현이 아니다."
        },
        {
            "id": "reading_2",
            "label": "보정 후 아직 Ubuntu 실패가 남은 후보를 읽는 단계",
            "sourceIds": [
                "S01",
                "S02",
                "S03",
                "S04",
                "S05",
                "S06",
                "S07",
                "S08"
            ],
            "readingBasisSHA": "753639a3b327785ca4fc0f9de4f3623dccd4829e",
            "editorialDescription": "중간 후보의 변경 자료와 최종 문서가 되짚은 검토·검사 결과를 추가한다. 자료가 늦게 도착했다는 사건이나 수신 시각을 만들지 않는다."
        },
        {
            "id": "reading_3",
            "label": "최종 보정과 검사를 읽는 단계",
            "sourceIds": [
                "S01",
                "S02",
                "S03",
                "S04",
                "S05",
                "S06",
                "S07",
                "S08",
                "S09",
                "S10"
            ],
            "readingBasisSHA": "bcf88bbdcaa683b5d2e781a0ab97135ea6f00fb8",
            "editorialDescription": "최종 코드 발췌와 사후 수용 문서까지 읽는 자료집의 마지막 단계다. 프로젝트 수신·적용·자동 기억 갱신을 실행하거나 재현하지 않는다."
        }
    ]
};
