export const CONVERTER_PARTS = [
    { key: 'input', name: '읽어들이기', note: '문서를 받아 변환할 내용을 읽는다.' },
    { key: 'document', name: '문서 읽기', note: '현재 합성 자료에서는 한 번에 문서 하나를 받는다.', parent: 'input' },
    { key: 'transform', name: '내용·모양 보존', note: '본문·표·문단 모양을 보존하며 변환한다.' },
    { key: 'content', name: '본문과 표', note: '문서 내용을 변환 결과에 이어 담는다.', parent: 'transform' },
    { key: 'layout', name: '문단 모양', note: '원본 문단 서식을 유지하는 요구가 있다. 실제 보존 정확도는 미검증이다.', parent: 'transform' },
    { key: 'output', name: '내보내기와 결과', note: 'PDF/docx를 저장하고 변환 결과를 알려준다.' },
    { key: 'files', name: '변환한 파일', note: '변환 형식과 저장한 산출물을 다룬다.', parent: 'output' },
    { key: 'results', name: '결과 설명', note: '현재 화면은 마지막 문서의 결과를 설명한다.', parent: 'output' },
];
// The map is authored example structure, not automatically inferred relations.
export const CONVERTER_RELATIONS = [
    ['document', 'content', 'flow', '읽어들인 문서의 본문과 표를 변환한다.'],
    ['content', 'files', 'flow', '변환한 내용을 선택한 형식으로 저장한다.'],
    ['layout', 'files', 'needs', '내보낼 때도 문단 모양을 보존하는 요구가 있다.'],
    ['files', 'results', 'related', '저장 위치 또는 실패 이유를 결과로 설명한다.'],
];
/** The authored short heading of the example's own sentence (CONVERTER_INTENT); any other sentence gets no authored heading. */
export const CONVERTER_HEADING = '폴더 단위 변환';
export const CONVERTER_INTENT = '폴더째 변환하고, 한 파일이 실패해도 나머지는 계속하며, 성공 결과는 유지하고 실패한 파일과 이유를 모아 보고 싶어. 기존 내용과 모양 보존은 유지해줘. 하위 폴더 포함과 재시도는 아직 정하지 않았고 병렬 처리는 요청하지 않았어.';
/** Input material only. A and B differ in the supplied implementation excerpt;
 * neither contains the authored expected analysis or preselected plan items. */
export function converterEvidence(condition) {
    return [
        { id: 'R01', kind: 'user', title: '처음 요구', text: '문서 하나를 PDF나 docx로 바꾸고 싶어. 본문·표·문단 모양은 유지해줘.', basis: '합성 작업 기록 / 대화 1 / 현재 요구' },
        { id: 'R02', kind: 'report', title: '단일 문서 변환 보고', text: '단일 문서를 읽어 변환하고 선택한 형식으로 저장하도록 했습니다. 폴더는 받지 않습니다. 현재 화면은 마지막 문서의 결과만 설명합니다.', basis: '합성 담당 보고 / main 판본 S0 / 실행 원자료와 구별' },
        { id: 'R03', kind: 'user', title: '변경안에서 시험하는 요구', text: '폴더째 받고, 하나가 실패해도 나머지는 계속하고, 성공 결과는 남기고 실패한 파일과 이유를 모아 보고 싶어.', basis: '합성 작업 기록 / 변경안 v1 / 현재 구현 또는 현재 요구로 채택한 기록 아님' },
        { id: 'R04', kind: 'user', title: '유지 조건과 미정', text: '기존 내용과 모양 보존은 유지해. 하위 폴더 포함과 재시도는 아직 정하지 않을게. 병렬 처리는 요청하지 않았어.', basis: '합성 작업 기록 / 변경안 v1 / 사용자의 유지 조건' },
        { id: 'R05', kind: 'user', title: '결과를 읽는 방법', text: '결과 목록에서 어떤 입력의 산출물인지 알고 싶어. 실패한 파일은 이름과 이유를 보고 성공한 결과는 다시 열 수 있으면 좋겠어.', basis: '합성 작업 기록 / 변경안 v1 / 사용자의 결과 이해 요구' },
        { id: 'P01', kind: 'code', title: '현재 흐름 설명 문서', text: 'docs/flow.md: 입력 문서 하나 → 본문·표·문단 모양 보존 → PDF/docx 저장. 이 문서는 설계 설명이며 동작 검증 결과가 아니다.', basis: '합성 프로젝트 자료 / main@S0 / docs/flow.md:1-3 / 실제 Git 판본 아님' },
        condition === 'A'
            ? { id: 'P03', kind: 'code', title: '단일 변환과 결과 보관 코드 발췌', text: 'convert.ts:1-4: convertOne(input)은 {inputId, status:"ok", outputPath} 또는 {inputId, status:"error", reason}를 반환한다. 호출자는 각 결과를 sessionResults에 누적한다. 화면은 마지막 결과만 표시한다. 제공된 발췌에는 폴더 열거·일괄 실행 코드가 없다.', basis: '합성 프로젝트 자료 / 조건 A / main@S0 / convert.ts:1-4 / 실제 코드가 아닌 공개 합성 발췌' }
            : { id: 'P03', kind: 'code', title: '단일 변환과 오류 전달 코드 발췌', text: 'convert.ts:1-4: convertOne(input)은 성공하면 outputPath 문자열을 반환하고 실패하면 예외를 던진다. 제공된 호출자는 성공 경로 또는 오류 메시지 하나를 화면에 표시한다. 제공된 두 발췌에는 입력 식별자가 붙은 결과 누적이나 폴더 실행이 없다.', basis: '합성 프로젝트 자료 / 조건 B / main@S0 / convert.ts:1-4 / 실제 코드가 아닌 공개 합성 발췌' },
        { id: 'T01', kind: 'test', title: '기존 단일 문서 검사 원자료', text: 'S0 / 단일 정상 문서 PDF 저장: PASS; 단일 정상 문서 docx 저장: PASS. 폴더 실행·성공과 실패 혼합·실패 후 계속·출력 이름 충돌·시각 보존 검사는 이 원자료에 포함되지 않는다.', basis: '합성 검사 원자료 / main@S0 / tests/single-result.txt:1-3 / 실제 실행한 검사가 아님' },
    ];
}
/** Explicitly authored example, for a labelled demonstration only.
 * Condition B's prerequisite is a separate item so a consumer can show the
 * dependency without silently selecting or adding it to the user's request. */
