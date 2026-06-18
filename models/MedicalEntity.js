const slugify = require("slugify");
const ngeohash = require("ngeohash");
const Booking = require("./BookingModel");
const fs = require("fs");
const path = require("path");

const ENTITIES_DIR = path.join(__dirname, "../entities_by_id");

class MedicalEntity {
  constructor(data = {}, sourceFile = null) {
    // ================= TYPE =================
    const detected = this.detectType(sourceFile);
    this.type = data.type || detected.type;
    this.subType = data.subType || detected.subType;
    this.category = data.category || detected.category;

    // ================= ID =================
    this.id = String(data.id || Date.now());

    // ================= NAME =================
    const rawName = data.name || data["\ufeffname"] || Object.values(data)[0];
    this.name = this.clean(rawName) || "no-name";
    this.slug = slugify(this.name, { lower: true, strict: true });

    // ================= SPECIALTIES =================
    this.specialties = this.parseArray(data.specialties);
    this.departments = data.departments || [];

    // ================= ADDRESS =================
    this.listingAddress = this.clean(data.listingAddress);
    this.detailAddress = this.clean(data.detailAddress);
    this.governorate = this.clean(data.governorate);
    this.area = this.clean(data.area);

    this.fullAddress =
      this.clean(data.fullAddress) ||
      `${this.name}, ${this.area || ""}, ${this.governorate || ""}`;

    this.geoAddress = this.clean(data.geoAddress ?? data.geo_address);

    this.displayName =
      this.clean(data.displayName) ||
      `${this.name}${this.area ? " - " + this.area : ""}${
        this.governorate ? " - " + this.governorate : ""
      }`;

    // ================= SEARCH =================
    this.searchText =
      data.searchText ||
      `${this.name} ${this.governorate || ""} ${this.area || ""}`;

    // ================= GEO =================
    const lat = data.newLatitude ?? data.latitude ?? null;
    const lon = data.newLongitude ?? data.longitude ?? null;

    this.latitude =
      lat !== null && lat !== "" ? parseFloat(lat) : null;

    this.longitude =
      lon !== null && lon !== "" ? parseFloat(lon) : null;

    this.geoStatus = this.clean(data.geoStatus ?? data.geo_status);

    this.geoHash =
      this.latitude && this.longitude
        ? ngeohash.encode(this.latitude, this.longitude, 5)
        : null;

    this.location =
      this.latitude && this.longitude
        ? { lat: this.latitude, lng: this.longitude }
        : null;

    // ================= CONTACT =================
    this.phoneNumbers = this.parsePhones(
      data.phoneNumbers ?? data.phones ?? data.phone
    );

    // ================= WORKING HOURS =================
    this.workingHours = this.clean(data.workingHours);
    this.is24Hours = this.detect24Hours(this.workingHours);

    this.openTime = data.openTime || "10:00";
    this.closeTime = data.closeTime || "18:00";
    this.slotDuration = data.slotDuration || 30;

    // ================= DESCRIPTION =================
    this.about = this.cleanLongText(data.about);

    // ================= MEDIA =================
    this.thumbnail =
      this.clean(data.thumbnail) || "default_hospital_thumb.png";

    this.image =
      this.clean(data.image) || "default_hospital_image.png";

    this.detailUrl = this.clean(data.detailUrl);

    // ================= BOOKING =================
    this.bookingEnabled = data.bookingEnabled ?? true;
    this.bookingType = data.bookingType || "clinic";
    this.consultationPrice = data.consultationPrice || 0;

    this.schedule = data.schedule || [];
    this.bookings = data.bookings || [];

    if (!this.schedule.length) {
      this.generateInitialSchedule();
    }

    this.refreshSchedule();

    // ================= REVIEWS =================
    this.reviews = data.reviews || [];
    this.ratingAverage = data.ratingAverage || 0;
    this.ratingQuantity = data.ratingQuantity || 0;

    // ================= MONETIZATION =================
    this.isFeatured = data.isFeatured || false;
    this.featuredUntil = data.featuredUntil || null;
    this.isPremium = data.isPremium || false;
    this.premiumUntil = data.premiumUntil || null;
    this.priorityScore = data.priorityScore || 0;

    // ================= STATUS =================
    this.active = data.active ?? true;

    // ================= META =================
    this.sourceFile = sourceFile;

    // ================= TIMESTAMPS =================
    this.createdAt = data.createdAt
      ? new Date(data.createdAt)
      : new Date();

    this.updatedAt = new Date();
  }

