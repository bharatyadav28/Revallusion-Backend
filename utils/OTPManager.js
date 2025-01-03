const sendEmail = require("./sendEmail");
const otpModel = require("../src/@otp_entity/otp.model");
const { findByIdAndDelete } = require("../src/@carousal_entity/carousal.model");
const sendSMS = require("./sendSMS");

class OTPManager {
  static async generateOTP({ userId, name, email, mobile, type }) {
    await otpModel.deleteMany({ userId, type, expiresAt: { $gt: new Date() } });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set expiry to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    const query = {
      userId,
      otp,
      type,
      expiresAt,
    };
    if (email) {
      query.email = email;
    } else {
      query.mobile = mobile;
    }

    // Save OTP to database
    await otpModel.create({
      userId,
      otp,
      email,
      mobile,
      type,
      expiresAt,
    });

    if (email) {
      // Send OTP via email
      const message = `
    <div style="font-family: 'Arial', sans-serif; text-align: center; background-color: #f4f4f4; margin-top: 15px; padding: 0;">

      <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; padding: 20px; border-radius: 8px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);">
        <h1 style="color: #333333;">Hey ${name}! </h1>
        <p style="color: #666666;">Your verification code is:</p>
        <p style="font-size: 24px; font-weight: bold; color: #009688; margin: 0;">${otp}</p>
          <p style="color: #666666;">
         This otp will expire in 10 minutes.
         </p>
        <p style="color: #666666;">
          If you did not request an otp , please ignore this email.
        </p>
      </div>

      <div style="color: #888888;">
        <p style="margin-bottom: 40px;">Regards, <span style="color:#b19cd9;">Team Revallusion</span></p>
      </div>
    
    </div>`;

      await sendEmail({
        to: email,
        subject:
          type === "account_verification"
            ? "Account Verification"
            : type === "two_step_auth"
            ? "Two Step Authentication"
            : "Password Reset",
        html: message,
      });
    } else if (mobile) {
      // Send OTP via SMS
      const message = `Your verification code is: ${otp}`;
      await sendSMS({ to: mobile, body: message });
    }

    return { success: true };
  }

  static async verifyOTP(query) {
    query.expiresAt = { $gt: new Date() };
    const otpRecord = await otpModel.findOne(query);

    if (!otpRecord) {
      throw new Error("Invalid or expired OTP");
    }

    // Delete used OTP
    await otpModel.deleteOne({ _id: otpRecord._id });

    return { success: true };
  }

  static async resendOTP({ userId, type }) {
    // Delete any existing OTP for this user and type
    await otpModel.deleteOne({ userId, type });

    const user = await User.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    return this.generateOTP({
      userId,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      type,
    });
  }

  static async invalidateOTP({ userId, type }) {
    await otpModel.deleteMany({ userId, type });
    return { success: true };
  }
}

module.exports = OTPManager;
