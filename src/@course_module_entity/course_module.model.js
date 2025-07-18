const mongoose = require("mongoose");

const ModuleSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Please enter tool name"],
      trim: true,
    },
    thumbnailUrl: String,
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// ModuleSchema.index({ course: 1, sequence: 1 }, { unique: true });

const CourseModuleModel = mongoose.model("CourseModule", ModuleSchema);

module.exports = CourseModuleModel;
