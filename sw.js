
const CACHE_NAME='focusly-v1';
const ASSETS=['./','index.html','styles.css','app.js','manifest.webmanifest','icons/icon-192.png','icons/icon-512.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE_NAME).then(c=>c.addAll(ASSETS)));self.skipWaiting()});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.map(k=>k!==CACHE_NAME?caches.delete(k):null))));self.clients.claim()});
self.addEventListener('fetch',e=>{e.respondWith(caches.match(e.request).then(res=>res||fetch(e.request).then(net=>{const cpy=net.clone();caches.open(CACHE_NAME).then(c=>c.put(e.request,cpy));return net})))})
self.addEventListener('push',event=>{let data={};try{data=event.data?event.data.json():{}}catch{};const title=data.title||'Focusly ADHD';const body=data.body||'Hai promemoria o task da rivedere.';const url=data.url||'./';const opts={body,icon:'icons/icon-192.png',badge:'icons/icon-192.png',data:{url},tag:data.tag||'focusly-push',requireInteraction:!!data.requireInteraction};event.waitUntil(self.registration.showNotification(title,opts))});
self.addEventListener('notificationclick',event=>{event.notification.close();const target=event.notification.data?.url||'./';event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{const open=list.find(w=>new URL(w.url).pathname===new URL(target,location.origin).pathname);if(open){open.focus();return}return clients.openWindow(target)}))});
