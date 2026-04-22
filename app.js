const { createApp, ref, computed, onMounted, watch } = Vue;

const supabaseUrl = 'https://dtfdzuggnitsdnlutryn.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZmR6dWdnbml0c2RubHV0cnluIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5Mjk0NTAsImV4cCI6MjA5MDUwNTQ1MH0.9Ne1ONIO9-ASkThtFZJLxV42dbyIMGkHwweIjTZ5A6Q';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);
let studentChannel = null;
let teacherChannel = null;

// Danh sách tài khoản mặc định
const FIXED_ACCOUNTS = [
    { id: 1, name: 'admin', password: '123', role: 'admin' },
    { id: 2, name: 'teacher', password: '123', role: 'teacher' }
];
createApp({
    setup() {
        // Lấy lại trang và tab cũ từ bộ nhớ trình duyệt (nếu có)
const savedView = localStorage.getItem('eduexam_current_view') || 'login';
const savedTab = localStorage.getItem('eduexam_teacher_tab') || 'exams';

const view = ref(savedView);
const teacherTab = ref(savedTab);
        const currentTime = ref(new Date());
        // --- 1. KHAI BÁO TẤT CẢ BIẾN STATE TRƯỚC ---
        const savedUser = localStorage.getItem('eduexam_user');
        const currentUser = ref(savedUser ? JSON.parse(savedUser) : null);
        // 2. Cập nhật Watcher để lưu đúng tên khóa
watch(view, (newView) => {
    localStorage.setItem('eduexam_current_view', newView);
});

watch(teacherTab, (newTab) => {
    localStorage.setItem('eduexam_teacher_tab', newTab);
});
        
        const currentExam = ref(null);
        const currentSlide = ref(0);
        const newExam = ref({ title: '', questions: [], settings: {} });
        
        const notification = ref({ show: false, message: '', type: 'success' });
        const authForm = ref({ name: '', password: '' });
        const users = ref([]);
        const exams = ref([]);
        const allResults = ref([]);
        const searchUser = ref('');
        
        // Các biến hỗ trợ khác
        const isFullscreen = ref(false);
        const cheatWarnings = ref(0);
        const timeLeft = ref(0);
        const timerInterval = ref(null);
        const studentAnswers = ref([]);

// Tìm và thay thế đoạn watch cũ
watch(() => [...studentAnswers.value], () => {
    if (view.value === 'exam-room') {
        sendRealtimeUpdate();
    }
}, { deep: true });
        const finalResult = ref({ score: 0, correct: 0 });
        
        // AI & UI State
        const isGenerating = ref(false);
        const aiPrompt = ref('');
        const aiMatrix = ref({ mc: true, tf: true, sa: true });
        const aiUploadedImage = ref(null);
        const aiUploadedFileName = ref('');
        const aiImageBase64 = ref('');
        const showSettingsModal = ref(false);
        const showSlideAnswer = ref(false);
        const activeQuestionTab = ref('mc'); // Tab mặc định khi soạn đề là Trắc nghiệm

        const searchMonitor = ref('');
const filteredExamsForMonitor = computed(() => {
    if (!searchMonitor.value.trim()) return exams.value;
    
    const term = searchMonitor.value.toLowerCase();
    return exams.value.filter(exam => 
        exam.title.toLowerCase().includes(term) || 
        (exam.creator && exam.creator.toLowerCase().includes(term))
    );
});
// Tìm đoạn khai báo các ref trong setup() và thêm vào:
// Trong setup() của app.js
// app.js
const searchExam = ref('');

const filteredExams = computed(() => {
    if (!searchExam.value.trim()) return exams.value;
    const term = searchExam.value.toLowerCase().trim();
    return exams.value.filter(exam => 
        exam.title.toLowerCase().includes(term)
    );
});

const sessionId = ref(Math.random().toString(36).substring(2, 10)); // ID phiên làm việc
const monitoringExamId = ref('');    // ID đề thi đang được giám sát
const isMonitoring = ref(false);     // Trạng thái mở phòng giám sát
const activeStudents = ref({}); // Phải có ref ở đây
const studentFile = ref(null);       // File nộp bài tự luận của học sinh
const isAIGradingSubmission = ref(false); // Trạng thái AI đang chấm bài khi nộp\
const defaultSettings = {
    scoreVisibility: 'always',
    answerVisibility: 'always',
    attemptLimit: 0,
    password: '',
    autoMonitor: true,
    shuffleMode: true,
    tfGradingScale: [0, 0.1, 0.25, 0.5, 1.0],
    // --- THUỘC TÍNH MỚI ---
    isPublished: false,
    scheduledAt: null,
    closedAt: null      // Thêm dòng này: Thời điểm đóng đề
};

        // --- 2. SAU ĐÓ MỚI ĐẾN WATCH VÀ HÀM ---
        const renderMath = () => {
            setTimeout(() => {
                if (window.MathJax && window.MathJax.typesetPromise) 
                    window.MathJax.typesetPromise().catch((err) => console.error('MathJax error:', err));
            }, 100); 
        };

        // Bây giờ watch sẽ hoạt động vì 'view' đã tồn tại
        watch([view, currentExam, currentSlide, newExam], () => renderMath(), { deep: true });

        // ... các hàm showNotify, handleLogin, v.v. viết tiếp ở dưới

        const gradingModal = ref(false);
        const currentGradingResult = ref(null);
        const manualScore = ref(0);
        const questionScores = ref([]); 
        const joinCode = ref('');
        const showQrModal = ref(false);
        const currentQrCode = ref('');
        const currentQrExamTitle = ref('');

        // ==========================================
        // HÀM HỆ THỐNG VÀ XỬ LÝ CHUNG
        // ==========================================
        const showNotify = (msg, type = 'success') => {
            notification.value = { show: true, message: msg, type: type };
            setTimeout(() => { notification.value.show = false; }, 3000);
        };

        const shuffleArray = (array) => {
            let currentIndex = array.length, randomIndex;
            while (currentIndex !== 0) {
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;
                [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
            }
            return array;
        };

        // app.js

const handleVisibilityChange = () => {
    if (view.value === 'exam-room' && document.hidden) {
        if (currentExam.value?.settings?.autoMonitor === false) return; 
        
        cheatWarnings.value++;
        
        // GỌI HÀM CẬP NHẬT REALTIME NGAY LẬP TỨC
        sendRealtimeUpdate(`Vi phạm chuyển Tab (${cheatWarnings.value}/3)`); 
        
        if (cheatWarnings.value >= 3) {
            showNotify("Vi phạm quá 3 lần. Tự động thu bài!", "error");
            if (timerInterval.value) clearInterval(timerInterval.value);
            submitExam(false); 
        } else {
            showNotify(`CẢNH BÁO: Bạn vừa rời màn hình thi (${cheatWarnings.value}/3)`, 'error');
        }
    }
};

const handleFullscreenChange = () => {
    const isFull = !!(document.fullscreenElement || document.webkitFullscreenElement);
    isFullscreen.value = isFull; 

    if (view.value === 'exam-room' && !isFull) {
        if (isAIGradingSubmission.value) return;

        cheatWarnings.value++;
        
        // GỌI HÀM CẬP NHẬT REALTIME KHI THOÁT TOÀN MÀN HÌNH
        sendRealtimeUpdate(`Thoát toàn màn hình (${cheatWarnings.value}/5)`);

        showNotify(`CẢNH BÁO: Không được thoát chế độ toàn màn hình!`, "error");

        if (cheatWarnings.value >= 5) {
            showNotify("Vi phạm quá số lần. Tự động thu bài!", "error");
            submitExam(false); 
        }
    }
};

const enterFullScreen = () => {
    const elem = document.documentElement;
    try {
        if (elem.requestFullscreen) {
            elem.requestFullscreen();
        } else if (elem.webkitRequestFullscreen) { /* Safari di động */
            elem.webkitRequestFullscreen();
        } else if (elem.msRequestFullscreen) {
            elem.msRequestFullscreen();
        }
    } catch (err) {
        console.warn("Thiết bị không hỗ trợ hoặc chặn Fullscreen:", err);
        // Không chặn người dùng, chỉ thông báo nhẹ
        showNotify("Chế độ toàn màn hình bị hạn chế trên thiết bị này.", "info");
    }
};

        const setupGlobalAuthPresence = async () => {
            if (!currentUser.value) return;
            const userChannel = supabaseClient.channel(`auth-presence-${currentUser.value.id}`, { config: { presence: { key: currentUser.value.id } } });
            userChannel.on('presence', { event: 'sync' }, () => {
                const state = userChannel.presenceState();
                const sessions = state[currentUser.value.id];
                if (sessions && sessions.length > 1) {
                    const otherSession = sessions.find(s => s.sessionId !== sessionId.value);
                    if (otherSession) showNotify("Tài khoản đang được đăng nhập ở thiết bị khác!", "error");
                }
            }).subscribe(async (status) => {
                if (status === 'SUBSCRIBED') await userChannel.track({ userId: currentUser.value.id, userName: currentUser.value.name, sessionId: sessionId.value, onlineAt: new Date().toISOString() });
            });
        };

const loadData = async () => {
    try {
        // Tải đề thi
        const { data: examData } = await supabaseClient.from('exams').select('*').order('id', { ascending: false });
        if (examData) exams.value = examData;

        // TẢI NGƯỜI DÙNG: Bổ sung đoạn này để đồng bộ tài khoản giữa các máy
        const { data: userData } = await supabaseClient.from('users').select('*');
        if (userData) {
            users.value = [...FIXED_ACCOUNTS, ...userData];
        }
        
        console.log("✅ Dữ liệu đã được đồng bộ từ Cloud");
    } catch (err) {
        console.error("Lỗi loadData:", err);
    }
};
        let isRealtimeSubscribed = false;
onMounted(async () => {
    console.log("🏗️ Đang khởi tạo và đồng bộ dữ liệu EduPro...");

    // 1. Tải danh sách đề thi từ Supabase
    const { data: examData } = await supabaseClient
        .from('exams')
        .select('*')
        .order('id', { ascending: false });
    if (examData) exams.value = examData;

    // 2. Tải danh sách người dùng (để đồng bộ tài khoản)
    const { data: userData } = await supabaseClient.from('users').select('*');
    if (userData) {
        users.value = [...FIXED_ACCOUNTS, ...userData];
    }

    // 3. QUAN TRỌNG: Tải toàn bộ kết quả đã nộp để không bị mất khi F5
    const { data: resData, error: resError } = await supabaseClient
        .from('results')
        .select('*')
        .order('id', { ascending: false });
    
    if (resData) {
        allResults.value = resData;
        console.log("✅ Đã tải lại " + resData.length + " kết quả nộp bài.");
    } else if (resError) {
        console.error("Lỗi tải kết quả:", resError.message);
    }

    // 4. Các thiết lập hệ thống khác
    if (currentUser.value) {
        setupGlobalAuthPresence(); 
        setTimeout(() => { subscribeToExamChanges(); }, 1500); 
    }

    // Render MathJax cho các công thức toán học (nếu có)
    if (window.MathJax && window.MathJax.typesetPromise) {
        window.MathJax.typesetPromise().catch(err => console.log(err));
    }

    console.log("🚀 Hệ thống sẵn sàng.");
});
        // ==========================================
        // QUẢN LÝ TÀI KHOẢN & PHÂN QUYỀN
        // ==========================================
        const switchView = (target) => { authForm.value.name = ''; authForm.value.password = ''; view.value = target; };
        const getRoleName = (role) => role === 'admin' ? 'Quản trị viên' : role === 'teacher' ? 'Giáo viên' : 'Học sinh';
        const getRoleBadgeClass = (role) => role === 'admin' ? 'bg-purple-100 text-purple-700' : role === 'teacher' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700';

        const handleRegister = async () => {
            if (!authForm.value.name.trim() || !authForm.value.password.trim()) return showNotify("Vui lòng điền đầy đủ thông tin", "error");
            if (users.value.find(u => u.name.toLowerCase() === authForm.value.name.toLowerCase())) return showNotify("Tên người dùng đã tồn tại", "error");
            const newUser = { id: Date.now(), name: authForm.value.name, password: authForm.value.password, role: 'student' };
            const { error } = await supabaseClient.from('users').insert([newUser]);
            if (!error) { users.value.push(newUser); showNotify("Đăng ký thành công!"); switchView('login'); } else showNotify("Lỗi CSDL: " + error.message, "error");
        };

const handleLogin = async () => {
    if (!authForm.value.name.trim() || !authForm.value.password.trim()) 
        return showNotify("Vui lòng nhập tên và mật khẩu", "error");
    
    // 1. Kiểm tra tài khoản mặc định trước
    let user = FIXED_ACCOUNTS.find(u => u.name.toLowerCase() === authForm.value.name.toLowerCase());

    // 2. Truy vấn Supabase nếu không phải tài khoản mặc định
    if (!user) {
        try {
            const { data, error } = await supabaseClient
                .from('users')
                .select('*') // Bổ sung select('*') để đảm bảo lấy đủ dữ liệu
                .eq('name', authForm.value.name)
                .maybeSingle(); // Dùng maybeSingle() thay vì single() để tránh lỗi nếu không tìm thấy
            
            if (error) throw error;
            user = data;
        } catch (err) {
            console.error("Lỗi đăng nhập:", err.message);
            return showNotify("Lỗi hệ thống khi đăng nhập", "error");
        }
    }

    if (!user) return showNotify("Tài khoản không tồn tại", "error");
    if (user.password !== authForm.value.password) return showNotify("Mật khẩu không chính xác", "error");

    currentUser.value = user;
    localStorage.setItem('eduexam_user', JSON.stringify(user));
    
    view.value = user.role === 'admin' ? 'admin-dash' : user.role === 'teacher' ? 'teacher-dash' : 'student-dash';
    if(user.role === 'teacher') teacherTab.value = 'exams';
    
    showNotify(`Chào mừng ${user.name}!`);
    
    // Sau khi đăng nhập thành công, khởi tạo Realtime
    subscribeToExamChanges();
};

const logout = () => {
    if (view.value === 'exam-room' && !confirm("Đăng xuất khi đang thi?")) return;
    
    // Ngắt kênh chủ động
    if (realtimeChannel) {
        supabaseClient.removeChannel(realtimeChannel);
        realtimeChannel = null; 
    }
    
    localStorage.clear();
    currentUser.value = null;
    view.value = 'login';
    showNotify("Đã đăng xuất!");
};

        const goHome = () => {
    if (view.value === 'exam-room' && !confirm("Rời khỏi phòng thi? Tiến trình sẽ không được lưu nếu chưa nộp bài.")) return;
    
    // Reset dữ liệu thi để tránh lỗi title khi quay lại dash
    currentExam.value = null; 
    
    if (view.value === 'presentation') exitPresentation();
    if (timerInterval.value) clearInterval(timerInterval.value);
    
    // Sử dụng dấu ? để tránh lỗi khi F5 mà currentUser chưa kịp load
    view.value = currentUser.value?.role === 'admin' ? 'admin-dash' : currentUser.value?.role === 'teacher' ? 'teacher-dash' : 'student-dash';
};

        const filteredUsers = computed(() => searchUser.value ? users.value.filter(u => u.name.toLowerCase().includes(searchUser.value.toLowerCase())) : users.value);
        const deleteUser = async (id) => { 
            if (confirm("Xóa tài khoản này?")) { const { error } = await supabaseClient.from('users').delete().eq('id', id); if (!error) { users.value = users.value.filter(u => u.id !== id); showNotify("Đã xóa tài khoản."); } }
        };
        const updateUserRole = async (user, newRole) => { 
            const { error } = await supabaseClient.from('users').update({ role: newRole }).eq('id', user.id); if (!error) { user.role = newRole; showNotify("Cập nhật quyền thành công."); }
        };
        const openEditModal = (user) => { editUserData.value = { ...user }; showEditModal.value = true; };
        const saveUserEdit = async () => {
            const { error } = await supabaseClient.from('users').update({ name: editUserData.value.name, password: editUserData.value.password, role: editUserData.value.role }).eq('id', editUserData.value.id);
            if (!error) { const idx = users.value.findIndex(u => u.id === editUserData.value.id); if (idx !== -1) users.value[idx] = { ...editUserData.value }; showEditModal.value = false; showNotify("Đã lưu thông tin."); }
        };

        // ==========================================
        // QUẢN LÝ ĐỀ THI, TRÌNH CHIẾU & PHÒNG THI 4.0
        // ==========================================
        const startPresentation = (exam) => {
            if(exam.type !== 'quiz') return showNotify("Chỉ hỗ trợ đề trắc nghiệm/hỗn hợp!", "error");
            currentExam.value = exam; currentSlide.value = 0; showSlideAnswer.value = false; view.value = 'presentation';
        };
        const nextSlide = () => { if (currentSlide.value < currentExam.value.questions.length - 1) { currentSlide.value++; showSlideAnswer.value = false; } };
        const prevSlide = () => { if (currentSlide.value > 0) { currentSlide.value--; showSlideAnswer.value = false; } };
        const exitPresentation = () => { view.value = 'teacher-dash'; teacherTab.value = 'exams'; };

const startMonitoring = (exam) => {
    if (!exam) return;
    isMonitoring.value = true;
    currentExam.value = exam;
    monitoringExamId.value = exam.id;
    activeStudents.value = {}; 

    if (teacherChannel) {
        supabaseClient.removeChannel(teacherChannel);
        teacherChannel = null;
    }

    teacherChannel = supabaseClient.channel('room-' + exam.id);
    teacherChannel
        .on('presence', { event: 'sync' }, () => {
            const state = teacherChannel.presenceState();
            const newActiveList = {};
            for (const id in state) {
                const data = state[id][0];
                if (data && data.studentName) {
                    // ĐẢM BẢO GÁN ĐÚNG KEY 'progress' VÀ 'total'
                    newActiveList[data.studentName] = {
                        progress: data.progress || 0,
                        total: data.total || 0,
                        cheats: data.cheats || 0,
                        status: data.status || 'Đang làm bài',
                        lastUpdate: data.lastUpdate
                    };
                }
            }
            // ÉP VUE CẬP NHẬT GIAO DIỆN
            activeStudents.value = { ...newActiveList };
            console.log("✅ Đã cập nhật UI Giáo viên:", activeStudents.value);
        })
        .subscribe();
};
const sendRealtimeUpdate = async (statusText = 'Đang làm bài') => {
    if (!studentChannel || !currentExam.value) return;
    
    // Đếm số câu dựa trên studentAnswers
    const currentProgress = studentAnswers.value.filter((ans, i) => {
        const q = currentExam.value.questions[i];
        if (!q) return false;
        if (q.type === 'mc') return ans.choice !== null && ans.choice !== undefined;
        if (q.type === 'tf') return Array.isArray(ans.choice) && ans.choice.some(c => c !== null);
        if (q.type === 'sa' || q.type === 'essay') return (ans.text && ans.text.trim() !== '');
        return false;
    }).length;

    await studentChannel.track({ 
        studentName: currentUser.value.name, 
        progress: currentProgress, // Gửi key 'progress'
        total: currentExam.value.questions.length, 
        cheats: cheatWarnings.value, 
        status: statusText, 
        lastUpdate: Date.now() 
    });
};

       const addQuestion = (type) => {
    const targetType = type || activeQuestionTab.value;
    let options = ['', '', '', ''];
    let correct = 0;
    let points = 0.25;

    if (targetType === 'tf') {
        correct = [true, true, true, true];
        points = 1.0;
    } else if (targetType === 'sa' || targetType === 'essay') {
        options = [];
        correct = null;
        points = 0.5;
    }

    newExam.value.questions.push({
        type: targetType,
        text: '',
        options: options,
        correct: correct,
        explanation: '',
        points: points
    });
    showNotify(`Đã thêm 1 câu vào phần ${targetType.toUpperCase()}`);
};
const removeQuestion = (originalIdx) => {
    if (confirm("Bạn có chắc muốn xóa câu hỏi này?")) {
        newExam.value.questions.splice(originalIdx, 1);
        showNotify("Đã xóa câu hỏi", "error");
    }
};
        const openEditExam = (exam) => { newExam.value = JSON.parse(JSON.stringify(exam)); view.value = 'create-exam'; };
const openCreateNewExam = () => {
    newExam.value = { 
        title: '', 
        type: 'quiz', 
        time: 15, 
        questions: [], 
        essayContent: '', 
        // Tạo bản sao từ defaultSettings để tránh tham chiếu ngược
        settings: { ...defaultSettings },
        // Đảm bảo các thuộc tính hệ thống khác cũng được reset
        examCode: Math.random().toString(36).substring(2, 8).toUpperCase()
    }; 
    
    // Chuyển sang màn hình soạn thảo
    view.value = 'create-exam'; 
    
    // Reset tab soạn thảo về Trắc nghiệm mặc định
    activeQuestionTab.value = 'mc';
    
    showNotify("Đã khởi tạo phôi đề thi mới!");
};
        const saveExam = async () => {
            if (!newExam.value.title) return showNotify("Vui lòng nhập tên đề thi/bài tập", "error");
            if (newExam.value.type === 'quiz' && newExam.value.questions.length === 0) return showNotify("Đề thi cần ít nhất 1 câu hỏi", "error");
            
            const isEditing = !!newExam.value.id;
            if(!newExam.value.settings) newExam.value.settings = {...defaultSettings};
            const examData = { ...newExam.value, creator: currentUser.value.name, examCode: newExam.value.examCode || Math.random().toString(36).substring(2, 8).toUpperCase() };

            let error;
            if (isEditing) error = (await supabaseClient.from('exams').update(examData).eq('id', newExam.value.id)).error;
            else { examData.id = Date.now(); error = (await supabaseClient.from('exams').insert([examData])).error; }
            
            if (!error) {
                if (isEditing) { const idx = exams.value.findIndex(e => e.id === examData.id); if (idx !== -1) exams.value[idx] = examData; showNotify("Đã cập nhật đề thi!"); } 
                else { exams.value.push(examData); showNotify("Đã giao bài thành công! Mã Code: " + examData.examCode); }
                view.value = 'teacher-dash'; teacherTab.value = 'exams';
            } else showNotify("Lỗi lưu đề: " + error.message, "error");
        };

        const deleteExam = async (id) => {
            if(confirm("Bạn có chắc chắn muốn xóa vĩnh viễn đề thi này không?")) {
                await supabaseClient.from('exams').delete().eq('id', id); await supabaseClient.from('results').delete().eq('examId', id);
                exams.value = exams.value.filter(e => e.id !== id); allResults.value = allResults.value.filter(r => r.examId !== id); showNotify("Đã xóa đề thi.");
            }
        };

        const viewResults = (id) => { currentExam.value = exams.value.find(e => e.id === id); view.value = 'view-results'; };
const filteredResults = computed(() => {
    if (!currentExam.value) return [];
    
    // 1. Lọc toàn bộ kết quả của bài thi này từ mảng allResults
    const resultsForExam = allResults.value.filter(r => r.examId === currentExam.value.id);
    
    // 2. Nhóm theo tên học sinh để xử lý nếu học sinh làm bài nhiều lần
    const grouped = {};
    
    resultsForExam.forEach(r => {
        const studentId = r.studentName;
        
        if (!grouped[studentId]) {
            grouped[studentId] = { ...r, totalAttempts: 1 };
        } else {
            grouped[studentId].totalAttempts++;
            // CHỈ GIỮ LẠI BẢN GHI CÓ ĐIỂM CAO NHẤT ĐỂ HIỂN THỊ
            if (r.score > grouped[studentId].score) {
                const oldAttempts = grouped[studentId].totalAttempts;
                Object.assign(grouped[studentId], r);
                grouped[studentId].totalAttempts = oldAttempts;
            }
        }
    });
    
    // Trả về mảng danh sách bài làm đã qua xử lý
    return Object.values(grouped).sort((a, b) => b.id - a.id);
});
            const filteredEditorQuestions = computed(() => {
    if (!newExam.value || !newExam.value.questions) return [];
    // Trả về danh sách câu hỏi kèm theo index gốc để dễ sửa/xóa
    return newExam.value.questions
        .map((q, idx) => ({ ...q, originalIdx: idx }))
        .filter(q => q.type === activeQuestionTab.value);
});
        const handleAiFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Reset trạng thái file cũ
    aiUploadedImage.value = null; 
    aiImageBase64.value = ''; 
    aiUploadedFileName.value = file.name;
    
    const fileExt = file.name.split('.').pop().toLowerCase();
    showNotify("Hệ thống đang tiền xử lý tài liệu...", "success");

    // XỬ LÝ ẢNH (JPG, PNG)
    if (['jpg', 'jpeg', 'png'].includes(fileExt)) {
        const reader = new FileReader();
        reader.onload = (e) => { 
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const scale = Math.min(1500 / img.width, 1);
                canvas.width = img.width * scale;
                canvas.height = img.height * scale;
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                
                const compressedBase64 = canvas.toDataURL('image/jpeg', 0.6);
                aiUploadedImage.value = compressedBase64; 
                aiImageBase64.value = compressedBase64.split(',')[1]; 
                showNotify("Đã nén ảnh thành công!"); 
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    } 
    
    // XỬ LÝ PDF (Đọc toàn bộ các trang)
    else if (fileExt === 'pdf') {
        const reader = new FileReader();
        reader.onload = async (e) => { 
            try {
                const typedarray = new Uint8Array(e.target.result);
                if (!window.pdfjsLib) throw new Error("Thư viện PDF chưa sẵn sàng!");
                
                window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';
                
                const pdf = await window.pdfjsLib.getDocument(typedarray).promise; 
                let totalHeight = 0;
                let maxWidth = 0;
                const canvases = [];
                
                // Đọc TOÀN BỘ trang thay vì giới hạn 4 trang như trước
                const numPages = pdf.numPages; 
                
                for (let i = 1; i <= numPages; i++) {
                    const page = await pdf.getPage(i);
                    const viewport = page.getViewport({ scale: 1.2 }); 
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: ctx, viewport: viewport }).promise;
                    canvases.push(canvas);
                    totalHeight += canvas.height;
                    if (canvas.width > maxWidth) maxWidth = canvas.width;
                }
                
                const finalCanvas = document.createElement('canvas');
                finalCanvas.width = maxWidth;
                finalCanvas.height = totalHeight;
                const finalCtx = finalCanvas.getContext('2d');
                finalCtx.fillStyle = "white";
                finalCtx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);
                
                let currentY = 0;
                for (let canvas of canvases) {
                    finalCtx.drawImage(canvas, 0, currentY);
                    currentY += canvas.height;
                }
                
                // Nén JPEG 0.4 để giảm dung lượng khi gửi đề thi nhiều câu
                // Tìm trong handleAiFileUpload đoạn xử lý PDF
// app.js
const base64Img = finalCanvas.toDataURL('image/jpeg', 0.25); // Tăng lên 0.25 để AI nhìn thấy chữ
//                 aiUploadedImage.value = base64Img; 
                aiImageBase64.value = base64Img.split(',')[1]; 
                
                showNotify(`Đã chuẩn bị xong ${numPages} trang PDF!`);
            } catch(err) {
                showNotify("Lỗi xử lý PDF: " + err.message, "error");
            }
        };
        reader.readAsArrayBuffer(file);
    } 
    
    // XỬ LÝ WORD (DOCX)
    else if (fileExt === 'docx') {
        const reader = new FileReader();
        reader.onload = (e) => {
            if (!window.mammoth) return showNotify("Thư viện Word chưa sẵn sàng!", "error");
            mammoth.extractRawText({ arrayBuffer: e.target.result })
            .then(res => { 
                aiPrompt.value = res.value + "\n\n" + aiPrompt.value; 
                showNotify("Đã trích xuất nội dung văn bản từ Word!"); 
            })
            .catch(err => showNotify("Lỗi đọc Word: " + err.message, "error"));
        };
        reader.readAsArrayBuffer(file);
    }
    event.target.value = ''; 
};

        const handleGenerateAI = async () => {
    if (!aiPrompt.value.trim() && !aiImageBase64.value) {
        return showNotify("Vui lòng nhập nội dung hoặc tải file đề!", "error");
    }
    
    isGenerating.value = true;
    // Thông báo cho người dùng về quá trình xử lý bóc tách 3 phần
    showNotify("AI đang phân tích và bóc tách 3 phần: Trắc nghiệm, Đúng/Sai, Tự luận...", "success");
    
    try {
        // Cấu trúc Prompt đặc biệt để ép AI phân loại đúng theo file AZOTA.docx 
        const strictPrompt = `
            Dựa trên nội dung tài liệu này, hãy bóc tách chính xác thành các loại sau:
            1. Các câu có 4 đáp án A,B,C,D: để type là 'mc'. 
            2. Các câu có chùm ý a,b,c,d (Đúng/Sai): để type là 'tf'. Mảng correct phải có 4 giá trị true/false. 
            3. Các câu hỏi yêu cầu giải thích/trình bày (Tự luận): để type là 'sa'. 
            Nội dung bổ sung từ người dùng: ${aiPrompt.value.trim()}
        `;

        const payload = { 
            prompt: strictPrompt, 
            imageBase64: aiImageBase64.value || null,
            matrix: aiMatrix.value // 
        };

        const { data, error } = await supabaseClient.functions.invoke('generate-exam', { 
            body: payload 
        });
        
        if (error) throw error;
        
        let generatedQuestions = [];
        try {
            let aiRawText = typeof data === 'string' ? data : (data.text || JSON.stringify(data));
            const cleanData = aiRawText.replace(/```json/g, '').replace(/```/g, '').trim();
            generatedQuestions = JSON.parse(cleanData);
        } catch (jsonErr) {
            throw new Error("Dữ liệu AI trả về lỗi cấu trúc. Hãy thử lại bằng cách quét ảnh rõ hơn.");
        }

        // --- BỘ LỌC LOGIC SỬA SAI CHO AI ---
        const finalQuestions = (Array.isArray(generatedQuestions) ? generatedQuestions : []).map(q => {
            let finalType = q.type || 'mc';

            // Kiểm tra nếu AI nhầm lẫn: Câu có 4 ý a,b,c,d nhưng lại để 'mc' thì ép về 'tf' (Đúng/Sai) 
            if (q.options && q.options.length === 4 && Array.isArray(q.correct)) {
                finalType = 'tf';
            }

            // Kiểm tra nếu câu hỏi không có phương án lựa chọn thì ép về 'sa' (Tự luận/Trả lời ngắn) 
            if (!q.options || q.options.length === 0 || q.options.every(opt => opt === "")) {
                finalType = 'sa';
            }

            return { 
                type: finalType, 
                text: q.text || "Câu hỏi không có nội dung", 
                options: q.options || (finalType === 'tf' ? ['', '', '', ''] : (finalType === 'mc' ? ['', '', '', ''] : [])), 
                correct: q.correct !== undefined ? q.correct : (finalType === 'tf' ? [true, true, true, true] : 0), 
                explanation: q.explanation || '',
                // Gán điểm mặc định theo chuẩn phân phối điểm thường thấy
                points: finalType === 'tf' ? 1.0 : (finalType === 'sa' ? 0.75 : 0.25) 
            };
        });

        if (finalQuestions.length === 0) {
            throw new Error("Không tìm thấy câu hỏi nào hợp lệ.");
        }

        // Cập nhật vào form tạo đề
        newExam.value = { 
            title: 'Đề thi bóc tách AI - ' + new Date().toLocaleDateString('vi-VN'), 
            type: 'quiz', 
            time: 45, 
            questions: finalQuestions, 
            essayContent: '', 
            settings: { ...defaultSettings } 
        };

        showNotify(`Thành công! Đã bóc tách được ${finalQuestions.length} câu hỏi theo đúng phân loại.`);
        
        // Reset trạng thái sau khi xong
        aiPrompt.value = ''; 
        aiUploadedImage.value = null; 
        aiImageBase64.value = ''; 
        
        // Chuyển sang màn hình soạn thảo đề thi để giáo viên kiểm tra 
        view.value = 'create-exam'; 
        
    } catch (err) { 
        console.error("AI Error:", err);
        showNotify("Lỗi xử lý: " + err.message, "error"); 
    } finally { 
        isGenerating.value = false; 
    }
};

        const exportToWord = (exam) => {
            let content = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word'><head><meta charset='utf-8'><title>${exam.title}</title><style>body { font-family: 'Times New Roman'; font-size: 14pt; } .title { text-align: center; font-weight: bold; font-size: 16pt; text-transform: uppercase; margin-bottom: 5px;} .time { text-align: center; font-style: italic; margin-bottom: 20px; }</style></head><body><div class='title'>ĐỀ THI: ${exam.title}</div><div class='time'>Thời gian làm bài: ${exam.time} phút</div>`;
            if (exam.type === 'quiz') {
                exam.questions.forEach((q, i) => {
                    content += `<div style="margin-top: 15px;"><b>Câu ${i + 1}:</b> ${q.text}</div>`;
                    if(q.type === 'mc' || q.type === 'tf') q.options.forEach((opt, o) => content += `<div style="margin-left: 15px;">${String.fromCharCode(65 + o)}. ${opt}</div>`);
                    else content += `<div style="height: 80px;"></div>`;
                });
                content += `<br><hr><div class='title' style='margin-top: 20px;'>BẢNG ĐÁP ÁN</div>`;
                exam.questions.forEach((q, i) => { 
                    content += `<div style="margin-bottom: 5px;"><b>Câu ${i + 1}:</b> ${q.type==='mc'?String.fromCharCode(65+q.correct):'Tự luận'}. <br><i>${q.explanation}</i></div>`; 
                });
            } else content += `<div><b>Nội dung đề bài tự luận:</b><br>${exam.essayContent.replace(/\n/g, '<br>')}</div>`;
            content += `</body></html>`;
            const blob = new Blob(['\ufeff', content], { type: 'application/msword' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `De_Thi_${exam.title.replace(/\s/g, '_')}.doc`; link.click();
            showNotify("Đã xuất file Word thành công!");
        };

        // ==========================================
        // QUẢN LÝ CHẤM ĐIỂM (GIÁO VIÊN & AI CHẤM TỰ LUẬN)
        // ==========================================
const openGradingModal = (result) => { 
    currentGradingResult.value = result; 
    const exam = exams.value.find(e => e.id === result.examId);
    
    if (exam && result.studentAnswersLog) {
        questionScores.value = result.studentAnswersLog.map((ans, i) => {
            // Ưu tiên lấy điểm đã chấm tay trước đó (nếu có)
            if (ans.score !== undefined && ans.score !== null) return ans.score; 
            
            // Nếu chưa chấm tay, tính lại dựa trên đáp án gốc
            const q = exam.questions[i]; 
            const p = parseFloat(q.points) || 0;
            if (q.type === 'mc') return (ans.choice === q.correct) ? p : 0;
            if (q.type === 'tf') { 
                let match = 0; 
                if(ans.choice) {
                    for (let j=0; j<4; j++) if (ans.choice[j]===q.correct[j]) match++; 
                }
                const scale = exam.settings?.tfGradingScale || [0, 0.1, 0.25, 0.5, 1.0]; 
                return (scale[match] || 0) * p; 
            }
            return 0; 
        });
    }
    updateTotalScore(); // Tự động tính lại manualScore
    gradingModal.value = true; 
};

const updateTotalScore = () => {
    const total = questionScores.value.reduce((sum, score) => {
        const num = parseFloat(score);
        return sum + (isNaN(num) ? 0 : num);
    }, 0);
    // Làm tròn đến 2 chữ số thập phân
    manualScore.value = Math.round(total * 100) / 100;
};
        const saveManualGrade = async () => {
            let updatedLog = currentGradingResult.value.studentAnswersLog ? currentGradingResult.value.studentAnswersLog.map((ans, i) => ({ ...ans, score: questionScores.value[i] || 0 })) : null;
            const { error } = await supabaseClient.from('results').update({ score: parseFloat(manualScore.value), status: 'graded', studentAnswersLog: updatedLog || currentGradingResult.value.studentAnswersLog }).eq('id', currentGradingResult.value.id);
            if (!error) {
                const idx = allResults.value.findIndex(r => r.id === currentGradingResult.value.id);
                if (idx !== -1) { allResults.value[idx].score = parseFloat(manualScore.value); allResults.value[idx].status = 'graded'; if (updatedLog) allResults.value[idx].studentAnswersLog = updatedLog; }
                gradingModal.value = false; showNotify("Đã lưu điểm bài thi thành công!");
            } else showNotify("Lỗi CSDL khi lưu điểm: " + error.message, "error");
        };

        const backgroundAIGrading = async (resRec, examData) => {
            const promises = examData.questions.map(async (q, i) => {
                const ans = resRec.studentAnswersLog[i]; const p = q.points || 0;
                if ((q.type === 'mc' || q.type === 'tf') && ans.choice === q.correct) return p;
                if ((q.type === 'sa' || q.type === 'essay') && (ans.text.trim() !== '' || ans.fileData)) {
                    try {
                        const prompt = `Chấm điểm câu trả lời sau: Yêu cầu: "${q.text}". Học sinh trả lời: "${ans.text}". Trả về MỘT SỐ NGUYÊN DUY NHẤT TỪ 0 ĐẾN 100 thể hiện phần trăm mức độ chính xác của câu trả lời. Không cần giải thích thêm.`;
                        const { data } = await supabaseClient.functions.invoke('generate-exam', { body: { prompt: prompt, imageBase64: ans.fileData?.split(',')[1] } });
                        if (data?.candidates) return (parseFloat(data.candidates[0].content.parts[0].text.replace(/[^0-9.]/g, '')) / 100) * p;
                    } catch(e) { console.error("AI Grading Error", e); }
                }
                return 0;
            });
            const scores = await Promise.all(promises); const total = scores.reduce((a, b) => a + b, 0);
            await supabaseClient.from('results').update({ score: total, status: 'graded' }).eq('id', resRec.id);
            const idx = allResults.value.findIndex(r => r.id === resRec.id); if (idx !== -1) { allResults.value[idx].score = total; allResults.value[idx].status = 'graded'; }
        };

        // ==========================================
        // QUẢN LÝ LÀM BÀI (HỌC SINH)
        // ==========================================

const realtimeTicker = setInterval(() => {
    if (view.value === 'exam-room') {
        sendRealtimeUpdate();
    } else {
        clearInterval(realtimeTicker);
    }
}, 5000); // Cứ 5 giây cập nhật 1 lần tự động
        const handleFileUpload = (event) => { const f = event.target.files[0]; if(f) { const r = new FileReader(); r.onload = (e) => studentFile.value = e.target.result; r.readAsDataURL(f); } };
        const handlePerQuestionFileUpload = (event, idx) => { const f = event.target.files[0]; if(f) { const r = new FileReader(); r.onload = (e) => studentAnswers.value[idx].fileData = e.target.result; r.readAsDataURL(f); } };
        const formattedTime = computed(() => { const m = Math.floor(timeLeft.value / 60); const s = timeLeft.value % 60; return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`; });

const submitExam = async (isManual = false) => {
    if (isManual) {
        const confirmMsg = "Xác nhận kết thúc bài thi và nộp bài?";
        if (!confirm(confirmMsg)) return;
    }

    isAIGradingSubmission.value = true;
    const previousView = view.value;
    view.value = 'result'; 

    if (timerInterval.value) clearInterval(timerInterval.value);
    
    if (document.fullscreenElement && document.exitFullscreen) {
        try { await document.exitFullscreen(); } catch (err) { console.log(err); }
    }

    if (studentChannel) {
        const statusText = cheatWarnings.value >= 3 ? 'Bị thu bài (Gian lận)' : 'Đã nộp bài';
        await sendRealtimeUpdate(statusText);
        supabaseClient.removeChannel(studentChannel);
    }

    try {
        let resData = null;
        const displayIdentity = `${studentProfile.value.fullName} - Lớp: ${studentProfile.value.className}`;

        if (currentExam.value.type === 'quiz') {
            let userScore = 0;
            let correctCount = 0;
            let hasEssay = false;

            currentExam.value.questions.forEach((q, i) => {
                const ans = studentAnswers.value[i];
                const p = parseFloat(q.points) || 0;

                if (q.type === 'mc') {
                    if (ans.choice === q.correct) {
                        correctCount++;
                        userScore += p;
                    }
                } 
                else if (q.type === 'tf') {
                    let match = 0;
                    if (ans.choice && Array.isArray(ans.choice)) {
                        for (let j = 0; j < 4; j++) {
                            if (ans.choice[j] === q.correct[j]) match++;
                        }
                    }
                    const scale = currentExam.value.settings?.tfGradingScale || [0, 0.1, 0.25, 0.5, 1.0];
                    userScore += (scale[match] || 0) * p;
                    if (match === 4) correctCount++;
                } 
                else if (q.type === 'sa' || q.type === 'essay') {
                    if ((ans.text && ans.text.trim() !== '') || ans.fileData) hasEssay = true;
                }
            });

            userScore = Math.round(userScore * 100) / 100;

            resData = { 
                id: Date.now(), 
                examId: currentExam.value.id, 
                studentName: displayIdentity, 
                submittedAt: new Date().toLocaleString('vi-VN'), 
                score: userScore, 
                correct: correctCount,
                cheats: cheatWarnings.value, 
                status: hasEssay ? 'pending' : 'graded',
                studentAnswersLog: JSON.parse(JSON.stringify(studentAnswers.value))
            };

            finalResult.value = { score: userScore, correct: correctCount };
        } else {
            resData = { 
                id: Date.now(), 
                examId: currentExam.value.id, 
                studentName: displayIdentity, 
                submittedAt: new Date().toLocaleString('vi-VN'), 
                type: 'essay', 
                cheats: cheatWarnings.value, 
                fileData: studentFile.value, 
                score: 0, 
                status: 'pending' 
            };
        }

        // LƯU VÀO CƠ SỞ DỮ LIỆU
        const { error } = await supabaseClient.from('results').insert([resData]);
        
        if (error) throw error;

        allResults.value.unshift(resData); // Thêm vào đầu danh sách để thấy ngay kết quả
        showNotify(cheatWarnings.value >= 3 ? "Tự động thu bài!" : "Nộp bài thành công!");
        
        if (currentExam.value.type === 'quiz' && resData.status === 'pending') {
            backgroundAIGrading(resData, currentExam.value); 
        }

    } catch (err) {
        console.error("Lỗi nộp bài:", err);
        view.value = previousView;
        showNotify("Lỗi nộp bài: " + err.message, "error");
    } finally {
        isAIGradingSubmission.value = false;
    }
};

// Thêm hàm cuộn tới câu hỏi (Helper function)
const scrollToQuestion = (idx) => {
    const el = document.getElementById('question-' + idx);
    if (el) {
        // Tính toán khoảng cách offset để không bị dính sát mép trên
        const offset = 100; 
        const bodyRect = document.body.getBoundingClientRect().top;
        const elementRect = el.getBoundingClientRect().top;
        const elementPosition = elementRect - bodyRect;
        const offsetPosition = elementPosition - offset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });
    }
};



        const joinExamByCode = () => {
            if (!joinCode.value.trim()) return showNotify("Vui lòng nhập mã phòng thi!", "error"); 
            const ex = exams.value.find(e => e.examCode === joinCode.value.trim().toUpperCase());
            if (!ex) return showNotify("Mã không đúng hoặc phòng thi không tồn tại", "error"); 
            startExam(ex); 
            joinCode.value = '';
        };
const openQrModal = (exam) => { 
            currentQrCode.value = exam.examCode; 
            currentQrExamTitle.value = exam.title; 
            showQrModal.value = true; 
        };
        const visibleExamsForStudent = computed(() => {
    return exams.value.filter(exam => {
        const settings = exam.settings;
        if (!settings) return false;

        const now = currentTime.value;
        const scheduledDate = settings.scheduledAt ? new Date(settings.scheduledAt) : null;
        const closedDate = settings.closedAt ? new Date(settings.closedAt) : null;

        if (closedDate && now >= closedDate) return false;
        if (settings.isPublished) return true;
        if (scheduledDate && now >= scheduledDate) return true;

        return false;
    });
});
const saveExamFast = async (exam) => {
    const { error } = await supabaseClient.from('exams').update({ settings: exam.settings }).eq('id', exam.id);
    if (!error) {
        showNotify("Đã giao bài thi thành công!");
    } else {
        showNotify("Lỗi: " + error.message, "error");
    }
};
const quickPublish = async (exam) => {
    try {
        const updatedSettings = { 
            ...(exam.settings || {}), 
            isPublished: true,
            scheduledAt: null 
        };
        const { error } = await supabaseClient.from('exams').update({ settings: updatedSettings }).eq('id', exam.id);
        if (error) throw error;
        exam.settings = updatedSettings;
        showNotify("Đã giao bài thi thành công!");
    } catch (error) {
        showNotify("Lỗi: " + error.message, "error");
    }
};

const unpublishExam = async (exam) => {
    if (!confirm("Thu hồi đề thi này? Học sinh sẽ không thấy đề này nữa.")) return;
    try {
        const updatedSettings = { 
            ...(exam.settings || {}), 
            isPublished: false 
        };
        const { error } = await supabaseClient.from('exams').update({ settings: updatedSettings }).eq('id', exam.id);
        if (error) throw error;
        exam.settings = updatedSettings;
        showNotify("Đã thu hồi về bản nháp!");
    } catch (error) {
        showNotify("Lỗi: " + error.message, "error");
    }
};
let realtimeChannel = null; // Dùng biến này để quản lý kênh duy nhất

const subscribeToExamChanges = async () => {
    // 1. Chỉ kết nối nếu chưa có kênh nào đang chạy và người dùng đã đăng nhập
    if (realtimeChannel || !currentUser.value) return;

    console.log("🚀 Đang khởi tạo hệ thống đồng bộ Realtime...");

    try {
        // 2. Tạo kênh mới trực tiếp lắng nghe bảng 'exams'
        realtimeChannel = supabaseClient
            .channel('exams-monitor-channel')
            .on(
                'postgres_changes',
                { 
                    event: '*', 
                    schema: 'public', 
                    table: 'exams' 
                },
                (payload) => {
                    console.log('📡 CSDL thay đổi:', payload);

                    if (payload.eventType === 'INSERT') {
                        // CHỐNG NHÂN ĐÔI: Kiểm tra xem đề này đã tồn tại trong mảng hiển thị chưa
                        const isExisted = exams.value.some(e => e.id === payload.new.id);
                        if (!isExisted) {
                            exams.value.push(payload.new);
                            showNotify(`✨ Đề mới từ GV ${payload.new.creator || 'Hệ thống'}: ${payload.new.title}`, "success");
                        }
                    } 
                    
                    else if (payload.eventType === 'UPDATE') {
                        const index = exams.value.findIndex(e => e.id === payload.new.id);
                        if (index !== -1) {
                            // Cập nhật lại dữ liệu mới nhất vào mảng
                            exams.value[index] = payload.new;
                            
                            // Xác định hành động để thông báo chuẩn ứng dụng
                            const isPub = payload.new.settings?.isPublished;
                            showNotify(`Đề "${payload.new.title}" ${isPub ? "đã GIAO 🚀" : "đã THU HỒI ↩️"}`, isPub ? "success" : "error");
                        }
                    } 
                    
                    else if (payload.eventType === 'DELETE') {
                        // Loại bỏ đề thi khỏi danh sách hiển thị
                        exams.value = exams.value.filter(e => e.id !== payload.old.id);
                        showNotify("Một đề thi vừa bị xóa khỏi hệ thống!", "error");
                    }
                }
            )
            .subscribe((status) => {
                console.log("📡 Trạng thái kết nối:", status);
                
                if (status === 'SUBSCRIBED') {
                    console.log("✅ Realtime đã kết nối và đang lắng nghe...");
                }
                
                if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
                    console.error("❌ Lỗi kết nối, đang giải phóng kênh để thử lại...");
                    realtimeChannel = null; // Reset để hàm có thể được gọi lại
                    // Thử kết nối lại sau 10 giây để tránh spam request
                    setTimeout(() => subscribeToExamChanges(), 10000);
                }
            });

    } catch (err) {
        realtimeChannel = null;
        console.error("Lỗi khởi tạo Realtime:", err.message);
    }
};
// --- KHAI BÁO STATE MỚI ---
const showInfoModal = ref(false); // Trạng thái hiện/ẩn modal nhập thông tin
const selectedExamForInfo = ref(null); // Lưu tạm đề thi trước khi nhấn xác nhận
const studentProfile = ref({
    fullName: '',
    className: '',
    school: 'THPT Yersin Đà Lạt' // Có thể để mặc định tên trường của mình
});

// --- FULL HÀM START EXAM (Mở Modal) ---
const startExam = (exam) => {
    // 1. Lưu đề thi lại để xử lý sau khi nhập thông tin
    selectedExamForInfo.value = exam;
    
    // 2. Mở modal yêu cầu nhập Họ tên, Lớp, Trường
    showInfoModal.value = true;
};

// --- HÀM XÁC NHẬN VÀ VÀO THI CHÍNH THỨC ---
const confirmStartExam = async () => {
    const exam = selectedExamForInfo.value;
    if (!exam) return;

    // 1. Kiểm tra tính hợp lệ của thông tin cá nhân
    if (!studentProfile.value.fullName.trim() || !studentProfile.value.className.trim()) {
        showNotify("Vui lòng điền đầy đủ Họ tên và Lớp để giáo viên chấm điểm!", "error");
        return;
    }

    // 2. Bảo mật: Kiểm tra mật khẩu đề thi (nếu có)
    if (exam.settings?.password) {
        const p = prompt("Vui lòng nhập mật khẩu phòng thi:");
        if (p !== exam.settings.password) {
            return showNotify("Mật khẩu không chính xác!", "error");
        }
    }

    // 3. Kích hoạt chế độ toàn màn hình
    enterFullScreen();

    // 4. Khởi tạo mảng câu trả lời
    let examCopy = JSON.parse(JSON.stringify(exam));
    studentAnswers.value = examCopy.questions.map(q => ({
        choice: q.type === 'tf' ? [null, null, null, null] : null,
        text: '',
        fileData: null
    }));

    // 5. Chuyển trạng thái sang Phòng thi
    currentExam.value = examCopy;
    timeLeft.value = examCopy.time * 60;
    cheatWarnings.value = 0;
    showInfoModal.value = false; // Đóng modal sau khi xong
    view.value = 'exam-room';

    // 6. Quản lý đồng hồ đếm ngược
    if (timerInterval.value) clearInterval(timerInterval.value);
    timerInterval.value = setInterval(() => {
        if (timeLeft.value > 0) timeLeft.value--;
        else submitExam(false);
    }, 1000);

    // 7. Gửi tín hiệu Realtime đầu tiên kèm thông tin cá nhân
    sendRealtimeUpdate('Vừa vào phòng thi');
};
// 1. Khai báo các ref mới
const showAddModal = ref(false);
const newUserData = ref({ name: '', password: '', role: 'teacher' });

// 2. Hàm mở modal
const openAddModal = () => { 
    newUserData.value = { name: '', password: '', role: 'teacher' }; 
    showAddModal.value = true; 
};

// 3. Hàm lưu người dùng (Đã sửa để lấy đúng role từ form)
const saveNewUser = async () => {
    if (!newUserData.value.name.trim() || !newUserData.value.password.trim()) {
        return showNotify("Nhập đầy đủ thông tin", "error");
    }
    
    const newUser = { 
        id: Date.now(), 
        name: newUserData.value.name,
        password: newUserData.value.password,
        role: newUserData.value.role // Lấy role từ form đã chọn
    };

    const { error } = await supabaseClient.from('users').insert([newUser]);
    if (!error) { 
        users.value.push(newUser); 
        showAddModal.value = false; 
        showNotify(`Đã tạo tài khoản ${newUser.role} thành công!`); 
    } else {
        showNotify("Lỗi: " + error.message, "error");
    }
};

return {
    showAddModal,
    newUserData,
    saveNewUser,
    showInfoModal,
    studentProfile,
    confirmStartExam,
    selectedExamForInfo,
    searchExam,
    filteredExams,
    searchMonitor,
    filteredExamsForMonitor,
    unpublishExam,
    quickPublish,
    visibleExamsForStudent, // Thêm dòng này nếu chưa có
    saveExamFast,           // Thêm dòng này
            // --- CÁC BIẾN & HÀM MỚI BỔ SUNG ---
            activeQuestionTab,
            filteredEditorQuestions,
            enterFullScreen,
            isFullscreen,

            // --- TRẠNG THÁI HỆ THỐNG & AUTH ---
            view, 
            currentUser, 
            authForm, 
            users, 
            exams, 
            newExam, 
            teacherTab, 
            notification, 
            searchUser,
            showNotify, 
            handleLogin, 
            handleRegister, 
            logout, 
            goHome, 
            switchView,

            // --- QUẢN LÝ NGƯỜI DÙNG (ADMIN) ---
            getRoleName, 
            getRoleBadgeClass, 
            deleteUser, 
            updateUserRole, 
            filteredUsers, 
            openEditModal, 
            saveUserEdit, 
            openAddModal, 

            // --- SOẠN THẢO ĐỀ THI (TEACHER) ---
            addQuestion, 
            removeQuestion, 
            saveExam, 
            openEditExam, 
            openCreateNewExam, 
            deleteExam, 
            viewResults, 
            showSettingsModal,
            aiPrompt, 
            isGenerating, 
            aiMatrix, 
            aiUploadedImage, 
            aiUploadedFileName,
            handleAiFileUpload, 
            handleGenerateAI, 
            exportToWord,

            // --- PHÒNG THI & LÀM BÀI (STUDENT) ---
            currentExam, 
            studentAnswers, 
            studentFile, 
            timeLeft, 
            formattedTime, 
            finalResult, 
            cheatWarnings, 
            startExam, 
            submitExam,
            joinCode, 
            joinExamByCode,
            handleFileUpload, 
            handlePerQuestionFileUpload,
            scrollToQuestion,

            // --- CHẤM ĐIỂM & GIÁM SÁT ---
            gradingModal, 
            currentGradingResult, 
            manualScore, 
            questionScores, 
            allResults, 
            filteredResults,
            openGradingModal, 
            saveManualGrade, 
            updateTotalScore, 
            backgroundAIGrading,
            isAIGradingSubmission,
            monitoringExamId, 
            isMonitoring, 
            activeStudents, 
            startMonitoring,
            sendRealtimeUpdate,

            // --- TRÌNH CHIẾU & TIỆN ÍCH ---
            currentSlide, 
            showSlideAnswer, 
            startPresentation, 
            nextSlide, 
            prevSlide, 
            exitPresentation,
            showQrModal, 
            currentQrCode, 
            currentQrExamTitle, 
            openQrModal
        };
    }
}).mount('#app');