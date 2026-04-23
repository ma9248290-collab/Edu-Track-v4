// ==========================================
// 1. قواعد البيانات المحلية (LocalStorage)
// ==========================================
let students = JSON.parse(localStorage.getItem("students")) || [];
let classSessions = JSON.parse(localStorage.getItem("classSessions")) || []; 
let exams = JSON.parse(localStorage.getItem("exams")) || []; 
let homeworks = JSON.parse(localStorage.getItem("homeworks")) || []; 
let financeRecords = JSON.parse(localStorage.getItem("financeRecords")) || {}; 
let expenses = JSON.parse(localStorage.getItem("expenses")) || []; 
let schedule = JSON.parse(localStorage.getItem("schedule")) || []; // <--- مصفوفة الجدول الأسبوعي
let isAssistantMode = localStorage.getItem("isAssistantMode") === "true";
let adminPin = localStorage.getItem("adminPin") || "1234";

// تحديث هيكل المجموعات: تحويل النصوص القديمة إلى Objects
let groups = JSON.parse(localStorage.getItem("groups")) || [];
if (groups.length > 0 && typeof groups[0] === 'string') {
    groups = groups.map(g => ({ name: g, level: 'الثالث الثانوي' }));
    localStorage.setItem("groups", JSON.stringify(groups));
}

let currentActiveSessionId = null;
let currentActiveExamId = null;
let currentActiveHwId = null;
let currentActiveGroup = null; 
let currentStudentProfileCode = null;

let attendanceChartInstance = null;
let groupsChartInstance = null;
let financeChartInstance = null;

let html5QrcodeScanner = null;
let currentScannerTarget = '';

if(isAssistantMode) enableAssistantMode();

// ==========================================
// 2. الذكاء الاصطناعي لفهم الأسماء (Fuzzy Search)
// ==========================================
function normalizeArabicName(text) {
    if (!text) return "";
    return text.replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/[يى]/g, 'ي').replace(/\s+/g, ' ').trim();
}
function findStudentByCodeOrName(input) {
    const val = input.trim();
    const normalizedInput = normalizeArabicName(val);
    return students.find(s => s.code === val || normalizeArabicName(s.name) === normalizedInput);
}

