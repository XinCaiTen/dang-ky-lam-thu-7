// ============================================
// SEND MAIL TO MANY PEOPLE FUNCTIONS
// ============================================

// Hàm lấy danh sách email từ nhân sự (Firestore)
window.getAllUserEmails = async function() {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const emails = [];
    usersSnapshot.forEach(doc => {
        const data = doc.data();
        if (data.email && typeof data.email === 'string' && data.email.includes('@')) {
            emails.push(data.email);
        }
    });
    return emails;
};

// Hàm gửi mail cho nhiều người
window.sendMailToMany = async function({ toList, subject, text }) {
    if (!Array.isArray(toList) || toList.length === 0) {
        alert('Danh sách email không hợp lệ!');
        return;
    }
    try {
        const response = await fetch('https://us-central1-diem-danh-thu-7.cloudfunctions.net/sendMailToMany', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ toList, subject, text })
        });
        const result = await response.json();
        if (result.success > 0) {
            alert(`Đã gửi thành công tới ${result.success} người!${result.fail > 0 ? '\nLỗi: ' + result.fail : ''}`);
        } else {
            alert('Không gửi được email nào!');
        }
    } catch (error) {
        alert('Lỗi gửi mail: ' + error.message);
    }
};

// Ví dụ: Gửi cho tất cả nhân sự có email
// window.sendMailToAllUsers = async function() {
//     const emails = await window.getAllUserEmails();
//     await window.sendMailToMany({
//         toList: emails,
//         subject: 'Thông báo từ hệ thống Đăng ký Thứ 7',
//         text: 'Đây là email gửi tự động từ hệ thống.'
//     });
// };
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getFirestore, collection, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, getDocs, query, where, orderBy, limit, addDoc, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';
import { firebaseConfig } from './firebase-config.js';
class PageLoader {
    constructor() {
        this.loader = document.getElementById('pageLoader');
        this.progressBar = document.getElementById('loaderProgressBar');
        this.subtext = document.getElementById('loaderSubtext');
        this.progress = 0;
        this.steps = [
            { progress: 20, text: 'Kết nối Firebase...' },
            { progress: 40, text: 'Xác thực người dùng...' },
            { progress: 60, text: 'Tải dữ liệu...' },
            { progress: 80, text: 'Khởi tạo giao diện...' },
            { progress: 100, text: 'Hoàn tất!' }
        ];
        this.currentStep = 0;
    }

    updateProgress(progress, text) {
        this.progress = progress;
        if (this.progressBar) {
            this.progressBar.style.width = progress + '%';
        }
        if (text && this.subtext) {
            this.subtext.textContent = text;
        }
    }

    nextStep() {
        if (this.currentStep < this.steps.length) {
            const step = this.steps[this.currentStep];
            this.updateProgress(step.progress, step.text);
            this.currentStep++;
        }
    }

    hide() {
        this.updateProgress(100, 'Hoàn tất!');
        setTimeout(() => {
            if (this.loader) {
                this.loader.classList.add('hidden');
                document.body.classList.remove('loading');
            }
            // Xóa loader khỏi DOM sau khi ẩn
            setTimeout(() => {
                if (this.loader && this.loader.parentNode) {
                    this.loader.parentNode.removeChild(this.loader);
                }
            }, 500);
        }, 300);
    }

    show() {
        if (this.loader) {
            this.loader.classList.remove('hidden');
            document.body.classList.add('loading');
        }
    }
}

const pageLoader = new PageLoader();

// Bắt đầu loading

window.addEventListener('DOMContentLoaded', () => {
    pageLoader.nextStep(); // Bước 1: Kết nối Firebase
});


// Initialize Firebase
const app = initializeApp(firebaseConfig);
pageLoader.nextStep(); // Bước 2: Xác thực

const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

// Global variables
let employeeData = [];
let filteredData = [];
let currentSaturday = getNextSaturday(new Date());
let unsubscribeUsers = null;
let unsubscribeAttendance = null;
let unsubscribeHistory = null;
let currentUser = null;
let previewData = [];

// ============================================
// PAGE LOADER MANAGER
// ============================================


// ============================================
// AUTHENTICATION FUNCTIONS
// ============================================

window.loginWithGoogle = async function() {
    try {
        const result = await signInWithPopup(auth, provider);
        currentUser = result.user;
    } catch (error) {
        console.error('Login error:', error);
        alert('Đăng nhập thất bại: ' + error.message);
    }
};

