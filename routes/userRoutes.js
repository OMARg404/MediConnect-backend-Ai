// 📂 routes/userRoutes.js

const express = require("express");
const router = express.Router();

const userController = require("../controllers/userController");
const authController = require("../controllers/authController");

/* -------------------- ✅ Public Auth Routes -------------------- */

// 🔑 تسجيل مستخدم جديد
router.post("/register", authController.register);

// 🔐 تسجيل دخول
router.post("/login", authController.login);

// 📨 نسيان الباسورد
router.post("/forgotPassword", authController.forgotPassword);

// 🔐 إعادة تعيين الباسورد
router.patch("/resetPassword/:token", authController.resetPassword);

/* -------------------- ✅ Protect All Routes After This -------------------- */
router.use(authController.protect);

/* -------------------- ✅ User Self Routes -------------------- */
// 👤 عرض بياناتي
router.get("/me", userController.getMe);
// 🔑 تحديث الباسورد
router.patch("/updateMyPassword", authController.updatePassword);

// 🧑‍💻 تحديث بياناتي
router.patch("/updateMe", userController.updateMe);

// 🗑️ حذف حسابي
router.delete("/deleteMe", userController.deleteMe);

/* -------------------- ✅ Param Middleware -------------------- */
router.param("id", userController.checkID);

/* -------------------- ✅ Admin Only -------------------- */

// 🧾 كل المستخدمين + إنشاء مستخدم
router
  .route("/")
  .get(authController.restrictTo("admin"), userController.getAllUsers)
  .post(authController.restrictTo("admin"), userController.createUser);

// 🧑‍💻 CRUD على مستخدم معين
router
  .route("/:id")
  .get(authController.restrictTo("admin"), userController.getUserById)
  .patch(authController.restrictTo("admin"), userController.updateUser)
  .delete(authController.restrictTo("admin"), userController.deleteUser);

module.exports = router;