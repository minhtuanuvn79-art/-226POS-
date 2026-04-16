// ==========================================
// 1. KHỞI TẠO DỮ LIỆU TỪ LOCALSTORAGE
// ==========================================

let accounts = JSON.parse(localStorage.getItem('kv_accounts')) || [];
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

// BIẾN CHO TÍNH NĂNG THIẾT LẬP GIÁ NHANH TRONG MODAL HÀNG HÓA
let tempPriceBookValues = {};
// Hàm tự động thêm dấu chấm khi gõ
window.formatCurrency = function(input) {
    let value = input.value.replace(/\D/g, ''); 
    if (value === '') {
        input.value = '0';
        return;
    }
    input.value = parseInt(value, 10).toLocaleString('vi-VN');
};
// Hàm kiểm tra xem tên hàng có chứa đầy đủ các ký tự viết tắt theo thứ tự không
window.fuzzyMatch = function(text, query) {
    text = text.toLowerCase();
    query = query.toLowerCase().split(' '); // Tách "aq 15" thành ["aq", "15"]
    
    // Kiểm tra xem tất cả các từ trong query có xuất hiện trong text không
    return query.every(word => text.includes(word));
};
// Quy đổi từ chuỗi "1.000" sang số 1000 để tính toán chính xác
window.parseCurrency = function(formattedString) {
    if (!formattedString) return 0;
    return parseFloat(formattedString.toString().replace(/\./g, '')) || 0;
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

function handleLogin(type) {
    const u = document.getElementById('login-user').value;
    const p = document.getElementById('login-pass').value;
    const err = document.getElementById('login-error');

    if(!u || !p) { err.style.display = 'block'; return; }

    const user = accounts.find(x => x.username === u && x.password === p);
    if(user) {
        err.style.display = 'none';
        currentUser = user;
        
        // LƯU TRẠNG THÁI ĐĂNG NHẬP ĐỂ CHỐNG F5
        localStorage.setItem('kv_current_user', JSON.stringify(currentUser));
        
        if(type === 'manage') {
            if(user.role === 'cashier') {
                alert("Nhân viên Thu ngân không có quyền vào trang Quản lý."); return;
            }
            localStorage.setItem('kv_current_view', 'dashboard-view');
            hideAll();
            document.getElementById('dashboard-view').style.display = 'flex';
            document.getElementById('dash-user-name').innerText = user.fullname;
            
            // Tự động mở lại tab đang xem dở
            const savedTab = localStorage.getItem('kv_current_tab') || 'tab-tong-quan';
            openDashTab(savedTab);
        } else {
            localStorage.setItem('kv_current_view', 'pos-view');
            hideAll();
            document.getElementById('pos-view').style.display = 'flex';
            document.getElementById('pos-user-name').innerText = user.fullname;
            initPOSData(); // <--- THÊM DÒNG NÀY VÀO
        }
    } else {
        err.style.display = 'block';
    }
}

function logout() {
    currentUser = null;
    // Xóa bộ nhớ trạng thái khi đăng xuất
    localStorage.removeItem('kv_current_user');
    localStorage.removeItem('kv_current_view');
    localStorage.removeItem('kv_current_tab');
    
    hideAll();
    document.getElementById('login-view').style.display = 'flex';
    document.getElementById('login-pass').value = '';
}

function switchToPOS() {
    localStorage.setItem('kv_current_view', 'pos-view');
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
    localStorage.setItem('kv_current_view', 'dashboard-view');
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
    document.getElementById('admin-tab-create').style.display = tabName === 'create' ? 'block' : 'none';
    document.getElementById('admin-tab-list').style.display = tabName === 'list' ? 'block' : 'none';
    document.getElementById('menu-tab-create').classList.toggle('active', tabName === 'create');
    document.getElementById('menu-tab-list').classList.toggle('active', tabName === 'list');
    if(tabName === 'list') renderAccountList();
}

function renderAccountList() {
    const tbody = document.getElementById('account-list-body');
    if(!tbody) return;
    tbody.innerHTML = '';
    accounts.forEach(acc => {
        const roleText = acc.role === 'manager' ? '<span style="color:var(--kv-blue); font-weight:bold;">Quản lý</span>' : 'Thu ngân';
        const disableDelete = acc.username === 'admin' ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : '';
        tbody.innerHTML += `
            <tr>
                <td>${acc.fullname}</td>
                <td><strong>${acc.username}</strong></td>
                <td>${roleText}</td>
                <td style="text-align: center;">
                    <button class="action-btn btn-edit" onclick="openEditModal('${acc.username}')"><i class="fa-solid fa-pen"></i></button>
                    <button class="action-btn btn-delete" onclick="deleteAccount('${acc.username}')" ${disableDelete}><i class="fa-solid fa-trash"></i></button>
                </td>
            </tr>
        `;
    });
}

function createAccount() {
    const fn = document.getElementById('new-fullname').value;
    const un = document.getElementById('new-username').value;
    const pw = document.getElementById('new-password').value;
    const ro = document.getElementById('new-role').value;

    if(!fn || !un || !pw) { alert("Vui lòng điền đủ thông tin!"); return; }
    if(accounts.find(x => x.username === un)) { alert("Tên đăng nhập đã tồn tại!"); return; }

    accounts.push({ fullname: fn, username: un, password: pw, role: ro });
    
    // 1. Lưu vào LocalStorage của máy
    localStorage.setItem('kv_accounts', JSON.stringify(accounts));
    
    // 2. THÊM DÒNG NÀY: Đồng bộ danh sách tài khoản lên Firebase Cloud
    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('accounts', accounts);
    }

    alert("Tạo tài khoản thành công!");
    
    document.getElementById('new-fullname').value = '';
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    switchAdminTab('list');
}

window.deleteAccount = function(username) {
    if(username === 'admin') { alert("Không thể xóa tài khoản Quản trị hệ thống!"); return; }
    
    showConfirm(`Xóa nhân viên: ${username}?`, function() {
        accounts = accounts.filter(acc => acc.username !== username);
        localStorage.setItem('kv_accounts', JSON.stringify(accounts));
        
        if (window.uploadToCloud) window.uploadToCloud('accounts', accounts);
        renderAccountList();
    });
};

let userEditing = null;
function openEditModal(username) {
    userEditing = accounts.find(acc => acc.username === username);
    if(!userEditing) return;
    document.getElementById('edit-username-display').innerText = userEditing.username;
    document.getElementById('edit-fullname').value = userEditing.fullname;
    document.getElementById('edit-password').value = userEditing.password;
    document.getElementById('edit-role').value = userEditing.role;
    document.getElementById('edit-role').disabled = (username === 'admin');
    document.getElementById('edit-account-modal').style.display = 'flex';
}

function closeEditModal() {
    document.getElementById('edit-account-modal').style.display = 'none';
    userEditing = null;
}

function saveEditAccount() {
    if(!userEditing) return;
    const fn = document.getElementById('edit-fullname').value;
    const pw = document.getElementById('edit-password').value;
    const ro = document.getElementById('edit-role').value;

    if(!fn || !pw) { alert("Tên và mật khẩu không được trống!"); return; }
    userEditing.fullname = fn;
    userEditing.password = pw;
    userEditing.role = ro;

    localStorage.setItem('kv_accounts', JSON.stringify(accounts));
    window.uploadToCloud('accounts', accounts);
    closeEditModal();
    renderAccountList();
}

// ==========================================
// 4. QUẢN LÝ TAB DASHBOARD
// ==========================================
/**
 * Hàm điều hướng các tab trong Dashboard và nạp dữ liệu tương ứng
 * @param {string} tabId - ID của tab cần mở (vd: 'tab-hoa-don', 'tab-danh-sach-hang')
 * @param {HTMLElement} navElement - Phần tử menu được click (không bắt buộc)
 */
