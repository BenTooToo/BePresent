const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function assertFits(page, selector) {
  const result = await page.evaluate(selector => {
    const viewport = { width: innerWidth, height: innerHeight };
    const outside = [...document.querySelectorAll(selector)].filter(el => {
      if (!el.getClientRects().length) return false;
      const r = el.getBoundingClientRect();
      return r.x < -1 || r.y < -1 || r.right > viewport.width + 1 || r.bottom > viewport.height + 1;
    }).map(el => el.id || el.className);
    return { outside, scrollX: document.documentElement.scrollWidth > innerWidth + 1,
      scrollY: document.documentElement.scrollHeight > innerHeight + 1 };
  }, selector);
  assert.deepEqual(result, { outside: [], scrollX: false, scrollY: false });
}

(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage({permissions:['clipboard-read','clipboard-write']});
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    for (const [width, height] of [[320,568],[360,640],[390,844],[430,932],[568,320],
      [844,390],[768,1024],[1024,600],[1280,720],[1366,768],[1440,900],[1920,1080],[2560,1080]]) {
      await page.setViewportSize({width,height});
      await page.goto('http://127.0.0.1:4173/');
      for (const count of [4,16]) {
        await page.evaluate(count => {
          cities = catalog.slice(0,count).map(city => ({...city}));
          settings.multilingual = count === 16;
          settings.secondLanguage = 'en'; settings.thirdLanguage = 'fr';
          applySettings();
        }, count);
        await page.waitForTimeout(100);
        await assertFits(page, '#clocks .clock-card, header, #add, #settings-toggle, #support');
        const limit=await page.evaluate(()=>clockLimit());
        assert.equal(await page.locator('#clocks .clock-card').count(),Math.min(count,limit));
        assert.equal(await page.locator('#add').isDisabled(),count>=limit);
        await page.locator('#settings-toggle').click();
        await page.waitForTimeout(100);
        await assertFits(page, '#settings-panel, #settings-close, .settings-body, .settings-panel input, .settings-panel select');
        await page.keyboard.press('Escape');
      }
      console.log(`PASS ${width}×${height}: all clocks, multilingual, controls, customization`);
    }
    await page.evaluate(() => { cities = catalog.slice(0,8).map(city=>({...city})); settings.multilingual=false; applySettings(); });
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#clocks .clock-card').count(),6);
    await page.screenshot({path:'tests/viewport-mobile.png'});
    await page.locator('#capture').click();
    await page.waitForFunction(()=>!document.getElementById('capture').disabled);
    assert.equal(await page.locator('#capture-status').getAttribute('data-state'),'success');
    assert.deepEqual(await page.evaluate(async()=>{
      const item=(await navigator.clipboard.read()).find(item=>item.types.includes('image/png'));
      const bitmap=await createImageBitmap(await item.getType('image/png'));
      return {width:bitmap.width,height:bitmap.height};
    }),{width:390,height:844});
    await page.setViewportSize({width:1366,height:768});
    await page.waitForTimeout(150);
    assert.equal(await page.locator('#clocks .clock-card').count(),8);
    assert.equal(await page.evaluate(()=>cities.length),8);
    await page.screenshot({path:'tests/viewport-desktop.png'});
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode=1; });
