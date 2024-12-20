const mongoose = require("mongoose");

const keyPointsSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, "Please provide key point title"],
  },
  explanation: {
    type: String,
    required: [true, "Please provide key point explanation"],
  },
});

const CarousalSchema = new mongoose.Schema(
  {
    sequence: {
      type: Number,
      required: [true, "Please provide carousal sequence number"],
      unique: true,
    },
    caption: {
      type: String,
      required: [true, "Please provide carousal caption"],
    },
    description: {
      type: String,
    },
    key_points: [keyPointsSchema],
  },
  { timestamps: true }
);

const CarousalModel = mongoose.model("Carousal", CarousalSchema);

module.exports = CarousalModel;
