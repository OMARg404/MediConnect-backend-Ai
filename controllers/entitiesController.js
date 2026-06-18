const fs = require("fs");
const path = require("path");
const MedicalEntity = require("../models/MedicalEntity"); // تأكد من مسار الموديل

const ENTITIES_DIR = path.join(__dirname, "../entities_by_id");
// ================= MAPPING =================

// قاموس للتحويل من إنجليزي لعربي (عشان نعرضه لليوزر في الفلاتر)
const subTypesEnToAr = {
    "Audiologists and Speech Therapists": "أطباء السمع والتخاطب",
    "Cardiologists": "أطباء القلب",
    "Cardiothoracic Surgery": "جراحة القلب والصدر",
    "Chest Allergy and Immunology Doctors": "أطباء الحساسية والمناعة الصدرية",
    "Dermatological Genitourinary Infertility": "أمراض جلدية وتناسلية وعقم",
    "Doctors and Beauty Centers": "أطباء ومراكز تجميل",
    "Eye Surgery": "جراحة العيون",
    "Gastroenterologists and hepatologists": "أطباء الجهاز الهضمي والكبد",
    "General Surgery": "الجراحة العامة",
    "Gynecologists and Obstetricians": "أطباء النساء والتوليد",
    "Hematology and Immunology Doctors": "أطباء أمراض الدم والمناعة",
    "Hospitals": "مستشفيات",
    "Immunology and Rheumatology Doctors": "أطباء المناعة والروماتيزم",
    "Internal Medicine Physicians": "أطباء الباطنة",
    "Internal Medicine and Nephrology Doctors": "أطباء الباطنة والكلى",
    "Laboratory": "معامل تحاليل",
    "Laparoscopic surgery": "جراحة المناظير",
    "Medical Centers": "مراكز طبية",
    "Medical Equipment Companies": "شركات الأجهزة الطبية",
    "Neurologists": "أطباء الأعصاب",
    "Neurosurgery": "جراحة المخ والأعصاب",
    "Nutrition and Weight Loss Doctors": "أطباء التغذية والتخسيس",
    "Oncologists": "أطباء الأورام",
    "Ophthalmologists": "أطباء العيون",
    "Orthopedic Surgeons": "أطباء العظام",
    "Orthopedic surgery": "جراحة العظام",
    "Otolaryngologists": "أطباء الأنف والأذن والحنجرة",
    "Pediatric Surgery": "جراحة الأطفال",
    "Pediatricians": "أطباء الأطفال",
    "Pharmaceutical Companies": "شركات الأدوية",
    "Pharmacies": "صيدليات",
    "Psychiatric and Neurological Doctors": "أطباء الطب النفسي والأعصاب",
    "Radiology centers": "مراكز الأشعة",
    "Tumor Surgery": "جراحة الأورام",
    "Urologists": "أطباء المسالك البولية",
    "Vascular Surgery": "جراحة الأوعية الدموية",
    "Vascular surgeons": "جراحو الأوعية الدموية",
    "dental doctors": "أطباء الأسنان",
    "physical therapy": "العلاج الطبيعي",
    "plastic surgery": "جراحة التجميل",
    "veterinary": "طب بيطري"
};

// قاموس للتحويل من عربي لإنجليزي (عشان ندور بيه في الداتا)
// الكود ده بيعكس القاموس اللي فوق أوتوماتيك
const subTypesArToEn = Object.fromEntries(
    Object.entries(subTypesEnToAr).map(([en, ar]) => [ar, en])
);
// ================= HELPERS =================

// 1. دالة لحساب المسافة بين نقطتين
const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; 
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; 
};

// 2. دالة لجلب كل الكيانات
const getAllEntities = () => {
    if (!fs.existsSync(ENTITIES_DIR)) return [];
    
    const files = fs.readdirSync(ENTITIES_DIR);
    const entities = [];

    files.forEach((file) => {
        if (file.endsWith(".json")) {
            const filePath = path.join(ENTITIES_DIR, file);
            const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
            entities.push(data);
        }
    });

    return entities;
};

