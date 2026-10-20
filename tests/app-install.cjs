const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const URL=process.env.CLOCK_TEST_URL || 'http://127.0.0.1:4173/';

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const context=await browser.newContext({viewport:{width:1440,height:900},locale:'zh-CN'});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(URL);
    const button=page.locator('#install-app'),help=page.locator('#install-help');
    assert.equal(await button.getAttribute('aria-label'),'安装到桌面');
    await button.click();
    assert(await help.isVisible());
    assert.match(await help.textContent(),/Chrome.*Edge/);
    await page.screenshot({path:'tests/install-desktop.png'});
    await page.keyboard.press('Escape');
    assert.equal(await help.isVisible(),false);
    // A native prompt cannot be automated headlessly. Exercise the event contract
    // with a deferred user choice, including dismissal and the single-use prompt.
    await page.evaluate(()=>{
      const event=new Event('beforeinstallprompt',{cancelable:true});
      window.promptCalls=0;
      event.prompt=async()=>{window.promptCalls++;};
      event.userChoice=new Promise(resolve=>{window.resolveInstallChoice=resolve;});
      window.dispatchEvent(event);
      window.installEventPrevented=event.defaultPrevented;
    });
    assert.equal(await page.evaluate(()=>window.installEventPrevented),true);
    await button.click();
    assert(await button.isDisabled());
    assert.equal(await page.evaluate(()=>window.promptCalls),1);
    assert.equal(await help.isVisible(),false);
    await page.evaluate(()=>window.resolveInstallChoice({outcome:'dismissed'}));
    await page.waitForFunction(()=>!document.getElementById('install-app').disabled);
    assert(await button.isVisible());
    await button.click();assert(await help.isVisible());
    assert.equal(await page.evaluate(()=>window.promptCalls),1);
    await page.locator('#install-help-close').click();
    // Browser errors fall back to manual installation instructions.
    await page.evaluate(()=>{
      const event=new Event('beforeinstallprompt',{cancelable:true});
      event.prompt=async()=>{throw new Error('unavailable');};
      window.dispatchEvent(event);
    });
    await button.click();assert(await help.isVisible());
    await page.keyboard.press('Escape');
    await page.evaluate(()=>{
      const event=new Event('beforeinstallprompt',{cancelable:true});
      event.prompt=async()=>{};event.userChoice=Promise.resolve({outcome:'accepted'});
      window.dispatchEvent(event);
    });
    await button.click();
    await page.waitForFunction(()=>document.getElementById('install-app').hidden);
    await page.reload();
    await page.evaluate(()=>window.dispatchEvent(new Event('appinstalled')));
    assert.equal(await button.isVisible(),false);

    // Platform instructions and narrow layouts; localized labels follow preferences.
    for(const [platform,ua,expected] of [
      ['iphone','Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1','主屏幕'],
      ['android','Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131.0.0.0 Mobile Safari/537.36','浏览器菜单'],
      ['mac','Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Version/17.0 Safari/605.1.15','程序坞']
    ]) {
      const context=await browser.newContext({viewport:{width:320,height:568},locale:'zh-CN',userAgent:ua,hasTouch:platform!=='mac',isMobile:platform!=='mac'});
      const mobile=await context.newPage();
      await mobile.goto(URL);
      // Ensure deterministic fallback even if this browser offers installation.
      await mobile.evaluate(()=>{pendingInstallPrompt=null;});
      await mobile.locator('#install-app').click();
      assert.match(await mobile.locator('#install-steps').textContent(),new RegExp(expected));
      assert.equal(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      const closeBox=await mobile.locator('#install-help-close').boundingBox();
      assert(closeBox.x>=0 && closeBox.y>=0 && closeBox.x+closeBox.width<=320 && closeBox.y+closeBox.height<=568);
      if(platform==='iphone')await mobile.screenshot({path:'tests/install-mobile.png'});
      await mobile.keyboard.press('Escape');
      await mobile.evaluate(()=>{settings.language='fr';applySettings();});
      assert.equal(await mobile.locator('#install-app').getAttribute('aria-label'),'Installer l’application');
      await context.close();
    }
    // Installed iOS windows omit the download button.
    const installed=await browser.newPage();
    await installed.addInitScript(()=>Object.defineProperty(navigator,'standalone',{get:()=>true}));
    await installed.goto(URL);
    assert.equal(await installed.locator('#install-app').isVisible(),false);
    await installed.close();

    // Verify real install resources and an offline relaunch in the same profile.
    await page.reload();
    await page.evaluate(()=>navigator.serviceWorker.ready);
    await page.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    const manifestResponse=await page.request.get(new global.URL('manifest.webmanifest',URL).href);
    assert(manifestResponse.ok());
    assert.match(manifestResponse.headers()['content-type'],/manifest\+json/);
    const manifest=await manifestResponse.json();
    assert.equal(manifest.display,'standalone');
    for(const icon of manifest.icons) {
      const dimensions=await page.evaluate(async src=>{
        const response=await fetch(src);const image=await createImageBitmap(await response.blob());
        return `${image.width}x${image.height}`;
      },icon.src);
      assert.equal(dimensions,icon.sizes);
    }
    const cdp=await page.context().newCDPSession(page);
    const installability=await cdp.send('Page.getInstallabilityErrors');
    // Playwright's isolated browser profile is incognito, where actual installation
    // is disallowed. Other errors would indicate a broken manifest or app resource.
    assert.deepEqual(installability.installabilityErrors.filter(error=>error.errorId!=='in-incognito'),[]);
    await page.evaluate(()=>{settings.language='fr';applySettings();});
    await page.context().setOffline(true);
    const offline=await page.context().newPage();
    await offline.goto(URL);
    assert(await offline.locator('.clock-card').count()>0);
    assert.equal(await offline.locator('#install-app').getAttribute('aria-label'),'Installer l’application');
    await offline.evaluate(()=>document.fonts.ready);
    const first=await offline.locator('.digital').first().getAttribute('datetime');
    await offline.waitForTimeout(1100);
    const second=await offline.locator('.digital').first().getAttribute('datetime');
    assert.notEqual(first,second,'offline clock continues ticking');
    assert.deepEqual(errors,[]);
    console.log('PASS: install manifest/icons, Chromium installability, prompt acceptance/dismissal/error, platform guidance, localization, installed state, narrow layout and offline relaunch.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