// ==========================================
// 3. الإشعارات والتأكيد 
// ==========================================
function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) { container = document.createElement('div'); container.id = 'toast-container'; document.body.appendChild(container); }
    const toast = document.createElement('div'); toast.className = `toast ${type}`;
    toast.innerHTML = `<span style="margin-left: 10px;">${type === 'success' ? '✅' : '❌'}</span> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'slideOut 0.3s ease-in forwards'; setTimeout(() => toast.remove(), 300); }, 3000);
}

let confirmCallback = null;
function customConfirm(message, callback) {
    document.getElementById('confirmMessage').innerText = message; confirmCallback = callback;
    document.getElementById('customConfirmModal').style.display = 'block';
}
document.getElementById('confirmYesBtn').addEventListener('click', function() {
    if(confirmCallback) confirmCallback(); closeModal('customConfirmModal');
});

// ==========================================
// 4. تسجيل الدخول (Login)
// ==========================================
const ADMIN_USER = "shefo"; 
const ADMIN_PASS = "12345"; 

if(sessionStorage.getItem("isLoggedIn") === "true") {
    document.getElementById("login-screen").style.display = "none";
    document.getElementById("main-app").style.display = "flex";
}
document.getElementById("loginForm").addEventListener("submit", function(e) {
    e.preventDefault();
    const user = document.getElementById("loginUsername").value.trim();
    const pass = document.getElementById("loginPassword").value.trim();
    if(user === ADMIN_USER && pass === ADMIN_PASS) {
        sessionStorage.setItem("isLoggedIn", "true");
        document.getElementById("login-screen").style.display = "none";
        document.getElementById("main-app").style.display = "flex";
        setTimeout(renderDashboardCharts, 100); 
    } else { document.getElementById("loginError").style.display = "block"; }
});
window.logout = function() { sessionStorage.removeItem("isLoggedIn"); location.reload(); };

// ==========================================
// 5. المساعد الآلي (EduBot AI)
// ==========================================
function toggleBotChat() { const w = document.getElementById("botChatWindow"); w.style.display = w.style.display === "flex" ? "none" : "flex"; }
function handleBotEnter(e) { if(e.key === "Enter") sendBotMessage(); }
function sendBotMessage() {
    const input = document.getElementById("botInput"); const text = input.value.trim(); if(!text) return;
    const body = document.getElementById("botBody"); body.innerHTML += `<div class="user-msg">${text}</div>`; input.value = ""; body.scrollTop = body.scrollHeight;
    setTimeout(() => { const response = generateBotResponse(text); body.innerHTML += `<div class="bot-msg">${response}</div>`; body.scrollTop = body.scrollHeight; }, 500); 
}
function generateBotResponse(text) {
    const q = normalizeArabicName(text);
    const rules = [
        { keys: ["طالب", "اضافه", "تسجيل"], ans: "عشان تسجل طالب، روح لـ <b>'إدارة الطلاب'</b> واضغط <b>'+ تسجيل طالب'</b>." },
        { keys: ["حضور", "غياب", "حصه", "احضر"], ans: "في <b>'سجل الحضور'</b>، اختار الحصة واعمل سكان بالباركود أو اكتب الاسم." },
        { keys: ["فلوس", "خزنه", "ماليات", "اشتراك"], ans: "<b>'الخزنة والماليات'</b> بتحسبلك الإيراد وتطرح منه نسبة السنتر وتطلعلك صافي الربح للحصة." },
        { keys: ["مساعد", "قفل", "حمايه"], ans: "قفل الصلاحيات الحساسة بـ <b>'🔒 قفل الإدارة'</b>. الباسوورد الافتراضي: 1234." },
        { keys: ["جدول", "مواعيد"], ans: "صفحة <b>'الجدول الأسبوعي'</b> بترتبلك حصصك طول الأسبوع عشان متنساش حاجة." }
    ];
    for(let rule of rules) { if(rule.keys.some(k => q.includes(k))) return rule.ans; }
    return "عذراً يا هندسة! اسألني عن: إضافة طالب، الحضور، الفلوس، الجدول، الواتساب.";
}

// ==========================================
// 6. التنقل و وضع المساعد
// ==========================================
function switchPage(pageId) {
    document.querySelectorAll(".view-section").forEach(el => el.style.display = "none");
    document.querySelectorAll(".nav-links li").forEach(el => el.classList.remove("active"));
    document.getElementById(pageId + "-view").style.display = "block";
    document.getElementById("nav-" + pageId).classList.add("active");

    const titles = {
        "dashboard": ["أهلاً بك يا شيفو 👋", "الرسوم البيانية ونظرة عامة"],
        "schedule": ["الجدول الأسبوعي 📅", "ترتيب مواعيد حصصك على مدار الأسبوع"],
        "groups": ["إدارة المجموعات 📚", "إضافة، تعديل، وإدارة المجموعات"],
        "students": ["إدارة الطلاب 🎓", "سجل الطلاب الشامل والملفات"],
        "attendance": ["سجل الحضور 📋", "تسجيل غياب الطلاب"],
        "exams": ["الامتحانات 📝", "رصد درجات الامتحانات"],
        "homework": ["الواجبات 📝", "تقييم الواجبات"],
        "finance": ["الماليات (حساب الحصة) 💰", "الإيرادات والمصروفات وصافي الربح لكل حصة"],
        "leaderboard": ["لوحة الشرف 🏆", "أفضل 5 طلاب في المجموعات"],
        "backup": ["النسخ الاحتياطي 🛡️", "حفظ واسترجاع بيانات النظام"],
        "atrisk": ["تحت الملاحظة 🚨", "الطلاب المعرضين للخطر (تأخر دراسي)"]
    };
    if(titles[pageId]) { document.getElementById("page-title").innerText = titles[pageId][0]; document.getElementById("page-desc").innerText = titles[pageId][1]; }

    if (pageId === "dashboard") { renderDashboardCharts(); }
    if (pageId === "schedule") { renderSchedule(); }
    if (pageId === "students") { document.getElementById("students-overview").style.display = "block"; document.getElementById("student-profile-view").style.display = "none"; renderTable(); }
    if (pageId === "groups") { document.getElementById("groups-overview").style.display = "block"; document.getElementById("group-details-view").style.display = "none"; renderGroupCards(); }
    if (pageId === "attendance") { document.getElementById("sessions-overview").style.display = "block"; document.getElementById("session-details-view").style.display = "none"; renderSessionCards(); populateDropdowns(); }
    if (pageId === "exams") { document.getElementById("exams-overview").style.display = "block"; document.getElementById("exam-details-view").style.display = "none"; renderExamCards(); populateDropdowns(); }
    if (pageId === "homework") { document.getElementById("hw-overview").style.display = "block"; document.getElementById("hw-details-view").style.display = "none"; renderHwCards(); populateDropdowns(); }
    if (pageId === "finance") { populateDropdowns(); renderFinanceTable(); }
    if (pageId === "leaderboard") { populateDropdowns(); }
    if (pageId === "atrisk") { renderAtRiskStudents(); }
}

const currentTheme = localStorage.getItem("theme") || "dark"; const themeBtn = document.getElementById("theme-btn");
if (currentTheme === "light") { document.documentElement.setAttribute("data-theme", "light"); themeBtn.innerText = "☀️ الوضع الفاتح"; }
function toggleTheme() {
    const root = document.documentElement;
    if (root.getAttribute("data-theme") === "light") { root.removeAttribute("data-theme"); localStorage.setItem("theme", "dark"); themeBtn.innerText = "☀️ الوضع الفاتح"; } 
    else { root.setAttribute("data-theme", "light"); localStorage.setItem("theme", "light"); themeBtn.innerText = "🌙 الوضع الداكن"; }
    renderDashboardCharts(); 
}

function toggleAssistantMode() {
    if(isAssistantMode) { openModal('pinModal'); } 
    else { enableAssistantMode(); showToast("تم تفعيل وضع المساعد وإغلاق الصلاحيات"); }
}
function enableAssistantMode() {
    isAssistantMode = true; localStorage.setItem("isAssistantMode", "true");
    document.body.classList.add('assistant-mode');
    document.getElementById('assistant-btn').innerText = "🔓 فتح الإدارة";
    document.getElementById('assistant-btn').style.borderColor = "var(--success-color)";
    document.getElementById('assistant-btn').style.color = "var(--success-color)";
    switchPage('dashboard');
}
function verifyPin() {
    const entered = document.getElementById('adminPinInput').value;
    if(entered === adminPin) {
        isAssistantMode = false; localStorage.setItem("isAssistantMode", "false");
        document.body.classList.remove('assistant-mode');
        document.getElementById('assistant-btn').innerText = "🔒 قفل الإدارة (للمساعد)";
        document.getElementById('assistant-btn').style.borderColor = "var(--danger-color)";
        document.getElementById('assistant-btn').style.color = "var(--danger-color)";
        closeModal('pinModal'); document.getElementById('adminPinInput').value = '';
        showToast("مرحباً بك يا شيفو! تم فتح الصلاحيات كاملة.");
        renderDashboardCharts();
    } else { showToast("الرقم السري خاطئ!", "error"); }
}

// الكاميرا
function startCameraScanner(targetInputId) { currentScannerTarget = targetInputId; document.getElementById('scannerModal').style.display = 'block'; html5QrcodeScanner = new Html5QrcodeScanner("reader", { fps: 10, qrbox: { width: 250, height: 250 } }, false); html5QrcodeScanner.render(onScanSuccess, onScanFailure); }
function stopCameraScanner() { if(html5QrcodeScanner) { html5QrcodeScanner.clear().then(() => { document.getElementById('scannerModal').style.display = 'none'; }).catch(e => { document.getElementById('scannerModal').style.display = 'none'; }); } else { document.getElementById('scannerModal').style.display = 'none'; } }
function onScanSuccess(decodedText) { stopCameraScanner(); const targetInput = document.getElementById(currentScannerTarget); if(targetInput) { targetInput.value = decodedText; const enterEvent = new KeyboardEvent('keypress', { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }); targetInput.dispatchEvent(enterEvent); } }
function onScanFailure() {}

// ==========================================
// 7. إعدادات الـ WhatsApp API و الإرسال في الخلفية
// ==========================================
document.getElementById('settingsForm')?.addEventListener('submit', function(e) {
    e.preventDefault();
    localStorage.setItem('waInstanceId', document.getElementById('waInstanceId').value.trim());
    localStorage.setItem('waToken', document.getElementById('waToken').value.trim());
    showToast('تم حفظ إعدادات السيرفر بنجاح');
    closeModal('settingsModal');
});


// ==========================================
// 8. الجدول الأسبوعي (ماتريكس)
// ==========================================
function renderSchedule() {
    const grid = document.getElementById("schedule-grid"); 
    if(!grid) return;
    grid.innerHTML = "";
    
    const days = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
    const hours = ["08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22"];

    let html = `<div class="schedule-table-container"><table class="timetable"><thead><tr><th>اليوم / الساعة</th>`;
    hours.forEach(h => {
        let hr = parseInt(h);
        let ampm = hr >= 12 ? 'م' : 'ص';
        let displayH = hr > 12 ? hr - 12 : hr;
        html += `<th>${displayH}:00 ${ampm}</th>`;
    });
    html += `</tr></thead><tbody>`;

    days.forEach(day => {
        html += `<tr><td class="day-head">${day}</td>`;
        hours.forEach(hour => {
            const items = schedule.filter(s => s.day === day && s.time.startsWith(hour));
            html += `<td>`;
            items.forEach(item => {
                html += `<div class="slot-card"><span class="del-btn admin-only" onclick="deleteScheduleItem(${item.id})">✖</span><div class="slot-time">${item.time}</div><div class="slot-group">${item.group}</div><div class="slot-subject">${item.subject}</div></div>`;
            });
            html += `</td>`;
        });
        html += `</tr>`;
    });
    html += `</tbody></table></div>`;
    grid.innerHTML = html;
}

// الكود المسئول عن حفظ الموعد الجديد
document.getElementById("addScheduleForm")?.addEventListener("submit", function(e) {
    e.preventDefault();
    schedule.push({
        id: Date.now(),
        day: document.getElementById("schedDay").value,
        time: document.getElementById("schedTime").value,
        group: document.getElementById("schedGroup").value,
        subject: document.getElementById("schedSubject").value
    });
    localStorage.setItem("schedule", JSON.stringify(schedule));
    closeModal('addScheduleModal'); 
    this.reset(); 
    renderSchedule(); 
    showToast("تم إضافة الموعد للجدول بنجاح");
});

function deleteScheduleItem(id) { 
    customConfirm("حذف هذا الموعد من الجدول؟", () => { 
        schedule = schedule.filter(s => s.id !== id); 
        localStorage.setItem("schedule", JSON.stringify(schedule)); 
        renderSchedule(); 
    }); 
}

// ==========================================
// 9. الفلترة الذكية للمجموعات
// ==========================================
function filterGroupsByLevel(levelSelectId, groupSelectId) {
    const level = document.getElementById(levelSelectId).value;
    const groupSelect = document.getElementById(groupSelectId);
    if(!groupSelect) return;
    groupSelect.innerHTML = "<option value=''>اختر المجموعة...</option>";
    if(level) { groups.filter(g => g.level === level).forEach(g => { groupSelect.innerHTML += `<option value="${g.name}">${g.name}</option>`; }); }
}
function filterSessionsForFinance() {
    const group = document.getElementById('financeGroupSelect').value; const finSelect = document.getElementById("financeSessionSelect");
    finSelect.innerHTML = "<option value=''>اختر الحصة...</option>";
    if(group) { [...classSessions].reverse().filter(s => s.group === group).forEach(s => { finSelect.innerHTML += `<option value="${s.id}">${s.date} - ${s.topic}</option>`; }); }
}

// ==========================================
// 10. إدارة الطلاب (منع التكرار الصارم)
// ==========================================
function generateStudentCode() { let maxId = 0; students.forEach(s => { let num = parseInt(s.code, 10); if (!isNaN(num) && num > maxId) maxId = num; }); return (maxId + 1).toString(); }
function openModal(modalId) { 
    document.getElementById(modalId).style.display = "block"; 
    if(modalId === 'addStudentModal') document.getElementById('studentCode').value = generateStudentCode(); 
    if(modalId === 'addSessionModal') { document.getElementById('sessionDate').valueAsDate = new Date(); toggleAutoInputs(); } 
    if(modalId === 'addExamModal') document.getElementById('examDate').valueAsDate = new Date(); 
    if(modalId === 'addHwModal') document.getElementById('hwDate').valueAsDate = new Date(); 
    if(modalId === 'settingsModal') {
        document.getElementById('waInstanceId').value = localStorage.getItem('waInstanceId') || '';
        document.getElementById('waToken').value = localStorage.getItem('waToken') || '';
    }
}
function closeModal(modalId) { document.getElementById(modalId).style.display = "none"; if(modalId === 'scannerModal') stopCameraScanner(); }

function populateDropdowns() {
    const selects = ["studentLevel", "editStudentLevel", "sessionLevelSelect", "examLevelSelect", "hwLevelSelect", "financeLevelSelect", "leaderboardLevel", "schedLevel"];
    selects.forEach(id => { const el = document.getElementById(id); if(el) el.value = ''; });
}

document.getElementById("addStudentForm")?.addEventListener("submit", function(e) { 
    e.preventDefault(); 
    const code = document.getElementById("studentCode").value.trim(); 
    const name = document.getElementById("studentName").value.trim(); 
    const level = document.getElementById("studentLevel").value; 
    const gender = document.getElementById("studentGender").value; 
    const phone = document.getElementById("studentPhone").value.trim(); 
    const parentPhone = document.getElementById("parentPhone").value.trim(); 
    const group = document.getElementById("studentGroup").value; 
    
    if(group === "") return showToast("يرجى اختيار مجموعة!", "error"); 
    
    // التحقق الصارم من التكرار
    const duplicate = students.find(s => 
        s.code === code || 
        s.phone === phone || 
        s.parentPhone === parentPhone || 
        normalizeArabicName(s.name) === normalizeArabicName(name)
    );
    if(duplicate) {
        return showToast(`تنبيه! هذه البيانات مسجلة مسبقاً للطالب: ${duplicate.name} (كود: ${duplicate.code}) في مجموعة ${duplicate.group}`, "error");
    }

    students.push({ code, name, level, gender, phone, parentPhone, group, behaviorPoints: 0 }); 
    localStorage.setItem("students", JSON.stringify(students)); 
    this.reset(); closeModal('addStudentModal'); renderTable(); showToast("تم تسجيل الطالب بنجاح"); 
});

function renderTable() { const tbody = document.getElementById("students-list"); tbody.innerHTML = ""; students.forEach((student) => { tbody.innerHTML += `<tr><td><strong style="color:var(--primary-color);">${student.code}</strong></td><td>${student.name}</td><td>${student.level}</td><td>${student.group}</td><td><button class="profile-btn" onclick="openStudentProfile('${student.code}')">👤 الملف</button></td></tr>`; }); document.getElementById("total-students").innerText = students.length; }
function searchStudent() { const filter = document.getElementById("searchInput").value.toLowerCase(); const rows = document.getElementById("students-list").getElementsByTagName("tr"); for (let i = 0; i < rows.length; i++) { const codeCol = rows[i].getElementsByTagName("td")[0]; const nameCol = rows[i].getElementsByTagName("td")[1]; if (codeCol && nameCol) { const txt = codeCol.innerText.toLowerCase() + " " + nameCol.innerText.toLowerCase(); rows[i].style.display = (txt.indexOf(filter) > -1) ? "" : "none"; } } }

function openStudentProfile(code) {
    const student = students.find(s => s.code === code); if(!student) return;
    currentStudentProfileCode = code;
    document.getElementById("students-overview").style.display = "none"; document.getElementById("student-profile-view").style.display = "block";
    document.getElementById("profile-name").innerText = student.name; document.getElementById("profile-code-group").innerText = `${student.code} | المجموعة: ${student.group}`;
    if(document.getElementById("profile-phone")) document.getElementById("profile-phone").innerText = student.phone;
    if(document.getElementById("profile-parent")) document.getElementById("profile-parent").innerText = student.parentPhone;
    if(document.getElementById("profile-level")) document.getElementById("profile-level").innerText = student.level;
    if(document.getElementById("profile-gender")) document.getElementById("profile-gender").innerText = student.gender;
    document.getElementById("profile-behavior-points").innerText = student.behaviorPoints || 0; 

    const waUrl = (phone) => `https://wa.me/20${phone.replace(/^0+/, '')}`; 
    if(document.getElementById("wa-student-btn")) document.getElementById("wa-student-btn").onclick = () => window.open(waUrl(student.phone), '_blank');
    if(document.getElementById("wa-parent-btn")) document.getElementById("wa-parent-btn").onclick = () => { const msg = encodeURIComponent(`أهلاً بحضرتك ولي أمر الطالب ${student.name}.. رسالة من إدارة الدرس: `); window.open(waUrl(student.parentPhone) + `?text=${msg}`, '_blank'); };

    const groupSessions = classSessions.filter(s => s.group === student.group).sort((a,b) => new Date(b.date) - new Date(a.date));
    let attended = 0; const attTbody = document.getElementById("profile-attendance-list"); if(attTbody) attTbody.innerHTML = "";
    groupSessions.forEach(s => { const st = s.attendance[student.phone]; if(st === 'present') attended++; const badge = st === 'present' ? `<span style="color:var(--success-color);">حاضر ✓</span>` : st === 'absent' ? `<span style="color:var(--danger-color);">غائب ✗</span>` : `-`; if(attTbody) attTbody.innerHTML += `<tr><td>${s.date}</td><td>${badge}</td></tr>`; });
    document.getElementById("profile-attendance").innerText = `${groupSessions.length > 0 ? Math.round((attended / groupSessions.length) * 100) : 0}%`;

    const groupExams = exams.filter(e => e.group === student.group).sort((a,b) => new Date(b.date) - new Date(a.date));
    let tExam = 0, sExam = 0; const exTbody = document.getElementById("profile-exams-list"); if(exTbody) exTbody.innerHTML = "";
    groupExams.forEach(e => { if(e.grades[student.phone]) { tExam += parseFloat(e.maxScore); sExam += parseFloat(e.grades[student.phone]); } if(exTbody) exTbody.innerHTML += `<tr><td>${e.name}</td><td>${e.date}</td><td><strong>${e.grades[student.phone] || '--'}</strong> / ${e.maxScore}</td></tr>`; });
    document.getElementById("profile-exams").innerText = `${tExam > 0 ? Math.round((sExam / tExam) * 100) : 0}%`;

    const groupHw = homeworks.filter(h => h.group === student.group).sort((a,b) => new Date(b.date) - new Date(a.date));
    let tHw = 0, sHw = 0; const hwTbody = document.getElementById("profile-hw-list"); if(hwTbody) hwTbody.innerHTML = "";
    groupHw.forEach(h => { if(h.grades[student.phone]) { tHw += parseFloat(h.maxScore); sHw += parseFloat(h.grades[student.phone]); } if(hwTbody) hwTbody.innerHTML += `<tr><td>${h.name}</td><td>${h.date}</td><td><strong>${h.grades[student.phone] || '--'}</strong> / ${h.maxScore}</td></tr>`; });
    document.getElementById("profile-hw").innerText = `${tHw > 0 ? Math.round((sHw / tHw) * 100) : 0}%`;
}
function backToStudents() { currentStudentProfileCode = null; document.getElementById("students-overview").style.display = "block"; document.getElementById("student-profile-view").style.display = "none"; }
function deleteStudentFromProfile() { customConfirm("حذف الطالب نهائياً؟", () => { students = students.filter(s => s.code !== currentStudentProfileCode); localStorage.setItem("students", JSON.stringify(students)); backToStudents(); renderTable(); showToast("تم الحذف"); }); }
function changeBehaviorPoints(points) { const student = students.find(s => s.code === currentStudentProfileCode); if(student) { student.behaviorPoints = (student.behaviorPoints || 0) + points; localStorage.setItem("students", JSON.stringify(students)); document.getElementById("profile-behavior-points").innerText = student.behaviorPoints; showToast(points > 0 ? "تم إضافة نقاط تميز 🌟" : "تم خصم نقاط 🤫"); } }

