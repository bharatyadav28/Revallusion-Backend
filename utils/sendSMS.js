const twilio = require("twilio");

// Twilio credentials
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const from = process.env.TWILIO_PHONE_NUMBER;

const client = twilio(accountSid, authToken);

const sendSMS = async ({ to, body }) => {
  const message = await client.messages.create({
    from,
    to,
    body,
  });

  console.log("OTP sent successfully:", message.sid);
};

module.exports = sendSMS;
