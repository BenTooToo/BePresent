const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1366,height:768}});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.locator('#settings-toggle').click();
    for(const id of ['animations','merge-timezones','deduplicate-translations'])assert.equal(await page.locator('#'+id).isChecked(),true);
    assert.equal(await page.locator('#translation-filter').isVisible(),false);
    await page.locator('#animations').uncheck();
    await page.locator('#merge-timezones').uncheck();
    await page.locator('#multilingual').check();
    await page.locator('#primary-language').selectOption('en');
    await page.locator('#secondary-language').selectOption('fr');
    const paris=page.locator('#clocks > article').filter({has:page.locator('.city',{hasText:'Paris'})});
    assert.deepEqual(await paris.locator('.city .translation-line').allTextContents(),['Paris']);
    assert.deepEqual(await paris.locator('.country .translation-line').allTextContents(),['France']);
    assert.equal(await paris.locator('.date .translation-line').count(),2,'distinct translated dates remain visible');
    const info=page.locator('#translation-info-button');
    await info.hover();assert.equal(await page.locator('#translation-info').isVisible(),true);
    await info.focus();assert.equal(await page.locator('#translation-info').isVisible(),true);
    await page.locator('#deduplicate-translations').uncheck();
    assert.deepEqual(await paris.locator('.country .translation-line').allTextContents(),['France','France']);
    await page.locator('#deduplicate-translations').check();
    await page.locator('#third-language').selectOption('zh');
    assert.deepEqual(await paris.locator('.country .translation-line').allTextContents(),['France','法国']);
    assert.deepEqual(await page.locator('#settings-preview .country .translation-line').allTextContents(),await page.evaluate(()=>{
      const names=displayLanguages().map(lang=>countryName(previewCity,lang));return [...new Set(names)];
    }));
    await page.locator('#settings-close').click();
    await page.waitForTimeout(900);
    assert.equal(await page.locator('#clocks > article').count(),4,'merging disabled');
    await page.locator('#settings-toggle').click();
    await page.locator('#merge-timezones').check();
    await page.locator('#settings-close').click();
    await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===3);
    assert.equal(await page.locator('.fusion-overlay,.fusion-particle,.fusion-halo').count(),0,'animation toggle disables all fusion effects');
    const group=page.locator('#clocks > article').filter({has:page.locator('.city',{hasText:'Waterloo/New York'})});
    await group.hover();await group.locator('.remove').click();
    await group.getByRole('menuitem',{name:'Remove New York',exact:true}).click();
    assert.equal(await page.locator('.fusion-overlay,.fusion-particle,.fusion-halo').count(),0,'animation toggle disables removal effects');
    // A pair merged with animations off must animate after explicitly enabling them.
    await page.evaluate(()=>{cities=defaults.map(city=>({...city}));render();});
    assert.equal(await page.locator('#clocks > article').count(),3);
    await page.locator('#settings-toggle').click();
    await page.locator('#animations').check();
    assert.equal(await page.locator('#clocks > article').count(),4);
    await page.locator('#deduplicate-translations').uncheck();
    assert.equal(await page.locator('#clocks > article').count(),4,'other settings changes do not consume the pending flight');
    await page.locator('#settings-close').click();
    await page.waitForSelector('.fusion-overlay');
    await page.waitForFunction(()=>document.querySelectorAll('#clocks > article').length===3);
    await page.waitForFunction(()=>!document.querySelector('.fusion-overlay,.fusion-particle,.fusion-halo'));
    await page.locator('#settings-toggle').click();
    await page.locator('#animations').uncheck();
    await page.locator('#merge-timezones').uncheck();
    await page.locator('#deduplicate-translations').uncheck();
    await page.reload();
    await page.locator('#settings-toggle').click();
    for(const id of ['animations','merge-timezones','deduplicate-translations'])assert.equal(await page.locator('#'+id).isChecked(),false,'saved choice persists');
    for(const language of ['zh','en','fr']) {
      await page.locator('#primary-language').selectOption(language);
      for(const [width,height] of [[390,844],[320,568]]) {
        await page.setViewportSize({width,height});await page.waitForTimeout(120);
        await page.locator('#translation-info-button').hover();
        const overflow=await page.locator('#settings-panel input, #settings-panel select, #translation-info').evaluateAll(nodes=>nodes.filter(node=>{
          if(!node.getClientRects().length)return false;const r=node.getBoundingClientRect();return r.left<0 || r.right>innerWidth+1 || r.bottom>innerHeight+1 || r.top<0;
        }).map(node=>node.id));
        assert.deepEqual(overflow,[]);
      }
    }
    await page.screenshot({path:'tests/display-options-mobile.png'});
    assert.deepEqual(errors,[]);
    console.log('PASS: translation deduplication, distinct translations, preview, tooltip, merge and animation switches, persistence, mobile in 3 languages');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
