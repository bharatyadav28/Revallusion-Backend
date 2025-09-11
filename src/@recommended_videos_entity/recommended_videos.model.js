const mongoose = require("mongoose");

const recommendedVideosSchema = new mongoose.Schema(
  {
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: [true, "Please provide video id"],
    },
    sequence: {
      type: Number,
      required: [true, "Please enter video sequence"],
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

recommendedVideosSchema.statics.getNextSequence = async function (courseId) {
  const maxSequenceDoc = await this.findOne(
    { course: new mongoose.Types.ObjectId(courseId) },
    { sequence: 1 },
    { sort: { sequence: -1 } }
  );
  const maxSequence = maxSequenceDoc?.sequence || 0;

  const nextSequence = (maxSequence < 0 ? 0 : maxSequence) + 1;

  return nextSequence;
};

module.exports = mongoose.model("RecommendedVideos", recommendedVideosSchema);
