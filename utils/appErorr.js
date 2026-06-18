class AppError extends Error {
    constructor(message, statusCode) {
        super(message); // نمرر الرسالة إلى الكلاس الأساسي Error

        this.statusCode = statusCode;
        this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error'; // 400 → fail, 500 → error
        this.isOperational = true; // علشان نعرف إن الخطأ متوقع ونعامله في middleware

        Error.captureStackTrace(this, this.constructor); // علشان نخلي الستاك ترجع لنقطة الخطأ الحقيقية
    }
}

module.exports = AppError;