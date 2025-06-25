const sg = require("@sendgrid/mail");
const nodemailer = require("nodemailer");

const api = process.env.SENDGRIP_API;
sg.setApiKey(api);

const sendEmail = async ({ to, subject, html, attachments }) => {
  const isProdEnv = process.env.NODE_ENV === "production";

  if (isProdEnv) {
    const mailOptions = {
      to,
      from: "contact@ravallusion.com",
      subject,
      html,
    };

    if (attachments) {
      mailOptions.attachments = attachments.map((file) => ({
        content: file.content.toString("base64"), // Buffer to Base64
        filename: file.filename,
        type: file.contentType,
        disposition: "attachment",
      }));
    }

    // Send email using SendGrid
    return sg.send(mailOptions);
  } else {
    const transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: process.env.ETHERIAL_PORT,
      auth: {
        user: process.env.ETHERIAL_USER,
        pass: process.env.ETHERIAL_PASS,
      },
    });

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
  }
};

module.exports = sendEmail;
