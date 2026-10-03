'use strict';
const CACHE='ki-workspace-1.0.0';
const ASSETS=['./','index.html','app.js','manifest.webmanifest','icon.svg','icon-192.png','icon-512.png','models.json'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('ki-workspace-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',e=>{
  const url=new URL(e.request.url);
  // Never intercept, cache or log credentials and OpenRouter requests.
  if(e.request.method!=='GET' || url.origin!==self.location.origin || !ASSETS.some(a=>new URL(a,self.registration.scope).href===url.href))return;
  e.respondWith(fetch(e.request).then(response=>{if(response.ok){const copy=response.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return response;}).catch(()=>caches.match(e.request).then(cached=>cached || Response.error())));
});
