/* عامل خدمة واحد لصفحتي نفحات وميقات.
   لا يُنزِّل شيئًا مسبقًا: يختزن كل ملف ثقيل عند أول استعمال فعلي،
   فلا تُحمَّل خطوط ميقات على زائر نفحات ولا العكس.
   النتيجة: بعد أول فتحة ناجحة تعمل الصفحة بلا شبكة. */
var CACHE = "daily-v2";

/* الملفات الثقيلة التي لا تتغير إلا نادرًا: من الذاكرة أولًا */
function isAsset(path){
  return /\.(woff2|ttf|otf|webp|png|jpg|jpeg|svg|ico)$/i.test(path);
}

self.addEventListener("install", function(){ self.skipWaiting(); });

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){ return k === CACHE ? null : caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function put(req, res){
  if (res && res.ok && res.status === 200) {
    var cp = res.clone();
    caches.open(CACHE).then(function(c){ c.put(req, cp); });
  }
  return res;
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url;
  try { url = new URL(req.url); } catch (err) { return; }
  if (url.origin !== self.location.origin) return;

  /* خطوط وصور: الذاكرة أولًا، والشبكة عند أول مرة فقط */
  if (isAsset(url.pathname)) {
    e.respondWith(
      caches.match(req, {ignoreSearch:true}).then(function(hit){
        return hit || fetch(req).then(function(res){ return put(req, res); });
      })
    );
    return;
  }

  /* الصفحات وملفات المحتوى: تُعرض من الذاكرة فورًا وتُحدَّث في الخلفية */
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){ return put(req, res); })
                          .catch(function(){ return hit; });
      return hit || net;
    })
  );
});
