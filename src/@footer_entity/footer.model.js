const mongoose = require("mongoose");

const FooterSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
    },
    iconPath: {
      type: String,
      required: [true, "Please provide icon path"],
      trim: true,
    },
    url: {
      type: String,
      required: [true, "Please provide URL"],
      trim: true,
    },
  },
  { timestamps: true }
);

const FooterModel = mongoose.model("Footer", FooterSchema);

module.exports = FooterModel;
