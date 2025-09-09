const mongoose = require("mongoose");

const AssignmentResourcesSchema = new mongoose.Schema(
  {
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    finalCutVideoUrl: {
      type: String,
      required: true,
    },
    assetsUrl: {
      type: String,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const AssignmentResourcesModel = mongoose.model(
  "AssignmentResources",
  AssignmentResourcesSchema
);

module.exports = AssignmentResourcesModel;