export function converterExampleAnalysis(partIds, condition) {
    const ids = (...keys) => keys.map(key => partIds[key]).filter((id) => typeof id === 'string' && !!id);
    // Authored presentation of this synthetic corpus only, never an inferred operation or current-product claim.
    // part-note excerpts are the actual authored map descriptions; evidence excerpts retain A/B's P03 basis via refs.
    const present = (key, current, wanted, origin = 'intent') => partIds[key] ? [{ partId: partIds[key], current, wanted, origin }] : [];
    const note = (key) => ({ text: CONVERTER_PARTS.find(p => p.key === key).note, source: 'part-note', refs: [] });
    const code = (text) => ({ text, source: 'evidence', refs: ['P03'] });
    const prerequisite = condition === 'B' ? ['outcomes'] : [];
    return {
        summary: condition === 'A'
            ? '파일별 결과는 이미 남고 있지만, 화면에는 마지막 결과만 보여요. 기존 결과를 활용해 실패 모음을 만들고, 폴더 입력과 계속 처리는 따로 살펴볼 수 있어요.'
            : '현재는 결과 하나만 전달해요. 실패한 파일과 이유를 모으려면 입력마다 결과를 구별하는 부분이 먼저 필요해요.',
        items: [
            { id: 'folder', title: '폴더 입력', description: '현재 단일 문서 입력을 폴더 안 파일을 받는 범위로 확장합니다. 하위 폴더 포함은 아직 정하지 않았습니다.', partIds: ids('input', 'document'), refs: ['R02', 'R03', 'P01'], dependsOn: [],
                presentation: present('document', note('document'), { text: '폴더 안 파일을 입력받기', refs: ['R03'] }) },
            // No presentation: the sources say nothing about what happens after a failure now, so there is no current text on the
            // same side as 'continue after a failure' (a single input or the part's role would be another side). The target is the
            // conversion stage as a whole, not one of its inner parts: why it is read is the impact on it below.
            { id: 'continue', title: '실패해도 나머지 계속', description: '한 문서의 실패가 다른 문서 처리를 중단하지 않는 결과를 원합니다. 병렬 처리나 재시도를 필수 방식으로 정하지 않습니다.', partIds: ids('transform'), refs: ['R03', 'R04', 'P03', 'P01'], dependsOn: [] },
            ...(condition === 'B' ? [{ id: 'outcomes', title: '파일별 결과 구별', description: '제공된 코드는 경로 한 개 또는 예외만 전달합니다. 실패한 파일과 이유를 모으려면 입력과 성공·실패 결과를 대응시킬 수 있어야 합니다. 이 전제를 요청에 포함할지 또는 기존 수단을 더 확인할지 구별합니다.', partIds: ids('transform', 'results'), refs: ['P03', 'R03'], dependsOn: [],
                    presentation: present('results', code('제공된 호출자는 성공 경로 또는 오류 메시지 하나를 화면에 표시한다.'), { text: '입력별 성공·실패 결과 구별', refs: ['P03', 'R03'] }, 'suggestion') }] : []),
            { id: 'failures', title: '성공 유지·실패 모음', description: condition === 'A'
                    ? '기존 입력별 성공 경로·실패 이유와 결과 누적을 재사용해 실패 모음을 구성할 수 있는 후보입니다. 현재 화면은 마지막 결과만 보여 주므로 결과 읽기 변화가 필요합니다. 폴더 실행이나 성공 보존 전체가 검증된 것은 아닙니다.'
                    : '실패한 입력과 이유를 모아 읽고 성공 산출물을 유지하려는 변경입니다. 제공된 범위에는 파일별 결과 누적이 없어 최소 전제의 확인이 필요합니다. 전제는 별도로 선택하지 않으면 이번 요청에 포함되지 않습니다.', partIds: ids('output', 'files', 'results'), refs: ['R02', 'R03', 'P03', 'T01'], dependsOn: prerequisite,
                // 'files' has only its role in the map (what it handles), not whether outputs survive a failure: no pair for it.
                presentation: [
                    ...present('results', condition === 'A' ? code('화면은 마지막 결과만 표시한다.') : code('제공된 호출자는 성공 경로 또는 오류 메시지 하나를 화면에 표시한다.'), { text: '실패한 파일과 이유 모아 보기', refs: ['R03'] }),
                ] },
        ],
        impacts: [
            // Why the conversion stage is read for 'continue': what the supplied code is known to return per input, and what no
            // source says (where a failure stops the rest, whether outputs already made remain). No loop or place is settled.
            { partId: partIds.transform ?? '', reason: condition === 'A'
                    ? '문서는 이 단계에서 변환된 뒤 변환한 파일로 넘어가요. 변환 결과는 입력마다 성공 경로나 실패 이유로 이미 돌아와요. 한 파일이 실패한 뒤 나머지를 계속 변환하는지, 이미 만든 산출물이 남는지는 확인되지 않았어요. 어디서 반복할지도 정하지 않았어요.'
                    : '문서는 이 단계에서 변환된 뒤 변환한 파일로 넘어가요. 변환은 성공하면 출력 경로를 돌려주고 실패하면 예외를 내요. 한 파일이 실패한 뒤 나머지를 계속 변환하는지, 이미 만든 산출물이 남는지는 확인되지 않았어요. 어디서 반복할지도 정하지 않았어요.', refs: ['P03', 'P01', 'R03', 'T01'] },
            { partId: partIds.document ?? partIds.input ?? '', reason: '문서 하나에서 폴더 안 파일로 입력 범위가 달라집니다. 파일 대상 규칙은 아직 미정입니다.', refs: ['R02', 'R03'] },
            { partId: partIds.results ?? partIds.output ?? '', reason: condition === 'A'
                    ? '파일별 결과 누적은 제공된 코드에 이미 있지만 화면은 마지막 결과만 보여 줍니다. 결과 읽기의 재사용 범위를 확인합니다.'
                    : '제공된 코드는 단일 경로 또는 오류만 전달하므로 파일별 결과 대응이 선행 조건입니다.', refs: ['P03', 'R03'] },
            { partId: partIds.files ?? partIds.output ?? '', reason: '여러 결과를 남길 때 입력별 산출 대응과 같은 이름 충돌을 살펴봐야 합니다. 덮어쓰기 발생을 관측한 것은 아닙니다.', refs: ['R03', 'P01'] },
        ].filter(impact => !!impact.partId),
        preserve: ['기존 본문·표·문단 모양 보존 요구', '기존 단일 문서 PDF/docx 변환 흐름'],
        unknowns: ['하위 폴더 포함 여부', '출력 저장 위치와 같은 이름 충돌 처리', '재시도 방식', '혼합 성공·실패 실행과 시각 보존의 실제 확인 범위'],
    };
}
/** Later authored observations: no fake return IDs, handoffs, or anchors.
 * R08 remains a report about earlier tests, not a new observed test execution. */
