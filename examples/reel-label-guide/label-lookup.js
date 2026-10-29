/*
 * reel board 리본 라벨 → 화면·컨트롤러·드라이버·보드 지정 정확 조회.
 *
 * 기준 자료: Zephyr 3568e1b6d5cdd51a6b964a2a1d6d29200fea2056
 *   boards/phytec/reel_board/doc/index.rst L9-L112 (Display 표, Power supply 주석)
 *
 * 매칭 정책: 앞뒤 공백(String.prototype.trim)만 무시하고, 라벨 전체를
 * 대소문자까지 그대로 비교한다. 접두어·부분·유사 문자·대소문자·하이픈을
 * 보정하거나 추정하지 않는다. 일치하지 않으면 대상 값을 돌려주지 않는다.
 *
 * 브라우저(classic script)에서는 globalThis.ReelLabelGuide,
 * Node에서는 module.exports로 같은 객체를 제공한다.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) {
    module.exports = api;
  } else {
    root.ReelLabelGuide = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const SOURCE = Object.freeze({
    repository: 'zephyrproject-rtos/zephyr',
    commit: '3568e1b6d5cdd51a6b964a2a1d6d29200fea2056',
    file: 'boards/phytec/reel_board/doc/index.rst',
    lines: 'L9-L112',
    url: 'https://github.com/zephyrproject-rtos/zephyr/blob/3568e1b6d5cdd51a6b964a2a1d6d29200fea2056/boards/phytec/reel_board/doc/index.rst#L9-L112',
  });

  // 문서 Display 표의 두 행만 담는다. 새 라벨은 추가하지 않는다.
  const ENTRIES = Object.freeze([
    Object.freeze({
      label: 'HINK-E0213',
      display: 'Good Display GDEH0213B1',
      controller: 'SSD1673',
      driver: 'ssd16xx',
      boardDesignation: 'reel_board',
    }),
    Object.freeze({
      label: 'HINK-E0213A22',
      display: 'Good Display GDEH0213B72',
      controller: 'SSD1675A',
      driver: 'ssd16xx',
      boardDesignation: 'reel_board@2',
    }),
  ]);

  const KNOWN_LABELS = Object.freeze(ENTRIES.map((entry) => entry.label));

  // 문서 Power supply 주석. 조회 결과와 관계없이 항상 표시한다.
  const LOW_POWER_LIMIT = Object.freeze({
    title: 'Low Power 모드로 소비 전력을 줄일 수 없음',
    detail:
      '문서에는 Low Power 모드에서 nRF52840 전압만 켜진다고 설명하지만, ' +
      '실제로는 nRF52840과 주변장치 두 전압이 항상 켜져 있어 이 모드로 ' +
      '소비 전력을 줄일 수 없다고 적혀 있습니다(문서가 가리키는 파일: ' +
      'boards/phytec/reel_board/board.c).',
  });

  function normalizeInput(raw) {
    if (typeof raw !== 'string') return '';
    return raw.trim();
  }

  function findEntry(raw) {
    const label = normalizeInput(raw);
    if (label === '') return null;
    for (const entry of ENTRIES) {
      if (entry.label === label) return entry;
    }
    return null;
  }

  /*
   * 화면에 그릴 상태를 만든다. 대상 값은 match일 때만 들어 있다.
   *   state: 'match' | 'needs-check'
   *   reason: 'matched' | 'empty' | 'unrecognized'
   */
  function describe(raw) {
    const label = normalizeInput(raw);
    if (label === '') {
      return Object.freeze({ state: 'needs-check', reason: 'empty', label: '', entry: null });
    }
    const entry = findEntry(label);
    if (!entry) {
      return Object.freeze({ state: 'needs-check', reason: 'unrecognized', label, entry: null });
    }
    return Object.freeze({ state: 'match', reason: 'matched', label, entry });
  }

  return Object.freeze({
    SOURCE,
    ENTRIES,
    KNOWN_LABELS,
    LOW_POWER_LIMIT,
    normalizeInput,
    findEntry,
    describe,
  });
});
