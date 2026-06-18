const AiSession = require('../models/AiSessionModel');
const axios = require('axios');

// 🚀 البورت اللي ربطنا بيه الدوكر (سيرفر النود بيكلم الدوكر على 5090)
const FASTAPI_BASE_URL = 'http://127.0.0.1:5090'; 

// ================= HELPERS =================
const fetchFastAPI = async (endpoint, body) => {
    try {
        const response = await axios.post(`${FASTAPI_BASE_URL}${endpoint}`, body, {
            headers: { 
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            // ⏱️ مهلة زمنية طويلة (160 ثانية) للسماح للموديل بالاستجابة
            timeout: 160000 
        });
        
        return response.data;

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            throw new Error('AI Assistant service is currently unreachable. Please ensure Docker is running on port 5090.');
        }
        
        const errorMessage = error.response?.data?.detail || error.message;
        throw new Error(`AI Service Error: ${errorMessage}`);
    }
};

// ================= CONTROLLERS =================

// 🤖 التشخيص الموحد (Unified Diagnosis)
exports.unifiedDiagnosis = async (req, res) => {
    try {
        // 1. استخراج الصورة من الـ body (صيغة Base64)
        const { session_id, question, answer, latitude, longitude, image } = req.body;
        const user = req.user; 

        let payload = {};
        let session;

        // 1️⃣ حالة بداية جلسة جديدة
        if (!session_id) {
            if (!question || latitude === undefined || longitude === undefined) {
                return res.status(400).json({ 
                    status: 'fail', 
                    message: 'Question, latitude, and longitude are required for a new session' 
                });
            }

            const medicalContext = `
معلومات المريض (للاعتبار الطبي):
- الاسم: ${user.name || 'غير محدد'}
- العمر: ${user.age || 'غير محدد'}
- الجنس: ${user.gender || 'غير محدد'}
- التاريخ المرضي: ${user.medical_history && user.medical_history.length > 0 ? user.medical_history.join('، ') : 'لا يوجد'}
- الأدوية الحالية: ${user.current_medications && user.current_medications.length > 0 ? user.current_medications.join('، ') : 'لا يوجد'}
- الحساسية: ${user.allergies && user.allergies.length > 0 ? user.allergies.join('، ') : 'لا يوجد'}

سؤال المريض: ${question}
`;
            payload = { 
                question: medicalContext, 
                latitude: parseFloat(latitude), 
                longitude: parseFloat(longitude) 
            };
            
            // إضافة الصورة للـ payload لو المريض بعتها
            if (image) payload.image = image;
            
        } 
        // 2️⃣ حالة استكمال جلسة
        else {
            // المريض لازم يبعت يا إما إجابة (نص) أو صورة، أو الاتنين
            if (!answer && !image) {
                return res.status(400).json({ 
                    status: 'fail', 
                    message: 'Answer or image is required to continue the session' 
                });
            }

            session = await AiSession.findById(session_id);
            if (!session || session.userId.toString() !== user.id.toString()) {
                return res.status(403).json({ status: 'fail', message: 'Session not found or unauthorized' });
            }

            // لو مفيش نص وبعت صورة بس، هنخلي النص فاضي
            payload = { session_id, answer: answer || "" };
            
            // إضافة الصورة للـ payload
            if (image) payload.image = image;
        }

        // إرسال الطلب للـ FastAPI داخل الدوكر
        const aiResponse = await fetchFastAPI('/ai/diagnosis/unified', payload);

        // ================= حفظ الداتا في السجل =================
        if (!session_id) {
            session = new AiSession({
                id: aiResponse.session_id,
                userId: user.id
            });
            // 💡 حفظ السؤال مع الصورة (إن وجدت)
            session.addMessage('user', question, image); 
        } else {
            // 💡 حفظ الاستكمال مع الصورة (إن وجدت)
            session.addMessage('user', answer || "[صورة مرفقة]", image);
        }

        // حفظ رد الدكتور
        if (aiResponse.need_more_questions && aiResponse.next_question) {
            session.addMessage('ai', aiResponse.next_question);
        } 
        else if (!aiResponse.need_more_questions) {
            session.status = 'finalized';
            const finalAiMessage = `
                <div class='final-diagnosis'>
                    ${aiResponse.final_diagnosis}
                    <hr>
                    <h4>التخصص الأنسب لحالتك:</h4>
                    <p><strong>${aiResponse.subType}</strong></p>
                </div>
            `;
            session.addMessage('ai', finalAiMessage);
            
            // 💡 حفظ قائمة الدكاترة/المستشفيات جوه الجلسة
            if (aiResponse.nearby_places && aiResponse.nearby_places.length > 0) {
                session.nearby_places = aiResponse.nearby_places;
            }
        }

        await session.save();

        res.status(200).json({
            status: true,
            data: aiResponse
        });

    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 📜 جلب سجل الشات (History)
exports.getMySessions = async (req, res) => {
    try {
        const sessions = await AiSession.findByUser(req.user.id);
        
        sessions.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

        res.status(200).json({
            status: true,
            results: sessions.length,
            data: { sessions }
        });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};