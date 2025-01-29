const mongoose = require("mongoose");

const LatestVideoSchema = new mongoose.Schema(
  {
    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      required: [true, "Please provide video id"],
    },
    sequence: {
      type: Number,
      required: [true, "Please enter video sequence"],
      unique: [true, "Video sequence should be unique"],
    },
  },
  { _id: false }
);

const LatestTutorailsSchema = new mongoose.Schema(
  {
    videos: [LatestVideoSchema],
  },
  { timestamps: true }
);

const LatestTutorailsModel = mongoose.model(
  "LatestTutorails",
  LatestTutorailsSchema
);

module.exports = LatestTutorailsModel;