function openEditStudentModal() { 
    const student = students.find(s => s.code === currentStudentProfileCode); 
    if(student) { 
        document.getElementById('editStudentCodeOriginal').value = student.code;
        document.getElementById('editStudentCode').value = student.code; 
        document.getElementById('editStudentName').value = student.name; 
        document.getElementById('editStudentLevel').value = student.level; 
        filterGroupsByLevel('editStudentLevel', 'editStudentGroup');
        document.getElementById('editStudentGroup').value = student.group; 
        document.getElementById('editStudentGender').value = student.gender; 
        document.getElementById('editStudentPhone').value = student.phone; 
        document.getElementById('editParentPhone').value = student.parentPhone; 
        openModal('editStudentModal'); 
    } 
}

document.getElementById('editStudentForm')?.addEventListener('submit', function(e) { 
    e.preventDefault(); 
    const originalCode = document.getElementById('editStudentCodeOriginal').value;
    const newCode = document.getElementById('editStudentCode').value.trim();
    const name = document.getElementById('editStudentName').value.trim();
    const phone = document.getElementById('editStudentPhone').value.trim();
    const parentPhone = document.getElementById('editParentPhone').value.trim();

    const duplicate = students.find(s => s.code !== originalCode && (s.code === newCode || s.phone === phone || s.parentPhone === parentPhone || normalizeArabicName(s.name) === normalizeArabicName(name)));
    if(duplicate) return showToast(`تنبيه! هذه البيانات مشابهة للطالب: ${duplicate.name} (كود: ${duplicate.code})`, "error");

    const studentIndex = students.findIndex(s => s.code === originalCode); 
    if(studentIndex > -1) { 
        const oldPhone = students[studentIndex].phone; 
        students[studentIndex].code = newCode; students[studentIndex].name = name; students[studentIndex].level = document.getElementById('editStudentLevel').value; students[studentIndex].gender = document.getElementById('editStudentGender').value; students[studentIndex].phone = phone; students[studentIndex].parentPhone = parentPhone; students[studentIndex].group = document.getElementById('editStudentGroup').value; 
        
        if(oldPhone !== phone) { 
            classSessions.forEach(s => { if(s.attendance[oldPhone]) { s.attendance[phone] = s.attendance[oldPhone]; delete s.attendance[oldPhone]; }}); 
            exams.forEach(ex => { if(ex.grades[oldPhone]) { ex.grades[phone] = ex.grades[oldPhone]; delete ex.grades[oldPhone]; }}); 
            homeworks.forEach(hw => { if(hw.grades[oldPhone]) { hw.grades[phone] = hw.grades[oldPhone]; delete hw.grades[oldPhone]; }}); 
            localStorage.setItem("classSessions", JSON.stringify(classSessions)); localStorage.setItem("exams", JSON.stringify(exams)); localStorage.setItem("homeworks", JSON.stringify(homeworks)); 
        } 
        if(originalCode !== newCode) {
            Object.keys(financeRecords).forEach(key => { if(financeRecords[key][originalCode]) { financeRecords[key][newCode] = financeRecords[key][originalCode]; delete financeRecords[key][originalCode]; }});
            localStorage.setItem("financeRecords", JSON.stringify(financeRecords));
        }

        localStorage.setItem("students", JSON.stringify(students)); 
        closeModal('editStudentModal'); openStudentProfile(newCode); showToast("تم التحديث بنجاح"); 
    } 
});

// ==========================================
// إدارة المجموعات
// ==========================================
document.getElementById("addGroupFormModal")?.addEventListener("submit", function(e) { 
    e.preventDefault(); 
    const groupName = document.getElementById("newGroupName").value.trim(); 
    const groupLevel = document.getElementById("newGroupLevel").value; 
    if(groups.some(g => g.name === groupName)) { return showToast("هذه المجموعة موجودة بالفعل!", "error"); } 
    groups.push({ name: groupName, level: groupLevel }); 
    localStorage.setItem("groups", JSON.stringify(groups)); 
    showToast("تم الإضافة"); this.reset(); closeModal('addGroupModal'); renderGroupCards(); 
});

function renderGroupCards() { 
    const grid = document.getElementById("groups-list"); 
    if(!grid) return;
    grid.innerHTML = ""; 
    groups.forEach((group, index) => { 
        const studentsCount = students.filter(s => s.group === group.name).length; 
        grid.innerHTML += `<div class="session-card"><div class="session-header-card"><div><div class="session-group-name">📁 ${group.name}</div><div style="font-size: 12px; color: var(--primary-color);">${group.level}</div></div><span class="status-badge status-none">👥 ${studentsCount} طالب</span></div><div class="session-actions"><button class="enter-btn" onclick="openGroupDetails('${group.name}')">إدارة المجموعة</button><button class="icon-btn admin-only" onclick="openEditGroupModal('${group.name}')">✏️</button><button class="icon-btn danger admin-only" onclick="deleteGroup(${index})" title="حذف">🗑️</button></div></div>`; 
    }); 
    document.getElementById("total-groups").innerText = groups.length; 
}

function deleteGroup(index) { customConfirm("حذف هذه المجموعة نهائياً؟", () => { groups.splice(index, 1); localStorage.setItem("groups", JSON.stringify(groups)); renderGroupCards(); }); }

function openEditGroupModal(oldName) {
    const group = groups.find(g => g.name === oldName);
    if(group) {
        document.getElementById('editGroupOriginalName').value = group.name;
        document.getElementById('editGroupName').value = group.name;
        document.getElementById('editGroupLevel').value = group.level;
        openModal('editGroupModal');
    }
}

document.getElementById('editGroupFormModal')?.addEventListener('submit', function(e) {
    e.preventDefault();
    const oldName = document.getElementById('editGroupOriginalName').value;
    const newName = document.getElementById('editGroupName').value.trim();
    const newLevel = document.getElementById('editGroupLevel').value;

    const groupIndex = groups.findIndex(g => g.name === oldName);
    if(groupIndex > -1) {
        if(newName !== oldName && groups.some(g => g.name === newName)) return showToast("الاسم الجديد مستخدم بالفعل!", "error");
        
        groups[groupIndex].name = newName;
        groups[groupIndex].level = newLevel;
        localStorage.setItem("groups", JSON.stringify(groups));

        if(newName !== oldName) {
            students.forEach(s => { if(s.group === oldName) s.group = newName; });
            classSessions.forEach(s => { if(s.group === oldName) s.group = newName; });
            exams.forEach(e => { if(e.group === oldName) e.group = newName; });
            homeworks.forEach(h => { if(h.group === oldName) h.group = newName; });
            schedule.forEach(sc => { if(sc.group === oldName) sc.group = newName; });
            Object.keys(financeRecords).forEach(key => {
                if(key.includes(`_${oldName}`)) {
                    const newKey = key.replace(`_${oldName}`, `_${newName}`);
                    financeRecords[newKey] = financeRecords[key];
                    delete financeRecords[key];
                }
            });
            localStorage.setItem("students", JSON.stringify(students));
            localStorage.setItem("classSessions", JSON.stringify(classSessions));
            localStorage.setItem("exams", JSON.stringify(exams));
            localStorage.setItem("homeworks", JSON.stringify(homeworks));
            localStorage.setItem("schedule", JSON.stringify(schedule));
            localStorage.setItem("financeRecords", JSON.stringify(financeRecords));
        }
        closeModal('editGroupModal'); renderGroupCards(); showToast("تم تعديل المجموعة بنجاح");
    }
});

function openGroupDetails(groupName) { currentActiveGroup = groupName; document.getElementById("groups-overview").style.display = "none"; document.getElementById("group-details-view").style.display = "block"; document.getElementById("current-group-title").innerText = `مجموعة: ${groupName}`; renderGroupStudentsTable(); }
function backToGroups() { currentActiveGroup = null; document.getElementById("groups-overview").style.display = "block"; document.getElementById("group-details-view").style.display = "none"; renderGroupCards(); }
function renderGroupStudentsTable() { 
    const tbody = document.getElementById("group-students-list"); 
    tbody.innerHTML = ""; 
    const groupStudents = students.filter(s => s.group === currentActiveGroup); 
    if(groupStudents.length === 0) return tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">لا يوجد طلاب</td></tr>`; 
    
    groupStudents.forEach((student) => { 
        tbody.innerHTML += `<tr>
            <td><strong style="color:var(--primary-color);">${student.code}</strong></td>
            <td>${student.name}</td>
            <td>${student.parentPhone}</td>
            <td>
                <button class="profile-btn" onclick="openStudentProfile('${student.code}')">👤 الملف</button>
                <button class="icon-btn danger admin-only" style="margin-right: 5px;" onclick="removeStudentFromGroup('${student.code}')" title="إزالة من المجموعة">❌ إزالة</button>
            </td>
        </tr>`; 
    }); 
}

// دالة إزالة الطالب من المجموعة الحالية
function removeStudentFromGroup(code) {
    customConfirm("هل أنت متأكد من إزالة هذا الطالب من المجموعة؟ (لن يتم مسحه من النظام، فقط من المجموعة)", () => {
        const student = students.find(s => s.code === code);
        if(student) {
            student.group = ""; // إفراغ المجموعة
            localStorage.setItem("students", JSON.stringify(students));
            renderGroupStudentsTable(); // تحديث الجدول المفتوح
            renderGroupCards(); // تحديث العدد في الكروت بره
            showToast("تم إزالة الطالب من المجموعة بنجاح");
        }
    });
}

