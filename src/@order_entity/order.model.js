const mongoose = require("mongoose");

const schema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
    order_id: {
      type: String,
    },
    razorpay_signature: {
      type: String,
    },
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
    },
    inr_price: {
      type: Number,
    },
    expiry_date: {
      type: Date,
    },
    status: {
      type: String,
      enum: ["Active", "Expire", "Pending", "Upcoming"],
    },
    start_date: {
      type: Date,
      default: new Date(),
    },
    actual_price: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Order", schema);
