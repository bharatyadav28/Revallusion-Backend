const mongoose = require("mongoose");

const AssignmentSchema = new mongoose.Schema(
  {
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

const AssignmentModel = mongoose.model("Assignment", AssignmentSchema);

module.exports = AssignmentModel;