function quickExamForGroup() { if(!currentActiveGroup) return; const quickExam = { id: Date.now().toString(), group: currentActiveGroup, name: `امتحان مفاجئ - ${new Date().toLocaleDateString('ar-EG')}`, maxScore: "10", date: new Date().toISOString().split('T')[0], status: "open", grades: {} }; exams.push(quickExam); localStorage.setItem("exams", JSON.stringify(exams)); switchPage('exams'); openExamDetails(quickExam.id); }
function openAddStudentToGroupModal() { openModal('addStudentToGroupModal'); const select = document.getElementById('existingStudentSelect'); select.innerHTML = "<option value=''>اختر طالباً...</option>"; students.filter(s => s.group !== currentActiveGroup).forEach(s => { select.innerHTML += `<option value="${s.code}">${s.name} (${s.code})</option>`; }); }
function switchAddStudentTab(tab) { const f = document.getElementById('addExistingStudentForm'); const c = document.getElementById('newStudentTabContent'); const b = document.querySelectorAll('#addStudentToGroupModal .theme-btn'); if(tab === 'existing') { f.style.display = 'block'; c.style.display = 'none'; b[0].style.color = 'var(--primary-color)'; b[1].style.color = 'var(--text-main)'; } else { f.style.display = 'none'; c.style.display = 'block'; b[1].style.color = 'var(--primary-color)'; b[0].style.color = 'var(--text-main)'; } }
document.getElementById('addExistingStudentForm')?.addEventListener('submit', function(e) { e.preventDefault(); const code = document.getElementById('existingStudentSelect').value; const student = students.find(s => s.code === code); if(student) { student.group = currentActiveGroup; localStorage.setItem("students", JSON.stringify(students)); closeModal('addStudentToGroupModal'); renderGroupStudentsTable(); showToast("تم إضافة الطالب"); } });
window.goToNewStudentForm = function() { closeModal('addStudentToGroupModal'); openModal('addStudentModal'); setTimeout(() => { document.getElementById('studentLevel').value = groups.find(g=>g.name===currentActiveGroup)?.level || ''; filterGroupsByLevel('studentLevel', 'studentGroup'); document.getElementById('studentGroup').value = currentActiveGroup || ""; }, 50); };

// ==========================================
// إدارة الحصص وإرسال الواتساب بالخلفية
// ==========================================
function toggleAutoInputs() { const eCheck = document.getElementById("autoExamCheck").checked; const hCheck = document.getElementById("autoHwCheck").checked; document.getElementById("autoExamScore").style.display = eCheck ? "block" : "none"; document.getElementById("autoHwScore").style.display = hCheck ? "block" : "none"; }
document.getElementById("addSessionForm")?.addEventListener("submit", function(e) { e.preventDefault(); const group = document.getElementById("sessionGroupSelect").value; const date = document.getElementById("sessionDate").value; const topic = document.getElementById("sessionTopic").value || "حصة"; classSessions.push({ id: Date.now().toString(), group, date, topic, status: "open", attendance: {} }); localStorage.setItem("classSessions", JSON.stringify(classSessions)); if(document.getElementById("autoExamCheck").checked) { exams.push({ id: Date.now().toString()+"_e", group, name: `امتحان: ${topic}`, maxScore: document.getElementById("autoExamScore").value, date, status: "open", grades: {} }); localStorage.setItem("exams", JSON.stringify(exams)); } if(document.getElementById("autoHwCheck").checked) { homeworks.push({ id: Date.now().toString()+"_h", group, name: `واجب: ${topic}`, maxScore: document.getElementById("autoHwScore").value, date, status: "open", grades: {} }); localStorage.setItem("homeworks", JSON.stringify(homeworks)); } this.reset(); toggleAutoInputs(); closeModal('addSessionModal'); renderSessionCards(); populateDropdowns(); showToast("تم الإنشاء"); });

function renderSessionCards() { const grid = document.getElementById("sessions-grid"); if(!grid) return; grid.innerHTML = ""; [...classSessions].reverse().forEach(session => { const presentCount = Object.values(session.attendance).filter(v => v === 'present').length; const total = students.filter(s => s.group === session.group).length; const isClosed = session.status === 'closed'; grid.innerHTML += `<div class="session-card"><div class="session-header-card"><div><div class="session-group-name">${session.group}</div><div class="session-date">${session.date}</div></div><span class="status-badge ${isClosed ? 'status-closed' : 'status-open'}">${isClosed ? 'مغلقة' : 'مفتوحة'}</span></div><div class="session-topic">${session.topic}</div><div style="font-size: 14px; color: var(--text-muted);">الحضور: <strong>${presentCount} / ${total}</strong></div><div class="session-actions"><button class="enter-btn" onclick="openSessionDetails('${session.id}')" ${isClosed?'disabled':''}>تسجيل</button><button class="icon-btn admin-only" onclick="openEditSessionModal('${session.id}')">✏️</button><button class="icon-btn admin-only" onclick="toggleSessionStatus('${session.id}')">${isClosed?'🔓':'🔒 قفل وإرسال'}</button><button class="icon-btn danger admin-only" onclick="deleteSession('${session.id}')">🗑️</button></div></div>`; }); }

function openEditSessionModal(id) { const session = classSessions.find(s => s.id === id); if(session) { document.getElementById('editSessionId').value = id; document.getElementById('editSessionDate').value = session.date; document.getElementById('editSessionTopic').value = session.topic; openModal('editSessionModal'); } }
document.getElementById('editSessionForm')?.addEventListener('submit', function(e) { e.preventDefault(); const session = classSessions.find(s => s.id === document.getElementById('editSessionId').value); if(session) { session.date = document.getElementById('editSessionDate').value; session.topic = document.getElementById('editSessionTopic').value; localStorage.setItem("classSessions", JSON.stringify(classSessions)); closeModal('editSessionModal'); renderSessionCards(); showToast("تم التعديل"); } });

function toggleSessionStatus(id) { 
    const session = classSessions.find(s => s.id === id); 
    if(!session) return;
    
    if(session.status === 'open') { 
        // فتح النافذة الاحترافية الجديدة
        document.getElementById('closeSessionId').value = id;
        openModal('closeSessionModal');
    } else {
        session.status = 'open'; 
        localStorage.setItem("classSessions", JSON.stringify(classSessions)); 
        renderSessionCards(); 
        showToast("تم فتح الحصة");
    }
}




// ==========================================
// دوال الحماية من الحظر (Anti-Ban Helpers)
// ==========================================

// 1. دالة التأخير الزمني (Sleep)
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}






// ==========================================
// إغلاق الحصة وإرسال التقارير (عبر السيرفر المحلي)
// ==========================================
async function confirmCloseSession(sendMessages) {
    const id = document.getElementById('closeSessionId').value;
    const session = classSessions.find(s => s.id === id); 
    if(!session) return;

    // إغلاق الحصة
    session.status = 'closed'; 
    localStorage.setItem("classSessions", JSON.stringify(classSessions)); 
    renderSessionCards();
    closeModal('closeSessionModal');

    // لو اختار "قفل فقط بدون إرسال"
    if(!sendMessages) {
        return showToast("تم إغلاق الحصة بدون إرسال رسائل.");
    }

    const sendAtt = document.getElementById('sendAttCheck').checked;
    const sendExam = document.getElementById('sendExamCheck').checked;
    const sendHw = document.getElementById('sendHwCheck').checked;

    const groupStudents = students.filter(st => st.group === session.group);
    if(groupStudents.length === 0) return showToast("لا يوجد طلاب لإرسال التقارير.");

    // فحص الاتصال بالسيرفر المحلي (Node.js) قبل الإرسال
    try {
        await fetch('http://localhost:3000/messages');
    } catch(e) {
        return showToast("السيرفر المحلي مغلق! افتح شاشة Node.js أولاً", "error");
    }

    showToast("جاري إرسال التقارير عبر سيرفرك الخاص... برجاء عدم إغلاق الصفحة");
    let successCount = 0;
    
    const sessionExam = exams.find(e => e.group === session.group && e.date === session.date);
    const sessionHw = homeworks.find(h => h.group === session.group && h.date === session.date);

    // إعدادات الحماية (تم تسريعها لأن السيرفر المحلي يستحمل وسريع جداً)
    const BATCH_SIZE = 15;        
    const BATCH_DELAY = 6000;    
    const MIN_DELAY = 1500;       
    const MAX_DELAY = 3000;       

    for (let i = 0; i < groupStudents.length; i++) {
        let st = groupStudents[i];
        
        // جلب التحية من ملف البوت
        let greeting = typeof getRandomGreeting === 'function' ? getRandomGreeting() : "أهلاً بك";
        
        let msg = `📢 *تقرير حصة:* ${session.topic || session.date}\n${greeting} ولي أمر الطالب: *${st.name}*\n\n`;
        
        if(sendAtt) {
            const isPresent = session.attendance[st.phone] === 'present';
            msg += `📋 *الحضور:* ${isPresent ? 'حاضر ✅' : 'غائب ❌'}\n`;
        }
        if(sendExam) {
            let examText = 'لا يوجد';
            if(sessionExam) examText = sessionExam.grades[st.phone] ? `${sessionExam.grades[st.phone]} / ${sessionExam.maxScore} ⭐` : 'لم يمتحن ⚠️';
            msg += `📝 *الامتحان:* ${examText}\n`;
        }
        if(sendHw) {
            let hwText = 'لا يوجد';
            if(sessionHw) hwText = sessionHw.grades[st.phone] ? `${sessionHw.grades[st.phone]} / ${sessionHw.maxScore} 📚` : 'لم يسلم ⚠️';
            msg += `📚 *الواجب:* ${hwText}\n`;
        }

        msg += `\n💡 *إدارة الدرس تتمنى لكم التوفيق!*`; 
        
        // إرسال عبر دالة السيرفر المحلي اللي في ملف whatsapp-bot.js
        if(typeof sendAutoWhatsApp === 'function') {
            const sent = await sendAutoWhatsApp(st.parentPhone, msg);
            if(sent) successCount++;
        }

        // تطبيق التأخير للحماية
        if (i < groupStudents.length - 1) { 
            if ((i + 1) % BATCH_SIZE === 0) {
                console.log(`تم إرسال ${BATCH_SIZE} رسائل، جاري إراحة السيرفر...`);
                if(typeof sleep === 'function') await sleep(BATCH_DELAY); 
            } else {
                const randomDelay = Math.floor(Math.random() * (MAX_DELAY - MIN_DELAY + 1) + MIN_DELAY); 
                if(typeof sleep === 'function') await sleep(randomDelay);
            }
        }
    }
    showToast(`تم إرسال ${successCount} تقرير بنجاح عبر سيرفرك المحلي! ✅`);
}

