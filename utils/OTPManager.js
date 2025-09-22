const sendEmail = require("./sendEmail");
const otpModel = require("../src/@otp_entity/otp.model");
const { findByIdAndDelete } = require("../src/@carousal_entity/carousal.model");
const sendSMS = require("./sendSMS");
const { otpTemplate } = require("./emailHTML");

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

      await sendEmail({
        to: email,
        subject:
          type === "account_verification"
            ? "Ravallusion Academy - Verify Your Account"
            : type === "two_step_auth"
            ? "Ravallusion Academy - Security Code"
            : "Password Reset",
        html: otpTemplate({ name, otp }),
      });
    } else if (mobile) {
      // Send OTP via SMS
      const message = `Your verification code is: ${otp}`;
      // await sendSMS({ to: mobile, body: message });
    }

    return { success: true };
  }

  static async verifyOTP(query) {
    query.expiresAt = { $gt: new Date() };
    const otpRecord = await otpModel.findOne(query);

    if (!otpRecord) {
      throw new Error("Invalid or Expired OTP");
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
