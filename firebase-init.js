// firebase-init.js

// 1. Cấu hình Firebase của bạn
const firebaseConfig = {
    apiKey: "AIzaSyCkdnpINyG_kxUz-5D-92W6jSZmbgCKjjA",
    authDomain: "vietsoup-670d2.firebaseapp.com",
    projectId: "vietsoup-670d2",
    storageBucket: "vietsoup-670d2.firebasestorage.app",
    messagingSenderId: "65399336972",
    appId: "1:65399336972:web:fc86d9cf656549219bbe29",
    measurementId: "G-Z5WMB9E3J0"
};

// 2. Khởi tạo Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ==========================================
// HỆ THỐNG LÕI: TỰ ĐỘNG PHÂN LUỒNG CHI NHÁNH
// ==========================================

function getBranchDocName(docName) {
    // Hóa đơn, Tài khoản và Chi nhánh dùng chung để Quản lý Hệ thống có thể xem tổng quát
    const globalDocs = ['branchesData', 'accountsData', 'invoicesData'];
    if (globalDocs.includes(docName)) {
        return docName;
    }
    
    // Thực đơn, Kho hàng, Phiếu nhập/kiểm duy trì CÁCH LY ĐỘC LẬP theo từng chi nhánh
    const currentBranch = localStorage.getItem('currentBranch');
    
    if (currentBranch && currentBranch !== 'Hệ thống') {
        return `${docName}_${currentBranch}`;
    }
    
    return docName;
}


// Hàm LƯU dữ liệu lên mây (Đã thêm tính năng bắt lỗi chặn CSDL)
window.saveToFirebase = function(docName, dataArray) {
    const finalDocName = getBranchDocName(docName);
    
    db.collection("pos_226").doc(finalDocName).set({ items: dataArray })
        .then(() => console.log(`[Firebase] Đã lưu ${finalDocName} thành công!`))
        .catch(error => {
            // Ném thẳng bảng báo lỗi ra giữa màn hình điện thoại
            alert(`LỖI KHÔNG THỂ LƯU (${finalDocName}): \n\n${error.message}\n\nVui lòng chụp màn hình này lại!`);
            console.error(`[Firebase] Lỗi lưu ${finalDocName}:`, error);
        });
}

// Hàm LẮNG NGHE Real-time (Đã nâng cấp cách ly)
window.listenToFirebase = function(docName, callback) {
    const finalDocName = getBranchDocName(docName);
    
    db.collection("pos_226").doc(finalDocName).onSnapshot((doc) => {
        if (doc.exists) {
            callback(doc.data().items);
        } else {
            callback(null); // Document chưa tồn tại
        }
    });
}