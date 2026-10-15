const assert=require('node:assert/strict');
const {chromium}=require('playwright');

async function main() {
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1440,height:900}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-15T12:34:56Z'));
    await page.goto('http://127.0.0.1:4173/');
    const card=page.locator('.clock-card').first();
    const digital=card.locator('.digital'),form=card.locator('.time-editor'),fields=form.locator('input');
    const focused=async index=>assert.equal(await fields.nth(index).evaluate(el=>el===document.activeElement),true);
    const clickPart=async index=>digital.locator(`[data-time-part="${index}"]`).last().click();
    assert.equal(await digital.textContent(),'14:34:56');

    await clickPart(2);
    await focused(2);
    assert.equal(await fields.nth(2).evaluate(el=>el.selectionEnd-el.selectionStart),2);
    await fields.nth(2).fill('12');
    await focused(2);
    await page.keyboard.press('Enter');
    assert.equal(await form.isVisible(),false);
    assert.equal(await digital.textContent(),'14:34:12');

    await clickPart(1);
    await focused(1);
    await fields.nth(1).fill('45');
    await focused(1);
    await page.keyboard.press('Enter');
    await focused(2);
    assert.equal(await fields.nth(2).inputValue(),'12');
    await page.keyboard.press('Enter');
    assert.equal(await digital.textContent(),'14:45:12');

    await clickPart(0);
    await focused(0);
    await fields.nth(0).fill('09');
    await focused(0);
    await page.keyboard.press('Enter');
    await focused(1);
    await fields.nth(1).fill('7');
    await page.keyboard.press('Enter');
    assert.equal(await fields.nth(1).inputValue(),'07');
    await focused(2);
    await fields.nth(2).fill('8');
    await page.keyboard.press('Enter');
    assert.equal(await form.isVisible(),false);
    assert.equal(await digital.textContent(),'09:07:08');
    assert.equal(new Set(await page.locator('.digital').evaluateAll(nodes=>nodes.map(node=>node.dateTime))).size,1);

    // Invalid values restore before Enter advances to the next input.
    await clickPart(0);
    await fields.nth(0).fill('');
    await page.keyboard.press('Enter');
    assert.equal(await fields.nth(0).inputValue(),'09');
    await focused(1);
    await fields.nth(1).pressSequentially('99');
    assert.equal(await fields.nth(1).getAttribute('aria-invalid'),'true');
    await page.keyboard.press('Enter');
    assert.equal(await fields.nth(1).inputValue(),'07');
    await focused(2);
    await page.keyboard.press('Enter');
    assert.equal(await digital.textContent(),'09:07:08');

    // Mouse/touch hit targets remain the same after repeated clock updates.
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(600);
    await clickPart(2);await focused(2);
    await page.keyboard.press('Escape');
    await digital.focus();await page.keyboard.press('Enter');await focused(0);
    await page.keyboard.press('Escape');
    assert.deepEqual(errors,[]);
    console.log('PASS: clicking each displayed segment edits that segment; two digits do not steal focus; Enter moves hours → minutes → seconds → finish; invalid values restore before advancing; clocks stay synchronized; mobile and keyboard access.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
