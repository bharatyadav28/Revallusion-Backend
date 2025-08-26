const mongoose = require("mongoose");
const { dash } = require("pdfkit");

const AppConfigSchema = new mongoose.Schema({
  activeGateways: {
    type: [String],
    enum: ["Razorpay", "Cashfree"],
    default: ["Razorpay"],
  },
  dashboardLeftImage: {
    type: String,
    default: "",
  },
  dashboardRightImage: {
    type: String,
    default: "",
  },
});

const AppConfigModel = mongoose.model("AppConfig", AppConfigSchema);
module.exports = AppConfigModel;
