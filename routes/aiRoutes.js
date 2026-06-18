// 📂 routes/aiRoutes.js
const express = require('express');
const authController = require('../controllers/authController');
const aiController = require('../controllers/aiController');

const router = express.Router();

// 🔒 حماية كل راوتس الـ AI (لازم التوكن)
router.use(authController.protect);

// 📜 جلب كل المحادثات السابقة للمستخدم
router.get('/my-sessions', aiController.getMySessions);

// 🤖 التشخيص (يشمل البداية، الاستكمال، والإنهاء)
router.post('/unified', aiController.unifiedDiagnosis);

module.exports = router;