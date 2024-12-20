const mongoose = require("mongoose");

const PageSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      unique: true,
    },
    description: {
      type: String,
      trim: true,
    },
    status: {
      type: String,
      default: "Active",
      enum: ["Active", "Inactive"],
    },
    type: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const PageModel = mongoose.model("Page", PageSchema);

module.exports = PageModel;