window.logout = async function() {
    try {
        // Xóa guest token nếu có
        localStorage.removeItem('guestName');
        localStorage.removeItem('guestToken');
        await signOut(auth);
        location.reload();
    } catch (error) {
        console.error('Logout error:', error);
    }
};

onAuthStateChanged(auth, (user) => {
    pageLoader.nextStep(); // Bước 3: Tải dữ liệu
    if (user) {
        currentUser = user;
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        document.getElementById('userInfo').style.display = 'flex';
        document.getElementById('userName').textContent = user.displayName;
        document.getElementById('userAvatar').src = user.photoURL;
        displayCurrentDate();
        loadData().then(() => {
            pageLoader.nextStep();
            loadRealtimeHistory();
            setTimeout(() => { pageLoader.hide(); }, 500);
        });
    } else {
        // Nếu có guestName và guestToken thì tự động đăng nhập guest
        const guestName = localStorage.getItem('guestName');
        const guestToken = localStorage.getItem('guestToken');
        if (guestName && guestToken) {
            document.getElementById('loginScreen').style.display = 'none';
            document.getElementById('mainApp').style.display = 'block';
            const userInfo = document.getElementById('userInfo');
            userInfo.style.display = 'flex';
            document.getElementById('userAvatar').src = '';
            document.getElementById('userName').textContent = guestName + ' (Khách)';
            displayCurrentDate();
            loadData();
            loadRealtimeHistory();
            document.body.classList.remove('loading');
            const pageLoaderEl = document.getElementById('pageLoader');
            if (pageLoaderEl) pageLoaderEl.classList.add('hidden');
        } else {
            document.getElementById('loginScreen').style.display = 'flex';
            document.getElementById('mainApp').style.display = 'none';
            pageLoader.nextStep();
            setTimeout(() => { pageLoader.hide(); }, 500);
        }
    }
});

window.loginAsGuest = function() {
    openGuestNameModal();
};

function openGuestNameModal() {
    document.getElementById('guestNameInput').value = '';
    document.getElementById('guestNameModal').style.display = 'block';
    setTimeout(() => {
        document.getElementById('guestNameInput').focus();
    }, 100);
}

window.closeGuestNameModal = function() {
    document.getElementById('guestNameModal').style.display = 'none';
}

window.submitGuestName = function() {
    const guestName = document.getElementById('guestNameInput').value.trim();
    if (!guestName) {
        alert('Vui lòng nhập tên!');
        document.getElementById('guestNameInput').focus();
        return;
    }
    // Lưu tên guest vào localStorage
    localStorage.setItem('guestName', guestName);
    // Tạo token giả cho guest (ví dụ: guest-<timestamp>-<random>)
    const guestToken = 'guest-' + Date.now() + '-' + Math.floor(Math.random()*1000000);
    localStorage.setItem('guestToken', guestToken);
    closeGuestNameModal();
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'block';
    // Hiển thị userInfo cho guest
    const userInfo = document.getElementById('userInfo');
    userInfo.style.display = 'flex';
    document.getElementById('userAvatar').src = '';
    document.getElementById('userName').textContent = guestName + ' (Khách)';
    // Bổ sung các hàm khởi tạo giao diện và dữ liệu cho khách
    displayCurrentDate();
    loadData();
    loadRealtimeHistory();
    // Ẩn loader nếu còn
    document.body.classList.remove('loading');
    const pageLoaderEl = document.getElementById('pageLoader');
    if (pageLoaderEl) pageLoaderEl.classList.add('hidden');
};

// Hỗ trợ submit bằng Enter trong modal
document.addEventListener('DOMContentLoaded', function() {
    const guestNameInput = document.getElementById('guestNameInput');
    if (guestNameInput) {
        guestNameInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                window.submitGuestName();
            }
        });
    }
});

// ============================================
// THEME FUNCTIONS
// ============================================

window.toggleTheme = function() {
    const html = document.documentElement;
    const currentTheme = html.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    html.setAttribute('data-theme', newTheme);
    
    const icon = document.getElementById('themeIcon');
    if (newTheme === 'dark') {
        icon.className = 'ri-sun-line';
    } else {
        icon.className = 'ri-moon-line';
    }
    localStorage.setItem('theme', newTheme);
};

