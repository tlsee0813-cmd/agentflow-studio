#!/usr/bin/env python3
"""두 fixture를 고정 원문에서 생성한다(정확 인용은 원문 파일의 줄을 그대로 읽어 넣는다).
사용: python3 -I build_fixtures.py <flow091-contract.md> <powertoys-src-dir> <out-dir>
powertoys-src-dir 아래에 <parentSHA>/ 와 <fixSHA>/ 폴더(세 파일)가 있어야 한다.
이 스크립트는 기록용이며 렌더러는 생성된 JSON만 읽는다."""
import json, sys, os, difflib

contract, ptdir, out = sys.argv[1], sys.argv[2], sys.argv[3]
L = open(contract, encoding='utf-8').read().split('\n')
def lines(a, b=None):
    b = b or a
    return '\n'.join(L[a - 1:b])

FREPO = 'https://github.com/tlsee0813-cmd/agentflow-studio/blob/5416decfbe9f38a45323de0badc4fc58ec6e4bcd/docs/flow091-background-contract.md'
def fev(id_, l, anchor, ltext, summary, quote_rng, typ='개발 계약 문서 · 고정 커밋', limits=None):
    return {
        'id': id_, 'type': typ,
        'source': {'label': f'FLOW091-C 계약 {ltext}', 'url': FREPO + anchor, 'pin': 'commit 5416dec'},
        'summary': summary,
        'quote': lines(*quote_rng),
        'limits': limits or '과거 개발 계약 문서다. 실제 사용자 대화·실제 AI 호출·실제 인계 수락은 이 자료에 없다(원문 L4).'
    }

