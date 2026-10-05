// 서비스 워커: 앱 화면 파일(HTML·JS·CSS·폰트·아이콘)만 캐시해 오프라인에서도 열리게 한다.
// 자산 데이터는 IndexedDB에만 있고 네트워크(fetch)를 거치지 않으므로 이 캐시에 들어갈 수 없다.
// 캐시 대상은 같은 출처의 GET 요청 중 아래 확장자/경로로 제한한다.

const CACHE = 'asset-tracker-shell-v1';
const STATIC_RE = /\.(?:js|css|woff2|png|webmanifest)$/;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const scope = new URL(self.registration.scope).pathname;
  if (!url.pathname.startsWith(scope)) return;

  // 페이지(index.html): 네트워크 우선, 실패하면 캐시(오프라인)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(scope, copy));
          return res;
        })
        .catch(() => caches.match(scope)),
    );
    return;
  }

  // 해시가 붙은 정적 파일: 캐시 우선
  if (STATIC_RE.test(url.pathname)) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          }),
      ),
    );
  }
});
