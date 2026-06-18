## Medical AI Assistant Backend (Python + FastAPI)

This project exposes AI endpoints that:

- Take a patient's question and location (latitude, longitude).
- Conduct up to **5 questions** of follow-up conversation using **Gemini Flash**.
- Produce an initial (non-final) medical diagnosis and select the most appropriate **subType** (medical specialty).
- Call your existing **nearby entities API** to fetch the nearest suitable place (clinic, hospital, etc.) for the patient.

---

### 1. Requirements

- Python 3.10+
- A valid **Gemini API key**
- Internet access (to call Gemini and the `nearby` entities API).

---

### 2. Setup

From the project root (same folder as `main.py` and `requirements.txt`):

```bash
pip install -r requirements.txt
```

Configure your Gemini API key:

```bash
copy .env.example .env   # on Windows (PowerShell: cp .env.example .env)
```

Then edit `.env` and set:

```bash
GEMINI_API_KEY=your_real_key_here
```

Alternatively, you can set `GEMINI_API_KEY` directly in your environment instead of using `.env`.

---

### 3. Run the server

```bash
uvicorn main:app --reload
```

The API will be available at:

- `http://localhost:8000`
- Swagger docs at `http://localhost:8000/docs`

---

### 4. Main Endpoints

#### `POST /ai/diagnosis/start`

Start a new diagnosis session.

**Body:**

```json
{
  "question": "بحس بألم في صدري مع مجهود بسيط وبنهج بسرعة",
  "latitude": 30.0444,
  "longitude": 31.2357
}
```

**Response (example):**

```json
{
  "session_id": "abc123",
  "current_step": 1,
  "max_steps": 5,
  "need_more_questions": true,
  "next_question": "من فضلك وضّح مكان الألم بالظبط فين في صدرك؟"
}
```

---

#### `POST /ai/diagnosis/continue`

Send the patient's answer and receive either:

- The next question, or
- The final diagnosis + selected `subType`.

**Body:**

```json
{
  "session_id": "abc123",
  "answer": "الألم ناحية الشمال وبيزيد مع المجهود"
}
```

**Response (example – more questions needed):**

```json
{
  "session_id": "abc123",
  "current_step": 2,
  "max_steps": 5,
  "need_more_questions": true,
  "next_question": "هل يصاحب الألم ضيق في التنفس أو تعرّق شديد؟"
}
```

**Response (example – final diagnosis):**

```json
{
  "session_id": "abc123",
  "current_step": 4,
  "max_steps": 5,
  "need_more_questions": false,
  "final_diagnosis": "الأعراض تشير لاحتمال وجود مشكلة في شرايين القلب مثل الذبحة الصدرية...",
  "subType": "Cardiologists"
}
```

---

#### `POST /ai/diagnosis/finalize`

Use after you have a final diagnosis and `subType`. It returns both:

- The stored diagnosis.
- The nearest medical place using your existing `nearby` API.

**Body:**

```json
{
  "session_id": "abc123"
}
```

**Response (example):**

```json
{
  "session_id": "abc123",
  "diagnosis": "الأعراض تشير لاحتمال وجود مشكلة في شرايين القلب مثل الذبحة الصدرية...",
  "subType": "Cardiologists",
  "nearest_place": {
    "id": "594",
    "type": "clinic",
    "subType": "Cardiologists",
    "name": "مركز الصفا",
    "listingAddress": "30 ش حيدر, حلوان, القاهرة",
    "detailAddress": "30 ش حيدر, حلوان, القاهرة حلوان القاهرة",
    "governorate": "القاهرة",
    "area": "حلوان",
    "phoneNumbers": ["0229733299"],
    "detailUrl": "https://healtheg.com/ar/Item/594/مركز-الصفا",
    "latitude": "29.8500001",
    "longitude": "31.333333",
    "fullAddress": "مركز الصفا, حلوان, القاهرة, Egypt",
    "displayName": "مركز الصفا - حلوان - القاهرة"
  }
}
```