// Initialize theme
const savedTheme = localStorage.getItem('theme') || 'light';
document.documentElement.setAttribute('data-theme', savedTheme);
const icon = document.getElementById('themeIcon');
if (savedTheme === 'dark') icon.className = 'ri-sun-line';
else icon.className = 'ri-moon-line';

// ============================================
// HISTORY TOGGLE FUNCTIONS
// ============================================

window.toggleHistory = function() {
    const rightPanel = document.querySelector('.right-panel');
    if (window.innerWidth <= 768) {
        rightPanel.classList.toggle('show-mobile');
    }
};

// ============================================
// DATE UTILITY FUNCTIONS
// ============================================

function getNextSaturday(date) {
    const result = new Date(date);
    const day = result.getDay();
    const diff = (6 - day + 7) % 7 || 7;
    result.setDate(result.getDate() + diff);
    result.setHours(0, 0, 0, 0);
    return result;
}

window.changeWeek = function(direction) {
    currentSaturday.setDate(currentSaturday.getDate() + (direction * 7));
    displayCurrentDate();
    loadData();
};

function displayCurrentDate() {
    const options = { weekday: 'long', year: 'numeric', month: 'numeric', day: 'numeric' };
    const dateStr = currentSaturday.toLocaleDateString('vi-VN', options);
    document.getElementById('currentDate').textContent = dateStr;
    
    const weekNum = getWeekNumber(currentSaturday);
    const year = currentSaturday.getFullYear();
    
    const dayOfWeek = currentSaturday.getDay();
    const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
    let badgeColor = '';
    
    if (dayOfWeek === 6) {
        badgeColor = 'var(--primary)';
    } else if (dayOfWeek === 0) {
        badgeColor = 'var(--danger)';
    } else {
        badgeColor = 'var(--warning)';
    }
    
    const badge = ` <span style="background: ${badgeColor}; color: white; padding: 2px 8px; border-radius: 4px; font-size: 11px; margin-left: 8px;">${dayNames[dayOfWeek]}</span>`;
    
    document.getElementById('weekInfo').innerHTML = `Tuần ${weekNum}, ${year}${badge}`;
}

