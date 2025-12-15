const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

// Tạo 1 function đơn giản để CLI nhận ra
exports.hello = functions.https.onRequest((req, res) => {
res.send('Hello from Functions');
});