const sendEmail = require("./sendEmail");

// function baseTemplate(body) {
//   return `
//   <div
//     style="
//       font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
//       text-align: center;
//       background-color: #f8fafc;
//       color: #1e293b;
//       margin: 0;
//       padding: 0.75rem 0.25rem;
//       line-height: 1.6;
//     "
//   >
//     <div
//       style="
//         max-width: 650px;
//         margin: 0px auto;
//         background-color: #ffffff;
//         border-radius: 8px;
//         box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
//         overflow: hidden;
//         border: 1px solid #e2e8f0;
//       "
//     >
//       <!-- Header with simple design -->
//       <div
//         style="
//           background: linear-gradient(135deg, #2537dc 0%, #2c68f6 50%, #4f86ff 100%);
//           padding: 1.5rem 0.75rem;
//           color: white;
//         "
//       >
//         ${body}
//       </div>

//       <!-- Body content -->
//       <div style="padding: 1.25rem 1rem;">
//         <!-- Brand section -->
//         <div style="margin-bottom: 1.5rem;">
//           <div style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.6rem; color: #1e293b;">
//             Ravallusion Academy
//           </div>
//           <div
//             style="
//               color: #64748b;
//               font-size: 0.9rem;
//               max-width: 20rem;
//               margin: 0 auto;
//               line-height: 1.5;
//               padding: 0 0.5rem;
//             "
//           >
//             Join thousands of creators enhancing their storytelling with our
//             expert-led courses and unlock your creative potential.
//           </div>
//         </div>

//         <!-- Simple divider -->
//         <div
//           style="
//             margin: 1.5rem auto;
//             height: 1px;
//             background: #e2e8f0;
//             width: 100%;
//           "
//         ></div>

//         <!-- Footer -->
//         <div
//           style="
//             background-color: #f8fafc;
//             border-radius: 6px;
//             padding: 1rem 0.75rem;
//             margin: 1rem 0;
//             border: 1px solid #e2e8f0;
//           "
//         >
//           <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.3rem; line-height: 1.4;">
//             © 2025 Ravallusion Training Academy LLP. All rights reserved
//           </div>
//           <div style="font-size: 0.75rem; color: #94a3b8;">
//             Ravallusion Training Academy LLP
//           </div>
//         </div>

//         <!-- Social links - Simple and clean -->
//         <div style="margin-top: 1.25rem;">
//           <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.75rem; color: #374151;">
//             Connect with us
//           </div>

