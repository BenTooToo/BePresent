const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const viewport of [{width:1366,height:768},{width:390,height:844},{width:568,height:320}]) {
      const page=await browser.newPage({viewport});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:4173/');
      await page.locator('#settings-toggle').click();
      const toggle=page.locator('#developer-options'),dialog=page.locator('#developer-confirm');
      assert.equal(await toggle.isChecked(),false);
      assert.equal(await page.locator('#experimental-features > .setting-row').count(),2);
      await toggle.click();assert.equal(await dialog.isVisible(),true);
      assert.equal(await toggle.isChecked(),false,'mode stays off until confirmation');
      assert.match(await dialog.innerText(),/奇奇怪怪/);
      await page.screenshot({path:`tests/developer-warning-${viewport.width}.png`});
      await dialog.locator('[value=cancel]').click();
      assert.equal(await toggle.isChecked(),false);
      assert.equal(await toggle.evaluate(el=>el===document.activeElement),true);
      await toggle.click();await page.keyboard.press('Escape');
      assert.equal(await dialog.isVisible(),false);
      assert.equal(await page.locator('#settings-panel').isVisible(),true);
      assert.equal(await toggle.isChecked(),false);
      await toggle.click();await dialog.locator('[value=enable]').click();
      await page.waitForFunction(()=>settings.developerMode);
      assert.equal(await toggle.isChecked(),true);
      assert.equal(await page.evaluate(()=>settings.developerMode),true);
      // Test the shared styling with a temporary fixture, without shipping an option.
      await page.evaluate(()=>{
        const row=document.createElement('label');row.className='setting-row';row.id='experimental-test';
        row.innerHTML='<span>Test</span><input type="checkbox" role="switch">';
        document.getElementById('experimental-features').append(row);
      });
      assert.equal(await page.locator('#experimental-test').isVisible(),true);
      assert.equal(await page.locator('#experimental-test').evaluate(el=>getComputedStyle(el).color),'rgb(237, 128, 128)');
      await page.locator('#experimental-test input').check();
      await page.waitForFunction(()=>getComputedStyle(document.querySelector('#experimental-test input')).backgroundColor==='rgb(237, 128, 128)');
      assert.equal(await page.locator('#experimental-test input').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(237, 128, 128)');
      await page.reload();await page.locator('#settings-toggle').click();
      assert.equal(await toggle.isChecked(),true,'confirmed mode persists');
      assert.equal(await page.locator('#experimental-features > .setting-row').count(),2);
      await toggle.click();assert.equal(await dialog.isVisible(),false,'turning off needs no warning');
      assert.equal(await page.evaluate(()=>settings.developerMode),false);
      for(const language of ['en','fr']) {
        await page.locator('#primary-language').selectOption(language);
        await toggle.click();
        const rect=await dialog.boundingBox();
        assert(rect.x>=0 && rect.y>=0 && rect.x+rect.width<=viewport.width && rect.y+rect.height<=viewport.height);
        assert.equal(await page.locator('#developer-confirm-title').innerText(),await page.evaluate(()=>t('enableDeveloper')));
        await dialog.locator('[value=cancel]').click();
      }
      assert.deepEqual(errors,[]);
      console.log(`PASS ${viewport.width}: confirmation, cancel, Escape, persistence, red experimental switches, three languages`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
