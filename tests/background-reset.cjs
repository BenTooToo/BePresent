const assert=require('node:assert/strict');
const {chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  for(const mobile of [false,true]){
   const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,isMobile:mobile});
   const page=await context.newPage();
   await page.clock.setFixedTime(new Date('2026-10-15T12:00:00Z'));
   await page.goto('http://127.0.0.1:4173/');
   const card=page.locator('.clock-card').first();
   const exploring=()=>page.locator('.page').evaluate(n=>n.classList.contains('is-exploring'));
   await card.focus();await page.keyboard.press('ArrowDown');assert(await exploring());
   assert.equal(await page.locator('#return-now').count(),0);
   await card.locator('.city-name').count().then(async count=>{if(count)await card.locator('.city-name').click();else await card.click({position:{x:20,y:20}});});
   assert(await exploring(),'clock click preserves adjusted time');
   await card.locator('.digital').click();assert(await exploring());
   await page.locator('main').click({position:{x:5,y:5}});
   assert.equal(await exploring(),false,'blank click exits time editing and restores real time');
   await card.focus();await page.keyboard.press('ArrowDown');
   await page.locator('#settings-toggle').click();assert(await exploring());await page.locator('#settings-title').click();assert(await exploring());await page.keyboard.press('Escape');assert(await exploring());
   await page.locator('#add').click();assert(await exploring());await page.locator('#close-picker').click();assert(await exploring());
   const box=await card.locator('.dial').boundingBox();
   await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
   await page.mouse.move(10,100,{steps:10});await page.mouse.up();
   assert(await exploring(),'release outside after dragging preserves adjusted time');
   if(mobile)await page.touchscreen.tap(10,100);else await page.mouse.click(10,100);
   assert.equal(await exploring(),false);
   await context.close();
  }
  console.log('Background reset: desktop, touch, editing, controls and drag release passed');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
