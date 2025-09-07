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
  const maxSequence = await this.findOne(
    { course: new mongoose.Types.ObjectId(courseId) },
    { sequence: 1 },
    { sort: { sequence: -1 } }
  );
  return (maxSequence?.sequence || 0) + 1;
};

module.exports = mongoose.model("RecommendedVideos", recommendedVideosSchema);
