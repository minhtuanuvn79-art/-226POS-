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

// Biến tạm lưu thông tin đăng nhập trước khi chọn chi nhánh
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
        
        // Hỗ trợ cả dữ liệu cũ (branchId chuỗi) và mới (branchIds mảng)
        let userBranches = user.branchIds || (user.branchId ? [user.branchId] : ['CN001']);

        // Lưu thông tin tạm để dùng sau khi chọn chi nhánh
        tempLoginData = { user, type, branches: userBranches };

        if (userBranches.length > 1) {
            // Hiển thị giao diện chọn chi nhánh
            document.querySelector('.login-box').style.display = 'none';
            document.getElementById('login-branch-select-box').style.display = 'block';
            renderLoginBranchSelect(userBranches);
        } else {
            // Đăng nhập luôn nếu chỉ có 1 chi nhánh
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
    sessionStorage.setItem('kv_current_branch', selectedBranchId); // Lưu chi nhánh đã chọn
    
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
    tempLoginData = null; // Xóa dữ liệu tạm
}
function logout() {
    currentUser = null;
    // Xóa bộ nhớ trạng thái khi đăng xuất
    localStorage.removeItem('kv_current_user');
    sessionStorage.removeItem('kv_current_view');
    localStorage.removeItem('kv_current_tab');
    
    hideAll();
    document.getElementById('login-view').style.display = 'flex';
    document.getElementById('login-pass').value = '';
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
    
    // [ĐÃ SỬA LỖI TẠI ĐÂY] Lọc nhân viên có chứa mã chi nhánh trong mảng branchIds
    const staff = allAccounts.filter(acc => {
        return (acc.branchIds && acc.branchIds.includes(branchId)) || (acc.branchId === branchId);
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
                <button class="btn-action edit" onclick="editAccount('${acc.username}')"><i class="fa-solid fa-pen"></i></button>
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
 // Thêm 3 dòng này để xóa giao diện tên nhóm hiển thị về mặc định
const pmGroupDisplay = document.getElementById('pm-group-display');
if (pmGroupDisplay) {
    pmGroupDisplay.innerText = 'Chọn nhóm hàng...';
    pmGroupDisplay.style.color = '#555';
    pmGroupDisplay.style.fontWeight = 'normal';
}
document.getElementById('pm-sell-direct').checked = true;
    
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

    // 4. Đọc bảng giá tươi nhất để nạp vào modal thiết lập giá nhanh
    const latestPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    tempPriceBookValues = {};
    latestPriceBooks.forEach(pb => {
        if (pb.prices && pb.prices[id] !== undefined) {
            tempPriceBookValues[pb.id] = pb.prices[id];
        }
    });

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
    document.getElementById('pm-sell-direct').checked = p.sellDirect;
    
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
    const barcodeEl = document.getElementById('pm-barcode'); // 1. Bổ sung lệnh đọc mã vạch

const parseNum = (val) => {
    return window.parseCurrency(val);
};

    const name = nameEl.value.trim();
    const price = parseNum(priceEl.value);
    const cost = parseNum(costEl.value);
    const stock = parseFloat(stockEl.value) || 0;
    const code = codeEl.value.trim();
    const barcode = barcodeEl ? barcodeEl.value.trim() : '';

    if (!name) { showToast("Vui lòng nhập tên hàng hóa!", "error"); return; }

    window.isSyncLocked = true;
    let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    let productIdToSave = editingProductId; // Tạo biến lưu ID để dùng chung cho Thiết lập giá

    if (editingProductId) {
        // --- TRƯỜNG HỢP: SỬA HÀNG HÓA CÓ SẴN ---
        const idx = allProducts.findIndex(p => p.id === editingProductId);
        if (idx !== -1) {
            allProducts[idx].name = name;
            allProducts[idx].price = price;
            allProducts[idx].cost = cost;
            allProducts[idx].stock = stock;
            allProducts[idx].group = document.getElementById('pm-group').value;
            allProducts[idx].code = code;
            allProducts[idx].barcode = barcode; // Đồng bộ mã vạch lớp ngoài

            // 2. FIX LỖI TÊN ĐƠN VỊ TÍNH: Bỏ chữ 'window.' đi, dùng trực tiếp biến
            if (currentProductUnits && currentProductUnits.length > 0) {
                currentProductUnits[0].price = price;
                currentProductUnits[0].code = code;
                currentProductUnits[0].barcode = barcode;
                allProducts[idx].units = currentProductUnits; // Đẩy toàn bộ lốc, thùng vào
            } else if (allProducts[idx].units && allProducts[idx].units.length > 0) {
                allProducts[idx].units[0].price = price;
                allProducts[idx].units[0].code = code;
                allProducts[idx].units[0].barcode = barcode;
            } else {
                allProducts[idx].units = [{ name: 'Cái', rate: 1, price: price, code: code, barcode: barcode, isBase: true }];
            }
        }
    } else {
        // --- TRƯỜNG HỢP: THÊM HÀNG HÓA MỚI ---
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
            branchId: sessionStorage.getItem('kv_current_branch') || 'CN001',
            units: newUnits
        };
        allProducts.unshift(newProd);
    }

    // 3. FIX LỖI KHÔNG LƯU "THIẾT LẬP GIÁ GỐC" TỪ MODAL
    if (Object.keys(tempPriceBookValues).length > 0) {
        let allPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
        let isChanged = false;
        
        allPriceBooks.forEach(pb => {
            if (tempPriceBookValues[pb.id] !== undefined) {
                if (!pb.prices) pb.prices = {};
                // Cập nhật giá gốc cho ID sản phẩm và ID đơn vị cơ bản (_0)
                pb.prices[productIdToSave] = tempPriceBookValues[pb.id];
                pb.prices[`${productIdToSave}_0`] = tempPriceBookValues[pb.id];
                isChanged = true;
            }
        });

        // Nếu có thay đổi giá gốc thì lưu lại
        if (isChanged) {
            localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
            window.priceBooks = allPriceBooks;
            if (window.uploadToCloud) window.uploadToCloud('pricebooks', allPriceBooks);
        }
    }

    // Ghi đè biến và LocalStorage ngay lập tức
    products = [...allProducts];
    window.products = [...allProducts];
    localStorage.setItem('kv_products', JSON.stringify(allProducts));

    // Cập nhật giao diện
// Cập nhật giao diện
    closeAddProductModal();
    if (typeof renderProductList === 'function') renderProductList();
    if (typeof renderPOS === 'function') renderPOS();

    // =================================================================
    // ĐỒNG BỘ NGƯỢC LẠI PHIẾU NHẬP HÀNG ĐANG MỞ (NẾU CÓ)
    // =================================================================
    if (typeof currentIOItems !== 'undefined' && currentIOItems.length > 0) {
        currentIOItems.forEach(item => {
            if (String(item.productId) === String(productIdToSave)) {
                // 1. Cập nhật tên mới vừa sửa
                item.name = name; 
                
                // 2. Tính toán lại giá vốn dựa theo đơn vị tính đang chọn trên dòng
                const rate = item.units && item.units[item.selectedUnitIdx] ? item.units[item.selectedUnitIdx].rate : 1;
                item.baseCost = cost;
                item.cost = cost * rate;
            }
        });
        // Vẽ lại bảng danh sách phiếu nhập để cập nhật tên và số tiền tức thì
        if (typeof renderIOItemsTable === 'function') renderIOItemsTable();
    }

    // Đồng bộ Cloud
    if (window.uploadToCloud) window.uploadToCloud('products', allProducts);
    showToast("Đã cập nhật dữ liệu thành công!", "success");

    // Mở khóa sau 3 giây để Server ổn định
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
    const currentBranch = sessionStorage.getItem('kv_current_branch');
    
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
                    displayCode: unit.code || p.code
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

    paginatedItems.forEach((item) => {
        const groupObj = savedGroups.find(g => g.id === item.group);
        const groupName = groupObj ? groupObj.name : 'Chưa phân nhóm';

        tbody.innerHTML += `
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
                    <button onclick="event.stopPropagation(); deleteProduct('${item.id}', '${item.name}')" class="btn-delete-small"><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });

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
function openQuickPriceSetup() {
    const tbody = document.getElementById('quick-price-tbody');
    const countLabel = document.getElementById('quick-price-count');
    
    countLabel.innerText = `Có ${priceBooks.length} bảng giá đang hoạt động`;

    if (priceBooks.length === 0) {
        tbody.innerHTML = `<tr><td colspan="2" style="text-align:center; padding: 30px; color:#888;">Bạn chưa tạo bảng giá nào. Vui lòng thiết lập ở mục Thiết lập giá.</td></tr>`;
    } else {
        let html = '';
        priceBooks.forEach(pb => {
            // Lấy giá trị từ biến tạm (nếu đã nhập ở lần mở trước)
            const currentVal = tempPriceBookValues[pb.id] !== undefined ? tempPriceBookValues[pb.id] : '';
            html += `
                <tr style="border-bottom: 1px solid #eee;">
                    <td style="padding: 10px;">${pb.name}</td>
                    <td style="padding: 10px; text-align:right;">
                        <input type="number" class="quick-price-input" data-pbid="${pb.id}" value="${currentVal}" style="width: 130px; text-align: right; padding: 6px 10px; border: 1px solid #007bff; border-radius: 4px; outline: none;">
                    </td>
                </tr>
            `;
        });
        tbody.innerHTML = html;
    }

    document.getElementById('quick-price-modal').style.display = 'flex';
}

function closeQuickPriceSetup() {
    document.getElementById('quick-price-modal').style.display = 'none';
}

function saveQuickPriceSetup() {
    const inputs = document.querySelectorAll('.quick-price-input');
    inputs.forEach(input => {
        const pbId = input.getAttribute('data-pbid');
        const val = input.value;
        if (val !== '') {
            tempPriceBookValues[pbId] = parseFloat(val);
        } else {
            delete tempPriceBookValues[pbId];
        }
    });
    closeQuickPriceSetup();
}

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
    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';

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
    const pIndex = window.products.findIndex(x => x.id === productId);
    
    if(pIndex !== -1) {
        window.isSyncLocked = true; 
        
        // Cập nhật giá vào đúng vị trí của đơn vị tính
        if (window.products[pIndex].units && window.products[pIndex].units[unitIdx]) {
            window.products[pIndex].units[unitIdx].price = cleanPrice || 0;
        }
        
        // Nếu đang sửa đơn vị cơ bản (unitIdx = 0), đồng bộ ra giá lớp ngoài
        if (unitIdx === 0) {
            window.products[pIndex].price = cleanPrice || 0;
        }
        
        localStorage.setItem('kv_products', JSON.stringify(window.products));
        if (typeof window.uploadToCloud === 'function') window.uploadToCloud('products', window.products);
        
        if (typeof renderProductList === 'function') renderProductList();
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

function openCreateCheckView(id = null) {
    editingICId = id;
    currentICItems = [];
    document.getElementById('inventory-check-view').style.display = 'flex';
    document.getElementById('ic-creator-name').innerText = currentUser.fullname;
    
    const now = new Date();
    document.getElementById('ic-current-time').innerText = now.toLocaleString('vi-VN');

    if (id) {
        const ic = inventoryChecks.find(x => x.id === id);
        document.getElementById('ic-code').value = ic.code;
        document.getElementById('ic-note').value = ic.note || '';
        document.getElementById('ic-status-badge').innerText = 'Phiếu tạm';
        document.getElementById('ic-status-badge').className = 'status-badge status-temp';
        currentICItems = JSON.parse(JSON.stringify(ic.items)); 
    } else {
        document.getElementById('ic-code').value = '';
        document.getElementById('ic-note').value = '';
        document.getElementById('ic-status-badge').innerText = 'Phiếu tạm';
        document.getElementById('ic-status-badge').className = 'status-badge status-temp';
    }
    
    document.getElementById('ic-search-input').value = '';
    document.getElementById('ic-search-dropdown').style.display = 'none';
    renderICItemsTable();
}

function closeCreateCheckView() {
    if(currentICItems.length > 0 && !editingICId) {
        if(!confirm("Phiếu chưa được lưu. Bạn có chắc chắn muốn thoát?")) return;
    }
    document.getElementById('inventory-check-view').style.display = 'none';
}

window.searchICProduct = function(keyword) {
    const dropdown = document.getElementById('ic-search-dropdown');
    if (!keyword.trim()) { 
        dropdown.style.display = 'none'; 
        return; 
    }
    
    const kw = keyword.toLowerCase().trim();

    // Tìm tất cả hàng hóa chứa ký tự bạn vừa gõ (không cần khớp 100%)
    const searchTerms = kw.split(/\s+/);
    const matches = products.filter(p => {
        let fullSearchStr = (p.name || '') + ' ' + (p.code || '') + ' ' + (p.barcode || '');
        if (p.units && p.units.length > 0) {
            p.units.forEach(u => fullSearchStr += ' ' + (u.name || '') + ' ' + (u.code || '') + ' ' + (u.barcode || ''));
        }
        return searchTerms.every(term => fullSearchStr.toLowerCase().includes(term));
    });

    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(p => `
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

    tbody.innerHTML = '';
    currentICItems.forEach(item => {
        sumActual += item.realQty;
        const diff = item.realQty - item.sysStock;
        const valDiff = diff * item.cost;
        
        let unitOptions = item.units.map((u, idx) => 
            `<option value="${idx}" ${item.selectedUnitIdx === idx ? 'selected' : ''}>${u.name}</option>`
        ).join('');
        
        tbody.innerHTML += `
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
                    <!-- ĐIỂM SỬA LỖI QUAN TRỌNG: Thêm dấu nháy đơn vào updateICRealQty('${item.productId}') -->
                    <input type="number" value="${item.realQty}" onchange="window.updateICRealQty('${item.productId}', this.value)" style="width: 80px; text-align: center; padding: 5px; border: 1px solid #ccc; border-radius: 4px; outline: none; font-weight: bold;">
                </td>
                <td style="text-align:center; font-weight:bold; color:${diff < 0 ? 'red' : 'green'};">${diff}</td>
                <td style="text-align:right; font-weight:bold; color:${valDiff < 0 ? 'red' : 'green'};">${valDiff.toLocaleString()}</td>
            </tr>
        `;
    });
    
    document.getElementById('ic-total-actual-qty').innerText = sumActual;
};

window.saveInventoryCheck = function(action) {
    if (currentICItems.length === 0) { 
        alert("Vui lòng thêm hàng để kiểm!"); 
        return; 
    }

    const icCode = document.getElementById('ic-code').value || ("KK" + Date.now().toString().slice(-6));
    
    const icData = {
        branchId: sessionStorage.getItem('kv_current_branch') || 'CN001',
        id: editingICId || Date.now(), // Ưu tiên dùng ID cũ nếu đang sửa
        code: icCode,
        creator: currentUser ? currentUser.fullname : 'Admin',
        status: action,
        note: document.getElementById('ic-note').value.trim(),
        items: JSON.parse(JSON.stringify(currentICItems))
    };

    if (editingICId) {
        const idx = inventoryChecks.findIndex(x => x.id === editingICId);
        if (idx !== -1) inventoryChecks[idx] = icData;
    } else {
        inventoryChecks.unshift(icData);
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

    localStorage.setItem('kv_inventory_checks', JSON.stringify(inventoryChecks));
    if (window.uploadToCloud) window.uploadToCloud('inventory_checks', inventoryChecks);

    // ==========================================
    // DỌN DẸP TRẠNG THÁI (TRÁNH KẸT MÀN HÌNH)
    // ==========================================
    currentICItems = []; // Xóa rỗng giỏ hàng trước để không bị dính cảnh báo
    editingICId = null; 

    // Đóng giao diện trực tiếp
    const icView = document.getElementById('inventory-check-view');
    if (icView) icView.style.display = 'none';

    // Vẽ lại bảng danh sách bên dưới
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
            const sellText = u.sellDirect ? 'Bán trực tiếp' : 'Ngừng bán';
            
            tagsContainer.innerHTML += `
                <div class="unit-tag ${isBase ? 'base' : ''}" onclick="openAddUnitModal(${isBase}, ${index})">
                    <div class="unit-tag-info">
                        <span class="unit-tag-title">${u.name} ${subTitle}</span>
                        <span class="unit-tag-subtitle">• ${sellText}</span>
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
        
        document.getElementById('sub-unit-sell').checked = u.sellDirect;
    } else {
        // Trường hợp: Thêm mới hoàn toàn đơn vị tính[cite: 2]
        document.getElementById('sub-unit-name').value = '';
        document.getElementById('sub-unit-rate').value = 1;
        
        // TỰ ĐỘNG LẤY GIÁ BÁN HIỆN TẠI: 
        // Dùng parseCurrency để làm sạch dấu chấm từ form chính rồi format lại cho modal mới[cite: 2]
        const mainPriceStr = document.getElementById('pm-price').value || "0";
        const mainPriceNum = window.parseCurrency(mainPriceStr);
        
        document.getElementById('sub-unit-price').value = mainPriceNum.toLocaleString('vi-VN');
        document.getElementById('sub-unit-sell').checked = true;
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
    const sellDirect = document.getElementById('sub-unit-sell').checked;

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

function generateVariants() {
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
        // 3. HIỂN THỊ: Ưu tiên mã riêng của đơn vị, nếu trống thì lấy luôn mã ngoài cùng
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
                        oninput="formatCurrency(this); currentProductUnits[${uIdx}].price = window.parseCurrency(this.value)" 
                        style="text-align:right; font-weight:bold; color:var(--kv-pink);">
                </td>
                <td style="text-align:center;">
                    <i class="fa-solid fa-trash-can" style="color:#888; cursor:pointer;" 
                        onclick="currentProductUnits.splice(${uIdx}, 1); renderUnitAttrUI();"></i>
                </td>
            </tr>
        `;
    });
}

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
        // Dọn dẹp ký tự ẩn của Apple và cắt bằng biểu thức \s+ (mọi loại khoảng trắng)
        const cleanStr = timeStr.replace(/[\u200E\u200F\u202F\u00A0]/g, ' ');
        const parts = cleanStr.replace(/,/g, '').trim().split(/\s+/);
        let dateStr = parts.find(p => p.includes('/')); 
        if (!dateStr) return 0;
        const dateParts = dateStr.split('/');
        return new Date(dateParts[2], dateParts[1] - 1, dateParts[0]).getTime();
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

    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';
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

    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';
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

        const index = allImports.findIndex(imp => imp.id === impId);
        if (index !== -1 && allImports[index].status !== 'cancel') {
            const imp = allImports[index];
            
            // 1. Trừ tồn kho (vì trước đó đã nhập vào)
            imp.items.forEach(item => {
                let p = products.find(x => x.id === item.productId || x.code === item.code);
                if (p) {
                    const rate = item.units && item.units[item.selectedUnitIdx] ? item.units[item.selectedUnitIdx].rate : 1;
                    p.stock = (parseFloat(p.stock) || 0) - (parseFloat(item.qty) * rate);
                }
            });

            // 2. Đổi trạng thái phiếu
            allImports[index].status = 'cancel';

            // 3. LƯU VÀ ĐỒNG BỘ CLOUD
            localStorage.setItem('kv_import_orders', JSON.stringify(allImports));
            localStorage.setItem('kv_products', JSON.stringify(products));
            
            if (typeof window.uploadToCloud === 'function') {
                window.uploadToCloud('import_orders', allImports);
                window.uploadToCloud('products', products);
            }
            
            showToast("Đã hủy phiếu nhập hàng", "success");
            renderImportOrders();
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

window.searchIOProduct = function(keyword) {
    const dropdown = document.getElementById('io-search-dropdown');
    if (!keyword || !keyword.trim()) { 
        dropdown.style.display = 'none'; 
        return; 
    }
    
    const rawKw = keyword.toLowerCase().trim();
    // Khử dấu tiếng Việt để tìm kiếm thông minh
    const cleanKw = window.removeVietnameseTones ? window.removeVietnameseTones(rawKw) : rawKw;
    const searchTerms = cleanKw.split(/\s+/);

    // Luôn lấy dữ liệu tươi nhất từ bộ nhớ và lọc theo chi nhánh
    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';
    const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];

    // 1. CHẾ ĐỘ QUÉT MÃ VẠCH (Khớp 100% mã hàng hoặc mã vạch)
    let exactMatch = null;
    for (let p of latestProducts) {
        if (p.branchId !== currentBranch) continue;
        
        // Xét lớp ngoài
        if ((p.barcode && p.barcode.toLowerCase() === rawKw) || (p.code && p.code.toLowerCase() === rawKw)) {
            exactMatch = p; 
            break;
        }
        // Xét các đơn vị tính
        if (p.units) {
            let uMatch = p.units.find(u => (u.barcode && u.barcode.toLowerCase() === rawKw) || (u.code && u.code.toLowerCase() === rawKw));
            if (uMatch) { exactMatch = p; break; }
        }
    }

    // Nếu là máy quét mã vạch -> Bắn thẳng vào phiếu nhập, không cần hiện danh sách
    if (exactMatch) {
        window.addIOToList(exactMatch.id);
        document.getElementById('io-search-input').value = '';
        dropdown.style.display = 'none';
        return;
    }

    // 2. CHẾ ĐỘ TÌM KIẾM TƯƠNG ĐỐI (Gõ chữ)
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

    // Lọc trùng lặp do 1 sản phẩm có thể có nhiều đơn vị tính khớp điều kiện
    results = results.filter((v, i, a) => a.findIndex(t => (t.id === v.id)) === i);

    // 3. Hiển thị Dropdown
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
};

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
    localStorage.setItem('kv_pos_state', JSON.stringify({
        tabs: posTabs,
        activeIndex: activeTabIndex,
        counter: tabCounter
    }));
};

function initPOSData() {
    // 1. Hiển thị thông tin nhân viên và khởi động đồng hồ hệ thống
    if (currentUser) {
        // Lấy tên chi nhánh hiện tại từ sessionStorage và danh sách chi nhánh
        const currentBranchId = sessionStorage.getItem('kv_current_branch') || 'CN001'; //
        const allBranches = JSON.parse(localStorage.getItem('kv_branches')) || []; //
        const currentBranchObj = allBranches.find(b => b.id === currentBranchId); //[cite: 2]
        const branchName = currentBranchObj ? currentBranchObj.name : currentBranchId; //[cite: 2]

        const sellerNameEl = document.getElementById('pos-seller-name');
        if (sellerNameEl) {
            // Hiển thị cả Tên nhân viên và Tên chi nhánh ngay phía dưới
            sellerNameEl.innerHTML = `<i class="fa-solid fa-user-tie" style="color: #888; margin-right:5px;"></i> ${currentUser.fullname} <br><span style="font-size: 11px; color: var(--kv-pink);">📍 ${branchName}</span>`; //[cite: 2]
        }
        const userNameEl = document.getElementById('pos-user-name');
        if (userNameEl) userNameEl.innerText = currentUser.username; //[cite: 2]
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
    priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || []; //[cite: 2]
    const pbSelect = document.getElementById('pos-pricebook-select');
    if (pbSelect) {
        let pbHtml = `<option value="default">Bảng giá chung</option>`;
        priceBooks.forEach(pb => { 
            pbHtml += `<option value="${pb.id}">${pb.name}</option>`; 
        });
        pbSelect.innerHTML = pbHtml;
    }

    // 3. KHÔI PHỤC DỮ LIỆU POS (Xử lý chống lỗi F5 hiện lại đơn đã thanh toán)
    const savedStateStr = localStorage.getItem('kv_pos_state');
    
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
// Hàm cốt lõi: Tính toán và lấy giá chính xác của đơn vị tính trong Bảng giá
window.getProductPrice = function(productObj, priceBookId, unitIdx = 0) {
    // 1. Nếu là bảng giá chung (default)
    if (!priceBookId || String(priceBookId) === 'default') {
        if (productObj.units && productObj.units[unitIdx]) return productObj.units[unitIdx].price;
        return productObj.price || 0;
    }

    // 2. Nếu là Bảng giá tùy chỉnh (Giá đêm, giá VIP...)
    const latestPBs = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
    const pb = latestPBs.find(x => String(x.id) === String(priceBookId));

    if (pb && pb.prices) {
        // Ưu tiên 1: Tìm giá được thiết lập RIÊNG cho đơn vị tính này (VD: SP01_1)
        const exactKey = `${productObj.id}_${unitIdx}`;
        if (pb.prices[exactKey] !== undefined) return pb.prices[exactKey];

        // Ưu tiên 2: Không có giá riêng thì tìm giá cơ bản (SP01_0) rồi nhân tỷ lệ quy đổi
        let basePrice = pb.prices[`${productObj.id}_0`];
        if (basePrice === undefined) basePrice = pb.prices[productObj.id]; // Hỗ trợ dữ liệu cũ

        if (basePrice !== undefined) {
            const rate = (productObj.units && productObj.units[unitIdx]) ? (productObj.units[unitIdx].rate || 1) : 1;
            return basePrice * rate;
        }
    }

    // 3. Fallback: Nếu bảng giá không có thiết lập cho món này, lấy giá gốc
    if (productObj.units && productObj.units[unitIdx]) return productObj.units[unitIdx].price;
    return productObj.price || 0;
};
let currentFocus = -1; // Biến theo dõi vị trí đang chọn trong dropdown

window.searchPOSProduct = function(keyword) {
    const dropdown = document.getElementById('pos-search-dropdown');
    if (!keyword || !keyword.trim()) { 
        dropdown.style.display = 'none'; 
        return; 
    }
    
    // 1. Chuẩn hóa từ khóa
    const rawKw = keyword.toLowerCase().trim();
    const cleanKw = window.removeVietnameseTones(rawKw);
    const searchTerms = cleanKw.split(/\s+/);
    
    // 2. Lấy chi nhánh hiện tại từ phiên đăng nhập
    const currentBranch = sessionStorage.getItem('kv_current_branch');
    const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    let results = [];

    latestProducts.forEach(p => {
        // --- BỘ LỌC CHI NHÁNH QUAN TRỌNG ---
        if (p.branchId !== currentBranch) return; 

        // Chuẩn hóa dữ liệu gốc để so sánh
        const pName = window.removeVietnameseTones((p.name || "").toLowerCase());
        const pCode = (p.code || "").toLowerCase();
        const pBarcode = (p.barcode || "").toLowerCase();

        const checkMatch = (str) => {
            if (!str) return false;
            return searchTerms.every(term => str.includes(term));
        };

        const matchBase = checkMatch(pName) || checkMatch(pCode) || checkMatch(pBarcode);

        // Duyệt đơn vị tính
        if (p.units && p.units.length > 0) {
            p.units.forEach((unit, uIdx) => {
                const uCode = (unit.code || "").toLowerCase();
                const uBarcode = (unit.barcode || "").toLowerCase();
                
                if (matchBase || checkMatch(uCode) || checkMatch(uBarcode)) {
                    results.push({
                        ...p,
                        matchedUnitIdx: uIdx,
                        displayUnitName: unit.name,
                        displayPrice: unit.price || (p.price * unit.rate), 
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
    window.currentFocus = -1; // Reset vị trí chọn phím mũi tên
};

// Biến đồng hồ để gộp nhịp Enter
let fastEnterTimer = null;

document.getElementById('pos-search-input').addEventListener('keydown', function(e) {
    const dropdown = document.getElementById('pos-search-dropdown');
    const items = dropdown ? dropdown.querySelectorAll('.pos-item-node') : [];
    
    if (e.key === 'ArrowDown') {
        e.preventDefault(); currentFocus++; addActive(items);
    } else if (e.key === 'ArrowUp') {
        e.preventDefault(); currentFocus--; addActive(items);
    } else if (e.key === 'Enter') {
        e.preventDefault();
        
        if (dropdown && dropdown.style.display === 'block') {
            if (currentFocus > -1 && items.length > 0) items[currentFocus].click(); 
            else if (items.length > 0) items[0].click(); 
        } 
        else {
            const kw = this.value.trim().toLowerCase();
            if (!kw) return;
            handleDirectEnter(kw); // Chạy thẳng lập tức, không dùng setTimeout nữa
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

function handleDirectEnter(kw) {
    const currentBranch = sessionStorage.getItem('kv_current_branch');
    const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    let found = null;

    for (let p of latestProducts) {
        if (p.branchId !== currentBranch) continue; 
        if (p.code?.toLowerCase() === kw || p.barcode?.toLowerCase() === kw) {
            found = { id: p.id, uIdx: 0 }; 
            break;
        }
        if (p.units) {
            const uIdx = p.units.findIndex(u => u.barcode?.toLowerCase() === kw || u.code?.toLowerCase() === kw);
            if (uIdx !== -1) { 
                found = { id: p.id, uIdx: uIdx }; 
                break; 
            }
        }
    }

    if (found) {
        addPOSItem(found.id, true, found.uIdx);
        
        const searchInput = document.getElementById('pos-search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select(); // Bôi đen ngay lập tức (0ms)
        }
    } else {
        showToast("Không tìm thấy mã này tại chi nhánh hiện tại", "warning");
        document.getElementById('pos-search-input').value = "";
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

let isTabCreating = false; // Thêm biến này ở đầu file hoặc ngay trên hàm
window.addPOSTab = function() {
    if (isTabCreating) return;
    isTabCreating = true;

    // 1. Tìm tất cả các số thứ tự hiện có (ví dụ từ "Hóa đơn 1" lấy ra số 1)
    const existingNumbers = posTabs.map(tab => {
        const match = tab.name.match(/\d+/);
        return match ? parseInt(match[0]) : 0;
    }).sort((a, b) => a - b);

    // 2. Tìm số nhỏ nhất còn thiếu (bắt đầu từ 1)
    let nextNumber = 1;
    for (let i = 0; i < existingNumbers.length; i++) {
        if (existingNumbers[i] === nextNumber) {
            nextNumber++;
        } else if (existingNumbers[i] > nextNumber) {
            break; // Đã tìm thấy khoảng trống
        }
    }

    // 3. Tạo tab mới với số vừa tìm được
    posTabs.push({ 
        id: Date.now(), 
        name: `Hóa đơn ${nextNumber}`, 
        items: [], 
        priceBook: 'default', 
        discount: 0, 
        extraFee: 0 
    });

    // 4. Chuyển sang tab mới và focus vào ô tìm kiếm
    switchPOSTab(posTabs.length - 1);
    savePOSState();
    if (typeof focusPOSSearch === 'function') focusPOSSearch();

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
        if (document.getElementById('pos-pricebook-select')) 
            document.getElementById('pos-pricebook-select').value = String(tab.priceBook);
        if (document.getElementById('pos-discount')) 
            document.getElementById('pos-discount').value = (tab.discount || 0).toLocaleString('vi-VN');
        if (document.getElementById('pos-extra-fee')) 
            document.getElementById('pos-extra-fee').value = (tab.extraFee || 0).toLocaleString('vi-VN');
    }

    renderPOSCart();
    savePOSState();
    
    // Đảm bảo cứ đổi tab là chuột nhảy về ô tìm kiếm
    focusPOSSearch();
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

window.addPOSItem = function(productId, keepInput = true, forcedUnitIdx = null) {
    const sInput = document.getElementById('pos-search-input');
    const dropdown = document.getElementById('pos-search-dropdown');
    
    if (dropdown) dropdown.style.display = 'none';
    
    const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];
    const p = allProds.find(x => String(x.id) === String(productId));
    if (!p) { showToast("Không tìm thấy hàng hóa!", "error"); return; }

    const tab = posTabs[activeTabIndex];
    if (!tab) return;

    const unitIdx = forcedUnitIdx !== null ? forcedUnitIdx : 0;
    const productUnits = (p.units && p.units.length > 0) ? p.units : [{ name: 'Cái', rate: 1, price: p.price, isBase: true }];
    const selectedUnit = productUnits[unitIdx];

    let finalPrice = 0;
    const currentPriceBookId = tab.priceBook || 'default';

    if (currentPriceBookId === 'default') {
        finalPrice = selectedUnit.price || (p.price * (selectedUnit.rate || 1));
    } else {
        const basePriceFromBook = getProductPrice(p, currentPriceBookId); 
        finalPrice = basePriceFromBook * (selectedUnit.rate || 1);
    }

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
    
    // TỐC ĐỘ BÀN THỜ: Bắt trình duyệt vẽ lại giỏ hàng NGAY LẬP TỨC 
    if (typeof renderPOSCart === 'function') renderPOSCart();

    if (sInput) {
        if (!keepInput) sInput.value = '';
        sInput.focus();
        sInput.select(); 
    }
};

window.renderPOSCart = function() {
    const listDiv = document.getElementById('pos-cart-list');
    const tab = posTabs[activeTabIndex];
    if (!listDiv || !tab) return;
    
    const isFeatureEnabled = document.getElementById('enable-beer-ice')?.checked;
    const currentBranch = sessionStorage.getItem('kv_current_branch');

    if (tab.items.length === 0) {
        listDiv.innerHTML = `<div style="text-align:center; margin-top:50px; color:#ccc;">Hóa đơn trống</div>`;
        if (typeof calcPOSTotals === 'function') calcPOSTotals();
        return;
    }

    // Lấy danh sách sản phẩm mới nhất để check tồn kho
    const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];

    listDiv.innerHTML = tab.items.map((item, index) => {
        const rowTotal = item.qty * item.price;
        
        // Tìm sản phẩm gốc và phải khớp đúng chi nhánh
        const pOriginal = allProds.find(x => x.id === item.productId && x.branchId === currentBranch);
        const currentStock = pOriginal ? (parseFloat(pOriginal.stock) || 0) : 0;
        
        let unitOptions = item.units.map((u, idx) => 
            `<option value="${idx}" ${item.selectedUnitIdx === idx ? 'selected' : ''}>${u.name}</option>`
        ).join('');

        const iceCheckboxHtml = isFeatureEnabled ? 
            `<div style="width: 35px; text-align: center;">
                <input type="checkbox" ${item.isIce ? 'checked' : ''} onchange="toggleBeerIce(${index}, this.checked)" style="width: 17px; height: 17px; cursor: pointer; accent-color: #00bcd4;">
            </div>` : '';

        return `
        <div class="cart-item-row" style="display: flex; align-items: center; padding: 12px 20px; border-bottom: 1px solid #f4f4f4; font-size: 14px;">
            <div style="width: 35px; text-align:center; color: #aaa; font-size: 12px;">${index + 1}</div>
            ${iceCheckboxHtml}
            <div style="flex: 1; min-width: 0; padding-right: 10px;">
                <div style="color: var(--kv-pink); font-weight: 600; font-size: 13px;">${item.code}</div>
                <div style="font-weight: 500;">
                    ${item.name} ${item.isIce ? '<i class="fa-solid fa-snowflake" style="color: #00bcd4; font-size: 11px;"></i>' : ''}
                </div>
                <div style="font-size: 11px; margin-top: 2px; color:#888;">Tồn chi nhánh: ${currentStock}</div>
            </div>
            <div style="width: 90px;"><select onchange="updatePOSUnit(${index}, this.value)" style="width: 100%; border: 1px solid #eee; padding: 5px; border-radius: 4px;">${unitOptions}</select></div>
            <div style="width: 100px; display: flex; align-items: center; justify-content: center;">
                <button type="button" onclick="window.updatePOSQty(${index}, ${item.qty - 1})" style="width: 28px; height: 30px; border: 1px solid #ddd; background: #fdfdfd; border-radius: 4px 0 0 4px; cursor: pointer; color: #555; font-weight: bold; border-right: none; font-size: 16px;">-</button>
                
                <input type="text" value="${item.qty}" class="pos-qty-input" 
                    oninput="this.value = this.value.replace(/[^0-9]/g, ''); window.updatePOSQty(${index}, this.value, true)" 
                    style="width: 44px; height: 30px; text-align: center; border: 1px solid #ddd; padding: 0; font-weight: bold; outline: none; border-radius: 0; font-size: 14px; box-sizing: border-box;">
                
                <button type="button" onclick="window.updatePOSQty(${index}, ${item.qty + 1})" style="width: 28px; height: 30px; border: 1px solid #ddd; background: #fdfdfd; border-radius: 0 4px 4px 0; cursor: pointer; color: #555; font-weight: bold; border-left: none; font-size: 14px;">+</button>
            </div>
            <div style="width: 110px; text-align: right;">${item.price.toLocaleString('vi-VN')}</div>
            
            <div id="pos-row-total-${index}" style="width: 110px; text-align: right; font-weight: bold; color: var(--kv-blue);">${rowTotal.toLocaleString('vi-VN')}</div>
            
            <div style="width: 35px; text-align: right;"><i class="fa-solid fa-trash-can" style="color: #ccc; cursor: pointer;" onclick="window.removePOSItem(${index})"></i></div>
        </div>`;
    }).join('');

    if (typeof calcPOSTotals === 'function') calcPOSTotals();
};

window.removePOSItem = function(index) { 
    if (posTabs[activeTabIndex] && posTabs[activeTabIndex].items[index]) {
        posTabs[activeTabIndex].items.splice(index, 1); 
        renderPOSCart(); 
        savePOSState(); 
    }
};

window.updatePOSQty = function(index, val, isRealTime = false) {
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
        // [CẬP NHẬT TỨC THỜI] Chỉ tính lại tiền của dòng này và gắn lên màn hình
        // Không tải lại toàn bộ bảng để tránh bị mất con trỏ chuột khi đang gõ
        const rowTotal = tab.items[index].qty * tab.items[index].price;
        const rowTotalEl = document.getElementById(`pos-row-total-${index}`);
        if (rowTotalEl) rowTotalEl.innerText = rowTotal.toLocaleString('vi-VN');
        
        // Gọi hàm tính tổng tiền của cả hóa đơn (Hàm này cũng chạy ngầm không load lại trang)
        if (typeof calcPOSTotals === 'function') calcPOSTotals();
    } else {
        // Nếu bấm bằng nút [+] [-] thì cứ tải lại bảng bình thường
        renderPOSCart();
    }
};
window.updatePOSUnit = function(index, unitIdx) {
    const tab = posTabs[activeTabIndex];
    const item = tab.items[index];
    item.selectedUnitIdx = parseInt(unitIdx);

    // Lấy lại sản phẩm gốc từ database để gọi hàm lấy giá
    const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];
    const prod = allProds.find(p => p.id === item.productId);

    if (prod) {
        item.price = window.getProductPrice(prod, tab.priceBook, item.selectedUnitIdx);
    }

    renderPOSCart();
    savePOSState();
};
function calcPOSTotals() {
    const tab = posTabs[activeTabIndex];
    if(!tab) return;
    
    const isFeatureEnabled = document.getElementById('enable-beer-ice')?.checked;
    let totalQty = 0, totalGoods = 0;
    tab.items.forEach(item => { totalQty += item.qty; totalGoods += (item.qty * item.price); });

    // Tính tiền lạnh (chỉ tính nếu bật nút gạt)
    const iceAmount = isFeatureEnabled ? calculateManualBeerIce() : 0;
    const iceDisplay = document.getElementById('pos-beer-ice-amount');
    if (iceDisplay) iceDisplay.innerText = iceAmount.toLocaleString('vi-VN');

    tab.discount = window.parseCurrency(document.getElementById('pos-discount').value) || 0;
    tab.extraFee = window.parseCurrency(document.getElementById('pos-extra-fee').value) || 0;
    
    // Tổng thanh toán = Tiền hàng - Giảm giá + Phí khác + Tiền bia lạnh (nếu có)
    const mustPay = totalGoods - tab.discount + tab.extraFee + iceAmount;

    document.getElementById('pos-total-qty').innerText = totalQty;
    document.getElementById('pos-total-goods').innerText = totalGoods.toLocaleString('vi-VN');
    document.getElementById('pos-total-goods').dataset.val = totalGoods;
    document.getElementById('pos-must-pay').innerText = mustPay.toLocaleString('vi-VN');
}

window.changePOSPriceBook = function(pbId) {
    const tab = posTabs[activeTabIndex];
    tab.priceBook = pbId;
    tab.items.forEach(item => {
        const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];
        const prod = allProds.find(p => p.id === item.productId);
        if (prod) {
            item.basePrice = window.getProductPrice(prod, pbId, 0);
            item.price = window.getProductPrice(prod, pbId, item.selectedUnitIdx);
        }
    });
    renderPOSCart();
    savePOSState();
};

window.processCheckout = function() {
    const tab = posTabs[activeTabIndex];
    if (!tab || tab.items.length === 0) { 
        showToast("Giỏ hàng trống!", "error"); 
        return; 
    }

    // Xác định chi nhánh hiện tại từ phiên đăng nhập
    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';
    const latestProds = JSON.parse(localStorage.getItem('kv_products')) || [];
    const totalAmount = parseFloat(document.getElementById('pos-total-goods').dataset.val) || 0;
    
    // Tính toán tiền bia lạnh nếu có tính năng này[cite: 2]
    const isFeatureEnabled = document.getElementById('enable-beer-ice')?.checked;
    const iceAmount = isFeatureEnabled ? calculateManualBeerIce() : 0;
    
    const mustPay = totalAmount - (tab.discount || 0) + (tab.extraFee || 0) + iceAmount;
    
    const newInvoice = {
        id: 'HD' + Date.now().toString().slice(-6),
        branchId: currentBranch, // LƯU MÃ CHI NHÁNH VÀO HÓA ĐƠN[cite: 2]
        createdAt: new Date().toLocaleString('vi-VN'),
        items: JSON.parse(JSON.stringify(tab.items)),
        totalAmount: totalAmount,
        invoiceDiscount: tab.discount || 0,
        extraFee: tab.extraFee || 0,
        beerIceAmount: iceAmount,
        beerIceNote: tab.beerIceNote || "",
        customerPaid: mustPay,
        creator: currentUser.fullname,
        status: 'done'
    };

    // 1. Trừ tồn kho[cite: 2]
    tab.items.forEach(cartItem => {
        const prod = latestProds.find(p => p.id === cartItem.productId);
        if (prod) {
            const rate = cartItem.units[cartItem.selectedUnitIdx]?.rate || 1;
            prod.stock -= (cartItem.qty * rate);
        }
    });

    let allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    allInvoices.unshift(newInvoice);

    // 2. Lưu dữ liệu cục bộ và đồng bộ Cloud[cite: 2]
    localStorage.setItem('kv_products', JSON.stringify(latestProds));
    localStorage.setItem('kv_invoices', JSON.stringify(allInvoices));

    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('invoices', allInvoices);
        window.uploadToCloud('products', latestProds);
    }
    
    // 3. Xử lý in hóa đơn và thông báo[cite: 2]
    if (window.autoPrintMode) {
        window.printReceipt(newInvoice);
    } else {
        showToast("Thanh toán thành công!", "success");
    }
    
    // 4. Dọn dẹp Tab sau khi thanh toán[cite: 2]
    posTabs.splice(activeTabIndex, 1); 

    if (posTabs.length === 0) {
        window.clearPOS();
    } else {
        activeTabIndex = Math.max(0, posTabs.length - 1);
        switchPOSTab(activeTabIndex);
        window.savePOSState();
    }
    
    focusPOSSearch();
    setTimeout(() => {
        const searchInput = document.getElementById('pos-search-input');
        if (searchInput) searchInput.value = '';
    }, 200);
};
window.clearPOS = function() {
    // 1. Reset về 1 tab trống duy nhất
    tabCounter = 1;
    posTabs = [{ 
        id: Date.now(), 
        name: 'Hóa đơn 1', 
        items: [], 
        priceBook: 'default', 
        discount: 0, 
        extraFee: 0 
    }];
    activeTabIndex = 0;

    // 2. XÓA SẠCH DỮ LIỆU TẠM TRONG MÁY
    localStorage.removeItem('kv_pos_state');

    // 3. Vẽ lại giao diện trắng
    renderPOSTabs();
    renderPOSCart();
    
    // Đưa các ô nhập giảm giá/phí về 0
    if (document.getElementById('pos-discount')) document.getElementById('pos-discount').value = '0';
    if (document.getElementById('pos-extra-fee')) document.getElementById('pos-extra-fee').value = '0';

    console.log("🧹 Đã dọn sạch bộ nhớ POS.");
};



function togglePOSMenu() {
    const menu = document.getElementById('pos-hamburger-menu');
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
}

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
    // Tìm hóa đơn trong dữ liệu
    const inv = invoices.find(x => x.id === invId);
    if (!inv) return;

    // Tạo nội dung HTML để in
    let printHTML = `
        <div style="width: 80mm; font-family: sans-serif; padding: 10px;">
            <h2 style="text-align: center;">226 POS</h2>
            <p style="text-align: center;">Mã HD: ${inv.id}</p>
            <hr>
            <table style="width: 100%; font-size: 12px;">
                ${inv.items.map(i => `
                    <tr>
                        <td>${i.name} x${i.qty}</td>
                        <td style="text-align: right;">${(i.qty * i.price).toLocaleString()}</td>
                    </tr>
                `).join('')}
            </table>
            <hr>
            <p>Khách cần trả: <strong>${((inv.totalAmount || 0) - (inv.invoiceDiscount || 0)).toLocaleString()}</strong></p>
            <p style="text-align: center; font-size: 10px;">Cảm ơn quý khách!</p>
        </div>
    `;

    const win = window.open('', '_blank');
    win.document.write(printHTML);
    win.document.close();
    win.print();
    win.close();
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
            .then(() => showToast(`Đã đồng bộ ${path} lên Cloud thành công`, "success"))
            .catch((err) => showToast("Lỗi Firebase: " + err.message, "error"));
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
    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001'; // Lấy chi nhánh hiện tại[cite: 8]
    
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
    
    // 1. Lấy danh sách nhân viên để nạp vào bộ lọc
    const sellerSelect = document.getElementById('report-seller-filter');
    const allAccounts = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    let sellerHtml = '<option value="all">Tất cả nhân viên</option>';
    allAccounts.forEach(acc => {
        sellerHtml += `<option value="${acc.fullname}">${acc.fullname} (${acc.username})</option>`;
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

        // Lọc theo nhân viên
        if (seller !== 'all' && inv.creator !== seller.split(' (')[0]) return;

        // Xử lý chuỗi thời gian
        let invDateStr = '';
        const dateMatch = inv.createdAt.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (dateMatch) {
            const d = dateMatch[1].padStart(2, '0');
            const m = dateMatch[2].padStart(2, '0');
            const y = dateMatch[3];
            
            if (type === 'day') invDateStr = `${y}-${m}-${d}`;
            else if (type === 'month') invDateStr = `${y}-${m}`;
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
        html = `<tr><td colspan="6" style="text-align:center; padding: 40px; color: #888;">Không có giao dịch bán hàng nào khớp với điều kiện lọc</td></tr>`;
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
    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';

    const extractDate = (timeStr) => {
        if (!timeStr) return null;
        const match = timeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (match) return { d: parseInt(match[1]), m: parseInt(match[2]), y: parseInt(match[3]) };
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

    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';
    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    const allImportOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
    const allInventoryChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];

    let activities = [];
const parseVNTime = (timeStr) => {
    if(!timeStr) return 0;
    
    // Dọn dẹp ký tự ẩn
    const cleanStr = timeStr.replace(/[\u200E\u200F\u202F\u00A0]/g, ' ');
    const parts = cleanStr.replace(/,/g, '').trim().split(/\s+/);
    
    // Tìm kiếm cụm giờ và cụm ngày bất chấp thứ tự do Safari đảo lộn
    const timeStrPart = parts.find(p => p.includes(':')) || '00:00:00';
    const dateStrPart = parts.find(p => p.includes('/')) || '01/01/2000';
    
    const timeParts = timeStrPart.split(':');
    const dateParts = dateStrPart.split('/');
    
    return new Date(dateParts[2], dateParts[1]-1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]||0).getTime();
};

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

// ==========================================
// HỆ THỐNG PHÍM TẮT TOÀN CỤC (GLOBAL SHORTCUTS)
// ==========================================
// Hệ thống phím tắt toàn cục (Global Shortcuts)
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
        
        switch (e.key) {
            case 'F1':
    e.preventDefault();
    e.stopImmediatePropagation();
    addPOSTab();
    // Hàm addPOSTab đã có focusPOSSearch bên trong nên không cần gọi lại ở đây
    break;

case 'F2':
    e.preventDefault();
    // Đảo trạng thái bật/tắt[cite: 2]
    window.autoPrintMode = !window.autoPrintMode; 
    
    // Hiện thông báo nhanh để bạn biết đã thao tác thành công[cite: 2]
    if (window.autoPrintMode) {
        showToast("Đã BẬT chế độ tự động in hóa đơn", "success");
    } else {
        showToast("Đã TẮT chế độ tự động in hóa đơn", "info");
    }
    
    // Cập nhật việc ẩn/hiện cái khung ở góc màn hình[cite: 2]
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
            case 'F9':
                e.preventDefault();
                if (typeof processCheckout === 'function') processCheckout();
                break;

            case 'Home':
                // Phím tắt nhảy xuống chỉnh số lượng hàng gần nhất (Như đã làm ở bước trước)
                e.preventDefault();
                const qtyInputs = document.querySelectorAll('.pos-qty-input');
                if (qtyInputs.length > 0) {
                    qtyInputs[0].focus();
                    qtyInputs[0].select();
                }
                break;
        }
    }

    // 4. Khi đang ở ô số lượng, nhấn Enter để quay lại ô tìm kiếm
    if (e.key === 'Enter' && e.target.classList.contains('pos-qty-input')) {
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
    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';
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
    
    // Bước 1: Lấy dữ liệu mới nhất từ LocalStorage (Nơi lưu tài khoản Admin bạn vừa tạo)
    const allAccounts = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    const allInventoryChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];

    // Bước 2: Gom tất cả tên từ 3 nguồn: Danh sách tài khoản Admin, Người bán hóa đơn, Người tạo phiếu kiểm
    const namesFromAcc = allAccounts.map(acc => acc.fullname);
    const namesFromInv = allInvoices.map(inv => inv.creator);
    const namesFromIC = allInventoryChecks.map(ic => ic.creator);
    
    // Bước 3: Gộp lại, loại bỏ tên trùng và các giá trị rỗng (Sử dụng Set)
    const uniqueCreators = [...new Set([...namesFromAcc, ...namesFromInv, ...namesFromIC])].filter(Boolean);
    
    // Ghi nhớ tên đang chọn hiện tại để không bị mất khi nạp lại
    const currentVal = select.value; 
    
    // Bước 4: Vẽ HTML cho Dropdown
    let html = '<option value="">Tất cả người tạo</option>';
    uniqueCreators.sort().forEach(name => {
        html += `<option value="${name}">${name}</option>`;
    });
    
    select.innerHTML = html;
    
    // Trả lại giá trị đang chọn nếu nó vẫn tồn tại
    if (currentVal && uniqueCreators.includes(currentVal)) {
        select.value = currentVal;
    }
};

window.initApp = function() {
    console.log("🚀 226 POS: Đang khởi tạo hệ thống và đồng bộ dữ liệu thời gian thực...");

    // 1. Cấu hình đồng bộ dữ liệu từ Firebase Cloud
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
                
                // Chuyển đổi dữ liệu Cloud sang Mảng chuẩn (Trị lỗi lủng mảng do xóa)
                let dataArray = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data).filter(Boolean)) : [];
                
                // XỬ LÝ ĐẶC BIỆT CHO TỪNG LOẠI DỮ LIỆU
                if (item.path === 'products') {
                    if (!window.isSyncLocked) { 
                        dataArray.forEach(p => { if (!p.branchId) p.branchId = 'CN001'; });
                        window.products = dataArray;
                        localStorage.setItem(item.storageKey, JSON.stringify(dataArray));
                        if (typeof renderProductList === 'function') renderProductList();
                    }
                }
                
if (item.path === 'pricebooks') window.priceBooks = dataArray;
                if (item.path === 'groups') window.productGroups = dataArray;
                if (item.path === 'branches') window.branches = dataArray;
                
                // ===============================================
                // LOGIC BẢO MẬT: XỬ LÝ TÀI KHOẢN (ĐỔI MK / BỊ XÓA)
                // ===============================================
                if (item.path === 'accounts') {
                    window.accounts = dataArray;
                    
                    // Nếu máy đang có người đăng nhập, tiến hành kiểm tra bảo mật
                    if (typeof currentUser !== 'undefined' && currentUser) {
                        // Tìm tài khoản này trong danh sách mới nhất từ Server
                        const updatedMe = dataArray.find(acc => acc.username === currentUser.username);
                        
                        if (!updatedMe) {
                            // Trường hợp 1: Tài khoản đã bị Admin xóa
                            alert("Tài khoản của bạn đã bị xóa khỏi hệ thống. Vui lòng liên hệ Quản lý!");
                            if (typeof logout === 'function') logout();
                        } 
                        else if (updatedMe.password !== currentUser.password) {
                            // Trường hợp 2: Mật khẩu đã bị Admin (hoặc người khác) thay đổi
                            alert("Mật khẩu của bạn vừa được thay đổi. Vui lòng đăng nhập lại bằng mật khẩu mới!");
                            if (typeof logout === 'function') logout();
                        } 
                        else {
                            // Trường hợp 3: Bình thường (Cập nhật ngầm thông tin quyền/chi nhánh mới nhất vào phiên làm việc)
                            currentUser = updatedMe;
                            localStorage.setItem('kv_current_user', JSON.stringify(currentUser));
                        }
                    }
                }

                // Lưu vào bộ nhớ máy (LocalStorage)
                localStorage.setItem(item.storageKey, JSON.stringify(dataArray));

                // 2. CẬP NHẬT GIAO DIỆN SAU KHI DỮ LIỆU VỀ (ĐÃ FIX TÊN TAB CHUẨN XÁC)
                const currentView = sessionStorage.getItem('kv_current_view');
                const currentTab = localStorage.getItem('kv_current_tab') || 'tab-tong-quan';

                if (currentView === 'pos-view') {
                    // Nếu đang ở màn hình bán hàng
                    if (item.path === 'products' && typeof renderPOSProducts === 'function') renderPOSProducts();
                    if (typeof renderPOSCart === 'function') renderPOSCart();
                } else if (currentView === 'dashboard-view') {
                    
                    // NẾU LÀ NHÓM HÀNG: Luôn vẽ lại thanh chọn và cây nhóm hàng ngay lập tức
                    if (item.path === 'groups') {
                        if (typeof window.renderGroupData === 'function') window.renderGroupData();
                    }

                    // Mapping đúng ID của các tab trong HTML
                    const tabMapping = {
                        'products': 'tab-danh-sach-hang',
                        'invoices': 'tab-hoa-don',
                        'import_orders': 'tab-nhap-hang',
                        'inventory_checks': 'tab-kiem-kho',
                        'pricebooks': 'tab-thiet-lap-gia'
                    };

                    // Kích hoạt vẽ lại Tab nếu dữ liệu tải về khớp với Tab đang mở
                    if (tabMapping[item.path] === currentTab || currentTab === 'tab-tong-quan') {
                        openDashTab(currentTab); 
                    }
                }
            });
        });
    }

    // 3. KHÔI PHỤC PHIÊN ĐĂNG NHẬP VÀ GIAO DIỆN
    const savedUser = localStorage.getItem('kv_current_user');
    const savedView = sessionStorage.getItem('kv_current_view'); 
    
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            
            if (currentUser.branchId) {
                sessionStorage.setItem('kv_current_branch', currentUser.branchId);
            }

            hideAll(); 

            if (savedView === 'pos-view') {
                const posView = document.getElementById('pos-view');
                if (posView) {
                    posView.style.display = 'flex';
                    if (typeof initPOSData === 'function') initPOSData();
                }
            } else if (savedView === 'admin-settings-view') {
                const adminView = document.getElementById('admin-settings-view');
                if (adminView) {
                    adminView.style.display = 'flex';
                    if (typeof switchAdminTab === 'function') switchAdminTab('list');
                }
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
            console.error("Lỗi khôi phục phiên:", e);
            localStorage.removeItem('kv_current_user');
            location.reload();
        }
    } else {
        hideAll();
        const loginView = document.getElementById('login-view');
        if (loginView) loginView.style.display = 'flex';
    }
    
    // 4. Cập nhật các bộ lọc sau 1 giây
    setTimeout(() => {
        if (typeof renderICCreatorFilter === 'function') renderICCreatorFilter();
        if (typeof renderInvCreatorFilter === 'function') renderInvCreatorFilter();
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
    const allAccs = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    const allInvs = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    const names = [...new Set([...allAccs.map(a => a.fullname), ...allInvs.map(i => i.creator)])].filter(Boolean);
    
    let html = '<option value="">Tất cả người bán</option>';
    names.sort().forEach(n => { if(n !== "1") html += `<option value="${n}">${n}</option>`; });
    select.innerHTML = html;
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
    const allAccs = JSON.parse(localStorage.getItem('kv_accounts')) || [];
    const allImps = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
    const names = [...new Set([...allAccs.map(a => a.fullname), ...allImps.map(i => i.creator)])].filter(Boolean);
    
    let html = '<option value="">Tất cả người tạo</option>';
    names.sort().forEach(n => { if(n !== "1") html += `<option value="${n}">${n}</option>`; });
    select.innerHTML = html;
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
    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';

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

    showConfirm(`Bạn sắp cập nhật dữ liệu cho ${updateIds.length} mặt hàng. Bạn có chắc chắn?`, function() {
        let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        
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
                    // SỬA LỖI Ở ĐÂY: Thêm [attr] để trích xuất đúng giá trị chữ/số bên trong, 
                    // thay vì lấy cả cục Object gây lỗi [object Object]
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
// Hàm hỗ trợ copy chéo dữ liệu hàng loạt (Từ Mã vạch -> Mã hàng và ngược lại)
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
            nextInput.focus();   // Trỏ chuột vào ô dưới
            nextInput.select();  // Tự động bôi đen để gõ đè số luôn cho nhanh
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
const searchInputs = [
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
    <div id="custom-confirm" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 9999;">
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

// Hàm tính toán số tiền lạnh dựa trên các món được tích
// Hàm tính toán số tiền lạnh bằng cách CỘNG DỒN TỔNG số lượng các món được tick
function calculateManualBeerIce() {
    const tab = posTabs[activeTabIndex];
    if (!tab) return 0;

    let totalBeerQty = 0;
    let details = [];

    // Bước 1: Duyệt qua giỏ hàng để cộng dồn tổng số lượng của các món được tick
    tab.items.forEach(item => {
        if (item.isIce) {
            totalBeerQty += (parseFloat(item.qty) || 0); // Cộng dồn số lượng
            details.push(`${item.name} (${item.qty})`);
        }
    });

    // Bước 2: Tính tiền dựa trên TỔNG số lượng đã gom được
    // Ví dụ: 3 lon hàng 1 + 1 lon hàng 2 = 4 lon -> 4 / 2 = 2k[cite: 2]
    let totalIceMoney = Math.floor(totalBeerQty / 2) * 1000;

    // Lưu kết quả vào tab để in hóa đơn[cite: 2]
    tab.beerIceAmount = totalIceMoney;
    tab.beerIceNote = details.join(", ");
    
    return totalIceMoney;
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
        const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';
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
    // 1. Kiểm tra xem đây có phải là phiếu cũ đã hoàn thành không
    if (editingIOId) {
        const allImps = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
        const found = allImps.find(x => x.id === editingIOId);
        // Nếu phiếu đã hoàn thành (done) -> Thoát thẳng lập tức, không cưỡng chế lưu tạm
        if (found && found.status === 'done') {
            document.getElementById('import-order-view').style.display = 'none';
            currentIOItems = []; 
            window.currentIOItems = [];
            editingIOId = null;
            if (typeof clearIOState === 'function') clearIOState();
            return; 
        }
    }

    // 2. Logic xử lý cho phiếu mới hoặc phiếu tạm thông thường
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
    
    // LỚP BẢO VỆ MỚI: Chỉ khóa nếu phiếu đã HỦY. Phiếu 'done' vẫn cho phép chạy xuống dưới để cập nhật.
    if (editingIOId) {
        const existingOrder = allImportOrders.find(x => x.id === editingIOId);
        if (existingOrder && existingOrder.status === 'cancel') {
            if (typeof showToast === 'function') showToast("Phiếu này đã bị hủy, không thể thay đổi!", "error");
            else alert("Phiếu này đã bị hủy, không thể thay đổi!");
            return; 
        }
    }

    const totalAmountEl = document.getElementById('io-total-amount');
    const totalAmount = parseFloat(totalAmountEl ? totalAmountEl.dataset.val : 0) || 0;
    const ioId = document.getElementById('io-code').value;

    const ioData = {
        id: ioId,
        branchId: sessionStorage.getItem('kv_current_branch') || 'CN001',
        timestamp: editingIOId ? (allImportOrders.find(x => x.id === editingIOId)?.timestamp || Date.now()) : Date.now(),
        createdAt: editingIOId ? (allImportOrders.find(x => x.id === editingIOId)?.createdAt || new Date().toLocaleString('vi-VN')) : new Date().toLocaleString('vi-VN'),
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

        // BƯỚC QUAN TRỌNG NHẤT: Nếu sửa một phiếu đã HOÀN THÀNH trước đó, ta phải trừ ngược kho của dữ liệu cũ ra
        if (editingIOId) {
            const oldOrder = allImportOrders.find(x => x.id === editingIOId);
            if (oldOrder && oldOrder.status === 'done') {
                oldOrder.items.forEach(oldItem => {
                    const prod = latestProducts.find(p => p.id === oldItem.productId);
                    if (prod) {
                        const oldRate = (oldItem.units && oldItem.units[oldItem.selectedUnitIdx]) ? (oldItem.units[oldItem.selectedUnitIdx].rate || 1) : 1;
                        // Trả kho về trạng thái trước khi nhập phiếu này
                        prod.stock = (parseFloat(prod.stock) || 0) - (oldItem.qty * oldRate);
                    }
                });
            }
        }

        // BƯỚC TIẾP THEO: Cộng dồn số lượng mới từ phiếu vừa chỉnh sửa vào lại kho
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

    // Ghi đè hoặc chèn mới vào danh sách phiếu nhập
    if (editingIOId) {
        const idx = allImportOrders.findIndex(x => x.id === editingIOId);
        if (idx !== -1) allImportOrders[idx] = ioData;
    } else {
        allImportOrders.unshift(ioData);
    }

    localStorage.setItem('kv_import_orders', JSON.stringify(allImportOrders));
    if (window.uploadToCloud) window.uploadToCloud('import_orders', allImportOrders);

    // DỌN DẸP TRẠNG THÁI GIAO DIỆN
    currentIOItems = []; 
    window.currentIOItems = [];
    editingIOId = null; 

    const ioView = document.getElementById('import-order-view');
    if (ioView) ioView.style.display = 'none';

    if (typeof renderImportOrders === 'function') renderImportOrders();
    
    const msg = action === 'done' ? "Cập nhật phiếu và tồn kho thành công!" : "Đã lưu phiếu tạm.";
    if (typeof showToast === 'function') showToast(msg, "success");
    else alert(msg);
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
    const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';
    
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
// TÍNH NĂNG QUÉT MÃ VẠCH BẰNG CAMERA ĐIỆN THOẠI
// ==========================================
let html5QrcodeScanner = null;
let currentScanTarget = 'pos'; // Biến lưu vị trí đang yêu cầu quét (pos, import, check)

window.startBarcodeScanner = function(target = 'pos') {
    currentScanTarget = target;
    const scannerModal = document.getElementById('scanner-modal');
    
    // 1. Mở hộp thoại lên trước để trình duyệt vẽ khung
    if (scannerModal) {
        scannerModal.style.display = 'flex';
    }
    
    // 2. Delay 300ms để chống lỗi đen màn hình (của iOS)
    setTimeout(() => {
        // Dọn dẹp luồng camera cũ
        if (html5QrcodeScanner) {
            try { html5QrcodeScanner.clear(); } catch(e) {}
            html5QrcodeScanner = null;
        }

        html5QrcodeScanner = new Html5Qrcode("reader");
        
        // --- 3. CẤU HÌNH ĐỘ NÉT CAO (HD) ---
        const config = { 
            fps: 15, 
            qrbox: { width: 250, height: 150 },
            aspectRatio: 1.0,
            disableFlip: false,
            videoConstraints: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                // Bơm lệnh ép ống kính liên tục lấy nét
                advanced: [{ focusMode: "continuous" }]
            }
        };

        const handleCameraError = (err) => {
            let errorMsg = "Không thể mở Camera.";
            if (typeof err === 'string') errorMsg = err;
            else if (err && err.name) {
                if (err.name === 'NotAllowedError') errorMsg = "Vui lòng vào Cài đặt để cấp quyền Camera cho trang web.";
                else if (err.name === 'NotFoundError') errorMsg = "Không tìm thấy Camera trên thiết bị này.";
                else errorMsg = `Lỗi hệ thống: ${err.message || err.name}`;
            }
            alert("⚠️ " + errorMsg);
            stopBarcodeScanner();
        };
        
        // Hàm kích hoạt camera có cơ chế "Lùi một bước" nếu máy bị khắt khe
        const startScan = (cameraConfig) => {
            html5QrcodeScanner.start(
                cameraConfig, 
                config, 
                onScanSuccess, 
                onScanFailure
            ).catch(err => {
                // Nếu điện thoại từ chối lệnh ép lấy nét (OverconstrainedError), 
                // ta tự động gỡ lệnh đó ra và thử bật lại ngay lập tức
                if (err.name === 'OverconstrainedError' || err.name === 'ConstraintNotSatisfiedError') {
                    delete config.videoConstraints.advanced;
                    html5QrcodeScanner.start(cameraConfig, config, onScanSuccess, onScanFailure).catch(handleCameraError);
                } else {
                    handleCameraError(err);
                }
            });
        };

        // --- 4. TRÍCH XUẤT ĐÍCH DANH CAMERA CHÍNH (LOẠI BỎ ULTRAWIDE) ---
        Html5Qrcode.getCameras().then(devices => {
            if (devices && devices.length > 0) {
                // Chỉ lấy danh sách camera mặt sau
                let backCameras = devices.filter(c => c.label.toLowerCase().includes('back') || c.label.toLowerCase().includes('sau'));
                
                if (backCameras.length > 0) {
                    // Lọc TỪ CHỐI các camera chứa chữ "ultra" hoặc "wide" (Góc siêu rộng gây mờ)
                    let mainCam = backCameras.find(c => !c.label.toLowerCase().includes('ultra') && !c.label.toLowerCase().includes('wide'));
                    
                    // Nếu tìm được thì truyền ID vào, không thì lấy cái mặt sau đầu tiên
                    startScan(mainCam ? mainCam.id : backCameras[0].id);
                } else {
                    startScan({ facingMode: "environment" });
                }
            } else {
                startScan({ facingMode: "environment" });
            }
        }).catch(err => {
            // Nếu bị lỗi không lấy được danh sách, xài lệnh mặc định
            startScan({ facingMode: "environment" });
        });

    }, 300);
};
// 1. Thêm 2 biến này ở bên ngoài (gần chỗ khai báo let html5QrcodeScanner)
let lastScannedCode = "";
let scanCooldownTimer = null;

function onScanSuccess(decodedText, decodedResult) {
    const scannedCode = decodedText.trim();

    // --- CHỐNG QUÉT ĐÚP (DEBOUNCE) ---
    if (scannedCode === lastScannedCode) {
        return;
    }

    lastScannedCode = scannedCode;
    clearTimeout(scanCooldownTimer);
    scanCooldownTimer = setTimeout(() => {
        lastScannedCode = ""; 
    }, 1500);

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
        const currentBranch = sessionStorage.getItem('kv_current_branch') || 'CN001';
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

// Tắt Camera và ẩn hộp thoại một cách an toàn
window.stopBarcodeScanner = function() {
    const scannerModal = document.getElementById('scanner-modal');
    if (scannerModal) scannerModal.style.display = 'none';
    
    if (html5QrcodeScanner) {
        try {
            // Lấy trạng thái hiện tại của camera 
            // (2: Html5QrcodeScannerState.SCANNING - Đang chạy)
            // (3: Html5QrcodeScannerState.PAUSED - Đang tạm dừng)
            const state = (typeof html5QrcodeScanner.getState === 'function') ? html5QrcodeScanner.getState() : 0;
            
            if (state === 2 || state === 3) {
                // Nếu camera ĐANG CHẠY thì mới gọi lệnh tắt
                html5QrcodeScanner.stop().then(() => {
                    html5QrcodeScanner.clear();
                    html5QrcodeScanner = null;
                }).catch((err) => {
                    // Nuốt lỗi rác để tránh báo đỏ trên console
                    html5QrcodeScanner.clear();
                    html5QrcodeScanner = null;
                });
            } else {
                // Nếu camera chưa chạy hoặc đã tắt, chỉ cần dọn dẹp bộ nhớ
                html5QrcodeScanner.clear();
                html5QrcodeScanner = null;
            }
        } catch (error) {
            // Bắt mọi ngoại lệ để đảm bảo hệ thống không bao giờ bị văng
            try { html5QrcodeScanner.clear(); } catch(e) {}
            html5QrcodeScanner = null;
        }
    }
};

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
    const branches = JSON.parse(localStorage.getItem('kv_branches')) || [{ id: 'CN001', name: 'Chi nhánh 1' }];
    const sourceSelect = document.getElementById('copy-source-branch');
    const targetSelect = document.getElementById('copy-target-branch');
    
    let optionsHtml = '';
    branches.forEach(b => {
        optionsHtml += `<option value="${b.id}">${b.name} (${b.id})</option>`;
    });
    
    if (sourceSelect) sourceSelect.innerHTML = optionsHtml;
    if (targetSelect) targetSelect.innerHTML = optionsHtml;
    
    const modal = document.getElementById('copy-branch-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeCopyBranchModal = function() {
    const modal = document.getElementById('copy-branch-modal');
    if (modal) modal.style.display = 'none';
};

window.processCopyBranch = function() {
    const sourceId = document.getElementById('copy-source-branch').value;
    const targetId = document.getElementById('copy-target-branch').value;
    const keepStock = document.getElementById('copy-keep-stock').checked;
    
    if (sourceId === targetId) {
        showToast("Chi nhánh nguồn và đích không được giống nhau!", "warning");
        return;
    }
    
    showConfirm(`Bạn có chắc muốn nhân bản toàn bộ danh mục từ <b>${sourceId}</b> sang <b>${targetId}</b>?<br><br>Hệ thống sẽ sao chép: <b>Tên hàng, Đơn vị tính, Giá bán, Giá vốn và các Bảng giá đa cột</b>.`, function() {
        
        let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        let allPriceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
        
        // 1. Lọc ra các sản phẩm thuộc chi nhánh nguồn
        const sourceProducts = allProducts.filter(p => (p.branchId || 'CN001') === sourceId);
        
        if (sourceProducts.length === 0) {
            showToast("Chi nhánh nguồn không có mặt hàng nào để sao chép!", "warning");
            return;
        }
        
        let newProducts = [];
        let idMapping = {}; // Biến này dùng để đối chiếu ID cũ và ID mới (Phục vụ cho Bảng giá)
        
        // 2. Chép Hàng hóa và Đơn vị tính
        sourceProducts.forEach((p, index) => {
            // Tạo một bản sao hoàn toàn tách biệt khỏi bản cũ (Deep Copy)
            let newP = JSON.parse(JSON.stringify(p));
            
            // Tạo ID mới độc lập
            const newId = 'PROD' + Date.now() + '_' + index;
            idMapping[p.id] = newId; 
            
            newP.id = newId;
            newP.branchId = targetId; // Chuyển quyền sở hữu sang chi nhánh đích
            
            // Xử lý tồn kho
            if (!keepStock) {
                newP.stock = 0; 
            }
            
            newProducts.push(newP);
        });
        
        // 3. Xử lý "Bảng giá đa cột": Chép giá của ID cũ sang ID mới
        allPriceBooks.forEach(pb => {
            if (!pb.prices) return;
            
            // Lặp qua tất cả giá cũ của bảng giá này
            Object.keys(pb.prices).forEach(oldKey => {
                // Key của bảng giá có dạng: "PROD123" hoặc "PROD123_0" (Đơn vị tính)
                for (let oldId in idMapping) {
                    if (oldKey === oldId || oldKey.startsWith(oldId + '_')) {
                        const newKey = oldKey.replace(oldId, idMapping[oldId]);
                        pb.prices[newKey] = pb.prices[oldKey]; // Gán mức giá tương tự cho mã hàng mới
                    }
                }
            });
        });
        
        // 4. Gộp hàng cũ và hàng mới vào hệ thống
        allProducts = [...allProducts, ...newProducts];
        
        // 5. Lưu dữ liệu
        localStorage.setItem('kv_products', JSON.stringify(allProducts));
        localStorage.setItem('kv_pricebooks', JSON.stringify(allPriceBooks));
        
        window.products = allProducts;
        window.priceBooks = allPriceBooks;
        
        // 6. Đồng bộ lên Firebase Cloud
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', allProducts);
            window.uploadToCloud('pricebooks', allPriceBooks);
        }
        
        closeCopyBranchModal();
        showToast(`Đã sao chép thành công ${newProducts.length} mặt hàng sang chi nhánh đích!`, "success");
        
        // Cập nhật lại màn hình Admin để thấy số đếm tăng lên
        if (typeof renderBranchList === 'function') renderBranchList();
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
    if (_origSaveIC) _origSaveIC(action);
    if (typeof currentICItems !== 'undefined' && currentICItems.length === 0) {
        clearICState();
    }
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