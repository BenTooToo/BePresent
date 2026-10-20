const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,devices}=require('playwright');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({...devices['iPhone 13'],locale:'zh-CN',acceptDownloads:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>Object.defineProperty(navigator,'share',{configurable:true,value:undefined}));
    await page.goto('http://127.0.0.1:4173/');
    async function open() {
      await page.locator('#capture').click();
      await page.waitForFunction(()=>document.getElementById('capture-preview').dataset.state==='ready' && !document.getElementById('capture-download').disabled);
    }
    async function closed() {
      await page.waitForFunction(()=>!document.getElementById('capture-preview').open && document.getElementById('capture').style.visibility==='');
      assert.equal(await page.evaluate(()=>captureImageURL),null);
    }
    await open();
    assert.equal(await page.locator('#capture-share').count(),0);
    assert.equal(await page.locator('#capture-copy').isVisible(),false);
    assert.equal(await page.locator('.capture-host').count(),0);
    const downloadPromise=page.waitForEvent('download');
    await page.locator('#capture-download').click();
    const download=await downloadPromise;
    assert.equal(fs.readFileSync(await download.path()).subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    await closed();
    // Even when native sharing is supported, saving has a single PNG action.
    await page.evaluate(()=>{
      Object.defineProperty(navigator,'canShare',{configurable:true,value:()=>true});
      Object.defineProperty(navigator,'share',{configurable:true,value:async()=>{throw Error('Unexpected duplicate share action');}});
    });
    await open();
    assert.equal(await page.locator('#capture-share').count(),0);
    assert.equal(await page.locator('#capture-download').textContent(),'保存图片');
    await page.locator('#capture-preview-close').click();await closed();
    assert.deepEqual(errors,[]);
    console.log('PASS: mobile preview, single PNG save action, return animation, retry and resource cleanup');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