// 🌟 3. دالة لتنظيف وتوحيد أي نص
const normalizeText = (text) => {
    if (!text) return "";
    return String(text).replace(/\+/g, ' ').toLowerCase().trim();
};
// 🔥 4. دالة لتوحيد معالجة الإحداثيات وترجمة الداتا قبل إرسالها لليوزر
const processEntityLocation = (doc) => {
    // 🆕 تحويل الداتا لـ Object عادي عشان لو جاية من Mongoose نقدر نعدل عليها بحرية
    const e = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };

    let finalLat = e.latitude ? parseFloat(e.latitude) : null;
    let finalLng = e.longitude ? parseFloat(e.longitude) : null;
    let isAccurate = false;

    if (e.newLatitude && e.newLongitude && finalLat && finalLng) {
        const diffDistance = calculateDistance(
            parseFloat(e.newLatitude), parseFloat(e.newLongitude), finalLat, finalLng
        );
        if (diffDistance < 10) isAccurate = true;
    } else if (e.newLatitude && e.newLongitude && !finalLat) {
        isAccurate = true;
    }

    if (isAccurate) {
        finalLat = parseFloat(e.newLatitude);
        finalLng = parseFloat(e.newLongitude);
        e.locationAccuracy = "accurate";
    } else if (finalLat && finalLng) {
        const randomDist = Math.random() * 1; 
        const randomAngle = Math.random() * 2 * Math.PI; 
        const latOffset = (randomDist * Math.cos(randomAngle)) / 111.0;
        const lngOffset = (randomDist * Math.sin(randomAngle)) / (111.0 * Math.cos(finalLat * (Math.PI / 180)));
        
        finalLat += latOffset;
        finalLng += lngOffset;
        e.locationAccuracy = "approximate";
    }

    e.activeLat = finalLat;
    e.activeLng = finalLng;

    // 🌟 🆕 إضافة الترجمة العربية 🌟
    if (e.subType) {
        // بنعمل حقل جديد إضافي اسمه subTypeAr عشان لو احتجت الإنجليزي في الفرونت إند
        e.subTypeAr = subTypesEnToAr[e.subType] || e.subType;
        
        // هنا بنستبدل القيمة الأصلية بالعربي عشان اليوزر يشوفها جاهزة دايماً
        e.subType = subTypesEnToAr[e.subType] || e.subType; 
    }

    return e;
};


