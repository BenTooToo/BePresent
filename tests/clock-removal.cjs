const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
      const page=await browser.newPage({viewport,reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:4173/');
      await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===3);
      await page.emulateMedia({reducedMotion:'no-preference'});
      const group=page.locator('#clocks > article').filter({has:page.locator('.city',{hasText:'滑铁卢/纽约'})});
      await group.hover();await group.locator('.remove').click();
      await group.getByRole('menuitem',{name:'移除 纽约',exact:true}).click();
      await page.waitForSelector('.removal-overlay');
      assert.equal(await page.locator('.removal-overlay .city').innerText(),'纽约');
      assert.equal(await page.locator('#clocks > article').count(),3);
      assert.equal(await page.evaluate(()=>cities.some(city=>city.id==='new-york')),false);
      assert.equal(await page.evaluate(()=>cities.some(city=>city.id==='waterloo')),true);
      const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('moment-cities')));
      assert(saved.includes('waterloo'));
      const before=await page.locator('.removal-overlay').boundingBox();
      for(let sample=0;sample<5;sample++) {
        await page.waitForTimeout(80);
        const during=await page.locator('.removal-overlay').boundingBox();
        assert(Math.abs(during.x-before.x)<=4.5 && Math.abs(during.y-before.y)<1,'removal trembles in place without flying away');
        assert(Math.abs(during.width-before.width)<1 && Math.abs(during.height-before.height)<1,'the clock retains its size');
      }
      assert.equal(await page.locator('.fusion-particle').count(),44);
      assert.equal(await page.locator('.fusion-halo').evaluate(el=>el.getAnimations()[0].effect.getTiming().direction),'reverse');
      await page.screenshot({path:`tests/removal-${viewport.width}.png`});
      await page.waitForFunction(()=>!document.querySelector('.fusion-overlay,.fusion-particle,.fusion-halo'));
      await page.waitForFunction(()=>pendingRemoval===null);
      await page.waitForTimeout(650);
      const single=page.locator('#clocks > article').filter({has:page.locator('.city',{hasText:'滑铁卢'})});
      const fixedPosition=await page.locator('#clocks > article').first().boundingBox();
      await single.hover();await single.locator('.remove').click();
      assert.equal(await page.locator('#clocks > article').count(),3,'deletion reserves its grid slot during the exit');
      await page.waitForSelector('.removal-overlay');
      assert.equal(await page.locator('.removal-overlay .city').innerText(),'滑铁卢');
      await page.waitForFunction(()=>pendingRemoval?.phase==='waiting');
      assert.equal(await page.locator('.fusion-overlay,.fusion-particle,.fusion-halo').count(),0);
      await page.waitForTimeout(600);
      assert.equal(await page.locator('#clocks > article').count(),3,'the old slots remain during the one-second pause after disappearance');
      const stillPosition=await page.locator('#clocks > article').first().boundingBox();
      for(const key of ['x','y','width','height'])assert(Math.abs(stillPosition[key]-fixedPosition[key])<1,'surviving clocks stay fixed until the pause ends');
      await page.waitForFunction(()=>pendingRemoval===null);
      assert.equal(await page.locator('#clocks > article').count(),2);
      await page.waitForTimeout(650);
      // A settings update may interrupt the exit; deletion stays committed and copies disappear.
      await page.evaluate(()=>{
        cities.push({...catalog.find(city=>city.id==='tokyo')});render();
      });
      const tokyo=page.locator('#clocks > article').filter({has:page.locator('.city',{hasText:'东京'})});
      await tokyo.hover();await tokyo.locator('.remove').click();
      await page.waitForSelector('.removal-overlay');
      await page.evaluate(()=>applySettings());
      assert.equal(await page.locator('.fusion-overlay,.fusion-particle,.fusion-halo').count(),0);
      await page.reload();
      assert.equal(await page.evaluate(()=>cities.some(city=>['waterloo','new-york'].includes(city.id))),false);
      assert.equal(await page.locator('#clocks > article').count(),2);
      await page.emulateMedia({reducedMotion:'reduce'});
      const beijing=page.locator('#clocks > article').filter({has:page.locator('.city',{hasText:'北京'})});
      await beijing.hover();await beijing.locator('.remove').click();
      assert.equal(await page.locator('#clocks > article').count(),1);
      assert.equal(await page.locator('.fusion-overlay,.fusion-particle,.fusion-halo').count(),0);
      assert.deepEqual(errors,[]);
      console.log(`PASS ${viewport.width}: stationary tremble, full disappearance then 1-second pause, fixed grid until reflow, interruption, persistence, reduced motion`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
