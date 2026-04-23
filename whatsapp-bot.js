// ==========================================
// 🤖 ملف المساعد الآلي (EduBot AI) - النسخة الشاملة
// ==========================================

let waBotInterval = null;
let processedMsgs = JSON.parse(localStorage.getItem("processedMsgs")) || [];

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

// ----------------------------------------------------
// 1. دالة الإرسال (بتاخد الـ ID الأصلي بدون أي تعديل)
// ----------------------------------------------------
async function sendAutoWhatsApp(chatId, message) {
    try {
        let response = await fetch('http://localhost:3000/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: chatId, message: message }) // إرسال الـ ID الخام
        });
        return response.ok;
    } catch(e) { 
        console.error("خطأ في الاتصال بالسيرفر:", e);
        return false; 
    }
}

// ----------------------------------------------------
// 2. تشغيل وإيقاف البوت
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
        fetch('http://localhost:3000/messages').then(() => {
            waBotInterval = setInterval(fetchAndProcessMessages, 8000); 
            btn.innerHTML = "البوت يعمل (محلي) 🟢";
            btn.style.color = "#ef4444"; btn.style.borderColor = "#ef4444"; btn.style.background = "rgba(239, 68, 68, 0.1)";
            showToast("المساعد الآلي متصل بالسيرفر بنجاح 🚀");
        }).catch(() => {
            showToast("السيرفر المحلي (Node.js) مغلق! افتحه أولاً", "error");
        });
    }
}

// ----------------------------------------------------
// 3. سحب الرسائل
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

                // msg.from هو الـ ID الخام (مثال: 218717401137169@c.us)
                await analyzeAndReply(msg.from, msg.body);
            }
        }
    } catch(e) {}
}

// ----------------------------------------------------
// 4. عقل البوت الشامل (صياد الأرقام + الردود الذكية)
// ----------------------------------------------------
// تأكد إن دالة analyzeAndReply في ملف whatsapp-bot.js بتستخدم originalFrom زي ما هي:
async function analyzeAndReply(originalFrom, text) {
    // originalFrom هنا هي الهوية الكاملة (مثلاً: 218717401137169@lid)
    
    // 1. استخراج الرقم للبحث فقط (تنظيف للبحث في السيستم)
    let searchPhone = originalFrom.split('@')[0]; 
    if(searchPhone.startsWith("20") && searchPhone.length === 12) {
        searchPhone = "0" + searchPhone.substring(2);
    }

    const studentList = typeof students !== 'undefined' ? students : [];
    let matchedStudent = studentList.find(s => s.phone === searchPhone || s.parentPhone === searchPhone);

    // 2. صيد الرقم من نص الرسالة (لو المرسل مش متسجل وعايز يستعلم)
    if (!matchedStudent) {
        const phoneRegex = /(01[0125][0-9]{8})/; 
        const extractedPhoneMatch = text.match(phoneRegex);
        if (extractedPhoneMatch) {
            const extractedPhone = extractedPhoneMatch[0];
            matchedStudent = studentList.find(s => s.phone === extractedPhone || s.parentPhone === extractedPhone);
        }
    }

    let aiPrompt = "";
    if (matchedStudent) {
        // ... (كود تجميع بيانات الطالب كما هو) ...
        aiPrompt = `أنت مساعد مستر شيفو. رد على ولي أمر الطالب (${matchedStudent.name}) بخصوص رسالته: "${text}"...`;
    } else {
        // ... (رد السكرتارية العام) ...
        aiPrompt = `أنت سكرتير مستر شيفو. شخص غير مسجل يسأل: "${text}". اطلب منه رقم الطالب للبحث...`;
    }

    try {
        const response = await fetch('http://localhost:3000/ask-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: aiPrompt })
        });
        const data = await response.json();
        
        // 🚀 الإرسال للهوية الأصلية (السيرفر هيحول @lid لـ @c.us أوتوماتيك)
        await sendAutoWhatsApp(originalFrom, data.reply);
        console.log(`✅ تم الرد الذكي بنجاح على المعرف: ${originalFrom}`);
    } catch (e) {
        console.error("AI Error:", e);
    }
}
