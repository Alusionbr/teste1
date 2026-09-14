"use strict";
const VERSION="4.0.0",CACHE=`estante-${VERSION}`;
const CORE=["./","./index.html","./styles.css","./core.js","./search-engine.js","./library.js","./acervo.js","./migration.js","./storage.js","./setlists.js","./song-prefs.js","./autoscroll.js","./player.js","./youtube-adapter.js","./karaoke.js","./song-edit.js","./print.js","./ui.js","./search-ui.js","./offline.js","./manifest.webmanifest"];
const OPTIONAL=["./acervo.json","./icon.svg","./icon-192.png","./icon-512.png"];
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE).then(async cache=>{await cache.addAll(CORE);await Promise.allSettled(OPTIONAL.map(url=>cache.add(url)))})));
self.addEventListener("activate",event=>event.waitUntil(self.clients.claim()));
self.addEventListener("message",event=>{if(event.data==="activate-update")self.skipWaiting()});
self.addEventListener("fetch",event=>{const request=event.request,url=new URL(request.url);if(request.method!=="GET"||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;event.respondWith(caches.open(CACHE).then(async cache=>{const hit=await cache.match(request,{ignoreSearch:true});if(hit)return hit;try{return await fetch(request)}catch(error){if(request.mode==="navigate"){const fallback=await cache.match("./index.html");if(fallback)return fallback}throw error}}))});
