const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-15T21:50:00Z'));
    await page.goto(process.env.CLOCK_TEST_URL || 'http://127.0.0.1:4173/');
    // Keep individual cities stable here; clock-fusion.cjs covers automatic grouping.
    await page.evaluate(()=>{mergeMatchingClocks=()=>{};});
    const cards = page.locator('.clock-card');
    const times = () => page.locator('.digital').evaluateAll(nodes => nodes.map(n => n.textContent));
    const dates = () => page.locator('.digital').evaluateAll(nodes => nodes.map(n => n.dateTime));
    const labels = () => page.locator('.day-change').allTextContents();
    const reset = async () => page.locator('main').click({position:{x:5,y:5}});
    assert.equal(await cards.count(), 4);
    assert.deepEqual(await times(), ['23:50:00', '17:50:00', '17:50:00', '05:50:00']);
    const originalWidth = (await cards.first().boundingBox()).width;

    // A real wheel gesture on any city changes a single shared instant.
    await cards.nth(1).hover();
    await page.mouse.wheel(0, 400);
    await page.waitForFunction(() => document.querySelector('.digital').textContent === '00:10:00');
    assert.deepEqual(await times(), ['00:10:00', '18:10:00', '18:10:00', '06:10:00']);
    assert.equal(new Set(await dates()).size, 1);
    assert.deepEqual(await labels(), ['明天', '', '', '']);
    assert.equal(await cards.first().locator('.day-change').evaluate(el => el.classList.contains('future')), true);
    await page.waitForTimeout(400);
    assert((await cards.first().boundingBox()).width > originalWidth);
    assert.equal(await cards.first().locator('.date').evaluate(el => getComputedStyle(el).opacity), '0');
    assert.equal(await cards.first().locator('.zone').evaluate(el => getComputedStyle(el).opacity), '0');
    await page.screenshot({ path: 'tests/preview-mode.png' });

    await reset();
    assert.equal(await page.locator('.page').evaluate(el => el.classList.contains('is-exploring')), false);
    assert.deepEqual(await times(), ['23:50:00', '17:50:00', '17:50:00', '05:50:00']);
    assert.deepEqual(await labels(), ['', '', '', '']);
    await page.waitForTimeout(400);
    assert.equal(await cards.first().locator('.date').evaluate(el => getComputedStyle(el).opacity), '1');

    // Reverse direction crosses yesterday in Beijing, independently of Paris.
    await cards.nth(3).hover();
    await page.mouse.wheel(0, -7200);
    await page.waitForFunction(() => document.querySelectorAll('.digital')[3].textContent === '23:50:00');
    assert.deepEqual(await labels(), ['明天', '明天', '明天', '']);
    assert.equal(await cards.first().locator('.day-change').evaluate(el => el.classList.contains('future')), true);
    await reset();

    // Up/down pointer drags and pointer capture outside the original clock.
    await page.waitForTimeout(400);
    let dial = await cards.nth(2).locator('.dial').boundingBox();
    await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2);
    await page.mouse.down();
    await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2 + 20, { steps: 8 });
    await page.mouse.up();
    assert.deepEqual(await times(), ['00:10:00', '18:10:00', '18:10:00', '06:10:00']);
    assert.equal(await page.evaluate(() => activeDrag), null);
    await reset();
    await page.waitForTimeout(400);
    dial = await cards.first().locator('.dial').boundingBox();
    await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2);
    await page.mouse.down();
    await page.mouse.move(dial.x + dial.width / 2, dial.y + dial.height / 2 - 30, { steps: 8 });
    await page.mouse.up();
    assert.equal((await times())[0], '23:20:00');
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(() => previewTimestamp), null);

    // Horizontal scrolling must remain available for a longer row of clocks.
    await cards.first().dispatchEvent('wheel', { deltaX: 200, deltaY: 1 });
    assert.equal(await page.evaluate(() => previewTimestamp), null);
    await cards.first().focus();
    await page.keyboard.press('ArrowUp');
    assert.equal((await times())[0], '23:45:00');
    await page.keyboard.press('ArrowDown');
    assert.equal((await times())[0], '23:50:00');
    await page.keyboard.press('Home');
    assert.equal(await page.evaluate(() => previewTimestamp), null);

    // Coarse dragging and fine wheel steps compose without resetting either gesture.
    await page.waitForTimeout(400);
    dial = await cards.first().locator('.dial').boundingBox();
    const dragX=dial.x+dial.width/2,dragY=dial.y+dial.height/2;
    await page.mouse.move(dragX,dragY);
    await page.mouse.down();
    await page.mouse.move(dragX,dragY+23);
    assert.equal((await times())[0],'00:13:00');
    await page.mouse.wheel(0,100);
    await page.waitForFunction(()=>document.querySelector('.digital').textContent==='00:15:00');
    await page.mouse.move(dragX,dragY+24);
    assert.equal((await times())[0],'00:16:00');
    await page.mouse.wheel(0,-100);
    await page.waitForFunction(()=>document.querySelector('.digital').textContent==='00:15:00');
    await page.mouse.move(dragX,dragY+30);
    assert.equal((await times())[0],'00:21:00');
    // Pointer capture also allows wheel refinement after moving off all clocks.
    await page.mouse.move(720,720);
    const before=await page.evaluate(()=>previewTimestamp);
    await page.mouse.wheel(0,100);
    await page.waitForFunction(previous=>previewTimestamp>previous,before);
    assert.equal(await cards.first().locator('.digital').textContent().then(text=>Number(text.slice(3,5))%5),0);
    await page.mouse.up();
    assert.equal(await page.evaluate(()=>activeDrag),null);
    await reset();

    // An off-grid time snaps in the requested direction and clears seconds.
    await page.evaluate(()=>setPreview(Date.parse('2026-10-15T21:57:42Z'),false));
    await cards.first().hover();
    await page.mouse.wheel(0,100);
    await page.waitForFunction(()=>document.querySelector('.digital').textContent==='00:00:00');
    await page.mouse.wheel(0,-100);
    await page.waitForFunction(()=>document.querySelector('.digital').textContent==='23:55:00');
    await reset();
    // High-resolution trackpads accumulate small deltas; line-mode mice work too.
    for(let i=0;i<10;i++) await cards.first().dispatchEvent('wheel',{deltaX:0,deltaY:10,deltaMode:0});
    assert.equal((await times())[0],'23:55:00');
    await cards.first().dispatchEvent('wheel',{deltaX:0,deltaY:3,deltaMode:1});
    assert.equal((await times())[0],'00:00:00');
    await reset();
    await page.evaluate(()=>stepTimeGrid(1,'Asia/Kathmandu'));
    assert.equal(await page.evaluate(()=>Number(formatter('Asia/Kathmandu').time.formatToParts(new Date(previewTimestamp)).find(part=>part.type==='minute').value)%5),0);
    await reset();

    // Calendar days, rather than elapsed 24-hour blocks, handle DST and year boundaries.
    assert.equal(await page.evaluate(() => calendarDay('Europe/Paris', new Date('2026-03-29T22:00:00Z')) - calendarDay('Europe/Paris', new Date('2026-03-28T23:00:00Z'))), 1);
    assert.equal(await page.evaluate(() => calendarDay('America/New_York', new Date('2026-11-02T05:00:00Z')) - calendarDay('America/New_York', new Date('2026-11-01T04:00:00Z'))), 1);
    assert.equal(await page.evaluate(() => calendarDay('Asia/Shanghai', new Date('2026-12-31T16:00:00Z')) - calendarDay('Asia/Shanghai', new Date('2026-12-31T15:59:00Z'))), 1);
    await page.evaluate(() => shiftMinutes(2880));
    assert.deepEqual(await labels(), ['明天', '明天', '明天', '明天']);
    await page.getByRole('button', { name: '添加城市', exact: true }).click();
    await page.getByRole('textbox').fill('伦敦');
    await page.locator('.city-option').first().click();
    assert.equal(await cards.count(), 5);
    assert.equal(new Set(await dates()).size, 1);
    await reset();

    // A narrow screen fits the clock grid and supports touch time adjustment.
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const touchPage = await touchContext.newPage();
    await touchPage.clock.setFixedTime(new Date('2026-10-15T21:50:00Z'));
    await touchPage.goto(process.env.CLOCK_TEST_URL || 'http://127.0.0.1:4173/');
    await touchPage.evaluate(()=>{mergeMatchingClocks=()=>{};});
    assert.equal(await touchPage.locator('.clock-card').first().evaluate(el => getComputedStyle(el).touchAction), 'none');
    assert.equal(await touchPage.locator('.clock-scroll').evaluate(el => el.scrollWidth > el.clientWidth), false);
    const session = await touchContext.newCDPSession(touchPage);
    const touchDial = await touchPage.locator('.dial').first().boundingBox();
    const x = touchDial.x + touchDial.width / 2, y = touchDial.y + touchDial.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y + 20 }] });
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    assert.equal(await touchPage.locator('.digital').first().textContent(), '00:10:00');
    await touchPage.waitForTimeout(400);
    assert.equal(await touchPage.locator('.date').first().evaluate(el => getComputedStyle(el).opacity), '0');
    assert.equal(await touchPage.locator('.day-change').first().textContent(), '');
    await touchPage.screenshot({ path: 'tests/preview-mobile.png' });
    await touchContext.close();
    assert.deepEqual(errors, []);
    console.log('PASS: shared time, both wheel directions, mouse/touch drag, cross-day colors, fades, scale, reset, keyboard, horizontal scroll, DST, year boundary, multiple days, adding a clock.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
