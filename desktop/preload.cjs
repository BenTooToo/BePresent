const {ipcRenderer} = require('electron');

window.addEventListener('DOMContentLoaded', async()=>{
  const container = document.querySelector('.behavior-settings');
  if (!container) return;
  const words = {
    zh:{pin:'窗口置顶',background:'关闭后在后台运行',hint:'关闭窗口后保留在系统托盘，点击托盘图标重新打开。',error:'无法保存桌面设置，请重试。'},
    en:{pin:'Always on top',background:'Keep running after closing',hint:'Keep the app in the system tray when closed. Click the tray icon to reopen.',error:'Could not save desktop settings. Please try again.'},
    fr:{pin:'Toujours au premier plan',background:'Rester actif après fermeture',hint:'Garder l’application dans la zone de notification à la fermeture. Cliquer sur son icône pour la rouvrir.',error:'Impossible d’enregistrer les réglages. Réessayez.'}
  };
  const group = document.createElement('div');
  group.id = 'desktop-settings';
  const controls = {};
  for (const [key,word] of [['alwaysOnTop','pin'],['background','background']]) {
    const label = document.createElement('label');label.className='setting-row';
    const text = document.createElement('span');text.dataset.desktopWord=word;
    const input = document.createElement('input');input.type='checkbox';input.id='desktop-'+key;input.setAttribute('role','switch');
    label.append(text,input);group.append(label);controls[key]=input;
    input.addEventListener('change',async()=>{
      input.disabled=true;
      try { apply(await ipcRenderer.invoke('desktop:set',{[key]:input.checked}));error.hidden=true; }
      catch {input.checked=!input.checked;error.hidden=false;}
      finally {input.disabled=false;}
    });
  }
  const hint=document.createElement('p');hint.dataset.desktopWord='hint';hint.style.cssText='color:#888;font-size:11px;line-height:1.6;margin:4px 0 12px';
  const error=document.createElement('p');error.dataset.desktopWord='error';error.hidden=true;error.setAttribute('role','alert');
  group.append(hint,error);container.append(group);
  function apply(state) {for (const key of Object.keys(controls)) controls[key].checked=state[key];}
  function translate() {
    const locale=document.documentElement.lang.toLowerCase().split(/[-_]/)[0];
    const language=Object.hasOwn(words,locale)?locale:'en';
    for (const text of group.querySelectorAll('[data-desktop-word]')) text.textContent=words[language][text.dataset.desktopWord];
    ipcRenderer.send('desktop:language',language);
  }
  new MutationObserver(translate).observe(document.documentElement,{attributes:true,attributeFilter:['lang']});
  ipcRenderer.on('desktop:preferences',(_event,state)=>apply(state));
  try {
    const state=await ipcRenderer.invoke('desktop:get');apply(state);
    document.querySelector('.settings-version').textContent='v'+state.version;
  } catch {error.hidden=false;}
  // The Windows executable is already installed/running, so omit the browser's PWA install entry.
  const installButton=document.getElementById('install-app');
  if(installButton) installButton.style.display='none';
  const installSetting=document.querySelector('[data-enabled="install"]')?.closest('label');
  if(installSetting) installSetting.hidden=true;
  translate();
});