function deleteSession(id) { customConfirm("حذف الحصة؟", () => { classSessions = classSessions.filter(s => s.id !== id); localStorage.setItem("classSessions", JSON.stringify(classSessions)); renderSessionCards(); }); }
function openSessionDetails(id) { currentActiveSessionId = id; const session = classSessions.find(s => s.id === id); document.getElementById("sessions-overview").style.display = "none"; document.getElementById("session-details-view").style.display = "block"; document.getElementById("current-session-title").innerText = session.group; renderAttendanceTable(session); }
function backToSessions() { document.getElementById("sessions-overview").style.display = "block"; document.getElementById("session-details-view").style.display = "none"; renderSessionCards(); }
function renderAttendanceTable(session) { const tbody = document.getElementById("attendance-list"); const gStudents = students.filter(s => s.group === session.group); if(gStudents.length===0) return tbody.innerHTML=`<tr><td colspan="6">لا يوجد طلاب</td></tr>`; tbody.innerHTML = ""; const groupS = classSessions.filter(s => s.group === session.group).sort((a,b)=>new Date(a.date)-new Date(b.date)); const prevSession = groupS[groupS.findIndex(s => s.id === session.id) - 1]; gStudents.forEach(st => { const stat = session.attendance[st.phone]; const statHtml = stat === 'present' ? '<span style="color:var(--success-color)">حاضر ✓</span>' : stat === 'absent' ? '<span style="color:var(--danger-color)">غائب ✗</span>' : 'لم يسجل'; let pHT = '--'; if(prevSession) { const p = prevSession.attendance[st.phone]; pHT = p==='present'?'حاضر':p==='absent'?'غائب':'--'; } tbody.innerHTML += `<tr><td><strong>${st.code}</strong></td><td>${st.name}</td><td>${st.phone}</td><td>${pHT}</td><td>${statHtml}</td><td><button class="btn-present" onclick="markAttendance('${st.phone}','present')">حاضر</button><button class="btn-absent" onclick="markAttendance('${st.phone}','absent')">غائب</button></td></tr>`; }); }
function markAttendance(phone, status) { const s = classSessions.find(s => s.id === currentActiveSessionId); if(s && s.status==='open') { s.attendance[phone] = status; localStorage.setItem("classSessions", JSON.stringify(classSessions)); renderAttendanceTable(s); } }

document.getElementById('attendanceBarcode')?.addEventListener('keypress', function(e) { 
    if(e.key === 'Enter') { 
        e.preventDefault(); 
        let val = this.value.trim(); 
        let student = findStudentByCodeOrName(val); 
        const session = classSessions.find(s => s.id === currentActiveSessionId); 
        if(!student) { showToast(`طالب غير موجود!`, 'error'); } else if(student.group !== session.group) { showToast(`الطالب ليس في هذه المجموعة!`, 'error'); } else if(session.status === 'closed') { showToast(`الحصة مغلقة!`, 'error'); } else { markAttendance(student.phone, 'present'); showToast(`تم حضور: ${student.name}`); }
        this.value = ''; 
    } 
});

// ==========================================
// الامتحانات والواجبات
// ==========================================
document.getElementById("addExamForm")?.addEventListener("submit", function(e) { e.preventDefault(); exams.push({ id: Date.now().toString(), group: document.getElementById("examGroupSelect").value, name: document.getElementById("examName").value, maxScore: document.getElementById("examMaxScore").value, date: document.getElementById("examDate").value, status: "open", grades: {} }); localStorage.setItem("exams", JSON.stringify(exams)); this.reset(); closeModal('addExamModal'); renderExamCards(); showToast("تم الإنشاء"); });
function renderExamCards() { const grid = document.getElementById("exams-grid"); if(!grid) return; grid.innerHTML = ""; [...exams].reverse().forEach(exam => { const isClosed = exam.status === 'closed'; grid.innerHTML += `<div class="session-card exam-card"><div class="session-header-card"><div><div class="exam-group-name">${exam.name}</div><div class="session-date">${exam.group}</div></div><span class="status-badge ${isClosed ? 'status-closed' : 'status-open'}">${isClosed?'مغلق':'مفتوح'}</span></div><div class="session-actions"><button class="enter-btn enter-exam-btn" onclick="openExamDetails('${exam.id}')" ${isClosed?'disabled':''}>رصد</button><button class="icon-btn admin-only" onclick="openEditExamModal('${exam.id}')">✏️</button><button class="icon-btn admin-only" onclick="toggleExamStatus('${exam.id}')">${isClosed?'🔓':'🔒'}</button><button class="icon-btn danger admin-only" onclick="deleteExam('${exam.id}')">🗑️</button></div></div>`; }); }
function openEditExamModal(id) { const e = exams.find(e => e.id === id); if(e) { document.getElementById('editExamId').value=id; document.getElementById('editExamName').value=e.name; document.getElementById('editExamMaxScore').value=e.maxScore; document.getElementById('editExamDate').value=e.date; openModal('editExamModal'); } }
document.getElementById('editExamForm')?.addEventListener('submit', function(e) { e.preventDefault(); const ex = exams.find(e => e.id === document.getElementById('editExamId').value); if(ex) { ex.name = document.getElementById('editExamName').value; ex.maxScore = document.getElementById('editExamMaxScore').value; ex.date = document.getElementById('editExamDate').value; localStorage.setItem("exams", JSON.stringify(exams)); closeModal('editExamModal'); renderExamCards(); } });
function toggleExamStatus(id) { const e = exams.find(e => e.id === id); if(e) { e.status = e.status === 'open' ? 'closed' : 'open'; localStorage.setItem("exams", JSON.stringify(exams)); renderExamCards(); } }
function deleteExam(id) { customConfirm("حذف الامتحان؟", () => { exams = exams.filter(e => e.id !== id); localStorage.setItem("exams", JSON.stringify(exams)); renderExamCards(); }); }
function openExamDetails(id) { currentActiveExamId = id; const e = exams.find(e => e.id === id); document.getElementById("exams-overview").style.display = "none"; document.getElementById("exam-details-view").style.display = "block"; document.getElementById("current-exam-title").innerText = e.name; document.getElementById('examBarcodeCode').value = ''; document.getElementById('examBarcodeGrade').value = ''; renderGradesTable(e, "grades-list", saveExamGrade, currentActiveExamId, 'exam'); }
function backToExams() { document.getElementById("exams-overview").style.display = "block"; document.getElementById("exam-details-view").style.display = "none"; renderExamCards(); }
function saveExamGrade(phone) { const e = exams.find(e => e.id === currentActiveExamId); const v = document.getElementById(`grade_${phone}`).value; if(v !== "") { e.grades[phone] = v; localStorage.setItem("exams", JSON.stringify(exams)); renderGradesTable(e, "grades-list", saveExamGrade, currentActiveExamId, 'exam'); } }

document.getElementById('examBarcodeCode')?.addEventListener('keypress', function(e) {
    if(e.key === 'Enter') {
        e.preventDefault(); let val = this.value.trim();
        if(val) {
            let student = findStudentByCodeOrName(val);
            const exam = exams.find(ex => ex.id === currentActiveExamId);
            if(exam.status === 'closed') { showToast(`الامتحان مغلق!`, 'error'); this.value = ''; } 
            else if(student && student.group === exam.group) { this.value = student.code; document.getElementById('examBarcodeGrade').focus(); showToast(`اكتب درجة: ${student.name}`); } 
            else { showToast(`طالب غير موجود أو ليس بالمجموعة!`, 'error'); this.value = ''; }
        }
    }
});
document.getElementById('examBarcodeGrade')?.addEventListener('keypress', function(e) { if(e.key === 'Enter') { e.preventDefault(); window.submitExamBarcodeGrade(); } });
window.submitExamBarcodeGrade = function() {
    let c = document.getElementById('examBarcodeCode').value.trim(); let g = document.getElementById('examBarcodeGrade').value.trim();
    const ex = exams.find(e => e.id === currentActiveExamId);
    if(c !== "" && g !== "") {
        let student = findStudentByCodeOrName(c);
        if(student && ex && ex.status === 'open') {
            if(parseFloat(g) > parseFloat(ex.maxScore) || parseFloat(g) < 0) { showToast(`الدرجة غير منطقية!`, 'error'); return; }
            ex.grades[student.phone] = g; localStorage.setItem("exams", JSON.stringify(exams)); renderGradesTable(ex, "grades-list", saveExamGrade, currentActiveExamId, 'exam'); showToast(`تم رصد ${g} للطالب ${student.name}`);
            document.getElementById('examBarcodeCode').value = ''; document.getElementById('examBarcodeGrade').value = ''; document.getElementById('examBarcodeCode').focus();
        }
    } else { showToast("يرجى إدخال الكود والدرجة!", "error"); }
};

document.getElementById("addHwForm")?.addEventListener("submit", function(e) { e.preventDefault(); homeworks.push({ id: Date.now().toString(), group: document.getElementById("hwGroupSelect").value, name: document.getElementById("hwName").value, maxScore: document.getElementById("hwMaxScore").value, date: document.getElementById("hwDate").value, status: "open", grades: {} }); localStorage.setItem("homeworks", JSON.stringify(homeworks)); this.reset(); closeModal('addHwModal'); renderHwCards(); });
function renderHwCards() { const grid = document.getElementById("hw-grid"); if(!grid) return; grid.innerHTML = ""; [...homeworks].reverse().forEach(hw => { const isClosed = hw.status === 'closed'; grid.innerHTML += `<div class="session-card hw-card"><div class="session-header-card"><div><div class="hw-group-name">${hw.name}</div><div class="session-date">${hw.group}</div></div><span class="status-badge ${isClosed ? 'status-closed' : 'status-open'}">${isClosed?'مغلق':'مفتوح'}</span></div><div class="session-actions"><button class="enter-btn enter-hw-btn" onclick="openHwDetails('${hw.id}')" ${isClosed?'disabled':''}>تقييم</button><button class="icon-btn admin-only" onclick="openEditHwModal('${hw.id}')">✏️</button><button class="icon-btn admin-only" onclick="toggleHwStatus('${hw.id}')">${isClosed?'🔓':'🔒'}</button><button class="icon-btn danger admin-only" onclick="deleteHw('${hw.id}')">🗑️</button></div></div>`; }); }
function openEditHwModal(id) { const h = homeworks.find(h => h.id === id); if(h) { document.getElementById('editHwId').value=id; document.getElementById('editHwName').value=h.name; document.getElementById('editHwMaxScore').value=h.maxScore; document.getElementById('editHwDate').value=h.date; openModal('editHwModal'); } }
document.getElementById('editHwForm')?.addEventListener('submit', function(e) { e.preventDefault(); const hw = homeworks.find(h => h.id === document.getElementById('editHwId').value); if(hw) { hw.name = document.getElementById('editHwName').value; hw.maxScore = document.getElementById('editHwMaxScore').value; hw.date = document.getElementById('editHwDate').value; localStorage.setItem("homeworks", JSON.stringify(homeworks)); closeModal('editHwModal'); renderHwCards(); } });
function toggleHwStatus(id) { const h = homeworks.find(h => h.id === id); if(h) { h.status = h.status === 'open' ? 'closed' : 'open'; localStorage.setItem("homeworks", JSON.stringify(homeworks)); renderHwCards(); } }
function deleteHw(id) { customConfirm("حذف هذا الواجب؟", () => { homeworks = homeworks.filter(h => h.id !== id); localStorage.setItem("homeworks", JSON.stringify(homeworks)); renderHwCards(); }); }
function openHwDetails(id) { currentActiveHwId = id; const hw = homeworks.find(h => h.id === id); document.getElementById("hw-overview").style.display = "none"; document.getElementById("hw-details-view").style.display = "block"; document.getElementById("current-hw-title").innerText = hw.name; document.getElementById('hwBarcodeCode').value = ''; document.getElementById('hwBarcodeGrade').value = ''; renderGradesTable(hw, "hw-grades-list", saveHwGrade, currentActiveHwId, 'hw'); }
function backToHw() { document.getElementById("hw-overview").style.display = "block"; document.getElementById("hw-details-view").style.display = "none"; renderHwCards(); }
function saveHwGrade(phone) { const hw = homeworks.find(h => h.id === currentActiveHwId); const v = document.getElementById(`grade_${phone}`).value; if(v !== "") { hw.grades[phone] = v; localStorage.setItem("homeworks", JSON.stringify(homeworks)); renderGradesTable(hw, "hw-grades-list", saveHwGrade, currentActiveHwId, 'hw'); } }

