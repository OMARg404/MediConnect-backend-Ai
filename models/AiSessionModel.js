// 📂 models/AiSessionModel.js
const fs = require('fs');
const path = require('path');

const AI_SESSIONS_FILE = path.join(__dirname, '../data/ai_sessions.json');
const AI_SESSIONS_DIR = path.join(__dirname, '../data/ai_sessions_by_id');
// 💡 فولدر جديد مخصص لحفظ صور المحادثات
const AI_IMAGES_DIR = path.join(__dirname, '../data/ai_images'); 

// ================= INIT =================
if (!fs.existsSync(AI_SESSIONS_FILE)) {
    fs.mkdirSync(path.dirname(AI_SESSIONS_FILE), { recursive: true });
    fs.writeFileSync(AI_SESSIONS_FILE, JSON.stringify([]));
}
if (!fs.existsSync(AI_SESSIONS_DIR)) {
    fs.mkdirSync(AI_SESSIONS_DIR, { recursive: true });
}
if (!fs.existsSync(AI_IMAGES_DIR)) {
    fs.mkdirSync(AI_IMAGES_DIR, { recursive: true });
}

class AiSession {
    constructor(data = {}) {
        this.id = data.id || data.session_id;
        this.userId = data.userId;
        
        this.messages = data.messages || []; 
        
        this.status = data.status || 'active'; 
        
        // 💡 حقل جديد لحفظ الدكاترة والمستشفيات
        this.nearby_places = data.nearby_places || []; 

        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = new Date();
    }

    // 💡 تعديل الدالة لتقبل الصورة بصيغة Base64 كعنصر اختياري
    addMessage(role, content, imageBase64 = null) {
        let imagePath = null;

        if (imageBase64) {
            try {
                // 1. فصل رأس الـ Base64 (لو موجود) عن الداتا الفعلية
                const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "");
                
                // 2. إنشاء اسم فريد للصورة بناءً على الـ ID والوقت
                const filename = `${this.id}_${Date.now()}.jpg`;
                const filepath = path.join(AI_IMAGES_DIR, filename);
                
                // 3. حفظ الصورة كملف حقيقي في الفولدر
                fs.writeFileSync(filepath, base64Data, 'base64');
                
                // 4. حفظ المسار اللي الفرونت إند هيستخدمه لطلب الصورة
                imagePath = `/api/ai/images/${filename}`; 
            } catch (error) {
                console.error("Error saving image:", error);
            }
        }

        this.messages.push({
            role, 
            content,
            image: imagePath, // 💡 هيتسجل كـ مسار (URL) مش Base64
            timestamp: new Date()
        });
        
        this.updatedAt = new Date();
    }

    save() {
        if (!this.id) throw new Error("Session ID is required to save");

        let sessions = JSON.parse(fs.readFileSync(AI_SESSIONS_FILE));
        const existingIndex = sessions.findIndex(s => s.id === this.id);

        if (existingIndex !== -1) {
            sessions[existingIndex] = this;
        } else {
            sessions.push(this);
        }

        fs.writeFileSync(AI_SESSIONS_FILE, JSON.stringify(sessions, null, 2));
        const sessionFile = path.join(AI_SESSIONS_DIR, `${this.id}.json`);
        fs.writeFileSync(sessionFile, JSON.stringify(this, null, 2));

        return this;
    }

    static findById(id) {
        const file = path.join(AI_SESSIONS_DIR, `${id}.json`);
        if (!fs.existsSync(file)) return null;
        return new AiSession(JSON.parse(fs.readFileSync(file)));
    }

    static findByUser(userId) {
        const sessions = JSON.parse(fs.readFileSync(AI_SESSIONS_FILE));
        return sessions.filter(s => s.userId === userId);
    }
}

module.exports = AiSession;