flow = {
    'schemaVersion': 1,
    'caseId': 'flow091-background-copy',
    'title': 'AgentFlow 배경 사본 기능 일부',
    'scope': 'FLOW091-C 계약이 다루는 배경 사본 연결 부분만. 제품 전체 구성이 아님.',
    'nature': '과거 개발 계약 문서와 그 안의 MOCK 검사 보고. 실제 사용자 대화·실제 AI 호출·실제 인계 수락은 없음.',
    'basisTime': '고정 커밋 5416dec 시점의 계약 문서',
    'groupingNote': '점선 묶음은 이해를 돕기 위해 AI가 제안한 보기 구분이며 코드 소유·실행 순서가 아님.',
    'nodes': [
        {'id': 'G1', 'parent': None, 'name': '구상과 목적', 'short': '목적과 영역 구상, 지금 상태', 'role': '프로젝트 목적과 영역 구상을 다듬는 곳. 지금 구상은 계속 바뀔 수 있다.', 'evidence': ['F3', 'F10']},
        {'id': 'G2', 'parent': None, 'name': '요청 맥락', 'short': '새 요청의 배경과 범위', 'role': '새 요청이 어떤 배경과 범위로 나가는지 다루는 부분.', 'evidence': []},
        {'id': 'C21', 'parent': 'G2', 'name': '새 요청의 배경 고정', 'short': '명시 새 요청 때만 사본', 'role': '명시적인 새 요청을 보낼 때만 목적과 대상 영역 하나를 사본으로 고정한다.', 'evidence': ['F2', 'F3']},
        {'id': 'C22', 'parent': 'G2', 'name': '요청 범위 구분', 'short': '실행 범위는 이번 요청', 'role': '실행 범위는 이번 요청이 정하고 배경은 자료로만 둔다.', 'evidence': ['F7', 'F9']},
        {'id': 'G3', 'parent': None, 'name': '전달할 내용', 'short': 'AI 입력과 사람이 읽는 작업문', 'role': 'AI에게 보내는 입력과 사람이 읽는 작업문, 두 형태.', 'evidence': []},
        {'id': 'C31', 'parent': 'G3', 'name': 'AI 입력', 'short': '배경은 전용 필드', 'role': '배경을 출처·기준과 분리된 전용 필드로 싣는다.', 'evidence': ['F7', 'F9']},
        {'id': 'C32', 'parent': 'G3', 'name': '작업문과 미리보기', 'short': '배경을 별도 블록으로', 'role': '작업문·미리보기·Markdown에 배경을 별도 블록으로 넣는다.', 'evidence': ['F3', 'F8', 'F9', 'F10', 'F11'],
         'change': {'label': '이 기록의 정책 변경', 'summary': '목적을 작업문의 분리된 배경 블록 안에만 넣도록 바뀜',
                    'before': '목적을 작업문에서 제외', 'after': '목적은 작업문의 분리된 배경 블록 안에만. 요청·출처·기준·지시로는 쓰지 않음',
                    'basis': '계약의 기존 테스트 변경표가 적은 이전 단언과 바뀐 단언(원문 L52)', 'evidence': ['F1']}},
        {'id': 'G4', 'parent': None, 'name': '결과 연결', 'short': '돌아온 결과를 어느 사본에 잇나', 'role': '돌아온 결과를 어느 작업의 사본에 잇는지 다루는 부분.', 'evidence': []},
        {'id': 'C41', 'parent': 'G4', 'name': '일반 보고 연결', 'short': '연결된 대상 작업의 사본', 'role': '정확히 연결된 대상 작업의 사본을 그대로 잇는다.', 'evidence': ['F4']},
        {'id': 'C42', 'parent': 'G4', 'name': '파일 반환 연결', 'short': '일치하는 반환 식별자', 'role': '반환 식별자가 일치하는 내보내기 기록의 사본을 쓴다.', 'evidence': ['F5']},
        {'id': 'G5', 'parent': None, 'name': '저장·복구', 'short': '내보내기 기록·저장 형식', 'role': '내보내기 기록과 저장 형식. 당시 작업문에 넣은 사본을 보존한다.', 'evidence': ['F6', 'F10']},
    ],
    'relations': [
        {'id': 'R1', 'from': 'G1', 'to': 'C21', 'kind': '명시 새 요청 때만 사본 고정', 'short': '목적과 대상 영역 하나를 사본으로',
         'condition': '명시적인 새 요청을 보낼 때만 그때의 목적과 그 요청의 대상 영역 하나를 사본으로 고정합니다. 지도에서 고르거나 둘러보는 것은 새 요청이 아닙니다.', 'evidence': ['F2']},
        {'id': 'R2', 'from': 'C21', 'to': 'C31', 'kind': '요청 사본', 'short': 'AI 입력의 전용 필드로',
         'condition': '명시 새 요청 때 고정한 그 요청의 배경 사본을 AI 입력의 전용 필드로 싣습니다. 출처·기준과 분리되고 실행 범위는 이번 요청이 정합니다.', 'evidence': ['F7']},
        {'id': 'R3', 'from': 'C21', 'to': 'C32', 'kind': '요청 사본', 'short': '작업문의 별도 블록으로',
         'condition': '명시 새 요청 때 고정한 그 요청의 배경 사본을 작업문·미리보기의 별도 블록으로 넣습니다. 지금 지도에 보이는 최신 구상을 가져오는 것이 아닙니다. 사본이 없거나 비면 블록을 넣지 않습니다.', 'evidence': ['F8']},
        {'id': 'R4', 'from': 'C32', 'to': 'G5', 'kind': '내보내기 기록의 사본', 'short': '작업문에 넣은 사본을 기록',
         'condition': '작업문에 실제로 넣은 사본을 내보내기 기록에 남깁니다. 작업문 전문 저장이나 외부에서 받거나 수락했다는 증거가 아닙니다.', 'evidence': ['F6']},
        {'id': 'R5', 'from': 'G5', 'to': 'C42', 'kind': '일치하는 반환 식별자', 'short': '일치하는 기록의 사본',
         'condition': '반환 식별자가 일치하는 내보내기 기록의 사본을 씁니다. 옛 기록에 사본이 없으면 빈 값 그대로이며 최신 구상으로 메우지 않습니다.', 'evidence': ['F5']},
        {'id': 'R6', 'from': 'C21', 'to': 'C41', 'kind': '정확히 연결된 대상 작업의 사본', 'short': '연결된 작업의 사본',
         'condition': '일반 보고는 정확히 연결된 대상 작업의 사본을 그대로 잇습니다. 대상이 없으면 빈 값 그대로입니다.', 'evidence': ['F4']},
    ],
    'evidence': [
        fev('F1', 52, '#L52', 'L52', '목적은 ‘작업문에서 제외’에서 ‘분리된 배경 블록 안에만 포함’으로 바뀌었다. 목적을 요청·출처·기준·지시로 쓰지 않는 성질은 그대로다.', (52,)),
        fev('F2', 10, '#L10', 'L10', '명시적인 새 요청을 보낼 때만 목적과 그 요청의 대상 영역 하나를 사본으로 고정한다. 지도에서 고른 영역이 아니며 빈 값은 null이다.', (10,)),
        fev('F3', 11, '#L11', 'L11', '구상 수정·보관·재배치·반복 내보내기·탐색은 기존 사본을 바꾸지 않는다. 다음 명시 새 요청만 최신 구상을 쓴다.', (11,)),
        fev('F4', 12, '#L12', 'L12', '일반 보고는 정확히 연결된 반환 대상 작업의 사본을 그대로 잇는다. 대상이 없으면 null.', (12,)),
        fev('F5', 13, '#L13', 'L13', '파일 반환은 일치하는 반환 식별자의 내보내기 기록 사본을 쓴다. 옛 기록에 없으면 null이며 최신 구상으로 메우지 않는다.', (13,)),
        fev('F6', 14, '#L14', 'L14 · L55', '내보내기 기록은 그때 작업문에 실제로 넣은 사본을 보존한다. 작업문 전문은 보존하지 않는다(L55).', (14,), limits='과거 개발 계약 문서다. 내보내기 기록은 작업문 전문을 저장하지 않으며(L55) 외부 수신·수락의 증거가 아니다.'),
        fev('F7', 15, '#L15', 'L15', 'AI 입력의 배경은 출처·기준과 분리된 전용 필드다. 실행 범위는 이번 요청이 정한다.', (15,)),
        fev('F8', 16, '#L16', 'L16', '작업문·미리보기·Markdown은 배경을 별도 블록으로 구분한다. 사본이 없거나 둘 다 빈 값이면 블록을 넣지 않는다.', (16,)),
        fev('F9', 17, '#L17', 'L17', '배경을 출처·기준·새 사용자 결정으로 자동 승격하지 않는다. 직접 수정 우선권은 그대로다.', (17,)),
        fev('F10', 18, '#L18-L22', 'L18–22', '구상이 뒤에 바뀌면 ‘이 사본은 그대로’로 안내한다. 옛 저장 형식은 현재 구상을 소급하지 않고 null로 옮긴다.', (18, 22)),
        fev('F11', 33, '#L33-L41', 'L33–41', '‘A 내보내기 → 변경 → B → 늦은 A 보고’에서 A의 사본과 B의 요청·사본을 보존했다는 검사 보고.', (33, 41),
            typ='MOCK 검사 보고 · 계약 문서 안', limits='가짜 호출을 쓴 MOCK 검사 보고다. 실제 사용자 사건이나 실제 AI 처리 성공이 아니다(L4, L58).'),
    ],
    'initialView': {
        'expanded': ['G3'],
        'layout': {'columns': ['170px', '200px', '230px', '170px'], 'areas': ['a b c e', 'a b d e'],
                   'place': {'G1': {'area': 'a', 'align': 'center'}, 'G2': {'area': 'b', 'align': 'center'}, 'G3': {'area': 'c', 'align': 'end'},
                             'G4': {'area': 'd', 'align': 'start'}, 'G5': {'area': 'e', 'align': 'center'}}}
    }
}

