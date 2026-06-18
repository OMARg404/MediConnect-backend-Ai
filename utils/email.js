// email.js
const nodemailer = require('nodemailer');

const sendEmail = async(options) => {
    // 1) Create a transporter
    const transporter = nodemailer.createTransport({
        host: process.env.EMAIL_HOST, // مثال: smtp.gmail.com
        port: process.env.EMAIL_PORT, // مثال: 587
        secure: process.env.EMAIL_SECURE === 'true', // يتحول لـ boolean
        auth: {
            user: process.env.EMAIL_USERNAME, // إيميلك
            pass: process.env.EMAIL_PASSWORD // باسورد أو App Password
        }
    });

    // 2) Define the email options
    const mailOptions = {
        from: `Trips Support <${process.env.EMAIL_USERNAME}>`, // يظهر للعميل باسم مشروعك
        to: options.email,
        subject: options.subject,
        text: options.message, // نسخة plain text
        html: options.html // نسخة HTML (منسقة)
    };

    // 3) Actually send the email
    await transporter.sendMail(mailOptions);
};

module.exports = sendEmail;