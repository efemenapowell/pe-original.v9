// ============================================================
// services/emailService.js — Nodemailer wrapper
// Sends password-reset and order-confirmation emails.
// In dev (MAIL_DEV_MODE=true) emails are logged to the console
// instead of sent — ideal for local testing without SMTP creds.
// ============================================================
const nodemailer = require('nodemailer');
const config = require('../config');

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.secure,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transporter;
}

async function sendMail({ to, subject, html, text }) {
  if (config.smtp.devMode || !config.smtp.user) {
    // Dev mode — print instead of sending
    console.log('\n========================================');
    console.log(`[MAIL DEV MODE] To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${text || html.replace(/<[^>]+>/g, ' ').slice(0, 500)}`);
    console.log('========================================\n');
    return { devMode: true, messageId: `dev-${Date.now()}` };
  }

  const info = await getTransporter().sendMail({
    from: config.smtp.from,
    to,
    subject,
    html,
    text,
  });
  return { devMode: false, messageId: info.messageId };
}

/** Password reset email — link contains a one-time token. */
async function sendPasswordResetEmail(to, resetUrl, isAdmin = false) {
  const subject = isAdmin
    ? 'PE_ORIGINALS Admin — Reset your password'
    : 'PE_ORIGINALS — Reset your password';
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;border:1px solid #f0e0e8;border-radius:14px;overflow:hidden">
      <div style="background:#f9e8ef;padding:24px;text-align:center">
        <h2 style="color:#b04a74;margin:0;font-family:Georgia,serif">PE_ORIGINALS</h2>
      </div>
      <div style="padding:28px">
        <h3 style="color:#333">Reset your password</h3>
        <p style="color:#555;line-height:1.6">We received a request to reset your password.
        This link is valid for <strong>30 minutes</strong>. If you didn't ask for this, you can ignore this email.</p>
        <p style="text-align:center;margin:28px 0">
          <a href="${resetUrl}"
             style="background:#c75b8c;color:#fff;text-decoration:none;padding:13px 30px;border-radius:30px;font-weight:bold;display:inline-block">
             Reset password
          </a>
        </p>
        <p style="color:#999;font-size:13px">Or copy this link: ${resetUrl}</p>
      </div>
    </div>`;
  return sendMail({ to, subject, html, text: `Reset your password: ${resetUrl}` });
}

/** Order confirmation email. */
async function sendOrderConfirmationEmail(to, order, items) {
  const subject = `Your PE_ORIGINALS order ${order.orderNumber} is confirmed`;
  const rows = items
    .map(
      (i) => `<tr>
        <td style="padding:10px;border-bottom:1px solid #f0e0e8">${i.name} (${i.size})</td>
        <td style="padding:10px;border-bottom:1px solid #f0e0e8;text-align:center">${i.qty}</td>
        <td style="padding:10px;border-bottom:1px solid #f0e0e8;text-align:right">₦${(i.subtotal).toLocaleString()}</td>
      </tr>`
    )
    .join('');
  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;border:1px solid #f0e0e8;border-radius:14px;overflow:hidden">
      <div style="background:#f9e8ef;padding:24px;text-align:center">
        <h2 style="color:#b04a74;margin:0;font-family:Georgia,serif">PE_ORIGINALS</h2>
        <p style="color:#b04a74;margin:4px 0 0">Order #${order.orderNumber}</p>
      </div>
      <div style="padding:28px">
        <p style="color:#555">Hi ${order.shipFirstName}, thank you for your order! 💕</p>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr><th style="text-align:left;color:#999;font-size:12px">Item</th>
          <th style="color:#999;font-size:12px">Qty</th>
          <th style="color:#999;font-size:12px;text-align:right">Total</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="text-align:right;font-size:18px;font-weight:bold;color:#333;margin-top:16px">
          Total: ₦${order.total.toLocaleString()}
        </p>
        <p style="color:#999;font-size:13px">We'll email you the moment your order ships. Track it anytime in your account.</p>
      </div>
    </div>`;
  return sendMail({ to, subject, html, text: `Order ${order.orderNumber} confirmed — total ₦${order.total}` });
}

module.exports = { sendMail, sendPasswordResetEmail, sendOrderConfirmationEmail };
