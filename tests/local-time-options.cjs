const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const [timezoneId,id] of [['Europe/Paris','paris'],['Asia/Shanghai','beijing'],['America/New_York','new-york']]) {
      const page=await browser.newPage({timezoneId,reducedMotion:'reduce',viewport:{width:390,height:844}});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:4173/');
      await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===3);
      await page.locator('#settings-toggle').click();
      const main=page.locator('[data-enabled=localTime]'),text=page.locator('[data-enabled=localTimeText]');
      assert.equal(await main.isChecked(),true);assert.equal(await text.isChecked(),true);
      assert.equal(await page.locator('#clocks .home').count(),1);
      await text.uncheck();
      assert.equal(await page.locator('#clocks .home').isVisible(),false);
      assert.equal(await page.evaluate(id=>Boolean(cities.find(city=>city.id===id).el),id),true,'label switch preserves the local clock');
      await main.uncheck();
      assert.equal(await page.locator('#local-time-options').isVisible(),false);
      assert.equal(await page.evaluate(id=>cities.find(city=>city.id===id).el===null,id),true,'main switch hides the whole local city');
      assert.equal(await page.evaluate(()=>cities.length),4,'hidden city is retained');
      assert.equal(await page.evaluate(id=>cities.filter(city=>city.id!==id).every(city=>Boolean(city.el)),id),true,'other cities stay visible, including a merged partner');
      await page.reload();await page.locator('#settings-toggle').click();
      assert.equal(await main.isChecked(),false);assert.equal(await text.isChecked(),false);
      await main.check();
      assert.equal(await page.locator('#local-time-options').isVisible(),true);
      assert.equal(await text.isChecked(),false,'child preference survives parent off/on');
      assert.equal(await page.evaluate(id=>Boolean(cities.find(city=>city.id===id).el),id),true);
      await text.check();assert.equal(await page.locator('#settings-preview .home').isVisible(),true);
      // Hiding the last remaining city must not break the settings or fitting logic.
      await page.evaluate(id=>{cities=[{...catalog.find(city=>city.id===id)}];render();},id);
      await main.uncheck();await page.waitForTimeout(100);
      assert.equal(await page.locator('#clocks > article').count(),0);
      await main.check();assert.equal(await page.locator('#clocks > article').count(),1);
      assert.deepEqual(errors,[]);
      console.log(`PASS ${timezoneId}: defaults, label-only switch, local city visibility, merged partner, persistence, empty layout`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