export function converterObservations() {
    return [
        { id: 'R07', itemId: 'folder', kind: 'report', text: '폴더 바로 아래 파일을 열거하는 입력 처리만 바꿨습니다. 실패 후 계속과 실패 모음은 이번 보고 범위가 아닙니다. 기준 브랜치 병합이나 폴더 전체 실행 성공을 보고한 것은 아닙니다.', basis: '합성 후속 담당 보고 / feature/folder@F1 / 작성 기준 S0 뒤에 도착', refs: ['R03', 'P01'] },
        { id: 'P02', itemId: 'folder', kind: 'code', text: 'input.ts:1-3의 변경은 readDirectory(path) 결과 중 바로 아래 파일을 입력 목록으로 만드는 부분뿐입니다. 제공된 diff에는 변환 반복·계속 처리·실패 결과 모음 변경이 없습니다.', basis: '합성 후속 프로젝트 자료 / feature/folder@F1 / input.ts:1-3 / main 병합 자료 없음', refs: ['R03', 'P01'] },
        { id: 'R08', itemId: 'folder', kind: 'report', text: 'S0의 단일 정상 문서 PDF/docx 저장 검사가 통과했다고 늦게 보고합니다. 근거는 기존 T01이며 F1 폴더 입력 또는 혼합 성공·실패를 검사한 결과가 아닙니다.', basis: '합성 지연 도착 담당 보고 / main@S0 / 도착 순서와 대상 판본을 구별', refs: ['T01'] },
    ];
}
