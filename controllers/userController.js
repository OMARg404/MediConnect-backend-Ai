const fs = require('fs');
const path = require('path');
const User = require('../models/userModel'); 

// ================= PATHS FOR DELETION =================
const USERS_FILE = path.join(__dirname, '../data/users.json');
const USERS_BY_ID_DIR = path.join(__dirname, '../data/users_by_id');

// ================= HELPER FUNCTION =================
const deleteUserFromFiles = (id) => {
    if (fs.existsSync(USERS_FILE)) {
        const users = JSON.parse(fs.readFileSync(USERS_FILE));
        const filteredUsers = users.filter(u => u.id !== id);
        fs.writeFileSync(USERS_FILE, JSON.stringify(filteredUsers, null, 2));
    }

    const userFile = path.join(USERS_BY_ID_DIR, `${id}.json`);
    if (fs.existsSync(userFile)) {
        fs.unlinkSync(userFile);
    }
};

// ================= CONTROLLERS =================

// ✅ Middleware to check if the user exists and attach it to req.targetUser
exports.checkID = async (req, res, next, id) => {
    try {
        const userData = User.findById(id); 
        
        if (!userData) {
            console.log(`User with id ${id} not found 🙄`);
            return res.status(404).json({ message: 'User not found' });
        }
        
        console.log(`User ID is: 🌟 ${id}`);
        // 💡 استخدام targetUser بدل user لمنع التداخل مع الـ Admin 
        req.targetUser = new User(userData); 
        next();
    } catch (err) {
        return res.status(400).json({ status: 'fail', message: 'Invalid ID' });
    }
};

// ✅ Get All Users
exports.getAllUsers = async (req, res) => {
    try {
        const users = User.findAll();
        res.status(200).json({ status: true, results: users.length, data: { users } });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// ✅ Get User by ID (Admin)
exports.getUserById = async (req, res) => {
    // 💡 بنعرض البيانات من targetUser
    res.status(200).json({ status: true, data: { user: req.targetUser } });
};

// ✅ Create User (Admin)
exports.createUser = async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save(); 
        
        res.status(201).json({ status: true, data: { user } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

// ✅ Update User (Admin)
exports.updateUser = async (req, res) => {
    try {
        const user = req.targetUser;

        Object.keys(req.body).forEach(key => {
            user[key] = req.body[key];
        });

        await user.save(); 

        res.status(200).json({ status: true, data: { user } });
    } catch (err) {
        res.status(400).json({ status: 'fail', message: err.message });
    }
};

// ✅ Delete User (Admin)
exports.deleteUser = async (req, res) => {
    try {
        deleteUserFromFiles(req.targetUser.id);
        
        res.status(204).send(); 
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
};

// 👤 عرض بياناتي (View My Profile)
exports.getMe = (req, res) => {
    // req.user جاية جاهزة من الـ protect middleware
    const userOutput = { ...req.user };
    
    // إخفاء البيانات الحساسة
    delete userOutput.password;
    
    res.status(200).json({
        status: true,
        data: { user: userOutput }
    });
};

// 🧑‍💻 تحديث بياناتي (لليوزر نفسه)
exports.updateMe = async (req, res) => {
    try {
        if (req.body.password || req.body.confirmPassword) {
            return res.status(400).json({
                status: 'fail',
                message: 'This route is not for password updates. Please use /updateMyPassword.'
            });
        }

        const allowedFields = [
            'name', 'age', 'gender', 'national_id', 'birth_date',
            'nationality', 'marital_status', 'blood_type',
            'emergency_contact', 'email', 'address', 'phone',
            'occupation', 'profile_image',
            'medical_history', 'current_medications', 'allergies', 
            'surgeries', 'lab_tests', 'vaccinations', 'doctor_notes',
            'insurance', 'creditCard',
            'is_student', 'social_media', 'hobbies', 'skills', 
            'graduation_year', 'courses'
        ];

        const invalidFields = Object.keys(req.body).filter(
            (el) => !allowedFields.includes(el)
        );
        
        if (invalidFields.length > 0) {
            return res.status(400).json({
                status: 'fail',
                message: `Invalid field(s): ${invalidFields.join(', ')}`
            });
        }

        const user = req.user; 

        allowedFields.forEach(field => {
            if (req.body[field] !== undefined) {
                user[field] = req.body[field];
            }
        });

        await user.save();

        res.status(200).json({
            status: true,
            data: { user }
        });
    } catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message
        });
    }
};

// 🗑️ حذف (تعطيل) الحساب الخاص باليوزر
exports.deleteMe = async (req, res) => {
    try {
        const user = req.user; 
        
        deleteUserFromFiles(user.id);

        res.status(200).json({
            status: true,
            message: 'User deleted successfully',
            deletedUser: {
                id: user.id, 
                name: user.name,
                email: user.email,
                role: user.role,
                createdAt: user.createdAt
            }
        });
    } catch (err) {
        res.status(400).json({
            status: 'fail',
            message: err.message
        });
    }
};