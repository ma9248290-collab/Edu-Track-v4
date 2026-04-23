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
async function analyzeAndReply(originalFrom, text) {
    // 1. استخراج رقم تقريبي للبحث فقط (لا يستخدم في الإرسال)
    let senderPhone = originalFrom.split('@')[0]; 
    if(senderPhone.startsWith("20") && senderPhone.length === 12) {
        senderPhone = "0" + senderPhone.substring(2);
    }

    const studentList = typeof students !== 'undefined' ? students : [];
    
    // 2. هل الرقم متسجل عندنا أصلاً؟
    let matchedStudent = studentList.find(s => s.phone === senderPhone || s.parentPhone === senderPhone);

    // 3. صيد الرقم من نص الرسالة (لو المرسل غير مسجل)
    if (!matchedStudent) {
        const phoneRegex = /(01[0125][0-9]{8})/; 
        const extractedPhoneMatch = text.match(phoneRegex);
        
        if (extractedPhoneMatch) {
            const extractedPhone = extractedPhoneMatch[0];
            matchedStudent = studentList.find(s => s.phone === extractedPhone || s.parentPhone === extractedPhone);
            
            if (!matchedStudent) {
                const reply = "عذراً يا فندم، الرقم اللي حضرتك بعته غير مسجل عندنا في النظام. 🚫\nيرجى التأكد من الرقم والمحاولة مرة أخرى.";
                await sendAutoWhatsApp(originalFrom, reply); // الرد باستخدام الـ ID الأصلي
                return;
            }
        }
    }

    let aiPrompt = "";

    // 🟢 طالب معروف
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
        - لخص حالة الطالب.
        - اختم برسالة تشجيعية. 
        - اجعل الرد قصيراً وضع بعض الإيموجي. لا تذكر أبداً أنك ذكاء اصطناعي.
        `;
    } 
    // 🔴 شخص غريب
    else {
        console.log(`🤖 شخص غير مسجل يتحدث.`);
        aiPrompt = `
        أنت مساعد ذكي وسكرتير لمستر شيفو. يتحدث معك شخص غير مسجل.
        رسالة الشخص: "${text}"
        
        المطلوب:
        1. إذا كان يسأل عن طالب، اعتذر بلباقة واطلب منه "كتابة رقم هاتف الطالب أو ولي الأمر" المكون من 11 رقم للبحث.
        2. إذا كان يسأل أسئلة عامة، أجب بأسلوب ودي.
        3. اجعل الرد بلهجة مصرية محترمة، قصيراً، ولا تذكر أنك روبوت.
        `;
    }

    // 🚀 طلب الرد من Gemini والإرسال
    try {
        const response = await fetch('http://localhost:3000/ask-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: aiPrompt })
        });
        const data = await response.json();
        
        // إرسال الرد باستخدام الـ ID الأصلي اللي استلمناه من الواتس
        await sendAutoWhatsApp(originalFrom, data.reply);
        console.log(`✅ تم الرد بنجاح.`);
    } catch (e) {
        console.error("AI Error:", e);
    }
}
