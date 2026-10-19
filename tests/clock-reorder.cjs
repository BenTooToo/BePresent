const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
      const page=await browser.newPage({viewport,reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:4173/');
      await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===3);
      const order=()=>page.evaluate(()=>cities.map(city=>city.id));
      const begin=async(from,to)=>{
        const cards=page.locator('#clocks > article');
        const source=await cards.nth(from).locator('.dial').boundingBox();
        const target=await cards.nth(to).locator('.dial').boundingBox();
        await page.mouse.move(source.x+source.width/2,source.y+source.height/2);
        await page.mouse.down({button:'right'});
        await page.mouse.move(target.x+target.width/2,target.y+target.height/2,{steps:10});
      };
      const original=await order();
      await begin(0,2);await page.mouse.up({button:'right'});
      assert.deepEqual(await order(),original,'disabled by default');
      await page.locator('#settings-toggle').click();
      assert.equal(await page.locator('#right-drag-reorder').isVisible(),false);
      await page.locator('#developer-options').click();
      await page.locator('#developer-confirm [value=enable]').click();
      await page.waitForFunction(()=>settings.developerMode);
      const toggle=page.locator('#right-drag-reorder');
      assert.equal(await toggle.isChecked(),false);
      assert.equal(await toggle.locator('..').evaluate(el=>getComputedStyle(el).color),'rgb(237, 128, 128)');
      await toggle.check();
      await page.locator('#settings-close').click();
      await page.emulateMedia({reducedMotion:'no-preference'});
      await begin(0,2);
      assert.equal(await page.locator('.reorder-overlay').count(),1);
      assert.equal(await page.locator('.reorder-target').count(),1);
      assert.equal(await page.evaluate(()=>previewTimestamp),null,'right drag never changes time');
      await page.mouse.up({button:'right'});
      assert.deepEqual(await order(),['beijing','waterloo','new-york','paris']);
      assert.equal(await page.locator('.reorder-overlay,.reorder-target,.reorder-source').count(),0);
      await page.waitForTimeout(700);
      await begin(1,0);await page.mouse.up({button:'right'});
      assert.deepEqual(await order(),['waterloo','new-york','beijing','paris'],'merged cities move together in original member order');
      await page.waitForTimeout(700);
      const saved=await order();
      await begin(0,2);await page.keyboard.press('Escape');await page.mouse.up({button:'right'});
      assert.deepEqual(await order(),saved,'Escape cancels');
      assert.equal(await page.locator('.reorder-overlay').count(),0);
      await begin(0,2);await page.mouse.move(2,2);await page.mouse.up({button:'right'});
      assert.deepEqual(await order(),saved,'dropping outside a clock cancels');
      await page.reload();
      assert.deepEqual(await order(),saved,'order persists after refresh');
      assert.equal(await page.evaluate(()=>settings.rightDragReorder),true);
      await page.locator('#settings-toggle').click();await page.locator('#developer-options').click();await page.locator('#settings-close').click();
      await begin(0,2);await page.mouse.up({button:'right'});
      assert.deepEqual(await order(),saved,'developer mode must be enabled');
      assert.equal(await page.evaluate(()=>previewTimestamp),null);
      assert.deepEqual(errors,[]);
      console.log(`PASS ${viewport.width}: developer gate, right-button drag, group movement, cancellation, persistence, time unchanged`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
