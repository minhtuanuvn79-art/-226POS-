// =========================================
// CHỐT CHẶN BẢO MẬT: BẮT BUỘC ĐĂNG NHẬP
// =========================================
(function checkManagerAuth() {
    const isLoggedIn = localStorage.getItem('isLoggedIn');
    if (!isLoggedIn) {
        window.location.href = 'login.html';
    }
    
    document.addEventListener('DOMContentLoaded', () => {
        const currentUser = localStorage.getItem('currentUser');
        const role = localStorage.getItem('currentRole');
        const userElement = document.querySelector('.admin-user');
        if (userElement && currentUser) {
            userElement.innerHTML = `<i class="fa-solid fa-user-tie"></i> ${currentUser} <small>(${role})</small>`;
        }
    });
})();

// =========================================
// LÕI HỆ THỐNG THÔNG BÁO XỊN (AppModal)
// =========================================
const AppModal = {
    init: function() {
        if (document.getElementById('custom-modal-overlay')) return;
        const html = `
            <div id="custom-modal-overlay" class="custom-modal-overlay">
                <div class="custom-modal">
                    <div id="custom-modal-icon" class="custom-modal-icon"></div>
                    <h3 id="custom-modal-title" class="custom-modal-title"></h3>
                    <p id="custom-modal-msg" class="custom-modal-msg"></p>
                    <div class="custom-modal-actions">
                        <button id="custom-modal-cancel" class="custom-modal-btn modal-btn-cancel">Hủy</button>
                        <button id="custom-modal-ok" class="custom-modal-btn modal-btn-ok">Đồng ý</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', html);
    },
    show: function(options) {
        this.init();
        const overlay = document.getElementById('custom-modal-overlay');
        const icon = document.getElementById('custom-modal-icon');
        const title = document.getElementById('custom-modal-title');
        const msg = document.getElementById('custom-modal-msg');
        const btnCancel = document.getElementById('custom-modal-cancel');
        const btnOk = document.getElementById('custom-modal-ok');

        title.innerText = options.title || 'Thông báo';
        msg.innerHTML = options.msg || '';

        let iconHtml = '', btnClass = '';
        switch(options.type) {
            case 'success': iconHtml = '<i class="fa-regular fa-circle-check"></i>'; icon.className = 'custom-modal-icon success'; btnClass = 'btn-success'; break;
            case 'error': iconHtml = '<i class="fa-regular fa-circle-xmark"></i>'; icon.className = 'custom-modal-icon error'; btnClass = 'btn-danger'; break;
            case 'warning': iconHtml = '<i class="fa-solid fa-triangle-exclamation"></i>'; icon.className = 'custom-modal-icon warning'; btnClass = 'btn-danger'; break;
            default: iconHtml = '<i class="fa-solid fa-circle-info"></i>'; icon.className = 'custom-modal-icon info'; btnClass = '';
        }
        icon.innerHTML = iconHtml;
        btnOk.className = 'custom-modal-btn modal-btn-ok ' + btnClass;
        btnOk.innerText = options.okText || 'Đồng ý';

        if (options.showCancel) {
            btnCancel.classList.add('show'); btnCancel.innerText = options.cancelText || 'Hủy';
        } else {
            btnCancel.classList.remove('show');
        }

        overlay.classList.add('active');
        btnOk.onclick = () => { overlay.classList.remove('active'); if (options.onOk) options.onOk(); };
        btnCancel.onclick = () => { overlay.classList.remove('active'); if (options.onCancel) options.onCancel(); };
    },
    alert: function(msg, type = 'info', title = 'Thông báo', onOk = null) { this.show({ msg, type, title, onOk, showCancel: false }); },
    confirm: function(msg, onOk, title = 'Xác nhận') { this.show({ msg, type: 'warning', title, onOk, showCancel: true, okText: 'Đồng ý', cancelText: 'Đóng' }); }
};

// =========================================
// KHỞI TẠO BIẾN DỮ LIỆU CỤC BỘ
// =========================================
let db_categories = { menu: [], goods: [] };
let db_menu = [];
let db_goods = [];
let db_invoices = [];
let db_imports = [];
let db_audits = [];

let currentSearchMenu = '';
let currentSearchGood = '';
let editingCategoryType = null;
let editingCategoryId = null;
let editingMenuId = null;
let editingGoodId = null;

// Hàm chuẩn hóa tiếng Việt không dấu
function removeAccents(str) {
    return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().trim();
}
function formatMoney(amount) { return Number(amount).toLocaleString('vi-VN') + 'đ'; }
function getCurrentDate() { const d = new Date(); return `${d.getDate()}/${d.getMonth()+1}/${d.getFullYear()}`; }

// Chuyển Tab Quản lý
function switchManagerTab(tabId, element = null) {
    document.querySelectorAll('.admin-menu li:not(.menu-group)').forEach(li => li.classList.remove('active'));
    if (element) element.classList.add('active');
    else if (event && event.currentTarget) event.currentTarget.classList.add('active');
    document.querySelectorAll('.admin-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(tabId + '-tab').classList.add('active');
}
function toggleSubMenu(headerElement) {
    const submenu = headerElement.nextElementSibling;
    const icon = headerElement.querySelector('.transition-icon');
    if (submenu.classList.contains('open')) { submenu.classList.remove('open'); icon.style.transform = 'rotate(0deg)'; } 
    else { submenu.classList.add('open'); icon.style.transform = 'rotate(180deg)'; }
}
function closeManagerModal(modalId) { document.getElementById(modalId).classList.remove('active'); editingMenuId = null; editingGoodId = null; }

/* =========================================
   0. QUẢN LÝ NHÓM HÀNG & THỰC ĐƠN & KHO HÀNG
========================================= */
function createCategory() {
    const type = document.getElementById('cat-type').value; 
    const name = document.getElementById('cat-name').value;
    if(!name) return AppModal.alert("Vui lòng nhập tên nhóm!", "error");
    
    if (editingCategoryId) {
        const index = db_categories[editingCategoryType].findIndex(c => c.id === editingCategoryId);
        if (index > -1) {
            const oldName = db_categories[editingCategoryType][index].name;
            db_categories[editingCategoryType][index].name = name;
            
            if (editingCategoryType === 'menu') { 
                db_menu.forEach(m => { if(m.category === oldName) m.category = name; }); 
                saveToFirebase('menuData', db_menu); 
                renderMenu(); 
            } else { 
                db_goods.forEach(g => { if(g.category === oldName) g.category = name; }); 
                saveToFirebase('goodsData', db_goods); 
                renderGoods(); 
            }
        }
        editingCategoryId = null; editingCategoryType = null;
        AppModal.alert("Đã cập nhật nhóm hàng!", "success");
        const btn = document.querySelector('#categories-tab .btn-add'); 
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Tạo nhóm'; 
        btn.style.background = '#00b894';
    } else {
        db_categories[type].push({ id: "C" + Date.now().toString().slice(-4), name: name });
        AppModal.alert("Đã thêm nhóm hàng!", "success");
    }
    
    saveToFirebase('categoriesData', db_categories);
    document.getElementById('cat-name').value = ''; 
    renderCategories(); 
    updateCategorySelects();
}

function editCategory(type, id) {
    const cat = db_categories[type].find(c => c.id === id); if (!cat) return;
    editingCategoryType = type; editingCategoryId = id;
    document.getElementById('cat-type').value = type; document.getElementById('cat-name').value = cat.name;
    const btn = document.querySelector('#categories-tab .btn-add'); btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Cập nhật nhóm'; btn.style.background = '#0984e3';
}

function renderCategories() {
    const menuTbody = document.getElementById('menu-cat-list'); 
    const goodsTbody = document.getElementById('goods-cat-list');
    
    if(menuTbody) {
        menuTbody.innerHTML = '';
        if(db_categories.menu.length === 0) {
            menuTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#888;">Chưa có nhóm</td></tr>';
        } else {
            db_categories.menu.forEach((c) => { 
                menuTbody.innerHTML += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <i class="fa-solid fa-grip-vertical drag-handle" style="color: #b2bec3; font-size: 1.3rem; cursor: grab; padding: 10px 5px;" title="Đè và Kéo"></i> 
                            <strong>${c.name}</strong>
                        </div>
                    </td>
                    <td style="width: 120px;">
                        <button onclick="editCategory('menu', '${c.id}')" style="background:#0984e3; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px;"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteCategory('menu', '${c.id}')" style="background:#ff7675; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`; 
            });
        }
    }
    
    if(goodsTbody) {
        goodsTbody.innerHTML = '';
        if(db_categories.goods.length === 0) {
            goodsTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#888;">Chưa có nhóm</td></tr>';
        } else {
            db_categories.goods.forEach((c) => { 
                goodsTbody.innerHTML += `
                <tr>
                    <td>
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <i class="fa-solid fa-grip-vertical drag-handle" style="color: #b2bec3; font-size: 1.3rem; cursor: grab; padding: 10px 5px;" title="Đè và Kéo"></i> 
                            <strong>${c.name}</strong>
                        </div>
                    </td>
                    <td style="width: 120px;">
                        <button onclick="editCategory('goods', '${c.id}')" style="background:#0984e3; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px;"><i class="fa-solid fa-pen"></i></button>
                        <button onclick="deleteCategory('goods', '${c.id}')" style="background:#ff7675; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                    </td>
                </tr>`; 
            });
        }
    }

    // Kích hoạt tính năng kéo thả ngay sau khi danh sách được vẽ ra
    initDragAndDrop();
}
// Khai báo biến toàn cục để đảm bảo chỉ khởi tạo công cụ kéo thả 1 lần
let menuSortable, goodsSortable;

