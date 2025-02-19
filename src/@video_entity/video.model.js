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

    resource: {
      type: String,
    },
    assignment: {
      type: String,
    },

    // Status flags
    isActive: {
      type: Boolean,
      default: true,
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

  const maxSequence = await this.findOne(
    query,
    { sequence: 1 },
    { sort: { sequence: -1 } }
  );

  return (maxSequence?.sequence || 0) + 1;
};

videoSchema.statics.updateVideoSequence = async function (video, sequence) {
  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const oldSequence = video.sequence;
      const query = {};

      if (video.submodule) {
        query.submodule = video.submodule;
      } else if (video.course) {
        query.course = video.course;
        query.submodule = null;
      }

      if (newSequence > oldSequence) {
        await mongoose.model("Video").updateMany(
          {
            ...query,
            sequence: { $gt: oldSequence, $lte: newSequence },
          },
          { $inc: { sequence: -1 } },
          { session }
        );
      } else if (newSequence < oldSequence) {
        await mongoose.model("Video").updateMany(
          {
            ...query,
            sequence: { $gte: newSequence, $lt: oldSequence },
          },
          { $inc: { sequence: 1 } },
          { session }
        );
      }

      video.sequence = newSequence;
      await video.save({ session });
    });

    await session.endSession();
  } catch (error) {
    await session.endSession();
    throw error;
  }
};

const VideoModel = mongoose.model("Video", videoSchema);

module.exports = VideoModel;
