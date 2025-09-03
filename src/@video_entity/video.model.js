// videoSchema.js
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
      required: [true, "Please enter video description"],
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
    duration: {
      hours: { type: Number, default: 0 },
      minutes: { type: Number, default: 0 },
      seconds: { type: Number, default: 0 },
    },
    // References - video can be in submodule, course (free video), or standalone
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
    },
    module: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseModule",
    },
    submodule: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Submodule",
    },
    // Sequence management
    sequence: {
      type: Number,
    },

    assignment: {
      type: String,
      trim: true,
    },

    // Status flags
    isActive: {
      type: Boolean,
      default: true,
    },

    disableForward: {
      type: Boolean,
      default: false,
    },
    lock: {
      type: Boolean,
      default: false,
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

// Compound indexes for efficient querying
videoSchema.index({ course: 1, sequence: 1 });
videoSchema.index({ submodule: 1, sequence: 1 });

videoSchema.statics.getNextSequence = async function ({ course, submodule }) {
  const query = {};

  if (submodule) {
    query.submodule = submodule;
  } else if (course) {
    query.course = course;
    query.submodule = null;
  }

  const maxSequenceDoc = await this.findOne(
    query,
    { sequence: 1 },
    { sort: { sequence: -1 } }
  );

  const maxSequence = maxSequenceDoc?.sequence || 0;

  const nextSequence = (maxSequence < 0 ? 0 : maxSequence) + 1;

  return nextSequence;
};

const VideoModel = mongoose.model("Video", videoSchema);

module.exports = VideoModel;