// Hàm kích hoạt Kéo - Thả
function initDragAndDrop() {
    const menuEl = document.getElementById('menu-cat-list');
    const goodsEl = document.getElementById('goods-cat-list');

    // Cấu hình kéo thả cho Nhóm Thực Đơn
    if (menuEl && !menuSortable) {
        menuSortable = new Sortable(menuEl, {
            animation: 150, // Hiệu ứng trượt mượt mà
            handle: '.drag-handle', // Bắt buộc đè ngón tay vào biểu tượng 6 chấm mới kéo được (chống lỗi khi cuộn trang)
            ghostClass: 'sortable-ghost', // Làm mờ mục đang kéo
            onEnd: function (evt) {
                // Khi thả tay ra: Cắt nhóm ở vị trí cũ và chèn vào vị trí mới
                const movedItem = db_categories.menu.splice(evt.oldIndex, 1)[0];
                db_categories.menu.splice(evt.newIndex, 0, movedItem);
                
                // Đồng bộ thứ tự mới lên Cloud ngay lập tức
                saveToFirebase('categoriesData', db_categories);
                updateCategorySelects();
            }
        });
    }

    // Cấu hình kéo thả cho Nhóm Kho Hàng
    if (goodsEl && !goodsSortable) {
        goodsSortable = new Sortable(goodsEl, {
            animation: 150,
            handle: '.drag-handle',
            ghostClass: 'sortable-ghost',
            onEnd: function (evt) {
                const movedItem = db_categories.goods.splice(evt.oldIndex, 1)[0];
                db_categories.goods.splice(evt.newIndex, 0, movedItem);
                
                saveToFirebase('categoriesData', db_categories);
                updateCategorySelects();
            }
        });
    }
}
function deleteCategory(type, id) {
    AppModal.confirm("Xóa nhóm hàng này?", () => { 
        db_categories[type] = db_categories[type].filter(c => c.id !== id); 
        saveToFirebase('categoriesData', db_categories); 
        renderCategories(); 
        updateCategorySelects(); 
    });
}
// Hàm di chuyển vị trí nhóm hàng trong mảng
function moveCategory(type, index, direction) {
    // direction: -1 (Di chuyển lên/trái), 1 (Di chuyển xuống/phải)
    const newIndex = index + direction;

    // Kiểm tra để đảm bảo không bị vượt quá giới hạn của mảng
    if (newIndex < 0 || newIndex >= db_categories[type].length) {
        return; 
    }

    // Hoán đổi vị trí 2 phần tử trong mảng
    const temp = db_categories[type][index];
    db_categories[type][index] = db_categories[type][newIndex];
    db_categories[type][newIndex] = temp;

    // Lưu mảng mới lên Firebase (Trang POS sẽ tự động nhảy vị trí ngay lập tức)
    saveToFirebase('categoriesData', db_categories);

    // Render lại giao diện bảng quản lý
    renderCategories();
    updateCategorySelects();
}
function updateCategorySelects() {
    // Nạp cho ô tạo món ăn
    const menuSel = document.getElementById('menu-category'); 
    if(menuSel) { 
        menuSel.innerHTML = '<option value="">-- Chọn nhóm món --</option>'; 
        db_categories.menu.forEach(c => menuSel.innerHTML += `<option value="${c.name}">${c.name}</option>`); 
    }
    
    // Nạp cho ô tạo nguyên liệu kho
    const goodsSel = document.getElementById('good-category'); 
    if(goodsSel) { 
        goodsSel.innerHTML = '<option value="">-- Chọn nhóm NL --</option>'; 
        db_categories.goods.forEach(c => goodsSel.innerHTML += `<option value="${c.name}">${c.name}</option>`); 
    }

    // [THÊM MỚI] Nạp cho ô chọn Nhóm hiển thị tại POS (khi bật Cho phép bán lẻ)
    const goodPosSel = document.getElementById('good-pos-category');
    if(goodPosSel) { 
        goodPosSel.innerHTML = '<option value="">-- Chọn nhóm tại POS --</option>'; 
        db_categories.menu.forEach(c => goodPosSel.innerHTML += `<option value="${c.name}">${c.name}</option>`); 
    }
}
function handleSearchMenu(e) { currentSearchMenu = e.target.value; renderMenu(); }

// Bật/Tắt hiển thị vùng Size
function toggleMenuSizes() {
    const hasSizes = document.getElementById('menu-has-sizes').checked;
    document.getElementById('menu-default-config').style.display = hasSizes ? 'none' : 'block';
    document.getElementById('menu-sizes-config').style.display = hasSizes ? 'block' : 'none';
}

// Hàm thêm hàng công thức (Đã nâng cấp để chèn vào vùng cụ thể)
function addRecipeRow(containerId, goodId = '', qty = '') {
    let options = '<option value="">-- Chọn NL --</option>'; 
    db_goods.forEach(g => { options += `<option value="${g.id}" ${g.id === goodId ? 'selected' : ''}>${g.name} (${g.unit})</option>`; });
    const row = document.createElement('div'); 
    row.style = "display: flex; gap: 10px; align-items: center;";
    row.innerHTML = `<select class="recipe-good-id" style="flex: 2; padding: 8px; border: 1px solid #dfe6e9; border-radius: 4px;">${options}</select><input type="number" step="0.01" class="recipe-qty" placeholder="SL dùng..." value="${qty}" style="flex: 1; padding: 8px; border: 1px solid #dfe6e9; border-radius: 4px;"><button type="button" onclick="this.parentElement.remove()" style="background: #ff7675; color: white; border: none; padding: 8px; width: 35px; border-radius: 4px;"><i class="fa-solid fa-trash"></i></button>`;
    document.getElementById(containerId).appendChild(row);
}

function getRecipeData(containerId) {
    const recipe = [];
    document.querySelectorAll(`#${containerId} > div`).forEach(row => { 
        const goodId = row.querySelector('.recipe-good-id').value; 
        const qty = Number(row.querySelector('.recipe-qty').value); 
        if (goodId && qty > 0) recipe.push({ id: goodId, qty: qty }); 
    });
    return recipe;
}

// Sinh ra 1 khối Nhập liệu riêng cho từng Size (Gồm Tên Size, Giá, Công thức riêng)
function addSizeBlock(sizeName = '', sizePrice = '', ingredients = []) {
    const sizeId = 'size-container-' + Date.now() + Math.floor(Math.random()*1000);
    const block = document.createElement('div');
    block.className = 'size-block';
    block.style = "background: #f8f9fa; border: 1px solid #dfe6e9; border-radius: 8px; padding: 15px; position: relative;";
    block.innerHTML = `
        <button type="button" onclick="this.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: #ff7675; color: white; border: none; width: 28px; height: 28px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-xmark"></i></button>
        <div style="display: flex; gap: 10px; margin-bottom: 10px; padding-right: 30px;">
            <div style="flex: 1;">
                <label style="font-size: 0.85rem; font-weight: bold; color: #636e72;">Tên Size</label>
                <input type="text" class="size-name" placeholder="VD: Size L" value="${sizeName}" style="width: 100%; padding: 8px; border: 1px solid #dfe6e9; border-radius: 4px; outline: none;">
            </div>
            <div style="flex: 1;">
                <label style="font-size: 0.85rem; font-weight: bold; color: #636e72;">Giá bán (VNĐ)</label>
                <input type="number" class="size-price" placeholder="VD: 55000" value="${sizePrice}" style="width: 100%; padding: 8px; border: 1px solid #dfe6e9; border-radius: 4px; outline: none;">
            </div>
        </div>
        <div style="border-top: 1px dashed #dfe6e9; padding-top: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <label style="font-size: 0.85rem; font-weight: bold; color: #00b894;">Công thức riêng cho Size này</label>
                <button type="button" onclick="addRecipeRow('${sizeId}')" style="background: #00b894; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 0.8rem;"><i class="fa-solid fa-plus"></i> Thêm NL</button>
            </div>
            <div id="${sizeId}" class="size-recipe-container" style="display: flex; flex-direction: column; gap: 8px;"></div>
        </div>
    `;
    document.getElementById('sizes-container').appendChild(block);
    
    if (ingredients.length > 0) ingredients.forEach(ing => addRecipeRow(sizeId, ing.id, ing.qty));
    else addRecipeRow(sizeId); // Mặc định 1 dòng
}

function openCreateMenuModal() {
    editingMenuId = null; 
    document.getElementById('menu-name').value = ''; 
    document.getElementById('menu-price').value = ''; 
    document.getElementById('menu-category').value = ''; 
    document.getElementById('recipe-container').innerHTML = '';
    document.getElementById('menu-has-sizes').checked = false;
    document.getElementById('sizes-container').innerHTML = '';
    toggleMenuSizes();

    const title = document.getElementById('menu-modal-title'); if (title) title.innerHTML = '<i class="fa-solid fa-burger"></i> Thêm món ăn';
    const btn = document.querySelector('#create-menu-modal .custom-modal-btn:last-child'); if (btn) { btn.innerHTML = 'Tạo món'; btn.style.background = '#0984e3'; }
    document.getElementById('create-menu-modal').classList.add('active');
}

function editMenuItem(id) {
    const item = db_menu.find(m => m.id === id); if (!item) return; editingMenuId = id;
    document.getElementById('menu-name').value = item.name; 
    document.getElementById('menu-category').value = item.category;
    document.getElementById('recipe-container').innerHTML = ''; 
    document.getElementById('sizes-container').innerHTML = '';

    if (item.hasSizes) {
        document.getElementById('menu-has-sizes').checked = true;
        item.sizes.forEach(sz => addSizeBlock(sz.name, sz.price, sz.ingredients));
    } else {
        document.getElementById('menu-has-sizes').checked = false;
        document.getElementById('menu-price').value = item.price; 
        if (item.ingredients) item.ingredients.forEach(ing => addRecipeRow('recipe-container', ing.id, ing.qty));
    }
    toggleMenuSizes();

    document.getElementById('menu-modal-title').innerHTML = '<i class="fa-solid fa-pen"></i> Cập nhật món'; 
    document.querySelector('#create-menu-modal .custom-modal-btn:last-child').innerHTML = 'Lưu thay đổi'; document.querySelector('#create-menu-modal .custom-modal-btn:last-child').style.background = '#00b894';
    document.getElementById('create-menu-modal').classList.add('active');
}

