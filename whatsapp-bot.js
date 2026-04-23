// ==========================================
// 🤖 ملف المساعد الآلي (EduBot AI) - نسخة السيرفر المحلي
// ==========================================

let waBotInterval = null;
let processedMsgs = JSON.parse(localStorage.getItem("processedMsgs")) || [];

// دوال مساعدة للحماية
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function getRandomGreeting() {
    const greetings = ["أهلاً بحضرتك", "مرحباً بك", "تحياتي", "السلام عليكم", "أهلاً وسهلاً"];
    return greetings[Math.floor(Math.random() * greetings.length)];
}

// ----------------------------------------------------
// 1. دالة الإرسال (مربوطة بالسيرفر المحلي 3000)
// ----------------------------------------------------
async function sendAutoWhatsApp(phone, message) {
    let formattedPhone = phone;
    if (phone.startsWith("0")) formattedPhone = "20" + phone.substring(1);
    else if (!phone.startsWith("20")) formattedPhone = "20" + phone;

    try {
        let response = await fetch('http://localhost:3000/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: formattedPhone, message: message })
        });
        return response.ok;
    } catch(e) { 
        console.error("خطأ في الاتصال بالسيرفر المحلي:", e);
        return false; 
    }
}

// ----------------------------------------------------
// 2. تشغيل وإيقاف البوت من لوحة التحكم
// ----------------------------------------------------
function toggleWaBot() {
    const btn = document.getElementById("waBotBtn");
    if(!btn) return;

    if (waBotInterval) {
        clearInterval(waBotInterval);
        waBotInterval = null;
        btn.innerHTML = "تشغيل البوت الآلي 🤖";
        btn.style.color = "#10b981"; btn.style.borderColor = "#10b981"; btn.style.background = "rgba(16, 185, 129, 0.1)";
        showToast("تم إيقاف المساعد الآلي 🛑", "error");
    } else {
        // فحص سريع إذا كان السيرفر (Node.js) مفتوح أصلاً
        fetch('http://localhost:3000/messages').then(() => {
            waBotInterval = setInterval(fetchAndProcessMessages, 10000); // فحص كل 10 ثواني
            btn.innerHTML = "البوت يعمل (محلي) 🟢";
            btn.style.color = "#ef4444"; btn.style.borderColor = "#ef4444"; btn.style.background = "rgba(239, 68, 68, 0.1)";
            showToast("المساعد الآلي متصل بالسيرفر المحلي بنجاح 🚀");
        }).catch(() => {
            showToast("السيرفر المحلي (Node.js) مغلق! افتحه أولاً", "error");
        });
    }
}

// ----------------------------------------------------
// 3. سحب الرسائل من السيرفر وتحليلها
// ----------------------------------------------------
async function fetchAndProcessMessages() {
    try {
        const response = await fetch('http://localhost:3000/messages');
        const data = await response.json();
        const messages = data.messages || []; 
        
        for(let msg of messages) {
            if(!processedMsgs.includes(msg.id)) {
                processedMsgs.push(msg.id);
                if(processedMsgs.length > 500) processedMsgs.shift(); 
                localStorage.setItem("processedMsgs", JSON.stringify(processedMsgs));

                // استدعاء عقل البوت للرد
                await analyzeAndReply(msg.from, msg.body);
            }
        }
    } catch(e) { /* السيرفر مغلق حالياً */ }
}

