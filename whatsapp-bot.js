let waBotInterval = null;
let processedMsgs = JSON.parse(localStorage.getItem("processedMsgs")) || [];
let userStates = {}; // لحفظ حالة المحادثة (هل بنستنى منه رقم تليفون؟)

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function sendAutoWhatsApp(chatId, message) {
    try {
        await fetch('http://localhost:3000/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone: chatId, message: message })
        });
        return true;
    } catch(e) { return false; }
}

function toggleWaBot() {
    const btn = document.getElementById("waBotBtn");
    if (waBotInterval) {
        clearInterval(waBotInterval); waBotInterval = null;
        btn.innerHTML = "تشغيل البوت الآلي 🤖"; btn.style.color = "#10b981";
        showToast("تم إيقاف المساعد 🛑", "error");
    } else {
        waBotInterval = setInterval(fetchAndProcessMessages, 8000);
        btn.innerHTML = "البوت يعمل (نشط) 🟢"; btn.style.color = "#ef4444";
        showToast("المساعد الآلي متصل 🚀");
    }
}

async function fetchAndProcessMessages() {
    try {
        const response = await fetch('http://localhost:3000/messages');
        const data = await response.json();
        for(let msg of data.messages) {
            if(!processedMsgs.includes(msg.id)) {
                processedMsgs.push(msg.id);
                if(processedMsgs.length > 500) processedMsgs.shift();
                localStorage.setItem("processedMsgs", JSON.stringify(processedMsgs));
                await analyzeAndReply(msg.from, msg.body);
            }
        }
    } catch(e) {}
}

async function analyzeAndReply(originalFrom, text) {
    const sender = originalFrom;
    let senderClean = sender.split('@')[0];
    if(senderClean.startsWith("20")) senderClean = "0" + senderClean.substring(2);

    // 1. هل الشخص ده في حالة "انتظار رقم الهاتف"؟
    if (userStates[sender] === 'waiting_for_phone') {
        const phoneRegex = /(01[0125][0-9]{8})/;
        const match = text.match(phoneRegex);
        
        if (match) {
            const providedPhone = match[0];
            const student = students.find(s => s.phone === providedPhone || s.parentPhone === providedPhone);
            if (student) {
                delete userStates[sender];
                await getSmartAIResponse(sender, `لقد وجدت بيانات الطالب ${student.name}. رد عليّ بتقرير مفصل عنه بناءً على طلبي السابق: ${text}`, student);
            } else {
                await sendAutoWhatsApp(sender, "عذراً، هذا الرقم غير مسجل لدينا. تأكد من الرقم أو تواصل مع السكرتارية. ❌");
                delete userStates[sender];
            }
        } else {
            await sendAutoWhatsApp(sender, "من فضلك أرسل رقم الهاتف المكون من 11 رقم للبحث (مثال: 01012345678). 📱");
        }
        return;
    }

    // 2. البحث التلقائي برقم المرسل
    let matchedStudent = students.find(s => s.phone === senderClean || s.parentPhone === senderClean);

    // 3. لو مش مسجل.. نسأله عن بيانات أو نرد رد عام
    if (!matchedStudent) {
        // إذا كان يسأل عن طالب أو نتائج
        if (/(درجه|نتيجه|طالب|ابني|مستوى|استعلام)/.test(text)) {
            userStates[sender] = 'waiting_for_phone';
            await sendAutoWhatsApp(sender, "أهلاً بك! لكي أتمكن من مساعدتك بخصوص بيانات الطالب، يرجى إرسال **رقم الهاتف المسجل لدينا**. 📱");
        } else {
            // رد عام باستخدام الذكاء الاصطناعي لأي سؤال آخر
            await getSmartAIResponse(sender, text, null);
        }
    } else {
        // طالب مسجل فعلاً
        await getSmartAIResponse(sender, text, matchedStudent);
    }
}

async function getSmartAIResponse(chatId, text, student) {
    let aiPrompt = "";
    if (student) {
        const recentAtt = classSessions.filter(s => s.group === student.group).slice(-3);
        const attSummary = recentAtt.map(s => `${s.date}: ${s.attendance[student.phone] === 'present' ? 'حاضر' : 'غائب'}`).join(', ');
        
        aiPrompt = `أنت مساعد مستر شيفو. ولي أمر الطالب (${student.name}) يسأل: "${text}". بياناته: الحضور (${attSummary}). رد بأسلوب لبق ومصري منسق بالإيموجي وقدم التقرير.`;
    } else {
        aiPrompt = `أنت سكرتير مستر شيفو. شخص يسأل: "${text}". رد بأسلوب مصري ودي وقصير. لو سأل عن مواعيد أو تفاصيل، قل له أن يرسل رقم الطالب للاستعلام.`;
    }

    try {
        const response = await fetch('http://localhost:3000/ask-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: aiPrompt })
        });
        const data = await response.json();
        await sendAutoWhatsApp(chatId, data.reply);
    } catch (e) {}
}