function createMenuItem() {
    const name = document.getElementById('menu-name').value; 
    const category = document.getElementById('menu-category').value; 
    const hasSizes = document.getElementById('menu-has-sizes').checked;
    if(!name || !category) return AppModal.alert("Vui lòng nhập tên và chọn nhóm món ăn!", "error");

    let finalPrice = 0; let finalIngredients = []; let finalSizes = [];

    if (hasSizes) {
        const sizeBlocks = document.querySelectorAll('.size-block');
        if (sizeBlocks.length === 0) return AppModal.alert("Vui lòng thêm ít nhất 1 Size!", "error");
        let valid = true;
        sizeBlocks.forEach(block => {
            const sName = block.querySelector('.size-name').value;
            const sPrice = block.querySelector('.size-price').value;
            const sRecipe = getRecipeData(block.querySelector('.size-recipe-container').id);
            if (!sName || !sPrice) valid = false;
            finalSizes.push({ name: sName, price: Number(sPrice), ingredients: sRecipe });
        });
        if (!valid) return AppModal.alert("Vui lòng nhập đầy đủ Tên Size và Giá bán cho từng Size!", "error");
        finalPrice = finalSizes[0].price; // Lấy giá Size đầu làm đại diện
    } else {
        finalPrice = document.getElementById('menu-price').value;
        if (!finalPrice) return AppModal.alert("Vui lòng nhập giá bán mặc định!", "error");
        finalIngredients = getRecipeData('recipe-container');
    }

    if (editingMenuId) { 
        const index = db_menu.findIndex(m => m.id === editingMenuId); 
        if (index > -1) { db_menu[index] = { ...db_menu[index], name, category, hasSizes, price: Number(finalPrice), ingredients: finalIngredients, sizes: finalSizes }; } 
        AppModal.alert("Đã cập nhật món ăn!", "success"); 
    } else { 
        db_menu.push({ id: "M" + Date.now().toString().slice(-4), name, category, hasSizes, price: Number(finalPrice), ingredients: finalIngredients, sizes: finalSizes }); 
        AppModal.alert("Đã thêm món vào thực đơn!", "success"); 
    }
    saveToFirebase('menuData', db_menu); closeManagerModal('create-menu-modal'); renderMenu();
}

function renderMenu() {
    const tbody = document.getElementById('menu-list-body'); if(!tbody) return; tbody.innerHTML = '';
    let filtered = db_menu; if(currentSearchMenu.trim() !== '') { const q = removeAccents(currentSearchMenu); filtered = filtered.filter(item => removeAccents(item.name).includes(q)); }
    if(filtered.length === 0) return tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">Không tìm thấy món</td></tr>';
    filtered.forEach(item => { tbody.innerHTML += `<tr><td><strong>${item.id}</strong></td><td>${item.name}</td><td>${item.category}</td><td style="color:#0984e3; font-weight:bold;">${formatMoney(item.price)}</td><td><button onclick="editMenuItem('${item.id}')" style="background:#0984e3; color:#fff; border:none; padding:5px 10px; border-radius:4px; margin-right:5px;"><i class="fa-solid fa-pen"></i></button><button onclick="deleteMenuItem('${item.id}')" style="background:#ff7675; color:#fff; border:none; padding:5px 10px; border-radius:4px;"><i class="fa-solid fa-trash"></i></button></td></tr>`; });
}

function deleteMenuItem(id) { AppModal.confirm("Xóa món này?", () => { db_menu = db_menu.filter(m => m.id !== id); saveToFirebase('menuData', db_menu); renderMenu(); }); }

function handleSearchGood(e) { currentSearchGood = e.target.value; renderGoods(); }
function toggleGoodPriceInput() { document.getElementById('good-sell-fields').style.display = document.getElementById('good-is-sellable').checked ? 'block' : 'none'; }

function openCreateGoodModal() {
    editingGoodId = null; document.getElementById('good-name').value = ''; document.getElementById('good-unit').value = ''; document.getElementById('good-cost').value = ''; document.getElementById('good-is-sellable').checked = false; document.getElementById('good-price').value = ''; document.getElementById('good-pos-category').value = ''; toggleGoodPriceInput(); document.getElementById('good-category').value = '';
    document.querySelector('#create-good-modal h3').innerHTML = '<i class="fa-solid fa-boxes-stacked"></i> Thêm nguyên liệu'; document.querySelector('#create-good-modal .custom-modal-btn:last-child').innerHTML = 'Thêm'; document.querySelector('#create-good-modal .custom-modal-btn:last-child').style.background = '#0984e3';
    document.getElementById('create-good-modal').classList.add('active');
}

function editGoodItem(id) {
    const item = db_goods.find(g => g.id === id); if (!item) return; editingGoodId = id;
    document.getElementById('good-name').value = item.name; document.getElementById('good-unit').value = item.unit; document.getElementById('good-cost').value = item.cost || ''; document.getElementById('good-is-sellable').checked = !!item.isSellable; document.getElementById('good-price').value = item.price || ''; document.getElementById('good-pos-category').value = item.posCategory || ''; toggleGoodPriceInput(); document.getElementById('good-category').value = item.category;
    document.querySelector('#create-good-modal h3').innerHTML = '<i class="fa-solid fa-pen"></i> Cập nhật hàng hóa'; document.querySelector('#create-good-modal .custom-modal-btn:last-child').innerHTML = 'Lưu'; document.querySelector('#create-good-modal .custom-modal-btn:last-child').style.background = '#00b894';
    document.getElementById('create-good-modal').classList.add('active');
}

function createGoodItem() {
    const name = document.getElementById('good-name').value; const unit = document.getElementById('good-unit').value; const cost = document.getElementById('good-cost').value; const isSellable = document.getElementById('good-is-sellable').checked; const price = document.getElementById('good-price').value; const posCategory = document.getElementById('good-pos-category').value; const category = document.getElementById('good-category').value;
    if(!name || !unit || !cost || !category) return AppModal.alert("Nhập đủ tên, đơn vị, giá vốn và nhóm!", "error");
    if(isSellable && (!price || !posCategory)) return AppModal.alert("Nhập giá bán lẻ và nhóm hiển thị tại POS!", "error");

    if (editingGoodId) {
        const index = db_goods.findIndex(g => g.id === editingGoodId);
        if (index > -1) { db_goods[index] = { ...db_goods[index], name, unit, cost: Number(cost), isSellable, price: isSellable ? Number(price) : null, posCategory: isSellable ? posCategory : null, category }; }
        AppModal.alert("Cập nhật thành công!", "success");
    } else {
        db_goods.push({ id: "NL" + Date.now().toString().slice(-4), name, category, unit, cost: Number(cost), isSellable, price: isSellable ? Number(price) : null, posCategory: isSellable ? posCategory : null, stock: 0 });
        AppModal.alert("Đã lưu vào kho!", "success");
    }
    saveToFirebase('goodsData', db_goods); 
    closeManagerModal('create-good-modal'); 
    renderGoods();
}

function renderGoods() {
    const tbody = document.getElementById('goods-list-body'); if(!tbody) return; tbody.innerHTML = '';
    let filtered = db_goods; if(currentSearchGood.trim() !== '') { const q = removeAccents(currentSearchGood); filtered = filtered.filter(item => removeAccents(item.name).includes(q)); }
    if(filtered.length === 0) return tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; color:#888;">Không tìm thấy</td></tr>';
    filtered.forEach(item => {
        const formattedCost = item.cost ? formatMoney(item.cost) : '0đ';
        const formattedPrice = item.isSellable ? `${formatMoney(item.price)} <small style="color:#74b9ff; display:block;">(${item.posCategory})</small>` : '<span style="color:#a4b0be; font-style:italic;">Chỉ làm NL</span>';
        tbody.innerHTML += `<tr><td><strong>${item.id}</strong></td><td>${item.name}</td><td>${item.category}</td><td>${item.unit}</td><td style="color:#d63031; font-weight:bold;">${formattedCost}</td><td style="color:#00b894; font-weight:bold;">${formattedPrice}</td><td><span style="background:#e3f2fd; padding:3px 8px; border-radius:4px; font-weight:bold;">${item.stock}</span></td><td><button onclick="editGoodItem('${item.id}')" style="background:#0984e3; color:#fff; border:none; padding:5px 10px; border-radius:4px; margin-right:5px;"><i class="fa-solid fa-pen"></i></button><button onclick="deleteGoodItem('${item.id}')" style="background:#ff7675; color:#fff; border:none; padding:5px 10px; border-radius:4px;"><i class="fa-solid fa-trash"></i></button></td></tr>`;
    });
}

function deleteGoodItem(id) { AppModal.confirm("Xóa nguyên liệu này khỏi kho?", () => { db_goods = db_goods.filter(g => g.id !== id); saveToFirebase('goodsData', db_goods); renderGoods(); }); }
function resetGoodsData() { AppModal.confirm("XÓA SẠCH toàn bộ hàng hóa kẹt và đưa kho về số 0. Chắc chắn?", () => { db_goods = []; saveToFirebase('goodsData', []); renderGoods(); AppModal.alert("Đã dọn dẹp sạch kho!", "success"); }, "Dọn dẹp Kho"); }


// =========================================
// HỆ THỐNG NHẬP HÀNG TÍCH HỢP SỬA & HOÀN TÁC
// =========================================
let currentSearchImport = '';
let editingImportId = null;

function handleSearchImport(e) { currentSearchImport = e.target.value; renderImports(); }

