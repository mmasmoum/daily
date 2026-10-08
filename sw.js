/* عامل الخدمة: يجعل الصفحة تعمل بلا شبكة بعد أول فتحة ناجحة.
   الخطوط والخلفية: من الذاكرة أولًا (لا تتغير إلا نادرًا).
   الصفحات وملفات المحتوى: من الذاكرة فورًا مع تحديثها في الخلفية. */
var CACHE = "nafahat-v1";

/* تُحمَّل مسبقًا عند أول زيارة. البدائل القديمة (png و ttf) ليست هنا
   كي لا تُنزَّل بلا داعٍ؛ تُخزَّن تلقائيًا إن طلبها متصفح قديم. */
var HEAVY = [
  "nafahat-template.webp",
  "font-naskh.woff2", "font-naskh-bold.woff2",
  "font-plex.woff2", "font-plex-med.woff2", "font-amiri-bold.woff2"
];
var ALSO = ["nafahat-template.png",
  "font-naskh.ttf","font-naskh-bold.ttf","font-plex.ttf","font-plex-med.ttf","font-amiri-bold.ttf"];

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function(c){
      return Promise.all(HEAVY.map(function(u){
        return c.add(u).catch(function(){});   /* ملف مفقود لا يُفشل التثبيت */
      }));
    })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(ks){
      return Promise.all(ks.map(function(k){ return k===CACHE ? null : caches.delete(k); }));
    }).then(function(){ return self.clients.claim(); })
  );
});

function isHeavy(url){
  return HEAVY.concat(ALSO).some(function(u){ return url.pathname.indexOf(u) >= 0; });
}

self.addEventListener("fetch", function(e){
  var req = e.request;
  if (req.method !== "GET") return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  /* الخطوط والخلفية: الذاكرة أولًا */
  if (isHeavy(url)) {
    e.respondWith(
      caches.match(req, {ignoreSearch:true}).then(function(hit){
        return hit || fetch(req).then(function(res){
          if (res && res.ok) { var cp=res.clone(); caches.open(CACHE).then(function(c){ c.put(req,cp); }); }
          return res;
        });
      })
    );
    return;
  }

  /* الصفحات وملفات المحتوى: من الذاكرة فورًا، ثم تحديث صامت */
  e.respondWith(
    caches.match(req).then(function(hit){
      var net = fetch(req).then(function(res){
        if (res && res.ok) { var cp=res.clone(); caches.open(CACHE).then(function(c){ c.put(req,cp); }); }
        return res;
      }).catch(function(){ return hit; });
      return hit || net;
    })
  );
});
