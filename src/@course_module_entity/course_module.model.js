const mongoose = require("mongoose");

const ModuleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, "Please enter module name"],
    trim: true,
  },
  course: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Course",
    required: true,
  },
});

// ModuleSchema.index({ course: 1, sequence: 1 }, { unique: true });

const CourseModuleModel = mongoose.model("CourseModule", ModuleSchema);

module.exports = CourseModuleModel;