//           <div style="text-align: center;">
//             <div style="margin-bottom: 0.5rem;">
//               <a
//                 href="#"
//                 style="
//                   display: inline-block;
//                   margin: 0.25rem 0.375rem;
//                   padding: 0.5rem 0.75rem;
//                   color: #64748b;
//                   text-decoration: none;
//                   font-size: 0.8rem;
//                   font-weight: 500;
//                   border-radius: 4px;
//                   border: 1px solid #e2e8f0;
//                   background-color: #ffffff;
//                   min-width: 70px;
//                   line-height: 1.2;
//                 "
//               >Facebook</a>
//               <a
//                 href="#"
//                 style="
//                   display: inline-block;
//                   margin: 0.25rem 0.375rem;
//                   padding: 0.5rem 0.75rem;
//                   color: #64748b;
//                   text-decoration: none;
//                   font-size: 0.8rem;
//                   font-weight: 500;
//                   border-radius: 4px;
//                   border: 1px solid #e2e8f0;
//                   background-color: #ffffff;
//                   min-width: 70px;
//                   line-height: 1.2;
//                 "
//               >Twitter</a>
//               <a
//                 href="#"
//                 style="
//                   display: inline-block;
//                   margin: 0.25rem 0.375rem;
//                   padding: 0.5rem 0.75rem;
//                   color: #64748b;
//                   text-decoration: none;
//                   font-size: 0.8rem;
//                   font-weight: 500;
//                   border-radius: 4px;
//                   border: 1px solid #e2e8f0;
//                   background-color: #ffffff;
//                   min-width: 70px;
//                   line-height: 1.2;
//                 "
//               >LinkedIn</a>
//             </div>
//             <div>
//               <a
//                 href="#"
//                 style="
//                   display: inline-block;
//                   margin: 0.25rem 0.375rem;
//                   padding: 0.5rem 0.75rem;
//                   color: #64748b;
//                   text-decoration: none;
//                   font-size: 0.8rem;
//                   font-weight: 500;
//                   border-radius: 4px;
//                   border: 1px solid #e2e8f0;
//                   background-color: #ffffff;
//                   min-width: 70px;
//                   line-height: 1.2;
//                 "
//               >Instagram</a>
//               <a
//                 href="#"
//                 style="
//                   display: inline-block;
//                   margin: 0.25rem 0.375rem;
//                   padding: 0.5rem 0.75rem;
//                   color: #64748b;
//                   text-decoration: none;
//                   font-size: 0.8rem;
//                   font-weight: 500;
//                   border-radius: 4px;
//                   border: 1px solid #e2e8f0;
//                   background-color: #ffffff;
//                   min-width: 70px;
//                   line-height: 1.2;
//                 "
//               >YouTube</a>
//               <a
//                 href="#"
//                 style="
//                   display: inline-block;
//                   margin: 0.25rem 0.375rem;
//                   padding: 0.5rem 0.75rem;
//                   color: #64748b;
//                   text-decoration: none;
//                   font-size: 0.8rem;
//                   font-weight: 500;
//                   border-radius: 4px;
//                   border: 1px solid #e2e8f0;
//                   background-color: #ffffff;
//                   min-width: 70px;
//                   line-height: 1.2;
//                 "
//               >Telegram</a>
//             </div>
//           </div>
//         </div>
//       </div>
//     </div>
//   </div>
// `;
// }