# ---------------- PowerToys ----------------
P = '4671e537039fdeb185190d93e0157ffed954ddca'; C = 'a964f08cc6fbecb3b9f9d4fe6c1d7481330c7938'
PTB = 'https://github.com/microsoft/PowerToys/blob/' + C + '/'
FILES = {'S': 'src/modules/keyboardmanager/KeyboardManagerEditorUI/Controls/KeyDropDownButton.xaml.cs',
         'R': 'src/modules/keyboardmanager/KeyboardManagerEditorUI/Helpers/KeyboardHookHelper.cs',
         'H': 'src/common/ManagedCommon/HotkeySettingsControlHook.cs'}
def hunk(key, want):
    """부모→수정 diff에서 want 문자열이 들어간 hunk만 그대로 꺼낸다."""
    f = os.path.basename(FILES[key])
    a = open(os.path.join(ptdir, P, f), encoding='utf-8').read().split('\n')
    b = open(os.path.join(ptdir, C, f), encoding='utf-8').read().split('\n')
    d = list(difflib.unified_diff(a, b, lineterm='', n=2))[2:]
    hunks, cur = [], []
    for ln in d:
        if ln.startswith('@@') and cur: hunks.append(cur); cur = []
        cur.append(ln)
    if cur: hunks.append(cur)
    sel = [h for h in hunks if any(w in '\n'.join(h) for w in want)]
    assert sel, (key, want)
    return '\n'.join('\n'.join(h) for h in sel)

