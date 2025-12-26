const functions = require("firebase-functions");
const admin = require("firebase-admin");
const nodemailer = require("nodemailer");
const gmailEmail = functions.config().gmail.user;
const gmailPassword = functions.config().gmail.pass;
admin.initializeApp();

// Cấu hình transporter với Gmail (hoặc SMTP khác)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: gmailEmail,//"duannguyen0901@gmail.com", // Email
    pass: gmailPassword // Password
  },
});

// Function gửi mail test qua HTTP request
exports.sendTestMail = functions.https.onRequest(async (req, res) => {
  // Thêm CORS headers
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");

  // Xử lý preflight request
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const to = req.body.to || req.query.to || "recipient@example.com";
  const subject =
    req.body.subject ||
    req.query.subject ||
    "Test Email from Firebase Functions";
  const text =
    req.body.text ||
    req.query.text ||
    "Đây là email test gửi từ Firebase Functions.";

  const mailOptions = {
    from: "duannguyen0901@gmail.com", // Email chính
    to,
    subject,
    text,
  };

  try {
    await transporter.sendMail(mailOptions);
    res.status(200).send("Đã gửi email thành công tới: " + to);
  } catch (error) {
    console.error("Send mail error:", error);
    res.status(500).send("Lỗi gửi mail: " + error.message);
  }
});

