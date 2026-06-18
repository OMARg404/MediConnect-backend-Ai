// 📂 server.js
const express = require("express");
const cookieParser = require("cookie-parser"); 
const cors = require("cors"); 
require('dotenv').config(); 
const app = express();
const path = require('path');

// ================= Catch Silent Errors (الرادار) =================
// 💡 الكود ده هيمنع السيرفر يقفل فجأة وهيطبعلك الإيرور اللي بيوقعه
process.on('uncaughtException', (err) => {
  console.error("🔥 Uncaught Exception:", err);
});
process.on('unhandledRejection', (err) => {
  console.error("🔥 Unhandled Rejection:", err);
});

// ================= Middleware =================
app.use(cors()); 

// 💡 رفع الحد الأقصى لـ 50 ميجا عشان يستقبل صور الـ Base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cookieParser()); 

// السماح بعرض الصور المحفوظة في فولدر ai_images
app.use('/api/ai/images', express.static(path.join(__dirname, 'data/ai_images')));

// ================= Routes =================
const entitiesRoutes = require("./routes/entities.routes");
app.use("/api/entities", entitiesRoutes);

const userRoutes = require("./routes/userRoutes");
app.use("/api/users", userRoutes);

const bookingRoutes = require("./routes/bookingRoutes");
app.use("/api/bookings", bookingRoutes);

const paymobRoutes = require("./routes/paymob"); 
app.use("/api/paymob", paymobRoutes);

const aiRoutes = require("./routes/aiRoutes");
app.use("/api/ai", aiRoutes);

// ================= Root =================
app.get("/", (req, res) => {
  res.send("MediConnect API is running 🚀");
});

// ================= Server =================
const PORT = 5050;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server running perfectly on port ${PORT}`);
  // console.log(`🔗 Paymob endpoints available at: http://localhost:${PORT}/api/paymob`);
});

// 💡 تظبيط أوقات السيرفر عشان الذكاء الاصطناعي و Cloudflare
server.timeout = 160000;
server.keepAliveTimeout = 120000; 
server.headersTimeout = 121000;   

// 💡 نبض اصطناعي يجبر السيرفر يفضل شغال وميقفلش نفسه
setInterval(() => {}, 60000);