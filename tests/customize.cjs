const assert = require('node:assert/strict');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch({ channel:'msedge', headless:true });
  try {
    const page = await browser.newPage({ locale:'zh-CN',viewport:{width:1440,height:900} });
    const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto('http://127.0.0.1:4173/');
    await page.evaluate(()=>document.fonts.ready);
    await page.screenshot({path:'tests/outside-numbers.png'});
    await page.getByRole('button',{name:'自定义',exact:true}).click();
    assert.equal(await page.locator('#settings-title').textContent(),'自定义');
    assert.equal(await page.locator('.settings-columns legend').first().textContent(),'时间');
    assert.equal(await page.locator('#settings-panel').innerText().then(text=>/隐藏|启用/.test(text)),false);
    assert.equal(await page.locator('[data-enabled]').evaluateAll(nodes=>nodes.every(node=>node.checked===!['country','date'].includes(node.dataset.enabled))),true);
    assert.equal(await page.locator('#multilingual').isChecked(),false);
    assert.deepEqual(await page.evaluate(()=>cities.map(city=>city.id)),['paris','waterloo','new-york','beijing']);
    assert.equal(await page.locator('#clock-options').isVisible(),true);
    assert.equal(await page.locator('#numeral-count').inputValue(),'12');
    assert.equal(await page.locator('#numeral-position').inputValue(),'outside');
    assert.equal(await page.locator('#numeral-options #numeral-count').count(),1);
    assert.equal(await page.locator('#numeral-options #numeral-position').count(),1);
    for(const dial of await page.locator('.dial').all()) {
      assert.equal(await dial.locator('.dial-numbers text').count(),12);
      assert.deepEqual(await dial.locator('.dial-numbers text').allTextContents(),Array.from({length:12},(_,i)=>String(i+1)));
      assert.equal(await dial.getAttribute('viewBox'),'-28 -28 296 296');
      assert.equal(await dial.locator('.dial-numbers').evaluate(el=>getComputedStyle(el).fontSize),'16px');
      // Every glyph sits entirely outside the face and within the expanded SVG bounds.
      assert.equal(await dial.locator('.dial-numbers text').evaluateAll(nodes=>nodes.every(node=>{
        const b=node.getBBox();
        const dx=Math.max(b.x-120,0,120-b.x-b.width),dy=Math.max(b.y-120,0,120-b.y-b.height);
        return Math.hypot(dx,dy)>118 && b.x>=-28 && b.y>=-28 && b.x+b.width<=268 && b.y+b.height<=268;
      })),true);
    }
    await page.locator('[data-enabled="secondHand"]').uncheck();
    assert.equal(await page.locator('#settings-preview .second').isVisible(),false);
    assert.equal(await page.locator('#settings-preview .minute').isVisible(),true);
    await page.locator('[data-enabled="secondHand"]').check();
    await page.locator('#numeral-count').selectOption('4',{force:true});
    for(const dial of await page.locator('.dial').all()) assert.deepEqual(await dial.locator('.dial-numbers text').allTextContents(),['12','3','6','9']);
    const coords=await page.locator('.dial-numbers').first().locator('text').evaluateAll(nodes=>nodes.map(node=>[Number(node.getAttribute('x')),Number(node.getAttribute('y'))]));
    assert.deepEqual(coords,[[120,-16],[256,120],[120,256],[-16,120]]);
    await page.locator('#numeral-position').selectOption('inside',{force:true});
    for(const dial of await page.locator('.dial').all()) {
      assert.equal(await dial.locator('.dial-numbers').getAttribute('data-position'),'inside');
      const inner=await dial.locator('.dial-numbers text').evaluateAll(nodes=>nodes.map(node=>[Number(node.getAttribute('x')),Number(node.getAttribute('y'))]));
      assert.deepEqual(inner,[[120,34],[206,120],[120,206],[34,120]]);
      assert.equal(await dial.getAttribute('viewBox'),'0 0 240 240');
      assert.equal(await dial.locator('.dial-numbers').evaluate(el=>getComputedStyle(el).fontSize),'12px');
    }
    await page.locator('[data-enabled="numerals"]').uncheck();
    assert.equal(await page.locator('#numeral-count-field').isVisible(),false);
    assert.equal(await page.locator('#numeral-position').isVisible(),false);
    assert.equal(await page.locator('#settings-preview .dial-numbers').isVisible(),false);
    await page.locator('[data-enabled="analog"]').uncheck();
    assert.equal(await page.locator('#clock-options').isVisible(),false);
    assert.equal(await page.locator('#clocks .dial').first().isVisible(),false);
    assert.equal(await page.locator('#settings-preview .digital').isVisible(),true);
    await page.locator('[data-enabled="analog"]').check();
    assert.equal(await page.locator('#clock-options').isVisible(),true);
    assert.equal(await page.locator('[data-enabled="numerals"]').isChecked(),false);
    await page.locator('[data-enabled="numerals"]').check();
    assert.equal(await page.locator('#numeral-count').inputValue(),'4');
    assert.equal(await page.locator('#numeral-position').inputValue(),'inside');
    await page.locator('[data-enabled="support"]').uncheck();
    await page.locator('#settings-close').click();
    assert.equal(await page.locator('#support').isVisible(),false);
    await page.reload();
    await page.locator('#settings-toggle').click();
    assert.equal(await page.locator('#numeral-count').inputValue(),'4');
    assert.equal(await page.locator('#numeral-position').inputValue(),'inside');
    await page.locator('#numeral-position').selectOption('outside',{force:true});
    assert.equal(await page.locator('[data-enabled="support"]').isChecked(),false);
    await page.locator('[data-language-select="primary-language"]').click();await page.locator(`.language-choice[data-language="${'en'}"]`).click();
    assert.equal(await page.locator('#settings-title').textContent(),'Customize');
    assert.equal(await page.locator('#settings-panel').innerText().then(text=>/Hide |Enable /.test(text)),false);
    await page.locator('[data-language-select="primary-language"]').click();await page.locator(`.language-choice[data-language="${'fr'}"]`).click();
    assert.equal(await page.locator('#settings-title').textContent(),'Personnaliser');
    assert.equal(await page.locator('#settings-panel').innerText().then(text=>/Masquer|Activer/.test(text)),false);
    await page.locator('[data-language-select="primary-language"]').click();await page.locator(`.language-choice[data-language="${'zh'}"]`).click();
    await page.waitForTimeout(150);
    await page.screenshot({path:'tests/customize-desktop.png'});
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(150);
    const panelRect=await page.locator('#settings-panel').boundingBox();
    assert.equal(panelRect.width,390);assert.equal(panelRect.height,844);assert.equal(panelRect.y,0);
    assert.equal(await page.locator('#settings-preview .preview-clock').isVisible(),true);
    await page.screenshot({path:'tests/customize-mobile.png'});
    // Old hide-based preferences migrate without inverting what the user sees.
    await page.evaluate(()=>localStorage.setItem('be-present-settings',JSON.stringify({language:'zh',hide:{analog:true,country:false,settings:false,title:true}})));
    await page.reload();
    assert.equal(await page.locator('#clocks .dial').first().isVisible(),false);
    assert.equal(await page.locator('.country').first().isVisible(),true);
    assert.equal(await page.locator('.brand').isVisible(),false);
    assert.equal(await page.evaluate(()=>settings.enabled.secondHand && settings.enabled.numerals),true);
    assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('be-present-settings')).version),2);
    assert.deepEqual(errors,[]);
    console.log('PASS: positive defaults, minimal labels in three languages, dependent options, second hand, 4/12 dial numbers, support toggle, persistence, legacy migration, non-overlapping mobile dock.');
  } finally { await browser.close(); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
