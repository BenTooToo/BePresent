const assert = require('node:assert/strict');
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true});
  try {
    for (const viewport of [{width:1366,height:768},{width:390,height:844}]) {
      const page=await browser.newPage({viewport});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:4173/');
      assert.equal(await page.locator('#clocks > article').count(),4);
      await page.waitForSelector('.fusion-overlay');
      const before=await page.locator('.fusion-overlay').boundingBox();
      await page.waitForTimeout(480);
      const during=await page.locator('.fusion-overlay').boundingBox();
      assert.ok(during.x<before.x || during.y<before.y,'right-hand clock travels toward its partner');
      await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===3);
      await page.waitForSelector('.fusion-particle',{state:'attached'});
      await page.waitForTimeout(220);
      assert.equal(await page.locator('.fusion-halo').count(),1);
      await page.screenshot({path:`tests/fusion-particles-${viewport.width}.png`});
      assert.equal(await page.evaluate(()=>cities.length),4,'all individual cities stay saved');
      const group=page.locator('#clocks > article').filter({has:page.locator('.city',{hasText:'滑铁卢/纽约'})});
      assert.equal(await group.locator('.country').innerText(),'加拿大/美国');
      await page.waitForFunction(()=>!document.querySelector('.fusion-particle'));
      // Completed groups remain merged through settings updates and full reloads.
      await page.evaluate(()=>applySettings());
      assert.equal(await page.locator('#clocks > article').count(),3);
      assert.equal(await page.locator('.fusion-overlay,.fusion-particle').count(),0);
      await page.reload();
      assert.equal(await page.locator('#clocks > article').count(),3);
      await page.waitForTimeout(1000);
      assert.equal(await page.locator('.fusion-overlay,.fusion-particle').count(),0);
      await group.locator('.digital').click();
      await group.locator('.time-editor input').first().fill('12');
      await group.locator('.time-editor input').first().press('Enter');
      assert.match(await group.locator('.digital').innerText(),/^12:/);
      await page.screenshot({path:`tests/fusion-${viewport.width}.png`});
      await group.hover();
      assert.equal(await group.locator('.remove').count(),1);
      await group.locator('.remove').click();
      assert.deepEqual(await group.getByRole('menuitem').allTextContents(),['滑铁卢','纽约']);
      const trigger=await group.locator('.remove').boundingBox(),menu=await group.locator('.remove-menu').boundingBox();
      assert(Math.abs(trigger.y+trigger.height-menu.y)<=2,'menu directly touches the close button');
      await page.screenshot({path:`tests/fusion-remove-menu-${viewport.width}.png`});
      await group.locator('.remove').press('Escape');
      assert.equal(await group.locator('.remove-menu').isVisible(),false);
      await group.locator('.remove').click();
      await group.getByRole('menuitem',{name:'移除 纽约',exact:true}).click();
      assert.equal(await page.evaluate(()=>cities.some(city=>city.id==='waterloo')),true);
      assert.equal(await page.evaluate(()=>cities.some(city=>city.id==='new-york')),false);
      assert.equal(await page.locator('#clocks > article').count(),3);
      await page.waitForFunction(()=>pendingRemoval===null);
      // Interrupt a new flight by changing settings; no detached copies may remain.
      await page.evaluate(()=>{fusedPairs.clear();cities=defaults.map(city=>({...city}));render();});
      await page.waitForSelector('.fusion-overlay');
      await page.evaluate(()=>{settings.multilingual=true;settings.secondLanguage='en';applySettings();});
      await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===3);
      assert.match(await page.locator('#clocks .city').allTextContents().then(names=>names.join(' ')),/Waterloo\/New York/);
      await page.waitForFunction(()=>!document.querySelector('.fusion-overlay,.fusion-particle'));
      assert.deepEqual(errors,[]);
      console.log(`PASS ${viewport.width}: travel, burst, labels, editing, removal, interruption`);
      await page.close();
    }
    const page=await browser.newPage({reducedMotion:'reduce'});
    await page.goto('http://127.0.0.1:4173/');
    await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===3);
    assert.equal(await page.locator('.fusion-overlay,.fusion-particle').count(),0);
    await page.evaluate(()=>{cities=catalog.filter(city=>['beijing','singapore','hong-kong','paris'].includes(city.id));render();});
    await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===2);
    assert.match(await page.locator('#clocks .city').allTextContents().then(names=>names.join(' ')),/北京\/新加坡\/香港/);
    await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
    await page.evaluate(()=>{cities=[{...catalog.find(city=>city.id==='paris')},{id:'lagos',name:'Lagos',country:'Nigeria',zone:'Africa/Lagos'}];render();});
    assert.equal(await page.locator('#clocks > article').count(),2);
    await page.clock.setFixedTime(new Date('2026-10-26T12:00:00Z'));
    await page.evaluate(()=>update());
    await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===1);
    await page.clock.setFixedTime(new Date('2027-07-01T12:00:00Z'));
    await page.evaluate(()=>update());
    assert.equal(await page.locator('#clocks > article').count(),2,'DST differences split the group again');
    console.log('PASS reduced motion, three-city groups, DST regrouping');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