document.getElementById('hwBarcodeCode')?.addEventListener('keypress', function(e) {
    if(e.key === 'Enter') {
        e.preventDefault(); 
        let val = this.value.trim();
        if(val) {
            let student = findStudentByCodeOrName(val);
            const hw = homeworks.find(h => h.id === currentActiveHwId);
            if(hw.status === 'closed') { showToast(`الواجب مغلق!`, 'error'); this.value = ''; } 
            else if(student && student.group === hw.group) { this.value = student.code; document.getElementById('hwBarcodeGrade').focus(); showToast(`اكتب درجة: ${student.name}`); } 
            else { showToast(`طالب غير موجود أو ليس بالمجموعة!`, 'error'); this.value = ''; }
        }
    }
});
document.getElementById('hwBarcodeGrade')?.addEventListener('keypress', function(e) { if(e.key === 'Enter') { e.preventDefault(); window.submitHwBarcodeGrade(); } });
window.submitHwBarcodeGrade = function() {
    let c = document.getElementById('hwBarcodeCode').value.trim(); let g = document.getElementById('hwBarcodeGrade').value.trim();
    const hw = homeworks.find(h => h.id === currentActiveHwId);
    if(c !== "" && g !== "") {
        let student = findStudentByCodeOrName(c);
        if(student && hw && hw.status === 'open') {
            if(parseFloat(g) > parseFloat(hw.maxScore) || parseFloat(g) < 0) { showToast(`الدرجة غير منطقية!`, 'error'); return; }
            hw.grades[student.phone] = g; localStorage.setItem("homeworks", JSON.stringify(homeworks)); renderGradesTable(hw, "hw-grades-list", saveHwGrade, currentActiveHwId, 'hw'); showToast(`تم رصد ${g} للطالب ${student.name}`);
            document.getElementById('hwBarcodeCode').value = ''; document.getElementById('hwBarcodeGrade').value = ''; document.getElementById('hwBarcodeCode').focus();
        }
    } else { showToast("يرجى إدخال الكود والدرجة!", "error"); }
};

function renderGradesTable(itemDetails, tbodyId, saveFunction, itemId, itemType) {
    const tbody = document.getElementById(tbodyId); const gStudents = students.filter(s => s.group === itemDetails.group);
    if(gStudents.length === 0) return tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;">لا يوجد طلاب</td></tr>`; tbody.innerHTML = ""; 
    let prevItem = null;
    if(itemType === 'exam') { const grpItems = exams.filter(e => e.group === itemDetails.group).sort((a,b)=>new Date(a.date)-new Date(b.date)); prevItem = grpItems[grpItems.findIndex(e=>e.id===itemDetails.id)-1]; }
    if(itemType === 'hw') { const grpItems = homeworks.filter(h => h.group === itemDetails.group).sort((a,b)=>new Date(a.date)-new Date(b.date)); prevItem = grpItems[grpItems.findIndex(h=>h.id===itemDetails.id)-1]; }

    gStudents.forEach(st => {
        const grade = itemDetails.grades[st.phone] !== undefined ? itemDetails.grades[st.phone] : '';
        const isHw = tbodyId === 'hw-grades-list'; const btnColor = isHw ? 'var(--hw-color)' : 'var(--exam-color)';
        let pHT = `<span style="color:var(--text-muted)">--</span>`;
        if(prevItem && prevItem.grades[st.phone] !== undefined) pHT = `<strong style="color:${btnColor}">${prevItem.grades[st.phone]} / ${prevItem.maxScore}</strong>`;

        tbody.innerHTML += `<tr><td><strong>${st.code}</strong></td><td>${st.name}</td><td>${st.phone}</td><td style="direction:ltr;">${pHT}</td><td style="direction: ltr;"><span style="color:var(--text-muted);">/ ${itemDetails.maxScore}</span><input type="number" id="grade_${st.phone}" class="custom-input" style="width:70px; padding:5px; text-align:center;" value="${grade}" max="${itemDetails.maxScore}"></td><td><button class="btn-present" onclick="${saveFunction.name}('${st.phone}')" style="background-color: ${btnColor}; color: #fff;">حفظ</button></td></tr>`;
    });
}
// ==========================================
// لوحة القيادة التفاعلية (الرئيسية)
// ==========================================
function renderDashboardCharts() {
    if(sessionStorage.getItem("isLoggedIn") !== "true") return;
    document.getElementById("total-students").innerText = students.length;
    document.getElementById("total-groups").innerText = groups.length;
    
    const textColor = getComputedStyle(document.documentElement).getPropertyValue('--text-main').trim() || '#fff';
    const primaryColor = getComputedStyle(document.documentElement).getPropertyValue('--primary-color').trim() || '#3b82f6';
    
    const ctxAtt = document.getElementById('attendanceChart').getContext('2d');
    if(attendanceChartInstance) attendanceChartInstance.destroy();
    const sessionsByDate = {};
    classSessions.forEach(s => {
        if(!sessionsByDate[s.date]) { sessionsByDate[s.date] = { expected: 0, attended: 0 }; }
        const groupStudentsCount = students.filter(st => st.group === s.group).length;
        const presentCount = Object.values(s.attendance).filter(v => v === 'present').length;
        sessionsByDate[s.date].expected += groupStudentsCount;
        sessionsByDate[s.date].attended += presentCount;
    });
    const sortedDates = Object.keys(sessionsByDate).sort((a,b) => new Date(a) - new Date(b)).slice(-7);
    const sessionLabels = sortedDates.map(d => d.substring(5)); 
    const sessionData = sortedDates.map(d => { const exp = sessionsByDate[d].expected; return exp > 0 ? Math.round((sessionsByDate[d].attended / exp) * 100) : 0; });
    attendanceChartInstance = new Chart(ctxAtt, { type: 'line', data: { labels: sessionLabels, datasets: [{ label: 'متوسط الحضور اليومي (%)', data: sessionData, borderColor: primaryColor, backgroundColor: 'rgba(59, 130, 246, 0.2)', borderWidth: 3, fill: true, tension: 0.3 }] }, options: { plugins: { legend: { labels: { color: textColor } } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor }, min: 0, max: 100 } } } });

    const ctxGrp = document.getElementById('groupsChart').getContext('2d');
    if(groupsChartInstance) groupsChartInstance.destroy();
    // التعديل السليم عشان المجموعات تقرأ صح
    const groupLabels = groups.map(g => g.name); 
    const groupData = groups.map(g => students.filter(s => s.group === g.name).length); 
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
    groupsChartInstance = new Chart(ctxGrp, { type: 'doughnut', data: { labels: groupLabels, datasets: [{ data: groupData, backgroundColor: colors, borderWidth: 0 }] }, options: { plugins: { legend: { position: 'bottom', labels: { color: textColor } } } } });

    if(isAssistantMode) return; 

    const ctxFin = document.getElementById('financeChart').getContext('2d');
    if(financeChartInstance) financeChartInstance.destroy();
    const monthlyData = {}; const defaultStudentFee = 50; const defaultCenterFee = 10;
    classSessions.forEach(s => { const month = s.date.substring(0, 7); if(!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0, net: 0 }; });
    Object.keys(financeRecords).forEach(key => {
        if(key.startsWith('fin_session_')) {
            const sessionId = key.replace('fin_session_', ''); const session = classSessions.find(s => s.id === sessionId);
            if(session) {
                const month = session.date.substring(0, 7); if(!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0, net: 0 };
                let paidCount = 0; Object.values(financeRecords[key]).forEach(status => { if(status === 'paid') paidCount++; });
                const income = paidCount * defaultStudentFee; const centerCut = paidCount * defaultCenterFee;
                monthlyData[month].income += income; monthlyData[month].expenses += centerCut;
            }
        }
    });
    expenses.forEach(ex => {
        const session = classSessions.find(s => s.id === ex.sessionId);
        if(session) { const month = session.date.substring(0, 7); if(!monthlyData[month]) monthlyData[month] = { income: 0, expenses: 0, net: 0 }; monthlyData[month].expenses += parseFloat(ex.amount); }
    });
    Object.keys(monthlyData).forEach(m => { monthlyData[m].net = monthlyData[m].income - monthlyData[m].expenses; });
    const sortedMonths = Object.keys(monthlyData).sort();
    financeChartInstance = new Chart(ctxFin, { type: 'bar', data: { labels: sortedMonths, datasets: [ { label: 'الإيرادات', data: sortedMonths.map(m => monthlyData[m].income), backgroundColor: '#10b981' }, { label: 'المصروفات', data: sortedMonths.map(m => monthlyData[m].expenses), backgroundColor: '#ef4444' }, { label: 'صافي الربح', data: sortedMonths.map(m => monthlyData[m].net), backgroundColor: '#3b82f6' } ] }, options: { plugins: { legend: { labels: { color: textColor } } }, scales: { x: { ticks: { color: textColor } }, y: { ticks: { color: textColor } } } } });
}

// ==========================================
// تحت الملاحظة (الإنذار)
// ==========================================
function renderAtRiskStudents() {
    const tbody = document.getElementById("atrisk-list"); tbody.innerHTML = "";
    if(students.length === 0) return tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">لا يوجد طلاب</td></tr>`;
    let atRiskCount = 0;
    students.forEach(student => {
        let reasons = [];
        const gSessions = classSessions.filter(s => s.group === student.group).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0, 2);
        if(gSessions.length === 2 && gSessions[0].attendance[student.phone] === 'absent' && gSessions[1].attendance[student.phone] === 'absent') { reasons.push("غياب آخر حصتين"); }
        const gExams = exams.filter(e => e.group === student.group).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0, 2);
        let failCount = 0; gExams.forEach(ex => { const grade = ex.grades[student.phone]; if(grade !== undefined && parseFloat(grade) < (parseFloat(ex.maxScore) / 2)) failCount++; });
        if(failCount === 2) reasons.push("رسوب في آخر امتحانين");
        if(reasons.length > 0) {
            atRiskCount++; const msg = encodeURIComponent(`تحذير من إدارة الدرس: الطالب ${student.name} مستواه متراجع. السبب: ${reasons.join(" و ")}.`); const waUrl = `https://wa.me/20${student.parentPhone.replace(/^0+/, '')}?text=${msg}`;
            tbody.innerHTML += `<tr><td><strong>${student.code}</strong></td><td>${student.name}</td><td>${student.group}</td><td style="color:var(--danger-color); font-weight:bold;">${reasons.join("<br>")}</td><td><button class="icon-btn" style="background-color:#128C7E; color:white; border:none;" onclick="window.open('${waUrl}','_blank')">إنذار 💬</button></td></tr>`;
        }
    });
    if(atRiskCount === 0) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color:var(--success-color); font-weight:bold;">الطلاب كلهم في مستوى أمان!</td></tr>`;
}

