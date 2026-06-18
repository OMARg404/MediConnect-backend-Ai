from typing import Dict, List, Optional, Any
import os
import json
import sqlite3
import logging
import uuid
import re
import math
from pathlib import Path
import asyncio
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import random
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

load_dotenv()

MODEL_NAME = os.getenv("AI_MODEL_NAME", "google/gemma-4-26b-a4b-it")
API_KEYS_FILE = Path(os.getenv("API_KEYS_FILE", "api_keys.json"))
DB_PATH = Path(os.getenv("SESSIONS_DB_PATH", "sessions.db"))
ENTITIES_JSON_PATH = Path(os.getenv("ENTITIES_JSON_PATH", './allEntities.json'))

MAX_STEPS = 4

SUBTYPES: List[str] = [
    "Audiologists and Speech Therapists", "Cardiologists", "Cardiothoracic Surgery",
    "Chest Allergy and Immunology Doctors", "Dermatological Genitourinary Infertility",
    "Doctors and Beauty Centers", "Eye Surgery", "Gastroenterologists and hepatologists",
    "General Surgery", "Gynecologists and Obstetricians", "Hematology and Immunology Doctors",
    "Hospitals", "Immunology and Rheumatology Doctors", "Internal Medicine Physicians",
    "Internal Medicine and Nephrology Doctors", "Laboratory", "Laparoscopic surgery",
    "Medical Centers", "Medical Equipment Companies", "Neurologists", "Neurosurgery",
    "Nutrition and Weight Loss Doctors", "Oncologists", "Ophthalmologists",
    "Orthopedic Surgeons", "Orthopedic surgery", "Otolaryngologists",
    "Pediatric Surgery", "Pediatricians", "Pharmaceutical Companies", "Pharmacies",
    "Psychiatric and Neurological Doctors", "Radiology centers", "Tumor Surgery",
    "Urologists", "Vascular Surgery", "Vascular surgeons", "dental doctors",
    "physical therapy", "plastic surgery", "veterinary",
]

SUBTYPES_EN_TO_AR = {
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
    "veterinary": "طب بيطري",
}

app = FastAPI(title="Medical AI Assistant", version="2.0.0")

# ==================== HELPERS FOR LOCAL JSON SEARCH ====================
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def process_entity_location(e: dict) -> dict:
    try:
        final_lat = float(e["latitude"]) if e.get("latitude") else None
        final_lng = float(e["longitude"]) if e.get("longitude") else None
    except (ValueError, TypeError):
        final_lat = final_lng = None

    is_accurate = False
    new_lat_raw = e.get("newLatitude")
    new_lng_raw = e.get("newLongitude")

    if new_lat_raw and new_lng_raw and final_lat and final_lng:
        try:
            diff_distance = calculate_distance(float(new_lat_raw), float(new_lng_raw), final_lat, final_lng)
            if diff_distance < 10:
                is_accurate = True
        except:
            pass
    elif new_lat_raw and new_lng_raw and not final_lat:
        is_accurate = True

    if is_accurate:
        e["activeLat"] = float(new_lat_raw)
        e["activeLng"] = float(new_lng_raw)
        e["locationAccuracy"] = "accurate"
    elif final_lat and final_lng:
        random_dist = random.random() * 1.0
        random_angle = random.random() * 2 * math.pi
        lat_offset = (random_dist * math.cos(random_angle)) / 111.0
        lng_offset = (random_dist * math.sin(random_angle)) / (111.0 * math.cos(math.radians(final_lat)))
        e["activeLat"] = final_lat + lat_offset
        e["activeLng"] = final_lng + lng_offset
        e["locationAccuracy"] = "approximate"
    else:
        e["activeLat"] = None
        e["activeLng"] = None
        e["locationAccuracy"] = "unknown"

    return e


# ==================== MEMORY CACHING & PRE-PROCESSING ====================
GLOBAL_ENTITIES = []
try:
    if ENTITIES_JSON_PATH.exists():
        with open(ENTITIES_JSON_PATH, 'r', encoding='utf-8') as f:
            raw_entities = json.load(f)

        for e in raw_entities:
            e = process_entity_location(e)
            original_sub = e.get("subType", "")
            e["subTypeAr"] = SUBTYPES_EN_TO_AR.get(original_sub, original_sub)
            GLOBAL_ENTITIES.append(e)

        logger.info(f"Loaded and pre-processed {len(GLOBAL_ENTITIES)} entities into memory.")
    else:
        logger.error(f"Entities file not found at: {ENTITIES_JSON_PATH}")