// Function gửi mail cho nhiều người qua HTTP request
exports.sendMailToMany = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  const toList = req.body.toList || req.query.toList;
  const subject =
    req.body.subject ||
    req.query.subject ||
    "Thông báo từ hệ thống Đăng ký làm Thứ 7";
  const text =
    req.body.text || req.query.text || "Đây là email gửi tự động từ hệ thống.";

  if (!Array.isArray(toList) || toList.length === 0) {
    res.status(400).send("toList phải là mảng email.");
    return;
  }

  let success = 0,
    fail = 0,
    errors = [];
  for (const to of toList) {
    const mailOptions = {
      from: "duannguyen0901@gmail.com",
      to,
      subject,
      text,
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

// Function tự động gửi mail vào 8h sáng thứ 6 hàng tuần (GMT+7, lấy email từ Authentication)
exports.scheduledSendMail = functions.pubsub
  .schedule("every friday 08:00")
  .timeZone("Asia/Ho_Chi_Minh")
  .onRun(async (context) => {
    // Lấy email từ Firebase Authentication
    const emailList = [];
    let nextPageToken;
    do {
      const result = await admin.auth().listUsers(1000, nextPageToken);
      result.users.forEach((userRecord) => {
        if (userRecord.email) emailList.push(userRecord.email);
      });
      nextPageToken = result.pageToken;
    } while (nextPageToken);

    if (emailList.length === 0) return null;
    // Subject, text, html: dùng giá trị mặc định vì Cloud Scheduler không có req/query
    const subject = "🔔 Nhắc đăng ký đi làm Thứ 7";
    const text =
      "Bạn vui lòng truy cập trang web để đăng ký đi làm và ăn trưa Thứ 7 tuần này." +
      "\n\nVui lòng truy cập link: https://diem-danh-thu-7.web.app/ (Nếu link trên bị lỗi)." +
      "\n\n— Create by DuanNV";

    const html = `<div style="font-family:Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#1f2937; line-height:1.6;">
    <div style="max-width:640px; margin:0 auto; padding:24px; border:1px solid #e5e7eb; border-radius:12px;">
      <h2 style="margin:0 0 12px; color:#111827;">Nhắc đăng ký đi làm Thứ 7</h2>
      <p style="margin:0 0 16px;">
        Bạn vui lòng truy cập trang web để đăng ký <strong>đi làm</strong> và <strong>ăn trưa</strong> Thứ 7 tuần này.
      </p>

      <div style="margin:20px 0;">
        <a href="https://xincaiten.github.io/dang-ky-lam-thu-7/" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:600;">
          Truy cập trang web
        </a>
      </div>

      <p style="margin:0 0 8px; font-size:14px; color:#374151;">
        Nếu link trên bị lỗi, vui lòng dùng đường dẫn dự phòng:
      </p>
      <ul style="margin:0 0 16px; padding-left:18px; font-size:14px;">
        <li><a href="https://diem-danh-thu-7.web.app/" style="color:#2563eb; text-decoration:none;">Nhấp vào để tiếp tục truy cập</a></li>
      </ul>

      <hr style="border:none; border-top:1px solid #e5e7eb; margin:16px 0;">

      <p style="margin:0 0 6px; font-size:14px; font-weight:600; color:#EC070C;">
        Vui lòng hoàn tất đăng ký trước 16:00 thứ Sáu để hệ thống thống kê suất ăn.
      </p>

      <p style="margin:8px 0 0; font-size:12px; color:#0055A8;">
        — Create by <strong>DuanNV</strong>
      </p>
    </div>
  </div>`;

    let success = 0,
      fail = 0,
      errors = [];
    for (const to of emailList) {
      const mailOptions = {
        from: "duannguyen0901@gmail.com",
        to,
        subject,
        text,
		html
      };
      try {
        await transporter.sendMail(mailOptions);
        success++;
      } catch (err) {
        fail++;
        errors.push({ to, error: err.message });
      }
    }
    console.log(`Scheduled mail: success=${success}, fail=${fail}`);
    return null;
  });

// Function hello cũ
exports.hello = functions.https.onRequest((req, res) => {
  res.send("Hello from Functions");
});
// Function gửi mail ngay lập tức cho tất cả user trong Authentication (gọi qua HTTP)
exports.sendMailToAllAuthUsers = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }

  // Lấy email từ Firebase Authentication
  const emailList = [];
  let nextPageToken;
  do {
    const result = await admin.auth().listUsers(1000, nextPageToken);
    result.users.forEach((userRecord) => {
      if (userRecord.email) emailList.push(userRecord.email);
    });
    nextPageToken = result.pageToken;
  } while (nextPageToken);

  if (emailList.length === 0) {
    res.status(200).send("Không có email nào trong Authentication!");
    return;
  }

  // Subject “trang trí”
  const subject =
    req.body.subject || req.query.subject || "🔔 Nhắc đăng ký đi làm Thứ 7";

  // Plain text (có chữ ký)
  const text =
    (req.body.text ||
      req.query.text ||
      "Bạn vui lòng truy cập trang web để đăng ký đi làm và ăn trưa Thứ 7 tuần này.") +
    "\n\nVui lòng truy cập link: https://1 hoặc https://2 (Nếu link trên bị lỗi)." +
    "\n\n— Được thực hiện bởi DuanNV";

  // HTML body “trang trí” (có chữ ký)
  const html =
    req.body.html ||
    `<div style="font-family:Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#1f2937; line-height:1.6;">
    <div style="max-width:640px; margin:0 auto; padding:24px; border:1px solid #e5e7eb; border-radius:12px;">
      <h2 style="margin:0 0 12px; color:#111827;">Nhắc đăng ký đi làm Thứ 7</h2>
      <p style="margin:0 0 16px;">
        Bạn vui lòng truy cập trang web để đăng ký <strong>đi làm</strong> và <strong>ăn trưa</strong> Thứ 7 tuần này.
      </p>

      <div style="margin:20px 0;">
        <a href="https://xincaiten.github.io/dang-ky-lam-thu-7/" style="display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:600;">
          Truy cập trang web
        </a>
      </div>

      <p style="margin:0 0 8px; font-size:14px; color:#374151;">
        Nếu link trên bị lỗi, vui lòng dùng đường dẫn dự phòng:
      </p>
      <ul style="margin:0 0 16px; padding-left:18px; font-size:14px;">
        <li><a href="https://diem-danh-thu-7.web.app/" style="color:#2563eb; text-decoration:none;">Nhấp vào để tiếp tục truy cập</a></li>
      </ul>

      <hr style="border:none; border-top:1px solid #e5e7eb; margin:16px 0;">

      <p style="margin:0 0 6px; font-size:12px; color:#6b7280;">
        Vui lòng hoàn tất đăng ký trước 16:00 thứ Sáu để hệ thống thống kê suất ăn.
      </p>

      <p style="margin:8px 0 0; font-size:12px; color:#0055A8;">
        — Create by <strong>DuanNV</strong>
      </p>
    </div>
  </div>`;

  let success = 0,
    fail = 0,
    errors = [];
  for (const to of emailList) {
    const mailOptions = {
      from: "duannguyen0901@gmail.com",
      to,
      subject,
      text,
      html,
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
// Function gửi mail khi user đăng nhập Google lần đầu (onCreate trigger)
exports.sendWelcomeMailOnGoogleSignup = functions.auth.user().onCreate(async (user) => {
  // Chỉ gửi nếu user có email
  if (!user.email) return null;

  // Subject và nội dung chào mừng
  const subject = "Bạn đã sẵn sàng sử dụng tài khoản Google để đăng ký làm Thứ 7!";
  const text =
    `Xin chào ${user.displayName || "bạn"},\n\n` +
    "Cảm ơn bạn đã đăng nhập bằng Google. Bạn đã có thể sử dụng  để đăng ký đi làm và ăn trưa Thứ 7. \n\n" +
    "Truy cập trang web tại: https://xincaiten.github.io/dang-ky-lam-thu-7/\n\n" +
    "— Create by DuanNV";
  const html =
    `<div style=\"font-family:Segoe UI, Roboto, Helvetica, Arial, sans-serif; color:#1f2937; line-height:1.6;\">` +
    `<div style=\"max-width:640px; margin:0 auto; padding:24px; border:1px solid #e5e7eb; border-radius:12px;\">` +
    `<h2 style=\"margin:0 0 12px; color:#111827;\">Chào mừng bạn đến với website đăng ký làm việc thứ 7</h2>` +
    `<p style=\"margin:0 0 16px;\">Xin chào <strong>${user.displayName || user.email}</strong>,</p>` +
    `<p style=\"margin:0 0 16px;\">Giờ đây, bạn có thể dễ dàng sử dụng website để đăng ký <strong>đi làm</strong> và <strong>ăn trưa</strong> Thứ 7. </p>` +
    `<p style=\"margin:0 0 16px; color:#FF0000;\">Hệ thống sẽ tự động gửi email nhắc nhở vào lúc 8h sáng mỗi Thứ 6 hàng tuần.</p>` +
    `<p style=\"margin:0 0 16px;\">Chúc bạn có một trải nghiệm thật tốt khi sử dụng trang web này!</p>` +
    `<div style=\"margin:20px 0;\">` +
    `<a href=\"https://xincaiten.github.io/dang-ky-lam-thu-7/\" style=\"display:inline-block; background:#2563eb; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:600;\">Truy cập trang web</a>` +
    `</div>` +
    `<hr style=\"border:none; border-top:1px solid #e5e7eb; margin:16px 0;\">` +
    `<p style=\"margin:8px 0 0; font-size:12px; color:#0055A8;\">— Create by <strong>DuanNV</strong></p>` +
    `</div></div>`;

  const mailOptions = {
    from: "duannguyen0901@gmail.com",
    to: user.email,
    subject,
    text,
    html,
  };
  try {
    await transporter.sendMail(mailOptions);
    console.log(`Đã gửi mail chào mừng tới: ${user.email}`);
  } catch (error) {
    console.error("Lỗi gửi mail chào mừng:", error);
  }
  return null;
});
