const nodemailer = require("nodemailer");

const sendEmail = async ({ to, subject, html, attachments }) => {
  //  create tranporter(ethereal config) using nodemailer
  const devTransporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: process.env.ETHERIAL_PORT,
    auth: {
      user: process.env.ETHERIAL_USER,
      pass: process.env.ETHERIAL_PASS,
    },
  });

  const prodTransporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_PASS,
    },
  });

  const transporter =
    process.env.NODE_ENV === "production" ? prodTransporter : devTransporter;

  const mailOptions = {
    from: '"Ravallusion" < ravallusionacademy@gmail.com>',
    to,
    subject,
    html,
  };

  if (attachments) {
    mailOptions.attachments = attachments;
  }

  // Send email using previously created transporter
  return transporter.sendMail(mailOptions);
};

module.exports = sendEmail;