// ==========================================
// الخزنة والماليات
// ==========================================
function renderFinanceTable() {
    const sessionId = document.getElementById("financeSessionSelect").value; const studentFee = parseFloat(document.getElementById("financeStudentFee").value) || 0; const centerFee = parseFloat(document.getElementById("financeCenterFee").value) || 0; const tbody = document.getElementById("finance-list");
    if(!sessionId) return tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">اختر الحصة لعرض حساباتها</td></tr>`;
    const session = classSessions.find(s => s.id === sessionId); if(!session) return;
    const groupStudents = students.filter(s => s.group === session.group); if(groupStudents.length === 0) return tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;">لا يوجد طلاب</td></tr>`;
    const recordKey = `fin_session_${sessionId}`; if(!financeRecords[recordKey]) financeRecords[recordKey] = {};
    tbody.innerHTML = ""; let totalPaidCount = 0;
    groupStudents.forEach(student => {
        const isPaid = financeRecords[recordKey][student.code] === 'paid'; if(isPaid) totalPaidCount++;
        const attendanceStatus = session.attendance[student.phone] || 'none'; let attBadge = `<span style="color:var(--text-muted)">لم يسجل</span>`; if(attendanceStatus === 'present') attBadge = `<span style="color:var(--success-color); font-weight:bold;">حاضر</span>`; if(attendanceStatus === 'absent') attBadge = `<span style="color:var(--danger-color); font-weight:bold;">غائب</span>`;
        const badge = isPaid ? `<span class="status-badge status-present">تم الدفع ✅</span>` : `<span class="status-badge status-absent">لم يدفع ❌</span>`; const btn = isPaid ? `<button class="icon-btn danger" onclick="togglePayment('${recordKey}', '${student.code}', 'unpaid')">إلغاء الدفع</button>` : `<button class="enter-btn" onclick="togglePayment('${recordKey}', '${student.code}', 'paid')">تأكيد الدفع</button>`;
        tbody.innerHTML += `<tr><td><strong>${student.code}</strong></td><td>${student.name}</td><td>${attBadge}</td><td>${badge}</td><td>${btn}</td></tr>`;
    });
    const totalIncome = totalPaidCount * studentFee; const totalCenterCut = totalPaidCount * centerFee;
    document.getElementById("total-income").innerText = `${totalIncome} ج.م`; document.getElementById("total-income").dataset.income = totalIncome; document.getElementById("total-income").dataset.centerCut = totalCenterCut; renderExpensesList();
}
function togglePayment(recordKey, studentCode, status) { financeRecords[recordKey][studentCode] = status; localStorage.setItem("financeRecords", JSON.stringify(financeRecords)); renderFinanceTable(); }
document.getElementById("addExpenseForm")?.addEventListener("submit", function(e) { e.preventDefault(); const desc = document.getElementById("expDesc").value; const amount = parseFloat(document.getElementById("expAmount").value); const sessionId = document.getElementById("financeSessionSelect").value; if(!sessionId) return showToast("اختر الحصة أولاً!", "error"); expenses.push({ id: Date.now(), sessionId, desc, amount }); localStorage.setItem("expenses", JSON.stringify(expenses)); this.reset(); renderExpensesList(); showToast("تم الإضافة"); });
function renderExpensesList() {
    const sessionId = document.getElementById("financeSessionSelect").value; const tbody = document.getElementById("expenses-list"); tbody.innerHTML = "";
    let totalAdditionalExp = 0; expenses.filter(ex => ex.sessionId === sessionId).forEach((ex) => { totalAdditionalExp += ex.amount; tbody.innerHTML += `<tr><td>${ex.desc}</td><td>${ex.amount} ج</td><td><button class="icon-btn danger" onclick="deleteExpense('${ex.id}')">🗑️</button></td></tr>`; });
    const incomeEl = document.getElementById("total-income"); const totalIncome = parseFloat(incomeEl.dataset.income) || 0; const centerCut = parseFloat(incomeEl.dataset.centerCut) || 0;
    const totalExpensesWithCenter = centerCut + totalAdditionalExp; document.getElementById("total-expenses").innerText = `${totalExpensesWithCenter} ج.م`;
    const netProfit = totalIncome - totalExpensesWithCenter; const netEl = document.getElementById("net-profit"); netEl.innerText = `${netProfit} ج.م`; netEl.style.color = netProfit < 0 ? "var(--danger-color)" : "var(--primary-color)";
}
function deleteExpense(id) { expenses = expenses.filter(ex => ex.id.toString() !== id.toString()); localStorage.setItem("expenses", JSON.stringify(expenses)); renderExpensesList(); }

// ==========================================
// لوحة الشرف
// ==========================================
function generateLeaderboard() {
    const group = document.getElementById("leaderboardGroup").value; const container = document.getElementById("leaderboard-results");
    if(!group) return container.innerHTML = `<p style="text-align: center; color: var(--text-muted);">اختر المجموعة لعرض أوائل الطلبة</p>`;
    const groupStudents = students.filter(s => s.group === group); if(groupStudents.length === 0) return container.innerHTML = `<p style="text-align: center;">لا يوجد طلاب في هذه المجموعة</p>`;
    let leaderboard = groupStudents.map(student => {
        let score = 0; classSessions.filter(s => s.group === group).forEach(session => { if(session.attendance[student.phone] === 'present') score += 10; }); exams.filter(e => e.group === group).forEach(exam => { if(exam.grades[student.phone]) { score += (parseFloat(exam.grades[student.phone]) / parseFloat(exam.maxScore)) * 50; } }); homeworks.filter(h => h.group === group).forEach(hw => { if(hw.grades[student.phone]) { score += (parseFloat(hw.grades[student.phone]) / parseFloat(hw.maxScore)) * 20; } }); score += (student.behaviorPoints || 0); return { name: student.name, code: student.code, score: Math.round(score) };
    });
    leaderboard.sort((a, b) => b.score - a.score); const top5 = leaderboard.slice(0, 5); container.innerHTML = ""; const medals = ["🥇", "🥈", "🥉", "🏅", "🏅"];
    top5.forEach((st, index) => { container.innerHTML += `<div class="stat-card" style="display:flex; justify-content:space-between; align-items:center; border-left: 5px solid var(--exam-color);"><div style="display:flex; gap:15px; align-items:center;"><span style="font-size:30px;">${medals[index]}</span><div><h3 style="margin-bottom:5px; color:var(--text-main); font-size:18px;">${st.name}</h3><p style="color:var(--primary-color); font-weight:bold;">الكود: ${st.code}</p></div></div><div style="text-align:center;"><p style="color:var(--text-muted); font-size:12px;">مجموع النقاط</p><p style="font-size:24px; font-weight:bold; color:var(--exam-color);">${st.score}</p></div></div>`; });
}

function exportData() { const data = { students, groups, classSessions, exams, homeworks, financeRecords, expenses, schedule }; const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `EduTrack_Backup_${new Date().toISOString().split('T')[0]}.json`; a.click(); URL.revokeObjectURL(url); showToast("تم تحميل النسخة الاحتياطية بنجاح"); }
function importData(event) { const file = event.target.files[0]; if(!file) return; const reader = new FileReader(); reader.onload = function(e) { try { const imp = JSON.parse(e.target.result); if(imp.students && imp.groups) { localStorage.setItem("students", JSON.stringify(imp.students)); localStorage.setItem("groups", JSON.stringify(imp.groups)); localStorage.setItem("classSessions", JSON.stringify(imp.classSessions || [])); localStorage.setItem("exams", JSON.stringify(imp.exams || [])); localStorage.setItem("homeworks", JSON.stringify(imp.homeworks || [])); localStorage.setItem("financeRecords", JSON.stringify(imp.financeRecords || {})); localStorage.setItem("expenses", JSON.stringify(imp.expenses || [])); localStorage.setItem("schedule", JSON.stringify(imp.schedule || [])); alert("تم استرجاع البيانات بنجاح! سيتم إعادة تحميل الصفحة."); location.reload(); } else { showToast("ملف غير صالح!", "error"); } } catch(err) { showToast("خطأ أثناء قراءة الملف!", "error"); } }; reader.readAsText(file); }


// ==========================================
// استيراد الطلاب من ملف إكسيل
// ==========================================
function importStudentsFromExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const excelData = XLSX.utils.sheet_to_json(worksheet);

            let addedCount = 0;
            let errorCount = 0;

            excelData.forEach(row => {
                // قراءة العواميد من الإكسيل (لازم العواميد في الإكسيل تكون متسمية كده بالظبط)
                const name = row['الاسم'];
                const level = row['الصف'];
                const group = row['المجموعة'];
                const phone = row['هاتف الطالب'] || '';
                const parentPhone = row['هاتف ولي الأمر'] || '';
                const gender = row['الجنس'] || 'ذكر';

                if(name && level && group) {
                    // فحص التكرار قبل الإضافة
                    const duplicate = students.find(s => 
                        (phone && s.phone === phone.toString()) || 
                        (parentPhone && s.parentPhone === parentPhone.toString()) || 
                        normalizeArabicName(s.name) === normalizeArabicName(name.toString())
                    );
                    
                    if(!duplicate) {
                        students.push({
                            code: generateStudentCode(), // توليد كود تلقائي
                            name: name.toString().trim(),
                            level: level.toString().trim(),
                            group: group.toString().trim(),
                            phone: phone.toString().trim(),
                            parentPhone: parentPhone.toString().trim(),
                            gender: gender.toString().trim(),
                            behaviorPoints: 0
                        });
                        addedCount++;
                    } else {
                        errorCount++;
                    }
                }
            });

            localStorage.setItem("students", JSON.stringify(students));
            renderTable();
            document.getElementById("total-students").innerText = students.length;
            if (typeof renderDashboardCharts === "function") renderDashboardCharts();
            
            showToast(`تم استيراد ${addedCount} طالب بنجاح! ${errorCount > 0 ? `(تم تجاهل ${errorCount} متكررين)` : ''}`);
        } catch(err) {
            showToast("حدث خطأ أثناء قراءة الملف. تأكد من صيغة الإكسيل!", "error");
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = ""; // تصفير الـ Input عشان تقدر ترفع نفس الملف تاني لو حبيت
}

// ==========================================
// تحميل نموذج إكسيل فارغ لتسجيل الطلاب
// ==========================================
function downloadExcelTemplate() {
    // أسماء العواميد المطلوبة بالظبط
    const headers = [["الاسم", "الصف", "المجموعة", "هاتف الطالب", "هاتف ولي الأمر", "الجنس"]];
    
    // إنشاء شيت إكسيل جديد
    const worksheet = XLSX.utils.aoa_to_sheet(headers);
    
    // تظليل عرض العواميد عشان يكون شكلها حلو
    worksheet['!cols'] = [{wch: 25}, {wch: 15}, {wch: 20}, {wch: 15}, {wch: 15}, {wch: 10}];
    
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "الطلاب");
    
    // تحميل الملف للجهاز
    XLSX.writeFile(workbook, "نموذج_إضافة_الطلاب.xlsx");
    
    showToast("تم تحميل النموذج بنجاح! املاه وارفعه تاني.");
}

// ==========================================
// 🎙️ الرصد الصوتي بالذكاء الاصطناعي (EduVoice)
// ==========================================
let isListening = false;
let speechRecog = null;

