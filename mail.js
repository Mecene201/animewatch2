// mail.js
require('dotenv').config();
const nodemailer = require('nodemailer');

// 1) Configure your SMTP transport (example uses Gmail)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,   // your Gmail address
    pass: process.env.GMAIL_PASS    // your Gmail app password
  }
});

/**
 * Send a verification email containing a one-time token link.
 * @param {string} toEmail – recipient’s address
 * @param {string} token   – the verifyToken you generated
 */
async function sendVerificationEmail(toEmail, token) {
  const verifyUrl = `${process.env.BASE_URL}/verify?token=${token}`;
  await transporter.sendMail({
    from: `"AnimeWatch" <${process.env.GMAIL_USER}>`,
    to:   toEmail,
    subject: 'Verify your AnimeWatch account',
    html: `
      <p>Hey there! Thanks for signing up. Please verify your email by clicking below:</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
      <p>This link will expire in 24 hours.</p>
    `
  });
  console.log(`🔔 Sent verification email to ${toEmail}`);
}

module.exports = { sendVerificationEmail };
