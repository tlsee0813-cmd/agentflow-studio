/*
 * 화면 연결. 사용자 입력과 결과 값은 textContent로만 넣는다.
 * 입력이 바뀔 때마다 동기적으로 다시 그려 이전 결과가 남지 않게 한다.
 */
(function () {
  'use strict';

  const guide = window.ReelLabelGuide;
  const FIELDS = ['display', 'controller', 'driver', 'boardDesignation'];
  const EMPTY_VALUE = '—';

  const input = document.getElementById('label-input');
  const form = document.getElementById('label-form');
  const clearButton = document.getElementById('clear-button');
  const badge = document.getElementById('status-badge');
  const message = document.getElementById('status-message');
  const echo = document.getElementById('status-echo');
  const rows = document.getElementById('result-rows');
  const values = {};
  for (const field of FIELDS) {
    values[field] = rows.querySelector('[data-field="' + field + '"]');
  }

  document.getElementById('known-labels').textContent = guide.KNOWN_LABELS.join(', ');
  document.getElementById('limit-title').textContent = guide.LOW_POWER_LIMIT.title;
  document.getElementById('limit-detail').textContent = guide.LOW_POWER_LIMIT.detail;
  const sourceLink = document.getElementById('source-link');
  sourceLink.href = guide.SOURCE.url;
  sourceLink.textContent = 'Zephyr ' + guide.SOURCE.file;
  document.getElementById('source-meta').textContent =
    '· 커밋 ' + guide.SOURCE.commit.slice(0, 12) + ' · ' + guide.SOURCE.lines + ' (고정 판본)';

  const MESSAGES = {
    matched: '문서 표에서 이 라벨과 정확히 같은 행을 찾았습니다.',
    empty: '라벨이 비어 있습니다. 리본 케이블에 적힌 라벨을 입력해야 대상을 안내할 수 있습니다.',
    unrecognized:
      '문서 표의 라벨과 전체가 정확히 같지 않아 대상을 추정하지 않습니다. ' +
      '리본 케이블의 라벨 전체를 대소문자·하이픈까지 다시 확인하세요.',
  };

  function render() {
    const result = guide.describe(input.value);
    const matched = result.state === 'match';

    badge.dataset.state = result.state;
    badge.textContent = matched ? '대응 확인' : '확인 필요';
    rows.dataset.state = result.state;
    message.textContent = MESSAGES[result.reason];
    echo.textContent = result.label === '' ? '(비어 있음)' : result.label;

    for (const field of FIELDS) {
      values[field].textContent = matched ? result.entry[field] : EMPTY_VALUE;
    }
  }

  input.addEventListener('input', render);
  form.addEventListener('submit', function (event) {
    event.preventDefault();
    render();
  });
  input.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && input.value !== '') {
      event.preventDefault();
      input.value = '';
      render();
    }
  });
  clearButton.addEventListener('click', function () {
    input.value = '';
    render();
    input.focus();
  });

  render();
  input.focus();
})();
