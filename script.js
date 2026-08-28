// ==========================================
// 0. LÕI HỆ THỐNG INDEXEDDB (BỘ NHỚ LƯU TRỮ 500MB+)
// ==========================================
window.KV_RAM = {}; 
window.isRAMReady = false; // CỜ BẢO VỆ CHỐNG GHI ĐÈ ẢO

const DB_NAME = '226POS_DB';
const STORE_NAME = 'kv_store';

let appDB = null; // Biến giữ kết nối DB

window.initDB = function() {
    return new Promise((resolve, reject) => {
        if (appDB) return resolve(appDB); // Tái sử dụng nếu đã mở
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
        };
        req.onsuccess = (e) => {
            appDB = e.target.result;
            resolve(appDB);
        };
        req.onerror = (e) => reject(e);
    });
};
window.loadDBToRAM = async function() {
    const db = await window.initDB();
    return new Promise((resolve) => {
        const tx = db.transaction([STORE_NAME], 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.getAllKeys();
        
        req.onsuccess = () => {
            const keys = req.result;
            if (keys.length === 0) return resolve();
            
            let loaded = 0;
            keys.forEach(key => {
                const getReq = store.get(key);
                getReq.onsuccess = () => {
                    window.KV_RAM[key] = getReq.result;
                    loaded++;
                    if (loaded === keys.length) resolve();
                };
            });
        };
    });
};

window.saveDB = async function(key, value) {
    const db = await window.initDB(); // Giờ đây thao tác này cực nhanh vì trả về appDB ngay lập tức
    const tx = db.transaction([STORE_NAME], 'readwrite');
    tx.objectStore(STORE_NAME).put(value, key);
};

const oriGet = localStorage.getItem.bind(localStorage);
const oriSet = localStorage.setItem.bind(localStorage);
const oriRemove = localStorage.removeItem.bind(localStorage);

localStorage.getItem = function(key) {
    if (key.startsWith('kv_')) {
        return window.KV_RAM[key] !== undefined ? window.KV_RAM[key] : oriGet(key);
    }
    return oriGet(key);
};

let ramQueue = []; // Tạo hàng đợi
localStorage.setItem = function(key, value) {
    if (key.startsWith('kv_')) {
        // [QUAN TRỌNG] Đưa vào hàng đợi nếu RAM chưa tải xong
        if (!window.isRAMReady) {
            console.log("⏳ RAM chưa sẵn sàng, đưa vào hàng đợi: ", key);
            ramQueue.push({key, value});
            return; 
        }
        window.KV_RAM[key] = value;
        window.saveDB(key, value); 
        try { oriRemove(key); } catch(e){} 
    } else {
        oriSet(key, value);
    }
};

localStorage.removeItem = function(key) {
    if (key.startsWith('kv_')) {
        delete window.KV_RAM[key];
        window.initDB().then(db => {
            db.transaction([STORE_NAME], 'readwrite').objectStore(STORE_NAME).delete(key);
        });
    }
    oriRemove(key);
};



window.reloadGlobalsFromRAM = function() {
    try { accounts = (JSON.parse(localStorage.getItem('kv_accounts')) || []).filter(Boolean); if (accounts.length === 0) { accounts.push({ fullname: "Quản trị viên", username: "admin", password: "1", role: "manager" }); localStorage.setItem('kv_accounts', JSON.stringify(accounts)); } window.accounts = accounts; } catch(e){}
    try { products = JSON.parse(localStorage.getItem('kv_products')) || []; window.products = products; } catch(e){}
    try { productGroups = JSON.parse(localStorage.getItem('kv_groups')) || []; window.productGroups = productGroups; } catch(e){}
    try { priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || []; window.priceBooks = priceBooks; } catch(e){}
    try { invoices = JSON.parse(localStorage.getItem('kv_invoices')) || []; window.invoices = invoices; } catch(e){}
    try { importOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || []; window.importOrders = importOrders; } catch(e){}
    try { inventoryChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || []; window.inventoryChecks = inventoryChecks; } catch(e){}
    try { branches = JSON.parse(localStorage.getItem('kv_branches')) || [{ id: 'CN001', name: 'Chi nhánh 1' }]; window.branches = branches; } catch(e){}
};
// ==========================================
// KẾT THÚC LÕI INDEXEDDB
// ==========================================
// ==========================================
// 1. KHỞI TẠO DỮ LIỆU TỪ LOCALSTORAGE
// ==========================================

let accounts = (JSON.parse(localStorage.getItem('kv_accounts')) || []).filter(Boolean);
if (accounts.length === 0) {
    accounts.push({ fullname: "Quản trị viên", username: "admin", password: "1", role: "manager" });
    localStorage.setItem('kv_accounts', JSON.stringify(accounts));
}
let currentUser = null;

let products = JSON.parse(localStorage.getItem('kv_products')) || [];
let productGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
let priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];

let editingProductId = null;
let editingGroupId = null;
let activePriceBookIds = ['default'];

// BIẾN CHO TÍNH NĂNG ĐƠN VỊ TÍNH
let currentProductUnits = [];
let currentVariants = []; 
let editingUnitIndex = null;
// Hàm chuyển đổi Tiếng Việt có dấu sang không dấu
// === ĐOẠN MÃ KHÔI PHỤC DỮ LIỆU CŨ ===
// === ĐOẠN MÃ KHÔI PHỤC DỮ LIỆU CŨ (ÉP BUỘC) ===
(function khôiPhucHeThong() {
    let rawData = localStorage.getItem('kv_products');
    if (!rawData) return;
    
    let allProducts = JSON.parse(rawData);
    let updatedCount = 0;

    allProducts.forEach(p => {
        // Nếu hàng hóa hoàn toàn không có chi nhánh, mặc định đưa về CN1
        if (!p.branchId) {
            p.branchId = 'CN001'; 
            updatedCount++;
        }
    });

    if (updatedCount > 0) {
        localStorage.setItem('kv_products', JSON.stringify(allProducts));
        // Cập nhật ngay vào biến toàn cục để renderList đọc được luôn
        window.products = allProducts;
        
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', allProducts);
        }
        console.log(`🚀 Đã khôi phục thành công ${updatedCount} mặt hàng về Chi nhánh 1.`);
    }
})();
window.removeVietnameseTones = function(str) {
    if (!str) return "";
    str = str.replace(/à|á|ạ|ả|ã|â|ầ|ấ|ậ|ẩ|ẫ|ă|ằ|ắ|ặ|ẳ|ẵ/g, "a");
    str = str.replace(/è|é|ẹ|ẻ|ẽ|ê|ề|ế|ệ|ể|ễ/g, "e");
    str = str.replace(/ì|í|ị|ỉ|ĩ/g, "i");
    str = str.replace(/ò|ó|ọ|ỏ|õ|ô|ồ|ố|ộ|ổ|ỗ|ơ|ờ|ớ|ợ|ở|ỡ/g, "o");
    str = str.replace(/ù|ú|ụ|ủ|ũ|ư|ừ|ứ|ự|ử|ữ/g, "u");
    str = str.replace(/ỳ|ý|ỵ|ỷ|ỹ/g, "y");
    str = str.replace(/đ/g, "d");
    str = str.replace(/À|Á|Ạ|Ả|Ã|Â|Ầ|Ấ|Ậ|Ẩ|Ẫ|Ă|Ằ|Ắ|Ặ|Ẳ|Ẵ/g, "A");
    str = str.replace(/È|É|Ẹ|Ẻ|Ẽ|Ê|Ề|Ế|Ệ|Ể|Ễ/g, "E");
    str = str.replace(/Ì|Í|Ị|Ỉ|Ĩ/g, "I");
    str = str.replace(/Ò|Ó|Ọ|Ỏ|Õ|Ô|Ồ|Ố|Ộ|Ổ|Ỗ|Ơ|Ờ|Ớ|Ợ|Ở|Ỡ/g, "O");
    str = str.replace(/Ù|Ú|Ụ|Ủ|Ũ|Ư|Ừ|Ứ|Ự|Ử|Ữ/g, "U");
    str = str.replace(/Ỳ|Ý|Ỵ|Ỷ|Ỹ/g, "Y");
    str = str.replace(/Đ/g, "D");
    // Loại bỏ các dấu phụ khác
    str = str.replace(/\u0300|\u0301|\u0303|\u0309|\u0323/g, ""); 
    str = str.replace(/\u02C6|\u0306|\u031B/g, ""); 
    return str;
};

// Đặt ở đầu file script.js
window.focusPOSSearch = function() {
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
        searchInput.focus();
        searchInput.select(); // Luôn bôi đen để quét đè mã mới
    }
};
// BIẾN CHO TÍNH NĂNG THIẾT LẬP GIÁ NHANH TRONG MODAL HÀNG HÓA
let tempPriceBookValues = {};
window.formatCurrency = function(input) {
    if (input && typeof input === 'object' && input.value !== undefined) {
        // Xử lý khi người dùng đang gõ trực tiếp vào ô input
        let val = input.value;
        
        // 1. Chỉ giữ lại số nguyên và dấu phẩy (,)
        val = val.replace(/[^0-9,]/g, '');
        
        // 2. Tách phần nguyên và phần thập phân (nếu có)
        let parts = val.split(',');
        let intPart = parts[0];
        // Chỉ lấy nội dung sau dấu phẩy đầu tiên (phòng trường hợp người dùng gõ nhiều dấu phẩy)
        let decPart = parts.length > 1 ? ',' + parts[1] : '';

        // 3. Định dạng phần nguyên (thêm dấu chấm hàng nghìn)
        if (intPart) {
            intPart = parseInt(intPart, 10).toLocaleString('vi-VN');
        }

        // 4. Gộp lại và hiển thị
        input.value = intPart + decPart;
    } else {
        // Xử lý khi in số liệu tĩnh ra giao diện (Cho phép tối đa 9 số thập phân)
        return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 9 }).format(Number(input) || 0);
    }
};
// Hàm tính tồn kho dựa trên đơn vị quy đổi
function getStockByUnit(product, unitIndex) {
    const baseStock = parseFloat(product.stock) || 0;
    const rate = parseFloat(product.units[unitIndex].rate) || 1;
    // Trả về số tồn kho đã quy đổi (Ví dụ: 3 hộp / quy đổi 4 = 0.75 thùng)
    return parseFloat((baseStock / rate).toFixed(2)); 
}
// Quy đổi từ chuỗi "1.000" sang số 1000 để tính toán chính xác
window.parseCurrency = function(value) {
    if (!value && value !== 0) return 0;
    let strVal = value.toString();
    
    // 1. Xóa tất cả dấu chấm (phân cách hàng nghìn của VN)
    strVal = strVal.replace(/\./g, '');
    
    // 2. Thay dấu phẩy thành dấu chấm (để JS hiểu đây là số thập phân)
    strVal = strVal.replace(/,/g, '.');
    
    // 3. Loại bỏ các ký tự rác (chỉ giữ lại số, dấu chấm và dấu trừ nếu là số âm)
    strVal = strVal.replace(/[^0-9.-]/g, '');
    
    return parseFloat(strVal) || 0;
};

// ==========================================
// 2. ĐIỀU HƯỚNG MÀN HÌNH & GHI NHỚ TRẠNG THÁI (F5)
// ==========================================
function hideAll() {
    document.getElementById('login-view').style.display = 'none';
    document.getElementById('admin-settings-view').style.display = 'none';
    document.getElementById('dashboard-view').style.display = 'none';
    document.getElementById('pos-view').style.display = 'none';
}

function togglePassword() {
    const p = document.getElementById('login-pass');
    p.type = p.type === 'password' ? 'text' : 'password';
}

let tempLoginData = null;

function handleLogin(type) {
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();
    const err = document.getElementById('login-error');

    if (!u || !p) { 
        err.style.display = 'block'; 
        err.innerText = "Vui lòng nhập đầy đủ thông tin!";
        return; 
    }

    const latestAccounts = JSON.parse(localStorage.getItem('kv_accounts')) || accounts;
    const user = latestAccounts.find(x => x && x.username === u && x.password === p);

    if (user) {
        err.style.display = 'none';

        // ========================================================
        // 🚀 TÍNH NĂNG LƯU NHIỀU TÀI KHOẢN VÀO MÁY
        // ========================================================
        const rememberMe = document.getElementById('remember-me');
        let savedLogins = JSON.parse(localStorage.getItem('kv_saved_logins')) || [];
        
        if (rememberMe && rememberMe.checked) {
            const encodedPass = btoa(encodeURIComponent(p));
            // Lọc bỏ tk này nếu đã có trong danh sách (để đưa nó lên đầu)
            savedLogins = savedLogins.filter(acc => acc.u !== u);
            // Thêm vào đầu danh sách
            savedLogins.unshift({ u: u, p: encodedPass, name: user.fullname, role: user.role });
            
            // Chỉ giữ lại tối đa 5 tài khoản gần nhất cho đỡ rối
            if (savedLogins.length > 5) savedLogins.pop();
            
            localStorage.setItem('kv_saved_logins', JSON.stringify(savedLogins));
        } else {
            // Nếu không tick duy trì -> Xóa tk này khỏi bộ nhớ (nếu có)
            savedLogins = savedLogins.filter(acc => acc.u !== u);
            localStorage.setItem('kv_saved_logins', JSON.stringify(savedLogins));
        }
        // ========================================================
        
        let userBranches = user.branchIds || (user.branchId ? [user.branchId] : ['CN001']);

        tempLoginData = { user, type, branches: userBranches };

        if (userBranches.length > 1) {
            document.querySelector('.login-box').style.display = 'none';
            document.getElementById('login-branch-select-box').style.display = 'block';
            renderLoginBranchSelect(userBranches);
        } else {
            completeLogin(userBranches[0]);
        }
    } else {
        err.style.display = 'block';
        err.innerText = "Tên đăng nhập hoặc mật khẩu không đúng!";
    }
}

// Render danh sách nút bấm chi nhánh
function renderLoginBranchSelect(allowedBranches) {
    const listContainer = document.getElementById('login-branch-list');
    const allBranches = JSON.parse(localStorage.getItem('kv_branches')) || [{ id: 'CN001', name: 'Chi nhánh 1' }];
    
    let html = '';
    allowedBranches.forEach(bId => {
        const b = allBranches.find(x => x.id === bId);
        if (b) {
            html += `<button onclick="completeLogin('${b.id}')" style="padding: 12px; background: white; border: 1px solid var(--kv-blue); color: var(--kv-blue); border-radius: 6px; cursor: pointer; font-weight: bold; transition: 0.2s;" onmouseover="this.style.background='var(--kv-blue)'; this.style.color='white'" onmouseout="this.style.background='white'; this.style.color='var(--kv-blue)'">
                        ${b.name}
                    </button>`;
        }
    });
    listContainer.innerHTML = html;
}

// Hoàn tất quá trình đăng nhập sau khi đã xác định được chi nhánh
function completeLogin(selectedBranchId) {
    if (!tempLoginData) return;

    const { user, type } = tempLoginData;
    currentUser = user;
    
    localStorage.setItem('kv_current_user', JSON.stringify(currentUser));
    localStorage.setItem('kv_current_branch', selectedBranchId);
    
    
    // Ẩn hộp thoại chọn chi nhánh (nếu có mở)
    const selectBox = document.getElementById('login-branch-select-box');
    if(selectBox) selectBox.style.display = 'none';
    
    // Đảm bảo hộp thoại login chính hiển thị lại cho lần sau
    const loginBox = document.querySelector('.login-box');
    if(loginBox) loginBox.style.display = 'block';

    if (type === 'manage') {
        if (user.role === 'cashier') {
            alert("Nhân viên Thu ngân không có quyền vào trang Quản lý."); 
            return;
        }
        sessionStorage.setItem('kv_current_view', 'dashboard-view');
        hideAll();
        document.getElementById('dashboard-view').style.display = 'flex';
        document.getElementById('dash-user-name').innerText = user.fullname;
        
        const savedTab = localStorage.getItem('kv_current_tab') || 'tab-tong-quan';
        openDashTab(savedTab);
    } else {
        sessionStorage.setItem('kv_current_view', 'pos-view');
        hideAll();
        document.getElementById('pos-view').style.display = 'flex';
        
        initPOSData(); 
    }
    
    showToast(`Chào mừng ${user.fullname} đã đăng nhập!`, "success");
    window.renderQuickBranchSwitcher();
    tempLoginData = null; // Xóa dữ liệu tạm
}
function logout() {
    currentUser = null;
    
    // Xóa bộ nhớ trạng thái khi đăng xuất
    localStorage.removeItem('kv_current_user');
    sessionStorage.removeItem('kv_current_view');
    localStorage.removeItem('kv_current_tab');
    localStorage.removeItem('kv_current_branch');
    
    // Lưu ý: Đã gỡ bỏ lệnh xóa kv_pos_state, kv_io_state, kv_ic_state để giữ lại đơn hàng đang làm dở
    
    hideAll();
    document.getElementById('login-view').style.display = 'flex';
    
    // --- XÓA TRẮNG VÀ NẠP LẠI TÀI KHOẢN ĐÃ LƯU ---
    const uInput = document.getElementById('login-user');
    const pInput = document.getElementById('login-pass');
    
    if (uInput) uInput.value = '';
    if (pInput) pInput.value = '';
    
    // Kích hoạt nạp lại mật khẩu nếu người dùng có tick "Duy trì đăng nhập"
    if (typeof window.loadSavedLogin === 'function') {
        window.loadSavedLogin();
    }
    // ----------------------------------------------
}

function switchToPOS() {
    sessionStorage.setItem('kv_current_view', 'pos-view');
    hideAll();
    const posView = document.getElementById('pos-view');
    if(posView) posView.style.display = 'flex';
    
    // BẮT BUỘC có dòng này để nạp Tab hóa đơn và Bảng giá
    initPOSData(); 
}

function switchToDashboard() {
    if(currentUser.role === 'cashier') {
        alert("Bạn không có quyền truy cập trang Quản lý."); return;
    }
    sessionStorage.setItem('kv_current_view', 'dashboard-view');
    hideAll();
    document.getElementById('dashboard-view').style.display = 'flex';
    
    // Lấy tab đang mở trước đó
    const savedTab = localStorage.getItem('kv_current_tab') || 'tab-tong-quan';
    
    // Gọi hàm openDashTab để kích hoạt render dữ liệu cho tab đó
    openDashTab(savedTab);
}

// ==========================================
// TÍNH NĂNG CHUYỂN CHI NHÁNH NHANH (UI HIỆN ĐẠI & XÁC THỰC MK)
// ==========================================
let pendingBranchId = null; 

// 1. Hàm vẽ danh sách vào Custom Dropdown
window.renderQuickBranchSwitcher = function() {
    if (!currentUser) return;
    
    const userBranches = currentUser.branchIds || (currentUser.branchId ? [currentUser.branchId] : ['CN001']);
    const allBranches = JSON.parse(localStorage.getItem('kv_branches')) || [];
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';

    const dashSelector = document.getElementById('dash-branch-selector');
    const posSelector = document.getElementById('pos-branch-selector');
    
    // Nếu chỉ có 1 chi nhánh thì ẩn đi cho gọn
    if (userBranches.length <= 1) {
        if (dashSelector) dashSelector.style.display = 'none';
        if (posSelector) posSelector.style.display = 'none';
        return;
    }

    if (dashSelector) dashSelector.style.display = 'block';
    if (posSelector) posSelector.style.display = 'block';

    let html = '';
    let currentBranchName = '';

    userBranches.forEach(bId => {
        const b = allBranches.find(x => x.id === bId);
        if (b) {
            const isActive = (b.id === currentBranch);
            if (isActive) currentBranchName = b.name;
            
            const checkIcon = isActive ? '<i class="fa-solid fa-check" style="color: #28a745;"></i>' : '';
            const activeClass = isActive ? 'active' : '';

            html += `<div class="branch-dropdown-item ${activeClass}" onclick="quickSwitchBranch('${b.id}')">
                        <span>${b.name}</span>
                        ${checkIcon}
                     </div>`;
        }
    });

    // Đổ dữ liệu tên hiển thị và danh sách html
    const dashDisplay = document.getElementById('dash-branch-display');
    const posDisplay = document.getElementById('pos-branch-display');
    if (dashDisplay) dashDisplay.innerText = currentBranchName;
    if (posDisplay) posDisplay.innerText = currentBranchName;

    const dashDropdown = document.getElementById('dash-branch-dropdown');
    const posDropdown = document.getElementById('pos-branch-dropdown');
    if (dashDropdown) dashDropdown.innerHTML = html;
    if (posDropdown) posDropdown.innerHTML = html;
};

// 2. Mở / Đóng Menu
window.toggleBranchDropdown = function(dropdownId) {
    const dropdown = document.getElementById(dropdownId);
    if (dropdown) {
        // Đóng các dropdown khác để tránh mở chồng chéo
        document.querySelectorAll('.branch-dropdown').forEach(el => {
            if (el.id !== dropdownId) el.style.display = 'none';
        });
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
};

// 3. Tự động đóng Menu khi click chuột ra ngoài
document.addEventListener('click', function(e) {
    const isClickInside = e.target.closest('.kv-branch-selector');
    if (!isClickInside) {
        document.querySelectorAll('.branch-dropdown').forEach(el => el.style.display = 'none');
    }
});

// 4. Mở hộp thoại yêu cầu mật khẩu
window.quickSwitchBranch = function(newBranchId) {
    const currentBranch = localStorage.getItem('kv_current_branch');
    
    // Ẩn menu dropdown ngay lập tức
    document.querySelectorAll('.branch-dropdown').forEach(el => el.style.display = 'none');
    
    if (newBranchId && newBranchId !== currentBranch) {
        pendingBranchId = newBranchId; 
        
        document.getElementById('switch-branch-username').innerText = currentUser.username;
        const passInput = document.getElementById('switch-branch-pass');
        passInput.value = ''; 
        
        document.getElementById('switch-branch-modal').style.display = 'flex';
        setTimeout(() => passInput.focus(), 100);
    }
};

// 5. Kiểm tra mật khẩu (Giữ nguyên như lúc nãy)
window.confirmSwitchBranch = function() {
    const passInput = document.getElementById('switch-branch-pass').value.trim();
    if (passInput === currentUser.password) {
        localStorage.setItem('kv_current_branch', pendingBranchId);
        window.location.reload();
    } else {
        showToast("Mật khẩu không chính xác!", "error");
        document.getElementById('switch-branch-pass').select();
    }
};

// 6. Cập nhật hàm Hủy bỏ
window.cancelSwitchBranch = function() {
    document.getElementById('switch-branch-modal').style.display = 'none';
    pendingBranchId = null;
};
// ==========================================
// 3. ADMIN PANEL (QUẢN LÝ TÀI KHOẢN)
// ==========================================
function showAuthModal() { document.getElementById('auth-modal').style.display = 'flex'; }
function closeAuthModal() { document.getElementById('auth-modal').style.display = 'none'; }

function verifyAdmin() {
    if(document.getElementById('admin-pass-input').value === 'admin123') {
        closeAuthModal();
        localStorage.setItem('kv_current_view', 'admin-settings-view');
        hideAll();
        document.getElementById('admin-settings-view').style.display = 'flex';
        document.getElementById('admin-pass-input').value = '';
        switchAdminTab('list');
    } else {
        alert("Sai mật khẩu Admin!");
    }
}

function switchAdminTab(tabName) {
    // Ẩn tất cả các card
    document.getElementById('admin-tab-create').style.display = 'none';
    document.getElementById('admin-tab-list').style.display = 'none';
    document.getElementById('admin-tab-branches').style.display = 'none';
    
    // Bỏ active tất cả menu
    document.querySelectorAll('.admin-menu li').forEach(li => li.classList.remove('active'));

    // Hiển thị card được chọn
    const targetCard = document.getElementById(`admin-tab-${tabName}`);
    if (targetCard) targetCard.style.display = 'block';
    
    const targetMenu = document.getElementById(`menu-tab-${tabName}`);
    if (targetMenu) targetMenu.classList.add('active');

    if (tabName === 'list') renderAccountList();
    if (tabName === 'branches') renderBranchList();
    if (tabName === 'create') window.renderBranchSelectInAdmin();
}

function renderAccountList() {
    const tbody = document.getElementById('account-list-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    
    // Lấy danh sách chi nhánh mới nhất để đối soát
    const currentBranches = JSON.parse(localStorage.getItem('kv_branches')) || [{ id: 'CN001', name: 'Chi nhánh 1' }];

    accounts.forEach(acc => {
        if (!acc) return;
        
        // Tìm tên chi nhánh dựa vào branchId của tài khoản
        const branchObj = currentBranches.find(b => b.id === acc.branchId);
        const branchDisplayName = branchObj ? branchObj.name : acc.branchId; // Hiển thị tên, nếu không tìm thấy thì hiện mã

        const roleText = acc.role === 'manager' ? '<span style="color:var(--kv-blue); font-weight:bold;">Quản lý</span>' : 'Thu ngân';
        const disableDelete = acc.username === 'admin' ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : '';
        
        tbody.innerHTML += `
            <tr>
                <td>${acc.fullname}</td>
                <td><strong>${acc.username}</strong></td>
                <td>${roleText}</td>
                <td style="font-size: 12px; color: var(--kv-pink); font-weight: 600;">${branchDisplayName}</td>
                <td style="text-align: center;">
                    <button class="action-btn btn-edit" onclick="openEditModal('${acc.username}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn btn-delete" onclick="deleteAccount('${acc.username}')" ${disableDelete}><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}
let branches = JSON.parse(localStorage.getItem('kv_branches')) || [{ id: 'CN001', name: 'Chi nhánh 1' }];

window.renderBranchList = function() {
    const container = document.getElementById('branch-grid-container');
    if (!container) return;

    // Lấy dữ liệu chi nhánh, tài khoản và hàng hóa để đếm số lượng
    const allBranches = JSON.parse(localStorage.getItem('kv_branches')) || [{ id: 'CN001', name: 'Chi nhánh 1' }];
    const allAccounts = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    const allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];

    container.innerHTML = allBranches.map(br => {
        // [ĐÃ SỬA LỖI TẠI ĐÂY] Đếm số nhân viên có chứa mã chi nhánh này trong mảng branchIds
        const staffCount = allAccounts.filter(acc => {
            return (acc.branchIds && acc.branchIds.includes(br.id)) || (acc.branchId === br.id);
        }).length;

        // Đếm hàng hóa
        const productCount = allProducts.filter(p => (p.branchId || 'CN001') === br.id).length;

        return `
            <div class="branch-item-card" onclick="viewBranchDetail('${br.id}', '${br.name}')">
                <div class="branch-icon-circle">
                    <i class="fa-solid fa-store"></i>
                </div>
                <h4 style="font-size: 18px; margin-bottom: 5px; color: #333;">${br.name}</h4>
                <p style="font-size: 12px; color: #888; margin-bottom: 15px;">Mã: <strong>${br.id}</strong></p>
                
                <div style="display: flex; justify-content: space-around; background: #fafafa; padding: 10px; border-radius: 8px;">
                    <div style="text-align: center;">
                        <div style="font-weight: bold; color: var(--kv-blue);">${staffCount}</div>
                        <div style="font-size: 11px; color: #888;">Nhân viên</div>
                    </div>
                    <div style="border-left: 1px solid #eee;"></div>
                    <div style="text-align: center;">
                        <div style="font-weight: bold; color: var(--kv-pink);">${productCount}</div>
                        <div style="font-size: 11px; color: #888;">Mặt hàng</div>
                    </div>
                </div>

                <div class="branch-card-btns">
                    <button class="btn-branch-action" onclick="event.stopPropagation(); openBranchModal('${br.id}')">
                        <i class="fa-solid fa-pen-to-square"></i> Sửa tên
                    </button>
                    <button class="btn-branch-action" style="color: #d9534f;" onclick="event.stopPropagation(); deleteBranch('${br.id}')">
                        <i class="fa-solid fa-trash-can"></i> Xóa
                    </button>
                </div>
            </div>
        `;
    }).join('');
};

let selectedBranchId = null; // Biến lưu chi nhánh đang xem

window.viewBranchDetail = function(branchId, branchName) {
    selectedBranchId = branchId;
    
    // Ẩn Grid, hiện giao diện chi tiết
    document.getElementById('branch-main-view').style.display = 'none';
    const detailView = document.getElementById('branch-detail-view');
    detailView.style.display = 'block';
    document.getElementById('detail-branch-title').innerText = "Chi nhánh: " + branchName;

    // Cuộn vùng chứa lên đầu trang
    document.querySelector('.admin-content').scrollTop = 0;

    renderBranchStaff(branchId);
};

// 2. Hàm quay lại danh sách Grid
window.backToBranchGrid = function() {
    document.getElementById('branch-main-view').style.display = 'block';
    document.getElementById('branch-detail-view').style.display = 'none';
    selectedBranchId = null;
};

// 3. Hàm render danh sách nhân viên theo chi nhánh
window.renderBranchStaff = function(branchId) {
    const tbody = document.getElementById('branch-staff-table-body');
    const allAccounts = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    
    // ĐÃ SỬA LỖI TẠI ĐÂY: Thêm acc && để lọc bỏ các tài khoản bị rỗng
    const staff = allAccounts.filter(acc => {
        return acc && ((acc.branchIds && acc.branchIds.includes(branchId)) || (acc.branchId === branchId));
    });

    if (staff.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding: 20px; color: #888;">Chưa có nhân viên nào tại chi nhánh này</td></tr>';
        return;
    }

    tbody.innerHTML = staff.map(acc => `
        <tr>
            <td><strong>${acc.fullname}</strong></td>
            <td>${acc.username}</td>
            <td><span class="badge ${acc.role === 'manager' ? 'badge-manager' : 'badge-staff'}">${acc.role === 'manager' ? 'Quản lý' : 'Nhân viên'}</span></td>
            <td>
                <button class="btn-action edit" onclick="openEditModal('${acc.username}')"><i class="fa-solid fa-pen"></i></button>
                <button class="btn-action delete" onclick="deleteAccount('${acc.username}')"><i class="fa-solid fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
};

// 4. Hàm mở modal thêm tài khoản (Tự động điền chi nhánh hiện tại)
window.openAccountModalWithBranch = function() {
    // Gọi hàm mở modal có sẵn của bạn
    openAccountModal(); 
    
    // Tự động chọn chi nhánh trong select của modal
    const branchSelect = document.getElementById('acc-branch');
    if (branchSelect && selectedBranchId) {
        branchSelect.value = selectedBranchId;
        branchSelect.disabled = true; // Khóa lại để không chọn nhầm sang chi nhánh khác
    }
};
window.openBranchModal = function(id = null) {
    // Đọc dữ liệu mới nhất từ bộ nhớ máy
    branches = JSON.parse(localStorage.getItem('kv_branches')) || branches;
    
    if (id) {
        const br = branches.find(x => x.id === id);
        if (!br) return alert("Không tìm thấy chi nhánh!");
        const newName = prompt("Nhập tên chi nhánh mới:", br.name);
        if (newName) {
            br.name = newName.trim();
            window.saveAndSyncBranches();
        }
    } else {
        const brName = prompt("Nhập tên chi nhánh mới:");
        const brId = prompt("Nhập mã chi nhánh (VD: CN002):");
        if (brName && brId) {
            if (branches.find(x => x.id === brId)) return alert("Mã chi nhánh đã tồn tại!");
            branches.push({ id: brId.trim(), name: brName.trim() });
            window.saveAndSyncBranches();
        }
    }
};

window.saveAndSyncBranches = function() {
    localStorage.setItem('kv_branches', JSON.stringify(branches));
    if (window.uploadToCloud) window.uploadToCloud('branches', branches);
    
    // Cập nhật lại giao diện ngay lập tức
    if (typeof window.renderBranchList === 'function') window.renderBranchList();
    if (typeof window.renderBranchSelectInAdmin === 'function') window.renderBranchSelectInAdmin();
};

window.deleteBranch = function(id) {
    branches = JSON.parse(localStorage.getItem('kv_branches')) || branches;
    if (branches.length <= 1) return alert("Phải có ít nhất 1 chi nhánh!");
    
    // SỬ DỤNG showConfirm THAY VÌ if (confirm(...))
    showConfirm("Bạn có chắc chắn muốn xóa chi nhánh này?", function() {
        branches = branches.filter(x => x.id !== id);
        window.saveAndSyncBranches();
        
        if (typeof selectedBranchId !== 'undefined' && selectedBranchId === id) {
            window.backToBranchGrid();
        }
        showToast("Đã xóa chi nhánh thành công!", "success");
    });
};
function createAccount() {
    // 1. Lấy dữ liệu từ các ô nhập liệu cơ bản
    const fn = document.getElementById('new-fullname').value.trim();
    const un = document.getElementById('new-username').value.trim();
    const pw = document.getElementById('new-password').value.trim();
    const ro = document.getElementById('new-role').value;

    // 2. Lấy danh sách các chi nhánh được tích chọn (từ Checkbox)
    const branchCbs = document.querySelectorAll('.new-branch-cb:checked');
    const selectedBranches = Array.from(branchCbs).map(cb => cb.value);

    // 3. Kiểm tra tính hợp lệ của dữ liệu
    if (!fn || !un || !pw) { 
        showToast("Vui lòng điền đầy đủ họ tên, tên đăng nhập và mật khẩu!", "warning"); 
        return; 
    }
    
    if (selectedBranches.length === 0) {
        showToast("Vui lòng chọn ít nhất 1 chi nhánh cho nhân viên này!", "warning");
        return;
    }

    // 4. Kiểm tra xem tên đăng nhập đã bị trùng chưa
    const existingAccounts = JSON.parse(localStorage.getItem('kv_accounts')) || accounts;
    if (existingAccounts.find(x => x && x.username === un)) { 
        showToast("Tên đăng nhập này đã tồn tại trên hệ thống!", "error"); 
        return; 
    }

    // 5. Tạo đối tượng tài khoản mới (Lưu chi nhánh dưới dạng mảng branchIds)
    const newAcc = { 
        fullname: fn, 
        username: un, 
        password: pw, 
        role: ro,
        branchIds: selectedBranches, // Lưu dạng mảng chứa nhiều mã: ['CN001', 'CN002']
        createdAt: new Date().toLocaleString('vi-VN')
    };

    // 6. Lưu dữ liệu vào biến và LocalStorage
    accounts.push(newAcc);
    localStorage.setItem('kv_accounts', JSON.stringify(accounts));
    
    // Đồng bộ lên hệ thống Cloud Firebase ngay lập tức
    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('accounts', accounts);
    }

    // 7. Thông báo và làm sạch Form
    showToast(`Đã tạo tài khoản cho ${fn} thành công!`, "success");
    
    document.getElementById('new-fullname').value = '';
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    
    // Reset lại toàn bộ checkbox chi nhánh
    document.querySelectorAll('.new-branch-cb').forEach(cb => cb.checked = false);
    
    // 8. Quay lại tab danh sách tài khoản để xem kết quả
    switchAdminTab('list');
}

// Bổ sung để đảm bảo hàm có thể được gọi từ file HTML bằng onClick
window.createAccount = createAccount;
window.renderBranchSelectInAdmin = function() {
    const container = document.getElementById('new-branch-list-container');
    if (!container) return;

    const currentBranches = JSON.parse(localStorage.getItem('kv_branches')) || [];
    
    let html = '';
    currentBranches.forEach(br => {
        // [ĐÃ SỬA LỖI UI]: Thêm display:flex cho label và ép width/margin cho input
        html += `<label style="display: flex; align-items: center; margin-bottom: 8px; cursor: pointer; font-size: 14px; color: #333;">
                    <input type="checkbox" class="new-branch-cb" value="${br.id}" style="width: 16px; height: 16px; margin: 0; margin-right: 10px; padding: 0;"> 
                    ${br.name}
                 </label>`;
    });
    
    container.innerHTML = html;
};

// Cập nhật hàm switchAdminTab để mỗi khi bấm sang tab "Tạo tài khoản" thì nạp lại chi nhánh mới nhất
const originalSwitchAdminTab = window.switchAdminTab;
window.switchAdminTab = function(tabName) {
    originalSwitchAdminTab(tabName);
    if (tabName === 'create') {
        window.renderBranchSelectInAdmin();
    }
};
window.deleteAccount = function(username) {
    // 1. Bảo vệ tài khoản Quản trị tối cao
    if (username === 'admin') {
        showToast("Không thể xóa tài khoản Quản trị hệ thống!", "error");
        return;
    }

    // 2. Hiện hộp thoại xác nhận hiện đại
    showConfirm(`Bạn có chắc chắn muốn xóa nhân viên <b>${username}</b>? <br> Hành động này không thể hoàn tác.`, function() {
        
        // 3. Lọc bỏ tài khoản khỏi mảng
        accounts = accounts.filter(acc => acc && acc.username !== username);

        // 4. Lưu lại vào LocalStorage
        localStorage.setItem('kv_accounts', JSON.stringify(accounts));

        // 5. Đồng bộ xóa lên Cloud Firebase
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('accounts', accounts);
        }

        // 6. Cập nhật giao diện
        renderAccountList(); // Vẽ lại danh sách tài khoản chung

        // Nếu đang xem chi tiết một chi nhánh, cập nhật lại bảng nhân viên chi nhánh đó
        if (selectedBranchId) {
            renderBranchStaff(selectedBranchId);
        }

        // Cập nhật lại các ô Grid chi nhánh (để giảm số lượng nhân viên hiển thị)
        renderBranchList();

        showToast(`Đã xóa tài khoản ${username} thành công`, "success");
    }, 'delete'); // Loại 'delete' sẽ hiện icon cảnh báo màu đỏ
};

let userEditing = null;
window.openEditModal = function(username) {
    userEditing = accounts.find(acc => acc && acc.username === username);
    if(!userEditing) return;

    // 1. Nạp danh sách chi nhánh vào dạng Checkbox
    const container = document.getElementById('edit-branch-list-container');
    const currentBranches = JSON.parse(localStorage.getItem('kv_branches')) || [];
    
    // Lấy mảng chi nhánh hiện tại của User
    let userBranches = userEditing.branchIds || (userEditing.branchId ? [userEditing.branchId] : []);
    
    let html = '';
    currentBranches.forEach(br => {
        const isChecked = userBranches.includes(br.id) ? 'checked' : '';
        // [ĐÃ SỬA LỖI UI]: Thêm display:flex cho label và ép width/margin cho input
        html += `<label style="display: flex; align-items: center; margin-bottom: 8px; cursor: pointer; font-size: 14px; color: #333;">
                    <input type="checkbox" class="edit-branch-cb" value="${br.id}" ${isChecked} style="width: 16px; height: 16px; margin: 0; margin-right: 10px; padding: 0;"> 
                    ${br.name}
                 </label>`;
    });
    container.innerHTML = html;

    // 2. Đổ dữ liệu vào các ô Text
    document.getElementById('edit-username-display').innerText = userEditing.username;
    document.getElementById('edit-fullname').value = userEditing.fullname;
    document.getElementById('edit-password').value = userEditing.password;
    document.getElementById('edit-role').value = userEditing.role;
    
    document.getElementById('edit-account-modal').style.display = 'flex';
};

function closeEditModal() {
    document.getElementById('edit-account-modal').style.display = 'none';
    userEditing = null;
}

window.saveEditAccount = function() {
    if (!userEditing) return;

    // 1. Lấy dữ liệu mới từ các ô nhập liệu trong Modal
    const fn = document.getElementById('edit-fullname').value.trim();
    const pw = document.getElementById('edit-password').value.trim();
    const ro = document.getElementById('edit-role').value;
    
    // Lấy danh sách các chi nhánh được tích chọn
    const branchCbs = document.querySelectorAll('.edit-branch-cb:checked');
    const selectedBranches = Array.from(branchCbs).map(cb => cb.value);

    // 2. Kiểm tra tính hợp lệ
    if (!fn || !pw) {
        showToast("Họ tên và mật khẩu không được để trống!", "warning");
        return;
    }
    
    if (selectedBranches.length === 0) {
        showToast("Vui lòng chọn ít nhất 1 chi nhánh công tác!", "warning");
        return;
    }

    // 3. Tìm và cập nhật thông tin trong mảng accounts toàn cục
    const index = accounts.findIndex(acc => acc && acc.username === userEditing.username);
    if (index !== -1) {
        accounts[index].fullname = fn;
        accounts[index].password = pw;
        accounts[index].role = ro;
        accounts[index].branchIds = selectedBranches; // Cập nhật mảng branchIds
        
        // Xóa trường branchId cũ (nếu có) để chuẩn hóa dữ liệu
        if (accounts[index].branchId) {
            delete accounts[index].branchId;
        }
    }

    // 4. Lưu vào bộ nhớ máy (LocalStorage)
    localStorage.setItem('kv_accounts', JSON.stringify(accounts));

    // 5. Đồng bộ lên hệ thống Cloud Firebase
    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('accounts', accounts);
    }

    // 6. Cập nhật lại giao diện ngay lập tức
    closeEditModal();
    renderAccountList(); // Cập nhật tab danh sách tài khoản chung

    // Nếu đang ở trong màn hình chi tiết chi nhánh, vẽ lại bảng nhân viên tại đó
    if (typeof selectedBranchId !== 'undefined' && selectedBranchId) {
        renderBranchStaff(selectedBranchId);
    }
    
    // Vẽ lại Grid chi nhánh để cập nhật số lượng nhân viên hiển thị trên Card
    renderBranchList();

    showToast(`Đã cập nhật thông tin cho tài khoản ${userEditing.username}`, "success");
    userEditing = null;
};

// ==========================================
// 4. QUẢN LÝ TAB DASHBOARD
// ==========================================
/**
 * Hàm điều hướng các tab trong Dashboard và nạp dữ liệu tương ứng
 * @param {string} tabId - ID của tab cần mở (vd: 'tab-hoa-don', 'tab-danh-sach-hang')
 * @param {HTMLElement} navElement - Phần tử menu được click (không bắt buộc)
 */
function openDashTab(tabId, navElement = null) {
    // Lưu trạng thái tab hiện tại
    localStorage.setItem('kv_current_tab', tabId);

    // Xóa class active ở tất cả menu và thêm vào menu được chọn
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (navElement) {
        navElement.classList.add('active');
    }

    // Ẩn tất cả các tab content và hiển thị tab được chọn
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Đọc dữ liệu mới nhất từ bộ nhớ cục bộ
    window.products = JSON.parse(localStorage.getItem('kv_products')) || [];
    window.priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    window.productGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];

    // Phân luồng vẽ giao diện
    switch (tabId) {
        case 'tab-danh-sach-hang': 
            if (typeof window.renderGroupData === 'function') window.renderGroupData();
            if (typeof renderProductList === 'function') renderProductList(); 
            break;
            
        case 'tab-thiet-lap-gia': 
            if (typeof window.renderGroupData === 'function') window.renderGroupData();
            if (typeof renderPriceBookSidebar === 'function') renderPriceBookSidebar(); 
            if (typeof renderPriceSetupTable === 'function') renderPriceSetupTable(); 
            break;
            
        case 'tab-cap-nhat-hang': 
            window.currentUpdatePage = 1;
            window.pendingBatchUpdates = {};
            if (typeof renderBatchUpdateTable === 'function') renderBatchUpdateTable();
            break;

        case 'tab-phat-hien-trung': // TAB MỚI ĐÃ ĐƯỢC THÊM VÀO ĐÂY
            if (typeof window.scanDuplicateProducts === 'function') window.scanDuplicateProducts();
            break;
            
        case 'tab-hoa-don': 
            if (typeof renderInvoices === 'function') renderInvoices(); 
            break;
            
        case 'tab-nhap-hang': 
            if (typeof renderImportOrders === 'function') renderImportOrders(); 
            break;
            
        case 'tab-kiem-kho': 
            if (typeof renderInventoryChecks === 'function') renderInventoryChecks(); 
            break;
            
        case 'tab-tong-quan': 
            if (typeof renderDashboard === 'function') renderDashboard(); 
            break;
    }
}

// ==========================================
// 5. QUẢN LÝ NHÓM HÀNG 
// ==========================================
function initGroups() {
    if (!localStorage.getItem('kv_groups')) {
        localStorage.setItem('kv_groups', JSON.stringify([]));
    }
    renderGroupData();
}
// Thêm vào đầu file script.js
document.addEventListener('keydown', function(e) {
    // Chỉ hoạt động khi đang ở màn hình đăng nhập
    if (document.getElementById('login-view').style.display !== 'none') {
        if (e.ctrlKey && e.shiftKey && e.key === 'Enter') {
            e.preventDefault();
            showAuthModal();
        }
    }
});
// Đảm bảo hàm này luôn được gọi trong initApp hoặc sau khi dán Excel
window.renderGroupData = function() {
    // 1. Vẽ lại cây danh mục ở Sidebar hàng hóa và Thiết lập giá
    if (typeof window.renderSidebarGroups === 'function') {
        window.renderSidebarGroups();
    }
    // 2. Vẽ lại danh sách chọn (Select) trong Group Modal
    if (typeof window.renderGroupSelects === 'function') {
        window.renderGroupSelects();
    }
    // 3. THÊM DÒNG NÀY: Vẽ lại cây Custom Dropdown trong Modal Thêm/Sửa hàng hóa
    if (typeof window.renderPMGroupTree === 'function') {
        window.renderPMGroupTree();
    }
};
// 1. Hàm đệ quy xây dựng HTML dạng chuỗi lồng nhau (Hỗ trợ đổ dữ liệu vào 2 tab độc lập)
window.renderSidebarGroups = function() {
    const container1 = document.getElementById('sidebar-group-list');
    const container2 = document.getElementById('sidebar-price-group-list');

    // Luôn lấy dữ liệu tươi nhất
    const currentGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];

    function buildTreeHTML(parentId, indent, prefix, cbClass) {
        // Chuẩn hóa parentId để không bị dính lỗi undefined của Firebase
        const targetParent = parentId || "";
        const children = currentGroups.filter(g => (g.parentId || "") === targetParent);
        let html = '';
        
        children.forEach(child => {
            const childId = child.id || "";
            const hasChildren = currentGroups.some(g => (g.parentId || "") === childId);
            const toggleIcon = hasChildren 
                ? `<i class="fa-solid fa-chevron-right ${prefix}-toggle-icon" onclick="toggleGroupChildrenGeneric('${prefix}-children-${child.id}', this)" style="cursor: pointer; width: 15px; text-align: center; color: #888; transition: 0.2s;"></i>` 
                : `<span style="width: 15px; display: inline-block;"></span>`;

            html += `
            <div class="${prefix}-tree-item" data-name="${(child.name || '').toLowerCase()}" style="display:flex; justify-content:space-between; align-items:center; padding: 6px 8px; padding-left: ${indent + 8}px; border-bottom: 1px dashed #eee; transition: 0.2s;">
                <div style="display: flex; align-items: center; gap: 5px; flex: 1;">
                    ${toggleIcon}
                    <label style="display:flex; gap: 8px; align-items:center; cursor:pointer; margin:0; font-size: 13px; color: #333;">
                        <input type="checkbox" class="${cbClass}" value="${child.id}"> ${child.name}
                    </label>
                </div>
                <div style="display:flex; gap: 10px;">
                    <i class="fa-solid fa-pen" style="color: #888; font-size: 11px; cursor:pointer;" onclick="openGroupModal('${child.id}')" title="Sửa"></i>
                    <i class="fa-solid fa-trash" style="color: #d9534f; font-size: 11px; cursor:pointer;" onclick="deleteGroup('${child.id}')" title="Xóa"></i>
                </div>
            </div>`;

            if (hasChildren) {
                html += `<div id="${prefix}-children-${child.id}" class="${prefix}-children-container" style="display: none;">`;
                html += buildTreeHTML(child.id, indent + 15, prefix, cbClass);
                html += `</div>`;
            }
        });
        return html;
    }
    
    // Khởi chạy với chuỗi rỗng thay vì null
    if (container1) container1.innerHTML = buildTreeHTML("", 0, 'group', 'group-filter-cb');
    if (container2) container2.innerHTML = buildTreeHTML("", 0, 'price-group', 'price-group-filter-cb');
};

// Hàm xử lý Mở/Đóng mũi tên dùng chung
window.toggleGroupChildrenGeneric = function(containerId, iconEl) {
    const childrenContainer = document.getElementById(containerId);
    if (childrenContainer) {
        if (childrenContainer.style.display === 'none') {
            childrenContainer.style.display = 'block';
            iconEl.classList.remove('fa-chevron-right');
            iconEl.classList.add('fa-chevron-down');
        } else {
            childrenContainer.style.display = 'none';
            iconEl.classList.remove('fa-chevron-down');
            iconEl.classList.add('fa-chevron-right');
        }
    }
};

// Giữ lại hàm cũ để tránh lỗi các nút đã tạo
window.toggleGroupChildren = function(groupId, iconEl) {
    window.toggleGroupChildrenGeneric(`group-children-${groupId}`, iconEl);
};

function renderGroupSelects() {
    const pmGroup = document.getElementById('pm-group'); 
    const parentGroup = document.getElementById('group-parent');
    
    if(!pmGroup && !parentGroup) return;

    // Lấy dữ liệu mới nhất từ bộ nhớ
    const currentGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
    let html = '<option value="">Chọn nhóm hàng</option>';

    function renderSelectTree(parentId, prefix) {
        // Chuẩn hóa parentId
        const targetParent = parentId || "";
        const children = currentGroups.filter(g => (g.parentId || "") === targetParent);
        children.forEach(child => {
            html += `<option value="${child.id}">${prefix}${child.name}</option>`;
            renderSelectTree(child.id, prefix + '--- '); 
        });
    }
    
    // Gọi hàm với chuỗi rỗng
    renderSelectTree("", '');

    if (pmGroup) pmGroup.innerHTML = html;
    if (parentGroup) parentGroup.innerHTML = html;
}

window.openGroupModal = function(id = null) {
    editingGroupId = id;
    document.getElementById('group-modal').style.display = 'flex';
    
    // Nạp lại danh sách cho các dropdown khác
    if (typeof renderGroupSelects === 'function') renderGroupSelects();

    const currentGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
    let invalidParents = [];

    if(id) {
        document.getElementById('group-modal-title').innerText = 'Sửa nhóm hàng';
        const g = currentGroups.find(x => x.id === id);
        if(!g) return;
        
        document.getElementById('group-name').value = g.name || "";
        
        // Tìm tất cả nhóm con/cháu để chặn không cho chọn làm cha
        function getDescendants(parentId) {
            let desc = [];
            const targetParent = parentId || "";
            const children = currentGroups.filter(gr => (gr.parentId || "") === targetParent);
            children.forEach(c => {
                desc.push(c.id);
                desc = desc.concat(getDescendants(c.id));
            });
            return desc;
        }
        
        invalidParents = [id, ...getDescendants(id)];
        
        // Vẽ danh sách có làm mờ nhánh con để không cho bấm nhầm
        if (typeof window.renderParentGroupTree === 'function') {
            window.renderParentGroupTree(invalidParents);
        }

        // Gán dữ liệu hiển thị tên nhóm hiện tại lên UI
        const parentObj = currentGroups.find(x => x.id === g.parentId);
        if (parentObj) {
            if (typeof window.selectParentGroup === 'function') window.selectParentGroup(parentObj.id, parentObj.name);
        } else {
            if (typeof window.selectParentGroup === 'function') window.selectParentGroup('', 'Chọn nhóm cha (để trống nếu là gốc)...');
        }

    } else {
        document.getElementById('group-modal-title').innerText = 'Tạo nhóm hàng';
        document.getElementById('group-name').value = '';
        
        // Vẽ danh sách trắng và reset UI
        if (typeof window.renderParentGroupTree === 'function') window.renderParentGroupTree([]);
        if (typeof window.selectParentGroup === 'function') window.selectParentGroup('', 'Chọn nhóm cha (để trống nếu là gốc)...');
    }
};

function closeGroupModal() {
    document.getElementById('group-modal').style.display = 'none';
}

function saveGroup() {
    const name = document.getElementById('group-name').value.trim();
    const parentId = document.getElementById('group-parent').value;
    
    if(!name) { showToast("Vui lòng nhập tên nhóm!", "warning"); return; }

    // Đọc dữ liệu TƯƠI từ bộ nhớ để tránh ghi đè dữ liệu cũ
    let currentGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];

    if(editingGroupId) {
        const index = currentGroups.findIndex(x => x.id === editingGroupId);
        if (index !== -1) {
            currentGroups[index].name = name;
            currentGroups[index].parentId = parentId || ""; // Đổi null thành chuỗi rỗng ""
        }
    } else {
        currentGroups.push({
            id: 'g_' + Date.now(),
            name: name,
            parentId: parentId || "" // Firebase ghét null, đổi thành chuỗi rỗng ""
        });
    }

    // Cập nhật lại localStorage và biến Global
    localStorage.setItem('kv_groups', JSON.stringify(currentGroups));
    window.productGroups = currentGroups; 
    if (typeof productGroups !== 'undefined') productGroups = currentGroups;

    // Đẩy lên Firebase Cloud
    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('groups', currentGroups);
    }

    closeGroupModal();
    if (typeof renderGroupData === 'function') renderGroupData(); 
    if (typeof renderProductList === 'function') renderProductList(); 
    editingGroupId = null;
    
    showToast("Đã lưu nhóm hàng thành công!", "success");
}

function deleteGroup(id) {
    let currentGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
    
    // 1. Kiểm tra xem nhóm này có nhóm con nào không
    const hasChildren = currentGroups.some(g => (g.parentId || "") === id);
    
    // 2. Tùy chỉnh câu thông báo xác nhận
    let confirmMsg = "Bạn có chắc chắn muốn xóa nhóm hàng này?";
    if (hasChildren) {
        confirmMsg = "Nhóm này đang chứa các nhóm con. Bạn có chắc chắn muốn xóa nhóm này VÀ TOÀN BỘ các nhóm con của nó không?";
    }
    
    // 3. Hiển thị hộp thoại xác nhận (Có / Bỏ qua)
    showConfirm(confirmMsg, function() {
        
        // Hàm đệ quy: Tìm ID của nhóm hiện tại và TẤT CẢ nhóm con, cháu của nó
        function getAllDescendantIds(targetId) {
            let ids = [targetId];
            const children = currentGroups.filter(g => (g.parentId || "") === targetId);
            children.forEach(c => {
                ids = ids.concat(getAllDescendantIds(c.id));
            });
            return ids;
        }
        
        // Lấy danh sách toàn bộ ID nhóm cần xóa
        const idsToDelete = getAllDescendantIds(id);
        
        // 4. XÓA NHÓM: Giữ lại những nhóm KHÔNG nằm trong danh sách cần xóa
        currentGroups = currentGroups.filter(g => !idsToDelete.includes(g.id));
        
        // 5. CẬP NHẬT HÀNG HÓA: Gỡ bỏ ID nhóm đối với các mặt hàng thuộc nhóm vừa bị xóa
        let currentProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        currentProducts.forEach(p => { 
            if(idsToDelete.includes(p.group)) {
                p.group = ''; 
            } 
        });
        
        // 6. Lưu dữ liệu vào máy
        localStorage.setItem('kv_products', JSON.stringify(currentProducts));
        localStorage.setItem('kv_groups', JSON.stringify(currentGroups));
        
        window.productGroups = currentGroups;
        if (typeof productGroups !== 'undefined') productGroups = currentGroups;
        window.products = currentProducts;

        // 7. Đồng bộ lên Firebase Cloud
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', currentProducts);
            window.uploadToCloud('groups', currentGroups);
        }
        
        // 8. Tải lại giao diện
        if (typeof renderGroupData === 'function') renderGroupData(); 
        if (typeof renderProductList === 'function') renderProductList();
        
        showToast("Đã xóa nhóm hàng thành công!", "success");
    });
}

// ==========================================
// 6. QUẢN LÝ HÀNG HÓA
// ==========================================

function openAddProductModal() {
    editingProductId = null; 
    currentProductUnits = []; 
    tempPriceBookValues = {};
    
    // THÊM DÒNG NÀY ĐỂ FIX LỖI: Ép hệ thống nạp lại danh sách nhóm hàng mới nhất
    if (typeof renderGroupSelects === 'function') renderGroupSelects(); 
    
    // Lấy nội dung đang gõ dở ở thanh tìm kiếm (nếu có) để làm mã vạch/mã hàng
    const searchVal = document.getElementById('pos-search-input')?.value || "";
    
    document.querySelector('.product-modal-header h3').innerText = 'Thêm hàng hóa nhanh';
    
    // Reset form
    document.querySelectorAll('.product-modal-body input').forEach(input => {
        if(input.type === 'number') input.value = 0;
        else if(input.type === 'text') input.value = '';
    });
    
    // Nếu thanh tìm kiếm có số (thường là quét mã vạch), điền nó vào ô mã vạch luôn
    if (searchVal.length > 4) {
        document.getElementById('pm-barcode').value = searchVal;
    }

    document.getElementById('pm-group').value = '';
    document.getElementById('pm-is-combo').checked = false;
 // Thêm 3 dòng này để xóa giao diện tên nhóm hiển thị về mặc định
const pmGroupDisplay = document.getElementById('pm-group-display');
if (pmGroupDisplay) {
    pmGroupDisplay.innerText = 'Chọn nhóm hàng...';
    pmGroupDisplay.style.color = '#555';
    pmGroupDisplay.style.fontWeight = 'normal';
}
    
    const modalProduct = document.getElementById('add-product-modal');
    if (modalProduct) {
        modalProduct.style.display = 'flex';
        modalProduct.style.zIndex = '99999'; // Đẩy modal lên lớp trên cùng để không bị màn hình Nhập hàng che khuất
    }
    
    // Tự động focus vào ô Tên hàng để gõ ngay
    setTimeout(() => document.getElementById('pm-name').focus(), 100);
}

function closeAddProductModal() {
    const modalProduct = document.getElementById('add-product-modal');
    if (modalProduct) {
        modalProduct.style.display = 'none';
        modalProduct.style.zIndex = ''; // Reset lại z-index mặc định khi đóng
    }
}

// =================================================================
// CẬP NHẬT: Đưa hàm mở modal sửa hàng hóa lên phạm vi toàn cục và sửa lỗi che khuất
// =================================================================
window.openEditProductModal = function(id, ioItemIndex = null) {
    // 1. Gán ID đang chỉnh sửa vào biến toàn cục
    editingProductId = id;

    // Đọc dữ liệu tươi nhất trực tiếp từ bộ nhớ máy (LocalStorage)
    const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];

    // 2. Tìm sản phẩm trong danh sách dựa trên mảng dữ liệu mới
    const p = latestProducts.find(x => x.id === id);
    if (!p) {
        showToast("Không tìm thấy dữ liệu hàng hóa!", "error");
        return;
    }

    // 3. Khôi phục các mảng dữ liệu phụ (đơn vị tính, biến thể)
    currentProductUnits = p.units || [];
    currentVariants = p.variants || [];

// 4. Dọn sạch bộ nhớ tạm. Chỉ khi nào người dùng tự tay gõ giá mới thì mới lưu.
    tempPriceBookValues = {};

    // Nạp lại danh sách nhóm trước khi gắn dữ liệu hiện tại
    if (typeof renderGroupSelects === 'function') renderGroupSelects();

    // 5. Cập nhật giao diện Modal
    document.querySelector('.product-modal-header h3').innerText = 'Sửa hàng hóa';
    
    document.getElementById('pm-code').value = p.code || '';
    document.getElementById('pm-barcode').value = p.barcode || '';
    document.getElementById('pm-name').value = p.name || '';
    document.getElementById('pm-group').value = p.group || '';
    
    const pmGroupDisplay = document.getElementById('pm-group-display');
    if (pmGroupDisplay) {
        if (p.group) {
            const allGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
            const g = allGroups.find(x => x.id === p.group);
            if (g) {
                pmGroupDisplay.innerText = g.name;
                pmGroupDisplay.style.color = 'var(--kv-blue)';
                pmGroupDisplay.style.fontWeight = 'bold';
            } else {
                pmGroupDisplay.innerText = 'Chọn nhóm hàng...';
                pmGroupDisplay.style.color = '#555';
                pmGroupDisplay.style.fontWeight = 'normal';
            }
        } else {
            pmGroupDisplay.innerText = 'Chọn nhóm hàng...';
            pmGroupDisplay.style.color = '#555';
            pmGroupDisplay.style.fontWeight = 'normal';
        }
    }

    document.getElementById('pm-stock').value = p.stock || 0;
    document.getElementById('pm-is-combo').checked = p.isCombo || false;
    // ==========================================
    // TÍNH TOÁN GIÁ VỐN ƯU TIÊN LẤY TỪ PHIẾU NHẬP
    // ==========================================
    let finalCost = p.cost || 0;
    // Nếu được gọi từ màn hình phiếu nhập, ưu tiên lấy giá đang chỉnh sửa trên lưới
    if (ioItemIndex !== null && typeof currentIOItems !== 'undefined' && currentIOItems[ioItemIndex]) {
        const ioItem = currentIOItems[ioItemIndex];
        const rate = ioItem.units && ioItem.units[ioItem.selectedUnitIdx] ? (ioItem.units[ioItem.selectedUnitIdx].rate || 1) : 1;
        finalCost = (ioItem.cost || 0) / rate; // Trả về giá vốn của đơn vị cơ bản
    }
    
    document.getElementById('pm-cost').value = finalCost.toLocaleString('vi-VN');
    
    const displayPrice = (p.units && p.units.length > 0) ? p.units[0].price : p.price;
    document.getElementById('pm-price').value = (displayPrice || 0).toLocaleString('vi-VN');

    // 6. HIỂN THỊ MODAL & ÉP Z-INDEX CAO NHẤT ĐỂ ĐÈ LÊN MÀN HÌNH NHẬP HÀNG
    const modalProduct = document.getElementById('add-product-modal');
    if (modalProduct) {
        modalProduct.style.display = 'flex';
        modalProduct.style.zIndex = '99999';
    }
    
    // Tự động focus và bôi đen ô tên hàng để tiện chỉnh sửa
    setTimeout(() => {
        const nameInput = document.getElementById('pm-name');
        if (nameInput) {
            nameInput.focus();
            nameInput.select();
        }
    }, 100);
};
window.editProduct = function(id) {
    const p = products.find(x => x.id == id);
    if (!p) return;

    editingProductId = id;
    
    // Đổ dữ liệu vào đúng ID đã sửa ở Bước 1
    document.getElementById('edit-product-name').value = p.name || '';
    document.getElementById('edit-product-code').value = p.code || '';
    document.getElementById('edit-product-price').value = p.price || 0;
    document.getElementById('edit-product-cost').value = p.cost || 0;
    document.getElementById('edit-product-stock').value = p.stock || 0;
    document.getElementById('edit-product-group').value = p.groupId || '';

    openModal('product-modal');
};
window.saveProduct = function() {
    const nameEl = document.getElementById('pm-name');
    const priceEl = document.getElementById('pm-price');
    const costEl = document.getElementById('pm-cost');
    const stockEl = document.getElementById('pm-stock');
    const codeEl = document.getElementById('pm-code');
    const barcodeEl = document.getElementById('pm-barcode');
    const isComboEl = document.getElementById('pm-is-combo'); // Lấy checkbox Combo

    const parseNum = (val) => window.parseCurrency(val);

    const name = nameEl.value.trim();
    const price = parseNum(priceEl.value);
    const cost = parseNum(costEl.value);
    const stock = parseFloat(stockEl.value) || 0;
    const code = codeEl.value.trim();
    const barcode = barcodeEl ? barcodeEl.value.trim() : '';
    const isCombo = isComboEl ? isComboEl.checked : false; // Kiểm tra cờ Combo

    if (!name) { showToast("Vui lòng nhập tên hàng hóa!", "error"); return; }

    // ==========================================
    // KIỂM TRA TRÙNG MÃ HÀNG
    // ==========================================
    let allProductsCheck = JSON.parse(localStorage.getItem('kv_products')) || [];
    let currentBranchCheck = localStorage.getItem('kv_current_branch') || 'CN001';

    let isDuplicateCode = false;
    if (code !== '') {
        isDuplicateCode = allProductsCheck.some(p => {
            if ((p.branchId || 'CN001') !== currentBranchCheck) return false;
            if (editingProductId && p.id === editingProductId) return false;
            if (p.code && p.code.toLowerCase() === code.toLowerCase()) return true;
            if (p.units && p.units.length > 0) {
                return p.units.some(u => u.code && u.code.toLowerCase() === code.toLowerCase());
            }
            return false;
        });
    }

    if (isDuplicateCode) {
        showToast("Mã hàng này đã tồn tại! Vui lòng nhập mã khác.", "error");
        document.getElementById('pm-code').focus();
        return; 
    }

    window.isSyncLocked = true;
    let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    let allPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    let productIdToSave = editingProductId;
    let isPriceBookChanged = false;

    if (editingProductId) {
        // --- SỬA HÀNG HÓA CÓ SẴN ---
        const idx = allProducts.findIndex(p => p.id === editingProductId);
        if (idx !== -1) {
            // 1. Lấy danh sách đơn vị tính cũ để so sánh trước khi ghi đè
            const oldUnits = JSON.parse(JSON.stringify(allProducts[idx].units || []));
            const oldBasePrice = allProducts[idx].price || 0; // Dự phòng cho dữ liệu cũ

            // 2. Cập nhật thông tin cơ bản
            allProducts[idx].name = name;
            allProducts[idx].price = price;
            allProducts[idx].cost = cost;
            allProducts[idx].stock = stock;
            allProducts[idx].group = document.getElementById('pm-group').value;
            allProducts[idx].code = code;
            allProducts[idx].barcode = barcode;
            allProducts[idx].isCombo = isCombo;

            // 3. Xử lý ghi nhận mảng đơn vị tính mới
            if (currentProductUnits && currentProductUnits.length > 0) {
                currentProductUnits[0].price = price;
                currentProductUnits[0].code = code;
                currentProductUnits[0].barcode = barcode;
                allProducts[idx].units = currentProductUnits;
            } else if (allProducts[idx].units && allProducts[idx].units.length > 0) {
                allProducts[idx].units[0].price = price;
                allProducts[idx].units[0].code = code;
                allProducts[idx].units[0].barcode = barcode;
            } else {
                allProducts[idx].units = [{ name: 'Cái', rate: 1, price: price, code: code, barcode: barcode, isBase: true }];
            }

            // 4. LOGIC MỚI: Tính chênh lệch giá cho TẤT CẢ các đơn vị tính
            const newUnits = allProducts[idx].units;
            newUnits.forEach((newUnit, uIdx) => {
                let oldUnitPrice = 0;
                
                // Xác định giá cũ của đơn vị tính này
                if (oldUnits[uIdx] !== undefined) {
                    oldUnitPrice = oldUnits[uIdx].price || 0;
                } else if (uIdx === 0 && oldUnits.length === 0) {
                    oldUnitPrice = oldBasePrice; 
                } else {
                    return; // Nếu đây là đơn vị mới thêm vào, bỏ qua việc tính chênh lệch cũ
                }

                const priceDiff = newUnit.price - oldUnitPrice;

                // Tự động cộng/trừ chênh lệch vào các bảng giá phụ
                if (priceDiff !== 0) {
                    allPriceBooks.forEach(pb => {
                        if (pb.prices) {
                            // Cập nhật cho key chính xác (Ví dụ: SP01_0, SP01_1)
                            const exactKey = `${editingProductId}_${uIdx}`;
                            if (pb.prices[exactKey] !== undefined) {
                                pb.prices[exactKey] += priceDiff;
                                if (pb.prices[exactKey] < 0) pb.prices[exactKey] = 0; // Không cho âm
                                isPriceBookChanged = true;
                            }
                            
                            // Hỗ trợ tương thích ngược: Cập nhật cho key không có hậu tố (Ví dụ: SP01)
                            if (uIdx === 0 && pb.prices[editingProductId] !== undefined) {
                                pb.prices[editingProductId] += priceDiff;
                                if (pb.prices[editingProductId] < 0) pb.prices[editingProductId] = 0;
                                isPriceBookChanged = true;
                            }
                        }
                    });
                }
            });
        }
    } else {
        // --- THÊM HÀNG HÓA MỚI ---
        let newUnits = (currentProductUnits && currentProductUnits.length > 0)
            ? currentProductUnits
            : [{ name: 'Cái', rate: 1, price: price, code: code, barcode: barcode, isBase: true }];

        newUnits[0].price = price;
        newUnits[0].code = code;
        newUnits[0].barcode = barcode;

        productIdToSave = 'PROD' + Date.now();
        const newProd = {
            id: productIdToSave,
            name, price, cost, stock,
            code: code || ('HH' + Date.now()),
            barcode: barcode,
            group: document.getElementById('pm-group').value, // Đã fix: Bắt nhóm ngay khi thêm mới
            branchId: localStorage.getItem('kv_current_branch') || 'CN001',
            units: newUnits,
            isCombo: isCombo // Ghi nhận cờ Combo khi thêm mới
        };
        allProducts.unshift(newProd);
    }

    // ==========================================
    // TÍNH TOÁN "THIẾT LẬP GIÁ NHANH" CHO TỪNG ĐƠN VỊ TÍNH
    // ==========================================
    if (Object.keys(tempPriceBookValues).length > 0) {
        Object.keys(tempPriceBookValues).forEach(tempKey => {
            const parts = tempKey.split('___');
            
            if (parts.length === 2) {
                const pbId = parts[0];
                const unitIdx = parts[1];
                const priceVal = tempPriceBookValues[tempKey];
                
                let pb = allPriceBooks.find(x => x.id === pbId);
                if (pb) {
                    if (!pb.prices) pb.prices = {};
                    pb.prices[`${productIdToSave}_${unitIdx}`] = priceVal;
                    if (parseInt(unitIdx) === 0) {
                        pb.prices[productIdToSave] = priceVal;
                    }
                    isPriceBookChanged = true;
                }
            } else {
                const pbId = tempKey;
                let pb = allPriceBooks.find(x => x.id === pbId);
                if (pb) {
                    if (!pb.prices) pb.prices = {};
                    pb.prices[`${productIdToSave}_0`] = tempPriceBookValues[tempKey];
                    pb.prices[productIdToSave] = tempPriceBookValues[tempKey];
                    isPriceBookChanged = true;
                }
            }
        });
    }

    localStorage.setItem('kv_products', JSON.stringify(allProducts));
    window.products = allProducts;
    if (typeof products !== 'undefined') products = allProducts;

    if (isPriceBookChanged) {
        localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
        window.priceBooks = allPriceBooks;
    }

    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('products', allProducts);
        if (isPriceBookChanged) window.uploadToCloud('pricebooks', allPriceBooks);
    }

    if (typeof currentIOItems !== 'undefined' && currentIOItems.length > 0) {
        currentIOItems.forEach(item => {
            if (String(item.productId) === String(productIdToSave)) {
                item.name = name;
                const rate = item.units && item.units[item.selectedUnitIdx] ? item.units[item.selectedUnitIdx].rate : 1;
                item.baseCost = cost;
                item.cost = cost * rate;
            }
        });
        if (typeof renderIOItemsTable === 'function') renderIOItemsTable();
    }

    // Cập nhật giao diện chung
    if (typeof renderProductList === 'function') renderProductList();
    if (typeof renderPriceSetupTable === 'function') renderPriceSetupTable();
    if (typeof renderPOS === 'function') renderPOS();

    showToast("Đã cập nhật dữ liệu thành công!", "success");

    // ==========================================
    // LOGIC THÊM LIÊN TỤC 
    // ==========================================
    const continueAddCb = document.getElementById('pm-continue-add');
    const isContinueAdd = continueAddCb && continueAddCb.checked;

    if (isContinueAdd && !editingProductId) {
        // Dọn dẹp Text
        document.getElementById('pm-code').value = '';
        document.getElementById('pm-barcode').value = '';
        document.getElementById('pm-name').value = '';
        document.getElementById('pm-cost').value = '0';
        document.getElementById('pm-price').value = '0';
        document.getElementById('pm-stock').value = '0';
        
        // Dọn dẹp Checkbox Combo
        if(isComboEl) isComboEl.checked = false;
        
        // Dọn dẹp Dropdown Nhóm hàng
        document.getElementById('pm-group').value = '';
        const pmGroupDisplay = document.getElementById('pm-group-display');
        if (pmGroupDisplay) {
            pmGroupDisplay.innerText = 'Chọn nhóm hàng...';
            pmGroupDisplay.style.color = '#555';
            pmGroupDisplay.style.fontWeight = 'normal';
        }
        
        // Dọn dẹp Đơn vị tính
        currentProductUnits = [];
        tempPriceBookValues = {};

        if (typeof renderUnitAttrUI === 'function') renderUnitAttrUI();

        setTimeout(() => { document.getElementById('pm-name').focus(); }, 100);
    } else {
        if (typeof closeAddProductModal === 'function') closeAddProductModal();
    }

    setTimeout(() => { window.isSyncLocked = false; }, 3000);
};
function toggleProductDetail(id) {
    const row = document.getElementById(`detail-row-${id}`);
    document.querySelectorAll('tr[id^="detail-row-"]').forEach(el => {
        if (el.id !== `detail-row-${id}`) el.style.display = 'none';
    });
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}
window.renderPOS = function(productsToRender) {
    const container = document.querySelector('.pos-products-grid');
    if (!container) return;

    // Nếu không truyền vào danh sách, tự lấy danh sách đã lọc hoặc danh sách gốc
    const list = productsToRender || window.currentFilteredProducts || window.products || [];
    
    container.innerHTML = '';
    
    if (list.length === 0) {
        container.innerHTML = '<div class="no-data">Không có hàng hóa nào</div>';
        return;
    }

    list.forEach(product => {
        const div = document.createElement('div');
        div.className = 'pos-product-item';
        // Đảm bảo định dạng tiền hiển thị đúng giá mới nhất
        const displayPrice = window.formatCurrency ? window.formatCurrency(product.price) : product.price.toLocaleString('vi-VN');
        
        div.innerHTML = `
            <div class="pos-product-info" onclick="addToCart('${product.id}')">
                <div class="pos-product-name">${product.name}</div>
                <div class="pos-product-price">${displayPrice}</div>
            </div>
        `;
        container.appendChild(div);
    });
};
// 1. Khai báo biến toàn cục để lưu trạng thái trang (Đặt ở ngoài cùng, gần các biến let khác)
window.currentProductPage = 1;
const productsPerPage = 100; // Số lượng hiển thị tối đa trên 1 trang

window.renderProductPage = 1;

window.renderProductList = function() {
    const tbody = document.getElementById('import-table-body'); 
    if (!tbody) return;
    
    // 1. Lấy dữ liệu và xác định chi nhánh hiện tại
    const savedProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    const savedGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
    const currentBranch = localStorage.getItem('kv_current_branch');
    
    tbody.innerHTML = '';

    // 2. Lấy các thông số lọc từ giao diện
    const keyword = (document.getElementById('search-product-manage')?.value || '').toLowerCase().trim();
    const checkedGroupCbs = document.querySelectorAll('.group-filter-cb:checked');
    const selectedGroupIds = Array.from(checkedGroupCbs).map(cb => cb.value);
    const stockVal = document.getElementById('stock-filter')?.value || 'all';

    // 3. TIẾN HÀNH LỌC DỮ LIỆU (QUAN TRỌNG: Lọc theo Chi nhánh trước)[cite: 1, 2]
    const filteredBase = savedProducts.filter(p => {
        // BƯỚC LỌC CHI NHÁNH: Nếu hàng không có branchId hoặc branchId không khớp thì loại bỏ
        if (p.branchId !== currentBranch) return false;

// [MỚI] Lọc theo từ khóa thông minh (Cắt từng chữ khoảng trắng giống POS)
        const cleanKw = window.removeVietnameseTones(keyword);
        const searchTerms = cleanKw ? cleanKw.split(/\s+/) : [];
        let matchKw = true;
        
        if (searchTerms.length > 0) {
            let fullSearchStr = (p.name || '') + ' ' + (p.code || '') + ' ' + (p.barcode || '');
            if (p.units && p.units.length > 0) {
                p.units.forEach(u => fullSearchStr += ' ' + (u.name || '') + ' ' + (u.code || '') + ' ' + (u.barcode || ''));
            }
            const cleanData = window.removeVietnameseTones(fullSearchStr.toLowerCase());
            matchKw = searchTerms.every(term => cleanData.includes(term));
        }

        // Lọc theo nhóm hàng
        let matchGroup = true;
        if (selectedGroupIds.length > 0) {
            matchGroup = selectedGroupIds.includes(p.group);
        }

        return matchKw && matchGroup;
    });

    // 4. Bung các đơn vị tính và lọc theo tồn kho
    let flatProducts = [];
    filteredBase.forEach(p => {
        const units = p.units || [{ name: 'Cái', rate: 1, price: p.price }];
        units.forEach((unit, uIdx) => {
            const currentStock = getStockByUnit(p, uIdx);
            
            let matchStock = true;
            if (stockVal === 'below_min') matchStock = (currentStock <= 5);
            else if (stockVal === 'out_of_stock') matchStock = (currentStock <= 0);
            // ... các điều kiện tồn kho khác

if (matchStock) {
                flatProducts.push({
                    ...p,
                    displayUnit: unit,
                    displayStock: currentStock,
                    displayCode: unit.code || p.code,
                    uIdx: uIdx 
                });
            }
        });
    });

// 5. Vẽ dữ liệu ra bảng
    if (flatProducts.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 50px; color: #aaa;">Không có hàng hóa nào thuộc chi nhánh này</td></tr>`;
        return;
    }

    const itemsPerPage = 100;
    const totalPages = Math.ceil(flatProducts.length / itemsPerPage);
    const startIndex = (window.currentProductPage - 1) * itemsPerPage;
    const paginatedItems = flatProducts.slice(startIndex, startIndex + itemsPerPage);

    let htmlContent = ''; // Tạo chuỗi rỗng

    paginatedItems.forEach((item) => {
        const groupObj = savedGroups.find(g => g.id === item.group);
        const groupName = groupObj ? groupObj.name : 'Chưa phân nhóm';

        htmlContent += `
            <tr onclick="openEditProductModal('${item.id}')" style="cursor:pointer;">
                <td style="text-align: center;"><input type="checkbox" class="product-item-check" data-id="${item.id}"></td>
                <td style="color:var(--kv-blue); font-weight:bold;">${item.displayCode}</td>
                <td>${item.barcode || '---'}</td>
                <td>
                    <div style="font-weight: 500;">${item.name} (${item.displayUnit.name})</div>
                    <div style="font-size: 11px; color: #888;">${groupName}</div>
                </td>
                <td style="text-align: right; color: var(--kv-pink); font-weight: bold;">${(item.displayUnit.price || 0).toLocaleString()}</td>
                <td style="text-align: right;">${(item.cost * item.displayUnit.rate || 0).toLocaleString()}</td>
                <td style="text-align: center;">${item.displayStock}</td>
                <td style="text-align: center;">
                    <button onclick="event.stopPropagation(); deleteProductUnit('${item.id}', ${item.uIdx}, '${item.name}', '${item.displayUnit.name}')" style="background: white; border: 1px solid #d9534f; color: #d9534f; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = htmlContent; // Gán 1 lần duy nhất ở cuối

    window.renderPaginationControls('product-pagination', window.currentProductPage, totalPages, 'changeProductPage');
};
// 3. Hàm tạo các nút bấm trang (Dán ngay dưới hàm renderProductList)
function renderPaginationControls(totalPages) {
    const paginationDiv = document.getElementById('product-pagination');
    if (!paginationDiv) return;
    
    // Nếu chỉ có 1 trang thì không hiện nút bấm
    if (totalPages <= 1) {
        paginationDiv.innerHTML = `<span style="font-size: 13px; color: #888;">Hiển thị tất cả ${window.products.length} mặt hàng</span>`;
        return;
    }

    let html = `<span style="font-size: 13px; color: #555; margin-right: 15px;">Đang xem trang <b>${currentProductPage}</b> / ${totalPages}</span>`;
    
    // Nút Trở lại (Previous)
    html += `<button onclick="changeProductPage(${currentProductPage - 1})" ${currentProductPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-action-outline"><i class="fa-solid fa-chevron-left"></i> Trang trước</button>`;
    
    // Nút Tiếp theo (Next)
    html += `<button onclick="changeProductPage(${currentProductPage + 1})" ${currentProductPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-action-outline">Trang sau <i class="fa-solid fa-chevron-right"></i></button>`;
    
    paginationDiv.innerHTML = html;
}

// 4. Hàm xử lý khi click chuyển trang
window.changeProductPage = function(newPage) {
    currentProductPage = newPage;
    renderProductList();
};
// 1. Hàm xử lý khi chọn Dropdown Tồn kho
window.handleStockFilterChange = function() {
    const filterVal = document.getElementById('stock-filter').value;
    const customRange = document.getElementById('custom-stock-range');
    
    // Hiện/ẩn ô nhập Tùy chỉnh
    if (customRange) {
        customRange.style.display = (filterVal === 'custom') ? 'flex' : 'none';
    }
    
    // BẮT BUỘC: Đưa về trang 1 mỗi khi thay đổi bộ lọc để chống lỗi kẹt trang trắng
    window.currentProductPage = 1; 
    
    // Khởi chạy lại bảng
    window.renderProductList();
};

// Đảm bảo 2 ô Tùy chỉnh (Từ - Đến) cũng tự reset trang khi gõ
document.addEventListener('input', function(e) {
    if (e.target.id === 'stock-min' || e.target.id === 'stock-max') {
        window.currentProductPage = 1;
    }
});

function togglePMSection(headerEl) {
    const bodyEl = headerEl.nextElementSibling;
    const icon = headerEl.querySelector('i.fa-solid');
    if (bodyEl.style.display === 'none') {
        bodyEl.style.display = 'block';
        icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up');
    } else {
        bodyEl.style.display = 'none';
        icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down');
    }
}

// ==========================================
// CÁC HÀM XỬ LÝ MODAL THIẾT LẬP GIÁ NHANH (MỚI BỔ SUNG)
// ==========================================
window.openQuickPriceSetup = function(unitIdx = 0) {
    window.currentQuickPriceUnitIdx = unitIdx; // Lưu lại Index của đơn vị đang được thao tác
    
    const tbody = document.getElementById('quick-price-tbody');
    const countLabel = document.getElementById('quick-price-count');
    const titleLabel = document.querySelector('#quick-price-modal h3');
    
    // Đổi tiêu đề Modal để người dùng biết đang chỉnh giá cho đơn vị nào
    let unitName = 'Cơ bản';
    if (typeof currentProductUnits !== 'undefined' && currentProductUnits[unitIdx]) {
        unitName = currentProductUnits[unitIdx].name;
    }
    if (titleLabel) titleLabel.innerText = `Bảng giá cho: ${unitName}`;
    
    // Đọc giá trị mới nhất từ hệ thống
    const latestPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    countLabel.innerText = `Có ${latestPriceBooks.length} bảng giá đang hoạt động`;

    if (latestPriceBooks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 30px; color:#888;">Bạn chưa tạo bảng giá nào. Vui lòng thiết lập ở mục Thiết lập giá.</td></tr>`;
    } else {
        let html = '';
        latestPriceBooks.forEach(pb => {
            let systemVal = '';
            if (editingProductId) {
                // Lấy giá theo đúng Index của đơn vị
                if (pb.prices && pb.prices[`${editingProductId}_${unitIdx}`] !== undefined) {
                    systemVal = pb.prices[`${editingProductId}_${unitIdx}`];
                } else if (unitIdx === 0 && pb.prices && pb.prices[editingProductId] !== undefined) {
                    systemVal = pb.prices[editingProductId];
                }
            }

            // Tạo mã khóa lưu nháp độc nhất: ID_Bảng_Giá + ___ + ID_Đơn_Vị
            const tempKey = `${pb.id}___${unitIdx}`;
            const displayVal = tempPriceBookValues[tempKey] !== undefined ? tempPriceBookValues[tempKey] : '';
            
            const placeholderStr = systemVal !== '' ? Number(systemVal).toLocaleString('vi-VN') : 'Giá tự động';
            const formattedDisplayVal = displayVal !== '' ? Number(displayVal).toLocaleString('vi-VN') : '';
            
            // --- THÊM MỚI: Bắt sự kiện onkeydown để nhảy ô bằng nút Enter ---
            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${pb.name}</td>
                    <td style="padding: 10px; text-align:right;">
                        <input type="text" class="quick-price-input" data-pbid="${pb.id}" value="${formattedDisplayVal}" placeholder="${placeholderStr}" 
                            oninput="window.formatCurrency(this)" 
                            onkeydown="window.moveNextOnEnter(event, this, 'quick-price-input')"
                            style="width: 130px; text-align: right; padding: 6px 10px; border: 1px solid #007bff; border-radius: 4px; outline: none;">
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    document.getElementById('quick-price-modal').style.display = 'flex';

    // --- THÊM MỚI: Tự động trỏ chuột và bôi đen ô đầu tiên ---
    setTimeout(() => {
        const firstInput = document.querySelector('.quick-price-input');
        if (firstInput) {
            firstInput.focus();
            firstInput.select();
        }
    }, 50);
};
function closeQuickPriceSetup() {
    document.getElementById('quick-price-modal').style.display = 'none';
}

window.saveQuickPriceSetup = function() {
    const inputs = document.querySelectorAll('.quick-price-input');
    const unitIdx = window.currentQuickPriceUnitIdx !== undefined ? window.currentQuickPriceUnitIdx : 0;
    
    inputs.forEach(input => {
        const pbId = input.getAttribute('data-pbid');
        const val = input.value;
        const tempKey = `${pbId}___${unitIdx}`; // Nối tên Bảng giá và Vị trí đơn vị tính lại với nhau
        
        if (val !== '') {
            tempPriceBookValues[tempKey] = window.parseCurrency(val);
        } else {
            delete tempPriceBookValues[tempKey];
        }
    });
    
    document.getElementById('quick-price-modal').style.display = 'none';
};

// ==========================================
// 8. QUẢN LÝ THIẾT LẬP GIÁ ĐA CỘT
// ==========================================
/**
 * Hàm vẽ danh sách các bảng giá đang được chọn xem (Sidebar bên trái)
 * Hỗ trợ các tính năng: Ẩn cột, Đổi tên và Xóa bảng giá
 */
window.renderPriceBookSidebar = function() {
    const tagContainer = document.getElementById('active-pricebook-tags');
    const select = document.getElementById('add-pricebook-select');
    
    if(!tagContainer || !select) return;

    // 1. Luôn lấy dữ liệu mới nhất từ bộ nhớ để tránh lỗi đồng bộ
    window.priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    
    tagContainer.innerHTML = '';

    // 2. Vẽ các thẻ (tags) cho những bảng giá đang được chọn xem
    activePriceBookIds.forEach(id => {
        if (id === 'default') {
            // Thẻ mặc định cho Bảng giá chung (Không cho xóa/sửa tên)
            tagContainer.innerHTML += `<div class="pb-tag">BẢNG GIÁ CHUNG</div>`;
        } else {
            // Tìm thông tin chi tiết của bảng giá từ mảng dữ liệu
            const pb = window.priceBooks.find(pb => pb && pb.id === id);
            
            // Chỉ hiển thị nếu bảng giá tồn tại và có tên (Tránh lỗi undefined)
            if (pb && pb.name) {
                tagContainer.innerHTML += `
                    <div class="pb-tag" style="display: inline-flex; align-items: center; gap: 8px;">
                        <span onclick="editPriceBookName('${id}')" title="Bấm để Đổi tên hoặc Xóa" style="cursor:pointer; display: flex; align-items: center;">
                            <i class="fa-solid fa-pen-to-square" style="font-size: 10px; margin-right: 6px; opacity: 0.8;"></i>
                            ${pb.name.toUpperCase()}
                        </span>
                        <i class="fa-solid fa-xmark" onclick="removePriceBookFromView('${id}')" title="Ẩn cột này khỏi bảng" style="cursor: pointer; padding-left: 5px; border-left: 1px solid rgba(255,255,255,0.3);"></i>
                    </div>`;
            }
        }
    });

    // 3. Cập nhật danh sách thả xuống (Dropdown) để thêm bảng giá vào góc nhìn
    let optionsHtml = '<option value="">Thêm bảng giá vào góc nhìn...</option>';
    window.priceBooks.forEach(pb => {
        // Chỉ hiện những bảng giá hợp lệ và chưa có trong danh sách đang xem
        if (pb && pb.id && pb.name && !activePriceBookIds.includes(pb.id)) {
            optionsHtml += `<option value="${pb.id}">${pb.name}</option>`;
        }
    });
    
    select.innerHTML = optionsHtml;
    select.value = ''; // Reset trạng thái chọn về mặc định
};
function addPriceBookToView(id) {
    if (!id) return;
    if (!activePriceBookIds.includes(id)) {
        activePriceBookIds.push(id);
    }
    renderPriceBookSidebar();
    renderPriceSetupTable();
}

function removePriceBookFromView(id) {
    activePriceBookIds = activePriceBookIds.filter(x => x !== id);
    renderPriceBookSidebar();
    renderPriceSetupTable();
}

function openPriceBookModal() {
    document.getElementById('pricebook-name').value = '';
    document.getElementById('pricebook-modal').style.display = 'flex';
}
function closePriceBookModal() {
    document.getElementById('pricebook-modal').style.display = 'none';
}

window.savePriceBook = function() {
    const nameInput = document.getElementById('pricebook-name');
    const name = nameInput ? nameInput.value.trim() : "";

    if (!name) { 
        alert("Vui lòng nhập tên bảng giá!"); 
        return; 
    }

    // Kiểm tra trùng tên
    const isExist = window.priceBooks.some(pb => pb.name.toLowerCase() === name.toLowerCase());
    if (isExist) {
        alert("Tên bảng giá này đã tồn tại!");
        return;
    }

    const newPb = {
        id: 'pb_' + Date.now(),
        name: name,
        prices: {}
    };

    window.priceBooks.push(newPb);
    activePriceBookIds.push(newPb.id); // Tự động hiển thị cột mới tạo
    
    saveAndSyncPriceBooks();
    
    closePriceBookModal();
    if (nameInput) nameInput.value = '';
    alert(`Đã tạo bảng giá "${name}" thành công!`);
};

window.currentPricePage = 1;

window.renderPriceSetupTable = function() {
    const thead = document.querySelector('#price-setup-table thead');
    const tbody = document.querySelector('#price-setup-table tbody');
    if (!thead || !tbody) return;

    window.priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    window.products = JSON.parse(localStorage.getItem('kv_products')) || [];
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';

// 1. Tạo Header động
    let thHtml = `
        <tr>
            <th style="text-align: center; width: 60px;">STT</th>
            <th style="text-align: left; min-width: 120px;">Mã hàng</th>
            <th style="text-align: left; min-width: 130px;">Mã vạch</th>
            <th style="text-align: left; min-width: 250px;">Tên hàng</th>
            <th style="text-align: right;">Giá vốn</th>
        `;
    activePriceBookIds.forEach(id => {
        if (id === 'default') {
            thHtml += `<th style="text-align: right; color: var(--kv-pink);">Giá chung</th>`;
        } else {
            const pb = window.priceBooks.find(x => x && x.id === id);
            if (pb) {
                const pbName = (pb.name && pb.name.trim() !== '') ? pb.name : 'Bảng giá';
                thHtml += `<th style="text-align: right; color: var(--kv-pink);">${pbName}</th>`;
            }
        }
    });
    thHtml += `</tr>`;
    thead.innerHTML = thHtml;

    // 2. Lọc và Tìm kiếm
    const searchInput = document.getElementById('search-price-setup');
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const searchTerms = keyword ? keyword.split(/\s+/) : [];
    const checkedGroupCbs = document.querySelectorAll('.price-group-filter-cb:checked');
    const selectedGroupIds = Array.from(checkedGroupCbs).map(cb => cb.value);
    const stockFilter = document.getElementById('price-stock-filter');
    const stockVal = stockFilter ? stockFilter.value : 'all';

    let filtered = window.products.filter(p => {
        if (p.branchId !== currentBranch) return false;
        let matchKw = true;
        if (searchTerms.length > 0) {
            let fullSearchStr = (p.name || '') + ' ' + (p.code || '') + ' ' + (p.barcode || '');
            if (p.units && p.units.length > 0) {
                p.units.forEach(u => fullSearchStr += ' ' + (u.name || '') + ' ' + (u.code || '') + ' ' + (u.barcode || ''));
            }
            matchKw = searchTerms.every(term => fullSearchStr.toLowerCase().includes(term));
        }
        let matchGroup = true;
        if (selectedGroupIds.length > 0) matchGroup = selectedGroupIds.includes(p.group);
        let matchStock = true;
        const stockLevel = parseFloat(p.stock) || 0;
        if (stockVal === 'below_min') matchStock = (stockLevel <= 5); 
        else if (stockVal === 'out_of_stock') matchStock = (stockLevel <= 0);
        return matchKw && matchGroup && matchStock;
    });

    // 3. Bung các đơn vị tính
    let flatProducts = [];
    filtered.forEach(p => {
        const units = p.units || [{ name: 'Cái', rate: 1, price: p.price }];
        units.forEach((unit, uIdx) => {
            flatProducts.push({
                ...p, displayUnit: unit, uIdx: uIdx, 
                displayCode: unit.code || p.code, displayBarcode: unit.barcode || p.barcode
            });
        });
    });

    // 4. Phân trang
    const itemsPerPage = 100;
    const totalPages = Math.ceil(flatProducts.length / itemsPerPage);
    if (window.currentPricePage > totalPages) window.currentPricePage = totalPages || 1;
    const startIndex = (window.currentPricePage - 1) * itemsPerPage;
    const paginatedProducts = flatProducts.slice(startIndex, startIndex + itemsPerPage);

    // 5. Vẽ dữ liệu
    let tbHtml = '';
    if (paginatedProducts.length === 0) {
        tbHtml = `<tr><td colspan="10" style="text-align:center; padding: 50px; color: #aaa;">Không tìm thấy hàng hóa</td></tr>`;
    } else {
        paginatedProducts.forEach((item, index) => {
            const stt = startIndex + index + 1;
            const baseCost = item.cost || 0;
            const unitCost = baseCost * (item.displayUnit.rate || 1); 
            const baseRefPrice = item.displayUnit.price || (item.price * (item.displayUnit.rate || 1));

// THÊM: transition cho đổi màu mượt hơn
            tbHtml += `
                <tr style="border-bottom: 1px dashed #eee; transition: background-color 0.2s ease;">
                    <td style="text-align: center; color: #888; font-size: 12px;">${stt}</td>
                    <td style="text-align: left; color: var(--kv-blue); font-weight: 500;">${item.displayCode}</td>
                    <td style="text-align: left; color:#555;">${item.displayBarcode || '---'}</td>
                    <td style="text-align: left; font-weight: bold;">${item.name} (${item.displayUnit.name})</td>
                    <td style="text-align: right;">${unitCost.toLocaleString('vi-VN')}</td>
            `;

            activePriceBookIds.forEach(id => {
                if (id === 'default') {
                    const inputId = `input-default-${item.id}-${item.uIdx}`;
                    tbHtml += `
                        <td style="text-align: right;">
                            <input type="text" id="${inputId}" value="${(item.displayUnit.price || 0).toLocaleString('vi-VN')}" 
                                oninput="formatCurrency(this)"
                                onchange="updateMainProductPrice('${item.id}', ${item.uIdx}, window.parseCurrency(this.value))"
                                onfocus="window.highlightRow(this, true)"
                                onblur="window.highlightRow(this, false)"
                                class="price-col-default"
                                style="width: 100px; text-align: right; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; outline: none; color: var(--kv-blue); font-weight: 500;">
                        </td>`;
                } else {
                    const pb = window.priceBooks.find(x => x && x.id === id);
                    if (!pb) return;

                    const exactKey = `${item.id}_${item.uIdx}`;
                    let pbPrice = pb.prices && pb.prices[exactKey] !== undefined ? pb.prices[exactKey] : '';
                    
                    let placeholderPrice = '';
                    if (pbPrice === '') {
                        let basePbPrice = pb.prices && (pb.prices[`${item.id}_0`] !== undefined ? pb.prices[`${item.id}_0`] : pb.prices[item.id]);
                        if (basePbPrice !== undefined) {
                            placeholderPrice = (basePbPrice * (item.displayUnit.rate || 1)).toLocaleString('vi-VN');
                        } else {
                            placeholderPrice = (item.displayUnit.price || 0).toLocaleString('vi-VN');
                        }
                    }

                    const displayPbPrice = pbPrice !== '' ? pbPrice.toLocaleString('vi-VN') : '';
                    const inputId = `input-${id}-${item.id}-${item.uIdx}`;
                    
                    const colorStyle = pbPrice !== '' ? 'color: var(--kv-pink); font-weight: bold;' : 'color: #333; font-weight: normal;';

                    // GỌI HÀM HIGHLIGHT KHI FOCUS VÀ BLUR
                    tbHtml += `
                        <td style="text-align: right; position: relative;">
                            <input type="text" id="${inputId}" value="${displayPbPrice}" placeholder="${placeholderPrice}"
                                oninput="formatCurrency(this); this.style.color = this.value ? 'var(--kv-pink)' : '#333'; this.style.fontWeight = this.value ? 'bold' : 'normal';"
                                onchange="updatePriceBookValue('${id}', '${item.id}', ${item.uIdx}, this.value === '' ? '' : window.parseCurrency(this.value))"
                                onkeydown="moveNextOnEnter(event, this, 'price-col-${id}')"
                                onfocus="showQuickPriceMenu(this); window.highlightRow(this, true);"
                                onblur="hideQuickPriceMenu(this); window.highlightRow(this, false);"
                                class="price-col-${id}"
                                style="width: 100px; text-align: right; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; outline: none; transition: 0.2s; ${colorStyle}">
                            
                            <div class="quick-price-dropdown" style="display: none; position: absolute; right: 10px; top: 100%; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); z-index: 100; width: 120px; flex-direction: column; overflow: hidden;">
                                <div onmousedown="applyQuickAdd(${baseRefPrice}, 0, '${id}', '${item.id}', ${item.uIdx}, '${inputId}')" style="padding: 8px; cursor: pointer; text-align: center; border-bottom: 1px solid #eee; font-size: 13px; color: var(--kv-pink); font-weight: bold; background: #fff;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='#fff'">+ 0k (Bằng giá)</div>
                                <div onmousedown="applyQuickAdd(${baseRefPrice}, 1, '${id}', '${item.id}', ${item.uIdx}, '${inputId}')" style="padding: 8px; cursor: pointer; text-align: center; border-bottom: 1px solid #eee; font-size: 13px; color: #007bff; font-weight: 500; background: #fff;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='#fff'">+ 1.000</div>
                                <div onmousedown="applyQuickAdd(${baseRefPrice}, 2, '${id}', '${item.id}', ${item.uIdx}, '${inputId}')" style="padding: 8px; cursor: pointer; text-align: center; border-bottom: 1px solid #eee; font-size: 13px; color: #007bff; font-weight: 500; background: #fff;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='#fff'">+ 2.000</div>
                                <div onmousedown="applyQuickAdd(${baseRefPrice}, 3, '${id}', '${item.id}', ${item.uIdx}, '${inputId}')" style="padding: 8px; cursor: pointer; text-align: center; border-bottom: 1px solid #eee; font-size: 13px; color: #007bff; font-weight: 500; background: #fff;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='#fff'">+ 3.000</div>
                                <div onmousedown="applyQuickAdd(${baseRefPrice}, 4, '${id}', '${item.id}', ${item.uIdx}, '${inputId}')" style="padding: 8px; cursor: pointer; text-align: center; border-bottom: 1px solid #eee; font-size: 13px; color: #007bff; font-weight: 500; background: #fff;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='#fff'">+ 4.000</div>
                                <div onmousedown="applyQuickAdd(${baseRefPrice}, 5, '${id}', '${item.id}', ${item.uIdx}, '${inputId}')" style="padding: 8px; cursor: pointer; text-align: center; font-size: 13px; color: #007bff; font-weight: 500; background: #fff;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='#fff'">+ 5.000</div>
                            </div>
                        </td>`;
                }
            });
            tbHtml += `</tr>`; 
        });
    }
    tbody.innerHTML = tbHtml;
    window.renderPaginationControls('price-pagination', window.currentPricePage, totalPages, 'changePricePage');
};
// Hàm vẽ các nút "Trang trước", "Trang sau" cho bảng giá
function renderPricePaginationControls(totalPages) {
    const paginationDiv = document.getElementById('price-pagination');
    if (!paginationDiv) return;
    
    if (totalPages <= 1) {
        paginationDiv.innerHTML = `<span style="font-size: 13px; color: #888;">Hiển thị tất cả ${products.length} mặt hàng</span>`;
        return;
    }

    let html = `<span style="font-size: 13px; color: #555; margin-right: 15px;">Đang xem trang <b>${currentPricePage}</b> / ${totalPages}</span>`;
    html += `<button onclick="changePricePage(${currentPricePage - 1})" ${currentPricePage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-action-outline"><i class="fa-solid fa-chevron-left"></i> Trang trước</button>`;
    html += `<button onclick="changePricePage(${currentPricePage + 1})" ${currentPricePage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-action-outline" style="margin-left: 8px;">Trang sau <i class="fa-solid fa-chevron-right"></i></button>`;
    
    paginationDiv.innerHTML = html;
}

// Hàm xử lý khi bấm nút chuyển trang
window.changePricePage = function(newPage) {
    currentPricePage = newPage;
    renderPriceSetupTable();
};

window.updateMainProductPrice = function(productId, unitIdx, newPrice) {
    const cleanPrice = typeof newPrice === 'string' ? window.parseCurrency(newPrice) : newPrice;

    // 1. Luôn đọc dữ liệu mới nhất từ kho lưu trữ để làm chuẩn
    let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    let allPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];

    const pIndex = allProducts.findIndex(x => x.id === productId);

    if(pIndex !== -1) {
        window.isSyncLocked = true;

        // 2. Lấy giá cũ để tính độ chênh lệch
        let oldPrice = 0;
        if (allProducts[pIndex].units && allProducts[pIndex].units[unitIdx]) {
            oldPrice = allProducts[pIndex].units[unitIdx].price || 0;
        } else {
            oldPrice = allProducts[pIndex].price || 0;
        }

        const priceDiff = cleanPrice - oldPrice;

        // 3. Cập nhật giá chính
        if (allProducts[pIndex].units && allProducts[pIndex].units[unitIdx]) {
            allProducts[pIndex].units[unitIdx].price = cleanPrice || 0;
        }
        if (unitIdx === 0) {
            allProducts[pIndex].price = cleanPrice || 0;
        }

        // 4. Tính toán chênh lệch cho bảng giá phụ
        let isPriceBookChanged = false;
        if (priceDiff !== 0) {
            allPriceBooks.forEach(pb => {
                if (pb.prices) {
                    const exactKey = `${productId}_${unitIdx}`;
                    if (pb.prices[exactKey] !== undefined) {
                        pb.prices[exactKey] += priceDiff;
                        if (pb.prices[exactKey] < 0) pb.prices[exactKey] = 0; // Không cho âm
                        isPriceBookChanged = true;
                    }
                }
            });
        }

        // ==========================================
        // FIX LỖI: PHẢI LƯU VÀO MÁY TRƯỚC KHI ĐẨY LÊN CLOUD
        // ==========================================
        localStorage.setItem('kv_products', JSON.stringify(allProducts));
        window.products = allProducts;
        if (typeof products !== 'undefined') products = allProducts; // Cập nhật biến Global

        if (isPriceBookChanged) {
            localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
            window.priceBooks = allPriceBooks;
        }

        // SAU ĐÓ MỚI ĐẨY LÊN CLOUD
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', allProducts);
            if (isPriceBookChanged) {
                window.uploadToCloud('pricebooks', allPriceBooks);
            }
        }

        // RENDER LẠI GIAO DIỆN
        if (typeof renderProductList === 'function') renderProductList();
        if (typeof renderPriceSetupTable === 'function') renderPriceSetupTable();

        setTimeout(() => { window.isSyncLocked = false; }, 3000);
    }
};

window.updatePriceBookValue = function(pbId, productId, unitIdx, newPrice) {
    const pb = window.priceBooks.find(x => x.id === pbId);
    if (pb) {
        if (!pb.prices) pb.prices = {}; 
        
        // Lưu chìa khóa dưới dạng "SP01_1" (ID sản phẩm + Vị trí đơn vị tính)
        const exactKey = `${productId}_${unitIdx}`;
        
        if (newPrice === '' || newPrice === null) {
            delete pb.prices[exactKey]; 
        } else {
            pb.prices[exactKey] = parseFloat(newPrice);
        }
        
        localStorage.setItem('kv_pricebooks', JSON.stringify(window.priceBooks));
        if (typeof window.uploadToCloud === 'function') window.uploadToCloud('pricebooks', window.priceBooks);
    }
};

// ==========================================
// 9. HÀM KHỞI CHẠY HỆ THỐNG KHI LOAD TRANG (CHỐNG F5)
// ==========================================


// ==========================================
// 10. QUẢN LÝ KIỂM KHO (STOCKTAKES)
// ==========================================
let inventoryChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];
let currentICItems = []; // Danh sách mặt hàng đang kiểm trong màn hình tạo phiếu
let editingICId = null;  // ID phiếu đang sửa

window.currentICPage = 1;


window.changeICPage = function(newPage) {
    currentICPage = newPage;
    renderInventoryChecks();
};

window.cancelIC = function(icId) {
    showConfirm(`Bạn muốn xóa phiếu kiểm kho <b>${icId}</b>? <br>Lưu ý: Tồn kho đã cân bằng trước đó sẽ không bị đảo ngược.`, function() {
        let allChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];
        
        // Lọc bỏ phiếu này khỏi mảng
        const newChecks = allChecks.filter(ic => ic.id.toString() !== String(icId) && ic.code !== icId);
        
        // Lưu và đẩy Cloud
        localStorage.setItem('kv_inventory_checks', JSON.stringify(newChecks));
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('inventory_checks', newChecks);
        }
        
        showToast("Đã xóa phiếu kiểm kho", "success");
        renderInventoryChecks();
    });
};

// 1. Chức năng Tìm kiếm mã/tên trong bảng chi tiết
function filterICDetailTable(icId, colIndex, keyword) {
    const trs = document.querySelectorAll(`#ic-detail-${icId} table tbody tr`);
    const kw = keyword.toLowerCase();
    trs.forEach(tr => {
        const td = tr.querySelectorAll('td')[colIndex];
        if (td) {
            const text = td.innerText.toLowerCase();
            if (text.includes(kw)) {
                tr.style.display = '';
            } else {
                tr.style.display = 'none';
            }
        }
    });
}

// 2. Chức năng Sao chép phiếu
function copyIC(id) {
    const ic = inventoryChecks.find(x => x.id === id);
    if(ic) {
        openCreateCheckView(null); 
        currentICItems = JSON.parse(JSON.stringify(ic.items));
        renderICItemsTable();
        alert("Đã sao chép dữ liệu sang phiếu mới. Bạn có thể kiểm tra và lưu lại.");
    }
}

// 3. Chức năng Xuất file CSV (Excel)
function exportICExcel(id) {
    const ic = inventoryChecks.find(x => x.id === id);
    if(!ic) return;
    
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Mã hàng,Tên hàng,Tồn kho,Thực tế,SL lệch,Giá trị lệch\n";

    ic.items.forEach(item => {
        const diff = item.realQty - item.sysStock;
        const valDiff = diff * item.cost;
        csvContent += `${item.code},"${item.name}",${item.sysStock},${item.realQty},${diff},${valDiff}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Phieu_Kiem_Kho_${ic.code}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
}

// 4. Chức năng In phiếu
function printIC(id) {
    const detailRow = document.getElementById(`ic-detail-${id}`);
    if(detailRow && detailRow.style.display !== 'none') {
        window.print();
    } else {
        alert("Vui lòng mở chi tiết phiếu trước khi in!");
    }
}

// ---------------- THAO TÁC TRONG MÀN HÌNH TẠO PHIẾU ----------------

window.openCreateCheckView = function(id = null) {
    editingICId = id;
    currentICItems = [];
    
    document.getElementById('inventory-check-view').style.display = 'flex';
    document.getElementById('ic-creator-name').innerText = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.fullname : 'Admin';

    const now = new Date();
    document.getElementById('ic-current-time').innerText = now.toLocaleString('vi-VN');

    if (id) {
        // Lấy dữ liệu mới nhất trực tiếp từ localStorage để tránh bị cũ
        let allChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];
        
        // FIX LỖI: Ép cả 2 biến về dạng String để so sánh chính xác
        const ic = allChecks.find(x => String(x.id) === String(id));

        if (ic) {
            document.getElementById('ic-code').value = ic.code || '';
            document.getElementById('ic-note').value = ic.note || '';
            document.getElementById('ic-status-badge').innerText = ic.status === 'done' ? 'Đã cân bằng' : 'Phiếu tạm';
            document.getElementById('ic-status-badge').className = ic.status === 'done' ? 'status-badge status-done' : 'status-badge status-temp';
            
            // Nạp lại danh sách mặt hàng
            currentICItems = JSON.parse(JSON.stringify(ic.items || []));
        } else {
            console.warn("Không tìm thấy phiếu kiểm kho!");
        }
    } else {
        document.getElementById('ic-code').value = '';
        document.getElementById('ic-note').value = '';
        document.getElementById('ic-status-badge').innerText = 'Phiếu tạm';
        document.getElementById('ic-status-badge').className = 'status-badge status-temp';
    }
    
    document.getElementById('ic-search-input').value = '';
    document.getElementById('ic-search-dropdown').style.display = 'none';
    
    // Bắt buộc vẽ lại bảng sau khi đã nạp dữ liệu
    if (typeof renderICItemsTable === 'function') renderICItemsTable();
};
function closeCreateCheckView() {
    if(currentICItems.length > 0 && !editingICId) {
        if(!confirm("Phiếu chưa được lưu. Bạn có chắc chắn muốn thoát?")) return;
    }
    document.getElementById('inventory-check-view').style.display = 'none';
}

let icSearchTimeout = null;
window.searchICProduct = function(keyword) {
    const dropdown = document.getElementById('ic-search-dropdown');
    if (!keyword || !keyword.trim()) { 
        dropdown.style.display = 'none'; 
        return; 
    }

    clearTimeout(icSearchTimeout);
    icSearchTimeout = setTimeout(() => {
        const kw = keyword.toLowerCase().trim();
        const searchTerms = kw.split(/\s+/);
        const latestProducts = window.products || []; // TỐI ƯU: Lấy từ RAM
        
        const matches = latestProducts.filter(p => {
            let fullSearchStr = (p.name || '') + ' ' + (p.code || '') + ' ' + (p.barcode || '');
            if (p.units && p.units.length > 0) {
                p.units.forEach(u => fullSearchStr += ' ' + (u.name || '') + ' ' + (u.code || '') + ' ' + (u.barcode || ''));
            }
            return searchTerms.every(term => fullSearchStr.toLowerCase().includes(term));
        });

        if (matches.length > 0) {
            dropdown.innerHTML = matches.slice(0, 15).map(p => `
                <div class="ic-dropdown-item" onclick="addICToList('${p.id}')">
                    <div style="display: flex; flex-direction: column;">
                        <strong style="color: var(--kv-blue);">${p.code}</strong>
                        <span style="font-size: 13px;">${p.name}</span>
                        <small style="color: #888;">Mã vạch: ${p.barcode || '---'}</small>
                    </div>
                    <div style="text-align: right;">
                        <span style="font-weight: bold; color: var(--kv-pink);">${(p.price || 0).toLocaleString()}</span>
                        <div style="font-size: 11px; color: #555;">Tồn: ${p.stock || 0}</div>
                    </div>
                </div>`).join('');
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = '<div style="padding: 10px; color: #888; text-align: center;">Không tìm thấy hàng hóa</div>';
            dropdown.style.display = 'block';
        }
    }, 100);
};

// Bắt sự kiện Enter cho Kiểm kho
document.getElementById('ic-search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const firstItem = document.querySelector('#ic-search-dropdown .ic-dropdown-item');
        if (firstItem) firstItem.click();
    }
});

function addICToList(productId) {
    const sInput = document.getElementById('ic-search-input');
    document.getElementById('ic-search-dropdown').style.display = 'none';
    
    const p = products.find(x => x.id === productId);
    if (!p) return;

    const productUnits = (p.units && p.units.length > 0) ? p.units : [{ name: 'Cái', rate: 1, price: p.price, isBase: true }];

    const existing = currentICItems.find(x => x.productId === productId);
    if (existing) {
        existing.realQty += 1;
    } else {
        currentICItems.unshift({
            productId: p.id,
            code: p.code,
            name: p.name,
            units: productUnits,
            selectedUnitIdx: 0,
            baseCost: p.cost || 0,
            cost: p.cost || 0,
            baseSysStock: p.stock || 0,
            sysStock: p.stock || 0,
            realQty: (p.stock || 0) + 1
        });
    }
    
    renderICItemsTable();

    // Reset thanh tìm kiếm và bôi đen
    sInput.value = '';
    sInput.focus();
    sInput.select();
}
// Hàm mới: Đổi đơn vị tính khi kiểm kho
function changeICUnit(productId, newUnitIdx) {
    const item = currentICItems.find(x => x.productId === productId);
    if (item) {
        const oldRate = item.units[item.selectedUnitIdx].rate || 1;
        item.selectedUnitIdx = parseInt(newUnitIdx);
        const newRate = item.units[item.selectedUnitIdx].rate || 1;

        // Quy đổi Tồn hệ thống và Số đếm thực tế (VD: Từ 10 Cây -> Thành 1 Lốc)
        item.sysStock = parseFloat((item.baseSysStock / newRate).toFixed(2));
        item.realQty = parseFloat(((item.realQty * oldRate) / newRate).toFixed(2));
        item.cost = item.baseCost * newRate; // Quy đổi giá để tính tiền chênh lệch

        renderICItemsTable();
    }
}

window.removeICItem = function(productId) {
    // Ép kiểu String để so sánh chính xác tuyệt đối
    currentICItems = currentICItems.filter(x => String(x.productId) !== String(productId));
    
    // Cập nhật lại số lượng hiển thị trên các Tab (Tất cả/Khớp/Lệch)
    const countEl = document.getElementById('ic-count-all');
    if (countEl) countEl.innerText = currentICItems.length;

    // Vẽ lại bảng ngay lập tức
    renderICItemsTable();
};

function updateICRealQty(productId, value) {
    const item = currentICItems.find(x => x.productId === productId);
    if (item) {
        item.realQty = parseFloat(value) || 0;
        renderICItemsTable(); 
    }
}

window.renderICItemsTable = function() {
    const tbody = document.querySelector('#ic-items-table tbody');
    document.getElementById('ic-count-all').innerText = currentICItems.length;

    let sumActual = 0;
    
    if (currentICItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 50px; color:#aaa;">Gõ mã hoặc tên hàng hóa vào ô tìm kiếm để thêm vào phiếu kiểm</td></tr>`;
        document.getElementById('ic-total-actual-qty').innerText = 0;
        return;
    }

    let htmlContent = ''; // Tạo chuỗi rỗng

    currentICItems.forEach(item => {
        sumActual += item.realQty;
        const diff = item.realQty - item.sysStock;
        const valDiff = diff * item.cost;
        
        let unitOptions = item.units.map((u, idx) => 
            `<option value="${idx}" ${item.selectedUnitIdx === idx ? 'selected' : ''}>${u.name}</option>`
        ).join('');
        
        htmlContent += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="text-align:center;"><i class="fa-solid fa-trash" style="color:#d9534f; cursor:pointer;" onclick="removeICItem('${item.productId}')"></i></td>
                <td style="color:var(--kv-blue); font-weight:bold;">${item.code}</td>
                <td>${item.name}</td>
                <td>
                    <select onchange="window.changeICUnit('${item.productId}', this.value)" style="border:none; color:var(--kv-blue); outline:none; background:transparent; cursor:pointer; font-weight:500;">
                        ${unitOptions}
                    </select>
                </td>
                <td style="text-align:center;">${item.sysStock}</td>
                <td style="text-align:center;">
                    <input type="number" value="${item.realQty}" onchange="window.updateICRealQty('${item.productId}', this.value)" style="width: 80px; text-align: center; padding: 5px; border: 1px solid #ccc; border-radius: 4px; outline: none; font-weight: bold;">
                </td>
                <td style="text-align:center; font-weight:bold; color:${diff < 0 ? 'red' : 'green'};">${diff}</td>
                <td style="text-align:right; font-weight:bold; color:${valDiff < 0 ? 'red' : 'green'};">${valDiff.toLocaleString()}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = htmlContent; // Gán 1 lần
    document.getElementById('ic-total-actual-qty').innerText = sumActual;
};

window.saveInventoryCheck = function(action) {
    if (currentICItems.length === 0) { 
        alert("Vui lòng thêm hàng để kiểm!"); 
        return; 
    }

    const icCode = document.getElementById('ic-code').value || ("KK" + Date.now().toString().slice(-6));
    
    // Luôn đọc dữ liệu tươi nhất
    let allChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];

    const icData = {
        branchId: localStorage.getItem('kv_current_branch') || 'CN001',
        id: editingICId || Date.now(), 
        code: icCode,
        creator: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.fullname : 'Admin',
        status: action,
        note: document.getElementById('ic-note').value.trim(),
        items: JSON.parse(JSON.stringify(currentICItems))
    };

    if (editingICId) {
        // FIX LỖI: Ép kiểu String để tìm chính xác phiếu đang sửa
        const idx = allChecks.findIndex(x => String(x.id) === String(editingICId));
        if (idx !== -1) {
            allChecks[idx] = icData;
        } else {
            allChecks.unshift(icData); // An toàn: Nếu không thấy thì thêm mới
        }
    } else {
        allChecks.unshift(icData);
    }

    // Nếu hoàn thành, cập nhật tồn kho vào danh mục sản phẩm
    if (action === 'done') {
        let latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        currentICItems.forEach(item => {
            const prod = latestProducts.find(p => p.id === item.productId);
            if (prod) {
                const rate = item.units[item.selectedUnitIdx]?.rate || 1;
                prod.stock = item.realQty * rate; 
            }
        });
        localStorage.setItem('kv_products', JSON.stringify(latestProducts));
        if (window.uploadToCloud) window.uploadToCloud('products', latestProducts);
    }

    // Lưu mảng phiếu kiểm vào Storage
    localStorage.setItem('kv_inventory_checks', JSON.stringify(allChecks));
    if (window.uploadToCloud) window.uploadToCloud('inventory_checks', allChecks);
    
    // Đồng bộ lại mảng Global
    inventoryChecks = allChecks;

    // Dọn dẹp trạng thái
    currentICItems = []; 
    editingICId = null; 

    // Đóng giao diện
    const icView = document.getElementById('inventory-check-view');
    if (icView) icView.style.display = 'none';

    // Vẽ lại bảng ngoài trang danh sách
    if (typeof renderInventoryChecks === 'function') renderInventoryChecks();

    const msg = action === 'done' ? "Cân bằng kho thành công!" : "Đã lưu phiếu tạm.";
    if (typeof showToast === 'function') {
        showToast(msg, "success");
    } else {
        alert(msg);
    }
};
// ==========================================
// 11. TÍNH NĂNG: ĐƠN VỊ TÍNH (NÂNG CAO)
// ==========================================

function openUnitAttrModal() {
    // 1. ĐỒNG BỘ: Kéo ngay mã vạch, mã hàng, giá từ form ngoài vào Đơn vị cơ bản trước khi mở
    if (currentProductUnits && currentProductUnits.length > 0) {
        currentProductUnits[0].code = document.getElementById('pm-code').value.trim();
        currentProductUnits[0].barcode = document.getElementById('pm-barcode').value.trim();
        currentProductUnits[0].price = window.parseCurrency(document.getElementById('pm-price').value);
    }

    document.getElementById('unit-attr-modal').style.display = 'flex';
    renderUnitAttrUI();
}

function closeUnitAttrModal() {
    document.getElementById('unit-attr-modal').style.display = 'none';
}

function renderUnitAttrUI() {
    const tagsContainer = document.getElementById('unit-tags-container');
    const btnAddUnit = document.getElementById('btn-add-unit');
    
    tagsContainer.innerHTML = '';
    
    if (currentProductUnits.length === 0) {
        btnAddUnit.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm đơn vị cơ bản';
        btnAddUnit.setAttribute('onclick', 'openAddUnitModal(true)');
        btnAddUnit.style.display = 'inline-block';
    } else {
        currentProductUnits.forEach((u, index) => {
            const isBase = index === 0;
            const subTitle = isBase ? '(Đơn vị cơ bản)' : `(${u.rate} ${currentProductUnits[0].name})`;
            
            // Đã bỏ dòng const sellText = ...
            // Đã xóa thẻ hiển thị sellText
            
            tagsContainer.innerHTML += `
                <div class="unit-tag ${isBase ? 'base' : ''}" onclick="openAddUnitModal(${isBase}, ${index})">
                    <div class="unit-tag-info">
                        <span class="unit-tag-title">${u.name} ${subTitle}</span>
                    </div>
                    <i class="fa-solid fa-pen"></i>
                </div>
            `;
        });
        
        btnAddUnit.innerHTML = '<i class="fa-solid fa-plus"></i> Thêm đơn vị';
        btnAddUnit.setAttribute('onclick', 'openAddUnitModal(false)');
        btnAddUnit.style.display = 'inline-block';
    }

    generateVariants();
}

function openAddUnitModal(isBase, editIndex = null) {
    // 1. Gán chỉ mục đang chỉnh sửa vào biến toàn cục để hàm lưu (saveSubUnit) nhận diện
    editingUnitIndex = editIndex;
    const modal = document.getElementById('add-unit-modal');
    
    // 2. Thiết lập tiêu đề và mô tả dựa trên loại đơn vị (Cơ bản hay Quy đổi)
    document.getElementById('add-unit-title').innerText = isBase ? 'Thêm đơn vị cơ bản' : 'Thêm đơn vị';
    document.getElementById('add-unit-desc').style.display = isBase ? 'block' : 'none';
    
    // 3. Ẩn hiện ô nhập giá trị quy đổi (Chỉ hiện khi thêm đơn vị phụ)
    const rateGroup = document.getElementById('sub-unit-rate-group');
    if(!isBase && currentProductUnits.length > 0) {
        rateGroup.style.display = 'block';
        document.getElementById('sub-unit-base-lbl').innerText = currentProductUnits[0].name;
    } else {
        rateGroup.style.display = 'none';
    }

    // 4. Đổ dữ liệu vào các ô nhập liệu[cite: 2]
    if(editIndex !== null) {
        // Trường hợp: Chỉnh sửa đơn vị đã có trong danh sách[cite: 2]
        const u = currentProductUnits[editIndex];
        document.getElementById('sub-unit-name').value = u.name;
        document.getElementById('sub-unit-rate').value = u.rate;
        
        // HIỂN THỊ GIÁ CÓ DẤU CHẤM: Sử dụng toLocaleString để dễ nhìn[cite: 2]
        document.getElementById('sub-unit-price').value = (u.price || 0).toLocaleString('vi-VN');
        
    } else {
        // Trường hợp: Thêm mới hoàn toàn đơn vị tính[cite: 2]
        document.getElementById('sub-unit-name').value = '';
        document.getElementById('sub-unit-rate').value = 1;
        
        // TỰ ĐỘNG LẤY GIÁ BÁN HIỆN TẠI: 
        // Dùng parseCurrency để làm sạch dấu chấm từ form chính rồi format lại cho modal mới[cite: 2]
        const mainPriceStr = document.getElementById('pm-price').value || "0";
        const mainPriceNum = window.parseCurrency(mainPriceStr);
        
        document.getElementById('sub-unit-price').value = mainPriceNum.toLocaleString('vi-VN');
    }
    
    // 5. Hiển thị Modal lên màn hình[cite: 1, 2]
    modal.style.display = 'flex';
    
    // Tự động focus vào ô tên đơn vị để gõ ngay[cite: 2]
    setTimeout(() => {
        const nameInput = document.getElementById('sub-unit-name');
        if (nameInput) {
            nameInput.focus();
            nameInput.select(); // Bôi đen toàn bộ nội dung[cite: 2]
        }
    }, 100);
}

function closeAddUnitModal() { document.getElementById('add-unit-modal').style.display = 'none'; }

function saveSubUnit() {
    const name = document.getElementById('sub-unit-name').value.trim();
    if(!name) { alert("Vui lòng nhập tên đơn vị!"); return; }
    
    const isBase = editingUnitIndex === 0 || (editingUnitIndex === null && currentProductUnits.length === 0);
    const rate = isBase ? 1 : parseFloat(document.getElementById('sub-unit-rate').value) || 1;
    
    const price = window.parseCurrency(document.getElementById('sub-unit-price').value);
    const sellDirect = true;

    if (editingUnitIndex !== null) {
        currentProductUnits[editingUnitIndex].name = name;
        currentProductUnits[editingUnitIndex].rate = rate;
        currentProductUnits[editingUnitIndex].price = price;
        currentProductUnits[editingUnitIndex].sellDirect = sellDirect;
        currentProductUnits[editingUnitIndex].isBase = isBase;
    } else {
        // 2. KẾ THỪA: Khi tạo đơn vị mới, tự động lấy luôn mã vạch và mã hàng ở lớp ngoài cùng
        const mainCode = document.getElementById('pm-code').value.trim() || 'SP';
        const mainBarcode = document.getElementById('pm-barcode').value.trim() || ''; 
        
        currentProductUnits.push({ 
            name, rate, price, sellDirect, isBase,
            code: mainCode,
            barcode: mainBarcode // Bơm trực tiếp mã vạch vào
        });
    }

    closeAddUnitModal();
    renderUnitAttrUI();
}

window.generateVariants = function() {
    const vSection = document.getElementById('variant-section');
    const vBody = document.getElementById('variant-tbody');
    
    if(!vSection || !vBody) return;
    if(currentProductUnits.length === 0) {
        vSection.style.display = 'none';
        return;
    }

    vSection.style.display = 'block';
    vBody.innerHTML = '';
    
    // Lấy mã gốc và mã vạch từ form chính để làm chuẩn gợi ý
    const mainCode = document.getElementById('pm-code').value.trim() || 'SP';
    const mainBarcode = document.getElementById('pm-barcode').value.trim() || '';
    
    currentProductUnits.forEach((unit, uIdx) => {
        // HIỂN THỊ: Ưu tiên mã riêng của đơn vị, nếu trống thì lấy luôn mã ngoài cùng
        const displayCode = unit.code || mainCode;
        const displayBarcode = unit.barcode || mainBarcode; 
        const displayPrice = (unit.price || 0).toLocaleString('vi-VN');
        
        vBody.innerHTML += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="font-weight: 500; color: var(--kv-blue);">${unit.name}</td>
                <td><input type="text" class="variant-input" value="${unit.rate}" style="width: 60px; text-align:center; background: #f9f9f9;" disabled></td>
                <td>
                    <input type="text" class="variant-input" value="${displayCode}" 
                        placeholder="Mã hàng" oninput="currentProductUnits[${uIdx}].code = this.value">
                </td>
                <td>
                    <input type="text" class="variant-input" value="${displayBarcode}" 
                        placeholder="Mã vạch" oninput="currentProductUnits[${uIdx}].barcode = this.value">
                </td>
                <td style="text-align:right; color: #888;">---</td>
                <td>
                    <input type="text" class="variant-input" value="${displayPrice}" 
                        placeholder="Giá bán"
                        oninput="window.formatCurrency(this); currentProductUnits[${uIdx}].price = window.parseCurrency(this.value)" 
                        style="text-align:right; font-weight:bold; color:var(--kv-pink);">
                </td>
                <td style="text-align:center; white-space: nowrap;">
                    <!-- THÊM MỚI NÚT THIẾT LẬP GIÁ Ở ĐÂY -->
                    <i class="fa-solid fa-tags" style="color:var(--kv-blue); cursor:pointer; margin-right: 12px; font-size: 15px;" 
                        onclick="window.openQuickPriceSetup(${uIdx})" title="Thiết lập bảng giá cho ${unit.name}"></i>
                        
                    <i class="fa-solid fa-trash-can" style="color:#888; cursor:pointer; font-size: 15px;" 
                        onclick="currentProductUnits.splice(${uIdx}, 1); renderUnitAttrUI();" title="Xóa đơn vị này"></i>
                </td>
            </tr>
        `;
    });
};

window.saveUnitAttr = function() {
    const rows = document.querySelectorAll('#variant-tbody tr');
    
    rows.forEach((row, index) => {
        const inputCode = row.querySelector('input[placeholder="Mã hàng"]');
        const inputBarcode = row.querySelector('input[placeholder="Mã vạch"]');
        const inputPrice = row.querySelector('input[placeholder="Giá bán"]');

        if (currentProductUnits[index]) {
            currentProductUnits[index].code = inputCode ? inputCode.value.trim() : currentProductUnits[index].code;
            currentProductUnits[index].barcode = inputBarcode ? inputBarcode.value.trim() : currentProductUnits[index].barcode;
            currentProductUnits[index].price = inputPrice ? window.parseCurrency(inputPrice.value) : currentProductUnits[index].price;

// NẾU LÀ ĐƠN VỊ CƠ BẢN (Dòng đầu tiên): Cập nhật thẳng ra ngoài sản phẩm chính
                if (index === 0) {
                    document.getElementById('pm-code').value = currentProductUnits[index].code || '';
                    document.getElementById('pm-barcode').value = currentProductUnits[index].barcode || '';
                    document.getElementById('pm-price').value = currentProductUnits[index].price.toLocaleString('vi-VN');
                }
        }
    });

    closeUnitAttrModal();
    showToast("Đã đồng bộ mã hàng và mã vạch mới", "success");
};
// ==========================================
// 12. QUẢN LÝ TAB HÓA ĐƠN
// ==========================================
let invoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
// ==========================================
// HÀM HỖ TRỢ BỘ LỌC THỜI GIAN CHO TRANG QUẢN LÝ
// ==========================================
window.getFilterTimeRange = function(prefix) {
    const dateType = document.querySelector(`input[name="${prefix}-date-type"]:checked`)?.value || 'predefined';
    const predefinedVal = document.getElementById(`${prefix}-date-predefined`)?.value || 'all';
    const fromDateVal = document.getElementById(`${prefix}-date-from`)?.value;
    const toDateVal = document.getElementById(`${prefix}-date-to`)?.value;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startOfWeek = todayStart - (now.getDay() === 0 ? 6 : now.getDay() - 1) * 86400000;
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59).getTime();

    let fromTime = 0, toTime = Infinity;

    if (dateType === 'predefined') {
        if (predefinedVal === 'today') { fromTime = todayStart; toTime = todayStart + 86400000 - 1; }
        else if (predefinedVal === 'yesterday') { fromTime = todayStart - 86400000; toTime = todayStart - 1; }
        else if (predefinedVal === 'this_week') { fromTime = startOfWeek; toTime = now.getTime(); }
        else if (predefinedVal === 'this_month') { fromTime = startOfMonth; toTime = now.getTime(); }
        else if (predefinedVal === 'last_month') { fromTime = startOfLastMonth; toTime = endOfLastMonth; }
    } else {
        if (fromDateVal) fromTime = new Date(fromDateVal).getTime();
        if (toDateVal) toTime = new Date(toDateVal).getTime() + 86400000 - 1; // Cuối ngày của ngày Đến
    }
    return { fromTime, toTime };
};

window.parseVNTime = function(timeStr) {
    if(!timeStr) return 0;
    try {
        let y, m, d, hh = 0, mm = 0, ss = 0;
        const match = timeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (match) {
            d = parseInt(match[1]); m = parseInt(match[2]); y = parseInt(match[3]);
        } else {
            // Bắt mọi chữ số nếu iPhone dùng chữ "thg"
            const nums = timeStr.match(/\d+/g);
            if (nums && nums.length >= 3) {
                const yIdx = nums.findIndex(p => p.length === 4);
                if (yIdx >= 2) { d = parseInt(nums[yIdx-2]); m = parseInt(nums[yIdx-1]); y = parseInt(nums[yIdx]); }
                else if (yIdx === 0) { y = parseInt(nums[0]); m = parseInt(nums[1]); d = parseInt(nums[2]); }
            }
        }
        
        const timeMatch = timeStr.match(/(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
        if (timeMatch) { hh = parseInt(timeMatch[1]); mm = parseInt(timeMatch[2]); ss = parseInt(timeMatch[3] || 0); }
        
        if (y && m && d) return new Date(y, m - 1, d, hh, mm, ss).getTime();
        return 0;
    } catch(e) { return 0; }
};
window.currentInvoicePage = 1;

window.renderInvoices = function() {
    const tbody = document.getElementById('invoice-tbody');
    if (!tbody) return; // Thoát ngay nếu tab hóa đơn chưa được nạp vào DOM

    // Kiểm tra an toàn cho các ô nhập liệu
    const searchInput = document.getElementById('search-invoice');
    const searchInvKw = searchInput ? searchInput.value.toLowerCase().trim() : '';
    
    const productSearchInput = document.getElementById('search-product-in-invoice');
    const productKw = productSearchInput ? productSearchInput.value.toLowerCase().trim() : '';

    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];

// LẤY GIÁ TRỊ TỪ CÁC BỘ LỌC
    const timeRange = window.getFilterTimeRange('inv');
    const showDone = document.getElementById('filter-inv-done')?.checked;
    const showCancel = document.getElementById('filter-inv-cancel')?.checked;
    const creatorVal = document.getElementById('filter-inv-creator')?.value || '';

    // Lọc dữ liệu
    let filtered = allInvoices.filter(inv => {
        // 1. Lọc chi nhánh
        if ((inv.branchId || 'CN001') !== currentBranch) return false;
        
        // 2. Lọc theo mã hóa đơn
        if (searchInvKw && !inv.id.toLowerCase().includes(searchInvKw)) return false;
        
        // 3. Lọc theo tên/mã hàng trong hóa đơn
        if (productKw) {
            const hasProduct = inv.items.some(it => 
                (it.name || '').toLowerCase().includes(productKw) || 
                (it.code || '').toLowerCase().includes(productKw)
            );
            if (!hasProduct) return false;
        }

        // 4. LỌC THEO THỜI GIAN
        const invTime = window.parseVNTime(inv.createdAt);
        if (invTime < timeRange.fromTime || invTime > timeRange.toTime) return false;

        // 5. LỌC THEO TRẠNG THÁI
        if (inv.status === 'cancel' && !showCancel) return false;
        if (inv.status !== 'cancel' && !showDone) return false;

        // 6. LỌC THEO NGƯỜI BÁN
        if (creatorVal && inv.creator !== creatorVal) return false;

        return true;
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding: 40px; color: #aaa;">Không tìm thấy hóa đơn nào</td></tr>`;
        return;
    }

    // Vẽ bảng
    tbody.innerHTML = filtered.map(inv => {
        const finalAmount = (inv.totalAmount || 0) - (inv.invoiceDiscount || 0) + (inv.extraFee || 0) + (inv.beerIceAmount || 0);
        const isCancel = inv.status === 'cancel';

        return `
        <tr onclick="toggleInvoiceDetail('${inv.id}')" style="cursor:pointer; border-bottom: 1px solid #eee; ${isCancel ? 'background: #fff5f5;' : ''}">
            <td style="text-align:center;"><input type="checkbox" onclick="event.stopPropagation()"></td>
            <td style="color:var(--kv-blue); font-weight:bold;">${inv.id}</td>
            <td>${inv.createdAt}</td>
            <td>${inv.customer || 'Khách lẻ'}</td>
            <td style="text-align:right;">${(inv.totalAmount || 0).toLocaleString()}</td>
            <td style="text-align:right;">${(inv.invoiceDiscount || 0).toLocaleString()}</td>
            <td style="text-align:right; font-weight:bold; color:${isCancel ? 'red' : 'var(--kv-blue)'};">${finalAmount.toLocaleString()}</td>
        </tr>
        <tr id="inv-detail-${inv.id}" style="display:none;" class="io-detail-wrapper">
            <td colspan="7" style="padding: 20px; background: #f4f6f9;">
                <div style="background: white; border-radius: 8px; border: 1px solid #ddd; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <div style="padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                        <h3 style="margin:0; color:var(--kv-blue);">Mã hóa đơn: ${inv.id}</h3>
                        <span class="status-badge-new ${isCancel ? 'badge-cancel' : 'badge-done'}">${isCancel ? 'Đã hủy' : 'Hoàn thành'}</span>
                    </div>
                    <div style="padding: 20px;">
                        <div class="io-detail-info-grid">
                            <div><b>Người bán:</b> ${inv.creator}</div>
                            <div><b>Thời gian:</b> ${inv.createdAt}</div>
                            <div><b>Khách hàng:</b> ${inv.customer || 'Khách lẻ'}</div>
                        </div>
                        <table class="kv-table" style="width:100%; margin-top:15px; border: 1px solid #eee;">
                            <thead><tr style="background:#f9f9f9;"><th>Mã hàng</th><th>Tên hàng</th><th style="text-align:center;">SL</th><th style="text-align:right;">Giá</th><th style="text-align:right;">T.Tiền</th></tr></thead>
                            <tbody>
                                ${inv.items.map(it => `<tr><td style="color:var(--kv-blue);">${it.code}</td><td>${it.name} ${it.isIce ? '❄️' : ''}</td><td style="text-align:center;">${it.qty}</td><td style="text-align:right;">${(it.price || 0).toLocaleString()}</td><td style="text-align:right;">${((it.qty || 0) * (it.price || 0)).toLocaleString()}</td></tr>`).join('')}
                            </tbody>
                        </table>
                        <div style="display:flex; justify-content: flex-end; margin-top:15px;">
                            <div class="io-detail-summary-box" style="width: 250px;">
                                <div class="summary-row" style="display:flex; justify-content:space-between;"><span>Tiền hàng:</span><span>${(inv.totalAmount || 0).toLocaleString()}</span></div>
                                <div class="summary-row" style="display:flex; justify-content:space-between; border-top:1px solid #eee; font-weight:bold; margin-top:5px; padding-top:5px;"><span>Khách đã trả:</span><span>${finalAmount.toLocaleString()}</span></div>
                            </div>
                        </div>
                    </div>
                    <div style="padding:15px; background:#f9f9f9; display:flex; justify-content:flex-end; gap:10px;">
                        ${!isCancel ? `
                            <button class="btn-action-outline text-danger" onclick="deleteInvoice('${inv.id}')"><i class="fa-solid fa-trash"></i> Hủy</button>
                            <button class="btn-action-outline" onclick="editInvoice('${inv.id}')"><i class="fa-solid fa-pen"></i> Sửa</button>
                        ` : `
                            <button class="btn-action-outline text-danger" onclick="permanentlyRemoveInvoice('${inv.id}')"><i class="fa-solid fa-eraser"></i> Xóa vĩnh viễn</button>
                        `}
                        <button class="btn-action-primary" onclick="printInvoice('${inv.id}')">In</button>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');
};

window.toggleInvoiceDetail = function(id) {
    const row = document.getElementById(`inv-detail-${id}`);
    if (!row) return;

    const isVisible = row.style.display === 'table-row';
    
    // Ẩn tất cả các dòng chi tiết khác đang mở
    document.querySelectorAll('tr[id^="inv-detail-"]').forEach(el => {
        el.style.display = 'none';
    });

    // Nếu dòng đang chọn chưa mở thì mới mở ra
    row.style.display = isVisible ? 'none' : 'table-row';
};
window.permanentlyRemoveInvoice = function(invId) {
    showConfirm(`Bạn có chắc muốn <b>Xóa vĩnh viễn</b> hóa đơn ${invId}? Hành động này không thể hoàn tác.`, function() {
        let allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
        const newInvoices = allInvoices.filter(x => x.id !== invId);
        
        localStorage.setItem('kv_invoices', JSON.stringify(newInvoices));
        if (window.uploadToCloud) window.uploadToCloud('invoices', newInvoices);
        
        renderInvoices();
        showToast("Đã xóa vĩnh viễn hóa đơn", "success");
    });
};
window.changeInvoicePage = function(newPage) {
    currentInvoicePage = newPage;
    renderInvoices();
};



// ==========================================
// 13. QUẢN LÝ NHẬP HÀNG (IMPORT ORDERS)
// ==========================================
let importOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
let currentIOItems = []; 
let editingIOId = null;  

window.currentIOPage = 1;

window.renderImportOrders = function() {
    const tbody = document.getElementById('import-tbody');
    if (!tbody) return;

    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    const allImportOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
    const searchKw = (document.getElementById('search-import')?.value || '').toLowerCase().trim();

// LẤY GIÁ TRỊ TỪ CÁC BỘ LỌC
    const timeRange = window.getFilterTimeRange('imp');
    const showTemp = document.getElementById('filter-imp-temp')?.checked;
    const showDone = document.getElementById('filter-imp-done')?.checked;
    const showCancel = document.getElementById('filter-imp-cancel')?.checked;
    const creatorVal = document.getElementById('filter-imp-creator')?.value || '';

    tbody.innerHTML = allImportOrders.filter(imp => {
        if ((imp.branchId || 'CN001') !== currentBranch) return false;
        if (searchKw && !imp.id.toLowerCase().includes(searchKw)) return false;
        
        // LỌC THỜI GIAN
        const impTime = imp.timestamp || window.parseVNTime(imp.createdAt);
        if (impTime < timeRange.fromTime || impTime > timeRange.toTime) return false;

        // LỌC TRẠNG THÁI
        if (imp.status === 'temp' && !showTemp) return false;
        if (imp.status === 'done' && !showDone) return false;
        if (imp.status === 'cancel' && !showCancel) return false;

        // LỌC NGƯỜI TẠO
        if (creatorVal && imp.creator !== creatorVal) return false;

        return true;
    }).map(imp => {
        const isCancel = imp.status === 'cancel';
        const statusText = isCancel ? 'Đã hủy' : (imp.status === 'done' ? 'Đã nhập hàng' : 'Phiếu tạm');
        const badgeClass = isCancel ? 'badge-cancel' : (imp.status === 'done' ? 'badge-done' : 'badge-temp');

        return `
        <tr onclick="toggleImportDetail('${imp.id}')" style="cursor:pointer; border-bottom: 1px solid #eee; ${isCancel ? 'background: #fff5f5;' : ''}">
            <td style="text-align:center;"><input type="checkbox" onclick="event.stopPropagation()"></td>
            <td style="color:var(--kv-blue); font-weight:bold;">${imp.id}</td>
            <td>${imp.createdAt}</td>
            <td>${imp.supplierName || 'NCC lẻ'}</td>
            <td style="text-align:right; font-weight:bold; color:var(--kv-pink);">${(imp.mustPay || 0).toLocaleString()}</td>
            <td style="text-align:center;"><span class="status-badge-new ${badgeClass}">${statusText}</span></td>
        </tr>
        <tr id="io-detail-${imp.id}" style="display:none;" class="io-detail-wrapper">
            <td colspan="6" style="padding: 20px; background: #f0f7ff;">
                <div style="background: white; border-radius: 8px; border: 1px solid #cee0f5; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                    <div style="padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; background: #fff;">
                        <h3 style="margin: 0; color: var(--kv-blue);">Phiếu nhập: ${imp.id}</h3>
                    </div>
                    <div style="padding: 20px;">
                        <div class="io-detail-info-grid">
                            <div class="info-item"><span class="info-label">Người nhập:</span><span>${imp.creator}</span></div>
                            <div class="info-item"><span class="info-label">Nhà cung cấp:</span><span>${imp.supplierName}</span></div>
                            <div class="info-item"><span class="info-label">Trạng thái:</span><span class="status-badge-new ${badgeClass}">${statusText}</span></div>
                        </div>
                        <table class="kv-table" style="width: 100%; margin-top: 15px;">
                            <thead>
                                <tr style="background: #f9f9f9;">
                                    <th>Mã hàng</th><th>Tên hàng</th><th style="text-align:center;">SL</th><th style="text-align:right;">Đơn giá</th><th style="text-align:right;">Thành tiền</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${imp.items.map(it => `
                                <tr>
                                    <td>${it.code}</td><td>${it.name}</td>
                                    <td style="text-align:center;">${it.qty}</td>
                                    <td style="text-align:right;">${(it.cost || 0).toLocaleString()}</td>
                                    <td style="text-align:right;">${((it.qty || 0) * (it.cost || 0)).toLocaleString()}</td>
                                </tr>`).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div style="padding: 15px 20px; background: #f9f9f9; display: flex; justify-content: flex-end; gap: 10px;">
                        ${!isCancel ? `
                            <button class="btn-action-outline text-danger" onclick="cancelImportOrder('${imp.id}')">
                                <i class="fa-solid fa-trash"></i> Hủy phiếu
                            </button>
                        ` : `
                            <button class="btn-action-outline text-danger" style="background: #fff0f0;" onclick="permanentlyRemoveImport('${imp.id}')">
                                <i class="fa-solid fa-eraser"></i> Xóa vĩnh viễn
                            </button>
                        `}
                        <button class="btn-action-primary" onclick="openCreateImportView('${imp.id}')">Mở lại phiếu</button>
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');
};
window.toggleImportDetail = function(id) {
    const row = document.getElementById(`io-detail-${id}`);
    if (row) row.style.display = (row.style.display === 'none') ? 'table-row' : 'none';
};
window.permanentlyRemoveImport = function(impId) {
    showConfirm(`Bạn muốn <b>Xóa vĩnh viễn</b> phiếu nhập ${impId}? <br>Hành động này sẽ xóa sạch dữ liệu trên Cloud và không thể khôi phục.`, function() {
        // 1. Lấy dữ liệu từ máy
        let allImports = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
        
        // 2. Lọc bỏ phiếu cần xóa
        const newImports = allImports.filter(imp => imp.id.toString() !== impId.toString());
        
        // 3. Cập nhật LocalStorage
        localStorage.setItem('kv_import_orders', JSON.stringify(newImports));
        
        // 4. ĐỒNG BỘ LÊN FIREBASE (QUAN TRỌNG NHẤT)
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('import_orders', newImports);
        }
        
        // 5. Cập nhật giao diện
        showToast("Đã xóa vĩnh viễn phiếu nhập hàng", "success");
        renderImportOrders();
    });
};
window.changeIOPage = function(newPage) {
    currentIOPage = newPage;
    renderImportOrders();
};
window.cancelImportOrder = function(impId) {
    showConfirm(`Xác nhận hủy phiếu nhập <b>${impId}</b>? <br>Số lượng hàng trong phiếu này sẽ bị trừ khỏi kho.`, function() {
        let allImports = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
        let products = JSON.parse(localStorage.getItem('kv_products')) || [];

        const index = allImports.findIndex(imp => String(imp.id) === String(impId));
        
        if (index !== -1 && allImports[index].status !== 'cancel') {
            const imp = allImports[index];
            
            // 1. Trừ tồn kho an toàn (CÓ KIỂM TRA ĐIỀU KIỆN ĐỂ KHÔNG BỊ TREO)
            if (imp.items && imp.items.length > 0) {
                imp.items.forEach(item => {
                    let p = products.find(x => String(x.id) === String(item.productId) || String(x.code) === String(item.code));
                    if (p) {
                        // Tính toán rate một cách an toàn nhất, tránh lỗi undefined
                        let rate = 1;
                        if (item.units && item.units.length > 0 && item.selectedUnitIdx !== undefined) {
                            const unit = item.units[item.selectedUnitIdx];
                            if (unit && unit.rate) {
                                rate = parseFloat(unit.rate);
                            }
                        }
                        
                        // Trừ kho
                        p.stock = (parseFloat(p.stock) || 0) - ((parseFloat(item.qty) || 0) * rate);
                    }
                });
            }

            // 2. Đổi trạng thái phiếu thành đã hủy
            allImports[index].status = 'cancel';

            // 3. LƯU VÀ ĐỒNG BỘ CLOUD
            localStorage.setItem('kv_import_orders', JSON.stringify(allImports));
            localStorage.setItem('kv_products', JSON.stringify(products));
            
            // Đồng bộ bộ nhớ cục bộ
            window.products = products;
            
            if (typeof window.uploadToCloud === 'function') {
                window.uploadToCloud('import_orders', allImports);
                window.uploadToCloud('products', products);
            }
            
            showToast("Đã hủy phiếu nhập hàng thành công!", "success");
            
            // 4. Vẽ lại giao diện danh sách phiếu nhập
            if (typeof renderImportOrders === 'function') {
                renderImportOrders();
            }
        } else {
            showToast("Không tìm thấy phiếu hoặc phiếu đã bị hủy từ trước!", "error");
        }
    });
};

window.toggleImportDetail = function(id) {
    const row = document.getElementById(`io-detail-${id}`);
    if (!row) return;

    // Ẩn các dòng chi tiết khác đang mở để tránh rối mắt
    document.querySelectorAll('tr[id^="io-detail-"]').forEach(el => {
        if (el.id !== `io-detail-${id}`) el.style.display = 'none';
    });

    // Đổi trạng thái hiển thị
    row.style.display = (row.style.display === 'none') ? 'table-row' : 'none';
};

window.openCreateImportView = function(editId = null) {
    // 1. Reset dữ liệu cũ trước khi mở màn hình
    currentIOItems = []; 
    window.currentIOItems = currentIOItems; 
    editingIOId = editId;

    // 2. Hiện màn hình tạo/sửa phiếu
    const ioView = document.getElementById('import-order-view');
    if (ioView) ioView.style.display = 'flex';
    
    const creatorEl = document.getElementById('io-creator-name');
    if (creatorEl && typeof currentUser !== 'undefined' && currentUser) {
        creatorEl.innerText = currentUser.fullname;
    }
    
    const timeEl = document.getElementById('io-current-time');
    if (timeEl) timeEl.value = new Date().toLocaleString('vi-VN');

    // TÌM ĐÚNG NÚT DỰA VÀO CHỮ 'temp' VÀ 'done' (Khớp với index.html)
    let btnSaveDraft = null;
    let btnComplete = null;
    if (ioView) {
        const buttons = ioView.querySelectorAll('button');
        buttons.forEach(btn => {
            const attr = btn.getAttribute('onclick') || '';
            // Đã sửa 'draft' thành 'temp' ở dòng dưới đây
            if (attr.includes("'temp'")) btnSaveDraft = btn; 
            if (attr.includes("'done'")) btnComplete = btn;
        });
    }

    if (editId) {
        const allImps = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
        const found = allImps.find(x => x.id === editId);

        if (found) {
            document.getElementById('io-code').value = found.id;
            document.getElementById('io-supplier').value = found.supplierName || '';
            document.getElementById('io-note').value = found.note || '';
            
            const badge = document.getElementById('io-status-badge');
            if(badge) badge.innerText = found.status === 'done' ? 'Đã nhập hàng' : 'Phiếu tạm';

            document.getElementById('io-discount').value = (found.ioDiscount || 0).toLocaleString('vi-VN');
            document.getElementById('io-extra-fee').value = (found.ioExtraFee || 0).toLocaleString('vi-VN');
            document.getElementById('io-paid').value = (found.paid || 0).toLocaleString('vi-VN');

            currentIOItems = found.items ? JSON.parse(JSON.stringify(found.items)) : [];
            window.currentIOItems = currentIOItems; 

            // ĐIỀU KHIỂN ẨN HIỆN NÚT
            if (found.status === 'done') {
                if (btnSaveDraft) btnSaveDraft.style.display = 'none'; // Đảm bảo ẩn nút Lưu tạm
                if (btnComplete) {
                    btnComplete.style.display = 'inline-block';
                    btnComplete.innerHTML = '<i class="fa-solid fa-save"></i> Cập nhật phiếu';
                }
            } else if (found.status === 'cancel') {
                if (btnSaveDraft) btnSaveDraft.style.display = 'none';
                if (btnComplete) btnComplete.style.display = 'none';
            } else {
                if (btnSaveDraft) btnSaveDraft.style.display = 'inline-block';
                if (btnComplete) {
                    btnComplete.style.display = 'inline-block';
                    btnComplete.innerHTML = '<i class="fa-solid fa-check"></i> Hoàn thành';
                }
            }
        }
    } else {
        document.getElementById('io-code').value = 'PN' + Date.now().toString().slice(-6);
        document.getElementById('io-supplier').value = '';
        document.getElementById('io-note').value = '';
        
        const badge = document.getElementById('io-status-badge');
        if(badge) badge.innerText = 'Phiếu tạm';
        
        document.getElementById('io-discount').value = '0';
        document.getElementById('io-extra-fee').value = '0';
        document.getElementById('io-paid').value = '0';

        if (btnSaveDraft) btnSaveDraft.style.display = 'inline-block';
        if (btnComplete) {
            btnComplete.style.display = 'inline-block';
            btnComplete.innerHTML = '<i class="fa-solid fa-check"></i> Hoàn thành';
        }
    }

    if (typeof renderIOItemsTable === 'function') renderIOItemsTable();
};
function closeCreateImportView() {
    if(currentIOItems.length > 0 && !editingIOId) {
        if(!confirm("Phiếu chưa được lưu. Bạn có chắc chắn muốn thoát?")) return;
    }
    document.getElementById('import-order-view').style.display = 'none';
}

// =================================================================
// CẬP NHẬT CHỨC NĂNG TÌM KIẾM VÀ QUÉT MÃ VẠCH (TAB NHẬP HÀNG)
// =================================================================


// =================================================================
// 1. FIX: Bắt sự kiện Enter cho thanh tìm kiếm Nhập hàng (Chống quét x2)
// =================================================================
const ioSearchInput = document.getElementById('io-search-input');
if (ioSearchInput) {
    // Clone node để xóa sạch các bộ lắng nghe cũ (tránh lặp sự kiện)
    const newIoSearch = ioSearchInput.cloneNode(true);
    ioSearchInput.parentNode.replaceChild(newIoSearch, ioSearchInput);

    newIoSearch.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();

            // Lấy từ khóa hiện tại
            const kw = this.value.trim();
            
            // CHẶN ĐỨNG: Nếu input rỗng (do lần quét 1 vừa xóa xong) thì ngắt ngay
            if (!kw) return; 

            // XÓA RỖNG NGAY LẬP TỨC: Giúp tia quét thứ 2 bị chặn lại ở điều kiện trên
            this.value = '';

            const dropdown = document.getElementById('io-search-dropdown');
            const firstItem = dropdown ? dropdown.querySelector('.ic-dropdown-item') : null;
            
            // Nếu danh sách kết quả đang mở sẵn, thực hiện click chọn món đầu tiên
            if (dropdown && dropdown.style.display === 'block' && firstItem) {
                firstItem.click();
            } else {
                // Nếu quét quá nhanh dropdown chưa kịp mở, chạy hàm tìm kiếm tương đối trực tiếp
                window.searchIOProduct(kw);
            }
        }
    });
}

// =================================================================
// 2. KHÔI PHỤC: Hàm thêm hàng hóa vào danh sách phiếu nhập
// =================================================================
window.addIOToList = function(productId) {
    const sInput = document.getElementById('io-search-input');
    const dropdown = document.getElementById('io-search-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    // Luôn lấy dữ liệu tươi nhất từ bộ nhớ máy
    const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    const p = latestProducts.find(x => String(x.id) === String(productId));
    
    if (!p) {
        if (typeof showToast === 'function') showToast("Hàng hóa không tồn tại!", "error");
        return;
    }
    
    const productUnits = (p.units && p.units.length > 0) ? p.units : [{ name: 'Cái', rate: 1, price: p.price, isBase: true }];

    // Kiểm tra xem món này đã tồn tại ở đơn vị tính cơ bản trong phiếu nhập chưa
    const existingItem = currentIOItems.find(x => String(x.productId) === String(productId) && parseInt(x.selectedUnitIdx) === 0);
    
    if (existingItem) {
        existingItem.qty += 1;
    } else {
        currentIOItems.unshift({
            productId: p.id,
            code: p.code,
            name: p.name,
            units: productUnits,
            selectedUnitIdx: 0,
            baseCost: p.cost || 0,
            cost: (p.cost || 0) * (productUnits[0].rate || 1),
            discount: 0,
            qty: 1
        });
    }
    
    // Cập nhật và tính toán lại toàn bộ bảng hiển thị của phiếu nhập hàng
    if (typeof renderIOItemsTable === 'function') renderIOItemsTable();

    // Trả lại trạng thái trống và tự động trỏ chuột vào ô tìm kiếm để sẵn sàng cho lần nhập tiếp theo
    if (sInput) {
        sInput.value = '';
        sInput.focus();
        sInput.select();
    }
};

window.removeIOItem = function(index) {
    // Xóa phần tử theo vị trí index
    currentIOItems.splice(index, 1);
    
    // Vẽ lại bảng để cập nhật lại STT và các ID dòng
    renderIOItemsTable();
    
    // Nếu danh sách trống, reset các ô tổng về 0
    if (currentIOItems.length === 0) {
        document.getElementById('io-total-qty').innerText = '0';
        const totalAmountEl = document.getElementById('io-total-amount');
        totalAmountEl.innerText = '0';
        totalAmountEl.dataset.val = '0';
        calculateIOTotals();
    }
};

// Đổi đơn vị tính theo Index
window.changeIOUnit = function(index, unitIdx) {
    const item = currentIOItems[index];
    if(item) {
        item.selectedUnitIdx = parseInt(unitIdx);
        const selectedUnit = item.units[item.selectedUnitIdx];
        item.cost = item.baseCost * selectedUnit.rate;
        renderIOItemsTable();
    }
}

window.updateIOItemState = function(index, field, value) {
    const item = currentIOItems[index];
    if (item) {
        // Chuyển đổi giá trị nhập vào thành số
        item[field] = parseFloat(value) || 0;
        
        // 1. LÀM TRÒN CỘT THÀNH TIỀN CỦA DÒNG HIỆN TẠI
        const rowTotal = Math.round(item.qty * (item.cost - (item.discount || 0)));
        const rowTotalEl = document.getElementById(`io-row-total-${index}`);
        if (rowTotalEl) rowTotalEl.innerText = rowTotal.toLocaleString('vi-VN');
        
        // 2. Tính toán lại tổng số lượng và làm tròn tổng tiền hàng
        let totalQty = 0;
        let totalAmount = 0;
        currentIOItems.forEach(i => {
            totalQty += i.qty;
            totalAmount += Math.round(i.qty * (i.cost - (i.discount || 0)));
        });
        
        // Cập nhật lên giao diện
        document.getElementById('io-total-qty').innerText = totalQty;
        const totalAmountEl = document.getElementById('io-total-amount');
        totalAmountEl.innerText = totalAmount.toLocaleString('vi-VN');
        totalAmountEl.dataset.val = totalAmount; // Lưu giá trị số để calculateIOTotals dùng
        
        calculateIOTotals();
    }
};

window.renderIOItemsTable = function() {
    const tbody = document.getElementById('io-items-table-body');
    if (!tbody) return;

    let html = '';
    let totalQty = 0;
    let totalAmount = 0;

    const items = typeof currentIOItems !== 'undefined' ? currentIOItems : (window.currentIOItems || []);

    if (items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 30px; color: #888;">Chưa có hàng hóa nào trong phiếu nhập. Gõ vào ô tìm kiếm để thêm hàng.</td></tr>`;
        document.getElementById('io-total-qty').innerText = '0';
        
        const elTotalAmount = document.getElementById('io-total-amount');
        if (elTotalAmount) {
            elTotalAmount.innerText = '0';
            elTotalAmount.dataset.val = '0';
        }
        
        if (typeof calculateIOTotals === 'function') calculateIOTotals();
        return;
    }

    items.forEach((item, index) => {
        let qty = parseFloat(item.qty) || 1;
        let cost = parseFloat(item.cost) || 0;
        let discount = parseFloat(item.discount) || 0;
        let total = (qty * cost) - discount;

        totalQty += qty;
        totalAmount += total;

        let formatVal = typeof formatCurrencyValue === 'function' ? formatCurrencyValue : (val => Number(val).toLocaleString('vi-VN'));

        // XÁC ĐỊNH TRẠNG THÁI NGÔI SAO TỪ DỮ LIỆU ĐÃ LƯU
        let starClass = item.isMarked ? 'fa-solid marked' : 'fa-regular';
        let starColor = item.isMarked ? 'color: #ffc107;' : '';

        html += `
            <tr style="border-bottom: 1px dashed #eee;">
                <td style="text-align: center; width: 40px;">
                    <i class="fa-solid fa-trash-can text-danger" style="cursor: pointer; padding: 5px;" onclick="removeIOItem(${index})" title="Xóa khỏi phiếu"></i>
                </td>
                <td style="text-align: center; width: 40px;">
                    <i class="${starClass} fa-star star-mark" style="${starColor}" onclick="toggleIOStar(${index}, this)" title="Đánh dấu đã sửa"></i>
                </td>
                <td style="text-align: center; color: #888; width: 50px;">${index + 1}</td>
                <td style="color: var(--kv-blue); font-weight: 500;">${item.code || ''}</td>
                
<td style="color: #333; font-weight: 500;">${item.name || ''}</td>
                
                <td>
                    <select onchange="window.changeIOUnit(${index}, this.value)" style="width: 100px; padding: 5px; border: 1px solid #ddd; border-radius: 4px; outline: none; cursor: pointer;">
                        ${item.units.map((u, idx) => `<option value="${idx}" ${item.selectedUnitIdx === idx ? 'selected' : ''}>${u.name}</option>`).join('')}
                    </select>
                </td>
                <td style="text-align: center;">
                    <input type="number" value="${qty}" min="1" onchange="updateIOItemState(${index}, 'qty', this.value)" style="width: 70px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; text-align: center; outline: none;">
                </td>
                <td style="text-align: right; white-space: nowrap;">
                    <input type="text" value="${formatVal(cost)}" oninput="formatCurrency(this); updateIOItemState(${index}, 'cost', window.parseCurrency(this.value))" style="width: 100px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; text-align: right; outline: none;">
                    <i class="fa-solid fa-pen-to-square" style="color: var(--kv-blue); cursor: pointer; margin-left: 8px;" onclick="openEditProductModal('${item.productId}', ${index})" title="Sửa chi tiết hàng hóa"></i>
                </td>
                <td style="text-align: right;">
                    <input type="text" value="${formatVal(discount)}" oninput="formatCurrency(this); updateIOItemState(${index}, 'discount', window.parseCurrency(this.value))" style="width: 80px; padding: 6px; border: 1px solid #ddd; border-radius: 4px; text-align: right; outline: none;">
                </td>
                <td style="text-align: right; font-weight: bold; color: #333;" id="io-row-total-${index}">
                    ${formatVal(total)}
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = html;

    // Cập nhật thông số
    const elTotalQty = document.getElementById('io-total-qty');
    if (elTotalQty) elTotalQty.innerText = totalQty;
    const elTotalAmount = document.getElementById('io-total-amount');
    if (elTotalAmount) {
        let formatVal = typeof formatCurrencyValue === 'function' ? formatCurrencyValue : (val => Number(val).toLocaleString('vi-VN'));
        elTotalAmount.innerText = formatVal(totalAmount);
        elTotalAmount.dataset.val = totalAmount; 
    }
    if (typeof calculateIOTotals === 'function') calculateIOTotals();
};

function calculateIOTotals() {
    const totalAmount = parseFloat(document.getElementById('io-total-amount').dataset.val) || 0;
    const discount = window.parseCurrency(document.getElementById('io-discount').value) || 0;
    const extraFee = window.parseCurrency(document.getElementById('io-extra-fee').value) || 0;
    const paid = window.parseCurrency(document.getElementById('io-paid').value) || 0;

    // Ép làm tròn số cho Tổng cần trả và Nợ
    const mustPay = Math.round(totalAmount - discount + extraFee);
    const debt = Math.round(mustPay - paid);

    document.getElementById('io-must-pay').innerText = mustPay.toLocaleString('vi-VN');
    document.getElementById('io-debt').innerText = debt.toLocaleString('vi-VN');
}

window.toggleICDateFilter = function() {
    const type = document.querySelector('input[name="ic-date-type"]:checked').value;
    document.getElementById('ic-date-custom-wrapper').style.display = (type === 'custom') ? 'flex' : 'none';
    window.currentICPage = 1;
    renderInventoryChecks();
};


// ==========================================
// 14. LOGIC BÁN HÀNG SIÊU ĐỒNG BỘ (FIX LỖI TÌM KIẾM & CHỐNG MẤT DỮ LIỆU KHI F5)
// ==========================================
let posTabs = [];
let lastScanTime = 0;
let lastScanCode = "";
let activeTabIndex = 0;
let tabCounter = 0;
let clockInterval;

// HÀM MỚI: LƯU TOÀN BỘ TRẠNG THÁI POS VÀO BỘ NHỚ TRÌNH DUYỆT
window.savePOSState = function() {
    // SỬA ĐỔI: Lấy tên tài khoản và chi nhánh để tạo "chìa khóa" lưu trữ riêng biệt
    const branch = localStorage.getItem('kv_current_branch') || 'CN001';
    const user = currentUser ? currentUser.username : 'unknown';
    const storageKey = `kv_pos_state_${user}_${branch}`;

    localStorage.setItem(storageKey, JSON.stringify({
        tabs: posTabs,
        activeIndex: activeTabIndex,
        counter: tabCounter
    }));
};
function initPOSData() {
    // 1. Hiển thị thông tin nhân viên và khởi động đồng hồ hệ thống
    if (currentUser) {
        const currentBranchId = localStorage.getItem('kv_current_branch') || 'CN001'; 
        const allBranches = JSON.parse(localStorage.getItem('kv_branches')) || []; 
        const currentBranchObj = allBranches.find(b => b.id === currentBranchId); 
        const branchName = currentBranchObj ? currentBranchObj.name : currentBranchId; 

        const sellerNameEl = document.getElementById('pos-seller-name');
        if (sellerNameEl) {
            // Hiển thị cả Tên nhân viên và Tên chi nhánh ngay phía dưới
            sellerNameEl.innerHTML = `<i class="fa-solid fa-user-tie" style="color: #888; margin-right:5px;"></i> ${currentUser.fullname} <br><span style="font-size: 11px; color: var(--kv-pink);">📍 ${branchName}</span>`; 
        }
        const userNameEl = document.getElementById('pos-user-name');
        if (userNameEl) userNameEl.innerText = currentUser.username; 
    }

    // Cập nhật thời gian thực mỗi giây
    if (typeof clockInterval !== 'undefined' && clockInterval) clearInterval(clockInterval);
    clockInterval = setInterval(() => {
        const timeEl = document.getElementById('pos-current-time');
        if (timeEl) timeEl.innerText = new Date().toLocaleString('vi-VN', { 
            hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' 
        });
    }, 1000);

    // 2. Nạp danh sách Bảng giá từ bộ nhớ vào thanh chọn POS
    priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || []; 
    const pbSelect = document.getElementById('pos-pricebook-select');
    if (pbSelect) {
        let pbHtml = `<option value="default">Bảng giá chung</option>`;
        priceBooks.forEach(pb => { 
            pbHtml += `<option value="${pb.id}">${pb.name}</option>`; 
        });
        pbSelect.innerHTML = pbHtml;
    }

    // 3. KHÔI PHỤC DỮ LIỆU POS (Lấy đúng giỏ hàng của nhân viên & chi nhánh này)
    const branch = localStorage.getItem('kv_current_branch') || 'CN001';
    const user = currentUser ? currentUser.username : 'unknown';
    const storageKey = `kv_pos_state_${user}_${branch}`;
    
    const savedStateStr = localStorage.getItem(storageKey);
    
    if (savedStateStr) {
        try {
            const savedState = JSON.parse(savedStateStr);
            
            // Kiểm tra nếu dữ liệu lưu trữ hợp lệ và có ít nhất một Tab
            if (savedState && savedState.tabs && savedState.tabs.length > 0) {
                posTabs = savedState.tabs;
                activeTabIndex = savedState.activeIndex || 0;
                tabCounter = savedState.counter || posTabs.length;
                
                // Đồng bộ giao diện với Tab đang mở
                switchPOSTab(activeTabIndex);
            } else {
                // Nếu dữ liệu trong localStorage là mảng rỗng (vừa thanh toán xong), dọn sạch POS
                window.clearPOS();
            }
        } catch (e) {
            console.error("Lỗi cấu trúc dữ liệu POS, đang khởi tạo lại:", e);
            window.clearPOS();
        }
    } else {
        // Nếu không có dữ liệu cũ (máy mới hoặc đã clear), tạo màn hình trắng
        window.clearPOS();
    }
}
window.getProductPrice = function(productObj, priceBookId, unitIdx = 0) {
    if (!priceBookId || String(priceBookId) === 'default') {
        if (productObj.units && productObj.units[unitIdx]) return productObj.units[unitIdx].price;
        return productObj.price || 0;
    }

    // TỐI ƯU SIÊU TỐC: Đọc bảng giá từ biến RAM thay vì ổ cứng để chống đứng máy
    if (!window.priceBooks || window.priceBooks.length === 0) {
        window.priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    }
    
    const pb = window.priceBooks.find(x => String(x.id) === String(priceBookId));

    if (pb && pb.prices) {
        const exactKey = `${productObj.id}_${unitIdx}`;
        if (pb.prices[exactKey] !== undefined) return pb.prices[exactKey];

        let basePrice = pb.prices[`${productObj.id}_0`];
        if (basePrice === undefined) basePrice = pb.prices[productObj.id];

        if (basePrice !== undefined) {
            const rate = (productObj.units && productObj.units[unitIdx]) ? (productObj.units[unitIdx].rate || 1) : 1;
            return basePrice * rate;
        }
    }

    if (productObj.units && productObj.units[unitIdx]) return productObj.units[unitIdx].price;
    return productObj.price || 0;
};
var currentFocus = -1; // Biến theo dõi vị trí đang chọn trong dropdown

let posSearchTimeout = null; // Biến giữ nhịp thời gian

window.searchPOSProduct = function(keyword) {
    if (window.isProcessingCheckout) return; // CHẶN KHI ĐANG THANH TOÁN

    const dropdown = document.getElementById('pos-search-dropdown');
    
    if (!keyword || !keyword.trim()) { 
        dropdown.style.display = 'none'; 
        return; 
    }

    // Xóa bộ đếm cũ nếu có phím mới được gõ vào
    clearTimeout(posSearchTimeout);

    // Đợi 250ms
    posSearchTimeout = setTimeout(() => {
        // 1. Chuẩn hóa từ khóa
        const rawKw = keyword.toLowerCase().trim();
        const cleanKw = window.removeVietnameseTones(rawKw);
        const searchTerms = cleanKw.split(/\s+/);
        
        // 2. TỐI ƯU: Sử dụng biến toàn cục (RAM) thay vì đọc ổ cứng (LocalStorage)
        const currentBranch = localStorage.getItem('kv_current_branch');
        const latestProducts = window.products || JSON.parse(localStorage.getItem('kv_products')) || [];
        
        const tab = posTabs[activeTabIndex];
        const currentPriceBookId = tab ? (tab.priceBook || 'default') : 'default';

        let results = [];

        latestProducts.forEach(p => {
            if (p.branchId !== currentBranch) return; 

            const pName = window.removeVietnameseTones((p.name || "").toLowerCase());
            const pCode = (p.code || "").toLowerCase();
            const pBarcode = (p.barcode || "").toLowerCase();

            const checkMatch = (str) => {
                if (!str) return false;
                return searchTerms.every(term => str.includes(term));
            };

            const matchBase = checkMatch(pName) || checkMatch(pCode) || checkMatch(pBarcode);

            if (p.units && p.units.length > 0) {
                p.units.forEach((unit, uIdx) => {
                    const uCode = (unit.code || "").toLowerCase();
                    const uBarcode = (unit.barcode || "").toLowerCase();
                    
                    if (matchBase || checkMatch(uCode) || checkMatch(uBarcode)) {
                        const correctPrice = window.getProductPrice(p, currentPriceBookId, uIdx);
                        results.push({
                            ...p,
                            matchedUnitIdx: uIdx,
                            displayUnitName: unit.name,
                            displayPrice: correctPrice,
                            displayCode: unit.code || p.code
                        });
                    }
                });
            }
        });

        // 3. Hiển thị kết quả
        if (results.length === 0) {
            dropdown.innerHTML = '<div style="padding:15px; color:#888; text-align:center;">Không tìm thấy hàng hóa thuộc chi nhánh này</div>';
        } else {
            dropdown.innerHTML = results.slice(0, 20).map(p => `
                <div class="pos-dropdown-item pos-item-node"  onclick="document.getElementById('pos-search-input').value='${p.displayCode}'; addPOSItem('${p.id}', true, ${p.matchedUnitIdx});">
                    <div style="flex:1;">
                        <strong style="color: var(--kv-blue);">${p.displayCode}</strong> - 
                        <strong>${p.name} (${p.displayUnitName})</strong>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: var(--kv-pink);">${(p.displayPrice || 0).toLocaleString('vi-VN')}</div>
                    </div>
                </div>`).join('');
        }
        dropdown.style.display = 'block';
        window.currentFocus = -1;
    }, 250); 
};
// Biến đồng hồ để gộp nhịp Enter
var fastEnterTimer = null;

// Biến đồng hồ để chặn súng quét bắn 2 lần (200ms là đủ siêu mượt)
var posLastEnterTime = 0; 

document.getElementById('pos-search-input').addEventListener('keydown', function(e) {
    // CHẶN NGAY LẬP TỨC NẾU ĐANG THANH TOÁN
    if (window.isProcessingCheckout) {
        e.preventDefault();
        showToast("Đang xử lý thanh toán, vui lòng đợi!", "warning");
        return;
    }

    const dropdown = document.getElementById('pos-search-dropdown');
    const items = dropdown ? dropdown.querySelectorAll('.pos-item-node') : [];
    
    if (e.key === 'ArrowDown') {
        e.preventDefault(); currentFocus++; addActive(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault(); currentFocus--; addActive(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        
        const kw = this.value.trim().toLowerCase();
        if (!kw) return;

        // Chống nhảy 2 lần do súng quét (đã giảm xuống 50ms để Enter nhạy hơn)
        const now = Date.now();
        if (now - posLastEnterTime < 100) return; 
        posLastEnterTime = now;
        
        // Hủy luôn hẹn giờ mở bảng Dropdown (Tránh việc chọn xong bảng gợi ý vẫn tự bật lên)
        if (typeof posSearchTimeout !== 'undefined') clearTimeout(posSearchTimeout); 

        // TRƯỜNG HỢP 1: Bảng gợi ý ĐÃ KỊP MỞ
        if (dropdown && dropdown.style.display === 'block' && items.length > 0) {
            if (currentFocus > -1) items[currentFocus].click(); 
            else items[0].click(); 
            
            dropdown.style.display = 'none';
            const inputEl = this;
            setTimeout(() => { inputEl.select(); }, 10);
        } 
        // TRƯỜNG HỢP 2: Bảng gợi ý CHƯA MỞ (Gõ nhanh tên hàng rồi bấm Enter luôn)
        else {
            const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
            const latestProducts = window.products || JSON.parse(localStorage.getItem('kv_products')) || [];
            
            let exactMatch = null;
            let matchedUnitIdx = 0;
            let firstPartialMatch = null;
            let partialUnitIdx = 0;

            const cleanKw = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(kw) : kw;
            const searchTerms = cleanKw.split(/\s+/);

            for (let p of latestProducts) {
                if (p.branchId !== currentBranch) continue;
                
                // 1. Quét tìm mã chính xác trước (Súng quét mã vạch)
                if ((p.barcode && p.barcode.toLowerCase() === kw) || (p.code && p.code.toLowerCase() === kw)) {
                    exactMatch = p;
                    matchedUnitIdx = 0;
                    break; // Thấy mã chuẩn thì ngưng tìm luôn
                }
                if (p.units && p.units.length > 0) {
                    let uIdx = p.units.findIndex(u => (u.barcode && u.barcode.toLowerCase() === kw) || (u.code && u.code.toLowerCase() === kw));
                    if (uIdx !== -1) {
                        exactMatch = p;
                        matchedUnitIdx = uIdx;
                        break;
                    }
                }

                // 2. TÌM KẾT QUẢ GẦN ĐÚNG NHẤT (Dành cho người dùng gõ tay)
                if (!exactMatch && !firstPartialMatch) {
                    let fullSearchStr = (p.name || '') + ' ' + (p.code || '') + ' ' + (p.barcode || '');
                    if (p.units) p.units.forEach(u => fullSearchStr += ' ' + (u.name || '') + ' ' + (u.code || '') + ' ' + (u.barcode || ''));
                    
                    const cleanData = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(fullSearchStr.toLowerCase()) : fullSearchStr.toLowerCase();
                    
                    if (searchTerms.every(term => cleanData.includes(term))) {
                        firstPartialMatch = p;
                        partialUnitIdx = 0; 
                    }
                }
            }

            // Nếu không có mã vạch chính xác, hệ thống sẽ tự động bắt lấy cái tên gần giống nhất
            const targetMatch = exactMatch || firstPartialMatch;
            const targetUnitIdx = exactMatch ? matchedUnitIdx : partialUnitIdx;

            if (targetMatch) {
                if (typeof addPOSItem === 'function') {
                    addPOSItem(targetMatch.id, true, targetUnitIdx);
                }
                if (dropdown) dropdown.style.display = 'none';
            } else {
                if (typeof showToast === 'function') showToast("Không tìm thấy mặt hàng!", "error");
            }
            
            // Trả lại bôi đen để gõ tiếp
            const inputEl = this;
            setTimeout(() => { inputEl.select(); }, 10);
        }
    }
});

// Hàm đổi màu dòng đang được chọn bằng phím mũi tên[cite: 2, 3]
function addActive(items) {
    if (!items || items.length === 0) return;
    items.forEach(item => {
        item.style.background = "white";
        item.style.color = "#333";
    });

    if (currentFocus >= items.length) currentFocus = 0;
    if (currentFocus < 0) currentFocus = items.length - 1;

    const activeItem = items[currentFocus];
    activeItem.style.background = "#eef6ff"; // Màu highlight xanh nhạt[cite: 3]
    activeItem.style.color = "var(--kv-blue)";
    activeItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
}


// Hàm phụ trợ: Xử lý sao chép 1 sản phẩm
function copySingleProductToCurrentBranch(sourceProduct, targetBranchId, allProducts, uIdxToCart) {
    let allPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    
    // Deep copy tách biệt dữ liệu hoàn toàn khỏi chi nhánh cũ
    let newP = JSON.parse(JSON.stringify(sourceProduct));
    
    // Cấp phát ID mới
    const newId = 'PROD' + Date.now();
    const oldId = sourceProduct.id;
    
    newP.id = newId;
    newP.branchId = targetBranchId; // Đổi quyền sở hữu về chi nhánh hiện tại
    newP.stock = 0;                 // Tồn kho ở chi nhánh mới mặc định phải bằng 0
    
    // Chép theo Bảng giá phụ (nếu có)
    allPriceBooks.forEach(pb => {
        if (!pb.prices) return;
        Object.keys(pb.prices).forEach(oldKey => {
            if (oldKey === oldId || oldKey.startsWith(oldId + '_')) {
                const newKey = oldKey.replace(oldId, newId);
                pb.prices[newKey] = pb.prices[oldKey];
            }
        });
    });
    
    // Lưu lại hệ thống
    allProducts.unshift(newP);
    localStorage.setItem('kv_products', JSON.stringify(allProducts));
    localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
    
    window.products = allProducts;
    window.priceBooks = allPriceBooks;
    
    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('products', allProducts);
        window.uploadToCloud('pricebooks', allPriceBooks);
    }
    
    window.showToast("Đã sao chép hàng hóa thành công!", "success");
    
    // Đẩy ngay lập tức mặt hàng vừa copy vào giỏ hàng để tiếp tục tính tiền
    window.addPOSItem(newId, true, uIdxToCart);
    
    // Focus lại ô tìm kiếm
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
        searchInput.focus();
        searchInput.select();
    }
}
function getProductPrice(productObj, priceBookId) {
    if (!priceBookId || String(priceBookId) === 'default') return productObj.price || 0;
    
    const latestPBs = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    const pb = latestPBs.find(x => String(x.id) === String(priceBookId));
    
    // Nếu bảng giá có thiết lập giá riêng cho ID sản phẩm này thì lấy, không thì lấy giá gốc
    if (pb && pb.prices && pb.prices[productObj.id] !== undefined) {
        return pb.prices[productObj.id];
    }
    return productObj.price || 0;
}

var isTabCreating = false; // Thêm biến này ở đầu file hoặc ngay trên hàm
window.addPOSTab = function() {
    if (isTabCreating) return;
    isTabCreating = true;

    const existingNumbers = posTabs.map(tab => {
        const match = tab.name.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    }).sort((a, b) => a - b);

    let nextNumber = 1;
    for (let i = 0; i < existingNumbers.length; i++) {
        if (existingNumbers[i] === nextNumber) {
            nextNumber++;
        } else if (existingNumbers[i] > nextNumber) {
            break;
        }
    }

    // Đảm bảo lấy CHÍNH XÁC bảng giá của tab hiện hành để kế thừa cho Tab 2, Tab 3...
    let currentPb = 'default';
    if (posTabs.length > 0 && posTabs[activeTabIndex] && posTabs[activeTabIndex].priceBook) {
        currentPb = posTabs[activeTabIndex].priceBook;
    }

    posTabs.push({ 
        id: Date.now(), 
        name: `Hóa đơn ${nextNumber}`, 
        items: [], 
        priceBook: currentPb, 
        discount: 0, 
        extraFee: 0 
    });

    switchPOSTab(posTabs.length - 1);
    
    setTimeout(() => { isTabCreating = false; }, 200);
};
function renderPOSTabs() {
    const container = document.getElementById('pos-tabs-container');
    if(!container) return;
    let html = '';
    posTabs.forEach((tab, index) => {
        html += `
            <div class="pos-tab ${index === activeTabIndex ? 'active' : ''}" onclick="switchPOSTab(${index})">
                ${tab.name} 
                ${posTabs.length > 1 ? `<i class="fa-solid fa-xmark" onclick="closePOSTab(${index}, event)"></i>` : ''}
            </div>
        `;
    });
    html += `<div class="pos-tab-add" onclick="addPOSTab()" title="Thêm Hóa Đơn (F1)"><i class="fa-solid fa-plus"></i></div>`;
    container.innerHTML = html;
}

function switchPOSTab(index) {
    activeTabIndex = index;
    renderPOSTabs();

    const tab = posTabs[activeTabIndex];
    if (tab) {
        // [TỐI ƯU CỰC QUAN TRỌNG]: Nạp lại danh sách Bảng giá liên tục để chống lỗi rỗng
        const pbSelect = document.getElementById('pos-pricebook-select');
        if (pbSelect) {
            const latestPBs = JSON.parse(localStorage.getItem('kv_pricebooks')) || []; 
            let pbHtml = `<option value="default">Bảng giá chung</option>`;
            latestPBs.forEach(pb => { 
                pbHtml += `<option value="${pb.id}">${pb.name}</option>`; 
            });
            pbSelect.innerHTML = pbHtml;

            // Khôi phục giá trị đã lưu cho Tab này
            pbSelect.value = tab.priceBook || 'default';
            
            // Nếu giá trị không tồn tại trong danh sách, tự ép về mặc định
            if (!pbSelect.value) {
                pbSelect.value = 'default';
                tab.priceBook = 'default';
            }
        }
        
        if (document.getElementById('pos-discount')) 
            document.getElementById('pos-discount').value = (tab.discount || 0).toLocaleString('vi-VN');
        if (document.getElementById('pos-extra-fee')) 
            document.getElementById('pos-extra-fee').value = (tab.extraFee || 0).toLocaleString('vi-VN');
    }

    renderPOSCart();
    savePOSState();
    if (typeof focusPOSSearch === 'function') focusPOSSearch();
}

window.closePOSTab = function(index, event) {
    if(event) event.stopPropagation();
    
    // Nếu chỉ còn 1 tab thì không cho đóng
    if (posTabs.length <= 1) return;

    const tabToClose = posTabs[index];

    // Tạo một hàm con xử lý việc đóng tab để dùng lại cho cả 2 trường hợp
    const executeClose = () => {
        posTabs.splice(index, 1);
        // Cập nhật lại vị trí tab đang active nếu lỡ xóa tab ở cuối
        if (activeTabIndex >= posTabs.length) activeTabIndex = posTabs.length - 1;
        
        switchPOSTab(activeTabIndex);
        savePOSState();
        focusPOSSearch();
    };

    // Kiểm tra xem hóa đơn này có đang chứa hàng hóa nào không
    if (tabToClose && tabToClose.items && tabToClose.items.length > 0) {
        // Nếu có hàng: Hiển thị cảnh báo xác nhận
        showConfirm(
            `Hóa đơn <b>${tabToClose.name}</b> đang có ${tabToClose.items.length} mặt hàng.<br>Bạn có chắc chắn muốn đóng và xóa hóa đơn này không?`, 
            function() {
                executeClose();
            }
        );
    } else {
        // Nếu hóa đơn trống: Tắt ngay lập tức không cần hỏi
        executeClose();
    }
};


window.renderPOSCart = function() {
    const listDiv = document.getElementById('pos-cart-list');
    const tab = posTabs[activeTabIndex];
    if (!listDiv || !tab) return;
    
    // --- BƯỚC 1: GHI NHỚ VỊ TRÍ NÚT XÓA ĐANG ĐƯỢC CHỌN ---
    let focusedIndex = null;
    if (document.activeElement && document.activeElement.classList.contains('pos-trash-btn')) {
        focusedIndex = parseInt(document.activeElement.getAttribute('data-index'));
    }

    const isFeatureEnabled = document.getElementById('enable-beer-ice')?.checked;
    const currentBranch = localStorage.getItem('kv_current_branch');

    if (tab.items.length === 0) {
        listDiv.innerHTML = `<div style="text-align:center; margin-top:50px; color:#ccc;">Hóa đơn trống</div>`;
        if (typeof calcPOSTotals === 'function') calcPOSTotals();
        
        // Nếu giỏ hàng trống, tự động trả con trỏ về ô tìm kiếm
        if (focusedIndex !== null) {
            setTimeout(() => { if (typeof focusPOSSearch === 'function') focusPOSSearch(); }, 10);
        }
        return;
    }

    // Lấy danh sách sản phẩm mới nhất để check tồn kho
    const allProds = window.products || [];

    listDiv.innerHTML = tab.items.map((item, index) => {
        const rowTotal = item.qty * item.price;
        
        const pOriginal = allProds.find(x => x.id === item.productId && x.branchId === currentBranch);
        const currentStock = pOriginal ? (parseFloat(pOriginal.stock) || 0) : 0;
        
        let unitOptions = item.units.map((u, idx) => 
            `<option value="${idx}" ${item.selectedUnitIdx === idx ? 'selected' : ''}>${u.name}</option>`
        ).join('');

        // THÊM TABINDEX="-1" VÀO NÚT BIA LẠNH ĐỂ PHÍM TAB BỎ QUA NÓ
        const iceCheckboxHtml = isFeatureEnabled ? 
            `<div style="width: 35px; text-align: center;">
                <input type="checkbox" tabindex="-1" ${item.isIce ? 'checked' : ''} onchange="toggleBeerIce(${index}, this.checked)" style="width: 17px; height: 17px; cursor: pointer; accent-color: #00bcd4;">
            </div>` : '';

        // TẠO VÒNG LẶP TAB: Bắt sự kiện nếu là mục cuối cùng thì trỏ chuột ngược lên đầu tiên
        const isLastItem = index === tab.items.length - 1;
        const tabLoopLogic = isLastItem ? `if(event.key === 'Tab' && !event.shiftKey) { event.preventDefault(); const firstBtn = document.querySelector('.pos-trash-btn'); if(firstBtn) firstBtn.focus(); }` : '';

        return `
        <div class="cart-item-row" style="display: flex; align-items: center; padding: 12px 20px; border-bottom: 1px solid #f4f4f4; font-size: 14px;">
            
            <div style="width: 35px; text-align:center; color: #888; font-size: 13px; font-weight: bold;">${index + 1}</div>

            <!-- NÚT XÓA ĐƯỢC GẮN THÊM DATA-INDEX VÀ CLASS POS-TRASH-BTN -->
            <div style="width: 45px; text-align: center;">
                <div tabindex="0" class="pos-trash-btn" data-index="${index}"
                     onclick="window.removePOSItem(${index})" 
                     onkeydown="if(event.key === 'Enter') { window.removePOSItem(${index}); } ${tabLoopLogic}" 
                     style="width: 32px; height: 32px; margin: 0 auto; background: #fff0f0; color: #d9534f; border-radius: 6px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s; border: 1px solid #ffd6d6; outline: none;" 
                     onmouseover="this.style.background='#ffe0e0'; this.style.borderColor='#ffb3b3';" 
                     onmouseout="this.style.background='#fff0f0'; this.style.borderColor='#ffd6d6';" 
                     onfocus="this.style.boxShadow='0 0 0 3px #007bff'; this.style.borderColor='#007bff';" 
                     onblur="this.style.boxShadow='none'; this.style.borderColor='#ffd6d6';" 
                     title="Xóa (Phím Tab để chọn + Enter)">
                    <i class="fa-solid fa-trash-can" style="font-size: 14px;"></i>
                </div>
            </div>
            
            ${iceCheckboxHtml}
            
            <div style="flex: 1; min-width: 0; padding-right: 10px;">
                <div style="color: var(--kv-pink); font-weight: 600; font-size: 13px;">${item.code}</div>
                <div style="font-weight: bold; font-size: 16px; color: #111; margin-top: 4px; margin-bottom: 4px;">
                    ${item.name} ${item.isIce ? '<i class="fa-solid fa-snowflake" style="color: #00bcd4; font-size: 14px;"></i>' : ''}
                </div>
                <div style="font-size: 12px; color:#888;">Tồn chi nhánh: ${currentStock}</div>
            </div>
            
<!-- THÊM TABINDEX="-1" ĐỂ BỎ QUA Ô CHỌN ĐƠN VỊ -->
            <div style="width: 90px;">
                <select tabindex="-1" 
                    onclick="if(this.dataset.opened === '1') { this.blur(); this.dataset.opened = '0'; } else { this.dataset.opened = '1'; }"
                    onchange="this.dataset.opened = '0'; updatePOSUnit(${index}, this.value);"
                    onblur="this.dataset.opened = '0'; setTimeout(() => { if(document.activeElement && document.activeElement.tagName === 'INPUT') return; if (typeof focusPOSSearch === 'function') focusPOSSearch(); }, 50);"
                    style="width: 100%; border: 1px solid #eee; padding: 5px; border-radius: 4px; outline: none; cursor: pointer;">
                    ${unitOptions}
                </select>
            </div>
            
<!-- THÊM TABINDEX="-1" ĐỂ BỎ QUA CỤM CHỈNH SỐ LƯỢNG KHI BẤM TAB -->
            <div style="width: 100px; display: flex; align-items: center; justify-content: center;">
                <button tabindex="-1" type="button" onclick="window.updatePOSQty(${index}, ${item.qty - 1})" style="width: 28px; height: 30px; border: 1px solid #ddd; background: #fdfdfd; border-radius: 4px 0 0 4px; cursor: pointer; color: #555; font-weight: bold; border-right: none; font-size: 16px;">-</button>
                <input tabindex="-1" type="text" value="${item.qty}" class="pos-qty-input" 
                    oninput="this.value = this.value.replace(/[^0-9]/g, ''); window.updatePOSQty(${index}, this.value, true)" 
                    style="width: 44px; height: 30px; text-align: center; border: 1px solid #ddd; padding: 0; font-weight: bold; outline: none; border-radius: 0; font-size: 14px; box-sizing: border-box;">
                <button tabindex="-1" type="button" onclick="window.updatePOSQty(${index}, ${item.qty + 1})" style="width: 28px; height: 30px; border: 1px solid #ddd; background: #fdfdfd; border-radius: 0 4px 4px 0; cursor: pointer; color: #555; font-weight: bold; border-left: none; font-size: 14px;">+</button>
            </div>
            
            <div style="width: 120px; text-align: right; font-weight: 500; color: #333;">${item.price.toLocaleString('vi-VN')}</div>
            <div id="pos-row-total-${index}" style="width: 120px; text-align: right; font-weight: bold; color: var(--kv-blue); font-size: 15px;">${rowTotal.toLocaleString('vi-VN')}</div>
        </div>`;
    }).join('');

    if (typeof calcPOSTotals === 'function') calcPOSTotals();

    // --- BƯỚC 2: PHỤC HỒI LẠI TRẠNG THÁI FOCUS SAU KHI VẼ XONG ---
    if (focusedIndex !== null && !isNaN(focusedIndex)) {
        setTimeout(() => {
            const btns = listDiv.querySelectorAll('.pos-trash-btn');
            if (btns.length > 0) {
                // Trỏ vào nút ở vị trí cũ. Nếu món đó vừa bị xóa, trỏ vào món bị đẩy lên thế chỗ nó
                const newFocusIdx = Math.min(focusedIndex, btns.length - 1);
                btns[newFocusIdx].focus();
            }
        }, 10);
    }
};

window.removePOSItem = function(index) { 
    if (window.isProcessingCheckout) return; // Chặn nếu đang thanh toán

    if (posTabs[activeTabIndex] && posTabs[activeTabIndex].items[index]) {
        // 1. Xóa mặt hàng khỏi giỏ
        posTabs[activeTabIndex].items.splice(index, 1); 
        
        // 2. Ngắt focus hiện tại ở thùng rác để hàm renderPOSCart không tự kéo focus lại
        if (document.activeElement) {
            document.activeElement.blur();
        }

        // 3. Vẽ lại giao diện giỏ hàng mới
        renderPOSCart(); 
        savePOSState(); 
        
        // 4. Nhảy nảy chuột lên ô tìm kiếm ngay lập tức
        setTimeout(() => {
            if (typeof focusPOSSearch === 'function') {
                focusPOSSearch();
            } else {
                const searchInput = document.getElementById('pos-search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select(); // Bôi đen chữ sẵn sàng
                }
            }
        }, 10); // Phản hồi cực nhanh chỉ 10ms
    }
};

window.updatePOSQty = function(index, val, isRealTime = false) {
    if (window.isProcessingCheckout) return; // CHẶN KHI ĐANG THANH TOÁN

    const tab = posTabs[activeTabIndex];
    if (!tab || !tab.items[index]) return;

    // Chuyển đổi giá trị thành số, nếu xóa trắng thì hiểu là 0
    let q = parseFloat(val);
    if (isNaN(q)) q = 0;
    if (q < 0) q = 0;

    // Lưu số lượng mới vào giỏ hàng
    tab.items[index].qty = q;
    savePOSState();

    if (isRealTime) {
        // [CẬP NHẬT TỨC THỜI KHI ĐANG GÕ SỐ] Chỉ tính lại tiền của dòng này và gắn lên màn hình
        const rowTotal = tab.items[index].qty * tab.items[index].price;
        const rowTotalEl = document.getElementById(`pos-row-total-${index}`);
        if (rowTotalEl) rowTotalEl.innerText = rowTotal.toLocaleString('vi-VN');
        
        // Gọi hàm tính tổng tiền của cả hóa đơn
        if (typeof calcPOSTotals === 'function') calcPOSTotals();
    } else {
        // [KHI BẤM NÚT CỘNG/TRỪ] Vẽ lại giỏ hàng
        renderPOSCart();
        
        // --- THÊM MỚI: Tự động nhảy lên ô tìm kiếm ---
        setTimeout(() => {
            if (typeof focusPOSSearch === 'function') {
                focusPOSSearch();
            } else {
                const searchInput = document.getElementById('pos-search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select();
                }
            }
        }, 50); // Độ trễ 50ms chờ giỏ hàng vẽ xong
    }
};
window.updatePOSUnit = function(index, unitIdx) {
    if (window.isProcessingCheckout) return; // CHẶN KHI ĐANG THANH TOÁN

    const tab = posTabs[activeTabIndex];
    const item = tab.items[index];
    item.selectedUnitIdx = parseInt(unitIdx);

    // Lấy lại sản phẩm gốc từ database để gọi hàm lấy giá
    const allProds = window.products || [];
    const prod = allProds.find(p => p.id === item.productId);

    if (prod) {
        item.price = window.getProductPrice(prod, tab.priceBook, item.selectedUnitIdx);
    }

    renderPOSCart();
    savePOSState();

    // --- THÊM MỚI: Tự động nhảy lên ô tìm kiếm sau khi đổi đơn vị ---
    setTimeout(() => {
        if (typeof focusPOSSearch === 'function') {
            focusPOSSearch();
        } else {
            const searchInput = document.getElementById('pos-search-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
    }, 50);
};
function calcPOSTotals() {
    const tab = posTabs[activeTabIndex];
    if(!tab) return;
    
    const isFeatureEnabled = document.getElementById('enable-beer-ice')?.checked;
    let totalQty = 0, totalGoods = 0;
    tab.items.forEach(item => { totalQty += item.qty; totalGoods += (item.qty * item.price); });

    // === CHUYỂN BƯỚC NÀY LÊN TRƯỚC ĐỂ LẤY DỮ LIỆU LÀM TRÒN ===
    tab.discount = window.parseCurrency(document.getElementById('pos-discount').value) || 0;
    tab.extraFee = window.parseCurrency(document.getElementById('pos-extra-fee').value) || 0;

    // Tính tiền lạnh (chỉ tính nếu bật nút gạt)
    const iceAmount = isFeatureEnabled ? calculateManualBeerIce() : 0;
    
    const iceDisplay = document.getElementById('pos-beer-ice-amount');
    if (iceDisplay) iceDisplay.innerText = iceAmount.toLocaleString('vi-VN');

    // Tổng thanh toán = Tiền hàng - Giảm giá + Phí khác + Tiền bia lạnh (nếu có)
    const mustPay = totalGoods - tab.discount + tab.extraFee + iceAmount;

    document.getElementById('pos-total-qty').innerText = totalQty;
    document.getElementById('pos-total-goods').innerText = totalGoods.toLocaleString('vi-VN');
    document.getElementById('pos-total-goods').dataset.val = totalGoods;
    document.getElementById('pos-must-pay').innerText = mustPay.toLocaleString('vi-VN');
    
    // MỚI: TỰ ĐỘNG ẨN/HIỆN KHU VỰC THANH TOÁN
    const paymentSection = document.getElementById('pos-payment-section');
    if (paymentSection) {
        if (tab.items.length === 0) {
            paymentSection.style.display = 'none'; // Giỏ hàng trống -> Ẩn đi
        } else {
            paymentSection.style.display = 'block'; // Có hàng -> Hiện lên
        }
    }

    // GỌI HÀM VẼ NÚT GỢI Ý & TÍNH TIỀN THỪA KHÁCH ĐƯA
    if (typeof window.renderQuickMoneySuggestions === 'function') {
        window.renderQuickMoneySuggestions(mustPay);
    }
    
    const paidInput = document.getElementById('pos-customer-paid');
    if (paidInput) {
        // Mặc định lấy số tiền đã nhập, nếu chưa nhập thì lấy bằng đúng số tiền khách cần trả
        const savedPaid = tab.customerPaid !== undefined ? tab.customerPaid : mustPay;
        
        // CHIA 1000 ĐỂ HIỂN THỊ RÚT GỌN VÀO Ô NHẬP (Ví dụ 135,000 sẽ hiện 135)
        paidInput.value = (savedPaid / 1000).toLocaleString('vi-VN');
        
        if (typeof window.calcPOSChange === 'function') window.calcPOSChange();
    }
}
window.changePOSPriceBook = function(pbId) {
    const tab = posTabs[activeTabIndex];
    if (!tab) return;
    
    tab.priceBook = pbId;
    
    // Quét lại toàn bộ hàng hóa trong giỏ để cập nhật giá mới
    tab.items.forEach(item => {
        const allProds = window.products || JSON.parse(localStorage.getItem('kv_products')) || [];
        const prod = allProds.find(p => String(p.id) === String(item.productId));
        if (prod) {
            item.basePrice = window.getProductPrice(prod, pbId, 0);
            item.price = window.getProductPrice(prod, pbId, item.selectedUnitIdx);
        }
    });
    
    renderPOSCart();
    
    // LƯU NGAY LẬP TỨC ĐỂ CHỐNG F5 HOẶC MỞ TAB MỚI BỊ LỖI
    savePOSState(); 
    
    // Đưa chuột về lại ô tìm kiếm để sẵn sàng bắn mã
    if (typeof focusPOSSearch === 'function') focusPOSSearch();
};

// Khai báo cờ khóa toàn cục cho hệ thống POS
window.isProcessingCheckout = false;

window.processCheckout = function() {
    if (window.isProcessingCheckout) return;

    const checkoutBtn = document.querySelector('.pos-checkout-btn');
    if (checkoutBtn && checkoutBtn.disabled) return;

    window.isProcessingCheckout = true;

    if (checkoutBtn) {
        checkoutBtn.disabled = true;
        checkoutBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...';
    }

    // ĐÃ GỠ BỎ HOÀN TOÀN SETTIMEOUT ĐỂ LƯU NGAY LẬP TỨC (CHỐNG F5)
    try {
        const tab = posTabs[activeTabIndex];
        if (!tab || tab.items.length === 0) { 
            showToast("Giỏ hàng trống!", "error"); 
            return; 
        }

        const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
        const latestProds = JSON.parse(localStorage.getItem('kv_products')) || [];
        let allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
        const totalAmount = parseFloat(document.getElementById('pos-total-goods').dataset.val) || 0;
        
        const isFeatureEnabled = document.getElementById('enable-beer-ice')?.checked;
        const iceAmount = isFeatureEnabled ? calculateManualBeerIce() : 0;
        
        const mustPay = totalAmount - (tab.discount || 0) + (tab.extraFee || 0) + iceAmount;

        const actualPaidStr = document.getElementById('pos-customer-paid')?.value || '0';
        const actualPaid = (window.parseCurrency(actualPaidStr) * 1000) || mustPay;

        let invoiceIdToSave = 'HD' + Date.now().toString().slice(-6);
        let originalInvoiceDate = new Date().toLocaleString('vi-VN');
        let oldInvIndex = -1;
        let oldInv = null;

        if (tab.isEditing && tab.oldInvId) {
            invoiceIdToSave = tab.oldInvId; 
            oldInvIndex = allInvoices.findIndex(x => x.id === tab.oldInvId);
            if (oldInvIndex !== -1) {
                oldInv = allInvoices[oldInvIndex];
                originalInvoiceDate = oldInv.createdAt; 
            }
        }

        const newInvoice = {
            id: invoiceIdToSave,
            branchId: currentBranch,
            createdAt: originalInvoiceDate,
            items: JSON.parse(JSON.stringify(tab.items)),
            totalAmount: totalAmount,
            invoiceDiscount: tab.discount || 0,
            extraFee: tab.extraFee || 0,
            beerIceAmount: iceAmount,
            beerIceNote: tab.beerIceNote || "",
            customerPaid: actualPaid, 
            creator: currentUser.fullname,
            status: 'done'
        };

        if (navigator.onLine) {
            window.isSyncLocked = true;

            if (oldInv && oldInv.status === 'done') {
                oldInv.items.forEach(oldItem => {
                    const prod = latestProds.find(p => p.id === oldItem.productId);
                    if (prod) {
                        const oldRate = oldItem.units && oldItem.units[oldItem.selectedUnitIdx] ? (oldItem.units[oldItem.selectedUnitIdx].rate || 1) : 1;
                        prod.stock = (parseFloat(prod.stock) || 0) + (oldItem.qty * oldRate);
                    }
                });
                allInvoices.splice(oldInvIndex, 1);
            }

            tab.items.forEach(cartItem => {
                const prod = latestProds.find(p => p.id === cartItem.productId);
                if (prod) {
                    const rate = cartItem.units[cartItem.selectedUnitIdx]?.rate || 1;
                    prod.stock -= (cartItem.qty * rate);
                }
            });

            allInvoices.unshift(newInvoice);

            // LƯU NGAY LẬP TỨC VÀO TRONG MÁY (ĐỒNG BỘ 100% CÙNG LÚC NHẤN NÚT)
            localStorage.setItem('kv_products', JSON.stringify(latestProds));
            localStorage.setItem('kv_invoices', JSON.stringify(allInvoices));
            
            // ĐẨY TOÀN BỘ DANH SÁCH LÊN CLOUD ĐỂ ĐỒNG NHẤT
            if (typeof window.uploadToCloud === 'function') {
                window.uploadToCloud('invoices', allInvoices);
                window.uploadToCloud('products', latestProds);
            }

            if (window.autoPrintMode) window.printReceipt(newInvoice);
            else showToast(tab.isEditing ? "Cập nhật hóa đơn thành công!" : "Thanh toán thành công!", "success");

        } else {
            let pendingData = JSON.parse(localStorage.getItem('kv_pending_invoices_data')) || [];
            if (tab.isEditing && tab.oldInvId) {
                newInvoice.isEditing = true;
                newInvoice.oldInvId = tab.oldInvId;
            }
            pendingData.push(newInvoice); 
            localStorage.setItem('kv_pending_invoices_data', JSON.stringify(pendingData));
            
            if (typeof window.updateOfflineIndicator === 'function') window.updateOfflineIndicator();
            
            if (window.autoPrintMode) window.printReceipt(newInvoice); 
            showToast("Mất mạng! Hóa đơn đã được lưu an toàn vào máy chờ đồng bộ.", "warning");
        }
        
        posTabs.splice(activeTabIndex, 1); 

        if (posTabs.length === 0) {
            window.clearPOS();
        } else {
            activeTabIndex = Math.max(0, posTabs.length - 1);
            switchPOSTab(activeTabIndex);
            window.savePOSState();
        }
        
        if (typeof focusPOSSearch === 'function') focusPOSSearch();
        const searchInput = document.getElementById('pos-search-input');
        if (searchInput) searchInput.value = '';

    } catch (error) {
        console.error("Lỗi khi xử lý thanh toán:", error);
        showToast("Có lỗi xảy ra, vui lòng thử lại!", "error");
    } finally {
        window.isProcessingCheckout = false; 
        if (checkoutBtn) {
            checkoutBtn.disabled = false;
            checkoutBtn.innerHTML = 'THANH TOÁN (F9)';
        }
    }
};
window.clearPOS = function() {
    // 1. Lấy bảng giá đang được chọn trên giao diện (nếu có), nếu không có mới dùng 'default'
    const currentPbSelect = document.getElementById('pos-pricebook-select');
    const lastPriceBook = currentPbSelect ? currentPbSelect.value : 'default';

    // 2. Reset về 1 tab trống duy nhất nhưng GIỮ NGUYÊN BẢNG GIÁ
    tabCounter = 1;
    posTabs = [{ 
        id: Date.now(), 
        name: 'Hóa đơn 1', 
        items: [], 
        priceBook: lastPriceBook, // SỬA Ở ĐÂY
        discount: 0, 
        extraFee: 0 
    }];
    activeTabIndex = 0;

    // 3. XÓA SẠCH DỮ LIỆU TẠM TRONG MÁY
    localStorage.removeItem('kv_pos_state');

    // 4. Vẽ lại giao diện trắng
    renderPOSTabs();
    renderPOSCart();
    
    // Đảm bảo ô chọn bảng giá hiển thị đúng
    if (currentPbSelect) currentPbSelect.value = lastPriceBook;

    // Đưa các ô nhập giảm giá/phí về 0
    if (document.getElementById('pos-discount')) document.getElementById('pos-discount').value = '0';
    if (document.getElementById('pos-extra-fee')) document.getElementById('pos-extra-fee').value = '0';

    console.log("🧹 Đã dọn sạch bộ nhớ POS, giữ lại bảng giá: " + lastPriceBook);
};



function togglePOSMenu() {
    const menu = document.getElementById('pos-hamburger-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}
// TỰ ĐỘNG ĐÓNG MENU 3 GẠCH KHI CLICK RA NGOÀI
document.addEventListener('click', function(e) {
    const menu = document.getElementById('pos-hamburger-menu');
    
    // Nếu menu đang mở
    if (menu && menu.style.display === 'block') {
        // Kiểm tra xem vị trí người dùng bấm vào có phải là nút 3 gạch hay không
        const isClickOnTrigger = e.target.closest('[onclick="togglePOSMenu()"]');
        
        // Nếu không bấm vào bên trong menu VÀ không bấm vào nút 3 gạch -> Đóng menu
        if (!menu.contains(e.target) && !isClickOnTrigger) {
            menu.style.display = 'none';
        }
    }
});
function showShortcutModal() {
    document.getElementById('shortcut-modal').style.display = 'flex';
}


// ==========================================
// TÍNH NĂNG BỘ LỌC TỒN KHO (TAB THIẾT LẬP GIÁ)
// ==========================================
window.handlePriceStockFilterChange = function() {
    const filterVal = document.getElementById('price-stock-filter').value;
    const customRange = document.getElementById('price-custom-stock-range');
    
    if (customRange) {
        customRange.style.display = (filterVal === 'custom') ? 'flex' : 'none';
    }
    
    window.currentPricePage = 1; // Đưa về trang 1 chống lỗi kẹt trang
    window.renderPriceSetupTable();
};

/**
 * Chức năng chỉnh sửa hóa đơn: Đưa các mặt hàng ngược lại giỏ hàng POS
 * @param {string} invId - Mã hóa đơn cần sửa
 */
window.editInvoice = function(invId) {
    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    const inv = allInvoices.find(x => x.id === invId);
    
    if (!inv) return;

    showConfirm(`Bạn muốn chỉnh sửa hóa đơn <b>${invId}</b>? Hệ thống sẽ nạp lại hàng vào màn hình Bán hàng.`, function() {
        switchToPOS(); // Chuyển sang màn hình bán hàng

        const newTab = {
            id: Date.now(),
            name: `Sửa ${inv.id}`,
            items: JSON.parse(JSON.stringify(inv.items)),
            priceBook: inv.priceBook || 'default',
            discount: inv.invoiceDiscount || 0,
            extraFee: inv.extraFee || 0,
            isEditing: true,
            oldInvId: inv.id
        };

        posTabs.push(newTab);
        activeTabIndex = posTabs.length - 1;

        renderPOSTabs();
        renderPOSCart();
        savePOSState();
    });
};
function printInvoice(invId) {
    // 1. Lấy danh sách hóa đơn MỚI NHẤT trực tiếp từ bộ nhớ máy
    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    const inv = allInvoices.find(x => x.id === invId);
    
    if (!inv) {
        alert("Không tìm thấy hóa đơn!");
        return;
    }

    // 2. Tính toán lại số tiền Khách Trả (đề phòng dữ liệu hóa đơn cũ lưu bị thiếu trường này)
    if (inv.customerPaid === undefined) {
        inv.customerPaid = (inv.totalAmount || 0) - (inv.invoiceDiscount || 0) + (inv.extraFee || 0) + (inv.beerIceAmount || 0);
    }

    // 3. Gọi trực tiếp hàm in mẫu chuẩn của trang Bán hàng (POS)
    if (typeof window.printReceipt === 'function') {
        window.printReceipt(inv);
    } else {
        alert("Lỗi: Không tìm thấy mẫu in hóa đơn!");
    }
}
function refundInvoice(invId) {
    const inv = invoices.find(x => x.id === invId);
    if (!inv) return;

    if (confirm(`Thực hiện trả hàng cho hóa đơn ${invId}? Hàng sẽ được cộng lại vào kho.`)) {
        // Chuyển sang POS
        switchToPOS();

        // Nạp vào giỏ hàng với số lượng dương (để khi thanh toán trả hàng, ta xử lý riêng hoặc coi như nhập lại)
        tabCounter++;
        const refundTab = {
            id: Date.now(),
            name: `Trả ${inv.id}`,
            items: JSON.parse(JSON.stringify(inv.items)),
            priceBook: inv.priceBook || 'default',
            discount: inv.invoiceDiscount || 0,
            isRefund: true,
            oldInvId: inv.id
        };

        posTabs.push(refundTab);
        activeTabIndex = posTabs.length - 1;
        renderPOSTabs();
        renderPOSCart();
    }
}



// 3. Hàm bổ sung: Đẩy tài khoản lên Cloud (Giải quyết câu hỏi trước của bạn)
function syncAccountsToFirebase() {
    if (window.fbSet && window.fbDb) {
        window.fbSet(window.fbRef(window.fbDb, 'accounts'), accounts);
    }
}
window.uploadToCloud = function(path, data) {
    if (!navigator.onLine) {
        showToast("Máy mất mạng! Dữ liệu không thể đồng bộ về nhà.", "error");
        return;
    }

    if (window.fbSet && window.fbDb) {
        window.fbSet(window.fbRef(window.fbDb, path), data)
            .then(() => {
                window.isSyncLocked = false;
                showToast(`Đã đồng bộ ${path} lên Cloud thành công`, "success");
            })
            .catch((err) => {
                window.isSyncLocked = false;
                showToast("Lỗi Firebase: " + err.message, "error");
            });
    }
};

window.uploadSingleInvoice = function(invoice) {
    if (!navigator.onLine) return;
    if (window.fbSet && window.fbDb && window.fbRef) {
        window.fbSet(window.fbRef(window.fbDb, 'invoices/' + invoice.id), invoice)
            .then(() => {
                window.isSyncLocked = false;
            })
            .catch(err => {
                window.isSyncLocked = false;
                console.error("Lỗi đồng bộ Firebase:", err);
            });
    }
};


window.deleteProduct = function(productId, productName) {
    showConfirm(`Bạn có chắc muốn xóa vĩnh viễn hàng hóa: <b>${productName}</b>?`, function() {
        // Lọc bỏ sản phẩm khỏi mảng
        let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        allProducts = allProducts.filter(p => p.id !== productId);
        
        window.products = allProducts;
        localStorage.setItem('kv_products', JSON.stringify(allProducts));
        
        // Đồng bộ xóa lên Firebase
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', allProducts);
        }
        
        showToast("Đã xóa hàng hóa thành công", "success");
        renderProductList(); 
    });
};
window.deleteProductUnit = function(productId, uIdx, productName, unitName) {
    let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    let allPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    
    const pIndex = allProducts.findIndex(p => p.id === productId);
    if (pIndex === -1) return;

    // TRƯỜNG HỢP 1: NẾU LÀ ĐƠN VỊ CƠ BẢN (XÓA TOÀN BỘ)
    if (uIdx === 0) {
        showConfirm(`<b>${unitName}</b> là đơn vị cơ bản.<br>Việc xóa đơn vị này sẽ <b>XÓA TOÀN BỘ</b> mặt hàng <b>${productName}</b>.<br><br>Bạn có chắc chắn muốn xóa không?`, function() {
            allProducts.splice(pIndex, 1);
            
            // Dọn dẹp giá rác trong Bảng giá
            allPriceBooks.forEach(pb => {
                if (pb.prices) {
                    Object.keys(pb.prices).forEach(key => {
                        if (key === productId || key.startsWith(productId + '_')) {
                            delete pb.prices[key];
                        }
                    });
                }
            });

            localStorage.setItem('kv_products', JSON.stringify(allProducts));
            localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
            window.products = allProducts;
            window.priceBooks = allPriceBooks;
            
            if (typeof window.uploadToCloud === 'function') {
                window.uploadToCloud('products', allProducts);
                window.uploadToCloud('pricebooks', allPriceBooks);
            }
            
            showToast(`Đã xóa toàn bộ mặt hàng ${productName}`, "success");
            renderProductList();
        });
    } 
    // TRƯỜNG HỢP 2: NẾU LÀ ĐƠN VỊ PHỤ (CHỈ XÓA NÓ)
    else {
        showConfirm(`Bạn có chắc muốn xóa đơn vị quy đổi <b>${unitName}</b> của mặt hàng <b>${productName}</b>?`, function() {
            const oldUnitsLength = allProducts[pIndex].units.length;
            
            // Cắt đơn vị phụ đó ra khỏi mảng
            allProducts[pIndex].units.splice(uIdx, 1);
            
            // Xử lý dồn Bảng giá: Vì mảng units bị thụt đi 1, nên ID của bảng giá (Ví dụ: SP01_2) cũng phải lùi lại thành SP01_1 để không bị hiển thị sai giá
            let isPbChanged = false;
            allPriceBooks.forEach(pb => {
                if (pb.prices) {
                    // Xóa giá của đơn vị hiện tại
                    if (pb.prices[`${productId}_${uIdx}`] !== undefined) {
                        delete pb.prices[`${productId}_${uIdx}`];
                        isPbChanged = true;
                    }
                    // Đẩy giá của các đơn vị nằm sau nó lên 1 bậc
                    for (let i = uIdx + 1; i < oldUnitsLength; i++) {
                        if (pb.prices[`${productId}_${i}`] !== undefined) {
                            pb.prices[`${productId}_${i - 1}`] = pb.prices[`${productId}_${i}`];
                            delete pb.prices[`${productId}_${i}`];
                            isPbChanged = true;
                        }
                    }
                }
            });

            // Lưu dữ liệu lại
            localStorage.setItem('kv_products', JSON.stringify(allProducts));
            window.products = allProducts;
            
            if (isPbChanged) {
                localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
                window.priceBooks = allPriceBooks;
            }

            if (typeof window.uploadToCloud === 'function') {
                window.uploadToCloud('products', allProducts);
                if (isPbChanged) window.uploadToCloud('pricebooks', allPriceBooks);
            }
            
            showToast(`Đã xóa đơn vị ${unitName}`, "success");
            renderProductList();
        });
    }
};
// File kết thúc tại đây, không có thêm dấu ngoặc nào bên dưới
// ==========================================
// TÍNH NĂNG NHẬP HÀNG LOẠT (PASTE EXCEL)
// ==========================================

window.openBulkImportModal = function() {
    document.getElementById('bulk-import-data').value = '';
    document.getElementById('bulk-import-modal').style.display = 'flex';
};

window.closeBulkImportModal = function() {
    document.getElementById('bulk-import-modal').style.display = 'none';
};

window.processBulkImport = function() {
    const rawText = document.getElementById('bulk-import-data').value;
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001'; // Lấy chi nhánh hiện tại[cite: 8]
    
    if (!rawText.trim()) { alert("Vui lòng dán dữ liệu!"); return; }

    const lines = rawText.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
    
    const colMap = {
        code: headers.findIndex(h => h.includes('mã hàng')),
        name: headers.findIndex(h => h.includes('tên hàng')),
        price: headers.findIndex(h => h.includes('giá bán')),
        cost: headers.findIndex(h => h.includes('giá vốn')),
        stock: headers.findIndex(h => h.includes('tồn kho'))
    };

    let newProducts = [];
    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        if (!cols[colMap.name]) continue;

        const price = parseFloat(cols[colMap.price]?.replace(/\./g, '')) || 0;
        newProducts.push({
            id: 'ID' + Date.now() + i,
            branchId: currentBranch, // Hàng nhập vào thuộc về chi nhánh hiện tại[cite: 8]
            code: cols[colMap.code]?.trim() || ('HH' + Date.now() + i),
            name: cols[colMap.name].trim(),
            price: price,
            cost: parseFloat(cols[colMap.cost]?.replace(/\./g, '')) || 0,
            stock: parseFloat(cols[colMap.stock]) || 0,
            units: [{ name: 'Cái', rate: 1, isBase: true, price: price }]
        });
    }

    if (newProducts.length > 0) {
        let currentProds = JSON.parse(localStorage.getItem('kv_products')) || [];
        window.products = [...currentProds, ...newProducts];
        localStorage.setItem('kv_products', JSON.stringify(window.products));
        if (window.uploadToCloud) window.uploadToCloud('products', window.products);
        alert(`Đã nhập thành công ${newProducts.length} mặt hàng cho chi nhánh ${currentBranch}!`);
        closeBulkImportModal();
        renderProductList();
    }
};
window.updateGroupsFromImport = function(importedProds) {
    // 1. Lấy danh sách nhóm hiện tại từ bộ nhớ máy
    let groups = JSON.parse(localStorage.getItem('kv_groups')) || [];
    let isChanged = false;

    // 2. Duyệt qua từng sản phẩm mới được dán vào
    importedProds.forEach(p => {
        // Kiểm tra xem sản phẩm này có thông tin nhóm (dạng chữ) không
        if (p.group && p.group.trim() !== '') {
            // Hỗ trợ bóc tách nhóm đa cấp (ví dụ: "Bánh kẹo >> Bánh quy")
            const groupPath = p.group.split('>>').map(g => g.trim());
            let currentParentId = null;

            // Duyệt qua từng cấp của tên nhóm để tạo cấu trúc cây
            groupPath.forEach(gName => {
                // Tìm xem nhóm có tên này và cùng cấp cha đã tồn tại chưa
                let existingGroup = groups.find(g => g.name === gName && g.parentId === currentParentId);
                
                if (!existingGroup) {
                    // Nếu chưa có, tạo mới ID và lưu vào danh sách nhóm hệ thống
                    const newGroupId = 'g_' + Date.now() + Math.floor(Math.random() * 1000);
                    existingGroup = {
                        id: newGroupId,
                        name: gName,
                        parentId: currentParentId
                    };
                    groups.push(existingGroup);
                    isChanged = true;
                }
                // Chuyển cấp cha xuống nhóm vừa tìm được/tạo được để xét cấp tiếp theo
                currentParentId = existingGroup.id;
            });
            
            // QUAN TRỌNG: Gán lại ID nhóm cuối cùng cho sản phẩm (thay thế tên chữ)
            // Điều này giúp bộ lọc Sidebar có thể khớp dữ liệu
            p.group = currentParentId;
        } else {
            // Nếu không có tên nhóm, để trống ID
            p.group = '';
        }
    });

    // 3. Nếu có nhóm mới được tạo, lưu lại và cập nhật giao diện
    if (isChanged) {
        // Cập nhật biến toàn cục và LocalStorage
        window.productGroups = groups;
        localStorage.setItem('kv_groups', JSON.stringify(groups));
        
        // Đồng bộ lên Firebase Cloud (nếu có mạng)
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('groups', groups);
        }

        // Kích hoạt vẽ lại Sidebar và Modal để hiện danh sách nhóm mới
        if (typeof window.renderGroupData === 'function') {
            window.renderGroupData();
        }
        
        console.log("✅ Đã tự động khởi tạo danh mục nhóm hàng mới từ Excel.");
    }
};
// Hàm vẽ giao diện nút phân trang dùng chung cho mọi Tab
window.renderPaginationControls = function(containerId, currentPage, totalPages, functionName) {
    const paginationDiv = document.getElementById(containerId);
    if (!paginationDiv) return;
    
    if (totalPages <= 1) {
        paginationDiv.innerHTML = `<span style="font-size: 13px; color: #888;">Hiển thị tất cả</span>`;
        return;
    }

    let html = `<span style="font-size: 13px; color: #555; margin-right: 15px;">Trang <b>${currentPage}</b> / ${totalPages}</span>`;
    html += `<button onclick="${functionName}(${currentPage - 1})" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-action-outline"><i class="fa-solid fa-chevron-left"></i> Trước</button>`;
    html += `<button onclick="${functionName}(${currentPage + 1})" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : 'style="cursor:pointer;"'} class="btn-action-outline" style="margin-left: 8px;">Sau <i class="fa-solid fa-chevron-right"></i></button>`;
    
    paginationDiv.innerHTML = html;
};
// ==========================================
// TÍNH NĂNG TỰ ĐỘNG ẨN/HIỆN SỐ 0 KHI NHẬP LIỆU (UX TỐI ƯU)
// ==========================================

// 1. Xóa số 0 khi click chuột (hoặc dùng phím Tab) vào ô nhập liệu
document.addEventListener('focusin', function(e) {
    if (e.target.tagName === 'INPUT') {
        // [FIX] Loại trừ các ô tìm kiếm ra khỏi tính năng này
        if (e.target.id && e.target.id.toLowerCase().includes('search')) return;

        // Nếu ô đang chứa đúng số 0 thì xóa trắng để gõ luôn
        if (e.target.value === '0') {
            e.target.value = '';
            e.target.dataset.autoZero = 'true'; // Đánh dấu ô này đã từng tự động xóa 0
        }
    }
});

// 2. Điền lại số 0 nếu click chuột ra ngoài mà để trống
document.addEventListener('focusout', function(e) {
    if (e.target.tagName === 'INPUT') {
        // [FIX] Loại trừ các ô tìm kiếm, xóa cờ autoZero nếu lỡ bị dính
        if (e.target.id && e.target.id.toLowerCase().includes('search')) {
            delete e.target.dataset.autoZero;
            return;
        }

        // Kiểm tra xem đây có phải là ô chuyên nhập số lượng / tiền tệ không
        const isNumericInput = e.target.type === 'number' || 
                               (e.target.getAttribute('oninput') || '').includes('formatCurrency') || 
                               e.target.dataset.autoZero === 'true';
        
        // Nếu người dùng để trống ô nhập số, tự động trả về 0
        if (e.target.value.trim() === '' && isNumericInput) {
            e.target.value = '0';
            
            // Tự động kích hoạt lại các hàm tính toán tổng tiền, định dạng tiền tệ
            e.target.dispatchEvent(new Event('input', { bubbles: true }));
            e.target.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
});
// ==========================================
// TÍNH NĂNG: BÁO CÁO DOANH THU CUỐI NGÀY TỐI ƯU
// ==========================================
// ==========================================
// TÍNH NĂNG: BÁO CÁO DOANH THU CUỐI NGÀY TỐI ƯU (CÓ PHÂN TRANG)
// ==========================================

window.currentReportPage = 1; // Khai báo biến lưu trang hiện tại

window.openEndOfDayReport = function() {
    window.currentReportPage = 1; // Reset về trang 1 khi mở lại báo cáo
    document.getElementById('report-modal').style.display = 'flex';
    
    // --- MỚI: Lấy mã chi nhánh đang hoạt động ---
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';

    // 1. Lấy danh sách nhân viên để nạp vào bộ lọc (CHỈ LỌC NHÂN VIÊN CỦA CHI NHÁNH)
    const sellerSelect = document.getElementById('report-seller-filter');
    const allAccounts = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    let sellerHtml = '<option value="all">Tất cả nhân viên</option>';
    
    allAccounts.forEach(acc => {
        if (!acc) return;
        // Kiểm tra xem nhân viên có quyền ở chi nhánh hiện tại không
        const isBelongToBranch = (acc.branchIds && acc.branchIds.includes(currentBranch)) || (acc.branchId === currentBranch);
        
        // Luôn hiển thị tài khoản admin gốc, hoặc các tài khoản thuộc chi nhánh
        if (isBelongToBranch || acc.username === 'admin') {
            sellerHtml += `<option value="${acc.fullname}">${acc.fullname} (${acc.username})</option>`;
        }
    });
    sellerSelect.innerHTML = sellerHtml;

    // 2. Thiết lập thời gian mặc định là Hôm nay
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    
    document.getElementById('report-date-day').value = `${yyyy}-${mm}-${dd}`;
    document.getElementById('report-date-month').value = `${yyyy}-${mm}`;
    document.getElementById('report-date-year').value = yyyy;
    
    window.toggleReportDateInput();
};

window.toggleReportDateInput = function() {
    window.currentReportPage = 1; // Reset về trang 1 mỗi khi đổi kiểu lọc
    const type = document.getElementById('report-filter-type').value;
    document.getElementById('report-date-day').style.display = type === 'day' ? 'block' : 'none';
    document.getElementById('report-date-month').style.display = type === 'month' ? 'block' : 'none';
    document.getElementById('report-date-year').style.display = type === 'year' ? 'block' : 'none';
    
    window.generateEndOfDayReport();
};
window.generateEndOfDayReport = function() {
    const type = document.getElementById('report-filter-type').value;
    const seller = document.getElementById('report-seller-filter').value;
    const tbody = document.getElementById('report-tbody');
    
    // --- MỚI: Lấy mã chi nhánh đang hoạt động ---
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    
    // Lấy giá trị thời gian người dùng đang chọn
    let targetStr = '';
    if (type === 'day') targetStr = document.getElementById('report-date-day').value; 
    else if (type === 'month') targetStr = document.getElementById('report-date-month').value; 
    else if (type === 'year') targetStr = document.getElementById('report-date-year').value; 

    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    
    let filteredInvoices = [];
    let totalRevenue = 0;
    let totalDiscount = 0;
    let totalNet = 0;

    // BƯỚC 1: LỌC HÓA ĐƠN & TÍNH TỔNG TIỀN (Chạy qua toàn bộ dữ liệu)
    allInvoices.forEach(inv => {
        if (inv.status !== 'done') return; 

        // --- MỚI: Chỉ lấy doanh thu của chi nhánh hiện tại ---
        if ((inv.branchId || 'CN001') !== currentBranch) return;

        // Lọc theo nhân viên
        if (seller !== 'all' && inv.creator !== seller.split(' (')[0]) return;

        // Xử lý chuỗi thời gian chống lỗi iPhone
        let invDateStr = '';
        let y, m, d;
        const match = inv.createdAt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (match) {
            d = match[1]; m = match[2]; y = match[3];
        } else {
            const parts = inv.createdAt.match(/\d+/g);
            if (parts && parts.length >= 3) {
                const yIdx = parts.findIndex(p => p.length === 4);
                if (yIdx >= 2) { d = parts[yIdx-2]; m = parts[yIdx-1]; y = parts[yIdx]; }
                else if (yIdx === 0) { y = parts[0]; m = parts[1]; d = parts[2]; }
            }
        }

        if (y && m && d) {
            const dd = String(d).padStart(2, '0');
            const mm = String(m).padStart(2, '0');
            if (type === 'day') invDateStr = `${y}-${mm}-${dd}`;
            else if (type === 'month') invDateStr = `${y}-${mm}`;
            else if (type === 'year') invDateStr = `${y}`;
        }

        // So sánh thời gian
        if (targetStr && invDateStr !== targetStr) return; 

        // Nếu qua được các bộ lọc -> Tính tiền và Đưa vào mảng
        const amount = inv.totalAmount || 0;
        const discount = inv.invoiceDiscount || 0;
        const net = amount - discount;

        totalRevenue += amount;
        totalDiscount += discount;
        totalNet += net;

        filteredInvoices.push(inv);
    });

    // CẬP NHẬT 3 Ô TỔNG TIỀN PHÍA TRÊN
    document.getElementById('report-sum-revenue').innerText = totalRevenue.toLocaleString('vi-VN');
    document.getElementById('report-sum-discount').innerText = totalDiscount.toLocaleString('vi-VN');
    document.getElementById('report-sum-net').innerText = totalNet.toLocaleString('vi-VN');

    // BƯỚC 2: LOGIC PHÂN TRANG CHO BẢNG (Giới hạn 40 dòng)
    const itemsPerPage = 40;
    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    if (window.currentReportPage > totalPages) window.currentReportPage = totalPages || 1;
    if (window.currentReportPage < 1) window.currentReportPage = 1;

    const startIndex = (window.currentReportPage - 1) * itemsPerPage;
    const paginatedInvoices = filteredInvoices.slice(startIndex, startIndex + itemsPerPage);

    // BƯỚC 3: VẼ BẢNG HTML
    let html = '';
    if (filteredInvoices.length === 0) {
        html = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #888;">Không có giao dịch bán hàng nào khớp với điều kiện lọc tại chi nhánh này</td></tr>`;
        document.getElementById('report-pagination').innerHTML = ''; // Ẩn phân trang
    } else {
        paginatedInvoices.forEach(inv => {
            const amount = inv.totalAmount || 0;
            const discount = inv.invoiceDiscount || 0;
            const net = amount - discount;

            html += `
                <tr style="border-bottom: 1px dashed #eee; transition: 0.2s;">
                    <td style="color:var(--kv-blue); font-weight:bold;">${inv.id}</td>
                    <td style="color: #555;">${inv.createdAt}</td>
                    <td><i class="fa-solid fa-user-tag" style="color: #ccc; margin-right: 5px;"></i>${inv.creator}</td>
                    <td style="text-align:right;">${amount.toLocaleString('vi-VN')}</td>
                    <td style="text-align:right;">${discount.toLocaleString('vi-VN')}</td>
                    <td style="text-align:right; font-weight:bold; color:#28a745;">${net.toLocaleString('vi-VN')}</td>
                </tr>
            `;
        });
        
        // Gọi lại hàm vẽ nút bấm (Hàm này đã có sẵn ở dưới cùng file script.js)
        window.renderPaginationControls('report-pagination', window.currentReportPage, totalPages, 'changeReportPage');
    }

    document.getElementById('report-tbody').innerHTML = html;
};

// Hàm xử lý khi bấm nút chuyển trang trong báo cáo
window.changeReportPage = function(newPage) {
    window.currentReportPage = newPage;
    window.generateEndOfDayReport();
};
// ==========================================
// TỔNG QUAN (DASHBOARD) - HOẠT ĐỘNG & THỐNG KÊ
// ==========================================

window.renderDashboard = function() {
    renderDashboardSummary();
    renderActivityFeed();
};

window.renderDashboardSummary = function() {
    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';

const extractDate = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) return { d: parseInt(match[1]), m: parseInt(match[2]), y: parseInt(match[3]) };
    
    // Vá lỗi iPhone dùng chữ "thg" hoặc "tháng" (VD: 22 thg 8, 2026)
    const parts = timeStr.match(/\d+/g);
    if (parts && parts.length >= 3) {
        const yIdx = parts.findIndex(p => p.length === 4);
        if (yIdx >= 2) return { d: parseInt(parts[yIdx-2]), m: parseInt(parts[yIdx-1]), y: parseInt(parts[yIdx]) };
        else if (yIdx === 0) return { y: parseInt(parts[0]), m: parseInt(parts[1]), d: parseInt(parts[2]) };
    }
    return null;
};

    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    const isSameDay = (dateObj1, dateObj2) => {
        if (!dateObj1 || !dateObj2) return false;
        return dateObj1.d === dateObj2.getDate() && 
               dateObj1.m === (dateObj2.getMonth() + 1) && 
               dateObj1.y === dateObj2.getFullYear();
    };

    const isSameMonth = (dateObj1, dateObj2) => {
        if (!dateObj1 || !dateObj2) return false;
        return dateObj1.m === (dateObj2.getMonth() + 1) && 
               dateObj1.y === dateObj2.getFullYear();
    };

    let todayRev = 0, yesterdayRev = 0, lastMonthRev = 0, todayReturn = 0;

    allInvoices.forEach(inv => {
        // Hỗ trợ dữ liệu cũ: Nếu không có branchId thì mặc định là CN001
        const invBranch = inv.branchId || 'CN001';
        if (invBranch !== currentBranch) return;

        if (inv.status === 'done') {
            const amount = (inv.totalAmount || 0) - (inv.invoiceDiscount || 0);
            const invDate = extractDate(inv.createdAt);
            if (!invDate) return;

            if (isSameDay(invDate, today)) {
                if (amount < 0) todayReturn += Math.abs(amount);
                else todayRev += amount;
            } else if (isSameDay(invDate, yesterday)) {
                if (amount >= 0) yesterdayRev += amount;
            } else if (isSameMonth(invDate, lastMonth)) {
                if (amount >= 0) lastMonthRev += amount;
            }
        }
    });

    const calcPercent = (current, past) => {
        if (past === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - past) / past) * 100);
    };

    const percentYesterday = calcPercent(todayRev, yesterdayRev);
    const percentLastMonth = calcPercent(todayRev, lastMonthRev);

    const summaryValues = document.querySelectorAll('#tab-tong-quan .sum-value');
    if (summaryValues.length >= 4) {
        summaryValues[0].innerText = todayRev.toLocaleString('vi-VN');
        summaryValues[1].innerText = todayReturn.toLocaleString('vi-VN');
        summaryValues[2].innerHTML = `<span style="color:${percentYesterday >= 0 ? '#5cb85c' : '#d9534f'}">${percentYesterday >= 0 ? '↑' : '↓'} ${Math.abs(percentYesterday)}%</span>`;
        summaryValues[3].innerHTML = `<span style="color:${percentLastMonth >= 0 ? '#5cb85c' : '#d9534f'}">${percentLastMonth >= 0 ? '↑' : '↓'} ${Math.abs(percentLastMonth)}%</span>`;
    }
    
    const bigRevenue = document.querySelector('#tab-tong-quan .widget-title span');
    if (bigRevenue) bigRevenue.innerText = todayRev.toLocaleString('vi-VN');

    render7DaysChart(allInvoices.filter(inv => (inv.branchId || 'CN001') === currentBranch), today);
};

// Hàm con: Vẽ biểu đồ cột bằng HTML/CSS thuần (Không làm nặng web)
function render7DaysChart(invoices, today) {
    const chartContainer = document.querySelector('.chart-placeholder');
    if (!chartContainer) return;

    let days = [];
    let maxRev = 0;

const extractDate = (timeStr) => {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
    if (match) return { d: parseInt(match[1]), m: parseInt(match[2]), y: parseInt(match[3]) };
    
    // Vá lỗi iPhone dùng chữ "thg" hoặc "tháng" (VD: 22 thg 8, 2026)
    const parts = timeStr.match(/\d+/g);
    if (parts && parts.length >= 3) {
        const yIdx = parts.findIndex(p => p.length === 4);
        if (yIdx >= 2) return { d: parseInt(parts[yIdx-2]), m: parseInt(parts[yIdx-1]), y: parseInt(parts[yIdx]) };
        else if (yIdx === 0) return { y: parseInt(parts[0]), m: parseInt(parts[1]), d: parseInt(parts[2]) };
    }
    return null;
};

    const isSameDay = (dateObj1, dateObj2) => {
        if (!dateObj1 || !dateObj2) return false;
        return dateObj1.d === dateObj2.getDate() && 
               dateObj1.m === (dateObj2.getMonth() + 1) && 
               dateObj1.y === dateObj2.getFullYear();
    };

    // Lấy dữ liệu của 7 ngày lùi về trước
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 86400000);
        const dStr = String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0');
        
        let rev = 0;
        invoices.forEach(inv => {
            if (inv.status === 'done') {
                const invDate = extractDate(inv.createdAt);
                if (isSameDay(invDate, d)) {
                    const amount = (inv.totalAmount || 0) - (inv.invoiceDiscount || 0);
                    if (amount > 0) rev += amount;
                }
            }
        });

        if (rev > maxRev) maxRev = rev;
        days.push({ label: dStr, value: rev });
    }

    // Chống lỗi chia cho 0 nếu chưa có doanh thu
    if (maxRev === 0) maxRev = 100000; 

    // Tạo các cột biểu đồ
    let barsHtml = '';
    days.forEach(day => {
        const heightPct = Math.max((day.value / maxRev) * 100, 2); // Cột thấp nhất là 2% để hiển thị
        const displayVal = day.value > 0 ? (day.value / 1000).toFixed(0) + 'k' : '0'; // Hiển thị 100k, 200k...
        
        barsHtml += `
            <div style="display: flex; flex-direction: column; justify-content: flex-end; align-items: center; height: 100%; gap: 10px;">
                <div style="font-size: 11px; color: #888; font-weight: bold;" title="${day.value.toLocaleString('vi-VN')} đ">${displayVal}</div>
                <div style="width: 35px; height: ${heightPct}%; background: linear-gradient(to top, #007bff, #66b0ff); border-radius: 4px 4px 0 0; transition: height 1s ease-out; box-shadow: 2px 0 5px rgba(0,0,0,0.1);"></div>
                <div style="font-size: 11px; font-weight: bold; color: #555;">${day.label}</div>
            </div>
        `;
    });

    // Thay thế placeholder bằng biểu đồ thật
    chartContainer.style.background = 'white';
    chartContainer.style.border = 'none';
    chartContainer.innerHTML = `
        <div style="display: flex; justify-content: space-around; align-items: flex-end; height: 220px; width: 100%; padding: 0 20px; margin-top: 10px;">
            ${barsHtml}
        </div>
        <div style="text-align: center; font-size: 12px; color: #888; margin-top: 15px; font-style: italic;">
            Biểu đồ doanh thu 7 ngày gần nhất (Đơn vị: Nghìn VNĐ)
        </div>
    `;
}

window.renderActivityFeed = function() {
    const feedContainer = document.querySelector('.activity-feed');
    if (!feedContainer) return;

    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    const allImportOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
    const allInventoryChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];

    let activities = [];
    
    // Dùng chung hàm parseVNTime đã được vá lỗi iPhone
    const parseVNTime = window.parseVNTime;

    // Lọc Hóa đơn
    allInvoices.filter(inv => (inv.branchId || 'CN001') === currentBranch).forEach(inv => {
        activities.push({ type: 'invoice', id: inv.id, creator: inv.creator, timeStr: inv.createdAt, timestamp: parseVNTime(inv.createdAt), amount: (inv.totalAmount || 0) - (inv.invoiceDiscount || 0), status: inv.status });
    });

    // Lọc Nhập hàng
    allImportOrders.filter(io => (io.branchId || 'CN001') === currentBranch).forEach(io => {
        activities.push({ type: 'import', id: io.id, creator: io.creator, timeStr: io.createdAt, timestamp: io.timestamp || parseVNTime(io.createdAt), amount: io.mustPay || 0, status: io.status });
    });

    // Lọc Kiểm kho
    allInventoryChecks.filter(ic => (ic.branchId || 'CN001') === currentBranch).forEach(ic => {
        activities.push({ type: 'inventory', id: ic.code, creator: ic.creator, timeStr: new Date(ic.id).toLocaleString('vi-VN'), timestamp: ic.id, amount: 0, status: ic.status });
    });

    activities.sort((a, b) => b.timestamp - a.timestamp);
    const recent = activities.slice(0, 20);

    if (recent.length === 0) {
        feedContainer.innerHTML = `<div class="empty-data"><p>Không có hoạt động tại chi nhánh này</p></div>`;
        return;
    }

    feedContainer.innerHTML = recent.map(act => `
        <div style="display: flex; gap: 15px; margin-bottom: 15px; border-bottom: 1px solid #f5f5f5; padding-bottom: 10px;">
            <div style="font-size: 13px; flex: 1;">
                <strong>${act.id}</strong> - ${act.type === 'invoice' ? 'Bán hàng' : act.type === 'import' ? 'Nhập hàng' : 'Kiểm kho'}
                <div style="color: #888; font-size: 11px;">${act.timeStr} - ${act.creator}</div>
            </div>
            <div style="font-weight: bold; color: ${act.type === 'invoice' ? '#28a745' : '#dc3545'}">
                ${act.type === 'inventory' ? '' : (act.type === 'invoice' ? '+' : '-') + act.amount.toLocaleString()}
            </div>
        </div>
    `).join('');
};
window.printReceipt = function(invoice) {
    let printSection = document.getElementById('print-section');
    if (!printSection) {
        printSection = document.createElement('div');
        printSection.id = 'print-section';
        document.body.appendChild(printSection);
    }

    // 1. Tạo danh sách hàng hóa trong hóa đơn
    let itemsHtml = '';
    invoice.items.forEach(item => {
        // Thêm biểu tượng bông tuyết nếu món hàng đó có tính tiền lạnh
        const iceIcon = item.isIce ? ' ❄️' : '';
        itemsHtml += `
            <tr>
                <td style="padding: 8px 0; font-size: 15px; line-height: 1.4;">${item.name}${iceIcon}</td>
                <td style="text-align: center; padding: 8px 0; font-size: 15px;">${item.qty}</td>
                <td style="text-align: right; padding: 8px 0; font-size: 15px; font-weight: bold;">${(item.qty * item.price).toLocaleString('vi-VN')}</td>
            </tr>
        `;
    });

    // 2. Xử lý hiển thị Tiền bia lạnh (nếu có)
    let beerIceHtml = "";
    if (invoice.beerIceAmount > 0) {
        beerIceHtml = `
            <div style="display: flex; justify-content: space-between; font-style: italic; color: #333; font-size: 15px; margin-top: 5px;">
                <span>Tiền bia lạnh (${invoice.beerIceNote}):</span>
                <span>${invoice.beerIceAmount.toLocaleString('vi-VN')}</span>
            </div>
        `;
    }

    // 3. Xây dựng mẫu hóa đơn in
    printSection.innerHTML = `
        <div style="width: 100%; font-family: 'Segoe UI', Arial, sans-serif; color: #000; padding: 10px;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase;">Hóa Đơn Bán Hàng</h2>
                <div style="border-top: 2px dashed #000; margin: 15px 0;"></div>
            </div>

            <div style="font-size: 15px; margin-bottom: 15px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Mã HĐ: <strong>${invoice.id}</strong></span>
                </div>
                <div>Thời gian: ${invoice.createdAt}</div>
            </div>

            <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px;">
                <thead>
                    <tr style="border-bottom: 2px solid #000;">
                        <th style="text-align: left; padding-bottom: 10px; font-size: 15px;">Tên hàng</th>
                        <th style="text-align: center; padding-bottom: 10px; font-size: 15px; width: 40px;">SL</th>
                        <th style="text-align: right; padding-bottom: 10px; font-size: 15px; width: 100px;">Thành tiền</th>
                    </tr>
                </thead>
                <tbody>
                    ${itemsHtml}
                </tbody>
            </table>

            <div style="border-top: 2px dashed #000; margin: 15px 0;"></div>

            <div style="font-size: 16px; line-height: 1.8;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Tổng tiền hàng:</span>
                    <span>${invoice.totalAmount.toLocaleString('vi-VN')}</span>
                </div>
                
                ${beerIceHtml}

                <div style="display: flex; justify-content: space-between;">
                    <span>Giảm giá:</span>
                    <span>${(invoice.invoiceDiscount || 0).toLocaleString('vi-VN')}</span>
                </div>

                <div style="display: flex; justify-content: space-between; font-size: 22px; font-weight: bold; margin-top: 10px; border-top: 1px solid #000; padding-top: 10px;">
                    <span>KHÁCH TRẢ:</span>
                    <span>${invoice.customerPaid.toLocaleString('vi-VN')}</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px; font-size: 16px; font-style: italic;">
                <p>Cảm ơn Quý khách. Hẹn gặp lại!</p>
            </div>
        </div>
    `;

    // 4. Lệnh in
    window.print();
};
// ==========================================
// TÍNH NĂNG IN HÓA ĐƠN & PHÍM TẮT F2
// ==========================================

// Biến trạng thái: Mặc định là Tắt (Hỏi trước khi in)
window.autoPrintMode = false;

// 1. Tự động vẽ Nút trạng thái lên màn hình
window.initPrintStatusUI = function() {
    let statusDiv = document.getElementById('print-status-indicator');
    if (!statusDiv) {
        statusDiv = document.createElement('div');
        statusDiv.id = 'print-status-indicator';
        
        // Vị trí góc dưới bên trái
        statusDiv.style.position = 'fixed';
        statusDiv.style.bottom = '20px';
        statusDiv.style.left = '20px';
        
        statusDiv.style.zIndex = '9999';
        statusDiv.style.padding = '8px 20px';
        statusDiv.style.borderRadius = '30px';
        statusDiv.style.fontWeight = 'bold';
        statusDiv.style.fontSize = '13px';
        statusDiv.style.boxShadow = '0 3px 10px rgba(0,0,0,0.15)';
        statusDiv.style.transition = 'all 0.3s ease';
        
        // MẶC ĐỊNH ẨN ĐI
        statusDiv.style.display = 'none'; 
        document.body.appendChild(statusDiv);
    }
    window.updatePrintStatusUI();
};

// Tìm hàm này trong script.js và sửa lại màu nền
window.updatePrintStatusUI = function() {
    const statusDiv = document.getElementById('print-status-indicator');
    if (!statusDiv) return;

    const posView = document.getElementById('pos-view');
    
    // Kiểm tra: Đang ở màn hình POS VÀ Chế độ in đang BẬT
    if (posView && posView.style.display !== 'none' && window.autoPrintMode === true) {
        statusDiv.style.display = 'block'; // Chỉ hiện khi bật
        statusDiv.innerHTML = '<i class="fa-solid fa-print"></i> Chế độ In (F2): ĐANG BẬT';
        statusDiv.style.backgroundColor = 'var(--kv-pink)'; 
        statusDiv.style.color = 'white';
        statusDiv.style.border = 'none';
    } else {
        // Nếu tắt hoặc không ở màn hình POS thì ẩn hoàn toàn[cite: 2]
        statusDiv.style.display = 'none';
    }
};

document.addEventListener('keydown', function(e) {
    // 1. Chặn phím F11 (Toàn màn hình) và phím F12 (Nếu muốn chặn mở Code)
    if (e.key === 'F11') {
        e.preventDefault(); // Ngắn chặn trình duyệt bật Full Screen
        return false;
    }

    // 2. Xử lý phím ESC - Đóng các màn hình lớn/Modal
    if (e.key === 'Escape') {
        if (typeof closeCreateImportView === 'function') closeCreateImportView();
        if (typeof closeCreateCheckView === 'function') closeCreateCheckView();
        
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.style.display = 'none';
        });

        const dropdowns = ['pos-search-dropdown', 'ic-search-dropdown', 'io-search-dropdown', 'pos-hamburger-menu'];
        dropdowns.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        return;
    }

    // 3. Các phím tắt dành riêng cho màn hình Bán hàng (POS)
    const posView = document.getElementById('pos-view');
    if (posView && posView.style.display === 'flex') {
        
        // --- CHẶN TẤT CẢ PHÍM TẮT TRONG LÚC ĐANG THANH TOÁN ---
        if (window.isProcessingCheckout) {
            const blockedKeys = ['F1', 'F2', 'F3', 'F4', 'F8', 'F9', 'Home', 'Enter'];
            if (blockedKeys.includes(e.key)) {
                e.preventDefault();
                return; // Ngắt ngang, không cho chạy bất cứ lệnh F nào
            }
        }

        switch (e.key) {
            case 'F1':
                e.preventDefault();
                e.stopImmediatePropagation();
                addPOSTab();
                break;

            case 'F2':
                e.preventDefault();
                // Đảo trạng thái bật/tắt
                window.autoPrintMode = !window.autoPrintMode; 
                
                // Hiện thông báo nhanh để bạn biết đã thao tác thành công
                if (window.autoPrintMode) {
                    showToast("Đã BẬT chế độ tự động in hóa đơn", "success");
                } else {
                    showToast("Đã TẮT chế độ tự động in hóa đơn", "info");
                }
                
                // Cập nhật việc ẩn/hiện cái khung ở góc màn hình
                if (typeof window.updatePrintStatusUI === 'function') window.updatePrintStatusUI();
                break;

            case 'F3':
                e.preventDefault();
                const searchInput = document.getElementById('pos-search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select(); // Bôi đen để quét mã mới sẽ ghi đè mã cũ
                }
                break;
            case 'F4':
                e.preventDefault();
                openAddProductModal();
                break;
            case 'F8':
                e.preventDefault();
                const customerPaidInput = document.getElementById('pos-customer-paid');
                if (customerPaidInput) {
                    customerPaidInput.focus();   
                    customerPaidInput.select(); 
                }
                break;
            case 'F9':
                e.preventDefault();
                if (typeof processCheckout === 'function') processCheckout();
                break;

case 'Home':
                e.preventDefault();
                const qtyInputs = document.querySelectorAll('.pos-qty-input');
                if (qtyInputs.length > 0) {
                    // Nhảy vòng lặp các ô số lượng khi bấm phím Home liên tục
                    let currentIdx = Array.from(qtyInputs).indexOf(document.activeElement);
                    let nextIdx = (currentIdx + 1) % qtyInputs.length;
                    qtyInputs[nextIdx].focus();
                    qtyInputs[nextIdx].select(); // Tự động bôi đen để gõ đè số mới
                }
                break;
        }
    }

    // 4. Khi đang ở ô số lượng, nhấn Enter để quay lại ô tìm kiếm
    if (e.key === 'Enter' && e.target.classList.contains('pos-qty-input')) {
        // CŨNG CHẶN KHI ĐANG THANH TOÁN
        if (window.isProcessingCheckout) {
            e.preventDefault();
            return;
        }

        e.preventDefault();
        const searchInput = document.getElementById('pos-search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }
});
// Gọi hàm vẽ UI sau khi hệ thống load xong (Khoảng 1 giây)
setTimeout(window.initPrintStatusUI, 1000);

// Đồng bộ trạng thái UI mỗi khi bấm qua lại giữa các màn hình
const originalSwitchToPOSOverview = window.switchToPOS || function(){};
window.switchToPOS = function() {
    originalSwitchToPOSOverview();
    setTimeout(window.updatePrintStatusUI, 100);
};

const originalSwitchToDashboardOverview = window.switchToDashboard || function(){};
window.switchToDashboard = function() {
    originalSwitchToDashboardOverview();
    setTimeout(window.updatePrintStatusUI, 100);
};
// ==========================================
// TÍNH NĂNG HỦY HÓA ĐƠN & HOÀN TRẢ KHO
// ==========================================

window.deleteInvoice = function(invId) {
    showConfirm(`Hủy hóa đơn <b>${invId}</b>? Hàng sẽ trả về kho.`, function() {
        let allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
        let products = JSON.parse(localStorage.getItem('kv_products')) || [];
        const idx = allInvoices.findIndex(x => x.id === invId);
        
        if (idx !== -1) {
            allInvoices[idx].items.forEach(item => {
                let p = products.find(x => x.id === item.productId || x.code === item.code);
                if (p) p.stock = (parseFloat(p.stock) || 0) + (parseFloat(item.qty) || 0);
            });
            allInvoices[idx].status = 'cancel';
            
            localStorage.setItem('kv_invoices', JSON.stringify(allInvoices));
            localStorage.setItem('kv_products', JSON.stringify(products));
            
            // Đồng bộ Firebase
            if (window.uploadToCloud) {
                window.uploadToCloud('invoices', allInvoices);
                window.uploadToCloud('products', products);
            }
            renderInvoices();
            showToast("Đã hủy hóa đơn", "success");
        }
    });
};
// ==========================================
// TÍNH NĂNG BỘ LỌC NHÓM HÀNG NÂNG CAO
// ==========================================

// Đóng dropdown khi click ra ngoài màn hình
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('group-filter-dropdown');
    const trigger = document.getElementById('group-dropdown-trigger');
    if (dropdown && dropdown.style.display === 'block' && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

// Mở/tắt Dropdown
window.toggleGroupDropdown = function() {
    const dropdown = document.getElementById('group-filter-dropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
};

// Hàm xử lý khi click vào mũi tên (Xổ xuống / Thu gọn)
window.toggleGroupChildren = function(groupId, iconEl) {
    const childrenContainer = document.getElementById(`group-children-${groupId}`);
    if (childrenContainer) {
        if (childrenContainer.style.display === 'none') {
            childrenContainer.style.display = 'block';
            iconEl.classList.remove('fa-chevron-right');
            iconEl.classList.add('fa-chevron-down');
        } else {
            childrenContainer.style.display = 'none';
            iconEl.classList.remove('fa-chevron-down');
            iconEl.classList.add('fa-chevron-right');
        }
    }
};

// Nâng cấp: Tự động bung nhóm cha nếu tìm nhóm con, và hiện nhóm con nếu tìm trúng nhóm cha
window.filterGroupTree = function() {
    const rawKw = document.getElementById('search-group-filter').value.toLowerCase().trim();
    // Khử dấu tiếng Việt để tìm cho dễ
    const kw = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(rawKw) : rawKw;
    const items = document.querySelectorAll('.group-tree-item');
    
    // 1. Tạm thời ẩn hết đi
    items.forEach(item => item.style.display = 'none');

    if (kw === '') {
        items.forEach(item => item.style.display = 'flex');
        return;
    }

    // 2. Tìm item khớp từ khóa
    items.forEach(item => {
        const rawName = item.getAttribute('data-name') || '';
        const name = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(rawName) : rawName;

        if (name.includes(kw)) {
            // A. Hiện chính nó
            item.style.display = 'flex'; 
            
            // B. Hiện TẤT CẢ các nhóm con của nó (Trường hợp tìm nhóm cha)
            const cb = item.querySelector('.group-filter-cb');
            if (cb) {
                const childrenContainer = document.getElementById(`group-children-${cb.value}`);
                if (childrenContainer) {
                    childrenContainer.style.display = 'block'; // Mở div bọc nhóm con
                    
                    // Xoay icon mũi tên xuống
                    const icon = item.querySelector('.group-toggle-icon');
                    if (icon) {
                        icon.classList.remove('fa-chevron-right');
                        icon.classList.add('fa-chevron-down');
                    }
                    
                    // Ép tất cả các thẻ nhóm con bên trong phải hiện lên
                    const descendantItems = childrenContainer.querySelectorAll('.group-tree-item');
                    descendantItems.forEach(desc => desc.style.display = 'flex');
                }
            }
            
            // C. Lần ngược lên các div chứa nó để bắt nhóm cha mở ra (Trường hợp tìm nhóm con)
            let parentContainer = item.closest('.group-children-container');
            while (parentContainer) {
                parentContainer.style.display = 'block'; 
                
                const parentId = parentContainer.id.replace('group-children-', '');
                const parentItem = document.querySelector(`.group-tree-item input[value="${parentId}"]`)?.closest('.group-tree-item');
                if (parentItem) parentItem.style.display = 'flex';

                const parentIcon = document.querySelector(`.group-toggle-icon[onclick*="${parentId}"]`);
                if (parentIcon) {
                    parentIcon.classList.remove('fa-chevron-right');
                    parentIcon.classList.add('fa-chevron-down');
                }
                
                parentContainer = parentContainer.parentElement.closest('.group-children-container');
            }
        }
    });
};

// Nút "Chọn tất cả"
window.selectAllGroups = function() {
    const cbs = document.querySelectorAll('.group-filter-cb');
    const allVisible = Array.from(cbs).filter(cb => cb.closest('.group-tree-item').style.display !== 'none');
    
    // Nếu tất cả đã tích thì bỏ tích, nếu chưa thì tích hết
    const allChecked = allVisible.every(cb => cb.checked);
    allVisible.forEach(cb => cb.checked = !allChecked);
};

// Nút "Áp dụng"
window.applyGroupFilter = function() {
    document.getElementById('group-filter-dropdown').style.display = 'none';
    
    const checked = document.querySelectorAll('.group-filter-cb:checked');
    const display = document.getElementById('group-filter-display');
    
    // Thay đổi chữ hiển thị trên nút bấm
    if (checked.length === 0) {
        display.innerText = 'Tất cả nhóm hàng';
        display.style.color = '#555';
    } else if (checked.length === 1) {
        display.innerText = checked[0].parentElement.innerText.trim();
        display.style.color = 'var(--kv-blue)';
        display.style.fontWeight = 'bold';
    } else {
        display.innerText = `Đã chọn ${checked.length} nhóm`;
        display.style.color = 'var(--kv-blue)';
        display.style.fontWeight = 'bold';
    }
    
    // Đẩy lệnh vẽ lại bảng hàng hóa
    window.currentProductPage = 1;
    renderProductList();
};
// ==========================================
// TÍNH NĂNG BỘ LỌC NHÓM HÀNG (TAB THIẾT LẬP GIÁ)
// ==========================================

// Đóng dropdown khi click ra ngoài
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('price-group-filter-dropdown');
    const trigger = document.getElementById('price-group-dropdown-trigger');
    if (dropdown && dropdown.style.display === 'block' && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});

window.togglePriceGroupDropdown = function() {
    const dropdown = document.getElementById('price-group-filter-dropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
};

// Nâng cấp tương tự cho Tab Thiết lập giá
window.filterPriceGroupTree = function() {
    const rawKw = document.getElementById('search-price-group-filter').value.toLowerCase().trim();
    const kw = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(rawKw) : rawKw;
    const items = document.querySelectorAll('.price-group-tree-item');
    
    items.forEach(item => item.style.display = 'none');

    if (kw === '') {
        items.forEach(item => item.style.display = 'flex');
        return;
    }

    items.forEach(item => {
        const rawName = item.getAttribute('data-name') || '';
        const name = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(rawName) : rawName;

        if (name.includes(kw)) {
            item.style.display = 'flex'; 
            
            // Hiện các nhóm con
            const cb = item.querySelector('.price-group-filter-cb');
            if (cb) {
                const childrenContainer = document.getElementById(`price-group-children-${cb.value}`);
                if (childrenContainer) {
                    childrenContainer.style.display = 'block';
                    const icon = item.querySelector('.price-group-toggle-icon');
                    if (icon) {
                        icon.classList.remove('fa-chevron-right');
                        icon.classList.add('fa-chevron-down');
                    }
                    const descendantItems = childrenContainer.querySelectorAll('.price-group-tree-item');
                    descendantItems.forEach(desc => desc.style.display = 'flex');
                }
            }

            // Hiện các nhóm cha
            let parentContainer = item.closest('.price-group-children-container');
            while (parentContainer) {
                parentContainer.style.display = 'block';
                const parentId = parentContainer.id.replace('price-group-children-', '');
                const parentItem = document.querySelector(`.price-group-tree-item input[value="${parentId}"]`)?.closest('.price-group-tree-item');
                if (parentItem) parentItem.style.display = 'flex';
                
                const parentIcon = document.querySelector(`.price-group-toggle-icon[onclick*="${parentId}"]`);
                if (parentIcon) {
                    parentIcon.classList.remove('fa-chevron-right');
                    parentIcon.classList.add('fa-chevron-down');
                }
                parentContainer = parentContainer.parentElement.closest('.price-group-children-container');
            }
        }
    });
};

window.selectAllPriceGroups = function() {
    const cbs = document.querySelectorAll('.price-group-filter-cb');
    const allVisible = Array.from(cbs).filter(cb => cb.closest('.price-group-tree-item').style.display !== 'none');
    const allChecked = allVisible.every(cb => cb.checked);
    allVisible.forEach(cb => cb.checked = !allChecked);
};

window.applyPriceGroupFilter = function() {
    document.getElementById('price-group-filter-dropdown').style.display = 'none';
    const checked = document.querySelectorAll('.price-group-filter-cb:checked');
    const display = document.getElementById('price-group-filter-display');
    
    if (checked.length === 0) {
        display.innerText = 'Tất cả nhóm hàng';
        display.style.color = '#555';
    } else if (checked.length === 1) {
        display.innerText = checked[0].parentElement.innerText.trim();
        display.style.color = 'var(--kv-blue)';
        display.style.fontWeight = 'bold';
    } else {
        display.innerText = `Đã chọn ${checked.length} nhóm`;
        display.style.color = 'var(--kv-blue)';
        display.style.fontWeight = 'bold';
    }
    
    window.currentPricePage = 1; // Reset trang về 1 khi lọc
    renderPriceSetupTable();     // Vẽ lại bảng
};
// ==========================================
// TÍNH NĂNG BỘ LỌC NGÀY KIỂM KHO
// ==========================================
window.toggleICDateFilter = function() {
    const type = document.querySelector('input[name="ic-date-type"]:checked').value;
    const customWrapper = document.getElementById('ic-date-custom-wrapper');
    const predefinedSelect = document.getElementById('ic-date-predefined');
    const predefinedBox = document.getElementById('ic-predefined-box');
    const customBox = document.getElementById('ic-custom-box');

    // Chuyển đổi viền xanh/xám tùy theo option đang chọn
    if (type === 'custom') {
        customWrapper.style.display = 'flex';
        predefinedSelect.disabled = true;
        predefinedBox.style.border = '1px solid #ddd';
        customBox.style.border = '1px solid var(--kv-blue)';
        customBox.style.background = 'white';
    } else {
        customWrapper.style.display = 'none';
        predefinedSelect.disabled = false;
        predefinedBox.style.border = '1px solid var(--kv-blue)';
        customBox.style.border = '1px solid #ddd';
        customBox.style.background = '#fafafa';
    }
    
    window.currentICPage = 1;
    renderInventoryChecks();
};


// Kích hoạt nạp dữ liệu ngay khi vừa F5
setTimeout(window.renderICCreatorFilter, 500);

// Thủ thuật: Tự động chạy lại hàm nạp danh sách mỗi khi bảng Kiểm kho được vẽ lại
const oldRenderIC = window.renderInventoryChecks || (typeof renderInventoryChecks === 'function' ? renderInventoryChecks : function(){});
window.renderInventoryChecks = function() {
    const tbody = document.querySelector('#ic-list-table tbody');
    if (!tbody) return;
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    const allChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];
    const searchKw = (document.getElementById('search-ic')?.value || '').toLowerCase().trim();

    // LẤY CÁC BỘ LỌC
    const timeRange = window.getFilterTimeRange('ic');
    const showTemp = document.getElementById('filter-ic-temp')?.checked;
    const showDone = document.getElementById('filter-ic-done')?.checked;
    const showCancel = document.getElementById('filter-ic-cancel')?.checked;
    const creatorVal = document.getElementById('filter-ic-creator')?.value || '';

    tbody.innerHTML = allChecks.filter(ic => {
        if ((ic.branchId || 'CN001') !== currentBranch) return false;
        if (searchKw && !ic.code.toLowerCase().includes(searchKw)) return false;
        
        // LỌC THEO THỜI GIAN (ID của phiếu kiểm kho chính là số TimeStamp)
        const icTime = parseInt(ic.id);
        if (icTime < timeRange.fromTime || icTime > timeRange.toTime) return false;

        // LỌC TRẠNG THÁI
        if (ic.status === 'temp' && !showTemp) return false;
        if (ic.status === 'done' && !showDone) return false;
        if (ic.status === 'cancel' && !showCancel) return false;

        // LỌC NGƯỜI TẠO
        if (creatorVal && ic.creator !== creatorVal) return false;

        return true;
    }).map(ic => {
        const isDone = ic.status === 'done';
        const totalRealQty = ic.items.reduce((s, i) => s + (parseFloat(i.realQty) || 0), 0);
        const totalDiff = ic.items.reduce((s, i) => s + (parseFloat(i.realQty) - parseFloat(i.sysStock)), 0);

        return `
        <tr onclick="toggleICDetail('${ic.id}')" style="cursor:pointer; border-bottom: 1px solid #eee;">
            <td style="color:var(--kv-blue); font-weight:bold;">${ic.code}</td>
            <td>${new Date(ic.id).toLocaleString('vi-VN')}</td>
            <td>${isDone ? new Date(ic.id).toLocaleString('vi-VN') : '---'}</td>
            <td style="text-align:center;">${ic.items.length}</td>
            <td style="text-align:right;">${totalRealQty.toLocaleString()}</td>
            <td style="text-align:right; font-weight:bold; color:${totalDiff < 0 ? 'red' : 'green'};">${totalDiff > 0 ? '+' : ''}${totalDiff}</td>
            <td style="text-align:center;"><span class="status-badge-new ${isDone ? 'badge-done' : 'badge-temp'}">${isDone ? 'Đã cân bằng' : 'Phiếu tạm'}</span></td>
        </tr>
        <tr id="ic-detail-${ic.id}" style="display:none;" class="io-detail-wrapper">
            <td colspan="7" style="padding: 20px; background: #fafafa;">
                <div style="background: white; border: 1px solid #ddd; border-radius: 8px; overflow: hidden;">
                    <div style="padding: 15px 20px; border-bottom: 1px solid #eee; background: #fff;">
                        <h3 style="margin: 0; color: var(--kv-blue);">Chi tiết kiểm kho: ${ic.code}</h3>
                    </div>
                    <div style="padding: 20px;">
                        <table class="kv-table" style="width: 100%; border: 1px solid #eee;">
                            <thead>
                                <tr style="background: #f9f9f9;">
                                    <th>Mã hàng</th><th>Tên hàng</th><th style="text-align:center;">Tồn máy</th><th style="text-align:center;">Thực tế</th><th style="text-align:center;">Lệch</th><th style="text-align:right;">Giá trị lệch</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ic.items.map(it => {
                                    const diff = (parseFloat(it.realQty) || 0) - (parseFloat(it.sysStock) || 0);
                                    return `
                                    <tr>
                                        <td>${it.code}</td><td>${it.name}</td>
                                        <td style="text-align:center;">${it.sysStock}</td>
                                        <td style="text-align:center;">${it.realQty}</td>
                                        <td style="text-align:center; font-weight:bold; color:${diff < 0 ? 'red' : 'green'};">${diff}</td>
                                        <td style="text-align:right;">${(diff * (it.cost || 0)).toLocaleString()}</td>
                                    </tr>`;
                                }).join('')}
                            </tbody>
                        </table>
                    </div>
                    <div style="padding: 15px 20px; background: #f9f9f9; display: flex; justify-content: flex-end; gap: 10px;">
                        <button class="btn-action-outline text-danger" onclick="cancelIC('${ic.id}')"><i class="fa-solid fa-trash"></i> Hủy phiếu</button>
                        ${!isDone ? `<button class="btn-action-primary" onclick="openCreateCheckView('${ic.id}')">Tiếp tục kiểm</button>` : ''}
                    </div>
                </div>
            </td>
        </tr>`;
    }).join('');
};

window.toggleICDetail = function(id) {
    const row = document.getElementById(`ic-detail-${id}`);
    if (row) row.style.display = (row.style.display === 'none') ? 'table-row' : 'none';
};
if (typeof renderInventoryChecks !== 'undefined') {
    renderInventoryChecks = window.renderInventoryChecks;
}
// ==========================================
// TÍNH NĂNG ĐỒNG BỘ NHÂN VIÊN ADMIN VÀO BỘ LỌC
// ==========================================
window.renderICCreatorFilter = function() {
    const select = document.getElementById('filter-ic-creator');
    if (!select) return;
    
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    const allAccounts = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    const allInventoryChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];

    // ĐÃ SỬA: Thêm acc && để chống lỗi null object
    const validAccs = allAccounts.filter(acc => 
        acc && (acc.username === 'admin' || 
        (acc.branchIds && acc.branchIds.includes(currentBranch)) || 
        (acc.branchId === currentBranch))
    ).map(a => a.fullname);

    const validICs = allInventoryChecks.filter(ic => (ic.branchId || 'CN001') === currentBranch).map(ic => ic.creator);
    const uniqueCreators = [...new Set([...validAccs, ...validICs])].filter(Boolean);
    const currentVal = select.value;
    
    let html = '<option value="">Tất cả người tạo</option>';
    uniqueCreators.sort().forEach(name => {
        if(name !== "1") html += `<option value="${name}">${name}</option>`;
    });
    
    select.innerHTML = html;
    if (currentVal && uniqueCreators.includes(currentVal)) select.value = currentVal;
};

window.migrateOldData = async function() { return Promise.resolve(); };

window.initApp = async function() {
    console.log("🚀 Đang khởi động lõi lưu trữ...");
    try {
        if (typeof window.migrateOldData === 'function') await window.migrateOldData(); 
        await window.loadDBToRAM();    
    } catch (error) { console.error("Lỗi DB:", error); }
    
    window.isRAMReady = true; 
    window.reloadGlobalsFromRAM(); 
    
    if (typeof ramQueue !== 'undefined' && ramQueue.length > 0) {
        ramQueue.forEach(item => localStorage.setItem(item.key, item.value));
        ramQueue = [];
    }

    if (window.fbDb && window.fbOnValue) {
        const syncPaths = [
            { path: 'products', storageKey: 'kv_products' },
            { path: 'invoices', storageKey: 'kv_invoices' },
            { path: 'groups', storageKey: 'kv_groups' },
            { path: 'pricebooks', storageKey: 'kv_pricebooks' },
            { path: 'inventory_checks', storageKey: 'kv_inventory_checks' },
            { path: 'import_orders', storageKey: 'kv_import_orders' },
            { path: 'accounts', storageKey: 'kv_accounts' },
            { path: 'branches', storageKey: 'kv_branches' }
        ];

        syncPaths.forEach(item => {
            const dbRef = window.fbRef(window.fbDb, item.path);
            window.fbOnValue(dbRef, (snapshot) => {
                const data = snapshot.val();
                let dataArray = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data).filter(Boolean)) : [];
                
                const hasPending = (JSON.parse(localStorage.getItem('kv_pending_invoices_data')) || []).length > 0;
                if (hasPending && (item.path === 'invoices' || item.path === 'products')) return;

                // KHÓA CHỐNG GHI ĐÈ: Cứu tinh khi F5 ngắt mạng giữa chừng
                let localData = JSON.parse(localStorage.getItem(item.storageKey)) || [];
                if (localData.length > dataArray.length && !window.isSyncLocked) {
                    console.log(`[Bảo vệ] Máy có ${localData.length} > Cloud có ${dataArray.length}. Đẩy ngược lên Cloud!`);
                    if (typeof window.uploadToCloud === 'function') window.uploadToCloud(item.path, localData);
                    return; // Chặn Cloud ghi đè xuống máy
                }

                if (item.path === 'products') {
                    if (!window.isSyncLocked) { 
                        dataArray.forEach(p => { if (!p.branchId) p.branchId = 'CN001'; });
                        products = dataArray; 
                        window.products = dataArray;
                        localStorage.setItem(item.storageKey, JSON.stringify(dataArray));
                        if (typeof renderProductList === 'function') renderProductList();
                    }
                } 
                else if (item.path === 'invoices' || item.path === 'import_orders' || item.path === 'inventory_checks') {
                    if (!window.isSyncLocked) {
                        if (item.path === 'invoices') { invoices = dataArray; window.invoices = dataArray; }
                        if (item.path === 'import_orders') { importOrders = dataArray; window.importOrders = dataArray; }
                        if (item.path === 'inventory_checks') { inventoryChecks = dataArray; window.inventoryChecks = dataArray; }
                        localStorage.setItem(item.storageKey, JSON.stringify(dataArray));
                    }
                } 
                else {
                    if (item.path === 'pricebooks') { priceBooks = dataArray; window.priceBooks = dataArray; }
                    if (item.path === 'groups') { productGroups = dataArray; window.productGroups = dataArray; }
                    if (item.path === 'branches') { branches = dataArray; window.branches = dataArray; }
                    localStorage.setItem(item.storageKey, JSON.stringify(dataArray));
                }
                
                if (item.path === 'accounts') {
                    accounts = dataArray; 
                    window.accounts = dataArray;
                    if (typeof currentUser !== 'undefined' && currentUser) {
                        const updatedMe = dataArray.find(acc => acc && acc.username === currentUser.username);
                        if (updatedMe) {
                            currentUser = updatedMe;
                            localStorage.setItem('kv_current_user', JSON.stringify(currentUser));
                        }
                    }
                }

                const currentView = sessionStorage.getItem('kv_current_view');
                const currentTab = localStorage.getItem('kv_current_tab') || 'tab-tong-quan';

                if (currentView === 'pos-view') {
                    if (item.path === 'products' && typeof renderPOSProducts === 'function') renderPOSProducts();
                    if (typeof renderPOSCart === 'function') renderPOSCart();
                } else if (currentView === 'dashboard-view') {
                    if (item.path === 'groups' && typeof window.renderGroupData === 'function') window.renderGroupData();
                    const tabMapping = {
                        'products': 'tab-danh-sach-hang',
                        'invoices': 'tab-hoa-don',
                        'import_orders': 'tab-nhap-hang',
                        'inventory_checks': 'tab-kiem-kho',
                        'pricebooks': 'tab-thiet-lap-gia'
                    };
                    if (tabMapping[item.path] === currentTab || currentTab === 'tab-tong-quan') openDashTab(currentTab); 
                }
            });
        });
    }

    const savedUser = localStorage.getItem('kv_current_user');
    const savedView = sessionStorage.getItem('kv_current_view'); 
    
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            if (typeof window.renderQuickBranchSwitcher === 'function') window.renderQuickBranchSwitcher();
            if (currentUser.branchId && !localStorage.getItem('kv_current_branch')) {
                localStorage.setItem('kv_current_branch', currentUser.branchId); 
            }
            hideAll(); 
            if (savedView === 'pos-view') {
                const posView = document.getElementById('pos-view');
                if (posView) { posView.style.display = 'flex'; if (typeof initPOSData === 'function') initPOSData(); }
            } else if (savedView === 'admin-settings-view') {
                const adminView = document.getElementById('admin-settings-view');
                if (adminView) { adminView.style.display = 'flex'; if (typeof switchAdminTab === 'function') switchAdminTab('list'); }
            } else {
                const dashView = document.getElementById('dashboard-view');
                if (dashView) {
                    dashView.style.display = 'flex';
                    const nameEl = document.getElementById('dash-user-name');
                    if (nameEl) nameEl.innerText = currentUser.fullname;
                    const lastTab = localStorage.getItem('kv_current_tab') || 'tab-tong-quan';
                    openDashTab(lastTab); 
                }
            }
        } catch (e) {
            localStorage.removeItem('kv_current_user');
            location.reload();
        }
    } else {
        hideAll();
        const loginView = document.getElementById('login-view');
        if (loginView) loginView.style.display = 'flex';
    }
    
    setTimeout(() => {
        if (typeof renderICCreatorFilter === 'function') renderICCreatorFilter();
        if (typeof renderInvCreatorFilter === 'function') renderInvCreatorFilter();
        if (typeof window.updateOfflineIndicator === 'function') window.updateOfflineIndicator();
    }, 1000);
};
// ==========================================
// TÍNH NĂNG XUẤT FILE EXCEL HÀNG HÓA
// ==========================================
window.exportProductsToExcel = function() {
    // 1. Lấy dữ liệu hàng hóa và nhóm hàng mới nhất
    const allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    const allGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];

    if (allProducts.length === 0) {
        alert("Không có hàng hóa nào để xuất!");
        return;
    }

    // 2. Chuyển đổi dữ liệu sang định dạng tiếng Việt để làm tiêu đề cột Excel
    const exportData = allProducts.map(p => {
        // Tìm tên nhóm hàng dựa vào ID nhóm lưu trong sản phẩm
        const groupObj = allGroups.find(g => g.id === p.group);
        const groupName = groupObj ? groupObj.name : '';

        return {
            "Mã hàng": p.code || '',
            "Mã vạch": p.barcode || '',
            "Tên hàng": p.name || '',
            "Nhóm hàng": groupName,
            "Giá vốn": p.cost || 0,
            "Giá bán": p.price || 0,
            "Tồn kho": p.stock || 0
        };
    });

    // 3. Khởi tạo Worksheet và thiết lập độ rộng cột cho đẹp
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wscols = [
        {wch: 15}, // Mã hàng
        {wch: 15}, // Mã vạch
        {wch: 40}, // Tên hàng
        {wch: 25}, // Nhóm hàng
        {wch: 15}, // Giá vốn
        {wch: 15}, // Giá bán
        {wch: 10}  // Tồn kho
    ];
    ws['!cols'] = wscols;

    // 4. Khởi tạo Workbook và lưu file
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh_Sach_Hang_Hoa");
    
    // Tên file tải về (Có dính kèm ngày tháng để dễ quản lý)
    const today = new Date();
    const dateStr = `${today.getDate()}_${today.getMonth()+1}_${today.getFullYear()}`;
    XLSX.writeFile(wb, `DanhSachHangHoa_${dateStr}.xlsx`);
};
window.toggleInvDateFilter = function() {
    const type = document.querySelector('input[name="inv-date-type"]:checked').value;
    document.getElementById('inv-date-custom-wrapper').style.display = (type === 'custom') ? 'flex' : 'none';
    const predBox = document.getElementById('inv-predefined-box');
    const custBox = document.getElementById('inv-custom-box');
    
    if (type === 'custom') {
        predBox.style.borderColor = '#ddd';
        custBox.style.borderColor = 'var(--kv-blue)';
        custBox.style.background = 'white';
        document.getElementById('inv-date-predefined').disabled = true;
    } else {
        predBox.style.borderColor = 'var(--kv-blue)';
        custBox.style.borderColor = '#ddd';
        custBox.style.background = '#fafafa';
        document.getElementById('inv-date-predefined').disabled = false;
    }
    renderInvoices();
};

window.renderInvCreatorFilter = function() {
    const select = document.getElementById('filter-inv-creator');
    if (!select) return;
    
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    const allAccs = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    const allInvs = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    
    // ĐÃ SỬA: Thêm acc && để chống lỗi null object
    const validAccs = allAccs.filter(acc => 
        acc && (acc.username === 'admin' || 
        (acc.branchIds && acc.branchIds.includes(currentBranch)) || 
        (acc.branchId === currentBranch))
    ).map(a => a.fullname);

    const validInvs = allInvs.filter(inv => (inv.branchId || 'CN001') === currentBranch).map(i => i.creator);
    const names = [...new Set([...validAccs, ...validInvs])].filter(Boolean);
    const currentVal = select.value;
    
    let html = '<option value="">Tất cả người bán</option>';
    names.sort().forEach(n => { if(n !== "1") html += `<option value="${n}">${n}</option>`; });
    select.innerHTML = html;

    if (currentVal && names.includes(currentVal)) select.value = currentVal;
};
window.toggleImpDateFilter = function() {
    const type = document.querySelector('input[name="imp-date-type"]:checked').value;
    document.getElementById('imp-date-custom-wrapper').style.display = (type === 'custom') ? 'flex' : 'none';
    const predBox = document.getElementById('imp-predefined-box');
    const custBox = document.getElementById('imp-custom-box');
    
    if (type === 'custom') {
        predBox.style.borderColor = '#ddd';
        custBox.style.borderColor = 'var(--kv-blue)';
        custBox.style.background = 'white';
        document.getElementById('imp-date-predefined').disabled = true;
    } else {
        predBox.style.borderColor = 'var(--kv-blue)';
        custBox.style.borderColor = '#ddd';
        custBox.style.background = '#fafafa';
        document.getElementById('imp-date-predefined').disabled = false;
    }
    renderImportOrders();
};

window.renderImpCreatorFilter = function() {
    const select = document.getElementById('filter-imp-creator');
    if (!select) return;
    
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    const allAccs = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    const allImps = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
    
    // ĐÃ SỬA: Thêm acc && để chống lỗi null object
    const validAccs = allAccs.filter(acc => 
        acc && (acc.username === 'admin' || 
        (acc.branchIds && acc.branchIds.includes(currentBranch)) || 
        (acc.branchId === currentBranch))
    ).map(a => a.fullname);

    const validImps = allImps.filter(imp => (imp.branchId || 'CN001') === currentBranch).map(i => i.creator);
    const names = [...new Set([...validAccs, ...validImps])].filter(Boolean);
    const currentVal = select.value; 
    
    let html = '<option value="">Tất cả người tạo</option>';
    names.sort().forEach(n => { if(n !== "1") html += `<option value="${n}">${n}</option>`; });
    select.innerHTML = html;

    if (currentVal && names.includes(currentVal)) select.value = currentVal;
};
// ==========================================
// TÍNH NĂNG CẬP NHẬT HÀNG LOẠT (CÓ SỬA SONG SONG)
// ==========================================

window.currentUpdatePage = 1;
window.pendingBatchUpdates = {}; 

const originalOpenDashTab = window.openDashTab;
// ==========================================
// HÀM CHUYỂN ĐỔI GIỮA CÁC TAB QUẢN LÝ
// ==========================================
// ==========================================
// HÀM CHUYỂN ĐỔI GIỮA CÁC TAB QUẢN LÝ (BẢN CHUẨN - ĐÃ HỢP NHẤT)
// ==========================================
window.openDashTab = function(tabId, navElement = null) {
    // 1. Lưu trạng thái tab hiện tại vào LocalStorage để khi F5 không bị văng ra trang chủ
    localStorage.setItem('kv_current_tab', tabId);

    // 2. Xóa class 'active' ở tất cả menu và thêm vào menu được click
    const allNavItems = document.querySelectorAll('.nav-item');
    allNavItems.forEach(nav => nav.classList.remove('active'));
    if (navElement) {
        navElement.classList.add('active');
    }

    // 3. Ẩn toàn bộ các tab đang mở
    const allTabs = document.querySelectorAll('.tab-section');
    allTabs.forEach(tab => {
        tab.style.display = 'none';
        tab.classList.remove('active');
    });

    // 4. Hiển thị tab được yêu cầu
    const targetTab = document.getElementById(tabId);
    if (targetTab) {
        targetTab.style.display = 'block'; // Nếu layout bị lệch, bạn có thể đổi thành 'flex'
        targetTab.classList.add('active');
    }

    // 5. Quét dọn hàng hóa vô chủ (Chống lỗi dữ liệu rác)
    if (typeof window.autoAssignUnassignedProducts === 'function') {
        window.autoAssignUnassignedProducts();
    }

    // 6. Xử lý logic tải dữ liệu cực chuẩn cho TỪNG TAB khi vừa mở lên
    switch (tabId) {
        case 'tab-danh-sach-hang':
            window.currentProductPage = 1; 
            if (typeof window.renderGroupData === 'function') window.renderGroupData();
            if (typeof window.renderProductList === 'function') window.renderProductList();
            break;
            
        case 'tab-thiet-lap-gia':
            if (typeof window.renderGroupData === 'function') window.renderGroupData();
            if (typeof window.renderPriceBookSidebar === 'function') window.renderPriceBookSidebar();
            if (typeof window.renderPriceSetupTable === 'function') window.renderPriceSetupTable();
            break;
            
        case 'tab-cap-nhat-hang':
            window.currentUpdatePage = 1;
            window.pendingBatchUpdates = {};
            if (typeof window.renderBatchUpdateTable === 'function') window.renderBatchUpdateTable();
            break;
            
        case 'tab-phat-hien-trung':
            // [ĐÃ FIX] Sử dụng window. để đảm bảo luôn gọi được hàm quét trùng lặp
            if (typeof window.scanDuplicateProducts === 'function') window.scanDuplicateProducts();
            break;

        case 'tab-hoa-don': 
            if (typeof window.renderInvoices === 'function') window.renderInvoices(); 
            break;

        case 'tab-nhap-hang':
            if (typeof window.restoreIOState === 'function') window.restoreIOState();
            if (typeof window.renderImportOrders === 'function') window.renderImportOrders();
            break;

        case 'tab-kiem-kho':
            // [ĐÃ FIX] Sửa lỗi sai tên hàm (Thêm chữ "s" vào hàm renderInventoryChecks)
            if (typeof window.renderInventoryChecks === 'function') window.renderInventoryChecks();
            break;
            
        case 'tab-tong-quan':
            if (typeof window.renderDashboard === 'function') window.renderDashboard();
            break;
            
        default:
            console.log("Đã mở tab: " + tabId);
            break;
    }
};
window.renderBatchUpdateTable = function() {
    const tbody = document.querySelector('#batch-update-table tbody');
    const thead = document.querySelector('#batch-update-table thead');
    const attr = document.getElementById('batch-update-attr').value;
    const searchVal = document.getElementById('search-batch-update').value.toLowerCase().trim();

    // =====================================
    // ĐOẠN CODE MỚI ĐƯỢC THÊM ĐỂ LỌC CHI NHÁNH
    // Lấy chi nhánh hiện tại đang đăng nhập
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';

    // 1. Lấy dữ liệu và lọc
    let allProducts = window.allProducts || window.products || [];
    
    // LỌC: Chỉ giữ lại hàng hóa của chi nhánh hiện tại
    let products = allProducts.filter(p => (p.branchId || 'CN001') === currentBranch);
    // =====================================

    if (searchVal) {
        products = products.filter(p => 
            (p.name && p.name.toLowerCase().includes(searchVal)) || 
            (p.code && p.code.toLowerCase().includes(searchVal)) || 
            (p.barcode && p.barcode.toLowerCase().includes(searchVal))
        );
    }

    // 2. Phân trang (100 món/trang)
    const itemsPerPage = 100; 
    window.currentUpdatePage = window.currentUpdatePage || 1;
    let totalPages = Math.ceil(products.length / itemsPerPage) || 1;
    if (window.currentUpdatePage > totalPages) window.currentUpdatePage = totalPages;

    const start = (window.currentUpdatePage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const displayList = products.slice(start, end);

    // 3. RENDER HEADER
    let thHtml = '';
    if (attr === 'code_and_barcode') {
        thHtml = `
            <tr>
                <th style="text-align: center; width: 40px;"><i class="fa-solid fa-star" style="color: #ccc;" title="Đánh dấu đã sửa"></i></th>
                <th style="text-align: center; width: 50px;">STT</th>
                <th style="text-align: left; min-width: 200px;">Tên hàng</th>
                <th style="text-align: left; width: 25%;">Mã hàng hóa</th>
                <th style="text-align: left; width: 25%;">Mã vạch</th>
            </tr>
        `;
    } else {
        let attrName = "Giá trị mới";
        if (attr === 'name') attrName = "Tên hàng hóa";
        else if (attr === 'code') attrName = "Mã hàng hóa";
        else if (attr === 'barcode') attrName = "Mã vạch";
        else if (attr === 'group') attrName = "Nhóm hàng";
        else if (attr === 'stock') attrName = "Tồn kho"; // Đã loại bỏ điều kiện của cost tại đây

        thHtml = `
            <tr>
                <th style="text-align: center; width: 40px;"><i class="fa-solid fa-star" style="color: #ccc;" title="Đánh dấu đã sửa"></i></th>
                <th style="text-align: center; width: 50px;">STT</th>
                <th style="text-align: left; min-width: 120px;">Mã hàng</th>
                <th style="text-align: left; min-width: 200px;">Tên hàng</th>
                <th style="text-align: left;">${attrName}</th>
            </tr>
        `;
    }
    thead.innerHTML = thHtml;

    // 4. RENDER BODY
    let tbHtml = '';
    if (displayList.length === 0) {
        tbHtml = `<tr><td colspan="5" style="text-align: center; padding: 30px; color: #888;">Không tìm thấy hàng hóa phù hợp.</td></tr>`;
    } else {
        displayList.forEach((p, index) => {
            const stt = start + index + 1;
            window.pendingBatchUpdates = window.pendingBatchUpdates || {};
            const edits = window.pendingBatchUpdates[p.id] || {};

            const starSttHtml = `
                <td style="text-align: center;"><i class="fa-regular fa-star star-mark" onclick="toggleRowStar(this)"></i></td>
                <td style="text-align: center; color: #888;">${stt}</td>
            `;

            const updateJS = `window.pendingBatchUpdates['${p.id}'] = window.pendingBatchUpdates['${p.id}'] || {}; window.pendingBatchUpdates['${p.id}']`;

            if (attr === 'code_and_barcode') {
                let vCode = edits.code !== undefined ? edits.code : (p.code || '');
                let vBar = edits.barcode !== undefined ? edits.barcode : (p.barcode || '');
                tbHtml += `
                    <tr style="border-bottom: 1px dashed #eee;">
                        ${starSttHtml}
                        <td style="font-weight: bold; color: #333;">${p.name}</td>
                        <td><input type="text" value="${vCode}" onchange="${updateJS}.code = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; outline: none;"></td>
                        <td><input type="text" value="${vBar}" onchange="${updateJS}.barcode = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; outline: none;"></td>
                    </tr>
                `;
            } else if (attr === 'group') {
                let vGroup = edits.group !== undefined ? edits.group : (p.group || '');
                let groupOptions = `<option value="">-- Chọn nhóm --</option>`;
                
                let allGrps = window.productGroups || JSON.parse(localStorage.getItem('kv_groups')) || [];
                allGrps.forEach(g => {
                    groupOptions += `<option value="${g.id}" ${String(vGroup) === String(g.id) ? 'selected' : ''}>${g.name}</option>`;
                });

                tbHtml += `
                    <tr style="border-bottom: 1px dashed #eee;">
                        ${starSttHtml}
                        <td style="color: var(--kv-blue); font-weight: 500;">${p.code}</td>
                        <td style="color: #333;">${p.name}</td>
                        <td><select onchange="${updateJS}.group = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; outline: none;">${groupOptions}</select></td>
                    </tr>
                `;
            } else {
                let vAttr = edits[attr] !== undefined ? edits[attr] : (p[attr] !== undefined ? p[attr] : '');
                let inputType = (attr === 'stock') ? 'number' : 'text'; // Chỉ còn thuộc tính stock sử dụng kiểu number
                
                tbHtml += `
                    <tr style="border-bottom: 1px dashed #eee;">
                        ${starSttHtml}
                        <td style="color: var(--kv-blue); font-weight: 500;">${p.code}</td>
                        <td style="color: #333;">${p.name}</td>
                        <td><input type="${inputType}" value="${vAttr}" onchange="${updateJS}['${attr}'] = this.value" style="width: 100%; padding: 6px; border: 1px solid #ddd; border-radius: 4px; outline: none;"></td>
                    </tr>
                `;
            }
        });
    }
    tbody.innerHTML = tbHtml;

    // 5. Render Phân trang
    const paginationContainer = document.getElementById('update-pagination');
    if (paginationContainer) {
        window.renderPaginationControls('update-pagination', window.currentUpdatePage, totalPages, 'changeUpdatePage');
    }
};

window.changeUpdatePage = function(newPage) {
    window.currentUpdatePage = newPage;
    renderBatchUpdateTable();
};

// Hàm ghi nhớ cho sửa đơn lẻ
window.recordBatchUpdate = function(productId, newValue) {
    if (newValue === '' || newValue === null) delete window.pendingBatchUpdates[productId];
    else window.pendingBatchUpdates[productId] = newValue;
};

// Hàm ghi nhớ riêng cho sửa song song
window.recordBatchUpdateDual = function(productId, field, newValue) {
    if (!window.pendingBatchUpdates[productId]) window.pendingBatchUpdates[productId] = {};
    window.pendingBatchUpdates[productId][field] = newValue;
    
    // Nếu cả 2 ô đều bị xóa trắng thì hủy lệnh lưu
    if (!window.pendingBatchUpdates[productId].code && !window.pendingBatchUpdates[productId].barcode) {
        delete window.pendingBatchUpdates[productId];
    }
};

window.saveBatchUpdates = function() {
    const attr = document.getElementById('batch-update-attr').value;
    const updateIds = Object.keys(window.pendingBatchUpdates);
    
    if (updateIds.length === 0) {
        alert("Bạn chưa nhập dữ liệu mới nào để cập nhật!");
        return;
    }

    // Lấy dữ liệu để kiểm tra
    let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    let currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    let hasDuplicateError = false;

    // KIỂM TRA TRÙNG LẶP TRƯỚC KHI LƯU
    if (attr === 'code_and_barcode' || attr === 'code') {
        for (let i = 0; i < updateIds.length; i++) {
            const id = updateIds[i];
            const updates = window.pendingBatchUpdates[id];
            const newCodeToSave = attr === 'code_and_barcode' ? updates.code : updates[attr];

            if (newCodeToSave && newCodeToSave.trim() !== '') {
                const isDup = allProducts.some(p => {
                    if ((p.branchId || 'CN001') !== currentBranch) return false;
                    if (p.id === id) return false; // Bỏ qua chính nó
                    if (p.code && p.code.toLowerCase() === newCodeToSave.trim().toLowerCase()) return true;
                    if (p.units && p.units.some(u => u.code && u.code.toLowerCase() === newCodeToSave.trim().toLowerCase())) return true;
                    return false;
                });

                if (isDup) {
                    alert(`Lỗi: Mã hàng "${newCodeToSave}" đã tồn tại trên hệ thống. Cập nhật bị hủy!`);
                    hasDuplicateError = true;
                    break; 
                }
            }
        }
    }

    if (hasDuplicateError) return; // Dừng lại nếu phát hiện lỗi

    showConfirm(`Bạn sắp cập nhật dữ liệu cho ${updateIds.length} mặt hàng. Bạn có chắc chắn?`, function() {
        updateIds.forEach(id => {
            const prodIndex = allProducts.findIndex(p => p.id === id);
            if (prodIndex !== -1) {
                if (attr === 'code_and_barcode') {
                    const updates = window.pendingBatchUpdates[id];
                    if (updates.code !== undefined && updates.code.trim() !== '') {
                        allProducts[prodIndex].code = updates.code.trim();
                        // Đồng bộ xuống unit[0]
                        if(allProducts[prodIndex].units && allProducts[prodIndex].units.length > 0) {
                            allProducts[prodIndex].units[0].code = updates.code.trim();
                        }
                    }
                    if (updates.barcode !== undefined && updates.barcode.trim() !== '') {
                        allProducts[prodIndex].barcode = updates.barcode.trim();
                        // Đồng bộ xuống unit[0]
                        if(allProducts[prodIndex].units && allProducts[prodIndex].units.length > 0) {
                            allProducts[prodIndex].units[0].barcode = updates.barcode.trim();
                        }
                    }
                } else {
                    // SỬA LỖI Ở ĐÂY: Thêm [attr] để trích xuất đúng giá trị chữ/số bên trong
                    const newValue = window.pendingBatchUpdates[id][attr];
                    
                    allProducts[prodIndex][attr] = newValue;
                    
                    // Đồng bộ giá bán xuống unit[0] nếu thuộc tính đang sửa là giá
                    if (attr === 'price' && allProducts[prodIndex].units && allProducts[prodIndex].units.length > 0) {
                        allProducts[prodIndex].units[0].price = newValue;
                    }
                }
            }
        });

        localStorage.setItem('kv_products', JSON.stringify(allProducts));
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', allProducts);
        }
        
        window.products = allProducts;
        window.pendingBatchUpdates = {};
        
        alert("Cập nhật hàng loạt thành công!");
        renderBatchUpdateTable();
    });
};
// Hàm hỗ trợ copy chéo dữ liệu hàng loạt (Từ Mã vạch -> Mã hàng và ngược lại)
window.copyColumnData = function(source, target) {
    let sourceName = source === 'barcode' ? 'Mã vạch' : 'Mã hàng';
    let targetName = target === 'code' ? 'Mã hàng' : 'Mã vạch';

    if (!confirm(`Hệ thống sẽ copy toàn bộ dữ liệu từ [${sourceName}] dán sang cột [${targetName}] cho danh sách hiện tại. Bạn có chắc chắn?`)) {
        return;
    }

    // FIX LỖI: Lấy trực tiếp từ kho lưu trữ (localStorage) thay vì dùng biến tạm
    const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];

    // Lấy danh sách đang hiển thị (đã qua bộ lọc tìm kiếm)
    const keyword = (document.getElementById('search-batch-update')?.value || '').toLowerCase().trim();
    let filtered = allProds.filter(p => {
        return (p.name || '').toLowerCase().includes(keyword) || 
               (p.code || '').toLowerCase().includes(keyword) ||
               (p.barcode || '').toLowerCase().includes(keyword);
    });

    let copyCount = 0;

    filtered.forEach(p => {
        // 1. Mặc định lấy giá trị ở CỘT CŨ
        let valToCopy = p[source] || ''; 
        
        // 2. Nếu có gõ tay vào CỘT MỚI thì ưu tiên lấy cái mới gõ
        if (window.pendingBatchUpdates[p.id] && window.pendingBatchUpdates[p.id][source] !== undefined) {
            valToCopy = window.pendingBatchUpdates[p.id][source];
        }

        // 3. Nếu có dữ liệu thì chép sang cột đích
        if (valToCopy.toString().trim() !== '') {
            if (!window.pendingBatchUpdates[p.id]) window.pendingBatchUpdates[p.id] = {};
            window.pendingBatchUpdates[p.id][target] = valToCopy;
            copyCount++;
        }
    });

    if (copyCount > 0) {
        alert(`Đã chép tự động thành công ${copyCount} dòng! Vui lòng kiểm tra lại bảng và bấm "Cập nhật dữ liệu" để lưu chính thức.`);
        renderBatchUpdateTable(); // Vẽ lại bảng để hiện số vừa được điền tự động
    } else {
        alert(`Không có dữ liệu [${sourceName}] nào để copy!`);
    }
};
// Hàm xử lý phép thuật: Rải dữ liệu hàng loạt từ Excel
window.handlePasteExcel = function(e, currentInput, attr) {
    // 1. Chặn trình duyệt tự dán một cục chữ lộn xộn vào 1 ô
    e.preventDefault();

    // 2. Lấy dữ liệu từ Clipboard (bộ nhớ tạm của máy tính)
    const pasteData = (e.clipboardData || window.clipboardData).getData('text');
    if (!pasteData) return;

    // 3. Tách dữ liệu thành từng dòng (Excel dùng \n để xuống dòng)
    const values = pasteData.split(/\r\n|\n|\r/).map(v => v.trim());

    // 4. Tìm tất cả các ô input của cột đó đang hiển thị trên bảng
    const allInputs = Array.from(document.querySelectorAll(`.batch-input-${attr}`));
    const currentIndex = allInputs.indexOf(currentInput);

    if (currentIndex === -1) return;

    // 5. Bắt đầu rải dữ liệu từ ô bạn đang trỏ chuột trở xuống
    let count = 0;
    for (let i = 0; i < values.length; i++) {
        const targetInput = allInputs[currentIndex + i];
        
        // Nếu còn ô để điền và dữ liệu copy có chữ
        if (targetInput && values[i] !== '') {
            targetInput.value = values[i];
            
            // Lệnh quan trọng: Kích hoạt sự kiện 'input' ảo để hệ thống tự động ghi nhớ
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            count++;
        }
    }
};
// ==========================================
// TÍNH NĂNG NHẤN ENTER NHẢY XUỐNG Ô DƯỚI (THIẾT LẬP GIÁ)
// ==========================================
window.moveNextOnEnter = function(event, currentInput, className) {
    if (event.key === 'Enter') {
        event.preventDefault(); // Chặn hành vi mặc định của phím Enter

        // Lấy toàn bộ các ô input cùng cột (cùng class)
        const inputs = Array.from(document.querySelectorAll('.' + className));
        const currentIndex = inputs.indexOf(currentInput);

        // Nếu chưa phải là ô cuối cùng, tự động nhảy xuống ô dưới
        if (currentIndex !== -1 && currentIndex < inputs.length - 1) {
            const nextInput = inputs[currentIndex + 1];
            nextInput.focus();   
            nextInput.select();  
        } 
        // --- THÊM MỚI: Nếu là ô cuối cùng, Enter sẽ tự bấm XONG ---
        else if (currentIndex === inputs.length - 1) {
            if (className === 'quick-price-input' && typeof saveQuickPriceSetup === 'function') {
                saveQuickPriceSetup(); // Tự động lưu bảng thiết lập giá
            }
        }
    }
};

// ==========================================
// TÍNH NĂNG MENU THIẾT LẬP GIÁ NHANH (+1k, +2k...)
// ==========================================
window.showQuickPriceMenu = function(inputEl) {
    // Ẩn tất cả các menu khác đang mở để tránh rối mắt
    document.querySelectorAll('.quick-price-dropdown').forEach(el => el.style.display = 'none');
    
    // Mở menu của ô vừa click vào
    const dropdown = inputEl.nextElementSibling;
    if (dropdown && dropdown.classList.contains('quick-price-dropdown')) {
        dropdown.style.display = 'flex';
    }
};

window.hideQuickPriceMenu = function(inputEl) {
    // Delay 1 chút để chuột kịp click vào menu trước khi nó biến mất
    setTimeout(() => {
        const dropdown = inputEl.nextElementSibling;
        if (dropdown) dropdown.style.display = 'none';
    }, 200);
};

window.applyQuickAdd = function(basePrice, addAmount, pbId, productId, unitIdx, inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    // Tính giá mới
    const newPrice = basePrice + (addAmount * 1000);
    
    // Đẩy số vào ô input, format lại và BẬT MÀU HỒNG NGAY LẬP TỨC
    inputEl.value = newPrice.toLocaleString('vi-VN');
    inputEl.style.color = 'var(--kv-pink)';
    inputEl.style.fontWeight = 'bold';

    // Lưu vào database
    updatePriceBookValue(pbId, productId, unitIdx, newPrice);

    // Ẩn menu đi
    const dropdown = inputEl.nextElementSibling;
    if (dropdown) dropdown.style.display = 'none';
};
// ==========================================
// HỆ THỐNG THÔNG BÁO CHUYÊN NGHIỆP (TOAST & CONFIRM)
// ==========================================

// 1. Tự động tạo container chứa Toast
if (!document.getElementById('kv-toast-container')) {
    const container = document.createElement('div');
    container.id = 'kv-toast-container';
    document.body.appendChild(container);
}

// 2. Hàm hiển thị Toast
window.showToast = function(message, type = 'info') {
    const container = document.getElementById('kv-toast-container');
    const toast = document.createElement('div');
    toast.className = `kv-toast toast-${type}`;
    
    let icon = 'fa-circle-info';
    if(type === 'success') icon = 'fa-circle-check';
    if(type === 'error') icon = 'fa-circle-xmark';
    if(type === 'warning') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `
        <i class="fa-solid ${icon} toast-icon"></i>
        <span class="toast-msg">${message}</span>
        <div class="toast-progress"></div>
    `;
    
    container.appendChild(toast);
    
    // Hiệu ứng trượt vào
    setTimeout(() => toast.classList.add('show'), 10);
    
    // Tự xóa sau 3 giây
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
};

// 3. GHI ĐÈ HÀM ALERT MẶC ĐỊNH (Phép thuật ở đây!)
window.alert = function(msg) {
    let type = 'info';
    let lowerMsg = msg.toLowerCase();
    
    // Tự động chọn icon/màu dựa trên nội dung tin nhắn
    if (lowerMsg.includes('thành công') || lowerMsg.includes('đã lưu')) type = 'success';
    else if (lowerMsg.includes('lỗi') || lowerMsg.includes('không')) type = 'error';
    
    // Sử dụng Toast (đã có trong file của bạn) để hiện thông báo nhanh không chặn màn hình
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        // Nếu chưa có toast, dùng modal confirm dạng thông báo đơn giản
        window.showConfirm(msg, null, 'info');
        document.getElementById('btn-confirm-cancel').style.display = 'none'; // Ẩn nút hủy
        document.getElementById('btn-confirm-ok').innerText = "Đã hiểu";
    }
};


// ==========================================
// TÍNH NĂNG XÓA HÀNG LOẠT (BULK DELETE)
// ==========================================

// 1. Chọn hoặc bỏ chọn tất cả các dòng đang hiển thị
window.toggleAllProductCheckboxes = function(source) {
    const checkboxes = document.querySelectorAll('.product-item-check');
    checkboxes.forEach(cb => {
        cb.checked = source.checked;
    });
    updateSelectedCount();
};

// 2. Cập nhật số lượng đếm và hiển thị/ẩn nút xóa
window.updateSelectedCount = function() {
    const checked = document.querySelectorAll('.product-item-check:checked');
    const count = checked.length;
    const btnDelete = document.getElementById('btn-bulk-delete');
    const countSpan = document.getElementById('selected-count');
    const checkAll = document.getElementById('check-all-products');
    
    if (btnDelete) {
        btnDelete.style.display = count > 0 ? 'inline-block' : 'none';
        if (countSpan) countSpan.innerText = count;
    }
    
    // Nếu bỏ tích một ô lẻ thì ô "Chọn tất cả" cũng phải bỏ tích theo
    if (checkAll && count === 0) checkAll.checked = false;
};

window.bulkDeleteProducts = function() {
    const checked = document.querySelectorAll('.product-item-check:checked');
    const idsToDelete = Array.from(checked).map(cb => cb.getAttribute('data-id'));
    
    if (idsToDelete.length === 0) return;

    showConfirm(`Bạn muốn xóa ${idsToDelete.length} hàng hóa đã chọn?`, function() {
        // Lấy dữ liệu mới nhất từ bộ nhớ máy
        let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        
        // Lọc bỏ những mã đã chọn
        const updatedProducts = allProducts.filter(p => !idsToDelete.includes(p.id));
        
        // Cập nhật LocalStorage và Cloud cùng lúc
        localStorage.setItem('kv_products', JSON.stringify(updatedProducts));
        window.products = updatedProducts;
        
        window.uploadToCloud('products', updatedProducts);
        
        renderProductList();
        updateSelectedCount(); // Ẩn nút xóa hàng loạt
    });
};
// Tự động bôi đen khi click chuột vào thanh tìm kiếm tại các màn hình
var searchInputs = [
    'pos-search-input', // Thanh tìm kiếm Bán hàng
    'ic-search-input',  // Thanh tìm kiếm Kiểm kho
    'io-search-input',  // Thanh tìm kiếm Nhập hàng
    'search-product-manage', // Tìm kiếm danh sách hàng hóa
    'search-price-setup'     // Tìm kiếm thiết lập giá
];

searchInputs.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener('focus', function() {
            this.select(); // Bôi đen toàn bộ nội dung trong ô
        });
    }
});
window.editPriceBookName = function(id) {
    const pbIndex = window.priceBooks.findIndex(x => x.id === id);
    if (pbIndex === -1) return;

    const currentName = window.priceBooks[pbIndex].name;
    const modal = document.getElementById('custom-prompt-modal');
    const input = document.getElementById('prompt-input');
    const btnOk = document.getElementById('btn-prompt-ok');
    const btnCancel = document.getElementById('btn-prompt-cancel');

    // Thiết lập nội dung hiện đại
    document.getElementById('prompt-title').innerText = "Chỉnh sửa bảng giá";
    document.getElementById('prompt-message').innerHTML = `Đang sửa: <b>${currentName}</b><br><small style="color:red">Xóa hết tên và nhấn Xác nhận để XÓA vĩnh viễn bảng này.</small>`;
    input.value = currentName;
    
    modal.style.display = 'flex';
    input.focus();
    input.select();

    // Xử lý khi nhấn Xác nhận
    btnOk.onclick = function() {
        const newName = input.value.trim();
        
        if (newName === "") {
            // Nếu xóa trắng tên -> Chuyển sang Modal xác nhận xóa (Confirm hiện đại đã làm ở bước trước)
            modal.style.display = 'none';
            showConfirm(`Bạn có chắc muốn XÓA vĩnh viễn bảng giá <b>${currentName}</b>?`, function() {
                activePriceBookIds = activePriceBookIds.filter(item => item !== id);
                window.priceBooks.splice(pbIndex, 1);
                saveAndSyncPriceBooks();
                showToast("Đã xóa bảng giá", "success");
            }, 'delete');
        } else {
            // Đổi tên
            window.priceBooks[pbIndex].name = newName;
            saveAndSyncPriceBooks();
            modal.style.display = 'none';
            showToast("Đã đổi tên thành công", "success");
        }
    };

    // Xử lý khi nhấn Hủy
    btnCancel.onclick = function() {
        modal.style.display = 'none';
    };
};

// Hàm phụ để lưu và đẩy lên Cloud nhanh
function saveAndSyncPriceBooks() {
    localStorage.setItem('kv_pricebooks', JSON.stringify(window.priceBooks));
    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('pricebooks', window.priceBooks);
    }
    renderPriceBookSidebar();
    renderPriceSetupTable();
}
// ==========================================
// ĐỒNG BỘ HÓA THÔNG BÁO HIỆN ĐẠI (OVERRIDE)
// ==========================================

// 1. Ghi đè hàm ALERT (Dùng cho thông báo 1 nút)
window.alert = function(msg) {
    let type = 'info';
    let lowerMsg = msg.toLowerCase();
    
    // Tự động nhận diện màu sắc dựa trên nội dung
    if (lowerMsg.includes('thành công') || lowerMsg.includes('đã lưu')) type = 'success';
    else if (lowerMsg.includes('lỗi') || lowerMsg.includes('không')) type = 'warning';
    
    // Nếu có hàm Toast thì dùng Toast cho nhẹ nhàng, không thì dùng Modal
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        window.showConfirm(msg, null, 'info');
        const btnCancel = document.getElementById('btn-confirm-cancel');
        if (btnCancel) btnCancel.style.display = 'none'; // Ẩn nút Bỏ qua
        document.getElementById('btn-confirm-ok').innerText = "Đã hiểu";
    }
};

window.showConfirm = function(message, callback) {
    // Tạo phần tử modal
    const modalHtml = `
    <div id="custom-confirm" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100005;">
        <div style="background: white; width: 400px; border-radius: 8px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.3); animation: slideDown 0.2s ease-out;">
            <div style="padding: 20px; border-bottom: 1px solid #eee; display: flex; align-items: center; gap: 15px;">
                <i class="fa-solid fa-circle-question" style="font-size: 30px; color: #f8bb86;"></i>
                <div style="font-size: 16px; line-height: 1.5; color: #333;">${message}</div>
            </div>
            <div style="padding: 15px; background: #f9f9f9; display: flex; justify-content: flex-end; gap: 10px;">
                <button id="confirm-cancel" style="padding: 8px 20px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer;">Bỏ qua</button>
                <button id="confirm-ok" style="padding: 8px 20px; border: none; background: var(--kv-blue, #007bff); color: white; border-radius: 4px; cursor: pointer;">Đồng ý</button>
            </div>
        </div>
    </div>`;

    // Chèn vào body
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Xử lý sự kiện nút Đồng ý
    document.getElementById('confirm-ok').onclick = function() {
        document.getElementById('custom-confirm').remove();
        if (callback) callback();
    };

    // Xử lý sự kiện nút Bỏ qua
    document.getElementById('confirm-cancel').onclick = function() {
        document.getElementById('custom-confirm').remove();
    };
};

// Thêm hiệu ứng chuyển động nhỏ vào CSS (hoặc chèn trực tiếp vào style.css)
const style = document.createElement('style');
style.innerHTML = `
    @keyframes slideDown {
        from { transform: translateY(-20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }
`;
document.head.appendChild(style);

// 3. Ghi đè hàm CONFIRM mặc định của hệ thống
window.confirm = function(msg) {
    // Vì confirm mặc định là đồng bộ (dừng code), 
    // còn Modal là bất đồng bộ nên bạn nên chuyển sang dùng showConfirm() trong code.
    // Tuy nhiên, để chữa cháy các chỗ dùng confirm cũ:
    window.showConfirm(msg, () => {
        console.log("User clicked OK on modern confirm");
    });
    return false; // Trả về false để chặn cái confirm cũ của trình duyệt hiện lên
};
// Tự động bôi đen nội dung khi focus vào bất kỳ ô input/textarea nào[cite: 2]
document.addEventListener('focusin', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
            e.target.select(); // Thực hiện bôi đen[cite: 2]
        }, 50);
    }
});

// Bôi đen khi click trực tiếp (dùng cho trường hợp ô đã focus nhưng bấm lại lần nữa)[cite: 2]
document.addEventListener('click', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        e.target.select();
    }
});

// Hỗ trợ đặc biệt cho thiết bị cảm ứng iPhone của bạn[cite: 2]
document.addEventListener('touchstart', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setTimeout(() => {
            e.target.setSelectionRange(0, 9999);
        }, 150);
    }
}, { passive: true });
// Hàm bật/tắt trạng thái tính tiền lạnh cho từng món
window.toggleBeerIce = function(index, isChecked) {
    const tab = posTabs[activeTabIndex];
    if (tab && tab.items[index]) {
        tab.items[index].isIce = isChecked;
        calcPOSTotals(); // Tính lại toàn bộ tiền
        savePOSState();
    }
};

// Hàm tính toán số tiền lạnh dựa trên số lượng tick và tự làm tròn tổng hóa đơn
function calculateManualBeerIce() {
    const tab = posTabs[activeTabIndex];
    if (!tab) return 0;

    let totalBeerQty = 0;
    let details = [];

    // Bước 1: Đếm tổng số lượng lon/chai được tick làm lạnh
    tab.items.forEach(item => {
        if (item.isIce) {
            totalBeerQty += (parseFloat(item.qty) || 0);
            details.push(`${item.name} (${item.qty})`);
        }
    });

    // Bước 2: Mỗi lon mặc định cộng 500 đồng
    let baseIceMoney = totalBeerQty * 500;
    
    if (baseIceMoney === 0) {
        tab.beerIceAmount = 0;
        tab.beerIceNote = "";
        return 0;
    }

    // Bước 3: Thu thập dữ liệu để tính tổng hóa đơn nháp
    let totalGoods = 0;
    tab.items.forEach(item => { totalGoods += (item.qty * item.price); });
    
    let discount = tab.discount || 0;
    let extraFee = tab.extraFee || 0;

    // Tổng tiền nháp (nếu chỉ cộng đúng 500đ/lon)
    let rawTotal = totalGoods - discount + extraFee + baseIceMoney;
    
    // Làm tròn tổng tiền nháp lên hàng nghìn (VD: 13,500 -> 14,000)
    let roundedTotal = Math.ceil(rawTotal / 1000) * 1000;
    
    // Lấy phần chênh lệch (nếu có lẻ 500đ) cộng luôn vào tiền đá 
    // Việc này giúp hóa đơn in ra cho khách tính nhẩm vẫn khớp 100%
    let finalIceMoney = baseIceMoney + (roundedTotal - rawTotal);

    // Lưu kết quả vào tab để in hóa đơn
    tab.beerIceAmount = finalIceMoney;
    tab.beerIceNote = details.join(", ");
    
    return finalIceMoney;
}
window.toggleBeerIceFeature = function(isEnabled) {
    const amountEl = document.getElementById('pos-beer-ice-amount');
    amountEl.style.display = isEnabled ? 'block' : 'none';
    
    // Nếu tắt tính năng, reset toàn bộ trạng thái isIce về false
    if (!isEnabled) {
        const tab = posTabs[activeTabIndex];
        if (tab) {
            tab.items.forEach(item => item.isIce = false);
        }
    }
    
    renderPOSCart(); // Vẽ lại giỏ hàng để hiện/ẩn cột checkbox
};
// Tự động bôi đen khi focus vào ô giá hoặc số lượng trên iPhone/iPad
document.addEventListener('focusin', function(e) {
    if (e.target.id === 'pm-price' || e.target.id === 'pm-cost' || e.target.id === 'pm-stock') {
        setTimeout(() => {
            e.target.setSelectionRange(0, 9999);
        }, 150);
    }
});

// Chặn hành vi Enter của trình duyệt để nhảy ô thay vì gửi form
document.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
        if (e.target.id === 'pm-price' || e.target.id === 'pm-cost') {
            e.preventDefault();
            document.getElementById('pm-stock')?.focus();
        }
    }
});
// Tự động gắn hiệu ứng format tiền tệ cho các ô nhập liệu mà không cần sửa HTML
document.addEventListener('input', function(e) {
    if (e.target.id === 'sub-unit-price' || e.target.id === 'pm-price' || e.target.id === 'pm-cost') {
        window.formatCurrency(e.target);
    }
});
// ==========================================
// TÍNH NĂNG: DROPDOWN TÌM KIẾM TÓM TẮT TRANG QUẢN LÝ
// ==========================================
setTimeout(() => {
    const searchInput = document.getElementById('search-product-manage');
    if (!searchInput) return;

    // 1. Tạo hộp thoại Dropdown UI y hệt POS
    const dropdown = document.createElement('div');
    dropdown.id = 'manage-search-dropdown';
    dropdown.className = 'pos-search-dropdown'; // Dùng chung class của POS để có giao diện đẹp
    dropdown.style.cssText = 'display:none; position:absolute; top:calc(100% + 5px); left:0; width:100%; z-index:9999; background:white; border-radius:8px; box-shadow:0 4px 15px rgba(0,0,0,0.1); max-height:350px; overflow-y:auto; border: 1px solid #eee;';
    
    // Chèn vào HTML
    searchInput.parentNode.style.position = 'relative';
    searchInput.parentNode.insertBefore(dropdown, searchInput.nextSibling);

    // 2. Lắng nghe người dùng gõ phím
    searchInput.addEventListener('input', function(e) {
        const keyword = e.target.value;
        if (!keyword.trim()) {
            dropdown.style.display = 'none';
            return;
        }

        const cleanKw = window.removeVietnameseTones(keyword.toLowerCase().trim());
        const searchTerms = cleanKw.split(/\s+/);
        const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
        const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        
        let results = [];

        // Tìm kiếm siêu tốc
        latestProducts.forEach(p => {
            if (p.branchId !== currentBranch) return;

            let fullSearchStr = (p.name || '') + ' ' + (p.code || '') + ' ' + (p.barcode || '');
            if (p.units) p.units.forEach(u => fullSearchStr += ' ' + (u.name || '') + ' ' + (u.code || '') + ' ' + (u.barcode || ''));
            
            const cleanData = window.removeVietnameseTones(fullSearchStr.toLowerCase());
            if (searchTerms.every(term => cleanData.includes(term))) {
                const displayPrice = p.units && p.units.length > 0 ? p.units[0].price : p.price;
                results.push({ ...p, displayPrice });
            }
        });

        // 3. Hiển thị kết quả ra HTML
        if (results.length === 0) {
            dropdown.innerHTML = '<div style="padding:15px; color:#888; text-align:center;">Không tìm thấy hàng hóa</div>';
        } else {
            dropdown.innerHTML = results.slice(0, 15).map(p => `
                <div class="pos-dropdown-item pos-item-node" 
                     onclick="openEditProductModal('${p.id}'); document.getElementById('manage-search-dropdown').style.display='none';" 
                     style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #f4f4f4; display: flex; justify-content: space-between; align-items: center;">
                    <div style="flex:1;">
                        <strong style="color: var(--kv-blue);">${p.code || '---'}</strong> - 
                        <strong style="color: #333;">${p.name}</strong>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: var(--kv-pink);">${(p.displayPrice || 0).toLocaleString('vi-VN')}</div>
                        <div style="font-size: 11px; color: #888; margin-top: 2px;">Tồn kho: ${p.stock || 0}</div>
                    </div>
                </div>`).join('');
        }
        dropdown.style.display = 'block';
    });

    // 4. Các sự kiện tắt Dropdown khi click chỗ khác
    document.addEventListener('click', function(e) {
        if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });
    
    // 5. Hỗ trợ phím mũi tên và phím Enter mở form trực tiếp
    let currentFocusManage = -1;
    searchInput.addEventListener('keydown', function(e) {
        const items = dropdown.querySelectorAll('.pos-item-node');
        if (e.key === 'ArrowDown') {
            e.preventDefault(); currentFocusManage++; addActiveManage(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault(); currentFocusManage--; addActiveManage(items);
        } else if (e.key === 'Enter') {
            if (currentFocusManage > -1 && items.length > 0) {
                e.preventDefault();
                items[currentFocusManage].click(); // Mở món đang chọn
            } else if (items.length > 0) {
                e.preventDefault();
                items[0].click(); // Mặc định mở món đầu tiên nếu Enter luôn
            }
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
        }
    });

    function addActiveManage(items) {
        if (!items || items.length === 0) return;
        items.forEach(item => { item.style.background = "white"; });
        if (currentFocusManage >= items.length) currentFocusManage = 0;
        if (currentFocusManage < 0) currentFocusManage = items.length - 1;
        items[currentFocusManage].style.background = "#eef6ff";
        items[currentFocusManage].scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
}, 1000);
// HÀM TÔ MÀU NỀN CHO DÒNG ĐANG THIẾT LẬP GIÁ
window.highlightRow = function(element, isFocused) {
    const tr = element.closest('tr');
    if (tr) {
        if (isFocused) {
            // Lưu lại màu cũ (nếu có) và đổi sang màu xanh dương nhạt cho dịu mắt
            if (!tr.dataset.oldBg) tr.dataset.oldBg = tr.style.backgroundColor || '';
            tr.style.backgroundColor = '#e3f2fd'; // Màu xanh nhạt (giúp nổi bật nhưng không chói)
        } else {
            // Trả lại màu bình thường khi click ra chỗ khác
            tr.style.backgroundColor = tr.dataset.oldBg || '';
        }
    }
};
// ==========================================
// TÍNH NĂNG DROPDOWN TÌM KIẾM NHÓM HÀNG (MODAL THÊM/SỬA SẢN PHẨM)
// ==========================================

// 1. Hàm vẽ cấu trúc cây nhóm hàng
window.renderPMGroupTree = function() {
    const container = document.getElementById('pm-group-tree-list');
    if (!container) return;

    const currentGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];

    function buildPMTree(parentId, indent) {
        const targetParent = parentId || "";
        const children = currentGroups.filter(g => (g.parentId || "") === targetParent);
        let html = '';

        children.forEach(child => {
            const childId = child.id || "";
            const hasChildren = currentGroups.some(g => (g.parentId || "") === childId);
            const toggleIcon = hasChildren
                ? `<i class="fa-solid fa-chevron-right pm-group-toggle" onclick="event.stopPropagation(); toggleGroupChildrenGeneric('pm-children-${child.id}', this)" style="cursor: pointer; width: 20px; text-align: center; color: #888; transition: 0.2s; font-size: 11px;"></i>`
                : `<span style="width: 20px; display: inline-block;"></span>`;

            html += `
            <div class="pm-group-tree-item" data-id="${child.id}" data-name="${(child.name || '').toLowerCase()}" style="padding: 8px; padding-left: ${indent + 8}px; border-bottom: 1px dashed #eee; transition: 0.2s; cursor: pointer; display: flex; align-items: center;" onclick="selectPMGroup('${child.id}', '${child.name}')" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='transparent'">
                ${toggleIcon}
                <span style="font-size: 13px; color: #333; flex: 1; font-weight: 500;">${child.name}</span>
            </div>`;

            if (hasChildren) {
                html += `<div id="pm-children-${child.id}" class="pm-group-children-container" style="display: none;">`;
                html += buildPMTree(child.id, indent + 15);
                html += `</div>`;
            }
        });
        return html;
    }

    container.innerHTML = buildPMTree("", 0);
};

// 2. Hàm Đóng/Mở Dropdown
window.togglePMGroupDropdown = function() {
    const dropdown = document.getElementById('pm-group-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        if (dropdown.style.display === 'block') {
            document.getElementById('search-pm-group').focus(); // Auto focus vào ô tìm kiếm
        }
    }
};

// 3. Hàm chọn Nhóm Hàng
window.selectPMGroup = function(id, name) {
    document.getElementById('pm-group').value = id; // Gắn ID vào thẻ ẩn (Để code lưu sản phẩm tự bắt được)
    
    const displayEl = document.getElementById('pm-group-display');
    displayEl.innerText = name;
    displayEl.style.color = id ? 'var(--kv-blue)' : '#555';
    displayEl.style.fontWeight = id ? 'bold' : 'normal';
    
    document.getElementById('pm-group-dropdown').style.display = 'none';
};

// 4. Hàm Tìm kiếm thông minh (Mở cả nhóm cha và nhóm con)
window.filterPMGroupTree = function() {
    const rawKw = document.getElementById('search-pm-group').value.toLowerCase().trim();
    const kw = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(rawKw) : rawKw;
    const items = document.querySelectorAll('.pm-group-tree-item');

    items.forEach(item => item.style.display = 'none');

    if (kw === '') {
        items.forEach(item => item.style.display = 'flex');
        return;
    }

    items.forEach(item => {
        const rawName = item.getAttribute('data-name') || '';
        const name = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(rawName) : rawName;

        if (name.includes(kw)) {
            item.style.display = 'flex'; 
            
            const groupId = item.getAttribute('data-id');

            // Mở nhóm con (Nếu có)
            const childrenContainer = document.getElementById(`pm-children-${groupId}`);
            if (childrenContainer) {
                childrenContainer.style.display = 'block';
                const icon = item.querySelector('.pm-group-toggle');
                if (icon) {
                    icon.classList.remove('fa-chevron-right');
                    icon.classList.add('fa-chevron-down');
                }
                const descendantItems = childrenContainer.querySelectorAll('.pm-group-tree-item');
                descendantItems.forEach(desc => desc.style.display = 'flex');
            }

            // Lần ngược mở nhóm cha
            let parentContainer = item.closest('.pm-group-children-container');
            while (parentContainer) {
                parentContainer.style.display = 'block';
                const parentId = parentContainer.id.replace('pm-children-', '');
                const parentItem = document.querySelector(`.pm-group-tree-item[data-id="${parentId}"]`);
                if (parentItem) parentItem.style.display = 'flex';
                
                const parentIcon = parentItem ? parentItem.querySelector('.pm-group-toggle') : null;
                if (parentIcon) {
                    parentIcon.classList.remove('fa-chevron-right');
                    parentIcon.classList.add('fa-chevron-down');
                }
                parentContainer = parentContainer.parentElement.closest('.pm-group-children-container');
            }
        }
    });
};

// 5. Tích hợp vẽ lại Dropdown này khi tải danh mục nhóm
const originalRenderGroupSelects = window.renderGroupSelects;
window.renderGroupSelects = function() {
    if (typeof originalRenderGroupSelects === 'function') originalRenderGroupSelects();
    if (typeof window.renderPMGroupTree === 'function') window.renderPMGroupTree();
};

// 6. Đóng Dropdown khi click chuột ra ngoài vùng khác
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('pm-group-dropdown');
    const trigger = document.getElementById('pm-group-trigger');
    if (dropdown && dropdown.style.display === 'block' && trigger && !dropdown.contains(e.target) && !trigger.contains(e.target)) {
        dropdown.style.display = 'none';
    }
});
// ==========================================
// TỰ ĐỘNG CHUYỂN HÀNG HÓA CHƯA CÓ NHÓM VÀO NHÓM "KHÁC"
// ==========================================
// ==========================================
// TỰ ĐỘNG CHUYỂN HÀNG HÓA CHƯA CÓ NHÓM VÀO NHÓM "KHÁC" (BẢN CHUẨN)
// ==========================================
window.autoAssignUnassignedProducts = function() {
    let currentGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
    let currentProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    
    // 1. Tìm hoặc tạo nhóm Khác
    let nhomKhac = currentGroups.find(g => g.name && g.name.trim().toLowerCase() === 'khác');
    let isGroupChanged = false;

    if (!nhomKhac) {
        nhomKhac = {
            id: 'g_' + Date.now() + '_khac',
            name: 'Khác',
            parentId: ''
        };
        currentGroups.push(nhomKhac);
        localStorage.setItem('kv_groups', JSON.stringify(currentGroups));
        isGroupChanged = true;
    }
    
    // 2. Quét quét toàn bộ sản phẩm
    let hasChanges = false;
    let updatedProducts = currentProducts.map(p => {
        // Bắt chặt chẽ mọi trường hợp: rỗng, undefined, null hoặc chứa hẳn chữ "Chưa phân nhóm"
        if (!p.group || p.group.toString().trim() === '' || p.group === 'Chưa phân nhóm' || p.group === 'null' || p.group === 'undefined') {
            p.group = nhomKhac.id;
            hasChanges = true;
        }
        return p;
    });
    
    // 3. Lưu và Đồng bộ
    if (hasChanges || isGroupChanged) {
        localStorage.setItem('kv_products', JSON.stringify(updatedProducts));
        
        // CẬP NHẬT BIẾN TOÀN CỤC (Fix lỗi không hiển thị tên nhóm)
        window.products = updatedProducts;
        window.productGroups = currentGroups; 
        
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('kv_products', updatedProducts);
            if (isGroupChanged) window.uploadToCloud('kv_groups', currentGroups);
        }
        console.log("✅ Đã xử lý toàn bộ hàng hóa chưa phân nhóm vào nhóm 'Khác'.");
    }
};

// Kích hoạt chạy hàm quét tự động sau khi trang tải xong 1.5 giây (để đảm bảo dữ liệu Firebase/Local hoàn tất)
setTimeout(() => {
    if (typeof window.autoAssignUnassignedProducts === 'function') {
        window.autoAssignUnassignedProducts();
    }
}, 1500);
window.closeIOView = function() {
    // 1. Ẩn form chi tiết phiếu nhập
    const detailView = document.getElementById('io-detail-view') || document.getElementById('io-form-view');
    if (detailView) detailView.style.display = 'none';

    // 2. Hiển thị lại màn hình danh sách quản lý
    const listView = document.getElementById('io-list-view') || document.getElementById('io-main-view');
    if (listView) listView.style.display = 'block';

    // 3. Dọn dẹp dữ liệu rác để lần sau tạo phiếu mới không bị dính hàng cũ
    if (typeof currentIOItems !== 'undefined') {
        currentIOItems = []; // Reset giỏ hàng
    }
    
    // 4. Xóa ghi chú hoặc từ khóa tìm kiếm còn sót lại
    const searchInput = document.getElementById('io-search-input');
    if (searchInput) searchInput.value = '';
    const noteInput = document.getElementById('io-note');
    if (noteInput) noteInput.value = '';
    
    // 5. Cập nhật lại giao diện (Làm rỗng bảng nhập & Tải lại danh sách phiếu)
    if (typeof renderIOItemsTable === 'function') renderIOItemsTable(); 
    if (typeof renderIOList === 'function') renderIOList(); 
};
window.closeCreateCheckView = function() {
    if (currentICItems.length > 0 && !editingICId) {
        // Sử dụng giao diện showConfirm hiện đại thay vì confirm cũ
        showConfirm("Phiếu chưa được lưu. Bạn có chắc chắn muốn thoát?", function() {
            // Nếu người dùng bấm Đồng ý thoát
            currentICItems = []; // Dọn sạch giỏ hàng tạm
            document.getElementById('inventory-check-view').style.display = 'none';
        });
    } else {
        // Thoát bình thường nếu không có hàng hoặc đang ở chế độ sửa
        currentICItems = []; 
        document.getElementById('inventory-check-view').style.display = 'none';
    }
};
// Hàm chuyển đổi trạng thái ngôi sao
window.toggleRowStar = function(element) {
    element.classList.toggle('marked');
    if (element.classList.contains('marked')) {
        element.classList.remove('fa-regular');
        element.classList.add('fa-solid');
    } else {
        element.classList.remove('fa-solid');
        element.classList.add('fa-regular');
    }
};
// ==========================================
// TÍNH NĂNG: LƯU NHÁP PHIẾU NHẬP (CHỐNG MẤT DỮ LIỆU KHI F5)
// ==========================================

window.saveIOState = function() {
    const ioView = document.getElementById('import-order-view');
    // Chỉ lưu khi màn hình nhập hàng đang được mở hiển thị
    if (ioView && ioView.style.display !== 'none') {
        const ioState = {
            isOpen: true,
            editingId: typeof editingIOId !== 'undefined' ? editingIOId : null,
            ioCode: document.getElementById('io-code')?.value || '',
            items: typeof currentIOItems !== 'undefined' ? currentIOItems : [],
            supplier: document.getElementById('io-supplier')?.value || '',
            note: document.getElementById('io-note')?.value || '',
            discount: document.getElementById('io-discount')?.value || '0',
            extraFee: document.getElementById('io-extra-fee')?.value || '0',
            paid: document.getElementById('io-paid')?.value || '0'
        };
        localStorage.setItem('kv_io_state', JSON.stringify(ioState));
    }
};

window.clearIOState = function() {
    localStorage.removeItem('kv_io_state');
};

window.restoreIOState = function() {
    const savedStateStr = localStorage.getItem('kv_io_state');
    if (savedStateStr) {
        try {
            const savedState = JSON.parse(savedStateStr);
            if (savedState && savedState.isOpen) {
                // 1. Hiển thị lại màn hình
                const ioView = document.getElementById('import-order-view');
                if (ioView) ioView.style.display = 'flex';
                
                // 2. Phục hồi biến dữ liệu mảng
                editingIOId = savedState.editingId;
                currentIOItems = savedState.items || [];
                window.currentIOItems = currentIOItems;
                
                // 3. Phục hồi các ô input bằng text
                if (document.getElementById('io-code')) document.getElementById('io-code').value = savedState.ioCode;
                if (document.getElementById('io-supplier')) document.getElementById('io-supplier').value = savedState.supplier;
                if (document.getElementById('io-note')) document.getElementById('io-note').value = savedState.note;
                if (document.getElementById('io-discount')) document.getElementById('io-discount').value = savedState.discount;
                if (document.getElementById('io-extra-fee')) document.getElementById('io-extra-fee').value = savedState.extraFee;
                if (document.getElementById('io-paid')) document.getElementById('io-paid').value = savedState.paid;
                
                // 4. Phục hồi tên người tạo
                const creatorEl = document.getElementById('io-creator-name');
                if(creatorEl && typeof currentUser !== 'undefined' && currentUser) {
                    creatorEl.innerText = currentUser.fullname;
                }
                
                // 5. Kích hoạt vẽ lại bảng và tính tổng tiền
                if (typeof renderIOItemsTable === 'function') renderIOItemsTable();
            }
        } catch (e) {
            console.error("Lỗi nạp state IO:", e);
            clearIOState();
        }
    }
};



window.closeCreateImportView = function() {
    const ioId = document.getElementById('io-code')?.value;

    // 1. Kiểm tra xem đây có phải là phiếu cũ đã hoàn thành hoặc hủy không
    if (editingIOId || ioId) {
        const allImps = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
        const found = allImps.find(x => String(x.id) === String(editingIOId || ioId));
        
        // FIX: Thoát thẳng nếu phiếu đã hoàn thành (done) HOẶC đã hủy (cancel)
        if (found && (found.status === 'done' || found.status === 'cancel')) {
            document.getElementById('import-order-view').style.display = 'none';
            currentIOItems = []; 
            window.currentIOItems = [];
            editingIOId = null;
            if (typeof clearIOState === 'function') clearIOState();
            return; 
        }
    }

    // 2. Logic xử lý cho phiếu mới hoặc phiếu tạm thông thường (Auto-Save Draft)
    const items = typeof currentIOItems !== 'undefined' ? currentIOItems : (window.currentIOItems || []);
    if (items.length > 0) {
        if (typeof showToast === 'function') {
            showToast("Hệ thống tự động Lưu Tạm do phiếu đang nhập dở!", "info");
        } else {
            alert("Hệ thống tự động Lưu Tạm do phiếu đang nhập dở!");
        }
        
        if (typeof window.saveImportOrder === 'function') {
            window.saveImportOrder('draft');
        }
    } else {
        const ioView = document.getElementById('import-order-view');
        if (ioView) ioView.style.display = 'none';
        
        currentIOItems = []; 
        window.currentIOItems = [];
        editingIOId = null;
        if (typeof clearIOState === 'function') clearIOState();
    }
};

const _origSaveIO = window.saveImportOrder;
window.saveImportOrder = function(action) {
    const itemsToSave = typeof currentIOItems !== 'undefined' ? currentIOItems : (window.currentIOItems || []);

    if (itemsToSave.length === 0) { 
        if (typeof showToast === 'function') showToast("Vui lòng chọn ít nhất 1 mặt hàng!", "warning");
        else alert("Vui lòng chọn ít nhất 1 mặt hàng!");
        return; 
    }

    let allImportOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
    const ioId = document.getElementById('io-code').value.trim();

    const existingOrder = allImportOrders.find(x => String(x.id) === String(editingIOId || ioId));
    if (existingOrder && existingOrder.status === 'cancel') {
        if (typeof showToast === 'function') showToast("Phiếu này đã bị hủy, không thể thay đổi!", "error");
        else alert("Phiếu này đã bị hủy, không thể thay đổi!");
        return; 
    }

    // [THÊM MỚI] Khóa đồng bộ dữ liệu
    window.isSyncLocked = true;

    const totalAmountEl = document.getElementById('io-total-amount');
    const totalAmount = parseFloat(totalAmountEl ? totalAmountEl.dataset.val : 0) || 0;

    const ioData = {
        id: ioId,
        branchId: localStorage.getItem('kv_current_branch') || 'CN001',
        timestamp: existingOrder ? existingOrder.timestamp : Date.now(),
        createdAt: existingOrder ? existingOrder.createdAt : new Date().toLocaleString('vi-VN'),
        creator: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.fullname : 'Admin',
        supplierName: document.getElementById('io-supplier').value.trim() || 'Nhà cung cấp lẻ',
        status: action,
        note: document.getElementById('io-note').value.trim(),
        items: JSON.parse(JSON.stringify(itemsToSave)),
        totalAmount: totalAmount,
        ioDiscount: window.parseCurrency(document.getElementById('io-discount').value) || 0,
        ioExtraFee: window.parseCurrency(document.getElementById('io-extra-fee').value) || 0,
        paid: window.parseCurrency(document.getElementById('io-paid').value) || 0,
        mustPay: totalAmount - (window.parseCurrency(document.getElementById('io-discount').value) || 0) + (window.parseCurrency(document.getElementById('io-extra-fee').value) || 0)
    };

    // LOGIC CẬP NHẬT TỒN KHO THÔNG MINH
    if (action === 'done') {
        let latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];

        if (existingOrder && existingOrder.status === 'done') {
            existingOrder.items.forEach(oldItem => {
                const prod = latestProducts.find(p => p.id === oldItem.productId);
                if (prod) {
                    const oldRate = (oldItem.units && oldItem.units[oldItem.selectedUnitIdx]) ? (oldItem.units[oldItem.selectedUnitIdx].rate || 1) : 1;
                    prod.stock = (parseFloat(prod.stock) || 0) - (oldItem.qty * oldRate);
                }
            });
        }

        itemsToSave.forEach(item => {
            const prod = latestProducts.find(p => p.id === item.productId);
            if (prod) {
                const rate = (item.units && item.units[item.selectedUnitIdx]) ? (item.units[item.selectedUnitIdx].rate || 1) : 1;
                const qtyInBaseUnit = item.qty * rate;
                
                prod.stock = (parseFloat(prod.stock) || 0) + qtyInBaseUnit;
                prod.cost = item.cost / rate; 
            }
        });
        localStorage.setItem('kv_products', JSON.stringify(latestProducts));
        if (window.uploadToCloud) window.uploadToCloud('products', latestProducts);
    }

    const idx = allImportOrders.findIndex(x => String(x.id) === String(ioId));
    if (idx !== -1) {
        allImportOrders[idx] = ioData; 
    } else {
        allImportOrders.unshift(ioData); 
    }

    localStorage.setItem('kv_import_orders', JSON.stringify(allImportOrders));
    if (window.uploadToCloud) window.uploadToCloud('import_orders', allImportOrders);

    // DỌN DẸP TRẠNG THÁI GIAO DIỆN CHỐNG KẸT
    currentIOItems = []; 
    window.currentIOItems = [];
    editingIOId = null; 
    if (typeof clearIOState === 'function') clearIOState();

    const ioView = document.getElementById('import-order-view');
    if (ioView) ioView.style.display = 'none';

    if (typeof renderImportOrders === 'function') renderImportOrders();
    
    const msg = action === 'done' ? "Cập nhật phiếu và tồn kho thành công!" : "Đã lưu phiếu tạm.";
    if (typeof showToast === 'function') showToast(msg, "success");
    else alert(msg);

    // [THÊM MỚI] Mở khóa đồng bộ
    setTimeout(() => { window.isSyncLocked = false; }, 3000);
};

const _origAddIO = window.addIOToList;
window.addIOToList = function(productId) {
    if (_origAddIO) _origAddIO(productId);
    saveIOState(); // Lưu ngay khi thêm hàng mới
};

const _origRemoveIO = window.removeIOItem;
window.removeIOItem = function(index) {
    if (_origRemoveIO) _origRemoveIO(index);
    saveIOState(); // Lưu khi xóa hàng
};

const _origUpdateIO = window.updateIOItemState;
window.updateIOItemState = function(index, field, value) {
    if (_origUpdateIO) _origUpdateIO(index, field, value);
    saveIOState(); // Lưu khi đổi số lượng/giá
};

// Tự động lưu khi gõ chữ xong ở các ô (Giảm giá, phí, Nhà cung cấp...)
document.addEventListener('change', function(e) {
    if (['io-supplier', 'io-note', 'io-discount', 'io-extra-fee', 'io-paid'].includes(e.target.id)) {
        saveIOState();
    }
});

// KÍCH HOẠT PHỤC HỒI DỮ LIỆU KHI NHẤN F5
setTimeout(() => {
    // Chỉ kích hoạt nếu user đang đứng ở màn hình quản lý & Tab Nhập hàng
    if (sessionStorage.getItem('kv_current_view') === 'dashboard-view' && 
        localStorage.getItem('kv_current_tab') === 'tab-nhap-hang') {
        restoreIOState();
    }
}, 1200); // Đợi 1.2s cho hệ thống tải xong dữ liệu Firebase rồi mới bung form ra
// Hàm xử lý click ngôi sao dành riêng cho Phiếu Nhập
window.toggleIOStar = function(index, element) {
    let items = typeof currentIOItems !== 'undefined' ? currentIOItems : (window.currentIOItems || []);
    if (items[index]) {
        // 1. Lưu trạng thái thật vào bộ nhớ dữ liệu
        items[index].isMarked = !items[index].isMarked;
        
        // 2. Đổi giao diện lập tức
        if (items[index].isMarked) {
            element.className = 'fa-solid fa-star star-mark marked';
            element.style.color = '#ffc107'; // Vàng
        } else {
            element.className = 'fa-regular fa-star star-mark';
            element.style.color = ''; // Rỗng
        }
        
        // 3. KÍCH HOẠT LƯU NHÁP TỰ ĐỘNG NGAY LẬP TỨC (F5 không mất)
        if (typeof window.saveIOState === 'function') {
            window.saveIOState();
        }
    }
};
// ==========================================
// TÍNH NĂNG: QUÉT PHÁT HIỆN TRÙNG TÊN SẢN PHẨM
// ==========================================
window.scanDuplicateProducts = function() {
    const tbody = document.querySelector('#duplicate-products-table tbody');
    if (!tbody) return;

    const allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    const currentBranch = localStorage.getItem('kv_current_branch')|| 'CN001';
    
    // Chỉ lọc các sản phẩm thuộc chi nhánh hiện tại
    const branchProducts = allProducts.filter(p => (p.branchId || 'CN001') === currentBranch);
    
    const nameGroups = {};
    branchProducts.forEach(p => {
        let cleanName = (p.name || '').trim().toLowerCase();
        
        // Khử dấu tiếng Việt
        if (typeof window.removeVietnameseTones === 'function') {
            cleanName = window.removeVietnameseTones(cleanName);
        }

        if (!cleanName) return; 

        if (!nameGroups[cleanName]) {
            nameGroups[cleanName] = [];
        }
        nameGroups[cleanName].push(p);
    });

    const duplicateGroups = Object.values(nameGroups).filter(group => group.length > 1);

    if (duplicateGroups.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align:center; padding: 40px; color: #28a745;">
                    <i class="fa-solid fa-circle-check" style="font-size: 30px; margin-bottom: 15px; display: block;"></i>
                    Tuyệt vời! Không phát hiện mặt hàng nào bị trùng tên trong chi nhánh này.
                </td>
            </tr>`;
        return;
    }

    let html = '';
    let stt = 1;
    const allGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];

    duplicateGroups.forEach((group, groupIndex) => {
        const displayOrigName = group[0].name || "Tên trống";
        html += `
            <tr style="background: #fff8e5;">
                <td colspan="6" style="font-weight: bold; color: #b58900; font-size: 13px; padding-top: 15px;">
                    <i class="fa-solid fa-link" style="margin-right: 5px;"></i> Nhóm ${groupIndex + 1}: Phát hiện ${group.length} mặt hàng giống tên "${displayOrigName}"
                </td>
            </tr>`;
        
        group.forEach(p => {
            const groupObj = allGroups.find(g => g.id === p.group);
            const groupName = groupObj ? groupObj.name : 'Chưa phân nhóm';
            const price = p.units && p.units.length > 0 ? p.units[0].price : p.price;

            html += `
                <tr style="border-bottom: 1px dashed #eee;">
                    <td style="text-align: center; color: #888;">${stt++}</td>
                    <td style="color: var(--kv-blue); font-weight: 600;">${p.code || '---'}</td>
                    <td style="color: #d9534f; font-weight: 500;">${p.name}</td>
                    <td style="color: #555;">${groupName}</td>
                    <td style="text-align: right; font-weight: bold;">${(price || 0).toLocaleString('vi-VN')}</td>
                    <td style="text-align: center;">
                        <button onclick="openEditProductModal('${p.id}')" style="background: white; border: 1px solid #007bff; color: #007bff; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin-right: 5px;"><i class="fa-solid fa-pen"></i> Sửa</button>
                        <button onclick="deleteProduct('${p.id}', '${p.name}'); setTimeout(window.scanDuplicateProducts, 1000);" style="background: white; border: 1px solid #d9534f; color: #d9534f; padding: 4px 8px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash"></i> Xóa</button>
                    </td>
                </tr>
            `;
        });
    });

    tbody.innerHTML = html;
};
// ==========================================
// TÍNH NĂNG DROPDOWN TÌM KIẾM NHÓM CHA (MODAL TẠO NHÓM)
// ==========================================

window.renderParentGroupTree = function(invalidParents = []) {
    const container = document.getElementById('parent-group-tree-list');
    if (!container) return;

    const currentGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];

    function buildTree(parentId, indent) {
        const targetParent = parentId || "";
        const children = currentGroups.filter(g => (g.parentId || "") === targetParent);
        let html = '';

        children.forEach(child => {
            const childId = child.id || "";
            const hasChildren = currentGroups.some(g => (g.parentId || "") === childId);
            const toggleIcon = hasChildren
                ? `<i class="fa-solid fa-chevron-right parent-group-toggle" onclick="event.stopPropagation(); toggleGroupChildrenGeneric('parent-children-${child.id}', this)" style="cursor: pointer; width: 20px; text-align: center; color: #888; transition: 0.2s; font-size: 11px;"></i>`
                : `<span style="width: 20px; display: inline-block;"></span>`;

            // Làm mờ và khóa click với các nhóm nằm trong danh sách không hợp lệ
            const isDisabled = invalidParents.includes(childId);
            const styleDisabled = isDisabled ? 'opacity: 0.4; cursor: not-allowed; pointer-events: none;' : 'cursor: pointer;';
            const hoverAction = isDisabled ? '' : `onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='transparent'"`;
            const clickAction = isDisabled ? '' : `onclick="selectParentGroup('${child.id}', '${child.name}')"`;

            html += `
            <div class="parent-group-tree-item" data-id="${child.id}" data-name="${(child.name || '').toLowerCase()}" style="padding: 8px; padding-left: ${indent + 8}px; border-bottom: 1px dashed #eee; transition: 0.2s; display: flex; align-items: center; ${styleDisabled}" ${clickAction} ${hoverAction}>
                ${toggleIcon}
                <span style="font-size: 13px; color: #333; flex: 1; font-weight: 500;">${child.name}</span>
            </div>`;

            if (hasChildren) {
                html += `<div id="parent-children-${child.id}" class="parent-group-children-container" style="display: none;">`;
                html += buildTree(child.id, indent + 15);
                html += `</div>`;
            }
        });
        return html;
    }
    container.innerHTML = buildTree("", 0);
};


// Đóng/Mở thanh Dropdown
window.toggleParentGroupDropdown = function() {
    const dropdown = document.getElementById('group-parent-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        if (dropdown.style.display === 'block') {
            const searchInput = document.getElementById('search-parent-group');
            if (searchInput) searchInput.focus();
        }
    }
};

// Chọn nhóm cha
window.selectParentGroup = function(id, name) {
    document.getElementById('group-parent').value = id;
    const displayEl = document.getElementById('group-parent-display');
    displayEl.innerText = name;
    displayEl.style.color = id ? 'var(--kv-blue)' : '#555';
    displayEl.style.fontWeight = id ? 'bold' : 'normal';
    document.getElementById('group-parent-dropdown').style.display = 'none';
};

// Tìm kiếm lọc thông minh
window.filterParentGroupTree = function() {
    const rawKw = document.getElementById('search-parent-group').value.toLowerCase().trim();
    const kw = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(rawKw) : rawKw;
    const items = document.querySelectorAll('.parent-group-tree-item');

    items.forEach(item => item.style.display = 'none');
    if (kw === '') { items.forEach(item => item.style.display = 'flex'); return; }

    items.forEach(item => {
        const rawName = item.getAttribute('data-name') || '';
        const name = typeof window.removeVietnameseTones === 'function' ? window.removeVietnameseTones(rawName) : rawName;

        if (name.includes(kw)) {
            item.style.display = 'flex'; 
            const groupId = item.getAttribute('data-id');

            // Hiển thị nhóm con
            const childrenContainer = document.getElementById(`parent-children-${groupId}`);
            if (childrenContainer) {
                childrenContainer.style.display = 'block';
                const icon = item.querySelector('.parent-group-toggle');
                if (icon) { icon.classList.remove('fa-chevron-right'); icon.classList.add('fa-chevron-down'); }
                childrenContainer.querySelectorAll('.parent-group-tree-item').forEach(desc => desc.style.display = 'flex');
            }

            // Mở nhóm cha phía trên
            let parentContainer = item.closest('.parent-group-children-container');
            while (parentContainer) {
                parentContainer.style.display = 'block';
                const parentId = parentContainer.id.replace('parent-children-', '');
                const parentItem = document.querySelector(`.parent-group-tree-item[data-id="${parentId}"]`);
                if (parentItem) parentItem.style.display = 'flex';
                
                const parentIcon = parentItem ? parentItem.querySelector('.parent-group-toggle') : null;
                if (parentIcon) { parentIcon.classList.remove('fa-chevron-right'); parentIcon.classList.add('fa-chevron-down'); }
                parentContainer = parentContainer.parentElement.closest('.parent-group-children-container');
            }
        }
    });
};

// Đóng Menu khi click chuột ra ngoài vùng khác
document.addEventListener('click', function(e) {
    const parentDropdown = document.getElementById('group-parent-dropdown');
    const parentTrigger = document.getElementById('group-parent-trigger');
    if (parentDropdown && parentDropdown.style.display === 'block' && parentTrigger && !parentDropdown.contains(e.target) && !parentTrigger.contains(e.target)) {
        parentDropdown.style.display = 'none';
    }
});
// ==========================================
// TÍNH NĂNG QUÉT MÃ VẠCH (TỐI ƯU CHO ĐIỆN THOẠI)
// ==========================================
var html5QrCode = null;
var lastScannedCode = "";
var scanCooldownTimer = null;

window.startBarcodeScanner = function(context) {
    // 1. Hiện UI Full màn hình chuyên cho điện thoại
    document.getElementById('scanner-modal').style.display = 'flex';

    // 2. Delay nhẹ để UI lên hình trước khi bật cam
    setTimeout(() => {
        if (html5QrCode && html5QrCode.getState() === 2) {
            html5QrCode.stop().then(() => {
                html5QrCode.clear();
                initScanner(context);
            }).catch(() => initScanner(context));
        } else {
            initScanner(context);
        }
    }, 200);
};

function initScanner(context) {
    html5QrCode = new Html5Qrcode("reader");

    // 1. Tối ưu khung quét và tăng tốc độ khung hình (fps) để bắt nét nhanh hơn
    const config = {
        fps: 20, // Tăng fps từ 10 lên 20 để mượt hơn
        qrbox: function(viewfinderWidth, viewFinderHeight) {
            let minEdgeSize = Math.min(viewfinderWidth, viewFinderHeight);
            let qrboxSize = Math.floor(minEdgeSize * 0.75); 
            return { width: qrboxSize, height: qrboxSize };
        },
        aspectRatio: 1.0
    };

    // 2. CẤU HÌNH CAMERA NÂNG CAO CHO IPHONE
    const cameraConstraints = {
        facingMode: "environment",
        // Ép độ phân giải cao (Full HD) để cầm xa vẫn đọc được các vạch nhỏ
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        // Thử ép zoom kỹ thuật số 2x (hoạt động tốt trên iOS 15+ và Android)
        advanced: [{ zoom: 2.0 }]
    };

    html5QrCode.start(
        cameraConstraints, 
        config,
        (decodedText, decodedResult) => {
            const scannedCode = decodedText.trim();

            // Chống quét đúp 1 mã liên tục (Debounce 1.5s)
            if (scannedCode === lastScannedCode) return;
            lastScannedCode = scannedCode;
            clearTimeout(scanCooldownTimer);
            scanCooldownTimer = setTimeout(() => { lastScannedCode = ""; }, 2000);

playBeepSound();
            
            // Kiểm tra trạng thái nút Quét liên tục
            const isContinuous = document.getElementById('continuous-scan-toggle');
            if (!isContinuous || !isContinuous.checked) {
                closeBarcodeScanner(); // Chỉ đóng khi không bật chế độ liên tục
            }
            
            processScannedData(context, scannedCode);
        },
        (errorMessage) => { /* Ẩn các lỗi nhòe nét khi cam đang lia */ }
    ).catch(err => {
        alert("Lỗi camera. Vui lòng đảm bảo web dùng HTTPS và cấp quyền Camera!");
        closeBarcodeScanner();
    });
}

window.closeBarcodeScanner = function() {
    document.getElementById('scanner-modal').style.display = 'none';
    if (html5QrCode && html5QrCode.getState() === 2) {
        html5QrCode.stop().then(() => {
            html5QrCode.clear();
        }).catch(err => console.error(err));
    }
};

// Map nút X vào cùng hàm đóng
window.stopBarcodeScanner = window.closeBarcodeScanner;

// Hàm phân luồng dữ liệu tự động
function processScannedData(context, barcode) {
    let inputElement = null;

    if (context === 'manage') {
        inputElement = document.getElementById('search-product-manage');
    } else if (context === 'price') {
        inputElement = document.getElementById('search-price-setup');
    } else if (context === 'update') {
        inputElement = document.getElementById('search-batch-update');
    } else if (context === 'import') {
        inputElement = document.getElementById('io-search-input');
    } else if (context === 'check') {
        inputElement = document.getElementById('ic-search-input');
    } else if (context === 'pos') {
        inputElement = document.getElementById('pos-search-input');
    }

    if (inputElement) {
        // Gắn số vào ô
        inputElement.value = barcode;
        
        // Luồng 1: Màn hình bán hàng (POS)
        if (context === 'pos' && typeof handleDirectEnter === 'function') {
            handleDirectEnter(barcode.toLowerCase());
            return;
        }
        
        // Luồng 2: Màn hình Kiểm kho (Tự động +1 vào danh sách)
        if (context === 'check' && typeof searchICProduct === 'function') {
            const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
            const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
            let exactMatch = null;
            
            for (let p of latestProducts) {
                if (p.branchId !== currentBranch) continue;
                if ((p.barcode && p.barcode.toLowerCase() === barcode.toLowerCase()) || (p.code && p.code.toLowerCase() === barcode.toLowerCase())) {
                    exactMatch = p; break;
                }
                if (p.units) {
                    let uMatch = p.units.find(u => (u.barcode && u.barcode.toLowerCase() === barcode.toLowerCase()) || (u.code && u.code.toLowerCase() === barcode.toLowerCase()));
                    if (uMatch) { exactMatch = p; break; }
                }
            }
            if (exactMatch) {
                window.addICToList(exactMatch.id);
                inputElement.value = '';
                showToast(`Đã đếm +1: ${exactMatch.name}`, "success");
            } else {
                window.searchICProduct(barcode);
            }
            return;
        }

        // Luồng 3: Các màn hình quản lý (Kích hoạt bộ lọc tìm kiếm)
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        showToast(`Đã quét: ${barcode}`, "success");
    }
}

function playBeepSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch(e) { }
}
function processScannedData(context, barcode) {
    let inputElement = null;

    // Phân luồng tùy thuộc vào bạn đang bấm nút quét ở Tab nào
    if (context === 'manage') {
        inputElement = document.getElementById('search-product-manage');
    } else if (context === 'price') {
        inputElement = document.getElementById('search-price-setup');
    } else if (context === 'update') {
        inputElement = document.getElementById('search-batch-update');
    } else if (context === 'import') {
        inputElement = document.getElementById('io-search-input');
        
        // Nếu trong tab Nhập hàng bạn dùng hàm searchIOProduct, bạn có thể gọi thẳng:
        // searchIOProduct(barcode); 
    } else if (context === 'sell') {
        // Dành cho màn hình Bán Hàng (Giỏ hàng POS)
        // inputElement = document.getElementById('id-o-tim-kiem-trong-pos');
        
        // HOẶC GỌI THẲNG HÀM THÊM VÀO GIỎ HÀNG:
        // addToCartByBarcode(barcode); 
    }

    // Tự động điền và kích hoạt sự kiện tìm kiếm
    if (inputElement) {
        inputElement.value = barcode;
        
        // Dòng này CỰC KỲ QUAN TRỌNG: Đánh lừa trình duyệt là có người vừa gõ phím
        // Để các hàm "oninput" của bạn trong HTML tự động chạy (ra kết quả / giỏ hàng)
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
    }
}
 
function onScanSuccess(decodedText, decodedResult) {
    const scannedCode = decodedText.trim();

    // --- CHỐNG QUÉT ĐÚP (DEBOUNCE) ---
    if (scannedCode === lastScannedCode) {
        return;
    }

    lastScannedCode = scannedCode;
    clearTimeout(scanCooldownTimer);
scanCooldownTimer = setTimeout(() => { lastScannedCode = ""; }, 2000);

    // --- PHÁT ÂM THANH BÍP ---
    playBeepSound();

    // --- ĐIỀU PHỐI DỮ LIỆU TÙY THEO MÀN HÌNH ĐANG MỞ ---
    
    // 1. Nếu đang ở màn hình Bán hàng
    if (currentScanTarget === 'pos') {
        const input = document.getElementById('pos-search-input');
        if (input) input.value = scannedCode;
        if (typeof handleDirectEnter === 'function') handleDirectEnter(scannedCode.toLowerCase());
        showToast(`Đã thêm: ${scannedCode}`, "success");
    } 
    
    // 2. Nếu đang ở màn hình tạo Phiếu Nhập
    else if (currentScanTarget === 'import') {
        const input = document.getElementById('io-search-input');
        if (input) {
            input.value = scannedCode;
            window.searchIOProduct(scannedCode);
        }
        showToast(`Đã nhận mã vào phiếu nhập: ${scannedCode}`, "success");
    }
    
    // 3. Nếu đang ở màn hình tạo Phiếu Kiểm Kho (Tự động cộng dồn +1)
    else if (currentScanTarget === 'check') {
        const input = document.getElementById('ic-search-input');
        if (input) input.value = scannedCode;
        
        // Tự động đối chiếu mã và cộng thẳng số lượng thực tế
        const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
        const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        let exactMatch = null;

        for (let p of latestProducts) {
            if (p.branchId !== currentBranch) continue;
            if ((p.barcode && p.barcode.toLowerCase() === scannedCode.toLowerCase()) || (p.code && p.code.toLowerCase() === scannedCode.toLowerCase())) {
                exactMatch = p; break;
            }
            if (p.units) {
                let uMatch = p.units.find(u => (u.barcode && u.barcode.toLowerCase() === scannedCode.toLowerCase()) || (u.code && u.code.toLowerCase() === scannedCode.toLowerCase()));
                if (uMatch) { exactMatch = p; break; }
            }
        }

        if (exactMatch) {
            window.addICToList(exactMatch.id);
            if (input) input.value = ''; // Quét xong xóa chữ để trống ô
            showToast(`Đã đếm +1: ${exactMatch.name}`, "success");
        } else {
            window.searchICProduct(scannedCode);
            showToast(`Mã chưa tồn tại: ${scannedCode}`, "warning");
        }
    }
    
    // 4. Nếu đang ở tab Quản lý hàng hóa
    else if (currentScanTarget === 'manage') {
        const input = document.getElementById('search-product-manage');
        if (input) {
            input.value = scannedCode;
            window.currentProductPage = 1;
            window.renderProductList();
            showToast(`Đã lọc danh sách: ${scannedCode}`, "success");
        }
    }
    
    // 5. Nếu đang ở tab Thiết lập giá
    else if (currentScanTarget === 'price') {
        const input = document.getElementById('search-price-setup');
        if (input) {
            input.value = scannedCode;
            window.currentPricePage = 1;
            window.renderPriceSetupTable();
            showToast(`Đã lọc bảng giá: ${scannedCode}`, "success");
        }
    }
    
    // 6. Nếu đang ở tab Cập nhật hàng loạt
    else if (currentScanTarget === 'update') {
        const input = document.getElementById('search-batch-update');
        if (input) {
            input.value = scannedCode;
            window.currentUpdatePage = 1;
            window.renderBatchUpdateTable();
            showToast(`Đã lọc lưới cập nhật: ${scannedCode}`, "success");
        }
    }
}

// Bỏ qua các lỗi đọc không rõ trong lúc camera đang tìm nét
function onScanFailure(error) {
    // Không làm gì cả để camera tiếp tục dò
}


// Hiệu ứng âm thanh Bíp đơn giản
function playBeepSound() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.type = 'sine'; // Kiểu âm thanh
        osc.frequency.setValueAtTime(800, ctx.currentTime); // Tần số bíp
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1); // Ngân trong 0.1 giây
    } catch(e) {
        console.log("Trình duyệt không hỗ trợ âm thanh ảo.");
    }
}
// ==========================================
// TÍNH NĂNG ADMIN: DỌN DẸP HÀNG HÓA & BẢNG GIÁ THEO CHI NHÁNH
// ==========================================

// 1. Hàm nạp danh sách chi nhánh vào ô Select của mục Xóa
window.renderDeleteBranchSelect = function() {
    const select = document.getElementById('delete-branch-select');
    if (!select) return;
    
    const branches = JSON.parse(localStorage.getItem('kv_branches')) || [{ id: 'CN001', name: 'Chi nhánh 1' }];
    let html = '';
    branches.forEach(b => {
        html += `<option value="${b.id}">${b.name} (${b.id})</option>`;
    });
    select.innerHTML = html;
};

// Gọi hàm nạp danh sách chi nhánh mỗi khi vào giao diện Admin
const originalSwitchAdminTabForDelete = window.switchAdminTab;
window.switchAdminTab = function(tabName) {
    if (typeof originalSwitchAdminTabForDelete === 'function') {
        originalSwitchAdminTabForDelete(tabName);
    }
    // Cập nhật lại dropdown mỗi khi chuyển tab
    if (typeof window.renderDeleteBranchSelect === 'function') {
        window.renderDeleteBranchSelect();
    }
};

// 2. Hàm Xóa dữ liệu theo chi nhánh được chọn
window.clearProductsAndPricesByBranch = function() {
    const select = document.getElementById('delete-branch-select');
    if (!select) return;

    const branchIdToDelete = select.value;
    const branchName = select.options[select.selectedIndex].text;

    showConfirm(
        `<div style="text-align:center;">
            <h3 style="color:#d9534f; margin-bottom:10px;">⚠️ CẢNH BÁO NGUY HIỂM ⚠️</h3>
            <p>Hệ thống sẽ <b>xóa sạch toàn bộ Mặt hàng</b> của <b style="color:var(--kv-blue);">${branchName}</b>.</p>
            <p style="font-size:12px; color:#666; margin-top:10px;"><i>(Hóa đơn, Nhập hàng, Kiểm kho của chi nhánh này vẫn được giữ nguyên)</i></p>
            <p style="margin-top:15px; font-weight:bold;">Bạn có chắc chắn muốn xóa không?</p>
        </div>`, 
        function() {
            // 1. Lấy dữ liệu hiện tại
            let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
            let allPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
            
            // Tìm các sản phẩm thuộc chi nhánh này
            const productsToDelete = allProducts.filter(p => (p.branchId || 'CN001') === branchIdToDelete);
            
            if (productsToDelete.length === 0) {
                showToast(`Chi nhánh ${branchIdToDelete} hiện đang trống, không có hàng hóa để xóa.`, "info");
                return;
            }

            // Tạo danh sách ID sản phẩm cần xóa để làm sạch Bảng giá
            const productIdsToDelete = productsToDelete.map(p => p.id);

            // 2. LỌC: Chỉ giữ lại các sản phẩm KHÔNG thuộc chi nhánh đang muốn xóa
            const keptProducts = allProducts.filter(p => (p.branchId || 'CN001') !== branchIdToDelete);
            
            // 3. DỌN BẢNG GIÁ: Xóa các mức giá liên quan đến ID sản phẩm vừa bị xóa
            allPriceBooks.forEach(pb => {
                if (pb.prices) {
                    Object.keys(pb.prices).forEach(key => {
                        // Key có dạng "PROD123" hoặc "PROD123_0"
                        const baseId = key.split('_')[0]; 
                        if (productIdsToDelete.includes(baseId)) {
                            delete pb.prices[key]; // Xóa giá của mặt hàng này khỏi Bảng giá
                        }
                    });
                }
            });

            // 4. Lưu lại vào bộ nhớ
            window.products = keptProducts;
            window.priceBooks = allPriceBooks;
            localStorage.setItem('kv_products', JSON.stringify(keptProducts));
            localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
            
            // 5. Đồng bộ lên Cloud
            if (typeof window.uploadToCloud === 'function') {
                window.uploadToCloud('products', keptProducts);
                window.uploadToCloud('pricebooks', allPriceBooks);
            }
            
            showToast(`Đã xóa ${productsToDelete.length} mặt hàng khỏi ${branchName}!`, "success");
            
            // Nếu đang xem tab Danh sách chi nhánh thì vẽ lại bảng để hiện Tồn kho = 0
            if (typeof renderBranchList === 'function') renderBranchList();
        }
    );
};
// ==========================================
// TÍNH NĂNG ADMIN: SAO CHÉP HÀNG HÓA GIỮA CÁC CHI NHÁNH
// ==========================================
window.openCopyBranchModal = function() {
    const branches = JSON.parse(localStorage.getItem('kv_branches')) || [];
    
    if (branches.length < 2) {
        showToast("Bạn cần có ít nhất 2 chi nhánh để thực hiện sao chép!", "warning");
        return;
    }

    let optionsHtml = '<option value="">-- Chọn chi nhánh --</option>';
    branches.forEach(b => {
        optionsHtml += `<option value="${b.id}">${b.name}</option>`;
    });

    document.getElementById('copy-source-branch').innerHTML = optionsHtml;
    document.getElementById('copy-target-branch').innerHTML = optionsHtml;
    document.getElementById('copy-keep-stock').checked = false; // Mặc định không chép tồn kho

    document.getElementById('copy-branch-modal').style.display = 'flex';
};

window.closeCopyBranchModal = function() {
    document.getElementById('copy-branch-modal').style.display = 'none';
};

window.processCopyBranch = function() {
    const sourceId = document.getElementById('copy-source-branch').value;
    const targetId = document.getElementById('copy-target-branch').value;
    const keepStock = document.getElementById('copy-keep-stock').checked;

    if (!sourceId || !targetId) {
        showToast("Vui lòng chọn đầy đủ chi nhánh Nguồn và Đích!", "warning");
        return;
    }
    
    if (sourceId === targetId) {
        showToast("Chi nhánh Nguồn và Đích không được trùng nhau!", "error");
        return;
    }

    showConfirm("Bạn có chắc chắn muốn nhân bản toàn bộ hàng hóa sang chi nhánh mới? Quá trình này không thể hoàn tác.", function() {
        let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        let allPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];

        // Lọc lấy danh sách hàng hóa của chi nhánh Nguồn
        const sourceProducts = allProducts.filter(p => (p.branchId || 'CN001') === sourceId);

        if (sourceProducts.length === 0) {
            showToast("Chi nhánh nguồn không có mặt hàng nào để sao chép!", "error");
            return;
        }

        let newProducts = [];
        let isPriceBookChanged = false;

        sourceProducts.forEach((p, index) => {
            // Deep copy để tách biệt hoàn toàn dữ liệu
            let newP = JSON.parse(JSON.stringify(p));

            // Tạo ID mới (Thêm index để đảm bảo vòng lặp chạy nhanh không bị trùng ID)
            const oldId = p.id;
            const newId = 'PROD' + Date.now() + '_' + index;

            newP.id = newId;
            newP.branchId = targetId;

            // Xử lý tồn kho theo Checkbox
            if (!keepStock) {
                newP.stock = 0;
            }

            newProducts.push(newP);

            // Sao chép luôn các thiết lập giá đa cột (nếu có)
            allPriceBooks.forEach(pb => {
                if (pb.prices) {
                    Object.keys(pb.prices).forEach(key => {
                        // Tìm các giá trị khớp với ID cũ hoặc ID cũ + Đơn vị tính (VD: PROD123_1)
                        if (key === oldId || key.startsWith(oldId + '_')) {
                            const newKey = key.replace(oldId, newId);
                            pb.prices[newKey] = pb.prices[key];
                            isPriceBookChanged = true;
                        }
                    });
                }
            });
        });

        // Gộp hàng hóa mới vào mảng hệ thống (Đưa lên đầu danh sách)
        allProducts = [...newProducts, ...allProducts];

        // Lưu vào LocalStorage
        localStorage.setItem('kv_products', JSON.stringify(allProducts));
        window.products = allProducts;
        
        if (isPriceBookChanged) {
            localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
            window.priceBooks = allPriceBooks;
        }

        // Đồng bộ lên Firebase Cloud
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', allProducts);
            if (isPriceBookChanged) window.uploadToCloud('pricebooks', allPriceBooks);
        }

        closeCopyBranchModal();
        showToast(`Tuyệt vời! Đã sao chép thành công ${newProducts.length} mặt hàng.`, "success");

        // Cập nhật lại giao diện đếm số lượng ngoài trang Admin (nếu đang ở trang đó)
        if (typeof renderBranchList === 'function') {
            renderBranchList();
        }
    });
};
// ==========================================
// LỚP BẢO VỆ 1: CẢNH BÁO CHỐNG VĂNG TRANG (F5 HOẶC KÉO TRƯỢT XUỐNG)
// ==========================================
window.addEventListener('beforeunload', function (e) {
    // Kiểm tra xem giỏ hàng POS, Nhập hàng, hoặc Kiểm kho có đang chứa dữ liệu dở dang không
    const hasIO = (typeof currentIOItems !== 'undefined' && currentIOItems.length > 0);
    const hasIC = (typeof currentICItems !== 'undefined' && currentICItems.length > 0);
    let hasPOS = false;
    
    if (typeof posTabs !== 'undefined') {
        hasPOS = posTabs.some(tab => tab.items && tab.items.length > 0);
    }

    if (hasIO || hasIC || hasPOS) {
        // Lệnh này ép trình duyệt (Chrome, Safari) tự động hiện hộp thoại cảnh báo: 
        // "Bạn có chắc chắn muốn tải lại trang? Dữ liệu chưa lưu có thể bị mất."
        // Chặn đứng thao tác vuốt tải lại trang nhầm trên điện thoại.
        e.preventDefault();
        e.returnValue = ''; 
    }
});

// ==========================================
// LỚP BẢO VỆ 2: AUTO-SAVE TRẠNG THÁI KIỂM KHO (GIỐNG NHẬP HÀNG)
// ==========================================
window.saveICState = function() {
    const icView = document.getElementById('inventory-check-view');
    // Chỉ lưu nháp khi màn hình kiểm kho đang mở
    if (icView && icView.style.display !== 'none') {
        const icState = {
            isOpen: true,
            editingId: typeof editingICId !== 'undefined' ? editingICId : null,
            icCode: document.getElementById('ic-code')?.value || '',
            items: typeof currentICItems !== 'undefined' ? currentICItems : [],
            note: document.getElementById('ic-note')?.value || ''
        };
        localStorage.setItem('kv_ic_state', JSON.stringify(icState));
    }
};

window.clearICState = function() {
    localStorage.removeItem('kv_ic_state');
};

window.restoreICState = function() {
    const savedStateStr = localStorage.getItem('kv_ic_state');
    if (savedStateStr) {
        try {
            const savedState = JSON.parse(savedStateStr);
            if (savedState && savedState.isOpen) {
                // Mở lại màn hình
                const icView = document.getElementById('inventory-check-view');
                if (icView) icView.style.display = 'flex';
                
                // Khôi phục dữ liệu
                editingICId = savedState.editingId;
                currentICItems = savedState.items || [];
                
                if (document.getElementById('ic-code')) document.getElementById('ic-code').value = savedState.icCode;
                if (document.getElementById('ic-note')) document.getElementById('ic-note').value = savedState.note;
                
                // Vẽ lại bảng danh sách
                if (typeof renderICItemsTable === 'function') renderICItemsTable();
            }
        } catch (e) {
            clearICState();
        }
    }
};

// --- Tự động kích hoạt Save khi có thao tác trong Kiểm kho ---
const _origAddIC = window.addICToList;
window.addICToList = function(productId) {
    if (_origAddIC) _origAddIC(productId);
    saveICState();
};

const _origRemoveIC = window.removeICItem;
window.removeICItem = function(productId) {
    if (_origRemoveIC) _origRemoveIC(productId);
    saveICState();
};

const _origUpdateICRealQty = window.updateICRealQty;
window.updateICRealQty = function(productId, value) {
    const item = currentICItems.find(x => String(x.productId) === String(productId));
    if (item) {
        item.realQty = parseFloat(value) || 0;
        renderICItemsTable(); 
    }
};

const _origChangeICUnit = window.changeICUnit;
window.changeICUnit = function(productId, newUnitIdx) {
    const item = currentICItems.find(x => String(x.productId) === String(productId));
    if (item) {
        const oldRate = item.units[item.selectedUnitIdx].rate || 1;
        item.selectedUnitIdx = parseInt(newUnitIdx);
        const newRate = item.units[item.selectedUnitIdx].rate || 1;

        item.sysStock = parseFloat((item.baseSysStock / newRate).toFixed(2));
        item.realQty = parseFloat(((item.realQty * oldRate) / newRate).toFixed(2));
        item.cost = item.baseCost * newRate; 

        renderICItemsTable();
    }
};

// Tự động lưu nháp khi gõ ghi chú
document.addEventListener('change', function(e) {
    if (e.target.id === 'ic-note') saveICState();
});

// Xóa bản nháp sau khi đã Lưu chính thức thành công hoặc Hủy
const _origSaveIC = window.saveInventoryCheck;
window.saveInventoryCheck = function(action) {
    if (currentICItems.length === 0) { 
        alert("Vui lòng thêm hàng để kiểm!"); 
        return; 
    }

    // [THÊM MỚI] Khóa đồng bộ dữ liệu
    window.isSyncLocked = true;

    const icCode = document.getElementById('ic-code').value || ("KK" + Date.now().toString().slice(-6));
    let allChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];

    const icData = {
        branchId: localStorage.getItem('kv_current_branch') || 'CN001',
        id: editingICId || Date.now(), 
        code: icCode,
        creator: (typeof currentUser !== 'undefined' && currentUser) ? currentUser.fullname : 'Admin',
        status: action,
        note: document.getElementById('ic-note').value.trim(),
        items: JSON.parse(JSON.stringify(currentICItems))
    };

    if (editingICId) {
        const idx = allChecks.findIndex(x => String(x.id) === String(editingICId));
        if (idx !== -1) {
            allChecks[idx] = icData;
        } else {
            allChecks.unshift(icData);
        }
    } else {
        allChecks.unshift(icData);
    }

    // Nếu hoàn thành, cập nhật tồn kho vào danh mục sản phẩm
    if (action === 'done') {
        let latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        currentICItems.forEach(item => {
            const prod = latestProducts.find(p => p.id === item.productId);
            if (prod) {
                const rate = item.units[item.selectedUnitIdx]?.rate || 1;
                prod.stock = item.realQty * rate; 
            }
        });
        localStorage.setItem('kv_products', JSON.stringify(latestProducts));
        if (window.uploadToCloud) window.uploadToCloud('products', latestProducts);
    }

    // Lưu mảng phiếu kiểm vào Storage
    localStorage.setItem('kv_inventory_checks', JSON.stringify(allChecks));
    if (window.uploadToCloud) window.uploadToCloud('inventory_checks', allChecks);
    
    // Đồng bộ lại mảng Global
    inventoryChecks = allChecks;

    // Dọn dẹp trạng thái
    currentICItems = []; 
    editingICId = null; 

    // Đóng giao diện
    const icView = document.getElementById('inventory-check-view');
    if (icView) icView.style.display = 'none';

    // Vẽ lại bảng ngoài trang danh sách
    if (typeof renderInventoryChecks === 'function') renderInventoryChecks();

    const msg = action === 'done' ? "Cân bằng kho thành công!" : "Đã lưu phiếu tạm.";
    if (typeof showToast === 'function') {
        showToast(msg, "success");
    } else {
        alert(msg);
    }

    // [THÊM MỚI] Mở khóa đồng bộ
    setTimeout(() => { window.isSyncLocked = false; }, 3000);
};

const _origCloseIC = window.closeCreateCheckView;
window.closeCreateCheckView = function() {
    if (_origCloseIC) _origCloseIC();
    if (typeof currentICItems !== 'undefined' && currentICItems.length === 0) {
        clearICState();
    }
};

// ==========================================
// TỰ ĐỘNG PHỤC HỒI DỮ LIỆU SAU KHI F5 THÀNH CÔNG
// ==========================================
setTimeout(() => {
    const currentView = sessionStorage.getItem('kv_current_view');
    const currentTab = localStorage.getItem('kv_current_tab');
    
    if (currentView === 'dashboard-view') {
        // Phục hồi Nhập hàng (nếu đang ở tab Nhập hàng)
        if (currentTab === 'tab-nhap-hang' && typeof restoreIOState === 'function') {
            restoreIOState();
        }
        // Phục hồi Kiểm kho (nếu đang ở tab Kiểm kho)
        if (currentTab === 'tab-kiem-kho' && typeof restoreICState === 'function') {
            restoreICState();
        }
    }
}, 1200);
// ==========================================
// TỰ ĐỘNG TẠO NÚT NỔI "BỘ LỌC / LÊN TRÊN" CHO MOBILE (BẢN CHỐT LỖI TỌA ĐỘ)
// ==========================================
(function setupMobileFilterBtn() {
    // 1. Dọn dẹp nút cũ nếu có
    let oldBtn = document.getElementById('mobile-filter-btn');
    if (oldBtn) oldBtn.remove();

    // 2. Tạo nút nổi
    const filterBtn = document.createElement('button');
    filterBtn.id = 'mobile-filter-btn';
    filterBtn.innerHTML = '<i class="fa-solid fa-filter"></i> Bộ lọc';
    filterBtn.dataset.action = 'down'; // Cờ hiệu điều hướng
    document.body.appendChild(filterBtn);

    // 3. Xử lý logic Click mượt mà bằng TỌA ĐỘ TUYỆT ĐỐI (Chống lỗi Flexbox trên Safari)
    filterBtn.onclick = function() {
        const dashContent = document.querySelector('.dash-content');
        if (!dashContent) return;

        if (filterBtn.dataset.action === 'down') {
            // Lệnh 1: Đi XUỐNG (Bắn thẳng tọa độ xuống đáy vùng cuộn)
            try {
                dashContent.scrollTo({ top: dashContent.scrollHeight, behavior: 'smooth' });
            } catch(e) {
                dashContent.scrollTop = dashContent.scrollHeight; // Dự phòng cho trình duyệt cũ
            }
        } else {
            // Lệnh 2: Đi LÊN (Bắn thẳng tọa độ về 0)
            try {
                dashContent.scrollTo({ top: 0, behavior: 'smooth' });
            } catch(e) {
                dashContent.scrollTop = 0; // Dự phòng cho trình duyệt cũ
            }
        }
    };

    // 4. Radar quét vị trí bằng Tọa Độ
    function updateBtnState() {
        if (window.innerWidth > 768) return; 
        
        const dashContent = document.querySelector('.dash-content');
        if (!dashContent) return;
        
        // Nếu đã cuộn xuống quá 300 pixel -> Đổi thành nút "Lên trên"
        if (dashContent.scrollTop > 300) {
            filterBtn.innerHTML = '<i class="fa-solid fa-arrow-up"></i> Lên trên';
            filterBtn.style.backgroundColor = '#555';
            filterBtn.dataset.action = 'up';
        } else {
            // Đang ở trên đầu -> Đổi thành nút "Bộ lọc"
            filterBtn.innerHTML = '<i class="fa-solid fa-filter"></i> Bộ lọc';
            filterBtn.style.backgroundColor = 'var(--kv-blue)';
            filterBtn.dataset.action = 'down';
        }
    }

    // Gắn Radar vào sự kiện cuộn
    const dashContent = document.querySelector('.dash-content');
    if (dashContent) dashContent.addEventListener('scroll', updateBtnState);
    window.addEventListener('scroll', updateBtnState);

    // 5. Hàm kiểm tra ẩn/hiện nút khi đổi Tab
    window.checkMobileFilterBtn = function() {
        const btn = document.getElementById('mobile-filter-btn');
        if (!btn) return;

        if (window.innerWidth > 768) {
            btn.style.display = 'none';
        } else {
            const activeTab = document.querySelector('.tab-section.active');
            if (activeTab && activeTab.querySelector('.list-sidebar')) {
                btn.style.display = 'flex';
                
                // Trả về đầu trang khi qua tab mới
                if (dashContent) dashContent.scrollTop = 0;
                window.scrollTo(0, 0);
                setTimeout(updateBtnState, 100);
            } else {
                btn.style.display = 'none';
            }
        }
    };

    window.addEventListener('resize', window.checkMobileFilterBtn);
    setTimeout(window.checkMobileFilterBtn, 300);
})();

// 6. Ghi đè hàm chuyển tab
if (typeof window.openDashTab !== 'undefined') {
    const originalOpenDashTabFilters = window.openDashTab;
    window.openDashTab = function(tabId, navElement = null) {
        originalOpenDashTabFilters(tabId, navElement);
        if (typeof window.checkMobileFilterBtn === 'function') {
            setTimeout(window.checkMobileFilterBtn, 100);
        }
    };
}
// ==========================================
// TÍNH NĂNG QUÉT MÃ VẠCH (TỐI ƯU CHO ĐIỆN THOẠI)
// ==========================================
var html5QrCode = null;
var lastScannedCode = "";
var scanCooldownTimer = null;

window.startBarcodeScanner = function(context) {
    document.getElementById('scanner-modal').style.display = 'flex';
    setTimeout(() => {
        if (window.html5QrCode && window.html5QrCode.getState() === 2) {
            window.html5QrCode.stop().then(() => {
                window.html5QrCode.clear();
                window.initScanner(context);
            }).catch(() => window.initScanner(context));
        } else {
            window.initScanner(context);
        }
    }, 200);
};

window.initScanner = function(context) {
    window.html5QrCode = new Html5Qrcode("reader");

    // Tự động bo khung quét 75% màn hình để không bị méo trên điện thoại
    const config = {
        fps: 10,
        qrbox: function(viewfinderWidth, viewFinderHeight) {
            let minEdgeSize = Math.min(viewfinderWidth, viewFinderHeight);
            let qrboxSize = Math.floor(minEdgeSize * 0.75); 
            return { width: qrboxSize, height: qrboxSize };
        }
    };

    // Ép bật camera sau cực nhạy
    window.html5QrCode.start(
        { facingMode: "environment" }, 
        config,
        (decodedText, decodedResult) => {
            const scannedCode = decodedText.trim();
            
            // Chống quét đúp 1 mã liên tục
            if (scannedCode === window.lastScannedCode) return;
            window.lastScannedCode = scannedCode;
            clearTimeout(window.scanCooldownTimer);
            window.scanCooldownTimer = setTimeout(() => { window.lastScannedCode = ""; }, 1500);

            window.playBeepSound();
            window.closeBarcodeScanner();
            window.processScannedData(context, scannedCode);
        },
        (errorMessage) => {}
    ).catch(err => {
        alert("Lỗi camera. Vui lòng cấp quyền máy ảnh và đảm bảo đang dùng mạng HTTPS (hoặc localhost)!");
        window.closeBarcodeScanner();
    });
};

window.closeBarcodeScanner = function() {
    document.getElementById('scanner-modal').style.display = 'none';
    if (window.html5QrCode && window.html5QrCode.getState() === 2) {
        window.html5QrCode.stop().then(() => {
            window.html5QrCode.clear();
        }).catch(err => console.error(err));
    }
};
window.stopBarcodeScanner = window.closeBarcodeScanner;

window.processScannedData = function(context, barcode) {
    let inputElement = null;
    if (context === 'manage') inputElement = document.getElementById('search-product-manage');
    else if (context === 'price') inputElement = document.getElementById('search-price-setup');
    else if (context === 'update') inputElement = document.getElementById('search-batch-update');
    else if (context === 'import') inputElement = document.getElementById('io-search-input');
    else if (context === 'check') inputElement = document.getElementById('ic-search-input');
    else if (context === 'pos') inputElement = document.getElementById('pos-search-input');

    if (inputElement) {
        inputElement.value = barcode;
        
        // Luồng 1: Bán hàng POS
        if (context === 'pos' && typeof handleDirectEnter === 'function') {
            handleDirectEnter(barcode.toLowerCase());
            return;
        }
        
        // Luồng 2: Kiểm kho
        if (context === 'check' && typeof searchICProduct === 'function') {
            const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
            const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
            let exactMatch = null;
            for (let p of latestProducts) {
                if (p.branchId !== currentBranch) continue;
                if ((p.barcode && p.barcode.toLowerCase() === barcode.toLowerCase()) || (p.code && p.code.toLowerCase() === barcode.toLowerCase())) {
                    exactMatch = p; break;
                }
                if (p.units) {
                    let uMatch = p.units.find(u => (u.barcode && u.barcode.toLowerCase() === barcode.toLowerCase()) || (u.code && u.code.toLowerCase() === barcode.toLowerCase()));
                    if (uMatch) { exactMatch = p; break; }
                }
            }
            if (exactMatch) {
                window.addICToList(exactMatch.id);
                inputElement.value = '';
                if (typeof showToast === 'function') showToast(`Đã đếm +1: ${exactMatch.name}`, "success");
            } else {
                window.searchICProduct(barcode);
            }
            return;
        }

        // Luồng 3: Tìm kiếm cơ bản
        inputElement.dispatchEvent(new Event('input', { bubbles: true }));
        if (typeof showToast === 'function') showToast(`Đã quét: ${barcode}`, "success");
    }
};

window.playBeepSound = function() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.1);
    } catch(e) { }
};
// ==========================================
// HỆ THỐNG QUẢN LÝ NHIỀU TÀI KHOẢN CỤC BỘ
// ==========================================

// 1. Tự động điền tài khoản gần nhất khi mở trang
window.loadSavedLogin = function() {
    const savedLogins = JSON.parse(localStorage.getItem('kv_saved_logins')) || [];
    
    // Điền tk đăng nhập gần nhất (nằm ở vị trí 0)
    if (savedLogins.length > 0) {
        const latest = savedLogins[0];
        const uInput = document.getElementById('login-user');
        const pInput = document.getElementById('login-pass');
        const rememberCb = document.getElementById('remember-me');
        
        if (uInput && pInput) {
            uInput.value = latest.u;
            pInput.value = decodeURIComponent(atob(latest.p)); 
            if (rememberCb) rememberCb.checked = true;
        }
    }
    
    // Render sẵn danh sách vào Dropdown
    renderSavedAccountsDropdown(savedLogins);
};

// 2. Vẽ danh sách Dropdown
window.renderSavedAccountsDropdown = function(savedLogins) {
    const dropdown = document.getElementById('saved-accounts-dropdown');
    if (!dropdown) return;

    if (savedLogins.length === 0) {
        dropdown.innerHTML = '<div style="padding: 15px; color: #888; text-align: center; font-size: 13px;">Chưa có tài khoản nào được lưu</div>';
        return;
    }

    let html = '';
    savedLogins.forEach((acc, index) => {
        const roleName = acc.role === 'manager' ? 'Quản lý' : 'Thu ngân';
        html += `
            <div style="padding: 12px 15px; border-bottom: 1px solid #f5f5f5; display: flex; justify-content: space-between; align-items: center; transition: 0.2s;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='white'">
                <div style="flex: 1; cursor: pointer;" onclick="fillSavedAccount(${index})">
                    <div style="font-weight: bold; color: var(--kv-blue); font-size: 14px;">${acc.name || acc.u}</div>
                    <div style="font-size: 11px; color: #888;">${acc.u} - ${roleName}</div>
                </div>
                <i class="fa-solid fa-xmark" style="color: #ccc; cursor: pointer; padding: 5px; margin-left: 10px; border-radius: 4px;" onclick="removeSavedAccount('${acc.u}', event)" onmouseover="this.style.color='#d9534f'; this.style.background='#fff0f0';" onmouseout="this.style.color='#ccc'; this.style.background='transparent';" title="Xóa tài khoản này khỏi máy"></i>
            </div>
        `;
    });
    dropdown.innerHTML = html;
};

// 3. Đóng/Mở Dropdown
window.toggleSavedAccounts = function() {
    const dropdown = document.getElementById('saved-accounts-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
};

// 4. Chọn và điền tài khoản
window.fillSavedAccount = function(index) {
    const savedLogins = JSON.parse(localStorage.getItem('kv_saved_logins')) || [];
    const acc = savedLogins[index];
    if (acc) {
        document.getElementById('login-user').value = acc.u;
        document.getElementById('login-pass').value = decodeURIComponent(atob(acc.p));
        document.getElementById('saved-accounts-dropdown').style.display = 'none';
    }
};

// 5. Xóa 1 tài khoản khỏi máy
window.removeSavedAccount = function(username, event) {
    event.stopPropagation(); // Ngăn sự kiện click lan ra ngoài
    let savedLogins = JSON.parse(localStorage.getItem('kv_saved_logins')) || [];
    
    savedLogins = savedLogins.filter(acc => acc.u !== username);
    localStorage.setItem('kv_saved_logins', JSON.stringify(savedLogins));
    
    // Cập nhật lại UI
    renderSavedAccountsDropdown(savedLogins);

    // Nếu xóa trúng tài khoản đang hiển thị trên ô nhập thì xóa luôn text trên ô
    if (document.getElementById('login-user').value === username) {
        document.getElementById('login-user').value = '';
        document.getElementById('login-pass').value = '';
    }
};

// 6. Đóng Dropdown khi click chuột ra vùng khác
document.addEventListener('click', function(e) {
    const dropdown = document.getElementById('saved-accounts-dropdown');
    const userBox = document.getElementById('login-user');
    const arrow = document.querySelector('.fa-chevron-down');
    
    if (dropdown && dropdown.style.display === 'block') {
        if (!dropdown.contains(e.target) && e.target !== userBox && e.target !== arrow) {
            dropdown.style.display = 'none';
        }
    }
});

// Chạy hàm nạp tài khoản khi khởi động
window.loadSavedLogin();
// ==========================================
// TÍNH NĂNG DROPDOWN MENU TÀI KHOẢN (ĐĂNG XUẤT)
// ==========================================

// 1. Hàm bật/tắt menu xổ xuống
window.toggleUserDropdown = function() {
    const dropdown = document.getElementById('dash-user-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }
};

// 2. Tự động đóng menu khi click chuột ra chỗ khác trên màn hình
document.addEventListener('click', function(e) {
    const userDropdown = document.getElementById('dash-user-dropdown');
    const userMenu = document.querySelector('.user-menu');
    
    // Nếu menu đang mở và vị trí click chuột không nằm trong vùng user-menu
    if (userDropdown && userDropdown.style.display === 'block') {
        if (userMenu && !userMenu.contains(e.target)) {
            userDropdown.style.display = 'none';
        }
    }
});
// Tính toán tiền thừa trả khách
window.calcPOSChange = function() {
    const mustPayStr = document.getElementById('pos-must-pay').innerText;
    const mustPay = window.parseCurrency(mustPayStr) || 0;
    
    const paidStr = document.getElementById('pos-customer-paid').value;
    
    // BÍ QUYẾT: Nhân 1000 ngầm ở bên trong để khớp với chữ ,000 hiển thị bên ngoài
    const paid = (window.parseCurrency(paidStr) || 0) * 1000; 
    
    const change = paid - mustPay;
    const changeEl = document.getElementById('pos-change-return');
    
    if (changeEl) {
        if (change < 0) {
            changeEl.innerText = "0"; // Khách đưa thiếu
        } else {
            changeEl.innerText = change.toLocaleString('vi-VN');
        }
    }
    
    const tab = posTabs[activeTabIndex];
    if (tab) {
        tab.customerPaid = paid;
        savePOSState();
    }
};

// Thuật toán tạo gợi ý tiền (Giống KiotViet)
window.renderQuickMoneySuggestions = function(mustPay) {
    const container = document.getElementById('pos-quick-money-suggestions');
    if (!container) return;
    
    if (mustPay <= 0) {
        container.innerHTML = '';
        return;
    }

    let suggestions = [mustPay]; // Luôn gợi ý nút đầu tiên là số tiền vừa đủ
    
    // Các mệnh giá tiền phổ biến ở VN
    const denominations = [50000, 100000, 200000, 500000];
    
    // Làm tròn số tiền lên các mốc chẵn (VD: 135k thì làm tròn lên 140k, 150k, 200k)
    const roundUp10k = Math.ceil(mustPay / 10000) * 10000;
    const roundUp50k = Math.ceil(mustPay / 50000) * 50000;
    const roundUp100k = Math.ceil(mustPay / 100000) * 100000;
    
    if (roundUp10k > mustPay) suggestions.push(roundUp10k);
    if (roundUp50k > mustPay && !suggestions.includes(roundUp50k)) suggestions.push(roundUp50k);
    if (roundUp100k > mustPay && !suggestions.includes(roundUp100k)) suggestions.push(roundUp100k);
    
    // Thêm các tờ tiền polymer nếu số tiền phải trả nhỏ hơn tờ đó
    for (let d of denominations) {
        if (d > mustPay && !suggestions.includes(d)) {
            suggestions.push(d);
        }
    }
    
    // Sắp xếp từ nhỏ đến lớn và chỉ lấy tối đa 4 gợi ý cho gọn màn hình
    suggestions.sort((a, b) => a - b);
    const finalSuggestions = suggestions.slice(0, 4);

    let html = '';
    finalSuggestions.forEach(amount => {
        html += `<button type="button" class="btn-quick-money" onclick="applyQuickMoney(${amount})">${amount.toLocaleString('vi-VN')}</button>`;
    });
    
    container.innerHTML = html;
};

// Áp dụng số tiền khi click vào nút gợi ý
window.applyQuickMoney = function(amount) {
    const input = document.getElementById('pos-customer-paid');
    if (input) {
        // Chia 1000 vì trên màn hình đã có sẵn 3 số 0
        input.value = (amount / 1000).toLocaleString('vi-VN');
        window.calcPOSChange();
    }
};
// ==========================================
// TÍNH NĂNG: HÀNG COMBO / THÙNG MIX
// ==========================================

let pendingComboParent = null; // Chứa thông tin thùng mix đang chọn
let pendingComboItems = [];    // Chứa các mặt hàng lẻ nạp vào thùng

// 1. CHẶN VÀ CHUYỂN HƯỚNG TỪ HÀM addPOSItem HIỆN TẠI
const originalAddPOSItem = window.addPOSItem;
window.addPOSItem = function(productId, keepInput = true, forcedUnitIdx = null) {
    const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];
    const p = allProds.find(x => String(x.id) === String(productId));
    
    // Nếu sản phẩm này được đánh dấu là Hàng Combo (Thùng Mix)
    if (p && p.isCombo) {
        // Đóng dropdown tìm kiếm POS
        const dropdown = document.getElementById('pos-search-dropdown');
        if (dropdown) dropdown.style.display = 'none';

        // Mở bảng đóng gói Thùng
        openComboModal(p, forcedUnitIdx !== null ? forcedUnitIdx : 0);
        
        // Reset thanh tìm kiếm POS
        const sInput = document.getElementById('pos-search-input');
        if (sInput && !keepInput) sInput.value = '';
        return; // Ngắt, không đưa ngay vào giỏ hàng
    }

    // Nếu là hàng bình thường, chạy luồng gốc
    originalAddPOSItem(productId, keepInput, forcedUnitIdx);
};

// 2. MỞ BẢNG ĐÓNG GÓI THÙNG MIX
window.openComboModal = function(parentProd, parentUnitIdx) {
    pendingComboParent = { product: parentProd, uIdx: parentUnitIdx };
    pendingComboItems = []; // Rỗng thùng
    
    document.getElementById('combo-parent-name').innerText = `Đang mix: ${parentProd.name}`;
    document.getElementById('pos-combo-modal').style.display = 'flex';
    document.getElementById('combo-search-input').value = '';
    document.getElementById('combo-search-dropdown').style.display = 'none';
    
    renderComboItems();
    
    setTimeout(() => {
        document.getElementById('combo-search-input').focus();
    }, 100);
};

// 3. TÌM/QUÉT CÁC MÓN LẺ VÀO THÙNG (Giống hệt logic tìm POS)
window.searchComboItem = function(keyword) {
    const dropdown = document.getElementById('combo-search-dropdown');
    if (!keyword.trim()) { dropdown.style.display = 'none'; return; }
    
    const rawKw = keyword.toLowerCase().trim();
    const cleanKw = window.removeVietnameseTones(rawKw);
    const searchTerms = cleanKw.split(/\s+/);
    
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    
    let results = [];

    // Tự động Add thẳng nếu quét bằng máy tít mã vạch khớp 100%
    let exactMatch = null;
    for (let p of latestProducts) {
        if (p.branchId !== currentBranch || p.isCombo) continue; // Không cho phép nhét thùng mix vào trong thùng mix
        if (p.code?.toLowerCase() === rawKw || p.barcode?.toLowerCase() === rawKw) { exactMatch = { id: p.id, uIdx: 0 }; break; }
        if (p.units) {
            const uIdx = p.units.findIndex(u => u.barcode?.toLowerCase() === rawKw || u.code?.toLowerCase() === rawKw);
            if (uIdx !== -1) { exactMatch = { id: p.id, uIdx: uIdx }; break; }
        }
    }
    if (exactMatch) {
        addComboChild(exactMatch.id, exactMatch.uIdx);
        document.getElementById('combo-search-input').value = '';
        dropdown.style.display = 'none';
        return;
    }

    // Tìm kiếm tương đối để gõ phím
    latestProducts.forEach(p => {
        if (p.branchId !== currentBranch || p.isCombo) return;

        let fullStr = (p.name || '') + ' ' + (p.code || '') + ' ' + (p.barcode || '');
        if (p.units) p.units.forEach(u => fullStr += ' ' + (u.name || '') + ' ' + (u.code || '') + ' ' + (u.barcode || ''));
        
        if (searchTerms.every(term => window.removeVietnameseTones(fullStr.toLowerCase()).includes(term))) {
            results.push(p);
        }
    });

    if (results.length === 0) {
        dropdown.innerHTML = '<div style="padding:10px; color:#888; text-align:center;">Không tìm thấy hàng lẻ</div>';
    } else {
        dropdown.innerHTML = results.slice(0, 10).map(p => `
            <div onclick="addComboChild('${p.id}', 0)" style="padding: 10px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between;" onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='transparent'">
                <div><b>${p.code}</b> - ${p.name}</div>
                <div style="color: #888; font-size: 11px;">Tồn: ${p.stock || 0}</div>
            </div>
        `).join('');
    }
    dropdown.style.display = 'block';
};

// 4. THÊM MÓN LẺ VÀO THÙNG
window.addComboChild = function(productId, uIdx) {
    const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];
    const p = allProds.find(x => x.id === productId);
    if (!p) return;

    const unit = p.units && p.units[uIdx] ? p.units[uIdx] : { name: 'Cái', rate: 1 };
    
    const existIdx = pendingComboItems.findIndex(x => x.productId === productId && x.uIdx === uIdx);
    if (existIdx !== -1) {
        pendingComboItems[existIdx].qty += 1;
    } else {
        pendingComboItems.push({
            productId: p.id,
            uIdx: uIdx,
            code: unit.code || p.code,
            name: `${p.name} (${unit.name})`,
            qty: 1,
            rate: unit.rate || 1
        });
    }

    document.getElementById('combo-search-dropdown').style.display = 'none';
    const sInput = document.getElementById('combo-search-input');
    sInput.value = '';
    sInput.focus();
    renderComboItems();
};

window.removeComboChild = function(index) {
    pendingComboItems.splice(index, 1);
    renderComboItems();
};

window.updateComboChildQty = function(index, qty) {
    let q = parseInt(qty);
    if (isNaN(q) || q < 1) q = 1;
    pendingComboItems[index].qty = q;
    renderComboItems();
};

function renderComboItems() {
    const list = document.getElementById('combo-items-list');
    let total = 0;
    
    if (pendingComboItems.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding: 20px; color:#aaa; font-style:italic;">Thùng rỗng. Quét để thêm hàng...</div>`;
    } else {
        list.innerHTML = pendingComboItems.map((item, index) => {
            total += item.qty;
            return `
            <div style="display: flex; align-items: center; justify-content: space-between; background: #fdfdfd; border: 1px solid #eee; padding: 8px 12px; border-radius: 6px;">
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #333; font-size: 13px;">${item.name}</div>
                    <div style="font-size: 11px; color: var(--kv-blue);">${item.code}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <input type="number" value="${item.qty}" onchange="updateComboChildQty(${index}, this.value)" style="width: 50px; text-align: center; padding: 4px; border: 1px solid #ccc; border-radius: 4px; outline: none;">
                    <i class="fa-solid fa-trash-can" onclick="removeComboChild(${index})" style="color: #d9534f; cursor: pointer; padding: 5px;"></i>
                </div>
            </div>`;
        }).join('');
    }
    document.getElementById('combo-total-qty').innerText = total;
}

// 5. XÁC NHẬN VÀ ĐẨY THÙNG MIX VÀO GIỎ HÀNG POS
window.confirmComboToCart = function() {
    if (pendingComboItems.length === 0) {
        alert("Thùng mix đang trống! Vui lòng chọn các món lẻ trước khi bán.");
        return;
    }

    const tab = posTabs[activeTabIndex];
    const parentProd = pendingComboParent.product;
    const parentUnitIdx = pendingComboParent.uIdx;
    
    const productUnits = (parentProd.units && parentProd.units.length > 0) ? parentProd.units : [{ name: 'Cái', rate: 1, price: parentProd.price, isBase: true }];
    const selectedUnit = productUnits[parentUnitIdx];

    // Lấy giá của cái thùng (Giá bán bạn đã thiết lập lúc tạo hàng)
    let finalPrice = 0;
    const currentPriceBookId = tab.priceBook || 'default';
    if (currentPriceBookId === 'default') {
        finalPrice = selectedUnit.price || (parentProd.price * (selectedUnit.rate || 1));
    } else {
        const basePriceFromBook = getProductPrice(parentProd, currentPriceBookId); 
        finalPrice = basePriceFromBook * (selectedUnit.rate || 1);
    }

    // Đẩy vào giỏ hàng POS như 1 món bình thường, nhưng KÈM THEO DANH SÁCH MÓN LẺ
    tab.items.unshift({ 
        productId: parentProd.id, 
        code: selectedUnit.code || parentProd.code, 
        name: parentProd.name, 
        qty: 1, 
        basePrice: parentProd.price, 
        price: finalPrice, 
        units: productUnits, 
        selectedUnitIdx: parentUnitIdx, 
        isIce: false,
        isCombo: true, // Cờ báo hiệu đây là hàng Mix
        comboComponents: JSON.parse(JSON.stringify(pendingComboItems)) // Lưu lại các món lẻ
    });

    document.getElementById('pos-combo-modal').style.display = 'none';
    savePOSState();
    renderPOSCart();
    
    // Tự động nhảy lại thanh tìm kiếm
    const sInput = document.getElementById('pos-search-input');
    if (sInput) {
        sInput.value = '';
        sInput.focus();
    }
};

// 6. CẬP NHẬT GIAO DIỆN GIỎ HÀNG POS (Để hiển thị các món lẻ nằm thụt lề dưới Thùng mix)
const originalRenderPOSCart = window.renderPOSCart;
window.renderPOSCart = function() {
    originalRenderPOSCart();
    
    // Chèn thêm danh sách món lẻ vào dưới tên của hàng Combo
    const tab = posTabs[activeTabIndex];
    if (!tab) return;
    
    const cartRows = document.querySelectorAll('.cart-item-row');
    tab.items.forEach((item, index) => {
        if (item.isCombo && item.comboComponents && item.comboComponents.length > 0) {
            const row = cartRows[index];
            if (row) {
                const nameContainer = row.querySelector('div[style*="flex: 1; min-width: 0; padding-right: 10px;"]');
                if (nameContainer) {
                    let subHtml = `<div style="margin-top: 5px; padding-left: 10px; border-left: 2px solid var(--kv-blue); font-size: 11px; color: #555;">`;
                    item.comboComponents.forEach(comp => {
                        // Tính tổng số lượng lẻ = Số lượng của Thùng x Số lượng lẻ bên trong
                        subHtml += `<div>- ${comp.name} <b>x${comp.qty}</b></div>`;
                    });
                    subHtml += `</div>`;
                    nameContainer.innerHTML += subHtml;
                }
            }
        }
    });
};

// 7. CẬP NHẬT HÀM THANH TOÁN (Trừ đúng tồn kho của món lẻ)
const originalProcessCheckout = window.processCheckout;
window.processCheckout = function() {
    // 1. Can thiệp vào trước khi trừ tồn kho
    const tab = posTabs[activeTabIndex];
    if (!tab || tab.items.length === 0) { return originalProcessCheckout(); }

    const latestProds = JSON.parse(localStorage.getItem('kv_products')) || [];

    // Chúng ta sẽ "đánh lừa" hệ thống cũ bằng cách chuẩn bị sẵn tồn kho
    tab.items.forEach(cartItem => {
        if (cartItem.isCombo && cartItem.comboComponents) {
            // A. Trừ tồn kho của CÁC MÓN LẺ
            cartItem.comboComponents.forEach(child => {
                const childProd = latestProds.find(p => p.id === child.productId);
                if (childProd) {
                    // Số lượng trừ = Số lượng Thùng Mix * Số lượng lẻ trong 1 thùng * tỷ lệ quy đổi
                    const totalDeduct = cartItem.qty * child.qty * child.rate;
                    childProd.stock = (parseFloat(childProd.stock) || 0) - totalDeduct;
                }
            });

            // B. Trả lại tồn kho cho Thùng Mix ảo (để hàm gốc chạy trừ đi là hòa về 0, không bị âm kho ảo)
            const parentProd = latestProds.find(p => p.id === cartItem.productId);
            if (parentProd) {
                const parentRate = cartItem.units[cartItem.selectedUnitIdx]?.rate || 1;
                parentProd.stock = (parseFloat(parentProd.stock) || 0) + (cartItem.qty * parentRate);
            }
        }
    });

    // Lưu lại tồn kho đã được can thiệp vào máy trước khi gọi hàm Checkout gốc
    localStorage.setItem('kv_products', JSON.stringify(latestProds));

    // Gọi hàm thanh toán gốc (Nó sẽ lo in hóa đơn, lưu lịch sử, và vô tình trừ đi phần tồn kho ảo ta vừa bù vào)
    originalProcessCheckout();
};
// =========================================================================
// BẢN VÁ LỖI HIỆU NĂNG & CHỐNG MẤT DỮ LIỆU TỐI THƯỢNG (DÁN XUỐNG CUỐI CÙNG)
// =========================================================================

// 1. SỬA LỖI MẤT DỮ LIỆU KHI CHUYỂN ĐỔI INDEXEDDB
window.migrateOldData = async function() {
    // Phải gom danh sách key ra mảng riêng trước để vòng lặp không bị lỗi "nhảy cóc" khi xóa
    const keysToMigrate = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('kv_')) keysToMigrate.push(key);
    }
    
    // Tiến hành chuyển nhà an toàn
    for (const key of keysToMigrate) {
        const val = oriGet(key);
        await window.saveDB(key, val);
        window.KV_RAM[key] = val;
        oriRemove(key); // Bây giờ xóa mới an toàn
    }
};

// 2. SỬA LỖI ĐƠ MÀN HÌNH KHI QUÉT MÃ VẠCH (TỐC ĐỘ SIÊU TỐC TỪ RAM)
window.searchPOSProduct = function(keyword) {
    const dropdown = document.getElementById('pos-search-dropdown');
    if (!keyword || !keyword.trim()) { dropdown.style.display = 'none'; return; }
    
    const rawKw = keyword.toLowerCase().trim();
    const cleanKw = window.removeVietnameseTones(rawKw);
    const searchTerms = cleanKw.split(/\s+/);
    
    const currentBranch = localStorage.getItem('kv_current_branch');
    
    // [PHÉP THUẬT Ở ĐÂY]: Không dùng JSON.parse(localStorage) nữa, lấy thẳng từ RAM!
    const latestProducts = window.products || []; 
    
    const tab = posTabs[activeTabIndex];
    const currentPriceBookId = tab ? (tab.priceBook || 'default') : 'default';

    let results = [];

    latestProducts.forEach(p => {
        if (p.branchId !== currentBranch) return; 

        const pName = window.removeVietnameseTones((p.name || "").toLowerCase());
        const pCode = (p.code || "").toLowerCase();
        const pBarcode = (p.barcode || "").toLowerCase();

        const checkMatch = (str) => str && searchTerms.every(term => str.includes(term));
        const matchBase = checkMatch(pName) || checkMatch(pCode) || checkMatch(pBarcode);

        if (p.units && p.units.length > 0) {
            p.units.forEach((unit, uIdx) => {
                const uCode = (unit.code || "").toLowerCase();
                const uBarcode = (unit.barcode || "").toLowerCase();
                
                if (matchBase || checkMatch(uCode) || checkMatch(uBarcode)) {
                    const correctPrice = window.getProductPrice(p, currentPriceBookId, uIdx);
                    results.push({
                        ...p,
                        matchedUnitIdx: uIdx,
                        displayUnitName: unit.name,
                        displayPrice: correctPrice, 
                        displayCode: unit.code || p.code
                    });
                }
            });
        }
    });

    if (results.length === 0) {
        dropdown.innerHTML = '<div style="padding:15px; color:#888; text-align:center;">Không tìm thấy hàng hóa</div>';
    } else {
        dropdown.innerHTML = results.slice(0, 20).map(p => `
            <div class="pos-dropdown-item pos-item-node"  onclick="document.getElementById('pos-search-input').value='${p.displayCode}'; addPOSItem('${p.id}', true, ${p.matchedUnitIdx});">
                <div style="flex:1;">
                    <strong style="color: var(--kv-blue);">${p.displayCode}</strong> - 
                    <strong>${p.name} (${p.displayUnitName})</strong>
                </div>
                <div style="text-align: right;">
                    <div style="font-weight: bold; color: var(--kv-pink);">${(p.displayPrice || 0).toLocaleString('vi-VN')}</div>
                </div>
            </div>`).join('');
    }
    dropdown.style.display = 'block';
    window.currentFocus = -1; 
};

// HÀM XỬ LÝ KHI DÙNG SÚNG QUÉT MÃ VẠCH (TỐI ƯU SIÊU TỐC)
window.handleDirectEnter = function(barcode) {
    const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
    
    if (!window.products || window.products.length === 0) {
        window.products = JSON.parse(localStorage.getItem('kv_products')) || [];
    }
    const latestProducts = window.products;
    
    let exactMatch = null;
    let matchedUnitIdx = 0;

    for (let p of latestProducts) {
        if (p.branchId !== currentBranch) continue;
        
        if ((p.barcode && p.barcode.toLowerCase() === barcode) || (p.code && p.code.toLowerCase() === barcode)) {
            exactMatch = p;
            matchedUnitIdx = 0;
            break;
        }
        
        if (p.units && p.units.length > 0) {
            const uIdx = p.units.findIndex(u => (u.barcode && u.barcode.toLowerCase() === barcode) || (u.code && u.code.toLowerCase() === barcode));
            if (uIdx !== -1) {
                exactMatch = p;
                matchedUnitIdx = uIdx;
                break;
            }
        }
    }

    if (exactMatch) {
        window.addPOSItem(exactMatch.id, false, matchedUnitIdx);
    } else {
        showToast(`Không tìm thấy hàng hóa có mã: ${barcode}`, "error");
        const sInput = document.getElementById('pos-search-input');
        if (sInput) {
            sInput.focus();
            sInput.select();
        }
    }
    
    const dropdown = document.getElementById('pos-search-dropdown');
    if (dropdown) dropdown.style.display = 'none';
};

// 4. FIX ĐƠ MÁY CHO CÁC HÀM XỬ LÝ GIỎ HÀNG
window.addPOSItem = function(productId, keepInput = true, forcedUnitIdx = null) {
    const sInput = document.getElementById('pos-search-input');
    const dropdown = document.getElementById('pos-search-dropdown');
    
    if (dropdown) dropdown.style.display = 'none';
    
    // Tối ưu RAM: Không quét lại ổ cứng để tránh trễ nhịp
    if (!window.products || window.products.length === 0) {
        window.products = JSON.parse(localStorage.getItem('kv_products')) || [];
    }
    const allProds = window.products;
    
    const p = allProds.find(x => String(x.id) === String(productId));
    if (!p) { showToast("Không tìm thấy hàng hóa!", "error"); return; }

    const tab = posTabs[activeTabIndex];
    if (!tab) return;

    const unitIdx = forcedUnitIdx !== null ? forcedUnitIdx : 0;
    const productUnits = (p.units && p.units.length > 0) ? p.units : [{ name: 'Cái', rate: 1, price: p.price, isBase: true }];
    const selectedUnit = productUnits[unitIdx];

    const currentPriceBookId = tab.priceBook || 'default';
    const finalPrice = window.getProductPrice(p, currentPriceBookId, unitIdx);

    const existingIndex = tab.items.findIndex(x => 
        String(x.productId) === String(productId) && parseInt(x.selectedUnitIdx) === parseInt(unitIdx)
    );
    
    if (existingIndex !== -1) {
        tab.items[existingIndex].qty += 1;
        tab.items[existingIndex].price = finalPrice; 
        const item = tab.items.splice(existingIndex, 1)[0];
        tab.items.unshift(item);
    } else {
        tab.items.unshift({ 
            productId: p.id, code: selectedUnit.code || p.code, name: p.name, 
            qty: 1, basePrice: p.price, price: finalPrice, 
            units: productUnits, selectedUnitIdx: unitIdx, isIce: false 
        });
    }
    
    savePOSState();
    if (typeof renderPOSCart === 'function') renderPOSCart();

    if (sInput) {
        if (!keepInput) sInput.value = '';
        sInput.focus();
        sInput.select(); 
    }
};

let ioSearchTimeout = null;
window.searchIOProduct = function(keyword) {
    const dropdown = document.getElementById('io-search-dropdown');
    if (!keyword || !keyword.trim()) { 
        dropdown.style.display = 'none'; 
        return; 
    }

    clearTimeout(ioSearchTimeout);
    ioSearchTimeout = setTimeout(() => {
        const rawKw = keyword.toLowerCase().trim();
        const cleanKw = window.removeVietnameseTones ? window.removeVietnameseTones(rawKw) : rawKw;
        const searchTerms = cleanKw.split(/\s+/);

        const currentBranch = localStorage.getItem('kv_current_branch') || 'CN001';
        const latestProducts = window.products || []; // TỐI ƯU: Lấy từ RAM

        let exactMatch = null;
        for (let p of latestProducts) {
            if (p.branchId !== currentBranch) continue;
            
            if ((p.barcode && p.barcode.toLowerCase() === rawKw) || (p.code && p.code.toLowerCase() === rawKw)) {
                exactMatch = p; 
                break;
            }
            if (p.units) {
                let uMatch = p.units.find(u => (u.barcode && u.barcode.toLowerCase() === rawKw) || (u.code && u.code.toLowerCase() === rawKw));
                if (uMatch) { exactMatch = p; break; }
            }
        }

        if (exactMatch) {
            window.addIOToList(exactMatch.id);
            document.getElementById('io-search-input').value = '';
            dropdown.style.display = 'none';
            return;
        }

        let results = [];
        latestProducts.forEach(p => {
            if (p.branchId !== currentBranch) return;

            const pName = window.removeVietnameseTones ? window.removeVietnameseTones((p.name || "").toLowerCase()) : (p.name || "").toLowerCase();
            const pCode = (p.code || "").toLowerCase();
            const pBarcode = (p.barcode || "").toLowerCase();

            let matchBase = searchTerms.every(term => pName.includes(term) || pCode.includes(term) || pBarcode.includes(term));
            
            if (matchBase) {
                results.push({ ...p, displayCode: p.code });
            } else if (p.units) {
                p.units.forEach(u => {
                    const uName = window.removeVietnameseTones ? window.removeVietnameseTones((u.name || "").toLowerCase()) : (u.name || "").toLowerCase();
                    const uCode = (u.code || "").toLowerCase();
                    const uBarcode = (u.barcode || "").toLowerCase();
                    
                    if (searchTerms.every(term => pName.includes(term) || uName.includes(term) || uCode.includes(term) || uBarcode.includes(term))) {
                        results.push({ ...p, displayCode: u.code || p.code });
                    }
                });
            }
        });

        results = results.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

        if (results.length === 0) {
            dropdown.innerHTML = '<div style="padding:15px; color:#888; text-align:center;">Không tìm thấy hàng hóa thuộc chi nhánh này</div>';
        } else {
            dropdown.innerHTML = results.slice(0, 15).map(p => `
                <div class="ic-dropdown-item pos-item-node" onclick="window.addIOToList('${p.id}')" style="padding: 12px 15px; cursor: pointer; border-bottom: 1px solid #f4f4f4; display: flex; justify-content: space-between; align-items: center;" onmouseover="this.style.background='#eef6ff'" onmouseout="this.style.background='transparent'">
                    <div style="flex:1;">
                        <strong style="color: var(--kv-blue);">${p.displayCode || p.code}</strong> - 
                        <strong style="color: #333;">${p.name}</strong>
                    </div>
                    <div style="text-align: right;">
                        <div style="font-weight: bold; color: #888;">Giá vốn: ${(p.cost || 0).toLocaleString('vi-VN')}</div>
                        <div style="font-size: 11px; color: #888; margin-top: 2px;">Tồn kho: ${p.stock || 0}</div>
                    </div>
                </div>`).join('');
        }
        dropdown.style.display = 'block';
    }, 100);
};
// ==========================================
// TÍNH NĂNG: IN HÓA ĐƠN TẠM TÍNH (KHÔNG LƯU VÀO HỆ THỐNG)
// ==========================================
window.printTemporaryReceipt = function() {
    // 1. Lấy dữ liệu giỏ hàng hiện tại đang mở
    const tab = posTabs[activeTabIndex];
    if (!tab || tab.items.length === 0) { 
        showToast("Giỏ hàng trống, không có gì để in!", "warning"); 
        return; 
    }

    // 2. Thu thập các con số trên màn hình
    const totalAmount = parseFloat(document.getElementById('pos-total-goods').dataset.val) || 0;
    const isFeatureEnabled = document.getElementById('enable-beer-ice')?.checked;
    
    // Kiểm tra tính tiền lạnh
    let iceAmount = 0;
    if (isFeatureEnabled && typeof calculateManualBeerIce === 'function') {
        iceAmount = calculateManualBeerIce();
    }
    
    const mustPay = totalAmount - (tab.discount || 0) + (tab.extraFee || 0) + iceAmount;
    
    // Lấy số tiền khách đưa (nếu thu ngân đã gõ)
    const actualPaidStr = document.getElementById('pos-customer-paid')?.value || '0';
    const actualPaid = (window.parseCurrency(actualPaidStr) * 1000) || mustPay;

    // 3. Tạo một "Hóa đơn ảo" (Dữ liệu này chỉ dùng để in, không lưu vào Firebase)
    const tempInvoice = {
        id: 'TẠM TÍNH', // Thay mã Hóa Đơn bằng chữ TẠM TÍNH
        createdAt: new Date().toLocaleString('vi-VN'),
        items: tab.items,
        totalAmount: totalAmount,
        invoiceDiscount: tab.discount || 0,
        extraFee: tab.extraFee || 0,
        beerIceAmount: iceAmount,
        beerIceNote: tab.beerIceNote || "",
        customerPaid: actualPaid,
        creator: currentUser ? currentUser.fullname : 'Nhân viên',
        status: 'temp'
    };

    // 4. Đẩy hóa đơn ảo này vào máy in
    window.printReceipt(tempInvoice);
};
// ==========================================
// TÍNH NĂNG ĐỒNG BỘ TỰ ĐỘNG (GỘP DỮ LIỆU KHÔNG XUNG ĐỘT)
// ==========================================
window.syncOfflineData = function() {
    if (!navigator.onLine) {
        showToast("Máy vẫn đang mất mạng. Vui lòng kiểm tra lại kết nối Wifi/4G!", "error");
        return;
    }

    let pendingData = JSON.parse(localStorage.getItem('kv_pending_invoices_data')) || [];
    if (pendingData.length === 0) {
        showToast("Không có hóa đơn nào cần đồng bộ.", "info");
        return;
    }

    let allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    
    // Đẩy toàn bộ các đơn kẹt vào mảng chính thức (kiểm tra trùng lặp)
    pendingData.forEach(offlineInv => {
        const exists = allInvoices.find(inv => inv.id === offlineInv.id);
        if (!exists) {
            allInvoices.unshift(offlineInv);
        }
    });

    // Lưu vào máy và đồng bộ Firebase
    localStorage.setItem('kv_invoices', JSON.stringify(allInvoices));

    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('invoices', allInvoices);
        
        // Thành công -> Quét sạch mảng lưu nháp offline
        localStorage.removeItem('kv_pending_invoices_data');
        
        showToast(`Đã đồng bộ thành công ${pendingData.length} hóa đơn lên hệ thống!`, "success");
        
        // Cập nhật bảng và tắt đèn nhấp nháy
        window.updateOfflineIndicator();
        openOfflineInvoicesModal(); 
        
        // Load lại danh sách hóa đơn trong thẻ Quản lý nếu đang mở
        if (typeof renderInvoices === 'function') renderInvoices();
    }
};

// Lắng nghe sự kiện trình duyệt có mạng trở lại
window.addEventListener('online', function() {
    let pendingInvoices = JSON.parse(localStorage.getItem('kv_pending_invoices_data')) || [];
    if (pendingInvoices.length > 0) {
        showToast("Có mạng lại! Đang tải dữ liệu từ máy khác về để gộp...", "info");
        
        // ĐIỂM QUAN TRỌNG NHẤT: Bắt buộc đợi 4 giây. 
        // 4 giây này là để Firebase tự động kéo hóa đơn của máy tính về điện thoại xong xuôi, 
        // sau đó điện thoại mới bắt đầu gộp hóa đơn offline của nó vào và đẩy lên.
        setTimeout(window.syncOfflineData, 4000);
    }
});
// ==========================================
// TÍNH NĂNG: ĐỒNG BỘ HÓA ĐƠN OFFLINE THỦ CÔNG
// ==========================================

window.updateOfflineIndicator = function() {
    let pendingData = JSON.parse(localStorage.getItem('kv_pending_invoices_data')) || [];
    const count = pendingData.length;
    
    // Cập nhật con số
    document.querySelectorAll('.offline-count').forEach(el => el.innerText = count);
    
    // Thêm/bớt hiệu ứng nhấp nháy màu cam
    document.querySelectorAll('.offline-indicator').forEach(el => {
        if (count > 0) {
            el.classList.add('has-pending');
            el.title = `Có ${count} đơn hàng chờ đồng bộ. Bấm để xem chi tiết.`;
        } else {
            el.classList.remove('has-pending');
            el.title = "Không có đơn hàng chờ đồng bộ.";
        }
    });
};
// Cập nhật ngay khi trang web vừa tải xong
window.updateOfflineIndicator();

// Thiết lập đồng hồ quét tự động: Cứ 3 giây kiểm tra lại một lần
setInterval(window.updateOfflineIndicator, 3000);

// Lắng nghe sự kiện hệ thống có mạng / mất mạng để tự động cập nhật
window.addEventListener('online', window.updateOfflineIndicator);
window.addEventListener('offline', window.updateOfflineIndicator);
// ==========================================
// QUẢN LÝ DANH SÁCH HÓA ĐƠN OFFLINE
// ==========================================

// ==========================================
// CẬP NHẬT TRẠNG THÁI KẾT NỐI MẠNG (ONLINE / OFFLINE)
// ==========================================
window.updateNetworkStatusUI = function() {
    const banner = document.getElementById('network-status-banner');
    const dot = document.getElementById('network-status-dot');
    const text = document.getElementById('network-status-text');
    const btnSync = document.getElementById('btn-sync-offline');

    if (!banner) return;

    if (navigator.onLine) {
        // CÓ MẠNG: Xanh lá cây, mở khóa nút Đồng bộ
        banner.style.backgroundColor = '#e8f5e9';
        dot.style.background = '#28a745';
        dot.style.boxShadow = '0 0 5px rgba(40, 167, 69, 0.5)';
        text.style.color = '#28a745';
        text.innerHTML = 'Hệ thống đang Online (Kết nối ổn định, sẵn sàng đồng bộ)';
        
        if (btnSync) {
            btnSync.disabled = false;
            btnSync.style.opacity = '1';
            btnSync.style.cursor = 'pointer';
        }
    } else {
        // MẤT MẠNG: Đỏ, khóa nút Đồng bộ lại
        banner.style.backgroundColor = '#ffebee';
        dot.style.background = '#dc3545';
        dot.style.boxShadow = '0 0 5px rgba(220, 53, 69, 0.5)';
        text.style.color = '#dc3545';
        text.innerHTML = 'Đang mất kết nối mạng! (Vui lòng kiểm tra lại Wifi/4G)';
        
        if (btnSync) {
            btnSync.disabled = true;
            btnSync.style.opacity = '0.5';
            btnSync.style.cursor = 'not-allowed';
        }
    }
};

// Lắng nghe sự kiện cắm/rút dây mạng hoặc bật/tắt Wifi của thiết bị
window.addEventListener('online', window.updateNetworkStatusUI);
window.addEventListener('offline', window.updateNetworkStatusUI);

// 2. Mở cửa sổ Danh sách Hóa đơn đang kẹt (Đã cập nhật gọi kiểm tra mạng)
window.openOfflineInvoicesModal = function() {
    const tbody = document.getElementById('offline-invoices-tbody');
    const countEl = document.getElementById('offline-total-count');
    
    // Gọi hàm cập nhật tình trạng mạng để hiển thị ngay
    window.updateNetworkStatusUI();
    
    let pendingData = JSON.parse(localStorage.getItem('kv_pending_invoices_data')) || [];
    if (countEl) countEl.innerText = pendingData.length;

    if (pendingData.length === 0) {
        tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; padding: 40px; color: #888;">Không có hóa đơn offline nào đang tồn đọng.</td></tr>`;
    } else {
        tbody.innerHTML = pendingData.map((inv, index) => {
            return `
                <tr style="border-bottom: 1px dashed #eee; transition: 0.2s;" onmouseover="this.style.background='#fdfdfd'" onmouseout="this.style.background='white'">
                    <td style="color: var(--kv-blue); font-weight: bold; padding: 12px 15px;">${inv.id}</td>
                    <td style="padding: 12px 15px; color: #555;">${inv.createdAt}</td>
                    <td style="text-align: right; font-weight: bold; color: var(--kv-pink); padding: 12px 15px;">${(inv.totalAmount || 0).toLocaleString('vi-VN')}</td>
                    <td style="text-align: center; padding: 12px 15px;">
                        <button onclick="deleteOfflineInvoice(${index})" style="background: white; border: 1px solid #d9534f; color: #d9534f; padding: 6px 10px; border-radius: 4px; cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='#fff0f0'" onmouseout="this.style.background='white'" title="Xóa bỏ hóa đơn này khỏi máy">
                            <i class="fa-solid fa-trash-can"></i>
                        </button>
                    </td>
                </tr>
            `;
        }).join('');
    }
    
    document.getElementById('offline-invoices-modal').style.display = 'flex';
};

window.closeOfflineInvoicesModal = function() {
    document.getElementById('offline-invoices-modal').style.display = 'none';
};

window.deleteOfflineInvoice = function(index) {
    showConfirm("Bạn có chắc chắn muốn <b>XÓA BỎ</b> hóa đơn offline này không?<br>Dữ liệu sẽ mất vĩnh viễn và không được đẩy lên hệ thống nữa.", function() {
        let pendingData = JSON.parse(localStorage.getItem('kv_pending_invoices_data')) || [];
        
        pendingData.splice(index, 1); // Xóa khỏi mảng
        localStorage.setItem('kv_pending_invoices_data', JSON.stringify(pendingData));
        
        showToast("Đã xóa hóa đơn offline khỏi hàng đợi", "success");
        
        // Cập nhật lại UI lập tức
        openOfflineInvoicesModal(); 
        window.updateOfflineIndicator();
    });
};
// ==========================================
// TÍNH NĂNG SAO CHÉP HÀNG HÓA GIỮA CÁC CHI NHÁNH
// ==========================================

// 1. Hàm mở hộp thoại và nạp danh sách chi nhánh
window.openCopyBranchModal = function() {
    const sourceSelect = document.getElementById('copy-source-branch');
    const targetSelect = document.getElementById('copy-target-branch');
    const currentBranches = JSON.parse(localStorage.getItem('kv_branches')) || [];

    let optionsHtml = '';
    currentBranches.forEach(br => {
        optionsHtml += `<option value="${br.id}">${br.name}</option>`;
    });

    if (sourceSelect) sourceSelect.innerHTML = optionsHtml;
    if (targetSelect) targetSelect.innerHTML = optionsHtml;

    const modal = document.getElementById('copy-branch-modal');
    if (modal) modal.style.display = 'flex';
};

// 2. Hàm đóng hộp thoại
window.closeCopyBranchModal = function() {
    const modal = document.getElementById('copy-branch-modal');
    if (modal) modal.style.display = 'none';
};

// 3. Hàm xử lý logic sao chép dữ liệu
window.processCopyBranch = function() {
    const sourceId = document.getElementById('copy-source-branch').value;
    const targetId = document.getElementById('copy-target-branch').value;
    const keepStock = document.getElementById('copy-keep-stock').checked;

    if (sourceId === targetId) {
        showToast("Vui lòng chọn 2 chi nhánh khác nhau!", "error");
        return;
    }

    let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    let allPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];

    // Lọc lấy danh sách hàng hóa thuộc chi nhánh nguồn
    const sourceProducts = allProducts.filter(p => (p.branchId || 'CN001') === sourceId);

    if (sourceProducts.length === 0) {
        showToast("Chi nhánh nguồn không có hàng hóa nào để sao chép!", "warning");
        return;
    }

    showConfirm(`Hệ thống sẽ nhân bản ${sourceProducts.length} mặt hàng sang chi nhánh đích. Bạn có chắc chắn?`, function() {
        let copiedCount = 0;

        sourceProducts.forEach((p, index) => {
            // Tách bản sao độc lập (Deep Copy) để không bị dính líu dữ liệu với chi nhánh cũ
            let newP = JSON.parse(JSON.stringify(p));

            const oldId = p.id;
            const newId = 'PROD' + Date.now() + '_' + index; // Tạo mã ID hệ thống duy nhất

            newP.id = newId;
            newP.branchId = targetId; // Chuyển quyền sở hữu sang chi nhánh mới

            // Xử lý Tồn kho
            if (!keepStock) {
                newP.stock = 0; // Mặc định là reset tồn kho về 0
            }

            allProducts.unshift(newP);
            copiedCount++;

            // Xử lý chép Bảng giá đa cột (nếu có)
            allPriceBooks.forEach(pb => {
                if (pb.prices) {
                    Object.keys(pb.prices).forEach(oldKey => {
                        // Chép giá của đơn vị cơ bản và các đơn vị quy đổi (Vd: PROD123_0, PROD123_1)
                        if (oldKey === oldId || oldKey.startsWith(oldId + '_')) {
                            const newKey = oldKey.replace(oldId, newId);
                            pb.prices[newKey] = pb.prices[oldKey];
                        }
                    });
                }
            });
        });

        // Lưu vào LocalStorage
        localStorage.setItem('kv_products', JSON.stringify(allProducts));
        localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
        window.products = allProducts;
        window.priceBooks = allPriceBooks;

        // Đồng bộ lên Cloud
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', allProducts);
            window.uploadToCloud('pricebooks', allPriceBooks);
        }

        closeCopyBranchModal();
        showToast(`Đã sao chép thành công ${copiedCount} mặt hàng!`, "success");

        // Tự động cập nhật lại số đếm trên giao diện thẻ Chi nhánh
        if (typeof renderBranchList === 'function') {
            renderBranchList();
        }
    });
};
// =======================================================
// CHẶN NGƯỜI DÙNG F5 HOẶC TẮT TRÌNH DUYỆT KHI ĐANG THANH TOÁN
// =======================================================
window.addEventListener('beforeunload', function(e) {
    if (window.isProcessingCheckout) {
        // Hầu hết các trình duyệt hiện đại đều bỏ qua nội dung chuỗi này 
        // và tự hiển thị thông báo mặc định của hệ thống để chống Spam
        const confirmationMessage = "Đang trong quá trình xử lý thanh toán. Dữ liệu có thể bị mất nếu bạn tải lại trang ngay bây giờ!";
        
        // Chuẩn tương thích cho các trình duyệt
        e.preventDefault();
        (e || window.event).returnValue = confirmationMessage; // IE, Firefox
        return confirmationMessage; // Safari, Chrome, Edge
    }
});
// ==========================================
// TỰ ĐỘNG ĐÓNG DANH SÁCH TÌM KIẾM KHI CLICK RA NGOÀI
// ==========================================
document.addEventListener('click', function(e) {
    // Danh sách các cặp [Ô nhập liệu, Bảng sổ xuống] trên toàn hệ thống
    const searchPairs = [
        { input: 'pos-search-input', dropdown: 'pos-search-dropdown' },     // Màn hình Bán hàng
        { input: 'ic-search-input', dropdown: 'ic-search-dropdown' },       // Màn hình Kiểm kho
        { input: 'io-search-input', dropdown: 'io-search-dropdown' },       // Màn hình Nhập hàng
        { input: 'combo-search-input', dropdown: 'combo-search-dropdown' }  // Modal Đóng thùng Mix
    ];

    searchPairs.forEach(pair => {
        const inputEl = document.getElementById(pair.input);
        const dropdownEl = document.getElementById(pair.dropdown);
        
        // Nếu bảng dropdown đang mở
        if (dropdownEl && dropdownEl.style.display === 'block') {
            // Kiểm tra: Nếu vị trí click không nằm trong ô tìm kiếm VÀ không nằm trong bảng dropdown
            if (inputEl && !inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
                dropdownEl.style.display = 'none'; // Ẩn bảng đi
            }
        }
    });
});