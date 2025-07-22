// const client = require("twilio")(accountSid, authToken);

// exports.handleWhatsAppMessage = async (message) => {
//   return new Promise(async (resolve, reject) => {
//     try {
//       client.messages
//         .create({
//           body: `${message}`,
//           from: "whatsapp:+14155238886",
//           to: "whatsapp:+918708353990",
//         })
//         .then((message) => {
//           console.log("data is resolved");
//           resolve(message);
//         })
//         .catch((err) => {
//           reject(err);
//         });
//     } catch (error) {
//       reject(error.message);
//     }
//   });
// };