  // ================= SAVE =================
  save() {
    const filePath = path.join(ENTITIES_DIR, `${this.id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(this, null, 2));
  }

  // ================= STATIC =================
  static findById(id) {
    const file = path.join(ENTITIES_DIR, `${id}.json`);
    if (!fs.existsSync(file)) return null;

    return new MedicalEntity(
      JSON.parse(fs.readFileSync(file))
    );
  }

  // ================= BOOK SLOT =================
  bookSlot(user, date, time) {
    this.refreshSchedule();

    // 1. Time Validation: منع الحجز في الماضي
    const bookingDateTime = new Date(`${date}T${time}`);
    if (bookingDateTime < new Date()) {
        throw new Error("Cannot book a slot in the past");
    }

    const day = this.schedule.find(d => d.date === date);
    if (!day) throw new Error("Day not available");

    const slot = day.slots.find(s => s.time === time);
    if (!slot) throw new Error("Time not found");

    if (slot.booked)
      throw new Error("Slot already booked");

    slot.booked = true;

    // 2. Data Minimization: أخذ البيانات الأساسية فقط من المستخدم
    const userDataForBooking = {
        id: user.id,
        name: user.name,
        phone: user.phone || null,
        email: user.email || null
    };

    // إنشاء الحجز (بافتراض إن BookingModel بيدير الحفظ في مكانه)
    const booking = new Booking({
      user: userDataForBooking,
      entity: {
        id: this.id,
        name: this.name,
        type: this.type,
        address: this.fullAddress
      },
      date,
      time,
      price: this.consultationPrice,
      status: "confirmed"
    });

    booking.save();

    // إضافة مرجع للحجز في مصفوفة حجوزات المستشفى
    this.bookings.push({
        id: booking.id,
        userId: user.id,
        userName: user.name,
        date,
        time,
        status: "confirmed"
    });

    // 3. Two-Way Binding: إضافة الحجز لملف المستخدم
    if (typeof user.addBooking === 'function') {
        user.addBooking(booking);
        user.save();
    }

    this.updatedAt = new Date();
    this.save();

    return booking;
  }

  // ================= CANCEL =================
  cancelBooking(bookingId, user) {
    const bookingRef = this.bookings.find(b => b.id === bookingId);
    if (!bookingRef) throw new Error("Booking not found in Entity");

    // التأكد إن اليوزر هو صاحب الحجز (أو أدمن)
    if (user && bookingRef.userId !== user.id && user.role !== 'admin') {
        throw new Error("Unauthorized to cancel this booking");
    }

    bookingRef.status = "cancelled";
    bookingRef.cancelledAt = new Date();

    // تحرير السلوت ليكون متاح مرة أخرى
    const day = this.schedule.find(d => d.date === bookingRef.date);
    if (day) {
      const slot = day.slots.find(s => s.time === bookingRef.time);
      if (slot) slot.booked = false;
    }

    // Two-Way Binding: تحديث حالة الحجز عند المستخدم
    if (user && user.bookings) {
        const userBooking = user.bookings.find(b => b.id === bookingId);
        if (userBooking) {
            userBooking.status = "cancelled";
            user.save();
        }
    }

    // تحديث ملف الحجز الرئيسي (BookingModel)
    const actualBooking = Booking.findById(bookingId);
    if (actualBooking) {
        actualBooking.status = "cancelled";
        actualBooking.save();
    }

    this.updatedAt = new Date();
    this.save();

    return bookingRef;
  }

   // ================= ENABLE BOOKING =================
    enableBooking(type = "clinic", price = 100) {
      this.bookingEnabled = true;
      this.bookingType = type;
      this.consultationPrice = price;
      this.updatedAt = new Date();
      this.save();
    }

  // ================= SCHEDULE =================
  generateInitialSchedule() {
    const days = 7;
    const schedule = [];

    for (let i = 0; i < days; i++) {
      const date = new Date();
      date.setDate(date.getDate() + i);

      schedule.push({
        date: date.toISOString().split("T")[0],
        slots: this.generateSlots(
          this.openTime,
          this.closeTime,
          this.slotDuration
        )
      });
    }

    this.schedule = schedule;
  }

  generateSlots(start, end, duration) {
    const slots = [];
    let current = this.toMinutes(start);
    const endTime = this.toMinutes(end);

    while (current < endTime) {
      slots.push({
        time: this.toTime(current),
        booked: false
      });
      current += duration;
    }

    return slots;
  }

  refreshSchedule() {
    if (!this.schedule.length) return;

    const today = new Date().toISOString().split("T")[0];

    this.schedule = this.schedule.filter(d => d.date >= today);

    while (this.schedule.length < 7) {
      const lastDate = new Date(
        this.schedule[this.schedule.length - 1].date
      );

      lastDate.setDate(lastDate.getDate() + 1);

      this.schedule.push({
        date: lastDate.toISOString().split("T")[0],
        slots: this.generateSlots(
          this.openTime,
          this.closeTime,
          this.slotDuration
        )
      });
    }
  }

  // ================= HELPERS =================
  toMinutes(time) {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
  }

  toTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;

    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  parsePhones(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    if (typeof value === "string")
      return value
        .replace(/[()']/g, "")
        .split(",")
        .map(p => p.trim())
        .filter(Boolean);

    return [];
  }

  parseArray(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;

    if (typeof value === "string")
      return value
        .replace(/[()']/g, "")
        .split("|")
        .map(v => v.trim())
        .filter(Boolean);

    return [];
  }

  detect24Hours(hours) {
    if (!hours) return false;
    return hours.toLowerCase().includes("24");
  }

  clean(value) {
    if (value === undefined || value === null || value === "N/A")
      return null;

    if (typeof value !== "string") return value;

    const v = value.trim();
    return v.length ? v : null;
  }

  cleanLongText(text) {
    if (!text) return null;
    return text.replace(/\s+/g, " ").trim();
  }

  detectType(fileName) {
    if (!fileName)
      return { type: "clinic", subType: null, category: "clinic" };

    const name = fileName.toLowerCase();

    if (name.includes("hospital"))
      return { type: "hospital", subType: "Hospitals", category: "hospital" };

    if (name.includes("pharmacies"))
      return { type: "pharmacy", subType: "Pharmacy", category: "pharmacy" };

    return {
      type: "clinic",
      subType: fileName.replace(".csv", ""),
      category: "clinic"
    };
  }
}

module.exports = MedicalEntity;