function baseTemplate(body) {
  return ` 
  <div
    style="
      font-family: 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif;
      text-align: center;
      background-color: #f8fafc;
      color: #1e293b;
      margin: 0;
      padding: 0.75rem 0.25rem;
      line-height: 1.6;
    "
  >
    <div
      style="
        max-width: 650px;
        margin: 0px auto;
        background-color: #ffffff;
        border-radius: 8px;
        box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
        overflow: hidden;
        border: 1px solid #e2e8f0;
      "
    >
      <!-- Header -->
      <div
        style="
          background: linear-gradient(135deg, #2537dc 0%, #2c68f6 50%, #4f86ff 100%);
          padding: 1.5rem 0.75rem;
          color: white;
        "
      >
        ${body}
      </div>

      <!-- Body content -->
      <div style="padding: 1.25rem 1rem;">
        <!-- Brand section -->
        <div style="margin-bottom: 1.5rem;">
          <div style="font-size: 1.25rem; font-weight: 700; margin-bottom: 0.6rem; color: #1e293b;">
            Ravallusion Academy
          </div>
          <div
            style="
              color: #64748b;
              font-size: 0.9rem;
              max-width: 20rem;
              margin: 0 auto;
              line-height: 1.5;
              padding: 0 0.5rem;
            "
          >
            Empowering creators worldwide with comprehensive online courses in visual effects, storytelling, and digital artistry. Transform your passion into professional expertise.
          </div>
        </div>

        <!-- Divider -->
        <div
          style="
            margin: 1.5rem auto;
            height: 1px;
            background: #e2e8f0;
            width: 100%;
          "
        ></div>

        <!-- Footer with company info -->
        <div
          style="
            background-color: #f8fafc;
            border-radius: 6px;
            padding: 1rem 0.75rem;
            margin: 1rem 0;
            border: 1px solid #e2e8f0;
          "
        >
          <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.5rem; line-height: 1.4;">
            © 2025 Ravallusion Training Academy LLP. All rights reserved
          </div>
          <div style="font-size: 0.75rem; color: #94a3b8; margin-bottom: 0.5rem; line-height: 1.4;">
  85-40-4/4, S1, Sri Shaswatha Nivas, JN Road<br>
  Rajahmundry, East Godavari, Andhra Pradesh<br>
  India, 533101
</div>
          <div style="font-size: 0.7rem; color: #94a3b8;">
            <a href="mailto:unsubscribe@ravallusion.com" style="color: #94a3b8; text-decoration: underline;">
              Unsubscribe
            </a> | 
            <a href="https://www.ravallusion.com/privacy-policy" style="color: #94a3b8; text-decoration: underline;">
              Privacy Policy
            </a>
          </div>
        </div>

        <!-- Social links -->
        <div style="margin-top: 1.25rem;">
          <div style="font-size: 0.85rem; font-weight: 600; margin-bottom: 0.75rem; color: #374151;">
            Connect with us
          </div>
          
          <div style="text-align: center;">
            <div style="margin-bottom: 0.5rem;">
              <a href="https://facebook.com/ravallusion" style="display: inline-block; margin: 0.25rem 0.375rem; padding: 0.5rem 0.75rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 500; border-radius: 4px; border: 1px solid #e2e8f0; background-color: #ffffff; min-width: 70px; line-height: 1.2;">Facebook</a>
              <a href="https://twitter.com/ravallusion" style="display: inline-block; margin: 0.25rem 0.375rem; padding: 0.5rem 0.75rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 500; border-radius: 4px; border: 1px solid #e2e8f0; background-color: #ffffff; min-width: 70px; line-height: 1.2;">Twitter</a>
              <a href="https://linkedin.com/company/ravallusion" style="display: inline-block; margin: 0.25rem 0.375rem; padding: 0.5rem 0.75rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 500; border-radius: 4px; border: 1px solid #e2e8f0; background-color: #ffffff; min-width: 70px; line-height: 1.2;">LinkedIn</a>
            </div>
            <div>
              <a href="https://instagram.com/ravallusion" style="display: inline-block; margin: 0.25rem 0.375rem; padding: 0.5rem 0.75rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 500; border-radius: 4px; border: 1px solid #e2e8f0; background-color: #ffffff; min-width: 70px; line-height: 1.2;">Instagram</a>
              <a href="https://youtube.com/ravallusion" style="display: inline-block; margin: 0.25rem 0.375rem; padding: 0.5rem 0.75rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 500; border-radius: 4px; border: 1px solid #e2e8f0; background-color: #ffffff; min-width: 70px; line-height: 1.2;">YouTube</a>
              <a href="https://t.me/ravallusion" style="display: inline-block; margin: 0.25rem 0.375rem; padding: 0.5rem 0.75rem; color: #64748b; text-decoration: none; font-size: 0.8rem; font-weight: 500; border-radius: 4px; border: 1px solid #e2e8f0; background-color: #ffffff; min-width: 70px; line-height: 1.2;">Telegram</a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
`;
}

function otpTemplate({ name, otp }) {
  const body = `
    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.7rem;">
      Hello, ${name}!
    </div>
    
    <div style="margin-bottom: 1.2rem; font-size: 1rem; line-height: 1.5; max-width: 20rem; margin-left: auto; margin-right: auto;">
      We received a request to verify your account. Please use the verification code below:
    </div>

    <!-- OTP Display Box - matching baseTemplate style -->
    <div style="
      background-color: rgba(255, 255, 255, 0.2);
      border: 2px solid rgba(255, 255, 255, 0.4);
      border-radius: 8px;
      padding: 1.2rem;
      margin: 1.5rem auto;
      max-width: 180px;
    ">
      <div style="font-size: 0.8rem; color: rgba(255, 255, 255, 0.8); margin-bottom: 0.5rem; font-weight: 500;">
        Verification Code
      </div>
      <div style="
        font-size: 2.2rem; 
        font-weight: bold; 
        color: white; 
        letter-spacing: 0.2rem;
        font-family: 'Courier New', monospace;
        text-align: center;
      ">
        ${otp}
      </div>
    </div>

    <div style="margin: 1.2rem auto; font-size: 0.9rem; line-height: 1.4; max-width: 20rem; margin-left: auto; margin-right: auto;">
      This code will expire in <span style="font-weight: bold;">10 minutes</span> for your security.
    </div>

    <div style="
      margin: 1.5rem auto 0.5rem; 
      font-size: 0.8rem; 
      color: rgba(255, 255, 255, 0.7); 
      max-width: 20rem; 
      margin-left: auto;
      margin-right: auto;
      line-height: 1.4;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 1rem;
    ">
      If you didn't request this verification code, please ignore this email.
    </div>
  `;

  return baseTemplate(body);
}

