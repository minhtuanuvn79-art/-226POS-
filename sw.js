// QUY TẮC VÀNG: Mỗi khi bạn sửa code HTML/CSS/JS, hãy đổi tên phiên bản ở đây (ví dụ: v2 -> v3 -> v4)
const CACHE_NAME = 'pos-cache-v11';

const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    'https://unpkg.com/html5-qrcode',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js'
];

self.addEventListener('install', event => {
    // Lệnh này ép Service Worker phiên bản mới lập tức cài đặt, không cần đợi app tắt đi mở lại
    self.skipWaiting(); 
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                return cache.addAll(urlsToCache);
            })
    );
});

self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Xóa sạch các bộ nhớ đệm của phiên bản cũ (v1)
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Lệnh này ép phiên bản mới lập tức kiểm soát giao diện
    return self.clients.claim(); 
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});