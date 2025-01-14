const mongoose = require("mongoose");

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Please enter video title"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    thumbnailUrl: {
      type: String,
      required: [true, "Please provide thumbnail url"],
      trim: true,
    },
    videoUrl: {
      type: String,
      required: [true, "Please provide video url"],
      trim: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
    module: {
      type: String,
    },
    subModule: {
      type: String,
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
    deletedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

const VideoModel = mongoose.model("Video", videoSchema);
module.exports = VideoModel;
