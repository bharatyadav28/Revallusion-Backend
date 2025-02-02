const mongoose = require("mongoose");

const LatestTutorialsSchema = new mongoose.Schema(
  {
    video: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: [true, "Please provide video id"],
    },
    sequence: {
      type: Number,
      required: [true, "Please enter video sequence"],
    },
  },
  { timestamps: true }
);
LatestTutorialsSchema.index({ sequence: 1 });

// Get next sequence number in the list
LatestTutorialsSchema.statics.getNextSequence = async function () {
  const maxSequence = await this.findOne(
    {},
    { sequence: 1 },
    { sort: { sequence: -1 } }
  );

  return (maxSequence?.sequence || 0) + 1;
};

const LatestTutorailsModel = mongoose.model(
  "LatestTutorials",
  LatestTutorialsSchema
);

module.exports = LatestTutorailsModel;
