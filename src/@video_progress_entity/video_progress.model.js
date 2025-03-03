const mongoose = require("mongoose");

const videoProgressSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: true,
    },
    watchedDuration: {
      // First time watch
      type: Number,
      default: 0,
      required: true,
    },
    totalDuration: {
      // Total video duration
      type: Number,
      required: true,
    },
    percentageWatched: {
      type: Number,
      default: 0,
    },
    isCompleted: {
      type: Boolean,
      default: false,
    },
    lastPosition: {
      // Last watched position
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Calculate percentage watched before saving
videoProgressSchema.pre("save", function (next) {
  this.percentageWatched = Math.ceil(
    (this.lastPosition / this.totalDuration) * 100
  );

  // Mark as completed if watched at least 90%
  if (this.percentageWatched >= 90) {
    this.isCompleted = true;
  }

  this.updatedAt = Date.now();
  next();
});

const VideoProgress = mongoose.model("VideoProgress", videoProgressSchema);
module.exports = VideoProgress;
