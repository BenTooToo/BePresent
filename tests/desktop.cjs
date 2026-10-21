const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {_electron:electron} = require('playwright');
const data = fs.mkdtempSync(path.join(os.tmpdir(),'be-present-desktop-'));
let application;
async function launch() {
  const executablePath=process.env.BE_PRESENT_TEST_EXECUTABLE;
  application=await electron.launch({executablePath,args:['--user-data-dir='+data,...(executablePath?[]:[path.join(__dirname,'..')])],env:{...process.env,BE_PRESENT_TEST_DATA:data,ELECTRON_RUN_AS_NODE:undefined}});
  assert.equal(await application.evaluate(({app})=>app.getPath('userData')),data,'Tests must use an isolated app profile');
  const page=await application.firstWindow();
  await page.waitForSelector('#desktop-settings',{state:'attached'});
  await page.waitForFunction(()=>document.querySelector('.settings-version')?.textContent==='v0.3.1');
  return page;
}
const nativeState = ()=>application.evaluate(({BrowserWindow})=>{
  const win=BrowserWindow.getAllWindows()[0];
  return {pinned:win.isAlwaysOnTop(),visible:win.isVisible(),isolated:win.webContents.getLastWebPreferences().contextIsolation,sandbox:win.webContents.getLastWebPreferences().sandbox};
});
(async()=>{
  try {
    let page=await launch();
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.locator('#settings-toggle').click();
    const pin=page.locator('#desktop-alwaysOnTop');
    const background=page.locator('#desktop-background');
    assert.equal(await background.isChecked(),true);
    await pin.check();
    await page.waitForFunction(()=>!document.querySelector('#desktop-alwaysOnTop').disabled);
    assert.deepEqual(await nativeState(),{pinned:true,visible:true,isolated:true,sandbox:true});
    await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close());
    assert.equal((await nativeState()).visible,false,'Closing should hide instead of destroy');
    await application.evaluate(({app})=>app.emit('second-instance'));
    assert.equal((await nativeState()).visible,true,'Reopen should restore the same window');
    await page.locator('[data-language-select="primary-language"]').click();
    await page.locator('.language-choice[data-language="fr"]').click();
    await page.waitForFunction(()=>document.querySelector('#desktop-settings label span').textContent==='Toujours au premier plan');
    await page.reload();
    await page.waitForFunction(()=>document.querySelector('.settings-version')?.textContent==='v0.3.1');
    assert.equal(await page.locator('#desktop-alwaysOnTop').isChecked(),true);
    assert.equal(await page.locator('[data-desktop-word="pin"]').textContent(),'Toujours au premier plan');
    await page.locator('#settings-toggle').click();
    await page.screenshot({path:path.join(__dirname,'desktop-settings.png')});
    assert.deepEqual(errors,[],'Desktop must not cause renderer errors');
    await application.close();application=null;
    page=await launch();
    assert.equal((await nativeState()).pinned,true,'Pin preference should survive app restart');
    await page.locator('#settings-toggle').click();
    await page.locator('#desktop-background').uncheck();
    await page.waitForFunction(()=>!document.querySelector('#desktop-background').disabled);
    const saved=JSON.parse(fs.readFileSync(path.join(data,'desktop-settings.json'),'utf8'));
    assert.deepEqual(saved,{alwaysOnTop:true,background:false});
    const exiting=application.waitForEvent('close');
    await application.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].close()).catch(()=>{});
    await exiting;application=null;
    console.log('PASS: native pinning, close-to-tray, reopen, persistence, French UI, sandbox, reload, and close-to-quit.');
  } finally {
    if(application) await application.close();
    fs.rmSync(data,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
