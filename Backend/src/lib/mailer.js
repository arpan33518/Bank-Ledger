import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendWelcomeEmail(toEmail, userName) {
  await transporter.sendMail({
    from: `"Bank Ledger" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: "Welcome to Bank Ledger!",
    html: `
      <h2>Hi ${userName}, welcome to Bank Ledger! 🎉</h2>
      <p>Your account has been successfully created using Google Sign-In.</p>
      <p>Your email <strong>${toEmail}</strong> is verified and ready to use.</p>
    `,
  });
}