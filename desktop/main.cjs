const {app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, protocol, net, shell} = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

if (!app.isPackaged && process.env.BE_PRESENT_TEST_DATA) app.setPath('userData', process.env.BE_PRESENT_TEST_DATA);
protocol.registerSchemesAsPrivileged([{scheme:'clock', privileges:{standard:true, secure:true, supportFetchAPI:true, corsEnabled:true}}]);
const root = path.join(__dirname, '..', 'dist');
const pageURL = 'clock://app/index.html';
let window, tray, quitting = false, preferencesPath;
let preferences = {alwaysOnTop:false, background:true};
let language = 'en';
const labels = {
  zh:{open:'打开 Be Present',pin:'窗口置顶',background:'关闭后在后台运行',quit:'退出'},
  en:{open:'Open Be Present',pin:'Always on top',background:'Keep running after closing',quit:'Quit'},
  fr:{open:'Ouvrir Be Present',pin:'Toujours au premier plan',background:'Rester actif après fermeture',quit:'Quitter'}
};
function showWindow() {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  window.show();
  window.focus();
}
function updateMenu() {
  if (!tray) return;
  const t = labels[language];
  tray.setContextMenu(Menu.buildFromTemplate([
    {label:t.open, click:showWindow},
    {type:'separator'},
    {label:t.pin, type:'checkbox', checked:preferences.alwaysOnTop, click:item=>setPreferences({alwaysOnTop:item.checked})},
    {label:t.background, type:'checkbox', checked:preferences.background, click:item=>setPreferences({background:item.checked})},
    {type:'separator'},
    {label:t.quit, click:()=>app.quit()}
  ]));
}
function setPreferences(update) {
  const next = {...preferences};
  for (const key of ['alwaysOnTop','background']) if (typeof update[key] === 'boolean') next[key] = update[key];
  // Persist before changing the running state, so a write failure leaves both consistent.
  const temporary = preferencesPath + '.tmp';
  fs.writeFileSync(temporary, JSON.stringify(next));
  fs.renameSync(temporary, preferencesPath);
  preferences = next;
  window.setAlwaysOnTop(preferences.alwaysOnTop);
  if (!preferences.background && !window.isVisible()) showWindow();
  window.webContents.send('desktop:preferences', preferences);
  updateMenu();
  return preferences;
}
function authorized(event) {
  return event.sender === window?.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === pageURL;
}
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.on('before-quit', ()=>{quitting = true;});
  app.on('window-all-closed', ()=>app.quit());
  app.whenReady().then(async()=>{
    app.setAppUserModelId('com.bentootoo.bepresent');
    preferencesPath = path.join(app.getPath('userData'), 'desktop-settings.json');
    try {
      const saved = JSON.parse(fs.readFileSync(preferencesPath, 'utf8'));
      for (const key of ['alwaysOnTop','background']) if (typeof saved[key] === 'boolean') preferences[key] = saved[key];
    } catch {}
    const locale = app.getLocale().toLowerCase().split(/[-_]/)[0];
    language = Object.hasOwn(labels, locale) ? locale : 'en';
    protocol.handle('clock', request=>{
      const url = new URL(request.url);
      let filename;
      try { filename = path.resolve(root, '.' + decodeURIComponent(url.pathname)); }
      catch { return new Response(null, {status:400}); }
      if (url.host !== 'app' || !filename.startsWith(root + path.sep)) return new Response(null, {status:403});
      return net.fetch(pathToFileURL(filename).href);
    });
    const icon = nativeImage.createFromPath(path.join(root, 'assets/icons/app-512.png'));
    window = new BrowserWindow({
      width:1200, height:820, minWidth:390, minHeight:450, backgroundColor:'#000000',
      title:'Be Present', icon, show:false, alwaysOnTop:preferences.alwaysOnTop,
      webPreferences:{preload:path.join(__dirname,'preload.cjs'), contextIsolation:true, sandbox:true, nodeIntegration:false}
    });
    window.setMenuBarVisibility(false);
    // Create the tray before enabling close-to-tray, so the window can always be recovered.
    tray = new Tray(icon.resize({width:32,height:32}));
    tray.setToolTip('Be Present');
    tray.on('click', showWindow);
    tray.on('double-click', showWindow);
    updateMenu();
    window.on('close', event=>{
      if (!quitting && preferences.background && tray && !tray.isDestroyed()) {
        event.preventDefault();
        window.hide();
      }
    });
    window.once('ready-to-show', showWindow);
    window.webContents.setWindowOpenHandler(({url})=>{
      if (url.startsWith('https://')) shell.openExternal(url);
      return {action:'deny'};
    });
    window.webContents.on('will-navigate', (event,url)=>{if (url !== pageURL) event.preventDefault();});
    window.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
    ipcMain.handle('desktop:get', event=>{
      if (!authorized(event)) throw new Error('Unauthorized window');
      return {...preferences, version:app.getVersion()};
    });
    ipcMain.handle('desktop:set', (event,update)=>{
      if (!authorized(event) || !update || typeof update !== 'object') throw new Error('Invalid request');
      return setPreferences(update);
    });
    ipcMain.on('desktop:language', (event,value)=>{
      if (authorized(event) && Object.hasOwn(labels,value)) {language=value;updateMenu();}
    });
    await window.loadURL(pageURL);
  }).catch(error=>{console.error(error);app.quit();});
}
