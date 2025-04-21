const mongoose = require("mongoose");

const AppConfigSchema = new mongoose.Schema({
  activeGateways: {
    type: [String],
    enum: ["Razorpay", "Cashfree"],
    default: ["Razorpay"],
  },
});

const AppConfigModel = mongoose.model("AppConfig", AppConfigSchema);
module.exports = AppConfigModel;
