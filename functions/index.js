// Function gửi mail ngay lập tức cho tất cả user trong Authentication (gọi qua HTTP)
exports.sendMailToAllAuthUsers = functions.https.onRequest(async (req, res) => {
	res.set('Access-Control-Allow-Origin', '*');
	res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
	res.set('Access-Control-Allow-Headers', 'Content-Type');
	if (req.method === 'OPTIONS') {
		res.status(204).send('');
		return;
	}

	// Lấy email từ Firebase Authentication
	const emailList = [];
	let nextPageToken;
	do {
		const result = await admin.auth().listUsers(1000, nextPageToken);
		result.users.forEach(userRecord => {
			if (userRecord.email) emailList.push(userRecord.email);
		});
		nextPageToken = result.pageToken;
	} while (nextPageToken);

	if (emailList.length === 0) {
		res.status(200).send('Không có email nào trong Authentication!');
		return;
	}

	const subject = req.body.subject || req.query.subject || 'Nhắc đăng ký đi làm Thứ 7';
	const text = req.body.text || req.query.text || 'Bạn vui lòng đăng nhập hệ thống để đăng ký đi làm và ăn trưa Thứ 7 tuần này.';

	let success = 0, fail = 0, errors = [];
	for (const to of emailList) {
		const mailOptions = {
			from: 'duannguyen0901@gmail.com',
			to,
			subject,
			text
		};
		try {
			await transporter.sendMail(mailOptions);
			success++;
		} catch (err) {
			fail++;
			errors.push({ to, error: err.message });
		}
	}
	res.status(200).send({ success, fail, errors });
});
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

// Function gửi mail cho nhiều người qua HTTP request
exports.sendMailToMany = functions.https.onRequest(async (req, res) => {
	res.set('Access-Control-Allow-Origin', '*');
	res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
	res.set('Access-Control-Allow-Headers', 'Content-Type');
	if (req.method === 'OPTIONS') {
		res.status(204).send('');
		return;
	}

	const toList = req.body.toList || req.query.toList;
	const subject = req.body.subject || req.query.subject || 'Thông báo từ hệ thống Đăng ký Thứ 7';
	const text = req.body.text || req.query.text || 'Đây là email gửi tự động từ hệ thống.';

	if (!Array.isArray(toList) || toList.length === 0) {
		res.status(400).send('toList phải là mảng email.');
		return;
	}

	let success = 0, fail = 0, errors = [];
	for (const to of toList) {
		const mailOptions = {
			from: 'duannguyen0901@gmail.com',
			to,
			subject,
			text
		};
		try {
			await transporter.sendMail(mailOptions);
			success++;
		} catch (err) {
			fail++;
			errors.push({ to, error: err.message });
		}
	}
	res.status(200).send({ success, fail, errors });
});

// Function tự động gửi mail vào thứ 6 hàng tuần (lấy email từ Authentication)
exports.scheduledSendMail = functions.pubsub.schedule('every friday 09:00').timeZone('Asia/Ho_Chi_Minh').onRun(async (context) => {
	// Lấy email từ Firebase Authentication
	const emailList = [];
	let nextPageToken;
	do {
		const result = await admin.auth().listUsers(1000, nextPageToken);
		result.users.forEach(userRecord => {
			if (userRecord.email) emailList.push(userRecord.email);
		});
		nextPageToken = result.pageToken;
	} while (nextPageToken);

	if (emailList.length === 0) return null;

	const subject = 'Nhắc đăng ký đi làm Thứ 7';
	const text = 'Bạn vui lòng đăng nhập hệ thống để đăng ký đi làm và ăn trưa Thứ 7 tuần này.';

	for (const to of emailList) {
		const mailOptions = {
			from: 'duannguyen0901@gmail.com',
			to,
			subject,
			text
		};
		try {
			await transporter.sendMail(mailOptions);
		} catch (err) {
			console.error('Send mail error:', to, err.message);
		}
	}
	return null;
});

// Function hello cũ giữ nguyên
exports.hello = functions.https.onRequest((req, res) => {
	res.send('Hello from Functions');
});