function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function formatDateForAPI(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// ============================================
// HISTORY FUNCTIONS
// ============================================

async function logHistory(action, details) {
    try {
        let userInfo = {};
        if (currentUser && currentUser.uid) {
            userInfo = {
                uid: currentUser.uid,
                name: currentUser.displayName || '',
                email: currentUser.email || '',
                photo: currentUser.photoURL || '',
                isGuest: false
            };
        } else {
            userInfo = {
                uid: localStorage.getItem('guestToken') || 'guest',
                name: localStorage.getItem('guestName') || 'Khách',
                email: '',
                photo: '',
                isGuest: true
            };
        }
        await addDoc(collection(db, 'history'), {
            action: action,
            details: details,
            user: userInfo,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Log history error:', error);
    }
}

function loadRealtimeHistory() {
    if (unsubscribeHistory) unsubscribeHistory();

    const q = query(
        collection(db, 'history'),
        orderBy('timestamp', 'desc'),
        limit(1000)
    );

    unsubscribeHistory = onSnapshot(q, (snapshot) => {
        const historyBody = document.getElementById('historyBody');
        
        if (snapshot.empty) {
            historyBody.innerHTML = `
                <div class="empty-state" style="padding: 20px;">
                    <i class="ri-file-list-3-line" style="font-size: 32px;"></i>
                    <p style="font-size: 13px;">Chưa có hoạt động nào</p>
                </div>
            `;
            return;
        }

        historyBody.innerHTML = '';
        
        snapshot.forEach((doc) => {
            const data = doc.data();
            const item = document.createElement('div');
            item.className = 'history-item';

            const time = data.timestamp ? data.timestamp.toDate().toLocaleString('vi-VN', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit'
            }) : 'Vừa xong';

            let actionText = '';
            
            if (data.action === 'update_status') {
                const status = data.details.newValue ? 'Có' : 'Không';
                const typeText = data.details.type === 'work' ? 'Đi làm' : 'Ăn trưa';
                actionText = `Cập nhật <strong>${data.details.userName}</strong>: ${typeText} ➝ ${status}`;
            } else if (data.action === 'add_person') {
                actionText = `Đã thêm nhân sự: <strong>${data.details.userName}</strong>`;
            } else if (data.action === 'delete_person') {
                actionText = `Đã xóa nhân sự: <strong>${data.details.userName}</strong>`;
            } else if (data.action === 'export_excel') {
                actionText = `Xuất file Excel (${data.details.totalRecords} bản ghi)`;
            } else if (data.action === 'import_users') {
                actionText = `Import hàng loạt: <strong>${data.details.imported}</strong> người thành công${data.details.skipped > 0 ? `, bỏ qua ${data.details.skipped}` : ''}`;
            } else if (data.action === 'change_date') {
                const dateStr = new Date(data.details.date).toLocaleDateString('vi-VN', { 
                    day: '2-digit', 
                    month: '2-digit',
                    year: 'numeric'
                });
                actionText = `Chuyển sang ngày: <strong>${dateStr}</strong>`;
            }

            item.innerHTML = `
                <div class="history-time">${time}</div>
                <div class="history-action">${actionText}</div>
                <div class="history-user">
                    ${data.user.photo ? `<img src="${data.user.photo}" alt="">` : ''}
                    <span>${data.user.name}</span>
                </div>
            `;
            historyBody.appendChild(item);
        });
    });
}

// ============================================
// DATA LOADING FUNCTIONS
// ============================================

async function loadData() {
    return new Promise((resolve, reject) => {
        try {
            if (unsubscribeUsers) unsubscribeUsers();
            if (unsubscribeAttendance) unsubscribeAttendance();

            const dateStr = formatDateForAPI(currentSaturday);

            unsubscribeUsers = onSnapshot(collection(db, 'users'), async (snapshot) => {
                const users = [];
                snapshot.forEach((doc) => {
                    users.push({ id: doc.id, ...doc.data() });
                });

                users.sort((a, b) => (a.order || 0) - (b.order || 0));

                const attendanceDoc = await getDoc(doc(db, 'attendance', dateStr));
                const attendanceData = attendanceDoc.exists() ? attendanceDoc.data() : {};

                employeeData = users.map(user => ({
                    id: user.id,
                    name: user.name,
                    work: attendanceData[user.id]?.work || false,
                    lunch: attendanceData[user.id]?.lunch || false
                }));

                filteredData = [...employeeData];
                renderTable();

                document.getElementById('loadingIndicator').style.display = 'none';

                if (employeeData.length === 0) {
                    document.getElementById('emptyState').style.display = 'block';
                    document.getElementById('attendanceTable').style.display = 'none';
                    document.getElementById('summary').style.display = 'none';
                } else {
                    document.getElementById('emptyState').style.display = 'none';
                    document.getElementById('attendanceTable').style.display = 'table';
                    document.getElementById('summary').style.display = 'flex';
                }

                // Resolve promise sau lần load đầu tiên
                resolve();
            });

            unsubscribeAttendance = onSnapshot(doc(db, 'attendance', dateStr), (doc) => {
                if (doc.exists()) {
                    const attendanceData = doc.data();
                    employeeData.forEach(emp => {
                        if (attendanceData[emp.id]) {
                            emp.work = attendanceData[emp.id].work || false;
                            emp.lunch = attendanceData[emp.id].lunch || false;
                        }
                    });
                    filteredData = [...employeeData];
                    renderTable();
                }
            });

        } catch (error) {
            console.error('Load data error:', error);
            document.getElementById('loadingIndicator').style.display = 'none';
            reject(error);
        }
    });
}


// ============================================
// TABLE RENDERING FUNCTIONS
// ============================================

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = '';

    filteredData.forEach((employee, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td class="text-center">${index + 1}</td>
            <td>
                <div class="person-name">${employee.name}</div>
            </td>
            <td class="text-center">
                <input type="checkbox" 
                       id="work_${employee.id}" 
                       ${employee.work ? 'checked' : ''}
                       onchange="window.updateStatus('${employee.id}', 'work', this.checked)"
                       style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--primary);">
            </td>
            <td class="text-center">
                <input type="checkbox" 
                       id="lunch_${employee.id}" 
                       ${employee.lunch ? 'checked' : ''}
                       onchange="window.updateStatus('${employee.id}', 'lunch', this.checked)"
                       style="width: 20px; height: 20px; cursor: pointer; accent-color: var(--info);">
            </td>
            <td class="text-center">
                <button class="delete-btn" title="Xóa" onclick="window.deletePerson('${employee.id}', '${employee.name}')">
                    <i class="ri-delete-bin-line"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });

    updateSummary();
}

