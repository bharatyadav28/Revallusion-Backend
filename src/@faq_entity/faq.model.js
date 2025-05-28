const mongoose = require("mongoose");

const FaqSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please provide question title"],
      trim: true,
      unique: [true, "Title must be unique"],
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      default: "Active",
      enum: ["Active", "Inactive"],
      trim: true,
    },
  },
  { timestamps: true }
);

const FaqModel = mongoose.model("Faq", FaqSchema);

module.exports = FaqModel;
