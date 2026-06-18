// 📂 routes/paymob.js
const express = require('express');
const router = express.Router();
const paymobController = require('../controllers/PaymobPayment.js'); // تأكد من المسار

// لعمل عملية دفع جديدة
router.post('/create-payment', paymobController.createPayment);

// (اختياري) مكان الـ Webhook اللي باي موب هتبعتلك عليه تأكيد الدفع
router.post('/callback', async (req, res) => {
    const { obj } = req.body;
    const orderId = obj.order.id;
    const isSuccess = obj.success;

    if (isSuccess) {
        console.log(`✅ العملية نجحت للأوردر رقم: ${orderId}`);
        // هنا المفروض تروح لملف الـ JSON أو الداتابيز وتخلي حالة الحجز "Paid"
    } else {
        console.log(`❌ العملية فشلت للأوردر رقم: ${orderId}`);
    }

    res.status(200).send("OK"); // لازم ترد بـ 200 عشان باي موب ميفضلش يبعت الـ Webhook تاني
});

module.exports = router;