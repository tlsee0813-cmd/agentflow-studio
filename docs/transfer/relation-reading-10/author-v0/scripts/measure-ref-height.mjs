// 보조 측정(판정 아님): 기준 fix1과 cycle10의 G3→R3 참고 높이. Playwright locator.click(자동 스크롤 포함)을 쓴다.
import { chromium } from '/opt/npm-tools/node_modules/playwright/index.mjs';
const files = process.argv.slice(2);
const b = await chromium.launch(); const out = {};
for (const f of files) for (const [w, h] of [[1280, 720], [390, 844]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  await p.goto('file://' + f); await p.waitForTimeout(250);
  await p.click('#n-G3 .gname'); await p.locator('#panel .xbtn[data-xref="R3"]').click();
  out[`${f.split('/').pop()}@${w}`] = await p.evaluate(() => { const r = document.getElementById('xr-R3').getBoundingClientRect(); return { h: Math.round(r.height), chars: document.getElementById('xr-R3').innerText.replace(/\s+/g, '').length }; });
  await p.close();
}
await b.close(); console.log(JSON.stringify(out, null, 1));
