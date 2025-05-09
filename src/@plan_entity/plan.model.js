const mongoose = require("mongoose");

const PlanSchema = new mongoose.Schema(
  {
    plan_type: {
      type: String,
      required: [true, "Please provide Plan type"],
      trim: true,
    },
    inr_price: {
      type: String,
      required: [true, "Please provide inr plan price"],
      trim: true,
    },
    usd_price: {
      type: String,
      required: [true, "Please provide usd plan price"],
      trim: true,
    },
    validity: {
      type: Number,
      required: [true, "Please provide plan validity"],
    },
    level: {
      type: Number,
      required: true,
      default: 1,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  { timestamps: true }
);

const PlanModel = mongoose.model("Plan", PlanSchema);

module.exports = PlanModel;
