const sg = require("@sendgrid/mail");
const nodemailer = require("nodemailer");
let ElasticEmail = require("@elasticemail/elasticemail-client");

let defaultClient = ElasticEmail.ApiClient.instance;
let apikey = defaultClient.authentications["apikey"];
apikey.apiKey = process.env.ELASTIC_API_KEY;
let elasticApi = new ElasticEmail.EmailsApi();

// Sendgrid config
const api = process.env.SENDGRIP_API;
sg.setApiKey(api);

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
    user: process.env.SES_USER,
    pass: process.env.SES_PASS,
  },
});

const elasticTransporter = nodemailer.createTransport({
  host: "smtp.elasticemail.com",
  port: 2525,
  auth: {
    user: "contact@ravallusion.com",
    pass: process.env?.ELASTIC_API_KEY || "",
  },
});

const elasticEmailMail = async ({ to, subject, html, attachments }) => {
  try {
    let email = ElasticEmail.EmailMessageData.constructFromObject({
      Recipients: [new ElasticEmail.EmailRecipient(to)],
      Content: {
        Body: [
          ElasticEmail.BodyPart.constructFromObject({
            ContentType: "HTML",
            Content: html,
          }),
        ],
        Subject: subject,
        From: "Ravallusion <contact@ravallusion.com>",
      },
    });

    if (attachments && attachments.length > 0) {
      email.Content.Attachments = attachments.map((file) =>
        ElasticEmail.MessageAttachment.constructFromObject({
          BinaryContent: file?.content?.toString("base64"),
          Name: file?.filename,
          ContentType: file?.contentType || "application/octet-stream",
        })
      );
    }

    return new Promise((resolve, reject) => {
      elasticApi.emailsPost(email, (error, data, response) => {
        if (error) {
          reject(error);
        } else {
          resolve(data);
        }
      });
    });
  } catch (error) {
    throw error;
  }
};

const sendgridMail = async ({ to, subject, html, attachments }) => {
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
      content: file.content.toString("base64"),
      filename: file.filename,
      type: file.contentType,
      disposition: "attachment",
    }));
  }

  return sg.send(mailOptions);
};

const useTransporter = ({ to, subject, html, attachments, transporter }) => {
  const mailOptions = {
    from: {
      email: "contact@ravallusion.com",
      name: "Ravallusion",
    },
    to,
    subject,
    html,
  };

  if (attachments) {
    mailOptions.attachments = attachments;
  }

  return transporter.sendMail(mailOptions);
};

const sendEmail = async ({ to, subject, html, attachments }) => {
  try {
    const isProdEnv = process.env.NODE_ENV === "production";
    // const isProdEnv = true;

    if (isProdEnv) {
      return elasticEmailMail({ to, subject, html, attachments });
    } else {
      return useTransporter({
        to,
        subject,
        html,
        attachments,
        transporter: devTransporter,
      });
    }
  } catch (err) {
    console.log("Email not sent", err);
  }
};

module.exports = sendEmail;
