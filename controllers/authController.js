// 📂 controllers/authController.js

const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../models/userModel'); 
const sendEmail = require('../utils/email'); 

// ================= CONFIGURATION =================
const JWT_SECRET = 'mySuperSecretKey';
const JWT_EXPIRES_IN = '90d';
const JWT_COOKIE_EXPIRES_IN = 90; 

// ✅ إنشاء JWT
const signToken = (id) => {
    return jwt.sign({ id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
};
// ✅ إرسال الـ JWT للمستخدم + الكوكيز
const createSendToken = (user, statusCode, res) => {
    // 💡 تأمين: نقرأ الـ id أو الـ _id تحسباً لأي شكل راجع من الموديل
    const token = signToken(user.id || user._id); 

    const cookieOptions = {
        expires: new Date(
            Date.now() + JWT_COOKIE_EXPIRES_IN * 24 * 60 * 60 * 1000
        ),
        httpOnly: true,
        secure: false 
    };

    res.cookie('jwt', token, cookieOptions);

    // إخفاء الباسورد والبيانات الحساسة من الاستجابة
    const userOutput = { ...user };
    delete userOutput.password;
    delete userOutput.creditCard; 

    // 💡 ضفنا return هنا عشان تقفل الريكويست وتبعت الرد فوراً
    return res.status(statusCode).json({
        status: true,
        token,
        data: { user: userOutput }
    });
};

// ✅ Register
exports.register = async (req, res) => {
    try {
        const newUser = new User(req.body);
        
        // 💡 تأمين احتياطي: لو كلاس الـ User مش بيعمل ID تلقائي، هنعمله إحنا
        if (!newUser.id && !newUser._id) {
            newUser.id = Date.now().toString();
        }

        await newUser.save(); 

        // 🚀 شيلنا الـ setTimeout خالص عشان الريكويست ميتأخرش والفرونت يضرب Timeout
        
        // 💡 إرسال الرد والتأكيد فوراً
        return createSendToken(newUser, 201, res);
        
    } catch (err) {
        return res.status(400).json({
            status: 'fail',
            message: err.message
        });
    }
};

// ✅ Login
exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                status: 'fail',
                message: 'Please provide email and password'
            });
        }

        const userData = User.findByEmail(email);
        
        if (!userData) {
            return res.status(401).json({
                status: 'fail',
                message: 'Incorrect email or password'
            });
        }

        const user = new User(userData);

        if (!(await user.correctPassword(password, user.password))) {
            return res.status(401).json({
                status: 'fail',
                message: 'Incorrect email or password'
            });
        }

        // 💡 إرسال الرد فوراً
        return createSendToken(user, 200, res);
    } catch (err) {
        return res.status(500).json({ status: 'error', message: err.message });
    }
};
// ✅ Logout
exports.logout = (req, res) => {
    res.cookie('jwt', 'loggedout', {
        expires: new Date(Date.now() + 10 * 1000), 
        httpOnly: true
    });
    res.status(200).json({ status: true, message: 'Logged out successfully' });
};

// ✅ Middleware لحماية الروتس
exports.protect = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (!token) {
            return res.status(401).json({ status: 'fail', message: 'You are not logged in!' });
        }

        const decoded = jwt.verify(token, JWT_SECRET);

        const userData = User.findById(decoded.id);
        if (!userData) {
            return res.status(401).json({ status: 'fail', message: 'User no longer exists.' });
        }

        const currentUser = new User(userData);

        if (currentUser.changedPasswordAfter(decoded.iat)) {
            return res.status(401).json({
                status: 'fail',
                message: 'User recently changed password. Please log in again.'
            });
        }

        req.user = currentUser;
        next();
    } catch (err) {
        res.status(401).json({ status: 'fail', message: 'Invalid token or user' });
    }
};

// ✅ Middleware لتحديد الصلاحيات
exports.restrictTo = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                status: 'fail',
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};

// ✅ Forgot Password
exports.forgotPassword = async (req, res) => {
    try {
        const userData = User.findByEmail(req.body.email);
        if (!userData) {
            return res.status(404).json({ status: 'fail', message: 'No user with that email' });
        }

        const user = new User(userData);
        const resetToken = user.createPasswordResetToken();
        await user.save(); 

        const resetURL = `${req.protocol}://${req.get('host')}/api/v1/users/resetPassword/${resetToken}`;
        const message = `You requested a password reset.\nPlease make a PATCH request with your new password to:\n${resetURL}`;

        try {
            await sendEmail({
                email: user.email,
                subject: 'Password Reset (valid for 10 min)',
                message,
            });

            res.status(200).json({
                status: true,
                message: 'Token sent successfully to your email',
            });
        } catch (err) {
            user.passwordResetToken = undefined;
            user.passwordResetExpires = undefined;
            await user.save();

            return res.status(500).json({ status: 'error', message: 'There was an error sending the email. Try again later!' });
        }
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ✅ Reset Password
exports.resetPassword = async (req, res) => {
    try {
        const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

        const allUsers = User.findAll();
        const userData = allUsers.find(u => 
            u.passwordResetToken === hashedToken && 
            u.passwordResetExpires > Date.now()
        );

        if (!userData) {
            return res.status(400).json({ status: 'fail', message: 'Token is invalid or expired' });
        }

        const user = new User(userData);
        
        user.password = req.body.password;
        user.confirmPassword = req.body.confirmPassword;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        
        await user.save();

        createSendToken(user, 200, res);
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ✅ Update Password
exports.updatePassword = async (req, res) => {
    try {
        const user = req.user; 

        if (!(await user.correctPassword(req.body.currentPassword, user.password))) {
            return res.status(401).json({
                status: 'fail',
                message: 'Your current password is wrong'
            });
        }

        user.password = req.body.newPassword;
        user.confirmPassword = req.body.confirmPassword;
        
        await user.save();

        createSendToken(user, 200, res);
    } catch (err) {
        res.status(500).json({
            status: 'error',
            message: err.message
        });
    }
};