window.filterTable = function() {
    const searchText = document.getElementById('searchInput').value.toLowerCase();
    filteredData = employeeData.filter(emp =>
        emp.name.toLowerCase().includes(searchText)
    );
    renderTable();
};

function updateSummary() {
    const total = employeeData.length;
    const workCount = employeeData.filter(e => e.work).length;
    const lunchCount = employeeData.filter(e => e.lunch).length;

    document.getElementById('totalCount').textContent = total;
    document.getElementById('workCount').textContent = workCount;
    document.getElementById('lunchCount').textContent = lunchCount;
}


// Queue xử lý tuần tự các thao tác updateStatus
const updateQueue = [];
let isProcessingQueue = false;

window.updateStatus = function(userId, type, checked) {
    updateQueue.push({ userId, type, checked });
    processUpdateQueue();
};

async function processUpdateQueue() {
    if (isProcessingQueue || updateQueue.length === 0) return;
    isProcessingQueue = true;
    const { userId, type, checked } = updateQueue.shift();
    try {
        const dateStr = formatDateForAPI(currentSaturday);
        const attendanceRef = doc(db, 'attendance', dateStr);
        const attendanceDoc = await getDoc(attendanceRef);
        const currentData = attendanceDoc.exists() ? attendanceDoc.data() : {};
        currentData[userId] = currentData[userId] || {};
        const oldValue = currentData[userId][type];
        currentData[userId][type] = checked;
        await setDoc(attendanceRef, currentData);
        const userName = employeeData.find(e => e.id === userId)?.name;
        const typeText = type === 'work' ? 'Đi làm' : 'Ăn trưa';
        await logHistory('update_status', {
            userId: userId,
            userName: userName,
            date: dateStr,
            type: type,
            typeText: typeText,
            oldValue: oldValue,
            newValue: checked
        });
        showSaveIndicator();
    } catch (error) {
        console.error('Update error:', error);
        alert('Không thể lưu: ' + error.message);
        document.getElementById(`${type}_${userId}`).checked = !checked;
    } finally {
        isProcessingQueue = false;
        // Xử lý tiếp thao tác tiếp theo trong queue
        if (updateQueue.length > 0) {
            setTimeout(processUpdateQueue, 0);
        }
    }
}

// ============================================
// PERSON MANAGEMENT FUNCTIONS
// ============================================

window.openAddModal = function() {
    document.getElementById('addModal').style.display = 'block';
    document.getElementById('personName').focus();
};

window.closeAddModal = function() {
    document.getElementById('addModal').style.display = 'none';
    document.getElementById('addPersonForm').reset();
};

window.addPerson = async function() {
    const name = document.getElementById('personName').value.trim();

    if (!name) {
        alert('Vui lòng nhập họ và tên!');
        return;
    }

    const addBtn = document.getElementById('addPersonBtn');
    addBtn.disabled = true;
    addBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Đang thêm...';

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        const maxOrder = usersSnapshot.docs.reduce((max, doc) => {
            const order = doc.data().order || 0;
            return order > max ? order : max;
        }, 0);

        const newUserRef = doc(collection(db, 'users'));
        await setDoc(newUserRef, {
            name: name,
            order: maxOrder + 1,
            createdAt: new Date()
        });

        await logHistory('add_person', {
            userId: newUserRef.id,
            userName: name
        });

        showSaveIndicator();
        closeAddModal();
    } catch (error) {
        console.error('Add person error:', error);
        alert('Không thể thêm người: ' + error.message);
    }

    addBtn.disabled = false;
    addBtn.textContent = 'Thêm ngay';
};

// Custom delete confirmation modal logic
let pendingDeleteUserId = null;
let pendingDeleteUserName = null;

window.deletePerson = function(userId, userName) {
    pendingDeleteUserId = userId;
    pendingDeleteUserName = userName;
    document.getElementById('deleteConfirmText').textContent = `Bạn có chắc muốn xóa "${userName}" khỏi danh sách?`;
    document.getElementById('deleteConfirmModal').style.display = 'block';
    // Focus the Xóa button for accessibility
    setTimeout(() => {
        const btn = document.getElementById('deleteConfirmBtn');
        if (btn) btn.focus();
    }, 100);
};

window.closeDeleteConfirmModal = function() {
    document.getElementById('deleteConfirmModal').style.display = 'none';
    pendingDeleteUserId = null;
    pendingDeleteUserName = null;
};