function openDashTab(tabId, navElement = null) {
    // 1. Lưu trạng thái vào bộ nhớ
    localStorage.setItem('kv_current_tab', tabId);

    // 2. Cập nhật giao diện Menu (Active màu hồng)
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    if (navElement) {
        navElement.classList.add('active');
    } else {
        const activeNav = document.querySelector(`.nav-item[onclick*="${tabId}"]`) || 
                          document.querySelector(`.dropdown-menu li[onclick*="${tabId}"]`)?.closest('.nav-item');
        if (activeNav) activeNav.classList.add('active');
    }

    // 3. Hiển thị đúng vùng nội dung của Tab
    document.querySelectorAll('.tab-section').forEach(el => el.classList.remove('active'));
    const targetTab = document.getElementById(tabId);
    if (targetTab) targetTab.classList.add('active');

    // 4. Kích hoạt render dữ liệu tươi cho từng tab
    switch (tabId) {
        case 'tab-danh-sach-hang':
            renderProductList();
            break;
        case 'tab-thiet-lap-gia':
            renderPriceBookSidebar();
            renderPriceSetupTable();
            break;
        case 'tab-hoa-don':
            renderInvoices(); 
            window.renderInvCreatorFilter();
            break;
        case 'tab-nhap-hang':
            window.renderImpCreatorFilter(); // Nạp tên Admin vào dropdown người tạo phiếu nhập
            renderImportOrders();
            break;
        case 'tab-kiem-kho':
            // QUAN TRỌNG: Gọi nạp tên nhân viên Admin TRƯỚC KHI vẽ bảng
            if (typeof window.renderICCreatorFilter === 'function') window.renderICCreatorFilter(); 
            renderInventoryChecks();
            break;
        case 'tab-tong-quan':
            if (typeof window.renderDashboard === 'function') window.renderDashboard();
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

// Đảm bảo hàm này luôn được gọi trong initApp hoặc sau khi dán Excel
window.renderGroupData = function() {
    // 1. Vẽ lại cây danh mục ở Sidebar hàng hóa
    if (typeof window.renderSidebarGroups === 'function') {
        window.renderSidebarGroups();
    }
    // 2. Vẽ lại danh sách chọn (Select) trong Modal chi tiết
    if (typeof window.renderGroupSelects === 'function') {
        window.renderGroupSelects();
    }
};
// 1. Hàm đệ quy xây dựng HTML dạng chuỗi lồng nhau (Hỗ trợ đổ dữ liệu vào 2 tab độc lập)
window.renderSidebarGroups = function() {
    const container1 = document.getElementById('sidebar-group-list');
    const container2 = document.getElementById('sidebar-price-group-list');

    function buildTreeHTML(parentId, indent, prefix, cbClass) {
        const children = productGroups.filter(g => g.parentId === parentId);
        let html = '';
        
        children.forEach(child => {
            const hasChildren = productGroups.some(g => g.parentId === child.id);
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
    
    // Đổ dữ liệu vào Tab Hàng Hóa
    if (container1) container1.innerHTML = buildTreeHTML(null, 0, 'group', 'group-filter-cb');
    // Đổ dữ liệu vào Tab Thiết Lập Giá
    if (container2) container2.innerHTML = buildTreeHTML(null, 0, 'price-group', 'price-group-filter-cb');
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
    const pmGroup = document.getElementById('pm-group'); // Thanh chọn trong modal
    const parentGroup = document.getElementById('group-parent');
    
    if(!pmGroup && !parentGroup) return;

    // Lấy dữ liệu mới nhất từ bộ nhớ
    const currentGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
    let html = '<option value="">Chọn nhóm hàng</option>';

    // Hàm đệ quy để hiện nhóm đa cấp (có thụt lề cho đẹp)
    function renderSelectTree(parentId, prefix) {
        const children = currentGroups.filter(g => g.parentId === parentId);
        children.forEach(child => {
            html += `<option value="${child.id}">${prefix}${child.name}</option>`;
            renderSelectTree(child.id, prefix + '--- '); 
        });
    }
    renderSelectTree(null, '');

    if (pmGroup) pmGroup.innerHTML = html;
    if (parentGroup) parentGroup.innerHTML = html;
}

function openGroupModal(id = null) {
    editingGroupId = id;
    document.getElementById('group-modal').style.display = 'flex';
    renderGroupSelects();

    if(id) {
        document.getElementById('group-modal-title').innerText = 'Sửa nhóm hàng';
        const g = productGroups.find(x => x.id === id);
        document.getElementById('group-name').value = g.name;
        document.getElementById('group-parent').value = g.parentId || '';
        
        const options = document.getElementById('group-parent').options;
        
        function getDescendants(parentId) {
            let desc = [];
            const children = productGroups.filter(g => g.parentId === parentId);
            children.forEach(c => {
                desc.push(c.id);
                desc = desc.concat(getDescendants(c.id));
            });
            return desc;
        }
        
        const invalidParents = [id, ...getDescendants(id)];
        for(let i=0; i<options.length; i++) {
            if(invalidParents.includes(options[i].value)) {
                options[i].disabled = true; 
            }
        }
    } else {
        document.getElementById('group-modal-title').innerText = 'Tạo nhóm hàng';
        document.getElementById('group-name').value = '';
        document.getElementById('group-parent').value = '';
    }
}

function closeGroupModal() {
    document.getElementById('group-modal').style.display = 'none';
}

function saveGroup() {
    const name = document.getElementById('group-name').value.trim();
    const parentId = document.getElementById('group-parent').value;
    
    if(!name) { alert("Vui lòng nhập tên nhóm!"); return; }

    if(editingGroupId) {
        const g = productGroups.find(x => x.id === editingGroupId);
        if (g) {
            g.name = name;
            g.parentId = parentId || null;
        }
    } else {
        // Thêm vào biến toàn cục đang sử dụng
        productGroups.push({
            id: 'g_' + Date.now(),
            name: name,
            parentId: parentId || null
        });
    }

    // Cập nhật lại localStorage để đồng bộ nội bộ
    localStorage.setItem('kv_groups', JSON.stringify(productGroups));

    // Đẩy lên Firebase
    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('groups', productGroups);
    }

    closeGroupModal();
    renderGroupData(); 
    renderProductList(); 
    editingGroupId = null;
}

function deleteGroup(id) {
    if(productGroups.some(g => g.parentId === id)) {
        alert("Không thể xóa! Nhóm này đang chứa các nhóm con bên trong."); return;
    }
    if(confirm("Bạn có chắc chắn muốn xóa nhóm hàng này?")) {
        productGroups = productGroups.filter(g => g.id !== id);
        products.forEach(p => { if(p.group === id) p.group = ''; });
        
        localStorage.setItem('kv_products', JSON.stringify(products));
        localStorage.setItem('kv_groups', JSON.stringify(productGroups));
        
        // --- ĐỒNG BỘ CLOUD ---
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', products);
            window.uploadToCloud('groups', productGroups);
        }
        
        renderGroupData(); renderProductList();
    }
}

// ==========================================
// 6. QUẢN LÝ HÀNG HÓA
// ==========================================

function openAddProductModal() {
    editingProductId = null; 
    currentProductUnits = []; 
    currentVariants = []; 
    tempPriceBookValues = {}; // RESET BIẾN TẠM THIẾT LẬP GIÁ MỖI LẦN THÊM MỚI
    document.querySelector('.product-modal-header h3').innerText = 'Thêm hàng hóa';
    
    document.querySelectorAll('.product-modal-body input').forEach(input => {
        if(input.type === 'number') input.value = 0;
        else if(input.type === 'text') input.value = '';
    });
    document.getElementById('pm-group').value = '';
    document.getElementById('pm-sell-direct').checked = true;

    document.getElementById('add-product-modal').style.display = 'flex';
}

function closeAddProductModal() {
    document.getElementById('add-product-modal').style.display = 'none';
}

function openEditProductModal(id) {
    editingProductId = id;
    const p = products.find(x => x.id === id);
    if (!p) return;
    currentProductUnits = p.units || [];
    currentVariants = p.variants || [];

    // NẠP DỮ LIỆU TỪ BẢNG GIÁ VÀO BIẾN TẠM KHI MỞ SỬA (CHO MODAL THIẾT LẬP GIÁ NHANH)
    tempPriceBookValues = {};
    priceBooks.forEach(pb => {
        if (pb.prices && pb.prices[id] !== undefined) {
            tempPriceBookValues[pb.id] = pb.prices[id];
        }
    });

    document.querySelector('.product-modal-header h3').innerText = 'Sửa hàng hóa';
    document.getElementById('pm-code').value = p.code || '';
    document.getElementById('pm-barcode').value = p.barcode || '';
    document.getElementById('pm-name').value = p.name || '';
    document.getElementById('pm-group').value = p.group || '';
    document.getElementById('pm-cost').value = (p.cost || 0).toLocaleString('vi-VN');
document.getElementById('pm-price').value = (p.price || 0).toLocaleString('vi-VN');
    // (Đã bỏ VAT)
    document.getElementById('pm-stock').value = p.stock || 0;
    
    document.getElementById('pm-sell-direct').checked = p.sellDirect;
    document.getElementById('add-product-modal').style.display = 'flex';
}

window.saveProduct = function() {
    const name = document.getElementById('pm-name').value.trim();
    if (!name) { alert("Vui lòng nhập tên hàng!"); return; }

    const code = document.getElementById('pm-code').value.trim() || ('HH' + Date.now().toString().slice(-6));
    const cost = window.parseCurrency(document.getElementById('pm-cost').value);
    const price = window.parseCurrency(document.getElementById('pm-price').value);
    const stock = parseFloat(document.getElementById('pm-stock').value) || 0;

    const prodData = {
        id: editingProductId || ('ID' + Date.now()),
        code: code,
        barcode: document.getElementById('pm-barcode').value.trim(),
        name: name,
        cost: cost,
        price: price,
        stock: stock,
        group: document.getElementById('pm-group').value,
        sellDirect: document.getElementById('pm-sell-direct').checked,
        units: currentProductUnits.length > 0 ? currentProductUnits : [{ name: 'Cái', rate: 1, price: price, isBase: true }]
    };

    let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    if (editingProductId) {
        const idx = allProducts.findIndex(p => p.id === editingProductId);
        if (idx !== -1) allProducts[idx] = prodData;
    } else {
        allProducts.push(prodData);
    }

    localStorage.setItem('kv_products', JSON.stringify(allProducts));
    if (typeof window.uploadToCloud === 'function') window.uploadToCloud('products', allProducts);

    renderProductList();
    
    if (document.getElementById('pm-continue-add').checked) {
        openAddProductModal(); // Reset form để nhập tiếp
    } else {
        alert("Lưu thành công!");
        closeAddProductModal();
    }
};


function toggleProductDetail(id) {
    const row = document.getElementById(`detail-row-${id}`);
    document.querySelectorAll('tr[id^="detail-row-"]').forEach(el => {
        if (el.id !== `detail-row-${id}`) el.style.display = 'none';
    });
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

// 1. Khai báo biến toàn cục để lưu trạng thái trang (Đặt ở ngoài cùng, gần các biến let khác)
window.currentProductPage = 1;
const productsPerPage = 100; // Số lượng hiển thị tối đa trên 1 trang

window.renderProductList = function() {
    const tbody = document.getElementById('import-table-body'); 
    if (!tbody) return;
    
    // 1. Lấy dữ liệu mới nhất từ bộ nhớ
    const savedProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    const savedGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
    window.products = savedProducts;
    tbody.innerHTML = '';

    // 2. Lấy các thông số lọc từ giao diện
    const searchInput = document.getElementById('search-product-manage');
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const checkedGroupCbs = document.querySelectorAll('.group-filter-cb:checked');
    const selectedGroupIds = Array.from(checkedGroupCbs).map(cb => cb.value);

    const stockFilter = document.getElementById('stock-filter');
    const stockVal = stockFilter ? stockFilter.value : 'all';

    // 3. Logic lọc dữ liệu
    const filtered = window.products.filter(p => {
        // Lọc theo từ khóa (Mã, Tên, Mã vạch)
        const matchKw = (p.name || '').toLowerCase().includes(keyword) || 
                        (p.code || '').toLowerCase().includes(keyword) ||
                        (p.barcode || '').toLowerCase().includes(keyword);
        
        // Lọc theo Nhóm hàng
        let matchGroup = true;
        if (selectedGroupIds.length > 0) {
            matchGroup = selectedGroupIds.includes(p.group);
        }

        // Lọc theo Tồn kho
        let matchStock = true;
        const stockLevel = parseFloat(p.stock) || 0;

        if (stockVal === 'below_min') matchStock = (stockLevel <= 5);
        else if (stockVal === 'above_max') matchStock = (stockLevel > 100); 
        else if (stockVal === 'in_stock') matchStock = (stockLevel > 0);
        else if (stockVal === 'out_of_stock') matchStock = (stockLevel <= 0);
        else if (stockVal === 'custom') {
            const minInput = document.getElementById('stock-min');
            const maxInput = document.getElementById('stock-max');
            const minCondition = (minInput && minInput.value.trim() !== '') ? (stockLevel >= parseFloat(minInput.value)) : true;
            const maxCondition = (maxInput && maxInput.value.trim() !== '') ? (stockLevel <= parseFloat(maxInput.value)) : true;
            matchStock = minCondition && maxCondition;
        }

        return matchKw && matchGroup && matchStock;
    });

    // 4. Xử lý khi không có dữ liệu
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: 50px; color: #aaa;">Không tìm thấy hàng hóa phù hợp</td></tr>`;
        const paginationDiv = document.getElementById('product-pagination');
        if (paginationDiv) paginationDiv.innerHTML = '';
        if (typeof updateSelectedCount === 'function') updateSelectedCount(); 
        return;
    }

    // 5. Logic phân trang
    const productsPerPage = 100;
    const totalPages = Math.ceil(filtered.length / productsPerPage);
    if (window.currentProductPage > totalPages) window.currentProductPage = totalPages || 1;
    if (window.currentProductPage < 1) window.currentProductPage = 1;

    const startIndex = (window.currentProductPage - 1) * productsPerPage;
    const paginatedProducts = filtered.slice(startIndex, startIndex + productsPerPage);

    // 6. Vẽ dữ liệu ra bảng
    paginatedProducts.forEach((p) => {
        const stockLevel = parseFloat(p.stock) || 0;
        const isLowStock = stockLevel <= 5;
        const stockStyle = isLowStock ? 'color: #d9534f; font-weight: bold;' : '';
        
        // Dò tìm tên nhóm từ ID
        const groupObj = savedGroups.find(g => g.id === p.group);
        const groupName = groupObj ? groupObj.name : '<span style="color:#ccc">Chưa phân nhóm</span>';

        tbody.innerHTML += `
            <tr style="cursor:pointer; transition: 0.2s;">
                <td style="text-align: center;">
                    <input type="checkbox" class="product-item-check" data-id="${p.id}" onclick="updateSelectedCount()">
                </td>
                <td onclick="openEditProductModal('${p.id}')" style="color:var(--kv-blue); font-weight:bold;">${p.code || ''}</td>
                <td onclick="openEditProductModal('${p.id}')" style="color:#555;">${p.barcode || '---'}</td>
                <td onclick="openEditProductModal('${p.id}')">
                    <div style="font-weight: 500;">${p.name || ''}</div>
                    <div style="font-size: 11px; color: #888;"><i class="fa-solid fa-tag"></i> ${groupName}</div>
                </td>
                <td onclick="openEditProductModal('${p.id}')" style="text-align: right; color: var(--kv-pink); font-weight: bold;">${(p.price || 0).toLocaleString('vi-VN')}</td>
                <td onclick="openEditProductModal('${p.id}')" style="text-align: right; color: #555;">${(p.cost || 0).toLocaleString('vi-VN')}</td>
                <td onclick="openEditProductModal('${p.id}')" style="text-align: center; ${stockStyle}">
                    ${stockLevel} ${isLowStock ? '<i class="fa-solid fa-triangle-exclamation" title="Sắp hết hàng"></i>' : ''}
                </td>
                <td style="text-align: center;">
                    <button onclick="deleteProduct('${p.id}', '${p.name.replace(/'/g, "\\'")}')" style="background:none; border:none; color:#d9534f; cursor:pointer; padding:5px;">
                        <i class="fa-solid fa-trash-can"></i>
                    </button>
                </td>
            </tr>
        `;
    });

    // 7. Cập nhật phân trang và nút chức năng
    if (typeof window.renderPaginationControls === 'function') {
        window.renderPaginationControls('product-pagination', window.currentProductPage, totalPages, 'changeProductPage');
    }
    
    if (typeof updateSelectedCount === 'function') updateSelectedCount();
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
function renderPriceBookSidebar() {
    const tagContainer = document.getElementById('active-pricebook-tags');
    const select = document.getElementById('add-pricebook-select');
    
    if(!tagContainer || !select) return;

    tagContainer.innerHTML = '';
    activePriceBookIds.forEach(id => {
        const name = id === 'default' ? 'Bảng giá chung' : (priceBooks.find(pb => pb.id === id)?.name || 'Không rõ');
        tagContainer.innerHTML += `
            <div class="pb-tag">
                ${name.toUpperCase()} 
                ${id !== 'default' ? `<i class="fa-solid fa-xmark" onclick="removePriceBookFromView('${id}')" title="Đóng cột này"></i>` : ''}
            </div>
        `;
    });

    let optionsHtml = '<option value="">Thêm bảng giá vào góc nhìn...</option>';
    priceBooks.forEach(pb => {
        if (!activePriceBookIds.includes(pb.id)) {
            optionsHtml += `<option value="${pb.id}">${pb.name}</option>`;
        }
    });
    select.innerHTML = optionsHtml;
    select.value = '';
}

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

function savePriceBook() {
    const name = document.getElementById('pricebook-name').value.trim();
    if (!name) { alert("Vui lòng nhập tên bảng giá!"); return; }

    const newPb = {
        id: 'pb_' + Date.now(),
        name: name,
        prices: {} 
    };

    priceBooks.push(newPb);
    localStorage.setItem('kv_pricebooks', JSON.stringify(priceBooks));
    if (typeof window.uploadToCloud === 'function') window.uploadToCloud('pricebooks', priceBooks);
    closePriceBookModal();
    
    activePriceBookIds.push(newPb.id);
    renderPriceBookSidebar();
    renderPriceSetupTable();
}

window.currentPricePage = 1;

function renderPriceSetupTable() {
    const thead = document.querySelector('#price-setup-table thead');
    const tbody = document.querySelector('#price-setup-table tbody');
    if (!thead || !tbody) return;

    // 1. TẠO CỘT HEADER ĐỘNG
    let thHtml = `
        <tr>
            <th style="text-align: center; width: 60px;">STT</th>
            <th style="text-align: left; min-width: 120px;">Mã hàng</th>
            <th style="text-align: left; min-width: 130px;">Mã vạch</th>
            <th style="text-align: left; min-width: 250px;">Tên hàng</th>
            <th style="text-align: right;">Giá vốn</th>
            <th style="text-align: right;">Giá nhập cuối</th>
    `;
    activePriceBookIds.forEach(id => {
        const name = id === 'default' ? 'Bảng giá chung' : priceBooks.find(pb => pb.id === id)?.name;
        thHtml += `<th style="text-align: right; color: var(--kv-pink);">${name}</th>`;
    });
    thHtml += `</tr>`;
    thead.innerHTML = thHtml;

    // 2. LỌC VÀ TÌM KIẾM DỮ LIỆU
    const searchInput = document.getElementById('search-price-setup');
    const keyword = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const checkedGroupCbs = document.querySelectorAll('.price-group-filter-cb:checked');
    const selectedGroupIds = Array.from(checkedGroupCbs).map(cb => cb.value);
    const stockFilter = document.getElementById('price-stock-filter');
    const stockVal = stockFilter ? stockFilter.value : 'all';

    let filtered = products.filter(p => {
        const matchKw = (p.name || '').toLowerCase().includes(keyword) || 
                        (p.code || '').toLowerCase().includes(keyword) ||
                        (p.barcode || '').toLowerCase().includes(keyword);
        let matchGroup = true;
        if (selectedGroupIds.length > 0) matchGroup = selectedGroupIds.includes(p.group);

        let matchStock = true;
        const stockLevel = parseFloat(p.stock) || 0;
        if (stockVal === 'below_min') matchStock = (stockLevel <= 5); 
        else if (stockVal === 'above_max') matchStock = (stockLevel > 100); 
        else if (stockVal === 'in_stock') matchStock = (stockLevel > 0);
        else if (stockVal === 'out_of_stock') matchStock = (stockLevel <= 0);
        else if (stockVal === 'custom') {
            const minInput = document.getElementById('price-stock-min');
            const maxInput = document.getElementById('price-stock-max');
            const minCondition = (minInput && minInput.value.trim() !== '') ? (stockLevel >= parseFloat(minInput.value)) : true;
            const maxCondition = (maxInput && maxInput.value.trim() !== '') ? (stockLevel <= parseFloat(maxInput.value)) : true;
            matchStock = minCondition && maxCondition;
        }
        return matchKw && matchGroup && matchStock;
    });

    // 3. LOGIC PHÂN TRANG
    const productsPerPage = 100;
    const totalPages = Math.ceil(filtered.length / productsPerPage);
    if (currentPricePage > totalPages) currentPricePage = totalPages;
    if (currentPricePage < 1) currentPricePage = 1;

    const startIndex = (currentPricePage - 1) * productsPerPage;
    const endIndex = startIndex + productsPerPage;
    const paginatedProducts = filtered.slice(startIndex, endIndex);

    // 4. VẼ DỮ LIỆU RA BẢNG (KÈM MENU THIẾT LẬP NHANH)
    let tbHtml = '';
    paginatedProducts.forEach((p, index) => {
        const stt = startIndex + index + 1;
        
        tbHtml += `
            <tr style="border-bottom: 1px dashed #eee; transition: 0.2s;">
                <td style="text-align: center; color: #888; font-size: 12px;">${stt}</td>
                <td style="text-align: left;">${p.code || ''}</td>
                <td style="text-align: left; color:#555;">${p.barcode || '---'}</td>
                <td style="text-align: left; font-weight: bold; color: var(--kv-blue);">${p.name || ''}</td>
                <td style="text-align: right;">${(p.cost || 0).toLocaleString('vi-VN')}</td>
                <td style="text-align: right;">0</td>
        `;

        activePriceBookIds.forEach(id => {
            if (id === 'default') {
                tbHtml += `
                    <td style="text-align: right;">
                        <input type="text" value="${(p.price || 0).toLocaleString('vi-VN')}" 
                            oninput="formatCurrency(this)"
                            onchange="updateMainProductPrice('${p.id}', window.parseCurrency(this.value))"
                            onkeydown="moveNextOnEnter(event, this, 'price-col-default')"
                            class="price-col-default"
                            style="width: 100px; text-align: right; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; outline: none; transition: 0.2s;">
                    </td>`;
            } else {
                const pb = priceBooks.find(x => x.id === id);
                const pbPrice = pb && pb.prices[p.id] !== undefined ? pb.prices[p.id] : '';
                const displayPbPrice = pbPrice !== '' ? pbPrice.toLocaleString('vi-VN') : '';
                
                // Các biến cấu hình cho tính năng cộng giá
                const basePrice = p.price || 0;
                const inputId = `input-${id}-${p.id}`;

                tbHtml += `
                    <td style="text-align: right; position: relative;">
                        <input type="text" id="${inputId}" value="${displayPbPrice}" placeholder="${basePrice.toLocaleString('vi-VN')}"
                            oninput="formatCurrency(this)"
                            onchange="updatePriceBookValue('${id}', '${p.id}', this.value === '' ? '' : window.parseCurrency(this.value))"
                            onkeydown="moveNextOnEnter(event, this, 'price-col-${id}')"
                            onfocus="showQuickPriceMenu(this)"
                            onblur="hideQuickPriceMenu(this)"
                            class="price-col-${id}"
                            style="width: 100px; text-align: right; padding: 6px 10px; border: 1px solid #ddd; border-radius: 4px; outline: none; color: var(--kv-pink); font-weight: bold; transition: 0.2s;">
                        
                        <div class="quick-price-dropdown" style="display:none; position:absolute; top: 100%; right: 15px; background: white; border: 1px solid #ddd; border-radius: 4px; box-shadow: 0 4px 10px rgba(0,0,0,0.15); z-index: 100; width: 110px; flex-direction: column; overflow: hidden; margin-top: 2px;">
                            <div style="font-size: 10px; color: #888; text-align: center; padding: 5px; border-bottom: 1px solid #eee; background: #fafafa; font-weight: bold;">Cộng từ giá gốc</div>
                            ${[0, 1, 2, 3, 4, 5, 10].map(k => `
                                <div onmousedown="event.preventDefault(); applyQuickAdd(${basePrice}, ${k}, '${id}', '${p.id}', '${inputId}')" 
                                     onmouseover="this.style.background='#f0f7ff'" onmouseout="this.style.background='white'"
                                     style="padding: 6px 10px; font-size: 13px; cursor: pointer; text-align: right; border-bottom: 1px solid #eee; color: var(--kv-blue); font-weight: 500; background: white; transition: 0.1s;">
                                    + ${k}k
                                </div>
                            `).join('')}
                        </div>
                    </td>`;
            }
        });
        
        tbHtml += `</tr>`; 
    }); 

    tbody.innerHTML = tbHtml;
    renderPricePaginationControls(totalPages);
}
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

function updateMainProductPrice(productId, newPrice) {
    const pIndex = products.findIndex(x => x.id === productId);
    if(pIndex !== -1) {
        products[pIndex].price = parseFloat(newPrice) || 0;
        localStorage.setItem('kv_products', JSON.stringify(products));
        
        // --- ĐỒNG BỘ CLOUD ---
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', products);
        }
        
        renderProductList(); 
    }
}

function updatePriceBookValue(pbId, productId, newPrice) {
    // 1. Tìm bảng giá trong biến toàn cục
    const pb = priceBooks.find(x => x.id === pbId);
    if (pb) {
        if (!pb.prices) pb.prices = {}; // Đảm bảo object prices tồn tại
        
        if (newPrice === '' || newPrice === null) {
            delete pb.prices[productId]; 
        } else {
            pb.prices[productId] = parseFloat(newPrice);
        }
        
        // 2. Lưu vào bộ nhớ máy
        localStorage.setItem('kv_pricebooks', JSON.stringify(priceBooks));
        
        // 3. Đẩy lên Cloud ngay lập tức
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('pricebooks', priceBooks);
        }
    }
}

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

window.renderInventoryChecks = function() {
    const tbody = document.querySelector('#ic-list-table tbody');
    if (!tbody) return;

    // 1. Lấy thông số lọc từ giao diện
    const showTemp = document.getElementById('filter-ic-temp')?.checked;
    const showDone = document.getElementById('filter-ic-done')?.checked;
    const showCancel = document.getElementById('filter-ic-cancel')?.checked;
    const searchKw = (document.getElementById('search-ic')?.value || '').toLowerCase().trim();
    const creatorVal = (document.getElementById('filter-ic-creator')?.value || '');

    // 2. Tính toán thời gian lọc
    const dateType = document.querySelector('input[name="ic-date-type"]:checked')?.value || 'predefined';
    const predefinedVal = document.getElementById('ic-date-predefined')?.value || 'this_month';
    const fromDateVal = document.getElementById('ic-date-from')?.value;
    const toDateVal = document.getElementById('ic-date-to')?.value;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let fromTime = 0, toTime = Infinity;
    if (dateType === 'predefined') {
        if (predefinedVal === 'today') { fromTime = todayStart; toTime = todayStart + 86400000 - 1; }
        else if (predefinedVal === 'yesterday') { fromTime = todayStart - 86400000; toTime = todayStart - 1; }
        else if (predefinedVal === 'this_month') { fromTime = startMonth; toTime = now.getTime(); }
    } else {
        if (fromDateVal) fromTime = new Date(fromDateVal).getTime();
        if (toDateVal) toTime = new Date(toDateVal).getTime() + 86400000 - 1; 
    }

    // 3. Lọc dữ liệu
    let filtered = inventoryChecks.filter(ic => {
        if (ic.status === 'temp' && !showTemp) return false;
        if (ic.status === 'done' && !showDone) return false;
        if (ic.status === 'cancel' && !showCancel) return false;
        if (searchKw && !ic.code.toLowerCase().includes(searchKw)) return false;
        if (creatorVal && ic.creator !== creatorVal) return false;
        const icTime = parseInt(ic.id); 
        return !(icTime < fromTime || icTime > toTime);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:40px; color:#aaa;">Không tìm thấy phiếu kiểm kho nào</td></tr>`;
        return;
    }

    const itemsPerPage = 30;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (window.currentICPage - 1) * itemsPerPage;
    const paginatedICs = filtered.sort((a, b) => b.id - a.id).slice(startIndex, startIndex + itemsPerPage);

    tbody.innerHTML = paginatedICs.map(ic => {
        const timeStr = new Date(ic.id).toLocaleString('vi-VN');
        const isDone = ic.status === 'done';
        const isCancel = ic.status === 'cancel';
        const statusText = isDone ? 'Đã cân bằng kho' : (isCancel ? 'Đã hủy' : 'Phiếu tạm');
        const badgeClass = isDone ? 'badge-done' : (isCancel ? 'badge-cancel' : 'badge-temp');
        
        let totalRealQty = ic.items.reduce((s, i) => s + (parseFloat(i.realQty) || 0), 0);
        let totalSysStock = ic.items.reduce((a, b) => a + (parseFloat(b.sysStock) || 0), 0);
        let totalValueDiff = ic.items.reduce((s, i) => s + ((parseFloat(i.realQty) || 0) - (parseFloat(i.sysStock) || 0)) * (parseFloat(i.cost) || 0), 0);

        return `
            <tr onclick="toggleICDetail(${ic.id})" style="cursor:pointer; border-bottom: 1px solid #eee;">
                <td style="color:var(--kv-blue); font-weight:bold;">${ic.code}</td>
                <td>${timeStr}</td>
                <td>${isDone ? timeStr : '---'}</td>
                <td style="text-align:center;">${ic.items.length}</td>
                <td style="text-align:right;">${totalRealQty.toLocaleString()}</td>
                <td style="text-align:right;">${(totalRealQty - totalSysStock).toLocaleString()}</td>
                <td style="text-align:right; font-weight:bold; color: ${totalValueDiff < 0 ? 'red' : 'green'};">${totalValueDiff.toLocaleString()}</td>
            </tr>
            <tr id="ic-detail-${ic.id}" style="display:none;" class="io-detail-wrapper">
                <td colspan="7" style="padding: 20px; background: #f4f6f9;">
                    <div style="background: white; border-radius: 8px; border: 1px solid #ddd; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                        <div style="padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; color: var(--kv-blue);">${ic.code} <span class="status-badge-new ${badgeClass}">${statusText}</span></h3>
                            <span style="font-size: 13px; color: #888;">Chi nhánh trung tâm</span>
                        </div>
                        
                        <div style="padding: 20px;">
                            <div class="io-detail-info-grid">
                                <div class="info-item"><span class="info-label">Người tạo:</span><span>${ic.creator}</span></div>
                                <div class="info-item"><span class="info-label">Ngày tạo:</span><span>${timeStr}</span></div>
                                <div class="info-item"><span class="info-label">Người cân bằng:</span><span>${isDone ? ic.creator : '---'}</span></div>
                            </div>

                            <table class="kv-table" style="width: 100%; margin-top: 15px; border: 1px solid #eee;">
                                <thead>
                                    <tr style="background: #f9f9f9;">
                                        <th>Mã hàng</th><th>Tên hàng</th><th style="text-align:center;">Tồn kho</th><th style="text-align:center;">Thực tế</th><th style="text-align:center;">SL lệch</th><th style="text-align:right;">Giá trị lệch</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${ic.items.map(it => {
                                        const diff = (parseFloat(it.realQty) || 0) - (parseFloat(it.sysStock) || 0);
                                        return `
                                        <tr>
                                            <td style="color: var(--kv-blue);">${it.code}</td>
                                            <td>${it.name}</td>
                                            <td style="text-align:center;">${it.sysStock}</td>
                                            <td style="text-align:center;">${it.realQty}</td>
                                            <td style="text-align:center; color:${diff < 0 ? 'red' : (diff > 0 ? 'green' : '#333')}">${diff}</td>
                                            <td style="text-align:right;">${(diff * (parseFloat(it.cost) || 0)).toLocaleString()}</td>
                                        </tr>`;
                                    }).join('')}
                                </tbody>
                            </table>

                            <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                                <div style="width: 60%; background: #fdfdfd; padding: 15px; border: 1px solid #eee; border-radius: 4px; font-size: 13px;">
                                    <strong>Ghi chú:</strong> ${ic.note || '---'}
                                </div>
                                <div class="io-detail-summary-box">
                                    <div class="summary-row"><span class="lbl">Tổng thực tế:</span><span>${totalRealQty.toLocaleString()}</span></div>
                                    <div class="summary-row"><span class="lbl">Tổng chênh lệch:</span><span style="font-weight:bold; color:${(totalRealQty - totalSysStock) < 0 ? 'red' : 'green'};">${(totalRealQty - totalSysStock).toLocaleString()}</span></div>
                                    <div class="summary-row"><span class="lbl">Tổng giá trị lệch:</span><span style="font-weight:bold; color:${totalValueDiff < 0 ? 'red' : 'green'};">${totalValueDiff.toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>

                        <div style="padding: 15px 20px; background: #f9f9f9; border-top: 1px solid #eee; display: flex; justify-content: space-between;">
                            <div class="actions-left">
                                <button class="btn-action-outline text-danger" onclick="cancelIC(${ic.id})"><i class="fa-solid fa-trash"></i> Xóa/Hủy</button>
                                <button class="btn-action-outline" onclick="copyIC(${ic.id})"><i class="fa-solid fa-copy"></i> Sao chép</button>
                            </div>
                            <div class="actions-right">
                                ${!isDone && !isCancel ? `<button class="btn-action-primary" onclick="openCreateCheckView(${ic.id})"><i class="fa-solid fa-pen-to-square"></i> Sửa (Hoàn thiện)</button>` : ''}
                                <button class="btn-action-outline" onclick="window.print()"><i class="fa-solid fa-print"></i> In phiếu</button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>`;
    }).join('');
    window.renderPaginationControls('ic-pagination', window.currentICPage, totalPages, 'changeICPage');
};

window.changeICPage = function(newPage) {
    currentICPage = newPage;
    renderInventoryChecks();
};
function toggleICDetail(id) {
    const row = document.getElementById(`ic-detail-${id}`);
    document.querySelectorAll('tr[id^="ic-detail-"]').forEach(el => {
        if (el.id !== `ic-detail-${id}`) el.style.display = 'none';
    });
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}

function cancelIC(id) {
    if(confirm("Bạn có chắc chắn muốn hủy phiếu kiểm kho này?")) {
        const ic = inventoryChecks.find(x => x.id === id);
        if(ic) {
            ic.status = 'cancel';
            localStorage.setItem('kv_inventory_checks', JSON.stringify(inventoryChecks));
            
            // --- ĐỒNG BỘ CLOUD ---
            if (typeof window.uploadToCloud === 'function') {
                window.uploadToCloud('inventory_checks', inventoryChecks);
            }
            
            renderInventoryChecks();
        }
    }
}

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

window.openCreateCheckView = function(checkId = null) {
    // 1. Chuyển đổi giao diện
    document.getElementById('ic-list-section').style.display = 'none';
    document.getElementById('ic-create-section').style.display = 'block';

    const inputSearch = document.getElementById('ic-search-input');

    if (checkId) {
        // Sửa phiếu kiểm
        editingICId = checkId;
        const allIC = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];
        const ic = allIC.find(x => x.id === checkId);
        if (ic) {
            document.getElementById('ic-code').value = ic.id;
            document.getElementById('ic-note').value = ic.note || '';
            currentICItems = JSON.parse(JSON.stringify(ic.items));
        }
    } else {
        // Tạo phiếu kiểm mới
        editingICId = null;
        document.getElementById('ic-code').value = 'PK' + Date.now();
        document.getElementById('ic-note').value = '';
        currentICItems = [];
    }

    // 2. Tự động bôi đen ô tìm kiếm kiểm kho
    if (inputSearch) {
        inputSearch.addEventListener('focus', function() {
            setTimeout(() => { this.select(); }, 50);
        });
        inputSearch.addEventListener('mouseup', function(e) {
            if (this.value !== "") {
                e.preventDefault();
                this.select();
            }
        });
    }

    renderICItemList();
    if(inputSearch) inputSearch.focus();
};

function closeCreateCheckView() {
    if(currentICItems.length > 0 && !editingICId) {
        if(!confirm("Phiếu chưa được lưu. Bạn có chắc chắn muốn thoát?")) return;
    }
    document.getElementById('inventory-check-view').style.display = 'none';
}

window.searchICProduct = function(keyword) {
    const dropdown = document.getElementById('ic-search-dropdown');
    const input = document.getElementById('ic-search-input');
    
    // 1. Nếu ô tìm kiếm trống, ẩn dropdown và thoát
    if (!keyword || !keyword.trim()) { 
        dropdown.style.display = 'none'; 
        return; 
    }
    
    const kw = keyword.toLowerCase().trim();
    // Luôn lấy dữ liệu mới nhất từ products (đã được nạp trong window.products)
    const latestProducts = products || JSON.parse(localStorage.getItem('kv_products')) || [];

    // 2. Thực hiện lọc hàng hóa bằng thuật toán tìm kiếm mờ nâng cao
    const matches = latestProducts.filter(p => {
        // Gộp Tên, Mã hàng, Mã vạch thành một chuỗi duy nhất để tìm kiếm
        const fullText = `${p.name} ${p.code} ${p.barcode}`.toLowerCase();
        return window.fuzzyMatch(fullText, kw);
    });

    // 3. Hiển thị kết quả ra giao diện
    if (matches.length > 0) {
        // Sắp xếp ưu tiên: Kết quả nào khớp từ khóa ở đầu chuỗi sẽ hiện lên trước
        matches.sort((a, b) => {
            const firstWord = kw.split(' ')[0];
            return a.name.toLowerCase().indexOf(firstWord) - b.name.toLowerCase().indexOf(firstWord);
        });

        dropdown.innerHTML = matches.map(p => `
            <div class="ic-dropdown-item" onclick="addICToList('${p.id}')" style="display: flex; justify-content: space-between; align-items: center; padding: 12px; border-bottom: 1px solid #f0f0f0; cursor: pointer;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <div style="font-weight: bold; color: var(--kv-blue); font-size: 13px;">${p.code}</div>
                    <div style="font-size: 14px; color: #333;">${p.name}</div>
                    <small style="color: #888; font-size: 11px;">Mã vạch: ${p.barcode || '---'}</small>
                </div>
                <div style="text-align: right; min-width: 100px;">
                    <div style="font-weight: bold; color: var(--kv-pink); font-size: 14px;">${(p.price || 0).toLocaleString()}</div>
                    <div style="font-size: 12px; color: #555; margin-top: 4px;">
                        <i class="fa-solid fa-box-open" style="font-size: 10px; opacity: 0.5;"></i> Tồn: <strong>${p.stock || 0}</strong>
                    </div>
                </div>
            </div>`).join('');
        
        dropdown.style.display = 'block';
    } else {
        // 4. Trường hợp không tìm thấy
        dropdown.innerHTML = `
            <div style="padding: 20px; color: #888; text-align: center; font-size: 13px;">
                <i class="fa-solid fa-magnifying-glass" style="display: block; font-size: 24px; margin-bottom: 10px; opacity: 0.3;"></i>
                Không tìm thấy hàng hóa nào khớp với "<strong>${keyword}</strong>"
            </div>`;
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
    document.getElementById('ic-search-dropdown').style.display = 'none';
    document.getElementById('ic-search-input').value = '';
    
    const p = products.find(x => x.id === productId);
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
            baseSysStock: p.stock || 0,  // Tồn kho hệ thống gốc (số lượng cây)
            sysStock: p.stock || 0,      // Tồn kho hiển thị trên giao diện
            realQty: (p.stock || 0) + 1  // Thực tế đang đếm
        });
    }
    renderICItemsTable();
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

function renderICItemsTable() {
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
                    <select onchange="changeICUnit(${item.productId}, this.value)" style="border:none; color:var(--kv-blue); outline:none; background:transparent; cursor:pointer; font-weight:500;">
                        ${unitOptions}
                    </select>
                </td>
                <td style="text-align:center;">${item.sysStock}</td>
                <td style="text-align:center;">
                    <input type="number" value="${item.realQty}" onchange="updateICRealQty(${item.productId}, this.value)" style="width: 80px; text-align: center; padding: 5px; border: 1px solid #ccc; border-radius: 4px; outline: none; font-weight: bold;">
                </td>
                <td style="text-align:center; font-weight:bold; color:${diff<0?'red':'green'};">${diff}</td>
                <td style="text-align:right; font-weight:bold; color:${valDiff<0?'red':'green'};">${valDiff.toLocaleString()}</td>
            </tr>
        `;
    });
    
    document.getElementById('ic-total-actual-qty').innerText = sumActual;
}

window.saveInventoryCheck = function(action) {
    if (currentICItems.length === 0) { 
        alert("Vui lòng thêm hàng để kiểm!"); 
        return; 
    }

    const icCode = document.getElementById('ic-code').value || ("KK" + Date.now().toString().slice(-6));
    
    const icData = {
        id: editingICId || Date.now(), // Ưu tiên dùng ID cũ nếu đang sửa
        code: icCode,
        creator: currentUser.fullname,
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

    editingICId = null; 
    closeCreateCheckView();
    renderInventoryChecks();
    alert(action === 'done' ? "Cân bằng kho thành công!" : "Đã lưu phiếu tạm.");
};





// ==========================================
// 11. TÍNH NĂNG: ĐƠN VỊ TÍNH (NÂNG CAO)
// ==========================================

function openUnitAttrModal() {
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
    editingUnitIndex = editIndex;
    const modal = document.getElementById('add-unit-modal');
    
    document.getElementById('add-unit-title').innerText = isBase ? 'Thêm đơn vị cơ bản' : 'Thêm đơn vị';
    document.getElementById('add-unit-desc').style.display = isBase ? 'block' : 'none';
    
    const rateGroup = document.getElementById('sub-unit-rate-group');
    if(!isBase && currentProductUnits.length > 0) {
        rateGroup.style.display = 'block';
        document.getElementById('sub-unit-base-lbl').innerText = currentProductUnits[0].name;
    } else {
        rateGroup.style.display = 'none';
    }

    if(editIndex !== null) {
        const u = currentProductUnits[editIndex];
        document.getElementById('sub-unit-name').value = u.name;
        document.getElementById('sub-unit-rate').value = u.rate;
        document.getElementById('sub-unit-price').value = u.price;
        document.getElementById('sub-unit-sell').checked = u.sellDirect;
    } else {
        document.getElementById('sub-unit-name').value = '';
        document.getElementById('sub-unit-rate').value = 1;
        document.getElementById('sub-unit-price').value = document.getElementById('pm-price').value || 0;
        document.getElementById('sub-unit-sell').checked = true;
    }
    
    modal.style.display = 'flex';
}

function closeAddUnitModal() { document.getElementById('add-unit-modal').style.display = 'none'; }

function saveSubUnit() {
    const name = document.getElementById('sub-unit-name').value.trim();
    if(!name) { alert("Vui lòng nhập tên đơn vị!"); return; }
    
    const isBase = editingUnitIndex === 0 || (editingUnitIndex === null && currentProductUnits.length === 0);
    const rate = isBase ? 1 : parseFloat(document.getElementById('sub-unit-rate').value) || 1;
    const price = parseFloat(document.getElementById('sub-unit-price').value) || 0;
    const sellDirect = document.getElementById('sub-unit-sell').checked;

    const unitObj = { name, rate, price, sellDirect, isBase };

    if(editingUnitIndex !== null) {
        currentProductUnits[editingUnitIndex] = unitObj;
    } else {
        currentProductUnits.push(unitObj);
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
    const mainCode = document.getElementById('pm-code').value || 'SP';
    
    currentProductUnits.forEach((unit, uIdx) => {
        const autoCode = `${mainCode}-${uIdx + 1}`;
        
        vBody.innerHTML += `
            <tr>
                <td style="font-weight: 500; color: var(--kv-blue);">${unit.name}</td>
                <td><input type="text" class="variant-input" value="${unit.rate}" style="width: 60px; text-align:center;" disabled></td>
                <td><input type="text" class="variant-input" value="${autoCode}" placeholder="Tự động"></td>
                <td><input type="text" class="variant-input" placeholder="Mã vạch"></td>
                <td><input type="number" class="variant-input" value="0" style="text-align:right;"></td>
                <td><input type="number" class="variant-input" value="${unit.price}" style="text-align:right; font-weight:bold; color:var(--kv-pink);"></td>
                <td style="text-align:center; color:#888; cursor:pointer;"><i class="fa-solid fa-trash-can"></i></td>
            </tr>
        `;
    });
}

function saveUnitAttr() {
    closeUnitAttrModal();
}
// ==========================================
// 12. QUẢN LÝ TAB HÓA ĐƠN
// ==========================================
let invoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];

window.currentInvoicePage = 1;

window.renderInvoices = function() {
    const tbody = document.getElementById('invoice-tbody');
    if (!tbody) return;
    
    const searchKw = (document.getElementById('search-invoice')?.value || '').toLowerCase().trim();
    const showDone = document.getElementById('filter-inv-done')?.checked;
    const showCancel = document.getElementById('filter-inv-cancel')?.checked;
    const creatorVal = document.getElementById('filter-inv-creator')?.value || '';

    const dateType = document.querySelector('input[name="inv-date-type"]:checked')?.value || 'predefined';
    const predefinedVal = document.getElementById('inv-date-predefined')?.value;
    const fromDateVal = document.getElementById('inv-date-from')?.value;
    const toDateVal = document.getElementById('inv-date-to')?.value;

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endToday = startToday + 86400000 - 1;
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let fromTime = 0, toTime = Infinity;
    if (dateType === 'predefined') {
        if (predefinedVal === 'today') { fromTime = startToday; toTime = endToday; }
        else if (predefinedVal === 'yesterday') { fromTime = startToday - 86400000; toTime = startToday - 1; }
        else if (predefinedVal === 'this_month') { fromTime = startMonth; toTime = endToday; }
    } else {
        if (fromDateVal) fromTime = new Date(fromDateVal).getTime();
        if (toDateVal) toTime = new Date(toDateVal).getTime() + 86400000 - 1;
    }

    const parseVNTime = (timeStr) => {
        if(!timeStr) return 0;
        const parts = timeStr.replace(',', '').split(' ');
        const dateParts = parts[1].split('/');
        const timeParts = parts[0].split(':');
        return new Date(dateParts[2], dateParts[1]-1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]).getTime();
    };

    let allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    let filtered = allInvoices.filter(inv => {
        if (inv.status === 'done' && !showDone) return false;
        if (inv.status === 'cancel' && !showCancel) return false;
        if (searchKw && !inv.id.toLowerCase().includes(searchKw)) return false;
        if (creatorVal && inv.creator !== creatorVal) return false;
        const invTime = parseVNTime(inv.createdAt);
        return !(invTime < fromTime || invTime > toTime);
    });

    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:50px; color:#aaa;">Không có hóa đơn nào phù hợp</td></tr>`;
        document.getElementById('invoice-pagination').innerHTML = '';
        return;
    }

    const itemsPerPage = 30;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (window.currentInvoicePage - 1) * itemsPerPage;
    const paginated = filtered.slice(startIndex, startIndex + itemsPerPage);

    tbody.innerHTML = paginated.map(inv => {
        const netPay = (inv.totalAmount || 0) - (inv.invoiceDiscount || 0);
        return `
            <tr onclick="toggleInvoiceDetail('${inv.id}')" style="cursor:pointer; border-bottom: 1px solid #eee;">
                <td style="text-align:center;" onclick="event.stopPropagation()"><input type="checkbox"></td>
                <td style="color:var(--kv-blue); font-weight:bold;">${inv.id}</td>
                <td>${inv.createdAt}</td>
                <td>${inv.customer || 'Khách lẻ'}</td>
                <td style="text-align:right;">${(inv.totalAmount || 0).toLocaleString()}</td>
                <td style="text-align:right;">${(inv.invoiceDiscount || 0).toLocaleString()}</td>
                <td style="text-align:right; font-weight:bold;">${netPay.toLocaleString()}</td>
            </tr>
            <tr id="inv-detail-${inv.id}" style="display:none;" class="io-detail-wrapper">
                <td colspan="7" style="padding: 20px; background: #f4f6f9;">
                    <div style="background: white; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); overflow: hidden;">
                        <div style="padding: 15px 20px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
                            <h3 style="margin: 0; color: var(--kv-blue);">${inv.id} <span class="status-badge-new badge-done">${inv.status === 'done' ? 'Hoàn thành' : 'Đã hủy'}</span></h3>
                            <span style="font-size: 13px; color: #888;">Chi nhánh trung tâm</span>
                        </div>
                        <div style="padding: 20px;">
                            <div class="io-detail-info-grid">
                                <div class="info-item"><span class="info-label">Người tạo:</span><span class="info-value">${inv.creator}</span></div>
                                <div class="info-item"><span class="info-label">Người bán:</span><span class="info-value">${inv.creator}</span></div>
                                <div class="info-item"><span class="info-label">Ngày bán:</span><span class="info-value">${inv.createdAt}</span></div>
                            </div>
                            <table class="kv-table" style="width: 100%; margin-top: 20px; border: 1px solid #eee;">
                                <thead>
                                    <tr style="background: #f9f9f9;">
                                        <th>Mã hàng</th><th>Tên hàng</th><th style="text-align:center;">Số lượng</th><th style="text-align:right;">Giá bán</th><th style="text-align:right;">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${inv.items.map(it => `
                                        <tr>
                                            <td style="color: var(--kv-blue);">${it.code}</td>
                                            <td>${it.name}</td>
                                            <td style="text-align:center;">${it.qty}</td>
                                            <td style="text-align:right;">${it.price.toLocaleString()}</td>
                                            <td style="text-align:right; font-weight:bold;">${(it.qty * it.price).toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                                <textarea style="width: 60%; height: 80px; border: 1px solid #ddd; padding: 10px; border-radius: 4px; resize: none;" readonly>${inv.note || ''}</textarea>
                                <div class="io-detail-summary-box">
                                    <div class="summary-row"><span class="lbl">Tổng tiền hàng:</span><span class="val">${inv.totalAmount.toLocaleString()}</span></div>
                                    <div class="summary-row"><span class="lbl">Giảm giá:</span><span class="val">${(inv.invoiceDiscount || 0).toLocaleString()}</span></div>
                                    <div class="summary-row" style="font-size: 16px; color: var(--kv-blue);"><span class="lbl">Khách cần trả:</span><span class="val">${netPay.toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>
                        <div style="padding: 15px 20px; background: #f9f9f9; border-top: 1px solid #eee; display: flex; justify-content: space-between;">
                            <div class="actions-left">
                                <button class="btn-action-outline" onclick="deleteInvoice('${inv.id}')"><i class="fa-solid fa-trash"></i> Hủy</button>
                            </div>
                            <div class="actions-right">
                                <button class="btn-action-primary" onclick="editInvoice('${inv.id}')"><i class="fa-solid fa-pen-to-square"></i> Chỉnh sửa</button>
                                <button class="btn-action-outline" onclick="window.printReceipt(${JSON.stringify(inv).replace(/"/g, '&quot;')})"><i class="fa-solid fa-print"></i> In</button>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>`;
    }).join('');
    window.renderPaginationControls('invoice-pagination', window.currentInvoicePage, totalPages, 'changeInvoicePage');
};

