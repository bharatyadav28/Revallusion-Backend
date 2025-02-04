const mongoose = require("mongoose");

const AssignmentSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Please provide course id"],
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseModule",
      required: [true, "Please provide module id"],
    },
    submodule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submodule",
      required: [true, "Please provide submodule id"],
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

AssignmentSchema.index({ submodule: 1 });

const AssignmentModel = mongoose.model("Assignment", AssignmentSchema);

module.exports = AssignmentModel;
