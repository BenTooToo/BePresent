const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
      const page=await browser.newPage({viewport,reducedMotion:'no-preference'});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.addInitScript(()=>{
        if(localStorage.getItem('add-city-test-seeded'))return;
        localStorage.setItem('add-city-test-seeded','true');
        localStorage.setItem('moment-cities',JSON.stringify(['paris']));
        localStorage.setItem('be-present-fused-pairs',JSON.stringify([
          JSON.stringify(['beijing','singapore'].sort()),
          JSON.stringify(['beijing','hong-kong'].sort()),
          JSON.stringify(['singapore','hong-kong'].sort())
        ]));
      });
      await page.goto('http://127.0.0.1:4173/');
      assert.equal(await page.locator('#animations').isChecked(),true,'animations enabled by default');
      const add=async(name)=>{
        await page.locator('#add').click();await page.locator('#search').fill(name);
        await page.locator('.city-option').first().click();
      };
      await add('北京');
      assert.equal(await page.locator('#clocks > article').count(),2);
      const checkFlight=async(name)=>{
        await add(name);
        assert.equal(await page.locator('#clocks > article').count(),3,'new city appears independently despite remembered pair');
        await page.waitForSelector('.fusion-overlay');
        const from=await page.locator('.fusion-overlay').boundingBox();
        await page.waitForTimeout(450);
        const to=await page.locator('.fusion-overlay').boundingBox();
        assert(Math.abs(to.x-from.x)>5 || Math.abs(to.y-from.y)>5,'new clock visibly travels into its partner');
        await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===2);
        await page.waitForFunction(()=>!document.querySelector('.fusion-overlay,.fusion-particle,.fusion-halo'));
      };
      await checkFlight('新加坡');
      await checkFlight('香港');
      assert.match(await page.locator('#clocks .city').allTextContents().then(names=>names.join(' ')),/北京\/新加坡\/香港/);
      await page.reload();
      assert.equal(await page.locator('#clocks > article').count(),2,'existing group survives refresh without replaying');
      await page.waitForTimeout(1000);
      assert.equal(await page.locator('.fusion-overlay').count(),0);
      // Removing and re-adding a previously fused city is another animated entrance.
      const group=page.locator('#clocks > article').filter({has:page.locator('.city',{hasText:'北京/新加坡/香港'})});
      await group.hover();await group.locator('.remove').click();
      await group.getByRole('menuitem',{name:'移除 新加坡',exact:true}).click();
      await page.waitForFunction(()=>pendingRemoval===null);
      await checkFlight('新加坡');
      assert.deepEqual(errors,[]);
      console.log(`PASS ${viewport.width}: default animation, remembered pairs, entrance into an existing group, refresh, remove and re-add`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
