const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1600,height:900},reducedMotion:'no-preference'});
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.evaluate(()=>{settings.mergeTimezones=false;cities=defaults.slice(0,3).map(city=>({...city}));applySettings();});
    const columns=()=>page.locator('#clocks').getAttribute('data-columns');
    const diameter=()=>page.locator('#clocks .dial').first().evaluate(el=>Math.min(el.getBoundingClientRect().width,el.getBoundingClientRect().height));
    await page.waitForFunction(()=>container.dataset.columns==='3');
    const large=await diameter();
    await page.setViewportSize({width:900,height:900});await page.waitForTimeout(100);
    assert.equal(await columns(),'3');assert(await diameter()<large,'clocks shrink before wrapping');
    await page.setViewportSize({width:760,height:900});
    await page.waitForFunction(()=>container.dataset.columns==='2');
    assert.equal(await page.evaluate(()=>viewportAnimations.size),3,'row transition animates all surviving clocks');
    await page.waitForFunction(()=>viewportAnimations.size===0);
    assert.deepEqual(await page.locator('#clocks > article').evaluateAll(cards=>cards.map(card=>card.style.gridRow)),['1','1','2']);
    const last=await page.locator('#clocks > article').last().boundingBox();
    assert(Math.abs(last.x+last.width/2-380)<1,'last clock is centered below the first two');
    await page.screenshot({path:'tests/responsive-triangle.png'});
    // The phone breakpoint must retain the cards so the return transition can animate.
    await page.setViewportSize({width:390,height:900});await page.waitForTimeout(100);
    assert.equal(await columns(),'2');
    await page.setViewportSize({width:1100,height:900});
    await page.waitForFunction(()=>container.dataset.columns==='3');
    assert.equal(await page.evaluate(()=>viewportAnimations.size),3);
    await page.waitForFunction(()=>viewportAnimations.size===0);
    await page.screenshot({path:'tests/responsive-row.png'});
    await page.evaluate(()=>{cities=defaults.map(city=>({...city}));render();});
    await page.setViewportSize({width:1600,height:900});await page.waitForTimeout(700);
    assert.equal(await columns(),'4','four clocks use a single row in a wide window');
    await page.setViewportSize({width:900,height:900});
    await page.waitForFunction(()=>container.dataset.columns==='3');
    assert.equal(await page.evaluate(()=>viewportAnimations.size),4);
    await page.waitForFunction(()=>viewportAnimations.size===0);
    assert.deepEqual(await page.locator('#clocks > article').evaluateAll(cards=>cards.map(card=>card.style.gridRow)),['1','1','1','2'],'the last clock wraps first');
    await page.setViewportSize({width:720,height:900});
    await page.waitForFunction(()=>container.dataset.columns==='2');
    await page.waitForFunction(()=>viewportAnimations.size===0);
    await page.setViewportSize({width:900,height:350});await page.waitForTimeout(700);
    assert.equal(await columns(),'4','a short window keeps one row when a second row would not fit comfortably');
    await page.evaluate(()=>{settings.animations=false;applySettings();});
    await page.setViewportSize({width:760,height:900});await page.waitForTimeout(100);
    assert.equal(await columns(),'2');assert.equal(await page.evaluate(()=>viewportAnimations.size),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: single rows, gradual shrinking, animated wrap and unwrap, centered triangle, height constraints, animation switch');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
