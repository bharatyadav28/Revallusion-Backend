const mongoose = require("mongoose");
const validator = require("validator");

// OTP Schema
const otpSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Please provide user id"],
  },
  otp: {
    type: String,
    trim: true,
    required: [true, "Please provide otp"],
  },
  email: {
    type: String,
    trim: true,
    validate: [validator.isEmail, "Please enter valid email address"],
  },
  mobile: {
    type: String,
    // trim: true,
    validate: {
      validator: function (v) {
        return validator.isMobilePhone(v, "any", { strictMode: true });
      },
      message: (props) => `${props.value} is not a valid phone number!`,
    },
  },
  type: {
    type: String,
    required: [true, "Please enter  otp type"],
    enum: ["account_verification", "password_reset"],
  },
  expiresAt: {
    type: Date,
    required: [true, "Please provide otp expiry date"],
  },
});
// Otp model
const otpModel = mongoose.model("Otp", otpSchema);

module.exports = otpModel;
