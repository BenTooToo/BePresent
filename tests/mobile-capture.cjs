const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,devices}=require('playwright');

async function main() {
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const context=await browser.newContext({...devices['iPhone 13'],locale:'zh-CN',acceptDownloads:true});
    const page=await context.newPage();
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
      Object.defineProperty(navigator,'clipboard',{configurable:true,value:{write:()=>{throw new Error('Mobile must not copy');}}});
    });
    await page.goto('http://127.0.0.1:4173/');
    await page.evaluate(()=>document.fonts.ready);
    assert.equal(await page.locator('#capture').getAttribute('aria-label'),'拍摄并保存图片');
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#capture').click();
    const download=await downloadPromise;
    assert.match(download.suggestedFilename(),/^be-present-.*\.png$/);
    assert.equal(await download.failure(),null);
    const bytes=fs.readFileSync(await download.path());
    assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert(bytes.length>1000,'Download must contain an actual image');
    assert.equal(await page.locator('#capture-preview').isVisible(),true);
    assert.equal(await page.locator('#capture-share').isVisible(),false);
    assert.equal(await page.locator('#capture-options').isVisible(),false);
    const image=await page.locator('#capture-image').evaluate(async img=>{await img.decode();return {width:img.naturalWidth,height:img.naturalHeight};});
    assert(image.width>=390 && image.height>0);
    await page.screenshot({path:'tests/mobile-capture-preview.png'});
    assert.equal(await page.locator('.capture-host').count(),0);
    const firstURL=await page.locator('#capture-download').getAttribute('href');
    await page.locator('#capture-preview-close').click();
    assert.equal(await page.evaluate(async url=>{try {await fetch(url);return true;}catch{return false;}},firstURL),false);

    // Native sharing receives a real PNG. Cancellation leaves a usable download.
    await page.evaluate(()=>{
      window.sharedFiles=[];
      Object.defineProperty(navigator,'canShare',{configurable:true,value:data=>data.files?.[0]?.type==='image/png'});
      Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{
        window.sharedFiles.push({name:data.files[0].name,type:data.files[0].type,size:data.files[0].size});
        throw new DOMException('Canceled','AbortError');
      }});
    });
    await page.locator('#capture').click();
    await page.waitForFunction(()=>!document.getElementById('capture').disabled);
    assert.equal(await page.locator('#capture-share').isVisible(),true);
    await page.locator('#capture-share').click();
    assert((await page.evaluate(()=>window.sharedFiles)).every(file=>file.type==='image/png' && file.size>1000));
    assert.equal(await page.locator('#capture-save-status').textContent(),'在系统菜单中选择存储图像，或下载 PNG。');
    const manualDownload=page.waitForEvent('download');
    await page.locator('#capture-download').click();
    assert.equal(await (await manualDownload).failure(),null);

    // Permission or activation failures keep both the preview and download usable.
    await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw new DOMException('Denied','NotAllowedError');}}));
    await page.locator('#capture-share').click();
    assert.match(await page.locator('#capture-save-status').textContent(),/无法打开系统菜单/);
    assert.equal(await page.locator('#capture-share').isEnabled(),true);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#capture-preview').isVisible(),false);
    await page.evaluate(()=>{createScreenshotBlob=async()=>{throw new Error('Encoding failed');};});
    await page.locator('#capture').click();
    await page.waitForFunction(()=>!document.getElementById('capture').disabled);
    assert.equal(await page.locator('#capture-status').textContent(),'图片生成失败，请重试。');
    assert.deepEqual(errors,[]);
    await context.close();
    const desktop=await browser.newPage({locale:'en-GB',acceptDownloads:true,viewport:{width:1440,height:900}});
    await desktop.goto('http://127.0.0.1:4173/');
    assert.equal(await desktop.locator('#capture').getAttribute('aria-label'),'Copy full screenshot');
    await desktop.locator('#settings-toggle').click();
    await desktop.locator('[data-select="capture-action"] label').nth(1).click();
    await desktop.locator('#settings-close').click();
    const desktopDownload=desktop.waitForEvent('download');
    await desktop.locator('#capture').click();
    const desktopFile=await desktopDownload;
    assert.equal(await desktopFile.failure(),null);
    assert.equal(fs.readFileSync(await desktopFile.path()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    await desktop.waitForFunction(()=>!document.getElementById('capture').disabled);
    assert.equal(await desktop.locator('#capture-status').textContent(),'Image download started');
    assert.equal(await desktop.locator('#capture-preview').isVisible(),false);
    await desktop.close();
    console.log('PASS: mobile PNG download, native sharing, cancellation, retry, preview cleanup and generation failure.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