window.changeInvoicePage = function(newPage) {
    currentInvoicePage = newPage;
    renderInvoices();
};

function toggleInvoiceDetail(id) {
    const row = document.getElementById(`inv-detail-${id}`);
    if (!row) return;
    
    // Ẩn các dòng khác đang mở
    document.querySelectorAll('tr[id^="inv-detail-"]').forEach(el => {
        if (el.id !== `inv-detail-${id}`) el.style.display = 'none';
    });
    
    // Đóng/mở dòng hiện tại
    row.style.display = row.style.display === 'none' ? 'table-row' : 'none';
}


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
    
    // ... (Giữ nguyên phần logic lọc dữ liệu đầu hàm) ...
    const searchKw = (document.getElementById('search-import')?.value || '').toLowerCase().trim();
    const showTemp = document.getElementById('filter-imp-temp')?.checked;
    const showDone = document.getElementById('filter-imp-done')?.checked;
    const showCancel = document.getElementById('filter-imp-cancel')?.checked;
    const creatorVal = document.getElementById('filter-imp-creator')?.value || '';
    const dateType = document.querySelector('input[name="imp-date-type"]:checked')?.value || 'predefined';
    const predVal = document.getElementById('imp-date-predefined')?.value;
    const fromVal = document.getElementById('imp-date-from')?.value;
    const toVal = document.getElementById('imp-date-to')?.value;

    const now = new Date();
    const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endToday = startToday + 86400000 - 1;
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    let fromTime = 0, toTime = Infinity;
    if (dateType === 'predefined') {
        if (predVal === 'today') { fromTime = startToday; toTime = endToday; }
        else if (predVal === 'yesterday') { fromTime = startToday - 86400000; toTime = startToday - 1; }
        else if (predVal === 'this_month') { fromTime = startMonth; toTime = endToday; }
        else if (predVal === 'all') { fromTime = 0; toTime = Infinity; }
    } else {
        if (fromVal) fromTime = new Date(fromVal).getTime();
        if (toVal) toTime = new Date(toVal).getTime() + 86400000 - 1;
    }

    let allImportOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
    let filtered = allImportOrders.filter(imp => {
        if (imp.status === 'temp' && !showTemp) return false;
        if (imp.status === 'done' && !showDone) return false;
        if (imp.status === 'cancel' && !showCancel) return false;
        if (searchKw && !imp.id.toLowerCase().includes(searchKw)) return false;
        if (creatorVal && imp.creator !== creatorVal) return false;
        const impTime = imp.timestamp || 0;
        return !(fromTime !== 0 && (impTime < fromTime || impTime > toTime));
    });

    if(filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:50px; color:#aaa;">Không có phiếu nhập nào</td></tr>`;
        document.getElementById('import-pagination').innerHTML = '';
        return;
    }

    const itemsPerPage = 30;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    const startIndex = (window.currentImportPage - 1) * itemsPerPage;
    const paginated = filtered.sort((a,b) => (b.timestamp || 0) - (a.timestamp || 0)).slice(startIndex, startIndex + itemsPerPage);

    tbody.innerHTML = paginated.map(imp => {
        const isDone = imp.status === 'done';
        const isCancel = imp.status === 'cancel';
        const statusText = isDone ? 'Đã nhập hàng' : (isCancel ? 'Đã hủy' : 'Phiếu tạm');
        const badgeClass = isDone ? 'badge-done' : (isCancel ? 'badge-cancel' : 'badge-temp');
        
        return `
            <tr onclick="toggleImportDetail('${imp.id}')" style="cursor:pointer; border-bottom: 1px solid #eee;">
                <td style="text-align:center;" onclick="event.stopPropagation()"><input type="checkbox"></td>
                <td style="color:var(--kv-blue); font-weight:bold;">${imp.id}</td>
                <td>${imp.createdAt}</td>
                <td>${imp.supplierName || '---'}</td>
                <td style="text-align:right; font-weight:bold;">${(imp.mustPay || 0).toLocaleString()}</td>
                <td style="text-align:center;"><span class="status-badge-new ${badgeClass}">${statusText}</span></td>
            </tr>
            <tr id="io-detail-${imp.id}" style="display:none;" class="io-detail-wrapper">
                <td colspan="6" style="padding: 20px; background: #f4f6f9;">
                    <div style="background: white; border-radius: 8px; border: 1px solid #ddd; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                        <div style="padding: 15px 20px; border-bottom: 1px solid #eee;">
                            <h3 style="margin: 0; color: var(--kv-blue);">${imp.id} <span class="status-badge-new ${badgeClass}">${statusText}</span></h3>
                        </div>
                        <div style="padding: 20px;">
                            <div class="io-detail-info-grid">
                                <div class="info-item"><span class="info-label">Người tạo:</span><span>${imp.creator}</span></div>
                                <div class="info-item"><span class="info-label">Tên NCC:</span><span>${imp.supplierName}</span></div>
                                <div class="info-item"><span class="info-label">Ngày nhập:</span><span>${imp.createdAt}</span></div>
                            </div>
                            <table class="kv-table" style="width: 100%; margin-top: 15px; border: 1px solid #eee;">
                                <thead>
                                    <tr style="background: #f9f9f9;">
                                        <th>Mã hàng</th><th>Tên hàng</th><th style="text-align:center;">Số lượng</th><th style="text-align:right;">Giá nhập</th><th style="text-align:right;">Thành tiền</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${imp.items.map(it => `
                                        <tr>
                                            <td style="color: var(--kv-blue);">${it.code}</td>
                                            <td>${it.name}</td>
                                            <td style="text-align:center;">${it.qty}</td>
                                            <td style="text-align:right;">${(it.cost || 0).toLocaleString()}</td>
                                            <td style="text-align:right; font-weight:bold;">${((it.qty || 0) * (it.cost || 0)).toLocaleString()}</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                            <div style="display: flex; justify-content: space-between; margin-top: 20px;">
                                <textarea style="width: 60%; height: 60px; border: 1px solid #ddd; padding: 10px; border-radius: 4px; resize: none;" readonly>${imp.note || ''}</textarea>
                                <div class="io-detail-summary-box">
                                    <div class="summary-row"><span class="lbl">Tổng tiền hàng:</span><span>${(imp.totalAmount || 0).toLocaleString()}</span></div>
                                    <div class="summary-row"><span class="lbl">Cần trả NCC:</span><span style="font-weight:bold; color:var(--kv-blue);">${(imp.mustPay || 0).toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>
                        <div style="padding: 15px 20px; background: #f9f9f9; border-top: 1px solid #eee; display: flex; justify-content: space-between;">
                            <div class="actions-left">
                                <button class="btn-action-outline text-danger" onclick="cancelImportOrder('${imp.id}')"><i class="fa-solid fa-trash"></i> Hủy phiếu</button>
                            </div>
                            <div class="actions-right">
    ${!isCancel ? `
        <button class="btn-action-primary" onclick="openCreateImportView('${imp.id}')">
    <i class="fa-solid fa-pen-to-square"></i> Mở phiếu
</button>
    ` : ''}
    <button class="btn-action-outline" onclick="window.print()"><i class="fa-solid fa-print"></i> In phiếu</button>
</div>
                        </div>
                    </div>
                </td>
            </tr>`;
    }).join('');
    window.renderPaginationControls('import-pagination', window.currentImportPage, totalPages, 'changeImportPage');
};

// Hàm điều khiển ẩn hiện chi tiết
window.toggleImportDetail = function(id) {
    const row = document.getElementById(`io-detail-${id}`);
    if (!row) return;
    document.querySelectorAll('tr[id^="io-detail-"]').forEach(el => {
        if (el.id !== `io-detail-${id}`) el.style.display = 'none';
    });
    row.style.display = (row.style.display === 'none') ? 'table-row' : 'none';
};

window.changeIOPage = function(newPage) {
    currentIOPage = newPage;
    renderImportOrders();
};
// Bổ sung hàm Hủy Phiếu Nhập Hàng
window.cancelImportOrder = function(id) {
    showConfirm("Bạn có chắc chắn muốn hủy phiếu nhập hàng này?", function() {
        let allImportOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
        let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        
        const ioIdx = allImportOrders.findIndex(x => x.id === id);
        if(ioIdx === -1) return;

        const io = allImportOrders[ioIdx];
        if(io.status === 'cancel') { showToast("Phiếu này đã được hủy trước đó.", "warning"); return; }

        if(io.status === 'done') {
            io.items.forEach(item => {
                const pIdx = allProducts.findIndex(p => p.id === item.productId);
                if (pIdx !== -1) {
                    const rate = item.units && item.units[item.selectedUnitIdx] ? item.units[item.selectedUnitIdx].rate : 1;
                    allProducts[pIdx].stock -= (item.qty * rate); 
                }
            });
            localStorage.setItem('kv_products', JSON.stringify(allProducts));
        }

        allImportOrders[ioIdx].status = 'cancel';
        localStorage.setItem('kv_import_orders', JSON.stringify(allImportOrders));

        renderImportOrders(); 
        showToast("Đã xử lý hủy phiếu nhập hàng.", "success");
        
        setTimeout(() => {
            if (window.uploadToCloud) {
                window.uploadToCloud('import_orders', allImportOrders);
                if(io.status === 'done') window.uploadToCloud('products', allProducts);
            }
        }, 10);
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

window.openCreateImportView = function(orderId = null) {
    // 1. Hiển thị màn hình nhập hàng và ẩn danh sách
    document.getElementById('io-list-section').style.display = 'none';
    document.getElementById('io-create-section').style.display = 'block';

    const titleEl = document.querySelector('#io-create-section .kv-title');
    const inputSearch = document.getElementById('io-search-input');

    if (orderId) {
        // Trường hợp Sửa phiếu nhập cũ
        titleEl.innerText = 'Cập nhật phiếu nhập hàng';
        editingIOId = orderId;
        const allIO = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
        const io = allIO.find(x => x.id === orderId);
        if (io) {
            document.getElementById('io-code').value = io.id;
            document.getElementById('io-supplier').value = io.supplierName || '';
            document.getElementById('io-note').value = io.note || '';
            currentIOItems = JSON.parse(JSON.stringify(io.items));
        }
    } else {
        // Trường hợp Tạo mới
        titleEl.innerText = 'Tạo phiếu nhập hàng';
        editingIOId = null;
        document.getElementById('io-code').value = 'PN' + Date.now();
        document.getElementById('io-supplier').value = '';
        document.getElementById('io-note').value = '';
        currentIOItems = [];
    }

    // 2. Tự động bôi đen ô tìm kiếm nhập hàng
    if (inputSearch) {
        inputSearch.addEventListener('focus', function() {
            setTimeout(() => { this.select(); }, 50);
        });
        inputSearch.addEventListener('mouseup', function(e) {
            if (this.value !== "") {
                e.preventDefault();
                this.select();
            }
        });
    }

    renderIOItemList();
    if(inputSearch) inputSearch.focus();
};

function closeCreateImportView() {
    if(currentIOItems.length > 0 && !editingIOId) {
        if(!confirm("Phiếu chưa được lưu. Bạn có chắc chắn muốn thoát?")) return;
    }
    document.getElementById('import-order-view').style.display = 'none';
}

window.searchIOProduct = function(keyword) {
    const dropdown = document.getElementById('io-search-dropdown');
    if (!keyword.trim()) { dropdown.style.display = 'none'; return; }
    
    const kw = keyword.toLowerCase().trim();
    const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];

    // NÂNG CẤP: Sử dụng fuzzyMatch
    const matches = latestProducts.filter(p => {
        const fullText = `${p.name} ${p.code} ${p.barcode}`.toLowerCase();
        return window.fuzzyMatch(fullText, kw);
    });

    if (matches.length > 0) {
        dropdown.innerHTML = matches.map(p => `
            <div class="ic-dropdown-item" onclick="addIOToList('${p.id}')">
                <div style="display: flex; flex-direction: column;">
                    <strong style="color: var(--kv-blue);">${p.code}</strong>
                    <span style="font-size: 13px;">${p.name}</span>
                </div>
                <div style="text-align: right;">
                    <span style="font-weight: bold; color: var(--kv-pink);">${(p.price || 0).toLocaleString()}</span>
                </div>
            </div>`).join('');
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = '<div style="padding: 10px; color: #888; text-align: center;">Không tìm thấy</div>';
        dropdown.style.display = 'block';
    }
};

// Bắt sự kiện Enter cho Nhập hàng
document.getElementById('io-search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        const firstItem = document.querySelector('#io-search-dropdown .ic-dropdown-item');
        if (firstItem) firstItem.click();
    }
});

// Thêm hàng hóa vào danh sách (Không thay đổi nhiều, chỉ chuẩn hóa ID)
function addIOToList(productId) {
    document.getElementById('io-search-dropdown').style.display = 'none';
    document.getElementById('io-search-input').value = '';
    
    const p = products.find(x => String(x.id) === String(productId));
    if(!p) return;
    
    const productUnits = (p.units && p.units.length > 0) ? p.units : [{ name: 'Cái', rate: 1, price: p.price, isBase: true }];

    const existingItem = currentIOItems.find(x => String(x.productId) === String(productId) && x.selectedUnitIdx === 0);
    
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
            cost: (p.cost || 0) * productUnits[0].rate,
            discount: 0,
            qty: 1
        });
    }
    renderIOItemsTable();
}

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
function changeIOUnit(index, unitIdx) {
    const item = currentIOItems[index];
    if(item) {
        item.selectedUnitIdx = parseInt(unitIdx);
        const selectedUnit = item.units[item.selectedUnitIdx];
        item.cost = item.baseCost * selectedUnit.rate;
        renderIOItemsTable();
    }
}

// HÀM MỚI: Cập nhật số liệu tức thời KHÔNG vẽ lại toàn bộ bảng
window.updateIOItemState = function(index, field, value) {
    const item = currentIOItems[index];
    if (item) {
        // Chuyển đổi giá trị nhập vào thành số
        item[field] = parseFloat(value) || 0;
        
        // 1. Cập nhật cột Thành Tiền của dòng hiện tại
        const rowTotal = item.qty * (item.cost - (item.discount || 0));
        const rowTotalEl = document.getElementById(`io-row-total-${index}`);
        if (rowTotalEl) rowTotalEl.innerText = rowTotal.toLocaleString('vi-VN');
        
        // 2. Tính toán lại tổng số lượng và tổng tiền hàng
        let totalQty = 0;
        let totalAmount = 0;
        currentIOItems.forEach(i => {
            totalQty += i.qty;
            totalAmount += i.qty * (i.cost - (i.discount || 0));
        });
        
        // Cập nhật lên giao diện
        document.getElementById('io-total-qty').innerText = totalQty;
        const totalAmountEl = document.getElementById('io-total-amount');
        totalAmountEl.innerText = totalAmount.toLocaleString('vi-VN');
        totalAmountEl.dataset.val = totalAmount; // Lưu giá trị số để calculateIOTotals dùng
        
        calculateIOTotals();
    }
};

// Cải tiến hàm vẽ bảng: Gắn ID cho dòng và dùng sự kiện oninput
function renderIOItemsTable() {
    const tbody = document.getElementById('io-items-table-body');
    let totalQty = 0;
    let totalAmount = 0;
    
    // Nếu trống thì reset toàn bộ về 0
    if (currentIOItems.length === 0) {
        tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding: 80px 0; color: #888;">Gõ mã, tên hàng hóa vào thanh tìm kiếm hoặc quét mã vạch để thêm vào phiếu nhập</td></tr>`;
        document.getElementById('io-total-qty').innerText = 0;
        document.getElementById('io-total-amount').innerText = "0";
        document.getElementById('io-total-amount').dataset.val = 0;
        calculateIOTotals();
        return;
    }

    let html = '';
    currentIOItems.forEach((item, index) => {
        totalQty += item.qty;
        const rowTotal = item.qty * (item.cost - item.discount);
        totalAmount += rowTotal;
        
        let unitOptions = '';
        if (item.units && item.units.length > 0) {
            unitOptions = item.units.map((u, idx) => 
                `<option value="${idx}" ${item.selectedUnitIdx === idx ? 'selected' : ''}>${u.name}</option>`
            ).join('');
        } else {
            unitOptions = `<option value="0" selected>Cái</option>`;
        }
        
        html += `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="text-align:center;"><i class="fa-solid fa-trash-can" style="color:#d9534f; cursor:pointer;" onclick="removeIOItem(${index})"></i></td>
                <td style="text-align:center;">${index + 1}</td>
                <td style="color:var(--kv-blue); font-weight: 500;">${item.code}</td>
                <td>${item.name}</td>
                <td>
                    <select onchange="changeIOUnit(${index}, this.value)" style="border:none; color:var(--kv-blue); outline:none; background:transparent; cursor:pointer; font-weight: 500;">
                        ${unitOptions}
                    </select>
                </td>
                <td style="text-align:center;">
                    <input type="number" value="${item.qty}" oninput="updateIOItemState(${index}, 'qty', this.value)" style="width: 60px; text-align: center; border: 1px solid #ccc; border-radius: 15px; padding: 4px; outline: none;">
                </td>
                <td style="text-align:right;">
                    <input type="text" value="${item.cost.toLocaleString('vi-VN')}" oninput="formatCurrency(this); updateIOItemState(${index}, 'cost', window.parseCurrency(this.value))" style="width: 90px; text-align: right; border: 1px solid #ccc; border-radius: 15px; padding: 4px; outline: none;">
                </td>
                <td style="text-align:right;">
                    <input type="text" value="${item.discount.toLocaleString('vi-VN')}" oninput="formatCurrency(this); updateIOItemState(${index}, 'discount', window.parseCurrency(this.value))" style="width: 80px; text-align: right; border: 1px solid #ccc; border-radius: 15px; padding: 4px; outline: none;">
                </td>
                <td id="io-row-total-${index}" style="text-align:right; font-weight:bold;">${rowTotal.toLocaleString()}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    document.getElementById('io-total-qty').innerText = totalQty;
    document.getElementById('io-total-amount').innerText = totalAmount.toLocaleString();
    document.getElementById('io-total-amount').dataset.val = totalAmount; 
    calculateIOTotals();
}

function calculateIOTotals() {
    const totalAmount = parseFloat(document.getElementById('io-total-amount').dataset.val) || 0;
    const discount = window.parseCurrency(document.getElementById('io-discount').value) || 0;
    const extraFee = window.parseCurrency(document.getElementById('io-extra-fee').value) || 0;
    const paid = window.parseCurrency(document.getElementById('io-paid').value) || 0;

    const mustPay = totalAmount - discount + extraFee;
    const debt = mustPay - paid;

    document.getElementById('io-must-pay').innerText = mustPay.toLocaleString('vi-VN');
    document.getElementById('io-debt').innerText = debt.toLocaleString('vi-VN');
}
window.saveImportOrder = function(action) {
    // 1. Kiểm tra nếu chưa có hàng hóa trong danh sách
    if (currentIOItems.length === 0) { 
        alert("Vui lòng chọn ít nhất 1 mặt hàng!"); 
        return; 
    }

    let allImportOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
    const totalAmount = parseFloat(document.getElementById('io-total-amount').dataset.val) || 0;
    const ioId = document.getElementById('io-code').value;

    // 2. Thu thập dữ liệu phiếu nhập
    const ioData = {
        id: ioId,
        timestamp: editingIOId ? (allImportOrders.find(x => x.id === editingIOId)?.timestamp || Date.now()) : Date.now(),
        createdAt: editingIOId ? (allImportOrders.find(x => x.id === editingIOId)?.createdAt || new Date().toLocaleString('vi-VN')) : new Date().toLocaleString('vi-VN'),
        creator: currentUser.fullname,
        supplierName: document.getElementById('io-supplier').value.trim() || 'Nhà cung cấp lẻ',
        status: action,
        note: document.getElementById('io-note').value.trim(),
        items: JSON.parse(JSON.stringify(currentIOItems)),
        totalAmount: totalAmount,
        ioDiscount: window.parseCurrency(document.getElementById('io-discount').value) || 0,
        ioExtraFee: window.parseCurrency(document.getElementById('io-extra-fee').value) || 0,
        paid: window.parseCurrency(document.getElementById('io-paid').value) || 0,
        mustPay: totalAmount - (window.parseCurrency(document.getElementById('io-discount').value) || 0) + (window.parseCurrency(document.getElementById('io-extra-fee').value) || 0)
    };

    // 3. Xử lý lưu đè nếu đang sửa hoặc thêm mới
    if (editingIOId) {
        const idx = allImportOrders.findIndex(x => x.id === editingIOId);
        if (idx !== -1) allImportOrders[idx] = ioData;
    } else {
        allImportOrders.unshift(ioData);
    }

    // 4. LOGIC QUAN TRỌNG: Cập nhật Kho và Giá vốn khi Hoàn thành
    if (action === 'done') {
        let latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
        currentIOItems.forEach(item => {
            const prod = latestProducts.find(p => p.id === item.productId);
            if (prod) {
                const rate = item.units[item.selectedUnitIdx]?.rate || 1;
                const qtyInBaseUnit = item.qty * rate;
                
                // Cộng dồn tồn kho
                prod.stock = (prod.stock || 0) + qtyInBaseUnit;
                
                // Cập nhật giá vốn mới (quy đổi về đơn vị cơ bản)
                // Giúp hiển thị đúng ở ô "Giá nhập cuối" trong thiết lập giá
                prod.cost = item.cost / rate; 
            }
        });
        
        // Lưu và đẩy sản phẩm lên Cloud
        localStorage.setItem('kv_products', JSON.stringify(latestProducts));
        if (window.uploadToCloud) window.uploadToCloud('products', latestProducts);
    }

    // 5. Lưu phiếu nhập và đẩy lên Cloud
    localStorage.setItem('kv_import_orders', JSON.stringify(allImportOrders));
    if (window.uploadToCloud) window.uploadToCloud('import_orders', allImportOrders);

    // 6. Reset trạng thái và quay về danh sách
    editingIOId = null; 
    closeCreateImportView();
    renderImportOrders();
    
    // Thông báo cho người dùng
    alert(action === 'done' ? "Nhập hàng thành công!" : "Đã lưu phiếu tạm.");
};
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

window.initPOSData = function() {
    // 1. KHỞI TẠO DANH SÁCH TAB (HÓA ĐƠN)
    if (posTabs.length === 0) {
        posTabs.push({
            id: 'tab-' + Date.now(),
            name: 'Hóa đơn 1',
            cart: [],
            priceBook: 'default',
            customer: null
        });
        activeTabIndex = 0;
    }

    // 2. VẼ GIAO DIỆN
    renderPOSTabs(); 
    renderPOSCart(); 

    // 3. THIẾT LẬP Ô TÌM KIẾM (Xử lý quét mã và bôi đen)
    const searchInput = document.getElementById('pos-search-input');
    const searchDropdown = document.getElementById('pos-search-dropdown');

    if (searchInput) {
        // Tự động bôi đen khi focus
        searchInput.addEventListener('focus', function() {
            setTimeout(() => { this.select(); }, 50);
        });

        // Giữ bôi đen khi thả chuột
        searchInput.addEventListener('mouseup', function(e) {
            if (this.value !== "") {
                e.preventDefault();
                this.select();
            }
        });

        // XỬ LÝ QUÉT MÃ VẠCH / NHẤN ENTER
        searchInput.onkeydown = function(e) {
            if (e.key === 'Enter') {
                e.preventDefault(); // Chặn xuống dòng hoặc submit form
                const keyword = this.value.trim();
                if (!keyword) return;

                // Gọi hàm tìm kiếm và lấy danh sách kết quả
                const results = window.searchPOSProduct(keyword);

                if (results && results.length > 0) {
                    // LẤY SẢN PHẨM ĐẦU TIÊN THÊM VÀO GIỎ
                    addPOSItem(results[0].id);
                    
                    // Xóa trắng ô nhập để chờ lần quét tiếp theo
                    this.value = '';
                    if (searchDropdown) searchDropdown.style.display = 'none';
                    
                    // Giữ con trỏ chuột ở lại ô nhập
                    this.focus();
                } else {
                    showToast("Không tìm thấy hàng hóa với mã này!", "error");
                }
            }
        };

        searchInput.focus();
    }

    // 4. "NAM CHÂM" FOCUS (Click ra ngoài tự quay lại ô tìm kiếm)
    const posView = document.getElementById('pos-view');
    if (posView) {
        posView.onclick = function(e) {
            const ignoreTags = ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON', 'A', 'I', 'OPTION'];
            if (!ignoreTags.includes(e.target.tagName)) {
                if (searchInput) searchInput.focus();
            }
        };
    }

    if (typeof window.initPOSShortcuts === 'function') window.initPOSShortcuts();
    console.log("🚀 POS System: Đã sẵn sàng quét mã vạch.");
};

window.searchPOSProduct = function(keyword) {
    const dropdown = document.getElementById('pos-search-dropdown');
    if (!keyword || !keyword.trim()) { 
        dropdown.style.display = 'none'; 
        return []; // TRẢ VỀ MẢNG RỖNG KHI TRỐNG
    }
    
    const kw = keyword.toLowerCase().trim();
    const latestProducts = window.products || JSON.parse(localStorage.getItem('kv_products')) || [];

    // Tìm kiếm mờ
    const matches = latestProducts.filter(p => {
        const fullText = `${p.name} ${p.code} ${p.barcode}`.toLowerCase();
        return window.fuzzyMatch(fullText, kw);
    });

    // ƯU TIÊN: Đưa mã khớp 100% (mã vạch hoặc mã hàng) lên đầu danh sách để máy quét nhận diện đúng
    matches.sort((a, b) => {
        const aExact = (a.code.toLowerCase() === kw || a.barcode === kw);
        const bExact = (b.code.toLowerCase() === kw || b.barcode === kw);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        return 0;
    });

    if (matches.length === 0) {
        dropdown.innerHTML = '<div style="padding:15px; color:#888; text-align:center;">Không tìm thấy</div>';
        dropdown.style.display = 'block';
    } else {
        dropdown.innerHTML = matches.map(p => {
            const currentTab = posTabs[activeTabIndex];
            const price = getProductPrice(p, currentTab.priceBook).price || p.price;
            return `<div class="pos-dropdown-item" onclick="addPOSItem('${p.id}')">
                <div><strong>${p.code}</strong> - ${p.name}</div>
                <div style="font-weight:bold; color:var(--kv-pink);">${price.toLocaleString()}</div>
            </div>`;
        }).join('');
        dropdown.style.display = 'block';
    }
    
    return matches; // TRẢ VỀ KẾT QUẢ ĐỂ HÀM ENTER SỬ DỤNG
};

document.getElementById('pos-search-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') {
        e.preventDefault(); 
        
        const kw = this.value.trim().toLowerCase();
        if (kw) {
            const latestProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
            const exactMatch = latestProducts.find(p => 
                (p.barcode && p.barcode.toLowerCase() === kw) || 
                (p.code && p.code.toLowerCase() === kw)
            );

            if (exactMatch) {
                addPOSItem(exactMatch.id, true); 
            } else {
                const firstItem = document.querySelector('.pos-dropdown-item');
                if (firstItem) {
                    const onclickStr = firstItem.getAttribute('onclick');
                    const idMatch = onclickStr.match(/'([^']+)'/);
                    if (idMatch && idMatch[1]) {
                        addPOSItem(idMatch[1], true); 
                    }
                }
            }
            this.focus();
            this.select(); 
        }
    }
});

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
    // 1. Tạo tab mới
    const newTab = {
        id: 'tab-' + Date.now(),
        name: 'Hóa đơn ' + (posTabs.length + 1),
        cart: [],
        priceBook: 'default',
        customer: null
    };
    posTabs.push(newTab);
    activeTabIndex = posTabs.length - 1;

    // 2. Vẽ lại giao diện
    renderPOSTabs();
    renderPOSCart();

    // 3. QUAN TRỌNG: Trả lại focus và bôi đen ô tìm kiếm
    const searchInput = document.getElementById('pos-search-input');
    if (searchInput) {
        searchInput.focus();
        setTimeout(() => {
            searchInput.select();
        }, 50);
    }
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
    renderPOSTabs(); // Vẽ lại các thẻ (tab) phía trên

    const tab = posTabs[activeTabIndex];
    if (tab) {
        // 1. ÉP DỮ LIỆU LÊN MÀN HÌNH TRƯỚC (Rất quan trọng để chống trôi khi F5)
        const pbSelect = document.getElementById('pos-pricebook-select');
        if (pbSelect) pbSelect.value = String(tab.priceBook);

        const discEl = document.getElementById('pos-discount');
        if (discEl) discEl.value = (tab.discount || 0).toLocaleString('vi-VN');

        const feeEl = document.getElementById('pos-extra-fee');
        if (feeEl) feeEl.value = (tab.extraFee || 0).toLocaleString('vi-VN');
    }

    // 2. VẼ LẠI GIỎ HÀNG (Sau khi các ô input đã nhận đúng thông số của Tab)
    renderPOSCart();
    savePOSState(); // Lưu trạng thái hiện tại
}

function closePOSTab(index, event) {
    if(event) event.stopPropagation();
    if (posTabs.length <= 1) return;
    posTabs.splice(index, 1);
    if (activeTabIndex >= posTabs.length) activeTabIndex = posTabs.length - 1;
    switchPOSTab(activeTabIndex);
    savePOSState(); // Lưu trạng thái
}

window.addPOSItem = function(productId, keepInput = false) {
    document.getElementById('pos-search-dropdown').style.display = 'none';
    if (!keepInput) document.getElementById('pos-search-input').value = '';
    
    const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];
    const p = allProds.find(x => x.id === productId);
    if(!p) return;

    const tab = posTabs[activeTabIndex];
    const productUnits = (p.units && p.units.length > 0) ? p.units : [{ name: 'Cái', rate: 1 }];
    const activePrice = getProductPrice(p, tab.priceBook);
    
    const existing = tab.items.find(x => x.productId === productId && x.selectedUnitIdx === 0);
    
    if (existing) existing.qty += 1;
    else tab.items.unshift({ 
        productId: p.id, code: p.code, name: p.name, qty: 1, 
        basePrice: activePrice, price: activePrice * productUnits[0].rate, 
        units: productUnits, selectedUnitIdx: 0 
    });
    
    renderPOSCart();
    savePOSState(); // Lưu trạng thái
};

window.renderPOSCart = function() {
    const cartContainer = document.getElementById('pos-cart-items');
    if (!cartContainer) return;

    const currentTab = posTabs[activeTabIndex];
    const cart = currentTab.cart;
    
    if (cart.length === 0) {
        cartContainer.innerHTML = `
            <div style="text-align: center; padding: 50px 20px; color: #ccc;">
                <i class="fa-solid fa-cart-shopping" style="font-size: 48px; margin-bottom: 15px; opacity: 0.2;"></i>
                <p>Chưa có hàng hóa nào trong giỏ</p>
            </div>`;
        updatePOSTotal();
        return;
    }

    let html = '';
    cart.forEach((item, index) => {
        // 1. Xác định giá dựa trên Bảng giá của Tab hiện tại
        const priceInfo = getProductPrice(item, currentTab.priceBook);
        const price = priceInfo.price;

        // 2. Lấy thông tin tồn kho thực tế từ danh sách gốc (window.products)
        const originalProd = (window.products || []).find(p => p.id === item.productId) || item;
        const currentStock = originalProd.stock || 0;
        const stockStyle = currentStock <= 0 ? 'color: var(--kv-pink); font-weight: bold;' : 'color: #28a745;';

        // 3. Xử lý hiển thị Đơn vị tính (Dropdown nếu có nhiều đơn vị)
        let unitDisplay = `<span style="color: #666;">${item.unit || 'Đv'}</span>`;
        if (item.units && item.units.length > 1) {
            unitDisplay = `
                <select onchange="changeCartItemUnit(${index}, this.value)" style="border: 1px solid #ddd; border-radius: 4px; padding: 2px 4px; font-size: 12px; cursor: pointer;">
                    ${item.units.map((u, uIdx) => `<option value="${uIdx}" ${item.selectedUnitIdx == uIdx ? 'selected' : ''}>${u.name}</option>`).join('')}
                </select>`;
        }

        html += `
        <div class="cart-item-row" style="display: flex; align-items: center; padding: 12px 15px; border-bottom: 1px solid #f0f0f0; background: #fff;">
            <div style="width: 30px; color: #bbb; font-size: 11px;">${index + 1}</div>
            
            <div style="width: 30px; cursor: pointer; color: #ffbcbc;" onclick="removeCartItem(${index})">
                <i class="fa-solid fa-trash-can"></i>
            </div>

            <div style="flex: 1; min-width: 0; padding: 0 10px;">
                <div style="color: var(--kv-blue); font-weight: 600; font-size: 12px;">${item.code}</div>
                
                <div class="cart-item-name" data-full-name="${item.name}">
                    ${item.name}
                </div>
                
                <div style="font-size: 11px; margin-top: 3px; color: #888;">
                    Tồn: <span style="${stockStyle}">${currentStock}</span>
                </div>
            </div>

            <div style="width: 80px; text-align: center;">
                ${unitDisplay}
            </div>

            <div style="width: 110px; display: flex; justify-content: center; align-items: center;">
                <button onclick="updateCartQty(${index}, -1)" style="width: 28px; height: 28px; border: 1px solid #ddd; background: #fff; border-radius: 4px 0 0 4px; cursor: pointer;">-</button>
                <input type="text" value="${item.qty}" 
                    onchange="updateCartQtyDirect(${index}, this.value)"
                    style="width: 40px; height: 28px; border-top: 1px solid #ddd; border-bottom: 1px solid #ddd; border-left: none; border-right: none; text-align: center; font-weight: bold;">
                <button onclick="updateCartQty(${index}, 1)" style="width: 28px; height: 28px; border: 1px solid #ddd; background: #fff; border-radius: 0 4px 4px 0; cursor: pointer;">+</button>
            </div>

            <div style="width: 120px; text-align: right;">
                <div style="font-weight: bold; color: #333;">${(price * item.qty).toLocaleString()}</div>
                <div style="font-size: 11px; color: #999;">${price.toLocaleString()}</div>
            </div>
        </div>`;
    });

    cartContainer.innerHTML = html;
    updatePOSTotal(); // Cập nhật tổng tiền ở phía dưới
};

function removePOSItem(index) { posTabs[activeTabIndex].items.splice(index, 1); renderPOSCart(); savePOSState(); }
function updatePOSQty(index, val) { 
    const q = parseFloat(val); 
    if(q > 0) posTabs[activeTabIndex].items[index].qty = q; 
    else removePOSItem(index); 
    renderPOSCart(); 
    savePOSState();
}
function updatePOSUnit(index, unitIdx) {
    const item = posTabs[activeTabIndex].items[index];
    item.selectedUnitIdx = parseInt(unitIdx);
    item.price = item.basePrice * item.units[item.selectedUnitIdx].rate;
    renderPOSCart();
    savePOSState();
}
function calcPOSTotals() {
    const tab = posTabs[activeTabIndex];
    if(!tab) return;
    let totalQty = 0, totalGoods = 0;
    tab.items.forEach(item => { totalQty += item.qty; totalGoods += (item.qty * item.price); });

    tab.discount = window.parseCurrency(document.getElementById('pos-discount').value) || 0;
    tab.extraFee = window.parseCurrency(document.getElementById('pos-extra-fee').value) || 0;
    const mustPay = totalGoods - tab.discount + tab.extraFee;

    document.getElementById('pos-total-qty').innerText = totalQty;
    document.getElementById('pos-total-goods').innerText = totalGoods.toLocaleString('vi-VN');
    document.getElementById('pos-total-goods').dataset.val = totalGoods;
    document.getElementById('pos-must-pay').innerText = mustPay.toLocaleString('vi-VN');
    
    savePOSState(); // Lưu trạng thái khi gõ giảm giá hoặc phí thu thêm
}

function changePOSPriceBook(pbId) {
    const tab = posTabs[activeTabIndex];
    tab.priceBook = pbId;
    tab.items.forEach(item => {
        const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];
        const prod = allProds.find(p => p.id === item.productId);
        if (prod) {
            item.basePrice = getProductPrice(prod, pbId);
            item.price = item.basePrice * item.units[item.selectedUnitIdx].rate;
        }
    });
    renderPOSCart();
    savePOSState();
}

window.processCheckout = function() {
    const tab = posTabs[activeTabIndex];
    if (!tab || tab.items.length === 0) { 
        showToast("Giỏ hàng trống!", "error"); 
        return; 
    }

    const latestProds = JSON.parse(localStorage.getItem('kv_products')) || [];
    const totalAmount = parseFloat(document.getElementById('pos-total-goods').dataset.val) || 0;
    const mustPay = totalAmount - tab.discount + tab.extraFee;
    
    const newInvoice = {
        id: 'HD' + Date.now().toString().slice(-6),
        createdAt: new Date().toLocaleString('vi-VN'),
        items: JSON.parse(JSON.stringify(tab.items)),
        totalAmount: totalAmount,
        invoiceDiscount: tab.discount,
        customerPaid: mustPay,
        creator: currentUser.fullname,
        status: 'done'
    };

    // Trừ tồn kho
    tab.items.forEach(cartItem => {
        const prod = latestProds.find(p => p.id === cartItem.productId);
        if (prod) {
            const rate = cartItem.units[cartItem.selectedUnitIdx]?.rate || 1;
            prod.stock -= (cartItem.qty * rate);
        }
    });

    let allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    allInvoices.unshift(newInvoice);

    // Lưu dữ liệu
    localStorage.setItem('kv_products', JSON.stringify(latestProds));
    localStorage.setItem('kv_invoices', JSON.stringify(allInvoices));

    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('invoices', allInvoices);
        window.uploadToCloud('products', latestProds);
    }
    
    // --- LOGIC IN HÓA ĐƠN ĐÃ CẢI TIẾN ---
    if (window.autoPrintMode) {
        // Nếu ĐANG BẬT (F2): In ngay lập tức không hỏi
        window.printReceipt(newInvoice);
    } 
    // Nếu ĐANG TẮT: Không làm gì cả, bỏ qua bước in và thông báo thành công luôn
    else {
        console.log("Chế độ in đang tắt, bỏ qua bước in.");
        showToast("Thanh toán thành công!", "success");
    }
    
    // ==========================================
    // ĐÓNG TAB ĐÃ THANH TOÁN & QUẢN LÝ TAB TRỐNG
    // ==========================================
    posTabs.splice(activeTabIndex, 1); // Xóa tab hiện tại

    if (posTabs.length === 0) {
        tabCounter = 0; // Reset đếm để tạo Hóa đơn 1
        addPOSTab();    // Tạo tab mới tinh
    } else {
        // Nhảy sang tab cuối cùng nếu còn khách đang chờ
        activeTabIndex = posTabs.length - 1;
        switchPOSTab(activeTabIndex);
    }

    // ==========================================
    // LƯU LẠI TRẠNG THÁI (Xóa rác tab vừa thanh toán chống F5)
    // ==========================================
    if (typeof window.savePOSState === 'function') {
        window.savePOSState();
    }

    // ==========================================
    // TỰ ĐỘNG FOCUS VỀ Ô TÌM KIẾM SAU KHI THANH TOÁN
    // ==========================================
    setTimeout(() => {
        const searchInput = document.getElementById('pos-search-input');
        if (searchInput) {
            searchInput.focus();
        }
    }, 100); // Đợi 0.1s để giao diện render xong rồi mới focus
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
function editInvoice(invId) {
    // 1. Tìm hóa đơn trong danh sách
    invoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    const inv = invoices.find(x => x.id === invId);
    
    if (!inv) {
        alert("Không tìm thấy dữ liệu hóa đơn!");
        return;
    }

    if (confirm(`Bạn muốn chỉnh sửa hóa đơn ${invId}? Hệ thống sẽ nạp lại hàng hóa vào màn hình Bán hàng.`)) {
        // 2. Chuyển hướng sang màn hình POS trước
        switchToPOS();

        // 3. Tạo một Tab mới dành riêng cho việc sửa hóa đơn này
        tabCounter++;
        const newTab = {
            id: Date.now(),
            name: `Sửa ${inv.id}`,
            items: JSON.parse(JSON.stringify(inv.items)), // Copy sâu danh sách hàng
            priceBook: inv.priceBook || 'default',
            discount: inv.invoiceDiscount || 0,
            extraFee: 0,
            isEditing: true, // Đánh dấu đây là tab đang sửa
            oldInvId: inv.id // Lưu lại ID cũ để xử lý ghi đè nếu cần
        };

        posTabs.push(newTab);
        activeTabIndex = posTabs.length - 1;

        // 4. Cập nhật giao diện POS
        renderPOSTabs();
        renderPOSCart();
        
        // Đồng bộ bảng giá và giảm giá lên giao diện POS
        document.getElementById('pos-pricebook-select').value = newTab.priceBook;
        document.getElementById('pos-discount').value = newTab.discount;
        
        alert(`Đã nạp dữ liệu hóa đơn ${invId}. Bạn có thể thay đổi và thanh toán như hóa đơn mới.`);
    }
}
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

// Áp dụng cho Tài khoản: Tìm hàm saveAccount() của bạn và thêm dòng này vào cuối
function saveAccount() {
    // ... code lưu account vào mảng accounts của bạn ...
    localStorage.setItem('kv_accounts', JSON.stringify(accounts));
    
    // Đẩy lên Cloud ngay lập tức
    uploadToCloud('accounts', accounts);
}


window.deleteProduct = function(productId, productName) {
    showConfirm(`Bạn có chắc muốn xóa vĩnh viễn hàng hóa: <b>${productName}</b>?`, function() {
        // Lọc bỏ sản phẩm khỏi mảng hiện tại
        products = products.filter(p => p.id !== productId);
        localStorage.setItem('kv_products', JSON.stringify(products));
        
        // Đồng bộ lên Firebase ngay lập tức
        if (typeof window.uploadToCloud === 'function') {
            window.uploadToCloud('products', products);
        }
        
        showToast("Đã xóa hàng hóa thành công", "success");
        renderProductList(); // Vẽ lại bảng danh sách hàng
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
    if (!rawText.trim()) {
        alert("Vui lòng dán dữ liệu vào ô trống!");
        return;
    }

    const lines = rawText.split('\n').filter(line => line.trim() !== '');
    const headers = lines[0].split('\t').map(h => h.trim().toLowerCase());
    
    const colMap = {
        code: headers.findIndex(h => h.includes('mã hàng')),
        barcode: headers.findIndex(h => h.includes('mã vạch')),
        name: headers.findIndex(h => h.includes('tên hàng')),
        price: headers.findIndex(h => h.includes('giá bán')),
        cost: headers.findIndex(h => h.includes('giá vốn')),
        group: headers.findIndex(h => h.includes('nhóm hàng')),
        stock: headers.findIndex(h => h.includes('tồn kho'))
    };

    if (colMap.name === -1) {
        alert("Không tìm thấy cột 'Tên hàng'!");
        return;
    }

    let newProducts = [];
    const parseExcelNumber = (val) => {
        if (!val) return 0;
        return parseFloat(val.toString().replace(/,/g, '').replace(/\./g, '').trim()) || 0;
    };

    for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split('\t');
        const name = cols[colMap.name]?.trim();
        if (!name) continue;

        const basePrice = colMap.price !== -1 ? parseExcelNumber(cols[colMap.price]) : 0;

        newProducts.push({
            id: 'ID' + Date.now() + i,
            code: colMap.code !== -1 && cols[colMap.code] ? cols[colMap.code].trim() : ('HH' + Date.now() + i),
            barcode: colMap.barcode !== -1 ? cols[colMap.barcode]?.trim() : '',
            name: name,
            price: basePrice,
            cost: colMap.cost !== -1 ? parseExcelNumber(cols[colMap.cost]) : 0,
            stock: colMap.stock !== -1 ? parseExcelNumber(cols[colMap.stock]) : 0,
            group: colMap.group !== -1 ? cols[colMap.group]?.trim() : '', // Lưu tạm tên nhóm dạng chữ
            sellDirect: true,
            units: [{ name: 'Cái', rate: 1, isBase: true, price: basePrice }]
        });
    }

    if (newProducts.length > 0) {
        // --- BƯỚC QUAN TRỌNG NHẤT: Tạo nhóm và lấy ID nhóm thay cho tên chữ ---
        updateGroupsFromImport(newProducts); 

        let currentProds = JSON.parse(localStorage.getItem('kv_products')) || [];
        window.products = [...currentProds, ...newProducts];
        
        localStorage.setItem('kv_products', JSON.stringify(window.products));
        if (typeof window.uploadToCloud === 'function') window.uploadToCloud('products', window.products);

        alert(`Đã tạo thành công ${newProducts.length} hàng hóa và cập nhật danh mục nhóm!`);
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

// 1. Hàm tính toán số liệu tổng quan và vẽ biểu đồ
window.renderDashboardSummary = function() {
    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];

    // HÀM MỚI: Bóc tách ngày tháng năm cực kỳ chuẩn xác từ mọi định dạng
    const extractDate = (timeStr) => {
        if (!timeStr) return null;
        const match = timeStr.match(/(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/);
        if (match) return { d: parseInt(match[1]), m: parseInt(match[2]), y: parseInt(match[3]) };
        return null;
    };

    const today = new Date();
    const yesterday = new Date(today.getTime() - 86400000);
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate());

    // HÀM MỚI: So sánh 2 ngày chính xác tuyệt đối
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

    // Duyệt qua toàn bộ hóa đơn để gom số liệu
    allInvoices.forEach(inv => {
        if (inv.status === 'done') {
            const amount = (inv.totalAmount || 0) - (inv.invoiceDiscount || 0);
            const invDate = extractDate(inv.createdAt);
            
            if (!invDate) return;

            // Hôm nay
            if (isSameDay(invDate, today)) {
                if (amount < 0) todayReturn += Math.abs(amount);
                else todayRev += amount;
            }
            // Hôm qua
            else if (isSameDay(invDate, yesterday)) {
                if (amount >= 0) yesterdayRev += amount;
            }
            // Tháng trước
            else if (isSameMonth(invDate, lastMonth)) {
                if (amount >= 0) lastMonthRev += amount;
            }
        }
    });

    // Hàm tính phần trăm tăng trưởng
    const calcPercent = (current, past) => {
        if (past === 0) return current > 0 ? 100 : 0;
        return Math.round(((current - past) / past) * 100);
    };

    const percentYesterday = calcPercent(todayRev, yesterdayRev);
    const percentLastMonth = calcPercent(todayRev, lastMonthRev);

    // Đổ số liệu lên 4 ô Widget
    const summaryValues = document.querySelectorAll('#tab-tong-quan .sum-value');
    if (summaryValues.length >= 4) {
        summaryValues[0].innerText = todayRev.toLocaleString('vi-VN');
        summaryValues[1].innerText = todayReturn.toLocaleString('vi-VN');

        // Logic mũi tên xanh/đỏ cho % Hôm qua
        const yIcon = percentYesterday >= 0 ? '<i class="fa-solid fa-arrow-trend-up"></i>' : '<i class="fa-solid fa-arrow-trend-down"></i>';
        const yColor = percentYesterday >= 0 ? '#5cb85c' : '#d9534f';
        summaryValues[2].innerHTML = `<span style="color:${yColor}">${yIcon} ${Math.abs(percentYesterday)}%</span>`;

        // Logic mũi tên xanh/đỏ cho % Tháng trước
        const mIcon = percentLastMonth >= 0 ? '<i class="fa-solid fa-arrow-trend-up"></i>' : '<i class="fa-solid fa-arrow-trend-down"></i>';
        const mColor = percentLastMonth >= 0 ? '#5cb85c' : '#d9534f';
        summaryValues[3].innerHTML = `<span style="color:${mColor}">${mIcon} ${Math.abs(percentLastMonth)}%</span>`;
    }
    
    // Đổ số liệu lên chữ Doanh thu thuần to đùng
    const bigRevenue = document.querySelector('#tab-tong-quan .widget-title span');
    if (bigRevenue) bigRevenue.innerText = todayRev.toLocaleString('vi-VN');

    // GỌI HÀM VẼ BIỂU ĐỒ 7 NGÀY
    render7DaysChart(allInvoices, today);
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

// 2. Hàm gom dữ liệu và vẽ Timeline Hoạt động gần đây
window.renderActivityFeed = function() {
    const feedContainer = document.querySelector('.activity-feed');
    if (!feedContainer) return;

    const allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
    const allImportOrders = JSON.parse(localStorage.getItem('kv_import_orders')) || [];
    const allInventoryChecks = JSON.parse(localStorage.getItem('kv_inventory_checks')) || [];

    let activities = [];

    // Hàm tiện ích: Chuyển chuỗi "15:30:00 10/04/2026" thành số miliseconds để dễ sắp xếp
    const parseVNTime = (timeStr) => {
        if(!timeStr) return 0;
        try {
            const parts = timeStr.replace(',', '').split(' ');
            if(parts.length !== 2) return 0;
            const timeParts = parts[0].split(':');
            const dateParts = parts[1].split('/');
            return new Date(dateParts[2], dateParts[1]-1, dateParts[0], timeParts[0], timeParts[1], timeParts[2]||0).getTime();
        } catch(e) { return 0; }
    };

    // Nhặt Hóa đơn
    allInvoices.forEach(inv => {
        activities.push({
            type: 'invoice', id: inv.id, creator: inv.creator, timeStr: inv.createdAt,
            timestamp: parseVNTime(inv.createdAt), amount: (inv.totalAmount || 0) - (inv.invoiceDiscount || 0), status: inv.status
        });
    });

    // Nhặt Phiếu nhập hàng
    allImportOrders.forEach(io => {
        activities.push({
            type: 'import', id: io.id, creator: io.creator, timeStr: io.createdAt,
            timestamp: io.timestamp || parseVNTime(io.createdAt), amount: io.mustPay || 0, status: io.status
        });
    });

    // Nhặt Phiếu kiểm kho
    allInventoryChecks.forEach(ic => {
        activities.push({
            type: 'inventory', id: ic.code, creator: ic.creator, timeStr: new Date(ic.id).toLocaleString('vi-VN'),
            timestamp: ic.id, amount: 0, status: ic.status
        });
    });

    // Sắp xếp trộn lẫn tất cả theo thời gian (Mới nhất nằm trên)
    activities.sort((a, b) => b.timestamp - a.timestamp);

    // Cắt lấy 20 hoạt động gần nhất để web không bị nặng
    const recentActivities = activities.slice(0, 20);

    if (recentActivities.length === 0) {
        feedContainer.innerHTML = `<div class="empty-data" style="height: 300px; color: #ccc;"><i class="fa-solid fa-clock-rotate-left"></i><p>Chưa có hoạt động nào</p></div>`;
        return;
    }

    let html = '';
    recentActivities.forEach(act => {
        let icon = '', color = '', bg = '', title = '', amountHtml = '';

        // Tùy chỉnh màu sắc và Icon cho từng loại giao dịch
        if (act.type === 'invoice') {
            icon = '<i class="fa-solid fa-file-invoice-dollar"></i>';
            color = '#28a745'; bg = '#e8f5e9'; title = 'Bán hàng';
            amountHtml = `<div style="font-weight: bold; color: #28a745;">+${act.amount.toLocaleString('vi-VN')}</div>`;
        } else if (act.type === 'import') {
            icon = '<i class="fa-solid fa-truck-ramp-box"></i>';
            color = '#007bff'; bg = '#e6f2ff'; title = 'Nhập hàng';
            amountHtml = `<div style="font-weight: bold; color: #dc3545;">-${act.amount.toLocaleString('vi-VN')}</div>`;
        } else if (act.type === 'inventory') {
            icon = '<i class="fa-solid fa-boxes-stacked"></i>';
            color = '#f0ad4e'; bg = '#fcf8e3'; title = 'Kiểm kho';
            amountHtml = `<div style="font-size: 12px; font-weight: bold; color: #f0ad4e;">${act.status === 'done' ? 'Đã cân bằng' : (act.status === 'cancel' ? 'Đã hủy' : 'Đang kiểm')}</div>`;
        }

        // Nếu giao dịch bị hủy, gạch ngang tiền
        if (act.status === 'cancel') {
            amountHtml = `<div style="font-size: 12px; color: #d9534f; text-decoration: line-through;">${act.amount.toLocaleString('vi-VN')}</div>`;
        }

        html += `
            <div style="display: flex; gap: 15px; margin-bottom: 15px; border-bottom: 1px solid #f5f5f5; padding-bottom: 15px; align-items: center;">
                <div style="width: 40px; height: 40px; border-radius: 50%; background: ${bg}; color: ${color}; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0;">
                    ${icon}
                </div>
                <div style="flex: 1;">
                    <div style="font-weight: bold; color: #333; font-size: 13px;">${act.id} ${act.status === 'cancel' ? '<span style="color: red; font-size: 11px;">(Đã hủy)</span>' : ''}</div>
                    <div style="font-size: 12px; color: #555; margin-top: 2px;">${title} - ${act.creator || 'Hệ thống'}</div>
                    <div style="font-size: 11px; color: #888; margin-top: 4px;">${act.timeStr}</div>
                </div>
                ${amountHtml}
            </div>
        `;
    });

    feedContainer.innerHTML = html;
};


window.printReceipt = function(invoice) {
    let printSection = document.getElementById('print-section');
    if (!printSection) {
        printSection = document.createElement('div');
        printSection.id = 'print-section';
        document.body.appendChild(printSection);
    }

    let itemsHtml = '';
    invoice.items.forEach(item => {
        itemsHtml += `
            <tr>
                <td style="padding: 8px 0; font-size: 15px; line-height: 1.4;">${item.name}</td>
                <td style="text-align: center; padding: 8px 0; font-size: 15px;">${item.qty}</td>
                <td style="text-align: right; padding: 8px 0; font-size: 15px; font-weight: bold;">${(item.qty * item.price).toLocaleString('vi-VN')}</td>
            </tr>
        `;
    });

    // Mẫu bill đã được phóng to và xóa các thông tin thừa
    printSection.innerHTML = `
        <div style="width: 100%; font-family: 'Segoe UI', Arial, sans-serif; color: #000;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0; font-size: 24px; font-weight: bold; text-transform: uppercase;">Hóa Đơn Bán Hàng</h2>
                <p style="margin: 5px 0; font-size: 14px;">Địa chỉ: Đà Lạt, Lâm Đồng</p>
                <div style="border-top: 2px dashed #000; margin: 15px 0;"></div>
            </div>

            <div style="font-size: 15px; margin-bottom: 15px; line-height: 1.6;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Mã HĐ: <strong>${invoice.id}</strong></span>
                </div>
                <div>Thời gian: ${invoice.createdAt}</div>
                <div>Thu ngân: ${invoice.creator}</div>
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

            <div style="font-size: 16px; line-height: 2;">
                <div style="display: flex; justify-content: space-between;">
                    <span>Tổng tiền hàng:</span>
                    <span>${invoice.totalAmount.toLocaleString('vi-VN')}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>Giảm giá:</span>
                    <span>${invoice.invoiceDiscount.toLocaleString('vi-VN')}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: bold; margin-top: 10px; border-top: 1px solid #000; padding-top: 10px;">
                    <span>KHÁCH TRẢ:</span>
                    <span>${invoice.customerPaid.toLocaleString('vi-VN')}</span>
                </div>
            </div>

            <div style="text-align: center; margin-top: 30px; font-size: 16px; font-style: italic;">
                <p>Cảm ơn Quý khách. Hẹn gặp lại!</p>
            </div>
        </div>
    `;

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
        
        // --- ĐÃ THAY ĐỔI VỊ TRÍ XUỐNG GÓC DƯỚI TRÁI ---
        statusDiv.style.position = 'fixed';
        statusDiv.style.bottom = '20px'; // Cách đáy 20px
        statusDiv.style.left = '20px';   // Cách lề trái 20px
        
        statusDiv.style.zIndex = '9999';
        statusDiv.style.padding = '8px 20px';
        statusDiv.style.borderRadius = '30px';
        statusDiv.style.fontWeight = 'bold';
        statusDiv.style.fontSize = '13px';
        statusDiv.style.boxShadow = '0 3px 10px rgba(0,0,0,0.15)';
        statusDiv.style.transition = 'all 0.3s ease';
        statusDiv.style.display = 'none'; // Tạm ẩn, chỉ hiện ở POS
        document.body.appendChild(statusDiv);
    }
    window.updatePrintStatusUI();
};

// 2. Hàm thay đổi giao diện Nút trạng thái
window.updatePrintStatusUI = function() {
    const statusDiv = document.getElementById('print-status-indicator');
    if (!statusDiv) return;

    // Lấy view POS hiện tại
    const posView = document.getElementById('pos-view');
    if (posView && posView.style.display !== 'none') {
        statusDiv.style.display = 'block'; // Chỉ hiện ở màn POS
        
        if (window.autoPrintMode) {
            statusDiv.innerHTML = '<i class="fa-solid fa-print"></i> Chế độ In (F2): ĐANG BẬT';
            statusDiv.style.backgroundColor = '#28a745'; // Màu xanh lá cực nổi
            statusDiv.style.color = 'white';
            statusDiv.style.border = 'none';
        } else {
            statusDiv.innerHTML = '<i class="fa-solid fa-print" style="opacity: 0.6;"></i> Chế độ In (F2): ĐANG TẮT';
            statusDiv.style.backgroundColor = 'white'; // Nền trắng
            statusDiv.style.color = '#555';
            statusDiv.style.border = '1px solid #ccc';
        }
    } else {
        statusDiv.style.display = 'none';
    }
};

// ==========================================
// HỆ THỐNG PHÍM TẮT TOÀN CỤC (GLOBAL SHORTCUTS)
// ==========================================
document.addEventListener('keydown', function(e) {
    // 1. Xử lý phím ESC - Dùng được ở mọi màn hình
    if (e.key === 'Escape') {
        // Đóng các màn hình lớn
        if (typeof closeCreateImportView === 'function') closeCreateImportView();
        if (typeof closeCreateCheckView === 'function') closeCreateCheckView();
        
        // Đóng tất cả các modal overlay
        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.style.display = 'none';
        });

        // Đóng các dropdown tìm kiếm và menu
        const dropdowns = ['pos-search-dropdown', 'ic-search-dropdown', 'io-search-dropdown', 'pos-hamburger-menu'];
        dropdowns.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.display = 'none';
        });
        return; // Thoát hàm sau khi xử lý ESC
    }

    // 2. Các phím tắt dành riêng cho màn hình Bán hàng (POS)
    const posView = document.getElementById('pos-view');
    if (posView && posView.style.display === 'flex') {
        
        switch (e.key) {
            case 'F1':
                e.preventDefault();
                e.stopImmediatePropagation(); // Ngăn chặn sự kiện bị kích hoạt 2 lần
                
                addPOSTab(); // Gọi hàm tạo tab mới
                
                // Tự động focus vào ô tìm kiếm sau khi tạo tab
                setTimeout(() => {
                    const searchInput = document.getElementById('pos-search-input');
                    if (searchInput) {
                        searchInput.focus();
                    }
                }, 100);
                break;

            case 'F2':
                e.preventDefault();
                // Bật/Tắt chế độ tự động in hóa đơn
                window.autoPrintMode = !window.autoPrintMode;
                if (typeof window.updatePrintStatusUI === 'function') {
                    window.updatePrintStatusUI();
                }
                break;

            case 'F3':
                e.preventDefault();
                const searchInput = document.getElementById('pos-search-input');
                if (searchInput) {
                    searchInput.focus();
                    searchInput.select(); // Bôi đen để gõ đè nhanh
                }
                break;

            case 'F9':
                e.preventDefault();
                // Thực hiện thanh toán
                if (typeof processCheckout === 'function') {
                    processCheckout();
                }
                break;

            case 'F11':
                // Để trình duyệt xử lý mặc định hoặc tùy biến thêm tại đây
                break;
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

window.deleteInvoice = function(invoiceId) {
    showConfirm(`Bạn có muốn HỦY hóa đơn ${invoiceId}? Hàng sẽ được trả lại kho.`, function() {
        let allInvoices = JSON.parse(localStorage.getItem('kv_invoices')) || [];
        let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];

        const invIdx = allInvoices.findIndex(inv => inv.id === invoiceId);
        if (invIdx === -1) return;

        allInvoices[invIdx].status = 'cancel';

        // Cập nhật tồn kho cho từng món
        allInvoices[invIdx].items.forEach(item => {
            const pIdx = allProducts.findIndex(p => p.id === item.productId);
            if (pIdx !== -1) {
                const rate = item.units && item.units[item.selectedUnitIdx] ? item.units[item.selectedUnitIdx].rate : 1;
                allProducts[pIdx].stock += (item.qty * rate);
            }
        });

        localStorage.setItem('kv_invoices', JSON.stringify(allInvoices));
        localStorage.setItem('kv_products', JSON.stringify(allProducts));
        
        // ĐẨY LÊN FIREBASE (QUAN TRỌNG)
        if (window.uploadToCloud) {
            window.uploadToCloud('invoices', allInvoices);
            window.uploadToCloud('products', allProducts);
        }

        renderInvoices();
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

// Nâng cấp: Tự động bung nhóm cha nếu tìm thấy nhóm con
window.filterGroupTree = function() {
    const kw = document.getElementById('search-group-filter').value.toLowerCase().trim();
    const items = document.querySelectorAll('.group-tree-item');
    
    // 1. Tạm thời ẩn hết đi
    items.forEach(item => item.style.display = 'none');

    // Nếu xóa rỗng thanh tìm kiếm, hiện lại tất cả nhưng giữ nguyên trạng thái đóng/mở
    if (kw === '') {
        items.forEach(item => item.style.display = 'flex');
        return;
    }

    // 2. Tìm item khớp từ khóa
    items.forEach(item => {
        const name = item.getAttribute('data-name');
        if (name.includes(kw)) {
            item.style.display = 'flex'; // Hiện chính nó lên
            
            // Lần ngược lên các div chứa nó (nhóm cha) để bắt chúng mở ra
            let parentContainer = item.closest('.group-children-container');
            while (parentContainer) {
                parentContainer.style.display = 'block'; // Mở div bọc nhóm con
                
                const parentId = parentContainer.id.replace('group-children-', '');
                
                // Bắt cái thẻ hiển thị tên nhóm cha cũng phải hiện lên
                const parentItem = document.querySelector(`.group-tree-item input[value="${parentId}"]`)?.closest('.group-tree-item');
                if (parentItem) parentItem.style.display = 'flex';

                // Quay mũi tên của nhóm cha hướng xuống
                const parentIcon = document.querySelector(`.group-toggle-icon[onclick*="${parentId}"]`);
                if (parentIcon) {
                    parentIcon.classList.remove('fa-chevron-right');
                    parentIcon.classList.add('fa-chevron-down');
                }
                
                // Tiếp tục leo lên ông nội, cụ cố... (nếu lồng nhiều cấp)
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

window.filterPriceGroupTree = function() {
    const kw = document.getElementById('search-price-group-filter').value.toLowerCase().trim();
    const items = document.querySelectorAll('.price-group-tree-item');
    items.forEach(item => item.style.display = 'none');

    if (kw === '') {
        items.forEach(item => item.style.display = 'flex');
        return;
    }

    items.forEach(item => {
        const name = item.getAttribute('data-name');
        if (name.includes(kw)) {
            item.style.display = 'flex'; 
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
    oldRenderIC();
    window.renderICCreatorFilter();
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
    console.log("🚀 226 POS: Đang khởi tạo hệ thống và đồng bộ dữ liệu từ Cloud...");

    // 1. THIẾT LẬP LẮNG NGHE DỮ LIỆU REALTIME TỪ FIREBASE
    if (window.fbDb && window.fbOnValue) {
        const syncPaths = [
            { 
                path: 'products', 
                storageKey: 'kv_products', 
                renderFunc: () => { 
                    window.products = JSON.parse(localStorage.getItem('kv_products')) || [];
                    if (localStorage.getItem('kv_current_tab') === 'tab-danh-sach-hang') renderProductList(); 
                    if (localStorage.getItem('kv_current_tab') === 'tab-thiet-lap-gia') renderPriceSetupTable();
                    if (localStorage.getItem('kv_current_view') === 'pos-view') renderPOSCart();
                } 
            },
            { 
                path: 'invoices', 
                storageKey: 'kv_invoices', 
                renderFunc: () => { 
                    if (localStorage.getItem('kv_current_tab') === 'tab-hoa-don') renderInvoices(); 
                } 
            },
            { 
                path: 'groups', 
                storageKey: 'kv_groups', 
                renderFunc: () => { 
                    // Cập nhật biến toàn cục để các máy khác nhận được nhóm mới
                    window.productGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
                    if (typeof window.renderGroupData === 'function') window.renderGroupData(); 
                } 
            },
            { 
                path: 'pricebooks', 
                storageKey: 'kv_pricebooks', 
                renderFunc: () => { 
                    // Cập nhật biến toàn cục để đồng bộ bảng giá giữa các máy
                    window.priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
                    if (localStorage.getItem('kv_current_tab') === 'tab-thiet-lap-gia') renderPriceSetupTable();
                    if (localStorage.getItem('kv_current_view') === 'pos-view') {
                        const pbSelect = document.getElementById('pos-pricebook-select');
                        if (pbSelect) changePOSPriceBook(pbSelect.value);
                    }
                } 
            },
            { 
                path: 'inventory_checks', 
                storageKey: 'kv_inventory_checks', 
                renderFunc: () => { 
                    if (localStorage.getItem('kv_current_tab') === 'tab-kiem-kho') renderInventoryChecks(); 
                } 
            },
            { 
                path: 'import_orders', 
                storageKey: 'kv_import_orders', 
                renderFunc: () => { 
                    if (localStorage.getItem('kv_current_tab') === 'tab-nhap-hang') renderImportOrders(); 
                } 
            },
            { 
                path: 'accounts', 
                storageKey: 'kv_accounts', 
                renderFunc: () => { 
                    window.accounts = JSON.parse(localStorage.getItem('kv_accounts')) || [];
                } 
            }
        ];

        syncPaths.forEach(item => {
            window.fbOnValue(window.fbRef(window.fbDb, item.path), (snapshot) => {
                const data = snapshot.val();
                // Chuyển đổi dữ liệu từ Firebase về dạng Array chuẩn
                const dataArray = data ? (Array.isArray(data) ? data.filter(Boolean) : Object.values(data)) : [];
                localStorage.setItem(item.storageKey, JSON.stringify(dataArray));
                
                // Thực thi hàm vẽ lại giao diện tương ứng với dữ liệu vừa nhận
                item.renderFunc();
            });
        });
    }

    // 2. KHÔI PHỤC TRẠNG THÁI ĐĂNG NHẬP VÀ ĐIỀU HƯỚNG MÀN HÌNH
    const savedUser = localStorage.getItem('kv_current_user');
    const savedView = localStorage.getItem('kv_current_view');
    
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        hideAll(); 
        
        if (savedView === 'pos-view') {
            document.getElementById('pos-view').style.display = 'flex';
            initPOSData(); 
        } else {
            document.getElementById('dashboard-view').style.display = 'flex';
            
            // Đảm bảo nạp lại biến toàn cục từ LocalStorage trước khi render
            window.productGroups = JSON.parse(localStorage.getItem('kv_groups')) || [];
            window.priceBooks = JSON.parse(localStorage.getItem('kv_pricebooks')) || [];
            
            if (typeof window.renderGroupData === 'function') window.renderGroupData();

            const lastTab = localStorage.getItem('kv_current_tab') || 'tab-tong-quan';
            openDashTab(lastTab);
        }
    } else {
        hideAll();
        document.getElementById('login-view').style.display = 'flex';
    }

    // 3. KHỞI TẠO CÁC TIỆN ÍCH HỆ THỐNG
    if (typeof window.initPrintStatusUI === 'function') {
        window.initPrintStatusUI(); 
    }
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
window.openDashTab = function(tabId, navElement = null) {
    originalOpenDashTab(tabId, navElement);
    if (tabId === 'tab-cap-nhat-hang') {
        window.currentUpdatePage = 1;
        window.pendingBatchUpdates = {}; 
        renderBatchUpdateTable();
    }
};

window.renderBatchUpdateTable = function() {
    const thead = document.querySelector('#batch-update-table thead');
    const tbody = document.querySelector('#batch-update-table tbody');
    if (!thead || !tbody) return;

    const attr = document.getElementById('batch-update-attr').value;
    const keyword = (document.getElementById('search-batch-update')?.value || '').toLowerCase().trim();
    
    if (attr === 'code_and_barcode') {
        thead.innerHTML = `
            <tr>
                <th style="text-align: center; width: 60px;">STT</th>
                <th style="text-align: left; min-width: 200px;">Tên hàng</th>
                <th style="text-align: left; color: #888;">Mã hàng (Cũ)</th>
                <th style="text-align: left; color: var(--kv-blue); min-width: 160px;">
                    Mã hàng (Mới) <br>
                    <button onclick="copyColumnData('barcode', 'code')" style="margin-top:6px; padding: 4px 8px; font-size: 11px; background: var(--kv-blue); color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-arrow-left"></i> Chép từ Mã vạch qua</button>
                </th>
                <th style="text-align: left; color: #888;">Mã vạch (Cũ)</th>
                <th style="text-align: left; color: var(--kv-pink); min-width: 160px;">
                    Mã vạch (Mới) <br>
                    <button onclick="copyColumnData('code', 'barcode')" style="margin-top:6px; padding: 4px 8px; font-size: 11px; background: var(--kv-pink); color: white; border: none; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 4px;"><i class="fa-solid fa-arrow-left"></i> Chép từ Mã hàng qua</button>
                </th>
            </tr>
        `;
    } else {
        let attrLabel = '';
        if (attr === 'name') attrLabel = 'Tên hàng hóa';
        else if (attr === 'code') attrLabel = 'Mã hàng';
        else if (attr === 'barcode') attrLabel = 'Mã vạch';
        else if (attr === 'group') attrLabel = 'Nhóm hàng';
        else if (attr === 'cost') attrLabel = 'Giá vốn';
        else if (attr === 'stock') attrLabel = 'Tồn kho';

        thead.innerHTML = `
            <tr>
                <th style="text-align: center; width: 60px;">STT</th>
                <th style="text-align: left; min-width: 100px;">Mã hàng</th>
                <th style="text-align: left; min-width: 250px;">Tên hàng</th>
                <th style="text-align: left; color: #888;">${attrLabel} (Cũ)</th>
                <th style="text-align: left; color: var(--kv-blue); min-width: 200px;">${attrLabel} (Mới)</th>
            </tr>
        `;
    }

    const allProds = JSON.parse(localStorage.getItem('kv_products')) || [];
    let filtered = allProds.filter(p => {
        return (p.name || '').toLowerCase().includes(keyword) || 
               (p.code || '').toLowerCase().includes(keyword) ||
               (p.barcode || '').toLowerCase().includes(keyword);
    });

    const itemsPerPage = 100;
    const totalPages = Math.ceil(filtered.length / itemsPerPage);
    if (window.currentUpdatePage > totalPages) window.currentUpdatePage = totalPages || 1;
    if (window.currentUpdatePage < 1) window.currentUpdatePage = 1;

    const startIndex = (window.currentUpdatePage - 1) * itemsPerPage;
    const paginatedProducts = filtered.slice(startIndex, startIndex + itemsPerPage);

    let groupOptions = '<option value="">-- Xóa khỏi nhóm --</option>';
    if (attr === 'group') {
        productGroups.forEach(g => { groupOptions += `<option value="${g.id}">${g.name}</option>`; });
    }

    let tbHtml = '';
    paginatedProducts.forEach((p, index) => {
        const stt = startIndex + index + 1;
        
        if (attr === 'code_and_barcode') {
            const pendingObj = window.pendingBatchUpdates[p.id] || {};
            const pendingCode = pendingObj.code !== undefined ? pendingObj.code : '';
            const pendingBarcode = pendingObj.barcode !== undefined ? pendingObj.barcode : '';

            tbHtml += `
                <tr style="border-bottom: 1px dashed #eee;">
                    <td style="text-align: center; color: #888;">${stt}</td>
                    <td style="font-weight: bold;">${p.name}</td>
                    <td style="color: #888; background: #fafafa;">${p.code || '---'}</td>
                    <td style="background: #fdfdfd;">
                        <input type="text" class="batch-input-code" value="${pendingCode}" placeholder="Sửa mã hàng..." oninput="recordBatchUpdateDual('${p.id}', 'code', this.value)" onpaste="handlePasteExcel(event, this, 'code')" style="width: 100%; padding: 6px; border: 1px solid var(--kv-blue); border-radius: 4px; outline: none;">
                    </td>
                    <td style="color: #888; background: #fafafa;">${p.barcode || '---'}</td>
                    <td style="background: #fff0f5;">
                        <input type="text" class="batch-input-barcode" value="${pendingBarcode}" placeholder="Sửa mã vạch..." oninput="recordBatchUpdateDual('${p.id}', 'barcode', this.value)" onpaste="handlePasteExcel(event, this, 'barcode')" style="width: 100%; padding: 6px; border: 1px solid var(--kv-pink); border-radius: 4px; outline: none;">
                    </td>
                </tr>
            `;
        } else {
            let oldValue = p[attr] || '';
            if (attr === 'group') {
                const g = productGroups.find(x => x.id === p.group);
                oldValue = g ? g.name : '---';
            } else if (attr === 'cost' || attr === 'stock') {
                oldValue = (p[attr] || 0).toLocaleString('vi-VN');
            }

            const pendingValue = window.pendingBatchUpdates[p.id] !== undefined ? window.pendingBatchUpdates[p.id] : '';

            let inputHtml = '';
            if (attr === 'group') {
                inputHtml = `<select class="batch-input-group" onchange="recordBatchUpdate('${p.id}', this.value)" style="width: 100%; padding: 6px; border: 1px solid var(--kv-blue); border-radius: 4px; outline: none; background: #f0f7ff;">
                                <option value="" disabled ${pendingValue === '' ? 'selected' : ''}>Chọn nhóm mới...</option>
                                ${groupOptions}
                             </select>`;
                if (pendingValue) inputHtml = inputHtml.replace(`value="${pendingValue}"`, `value="${pendingValue}" selected`);
            } else if (attr === 'cost' || attr === 'stock') {
                inputHtml = `<input type="text" class="batch-input-${attr}" value="${pendingValue}" placeholder="Nhập số mới..." oninput="formatCurrency(this); recordBatchUpdate('${p.id}', window.parseCurrency(this.value))" onpaste="handlePasteExcel(event, this, '${attr}')" style="width: 100%; padding: 6px 10px; border: 1px solid var(--kv-blue); border-radius: 4px; outline: none;">`;
            } else {
                inputHtml = `<input type="text" class="batch-input-${attr}" value="${pendingValue}" placeholder="Nhập mới..." oninput="recordBatchUpdate('${p.id}', this.value)" onpaste="handlePasteExcel(event, this, '${attr}')" style="width: 100%; padding: 6px 10px; border: 1px solid var(--kv-blue); border-radius: 4px; outline: none;">`;
            }

            tbHtml += `
                <tr style="border-bottom: 1px dashed #eee;">
                    <td style="text-align: center; color: #888;">${stt}</td>
                    <td style="font-weight: bold;">${p.code}</td>
                    <td>${p.name}</td>
                    <td style="color: #888; background: #fafafa;">${oldValue}</td>
                    <td style="background: #fdfdfd;">${inputHtml}</td>
                </tr>
            `;
        }
    });

    tbody.innerHTML = tbHtml;
    window.renderPaginationControls('update-pagination', window.currentUpdatePage, totalPages, 'changeUpdatePage');
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

    if (!confirm(`Bạn sắp cập nhật dữ liệu cho ${updateIds.length} mặt hàng. Bạn có chắc chắn?`)) return;

    let allProducts = JSON.parse(localStorage.getItem('kv_products')) || [];
    
    // Xử lý lưu dữ liệu
    updateIds.forEach(id => {
        const prodIndex = allProducts.findIndex(p => p.id === id);
        if (prodIndex !== -1) {
            if (attr === 'code_and_barcode') {
                // Xử lý lưu song song 2 mã
                const updates = window.pendingBatchUpdates[id];
                if (updates.code !== undefined && updates.code.trim() !== '') allProducts[prodIndex].code = updates.code.trim();
                if (updates.barcode !== undefined && updates.barcode.trim() !== '') allProducts[prodIndex].barcode = updates.barcode.trim();
            } else {
                // Xử lý lưu các thuộc tính khác bình thường
                allProducts[prodIndex][attr] = window.pendingBatchUpdates[id];
            }
        }
    });

    // Lưu vào máy và đẩy lên Firebase
    localStorage.setItem('kv_products', JSON.stringify(allProducts));
    if (typeof window.uploadToCloud === 'function') {
        window.uploadToCloud('products', allProducts);
    }
    
    window.products = allProducts;
    window.pendingBatchUpdates = {};
    
    alert("Cập nhật hàng loạt thành công!");
    renderBatchUpdateTable();
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

window.applyQuickAdd = function(basePrice, addAmount, pbId, productId, inputId) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    // Tính giá mới = Giá gốc + Số tiền (k) * 1000
    const newPrice = basePrice + (addAmount * 1000);
    
    // Đẩy số vào ô input và format lại
    inputEl.value = newPrice.toLocaleString('vi-VN');

    // Lưu thẳng vào cơ sở dữ liệu
    updatePriceBookValue(pbId, productId, newPrice);

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
    let type = 'warning'; // Mặc định là cảnh báo vàng
    let lowerMsg = msg.toLowerCase();
    
    // AI tự nhận diện nội dung để gán màu sắc phù hợp
    if (lowerMsg.includes('thành công') || lowerMsg.includes('tuyệt vời') || lowerMsg.includes('đã lưu')) {
        type = 'success';
    } else if (lowerMsg.includes('lỗi') || lowerMsg.includes('không') || lowerMsg.includes('sai') || lowerMsg.includes('chưa')) {
        type = 'error';
    }
    
    showToast(msg, type);
};

// 4. Hàm hiển thị Hộp thoại Xác nhận (Confirm)
window.showConfirm = function(message, onConfirmCallback) {
    const modal = document.getElementById('custom-confirm-modal');
    document.getElementById('confirm-message').innerHTML = message.replace(/\n/g, '<br>');
    modal.style.display = 'flex';

    const btnOk = document.getElementById('btn-confirm-ok');
    const btnCancel = document.getElementById('btn-confirm-cancel');

    // Mẹo: Gỡ bỏ sự kiện click cũ để tránh bị chạy lặp lệnh
    const newBtnOk = btnOk.cloneNode(true);
    const newBtnCancel = btnCancel.cloneNode(true);
    btnOk.parentNode.replaceChild(newBtnOk, btnOk);
    btnCancel.parentNode.replaceChild(newBtnCancel, btnCancel);

    newBtnCancel.onclick = function() {
        modal.style.display = 'none';
    };

    newBtnOk.onclick = function() {
        modal.style.display = 'none';
        if (typeof onConfirmCallback === 'function') onConfirmCallback();
    };
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
// Tính năng: Click vào ô là bôi đen toàn bộ nội dung (Dành cho Search và Input số)
document.addEventListener('focusin', function(e) {
    if (e.target.tagName === 'INPUT' && (
        e.target.id.includes('search') || 
        e.target.id.includes('qty') || 
        e.target.id.includes('price') ||
        e.target.classList.contains('variant-input')
    )) {
        setTimeout(() => {
            e.target.select();
        }, 50); // Delay nhẹ để đảm bảo trình duyệt đã focus xong
    }
});