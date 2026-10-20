const CACHE_PREFIX='be-present-app-';
// The cache revision changes independently of the public release version.
const CACHE_NAME=CACHE_PREFIX+'0.3.0-capture-2';
const APP_ROOT=new URL('./',self.location.href).href;
const APP_ASSETS=[
  './','./index.html','./manifest.webmanifest',
  './assets/fonts/InstrumentSerif-Regular.ttf',
  './assets/vendor/html-to-image-1.11.13.js',
  './assets/icons/app-180.png','./assets/icons/app-192.png','./assets/icons/app-512.png',
  ...Array.from({length:12},(_,index)=>`./assets/icons/clock-${String(index+1).padStart(2,'0')}.svg`)
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX) && key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
  const url=new URL(event.request.url);
  if(event.request.method!=='GET' || url.origin!==self.location.origin || !url.href.startsWith(APP_ROOT))return;
  const navigation=event.request.mode==='navigate';
  const homeNavigation=navigation && (url.pathname===new URL(APP_ROOT).pathname || url.pathname===new URL('index.html',APP_ROOT).pathname);
  if(!homeNavigation && !APP_ASSETS.some(asset=>new URL(asset,APP_ROOT).pathname===url.pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE_NAME);
    const key=homeNavigation?APP_ROOT:event.request;
    try {
      // Prefer fresh files online; retain a complete local copy for offline launches.
      const response=await fetch(new Request(event.request,{cache:'no-cache'}));
      if(response.ok) {
        await cache.put(key,response.clone());
        return response;
      }
      return (await cache.match(key)) || response;
    } catch {
      return (await cache.match(key)) || Response.error();
    }
  })());
});
