# =========================
# Stage 1: Build
# =========================
FROM python:3.11-slim AS builder

WORKDIR /app

# تثبيت أدوات النظام الأساسية للبناء
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# تحديث أدوات Pip
RUN python3 -m pip install --upgrade pip setuptools wheel

# ✅ استبدلنا requests بـ httpx
RUN pip install --no-cache-dir \
    fastapi \
    uvicorn \
    python-dotenv \
    pydantic \
    httpx

# =========================
# Stage 2: Final Image
# =========================
FROM python:3.11-slim

WORKDIR /app

# نسخ المكتبات المسطبة من مرحلة البناء (لتقليل حجم الإيمدج)
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# نسخ ملفات المشروع بالكامل
COPY main.py .
COPY api_keys.json .
COPY sessions.db .
COPY allEntities.json .
COPY .env . 

# البورت الداخلي للكونتينر
EXPOSE 5085

# تشغيل السيرفر
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "5085", "--timeout-keep-alive", "65", "--workers", "1"]