document.getElementById('deleteConfirmBtn').onclick = async function() {
    if (!pendingDeleteUserId) return;
    const userId = pendingDeleteUserId;
    const userName = pendingDeleteUserName;
    window.closeDeleteConfirmModal();
    try {
        await deleteDoc(doc(db, 'users', userId));
        const attendanceSnapshot = await getDocs(collection(db, 'attendance'));
        const deletePromises = attendanceSnapshot.docs.map(async (attendanceDoc) => {
            const data = attendanceDoc.data();
            if (data[userId]) {
                delete data[userId];
                await setDoc(doc(db, 'attendance', attendanceDoc.id), data);
            }
        });
        await Promise.all(deletePromises);
        await logHistory('delete_person', {
            userId: userId,
            userName: userName
        });
        showSaveIndicator();
    } catch (error) {
        console.error('Delete error:', error);
        alert('Không thể xóa: ' + error.message);
    }
};

// ============================================
// EXPORT FUNCTIONS
// ============================================

window.exportToExcel = function() {
    const data = employeeData.map((emp, index) => ({
        'STT': index + 1,
        'Họ và tên': emp.name,
        'Đi làm': emp.work ? 'Có' : 'Không',
        'Ăn trưa': emp.lunch ? 'Có' : 'Không'
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách");

    const dateStr = formatDateForAPI(currentSaturday);
    XLSX.writeFile(wb, `Diem_danh_${dateStr}.xlsx`);

    logHistory('export_excel', {
        date: dateStr,
        totalRecords: data.length
    });
};

// ============================================
// STATISTICS FUNCTIONS
// ============================================

window.openStatsModal = function() {
    document.getElementById('statsModal').style.display = 'block';
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    document.getElementById('statsMonth').value = monthStr;
    loadMonthStats();
};

window.closeStatsModal = function() {
    document.getElementById('statsModal').style.display = 'none';
};

window.loadMonthStats = async function() {
    const monthStr = document.getElementById('statsMonth').value;
    if (!monthStr) return;

    const [year, month] = monthStr.split('-');
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const saturdays = [];
    for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        if (d.getDay() === 6) {
            saturdays.push(new Date(d));
        }
    }

    document.getElementById('totalSaturdays').textContent = saturdays.length;

    const userStats = {};
    let totalWork = 0;
    let totalLunch = 0;

    for (const saturday of saturdays) {
        const dateStr = formatDateForAPI(saturday);
        const attendanceDoc = await getDoc(doc(db, 'attendance', dateStr));
        
        if (attendanceDoc.exists()) {
            const data = attendanceDoc.data();
            Object.keys(data).forEach(userId => {
                if (!userStats[userId]) {
                    userStats[userId] = { work: 0, lunch: 0 };
                }
                if (data[userId].work) {
                    userStats[userId].work++;
                    totalWork++;
                }
                if (data[userId].lunch) {
                    userStats[userId].lunch++;
                    totalLunch++;
                }
            });
        }
    }

    const avgWork = saturdays.length > 0 ? (totalWork / saturdays.length).toFixed(1) : 0;
    const avgLunch = saturdays.length > 0 ? (totalLunch / saturdays.length).toFixed(1) : 0;

    document.getElementById('avgWork').textContent = avgWork;
    document.getElementById('avgLunch').textContent = avgLunch;

    const chartData = Object.keys(userStats).map(userId => {
        const user = employeeData.find(e => e.id === userId);
        return {
            name: user ? user.name : 'Unknown',
            count: userStats[userId].work
        };
    });

    chartData.sort((a, b) => b.count - a.count);
    const topUsers = chartData.slice(0, 10);

    const chartBars = document.getElementById('chartBars');
    chartBars.innerHTML = '';

    const maxCount = Math.max(...topUsers.map(u => u.count), 1);

    topUsers.forEach(user => {
        const height = (user.count / maxCount) * 100;
        
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; height: 100%;';
        
        const value = document.createElement('div');
        value.textContent = user.count;
        value.style.cssText = 'font-size: 11px; font-weight: bold; margin-bottom: 4px;';
        
        const bar = document.createElement('div');
        bar.style.cssText = `width: 100%; max-width: 30px; background: var(--primary); border-radius: 4px 4px 0 0; opacity: 0.8; height: ${height}%; transition: height 0.5s;`;
        
        const name = document.createElement('div');
        name.textContent = user.name.split(' ').pop();
        name.style.cssText = 'font-size: 10px; margin-top: 6px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%; text-align: center;';
        
        wrapper.appendChild(value);
        wrapper.appendChild(bar);
        wrapper.appendChild(name);
        
        chartBars.appendChild(wrapper);
    });
};

// ============================================
// IMPORT FUNCTIONS
// ============================================

window.openImportModal = function() {
    document.getElementById('importModal').style.display = 'block';
    document.getElementById('importFile').value = '';
    document.getElementById('previewSection').style.display = 'none';
    document.getElementById('importProgress').style.display = 'none';
    document.getElementById('importBtn').disabled = true;
    previewData = [];
};

window.closeImportModal = function() {
    document.getElementById('importModal').style.display = 'none';
};

window.downloadTemplate = function() {
    const templateData = [
        { 'Họ và tên': 'Nguyễn Văn A' },
        { 'Họ và tên': 'Trần Thị B' },
        { 'Họ và tên': 'Lê Văn C' }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Danh sách");
    ws['!cols'] = [{ wch: 30 }];

    XLSX.writeFile(wb, 'Mau_danh_sach_nhan_su.xlsx');
};

window.handleFileSelect = function(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);

            previewData = [];
            jsonData.forEach(row => {
                const name = row['Họ và tên'] || row['Tên'] || row['Name'] || 
                             row['Họ tên'] || row['Full Name'] || row['Fullname'];
                
                if (name && typeof name === 'string' && name.trim()) {
                    previewData.push(name.trim());
                }
            });

            previewData = [...new Set(previewData)];

            if (previewData.length === 0) {
                alert('Không tìm thấy dữ liệu hợp lệ trong file!\n\nVui lòng đảm bảo file có cột "Họ và tên"');
                return;
            }

            displayPreview();
            document.getElementById('importBtn').disabled = false;

        } catch (error) {
            console.error('Parse error:', error);
            alert('Lỗi đọc file: ' + error.message);
        }
    };

    reader.readAsArrayBuffer(file);
};

