/* عامل خدمة واحد لصفحتي نفحات وطرفي النهار.
   لا يُنزِّل شيئًا مسبقًا: يختزن كل ملف ثقيل عند أول استعمال فعلي،
   فلا تُحمَّل خطوط طرفي النهار على زائر نفحات ولا العكس.
   النتيجة: بعد أول فتحة ناجحة تعمل الصفحة بلا شبكة. */

/* تغيير هذا الاسم يمحو كل ما خزّنه المتصفح سابقًا عند أول تحديث. */
var CACHE = "daily-v3";

/* روابط أُلغيت. تُرفض من الذاكرة ومن الشبكة معًا، فلا تعود تعمل
   عند من فتحها قبل الإلغاء ولو كانت محفوظة في جهازه. */
var RETIRED = /\/(quran|nafahat)\.html$/i;

var GONE = '<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>رابط قديم</title><meta name="theme-color" content="#F6F2E8"><meta name="robots" content="noindex"><style>*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#F6F2E8;color:#2B3A34;padding:28px;font-family:system-ui,-apple-system,"Segoe UI",Tahoma,sans-serif}.box{max-width:360px;text-align:center;border:1px solid #DCD3BE;border-radius:18px;background:#FBF8F1;padding:34px 26px}.mark{width:46px;height:46px;margin:0 auto 18px;border-radius:50%;border:1.6px solid #A8802F;position:relative}.mark::before,.mark::after{content:"";position:absolute;background:#A8802F;width:1.6px;height:17px;top:14px;left:21.2px}.mark::before{transform:rotate(45deg)}.mark::after{transform:rotate(-45deg)}h1{font-size:20px;font-weight:700;color:#8A6A2F;margin:0 0 12px}p{font-size:15px;line-height:1.95;color:#5A6660;margin:0}</style></head><body><div class="box"><div class="mark"></div><h1>هذا الرابط لم يعد يعمل</h1><p>انتقلت البطاقة إلى رابط جديد. اطلبه ممّن أرسل لك هذا الرابط.</p></div></body></html>';

function goneResponse(){
  return new Response(GONE, {
    status: 404,
    headers: {"Content-Type": "text/html; charset=utf-8"}
  });
}

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
     .then(function(){
       /* إن كانت صفحة ملغاة معروضة الآن من نسخة قديمة محفوظة، تُعاد
          ملاحتها فورًا ليعترضها هذا العامل ويردّها، بلا انتظار فتحة ثانية. */
       return self.clients.matchAll({type:"window"}).then(function(cs){
         cs.forEach(function(c){
           if (c.url && RETIRED.test(new URL(c.url).pathname) && c.navigate) {
             c.navigate(c.url)["catch"](function(){});
           }
         });
       });
     })
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

  /* رابط ملغى: لا يُعرض من الذاكرة ولا يُطلب من الشبكة */
  if (RETIRED.test(url.pathname)) {
    e.respondWith(goneResponse());
    return;
  }

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
