const mongoose = require("mongoose");

const TimestampSchema = new mongoose.Schema(
  {
    video: {
      type: mongoose.Types.ObjectId,
      ref: "Video",
      required: [true, "Please provide video id"],
    },
    time: {
      type: Number,
      required: [true, "Please enter start time"],
    },
    title: {
      type: String,
      required: "Please enter timestamp title",
    },
  },
  {
    timestamps: true,
  }
);

const TimestampModel = mongoose.model("Timestamp", TimestampSchema);

module.exports = TimestampModel;