except Exception as e:
    logger.error(f"Failed to read entities JSON on startup: {e}")


# ==================== RUNTIME FILTERING ====================
def _filter_and_sort_places_sync(lat: float, lng: float, subtype: str, limit: int) -> List[dict]:
    if not GLOBAL_ENTITIES:
        return []

    filtered_entities = []
    search_subtype = subtype.lower().strip() if subtype else ""

    for e in GLOBAL_ENTITIES:
        entity_subtype = str(e.get("subType", "")).lower().strip()
        if not entity_subtype or entity_subtype != search_subtype:
            continue

        if e.get("activeLat") is not None and e.get("activeLng") is not None:
            e_copy = e.copy()
            e_copy["distance"] = calculate_distance(lat, lng, e_copy["activeLat"], e_copy["activeLng"])
            e_copy["subType"] = e_copy.get("subTypeAr", e_copy["subType"])
            filtered_entities.append(e_copy)

    filtered_entities.sort(key=lambda x: x.get("distance", float('inf')))
    return filtered_entities[:limit]


async def get_nearby_places_async(lat: float, lng: float, subtype: str, limit: int = 50) -> List[dict]:
    return await asyncio.to_thread(_filter_and_sort_places_sync, lat, lng, subtype, limit)


# ==================== OPENROUTER KEYS MANAGEMENT ====================
def _load_api_keys_from_file() -> List[Dict[str, object]]:
    if not API_KEYS_FILE.exists():
        return []
    try:
        payload = json.loads(API_KEYS_FILE.read_text(encoding="utf-8"))
        keys = payload.get("api_keys", [])
        return [k for k in keys if isinstance(k, dict) and k.get("is_active") is True]
    except Exception as exc:
        logger.exception("Failed to read keys: %s", exc)
        return []


def _get_all_api_keys() -> List[Dict[str, object]]:
    keys = _load_api_keys_from_file()
    env_key = os.getenv("OPENROUTER_API_KEY")
    if env_key:
        keys.append({"key": env_key, "project_id": "env", "is_active": True})
    return keys


async def openrouter_generate_text_async(prompt: str, images: List[str] = None) -> str:
    keys = _get_all_api_keys()
    if not keys:
        raise HTTPException(status_code=500, detail="No OpenRouter API keys found.")

    message_content = [{"type": "text", "text": prompt}]

    if images:
        for img in images:
            if not img.startswith("data:image"):
                img = f"data:image/jpeg;base64,{img}"
            message_content.append({
                "type": "image_url",
                "image_url": {"url": img}
            })

    last_exc = None
    async with httpx.AsyncClient(timeout=120.0) as client:
        for item in keys:
            key = item.get("key")
            if not isinstance(key, str) or not key.strip():
                continue

            try:
                response = await client.post(
                    url="https://openrouter.ai/api/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "HTTP-Referer": "https://localhost",
                        "X-Title": "Medical AI Assistant",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": MODEL_NAME,
                        "messages": [{"role": "user", "content": message_content}]
                    }
                )
                response.raise_for_status()
                response_data = response.json()
                return response_data["choices"][0]["message"]["content"].strip()

            except Exception as exc:
                last_exc = exc
                continue

    logger.exception("All OpenRouter keys failed. Last error: %s", last_exc)
    raise HTTPException(status_code=502, detail=f"Error calling OpenRouter: {last_exc}")


# ==================== DATABASE SETUP ====================
def _get_connection() -> sqlite3.Connection:
    return sqlite3.connect(DB_PATH, check_same_thread=False)


