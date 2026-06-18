// 📂 models/BookingModel.js
const fs = require('fs');
const path = require('path');

// ================= PATHS =================
const BOOKINGS_FILE = path.join(__dirname, '../data/bookings.json');
const BOOKINGS_BY_ID_DIR = path.join(__dirname, '../data/bookings_by_id');

// ================= INIT =================
if (!fs.existsSync(BOOKINGS_FILE)) {
    fs.mkdirSync(path.dirname(BOOKINGS_FILE), { recursive: true });
    fs.writeFileSync(BOOKINGS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(BOOKINGS_BY_ID_DIR)) {
    fs.mkdirSync(BOOKINGS_BY_ID_DIR, { recursive: true });
}

// ================= CLASS =================
class Booking {
    constructor(data = {}) {
        // إضافة رقم عشوائي لضمان عدم تكرار الـ ID لو حصل حجزين في نفس اللحظة
        this.id = data.id || `BOOK-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        // 🔗 Relations (ربط المتغيرات بالبيانات المبعوتة من MedicalEntity)
        this.userId = data.userId || (data.user ? data.user.id : null);
        this.entityId = data.entityId || (data.entity ? data.entity.id : null);

        // 📅 Booking Info
        this.date = data.date; // "2026-04-10"
        this.time = data.time; // "14:00"

        this.type = data.type || (data.entity ? data.entity.type : 'clinic'); 
        this.price = data.price || 0;

        this.status = data.status || 'confirmed'; 
        // confirmed | cancelled | completed

        this.notes = data.notes || null;
        this.cancelReason = data.cancelReason || null;

        // 🧠 Snapshot (حفظ بيانات مصغرة عن اليوزر والكيان لسرعة العرض)
        this.user = data.user || data.userSnapshot || null;
        this.entity = data.entity || data.entitySnapshot || null;

        this.createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
        this.updatedAt = new Date();
    }

    // ================= VALIDATION =================
    validate() {
        if (!this.userId) throw new Error('User ID is required for booking');
        if (!this.entityId) throw new Error('Entity ID is required for booking');
        if (!this.date) throw new Error('Date is required');
        if (!this.time) throw new Error('Time is required');

        if (!/^\d{4}-\d{2}-\d{2}$/.test(this.date))
            throw new Error('Invalid date format. Use YYYY-MM-DD');

        if (!/^\d{2}:\d{2}$/.test(this.time))
            throw new Error('Invalid time format. Use HH:MM');
    }

    // ================= SAVE (Create or Update) =================
    save() {
        this.validate();
        this.updatedAt = new Date();

        let bookings = JSON.parse(fs.readFileSync(BOOKINGS_FILE));
        const existingIndex = bookings.findIndex(b => b.id === this.id);

        if (existingIndex !== -1) {
            // UPDATE
            bookings[existingIndex] = this;
        } else {
            // CREATE: 🚫 منع double booking لنفس المكان في نفس الوقت
            const exists = bookings.find(
                b =>
                    b.entityId === this.entityId &&
                    b.date === this.date &&
                    b.time === this.time &&
                    b.status === 'confirmed'
            );

            if (exists) {
                throw new Error('This slot is already booked');
            }

            bookings.push(this);
        }

        fs.writeFileSync(BOOKINGS_FILE, JSON.stringify(bookings, null, 2));

        const bookingFile = path.join(BOOKINGS_BY_ID_DIR, `${this.id}.json`);
        fs.writeFileSync(bookingFile, JSON.stringify(this, null, 2));

        return this;
    }

    // ================= CANCEL =================
    cancel(reason = "User cancelled") {
        this.status = 'cancelled';
        this.cancelReason = reason;
        this.save(); // استخدام دالة الحفظ الموحدة
    }

    // ================= COMPLETE =================
    complete() {
        this.status = 'completed';
        this.save(); // استخدام دالة الحفظ الموحدة
    }

    // ================= STATIC =================
    static findAll() {
        return JSON.parse(fs.readFileSync(BOOKINGS_FILE));
    }

    static findById(id) {
        const file = path.join(BOOKINGS_BY_ID_DIR, `${id}.json`);
        if (!fs.existsSync(file)) return null;
        
        // إرجاع Class Instance عشان نقدر نستخدم دوال زي cancel() أو save()
        return new Booking(JSON.parse(fs.readFileSync(file)));
    }

    static findByUser(userId) {
        const bookings = this.findAll().filter(b => b.userId === userId);
        return bookings.map(b => new Booking(b));
    }

    static findByEntity(entityId) {
        const bookings = this.findAll().filter(b => b.entityId === entityId);
        return bookings.map(b => new Booking(b));
    }
}

module.exports = Booking;