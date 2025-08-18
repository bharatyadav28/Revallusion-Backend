const { image } = require("pdfkit");

exports.sendTemplateMessage = async (mobile, template_name) => {
  const name = "Pujitha";
  // console.log("Sending WhatsApp template message:", process.env.WHATSAPP_TOKEN);
  const response = await fetch(
    "https://graph.facebook.com/v22.0/753528621171731/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        // to: mobile,
        to: "+918708353990",
        type: "template",
        template: {
          // name: "welcome",
          name: template_name,
          language: {
            code: "en_US",
          },
          components: [
            {
              type: "header",
              parameters: [
                {
                  type: "image",
                  image: {
                    link: "https://www.ravallusion.com/_next/image?url=%2Fhero-image.png&w=3840&q=75",
                  },
                },
              ],
            },
            {
              type: "body",
              parameters: [
                {
                  type: "text",
                  parameter_name: "name",
                  text: name,
                },
              ],
            },
          ],
        },
      }),
    }
  );

  if (!response.ok) {
    const data = await response.json();
    console.error("Error response:", data);
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  const data = await response.json();
  return data;
};

exports.sendTextMessage = async (mobile, message) => {
  const response = await fetch(
    "https://graph.facebook.com/v22.0/753528621171731/messages",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: mobile,
        type: "text",
        text: {
          body: message,
        },
      }),
    }
  );

  return response;
};

exports.handleWhatsAppMessage = async (mobile, message) => {
  await exports.sendTemplateMessage(mobile, message);
  await exports.sendTextMessage(mobile, message);
};
