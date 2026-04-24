const express = require('express');
const fs = require('fs');
const cors = require('cors');
const { Client, LocalAuth } = require('whatsapp-web.js');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const qrcode = require('qrcode-terminal');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// ⚠️ استخدم مفتاحك هنا، الموديل 1.5 بيعطيك 1500 رسالة يومياً
const genAI = new GoogleGenerativeAI("AIzaSyAXiPlJKRzIcGseHfB6eQshz-lClmviiXM");
const aiModel = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });
let botDB = { students: [], classSessions: [], exams: [], homeworks: [], teacherName: "شيفو" };
let lastQR = null;

if (fs.existsSync('bot_db.json')) {
    botDB = JSON.parse(fs.readFileSync('bot_db.json'));
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => { lastQR = qr; qrcode.generate(qr, { small: true }); });
client.on('ready', () => { lastQR = null; console.log('✅ سيرفر EduTrack المدمج جاهز ومحمي ضد الحظر!'); });

// ==========================================
// عقل السكرتير الآلي
// ==========================================
client.on('message', async msg => {
    if (msg.fromMe || msg.from.includes('@g.us')) return;

    const text = msg.body;
    let senderPhone = msg.from.split('@')[0];
    if (senderPhone.startsWith('20') && senderPhone.length === 12) senderPhone = '0' + senderPhone.substring(2);

    let student = botDB.students.find(s => s.phone === senderPhone || s.parentPhone === senderPhone);
    if (!student) {
        const match = text.match(/(01[0125][0-9]{8})/);
        if (match) student = botDB.students.find(s => s.phone === match[0] || s.parentPhone === match[0]);
    }

    const tName = botDB.teacherName || "شيفو";
    let prompt = "";

    if (student) {
        const last4Sessions = botDB.classSessions.filter(s => s.group === student.group).slice(-4);
        const last4Exams = botDB.exams.filter(e => e.group === student.group).slice(-4);
        const last4Hw = (botDB.homeworks || []).filter(h => h.group === student.group).slice(-4);

        const presentCount = last4Sessions.filter(s => s.attendance[student.phone] === 'present').length;
        const absentCount = last4Sessions.filter(s => s.attendance[student.phone] === 'absent').length;

        const examsSummary = last4Exams.length > 0 ? last4Exams.map(e => `${e.name} (${e.grades[student.phone] ? e.grades[student.phone] + ' من ' + e.maxScore : 'لم يمتحن'})`).join('، ') : "لا توجد امتحانات مؤخراً";
        const hwSummary = last4Hw.length > 0 ? last4Hw.map(h => `${h.name} (${h.grades[student.phone] ? h.grades[student.phone] + ' من ' + h.maxScore : 'لم يسلم'})`).join('، ') : "لا توجد واجبات مؤخراً";

        prompt = `
        أنت المساعد الذكي. المطلوب صياغة التقرير الحرفي التالي فقط بدون أي مقدمات أو ترحيب. التزم بهذا النص:
        تقرير الطالب/ة: *${student.name}*
        الكود: ${student.code || 'غير محدد'} | المجموعة: ${student.group}
        سجل الحضور: حاضر ${presentCount} مرة، وغائب ${absentCount} مرة.
        سجل الامتحانات: ${examsSummary}.
        سجل الواجبات: ${hwSummary}.

        [اكتب هنا جملة تشجيعية واحدة لطيفة]

        إدارة مستر ${tName}
        `;
    } else {
        prompt = `أنت سكرتير مستر ${tName}. اعتذر واطلب رقم الطالب. التوقيع: إدارة مستر ${tName}`;
    }

    try {
        const result = await aiModel.generateContent(prompt);
        const response = await result.response;
        await client.sendMessage(msg.from, response.text());
    } catch (e) { console.error("⚠️ خطأ الذكاء الاصطناعي:", e.message); }
});

// ==========================================
// دالة الإرسال مع نظام الحماية (Anti-Ban)
// ==========================================
let globalBatchCount = 0;

async function safeSend(phone, message, retries = 2) {
    let attempt = 0;
    let chatId = String(phone).trim();
    if (chatId.includes('@lid')) { chatId = chatId.replace('@lid', '@c.us'); } 
    else if (!chatId.includes('@')) { chatId = chatId + "@c.us"; }

    while (attempt <= retries) {
        try {
            await client.sendMessage(chatId, message);
            
            // 🛡️ نظام الحماية (تأخير زمني بين الرسائل واستراحة بعد كل 10)
            globalBatchCount++;
            if (globalBatchCount >= 10) {
                const pauseTime = Math.floor(Math.random() * 60000) + 60000; 
                console.log(`⏳ استراحة حماية من الحظر لمدة ${Math.round(pauseTime/1000)} ثانية...`);
                await new Promise(r => setTimeout(r, pauseTime));
                globalBatchCount = 0;
            } else {
                const delayTime = Math.floor(Math.random() * 15000) + 15000; // 15 لـ 30 ثانية بين الرسائل
                await new Promise(r => setTimeout(r, delayTime));
            }
            return true;
        } catch (error) {
            attempt++;
            if (attempt > retries) return false;
            await new Promise(res => setTimeout(res, 2000));
        }
    }
}

app.post('/sync-database', (req, res) => {
    botDB = req.body;
    fs.writeFileSync('bot_db.json', JSON.stringify(botDB));
    res.json({ success: true });
});

app.post('/send', async (req, res) => {
    const { phone, message } = req.body;
    const success = await safeSend(phone, message);
    res.json({ success });
});

app.get('/status', (req, res) => { res.json({ status: client.info ? 'connected' : (lastQR ? 'need_scan' : 'loading') }); });
app.get('/qr', (req, res) => { res.json({ qr: lastQR }); });

client.initialize();
app.listen(3000, () => console.log('🌐 السيرفر المدمج يعمل على بورت 3000'));