function paymentSuccessTemplate({ invoiceLink }) {
  const body = `
    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.7rem;">
      💳 Payment Successful!
    </div>
    
    <div style="margin-bottom: 1rem; font-size: 1rem; line-height: 1.5; max-width: 22rem; margin-left: auto; margin-right: auto;">
      Thank you for your purchase! Your payment has been processed successfully and your enrollment is now active.
    </div>

    <!-- Payment Status Box -->
    <div style="
      background-color: rgba(255, 255, 255, 0.15);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 1.2rem;
      margin: 1.5rem auto;
      max-width: 24rem;
    ">
      <div style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.8); margin-bottom: 0.8rem; font-weight: 600;">
        ✅ Transaction Complete
      </div>
      <div style="font-size: 0.95rem; line-height: 1.4; color: white; margin-bottom: 0.5rem;">
        Your invoice has been generated and is ready for download!
      </div>
      <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); line-height: 1.3;">
        Click the button below to download your payment receipt for your records.
      </div>
    </div>

    <div style="margin: 1.2rem auto; font-size: 0.9rem; line-height: 1.4; max-width: 22rem; margin-left: auto; margin-right: auto;">
      Welcome to Ravallusion Academy! Your learning journey starts now. Access your course from your dashboard.
    </div>

        <a
      href="${invoiceLink}"
      style="
        display: inline-block;
        margin-top: 1.5rem;
        padding: 1rem 2.5rem;
        background-color: white;
        color: #2537dc;
        border: none;
        border-radius: 6px;
        font-size: 1rem;
        font-weight: 600;
        text-decoration: none;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
      "
    >
      📄 Download Invoice
    </a>

    <div style="
      margin: 1.5rem auto 0.5rem; 
      font-size: 0.8rem; 
      color: rgba(255, 255, 255, 0.6); 
      max-width: 20rem; 
      margin-left: auto;
      margin-right: auto;
      line-height: 1.4;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 1rem;
    ">
      Keep this invoice for your records. If you have any questions about your purchase, contact our support team.
    </div>
  `;

  return baseTemplate(body);
}

function courseCompletionTemplate({ name, course }) {
  const body = `
    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.7rem;">
      🎉 Congratulations, ${name}!
    </div>
    
    <div style="margin-bottom: 1rem; font-size: 1rem; line-height: 1.5; max-width: 22rem; margin-left: auto; margin-right: auto;">
      You have successfully completed the <span style="font-weight: bold; color: rgba(255, 255, 255, 0.9);">${course}</span> course! 
      Your dedication and hard work have paid off.
    </div>

    <!-- Certificate Status Box -->
    <div style="
      background-color: rgba(255, 255, 255, 0.15);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 1.2rem;
      margin: 1.5rem auto;
      max-width: 24rem;
    ">
      <div style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.8); margin-bottom: 0.8rem; font-weight: 600;">
        📜 Certificate Status
      </div>
      <div style="font-size: 0.95rem; line-height: 1.4; color: white; margin-bottom: 0.5rem;">
        Your certificate is ready to be generated!
      </div>
      <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); line-height: 1.3;">
        Visit your dashboard and enter your name to customize and download your official certificate.
      </div>
    </div>

    <div style="margin: 1.2rem auto; font-size: 0.9rem; line-height: 1.4; max-width: 22rem; margin-left: auto; margin-right: auto;">
      Ready to showcase your achievement? Generate your personalized certificate now!
    </div>


<a
  href="https://www.ravallusion.com/dashboard"
  style="
    display: inline-block;
    margin-top: 1.5rem;
    padding: 1rem 2.5rem;
    background-color: white;
    color: #2537dc;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    text-decoration: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
  "
>
  🎯 Generate Certificate
</a>


    <div style="
      margin: 1.5rem auto 0.5rem; 
      font-size: 0.8rem; 
      color: rgba(255, 255, 255, 0.6); 
      max-width: 20rem; 
      margin-left: auto;
      margin-right: auto;
      line-height: 1.4;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 1rem;
    ">
      Need help? Contact our support team or visit our help center for assistance with certificate generation.
    </div>
  `;

  return baseTemplate(body);
}

