const assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({locale:'zh-CN',viewport:{width:1440,height:1000},acceptDownloads:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#settings-toggle').click();
    assert.equal(await page.locator('.settings-version').textContent(),'v0.2.0');
    const group=page.locator('[data-select="capture-action"]');
    assert.equal(await group.getByRole('radio').count(),3);
    assert.equal(await group.getByRole('radio',{checked:true}).inputValue(),'clipboard');
    const camera=await page.locator('[data-enabled="camera"]').boundingBox();
    const modes=await group.boundingBox();assert(modes.y>camera.y);
    await page.locator('[data-enabled="camera"]').uncheck();
    assert.equal(await page.locator('#capture-options').isVisible(),false);
    await page.locator('[data-enabled="camera"]').check();
    await group.locator('label').first().click();
    await group.getByRole('radio',{checked:true}).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>settings.captureAction),'download');
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.evaluate(()=>settings.captureAction),'ask');
    assert.equal(await group.getByRole('radio',{checked:true}).count(),1);
    // Drag the thumb to each end; one setting remains selected.
    const bounds=await group.boundingBox();
    await page.mouse.move(bounds.x+bounds.width-15,bounds.y+18);await page.mouse.down();
    await page.mouse.move(bounds.x+15,bounds.y+18,{steps:8});await page.mouse.up();
    assert.equal(await page.evaluate(()=>settings.captureAction),'clipboard');
    await page.mouse.move(bounds.x+15,bounds.y+18);await page.mouse.down();
    await page.mouse.move(bounds.x+bounds.width-15,bounds.y+18,{steps:8});await page.mouse.up();
    assert.equal(await page.evaluate(()=>settings.captureAction),'ask');
    await page.screenshot({path:'tests/capture-settings-desktop.png'});
    await page.reload();
    assert.equal(await page.evaluate(()=>settings.captureAction),'ask');
    await page.evaluate(()=>{
      window.captureCount=0;window.copyCount=0;
      const original=createScreenshotBlob;
      createScreenshotBlob=()=>{window.captureCount++;return original();};
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{
        const blob=await items[0].getType('image/png');if(!blob.size)throw new Error('Empty copy');window.copyCount++;
      }}});
    });
    await page.locator('#capture').click();
    assert.equal(await page.locator('#capture-choice').isVisible(),true);
    assert.equal(await page.evaluate(()=>window.captureCount),0);
    await page.keyboard.press('Escape');
    assert.equal(await page.evaluate(()=>window.captureCount),0);
    await page.locator('#capture').click();await page.locator('#capture-choice-copy').click();
    await page.waitForFunction(()=>!document.getElementById('capture').disabled);
    assert.equal(await page.evaluate(()=>window.copyCount),1);
    assert.equal(await page.locator('#capture-status').textContent(),'截图已复制到剪贴板');
    await page.locator('#capture').click();
    const download=page.waitForEvent('download');
    await page.locator('#capture-choice-save').click();
    assert.match((await download).suggestedFilename(),/\.png$/);
    await page.waitForFunction(()=>!document.getElementById('capture').disabled);
    assert.equal(await page.evaluate(()=>settings.captureAction),'ask','The prompt must not overwrite the saved preference');
    await page.locator('#settings-toggle').click();
    for(const language of ['zh','en','fr']) {
      await page.locator('#primary-language').selectOption(language);
      for(const id of ['capture-action','numeral-count','numeral-position']) {
        const segment=page.locator(`[data-select="${id}"]`);
        assert.equal(await segment.getByRole('radio',{checked:true}).count(),1);
        assert.equal(await segment.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,`${language}: ${id} fits`);
      }
    }
    await page.locator('#primary-language').selectOption('zh');
    await page.locator('[data-select="numeral-count"] label').first().click();
    assert.equal(await page.evaluate(()=>settings.numeralCount),4);
    await page.locator('[data-select="numeral-position"] label').last().click();
    assert.equal(await page.evaluate(()=>settings.numeralPosition),'inside');
    await page.locator('#developer-options').click();await page.locator('#developer-confirm [value=enable]').click();
    await page.locator('#auto-sort').check();
    await page.locator('[data-select="sort-by"] label').last().click();
    await page.locator('[data-select="sort-direction"] label').last().click();
    assert.equal(await page.evaluate(()=>settings.sortBy),'city');
    assert.equal(await page.evaluate(()=>settings.sortDirection),'desc');
    assert.deepEqual(errors,[]);
    const mobile=await browser.newPage({...devices['iPhone 13'],locale:'zh-CN'});
    await mobile.goto('http://127.0.0.1:4173/');await mobile.locator('#settings-toggle').click();
    assert.equal(await mobile.locator('#capture-options').isVisible(),false);
    for(const id of ['numeral-count','numeral-position']) {
      const rect=await mobile.locator(`[data-select="${id}"]`).boundingBox();assert(rect.x>=0 && rect.x+rect.width<=390);
    }
    await mobile.screenshot({path:'tests/capture-settings-mobile.png'});
    console.log('PASS: v0.2.0, exclusive segmented controls, dragging, keyboard, persistence, capture prompt/cancel/copy/download, translations and mobile settings.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
