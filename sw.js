const CACHE_NAME = 'pos-cache-v1';

// Danh sách tất cả các file và thư viện cần lưu thẳng vào máy tính/điện thoại
const urlsToCache = [
    './',
    './index.html',
    './style.css',
    './script.js',
    // Lưu luôn các thư viện bên ngoài để xài lúc mất mạng
    'https://unpkg.com/html5-qrcode',
    'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js',
    'https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js'
];

// Sự kiện Install: Tải và lưu toàn bộ file vào Cache khi truy cập lần đầu
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Đã mở Cache và đang lưu trữ các file offline...');
                return cache.addAll(urlsToCache);
            })
    );
});

// Sự kiện Fetch: Bắt các luồng tải dữ liệu (Chống màn hình khủng long)
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Nếu tìm thấy file trong Cache (ổ cứng), trả về luôn không cần mạng
                if (response) {
                    return response;
                }
                // Nếu không có trong Cache thì mới bắt đầu tải từ Internet
                return fetch(event.request);
            })
    );
});

// Sự kiện Activate: Tự động dọn dẹp bộ nhớ cũ nếu có bản cập nhật mới
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});