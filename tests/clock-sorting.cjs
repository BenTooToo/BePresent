const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const viewport of [{width:1366,height:768},{width:390,height:844}]) {
      const page=await browser.newPage({viewport,reducedMotion:'reduce'});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-19T12:00:00Z'));
      await page.goto('http://127.0.0.1:4173/');
      assert.equal(await page.locator('#sort-clocks').count(),0);
      await page.locator('#settings-toggle').click();
      assert.equal(await page.locator('#auto-sort').isVisible(),false);
      await page.locator('#developer-options').click();
      await page.locator('#developer-confirm [value=enable]').click();
      await page.waitForFunction(()=>settings.developerMode);
      assert.equal(await page.locator('#auto-sort').isChecked(),false);
      assert.equal(await page.locator('#sorting-options').isVisible(),false);
      await page.locator('#merge-timezones').uncheck();
      await page.locator('[data-language-select="primary-language"]').click();await page.locator(`.language-choice[data-language="${'en'}"]`).click();
      await page.evaluate(()=>{
        const ids=['paris','waterloo','new-york','beijing','london','tokyo','sydney','dubai'];
        cities=ids.map(id=>({...catalog.find(city=>city.id===id)}));render();
      });
      const order=()=>page.evaluate(()=>cities.map(city=>city.id));
      await page.locator('#auto-sort').check();
      assert.equal(await page.locator('#sorting-options').isVisible(),true);
      const timezoneAscending=['new-york','waterloo','london','paris','dubai','beijing','tokyo','sydney'];
      assert.deepEqual(await order(),timezoneAscending,'timezone sorting compares numeric UTC offsets, including +11 versus +8');
      await page.locator('#sort-direction').selectOption('desc',{force:true});
      assert.deepEqual(await order(),[...timezoneAscending].reverse());
      await page.locator('#sort-by').selectOption('city',{force:true});
      const alphabetical=['beijing','dubai','london','new-york','paris','sydney','tokyo','waterloo'];
      assert.deepEqual(await order(),[...alphabetical].reverse());
      await page.locator('#sort-direction').selectOption('asc',{force:true});
      assert.deepEqual(await order(),alphabetical);
      await page.locator('#right-drag-reorder').check();
      assert.equal(await page.locator('#auto-sort').isChecked(),false,'enabling drag disables automatic sorting');
      assert.equal(await page.locator('#sorting-options').isVisible(),false);
      await page.evaluate(()=>{cities.reverse();render();});
      assert.deepEqual(await order(),[...alphabetical].reverse(),'manual order is retained when sorting is off');
      await page.locator('#auto-sort').check();
      assert.equal(await page.locator('#right-drag-reorder').isChecked(),false,'enabling automatic sorting disables drag');
      assert.deepEqual(await order(),alphabetical);
      await page.locator('#settings-close').click();
      await page.evaluate(()=>{cities.reverse();render();});
      assert.deepEqual(await order(),alphabetical,'automatic sorting reapplies during rendering without a button');
      await page.evaluate(()=>{cities=defaults.map(city=>({...city}));save();render();});
      await page.locator('#add').click();await page.locator('#search').fill('Dubai');
      await page.locator('.city-option').first().click();
      const finalOrder=['beijing','dubai','new-york','paris','waterloo'];
      assert.deepEqual(await order(),finalOrder,'adding a city applies automatic sorting');
      await page.reload();
      assert.deepEqual(await order(),finalOrder,'sorted order persists');
      await page.locator('#settings-toggle').click();
      assert.equal(await page.locator('#auto-sort').isChecked(),true);
      assert.equal(await page.locator('#sort-by').inputValue(),'city');
      assert.equal(await page.locator('#sort-direction').inputValue(),'asc');
      assert.equal(await page.locator('#right-drag-reorder').isChecked(),false);
      await page.locator('#developer-options').click();await page.locator('#settings-close').click();
      await page.evaluate(()=>{cities.reverse();render();});
      assert.deepEqual(await order(),[...finalOrder].reverse(),'developer mode gates sorting');
      await page.evaluate(()=>localStorage.setItem('be-present-settings',JSON.stringify({...settings,autoSort:true,rightDragReorder:true})));
      await page.reload();
      assert.equal(await page.evaluate(()=>settings.autoSort && !settings.rightDragReorder),true,'conflicting saved values are normalized');
      await page.evaluate(()=>{const saved={...settings,sortingButton:true};delete saved.autoSort;localStorage.setItem('be-present-settings',JSON.stringify(saved));});
      await page.reload();
      assert.equal(await page.evaluate(()=>settings.autoSort),true,'legacy sorting preference migrates');
      assert.deepEqual(errors,[]);
      console.log(`PASS ${viewport.width}: automatic sorting, mutually exclusive switches, numeric timezones, alphabetical order, new cities, persistence, legacy migration`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
