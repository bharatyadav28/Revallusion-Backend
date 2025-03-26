const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: [true, "Please enter user id"],
  },
  path: {
    type: String,
    trim: true,
    required: [true, "Please enter certificate path "],
  },
  plan: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Plan",
    required: [true, "Please enter plan id"],
  },
});

const CertificateModel = mongoose.model("Certificate", CertificateSchema);

module.exports = CertificateModel;