function displayPreview() {
    const previewSection = document.getElementById('previewSection');
    const previewList = document.getElementById('previewList');
    const previewCount = document.getElementById('previewCount');

    previewCount.textContent = previewData.length;
    previewList.innerHTML = '';

    previewData.forEach((name, index) => {
        const item = document.createElement('div');
        item.className = 'preview-item';
        item.innerHTML = `
            <i class="ri-user-line"></i>
            <span>${index + 1}. ${name}</span>
        `;
        previewList.appendChild(item);
    });

    previewSection.style.display = 'block';
}

window.importUsers = async function() {
    if (previewData.length === 0) {
        alert('Không có dữ liệu để import!');
        return;
    }

    const importBtn = document.getElementById('importBtn');
    importBtn.disabled = true;
    importBtn.innerHTML = '<i class="ri-loader-4-line ri-spin"></i> Đang import...';

    const progressSection = document.getElementById('importProgress');
    const progressBar = document.getElementById('progressBar');
    const progressText = document.getElementById('progressText');
    
    progressSection.style.display = 'block';

    try {
        const usersSnapshot = await getDocs(collection(db, 'users'));
        let maxOrder = usersSnapshot.docs.reduce((max, doc) => {
            const order = doc.data().order || 0;
            return order > max ? order : max;
        }, 0);

        const existingNames = new Set();
        usersSnapshot.docs.forEach(doc => {
            existingNames.add(doc.data().name.toLowerCase().trim());
        });

        let imported = 0;
        let skipped = 0;
        const total = previewData.length;

        for (let i = 0; i < previewData.length; i++) {
            const name = previewData[i];
            
            if (existingNames.has(name.toLowerCase().trim())) {
                skipped++;
                console.log(`Bỏ qua: ${name} (đã tồn tại)`);
            } else {
                const newUserRef = doc(collection(db, 'users'));
                await setDoc(newUserRef, {
                    name: name,
                    order: ++maxOrder,
                    createdAt: new Date()
                });
                imported++;
                existingNames.add(name.toLowerCase().trim());
            }

            const progress = Math.round(((i + 1) / total) * 100);
            progressBar.style.width = progress + '%';
            progressText.textContent = progress + '%';
        }

        await logHistory('import_users', {
            total: total,
            imported: imported,
            skipped: skipped
        });

        let message = `✅ Import thành công ${imported} người`;
        if (skipped > 0) {
            message += `\n⚠️ Bỏ qua ${skipped} người (đã tồn tại)`;
        }
        alert(message);

        closeImportModal();
        showSaveIndicator();

    } catch (error) {
        console.error('Import error:', error);
        alert('Lỗi import: ' + error.message);
    }

    importBtn.disabled = false;
    importBtn.innerHTML = '<i class="ri-upload-line"></i> Import ngay';
    progressSection.style.display = 'none';
};