function openCreateImportModal(id = null) {
    editingImportId = id;
    const modal = document.getElementById('create-import-modal');
    document.getElementById('import-item-search').value = '';
    document.getElementById('import-item-suggestions').style.display = 'none';
    document.getElementById('import-items-tbody').innerHTML = '';
    
    if (id) {
        const imp = db_imports.find(i => i.id === id);
        document.getElementById('import-supplier').value = imp.supplier;
        document.getElementById('import-note').value = imp.note;
        modal.querySelector('h3').innerHTML = `<i class="fa-solid fa-pen"></i> Sửa phiếu nhập ${id}`;
        
        imp.details.forEach(d => {
            const good = db_goods.find(g => g.id === d.id) || {id: d.id, name: d.name, unit: d.unit, stock: 0, isSellable: d.isSellable};
            addImportItemRow(good, d.qty, d.cost, d.price);
        });
        updateImportGrandTotal();
    } else {
        document.getElementById('import-supplier').value = '';
        document.getElementById('import-note').value = '';
        modal.querySelector('h3').innerHTML = `<i class="fa-solid fa-file-import"></i> Lập phiếu nhập hàng`;
        document.getElementById('import-grand-total').innerText = '0đ';
        document.getElementById('import-grand-total').setAttribute('data-val', 0);
    }
    modal.classList.add('active');
}

function handleImportItemSearch(e) {
    const query = removeAccents(e.target.value);
    const suggestionBox = document.getElementById('import-item-suggestions');
    if (!query) { suggestionBox.style.display = 'none'; return; }

    const filtered = db_goods.filter(g => removeAccents(g.name).includes(query));
    suggestionBox.innerHTML = '';
    if (filtered.length === 0) {
        suggestionBox.innerHTML = '<div style="padding: 10px; color: #888; text-align: center; font-style: italic;">Không tìm thấy hàng hóa nào</div>';
    } else {
        filtered.forEach(g => {
            const div = document.createElement('div');
            div.style = "padding: 12px 15px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between;";
            div.onmouseover = () => div.style.background = "#e3f2fd"; div.onmouseout = () => div.style.background = "transparent";
            div.innerHTML = `<span style="font-weight: 600;">${g.name}</span> <span style="color:#a4b0be;">Tồn kho: <b style="color: #00b894;">${g.stock}</b> ${g.unit}</span>`;
            div.onclick = () => addImportItemRow(g);
            suggestionBox.appendChild(div);
        });
    }
    suggestionBox.style.display = 'block';
}

document.addEventListener('click', e => {
    if(e.target.id !== 'import-item-search' && document.getElementById('import-item-suggestions')) document.getElementById('import-item-suggestions').style.display = 'none';
});

