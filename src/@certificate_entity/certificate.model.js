const mongoose = require("mongoose");

const CertificateSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Please enter user id"],
    },
    path: {
      type: String,
      trim: true,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
      required: [true, "Please enter plan id"],
    },
    totalAssignments: {
      type: Number,
      required: [true, "Please enter total assignments"],
    },
    scoresSum: {
      type: Number,
      required: [true, "Please enter total assigment score"],
    },
    averageAssigmentsScore: {
      type: String,
      required: [true, "Please enter average assigment score"],
    },
    isIssued: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

const CertificateModel = mongoose.model("Certificate", CertificateSchema);

module.exports = CertificateModel;
