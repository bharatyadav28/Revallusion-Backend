const mongoose = require("mongoose");

const CertificateAddSchema = new mongoose.Schema(
  {
    caption: {
      type: String,
      required: [true, "Please provide certificate caption"],
      trim: true,
    },
    key_points: {
      type: [String],
      required: [true, "Please provide certificate key points"],
    },
    image: {
      type: String,
      trim: true,
      // required: [true, "Please provide certificate image"],
    },
  },
  { timestamps: true }
);

const CertficateAddModel = mongoose.model(
  "CertficateAdd",
  CertificateAddSchema
);

module.exports = CertficateAddModel;
