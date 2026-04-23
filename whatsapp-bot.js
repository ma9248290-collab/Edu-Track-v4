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
// ----------------------------------------------------
// 4. عقل البوت الشامل (المحاكي للسكرتير البشري)
// ----------------------------------------------------
async function analyzeAndReply(fromPhone, text) {
    let senderPhone = fromPhone.split('@')[0]; // رقم اللي بيبعت الرسالة
    
    // تنظيف رقم المرسل
    if(senderPhone.startsWith("20") && senderPhone.length === 12) {
        senderPhone = "0" + senderPhone.substring(2);
    }

    const studentList = typeof students !== 'undefined' ? students : [];
    
    // 1. هل رقم اللي بيبعت ده متسجل عندنا أصلاً؟
    let matchedStudent = studentList.find(s => s.phone === senderPhone || s.parentPhone === senderPhone);

    // 2. لو مش متسجل.. هل هو باعت رقم تليفون جوه الرسالة عشان يستعلم بيه؟
    if (!matchedStudent) {
        // فلتر بيصطاد أي رقم موبايل مصري جوه الكلام
        const phoneRegex = /(01[0125][0-9]{8})/; 
        const extractedPhoneMatch = text.match(phoneRegex);
        
        if (extractedPhoneMatch) {
            const extractedPhone = extractedPhoneMatch[0];
            matchedStudent = studentList.find(s => s.phone === extractedPhone || s.parentPhone === extractedPhone);
            
            // لو بعت رقم بس طلع مش في السيستم
            if (!matchedStudent) {
                const reply = "عذراً يا فندم، الرقم اللي حضرتك بعته غير مسجل عندنا في النظام. 🚫\nيرجى التأكد من الرقم والمحاولة مرة أخرى.";
                await sendAutoWhatsApp(senderPhone, reply);
                return;
            }
        }
    }

    let aiPrompt = "";

    // 🟢 الحالة الأولى: عرفنا الطالب (سواء من رقم المرسل، أو الرقم اللي استخرجناه من رسالته)
    if (matchedStudent) {
        console.log(`🤖 جاري تحليل بيانات الطالب: ${matchedStudent.name}`);
        
        const recentAttendance = classSessions.filter(s => s.group === matchedStudent.group).slice(-3);
        const recentExams = exams.filter(e => e.group === matchedStudent.group).slice(-3);

        const attendanceSummary = recentAttendance.length ? recentAttendance.map(s => `${s.date}: ${s.attendance[matchedStudent.phone] === 'present' ? 'حاضر' : 'غائب'}`).join(', ') : 'لا يوجد حصص حديثة';
        const gradesSummary = recentExams.length ? recentExams.map(e => `${e.name}: ${e.grades[matchedStudent.phone] || 'لم يرصد'} من ${e.maxScore}`).join(', ') : 'لا يوجد امتحانات حديثة';

        aiPrompt = `
        أنت مساعد ذكي لمستر شيفو. المستخدم يستعلم عن الطالب (${matchedStudent.name}) وقال: "${text}".
        بيانات الطالب حالياً: 
        - الحضور الأخير: ${attendanceSummary}
        - الدرجات الأخيرة: ${gradesSummary}
        
        المطلوب:
        - رد بأسلوب بشري، لبق، ومصري.
        - لخص حالة الطالب (حاضر ولا غايب، درجاته حلوة ولا وحشة).
        - اختم برسالة تشجيعية. 
        - اجعل الرد قصيراً وضع بعض الإيموجي. لا تذكر أبداً أنك ذكاء اصطناعي.
        `;
    } 
    // 🔴 الحالة الثانية: شخص غريب بيسأل سؤال عام أو بيطلب نتيجة ولسه مبعتش رقم
    else {
        console.log(`🤖 شخص غير مسجل يتحدث: ${senderPhone}`);
        aiPrompt = `
        أنت مساعد ذكي وسكرتير لمستر شيفو. يتحدث معك شخص رقمه غير مسجل.
        رسالة الشخص: "${text}"
        
        المطلوب:
        1. إذا كان يسأل عن طالب (مستواه، نتيجته، حضوره)، اعتذر له بلباقة واطلب منه "كتابة رقم هاتف الطالب أو ولي الأمر" المكون من 11 رقم للبحث في النظام.
        2. إذا كان يسأل أسئلة عامة (من أنت، تفاصيل الدروس، كيف أعمل سكان)، أجب بأسلوب ودي ولطيف كموظف خدمة عملاء.
        3. اجعل الرد بلهجة مصرية محترمة، قصيراً، ولا تذكر أنك روبوت أو ذكاء اصطناعي.
        `;
    }

    // 🚀 إرسال الأمر لعقل Gemini في السيرفر
    try {
        const response = await fetch('http://localhost:3000/ask-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: aiPrompt })
        });
        const data = await response.json();
        
        await sendAutoWhatsApp(senderPhone, data.reply);
        console.log(`✅ تم الرد الذكي بنجاح.`);
    } catch (e) {
        console.error("AI Error:", e);
    }
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
