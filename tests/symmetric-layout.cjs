const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const [width, height] of [[320,568],[390,844],[844,390],[768,1024],[1366,768],[1920,1080]]) {
      await page.setViewportSize({ width, height });
      await page.goto('http://127.0.0.1:4173/');
      await page.evaluate(() => { mergeMatchingClocks = () => {}; });
      const limit = await page.evaluate(() => clockLimit());
      for (let count = 1; count <= limit; count++) {
        await page.evaluate(count => {
          cities = catalog.slice(0,count).map(city => ({...city}));
          applySettings();
        }, count);
        await page.waitForTimeout(100);
        const rows = await page.locator('#clocks > .clock-card').evaluateAll(cards => {
          const rows = new Map();
          for (const card of cards) {
            const rect = card.getBoundingClientRect();
            const key = card.style.gridRow;
            if (!rows.has(key)) rows.set(key, []);
            rows.get(key).push({left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom});
          }
          return [...rows.values()];
        });
        for (const row of rows) {
          assert(Math.abs((row[0].left + row.at(-1).right) / 2 - width / 2) < 1, `${width}px, ${count} clocks: row must be centered`);
          for (let i = 0; i < row.length; i++) {
            assert(Math.abs(row[i].left + row.at(-1-i).right - width) < 2);
            assert(row[i].left >= 0 && row[i].right <= width + 1 && row[i].top >= 0 && row[i].bottom <= height + 1);
          }
        }
        if (count === 3) {
          if(width>=1366)assert.deepEqual(rows.map(row => row.length), [3]);
          if(width===390)assert.deepEqual(rows.map(row => row.length), [2,1]);
          if (width === 390 || width === 1366) await page.screenshot({path:`tests/triangle-${width}.png`});
        }
      }
      console.log(`PASS ${width}×${height}: 1–${limit} clocks are symmetric and fit; rows adapt to available space`);
    }
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
