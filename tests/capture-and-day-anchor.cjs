const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium}=require('playwright');

async function main() {
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    const context=await browser.newContext({locale:'zh-CN',viewport:{width:1440,height:900},permissions:['clipboard-read','clipboard-write']});
    const page=await context.newPage();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.clock.setFixedTime(new Date('2026-10-15T21:50:00Z'));
    await page.goto('http://127.0.0.1:4173/');
    // Test each city's preview and capture independently of automatic grouping.
    await page.evaluate(()=>{mergeMatchingClocks=()=>{};});
    const cards=page.locator('.clock-card');
    const labels=()=>page.locator('.day-change').allTextContents();
    const reset=()=>page.locator('main').click({position:{x:5,y:5}});
    async function assertAnchor(index) {
      assert.equal(await page.evaluate(i=>calendarDay(cities[i].zone,new Date(previewTimestamp))===calendarDay(cities[i].zone,new Date()),index),true);
      assert.equal((await labels())[index],'');
      assert((await labels()).every(label=>['','昨天','明天'].includes(label)));
    }
    await cards.first().hover();await page.mouse.wheel(0,400);
    await page.waitForFunction(()=>document.querySelector('.digital').textContent==='00:10:00');
    await assertAnchor(0);
    assert.deepEqual(await labels(),['','昨天','昨天','昨天']);
    await reset();
    await cards.nth(3).hover();await page.mouse.wheel(0,-7200);
    await page.waitForFunction(()=>document.querySelectorAll('.digital')[3].textContent==='23:50:00');
    await assertAnchor(3);
    assert.deepEqual(await labels(),['明天','明天','明天','']);
    // Switching to a different city makes that city the same-day anchor immediately.
    await cards.nth(2).locator('.digital [data-time-part="2"]').last().click();
    await assertAnchor(2);
    await page.keyboard.press('Enter');
    await reset();
    const dial=await cards.first().locator('.dial').boundingBox();
    const x=dial.x+dial.width/2,y=dial.y+dial.height/2;
    await page.mouse.move(x,y);await page.mouse.down();await page.mouse.move(x,y+20);await page.mouse.up();
    await assertAnchor(0);
    for(const days of [-10,-2,2,10]) {
      await page.evaluate(d=>setCityPreview(Date.now()+d*86400000,cities[0]),days);
      await assertAnchor(0);
    }
    await reset();

    await page.evaluate(()=>{
      const original=htmlToImage.toBlob;
      htmlToImage.toBlob=async function(snapshot,options){
        if(snapshot.querySelector('button,a,.actions,.settings-panel,.time-editor'))throw new Error('Screenshot contains controls');
        if(!snapshot.querySelector('.brand') || snapshot.querySelectorAll('.clock-card').length!==4)throw new Error('Screenshot is missing title or clocks');
        window.captureContentChecked=true;
        return original.call(this,snapshot,options);
      };
    });
    async function copyAndRead(name,minWidth) {
      await page.locator('#capture').click();
      await page.waitForFunction(()=>!document.getElementById('capture').disabled,{timeout:20000});
      assert.equal(await page.locator('#capture-status').textContent(),'截图已复制到剪贴板');
      const image=await page.evaluate(async()=>{
        const items=await navigator.clipboard.read();
        const item=items.find(item=>item.types.includes('image/png'));
        const blob=await item.getType('image/png');
        const bitmap=await createImageBitmap(blob);
        const canvas=document.createElement('canvas');canvas.width=bitmap.width;canvas.height=bitmap.height;
        const ctx=canvas.getContext('2d');ctx.drawImage(bitmap,0,0);bitmap.close();
        const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
        const handsVisible=window.innerWidth!==1440 || [...document.querySelectorAll('.dial .hour,.dial .minute')].every(line=>{
          const point=line.ownerSVGElement.createSVGPoint();point.x=(line.x1.baseVal.value+line.x2.baseVal.value)/2;point.y=(line.y1.baseVal.value+line.y2.baseVal.value)/2;
          const expected=point.matrixTransform(line.getScreenCTM());
          for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){
            const x=Math.round(expected.x)+dx,y=Math.round(expected.y)+dy;
            const index=(y*canvas.width+x)*4;
            if(pixels[index]+pixels[index+1]+pixels[index+2]>450)return true;
          }
          return false;
        });
        const ink=[0,0,0,0];
        for(let y=Math.floor(canvas.height*.17);y<canvas.height*.76;y+=3)for(let x=0;x<canvas.width;x+=3){const i=(y*canvas.width+x)*4;if(pixels[i]+pixels[i+1]+pixels[i+2]>180)ink[Math.min(3,Math.floor(x/canvas.width*4))]++;}
        return {bytes:[...new Uint8Array(await blob.arrayBuffer())],width:canvas.width,height:canvas.height,ink,handsVisible};
      });
      assert(image.width>=minWidth);assert(image.height>=844);assert(image.bytes.length>10000);
      assert(image.ink.every(value=>value>60),`Missing clock content: ${image.ink}`);
      assert(image.handsVisible,'Clock hands must be present in the clipboard image');
      fs.writeFileSync(`tests/${name}.png`,Buffer.from(image.bytes));
      assert.equal(await page.locator('.capture-host').count(),0);
      assert.equal(await page.evaluate(()=>window.captureContentChecked),true);
      assert.equal(await page.locator('#capture').isVisible(),true);
      assert.equal(await page.locator('#add').isVisible(),true);
      return image;
    }
    const desktop=await copyAndRead('copied-desktop',1440);
    assert.equal(desktop.width,1440);
    await page.setViewportSize({width:390,height:844});
    await page.locator('.clock-scroll').evaluate(el=>el.scrollLeft=el.scrollWidth);
    const scrollBefore=await page.locator('.clock-scroll').evaluate(el=>el.scrollLeft);
    const mobile=await copyAndRead('copied-mobile-complete',390);
    assert.equal(mobile.width,390);
    assert.equal(await page.locator('.clock-scroll').evaluate(el=>el.scrollLeft),scrollBefore);
    // Permission failures never report a successful copy, and the button can be retried.
    await page.evaluate(()=>{navigator.clipboard.write=()=>Promise.reject(new DOMException('Denied','NotAllowedError'));});
    await page.locator('#capture').click();
    await page.waitForFunction(()=>!document.getElementById('capture').disabled);
    assert.equal(await page.locator('#capture-status').textContent(),'复制失败，请允许剪贴板访问后重试');
    assert.equal(await page.locator('.capture-host').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS: active city stays on its local today, midnight wrapping, switching anchors, yesterday/tomorrow only; real PNG clipboard write/read; complete desktop and mobile grid captures; cleanup and permission-error feedback.');
  } finally {await browser.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
