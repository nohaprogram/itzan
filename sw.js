// network-first: always fresh when online, shell fallback offline
self.addEventListener("install",e=>self.skipWaiting());
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{
  const r=e.request,u=new URL(r.url);
  if(r.method!=="GET"||u.origin!==location.origin||u.pathname.startsWith("/api/"))return;
  e.respondWith(fetch(r).then(x=>{if(x.ok&&r.mode==="navigate"){const c=x.clone();caches.open("itzan-v1").then(k=>k.put("/",c));}return x;}).catch(()=>caches.match(r.mode==="navigate"?"/":r)));
});