// ============================================
// DATE PICKER FUNCTIONS
// ============================================

window.openDatePicker = function() {
    document.getElementById('datePickerModal').style.display = 'block';
    const dateStr = formatDateForAPI(currentSaturday);
    document.getElementById('customDate').value = dateStr;
    setTimeout(() => {
        document.getElementById('customDate').focus();
    }, 100);
};

window.closeDatePicker = function() {
    document.getElementById('datePickerModal').style.display = 'none';
};

window.selectQuickDate = function(type) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let selectedDate = new Date(today);

    switch(type) {
        case 'today':
            selectedDate = today;
            break;
        case 'tomorrow':
            selectedDate.setDate(today.getDate() + 1);
            break;
        case 'nextSaturday':
            const daysUntilSaturday = (6 - today.getDay() + 7) % 7 || 7;
            selectedDate.setDate(today.getDate() + daysUntilSaturday);
            break;
        case 'nextSunday':
            const daysUntilSunday = (7 - today.getDay()) % 7 || 7;
            selectedDate.setDate(today.getDate() + daysUntilSunday);
            break;
    }

    const dateStr = formatDateForAPI(selectedDate);
    document.getElementById('customDate').value = dateStr;
};

window.applyCustomDate = async function() {
    const dateInput = document.getElementById('customDate').value;
    
    if (!dateInput) {
        alert('Vui lòng chọn ngày!');
        return;
    }

    const selectedDate = new Date(dateInput + 'T00:00:00');
    
    if (isNaN(selectedDate.getTime())) {
        alert('Ngày không hợp lệ!');
        return;
    }

    currentSaturday = selectedDate;
    displayCurrentDate();
    loadData();
    
    await logHistory('change_date', {
        date: dateInput,
        dayOfWeek: selectedDate.getDay()
    });
    
    closeDatePicker();
    showSaveIndicator();
};

window.goToToday = function() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    currentSaturday = today;
    displayCurrentDate();
    loadData();
};

// ============================================
// UI HELPER FUNCTIONS
// ============================================

function showSaveIndicator() {
    const indicator = document.getElementById('saveIndicator');
    indicator.style.display = 'flex';
    setTimeout(() => {
        indicator.style.display = 'none';
    }, 2000);
}

// ============================================
// EVENT LISTENERS
// ============================================

// Keyboard shortcuts
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        openDatePicker();
    }
    
    if ((e.ctrlKey || e.metaKey) && e.key === 't') {
        e.preventDefault();
        goToToday();
    }
});

// Modal click handler
window.onclick = function(event) {
    const modals = ['addModal', 'statsModal', 'importModal', 'datePickerModal'];
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });
    
    // Close mobile history modal when clicking outside
    const rightPanel = document.querySelector('.right-panel');
    if (event.target == rightPanel && rightPanel.classList.contains('show-mobile')) {
        rightPanel.classList.remove('show-mobile');
    }
};

// Form submit handler
document.getElementById('addPersonForm').addEventListener('submit', function(e) {
    e.preventDefault();
    addPerson();
});

// onAuthStateChanged(auth, async (user) => {
//     // ...existing code...
//     if (user) {
//         currentUser = user;
//         // Lưu email vào Firestore nếu chưa có
//         const userRef = doc(db, 'users', user.uid);
//         const userSnap = await getDoc(userRef);
//         if (!userSnap.exists()) {
//             await setDoc(userRef, {
//                 name: user.displayName,
//                 email: user.email,
//                 createdAt: new Date()
//             });
//         }
//         // ...existing code...
//     }
//     // ...existing code...
// });
window.sendTestMail = async function() {
    const response = await fetch('https://us-central1-diem-danh-thu-7.cloudfunctions.net/sendTestMail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            to: 'ngocthien.vn2024@gmail.com',
            subject: 'Test gửi mail',
            text: 'Đây là email test gửi từ Firebase Functions!'
        })
    });
    const text = await response.text();
    alert(text);
};