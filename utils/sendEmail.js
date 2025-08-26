const sg = require("@sendgrid/mail");
const nodemailer = require("nodemailer");

const api = process.env.SENDGRIP_API;
sg.setApiKey(api);

const sendEmail = async ({ to, subject, html, attachments }) => {
  // const isProdEnv = process.env.NODE_ENV === "production";
  const isProdEnv = true;
  const useSendgrid = false;

  if (isProdEnv && useSendgrid) {
    const mailOptions = {
      to,
      from: {
        email: "contact@ravallusion.com",
        name: "Ravallusion",
      },
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
    const devTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: process.env.ETHERIAL_PORT,
      auth: {
        user: process.env.ETHERIAL_USER,
        pass: process.env.ETHERIAL_PASS,
      },
    });

    const smtpTransporter = nodemailer.createTransport({
      host: "email-smtp.ap-south-1.amazonaws.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SES_USER, // from SMTP creds
        pass: process.env.SES_PASS,
      },
    });

    const elasticTransporter = nodemailer.createTransport({
      host: "smtp.elasticemail.com",
      port: 2525, // Elastic recommends 2525, 587, or 465 (SSL)
      auth: {
        user: "contact@ravallusion.com", // must be a verified email/domain in Elastic
        pass: process.env.ELASTIC_API_KEY, // Elastic API key (SMTP access)
      },
    });

    const transporter = isProdEnv ? elasticTransporter : devTransporter;

    const mailOptions = {
      from: "no-reply@ravallusion.com",
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