// ================= CONTROLLERS =================
// 🏷️ جلب القيم الفريدة
exports.getUniqueFilters = (req, res) => {
    try {
        const entities = getAllEntities();
        
        const uniqueSubTypesEn = [...new Set(entities.map(e => e.subType ? e.subType.trim() : null).filter(Boolean))].sort();
        
        // 🆕 تحويل الأقسام للعربي قبل إرسالها لليوزر
        const uniqueSubTypesAr = uniqueSubTypesEn.map(en => subTypesEnToAr[en] || en);

        const uniqueGovernorates = [...new Set(entities.map(e => e.governorate ? e.governorate.trim() : null).filter(Boolean))].sort();
        const uniqueAreas = [...new Set(entities.map(e => e.area ? e.area.trim() : null).filter(Boolean))].sort();

        res.status(200).json({
            status: true,
            data: { subTypes: uniqueSubTypesAr, governorates: uniqueGovernorates, areas: uniqueAreas } // 🆕 استخدام الأري العربي
        });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
};

// 📍 جلب الأقرب (Nearby)
exports.getNearbyEntities = (req, res) => {
    try {
        const { lat, lng, subType, page = 0 } = req.query;
        const limit = 50;
        const offset = parseInt(page) * limit;

        if (!lat || !lng) {
            return res.status(400).json({ status: "fail", message: "Latitude (lat) and Longitude (lng) are required" });
        }

        let entities = getAllEntities();

       if (subType) {
            // 🆕 تحويل الكلمة العربي اللي جاية من اليوزر للإنجليزي عشان تطابق الداتا
            const enSubType = subTypesArToEn[subType.trim()] || subType.trim();
            const searchSubType = normalizeText(enSubType);
            entities = entities.filter(e => normalizeText(e.subType) === searchSubType);
        }

        // 🔥 تطبيق سلسلة الإحداثيات والمسافة والترتيب
        const nearbyEntities = entities
            .map(processEntityLocation)
            .filter(e => e.activeLat && e.activeLng) 
            .map(e => {
                e.distance = calculateDistance(parseFloat(lat), parseFloat(lng), e.activeLat, e.activeLng);
                return e;
            })
            .sort((a, b) => a.distance - b.distance); 

        const total = nearbyEntities.length;
        const paginatedEntities = nearbyEntities.slice(offset, offset + limit);

        res.status(200).json({
            status: true,
            results: paginatedEntities.length,
            totalResults: total,
            currentPage: parseInt(page),
            data: paginatedEntities
        });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
};

// 🔍 فلترة الكيانات 
exports.filterEntities = (req, res) => {
    try {
        // ضفنا lat و lng هنا علشان لو اليوزر عايز يفلتر ويرتب بالمسافة في نفس الوقت
        const { subType, governorate, area, is24Hours, lat, lng, page = 0 } = req.query;
        const limit = 50;
        const offset = parseInt(page) * limit;

        let entities = getAllEntities();

        if (governorate) {
            const searchGov = normalizeText(governorate);
            entities = entities.filter(e => normalizeText(e.governorate) === searchGov);
        }
        
        if (area) {
            const searchArea = normalizeText(area);
            entities = entities.filter(e => normalizeText(e.area) === searchArea);
        }

       if (subType) {
            // 🆕 تحويل الكلمة العربي للإنجليزي للبحث في الداتا
            const enSubType = subTypesArToEn[subType.trim()] || subType.trim();
            const searchSubType = normalizeText(enSubType);
            entities = entities.filter(e => normalizeText(e.subType) === searchSubType);
        }
        
        if (is24Hours !== undefined) {
            const check24 = is24Hours === 'true';
            entities = entities.filter(e => e.is24Hours === check24);
        }

        // 🔥 تطبيق نفس سلسلة الإحداثيات بالظبط
        let processedEntities = entities.map(processEntityLocation);

        // لو اليوزر باعت lat و lng، نحسب المسافة ونرتب، غير كده نكتفي بتوحيد الإحداثيات بس
        if (lat && lng) {
            processedEntities = processedEntities
                .filter(e => e.activeLat && e.activeLng)
                .map(e => {
                    e.distance = calculateDistance(parseFloat(lat), parseFloat(lng), e.activeLat, e.activeLng);
                    return e;
                })
                .sort((a, b) => a.distance - b.distance);
        }

        const total = processedEntities.length;
        const paginatedEntities = processedEntities.slice(offset, offset + limit);

        res.status(200).json({
            status: true,
            results: paginatedEntities.length,
            totalResults: total,
            currentPage: parseInt(page),
            data: paginatedEntities
        });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
};

// ➕ إنشاء كيان جديد
exports.createEntity = (req, res) => {
    try {
        if (req.body.governorate) req.body.governorate = req.body.governorate.trim();
        if (req.body.area) req.body.area = req.body.area.trim();
        if (req.body.subType) req.body.subType = req.body.subType.trim();

        const newEntity = new MedicalEntity(req.body);
        newEntity.save(); 

        res.status(201).json({
            status: true,
            data: processEntityLocation(newEntity) 
        });
    } catch (err) {
        res.status(400).json({ status: "fail", message: err.message });
    }
};

// 📄 جلب كيان واحد بالـ ID
exports.getEntityById = (req, res) => {
    try {
        const entity = MedicalEntity.findById(req.params.id);

        if (!entity) {
            return res.status(404).json({ status: "fail", message: "Entity not found" });
        }

        res.status(200).json({
            status: true,
            data: processEntityLocation(entity) 
        });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
};

// ✏️ تحديث كيان
exports.updateEntity = (req, res) => {
    try {
        let entity = MedicalEntity.findById(req.params.id);

        if (!entity) {
            return res.status(404).json({ status: "fail", message: "Entity not found" });
        }

        Object.keys(req.body).forEach(key => {
            if (typeof req.body[key] === 'string') {
                entity[key] = req.body[key].trim();
            } else {
                entity[key] = req.body[key];
            }
        });

        entity.updatedAt = new Date();
        entity.save(); 

        res.status(200).json({
            status: true,
            data: processEntityLocation(entity) 
        });
    } catch (err) {
        res.status(400).json({ status: "fail", message: err.message });
    }
};

// ❌ حذف كيان
exports.deleteEntity = (req, res) => {
    try {
        const filePath = path.join(ENTITIES_DIR, `${req.params.id}.json`);

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ status: "fail", message: "Entity not found" });
        }

        fs.unlinkSync(filePath);

        res.status(204).json({
            status: true,
            data: null
        });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
};