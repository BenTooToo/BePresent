const assert=require('node:assert/strict');
const {chromium,devices}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({locale:'zh-CN',viewport:{width:1440,height:1000},acceptDownloads:true});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#settings-toggle').click();
    assert.equal(await page.locator('.settings-version').textContent(),'v0.3.0');
    const group=page.locator('#capture-action');
    assert.deepEqual(await group.locator('option').allTextContents(),['剪切板','保存','不预选']);
    assert.equal(await group.locator('option').count(),3);
    assert.equal(await group.inputValue(),'clipboard');
    const camera=await page.locator('[data-enabled="camera"]').boundingBox();
    const modes=await group.boundingBox();assert(modes.y>camera.y);
    await page.locator('[data-enabled="camera"]').uncheck();
    assert.equal(await page.locator('#capture-options').isVisible(),false);
    await page.locator('[data-enabled="camera"]').check();
    await group.selectOption('download');
    assert.equal(await page.evaluate(()=>settings.captureAction),'download');
    await group.selectOption('ask');
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
    assert.equal(await page.locator('#capture-preview').isVisible(),true);
    assert.equal(await page.evaluate(()=>window.captureCount),1);
    await page.keyboard.press('Escape');
    await page.waitForFunction(()=>!document.getElementById('capture-preview').open);
    assert.equal(await page.evaluate(()=>window.captureCount),1);
    await page.locator('#capture').click();await page.locator('#capture-copy').click();
    await page.waitForFunction(()=>!document.getElementById('capture-preview').open);
    assert.equal(await page.evaluate(()=>window.copyCount),1);
    assert.equal(await page.locator('#capture-status').textContent(),'截图已复制到剪贴板');
    await page.locator('#capture').click();
    const download=page.waitForEvent('download');
    await page.locator('#capture-download').click();
    assert.match((await download).suggestedFilename(),/\.png$/);
    await page.waitForFunction(()=>!document.getElementById('capture-preview').open);
    assert.equal(await page.evaluate(()=>settings.captureAction),'ask','The prompt must not overwrite the saved preference');
    await page.locator('#settings-toggle').click();
    for(const language of ['zh','en','fr']) {
      await page.locator('[data-language-select="primary-language"]').click();await page.locator(`.language-choice[data-language="${language}"]`).click();
      for(const width of [280,320,390,480,768,1024,1440,2560]) {
        await page.setViewportSize({width,height:1000});
        for(const id of ['capture-action','numeral-count','numeral-position']) {
          const rect=await page.locator('#'+id).boundingBox();
          assert(rect.x>=0 && rect.x+rect.width<=width);
        }
      }
      for(const id of ['capture-action','numeral-count','numeral-position']) {
        const segment=page.locator('#'+id);
        assert.equal(await segment.isVisible(),true);
        assert.equal(await segment.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true,`${language}: ${id} fits`);
      }
    }
    await page.setViewportSize({width:1440,height:1000});
    await page.locator('[data-language-select="primary-language"]').click();await page.locator(`.language-choice[data-language="${'zh'}"]`).click();
    await page.locator('#numeral-count').selectOption('4');
    assert.equal(await page.evaluate(()=>settings.numeralCount),4);
    await page.locator('#numeral-position').selectOption('inside');
    assert.equal(await page.evaluate(()=>settings.numeralPosition),'inside');
    await page.locator('#developer-options').click();await page.locator('#developer-confirm [value=enable]').click();
    await page.locator('#auto-sort').check();
    await page.locator('#sort-by').selectOption('city');
    await page.locator('#sort-direction').selectOption('desc');
    assert.equal(await page.evaluate(()=>settings.sortBy),'city');
    assert.equal(await page.evaluate(()=>settings.sortDirection),'desc');
    assert.deepEqual(errors,[]);
    const mobile=await browser.newPage({...devices['iPhone 13'],locale:'zh-CN'});
    await mobile.goto('http://127.0.0.1:4173/');await mobile.locator('#settings-toggle').click();
    assert.equal(await mobile.locator('#capture-options').isVisible(),false);
    for(const id of ['numeral-count','numeral-position']) {
      const rect=await mobile.locator('#'+id).boundingBox();assert(rect.x>=0 && rect.x+rect.width<=390);
    }
    await mobile.screenshot({path:'tests/capture-settings-mobile.png'});
    console.log('PASS: v0.3.0, native select controls, persistence, capture prompt/cancel/copy/download, translations and mobile settings.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
