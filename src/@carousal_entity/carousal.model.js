const mongoose = require("mongoose");

const CarousalVideoSchema = new mongoose.Schema(
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

const CarousalSchema = new mongoose.Schema(
  {
    videos: [CarousalVideoSchema],
  },
  { timestamps: true }
);

const CarousalModel = mongoose.model("Carousal", CarousalSchema);

module.exports = CarousalModel;
