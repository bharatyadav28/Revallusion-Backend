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
      required: [true, "Please provide plan price"],
      trim: true,
    },
    validity: {
      type: Number,
      required: [true, "Please provide plan validity"],
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
