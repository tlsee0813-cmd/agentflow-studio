// The model ids a reading names, read as words (ML-1): a pipeline's joined ids become families and names; unknown ids stay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { modelLabel } from '../dist/public/shared/model-label.js';

test('ML-1 joined pipeline ids read as families and names; an unknown id stays as written', () => {
  assert.equal(modelLabel('deepseek-flash_gpt-6.1-sol_gpt-6.1-terra'), 'DeepSeek Flash · GPT Sol · GPT Terra');
  assert.equal(modelLabel('deepseek-chat'), 'DeepSeek Chat');
  assert.equal(modelLabel('gpt-6-astra'), 'GPT Astra');
  assert.equal(modelLabel('my-local-model'), 'my-local-model');
  assert.equal(modelLabel('my_local_model'), 'my_local_model');
  assert.equal(modelLabel('gpt-5'), 'GPT 5');
  assert.equal(modelLabel('gpt-4.1'), 'GPT 4.1');
  assert.equal(modelLabel('o3-mini'), 'O3 Mini');
  assert.equal(modelLabel('claudette'), 'claudette');
  assert.equal(modelLabel('deepseek-flash_my-local'), 'deepseek-flash_my-local');
  assert.equal(modelLabel(''), 'AI');
  assert.equal(modelLabel(undefined), 'AI');
});
