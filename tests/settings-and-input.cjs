const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-15T21:50:00Z'));
    await page.goto('http://127.0.0.1:4173/');
    await page.evaluate(() => document.fonts.ready);
    assert.equal(await page.evaluate(() => document.fonts.check('32px "Instrument Serif"')), true);
    const english = await page.locator('.brand-name').boundingBox();
    const chinese = await page.locator('.brand-chinese').boundingBox();
    assert(chinese.y >= english.y + english.height);
    assert.equal(await page.locator('#support').getAttribute('href'), 'https://bentootoo.com/');

    const open = async () => page.locator('#settings-toggle').click();
    const close = async () => page.locator('#settings-close').click();
    async function assertDockClear(targetPage = page) {
      const panel=await targetPage.locator('#settings-panel').boundingBox();
      const viewport=targetPage.viewportSize();
      assert.equal(panel.x,0);assert.equal(panel.y,0);assert.equal(panel.width,viewport.width);assert.equal(panel.height,viewport.height);
      assert.equal(await targetPage.locator('main').isVisible(),false);
      assert.equal(await targetPage.locator('main').evaluate(el=>el.inert),true);
      assert.equal(await targetPage.locator('#settings-preview .preview-clock').count(),1);
      assert.equal(await targetPage.locator('#add').isVisible(),false);
    }
    await open();
    await assertDockClear();
    assert.deepEqual(await page.locator('[data-enabled]').evaluateAll(nodes => nodes.map(n => n.dataset.enabled)), ['analog','secondHand','numerals','city','country','digital','date','zone','settings','add','fullscreen','camera','title','support']);
    for (const [key, selector] of [['analog','.dial'],['city','.city-line'],['country','.country'],['digital','.time-area'],['date','.date'],['zone','.zone']]) {
      await page.locator(`[data-enabled="${key}"]`).uncheck();
      assert.equal(await page.locator('#settings-preview '+selector).first().isVisible(), false, key);
      await page.locator(`[data-enabled="${key}"]`).check();
      assert.equal(await page.locator('#settings-preview '+selector).first().isVisible(), true, key);
    }
    await page.locator('#primary-language').selectOption('en');
    assert.equal(await page.locator('#settings-title').textContent(), 'Customize');
    assert.equal(await page.locator('.city').first().textContent(), 'Paris');
    assert.equal(await page.locator('.country').first().textContent(), 'France');
    await page.locator('#multilingual').check();
    await page.locator('#secondary-language').selectOption('zh');
    await page.locator('#third-language').selectOption('fr');
    assert.deepEqual(await page.locator('.city').first().locator('.translation-line').allTextContents(), ['Paris','巴黎','Paris']);
    assert.equal(await page.locator('.date').first().locator('.translation-line').count(), 3);
    await assertDockClear();
    await page.screenshot({ path: 'tests/settings-desktop.png' });

    for (const key of ['settings','add','fullscreen','title']) await page.locator(`[data-enabled="${key}"]`).uncheck();
    await close();
    await page.mouse.click(720, 100);
    await page.mouse.move(720, 400);
    await page.waitForTimeout(250);
    for (const id of ['settings-toggle','add','fullscreen']) assert.equal(await page.locator(`#${id}`).evaluate(el => getComputedStyle(el).opacity), '0', id);
    assert.equal(await page.locator('.brand').isVisible(), false);
    await page.mouse.move(700, 995);
    await page.waitForTimeout(250);
    for (const id of ['settings-toggle','add']) assert.equal(await page.locator(`#${id}`).evaluate(el => getComputedStyle(el).opacity), '1');
    await page.mouse.move(700, 5);
    await page.waitForTimeout(250);
    assert.equal(await page.locator('#fullscreen').evaluate(el => getComputedStyle(el).opacity), '1');
    await page.reload();
    assert.equal(await page.evaluate(() => settings.language), 'en');
    assert.equal(await page.evaluate(() => settings.enabled.title), false);
    await page.mouse.move(700, 995);
    await open();
    assert.equal(await page.locator('#third-language').inputValue(), 'fr');
    assert.equal(await page.locator('[data-enabled="settings"]').isChecked(), false);
    await page.evaluate(() => localStorage.removeItem('be-present-settings'));
    await page.reload();

    // Three independent numeric fields update the same instant, including seconds.
    const cards = page.locator('.clock-card');
    const times = () => page.locator('.digital').evaluateAll(nodes => nodes.map(n => n.textContent));
    // Clicking another field commits a single digit, keeps the editor open and selects its contents.
    await cards.first().locator('.digital [data-time-part="0"]').click();
    const clickFields=cards.first().locator('.time-editor input');
    await clickFields.nth(0).fill('9');
    await clickFields.nth(1).click();
    assert.equal(await clickFields.nth(0).inputValue(),'09');
    assert.equal(await clickFields.nth(1).evaluate(el=>el===document.activeElement),true);
    assert.equal(await clickFields.nth(1).evaluate(el=>el.selectionEnd-el.selectionStart),2);
    await clickFields.nth(1).fill('7');
    await clickFields.nth(2).click();
    assert.equal(await clickFields.nth(1).inputValue(),'07');
    assert.equal((await times())[0],'09:07:00');
    await clickFields.nth(0).click();
    await clickFields.nth(0).fill('99');
    await clickFields.nth(1).click();
    assert.equal(await clickFields.nth(1).evaluate(el=>el===document.activeElement),true);
    assert.equal(await clickFields.nth(0).getAttribute('aria-invalid'),'false');
    assert.equal(await clickFields.nth(0).inputValue(),'09');
    await clickFields.nth(1).fill('');
    assert.equal(await clickFields.nth(1).getAttribute('aria-invalid'),'true');
    await clickFields.nth(2).click();
    assert.equal(await clickFields.nth(1).inputValue(),'07');
    assert.equal(await page.locator('.time-error').count(),0);
    assert.equal(await page.locator('[role="alert"]').count(),0);
    await page.keyboard.press('Escape');
    await cards.nth(2).locator('.digital [data-time-part="0"]').click();
    const form = cards.nth(2).locator('.time-editor');
    const fields = form.locator('input');
    assert.equal(await fields.count(), 3);
    await fields.nth(0).fill('18');
    assert.equal(await fields.nth(0).evaluate(el => el === document.activeElement), true);
    await page.keyboard.press('Enter');
    assert.equal(await fields.nth(1).evaluate(el => el === document.activeElement), true);
    await fields.nth(1).fill('45');
    await page.keyboard.press('Enter');
    assert.equal(await fields.nth(2).evaluate(el => el === document.activeElement), true);
    await fields.nth(2).fill('30');
    assert.deepEqual(await times(), ['00:45:30','18:45:30','18:45:30','06:45:30']);
    await page.keyboard.press('Enter');
    assert.equal(await form.isVisible(), false);
    assert.equal(new Set(await page.locator('.digital').evaluateAll(nodes => nodes.map(n => n.dateTime))).size, 1);
    await page.screenshot({ path: 'tests/edited-time.png' });

    await cards.first().locator('.digital [data-time-part="0"]').click();
    const parisFields = cards.first().locator('.time-editor input');
    await parisFields.nth(0).pressSequentially('99');
    assert.equal(await parisFields.nth(0).getAttribute('aria-invalid'),'true');
    await page.keyboard.press('Enter');
    assert.equal(await cards.first().locator('.time-editor').isVisible(), true);
    assert.equal(await parisFields.nth(1).evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    assert.equal(await cards.first().locator('.time-editor').isVisible(), false);
    assert.equal((await times())[0], '00:45:30');
    // Empty input also restores its original value on Enter.
    await cards.first().locator('.digital [data-time-part="0"]').click();
    await parisFields.nth(0).fill('');
    await page.keyboard.press('Enter');
    assert.equal((await times())[0], '00:45:30');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    // Wheel recovery works directly over the invalid input and uses five-minute marks.
    await cards.first().locator('.digital [data-time-part="0"]').click();
    await parisFields.nth(0).fill('99');
    await parisFields.nth(0).hover();
    await page.mouse.wheel(0,100);
    await page.waitForFunction(()=>document.querySelector('.digital').textContent==='00:50:00');
    assert.equal(await cards.first().locator('.time-editor').isVisible(),false);
    // Drag recovery restores the valid draft before applying the drag distance.
    await cards.first().locator('.digital [data-time-part="0"]').click();
    await parisFields.nth(0).fill('');
    const recoveryDial=await cards.first().locator('.dial').boundingBox();
    const rx=recoveryDial.x+recoveryDial.width/2,ry=recoveryDial.y+recoveryDial.height/2;
    await page.mouse.move(rx,ry);await page.mouse.down();
    await page.mouse.move(rx,ry+12);await page.mouse.up();
    assert.equal((await times())[0],'01:02:00');
    assert.equal(await cards.first().locator('.time-editor').isVisible(),false);

    // Reject a nonexistent local DST time, and preserve the nearest repeated hour.
    await page.clock.setFixedTime(new Date('2026-03-29T00:30:00Z'));
    await page.evaluate(() => setPreview(Date.parse('2026-03-29T00:30:00Z'), false));
    await cards.first().locator('.digital [data-time-part="0"]').click();
    await parisFields.nth(0).fill('2');
    assert.equal(await parisFields.nth(0).getAttribute('aria-invalid'),'true');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    assert.equal(await cards.first().locator('.time-editor').isVisible(), false);
    assert.equal((await times())[0], '01:30:00');
    assert.equal(await page.evaluate(() => resolveWallTime('America/New_York', Date.parse('2026-11-01T05:30:00Z'), 1, 45, 0)), Date.parse('2026-11-01T05:45:00Z'));
    assert.equal(await page.evaluate(() => resolveWallTime('America/New_York', Date.parse('2026-11-01T06:30:00Z'), 1, 45, 0)), Date.parse('2026-11-01T06:45:00Z'));
    await page.locator('main').click({position:{x:5,y:5}});
    assert.equal(await page.evaluate(() => previewTimestamp), null);

    // The dock remains below the clocks on small screens, also in three languages.
    await page.setViewportSize({ width: 390, height: 844 });
    await open();
    await assertDockClear();
    await page.locator('#multilingual').check();
    await page.locator('#third-language').selectOption('fr');
    await assertDockClear();
    await page.screenshot({ path: 'tests/settings-mobile.png' });
    await close();
    assert.deepEqual(errors, []);
    console.log('PASS: local font, stacked title, sponsor link, ordered controls, content visibility, three languages, persistence, hidden-button edge reveal, non-overlapping desktop/mobile drawer, numeric editing, seconds, auto field switching, validation, DST gaps/repeated hours, reset.');
  } finally {
    await browser.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
