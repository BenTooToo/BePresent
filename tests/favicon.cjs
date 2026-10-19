const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ timezoneId: 'Europe/Paris' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install({ time: new Date('2026-10-19T10:59:59Z') });
    await page.goto(process.env.CLOCK_TEST_URL || 'http://127.0.0.1:4173/');
    const icon = page.locator('#clock-favicon');
    const href = () => icon.getAttribute('href');
    assert.equal(await href(), 'assets/icons/clock-12.svg');

    // Only one link mutation at the boundary; ordinary ticks do not reload it.
    await page.evaluate(() => {
      window.iconChanges = 0;
      new MutationObserver(records => { window.iconChanges += records.length; })
        .observe(document.getElementById('clock-favicon'), { attributes: true });
    });
    await page.clock.runFor(1500);
    assert.equal(await href(), 'assets/icons/clock-01.svg');
    await page.clock.runFor(1000);
    assert.equal(await page.evaluate(() => window.iconChanges), 1);

    // Previewing another instant must not change the real-time icon.
    await page.evaluate(() => { previewTimestamp = Date.now() + 5 * 3600000; update(); });
    assert.equal(await href(), 'assets/icons/clock-01.svg');

    // Returning from suspension catches up immediately, including midnight.
    await page.clock.setSystemTime(new Date('2026-10-19T22:00:00Z'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    assert.equal(await href(), 'assets/icons/clock-12.svg');
    for (let hour = 1; hour <= 12; hour++) {
      await page.clock.setSystemTime(new Date(Date.UTC(2026, 9, 19, hour - 2)));
      await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
      assert.equal(await href(), `assets/icons/clock-${String(hour).padStart(2, '0')}.svg`);
      const response = await page.request.get(new URL(await href(), page.url()).href);
      assert.equal(response.status(), 200);
      const svg = await response.text();
      assert(svg.includes(`rotate(${hour % 12 * 30} 16 16)`));
      assert.equal(svg, fs.readFileSync(path.join(__dirname, '..', 'dist', await href()), 'utf8'));
    }
    // A different visitor timezone determines the icon, not Paris or the first city.
    const tokyo = await browser.newPage({ timezoneId: 'Asia/Tokyo' });
    await tokyo.clock.setFixedTime(new Date('2026-10-19T10:00:00Z'));
    await tokyo.goto(process.env.CLOCK_TEST_URL || 'http://127.0.0.1:4173/');
    assert.equal(await tokyo.locator('#clock-favicon').getAttribute('href'), 'assets/icons/clock-07.svg');
    assert.deepEqual(errors, []);
    console.log('PASS: 12 icons, hourly boundary, stable ticks, preview isolation, resume, local timezone, dist assets');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
