const assert=require('node:assert/strict');
const {chromium}=require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const mobile of [false,true]) {
      const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1440,height:900},hasTouch:mobile,isMobile:mobile});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.clock.setFixedTime(new Date('2026-10-20T23:00:00Z'));
      await page.goto(process.env.CLOCK_TEST_URL || 'http://127.0.0.1:4173/');
      const sample=()=>page.evaluate(()=>({
        returning:returnAnimation!==null,
        offset:returnAnimation?.offset,
        clocks:[...document.querySelectorAll('#clocks .clock-card')].map(card=>({
          timestamp:Date.parse(card.querySelector('time').dateTime),
          hour:card.querySelector('.hour').getAttribute('transform'),
          minute:card.querySelector('.minute').getAttribute('transform'),
          second:card.querySelector('.second').getAttribute('transform'),
          text:card.querySelector('time').textContent,
          zone:cities.find(city=>city.el===card).zone
        }))
      }));
      // Shortest direction in either direction, including the 24-hour boundary.
      for(const [hours,expectedOffset] of [[2,2],[-2,-2],[22,-2],[-22,2],[12,-12]]) {
        await page.evaluate(hours=>setPreview(Date.now()+hours*3600000,false),hours);
        const before=await sample();
        if(mobile)await page.touchscreen.tap(5,200);
        else await page.locator('main').click({position:{x:5,y:5}});
        const start=await sample();
        assert(start.returning,'return should animate');
        assert.equal(start.offset,expectedOffset*3600000);
        assert.notEqual(start.clocks[0].timestamp,Date.parse('2026-10-20T23:00:00Z'),'no immediate jump');
        await page.waitForTimeout(220);
        const middle=await sample();
        const real=Date.parse('2026-10-20T23:00:00Z');
        assert(Math.abs(middle.clocks[0].timestamp-real)<Math.abs(start.clocks[0].timestamp-real));
        assert.equal(new Set(middle.clocks.map(clock=>clock.timestamp)).size,1);
        for(const clock of middle.clocks) {
          const expected=await page.evaluate(({timestamp,zone})=>{
            const date=new Date(timestamp);
            const parts=Object.fromEntries(formatter(zone).time.formatToParts(date).map(part=>[part.type,part.value]));
            const s=Number(parts.second)+date.getMilliseconds()/1000;
            return {text:`${parts.hour}:${parts.minute}:${parts.second}`,hour:`rotate(${Number(parts.hour)*30+Number(parts.minute)/2+s/120} 120 120)`,minute:`rotate(${Number(parts.minute)*6+s/10} 120 120)`,second:`rotate(${s*6} 120 120)`};
          },clock);
          for(const key of ['text','hour','minute','second'])assert.equal(clock[key],expected[key]);
        }
        assert.notEqual(middle.clocks[0].hour,before.clocks[0].hour);
        await page.waitForFunction(()=>returnAnimation===null);
        assert.equal((await sample()).clocks[0].timestamp,real);
      }
      // Repeated returns do not restart the easing; new gestures take over in place.
      await page.evaluate(()=>{shiftMinutes(120);resetPreview();});
      await page.waitForTimeout(200);
      const originalStart=await page.evaluate(()=>returnAnimation.start);
      await page.keyboard.press('Escape');
      assert.equal(await page.evaluate(()=>returnAnimation.start),originalStart);
      const takeover=await page.evaluate(()=>{
        const before=displayedTimestamp();
        shiftMinutes(5);
        return {before,after:previewTimestamp,returning:returnAnimation!==null};
      });
      assert.equal(takeover.returning,false);
      assert(Math.abs(takeover.after-takeover.before-300000)<60000);
      await page.waitForTimeout(1500);
      assert.equal(await page.evaluate(()=>previewTimestamp),takeover.after,'cancelled animation cannot override a new preview');
      await page.evaluate(()=>{settings.animations=false;resetPreview();});
      assert.equal((await sample()).returning,false);
      await page.evaluate(()=>{settings.animations=true;shiftMinutes(60);});
      await page.emulateMedia({reducedMotion:'reduce'});
      await page.keyboard.press('Home');
      // Home is handled on a focused card.
      await page.locator('.clock-card').first().focus();
      await page.keyboard.press('Home');
      assert.equal((await sample()).returning,false);
      assert.equal(await page.evaluate(()=>previewTimestamp),null);
      assert.deepEqual(errors,[]);
      await page.close();
    }
    const livePage=await browser.newPage();
    await livePage.goto(process.env.CLOCK_TEST_URL || 'http://127.0.0.1:4173/');
    await livePage.evaluate(()=>{shiftMinutes(120);resetPreview();});
    await livePage.waitForFunction(()=>returnAnimation===null);
    const liveTime=()=>livePage.evaluate(()=>({shown:Date.parse(document.querySelector('#clocks time').dateTime),real:Date.now()}));
    const first=await liveTime();
    assert(Math.abs(first.shown-first.real)<300,'completion catches the moving real time');
    await livePage.waitForTimeout(1100);
    const next=await liveTime();
    assert(next.shown>first.shown,'live clock keeps ticking after the return');
    assert(Math.abs(next.shown-next.real)<300);
    await livePage.close();
    console.log('PASS: desktop/touch returns, shortest direction, synchronized digital time and hands, easing completion, repeated reset, interruption, animation settings and reduced motion.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
