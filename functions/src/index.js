const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.hello = functions.https.onRequest((req, res) => {
res.send('Hello from Functions');
});