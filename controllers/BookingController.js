// 📂 controllers/BookingController.js
const Booking = require('../models/BookingModel');
const MedicalEntity = require('../models/MedicalEntity'); // تأكد من المسار

// ➕ إنشاء حجز جديد
exports.createBooking = async (req, res) => {
    try {
        const { entityId, date, time } = req.body;

        if (!entityId || !date || !time) {
            return res.status(400).json({ 
                status: 'fail', 
                message: 'Entity ID, date, and time are required.' 
            });
        }

        // 1. البحث عن المستشفى/العيادة
        const entity = MedicalEntity.findById(entityId);
        if (!entity) {
            return res.status(404).json({ status: 'fail', message: 'Medical Entity not found.' });
        }

        // 2. الموديل هيتكفل بكل حاجة (التأكد من الوقت، حفظ الحجز، وربطه باليوزر والمستشفى)
        const booking = entity.bookSlot(req.user, date, time);

        res.status(201).json({
            status: true,
            message: 'Booking created successfully',
            data: { booking }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

// 👤 جلب حجوزات المستخدم الحالي (My Bookings)
exports.getMyBookings = async (req, res) => {
    try {
        const bookings = Booking.findByUser(req.user.id);
        
        res.status(200).json({
            status: true,
            results: bookings.length,
            data: { bookings }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 📋 جلب كل الحجوزات (مخصصة للـ Admin)
exports.getAllBookings = async (req, res) => {
    try {
        const bookings = Booking.findAll();
        res.status(200).json({
            status: true,
            results: bookings.length,
            data: { bookings }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 📄 جلب حجز معين بالـ ID
exports.getBookingById = async (req, res) => {
    try {
        const booking = Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ status: 'fail', message: 'Booking not found' });
        }

        // الحماية: لازم اليوزر يكون صاحب الحجز ده، أو يكون أدمن
        if (booking.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ 
                status: 'fail', 
                message: 'You do not have permission to view this booking' 
            });
        }

        res.status(200).json({
            status: true,
            data: { booking }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ✏️ تحديث الحجز (للملاحظات فقط)
exports.updateBooking = async (req, res) => {
    try {
        const booking = Booking.findById(req.params.id);
        if (!booking) {
            return res.status(404).json({ status: 'fail', message: 'Booking not found' });
        }

        if (booking.userId !== req.user.id && req.user.role !== 'admin') {
            return res.status(403).json({ 
                status: 'fail', 
                message: 'You do not have permission to update this booking' 
            });
        }

        // 🚫 نمنع تعديل الوقت أو العيادة من هنا علشان منبوظش جدول المواعيد (Schedule)
        // لو عايز يغير الميعاد، لازم يكنسل الحجز ويعمل واحد جديد
        if (req.body.date || req.body.time || req.body.entityId) {
            return res.status(400).json({ 
                status: 'fail', 
                message: 'To change date, time, or clinic, please cancel this booking and create a new one.' 
            });
        }

        // السماح بتعديل الملاحظات
        if (req.body.notes !== undefined) booking.notes = req.body.notes;
        
        // الأدمن فقط يقدر يغير حالة الحجز (مثلاً لـ completed) يدوياً
        if (req.body.status && req.user.role === 'admin') {
            booking.status = req.body.status;
        }

        booking.save();

        res.status(200).json({
            status: true,
            data: { booking }
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

// ❌ إلغاء الحجز (Cancel)
exports.cancelBooking = async (req, res) => {
    try {
        const bookingId = req.params.id;
        const booking = Booking.findById(bookingId);
        
        if (!booking) {
            return res.status(404).json({ status: 'fail', message: 'Booking not found' });
        }

        const entity = MedicalEntity.findById(booking.entityId);
        if (!entity) {
            // لو العيادة اتمسحت من السيستم لسبب ما، هنكنسل الحجز من الموديل مباشرة
            booking.cancel("Clinic no longer available");
        } else {
            // الموديل هيقوم بفك حجز السلوت، وتحديث حالة الحجز في كل الملفات
            entity.cancelBooking(bookingId, req.user);
        }

        res.status(200).json({
            status: true,
            message: 'Booking cancelled successfully'
        });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};