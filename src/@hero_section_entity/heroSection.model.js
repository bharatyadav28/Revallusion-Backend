const mongoose = require("mongoose");

const heroSectionSchema = new mongoose.Schema(
  {
    caption: {
      type: String,
      required: [true, "Please provide hero section caption"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const HeroSectionModal = mongoose.model("HeroSection", heroSectionSchema);

module.exports = HeroSectionModal;
