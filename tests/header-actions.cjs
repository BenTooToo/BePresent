const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
      const page=await browser.newPage({viewport,locale:'zh-CN'});
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      await page.goto('http://127.0.0.1:4173/');
      const initial=await page.locator('#install-app').boundingBox();
      const camera=await page.locator('#capture').boundingBox();
      const fullscreen=await page.locator('#fullscreen').boundingBox();
      await page.locator('#settings-toggle').click();
      await page.locator('[data-enabled=camera]').uncheck();
      await page.locator('#settings-close').click();
      const motion=await page.locator('#install-app').evaluate(el=>el.getAnimations().map(a=>({frames:a.effect.getKeyframes(),timing:a.effect.getTiming()})));
      assert.equal(motion.length,1);
      assert.match(motion[0].frames[0].transform,/-49px/);
      assert.equal(motion[0].timing.easing,'cubic-bezier(0.22, 0.61, 0.36, 1)');
      await page.locator('#install-app').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
      assert.equal(await page.locator('#capture').isVisible(),false);
      assert.equal((await page.locator('#install-app').boundingBox()).x,camera.x);
      assert.equal((await page.locator('#fullscreen').boundingBox()).x,fullscreen.x);
      await page.locator('#settings-toggle').click();
      await page.locator('[data-enabled=camera]').check();
      await page.locator('#settings-close').click();
      assert.equal(await page.locator('#install-app').evaluate(el=>el.getAnimations().length),1);
      await page.locator('#install-app').evaluate(el=>Promise.all(el.getAnimations().map(a=>a.finished)));
      assert.equal((await page.locator('#install-app').boundingBox()).x,initial.x);
      await page.locator('#settings-toggle').click();
      await page.locator('[data-enabled=install]').uncheck();
      await page.locator('#settings-close').click();
      assert.equal(await page.locator('#install-app').isVisible(),false);
      await page.reload();
      assert.equal(await page.locator('#install-app').isVisible(),false);
      await page.locator('#settings-toggle').click();
      await page.locator('[data-enabled=install]').check();
      await page.locator('#animations').uncheck();
      await page.locator('[data-enabled=camera]').uncheck();
      await page.locator('#settings-close').click();
      assert.equal(await page.locator('#install-app').isVisible(),true);
      assert.equal(await page.locator('#install-app').evaluate(el=>el.getAnimations().length),0);
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.locator('#settings-toggle').click();
      await page.locator('#animations').check();
      await page.locator('[data-enabled=camera]').check();
      await page.locator('#settings-close').click();
      assert.equal(await page.locator('#install-app').evaluate(el=>el.getAnimations().length),0);
      assert.deepEqual(errors,[]);
      console.log(`PASS ${viewport.width}: download visibility, persistence, camera positions, easing, animation preferences`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