function toggleVoiceRecognition(mode, inputId) {

    // التحقق من متصفح Brave ومنعه برسالة واضحة
    if (navigator.brave && navigator.brave.isBrave) {
        showToast("متصفح Brave يمنع الرصد الصوتي. يرجى استخدام متصفح Google Chrome ⚠️", "error");
        return;
    }

    const btn = document.getElementById(`voiceBtn_${mode}`);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        return showToast("متصفحك لا يدعم الرصد الصوتي. استخدم Google Chrome", "error");
    }

    if (isListening) {
        isListening = false;
        if(speechRecog) speechRecog.stop();
        btn.classList.remove('pulse-mic');
        btn.innerText = "🎙️ رصد بالصوت";
        showToast("تم إيقاف المايك 🛑");
        return;
    }

    speechRecog = new SpeechRecognition();
    speechRecog.lang = 'ar-EG'; // اللغة العربية
    speechRecog.continuous = true;
    speechRecog.interimResults = false;

    speechRecog.onstart = function() {
        isListening = true;
        btn.classList.add('pulse-mic');
        btn.innerText = "يستمع الآن...";
        showToast("المايك يعمل 🎙️.. تحدث الآن (مثال: أحمد رأفت تسعة)");
    };

    speechRecog.onresult = function(event) {
        const lastIndex = event.results.length - 1;
        const transcript = event.results[lastIndex][0].transcript.trim();
        console.log("🗣️ سمعت: ", transcript);
        processVoiceCommand(transcript, mode, inputId);
    };

   // إظهار سبب الخطأ بالتحديد عشان نعرف المشكلة فين
    speechRecog.onerror = function(event) {
        console.error("Speech Error:", event.error);
        if (event.error === 'not-allowed') {
            showToast("تم رفض صلاحية المايك! تأكد من السماح للمتصفح.", "error");
            isListening = false;
        } else if (event.error === 'network') {
            // هنا المتصفح بيقفل المايك لو اللينك C:/ 
            showToast("المايك لا يعمل على الملفات المحلية. يرجى تشغيل (Live Server)!", "error");
            isListening = false; // بنوقف اللوب هنا
        } else if (event.error === 'no-speech') {
            // تجاهل خطأ عدم الكلام، المايك هيعمل ريستارت لوحده
        } else {
            showToast("حدث خطأ في المايك: " + event.error, "error");
            isListening = false;
        }
        
        if(!isListening) {
            btn.classList.remove('pulse-mic');
            btn.innerText = "🎙️ رصد بالصوت";
        }
    };

    // جعل المايك يشتغل باستمرار حتى لو المدرس سكت ثواني
    speechRecog.onend = function() {
        if (isListening) {
            try { speechRecog.start(); } catch(e) {} // إعادة التشغيل التلقائي
        } else {
            btn.classList.remove('pulse-mic');
            btn.innerText = "🎙️ رصد بالصوت";
        }
    };

    try {
        speechRecog.start();
    } catch(e) {
        console.error(e);
    }
}

function processVoiceCommand(text, mode, inputId) {
    let activeGroupId = null;
    if(mode === 'attendance') activeGroupId = classSessions.find(s => s.id === currentActiveSessionId)?.group;
    if(mode === 'exam') activeGroupId = exams.find(e => e.id === currentActiveExamId)?.group;
    if(mode === 'hw') activeGroupId = homeworks.find(h => h.id === currentActiveHwId)?.group;

    if(!activeGroupId) return showToast("يجب فتح حصة أو امتحان أولاً!", "error");

    const groupStudents = students.filter(s => s.group === activeGroupId);
    let matchedStudent = null;

    // 1. البحث عن اسم الطالب في النص المسموع
    for(let st of groupStudents) {
        const nameParts = normalizeArabicName(st.name).split(' ');
        // لو النص المسموع بيحتوي على الاسم الأول والأخير للطالب
        if(nameParts.length >= 2) {
            if(normalizeArabicName(text).includes(nameParts[0]) && normalizeArabicName(text).includes(nameParts[nameParts.length-1])) {
                matchedStudent = st;
                break;
            }
        } else {
            if(normalizeArabicName(text).includes(nameParts[0])) { matchedStudent = st; break; }
        }
    }

    if(!matchedStudent) {
        return showToast(`لم أتعرف على الطالب في: "${text}"`, "error");
    }

    // 2. تنفيذ الأوامر بناءً على الشاشة المفتوحة
    if(mode === 'attendance') {
        if(text.includes('حاضر') || text.includes('موجود') || text.includes('جه')) {
            markAttendance(matchedStudent.phone, 'present');
            showToast(`🎙️ تم حضور: ${matchedStudent.name}`);
        } else if(text.includes('غايب') || text.includes('مجاش')) {
            markAttendance(matchedStudent.phone, 'absent');
            showToast(`🎙️ تم تغييب: ${matchedStudent.name}`);
        } else {
            // الافتراضي لو قال الاسم بس يعمل حاضر
            markAttendance(matchedStudent.phone, 'present');
            showToast(`🎙️ تم حضور: ${matchedStudent.name}`);
        }
    }

    if(mode === 'exam' || mode === 'hw') {
        // استخراج الأرقام من النص المسموع (مثلاً لو قال: جاب 10)
        let gradeMatch = text.match(/\d+/);
        
        // قاموس بسيط لو المتصفح كتب الرقم بالحروف
        const numberWords = {"صفر":0, "واحد":1, "اتنين":2, "اثنين":2, "تلاته":3, "ثلاثة":3, "اربعه":4, "أربعة":4, "خمسه":5, "خمسة":5, "سته":6, "ستة":6, "سبعه":7, "سبعة":7, "تمانيه":8, "ثمانية":8, "تسعه":9, "تسعة":9, "عشره":10, "عشرة":10};
        
        let finalGrade = null;
        if(gradeMatch) {
            finalGrade = gradeMatch[0];
        } else {
            // تدوير في الكلمات
            for (let word in numberWords) {
                if (text.includes(word)) { finalGrade = numberWords[word]; break; }
            }
        }

        if(finalGrade !== null) {
            document.getElementById(inputId).value = matchedStudent.code;
            if(mode === 'exam') {
                document.getElementById('examBarcodeGrade').value = finalGrade;
                submitExamBarcodeGrade();
            } else {
                document.getElementById('hwBarcodeGrade').value = finalGrade;
                submitHwBarcodeGrade();
            }
        } else {
            showToast(`تعرفت على ${matchedStudent.name}، لكن لم أسمع الدرجة!`, "error");
        }
    }
}


// ==========================================
// 🚀 دوال إرسال الواتساب والتقارير (بدون بوت)
// ==========================================
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function getRandomGreeting() {
    const greetings = ["أهلاً بحضرتك", "مرحباً بك", "تحياتي", "السلام عليكم", "أهلاً وسهلاً"];
    return greetings[Math.floor(Math.random() * greetings.length)];
}
function generateRandomHash() { return Math.floor(1000 + Math.random() * 9000); }

// دالة الإرسال للسيرفر
async function sendAutoWhatsApp(phone, message) {
    let formattedPhone = String(phone).trim();
    if (formattedPhone.startsWith("0") && formattedPhone.length === 11) {
        formattedPhone = "20" + formattedPhone.substring(1);
    }
    try {
        let response = await fetch('http://localhost:3000/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: formattedPhone, message: message })
        });
        return response.ok;
    } catch(e) { return false; }
}

// تعديل دالة إغلاق الحصة لتعمل مع السيرفر المحلي
async function confirmCloseSession(sendMessages) {
    const id = document.getElementById('closeSessionId').value;
    const session = classSessions.find(s => s.id === id); 
    if(!session) return;

    session.status = 'closed'; 
    localStorage.setItem("classSessions", JSON.stringify(classSessions)); 
    renderSessionCards();
    closeModal('closeSessionModal');

    if(!sendMessages) {
        return showToast("تم إغلاق الحصة بدون إرسال رسائل.");
    }

    const sendAtt = document.getElementById('sendAttCheck').checked;
    const sendExam = document.getElementById('sendExamCheck').checked;
    const sendHw = document.getElementById('sendHwCheck').checked;

    const groupStudents = students.filter(st => st.group === session.group);
    if(groupStudents.length === 0) return showToast("لا يوجد طلاب لإرسال التقارير.");

    try {
        await fetch('http://localhost:3000/status');
    } catch(e) {
        return showToast("السيرفر مغلق! برجاء تشغيل شاشة Node.js أولاً", "error");
    }

    showToast("جاري إرسال التقارير... برجاء عدم إغلاق الصفحة");
    let successCount = 0;
    
    const sessionExam = exams.find(e => e.group === session.group && e.date === session.date);
    const sessionHw = homeworks.find(h => h.group === session.group && h.date === session.date);

    for (let i = 0; i < groupStudents.length; i++) {
        let st = groupStudents[i];
        let msg = `📢 *تقرير حصة:* ${session.topic || session.date}\n${getRandomGreeting()} ولي أمر الطالب: *${st.name}*\n\n`;
        
        if(sendAtt) {
            const isPresent = session.attendance[st.phone] === 'present';
            msg += `📋 *الحضور:* ${isPresent ? 'حاضر ✅' : 'غائب ❌'}\n`;
        }
        if(sendExam) {
            let examText = 'لا يوجد';
            if(sessionExam) examText = sessionExam.grades[st.phone] ? `${sessionExam.grades[st.phone]} / ${sessionExam.maxScore} ⭐` : 'لم يمتحن ⚠️';
            msg += `📝 *الامتحان:* ${examText}\n`;
        }
        if(sendHw) {
            let hwText = 'لا يوجد';
            if(sessionHw) hwText = sessionHw.grades[st.phone] ? `${sessionHw.grades[st.phone]} / ${sessionHw.maxScore} 📚` : 'لم يسلم ⚠️';
            msg += `📚 *الواجب:* ${hwText}\n`;
        }

        msg += `\n💡 *إدارة الدرس تتمنى لكم التوفيق!*\n[Ref: ${generateRandomHash()}]`; 
        
        const sent = await sendAutoWhatsApp(st.parentPhone, msg);
        if(sent) successCount++;

        await sleep(2000); // إراحة السيرفر بين كل رسالة والتانية
    }
    showToast(`تم إرسال ${successCount} تقرير بنجاح! ✅`);
}

// فحص حالة السيرفر لعرض الـ QR Code في الإعدادات
if (!document.getElementById('qrScript')) {
    let script = document.createElement('script');
    script.id = 'qrScript';
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    document.head.appendChild(script);
}

setInterval(async () => {
    const nodeStatus = document.getElementById("nodeStatus");
    const waStatus = document.getElementById("waStatus");
    const qrContainer = document.getElementById("qrContainer");
    const qrImage = document.getElementById("qrImage");

    if(!nodeStatus) return;

    try {
        const response = await fetch('http://localhost:3000/status');
        const data = await response.json();
        
        nodeStatus.innerHTML = '<span class="status-online">● يعمل (Online)</span>';
        
        if (data.status === 'connected') {
            waStatus.innerHTML = '<span class="status-online">متصل ✅</span>';
            if(qrContainer) qrContainer.style.display = "none";
        } else if (data.status === 'need_scan') {
            waStatus.innerHTML = '<span class="status-offline">بانتظار المسح 📱</span>';
            if(qrContainer) {
                qrContainer.style.display = "block";
                const qrResp = await fetch('http://localhost:3000/qr');
                const qrData = await qrResp.json();
                if (qrData.qr) {
                    qrImage.innerHTML = "";
                    new QRCode(qrImage, { text: qrData.qr, width: 200, height: 200 });
                }
            }
        } else {
            waStatus.innerHTML = 'جاري التهيئة...';
        }
    } catch (e) {
        nodeStatus.innerHTML = '<span class="status-offline">● متوقف (Offline)</span>';
        waStatus.innerHTML = '---';
        if(qrContainer) qrContainer.style.display = "none";
    }
}, 5000);






// ==========================================
// التشغيل الأولي
// ==========================================
renderGroupCards(); 
renderTable(); 
populateDropdowns();
if(sessionStorage.getItem("isLoggedIn") === "true") { 
    switchPage('dashboard'); 
    setTimeout(renderDashboardCharts, 500); 
}
