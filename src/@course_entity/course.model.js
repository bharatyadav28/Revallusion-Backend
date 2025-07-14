const mongoose = require("mongoose");

const CourseSchema = new mongoose.Schema(
  {
    plan: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Plan",
    },
    title: {
      type: String,
      required: [true, "Please provide course title"],
      trim: true,
    },
    level: {
      type: Number,
      required: true,
      default: 0,
    },
    isFree: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const CourseModel = mongoose.model("Course", CourseSchema);

module.exports = CourseModel;
