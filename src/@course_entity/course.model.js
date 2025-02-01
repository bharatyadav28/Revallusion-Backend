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
    isFree: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const CourseModel = mongoose.model("Course", CourseSchema);

module.exports = CourseModel;