PR = 'https://github.com/microsoft/PowerToys/pull/51150'
pt = {
    'schemaVersion': 1,
    'caseId': 'powertoys-kbm-editor-pr51150',
    'title': 'PowerToys Keyboard Manager 편집기의 두 동작 수정',
    'scope': '편집기의 키 검색·선택과 녹화 종료 판정, 그리고 외부 공통 입력 훅 일부만. PowerToys 전체 구성이 아님.',
    'nature': '공개 PR 51150의 사람 리뷰 댓글 2건, 후속 고정 커밋 a964f08의 코드 차이, 작성자 회신, 조회 시점 PR 상태. 이 연구에서 재실행·재현하지 않음.',
    'basisTime': '리뷰 기준 커밋 4671e537 → 후속 수정 a964f08 (2026-10-13 UTC). PR 상태는 2026-10-16 조회 시점.',
    'groupingNote': '편집기 묶음은 코드 경로·PR 설명에 근거한 보기 구분이며 전체 제품의 포함 트리가 아님. 공통 훅은 편집기 밖 부품.',
    'nodes': [
        {'id': 'ED', 'parent': None, 'name': 'Keyboard Manager 편집기', 'short': '키 매핑을 고르고 녹화하는 화면', 'role': '키 매핑을 편집하는 화면. 이 지도는 그 안의 두 동작만 다룬다.', 'evidence': ['PRS']},
        {'id': 'SR', 'parent': 'ED', 'name': '키 검색·선택', 'short': '검색어로 키 목록을 걸러 고름', 'role': '키 고르기 목록에서 검색어를 넣고 Enter로 첫 결과를 고르는 동작.', 'evidence': ['RVS'],
         'change': {'label': '요청에 따른 수정', 'summary': 'Enter로 제출한 검색어로 목록을 바로 다시 걸러 첫 결과를 고르도록 바뀜',
                    'before': '화면 목록(ItemsSource)의 첫 항목을 고름. 목록 갱신이 늦으면 이전 검색 결과가 남아 있을 수 있음',
                    'after': '제출된 검색어(args.QueryText)로 FilterKeyList를 바로 호출해 첫 항목을 고름',
                    'basis': '리뷰 당시 커밋 4671e537 → 후속 커밋 a964f08, KeyDropDownButton.xaml.cs', 'evidence': ['RVS', 'PS', 'RPS']}},
        {'id': 'RC', 'parent': 'ED', 'name': '녹화 종료 판정', 'short': 'Tab으로 녹화를 끝낼지 판단', 'role': '키 녹화 중 Tab 입력을 보고 녹화를 끝내고 포커스를 옮길지 정하는 판정.', 'evidence': ['RVR'],
         'change': {'label': '요청에 따른 수정', 'summary': 'Tab을 누를 때만 녹화를 끝내고, 녹화 전부터 누르던 Tab을 뗄 때는 끝내지 않도록 바뀜',
                    'before': 'Tab이면 누름·뗌 구분 없이 녹화 종료로 판정',
                    'after': '누름(isKeyDown)인 Tab만 녹화 종료로 판정. 뗌은 일반 key-up 처리로 넘어감',
                    'basis': '리뷰 당시 커밋 4671e537 → 후속 커밋 a964f08, KeyboardHookHelper.cs', 'evidence': ['RVR', 'PRC']}},
        {'id': 'HK', 'parent': None, 'name': '공통 입력 훅', 'tag': '편집기 밖 공통 부품 · ManagedCommon', 'short': '키 이벤트를 받아 판정 함수에 넘김', 'role': 'PowerToys 공통 부품에서 키보드 이벤트를 받아 각 화면의 판정 함수로 넘기는 훅.', 'evidence': [],
         'change': {'label': '지원 변경 · 별도 요구 아님', 'summary': '판정 함수에 누름(key-down) 여부를 함께 넘기는 연결이 추가됨',
                    'before': '판정 함수에 키와 부가 정보만 넘김',
                    'after': '누름 여부를 함께 넘기는 형식을 추가하고, 기존 형식은 누름 여부를 버리는 연결로 계속 받음',
                    'basis': '리뷰 당시 커밋 4671e537 → 후속 커밋 a964f08, HotkeySettingsControlHook.cs', 'evidence': ['PH']}},
    ],
    'relations': [
        {'id': 'X1', 'from': 'HK', 'to': 'RC', 'kind': '이벤트 종류 전달', 'short': '누름 여부를 녹화 종료 판정에 넘김',
         'condition': '공통 훅이 키보드 이벤트의 메시지 종류로 누름(key-down, system key-down 포함) 여부를 계산해 판정 함수에 넘깁니다. 녹화 종료 판정은 이 값으로 Tab 누름만 종료로 봅니다. 호출 순서나 두 수정 사이의 인과를 뜻하지 않습니다.',
         'evidence': ['PH', 'PRC']},
    ],
    'evidence': [
        {'id': 'RVS', 'type': '사람 리뷰 댓글 · 재현 보고', 'source': {'label': 'PR 51150 리뷰 댓글 4255501266', 'url': PR + '#discussion_r4255501266', 'pin': 'review 5499716330 · 당시 기준 4671e537'},
         'summary': '2026-10-13 06:41 UTC. f1 결과를 본 뒤 0을 붙이고 즉시 Enter하면 F1이 선택된다는 관측과, 제출된 검색어를 동기적으로 걸러 달라는 요청.',
         'quote': None, 'limits': '사람 계정 리뷰어의 재현 보고이며 이 연구에서 재실행하지 않음. 댓글 원문은 이 입력에 복사하지 않았으므로 링크에서 확인. 현재 댓글의 commit_id 필드(4671e537)와 당시 기준을 혼동하지 않음.'},
        {'id': 'RVR', 'type': '사람 리뷰 댓글 · 재현 보고', 'source': {'label': 'PR 51150 리뷰 댓글 4255501287', 'url': PR + '#discussion_r4255501287', 'pin': 'review 5499716330 · 당시 기준 4671e537'},
         'summary': '2026-10-13 06:41 UTC. Tab을 누른 채 Space로 녹화를 시작한 뒤 Tab을 놓으면 녹화가 끝난다는 관측과, 종료 판정을 key-down으로 한정해 달라는 요청.',
         'quote': None, 'limits': '사람 계정 리뷰어의 재현 보고이며 이 연구에서 재실행하지 않음. 모든 키 입력·전체 녹화 결함으로 넓히지 않음. 현재 댓글의 commit_id 필드는 2b31b0c2로 당시 기준(4671e537)과 다름.'},
        {'id': 'PS', 'type': '고정 커밋 코드 차이', 'source': {'label': 'a964f08 · KeyDropDownButton.xaml.cs L131–139, L180–186', 'url': PTB + FILES['S'] + '#L131-L139', 'pin': 'parent 4671e537 → a964f08'},
         'summary': 'QuerySubmitted가 이전 ItemsSource 대신 제출된 args.QueryText를 FilterKeyList에 넘긴다.',
         'quote': hunk('S', ['QuerySubmitted', 'private List<KeyNameEntry> FilterKeyList']),
         'limits': '코드 차이는 동작 검증이 아님. 같은 커밋의 Escape 처리·포커스 수정·UI 테스트 변경은 이 요청의 직접 근거로 쓰지 않음. 테스트 추가는 실행 통과가 아님.'},
        {'id': 'PRC', 'type': '고정 커밋 코드 차이', 'source': {'label': 'a964f08 · KeyboardHookHelper.cs L123–139', 'url': PTB + FILES['R'] + '#L123-L139', 'pin': 'parent 4671e537 → a964f08'},
         'summary': '종료 조건 앞에 isKeyDown을 추가해 Tab 누름만 녹화를 끝낸다.',
         'quote': hunk('R', ['isKeyDown']),
         'limits': '코드 차이는 동작 검증이 아님. 추가된 UI 테스트의 대기 시간은 ‘Tab을 누른 채 Space’ 재현을 직접 보장하지 않음.'},
        {'id': 'PH', 'type': '고정 커밋 코드 차이', 'source': {'label': 'a964f08 · HotkeySettingsControlHook.cs L16–45, L70–75', 'url': PTB + FILES['H'] + '#L16-L45', 'pin': 'parent 4671e537 → a964f08'},
         'summary': '이벤트 종류(누름 여부)를 함께 넘기는 delegate/생성자를 추가하고, 기존 형식은 그 값을 버리는 연결로 유지한다.',
         'quote': hunk('H', ['FilterKeyboardEventsWithKeyState', 'bool isKeyDown = ev.message']),
         'limits': '공통 부품의 지원 변경이며 사용자 요구 두 건과 같은 별도 요구로 세지 않음. 다른 화면에 미친 영향은 이 입력이 확인하지 않음.'},
        {'id': 'RPS', 'type': '작성자 회신 · 수정 주장', 'source': {'label': 'PR 51150 답글 4257710120', 'url': PR + '#discussion_r4257710120', 'pin': '2026-10-13 10:51 UTC'},
         'summary': '검색 댓글을 직접 참조하고 a964f08을 수정 커밋으로 지목한 작성자 답글.',
         'quote': None, 'limits': '작성자의 수정 주장이며 독립 검증·새 담당 인계가 아님. 녹화 수정의 성공 근거로 넓히지 않음.'},
        {'id': 'PRS', 'type': 'PR 상태 · 조회 시점', 'source': {'label': 'PR 51150', 'url': PR, 'pin': 'merge 9501b98a · head 2b31b0c2'},
         'summary': '2026-10-14 05:18:57 UTC 병합(merged=true).',
         'quote': None, 'limits': '병합은 출시·실사용 해결·전체 요구 완료와 다름. 현재 PR 본문은 10월 9일의 최초 요청이 아님. a964f08의 Copilot 공동작성 메타데이터는 AI 대화 전문·인계 수락·실행 성공의 증거가 아님.'},
    ],
    'initialView': {
        'expanded': ['ED'],
        'layout': {'columns': ['300px', '230px'], 'areas': ['a b'],
                   'place': {'ED': {'area': 'a', 'align': 'center'}, 'HK': {'area': 'b', 'align': 'end'}}}
    }
}

os.makedirs(out, exist_ok=True)
for name, fx in (('flow091.json', flow), ('powertoys.json', pt)):
    with open(os.path.join(out, name), 'w', encoding='utf-8') as fh:
        json.dump(fx, fh, ensure_ascii=False, indent=1); fh.write('\n')
print('ok')
