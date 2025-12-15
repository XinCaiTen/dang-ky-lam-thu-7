const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
admin.initializeApp();

// Cấu hình transporter với Gmail (hoặc SMTP khác)
const transporter = nodemailer.createTransport({
	service: 'gmail',
	auth: {
		user: 'duannguyen0901@gmail.com',      // Email chính
		pass: 'flbg vqwn vzvw cjqd'          // App Password
	}
});

// Function gửi mail test qua HTTP request
exports.sendTestMail = functions.https.onRequest(async (req, res) => {
		// Thêm CORS headers
		res.set('Access-Control-Allow-Origin', '*');
		res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
		res.set('Access-Control-Allow-Headers', 'Content-Type');

		// Xử lý preflight request
		if (req.method === 'OPTIONS') {
			res.status(204).send('');
			return;
		}

		const to = req.body.to || req.query.to || 'recipient@example.com';
		const subject = req.body.subject || req.query.subject || 'Test Email from Firebase Functions';
		const text = req.body.text || req.query.text || 'Đây là email test gửi từ Firebase Functions.';

		const mailOptions = {
			from: 'duannguyen0901@gmail.com', // Email chính
			to,
			subject,
			text
		};

		try {
			await transporter.sendMail(mailOptions);
			res.status(200).send('Đã gửi email thành công tới: ' + to);
		} catch (error) {
			console.error('Send mail error:', error);
			res.status(500).send('Lỗi gửi mail: ' + error.message);
		}
});

// Function hello cũ giữ nguyên
exports.hello = functions.https.onRequest((req, res) => {
	res.send('Hello from Functions');
});