// ----------------------------------------------------
// 4. عقل البوت (تحليل النية والرد البشري)
// ----------------------------------------------------
async function analyzeAndReply(fromPhone, text) {
    let phone = fromPhone.split('@')[0];
    if(phone.startsWith("20")) phone = "0" + phone.substring(2);

    // البحث عن الطالب في بيانات script.js
    const student = students.find(s => s.phone === phone || s.parentPhone === phone);
    const q = text.toLowerCase().replace(/[أإآا]/g, 'ا').replace(/ة/g, 'ه').replace(/[يى]/g, 'ي');
    let reply = "";

    if(!student) {
        if(q.length > 2) {
            reply = `أهلاً بك يا فندم 🌟\nمعاك المساعد الآلي لسنتر مستر شيفو 🤖.\n\nعذراً، هذا الرقم غير مسجل لدينا.\nبرجاء التواصل مع السكرتارية لتسجيل بيانات الطالب لتفعيل الخدمة الآلية.`;
            await sendAutoWhatsApp(phone, reply);
        }
        return;
    }

    const isGreeting = /(سلام|ازيك|مرحبا|اهلا|مستر|شيفو|عامل ايه)/.test(q);
    const isGrades = /(درجه|نتيجه|امتحان|مستوى|جاب|نمر)/.test(q);
    const isAttendance = /(حضور|غياب|حضر|غاب|موجود|مجاش)/.test(q);

    if (isGreeting && !isGrades && !isAttendance) {
        reply = `${getRandomGreeting()} 🌟\nأنا المساعد الذكي لمستر شيفو. أقدر أساعدك بخصوص الطالب: *${student.name}*؟\n\n(اسألني عن: مستواه، درجاته، أو حضوره)`;
    } else {
        reply = `تقرير الطالب: *${student.name}* 🎓\n\n`;
        let understood = false;

        if(isAttendance) {
            understood = true;
            const groupSessions = classSessions.filter(s => s.group === student.group).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,3);
            reply += "📋 *سجل الحضور:* \n" + (groupSessions.length ? groupSessions.map(s => `- ${s.date}: ${s.attendance[student.phone] === 'present' ? 'حاضر ✅' : 'غائب ❌'}`).join('\n') : "لا توجد حصص مسجلة.") + "\n\n";
        }
        if(isGrades) {
            understood = true;
            const groupExams = exams.filter(e => e.group === student.group).sort((a,b)=>new Date(b.date)-new Date(a.date)).slice(0,3);
            reply += "⭐ *آخر الدرجات:* \n" + (groupExams.length ? groupExams.map(e => `- ${e.name}: ${e.grades[student.phone] || 'لم يرصد'} / ${e.maxScore}`).join('\n') : "لا توجد امتحانات مسجلة.") + "\n\n";
        }
        
        if(!understood) reply = `أهلاً بك يا فندم 🤖\nلقد استلمت رسالتك بخصوص *${student.name}*.\nبرجاء كتابة (الدرجات) أو (الغياب) لعرض التقرير فوراً، أو انتظر رد السكرتارية.`;
    }

    await sendAutoWhatsApp(phone, reply);
    console.log(`🤖 تم الرد آلياً عبر السيرفر المحلي على: ${student.name}`);
    await sleep(2000); 
}


// استدعاء مكتبة توليد QR الصور (تضاف في index.html أفضل ولكن سنضعها هنا للسهولة)
if (!document.getElementById('qrScript')) {
    let script = document.createElement('script');
    script.id = 'qrScript';
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js";
    document.head.appendChild(script);
}

// فحص حالة السيرفر وتحديث النافذة تلقائياً
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
            qrContainer.style.display = "none";
        } else if (data.status === 'need_scan') {
            waStatus.innerHTML = '<span class="status-offline">بانتظار المسح 📱</span>';
            qrContainer.style.display = "block";
            // جلب كود الـ QR وعرضه
            const qrResp = await fetch('http://localhost:3000/qr');
            const qrData = await qrResp.json();
            if (qrData.qr) {
                qrImage.innerHTML = "";
                new QRCode(qrImage, { text: qrData.qr, width: 200, height: 200 });
            }
        } else {
            waStatus.innerHTML = 'جاري التهيئة...';
        }
    } catch (e) {
        nodeStatus.innerHTML = '<span class="status-offline">● متوقف (Offline)</span>';
        waStatus.innerHTML = '---';
        qrContainer.style.display = "none";
    }
}, 5000);