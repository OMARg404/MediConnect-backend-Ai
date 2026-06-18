// 📂 routes/bookingRoutes.js
const express = require("express");
const auth = require("../controllers/authController");
const bookingController = require("../controllers/BookingController");

const router = express.Router();

// 🔒 حماية كل الـ routes (يجب تسجيل الدخول)
router.use(auth.protect);

// ================= BOOKING ROUTES =================

// إنشاء حجز جديد
router.post("/", bookingController.createBooking);

// جلب كل حجوزات المستخدم الحالي (لازم تكون فوق الـ :id)
router.get("/my", bookingController.getMyBookings);

// جلب حجز بالـ ID
router.get("/:id", bookingController.getBookingById);

// تعديل حجز (إضافة ملاحظات)
router.patch("/:id", bookingController.updateBooking);

// إلغاء حجز (باستخدام DELETE كأنها عملية إزالة/إلغاء)
router.delete("/:id", bookingController.cancelBooking);


// ================= ADMIN ROUTES =================

// جلب كل الحجوزات في النظام (مخصصة للـ Admin فقط)
router.get("/", auth.restrictTo("admin"), bookingController.getAllBookings);

module.exports = router;