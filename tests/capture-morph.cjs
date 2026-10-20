const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,devices}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const options of [{viewport:{width:1366,height:768}},{...devices['iPhone 13']},{viewport:{width:568,height:320},reducedMotion:'reduce'}]) {
      const page=await browser.newPage({...options,locale:'zh-CN',acceptDownloads:true});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{
        window.copiedImages=0;
        Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:async items=>{
          const blob=await items[0].getType('image/png');if(!blob.size)throw Error('Empty image');window.copiedImages++;
        }}});
        Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
        Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{window.sharedImage=true;}});
      });
      await page.goto('http://127.0.0.1:4173/');
      await page.evaluate(()=>{window.screenshots=0;window.originalScreenshot=createScreenshotBlob;createScreenshotBlob=()=>{window.screenshots++;return window.originalScreenshot();};});
      const button=page.locator('#capture'),preview=page.locator('#capture-preview');
      const origin=await button.boundingBox();
      async function ready() {
        await page.waitForFunction(()=>document.getElementById('capture-preview').dataset.state==='ready' && !document.getElementById('capture-download').disabled);
        const rect=await preview.boundingBox();
        assert(rect.y>origin.y && rect.width>origin.width && rect.height>origin.height);
        assert(rect.x>=0 && rect.y>=0 && rect.x+rect.width<=page.viewportSize().width && rect.y+rect.height<=page.viewportSize().height);
        assert(await page.locator('#capture-image').evaluate(img=>img.naturalWidth>0));
        assert.equal(await preview.evaluate(el=>getComputedStyle(el,'::backdrop').backdropFilter),'none');
        assert.equal(await page.locator('#capture-share').count(),0);
        assert.equal(await page.locator('#capture-download').textContent(),'保存图片');
      }
      async function returned() {
        await page.waitForFunction(()=>!document.getElementById('capture-preview').open && document.getElementById('capture').style.visibility==='');
        assert.equal(await button.getAttribute('aria-expanded'),'false');
        const rect=await button.boundingBox();assert.deepEqual(rect,origin);
        assert.equal(await button.evaluate(el=>el===document.activeElement),true);
        assert.equal(await page.evaluate(()=>captureImageURL),null);
      }
      await button.click();await ready();
      if(options.viewport?.width===1366)await page.screenshot({path:'tests/capture-morph-desktop.png'});
      if(options.isMobile)await page.screenshot({path:'tests/capture-morph-mobile.png'});
      await page.locator('#capture-preview-close').click();await returned();
      await button.click();await ready();
      const count=await page.evaluate(()=>window.screenshots);
      const downloadPromise=page.waitForEvent('download');
      await page.locator('#capture-download').click();
      const download=await downloadPromise;
      assert.equal(fs.readFileSync(await download.path()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
      await returned();assert.equal(await page.evaluate(()=>window.screenshots),count);
      await button.click();await ready();await page.keyboard.press('Escape');await returned();
      if(!options.isMobile) {
        await button.click();await ready();await page.locator('#capture-copy').click();await returned();
        assert.equal(await page.evaluate(()=>window.copiedImages),1);
      }
      // Cancel while the image is still being generated; a late result must not reopen it.
      await page.evaluate(()=>{createScreenshotBlob=()=>new Promise(resolve=>{window.resolveLateScreenshot=resolve;});});
      await button.click();await page.keyboard.press('Escape');await returned();
      await page.evaluate(()=>window.resolveLateScreenshot(new Blob(['late'],{type:'image/png'})));
      assert.equal(await preview.isVisible(),false);
      assert.equal(await page.evaluate(()=>captureImageURL),null);
      await page.evaluate(()=>{createScreenshotBlob=async()=>{throw Error('generation failed');};});
      await button.click();await returned();
      assert.equal(await page.locator('#capture-status').textContent(),'图片生成失败，请重试。');
      assert.deepEqual(errors,[]);
      console.log(`PASS ${page.viewportSize().width}: animated preview, return, download, copy, Escape, late cancellation, error cleanup`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
