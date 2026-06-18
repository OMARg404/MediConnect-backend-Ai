const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const validator = require('validator');

// ================= PATHS =================
const USERS_FILE = path.join(__dirname, '../data/users.json');
const USERS_BY_ID_DIR = path.join(__dirname, '../data/users_by_id');

// ================= INIT =================
if (!fs.existsSync(USERS_FILE)) {
    fs.mkdirSync(path.dirname(USERS_FILE), { recursive: true });
    fs.writeFileSync(USERS_FILE, JSON.stringify([]));
}

if (!fs.existsSync(USERS_BY_ID_DIR)) {
    fs.mkdirSync(USERS_BY_ID_DIR, { recursive: true });
}

// ================= ENCRYPTION =================
const ENCRYPTION_KEY = crypto.randomBytes(32);
const IV = crypto.randomBytes(16);

function encrypt(text) {
    const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, IV);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${encrypted}:${IV.toString('hex')}`;
}

// ================= CLASS =================
class User {
    constructor(data = {}) {
        this.id = data.id || `USR-${Date.now()}`;

        // ===== Personal =====
        this.name = data.name;
        this.age = data.age;
        this.gender = data.gender;
        this.national_id = data.national_id;
        this.birth_date = data.birth_date;
        this.nationality = data.nationality;
        this.marital_status = data.marital_status;
        this.blood_type = data.blood_type;

        this.emergency_contact = data.emergency_contact;

        this.email_verified = data.email_verified ?? false;
        this.role = data.role || 'user';
        this.is_active = data.is_active ?? true;

        this.email = data.email?.toLowerCase();
        this.address = data.address;
        this.phone = data.phone;
        this.occupation = data.occupation;

        this.profile_image = data.profile_image || 'default.jpg';

        // ===== Medical =====
        this.medical_history = data.medical_history;
        this.current_medications = data.current_medications;
        this.allergies = data.allergies;
        this.surgeries = data.surgeries;
        this.lab_tests = data.lab_tests;
        this.vaccinations = data.vaccinations;
        this.doctor_notes = data.doctor_notes;
        this.insurance = data.insurance;

        // ===== Social =====
        this.social_media = data.social_media;
        this.is_student = data.is_student;

        // ===== Auth =====
        this.password = data.password;
        this.confirmPassword = data.confirmPassword;
        this.passwordChangedAt = data.passwordChangedAt;
        this.passwordResetToken = data.passwordResetToken;
        this.passwordResetExpires = data.passwordResetExpires;

        this.creditCard = data.creditCard;

        // ===== Bookings =====
        this.bookings = data.bookings || [];

        this.createdAt = data.createdAt || new Date();
        this.updatedAt = new Date();
    }

    // ================= VALIDATION =================
    validate() {
        if (!this.name) throw new Error('Name is required');

        if (!this.email || !validator.isEmail(this.email))
            throw new Error('Invalid email');

        if (!this.password || this.password.length < 6)
            throw new Error('Password must be at least 6 chars');

        if (this.password !== this.confirmPassword)
            throw new Error('Passwords do not match');

        if (this.age < 0) throw new Error('Age must be positive');

        const allowedGenders = ['ذكر', 'أنثى', 'Male', 'Female'];
        if (this.gender && !allowedGenders.includes(this.gender)) {
            throw new Error('Invalid gender');
        }

        const allowedBlood = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
        if (this.blood_type && !allowedBlood.includes(this.blood_type)) {
            throw new Error('Invalid blood type');
        }
    }

    // ================= PRE SAVE =================
    async preSave() {
        // 🔐 password hash
        if (this.password) {
            this.password = await bcrypt.hash(this.password, 12);
            this.confirmPassword = undefined;
            this.passwordChangedAt = Date.now() - 1000;
        }

        // 🔐 encrypt credit card
        if (this.creditCard?.cardNumber) {
            this.creditCard.cardNumber = encrypt(this.creditCard.cardNumber);
        }

        if (this.creditCard?.cvv) {
            this.creditCard.cvv = encrypt(this.creditCard.cvv);
        }

        // 🧠 تحويل undefined → قيم فعلية
        const fixArray = (val) => Array.isArray(val) ? val : (val ? [val] : []);
        const fixObject = (val) => typeof val === 'object' && val !== null ? val : {};

        this.medical_history = fixArray(this.medical_history);
        this.current_medications = fixArray(this.current_medications);
        this.allergies = fixArray(this.allergies);
        this.surgeries = fixArray(this.surgeries);
        this.lab_tests = fixArray(this.lab_tests);
        this.vaccinations = fixArray(this.vaccinations);
        this.doctor_notes = fixArray(this.doctor_notes);

        this.emergency_contact = fixObject(this.emergency_contact);
        this.insurance = fixObject(this.insurance);
        this.social_media = fixObject(this.social_media);
        this.bookings = fixArray(this.bookings);
    }

    // ================= SAVE =================
    async save() {
        this.validate();
        await this.preSave();

        const users = JSON.parse(fs.readFileSync(USERS_FILE));

        const existingIndex = users.findIndex(u => u.id === this.id);

        if (existingIndex !== -1) {
            // UPDATE
            users[existingIndex] = this;
        } else {
            // CREATE
            if (users.find(u => u.email === this.email)) {
                throw new Error('Email already exists');
            }
            users.push(this);
        }

        fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));

        const userFile = path.join(USERS_BY_ID_DIR, `${this.id}.json`);
        fs.writeFileSync(userFile, JSON.stringify(this, null, 2));

        return this;
    }

    // ================= BOOKING METHODS =================
    addBooking(booking) {
        this.bookings.push({
            id: booking.id,
            entityId: booking.entity.id,
            entityName: booking.entity.name,
            date: booking.date,
            time: booking.time,
            status: booking.status,
            price: booking.price,
            createdAt: booking.createdAt || new Date()
        });
        this.updatedAt = new Date();
    }

    // ================= METHODS =================
    async correctPassword(candidate, hashed) {
        return await bcrypt.compare(candidate, hashed);
    }

    changedPasswordAfter(JWTTimestamp) {
        if (this.passwordChangedAt) {
            const changedTimestamp = parseInt(this.passwordChangedAt / 1000, 10);
            return JWTTimestamp < changedTimestamp;
        }
        return false;
    }

    createPasswordResetToken() {
        const resetToken = crypto.randomBytes(32).toString('hex');

        this.passwordResetToken = crypto
            .createHash('sha256')
            .update(resetToken)
            .digest('hex');

        this.passwordResetExpires = Date.now() + 10 * 60 * 1000;

        return resetToken;
    }

    // ================= STATIC =================
    static findAll() {
        return JSON.parse(fs.readFileSync(USERS_FILE));
    }

    static findByEmail(email) {
        const users = this.findAll();
        return users.find(u => u.email === email);
    }

    static findById(id) {
        const file = path.join(USERS_BY_ID_DIR, `${id}.json`);
        if (!fs.existsSync(file)) return null;
        return JSON.parse(fs.readFileSync(file));
    }
}

module.exports = User;