def _init_db() -> None:
    with _get_connection() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                data TEXT NOT NULL
            )
        """)


_init_db()


def _generate_session_id() -> str:
    return str(uuid.uuid4())


# ==================== MODELS ====================
class Session(BaseModel):
    question: str
    latitude: float
    longitude: float
    steps: int = 0
    conversation: List[dict] = []
    final_diagnosis: Optional[str] = None
    subType: Optional[str] = None


class DiagnosisRequest(BaseModel):
    session_id: Optional[str] = None
    question: Optional[str] = None
    answer: Optional[str] = None
    image: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class DiagnosisResponse(BaseModel):
    session_id: str
    current_step: int
    max_steps: int
    need_more_questions: bool
    next_question: Optional[str] = None
    final_diagnosis: Optional[str] = None
    subType: Optional[str] = None
    subTypeAr: Optional[str] = None
    nearby_places: Optional[List[dict]] = None
    debug_info: Optional[str] = None


# ==================== DB HELPERS ====================
def save_session(session_id: str, session: Session) -> None:
    with _get_connection() as conn:
        conn.execute(
            "INSERT INTO sessions (id, data) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET data=excluded.data",
            (session_id, session.model_dump_json())
        )


def load_session(session_id: str) -> Optional[Session]:
    with _get_connection() as conn:
        cur = conn.cursor()
        cur.execute("SELECT data FROM sessions WHERE id = ?", (session_id,))
        row = cur.fetchone()
        if row:
            return Session.model_validate_json(row[0])
    return None


# ==================== SUBTYPE VALIDATION ====================
def _normalize_subtype(raw: str) -> Optional[str]:
    """
    بيتحقق إن الـ subType المجاء من الـ AI موجود في القائمة الرسمية.
    بيرجع الاسم الصح لو لقاه، وإلا بيرجع None.
    """
    if not raw:
        return None

    raw_stripped = raw.strip().strip('"').strip("'")

    # مطابقة تامة (case-insensitive)
    for s in SUBTYPES:
        if s.lower() == raw_stripped.lower():
            return s

    # مطابقة جزئية كـ fallback أخير
    raw_lower = raw_stripped.lower()
    for s in SUBTYPES:
        if raw_lower in s.lower() or s.lower() in raw_lower:
            return s

    return None


async def _force_classify_subtype(session: Session) -> Optional[str]:
    """
    لو الـ AI مجبش subType صح أو مجبوش خالص،
    بنسأله مرة تانية بـ prompt مبسط ومركز.
    لو فشل تاني بيرجع None (مش باطنة hardcoded).
    """
    # بنجمع كل المحادثة عشان نديها للـ AI للتصنيف
    history_parts = [f"الشكوى الأساسية: {session.question}"]
    for turn in session.conversation[1:]:
        role = "المريض" if turn.get("role") == "patient" else "الدكتور"
        if turn.get("content"):
            history_parts.append(f"{role}: {turn.get('content')}")
    full_history = "\n".join(history_parts)

    prompt = f"""بناءً على هذه المحادثة الطبية:
{full_history}

اختر التخصص الطبي الأنسب من هذه القائمة فقط، واكتب الاسم بالضبط كما هو مكتوب في القائمة:
{SUBTYPES}

