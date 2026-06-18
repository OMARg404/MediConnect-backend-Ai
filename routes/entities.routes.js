const express = require("express");
const router = express.Router();

const controller = require("../controllers/entitiesController");

// =================== GEO (Nearby with Pagination) ===================
// يرسل أقرب 50 كيان حسب الموقع، مع خيار subType و page للـ Load More
// استقبل: ?lat=<latitude>&lng=<longitude>&subType=<subType>&page=<0,1,2,...>
router.get("/nearby", controller.getNearbyEntities);

// =================== FILTER ===================
// استقبل: ?type=<type>&specialty=<specialty>&governorate=<gov>&area=<area>&is24Hours=<true/false>
router.get("/filter", controller.filterEntities);

// =================== UNIQUE VALUES ===================
// 💡 حطيناها هنا فوق علشان الـ /:id مياكلهاش
// جلب القيم الفريدة للبحث والفلاتر
router.get("/unique-filters", controller.getUniqueFilters);

// // =================== BASIC CRUD ===================
// // إنشاء كيان جديد
// router.post("/", controller.createEntity);

// // جلب كيان بالـ ID
router.get("/:id", controller.getEntityById);

// // تحديث كيان
// router.put("/:id", controller.updateEntity);

// // حذف كيان
// router.delete("/:id", controller.deleteEntity);

module.exports = router;