function certificateAvailableTemplate({ name, course, certificateLink }) {
  const body = `
    <div style="font-size: 2rem; font-weight: bold; margin-bottom: 0.7rem;">
      🎉 Congratulations, ${name}!
    </div>
    
    <div style="margin-bottom: 1rem; font-size: 1rem; line-height: 1.5; max-width: 22rem; margin-left: auto; margin-right: auto;">
      You have successfully completed the <span style="font-weight: bold; color: rgba(255, 255, 255, 0.9);">${course}</span> course! 
      What an incredible achievement!
    </div>

    <!-- Achievement Status Box -->
    <div style="
      background-color: rgba(255, 255, 255, 0.15);
      border: 2px solid rgba(255, 255, 255, 0.3);
      border-radius: 8px;
      padding: 1.2rem;
      margin: 1.5rem auto;
      max-width: 24rem;
    ">
      <div style="font-size: 0.9rem; color: rgba(255, 255, 255, 0.8); margin-bottom: 0.8rem; font-weight: 600;">
        🏆 Course Completion
      </div>
      <div style="font-size: 0.95rem; line-height: 1.4; color: white; margin-bottom: 0.5rem;">
        Your certificate has been generated and is ready for download!
      </div>
      <div style="font-size: 0.85rem; color: rgba(255, 255, 255, 0.7); line-height: 1.3;">
        Click the button below to download your official course completion certificate.
      </div>
    </div>

    <div style="margin: 1.2rem auto; font-size: 0.9rem; line-height: 1.4; max-width: 22rem; margin-left: auto; margin-right: auto;">
      We're proud to have you as part of the Ravallusion learning community. Keep exploring, keep creating, and keep growing!
    </div>

<a
  href="${certificateLink}"
  style="
    display: inline-block;
    margin-top: 1.5rem;
    padding: 1rem 2.5rem;
    background-color: white;
    color: #2537dc;
    border: none;
    border-radius: 6px;
    font-size: 1rem;
    font-weight: 600;
    text-decoration: none;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    transition: all 0.3s ease;
  "
>
  📄 Download Certificate
</a>

    <div style="
      margin: 1.5rem auto 0.5rem; 
      font-size: 0.8rem; 
      color: rgba(255, 255, 255, 0.6); 
      max-width: 20rem; 
      margin-left: auto;
      margin-right: auto;
      line-height: 1.4;
      border-top: 1px solid rgba(255, 255, 255, 0.2);
      padding-top: 1rem;
    ">
      Share your achievement with friends and add this certificate to your professional portfolio!
    </div>
  `;

  return baseTemplate(body);
}

const sendEmailTest = async (req, res) => {
  try {
    await sendEmail({
      to: "bharatyquantumitinnovation@gmail.com",
      subject: "Ravallusion Academy - Payment Confirmation & Invoice",
      html: paymentSuccessTemplate({
        invoiceLink:
          "https://d2b1ol8c9bt133.cloudfront.net/invoices/58dd22bf-6ac0-4a24-aca9-3d2527cb338e.pdf",
      }),

      // html: courseCompletionTemplate({
      //   name: "Bharat",
      //   course: "VFX Course",

      // }),

      // html: certificateAvailableTemplate({
      //   name: "Bharat",
      //   course: "VFX Course",
      //   certificateLink:
      //     "https://d2b1ol8c9bt133.cloudfront.net/certificates/58dd22bf-6ac0-4a24-aca9-3d2527cb338e.pdf",
      // }),

      // html: otpTemplate({
      //   name: "Bharat",
      //   otp: "123456",
      // }),
    });
    return res.status(200).send("Email sent successfully");
  } catch (err) {
    console.log(err);
  }
};

module.exports = {
  paymentSuccessTemplate,
  otpTemplate,
  certificateAvailableTemplate,
  courseCompletionTemplate,
  sendEmailTest,
};
