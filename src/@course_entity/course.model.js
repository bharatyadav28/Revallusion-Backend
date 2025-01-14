const mongoose = require("mongoose");

const SubmodulesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter sub-module name"],
    trim: true,
  },

  videos: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "video",
    },
  ],
});

const ModulesSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter module name"],
    trim: true,
  },

  subModules: [SubmodulesSchema],
});

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
    modules: [ModulesSchema],
    freeVideos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "video",
      },
    ],
    isFree: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const CourseModel = mongoose.model("Course", CourseSchema);

module.exports = CourseModel;
