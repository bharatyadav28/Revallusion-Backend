const mongoose = require("mongoose");

const DashboardContentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "Please provide section name"],
    },
    videos: [
      {
        video: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Video",
          required: [true, "Please provide video id"],
        },

        _id: false,
      },
    ],
  },
  { timestamps: true }
);

const DashboardContentModel = mongoose.model(
  "DashboardContent",
  DashboardContentSchema
);

module.exports = DashboardContentModel;