⚠️ مهم جداً: اكتب اسم التخصص فقط بدون أي كلام إضافي أو علامات تنصيص."""

    try:
        result = await openrouter_generate_text_async(prompt)
        validated = _normalize_subtype(result)
        if validated:
            logger.info(f"Force classification succeeded: '{validated}'")
            return validated
        else:
            logger.warning(f"Force classification returned unrecognized value: '{result}'")
            return None
    except Exception as exc:
        logger.error(f"Force classification failed with error: {exc}")
        return None


# ==================== AI LOGIC ====================
async def call_ai_for_next_step(session: Session) -> dict:
    step = session.steps

    system_instructions = f"""
        أنت "المساعد الطبي الذكي" (Smart Medical Assistant) الخاص بمنصة MediConnect. 
        🎯 هدفك: توفير تقييم طبي أولي موثوق، تحليل أعراض المريض (والصور إن وجدت) بناءً على ملفه الطبي، وتوجيهه للتخصص المناسب بدقة.

        📌 القواعد الذهبية للتعامل:
        1. **الشخصية والاحترافية:** تحدث بلهجة مصرية مبسطة وراقية ومفهومة. كن مهنياً، هادئاً، ومطمئناً (تجنب تماماً التودد المبالغ فيه أو المصطلحات الشعبية الزائدة). أنت مساعد آلي ذكي ومحترف، تقدم نصيحة طبية موثوقة.
        2. **التخصيص:** استخدم اسم المريض الموجود في البيانات بشكل طبيعي في ردك لتشعره بالاهتمام الطبي الشخصي.
        3. **التحليل الطبي:** اربط دائماً بين شكوى المريض الحالية وبين عمره، جنسه، وتاريخه المرضي. إذا أرفق صورة (روشتة، تحليل، أشعة، إصابة)، قم بتحليلها علمياً واربطها بالأعراض.
        4. **المنهجية والتركيز:** اطرح سؤالاً واحداً فقط في كل مرة لتحديد المشكلة بدقة ولتجنب تشتيت المريض.
        5. **التوجيه الدقيق:** عند انتهاء التقييم للوصول لتشخيص مبدئي، يجب أن تختار تخصصاً واحداً فقط من هذه القائمة بالحرف الواحد: {SUBTYPES}
        
        🎨 قواعد التنسيق (HTML & CSS):
        - يجب تنسيق النص الموجه للمريض في حقل "next_question" و "final_diagnosis" باستخدام وسوم HTML مع (Inline CSS) ليظهر بشكل جميل ومقروء على خلفية التطبيق الرمادية.
        - ⚠️ هام جداً لسلامة الـ JSON: استخدم علامات التنصيص المفردة (') فقط داخل أي وسم HTML أو CSS (مثال: <span style='color: #1a73e8;'>).
        
        ✨ باليتة الألوان والتظليل (Color Palette & Highlights):
        - **النص العادي:** استخدم لون رمادي داكن مائل للأزرق ليكون مريحاً (مثال: <p style='color: #2c3e50; line-height: 1.6;'>).
        - **العناوين والترحيب:** استخدم لون "أزرق طبي" يبعث على الثقة (مثال: <h3 style='color: #1a73e8; border-bottom: 2px solid #e3e8ee; padding-bottom: 5px;'>).
        - **الكلمات المهمة (الأعراض، أسماء الأدوية):** استخدم لون خلفية خفيف مع نص بارز (مثال: <span style='background-color: #e3f2fd; color: #0d47a1; padding: 2px 6px; border-radius: 4px; font-weight: bold;'>الكلمة</span>).
        - **التحذيرات (إن وجدت):** لو فيه عرض يحتاج انتباه، استخدم لون أحمر هادئ للفت الانتباه بلطف (مثال: <strong style='color: #d32f2f;'>تنبيه:</strong>).
        - **النصائح والاطمئنان:** استخدم لون أخضر مريح (مثال: <span style='color: #2e7d32; font-weight: bold;'>اطمئن</span>).
        
        🚨 تنبيه هاااام جداً (إجباري):
        ممنوع كتابة أي حرف أو ترحيب خارج كائن الـ JSON.
        صيغة الرد يجب أن تبدأ بـ {{ وتنتهي بـ }} فقط:
        {{
        "need_more_questions": true أو false,
        "next_question": "نص الترحيب والسؤال منسق بأكواد HTML والألوان هنا" أو null,
        "final_diagnosis": "نص التشخيص المبدئي والنصيحة منسق بأكواد HTML والألوان هنا" أو null,
        "subType": "التخصص بالضبط من القائمة" أو null
        }}
    """

    history_text_parts = [f"سؤال المريض الأساسي (شامل ملفه الطبي): {session.question}"]
    session_images = []

    for turn in session.conversation:
        if turn.get("image"):
            session_images.append(turn["image"])

    for turn in session.conversation[1:]:
        role = "إجابة المريض" if turn.get("role") == "patient" else "رد الدكتور"
        content_text = turn.get('content', '')
        if turn.get("image"):
            content_text += " [تم إرفاق صورة مع هذه الرسالة]"
        history_text_parts.append(f"{role}: {content_text}")

    history_text = "\n".join(history_text_parts)
    prompt = f"{system_instructions}\n\nتاريخ المحادثة:\n{history_text}\nعدد الأسئلة حتى الآن: {step}"

    text = await openrouter_generate_text_async(prompt, session_images)

    # تنظيف الـ Markdown لو الموديل استخدمه
    clean_text = text.strip()
    if clean_text.startswith("```json"):
        clean_text = clean_text[7:]
    elif clean_text.startswith("```"):
        clean_text = clean_text[3:]
    if clean_text.endswith("```"):
        clean_text = clean_text[:-3]
    clean_text = clean_text.strip()

    json_match = re.search(r'\{.*\}', clean_text, re.DOTALL)
    if not json_match:
        logger.error(f"AI returned non-JSON response: {text}")
        raise HTTPException(status_code=502, detail="لم يقم الذكاء الاصطناعي بإرجاع صيغة JSON صحيحة.")

    clean_json_string = json_match.group(0)

    try:
        parsed = json.loads(clean_json_string)
    except json.JSONDecodeError as exc:
        raise HTTPException(status_code=502, detail=f"AI response could not be parsed as JSON: {clean_json_string}") from exc

    need_more = bool(parsed.get("need_more_questions"))

    # ✅ التحقق من صحة الـ subType اللي رجعه الـ AI
    raw_subtype = parsed.get("subType")
    validated_subtype = _normalize_subtype(raw_subtype) if raw_subtype else None
    parsed["subType"] = validated_subtype  # هيبقى None لو مش صح

    if step >= MAX_STEPS:
        need_more = False
        if not parsed.get("final_diagnosis"):
            parsed["final_diagnosis"] = "<h3 style='color: #1a73e8;'>تقييم طبي مبدئي</h3><p style='color: #2c3e50; line-height: 1.6;'>بناءً على المعلومات المتاحة، يُنصح بمراجعة طبيب متخصص لإجراء الفحص اللازم والحصول على التشخيص الدقيق.</p>"

    parsed["need_more_questions"] = need_more
    return parsed


# ==================== UNIFIED ENDPOINT ====================
@app.post("/ai/diagnosis/unified", response_model=DiagnosisResponse)
async def unified_diagnosis_endpoint(body: DiagnosisRequest):
    # 1️⃣ بدء جلسة جديدة
    if not body.session_id:
        if not body.question or body.latitude is None or body.longitude is None:
            raise HTTPException(status_code=400, detail="Missing required fields to start a session.")
        session_id = _generate_session_id()

        first_turn = {"role": "patient", "content": body.question}
        if body.image:
            first_turn["image"] = body.image

        session = Session(
            question=body.question,
            latitude=body.latitude,
            longitude=body.longitude,
            steps=1,
            conversation=[first_turn],
        )
    # 2️⃣ استكمال جلسة موجودة
    else:
        session_id = body.session_id
        session = load_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        if body.answer or body.image:
            turn = {"role": "patient", "content": body.answer or ""}
            if body.image:
                turn["image"] = body.image
            session.conversation.append(turn)
            session.steps += 1

    ai_response = await call_ai_for_next_step(session)

    # لو لسه محتاج أسئلة، ارجع السؤال الجاي
    if ai_response.get("need_more_questions") and ai_response.get("next_question"):
        session.conversation.append({"role": "ai", "content": ai_response.get("next_question")})
        save_session(session_id, session)

        return DiagnosisResponse(
            session_id=session_id,
            current_step=session.steps,
            max_steps=MAX_STEPS,
            need_more_questions=True,
            next_question=ai_response.get("next_question")
        )

    # ==================== معالجة النهاية ====================
    session.final_diagnosis = ai_response.get("final_diagnosis")
    session.subType = ai_response.get("subType")  # ممكن يكون None لو الـ AI مجبش حاجة صح

    # ✅ لو الـ subType لسه None، نعمل محاولة تصنيف تانية مستقلة
    if not session.subType:
        logger.warning(f"[Session {session_id}] subType is None after AI response. Attempting force classification...")
        session.subType = await _force_classify_subtype(session)

    save_session(session_id, session)

    # ==================== جلب الأماكن القريبة ====================
    nearby_places = []
    debug_msg = ""

    if session.subType:
        # عندنا تخصص صح — نجيب الأماكن القريبة
        try:
            nearby_places = await get_nearby_places_async(
                lat=session.latitude,
                lng=session.longitude,
                subtype=session.subType
            )
            if nearby_places:
                debug_msg = f"Successfully fetched {len(nearby_places)} places for subType '{session.subType}'."
            else:
                debug_msg = f"No places found for subType '{session.subType}' near the user's location."
        except Exception as e:
            debug_msg = f"Failed to fetch places: {str(e)}"
            logger.error(debug_msg)
    else:
        # مجبناش تخصص حتى بعد المحاولة التانية — بنكمل بدون أماكن
        debug_msg = "Could not determine a specific subType. Returning diagnosis without nearby places."
        logger.warning(f"[Session {session_id}] {debug_msg}")

    # ==================== تجهيز الرد النهائي ====================
    sub_type_ar = SUBTYPES_EN_TO_AR.get(session.subType, session.subType) if session.subType else None

    return DiagnosisResponse(
        session_id=session_id,
        current_step=session.steps,
        max_steps=MAX_STEPS,
        need_more_questions=False,
        final_diagnosis=session.final_diagnosis,
        subType=sub_type_ar,
        nearby_places=nearby_places if nearby_places else None,
        debug_info=debug_msg
    )