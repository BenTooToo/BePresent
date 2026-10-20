const assert = require('node:assert/strict');
const {chromium} = require('playwright');

(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try {
    for(const viewport of [{width:1366,height:768},{width:390,height:844},{width:568,height:320}]) {
      const page=await browser.newPage({viewport,locale:'fr-CA'});
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.goto('http://127.0.0.1:4173/');
      await page.locator('#settings-toggle').click();
      assert.equal(await page.locator('.segmented').count(),0);
      for(const [id,value] of [['numeral-count','4'],['numeral-position','inside'],['capture-action','ask']]) {
        await page.locator('#'+id).selectOption(value);
        assert.equal(await page.locator('#'+id).inputValue(),value);
      }
      const trigger=page.locator('[data-language-select="primary-language"]');
      const dialog=page.locator('#language-picker');
      await trigger.click();
      assert.equal(await page.locator('.language-choice').count(),3);
      assert.equal(await page.locator('.language-choice[aria-pressed=true]').getAttribute('data-language'),'fr');
      const rect=await dialog.boundingBox();
      assert(rect.width>=viewport.width*.9 && rect.height>=viewport.height*.89);
      await page.keyboard.press('Escape');
      assert.equal(await dialog.isVisible(),false);
      assert.equal(await page.locator('#settings-panel').isVisible(),true);
      assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
      for(const language of ['zh','en','fr']) {
        await trigger.click();
        await page.locator(`.language-choice[data-language="${language}"]`).click();
        assert.equal(await dialog.isVisible(),false);
        assert.equal(await page.evaluate(()=>settings.language),language);
      }
      await page.reload();await page.locator('#settings-toggle').click();
      assert.equal(await page.evaluate(()=>settings.language),'fr');
      assert.equal(await page.locator('#numeral-count').inputValue(),'4');
      assert.equal(await page.locator('#capture-action').inputValue(),'ask');
      await page.locator('#multilingual').check();
      await page.locator('[data-language-select="secondary-language"]').click();
      assert.equal(await page.locator('.language-choice[data-language=fr]').count(),0);
      await page.locator('.language-choice[data-language=en]').click();
      await page.locator('[data-language-select="third-language"]').click();
      await page.locator('.language-choice[data-language=zh]').click();
      assert.equal(await page.evaluate(()=>settings.thirdLanguage),'zh');
      await trigger.click();await page.locator('#language-picker-close').click();
      assert.equal(await dialog.isVisible(),false);
      assert.deepEqual(errors,[]);
      console.log(`PASS ${viewport.width}x${viewport.height}: selects, language dialog, Escape, focus, persistence, multilingual`);
      await page.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
