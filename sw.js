/* Cache only the app shell, never EOD market-data files or private backups. */
const CACHE = "makemoney-shell-v2";
const SHELL = ["./", "./index.html", "./styles.css", "./engine.js", "./app.js", "./decision.js", "./weekly-ui.js", "./holdings-import.js", "./manifest.webmanifest", "./icons/icon.svg", "./icons/icon-180.png"];
self.addEventListener("install", function(event) {
  event.waitUntil(caches.open(CACHE).then(function(c){return c.addAll(SHELL);}).then(function(){return self.skipWaiting();}).catch(function(){}));
});
self.addEventListener("activate", function(event) {
  event.waitUntil(caches.keys().then(function(keys){return Promise.all(keys.filter(function(k){return k!==CACHE;}).map(function(k){return caches.delete(k);}));}).then(function(){return self.clients.claim();}));
});
self.addEventListener("fetch", function(event) {
  if(event.request.method!=="GET")return;
  var url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.indexOf("/data/")!==-1)return; // network-only: avoid misleading old market data
  event.respondWith(fetch(event.request).then(function(response){
    if(response&&response.ok){var copy=response.clone();caches.open(CACHE).then(function(c){c.put(event.request,copy);}).catch(function(){});}
    return response;
  }).catch(function(){return caches.match(event.request).then(function(hit){return hit||Response.error();});}));
});