function addImportItemRow(good, initQty = '', initCost = null, initPrice = null) {
    document.getElementById('import-item-suggestions').style.display = 'none';
    document.getElementById('import-item-search').value = '';

    if (!initQty && document.getElementById(`import-row-${good.id}`)) return AppModal.alert(`Mặt hàng <b>${good.name}</b> đã có trong danh sách!`, "warning");

    const tbody = document.getElementById('import-items-tbody');
    const tr = document.createElement('tr');
    tr.id = `import-row-${good.id}`;
    
    const costVal = initCost !== null ? initCost : (good.cost || 0);
    const priceVal = initPrice !== null ? initPrice : (good.price || 0);
    const isSellable = good.isSellable;
    const priceHtml = isSellable 
        ? `<input type="number" class="import-price" value="${priceVal}" style="width: 100%; padding: 8px; border: 1px solid #dfe6e9; border-radius: 4px; outline: none; text-align: center;">`
        : `<input type="text" value="Chỉ làm NL" disabled style="width: 100%; padding: 8px; border: 1px solid #eee; background: #f1f2f6; color: #a4b0be; border-radius: 4px; text-align: center;">`;

    tr.innerHTML = `
        <td><strong style="color: #2d3436;">${good.name}</strong> <small>(${good.unit})</small>
            <input type="hidden" class="import-good-id" value="${good.id}" data-name="${good.name}" data-unit="${good.unit}" data-sellable="${isSellable}"></td>
        <td><input type="number" step="0.01" class="import-qty" value="${initQty}" oninput="calculateImportTotal(this)" placeholder="Nhập SL" style="width: 100%; padding: 8px; border: 2px solid #dfe6e9; border-radius: 6px; outline: none; text-align: center; font-weight: bold; color: #00b894;"></td>
        <td><input type="number" class="import-cost" oninput="calculateImportTotal(this)" value="${costVal}" style="width: 100%; padding: 8px; border: 1px solid #dfe6e9; border-radius: 4px; outline: none; text-align: center;"></td>
        <td>${priceHtml}</td>
        <td style="text-align: right; font-weight: bold; color: #d63031; font-size: 1.05rem;" class="import-row-total" data-val="0">0đ</td>
        <td style="text-align: right;"><button type="button" onclick="this.closest('tr').remove(); updateImportGrandTotal();" style="background: #ff7675; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.insertBefore(tr, tbody.firstChild);
    if(initQty !== '') calculateImportTotal(tr.querySelector('.import-qty'));
    else tr.querySelector('.import-qty').focus();
}

function calculateImportTotal(input) {
    const tr = input.closest('tr');
    const rowTotal = (parseFloat(tr.querySelector('.import-qty').value) || 0) * (parseFloat(tr.querySelector('.import-cost').value) || 0);
    const totalCell = tr.querySelector('.import-row-total');
    totalCell.innerText = rowTotal.toLocaleString('vi-VN') + 'đ';
    totalCell.setAttribute('data-val', rowTotal);
    updateImportGrandTotal();
}

function updateImportGrandTotal() {
    let grandTotal = 0;
    document.querySelectorAll('.import-row-total').forEach(td => grandTotal += parseFloat(td.getAttribute('data-val')) || 0);
    document.getElementById('import-grand-total').innerText = grandTotal.toLocaleString('vi-VN') + 'đ';
    document.getElementById('import-grand-total').setAttribute('data-val', grandTotal);
}

function submitImportReceipt() {
    const supplier = document.getElementById('import-supplier').value;
    const note = document.getElementById('import-note').value;
    const grandTotal = parseFloat(document.getElementById('import-grand-total').getAttribute('data-val')) || 0;
    if (!supplier) return AppModal.alert("Vui lòng nhập tên Nhà cung cấp!", "warning");

    let importDetails = [];
    document.querySelectorAll('#import-items-tbody tr').forEach(tr => {
        const id = tr.querySelector('.import-good-id').value;
        const qty = parseFloat(tr.querySelector('.import-qty').value);
        if (id && qty > 0) {
            importDetails.push({
                id, name: tr.querySelector('.import-good-id').getAttribute('data-name'), unit: tr.querySelector('.import-good-id').getAttribute('data-unit'),
                isSellable: tr.querySelector('.import-good-id').getAttribute('data-sellable') === 'true',
                qty, cost: parseFloat(tr.querySelector('.import-cost').value) || 0,
                price: tr.querySelector('.import-price') ? (parseFloat(tr.querySelector('.import-price').value) || 0) : null,
                total: parseFloat(tr.querySelector('.import-row-total').getAttribute('data-val'))
            });
        }
    });

    if (importDetails.length === 0) return AppModal.alert("Vui lòng thêm mặt hàng và nhập số lượng > 0!", "warning");

    if (editingImportId) {
        const oldImpIndex = db_imports.findIndex(i => i.id === editingImportId);
        db_imports[oldImpIndex].details.forEach(oldD => {
            const g = db_goods.find(x => x.id === oldD.id);
            if (g) { g.stock -= oldD.qty; g.stock = Math.round(g.stock * 100) / 100; }
        });

        importDetails.forEach(newD => {
            const g = db_goods.find(x => x.id === newD.id);
            if (g) {
                g.stock += newD.qty; g.stock = Math.round(g.stock * 100) / 100;
                g.cost = newD.cost;
                if (newD.isSellable && newD.price !== null) g.price = newD.price;
            }
        });
        db_imports[oldImpIndex] = { ...db_imports[oldImpIndex], supplier, note, total: grandTotal, details: importDetails };
        AppModal.alert("Đã cập nhật phiếu nhập và CÂN BẰNG LẠI KHO thành công!", "success");
    } else {
        const newImport = { id: "PN" + Date.now().toString().slice(-4), date: getCurrentDate() + " " + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), supplier, note, total: grandTotal, details: importDetails };
        db_imports.push(newImport);
        importDetails.forEach(d => {
            const g = db_goods.find(x => x.id === d.id);
            if (g) {
                g.stock += d.qty; g.stock = Math.round(g.stock * 100) / 100;
                g.cost = d.cost; if (d.isSellable && d.price !== null) g.price = d.price;
            }
        });
        AppModal.alert("Nhập hàng thành công!", "success");
    }

    saveToFirebase('importsData', db_imports);
    saveToFirebase('goodsData', db_goods);
    closeManagerModal('create-import-modal');
    renderGoods(); renderImports();
}

function renderImports() {
    const tbody = document.getElementById('imports-list-body');
    if(!tbody) return; tbody.innerHTML = '';
    let filtered = db_imports;
    if (currentSearchImport.trim() !== '') {
        const query = removeAccents(currentSearchImport);
        filtered = filtered.filter(i => removeAccents(i.supplier).includes(query) || removeAccents(i.note).includes(query) || (i.details && i.details.some(d => removeAccents(d.name).includes(query))));
    }
    if(filtered.length === 0) return tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Không tìm thấy phiếu nhập</td></tr>'; 
    
    [...filtered].reverse().forEach(item => {
        tbody.innerHTML += `<tr>
            <td><strong>${item.id}</strong></td><td>${item.date}</td><td>${item.supplier}</td>
            <td style="color:#d63031; font-weight:bold;">${formatMoney(item.total)}</td><td>${item.note}</td>
            <td>
                <button onclick="viewImportDetail('${item.id}')" style="background:#b2bec3; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px;" title="Xem"><i class="fa-solid fa-eye"></i></button>
                <button onclick="openCreateImportModal('${item.id}')" style="background:#0984e3; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;" title="Sửa"><i class="fa-solid fa-pen"></i></button>
            </td></tr>`;
    });
}

function viewImportDetail(id) { 
    const imp = db_imports.find(a => a.id === id); if (!imp) return;
    document.getElementById('view-import-id').innerText = imp.id; document.getElementById('view-import-date').innerText = imp.date;
    document.getElementById('view-import-supplier').innerText = imp.supplier; document.getElementById('view-import-note').innerText = imp.note;
    document.getElementById('view-import-total').innerText = imp.total.toLocaleString('vi-VN') + 'đ';
    const tbody = document.getElementById('view-import-details-body'); tbody.innerHTML = '';
    if (imp.details) imp.details.forEach(d => {
        tbody.innerHTML += `<tr><td>${d.name} <small>(${d.unit})</small></td><td style="text-align:center; font-weight:bold;">${d.qty}</td><td style="text-align:center;">${d.cost.toLocaleString('vi-VN')}đ</td><td style="text-align:right; font-weight:bold; color: #d63031;">${d.total.toLocaleString('vi-VN')}đ</td></tr>`;
    });
    document.getElementById('view-import-modal').classList.add('active');
}


// =========================================
// HỆ THỐNG KIỂM KÊ KHO TÍCH HỢP SỬA & HOÀN TÁC
// =========================================
let currentSearchAudit = '';
let editingAuditId = null;

function handleSearchAudit(e) { currentSearchAudit = e.target.value; renderAudits(); }

function openCreateAuditModal(id = null) {
    editingAuditId = id;
    const modal = document.getElementById('create-audit-modal');
    document.getElementById('audit-item-search').value = '';
    document.getElementById('audit-items-tbody').innerHTML = '';
    
    if (id) {
        const aud = db_audits.find(a => a.id === id);
        document.getElementById('audit-note').value = aud.note;
        modal.querySelector('h3').innerHTML = `<i class="fa-solid fa-pen"></i> Sửa phiếu kiểm ${id}`;
        
        aud.details.forEach(d => {
            const good = db_goods.find(g => g.id === d.id) || {id: d.id, name: d.name, unit: d.unit, stock: d.systemQty};
            addAuditItemRow(good, d.systemQty, d.actualQty); 
        });
    } else {
        document.getElementById('audit-note').value = '';
        modal.querySelector('h3').innerHTML = `<i class="fa-solid fa-clipboard-check"></i> Lập phiếu kiểm kê kho`;
    }
    modal.classList.add('active');
}

function handleAuditItemSearch(e) {
    const query = removeAccents(e.target.value);
    const suggestionBox = document.getElementById('audit-item-suggestions');
    if (!query) { suggestionBox.style.display = 'none'; return; }

    const filtered = db_goods.filter(g => removeAccents(g.name).includes(query));
    suggestionBox.innerHTML = '';
    filtered.forEach(g => {
        const div = document.createElement('div');
        div.style = "padding: 12px 15px; border-bottom: 1px solid #eee; cursor: pointer; display: flex; justify-content: space-between;";
        div.onmouseover = () => div.style.background = "#f1f2f6"; div.onmouseout = () => div.style.background = "transparent";
        div.innerHTML = `<span style="font-weight: 600;">${g.name}</span> <span style="color:#a4b0be;">Tồn HT: <b>${g.stock}</b></span>`;
        div.onclick = () => addAuditItemRow(g);
        suggestionBox.appendChild(div);
    });
    suggestionBox.style.display = 'block';
}

function addAuditItemRow(good, sysQty = null, actualQty = '') {
    document.getElementById('audit-item-suggestions').style.display = 'none';
    document.getElementById('audit-item-search').value = '';
    if (!actualQty && document.getElementById(`audit-row-${good.id}`)) return AppModal.alert("Mặt hàng đã có trong bảng!", "warning");

    const tbody = document.getElementById('audit-items-tbody');
    const tr = document.createElement('tr');
    tr.id = `audit-row-${good.id}`;
    
    const displaySysQty = sysQty !== null ? sysQty : good.stock; 
    
    tr.innerHTML = `
        <td><strong style="color: #2d3436;">${good.name}</strong> <small>(${good.unit})</small><input type="hidden" class="audit-good-id" value="${good.id}" data-name="${good.name}" data-unit="${good.unit}" data-stock="${displaySysQty}"></td>
        <td style="text-align: center; font-weight: bold; color: #636e72;" class="audit-system-qty">${displaySysQty}</td>
        <td><input type="number" step="0.01" class="audit-actual-qty" value="${actualQty}" oninput="calculateAuditDiff(this)" placeholder="Nhập SL" style="width: 100%; padding: 8px; border: 2px solid #dfe6e9; border-radius: 6px; outline: none; text-align: center; font-weight: bold; color: #0984e3;"></td>
        <td style="text-align: center; font-weight: bold; font-size: 1.1rem;" class="audit-diff-qty">-</td>
        <td style="text-align: right;"><button type="button" onclick="this.closest('tr').remove()" style="background: #ff7675; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer;"><i class="fa-solid fa-trash"></i></button></td>
    `;
    tbody.insertBefore(tr, tbody.firstChild);
    if(actualQty !== '') calculateAuditDiff(tr.querySelector('.audit-actual-qty'));
    else tr.querySelector('.audit-actual-qty').focus();
}

function calculateAuditDiff(input) {
    const tr = input.closest('tr');
    const systemQty = parseFloat(tr.querySelector('.audit-system-qty').innerText);
    const actualQty = parseFloat(input.value);
    const diffCell = tr.querySelector('.audit-diff-qty');
    if (isNaN(actualQty) || input.value === '') return diffCell.innerText = '-';
    const diff = Math.round((actualQty - systemQty) * 100) / 100;
    if (diff > 0) diffCell.innerHTML = `<span style="color: #00b894;">+${diff}</span>`;
    else if (diff < 0) diffCell.innerHTML = `<span style="color: #d63031;">${diff}</span>`;
    else diffCell.innerHTML = `<span style="color: #0984e3;">(0)</span>`;
}

function submitAuditReceipt() {
    const note = document.getElementById('audit-note').value;
    let auditDetails = [];
    document.querySelectorAll('#audit-items-tbody tr').forEach(tr => {
        const id = tr.querySelector('.audit-good-id').value;
        const actualInput = tr.querySelector('.audit-actual-qty').value;
        if (id && actualInput !== '') {
            const systemQty = parseFloat(tr.querySelector('.audit-good-id').getAttribute('data-stock'));
            auditDetails.push({ id, name: tr.querySelector('.audit-good-id').getAttribute('data-name'), unit: tr.querySelector('.audit-good-id').getAttribute('data-unit'), systemQty, actualQty: parseFloat(actualInput), diff: parseFloat(actualInput) - systemQty });
        }
    });

    if (auditDetails.length === 0) return AppModal.alert("Vui lòng thêm mặt hàng và nhập số lượng thực tế!", "warning");

    if (editingAuditId) {
        const oldAudIndex = db_audits.findIndex(a => a.id === editingAuditId);
        db_audits[oldAudIndex].details.forEach(oldD => {
            const g = db_goods.find(x => x.id === oldD.id);
            if (g) { g.stock -= oldD.diff; g.stock = Math.round(g.stock * 100) / 100; }
        });

        auditDetails.forEach(newD => {
            const g = db_goods.find(x => x.id === newD.id);
            if (g) { g.stock += newD.diff; g.stock = Math.round(g.stock * 100) / 100; }
        });
        db_audits[oldAudIndex] = { ...db_audits[oldAudIndex], note, details: auditDetails };
        AppModal.alert("Đã cập nhật phiếu kiểm và hoàn tác số liệu kho thành công!", "success");
    } else {
        const currentUser = localStorage.getItem('currentUser') || 'Quản lý viên';
        const newAudit = { id: "PK" + Date.now().toString().slice(-4), date: getCurrentDate() + " " + new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }), checker: currentUser, note: note || "Kiểm kê thông thường", details: auditDetails };
        db_audits.push(newAudit);
        auditDetails.forEach(d => {
            const g = db_goods.find(x => x.id === d.id);
            if (g) { g.stock = d.actualQty; } 
        });
        AppModal.alert("Đã lưu biên bản kiểm kê!", "success");
    }

    saveToFirebase('auditsData', db_audits);
    saveToFirebase('goodsData', db_goods);
    closeManagerModal('create-audit-modal');
    renderGoods(); renderAudits();
}

function renderAudits() {
    const tbody = document.getElementById('audits-list-body');
    if(!tbody) return; tbody.innerHTML = '';
    let filtered = db_audits;
    if (currentSearchAudit.trim() !== '') {
        const query = removeAccents(currentSearchAudit);
        filtered = filtered.filter(a => removeAccents(a.note).includes(query) || (a.details && a.details.some(d => removeAccents(d.name).includes(query))));
    }
    if(filtered.length === 0) return tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#888;">Không tìm thấy phiếu kiểm</td></tr>'; 
    
    [...filtered].reverse().forEach(item => {
        const itemCount = item.details ? item.details.length : 0;
        tbody.innerHTML += `<tr>
            <td><strong>${item.id}</strong></td><td>${item.date}</td><td>${item.checker}</td>
            <td style="color:#0984e3; font-weight:bold;">${itemCount} loại hàng</td><td>${item.note}</td>
            <td>
                <button onclick="viewAuditDetail('${item.id}')" style="background:#b2bec3; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor: pointer; margin-right:5px;" title="Xem"><i class="fa-solid fa-eye"></i></button>
                <button onclick="openCreateAuditModal('${item.id}')" style="background:#0984e3; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor: pointer;" title="Sửa"><i class="fa-solid fa-pen"></i></button>
            </td></tr>`;
    });
}

function viewAuditDetail(id) {
    const audit = db_audits.find(a => a.id === id); if (!audit) return;
    document.getElementById('view-audit-id').innerText = audit.id; document.getElementById('view-audit-date').innerText = audit.date;
    document.getElementById('view-audit-checker').innerText = audit.checker; document.getElementById('view-audit-note').innerText = audit.note;
    const tbody = document.getElementById('view-audit-details-body'); tbody.innerHTML = '';
    if (audit.details) audit.details.forEach(d => {
        let diffHtml = d.diff > 0 ? `<span style="color:#00b894;">+${d.diff}</span>` : d.diff < 0 ? `<span style="color:#d63031;">${d.diff}</span>` : `<span style="color:#0984e3;">0</span>`;
        tbody.innerHTML += `<tr><td>${d.name} <small>(${d.unit})</small></td><td style="text-align:center;">${d.systemQty}</td><td style="text-align:center; font-weight:bold;">${d.actualQty}</td><td style="text-align:center;">${diffHtml}</td></tr>`;
    });
    document.getElementById('view-audit-modal').classList.add('active');
}


// =========================================
// HỆ THỐNG HÓA ĐƠN BÁN HÀNG TÍCH HỢP SỬA & ROLLBACK CÔNG THỨC
// =========================================
let currentSearchInvoice = '';
let editingInvoiceId = null;
let editInvoiceItemsArr = [];
let managerInvoiceCurrentPage = 1;
const MANAGER_INVOICE_PAGE_SIZE = 50;

function handleSearchInvoice(e) { currentSearchInvoice = e.target.value; managerInvoiceCurrentPage = 1; renderInvoices(); }

function renderInvoices() {
    const tbody = document.getElementById('invoices-list-body');
    const paginationContainer = document.getElementById('manager-invoice-pagination');
    if (!tbody) return; tbody.innerHTML = ''; if (paginationContainer) paginationContainer.innerHTML = '';
    
    // Sử dụng mảng toàn cục db_invoices đã được đồng bộ từ Firebase
    let filteredInvoices = db_invoices;
    
    if (currentSearchInvoice.trim() !== '') {
        const query = removeAccents(currentSearchInvoice);
        filteredInvoices = filteredInvoices.filter(inv => removeAccents(inv.id).includes(query) || removeAccents(inv.cashier).includes(query) || (inv.items && inv.items.some(item => removeAccents(item.name).includes(query))));
    }

    if (filteredInvoices.length === 0) return tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#888;">Không tìm thấy hóa đơn</td></tr>';

    const sortedInvoices = [...filteredInvoices].reverse();
    const totalPages = Math.ceil(sortedInvoices.length / MANAGER_INVOICE_PAGE_SIZE);
    if (managerInvoiceCurrentPage > totalPages) managerInvoiceCurrentPage = totalPages;
    if (managerInvoiceCurrentPage < 1) managerInvoiceCurrentPage = 1;

    const startIndex = (managerInvoiceCurrentPage - 1) * MANAGER_INVOICE_PAGE_SIZE;
    sortedInvoices.slice(startIndex, startIndex + MANAGER_INVOICE_PAGE_SIZE).forEach(inv => {
        const itemCount = inv.items ? inv.items.reduce((sum, item) => sum + item.qty, 0) : 0;
        const itemText = itemCount > 0 ? `<br><small style="color:#a4b0be;">(${itemCount} SP)</small>` : '';
        tbody.innerHTML += `<tr>
            <td><strong>${inv.id}</strong>${itemText}</td><td>${inv.date} ${inv.time || ''}</td><td>${inv.cashier} <small style="color:#0984e3;">(${inv.branch})</small></td>
            <td style="color:#00b894; font-weight:bold;">${Number(inv.total).toLocaleString('vi-VN')}đ</td>
<td>
    <button onclick="openEditInvoiceModal('${inv.id}')" style="background:#0984e3; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer; margin-right:5px;" title="Sửa HĐ"><i class="fa-solid fa-pen"></i></button>
    <button onclick="deleteInvoice('${inv.id}')" style="background:#d63031; color:#fff; border:none; padding:5px 10px; border-radius:4px; cursor:pointer;" title="Xóa HĐ"><i class="fa-solid fa-trash"></i></button>
</td>
            </tr>`;
    });

    if (totalPages > 1 && paginationContainer) {
        paginationContainer.innerHTML = `
            <button onclick="goToManagerInvoicePage(1)" ${managerInvoiceCurrentPage===1?'disabled':''} style="padding:6px 12px; border:1px solid #dfe6e9; background:#fff; border-radius:6px; cursor:pointer;"><i class="fa-solid fa-angles-left"></i></button>
            <span style="font-size: 0.95rem; display:flex; align-items:center; gap:6px;">Trang <input type="number" value="${managerInvoiceCurrentPage}" min="1" max="${totalPages}" onchange="jumpToManagerInvoicePage(this.value, ${totalPages})" style="width:50px; text-align:center; padding:6px; border:1px solid #dfe6e9; border-radius:6px;"> / <b>${totalPages}</b></span>
            <button onclick="goToManagerInvoicePage(${managerInvoiceCurrentPage+1})" ${managerInvoiceCurrentPage===totalPages?'disabled':''} style="padding:6px 12px; border:1px solid #dfe6e9; background:#fff; border-radius:6px; cursor:pointer;"><i class="fa-solid fa-angle-right"></i></button>
        `;
    }
}

function goToManagerInvoicePage(page) { managerInvoiceCurrentPage = page; renderInvoices(); }
function jumpToManagerInvoicePage(val, totalPages) { const p = parseInt(val); if(p >= 1 && p <= totalPages) { managerInvoiceCurrentPage = p; renderInvoices(); } }

function openEditInvoiceModal(id) {
    editingInvoiceId = id;
    const inv = db_invoices.find(i => i.id === id);
    if (!inv) return;

    document.getElementById('edit-inv-id-display').innerText = id;
    editInvoiceItemsArr = JSON.parse(JSON.stringify(inv.items || [])); 
    
    document.getElementById('edit-inv-item-search').value = '';
    renderEditInvoiceItems();
    document.getElementById('edit-invoice-modal').classList.add('active');
}

function handleEditInvSearch(e) {
    const query = removeAccents(e.target.value);
    const suggestionBox = document.getElementById('edit-inv-item-suggestions');
    if (!query) { suggestionBox.style.display = 'none'; return; }

    let allProducts = [...db_menu];
    const sellableGoods = db_goods.filter(g => g.isSellable).map(g => ({ id: g.id, name: g.name, price: g.price }));
    allProducts = allProducts.concat(sellableGoods);

    const filtered = allProducts.filter(p => removeAccents(p.name).includes(query));
    
    suggestionBox.innerHTML = '';
    filtered.forEach(p => {
        const div = document.createElement('div');
        div.style = "padding: 12px 15px; border-bottom: 1px solid #eee; cursor: pointer;";
        div.onmouseover = () => div.style.background = "#e3f2fd"; div.onmouseout = () => div.style.background = "transparent";
        div.innerHTML = `<strong>${p.name}</strong> - <span style="color:#0984e3;">${p.price.toLocaleString('vi-VN')}đ</span>`;
        div.onclick = () => {
            const existing = editInvoiceItemsArr.find(i => i.id === p.id);
            if (existing) existing.qty++; else editInvoiceItemsArr.push({ ...p, qty: 1 });
            renderEditInvoiceItems();
            suggestionBox.style.display = 'none';
            document.getElementById('edit-inv-item-search').value = '';
        };
        suggestionBox.appendChild(div);
    });
    suggestionBox.style.display = 'block';
}

function updateEditInvQty(index, newQty) {
    editInvoiceItemsArr[index].qty = parseFloat(newQty) || 1;
    renderEditInvoiceItems();
}
function removeEditInvItem(index) {
    editInvoiceItemsArr.splice(index, 1);
    renderEditInvoiceItems();
}

function renderEditInvoiceItems() {
    const tbody = document.getElementById('edit-inv-items-tbody');
    tbody.innerHTML = '';
    let grandTotal = 0;

    editInvoiceItemsArr.forEach((item, index) => {
        const rowTotal = item.qty * item.price;
        grandTotal += rowTotal;
        tbody.innerHTML += `
            <tr>
                <td><strong>${item.name}</strong></td>
                <td style="text-align:center;"><input type="number" min="1" step="0.01" value="${item.qty}" onchange="updateEditInvQty(${index}, this.value)" style="width: 70px; text-align:center; padding: 6px; border:1px solid #dfe6e9; border-radius:4px; outline:none; font-weight:bold; color:#0984e3;"></td>
                <td style="text-align:center;">${item.price.toLocaleString('vi-VN')}đ</td>
                <td style="text-align:right; font-weight:bold; color:#d63031;">${rowTotal.toLocaleString('vi-VN')}đ</td>
                <td style="text-align:right;"><button onclick="removeEditInvItem(${index})" style="background:#ff7675; color:white; border:none; padding:6px 10px; border-radius:4px; cursor:pointer;"><i class="fa-solid fa-trash"></i></button></td>
            </tr>`;
    });
    document.getElementById('edit-inv-grand-total').innerText = grandTotal.toLocaleString('vi-VN') + 'đ';
    document.getElementById('edit-inv-grand-total').setAttribute('data-val', grandTotal);
}

function processInvoiceStock(itemsArray, isRollback) {
    const multiplier = isRollback ? 1 : -1; 
    
    itemsArray.forEach(item => {
        const baseId = item.id.split('-')[0]; 
        const menuData = db_menu.find(p => p.id === baseId);
        
        if (menuData && menuData.ingredients) {
            menuData.ingredients.forEach(ing => {
                const g = db_goods.find(x => x.id === ing.id);
                if (g) { g.stock += (ing.qty * item.qty * multiplier); g.stock = Math.round(g.stock * 100)/100; }
            });
        } else if (baseId && baseId.startsWith("NL")) {
            const g = db_goods.find(x => x.id === baseId);
            if (g) { g.stock += (item.qty * multiplier); g.stock = Math.round(g.stock * 100)/100; }
        }
    });
}

function submitInvoiceEdit() {
    if (editInvoiceItemsArr.length === 0) return AppModal.alert("Hóa đơn phải có ít nhất 1 món!", "warning");

    const invoices = db_invoices;
    const invIndex = invoices.findIndex(i => i.id === editingInvoiceId);
    if (invIndex === -1) return;
    const oldInv = invoices[invIndex];

    processInvoiceStock(oldInv.items, true);
    processInvoiceStock(editInvoiceItemsArr, false);

    saveToFirebase('goodsData', db_goods);
    
    invoices[invIndex].items = editInvoiceItemsArr;
    invoices[invIndex].total = parseFloat(document.getElementById('edit-inv-grand-total').getAttribute('data-val'));
    
    saveToFirebase('invoicesData', invoices);

    AppModal.alert("Đã cập nhật hóa đơn và BÙ TRỪ KHO NGUYÊN LIỆU thành công!", "success");
    closeManagerModal('edit-invoice-modal');
    renderGoods(); renderInvoices();
}
function deleteInvoice(id) {
    AppModal.confirm("Hành động này sẽ XÓA VĨNH VIỄN hóa đơn và HOÀN TRẢ lại số lượng nguyên liệu vào kho. Bạn chắc chắn muốn xóa?", () => {
        const invoices = db_invoices;
        const invIndex = invoices.findIndex(i => i.id === id);
        if (invIndex === -1) return;

        const invoiceToDelete = invoices[invIndex];

        // 1. Hoàn trả lại tồn kho (Truyền tham số true để isRollback = true)
        processInvoiceStock(invoiceToDelete.items, true);

        // 2. Xóa hóa đơn khỏi mảng
        invoices.splice(invIndex, 1);

        // 3. Cập nhật đồng bộ lên Firebase
        saveToFirebase('goodsData', db_goods);
        saveToFirebase('invoicesData', invoices);

        AppModal.alert("Đã xóa hóa đơn và hoàn trả kho nguyên liệu thành công!", "success");
        
        // 4. Render lại giao diện
        renderGoods(); 
        renderInvoices();
        updateReports();
    }, "Xóa hóa đơn");
}
// =========================================
// CẬP NHẬT CHỈ SỐ BÁO CÁO (DASHBOARD TỔNG QUAN)
// =========================================
// Hàm hiển thị/ẩn bộ chọn lịch tùy chỉnh
function handleManagerReportFilterChange() {
    const timeFilter = document.getElementById('manager-report-time').value;
    const customDateDiv = document.getElementById('manager-report-custom-date');
    
    if (timeFilter === 'custom') {
        customDateDiv.style.display = 'flex';
    } else {
        customDateDiv.style.display = 'none';
    }
    updateReports();
}

// =========================================
// CẬP NHẬT CHỈ SỐ BÁO CÁO (DASHBOARD TỔNG QUAN)
// =========================================
// =========================================
// CẬP NHẬT CHỈ SỐ BÁO CÁO (DASHBOARD TỔNG QUAN)
// =========================================
function updateReports() {
    const timeFilter = document.getElementById('manager-report-time')?.value || 'today';
    const cashierFilter = document.getElementById('manager-report-cashier')?.value || 'all';

    // 1. Cập nhật danh sách Thu ngân tự động từ hệ thống
    const cashierSelect = document.getElementById('manager-report-cashier');
    if (cashierSelect) {
        const uniqueCashiers = [...new Set(db_invoices.map(inv => inv.cashier))].filter(Boolean);
        const currentSelected = cashierSelect.value; // Giữ lại người đang chọn
        
        cashierSelect.innerHTML = '<option value="all">-- Tất cả --</option>';
        uniqueCashiers.forEach(c => {
            cashierSelect.innerHTML += `<option value="${c}">${c}</option>`;
        });
        
        if (uniqueCashiers.includes(currentSelected)) {
            cashierSelect.value = currentSelected;
        }
    }

    // 2. Xử lý tính toán ngày tháng theo Bộ Lọc
    let startDate = '';
    let endDate = '';
    const todayObj = new Date();
    
    const formatDate = (d) => {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };

    if (timeFilter === 'today') {
        startDate = endDate = formatDate(todayObj);
    } else if (timeFilter === 'yesterday') {
        const yesterday = new Date(todayObj);
        yesterday.setDate(yesterday.getDate() - 1);
        startDate = endDate = formatDate(yesterday);
    } else if (timeFilter === 'this_month') {
        startDate = `${todayObj.getFullYear()}-${String(todayObj.getMonth() + 1).padStart(2, '0')}-01`;
        endDate = formatDate(todayObj);
    } else if (timeFilter === 'last_month') {
        const lastMonth = new Date(todayObj.getFullYear(), todayObj.getMonth() - 1, 1);
        const endOfLastMonth = new Date(todayObj.getFullYear(), todayObj.getMonth(), 0);
        startDate = formatDate(lastMonth);
        endDate = formatDate(endOfLastMonth);
    } else if (timeFilter === 'this_year') {
        startDate = `${todayObj.getFullYear()}-01-01`;
        endDate = formatDate(todayObj);
    } else if (timeFilter === 'custom') {
        startDate = document.getElementById('manager-report-start').value;
        endDate = document.getElementById('manager-report-end').value;
    }

    // 3. Tiến hành Lọc Hóa Đơn
    const filteredInvoices = db_invoices.filter(inv => {
        // Định dạng chuẩn lại ngày của hóa đơn
        let invDate = inv.date;
        if (invDate.includes('/')) {
            const parts = invDate.split('/');
            invDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }

        // Cắt bỏ HĐ ngoài Khoảng thời gian
        if (startDate && invDate < startDate) return false;
        if (endDate && invDate > endDate) return false;

        // Cắt bỏ HĐ nếu không đúng Nhân viên
        if (cashierFilter !== 'all' && inv.cashier !== cashierFilter) return false;

        return true;
    });

    // 4. Cập nhật thẻ Doanh Thu & Số đơn
    const revenueTotal = filteredInvoices.reduce((sum, inv) => sum + inv.total, 0);
    const revEl = document.getElementById('report-revenue');
    const orderEl = document.getElementById('report-orders');
    
    if (revEl) revEl.innerText = formatMoney(revenueTotal);
    if (orderEl) orderEl.innerText = filteredInvoices.length;

    // -----------------------------------------
    // 4.5 TÍNH TOÁN & GỌI VẼ BIỂU ĐỒ DOANH THU
    // -----------------------------------------
    let chartLabels = [];
    let chartData = [];

    // Nếu lọc "Hôm nay" hoặc "Hôm qua" -> Chia biểu đồ theo 24 Cột Giờ (0h -> 23h)
    if (timeFilter === 'today' || timeFilter === 'yesterday') {
        chartLabels = Array.from({length: 24}, (_, i) => `${i}:00`);
        chartData = Array(24).fill(0);
        
        filteredInvoices.forEach(inv => {
            if (inv.time) {
                const hour = parseInt(inv.time.split(':')[0]);
                if (!isNaN(hour)) chartData[hour] += inv.total;
            }
        });
    } 
    // Nếu lọc "Năm nay" -> Chia biểu đồ theo 12 Cột Tháng (Tháng 1 -> 12)
    else if (timeFilter === 'this_year') {
        chartLabels = Array.from({length: 12}, (_, i) => `Tháng ${i+1}`);
        chartData = Array(12).fill(0);
        
        filteredInvoices.forEach(inv => {
            let invDate = inv.date;
            if (invDate.includes('/')) {
                 const parts = invDate.split('/');
                 invDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            const month = parseInt(invDate.split('-')[1]) - 1; // getMonth() bắt đầu từ 0
            if (!isNaN(month)) chartData[month] += inv.total;
        });
    } 
    // Nếu lọc "Tháng này", "1 tháng trước", hoặc "Tùy chỉnh" -> Chia biểu đồ theo Cột Ngày
    else {
        let dailyData = {};
        filteredInvoices.forEach(inv => {
            let invDate = inv.date;
            if (invDate.includes('/')) {
                 const parts = invDate.split('/');
                 invDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
            if (!dailyData[invDate]) dailyData[invDate] = 0;
            dailyData[invDate] += inv.total;
        });
        
        // Quét tạo các cột tương ứng với từng ngày trong khoảng thời gian
        if (startDate && endDate) {
            let startD = new Date(startDate);
            let endD = new Date(endDate);
            while (startD <= endD) {
                const dateStr = `${startD.getFullYear()}-${String(startD.getMonth() + 1).padStart(2, '0')}-${String(startD.getDate()).padStart(2, '0')}`;
                const displayStr = `${String(startD.getDate()).padStart(2, '0')}/${String(startD.getMonth() + 1).padStart(2, '0')}`;
                
                chartLabels.push(displayStr);
                chartData.push(dailyData[dateStr] || 0);
                
                startD.setDate(startD.getDate() + 1);
            }
        }
    }
    
    // Gọi hàm vẽ đè biểu đồ ra giao diện
    if (typeof renderRevenueChart === 'function') {
        renderRevenueChart(chartLabels, chartData);
    }
    // -----------------------------------------

    // 5. Phân tích Top Món Bán Chạy trong khoảng thời gian đã lọc
    let itemSales = {};
    filteredInvoices.forEach(inv => {
        if(inv.items) {
            inv.items.forEach(item => {
                const name = item.name.replace(/<[^>]*>?/gm, ''); // Lọc bỏ thẻ HTML size
                if (!itemSales[name]) {
                    itemSales[name] = { qty: 0, revenue: 0 };
                }
                itemSales[name].qty += item.qty;
                itemSales[name].revenue += (item.qty * item.price);
            });
        }
    });

    const sortedTopItems = Object.keys(itemSales)
        .map(name => ({ name, ...itemSales[name] }))
        .sort((a, b) => b.qty - a.qty)
        .slice(0, 5); // Lấy Top 5

    const topItemsTbody = document.getElementById('report-top-items');
    if (topItemsTbody) {
        if (sortedTopItems.length === 0) {
            topItemsTbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888;">Chưa có dữ liệu bán hàng</td></tr>';
        } else {
            topItemsTbody.innerHTML = sortedTopItems.map(item => `
                <tr>
                    <td><strong>${item.name}</strong></td>
                    <td style="text-align: center; font-weight: bold; color: #00b894;">${item.qty}</td>
                    <td style="text-align: right; color: #d63031; font-weight: bold;">${formatMoney(item.revenue)}</td>
                </tr>
            `).join('');
        }
    }

    // 6. Cảnh báo tồn kho (Đây là thông số thực tế kho, không chịu ảnh hưởng của bộ lọc thời gian)
    const lowStockItems = db_goods.filter(g => g.stock < 10).sort((a, b) => a.stock - b.stock);
    const lowStockEl = document.getElementById('report-low-stock');
    const lowStockTbody = document.getElementById('report-low-stock-list');

    if (lowStockEl) {
        lowStockEl.innerText = `${lowStockItems.length} mục`;
        lowStockEl.style.color = lowStockItems.length > 0 ? '#d63031' : '#2d3436';
    }

    if (lowStockTbody) {
        if (lowStockItems.length === 0) {
            lowStockTbody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#888;">Kho hàng đang ổn định.</td></tr>';
        } else {
            lowStockTbody.innerHTML = lowStockItems.slice(0, 5).map(g => `
                <tr>
                    <td>${g.name} <small>(${g.unit})</small></td>
                    <td style="text-align: center; font-weight: bold; color: #d63031; background: #ffeaa7; border-radius: 4px;">${g.stock}</td>
                </tr>
            `).join('');
        }
    }
}
// =========================================
// XỬ LÝ MODAL CẢNH BÁO TỒN KHO THẤP
// =========================================
let currentLowStockSearch = '';

function showLowStockModal() {
    currentLowStockSearch = '';
    const searchInput = document.getElementById('search-low-stock-input');
    if (searchInput) searchInput.value = '';
    
    renderLowStockModal();
    document.getElementById('low-stock-details-modal').classList.add('active');
}

function handleSearchLowStock(e) {
    currentLowStockSearch = removeAccents(e.target.value);
    renderLowStockModal();
}

function renderLowStockModal() {
    const tbody = document.getElementById('low-stock-details-body');
    if (!tbody) return;
    
    // Lấy toàn bộ hàng hóa có tồn kho < 10
    let lowStockItems = db_goods.filter(g => g.stock < 10).sort((a, b) => a.stock - b.stock);
    
    // Lọc theo thanh tìm kiếm
    if (currentLowStockSearch) {
        lowStockItems = lowStockItems.filter(g => removeAccents(g.name).includes(currentLowStockSearch));
    }

    tbody.innerHTML = '';
    
    if (lowStockItems.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align:center; color:#888; padding: 20px;">Không có mặt hàng nào khớp tìm kiếm hoặc kho đang ổn định.</td></tr>';
        return;
    }

    lowStockItems.forEach(g => {
        tbody.innerHTML += `
            <tr>
                <td><strong>${g.name}</strong> <small style="color: #636e72;">(${g.unit})</small></td>
                <td><span style="background: #f1f2f6; padding: 4px 8px; border-radius: 4px; font-size: 0.9rem;">${g.category}</span></td>
                <td style="text-align: center; font-weight: bold; color: #d63031; background: #ffeaa7;">${g.stock}</td>
            </tr>
        `;
    });
}
// =========================================
// KHỞI TẠO BẰNG FIREBASE REAL-TIME Lắng Nghe
// =========================================
document.addEventListener('DOMContentLoaded', () => {
    
    // Đồng bộ Danh mục Nhóm
    listenToFirebase('categoriesData', (data) => {
        if (data) db_categories = data;
        else {
            db_categories = { menu: [{id: "CM1", name: "Đồ ăn"}, {id: "CM2", name: "Thức uống"}], goods: [{id: "CG1", name: "Nguyên liệu tươi"}] };
            saveToFirebase('categoriesData', db_categories);
        }
        renderCategories(); updateCategorySelects();
    });

    // Lắng nghe độc lập cho từng bộ sưu tập dữ liệu
    listenToFirebase('menuData', (data) => { if (data) db_menu = data; else db_menu = []; renderMenu(); });
    
    listenToFirebase('goodsData', (data) => { 
        if (data) db_goods = data; else db_goods = []; 
        renderGoods(); 
        updateReports(); // Cập nhật lại chỉ số cảnh báo tồn kho
    });
    
// Cờ đánh dấu để không bị báo cáo dội lại khi vừa F5 tải lại trang
    let isInitLoad = { imports: true, audits: true };

    // 1. Lắng nghe và Báo cáo khi có Phiếu Nhập Hàng mới
    listenToFirebase('importsData', (data) => { 
        if (data) {
            // Nếu không phải lần tải đầu và phát hiện số lượng phiếu tăng lên
            if (!isInitLoad.imports && data.length > db_imports.length) {
                const newImport = data[data.length - 1]; // Lấy phiếu vừa tạo
                pushChromeAlert(
                    "📦 PHIẾU NHẬP HÀNG MỚI", 
                    `Nhà cung cấp: ${newImport.supplier}\nTổng tiền: ${formatMoney(newImport.total)}\nGhi chú: ${newImport.note || 'Không'}`
                );
            }
            db_imports = data; 
        } else { 
            db_imports = []; 
        }
        isInitLoad.imports = false;
        renderImports(); 
    });
    
    // 2. Lắng nghe và Báo cáo khi có Phiếu Kiểm Kho mới
    listenToFirebase('auditsData', (data) => { 
        if (data) {
            if (!isInitLoad.audits && data.length > db_audits.length) {
                const newAudit = data[data.length - 1];
                pushChromeAlert(
                    "📋 PHIẾU KIỂM KHO MỚI", 
                    `Người kiểm: ${newAudit.checker}\nCó ${newAudit.details.length} mặt hàng được cập nhật tồn kho.\nGhi chú: ${newAudit.note}`
                );
            }
            db_audits = data; 
        } else { 
            db_audits = []; 
        }
        isInitLoad.audits = false;
        renderAudits(); 
    });
    
    listenToFirebase('invoicesData', (data) => { 
        if (data) db_invoices = data; else db_invoices = []; 
        renderInvoices(); 
        updateReports(); // Cập nhật doanh thu hôm nay
    });

    requestWakeLock();
});



/* =========================================
   CHẾ ĐỘ GIỮ MÀN HÌNH LUÔN SÁNG (WAKE LOCK)
========================================= */
let wakeLock = null;
const requestWakeLock = async () => {
    try {
        if ('wakeLock' in navigator) {
            wakeLock = await navigator.wakeLock.request('screen');
            wakeLock.addEventListener('release', () => { console.log('Chế độ luôn sáng đã bị hủy.'); });
        }
    } catch (err) { console.error(`Lỗi wake lock: ${err.name}, ${err.message}`); }
};

document.addEventListener('click', () => { if (!wakeLock || wakeLock.released) requestWakeLock(); }, { once: true });
document.addEventListener('visibilitychange', async () => { if (wakeLock !== null && document.visibilityState === 'visible') requestWakeLock(); });
// =========================================
// HỆ THỐNG VẼ BIỂU ĐỒ DOANH THU (CHART.JS)
// =========================================
let revenueChartInstance = null;

function renderRevenueChart(labels, data) {
    const ctx = document.getElementById('revenueChart');
    if (!ctx) return;

    // Nếu đã có biểu đồ cũ thì hủy đi để vẽ cái mới đè lên
    if (revenueChartInstance) {
        revenueChartInstance.destroy();
    }

    revenueChartInstance = new Chart(ctx, {
        type: 'bar', // Dạng biểu đồ cột
        data: {
            labels: labels, // Trục X (Tháng, Ngày, hoặc Giờ)
            datasets: [{
                label: 'Doanh thu (VNĐ)',
                data: data, // Trục Y (Số tiền)
                backgroundColor: 'rgba(9, 132, 227, 0.8)', // Màu xanh biển của hệ thống
                hoverBackgroundColor: '#74b9ff',
                borderRadius: 4, // Bo tròn nhẹ góc trên của cột
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }, // Ẩn cái chú thích thừa
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) { label += ': '; }
                            if (context.parsed.y !== null) {
                                // Định dạng lại tiền trong bảng tooltip khi di chuột vào cột
                                label += new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(context.parsed.y);
                            }
                            return label;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            // Rút gọn số tiền trên trục Y (1.000.000 -> 1Tr, 100.000 -> 100k)
                            if (value >= 1000000) return (value / 1000000) + 'Tr';
                            if (value >= 1000) return (value / 1000) + 'k';
                            return value;
                        }
                    }
                }
            }
        }
    });
}
// =========================================
// HỆ THỐNG THÔNG BÁO TỪ TRÌNH DUYỆT CHROME
// =========================================

// Xin quyền bật thông báo Chrome khi Quản lý mở trang
if ("Notification" in window) {
    if (Notification.permission !== "granted" && Notification.permission !== "denied") {
        Notification.requestPermission();
    }
}

// Hàm đẩy Popup thông báo ra góc màn hình
function pushChromeAlert(title, body) {
    if (Notification.permission === "granted") {
        const notification = new Notification(title, {
            body: body,
            icon: "https://cdn-icons-png.flaticon.com/512/3143/3143460.png", // Icon giỏ hàng/thông báo
            silent: false // Bật âm thanh ting ting mặc định của máy
        });
        
        // Tự động đóng popup sau 7 giây để không làm rác màn hình
        setTimeout(() => { notification.close(); }, 7000);
    }
}